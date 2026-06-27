import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { decideApproval, fieldsToArgs } from "@/lib/agent/approvals";

/**
 * POST /api/approvals/[id]/approve — execute the action (with any edited
 * fields) and mark it approved.
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
  const body = await req.json().catch(() => ({}));
  const editedArgs = fieldsToArgs(body?.fields);

  const result = await decideApproval(session.user.id, id, "approved", editedArgs);
  return NextResponse.json(
    {
      ok: result.ok,
      error: result.error,
      summary: result.summary,
      alreadyResolved: result.alreadyResolved,
    },
    { status: result.status },
  );
}
