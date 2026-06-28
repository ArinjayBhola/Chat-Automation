import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  deleteSchedule,
  getWorkflow,
  getWorkflowSchedule,
  updateSchedule,
} from "@/lib/db-queries";
import { isValidCron, isValidTimezone, nextRun } from "@/lib/workflows/cron";

const updateSchema = z
  .object({
    schedule: z.string().trim().min(1).optional(),
    timezone: z.string().trim().min(1).optional(),
    name: z.string().trim().max(100).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update.",
  });

/** Verify the workflow is owned by the user and the schedule belongs to it. */
async function authorize(
  workflowId: string,
  scheduleId: string,
  userId: string,
) {
  const workflow = await getWorkflow(workflowId, userId);
  if (!workflow) return { error: "Workflow not found" as const };
  const schedule = await getWorkflowSchedule(scheduleId);
  if (!schedule || schedule.workflowId !== workflowId) {
    return { error: "Schedule not found" as const };
  }
  return { schedule };
}

/**
 * PUT /api/workflows/[id]/schedules/[scheduleId] — update a schedule. Recomputes
 * the next run time when the cron expression, timezone, or active state changes.
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; scheduleId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, scheduleId } = await ctx.params;

  const guard = await authorize(id, scheduleId, session.user.id);
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const patch = parsed.data;
  if (patch.schedule && !isValidCron(patch.schedule)) {
    return NextResponse.json(
      { error: "Invalid cron expression." },
      { status: 400 },
    );
  }
  if (patch.timezone && !isValidTimezone(patch.timezone)) {
    return NextResponse.json({ error: "Invalid timezone." }, { status: 400 });
  }

  // Recompute next run if anything that affects the schedule changed.
  const effSchedule = patch.schedule ?? guard.schedule.schedule;
  const effTimezone = patch.timezone ?? guard.schedule.timezone;
  const effActive = patch.isActive ?? guard.schedule.isActive;
  const recompute =
    patch.schedule !== undefined ||
    patch.timezone !== undefined ||
    patch.isActive !== undefined;
  const nextRunAt = recompute
    ? effActive
      ? nextRun(effSchedule, effTimezone)
      : null
    : undefined;

  const updated = await updateSchedule(scheduleId, {
    ...patch,
    ...(nextRunAt !== undefined ? { nextRun: nextRunAt } : {}),
  });
  return NextResponse.json(updated);
}

/**
 * DELETE /api/workflows/[id]/schedules/[scheduleId] — delete a schedule.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; scheduleId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, scheduleId } = await ctx.params;

  const guard = await authorize(id, scheduleId, session.user.id);
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: 404 });
  }

  await deleteSchedule(scheduleId);
  return NextResponse.json({ ok: true });
}
