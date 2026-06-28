import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getWorkflow, restoreWorkflowVersion } from "@/lib/db-queries";

const restoreSchema = z.object({
  version: z.number().int().positive(),
});

/**
 * POST /api/workflows/[id]/versions/restore — restore the workflow graph from a
 * stored version snapshot. Body: { version: number }.
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

  const parsed = restoreSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const restored = await restoreWorkflowVersion(id, parsed.data.version);
  if (!restored) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }
  return NextResponse.json({ message: "Restored", workflow: restored });
}
