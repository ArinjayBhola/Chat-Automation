import { NextResponse, type NextRequest } from "next/server";
import { isDbEnabled } from "@/lib/db";
import {
  createExecution,
  getDueSchedules,
  recordScheduleOutcome,
  updateSchedule,
} from "@/lib/db-queries";
import { nextRun } from "@/lib/workflows/cron";
import { WorkflowExecutor } from "@/lib/workflows/workflow-executor";
import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";

export const maxDuration = 60;
// Process a bounded batch per tick so a single invocation stays within limits.
const BATCH = 10;

/**
 * GET /api/cron — scheduler tick. Designed to be called once a minute by an
 * external scheduler (Vercel Cron, a system crontab hitting this URL, etc.),
 * NOT an in-process node-cron loop (which can't survive a serverless/standalone
 * deployment). It finds schedules whose nextRun is due, runs each workflow with
 * the Phase 3 engine, records stats, and advances nextRun.
 *
 * Secured with a bearer token (CRON_SECRET). Vercel Cron sends this header
 * automatically when CRON_SECRET is set in the project env.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing to run unsecured." },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDbEnabled) {
    return NextResponse.json({ ran: 0, message: "Database not configured." });
  }

  const now = new Date();
  const due = await getDueSchedules(now, BATCH);
  const results: Array<{
    scheduleId: string;
    workflowId: string;
    status: string;
  }> = [];

  for (const item of due) {
    const s = item.schedule;
    const advance = nextRun(s.schedule, s.timezone, now);

    // Only run published workflows; otherwise just advance the schedule.
    if (!item.isPublished) {
      await updateSchedule(s.id, { nextRun: advance });
      results.push({
        scheduleId: s.id,
        workflowId: s.workflowId,
        status: "skipped_unpublished",
      });
      continue;
    }

    try {
      const execution = await createExecution(
        s.workflowId,
        item.userId,
        "scheduled",
        {},
      );
      if (!execution) throw new Error("Could not create execution record.");

      const executor = new WorkflowExecutor({
        workflowId: s.workflowId,
        executionId: execution.id,
        userId: item.userId,
        nodes: (item.nodes ?? []) as WorkflowNode[],
        edges: (item.edges ?? []) as WorkflowEdge[],
        options: { dryRun: false, persist: true, triggerType: "scheduled" },
      });
      const result = await executor.execute();
      const ok = result.status !== "failed";

      await recordScheduleOutcome({
        scheduleId: s.id,
        ok,
        nextRun: advance,
        error: ok ? null : result.errors[0]?.message,
      });
      results.push({
        scheduleId: s.id,
        workflowId: s.workflowId,
        status: result.status,
      });
    } catch (e) {
      await recordScheduleOutcome({
        scheduleId: s.id,
        ok: false,
        nextRun: advance,
        error: e instanceof Error ? e.message : "Scheduled run failed.",
      });
      results.push({
        scheduleId: s.id,
        workflowId: s.workflowId,
        status: "failed",
      });
    }
  }

  return NextResponse.json({ ran: results.length, at: now.toISOString(), results });
}
