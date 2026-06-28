import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { duplicateWorkflow, getWorkflow } from "@/lib/db-queries";

/**
 * POST /api/workflows/[id]/duplicate — clone a workflow into a new draft.
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

  const existing = await getWorkflow(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const copy = await duplicateWorkflow(id, session.user.id);
  if (!copy) {
    return NextResponse.json(
      { error: "Failed to duplicate workflow." },
      { status: 500 },
    );
  }
  return NextResponse.json(copy, { status: 201 });
}
