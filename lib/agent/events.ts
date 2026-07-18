import type { ClientApproval, Step, ToolId } from "../types";

/**
 * NDJSON streaming protocol between /api/chat and the client. One JSON object
 * per line. Kept tiny and explicit so the rich UI (streamed text + live steps +
 * approval gate) works without adopting a heavier client framework.
 */
export type AgentEvent =
  | { type: "text"; value: string }
  | { type: "step"; step: Step }
  | { type: "approval"; approval: ClientApproval }
  | { type: "tools"; tools: ToolId[] }
  | { type: "meta"; chatId: string }
  | { type: "error"; message: string }
  /** Failover: which provider is producing output now, and why it switched. */
  | {
      type: "provider";
      provider: string;
      label: string;
      status: "active" | "switched" | "exhausted";
      reason?: string;
    }
  /** Failover: discard streamed-but-uncommitted text, reset to this baseline. */
  | { type: "reset"; content: string }
  /** Token + cost accounting for the run (all providers combined). */
  | {
      type: "usage";
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      costUsd: number;
    }
  | { type: "done" };

export function encodeEvent(e: AgentEvent): string {
  return JSON.stringify(e) + "\n";
}
