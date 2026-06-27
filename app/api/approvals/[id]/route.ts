import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getApprovalById, updateApproval } from "@/lib/db-queries";
import { fieldsToArgs } from "@/lib/agent/approvals";

/**
 * PUT /api/approvals/[id] — save edited field values without executing.
 * (Approving with edits is also supported directly via the /approve route.)
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const row = await getApprovalById(id, session.user.id);
  if (!row) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }
  if (row.status !== "pending") {
    return NextResponse.json(
      { error: "Approval is no longer pending" },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const editedArgs = fieldsToArgs(body?.fields);
  const updated = await updateApproval(id, {
    editedData: editedArgs ?? null,
  });
  return NextResponse.json({ ok: true, approval: updated });
}
