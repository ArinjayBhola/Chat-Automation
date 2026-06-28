import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getWorkflow, listExecutions } from "@/lib/db-queries";
import type { WorkflowExecutionStatus } from "@/lib/schema";

const STATUSES: WorkflowExecutionStatus[] = [
  "running",
  "success",
  "failed",
  "paused",
];

/**
 * GET /api/workflows/[id]/executions — execution history for a workflow.
 * Query params: page, limit, status.
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

  const sp = req.nextUrl.searchParams;
  const page = Math.max(Number(sp.get("page") ?? 1) || 1, 1);
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50) || 50, 1), 100);
  const statusRaw = sp.get("status") as WorkflowExecutionStatus | null;
  const status =
    statusRaw && STATUSES.includes(statusRaw) ? statusRaw : undefined;

  const { rows, total } = await listExecutions(id, {
    status,
    limit,
    offset: (page - 1) * limit,
  });

  return NextResponse.json({
    executions: rows,
    total,
    page,
    pages: Math.max(Math.ceil(total / limit), 1),
  });
}
