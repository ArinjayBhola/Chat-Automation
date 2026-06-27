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
  insertAuditLog,
  insertMessage,
  listChats,
} from "@/lib/db-queries";
import { planFromMessage } from "@/lib/ai/mock-agent";
import { createAgentStream } from "@/lib/agent/agent";
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
  if (session.user.isDemo) {
    return NextResponse.json({ chats: [] });
  }
  const rows = await listChats(session.user.id);
  return NextResponse.json({
    chats: rows.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
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
  if (!session.user.isDemo) {
    const conns = await getToolConnections(session.user.id);
    for (const c of conns) connected.add(c.tool as ToolId);
  }

  const messages: ModelMessage[] = [
    ...(history ?? []).map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: message },
  ];

  const persist = !session.user.isDemo && isDbEnabled;
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
        const agent = session.user.isDemo
          ? null
          : await createAgentStream({
              ctx: { userId, connected },
              modelId: modelId ?? "claude-opus-4-8",
              messages,
            });

        if (!agent) {
          await runMock(send, acc, message);
        } else {
          await runReal(send, acc, agent.result.fullStream);
        }

        if (persist) {
          await persistTurn(send, { userId, chatId, message, acc });
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
  },
) {
  try {
    const realChatId = await ensureChat(input.userId, input.chatId, input.message);
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
// Real agent → events
// ---------------------------------------------------------------------------
async function runReal(
  send: (e: AgentEvent) => void,
  acc: Accumulator,
  fullStream: AsyncIterable<unknown>,
) {
  for await (const raw of fullStream) {
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
      continue;
    }

    if (type === "tool-call") {
      const id = (part.toolCallId as string) ?? uid("call");
      const name = part.toolName as string;
      const toolId = toolNameToToolId(name);
      if (toolId) acc.tools.add(toolId);
      const step: Step = {
        id,
        tool: toolId,
        action: humanizeTool(name, part.input ?? part.args),
        status: "in_progress",
      };
      acc.steps.set(id, step);
      send({ type: "step", step });
      continue;
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
      };
      acc.steps.set(id, step);
      send({ type: "step", step });

      if (needsApproval) {
        const approval = output.approval as ClientApproval;
        acc.approvals.push({
          approval,
          op: (output.op as ApprovalOp) ?? null,
          args: (output.args as Record<string, unknown>) ?? {},
        });
        send({ type: "approval", approval });
      }
      continue;
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
      continue;
    }

    if (type === "error") {
      const err = part.error;
      send({
        type: "error",
        message: err instanceof Error ? err.message : String(err ?? "error"),
      });
    }
  }

  send({ type: "tools", tools: [...acc.tools] });
}

function humanizeTool(name: string, input: unknown): string {
  const args =
    input && typeof input === "object"
      ? Object.entries(input as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${truncate(String(v), 40)}`)
          .join(", ")
      : "";
  return `${name}(${args})`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ---------------------------------------------------------------------------
// Mock agent → events (demo / no provider)
// ---------------------------------------------------------------------------
const ACTION_OP: Record<string, ApprovalOp> = {
  send_email: "gmail.send",
  create_event: "calendar.create",
  update_doc: "docs.create",
  create_notion_page: "notion.create",
};

async function runMock(
  send: (e: AgentEvent) => void,
  acc: Accumulator,
  message: string,
) {
  const plan = planFromMessage(message);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (const t of plan.toolsUsed) acc.tools.add(t);
  if (plan.toolsUsed.length > 0) send({ type: "tools", tools: plan.toolsUsed });

  for (const step of plan.steps) {
    send({ type: "step", step: { ...step, status: "in_progress" } });
    await sleep(300);
    acc.steps.set(step.id, step);
    send({ type: "step", step });
  }

  const words = plan.content.split(" ");
  for (let i = 0; i < words.length; i++) {
    const value = words[i] + (i < words.length - 1 ? " " : "");
    acc.content += value;
    send({ type: "text", value });
    if (i % 4 === 0) await sleep(20);
  }

  if (plan.approval) {
    acc.approvals.push({
      approval: plan.approval,
      op: ACTION_OP[plan.approval.actionType] ?? null,
      args: Object.fromEntries(plan.approval.fields.map((f) => [f.key, f.value])),
    });
    send({ type: "approval", approval: plan.approval });
  }
}
