import { NextResponse } from "next/server";
import { z } from "zod";
import type { ModelMessage } from "ai";
import { auth } from "@/lib/auth";
import { getToolConnections } from "@/lib/db-queries";
import { planFromMessage } from "@/lib/ai/mock-agent";
import { createAgentStream } from "@/lib/agent/agent";
import { toolNameToToolId } from "@/lib/agent/tools";
import { encodeEvent, type AgentEvent } from "@/lib/agent/events";
import { uid } from "@/lib/utils";
import type { Step, ToolId } from "@/lib/types";

export const maxDuration = 60;

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
  const { message, modelId, history } = parsed.data;

  // Which tools can this user actually use?
  const connected = new Set<ToolId>();
  if (!session.user.isDemo) {
    const conns = await getToolConnections(session.user.id);
    for (const c of conns) connected.add(c.tool as ToolId);
  }

  const messages: ModelMessage[] = [
    ...(history ?? []).map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: message },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AgentEvent) =>
        controller.enqueue(encoder.encode(encodeEvent(e)));

      try {
        // Real agent only when a provider is configured and the user isn't demo.
        const agent = session.user.isDemo
          ? null
          : await createAgentStream({
              ctx: { userId: session.user.id, connected },
              modelId: modelId ?? "claude-opus-4-8",
              messages,
            });

        if (!agent) {
          await runMock(send, message);
        } else {
          await runReal(send, agent.result.fullStream);
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
// Real agent → events (defensive about SDK part field names across versions)
// ---------------------------------------------------------------------------
async function runReal(
  send: (e: AgentEvent) => void,
  fullStream: AsyncIterable<unknown>,
) {
  const used = new Set<ToolId>();
  const steps = new Map<string, Step>();

  for await (const raw of fullStream) {
    const part = raw as Record<string, unknown>;
    const type = part.type as string;

    if (type === "text-delta" || type === "text") {
      const value = (part.text ?? part.textDelta ?? part.delta) as
        | string
        | undefined;
      if (value) send({ type: "text", value });
      continue;
    }

    if (type === "tool-call") {
      const id = (part.toolCallId as string) ?? uid("call");
      const name = part.toolName as string;
      const toolId = toolNameToToolId(name);
      if (toolId) used.add(toolId);
      const step: Step = {
        id,
        tool: toolId,
        action: humanizeTool(name, part.input ?? part.args),
        status: "in_progress",
      };
      steps.set(id, step);
      send({ type: "step", step });
      continue;
    }

    if (type === "tool-result") {
      const id = (part.toolCallId as string) ?? uid("call");
      const prev = steps.get(id);
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
      steps.set(id, step);
      send({ type: "step", step });

      if (needsApproval) {
        send({
          type: "approval",
          approval: output.approval as never,
        });
      }
      continue;
    }

    if (type === "tool-error") {
      const id = (part.toolCallId as string) ?? uid("call");
      const prev = steps.get(id);
      const err = part.error;
      const step: Step = {
        ...(prev ?? { id, tool: null, action: "tool" }),
        status: "failed",
        error: err instanceof Error ? err.message : String(err ?? "failed"),
      };
      steps.set(id, step);
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

  send({ type: "tools", tools: [...used] });
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
// Mock agent → events (demo mode / no provider configured)
// ---------------------------------------------------------------------------
async function runMock(send: (e: AgentEvent) => void, message: string) {
  const plan = planFromMessage(message);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  if (plan.toolsUsed.length > 0) {
    send({ type: "tools", tools: plan.toolsUsed });
  }

  for (const step of plan.steps) {
    send({ type: "step", step: { ...step, status: "in_progress" } });
    await sleep(350);
    send({ type: "step", step });
  }

  // Stream the summary text word-by-word for a live feel.
  const words = plan.content.split(" ");
  for (let i = 0; i < words.length; i++) {
    send({ type: "text", value: words[i] + (i < words.length - 1 ? " " : "") });
    if (i % 4 === 0) await sleep(25);
  }

  if (plan.approval) {
    send({ type: "approval", approval: plan.approval });
  }
}
