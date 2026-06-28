/**
 * Domain types for the workflow automation system (Phase 1).
 *
 * These are the rich, app-facing shapes used by the API layer, the (future)
 * builder UI, and the execution engine. They are deliberately separate from the
 * Drizzle row types inferred in `lib/schema.ts` (which carry DB-specific quirks
 * like nullability and `null` instead of `undefined`). The `*Row` types from the
 * schema describe what is stored; the types below describe what we work with.
 */

// ---------------------------------------------------------------------------
// Graph: nodes + edges
// ---------------------------------------------------------------------------
export type WorkflowNodeType =
  | "trigger"
  | "tool"
  | "condition"
  | "loop"
  | "transform"
  | "delay";

export interface WorkflowNode {
  /** Stable UUID for the node, generated client-side in the builder. */
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    [key: string]: unknown;
  };
}

export interface WorkflowEdge {
  id: string;
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------
export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isActive: boolean;
  isPublished: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Fields a client may set when creating or updating a workflow. */
export interface WorkflowInput {
  name?: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------
export type ExecutionStatus = "running" | "success" | "failed" | "paused";
export type TriggerType = "manual" | "scheduled" | "webhook";

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  userId: string;
  status: ExecutionStatus;
  triggerType: TriggerType;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  error?: string;
  createdAt: Date;
}

export type StepStatus = "pending" | "running" | "success" | "failed";

export interface ExecutionStep {
  id: string;
  executionId: string;
  stepIndex: number;
  nodeId: string;
  nodeType: WorkflowNodeType;
  status: StepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string;
  duration?: number;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------
export interface WorkflowSchedule {
  id: string;
  workflowId: string;
  /** Cron expression, e.g. "0 9 * * 1" (9am every Monday). */
  schedule: string;
  /** IANA timezone, e.g. "America/New_York". */
  timezone: string;
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------
export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: Date;
}
