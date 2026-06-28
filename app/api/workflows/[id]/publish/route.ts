import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getWorkflow, publishWorkflow } from "@/lib/db-queries";

/**
 * POST /api/workflows/[id]/publish — publish a workflow.
 * Snapshots the current graph into a new version and increments the version.
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
  if (workflow.nodes.length === 0) {
    return NextResponse.json(
      { error: "Cannot publish an empty workflow. Add at least one node." },
      { status: 400 },
    );
  }

  const published = await publishWorkflow(id);
  if (!published) {
    return NextResponse.json(
      { error: "Failed to publish workflow." },
      { status: 500 },
    );
  }
  return NextResponse.json({
    message: "Published",
    version: published.version,
    workflow: published,
  });
}
