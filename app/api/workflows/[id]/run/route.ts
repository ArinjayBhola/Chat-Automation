import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { createExecution, getWorkflow } from "@/lib/db-queries";
import { limiterKey, rateLimit } from "@/lib/rate-limit";
import { WorkflowExecutor } from "@/lib/workflows/workflow-executor";
import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";

export const maxDuration = 60;

/**
 * POST /api/workflows/[id]/run — really execute a published workflow.
 *
 * Creates an execution record, runs the engine (real tool calls), persists each
 * step, and returns the final execution summary. Consequential tool writes are
 * performed here; use the approval node to gate them with a human.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDbEnabled) {
    return NextResponse.json(
      { error: "A database is required to run workflows." },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;

  const workflow = await getWorkflow(id, session.user.id);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }
  if (!workflow.isPublished) {
    return NextResponse.json(
      { error: "Publish the workflow before running it." },
      { status: 400 },
    );
  }

  const rl = rateLimit(limiterKey("workflow:run", session.user.id), 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many runs. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    inputs?: Record<string, unknown>;
    triggerType?: "manual" | "scheduled" | "webhook";
  };
  const triggerType = body?.triggerType ?? "manual";

  const execution = await createExecution(
    id,
    session.user.id,
    triggerType,
    body?.inputs ?? {},
  );
  if (!execution) {
    return NextResponse.json(
      { error: "Failed to start execution." },
      { status: 500 },
    );
  }

  const executor = new WorkflowExecutor({
    workflowId: id,
    executionId: execution.id,
    userId: session.user.id,
    nodes: (workflow.nodes ?? []) as WorkflowNode[],
    edges: (workflow.edges ?? []) as WorkflowEdge[],
    options: {
      dryRun: false,
      persist: true,
      triggerType,
      inputs: body?.inputs ?? {},
    },
  });

  const result = await executor.execute();

  return NextResponse.json({
    executionId: execution.id,
    status: result.status,
    durationMs: result.durationMs,
    stepCount: result.steps.length,
    steps: result.steps,
    variables: result.variables,
    errors: result.errors,
  });
}
