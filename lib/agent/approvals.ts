import "server-only";
import {
  getApprovalById,
  insertAuditLog,
  updateApproval,
} from "../db-queries";
import { executeApproval } from "./execute";
import { OP_KEY, type ApprovalOp } from "./ops";

export type ApprovalDecision = "approved" | "rejected" | "skipped";

/** Convert the approval panel's edited fields into an args object. */
export function fieldsToArgs(
  fields: unknown,
): Record<string, unknown> | undefined {
  if (!Array.isArray(fields)) return undefined;
  const entries = fields
    .filter(
      (f): f is { key: string; value: unknown } =>
        f && typeof f === "object" && typeof f.key === "string",
    )
    .map((f) => [f.key, f.value] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export type DecisionResult = {
  ok: boolean;
  status: number;
  error?: string;
  summary?: string;
  alreadyResolved?: boolean;
};

/**
 * Applies a user's decision to a pending approval. For "approved" it actually
 * performs the action via the executor, then records status + an audit entry.
 * Edited field values (from the approval panel) override the stored args.
 */
export async function decideApproval(
  userId: string,
  id: string,
  decision: ApprovalDecision,
  editedArgs?: Record<string, unknown>,
): Promise<DecisionResult> {
  const row = await getApprovalById(id, userId);
  if (!row) {
    // No persisted row (no DB, or already gone) — let the caller fall back.
    return { ok: false, status: 404, error: "Approval not found." };
  }
  if (row.status !== "pending") {
    return { ok: true, status: 200, alreadyResolved: true };
  }

  if (decision === "rejected" || decision === "skipped") {
    await updateApproval(id, {
      status: decision,
      approvedBy: userId,
      approvedAt: new Date(),
    });
    await insertAuditLog({
      userId,
      action: `approval.${decision}`,
      targetType: "approval",
      targetId: id,
    });
    return { ok: true, status: 200 };
  }

  // approved → execute the action
  const stored = (row.actionData ?? {}) as Record<string, unknown>;
  const op = stored[OP_KEY] as ApprovalOp | null;
  const args: Record<string, unknown> = { ...stored, ...(editedArgs ?? {}) };
  delete args[OP_KEY];

  try {
    if (!op) throw new Error("This action has no executor configured.");
    const result = await executeApproval(userId, op, args);
    await updateApproval(id, {
      status: "approved",
      approvedBy: userId,
      approvedAt: new Date(),
      editedData: editedArgs ?? null,
    });
    await insertAuditLog({
      userId,
      action: "approval.approved",
      targetType: "approval",
      targetId: id,
      detail: { op, summary: result.summary },
    });
    return { ok: true, status: 200, summary: result.summary };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Execution failed.";
    await insertAuditLog({
      userId,
      action: "approval.execute_failed",
      targetType: "approval",
      targetId: id,
      detail: { op, error },
    });
    // 200 with ok:false so the client surfaces the message inline.
    return { ok: false, status: 200, error };
  }
}
