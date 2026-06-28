import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getRecentExecutions } from "@/lib/db-queries";

/** GET /api/dashboard/executions — most recent executions across all workflows. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 10) || 10, 1),
    50,
  );
  const executions = await getRecentExecutions(session.user.id, limit);
  return NextResponse.json({ executions });
}
