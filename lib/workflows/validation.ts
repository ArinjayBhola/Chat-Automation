import { z } from "zod";
import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";

/**
 * Shared request validation for the workflow API routes. Node/edge graphs are
 * stored verbatim as JSON, so we validate the structural shape here (and at the
 * route boundary) rather than trusting client input blindly.
 */

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["trigger", "tool", "condition", "loop", "transform", "delay"]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z
    .object({ label: z.string(), description: z.string().optional() })
    .passthrough(),
});

export const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const nodesSchema = z.array(workflowNodeSchema).max(500);
export const edgesSchema = z.array(workflowEdgeSchema).max(1000);

/** Coerce validated JSON into the domain node/edge types. */
export function asNodes(value: unknown): WorkflowNode[] {
  return value as WorkflowNode[];
}
export function asEdges(value: unknown): WorkflowEdge[] {
  return value as WorkflowEdge[];
}

/**
 * Lightweight cron validation: 5 or 6 space-separated fields of allowed
 * characters. Full semantic validation happens in the scheduler (Phase 4).
 */
export function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) return false;
  return parts.every((p) => /^[0-9*/,\-?LW#]+$/.test(p));
}

/** Best-effort IANA timezone check using the Intl API. */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
