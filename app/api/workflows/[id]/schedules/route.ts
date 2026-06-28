import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  createWorkflowSchedule,
  getWorkflow,
  getWorkflowSchedules,
} from "@/lib/db-queries";
import { isValidCron, isValidTimezone } from "@/lib/workflows/validation";

const createSchema = z.object({
  schedule: z.string().trim().min(1),
  timezone: z.string().trim().min(1).default("UTC"),
});

/**
 * GET /api/workflows/[id]/schedules — list schedules for a workflow.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const workflow = await getWorkflow(id, session.user.id);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }
  const schedules = await getWorkflowSchedules(id);
  return NextResponse.json({ schedules });
}

/**
 * POST /api/workflows/[id]/schedules — create a cron schedule for a workflow.
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

  const workflow = await getWorkflow(id, session.user.id);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (!isValidCron(parsed.data.schedule)) {
    return NextResponse.json(
      { error: "Invalid cron expression." },
      { status: 400 },
    );
  }
  if (!isValidTimezone(parsed.data.timezone)) {
    return NextResponse.json({ error: "Invalid timezone." }, { status: 400 });
  }

  const schedule = await createWorkflowSchedule(
    id,
    parsed.data.schedule,
    parsed.data.timezone,
  );
  if (!schedule) {
    return NextResponse.json(
      { error: "Failed to create schedule." },
      { status: 500 },
    );
  }
  return NextResponse.json(schedule, { status: 201 });
}
