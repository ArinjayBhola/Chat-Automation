import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { uid } from "../utils";
import { APPROVAL_TIMEOUT_SECONDS } from "../types";
import type {
  ActionType,
  ApprovalField,
  ClientApproval,
  ToolId,
} from "../types";
import { getValidAccessToken } from "../tools/connections";
import * as g from "../tools/google-api";
import * as n from "../tools/notion-api";

/**
 * Builds the AI SDK tool set for a single request. Only tools whose backing
 * service is connected are registered, so the model can't choose a tool it
 * can't run. Read tools execute live; sensitive (write) tools return an
 * "approval_required" proposal instead of acting — execution happens after the
 * user approves (Phase 4).
 */

export type AgentContext = {
  userId: string;
  connected: Set<ToolId>;
};

function makeApproval(
  actionType: ActionType,
  toolName: string,
  description: string,
  fields: ApprovalField[],
): ClientApproval {
  return {
    id: uid("appr"),
    actionType,
    toolName,
    description,
    fields,
    status: "pending",
    timeoutSeconds: APPROVAL_TIMEOUT_SECONDS,
  };
}

/** Standard shape returned by sensitive tools. */
function approvalResult(approval: ClientApproval) {
  return {
    status: "approval_required" as const,
    approval,
    note: "Queued for the user's approval. Do not retry; summarize what's pending and stop.",
  };
}

async function token(ctx: AgentContext, t: ToolId): Promise<string> {
  const tok = await getValidAccessToken(ctx.userId, t);
  if (!tok) throw new Error(`${t} is not connected.`);
  return tok;
}

export function buildTools(ctx: AgentContext): ToolSet {
  const tools: ToolSet = {};
  const has = (t: ToolId) => ctx.connected.has(t);

  // ---------------------------------------------------------------- Gmail
  if (has("gmail")) {
    tools.gmail_search_emails = tool({
      description:
        "Search the user's Gmail. Use Gmail query syntax (e.g. 'is:unread', 'from:alice subject:invoice').",
      inputSchema: z.object({
        query: z.string().describe("Gmail search query"),
        max: z.number().int().min(1).max(25).optional(),
      }),
      execute: async ({ query, max }) =>
        g.gmailSearch(await token(ctx, "gmail"), query, max ?? 10),
    });

    tools.gmail_read_email = tool({
      description: "Read the full content of one email by its id.",
      inputSchema: z.object({ emailId: z.string() }),
      execute: async ({ emailId }) =>
        g.gmailReadEmail(await token(ctx, "gmail"), emailId),
    });

    tools.gmail_mark_as_read = tool({
      description: "Mark an email as read by its id.",
      inputSchema: z.object({ emailId: z.string() }),
      execute: async ({ emailId }) => {
        await g.gmailMarkRead(await token(ctx, "gmail"), emailId);
        return { ok: true };
      },
    });

    tools.gmail_send_email = tool({
      description:
        "Send an email. SENSITIVE: this requires user approval and will not send immediately.",
      inputSchema: z.object({
        to: z.string().describe("Recipient email address"),
        subject: z.string(),
        body: z.string(),
      }),
      execute: async ({ to, subject, body }) =>
        approvalResult(
          makeApproval("send_email", "Gmail", `Send an email to ${to}`, [
            { key: "to", label: "To", value: to },
            { key: "subject", label: "Subject", value: subject },
            { key: "body", label: "Body", value: body, multiline: true },
          ]),
        ),
    });
  }

  // ---------------------------------------------------------------- Drive
  if (has("drive")) {
    tools.drive_search_files = tool({
      description: "Search the user's Google Drive by file name.",
      inputSchema: z.object({
        query: z.string(),
        mimeType: z.string().optional(),
      }),
      execute: async ({ query, mimeType }) =>
        g.driveSearch(await token(ctx, "drive"), query, mimeType),
    });

    tools.drive_list_files = tool({
      description: "List recent files in Drive, optionally within a folder id.",
      inputSchema: z.object({
        folderId: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({ folderId, limit }) =>
        g.driveList(await token(ctx, "drive"), folderId, limit ?? 20),
    });

    tools.drive_read_file = tool({
      description: "Read the text content of a Drive file by id.",
      inputSchema: z.object({ fileId: z.string() }),
      execute: async ({ fileId }) =>
        g.driveReadFile(await token(ctx, "drive"), fileId),
    });

    tools.drive_save_file = tool({
      description: "Create/save a text file in Drive.",
      inputSchema: z.object({
        filename: z.string(),
        content: z.string(),
      }),
      execute: async ({ filename, content }) =>
        g.driveSaveFile(await token(ctx, "drive"), filename, content),
    });
  }

  // ---------------------------------------------------------------- Docs
  if (has("docs")) {
    tools.docs_read_document = tool({
      description: "Read a Google Doc's text by document id.",
      inputSchema: z.object({ documentId: z.string() }),
      execute: async ({ documentId }) =>
        g.docsRead(await token(ctx, "docs"), documentId),
    });

    tools.docs_create_document = tool({
      description:
        "Create a new Google Doc. SENSITIVE: requires user approval before creation.",
      inputSchema: z.object({ title: z.string(), content: z.string() }),
      execute: async ({ title, content }) =>
        approvalResult(
          makeApproval("update_doc", "Google Docs", `Create a doc "${title}"`, [
            { key: "title", label: "Title", value: title },
            { key: "content", label: "Content", value: content, multiline: true },
          ]),
        ),
    });

    tools.docs_update_document = tool({
      description:
        "Append text to an existing Google Doc. SENSITIVE: requires user approval.",
      inputSchema: z.object({ documentId: z.string(), text: z.string() }),
      execute: async ({ documentId, text }) =>
        approvalResult(
          makeApproval("update_doc", "Google Docs", "Append text to a doc", [
            { key: "documentId", label: "Document id", value: documentId },
            { key: "text", label: "Text to append", value: text, multiline: true },
          ]),
        ),
    });
  }

  // ---------------------------------------------------------------- Calendar
  if (has("calendar")) {
    tools.calendar_list_events = tool({
      description: "List upcoming calendar events within the next N days.",
      inputSchema: z.object({
        daysAhead: z.number().int().min(1).max(60).optional(),
      }),
      execute: async ({ daysAhead }) =>
        g.calendarList(await token(ctx, "calendar"), daysAhead ?? 7),
    });

    tools.calendar_search_events = tool({
      description: "Search calendar events by keyword.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) =>
        g.calendarSearch(await token(ctx, "calendar"), query),
    });

    tools.calendar_create_event = tool({
      description:
        "Create a calendar event. SENSITIVE: requires user approval before creation. Use ISO date-times.",
      inputSchema: z.object({
        title: z.string(),
        start: z.string().describe("ISO start datetime"),
        end: z.string().describe("ISO end datetime"),
        description: z.string().optional(),
      }),
      execute: async ({ title, start, end, description }) =>
        approvalResult(
          makeApproval("create_event", "Google Calendar", `Create event "${title}"`, [
            { key: "title", label: "Title", value: title },
            { key: "start", label: "Start", value: start },
            { key: "end", label: "End", value: end },
            {
              key: "description",
              label: "Description",
              value: description ?? "",
              multiline: true,
            },
          ]),
        ),
    });
  }

  // ---------------------------------------------------------------- Notion
  if (has("notion")) {
    tools.notion_search_pages = tool({
      description: "Search the user's Notion pages.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) =>
        n.notionSearch(await token(ctx, "notion"), query),
    });

    tools.notion_read_page = tool({
      description: "Read a Notion page's text content by id.",
      inputSchema: z.object({ pageId: z.string() }),
      execute: async ({ pageId }) =>
        n.notionReadPage(await token(ctx, "notion"), pageId),
    });

    tools.notion_create_page = tool({
      description:
        "Create a Notion page under a parent page. SENSITIVE: requires user approval.",
      inputSchema: z.object({
        parentId: z.string(),
        title: z.string(),
        content: z.string(),
      }),
      execute: async ({ parentId, title, content }) =>
        approvalResult(
          makeApproval("create_notion_page", "Notion", `Create page "${title}"`, [
            { key: "parentId", label: "Parent page id", value: parentId },
            { key: "title", label: "Title", value: title },
            { key: "content", label: "Content", value: content, multiline: true },
          ]),
        ),
    });

    tools.notion_update_page = tool({
      description:
        "Append content to a Notion page. SENSITIVE: requires user approval.",
      inputSchema: z.object({ pageId: z.string(), content: z.string() }),
      execute: async ({ pageId, content }) =>
        approvalResult(
          makeApproval("create_notion_page", "Notion", "Update a Notion page", [
            { key: "pageId", label: "Page id", value: pageId },
            { key: "content", label: "Content", value: content, multiline: true },
          ]),
        ),
    });
  }

  return tools;
}

/** Maps an AI SDK tool name (e.g. "gmail_send_email") to our ToolId for UI. */
export function toolNameToToolId(name: string): ToolId | null {
  const prefix = name.split("_")[0];
  if (["gmail", "drive", "docs", "calendar", "notion"].includes(prefix)) {
    return prefix as ToolId;
  }
  return null;
}
