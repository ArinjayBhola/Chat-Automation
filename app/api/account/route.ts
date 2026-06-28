import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { deleteUser } from "@/lib/db-queries";

/**
 * DELETE /api/account — permanently delete the account and everything it owns
 * (chats, messages, approvals, tool connections) via DB cascade. The client is
 * responsible for signing out afterwards.
 */
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

  await deleteUser(session.user.id);
  return NextResponse.json({ ok: true });
}
