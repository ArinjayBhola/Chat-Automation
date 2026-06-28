import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { WorkflowNode, WorkflowEdge } from "./types/workflow";

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

// Workflow automation enums --------------------------------------------------
export const workflowExecutionStatusEnum = pgEnum("workflow_execution_status", [
  "running",
  "success",
  "failed",
  "paused",
]);

export const workflowTriggerTypeEnum = pgEnum("workflow_trigger_type", [
  "manual",
  "scheduled",
  "webhook",
]);

export const executionStepStatusEnum = pgEnum("execution_step_status", [
  "pending",
  "running",
  "success",
  "failed",
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
// workflows — user-authored automations (graph of nodes + edges)
// ---------------------------------------------------------------------------
export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    isPublished: boolean("is_published").notNull().default(false),
    version: integer("version").notNull().default(1),
    nodes: jsonb("nodes").$type<WorkflowNode[]>().notNull().default([]),
    edges: jsonb("edges").$type<WorkflowEdge[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("workflows_user_idx").on(t.userId),
    activeIdx: index("workflows_active_idx").on(t.isActive),
    createdIdx: index("workflows_created_idx").on(t.createdAt),
  }),
);

// ---------------------------------------------------------------------------
// workflow_versions — immutable history snapshots of a workflow's graph
// ---------------------------------------------------------------------------
export const workflowVersions = pgTable(
  "workflow_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    nodes: jsonb("nodes").$type<WorkflowNode[]>().notNull().default([]),
    edges: jsonb("edges").$type<WorkflowEdge[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    workflowIdx: index("workflow_versions_workflow_idx").on(t.workflowId),
  }),
);

// ---------------------------------------------------------------------------
// workflow_schedules — cron triggers for a workflow
// ---------------------------------------------------------------------------
export const workflowSchedules = pgTable(
  "workflow_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    schedule: text("schedule").notNull(), // cron expression
    timezone: text("timezone").notNull().default("UTC"),
    isActive: boolean("is_active").notNull().default(true),
    lastRun: timestamp("last_run", { withTimezone: true }),
    nextRun: timestamp("next_run", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    workflowIdx: index("workflow_schedules_workflow_idx").on(t.workflowId),
    activeIdx: index("workflow_schedules_active_idx").on(t.isActive),
  }),
);

// ---------------------------------------------------------------------------
// workflow_executions — one run of a workflow
// ---------------------------------------------------------------------------
export const workflowExecutions = pgTable(
  "workflow_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: workflowExecutionStatusEnum("status").notNull().default("running"),
    triggerType: workflowTriggerTypeEnum("trigger_type").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    duration: integer("duration"), // milliseconds
    inputData: jsonb("input_data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    outputData: jsonb("output_data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    workflowIdx: index("workflow_executions_workflow_idx").on(t.workflowId),
    userIdx: index("workflow_executions_user_idx").on(t.userId),
    statusIdx: index("workflow_executions_status_idx").on(t.status),
    createdIdx: index("workflow_executions_created_idx").on(t.createdAt),
  }),
);

// ---------------------------------------------------------------------------
// execution_steps — per-node log for a single execution
// ---------------------------------------------------------------------------
export const executionSteps = pgTable(
  "execution_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executionId: uuid("execution_id")
      .notNull()
      .references(() => workflowExecutions.id, { onDelete: "cascade" }),
    stepIndex: integer("step_index").notNull(),
    nodeId: text("node_id").notNull(), // UUID of the node in the workflow graph
    nodeType: text("node_type").notNull(),
    status: executionStepStatusEnum("status").notNull().default("pending"),
    input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
    output: jsonb("output")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    error: text("error"),
    duration: integer("duration"), // milliseconds
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    executionIdx: index("execution_steps_execution_idx").on(t.executionId),
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

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  user: one(users, { fields: [workflows.userId], references: [users.id] }),
  versions: many(workflowVersions),
  schedules: many(workflowSchedules),
  executions: many(workflowExecutions),
}));

export const workflowVersionsRelations = relations(
  workflowVersions,
  ({ one }) => ({
    workflow: one(workflows, {
      fields: [workflowVersions.workflowId],
      references: [workflows.id],
    }),
  }),
);

export const workflowSchedulesRelations = relations(
  workflowSchedules,
  ({ one }) => ({
    workflow: one(workflows, {
      fields: [workflowSchedules.workflowId],
      references: [workflows.id],
    }),
  }),
);

export const workflowExecutionsRelations = relations(
  workflowExecutions,
  ({ one, many }) => ({
    workflow: one(workflows, {
      fields: [workflowExecutions.workflowId],
      references: [workflows.id],
    }),
    user: one(users, {
      fields: [workflowExecutions.userId],
      references: [users.id],
    }),
    steps: many(executionSteps),
  }),
);

export const executionStepsRelations = relations(executionSteps, ({ one }) => ({
  execution: one(workflowExecutions, {
    fields: [executionSteps.executionId],
    references: [workflowExecutions.id],
  }),
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

// Workflow row types (DB shape). Domain types live in lib/types/workflow.ts.
export type WorkflowRow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
export type WorkflowVersionRow = typeof workflowVersions.$inferSelect;
export type NewWorkflowVersion = typeof workflowVersions.$inferInsert;
export type WorkflowScheduleRow = typeof workflowSchedules.$inferSelect;
export type NewWorkflowSchedule = typeof workflowSchedules.$inferInsert;
export type WorkflowExecutionRow = typeof workflowExecutions.$inferSelect;
export type NewWorkflowExecution = typeof workflowExecutions.$inferInsert;
export type ExecutionStepRow = typeof executionSteps.$inferSelect;
export type NewExecutionStep = typeof executionSteps.$inferInsert;

export type WorkflowExecutionStatus =
  (typeof workflowExecutionStatusEnum.enumValues)[number];
export type WorkflowTriggerType =
  (typeof workflowTriggerTypeEnum.enumValues)[number];
export type ExecutionStepStatus =
  (typeof executionStepStatusEnum.enumValues)[number];
