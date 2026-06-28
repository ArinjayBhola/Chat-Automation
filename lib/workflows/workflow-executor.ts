import "server-only";
import { randomUUID } from "node:crypto";
import {
  addExecutionStep,
  updateExecutionStatus,
  updateExecutionStep,
} from "@/lib/db-queries";
import type {
  ApprovalConfig,
  ConditionConfig,
  DelayConfig,
  EndConfig,
  LoopConfig,
  ToolConfig,
  TransformConfig,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import {
  convertToMs,
  evaluateConditions,
  getPath,
  resolveParameters,
  runTransform,
  type RuntimeCondition,
} from "./runtime-helpers";
import {
  type RunOptions,
  type RuntimeContext,
  type RuntimeError,
  type RuntimeErrorType,
  type RuntimeStep,
} from "./execution-types";
import { ToolAuthError, ToolExecutor } from "./tool-executor";

const DEFAULT_MAX_STEPS = 250;
const HARD_LOOP_CAP = 1000;
// Cap real delays so a synchronous run can't hang the request indefinitely.
const MAX_REAL_DELAY_MS = 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ExecutorArgs {
  workflowId: string;
  executionId: string;
  userId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  options?: RunOptions;
}

/**
 * Runs a workflow graph node-by-node, threading a variable bag between steps,
 * branching on conditions, iterating loops, evaluating transforms, and pausing
 * at approval gates. Traversal is bounded by a step budget so it always
 * terminates even if the graph contains cycles.
 */
export class WorkflowExecutor {
  private readonly ctx: RuntimeContext;
  private readonly nodes: WorkflowNode[];
  private readonly edges: WorkflowEdge[];
  private readonly byId: Map<string, WorkflowNode>;
  private readonly tools: ToolExecutor;
  private readonly dryRun: boolean;
  private readonly persist: boolean;
  private budget: number;

  constructor(args: ExecutorArgs) {
    const opts = args.options ?? {};
    this.dryRun = opts.dryRun ?? false;
    this.persist = opts.persist ?? false;
    this.budget = opts.maxSteps ?? DEFAULT_MAX_STEPS;
    this.nodes = args.nodes;
    this.edges = args.edges;
    this.byId = new Map(args.nodes.map((n) => [n.id, n]));
    this.tools = new ToolExecutor(args.userId, this.dryRun);
    this.ctx = {
      workflowId: args.workflowId,
      executionId: args.executionId,
      userId: args.userId,
      status: "running",
      variables: { ...(opts.inputs ?? {}) },
      startedAt: new Date().toISOString(),
      steps: [],
      errors: [],
    };
  }

  async execute(): Promise<RuntimeContext> {
    try {
      const trigger = this.nodes.find((n) => n.type === "trigger");
      if (!trigger) {
        this.addError("", "validation", "No trigger node found.", false);
        this.ctx.status = "failed";
      } else {
        await this.runFrom(trigger.id);
        if (this.ctx.status === "running") this.ctx.status = "success";
      }
    } catch (e) {
      this.ctx.status = "failed";
      this.addError("", "unknown", errMessage(e), false);
    }

    this.ctx.finishedAt = new Date().toISOString();
    this.ctx.durationMs =
      new Date(this.ctx.finishedAt).getTime() -
      new Date(this.ctx.startedAt).getTime();

    await this.finalize();
    return this.ctx;
  }

  // --- traversal -----------------------------------------------------------
  private async runFrom(nodeId: string | undefined): Promise<void> {
    if (!nodeId || this.ctx.status !== "running") return;
    if (this.budget <= 0) {
      this.addError(nodeId, "timeout", "Step budget exceeded.", false);
      this.ctx.status = "failed";
      return;
    }
    const node = this.byId.get(nodeId);
    if (!node) {
      this.addError(nodeId, "execution", `Node ${nodeId} not found.`, false);
      this.ctx.status = "failed";
      return;
    }
    this.budget -= 1;

    const next = await this.executeNode(node);
    for (const id of next) {
      if (this.ctx.status !== "running") break;
      await this.runFrom(id);
    }
  }

  private async executeNode(node: WorkflowNode): Promise<string[]> {
    const step: RuntimeStep = {
      stepId: randomUUID(),
      nodeId: node.id,
      nodeType: node.type,
      startedAt: new Date().toISOString(),
      status: "running",
      inputs: {},
      outputs: {},
    };
    let next: string[] = [];
    try {
      next = await this.dispatch(node, step);
      if (step.status === "running") step.status = "success";
    } catch (e) {
      step.status = "failed";
      step.error = errMessage(e);
      this.addError(node.id, classify(e), errMessage(e), isRetryable(e));
      this.ctx.status = "failed";
      next = [];
    } finally {
      step.finishedAt = new Date().toISOString();
      step.durationMs =
        new Date(step.finishedAt).getTime() -
        new Date(step.startedAt).getTime();
      this.ctx.steps.push(step);
      await this.persistStep(step);
    }
    return next;
  }

  private async dispatch(
    node: WorkflowNode,
    step: RuntimeStep,
  ): Promise<string[]> {
    switch (node.type) {
      case "trigger":
        return this.runTrigger(step, node.id);
      case "tool":
        return this.runTool(node, step);
      case "condition":
        return this.runCondition(node, step);
      case "loop":
        return this.runLoop(node, step);
      case "delay":
        return this.runDelay(node, step);
      case "transform":
        return this.runTransformNode(node, step);
      case "approval":
        return this.runApproval(node, step);
      case "end":
        return this.runEnd(node, step);
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  // --- node handlers -------------------------------------------------------
  private runTrigger(step: RuntimeStep, nodeId: string): string[] {
    step.outputs = {
      message: "Workflow triggered",
      timestamp: new Date().toISOString(),
    };
    return this.outgoing(nodeId);
  }

  private async runTool(
    node: WorkflowNode,
    step: RuntimeStep,
  ): Promise<string[]> {
    const cfg = (node.data.config ?? {}) as ToolConfig & {
      outputVariable?: string;
    };
    const params = resolveParameters(cfg.parameters, this.ctx.variables);
    step.inputs = params;

    const result = await this.tools.execute(cfg.toolName, cfg.action, params);

    const outName = cfg.outputVariable || `${cfg.toolName}_result`;
    this.ctx.variables[outName] = result.data;
    step.outputs = {
      result: result.data,
      storedIn: outName,
      simulated: result.simulated,
    };
    return this.outgoing(node.id);
  }

  private runCondition(node: WorkflowNode, step: RuntimeStep): string[] {
    const cfg = (node.data.config ?? {}) as ConditionConfig;
    const conditions = (cfg.conditions ?? []) as RuntimeCondition[];
    const result = evaluateConditions(
      conditions,
      cfg.combineWith ?? "AND",
      this.ctx.variables,
    );
    step.inputs = { conditions, combineWith: cfg.combineWith ?? "AND" };
    step.outputs = { result };

    const branch = result ? "true" : "false";
    const out = this.edgesFrom(node.id);
    let chosen = out.filter((e) => (e.sourceHandle ?? null) === branch);
    if (chosen.length === 0 && result) {
      // Fall back to unlabeled edges for the truthy branch.
      chosen = out.filter((e) => e.sourceHandle == null);
    }
    return chosen.map((e) => e.target);
  }

  private async runLoop(
    node: WorkflowNode,
    step: RuntimeStep,
  ): Promise<string[]> {
    const cfg = (node.data.config ?? {}) as LoopConfig;
    const arr = getPath(this.ctx.variables, cfg.array);
    if (!Array.isArray(arr)) {
      throw new Error(`Loop variable "${cfg.array}" is not an array.`);
    }
    const bodyStart = this.outgoing(node.id)[0];
    const max = Math.min(
      arr.length,
      cfg.maxIterations || arr.length,
      HARD_LOOP_CAP,
    );
    const itemVar = cfg.itemVariableName || "item";

    let processed = 0;
    for (let i = 0; i < max; i += 1) {
      if (this.ctx.status !== "running" || this.budget <= 0) break;
      this.ctx.variables[itemVar] = arr[i];
      this.ctx.variables[`${itemVar}_index`] = i;
      if (bodyStart) await this.runFrom(bodyStart);
      processed += 1;
    }
    step.inputs = { array: cfg.array, itemCount: arr.length };
    step.outputs = { itemsProcessed: processed };
    // The loop body owns the downstream path; nothing further to traverse here.
    return [];
  }

  private async runDelay(
    node: WorkflowNode,
    step: RuntimeStep,
  ): Promise<string[]> {
    const cfg = (node.data.config ?? {}) as DelayConfig;
    const requestedMs = convertToMs(cfg.duration ?? 0, cfg.unit ?? "seconds");
    step.inputs = { duration: cfg.duration, unit: cfg.unit, requestedMs };

    if (this.dryRun) {
      step.outputs = { waited: false, requestedMs, simulated: true };
    } else {
      const waitMs = Math.min(requestedMs, MAX_REAL_DELAY_MS);
      await sleep(waitMs);
      step.outputs = { waited: true, waitedMs: waitMs, requestedMs };
    }
    return this.outgoing(node.id);
  }

  private runTransformNode(node: WorkflowNode, step: RuntimeStep): string[] {
    const cfg = (node.data.config ?? {}) as TransformConfig;
    step.inputs = { transformations: cfg.transformations ?? [] };
    const outputs: Record<string, unknown> = {};
    for (const t of cfg.transformations ?? []) {
      if (!t.outputVariable) continue;
      try {
        const value = runTransform(t.expression, this.ctx.variables);
        this.ctx.variables[t.outputVariable] = value;
        outputs[t.outputVariable] = value;
      } catch (e) {
        throw new Error(
          `Transform "${t.outputVariable}" failed: ${errMessage(e)}`,
        );
      }
    }
    step.outputs = outputs;
    return this.outgoing(node.id);
  }

  private runApproval(node: WorkflowNode, step: RuntimeStep): string[] {
    const cfg = (node.data.config ?? {}) as ApprovalConfig;
    step.inputs = { approvers: cfg.approvers ?? [], message: cfg.message };
    step.outputs = { status: "pending" };
    step.approvalStatus = "pending";
    // Human-in-the-loop: pause here. Resuming approved runs is handled by the
    // approval workflow (Phase 5); the engine simply stops at the gate.
    this.ctx.status = "paused";
    return [];
  }

  private runEnd(node: WorkflowNode, step: RuntimeStep): string[] {
    const cfg = (node.data.config ?? {}) as EndConfig;
    step.outputs = { status: cfg.status ?? "success", note: cfg.note };
    if (cfg.status === "failed") {
      this.ctx.status = "failed";
      this.addError(node.id, "execution", cfg.note || "Workflow ended in a failed state.", false);
    }
    return [];
  }

  // --- helpers -------------------------------------------------------------
  private edgesFrom(nodeId: string): WorkflowEdge[] {
    return this.edges.filter((e) => e.source === nodeId);
  }

  private outgoing(nodeId: string): string[] {
    return this.edgesFrom(nodeId).map((e) => e.target);
  }

  private addError(
    nodeId: string,
    type: RuntimeErrorType,
    message: string,
    retryable: boolean,
  ): void {
    const err: RuntimeError = {
      nodeId,
      type,
      message,
      timestamp: new Date().toISOString(),
      retryable,
      retryCount: 0,
    };
    this.ctx.errors.push(err);
  }

  private async persistStep(step: RuntimeStep): Promise<void> {
    if (!this.persist) return;
    try {
      const row = await addExecutionStep(
        this.ctx.executionId,
        step.nodeId,
        step.nodeType,
        step.inputs,
      );
      if (row) {
        await updateExecutionStep(
          row.id,
          step.status === "running" ? "success" : step.status === "skipped" ? "success" : step.status,
          step.outputs,
          step.error,
        );
      }
    } catch (e) {
      // Logging must never break execution.
      console.error("[workflow] failed to persist step:", e);
    }
  }

  private async finalize(): Promise<void> {
    if (!this.persist) return;
    const status =
      this.ctx.status === "success" || this.ctx.status === "failed"
        ? this.ctx.status
        : this.ctx.status === "paused"
          ? "paused"
          : "running";
    try {
      await updateExecutionStatus(
        this.ctx.executionId,
        status,
        {
          variables: this.ctx.variables,
          stepCount: this.ctx.steps.length,
          errors: this.ctx.errors,
        },
        this.ctx.errors[0]?.message,
      );
    } catch (e) {
      console.error("[workflow] failed to finalize execution:", e);
    }
  }
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e ?? "Unknown error");
}

function classify(e: unknown): RuntimeErrorType {
  if (e instanceof ToolAuthError) return "auth";
  return "execution";
}

function isRetryable(e: unknown): boolean {
  // Auth errors aren't retryable without reconnecting; treat others as transient.
  return !(e instanceof ToolAuthError);
}
