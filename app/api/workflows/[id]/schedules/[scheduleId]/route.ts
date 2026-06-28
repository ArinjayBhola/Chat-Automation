import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  deleteSchedule,
  getWorkflow,
  getWorkflowSchedule,
  updateSchedule,
} from "@/lib/db-queries";
import { isValidCron, isValidTimezone } from "@/lib/workflows/validation";

const updateSchema = z
  .object({
    schedule: z.string().trim().min(1).optional(),
    timezone: z.string().trim().min(1).optional(),
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
 * PUT /api/workflows/[id]/schedules/[scheduleId] — update a schedule.
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
  if (parsed.data.schedule && !isValidCron(parsed.data.schedule)) {
    return NextResponse.json(
      { error: "Invalid cron expression." },
      { status: 400 },
    );
  }
  if (parsed.data.timezone && !isValidTimezone(parsed.data.timezone)) {
    return NextResponse.json({ error: "Invalid timezone." }, { status: 400 });
  }

  const updated = await updateSchedule(scheduleId, parsed.data);
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
