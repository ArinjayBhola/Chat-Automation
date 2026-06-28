import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createExecution, getWorkflow } from "@/lib/db-queries";
import { limiterKey, rateLimit } from "@/lib/rate-limit";

const executeSchema = z.object({
  inputData: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/workflows/[id]/execute — manually trigger a workflow run.
 *
 * Phase 1 records the execution (status "running"); the actual execution engine
 * that advances and completes the run arrives in Phase 3.
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
  if (!workflow.isPublished) {
    return NextResponse.json(
      { error: "Publish the workflow before running it." },
      { status: 400 },
    );
  }

  const rl = rateLimit(limiterKey("workflow:execute", session.user.id), 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many runs. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const parsed = executeSchema.safeParse(await req.json().catch(() => ({})));
  const inputData = parsed.success ? (parsed.data.inputData ?? {}) : {};

  const execution = await createExecution(
    id,
    session.user.id,
    "manual",
    inputData,
  );
  if (!execution) {
    return NextResponse.json(
      { error: "Failed to start execution." },
      { status: 500 },
    );
  }
  return NextResponse.json(
    {
      executionId: execution.id,
      status: execution.status,
      startedAt: execution.startedAt,
    },
    { status: 202 },
  );
}
