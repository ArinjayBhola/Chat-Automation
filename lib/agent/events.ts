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
  | { type: "error"; message: string }
  | { type: "done" };

export function encodeEvent(e: AgentEvent): string {
  return JSON.stringify(e) + "\n";
}
