import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  archiveChat,
  getChatForUser,
  getChatMessages,
  getPendingApprovalsForChat,
} from "@/lib/db-queries";
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
 * DELETE /api/chat/[chatId] — soft-delete (archive) a chat.
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
  await archiveChat(chatId, session.user.id);
  return NextResponse.json({ ok: true });
}
