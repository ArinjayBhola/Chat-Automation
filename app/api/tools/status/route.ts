import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getToolConnections } from "@/lib/db-queries";
import { TOOL_META, type ToolId, type ToolStatus } from "@/lib/types";

const ALL_TOOLS = Object.keys(TOOL_META) as ToolId[];

/**
 * GET /api/tools/status — connection status for all five tools.
 * Demo users (or missing DB) get everything disconnected.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await getToolConnections(session.user.id);
  const connectedSet = new Set(connections.map((c) => c.tool as ToolId));

  const tools: ToolStatus[] = ALL_TOOLS.map((id) => ({
    id,
    name: TOOL_META[id].name,
    connected: connectedSet.has(id),
  }));

  return NextResponse.json({ tools });
}
