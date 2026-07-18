import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ModelMessage } from "ai";
import { auth } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import {
  createApproval,
  ensureChat,
  getToolConnections,
  incrementModelUsage,
  insertAuditLog,
  insertMessage,
  listChats,
} from "@/lib/db-queries";
import { createAgentRun } from "@/lib/agent/agent";
import type { EngineEvent } from "@/lib/agent/failover/types";
import { generateChatTitle } from "@/lib/agent/title";
import { toolNameToToolId } from "@/lib/agent/tools";
import { encodeEvent, type AgentEvent } from "@/lib/agent/events";
import { OP_KEY, type ApprovalOp } from "@/lib/agent/ops";
import { limiterKey, rateLimit } from "@/lib/rate-limit";
import { sanitizeMessage } from "@/lib/sanitize";
import { uid } from "@/lib/utils";
import type { ActionType, ClientApproval, Step, ToolId } from "@/lib/types";

export const maxDuration = 60;

/**
 * GET /api/chat — list the current user's (non-archived) chats for the sidebar.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await listChats(session.user.id);
  return NextResponse.json({
    chats: rows.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      pinnedAt: c.pinnedAt,
    })),
  });
}

const historyItem = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const bodySchema = z.object({
  message: z.string().min(1).max(8000),
  chatId: z.string().optional(),
  modelId: z.string().optional(),
  history: z.array(historyItem).max(40).optional(),
});

type PendingApproval = {
  approval: ClientApproval;
  op: ApprovalOp | null;
  args: Record<string, unknown>;
};

type Accumulator = {
  content: string;
  steps: Map<string, Step>;
  tools: Set<ToolId>;
  approvals: PendingApproval[];
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { modelId, history } = parsed.data;
  const chatId = parsed.data.chatId;
  const message = sanitizeMessage(parsed.data.message);
  if (!message) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  // Rate limit: 20 messages / minute / user.
  const rl = rateLimit(limiterKey("chat", session.user.id), 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You're sending messages too quickly. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const connected = new Set<ToolId>();
  const conns = await getToolConnections(session.user.id);
  for (const c of conns) connected.add(c.tool as ToolId);

  const messages: ModelMessage[] = [
    ...(history ?? []).map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: message },
  ];

  const persist = isDbEnabled;
  const userId = session.user.id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AgentEvent) =>
        controller.enqueue(encoder.encode(encodeEvent(e)));

      const acc: Accumulator = {
        content: "",
        steps: new Map(),
        tools: new Set(),
        approvals: [],
      };

      try {
        const { engine, state } = createAgentRun({
          ctx: { userId, connected },
          modelId: modelId ?? "claude-opus-4-8",
          messages,
          chatId,
        });

        await runReal(send, acc, engine.run());

        // Record accurate per-model token usage for the tracker (best-effort,
        // never blocks the response; requires a DB).
        if (isDbEnabled) {
          try {
            await incrementModelUsage(userId, state.modelUsageDeltas);
          } catch (e) {
            console.error("[chat] usage tracking failed:", e);
          }
        }

        if (persist) {
          await persistTurn(send, {
            userId,
            chatId,
            message,
            acc,
            modelId: modelId ?? "claude-opus-4-8",
          });
        }
      } catch (e) {
        send({
          type: "error",
          message: e instanceof Error ? e.message : "Agent error.",
        });
      } finally {
        send({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

// ---------------------------------------------------------------------------
// Persistence (non-demo + DB): chat, messages, approval rows, audit.
// ---------------------------------------------------------------------------
async function persistTurn(
  send: (e: AgentEvent) => void,
  input: {
    userId: string;
    chatId: string | undefined;
    message: string;
    acc: Accumulator;
    modelId: string;
  },
) {
  try {
    const realChatId = await ensureChat(
      input.userId,
      input.chatId,
      input.message,
      // Only invoked when a NEW chat is created (existing chats keep their name).
      () => generateChatTitle(input.modelId, input.message),
    );
    if (!realChatId) return;

    await insertMessage({
      chatId: realChatId,
      userId: input.userId,
      role: "user",
      content: input.message,
    });

    const assistantMessageId = randomUUID();
    await insertMessage({
      id: assistantMessageId,
      chatId: realChatId,
      userId: input.userId,
      role: "assistant",
      content: input.acc.content,
      toolUsed: [...input.acc.tools],
      executionSteps: [...input.acc.steps.values()],
    });

    for (const p of input.acc.approvals) {
      const args =
        Object.keys(p.args).length > 0
          ? p.args
          : Object.fromEntries(p.approval.fields.map((f) => [f.key, f.value]));
      await createApproval({
        id: p.approval.id,
        chatId: realChatId,
        messageId: assistantMessageId,
        userId: input.userId,
        actionType: p.approval.actionType as ActionType,
        toolName: p.approval.toolName,
        actionData: { ...args, [OP_KEY]: p.op ?? null },
        status: "pending",
      });
      await insertAuditLog({
        userId: input.userId,
        action: "approval.requested",
        targetType: "approval",
        targetId: p.approval.id,
        detail: { actionType: p.approval.actionType, op: p.op },
      });
    }

    send({ type: "meta", chatId: realChatId });
  } catch (e) {
    console.error("[chat] persistence failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Engine events → client events
//
// The ExecutionEngine yields provider-agnostic events: `sdk` parts (the AI SDK
// fullStream, mapped by handleSdkPart exactly as before) plus failover control
// events (provider switches, text resets, usage). Failover is transparent to
// the existing chat UI except for the new provider status line.
// ---------------------------------------------------------------------------
async function runReal(
  send: (e: AgentEvent) => void,
  acc: Accumulator,
  events: AsyncIterable<EngineEvent>,
) {
  for await (const event of events) {
    switch (event.kind) {
      case "sdk":
        handleSdkPart(send, acc, event.part);
        break;
      case "provider":
        send({
          type: "provider",
          provider: event.provider,
          label: event.label,
          status: event.status,
          reason: event.reason,
        });
        break;
      case "reset":
        // Drop the failed provider's uncommitted tail from the persisted copy
        // and tell the client to trim what it already rendered.
        acc.content = event.committedText;
        send({ type: "reset", content: event.committedText });
        break;
      case "usage":
        send({
          type: "usage",
          inputTokens: event.usage.inputTokens,
          outputTokens: event.usage.outputTokens,
          totalTokens: event.usage.totalTokens,
          costUsd: event.costUsd,
        });
        break;
      case "error":
        send({ type: "error", message: event.message });
        break;
    }
  }

  send({ type: "tools", tools: [...acc.tools] });
}

function handleSdkPart(
  send: (e: AgentEvent) => void,
  acc: Accumulator,
  raw: unknown,
) {
  {
    const part = raw as Record<string, unknown>;
    const type = part.type as string;

    if (type === "text-delta" || type === "text") {
      const value = (part.text ?? part.textDelta ?? part.delta) as
        | string
        | undefined;
      if (value) {
        acc.content += value;
        send({ type: "text", value });
      }
      return;
    }

    if (type === "tool-call") {
      const id = (part.toolCallId as string) ?? uid("call");
      const name = part.toolName as string;
      const toolId = toolNameToToolId(name);
      if (toolId) acc.tools.add(toolId);
      const input = part.input ?? part.args;
      const label = humanizeLabel(name);
      const step: Step = {
        id,
        tool: toolId,
        action: label,
        label,
        toolName: name,
        input: clampValue(input),
        status: "in_progress",
      };
      acc.steps.set(id, step);
      send({ type: "step", step });
      return;
    }

    if (type === "tool-result") {
      const id = (part.toolCallId as string) ?? uid("call");
      const prev = acc.steps.get(id);
      const output = (part.output ?? part.result) as
        | Record<string, unknown>
        | undefined;
      const needsApproval =
        output && output.status === "approval_required" && output.approval;

      const step: Step = {
        ...(prev ?? { id, tool: null, action: "tool" }),
        status: needsApproval ? "needs_approval" : "success",
        detail: needsApproval ? "Waiting for your approval." : undefined,
        // The approval payload isn't a useful "Response"; keep it hidden.
        output: needsApproval ? undefined : clampValue(output),
      };
      acc.steps.set(id, step);
      send({ type: "step", step });

      if (needsApproval) {
        const approval = output.approval as ClientApproval;
        const op = (output.op as ApprovalOp) ?? null;
        acc.approvals.push({
          approval,
          op,
          args: (output.args as Record<string, unknown>) ?? {},
        });
        // Carry the op so the client can echo it back for the no-DB fallback.
        send({ type: "approval", approval: { ...approval, op: op ?? undefined } });
      }
      return;
    }

    if (type === "tool-error") {
      const id = (part.toolCallId as string) ?? uid("call");
      const prev = acc.steps.get(id);
      const err = part.error;
      const step: Step = {
        ...(prev ?? { id, tool: null, action: "tool" }),
        status: "failed",
        error: err instanceof Error ? err.message : String(err ?? "failed"),
      };
      acc.steps.set(id, step);
      send({ type: "step", step });
      return;
    }

    if (type === "error") {
      const err = part.error;
      send({
        type: "error",
        message: err instanceof Error ? err.message : String(err ?? "error"),
      });
    }
  }
}

/** Friendly, human-readable label per tool for the steps timeline. */
const TOOL_LABELS: Record<string, string> = {
  gmail_search_emails: "Searching your inbox",
  gmail_read_email: "Reading an email",
  gmail_mark_as_read: "Marking as read",
  gmail_send_email: "Drafting an email",
  drive_search_files: "Searching Drive",
  drive_list_files: "Listing Drive files",
  drive_read_file: "Reading a file",
  drive_save_file: "Saving a file",
  docs_read_document: "Reading a document",
  docs_create_document: "Drafting a document",
  docs_update_document: "Preparing document edits",
  calendar_list_events: "Checking your calendar",
  calendar_search_events: "Searching events",
  calendar_create_event: "Drafting an event",
  notion_search_pages: "Searching Notion",
  notion_read_page: "Reading a Notion page",
  notion_create_page: "Drafting a Notion page",
  notion_update_page: "Preparing Notion edits",
};

function humanizeLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

/**
 * Keep small values structured (so the UI can pretty-print JSON), but cap large
 * payloads to a truncated string so persisted steps don't bloat the DB.
 */
function clampValue(v: unknown, max = 4000): unknown {
  if (v == null) return undefined;
  try {
    const s = JSON.stringify(v);
    if (s && s.length > max) return s.slice(0, max) + "… (truncated)";
    return v;
  } catch {
    return String(v);
  }
}
