import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getWorkflow, getWorkflowVersions } from "@/lib/db-queries";

/**
 * GET /api/workflows/[id]/versions — version history for a workflow.
 * Query params: limit (default 10).
 */
export async function GET(
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

  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 10) || 10, 1),
    100,
  );
  const versions = await getWorkflowVersions(id, limit);
  return NextResponse.json({ versions, workflowId: id });
}
