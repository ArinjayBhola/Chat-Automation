import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDashboardMetrics, getNodeTypeUsage } from "@/lib/db-queries";

/** GET /api/dashboard/metrics — headline metrics + node-type activity. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [metrics, nodeUsage] = await Promise.all([
    getDashboardMetrics(session.user.id),
    getNodeTypeUsage(session.user.id),
  ]);
  return NextResponse.json({ metrics, nodeUsage });
}
