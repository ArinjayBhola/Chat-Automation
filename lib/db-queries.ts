import { and, desc, eq, isNull } from "drizzle-orm";
import { db, isDbEnabled } from "./db";
import {
  approvals,
  auditLogs,
  chats,
  messages,
  toolConnections,
  users,
  type Approval,
  type NewApproval,
  type NewAuditLog,
  type NewMessage,
  type ToolName,
  type User,
} from "./schema";

/**
 * Thin query layer over Drizzle. Every function is demo-safe: when no database
 * is configured it returns a sensible empty/echo value instead of throwing, so
 * the app remains fully usable in demo mode.
 */

// ---- users ----------------------------------------------------------------
export async function upsertUserFromOAuth(input: {
  googleId?: string | null;
  email: string;
  name?: string | null;
  picture?: string | null;
}): Promise<User | null> {
  if (!isDbEnabled || !db) return null;

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(users)
      .set({
        googleId: input.googleId ?? existing[0].googleId,
        name: input.name ?? existing[0].name,
        picture: input.picture ?? existing[0].picture,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing[0].id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      googleId: input.googleId ?? null,
      email: input.email,
      name: input.name ?? null,
      picture: input.picture ?? null,
    })
    .returning();
  return created;
}

export async function getUserById(id: string): Promise<User | null> {
  if (!isDbEnabled || !db) return null;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

// ---- tool connections -----------------------------------------------------
export async function getToolConnections(userId: string) {
  if (!isDbEnabled || !db) return [];
  return db
    .select()
    .from(toolConnections)
    .where(eq(toolConnections.userId, userId));
}

export async function getToolConnection(userId: string, tool: ToolName) {
  if (!isDbEnabled || !db) return null;
  const rows = await db
    .select()
    .from(toolConnections)
    .where(
      and(eq(toolConnections.userId, userId), eq(toolConnections.tool, tool)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Insert-or-update a tool connection. Token values passed here are expected to
 * be ALREADY ENCRYPTED by the connections layer (lib/tools/connections.ts).
 */
export async function upsertToolConnection(input: {
  userId: string;
  tool: ToolName;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}) {
  if (!isDbEnabled || !db) return null;
  const [row] = await db
    .insert(toolConnections)
    .values({
      userId: input.userId,
      tool: input.tool,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt: input.expiresAt,
      scope: input.scope,
    })
    .onConflictDoUpdate({
      target: [toolConnections.userId, toolConnections.tool],
      set: {
        accessToken: input.accessToken,
        // Keep an existing refresh token if the provider didn't return a new one.
        ...(input.refreshToken ? { refreshToken: input.refreshToken } : {}),
        expiresAt: input.expiresAt,
        scope: input.scope,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

/** Update only the access token + expiry (used after a token refresh). */
export async function updateToolAccessToken(input: {
  userId: string;
  tool: ToolName;
  accessToken: string;
  expiresAt: Date | null;
}) {
  if (!isDbEnabled || !db) return null;
  const [row] = await db
    .update(toolConnections)
    .set({
      accessToken: input.accessToken,
      expiresAt: input.expiresAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(toolConnections.userId, input.userId),
        eq(toolConnections.tool, input.tool),
      ),
    )
    .returning();
  return row;
}

export async function deleteToolConnection(userId: string, tool: ToolName) {
  if (!isDbEnabled || !db) return;
  await db
    .delete(toolConnections)
    .where(
      and(eq(toolConnections.userId, userId), eq(toolConnections.tool, tool)),
    );
}

// ---- chats ----------------------------------------------------------------
export async function listChats(userId: string) {
  if (!isDbEnabled || !db) return [];
  return db
    .select()
    .from(chats)
    .where(and(eq(chats.userId, userId), isNull(chats.archivedAt)))
    .orderBy(desc(chats.updatedAt));
}

export async function createChat(userId: string, title = "New chat") {
  if (!isDbEnabled || !db) return null;
  const [chat] = await db
    .insert(chats)
    .values({ userId, title })
    .returning();
  return chat;
}

/**
 * Ensure a chat row exists for this user. Returns its id, or null when no DB.
 * If `chatId` is given and belongs to the user it's reused (and touched);
 * otherwise a new chat is created using `title` (first user message).
 */
export async function ensureChat(
  userId: string,
  chatId: string | undefined,
  title: string,
): Promise<string | null> {
  if (!isDbEnabled || !db) return null;

  if (chatId) {
    const rows = await db
      .select({ id: chats.id })
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      .limit(1);
    if (rows[0]) {
      await db
        .update(chats)
        .set({ updatedAt: new Date() })
        .where(eq(chats.id, chatId));
      return rows[0].id;
    }
  }

  const [chat] = await db
    .insert(chats)
    .values({ userId, title: title.slice(0, 80) || "New chat" })
    .returning({ id: chats.id });
  return chat?.id ?? null;
}

export async function getChatForUser(chatId: string, userId: string) {
  if (!isDbEnabled || !db) return null;
  const rows = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function archiveChat(chatId: string, userId: string) {
  if (!isDbEnabled || !db) return;
  await db
    .update(chats)
    .set({ archivedAt: new Date() })
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
}

export async function getChatMessages(chatId: string) {
  if (!isDbEnabled || !db) return [];
  return db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt);
}

export async function getPendingApprovalsForChat(
  chatId: string,
  userId: string,
) {
  if (!isDbEnabled || !db) return [];
  return db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.chatId, chatId),
        eq(approvals.userId, userId),
        eq(approvals.status, "pending"),
      ),
    );
}

export async function insertMessage(message: NewMessage) {
  if (!isDbEnabled || !db) return null;
  const [created] = await db.insert(messages).values(message).returning();
  return created;
}

// ---- approvals ------------------------------------------------------------
export async function getPendingApprovals(userId: string) {
  if (!isDbEnabled || !db) return [];
  return db
    .select()
    .from(approvals)
    .where(and(eq(approvals.userId, userId), eq(approvals.status, "pending")));
}

export async function createApproval(input: NewApproval) {
  if (!isDbEnabled || !db) return null;
  const [row] = await db.insert(approvals).values(input).returning();
  return row;
}

export async function getApprovalById(id: string, userId: string) {
  if (!isDbEnabled || !db) return null;
  const rows = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, id), eq(approvals.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateApproval(
  id: string,
  patch: Partial<
    Pick<Approval, "status" | "editedData" | "approvedAt" | "approvedBy">
  >,
) {
  if (!isDbEnabled || !db) return null;
  const [row] = await db
    .update(approvals)
    .set(patch)
    .where(eq(approvals.id, id))
    .returning();
  return row ?? null;
}

// ---- audit ----------------------------------------------------------------
export async function insertAuditLog(input: NewAuditLog) {
  if (!isDbEnabled || !db) return;
  try {
    await db.insert(auditLogs).values(input);
  } catch (e) {
    // Audit must never break the main flow.
    console.error("[audit] failed to write log:", e);
  }
}
