import "server-only";
import { type ModelMessage } from "ai";
import { buildTools, type AgentContext } from "./tools";
import { TOOL_META, type ToolId } from "../types";
import { ExecutionState } from "./failover/execution-state";
import { ExecutionEngine } from "./failover/execution-engine";
import { ProviderManager } from "./failover/provider-manager";
import { CheckpointManager } from "./failover/checkpoint-manager";
import { getHealthMonitor } from "./failover/health-monitor";

const MAX_STEPS = 8;

function systemPrompt(connected: ToolId[]): string {
  const toolList =
    connected.length > 0
      ? connected.map((t) => `- ${TOOL_META[t].name}`).join("\n")
      : "(none connected yet)";

  return `You are Relay, an autonomous assistant that orchestrates a user's tools to fulfil plain-English requests.

Connected tools you may use this session:
${toolList}

Operating rules:
- Break the request into the minimum set of steps. Use ONLY tools that are relevant; never call a tool that isn't needed.
- If a needed tool is not connected, tell the user it isn't connected and what to do, then continue with whatever you can.
- Pass data between steps (e.g. email ids found by a search into a read call).
- NEVER invent, guess, or fabricate resource ids (document id, Notion page/parent id, file id, email id, event id). If a write or update action needs an id, FIRST use a search/list/read tool to obtain the real id from the user's account, then use that exact value. If you still cannot find it, ask the user instead of guessing.
- Never pass placeholder strings such as "approval_required", "undefined", "unknown", "none", or an empty string as an id.
- SENSITIVE actions (sending email, creating events, creating/updating docs or Notion pages) return "approval_required" instead of acting. When that happens, do NOT retry the tool — briefly tell the user it's awaiting their approval and stop.
- If a tool call fails, note the error and continue with the other steps rather than aborting everything.
- If the request is too vague to act on, ask a short clarifying question instead of guessing.
- Finish with a concise, human-readable summary of what you did, what's pending approval, and any errors. Use markdown.`;
}

/**
 * Build a failover-aware, checkpoint-based agent run.
 *
 * Instead of binding to a single provider, this returns an ExecutionEngine that
 * streams over the provider chain: it commits each completed step into
 * Relay-owned working memory (ExecutionState) and, on a recoverable provider
 * failure, hands that same memory to the next provider so the run continues
 * from the point of failure rather than restarting. Checkpoints are persisted
 * to Postgres (best-effort) at every step boundary and provider switch.
 */
export function createAgentRun(opts: {
  ctx: AgentContext;
  modelId: string;
  messages: ModelMessage[];
  chatId?: string;
}): { engine: ExecutionEngine; state: ExecutionState } {
  const connected = [...opts.ctx.connected];
  const tools = buildTools(opts.ctx);
  const health = getHealthMonitor();

  const state = new ExecutionState({
    userId: opts.ctx.userId,
    input: opts.messages,
    chatId: opts.chatId,
  });

  const checkpoints = new CheckpointManager();

  const engine = new ExecutionEngine({
    state,
    requestedModelId: opts.modelId,
    system: systemPrompt(connected),
    tools,
    providerManager: new ProviderManager({ health }),
    health,
    checkpoint: (s) => checkpoints.save(s),
    maxSteps: MAX_STEPS,
  });

  return { engine, state };
}
