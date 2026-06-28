import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRecentExecutions } from "@/lib/db-queries";

// A run slower than this is flagged for attention.
const SLOW_MS = 30_000;

type Alert = {
  id: string;
  workflowId: string;
  type: "error" | "slow" | "auth" | "warning";
  message: string;
  createdAt: string;
};

/**
 * GET /api/dashboard/alerts — derived, not stored. Recent executions are scanned
 * for failures, auth problems, and slow runs so the dashboard can surface
 * actionable issues without a separate alerts table.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recent = await getRecentExecutions(session.user.id, 50);
  const alerts: Alert[] = [];

  for (const e of recent) {
    const when = (e.completedAt ?? e.startedAt).toISOString();
    const err = e.error ?? "";
    if (e.status === "failed") {
      const isAuth = /not connected|unauthorized|token|reconnect/i.test(err);
      alerts.push({
        id: e.id,
        workflowId: e.workflowId,
        type: isAuth ? "auth" : "error",
        message: isAuth
          ? `"${e.workflowName}" failed: a tool needs reconnecting. ${err}`.trim()
          : `"${e.workflowName}" failed${err ? `: ${err}` : "."}`,
        createdAt: when,
      });
    } else if (
      e.status === "success" &&
      typeof e.duration === "number" &&
      e.duration > SLOW_MS
    ) {
      alerts.push({
        id: e.id,
        workflowId: e.workflowId,
        type: "slow",
        message: `"${e.workflowName}" took ${(e.duration / 1000).toFixed(1)}s to run.`,
        createdAt: when,
      });
    }
  }

  return NextResponse.json({ alerts: alerts.slice(0, 8) });
}
