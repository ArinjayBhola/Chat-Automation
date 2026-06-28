import type { Variables } from "./runtime-helpers";

/**
 * In-memory runtime types for a single workflow run. These describe the live
 * execution (kept in memory and optionally mirrored to the DB), distinct from
 * the persisted row shapes in lib/schema.ts and the builder domain types in
 * lib/types/workflow.ts.
 */

export type RuntimeStatus =
  | "running"
  | "success"
  | "failed"
  | "paused"
  | "cancelled";

export type RuntimeStepStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

export type RuntimeErrorType =
  | "validation"
  | "execution"
  | "timeout"
  | "auth"
  | "unknown";

export interface RuntimeError {
  nodeId: string;
  type: RuntimeErrorType;
  message: string;
  timestamp: string;
  retryable: boolean;
  retryCount: number;
}

export interface RuntimeStep {
  stepId: string;
  nodeId: string;
  nodeType: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  status: RuntimeStepStatus;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  error?: string;
  /** Approval gate state, when the node is an approval node. */
  approvalStatus?: "pending" | "approved" | "rejected" | "timeout";
}

export interface RuntimeContext {
  workflowId: string;
  executionId: string;
  userId: string;
  status: RuntimeStatus;
  variables: Variables;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  steps: RuntimeStep[];
  errors: RuntimeError[];
}

/** Options controlling how a workflow is run. */
export interface RunOptions {
  /** Simulate tool calls instead of hitting external APIs (used by "Test"). */
  dryRun?: boolean;
  /** Persist the execution + steps to the database. */
  persist?: boolean;
  /** Trigger source recorded on the execution. */
  triggerType?: "manual" | "scheduled" | "webhook";
  /** Initial variables (trigger inputs). */
  inputs?: Variables;
  /** Hard cap on node executions to guarantee termination. */
  maxSteps?: number;
}
