import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPendingApprovals } from "@/lib/db-queries";

/**
 * GET /api/approvals — list the current user's pending approvals.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const approvals = await getPendingApprovals(session.user.id);
  return NextResponse.json({ approvals });
}
