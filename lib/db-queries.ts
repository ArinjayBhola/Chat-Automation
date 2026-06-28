import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  sql,
} from "drizzle-orm";
import { db, isDbEnabled } from "./db";
import {
  approvals,
  auditLogs,
  chats,
  executionSteps,
  messages,
  toolConnections,
  users,
  workflowExecutions,
  workflows,
  workflowSchedules,
  workflowVersions,
  type Approval,
  type ExecutionStepRow,
  type NewApproval,
  type NewAuditLog,
  type NewMessage,
  type ExecutionStepStatus,
  type ToolName,
  type User,
  type WorkflowExecutionRow,
  type WorkflowExecutionStatus,
  type WorkflowRow,
  type WorkflowScheduleRow,
  type WorkflowTriggerType,
  type WorkflowVersionRow,
} from "./schema";
import type {
  WorkflowEdge,
  WorkflowInput,
  WorkflowNode,
} from "./types/workflow";

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

// ===========================================================================
// Workflows
// ===========================================================================
const TERMINAL_EXECUTION_STATUSES: WorkflowExecutionStatus[] = [
  "success",
  "failed",
];

export async function createWorkflow(
  userId: string,
  name: string,
  description?: string,
): Promise<WorkflowRow | null> {
  if (!isDbEnabled || !db) return null;
  const [row] = await db
    .insert(workflows)
    .values({
      userId,
      name,
      description: description ?? null,
      nodes: [],
      edges: [],
      isActive: true,
      isPublished: false,
      version: 1,
    })
    .returning();
  return row ?? null;
}

export async function getWorkflow(
  workflowId: string,
  userId: string,
): Promise<WorkflowRow | null> {
  if (!isDbEnabled || !db) return null;
  const rows = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, workflowId), eq(workflows.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listWorkflows(
  userId: string,
  opts: {
    search?: string;
    sortBy?: "createdAt" | "updatedAt" | "name";
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ rows: WorkflowRow[]; total: number }> {
  if (!isDbEnabled || !db) return { rows: [], total: 0 };

  const conds = [eq(workflows.userId, userId)];
  if (opts.search) conds.push(ilike(workflows.name, `%${opts.search}%`));
  const where = and(...conds);

  const orderCol =
    opts.sortBy === "name"
      ? workflows.name
      : opts.sortBy === "createdAt"
        ? workflows.createdAt
        : workflows.updatedAt;
  const order = opts.sortBy === "name" ? asc(orderCol) : desc(orderCol);

  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  const rows = await db
    .select()
    .from(workflows)
    .where(where)
    .orderBy(order)
    .limit(limit)
    .offset(offset);

  const [{ value }] = await db
    .select({ value: count() })
    .from(workflows)
    .where(where);

  return { rows, total: Number(value ?? 0) };
}

export async function updateWorkflow(
  workflowId: string,
  patch: WorkflowInput,
): Promise<WorkflowRow | null> {
  if (!isDbEnabled || !db) return null;
  const [row] = await db
    .update(workflows)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description ?? null }
        : {}),
      ...(patch.nodes !== undefined ? { nodes: patch.nodes } : {}),
      ...(patch.edges !== undefined ? { edges: patch.edges } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(workflows.id, workflowId))
    .returning();
  return row ?? null;
}

/** Publish a workflow: snapshot the current graph and bump the version. */
export async function publishWorkflow(
  workflowId: string,
): Promise<WorkflowRow | null> {
  if (!isDbEnabled || !db) return null;
  const rows = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1);
  const current = rows[0];
  if (!current) return null;

  const nextVersion = current.version + 1;
  await db.insert(workflowVersions).values({
    workflowId,
    version: nextVersion,
    nodes: current.nodes,
    edges: current.edges,
  });

  const [row] = await db
    .update(workflows)
    .set({ isPublished: true, version: nextVersion, updatedAt: new Date() })
    .where(eq(workflows.id, workflowId))
    .returning();
  return row ?? null;
}

export async function deleteWorkflow(
  workflowId: string,
  userId: string,
): Promise<boolean> {
  if (!isDbEnabled || !db) return false;
  const deleted = await db
    .delete(workflows)
    .where(and(eq(workflows.id, workflowId), eq(workflows.userId, userId)))
    .returning({ id: workflows.id });
  return deleted.length > 0;
}

export async function duplicateWorkflow(
  workflowId: string,
  userId: string,
): Promise<WorkflowRow | null> {
  if (!isDbEnabled || !db) return null;
  const original = await getWorkflow(workflowId, userId);
  if (!original) return null;

  const [row] = await db
    .insert(workflows)
    .values({
      userId,
      name: `${original.name} (copy)`,
      description: original.description,
      nodes: original.nodes,
      edges: original.edges,
      isActive: true,
      isPublished: false,
      version: 1,
    })
    .returning();
  return row ?? null;
}

// ---- workflow versions ----------------------------------------------------
export async function saveWorkflowVersion(
  workflowId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Promise<WorkflowVersionRow | null> {
  if (!isDbEnabled || !db) return null;
  const [{ value }] = await db
    .select({ value: sql<number>`coalesce(max(${workflowVersions.version}), 0)` })
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowId, workflowId));
  const nextVersion = Number(value ?? 0) + 1;

  const [row] = await db
    .insert(workflowVersions)
    .values({ workflowId, version: nextVersion, nodes, edges })
    .returning();
  return row ?? null;
}

export async function getWorkflowVersions(
  workflowId: string,
  limit = 10,
): Promise<WorkflowVersionRow[]> {
  if (!isDbEnabled || !db) return [];
  return db
    .select()
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowId, workflowId))
    .orderBy(desc(workflowVersions.version))
    .limit(Math.min(Math.max(limit, 1), 100));
}

/** Restore a workflow's graph from a stored version snapshot. */
export async function restoreWorkflowVersion(
  workflowId: string,
  version: number,
): Promise<WorkflowRow | null> {
  if (!isDbEnabled || !db) return null;
  const rows = await db
    .select()
    .from(workflowVersions)
    .where(
      and(
        eq(workflowVersions.workflowId, workflowId),
        eq(workflowVersions.version, version),
      ),
    )
    .limit(1);
  const snapshot = rows[0];
  if (!snapshot) return null;

  const [row] = await db
    .update(workflows)
    .set({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      updatedAt: new Date(),
    })
    .where(eq(workflows.id, workflowId))
    .returning();
  return row ?? null;
}

// ---- schedules ------------------------------------------------------------
export async function createWorkflowSchedule(input: {
  workflowId: string;
  schedule: string;
  timezone: string;
  name?: string | null;
  description?: string | null;
  nextRun?: Date | null;
}): Promise<WorkflowScheduleRow | null> {
  if (!isDbEnabled || !db) return null;
  const [row] = await db
    .insert(workflowSchedules)
    .values({
      workflowId: input.workflowId,
      schedule: input.schedule,
      timezone: input.timezone,
      name: input.name ?? null,
      description: input.description ?? null,
      nextRun: input.nextRun ?? null,
    })
    .returning();
  return row ?? null;
}

/**
 * Active schedules whose nextRun is now-or-past, joined with the owning
 * workflow's user id and graph so the scheduler can run them in one query.
 */
export async function getDueSchedules(now: Date, limit = 25) {
  if (!isDbEnabled || !db) return [];
  return db
    .select({
      schedule: workflowSchedules,
      userId: workflows.userId,
      isPublished: workflows.isPublished,
      nodes: workflows.nodes,
      edges: workflows.edges,
    })
    .from(workflowSchedules)
    .innerJoin(workflows, eq(workflowSchedules.workflowId, workflows.id))
    .where(
      and(
        eq(workflowSchedules.isActive, true),
        isNotNull(workflowSchedules.nextRun),
        lte(workflowSchedules.nextRun, now),
      ),
    )
    .orderBy(asc(workflowSchedules.nextRun))
    .limit(limit);
}

/** Record the result of a scheduled run: bump stats, set lastRun + nextRun. */
export async function recordScheduleOutcome(input: {
  scheduleId: string;
  ok: boolean;
  nextRun: Date | null;
  error?: string | null;
}): Promise<void> {
  if (!isDbEnabled || !db) return;
  const set: Record<string, unknown> = {
    lastRun: new Date(),
    nextRun: input.nextRun,
    totalRuns: sql`${workflowSchedules.totalRuns} + 1`,
    lastError: input.ok ? null : (input.error ?? "Execution failed."),
    updatedAt: new Date(),
  };
  if (input.ok) {
    set.successfulRuns = sql`${workflowSchedules.successfulRuns} + 1`;
  } else {
    set.failedRuns = sql`${workflowSchedules.failedRuns} + 1`;
  }
  await db
    .update(workflowSchedules)
    .set(set)
    .where(eq(workflowSchedules.id, input.scheduleId));
}

export async function getWorkflowSchedules(
  workflowId: string,
): Promise<WorkflowScheduleRow[]> {
  if (!isDbEnabled || !db) return [];
  return db
    .select()
    .from(workflowSchedules)
    .where(eq(workflowSchedules.workflowId, workflowId))
    .orderBy(desc(workflowSchedules.createdAt));
}

export async function getWorkflowSchedule(
  scheduleId: string,
): Promise<WorkflowScheduleRow | null> {
  if (!isDbEnabled || !db) return null;
  const rows = await db
    .select()
    .from(workflowSchedules)
    .where(eq(workflowSchedules.id, scheduleId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateSchedule(
  scheduleId: string,
  updates: {
    schedule?: string;
    timezone?: string;
    name?: string | null;
    description?: string | null;
    isActive?: boolean;
    lastRun?: Date | null;
    nextRun?: Date | null;
  },
): Promise<WorkflowScheduleRow | null> {
  if (!isDbEnabled || !db) return null;
  const [row] = await db
    .update(workflowSchedules)
    .set({
      ...(updates.schedule !== undefined ? { schedule: updates.schedule } : {}),
      ...(updates.timezone !== undefined ? { timezone: updates.timezone } : {}),
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.description !== undefined
        ? { description: updates.description }
        : {}),
      ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
      ...(updates.lastRun !== undefined ? { lastRun: updates.lastRun } : {}),
      ...(updates.nextRun !== undefined ? { nextRun: updates.nextRun } : {}),
      updatedAt: new Date(),
    })
    .where(eq(workflowSchedules.id, scheduleId))
    .returning();
  return row ?? null;
}

export async function toggleSchedule(
  scheduleId: string,
  isActive: boolean,
): Promise<WorkflowScheduleRow | null> {
  return updateSchedule(scheduleId, { isActive });
}

export async function deleteSchedule(scheduleId: string): Promise<boolean> {
  if (!isDbEnabled || !db) return false;
  const deleted = await db
    .delete(workflowSchedules)
    .where(eq(workflowSchedules.id, scheduleId))
    .returning({ id: workflowSchedules.id });
  return deleted.length > 0;
}

// ---- executions -----------------------------------------------------------
export async function createExecution(
  workflowId: string,
  userId: string,
  triggerType: WorkflowTriggerType,
  inputData: Record<string, unknown> = {},
): Promise<WorkflowExecutionRow | null> {
  if (!isDbEnabled || !db) return null;
  const [row] = await db
    .insert(workflowExecutions)
    .values({
      workflowId,
      userId,
      triggerType,
      status: "running",
      inputData,
      outputData: {},
    })
    .returning();
  return row ?? null;
}

export async function getExecution(
  executionId: string,
): Promise<WorkflowExecutionRow | null> {
  if (!isDbEnabled || !db) return null;
  const rows = await db
    .select()
    .from(workflowExecutions)
    .where(eq(workflowExecutions.id, executionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listExecutions(
  workflowId: string,
  opts: {
    status?: WorkflowExecutionStatus;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ rows: WorkflowExecutionRow[]; total: number }> {
  if (!isDbEnabled || !db) return { rows: [], total: 0 };

  const conds = [eq(workflowExecutions.workflowId, workflowId)];
  if (opts.status) conds.push(eq(workflowExecutions.status, opts.status));
  const where = and(...conds);

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  const rows = await db
    .select()
    .from(workflowExecutions)
    .where(where)
    .orderBy(desc(workflowExecutions.startedAt))
    .limit(limit)
    .offset(offset);

  const [{ value }] = await db
    .select({ value: count() })
    .from(workflowExecutions)
    .where(where);

  return { rows, total: Number(value ?? 0) };
}

export async function updateExecutionStatus(
  executionId: string,
  status: WorkflowExecutionStatus,
  outputData?: Record<string, unknown>,
  error?: string,
): Promise<WorkflowExecutionRow | null> {
  if (!isDbEnabled || !db) return null;

  const isTerminal = TERMINAL_EXECUTION_STATUSES.includes(status);
  let completedAt: Date | undefined;
  let duration: number | undefined;
  if (isTerminal) {
    completedAt = new Date();
    const existing = await getExecution(executionId);
    if (existing) {
      duration = completedAt.getTime() - existing.startedAt.getTime();
    }
  }

  const [row] = await db
    .update(workflowExecutions)
    .set({
      status,
      ...(outputData !== undefined ? { outputData } : {}),
      ...(error !== undefined ? { error } : {}),
      ...(completedAt ? { completedAt } : {}),
      ...(duration !== undefined ? { duration } : {}),
    })
    .where(eq(workflowExecutions.id, executionId))
    .returning();
  return row ?? null;
}

// ---- execution steps ------------------------------------------------------
export async function addExecutionStep(
  executionId: string,
  nodeId: string,
  nodeType: string,
  input: Record<string, unknown> = {},
): Promise<ExecutionStepRow | null> {
  if (!isDbEnabled || !db) return null;
  const [{ value }] = await db
    .select({ value: count() })
    .from(executionSteps)
    .where(eq(executionSteps.executionId, executionId));

  const [row] = await db
    .insert(executionSteps)
    .values({
      executionId,
      stepIndex: Number(value ?? 0),
      nodeId,
      nodeType,
      status: "running",
      input,
      output: {},
    })
    .returning();
  return row ?? null;
}

export async function updateExecutionStep(
  stepId: string,
  status: ExecutionStepStatus,
  output?: Record<string, unknown>,
  error?: string,
): Promise<ExecutionStepRow | null> {
  if (!isDbEnabled || !db) return null;

  let duration: number | undefined;
  if (status === "success" || status === "failed") {
    const rows = await db
      .select({ createdAt: executionSteps.createdAt })
      .from(executionSteps)
      .where(eq(executionSteps.id, stepId))
      .limit(1);
    if (rows[0]) duration = Date.now() - rows[0].createdAt.getTime();
  }

  const [row] = await db
    .update(executionSteps)
    .set({
      status,
      ...(output !== undefined ? { output } : {}),
      ...(error !== undefined ? { error } : {}),
      ...(duration !== undefined ? { duration } : {}),
    })
    .where(eq(executionSteps.id, stepId))
    .returning();
  return row ?? null;
}

export async function getExecutionSteps(
  executionId: string,
): Promise<ExecutionStepRow[]> {
  if (!isDbEnabled || !db) return [];
  return db
    .select()
    .from(executionSteps)
    .where(eq(executionSteps.executionId, executionId))
    .orderBy(asc(executionSteps.stepIndex));
}

// ---- analytics ------------------------------------------------------------
export async function getExecutionStats(
  workflowId: string,
  days = 30,
): Promise<{
  total: number;
  success: number;
  failed: number;
  running: number;
  avgDurationMs: number;
}> {
  const empty = { total: 0, success: 0, failed: 0, running: 0, avgDurationMs: 0 };
  if (!isDbEnabled || !db) return empty;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = and(
    eq(workflowExecutions.workflowId, workflowId),
    gte(workflowExecutions.startedAt, since),
  );

  const [stats] = await db
    .select({
      total: count(),
      success: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'success')`,
      failed: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'failed')`,
      running: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'running')`,
      avgDurationMs: sql<number>`coalesce(avg(${workflowExecutions.duration}), 0)`,
    })
    .from(workflowExecutions)
    .where(where);

  return {
    total: Number(stats?.total ?? 0),
    success: Number(stats?.success ?? 0),
    failed: Number(stats?.failed ?? 0),
    running: Number(stats?.running ?? 0),
    avgDurationMs: Math.round(Number(stats?.avgDurationMs ?? 0)),
  };
}

export async function getWorkflowStats(userId: string): Promise<{
  totalWorkflows: number;
  published: number;
  active: number;
  totalExecutions: number;
}> {
  const empty = {
    totalWorkflows: 0,
    published: 0,
    active: 0,
    totalExecutions: 0,
  };
  if (!isDbEnabled || !db) return empty;

  const [wf] = await db
    .select({
      totalWorkflows: count(),
      published: sql<number>`count(*) filter (where ${workflows.isPublished})`,
      active: sql<number>`count(*) filter (where ${workflows.isActive})`,
    })
    .from(workflows)
    .where(eq(workflows.userId, userId));

  const [ex] = await db
    .select({ totalExecutions: count() })
    .from(workflowExecutions)
    .where(eq(workflowExecutions.userId, userId));

  return {
    totalWorkflows: Number(wf?.totalWorkflows ?? 0),
    published: Number(wf?.published ?? 0),
    active: Number(wf?.active ?? 0),
    totalExecutions: Number(ex?.totalExecutions ?? 0),
  };
}

// ===========================================================================
// Dashboard / monitoring
// ===========================================================================
export interface DashboardMetrics {
  totalWorkflows: number;
  publishedWorkflows: number;
  activeSchedules: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  runningExecutions: number;
  pausedExecutions: number;
  averageDurationMs: number;
  successRate: number;
}

export async function getDashboardMetrics(
  userId: string,
): Promise<DashboardMetrics> {
  const empty: DashboardMetrics = {
    totalWorkflows: 0,
    publishedWorkflows: 0,
    activeSchedules: 0,
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    runningExecutions: 0,
    pausedExecutions: 0,
    averageDurationMs: 0,
    successRate: 0,
  };
  if (!isDbEnabled || !db) return empty;

  const [wf] = await db
    .select({
      total: count(),
      published: sql<number>`count(*) filter (where ${workflows.isPublished})`,
    })
    .from(workflows)
    .where(eq(workflows.userId, userId));

  const [sched] = await db
    .select({ active: count() })
    .from(workflowSchedules)
    .innerJoin(workflows, eq(workflowSchedules.workflowId, workflows.id))
    .where(and(eq(workflows.userId, userId), eq(workflowSchedules.isActive, true)));

  const [ex] = await db
    .select({
      total: count(),
      success: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'success')`,
      failed: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'failed')`,
      running: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'running')`,
      paused: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'paused')`,
      avg: sql<number>`coalesce(avg(${workflowExecutions.duration}), 0)`,
    })
    .from(workflowExecutions)
    .where(eq(workflowExecutions.userId, userId));

  const success = Number(ex?.success ?? 0);
  const failed = Number(ex?.failed ?? 0);
  const completed = success + failed;

  return {
    totalWorkflows: Number(wf?.total ?? 0),
    publishedWorkflows: Number(wf?.published ?? 0),
    activeSchedules: Number(sched?.active ?? 0),
    totalExecutions: Number(ex?.total ?? 0),
    successfulExecutions: success,
    failedExecutions: failed,
    runningExecutions: Number(ex?.running ?? 0),
    pausedExecutions: Number(ex?.paused ?? 0),
    averageDurationMs: Math.round(Number(ex?.avg ?? 0)),
    successRate: completed > 0 ? Math.round((success / completed) * 100) : 0,
  };
}

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  successful: number;
  failed: number;
  other: number;
}

export async function getExecutionTrend(
  userId: string,
  days = 30,
): Promise<TrendPoint[]> {
  if (!isDbEnabled || !db) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dayExpr = sql<string>`to_char(date_trunc('day', ${workflowExecutions.startedAt}), 'YYYY-MM-DD')`;

  const rows = await db
    .select({
      date: dayExpr,
      successful: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'success')`,
      failed: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'failed')`,
      total: count(),
    })
    .from(workflowExecutions)
    .where(
      and(
        eq(workflowExecutions.userId, userId),
        gte(workflowExecutions.startedAt, since),
      ),
    )
    .groupBy(dayExpr)
    .orderBy(dayExpr);

  return rows.map((r) => {
    const successful = Number(r.successful ?? 0);
    const failed = Number(r.failed ?? 0);
    return {
      date: r.date,
      successful,
      failed,
      other: Math.max(Number(r.total ?? 0) - successful - failed, 0),
    };
  });
}

export interface RecentExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  triggerType: string;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
  error: string | null;
}

export async function getRecentExecutions(
  userId: string,
  limit = 10,
): Promise<RecentExecution[]> {
  if (!isDbEnabled || !db) return [];
  return db
    .select({
      id: workflowExecutions.id,
      workflowId: workflowExecutions.workflowId,
      workflowName: workflows.name,
      status: workflowExecutions.status,
      triggerType: workflowExecutions.triggerType,
      startedAt: workflowExecutions.startedAt,
      completedAt: workflowExecutions.completedAt,
      duration: workflowExecutions.duration,
      error: workflowExecutions.error,
    })
    .from(workflowExecutions)
    .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
    .where(eq(workflowExecutions.userId, userId))
    .orderBy(desc(workflowExecutions.startedAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export interface NodeUsage {
  nodeType: string;
  total: number;
  success: number;
  failed: number;
}

export async function getNodeTypeUsage(userId: string): Promise<NodeUsage[]> {
  if (!isDbEnabled || !db) return [];
  const rows = await db
    .select({
      nodeType: executionSteps.nodeType,
      total: count(),
      success: sql<number>`count(*) filter (where ${executionSteps.status} = 'success')`,
      failed: sql<number>`count(*) filter (where ${executionSteps.status} = 'failed')`,
    })
    .from(executionSteps)
    .innerJoin(
      workflowExecutions,
      eq(executionSteps.executionId, workflowExecutions.id),
    )
    .where(eq(workflowExecutions.userId, userId))
    .groupBy(executionSteps.nodeType);

  return rows
    .map((r) => ({
      nodeType: r.nodeType,
      total: Number(r.total ?? 0),
      success: Number(r.success ?? 0),
      failed: Number(r.failed ?? 0),
    }))
    .sort((a, b) => b.total - a.total);
}
