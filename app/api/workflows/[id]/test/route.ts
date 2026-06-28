import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getWorkflow } from "@/lib/db-queries";
import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";

/**
 * POST /api/workflows/[id]/test — static validation / dry-run of a workflow.
 *
 * Phase 2 only validates the graph structure (no side effects). The real
 * execution engine that runs nodes arrives in Phase 3. Returns a list of issues
 * so the builder can surface what needs fixing before publishing.
 */
export async function POST(
  _req: NextRequest,
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
  const issues: string[] = [];

  if (nodes.length === 0) {
    issues.push("Add at least one node to the canvas.");
  }
  if (nodes.length > 0 && !nodes.some((n) => n.type === "trigger")) {
    issues.push("Add a trigger node so the workflow knows when to start.");
  }

  // Flag disconnected nodes once there's more than one node.
  if (nodes.length > 1) {
    const connected = new Set<string>();
    for (const e of edges) {
      connected.add(e.source);
      connected.add(e.target);
    }
    for (const n of nodes) {
      if (!connected.has(n.id)) {
        issues.push(`"${n.data?.label ?? n.id}" is not connected to anything.`);
      }
    }
  }

  return NextResponse.json({
    ok: issues.length === 0,
    issues,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  });
}
