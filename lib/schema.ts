import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const toolEnum = pgEnum("tool", [
  "gmail",
  "drive",
  "docs",
  "calendar",
  "notion",
]);

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);

export const actionTypeEnum = pgEnum("action_type", [
  "send_email",
  "create_event",
  "update_doc",
  "create_notion_page",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "skipped",
]);

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    googleId: text("google_id").unique(),
    email: text("email").notNull().unique(),
    name: text("name"),
    picture: text("picture"),
    // Set only for email/password accounts; null for OAuth-only users.
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailIdx: index("users_email_idx").on(t.email),
  }),
);

// ---------------------------------------------------------------------------
// tool_connections
// ---------------------------------------------------------------------------
export const toolConnections = pgTable(
  "tool_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tool: toolEnum("tool").notNull(),
    // Tokens are stored encrypted at rest (see lib/crypto.ts).
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userToolIdx: uniqueIndex("tool_connections_user_tool_idx").on(
      t.userId,
      t.tool,
    ),
  }),
);

// ---------------------------------------------------------------------------
// chats
// ---------------------------------------------------------------------------
export const chats = pgTable(
  "chats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New chat"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("chats_user_idx").on(t.userId),
  }),
);

// ---------------------------------------------------------------------------
// messages
// ---------------------------------------------------------------------------
export type ExecutionStep = {
  id: string;
  tool: string | null;
  action: string;
  status: "pending" | "in_progress" | "success" | "failed" | "needs_approval";
  detail?: string;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
};

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull().default(""),
    toolUsed: text("tool_used").array().notNull().default([]),
    executionSteps: jsonb("execution_steps")
      .$type<ExecutionStep[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    chatIdx: index("messages_chat_idx").on(t.chatId),
  }),
);

// ---------------------------------------------------------------------------
// approvals
// ---------------------------------------------------------------------------
export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actionType: actionTypeEnum("action_type").notNull(),
    toolName: text("tool_name").notNull(),
    actionData: jsonb("action_data").$type<Record<string, unknown>>().notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: approvalStatusEnum("status").notNull().default("pending"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by"),
    editedData: jsonb("edited_data").$type<Record<string, unknown>>(),
  },
  (t) => ({
    chatIdx: index("approvals_chat_idx").on(t.chatId),
    statusIdx: index("approvals_status_idx").on(t.status),
  }),
);

// ---------------------------------------------------------------------------
// audit_logs — append-only trail of approvals and sensitive actions
// ---------------------------------------------------------------------------
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(), // e.g. "approval.approved", "tool.execute"
    targetType: text("target_type"), // e.g. "approval", "message"
    targetId: text("target_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("audit_logs_user_idx").on(t.userId),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  toolConnections: many(toolConnections),
  chats: many(chats),
  messages: many(messages),
  approvals: many(approvals),
}));

export const toolConnectionsRelations = relations(toolConnections, ({ one }) => ({
  user: one(users, {
    fields: [toolConnections.userId],
    references: [users.id],
  }),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, { fields: [chats.userId], references: [users.id] }),
  messages: many(messages),
  approvals: many(approvals),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, { fields: [messages.chatId], references: [chats.id] }),
  user: one(users, { fields: [messages.userId], references: [users.id] }),
  approvals: many(approvals),
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
  chat: one(chats, { fields: [approvals.chatId], references: [chats.id] }),
  message: one(messages, {
    fields: [approvals.messageId],
    references: [messages.id],
  }),
  user: one(users, { fields: [approvals.userId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ToolConnection = typeof toolConnections.$inferSelect;
export type NewToolConnection = typeof toolConnections.$inferInsert;
export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type ToolName = (typeof toolEnum.enumValues)[number];
export type ActionType = (typeof actionTypeEnum.enumValues)[number];
export type ApprovalStatus = (typeof approvalStatusEnum.enumValues)[number];
