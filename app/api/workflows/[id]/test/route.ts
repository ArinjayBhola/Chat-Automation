import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { getWorkflow } from "@/lib/db-queries";
import { WorkflowExecutor } from "@/lib/workflows/workflow-executor";
import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";

export const maxDuration = 30;

/**
 * POST /api/workflows/[id]/test — validate, then dry-run the workflow.
 *
 * Static structure checks run first; if they pass, the execution engine runs in
 * DRY-RUN mode (tool calls simulated, no external side effects, no DB writes)
 * so the author can see how data would flow. The response is a superset of the
 * Phase 2 shape ({ ok, issues, nodeCount, edgeCount }) plus an `execution`
 * summary.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const workflow = await getWorkflow(id, session.user.id);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const nodes = (workflow.nodes ?? []) as WorkflowNode[];
  const edges = (workflow.edges ?? []) as WorkflowEdge[];

  // --- static validation ---------------------------------------------------
  const issues: string[] = [];
  if (nodes.length === 0) {
    issues.push("Add at least one node to the canvas.");
  }
  if (nodes.length > 0 && !nodes.some((n) => n.type === "trigger")) {
    issues.push("Add a trigger node so the workflow knows when to start.");
  }
  if (nodes.length > 1) {
    const connected = new Set<string>();
    for (const e of edges) {
      connected.add(e.source);
      connected.add(e.target);
    }
    for (const node of nodes) {
      if (!connected.has(node.id)) {
        issues.push(`"${node.data?.label ?? node.id}" is not connected to anything.`);
      }
    }
  }

  if (issues.length > 0) {
    return NextResponse.json({
      ok: false,
      issues,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    });
  }

  // --- dry run -------------------------------------------------------------
  const body = (await req.json().catch(() => ({}))) as {
    inputs?: Record<string, unknown>;
  };

  const executor = new WorkflowExecutor({
    workflowId: id,
    executionId: randomUUID(),
    userId: session.user.id,
    nodes,
    edges,
    options: {
      dryRun: true,
      persist: false,
      triggerType: "manual",
      inputs: body?.inputs ?? {},
    },
  });

  const result = await executor.execute();
  const errorMessages = result.errors.map((e) => e.message);

  return NextResponse.json({
    ok: result.status !== "failed",
    issues: errorMessages,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    execution: {
      status: result.status,
      durationMs: result.durationMs,
      steps: result.steps,
      variables: result.variables,
      errors: result.errors,
    },
  });
}
