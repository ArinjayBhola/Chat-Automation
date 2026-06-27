import type { ToolId } from "../types";

/**
 * Identifies exactly which write operation a pending approval will perform when
 * approved. Stored inside approval.actionData as `__op` so the executor can
 * dispatch precisely (e.g. distinguish "create a doc" from "append to a doc").
 */
export type ApprovalOp =
  | "gmail.send"
  | "calendar.create"
  | "docs.create"
  | "docs.append"
  | "notion.create"
  | "notion.update";

export const OP_TOOL: Record<ApprovalOp, ToolId> = {
  "gmail.send": "gmail",
  "calendar.create": "calendar",
  "docs.create": "docs",
  "docs.append": "docs",
  "notion.create": "notion",
  "notion.update": "notion",
};

/** Key under which the op is stored inside an approval's actionData JSON. */
export const OP_KEY = "__op";
