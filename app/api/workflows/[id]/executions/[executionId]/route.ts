import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getExecution, getWorkflow } from "@/lib/db-queries";

/**
 * GET /api/workflows/[id]/executions/[executionId] — single execution details.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; executionId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, executionId } = await ctx.params;

  const workflow = await getWorkflow(id, session.user.id);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const execution = await getExecution(executionId);
  if (!execution || execution.workflowId !== id) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }
  return NextResponse.json(execution);
}
