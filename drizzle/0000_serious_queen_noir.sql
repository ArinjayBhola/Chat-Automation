CREATE TYPE "public"."action_type" AS ENUM('send_email', 'create_event', 'update_doc', 'create_notion_page');--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('running', 'switched', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."execution_step_status" AS ENUM('pending', 'running', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."tool" AS ENUM('gmail', 'drive', 'docs', 'calendar', 'notion');--> statement-breakpoint
CREATE TYPE "public"."workflow_execution_status" AS ENUM('running', 'success', 'failed', 'paused');--> statement-breakpoint
CREATE TYPE "public"."workflow_trigger_type" AS ENUM('manual', 'scheduled', 'webhook');--> statement-breakpoint
CREATE TABLE "agent_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" uuid,
	"status" "agent_run_status" DEFAULT 'running' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"active_provider" text,
	"active_model_id" text,
	"working_memory" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"committed_text" text DEFAULT '' NOT NULL,
	"provider_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failure_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"token_usage" jsonb DEFAULT '{"inputTokens":0,"outputTokens":0,"totalTokens":0}'::jsonb NOT NULL,
	"cost_usd" text DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_checkpoints_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action_type" "action_type" NOT NULL,
	"tool_name" text NOT NULL,
	"action_data" jsonb NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"edited_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"pinned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "execution_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"step_index" integer NOT NULL,
	"node_id" text NOT NULL,
	"node_type" text NOT NULL,
	"status" "execution_step_status" DEFAULT 'pending' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"duration" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"tool_used" text[] DEFAULT '{}' NOT NULL,
	"execution_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"provider" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"cached_input_tokens" bigint DEFAULT 0 NOT NULL,
	"reasoning_tokens" bigint DEFAULT 0 NOT NULL,
	"total_tokens" bigint DEFAULT 0 NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tool" "tool" NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_id" text,
	"email" text NOT NULL,
	"name" text,
	"picture" text,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workflow_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "workflow_execution_status" DEFAULT 'running' NOT NULL,
	"trigger_type" "workflow_trigger_type" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration" integer,
	"input_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"schedule" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"name" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run" timestamp with time zone,
	"next_run" timestamp with time zone,
	"total_runs" integer DEFAULT 0 NOT NULL,
	"successful_runs" integer DEFAULT 0 NOT NULL,
	"failed_runs" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_checkpoints" ADD CONSTRAINT "agent_checkpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_checkpoints" ADD CONSTRAINT "agent_checkpoints_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_steps" ADD CONSTRAINT "execution_steps_execution_id_workflow_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."workflow_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_usage" ADD CONSTRAINT "model_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_connections" ADD CONSTRAINT "tool_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_schedules" ADD CONSTRAINT "workflow_schedules_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_checkpoints_user_idx" ON "agent_checkpoints" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_checkpoints_chat_idx" ON "agent_checkpoints" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "agent_checkpoints_status_idx" ON "agent_checkpoints" USING btree ("status");--> statement-breakpoint
CREATE INDEX "approvals_chat_idx" ON "approvals" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "approvals_status_idx" ON "approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "approvals_user_status_idx" ON "approvals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "approvals_chat_status_idx" ON "approvals" USING btree ("chat_id","status");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "chats_user_idx" ON "chats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chats_user_archived_updated_idx" ON "chats" USING btree ("user_id","archived_at","updated_at");--> statement-breakpoint
CREATE INDEX "execution_steps_execution_idx" ON "execution_steps" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "messages_chat_idx" ON "messages" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "messages_chat_user_created_idx" ON "messages" USING btree ("chat_id","user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "model_usage_user_model_window_idx" ON "model_usage" USING btree ("user_id","model_id","window_start");--> statement-breakpoint
CREATE INDEX "model_usage_user_idx" ON "model_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "model_usage_user_window_idx" ON "model_usage" USING btree ("user_id","window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_connections_user_tool_idx" ON "tool_connections" USING btree ("user_id","tool");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "workflow_executions_workflow_idx" ON "workflow_executions" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_executions_user_idx" ON "workflow_executions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_executions_created_idx" ON "workflow_executions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workflow_schedules_workflow_idx" ON "workflow_schedules" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_schedules_active_idx" ON "workflow_schedules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "workflow_schedules_next_run_idx" ON "workflow_schedules" USING btree ("next_run");--> statement-breakpoint
CREATE INDEX "workflow_versions_workflow_idx" ON "workflow_versions" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflows_user_idx" ON "workflows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workflows_active_idx" ON "workflows" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "workflows_created_idx" ON "workflows" USING btree ("created_at");