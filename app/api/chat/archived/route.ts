import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listArchivedChats } from "@/lib/db-queries";

/**
 * GET /api/chat/archived — list the current user's archived chats so they can
 * be restored or permanently deleted from Settings.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await listArchivedChats(session.user.id);
  return NextResponse.json({
    chats: rows.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      archivedAt: c.archivedAt,
    })),
  });
}
