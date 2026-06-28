import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getExecutionTrend } from "@/lib/db-queries";

/** GET /api/dashboard/trend — daily success/failed counts over a window. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const days = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("days") ?? 30) || 30, 1),
    90,
  );
  const trend = await getExecutionTrend(session.user.id, days);
  return NextResponse.json({ trend });
}
