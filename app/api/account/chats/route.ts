import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { deleteAllUserChats } from "@/lib/db-queries";

/** DELETE /api/account/chats — permanently delete all of the user's chats. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDbEnabled) {
    return NextResponse.json(
      { error: "No database is configured." },
      { status: 503 },
    );
  }

  const count = await deleteAllUserChats(session.user.id);
  return NextResponse.json({ ok: true, count });
}
