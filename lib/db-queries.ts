import {
  and,
  desc,
  eq,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { db, isDbEnabled } from "./db";
import { cached, invalidatePrefix, TTL } from "./cache";
import {
  agentCheckpoints,
  approvals,
  auditLogs,
  chats,
  messages,
  modelUsage,
  toolConnections,
  users,
  type AgentCheckpoint,
  type ModelUsageRow,
  type Approval,
  type NewApproval,
  type NewAuditLog,
  type NewMessage,
  type ToolName,
  type User,
} from "./schema";

/**
 * Thin query layer over Drizzle. Every function is null-safe: when no database
 * is configured it returns a sensible empty value instead of throwing, so the
 * app can boot before the database is provisioned.
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

export async function getUserByEmail(email: string): Promise<User | null> {
  if (!isDbEnabled || !db) return null;
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

/** Create an email/password account. Throws if the email already exists. */
export async function createCredentialsUser(input: {
  email: string;
  name: string | null;
  passwordHash: string;
}): Promise<User | null> {
  if (!isDbEnabled || !db) return null;
  const [created] = await db
    .insert(users)
    .values({
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: input.passwordHash,
    })
    .returning();
  return created;
}

/** Update editable profile fields (name and/or email). */
export async function updateUserProfile(
  userId: string,
  patch: { name?: string | null; email?: string },
): Promise<User | null> {
  if (!isDbEnabled || !db) return null;
  const [updated] = await db
    .update(users)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.email !== undefined ? { email: patch.email.toLowerCase() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return updated ?? null;
}

/** Set or replace the password hash for an account. */
export async function setUserPassword(
  userId: string,
  passwordHash: string,
): Promise<void> {
  if (!isDbEnabled || !db) return;
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/** Permanently delete every chat (and, by cascade, messages/approvals). */
export async function deleteAllUserChats(userId: string): Promise<number> {
  if (!isDbEnabled || !db) return 0;
  const deleted = await db
    .delete(chats)
    .where(eq(chats.userId, userId))
    .returning({ id: chats.id });
  return deleted.length;
}

/** Permanently delete the account and all data owned by it (cascade). */
export async function deleteUser(userId: string): Promise<void> {
  if (!isDbEnabled || !db) return;
  await db.delete(users).where(eq(users.id, userId));
}

// ---- tool connections -----------------------------------------------------
// Connections change only on connect/disconnect/token-refresh, but are read on
// every chat request and tool call, so they are cached with explicit
// invalidation (see `invalidateConnections`) on every write below.
function connCacheKey(userId: string, tool?: ToolName) {
  return tool ? `conn:${userId}:t:${tool}` : `conn:${userId}:all`;
}

/** Drop all cached connection reads for a user (call after any write). */
export function invalidateConnections(userId: string) {
  invalidatePrefix(`conn:${userId}:`);
}

export async function getToolConnections(userId: string) {
  if (!isDbEnabled || !db) return [];
  return cached(connCacheKey(userId), TTL.connections, () =>
    db!
      .select()
      .from(toolConnections)
      .where(eq(toolConnections.userId, userId)),
  );
}

export async function getToolConnection(userId: string, tool: ToolName) {
  if (!isDbEnabled || !db) return null;
  return cached(connCacheKey(userId, tool), TTL.connections, async () => {
    const rows = await db!
      .select()
      .from(toolConnections)
      .where(
        and(eq(toolConnections.userId, userId), eq(toolConnections.tool, tool)),
      )
      .limit(1);
    return rows[0] ?? null;
  });
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
  invalidateConnections(input.userId);
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
  invalidateConnections(input.userId);
  return row;
}

export async function deleteToolConnection(userId: string, tool: ToolName) {
  if (!isDbEnabled || !db) return;
  await db
    .delete(toolConnections)
    .where(
      and(eq(toolConnections.userId, userId), eq(toolConnections.tool, tool)),
    );
  invalidateConnections(userId);
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
  titleFn?: () => Promise<string>,
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

  // New chat: prefer a generated title (only computed here, never on reuse).
  let finalTitle = title;
  if (titleFn) {
    try {
      finalTitle = await titleFn();
    } catch {
      /* fall back to the raw title */
    }
  }

  const [chat] = await db
    .insert(chats)
    .values({ userId, title: finalTitle.slice(0, 80) || "New chat" })
    .returning({ id: chats.id });
  return chat?.id ?? null;
}

/** Rename a chat the user owns. Returns the updated title or null. */
export async function renameChat(
  chatId: string,
  userId: string,
  title: string,
): Promise<string | null> {
  if (!isDbEnabled || !db) return null;
  const clean = title.trim().slice(0, 80) || "New chat";
  const [row] = await db
    .update(chats)
    .set({ title: clean, updatedAt: new Date() })
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning({ id: chats.id, title: chats.title });
  return row?.title ?? null;
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

/** Archive or restore a chat the user owns. */
export async function setChatArchived(
  chatId: string,
  userId: string,
  archived: boolean,
) {
  if (!isDbEnabled || !db) return null;
  const [row] = await db
    .update(chats)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning({ id: chats.id });
  return row ?? null;
}

/** Pin or unpin a chat the user owns. Returns the row or null when not found. */
export async function pinChat(
  chatId: string,
  userId: string,
  pinned: boolean,
) {
  if (!isDbEnabled || !db) return null;
  const [row] = await db
    .update(chats)
    .set({ pinnedAt: pinned ? new Date() : null })
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning({ id: chats.id, pinnedAt: chats.pinnedAt });
  return row ?? null;
}

/** Permanently delete one chat the user owns (cascades messages/approvals). */
export async function deleteChat(chatId: string, userId: string) {
  if (!isDbEnabled || !db) return false;
  const deleted = await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning({ id: chats.id });
  return deleted.length > 0;
}

/** List the user's archived chats, most recently updated first. */
export async function listArchivedChats(userId: string) {
  if (!isDbEnabled || !db) return [];
  return db
    .select()
    .from(chats)
    .where(and(eq(chats.userId, userId), isNotNull(chats.archivedAt)))
    .orderBy(desc(chats.updatedAt));
}

/**
 * Messages for a chat, scoped to their owner. The userId filter makes this
 * query self-guarding: it cannot return another user's messages even if a
 * caller forgets the ownership gate, so it is not an IDOR risk on its own.
 */
export async function getChatMessages(chatId: string, userId: string) {
  if (!isDbEnabled || !db) return [];
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.chatId, chatId), eq(messages.userId, userId)))
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

// ---- agent checkpoints (provider-failover resume) -------------------------
export type CheckpointRecord = {
  runId: string;
  userId: string;
  chatId?: string | null;
  status: "running" | "switched" | "completed" | "failed";
  currentStep: number;
  activeProvider: string | null;
  activeModelId: string | null;
  workingMemory: unknown[];
  completedSteps: unknown[];
  committedText: string;
  providerHistory: unknown[];
  failureHistory: unknown[];
  retryCount: number;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  costUsd: number;
};

/**
 * Insert-or-update the single checkpoint row for a run (keyed by runId). Called
 * at every step boundary and provider switch. No-ops without a database so the
 * live in-request failover path keeps working even when persistence is off.
 */
export async function upsertCheckpoint(
  rec: CheckpointRecord,
): Promise<AgentCheckpoint | null> {
  if (!isDbEnabled || !db) return null;
  // A chatId is only valid once the chat row exists; store null otherwise so we
  // never violate the FK for an as-yet-unpersisted chat.
  const chatId = rec.chatId ?? null;
  const values = {
    runId: rec.runId,
    userId: rec.userId,
    chatId,
    status: rec.status,
    currentStep: rec.currentStep,
    activeProvider: rec.activeProvider,
    activeModelId: rec.activeModelId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workingMemory: rec.workingMemory as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    completedSteps: rec.completedSteps as any,
    committedText: rec.committedText,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providerHistory: rec.providerHistory as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    failureHistory: rec.failureHistory as any,
    retryCount: rec.retryCount,
    tokenUsage: rec.tokenUsage,
    costUsd: String(rec.costUsd),
  };
  const [row] = await db
    .insert(agentCheckpoints)
    .values(values)
    .onConflictDoUpdate({
      target: agentCheckpoints.runId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  return row ?? null;
}

export async function getLatestCheckpoint(
  runId: string,
  userId: string,
): Promise<AgentCheckpoint | null> {
  if (!isDbEnabled || !db) return null;
  const rows = await db
    .select()
    .from(agentCheckpoints)
    .where(
      and(
        eq(agentCheckpoints.runId, runId),
        eq(agentCheckpoints.userId, userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// ---- model usage (per-model token accounting) -----------------------------
export type UsageDelta = {
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  requests: number;
};

/** Light usage row returned to callers (DB and in-memory produce the same shape). */
export type UsageRow = {
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  requestCount: number;
};

/** First instant of the current calendar month, UTC - the usage window key. */
export function currentUsageWindow(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * In-memory usage fallback used when no database is configured, so the tracker
 * still works in dev / before a DB is provisioned. Cached on globalThis to
 * survive HMR; per server process (not shared across serverless instances, and
 * not durable across restarts - provision a DB for that).
 */
type MemBucket = Map<string, UsageRow>; // key: `${modelId}`
const globalForUsage = globalThis as unknown as {
  __usageMem?: Map<string, MemBucket>; // key: `${userId}|${windowISO}`
};
function memStore(): Map<string, MemBucket> {
  return (globalForUsage.__usageMem ??= new Map());
}
function memBucket(userId: string, windowStart: Date): MemBucket {
  const key = `${userId}|${windowStart.toISOString()}`;
  const store = memStore();
  let bucket = store.get(key);
  if (!bucket) {
    bucket = new Map();
    store.set(key, bucket);
  }
  return bucket;
}

/**
 * Atomically add token/request deltas to each model's usage for the current
 * window. With a DB it upserts on the unique (user, model, window) index with
 * SQL increments so concurrent runs cannot lose counts; without a DB it updates
 * the in-memory store so usage is still visible.
 */
export async function incrementModelUsage(
  userId: string,
  deltas: UsageDelta[],
): Promise<void> {
  if (deltas.length === 0) return;
  const windowStart = currentUsageWindow();

  if (!isDbEnabled || !db) {
    const bucket = memBucket(userId, windowStart);
    for (const d of deltas) {
      if (d.inputTokens <= 0 && d.outputTokens <= 0 && d.requests <= 0) continue;
      const prev =
        bucket.get(d.modelId) ??
        ({
          modelId: d.modelId,
          provider: d.provider,
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          reasoningTokens: 0,
          totalTokens: 0,
          requestCount: 0,
        } satisfies UsageRow);
      prev.inputTokens += d.inputTokens;
      prev.outputTokens += d.outputTokens;
      prev.cachedInputTokens += d.cachedInputTokens ?? 0;
      prev.reasoningTokens += d.reasoningTokens ?? 0;
      prev.totalTokens += d.inputTokens + d.outputTokens;
      prev.requestCount += d.requests;
      bucket.set(d.modelId, prev);
    }
    return;
  }

  for (const d of deltas) {
    if (d.inputTokens <= 0 && d.outputTokens <= 0 && d.requests <= 0) continue;
    const total = d.inputTokens + d.outputTokens;
    const cached = d.cachedInputTokens ?? 0;
    const reasoning = d.reasoningTokens ?? 0;
    await db
      .insert(modelUsage)
      .values({
        userId,
        modelId: d.modelId,
        provider: d.provider,
        windowStart,
        inputTokens: d.inputTokens,
        outputTokens: d.outputTokens,
        cachedInputTokens: cached,
        reasoningTokens: reasoning,
        totalTokens: total,
        requestCount: d.requests,
      })
      .onConflictDoUpdate({
        target: [
          modelUsage.userId,
          modelUsage.modelId,
          modelUsage.windowStart,
        ],
        set: {
          inputTokens: sql`${modelUsage.inputTokens} + ${d.inputTokens}`,
          outputTokens: sql`${modelUsage.outputTokens} + ${d.outputTokens}`,
          cachedInputTokens: sql`${modelUsage.cachedInputTokens} + ${cached}`,
          reasoningTokens: sql`${modelUsage.reasoningTokens} + ${reasoning}`,
          totalTokens: sql`${modelUsage.totalTokens} + ${total}`,
          requestCount: sql`${modelUsage.requestCount} + ${d.requests}`,
          updatedAt: new Date(),
        },
      });
  }
}

/** A user's per-model usage for the current window (DB, else in-memory). */
export async function getModelUsage(userId: string): Promise<UsageRow[]> {
  const windowStart = currentUsageWindow();

  if (!isDbEnabled || !db) {
    const bucket = memStore().get(`${userId}|${windowStart.toISOString()}`);
    if (!bucket) return [];
    return [...bucket.values()].sort((a, b) => b.totalTokens - a.totalTokens);
  }

  const rows: ModelUsageRow[] = await db
    .select()
    .from(modelUsage)
    .where(
      and(
        eq(modelUsage.userId, userId),
        eq(modelUsage.windowStart, windowStart),
      ),
    )
    .orderBy(desc(modelUsage.totalTokens));

  return rows.map((r) => ({
    modelId: r.modelId,
    provider: r.provider,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    cachedInputTokens: r.cachedInputTokens,
    reasoningTokens: r.reasoningTokens,
    totalTokens: r.totalTokens,
    requestCount: r.requestCount,
  }));
}
