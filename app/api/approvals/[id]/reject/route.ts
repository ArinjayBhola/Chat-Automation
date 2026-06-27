import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { decideApproval } from "@/lib/agent/approvals";

/** POST /api/approvals/[id]/reject — reject without executing. */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const result = await decideApproval(session.user.id, id, "rejected");
  return NextResponse.json({ ok: result.ok }, { status: result.status });
}
