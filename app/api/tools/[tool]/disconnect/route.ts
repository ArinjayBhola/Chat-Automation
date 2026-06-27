import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { deleteToolConnection } from "@/lib/db-queries";
import { isToolId } from "@/lib/tools/registry";

/**
 * POST /api/tools/[tool]/disconnect — remove a stored tool connection.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ tool: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tool } = await ctx.params;
  if (!isToolId(tool)) {
    return NextResponse.json({ error: "Unknown tool" }, { status: 404 });
  }

  await deleteToolConnection(session.user.id, tool);
  return NextResponse.json({ ok: true });
}
