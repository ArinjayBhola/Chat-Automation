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
  | "delay"
  | "approval"
  | "end";

// ---------------------------------------------------------------------------
// Per-node configuration shapes
// ---------------------------------------------------------------------------
export interface TriggerConfig {
  type: "schedule" | "webhook" | "manual";
  scheduleId?: string;
  webhookUrl?: string;
  description: string;
}

export type ToolName = "gmail" | "drive" | "docs" | "calendar" | "notion";

export interface ToolConfig {
  toolName: ToolName;
  action: string; // e.g. "send_email", "search_files"
  parameters: Record<string, unknown>;
  /** Map node inputs from workflow variables. */
  inputMapping?: Record<string, string>;
}

export type ConditionOperator =
  | "=="
  | "!="
  | ">"
  | "<"
  | "includes"
  | "exists";

export interface ConditionRule {
  variable: string;
  operator: ConditionOperator;
  value: string;
}

export interface ConditionConfig {
  conditions: ConditionRule[];
  combineWith: "AND" | "OR";
}

export interface LoopConfig {
  array: string; // variable name containing the array
  itemVariableName: string; // name bound to each item
  maxIterations: number;
}

export interface DelayConfig {
  duration: number;
  unit: "seconds" | "minutes" | "hours" | "days";
}

export interface TransformRule {
  outputVariable: string;
  expression: string; // JS expression
}

export interface TransformConfig {
  transformations: TransformRule[];
  language: "javascript";
}

export interface ApprovalConfig {
  approvers: string[];
  timeout?: number; // minutes
  message: string;
}

export interface EndConfig {
  status?: "success" | "failed";
  note?: string;
}

export type NodeConfig =
  | TriggerConfig
  | ToolConfig
  | ConditionConfig
  | LoopConfig
  | DelayConfig
  | TransformConfig
  | ApprovalConfig
  | EndConfig
  | Record<string, never>;

/** The `data` payload carried by every node in the React Flow graph. */
export interface WorkflowNodeData {
  label: string;
  description?: string;
  config?: NodeConfig;
  inputs?: string[];
  outputs?: string[];
  [key: string]: unknown;
}

export interface WorkflowNode {
  /** Stable id for the node, generated client-side in the builder. */
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  /** Source/target handle ids (used by branching nodes like condition). */
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: {
    label?: string;
    condition?: string;
    [key: string]: unknown;
  };
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
