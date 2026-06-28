import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  deleteChat,
  getChatForUser,
  getChatMessages,
  getPendingApprovalsForChat,
  pinChat,
  renameChat,
  setChatArchived,
} from "@/lib/db-queries";
import { sanitizeLine } from "@/lib/sanitize";
import { OP_KEY } from "@/lib/agent/ops";
import type {
  ActionType,
  ApprovalField,
  ClientApproval,
  ClientMessage,
  Step,
  ToolId,
} from "@/lib/types";

const MULTILINE_KEYS = new Set(["body", "content", "description", "text"]);

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function approvalFromRow(row: {
  id: string;
  actionType: string;
  toolName: string;
  actionData: Record<string, unknown> | null;
  editedData: Record<string, unknown> | null;
}): ClientApproval {
  const data = { ...(row.editedData ?? row.actionData ?? {}) };
  delete data[OP_KEY];
  const fields: ApprovalField[] = Object.entries(data).map(([key, value]) => ({
    key,
    label: humanizeKey(key),
    value: String(value ?? ""),
    multiline: MULTILINE_KEYS.has(key),
  }));
  return {
    id: row.id,
    actionType: row.actionType as ActionType,
    toolName: row.toolName,
    description: `${row.toolName}: ${row.actionType.replace(/_/g, " ")}`,
    fields,
    status: "pending",
  };
}

/**
 * GET /api/chat/[chatId] — full message history for a chat, with any still-
 * pending approvals reattached so they remain actionable after a reload.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ chatId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { chatId } = await ctx.params;

  const chat = await getChatForUser(chatId, session.user.id);
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const [rows, pending] = await Promise.all([
    getChatMessages(chatId),
    getPendingApprovalsForChat(chatId, session.user.id),
  ]);

  const approvalByMessage = new Map<string, ClientApproval>();
  for (const a of pending) {
    approvalByMessage.set(a.messageId, approvalFromRow(a));
  }

  const messages: ClientMessage[] = rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    toolsUsed: (m.toolUsed ?? []) as ToolId[],
    steps: (m.executionSteps ?? []) as Step[],
    approval: approvalByMessage.get(m.id),
  }));

  return NextResponse.json({ chatId, title: chat.title, messages });
}

/**
 * PATCH /api/chat/[chatId] — rename, pin/unpin, or archive/restore a chat.
 * Accepts any of `{ title?, pinned?, archived? }`.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ chatId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { chatId } = await ctx.params;
  const userId = session.user.id;

  const body = await req.json().catch(() => ({}));
  const hasTitle = typeof body?.title === "string";
  const hasPinned = typeof body?.pinned === "boolean";
  const hasArchived = typeof body?.archived === "boolean";

  if (!hasTitle && !hasPinned && !hasArchived) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 },
    );
  }

  if (hasPinned) {
    const row = await pinChat(chatId, userId, body.pinned);
    if (!row) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
  }

  if (hasArchived) {
    const row = await setChatArchived(chatId, userId, body.archived);
    if (!row) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
  }

  if (hasTitle) {
    const title = sanitizeLine(String(body.title));
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const updated = await renameChat(chatId, userId, title);
    if (!updated) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, title: updated });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/chat/[chatId] — permanently delete a chat (and its messages).
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ chatId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { chatId } = await ctx.params;
  await deleteChat(chatId, session.user.id);
  return NextResponse.json({ ok: true });
}
