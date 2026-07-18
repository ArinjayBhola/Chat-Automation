/**
 * Shared client/server types for the chat experience. Kept framework-agnostic
 * so both API routes and React components can import them.
 */

export type ToolId = "gmail" | "drive" | "docs" | "calendar" | "notion";

export type ToolStatus = {
  id: ToolId;
  name: string;
  connected: boolean;
};

export type StepStatus =
  | "pending"
  | "in_progress"
  | "success"
  | "failed"
  | "needs_approval";

export type Step = {
  id: string;
  tool: ToolId | null;
  action: string;
  status: StepStatus;
  detail?: string;
  error?: string;
  /** Human phrase for the step, e.g. "Searching Notion". Falls back to action. */
  label?: string;
  /** Raw tool name, e.g. "notion_create_page". */
  toolName?: string;
  /** Arguments the tool was called with (the "Request"). */
  input?: unknown;
  /** Result the tool returned (the "Response"); omitted for approval prompts. */
  output?: unknown;
};

export type ActionType =
  | "send_email"
  | "create_event"
  | "update_doc"
  | "create_notion_page";

export type ApprovalField = {
  key: string;
  label: string;
  value: string;
  multiline?: boolean;
  options?: { label: string; value: string }[];
};

export type ApprovalStatus = "pending" | "approved" | "rejected" | "skipped";

export type ClientApproval = {
  id: string;
  actionType: ActionType;
  toolName: string;
  description: string;
  fields: ApprovalField[];
  status: ApprovalStatus;
  /** seconds remaining before auto-skip; null when not counting down */
  timeoutSeconds?: number;
  /**
   * Write op this approval will run (e.g. "notion.create"). Sent to the client
   * only so it can be echoed back to execute when the DB is disabled (no
   * persisted row to look the op up from). Ignored when a DB row exists.
   */
  op?: string;
};

export type ChatRole = "user" | "assistant";

export type ClientMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  toolsUsed: ToolId[];
  steps: Step[];
  approval?: ClientApproval;
  /** UI state: assistant message still being produced. */
  thinking?: boolean;
  /** True once the stream has fully finished (drives the steps "Done" row). */
  done?: boolean;
  /** Failover: label of the provider currently producing this message. */
  activeProvider?: string;
  /** Failover: human notes about provider switches during this run. */
  providerNotes?: string[];
  /** Token + cost accounting for the run, once known. */
  usage?: { totalTokens: number; costUsd: number };
};

export type ChatRequest = {
  message: string;
  chatId?: string;
  modelId?: string;
};

export type ChatResponse = {
  chatId: string;
  message: ClientMessage;
};

export const TOOL_META: Record<ToolId, { name: string }> = {
  gmail: { name: "Gmail" },
  drive: { name: "Google Drive" },
  docs: { name: "Google Docs" },
  calendar: { name: "Google Calendar" },
  notion: { name: "Notion" },
};

export const APPROVAL_TIMEOUT_SECONDS = 30;
