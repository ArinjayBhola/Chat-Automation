import { uid } from "../utils";
import type {
  ClientApproval,
  ClientMessage,
  Step,
  ToolId,
} from "../types";
import { APPROVAL_TIMEOUT_SECONDS } from "../types";

/**
 * Deterministic, credential-free "agent" used in demo mode and as a preview of
 * the real orchestration (Phase 3). It selects tools from keywords, builds a
 * plausible step plan, and raises an approval for any sensitive action so the
 * full UI (steps + approval gate) is exercisable without external services.
 */

type Plan = {
  content: string;
  toolsUsed: ToolId[];
  steps: Step[];
  approval?: ClientApproval;
};

function detectTools(text: string): ToolId[] {
  const t = text.toLowerCase();
  const tools = new Set<ToolId>();
  if (/\b(email|emails|inbox|gmail|unread|mail)\b/.test(t)) tools.add("gmail");
  if (/\b(drive|file|files|folder|upload|save)\b/.test(t)) tools.add("drive");
  if (/\b(doc|docs|document|report|write-up)\b/.test(t)) tools.add("docs");
  if (/\b(calendar|event|meeting|invite|schedule|week)\b/.test(t))
    tools.add("calendar");
  if (/\b(notion|page|notes?|wiki)\b/.test(t)) tools.add("notion");
  return [...tools];
}

export function planFromMessage(message: string): Plan {
  const tools = detectTools(message);
  const t = message.toLowerCase();
  const steps: Step[] = [];
  const used: ToolId[] = [];

  // Vague request → ask for clarification (mirrors real agent behavior).
  if (tools.length === 0) {
    return {
      content:
        "I can help with Gmail, Google Drive, Docs, Calendar, and Notion. " +
        "Could you tell me which of those to use and what you'd like done? " +
        'For example: "Show me unread emails and save the important ones to Drive."',
      toolsUsed: [],
      steps: [],
    };
  }

  if (tools.includes("gmail")) {
    used.push("gmail");
    steps.push({
      id: uid("step"),
      tool: "gmail",
      action: "search_emails(query: \"is:unread\")",
      status: "success",
      detail: "Found 4 unread emails (demo data).",
    });
  }
  if (tools.includes("calendar")) {
    used.push("calendar");
    steps.push({
      id: uid("step"),
      tool: "calendar",
      action: "list_events(daysAhead: 7)",
      status: "success",
      detail: "3 upcoming events this week (demo data).",
    });
  }
  if (tools.includes("docs")) {
    used.push("docs");
    steps.push({
      id: uid("step"),
      tool: "docs",
      action: "read_document(...)",
      status: "success",
      detail: "Read 1 meeting-notes doc (demo data).",
    });
  }
  if (tools.includes("drive")) {
    used.push("drive");
    steps.push({
      id: uid("step"),
      tool: "drive",
      action: "save_file(\"summary.md\")",
      status: "success",
      detail: "Saved to /auto-chat (demo data).",
    });
  }

  // Decide whether a sensitive action is implied → approval gate.
  let approval: ClientApproval | undefined;
  const wantsSend = /\b(send|email|invite|reply|forward)\b/.test(t);
  const wantsEvent = /\b(create|schedule|book|set up)\b/.test(t) &&
    tools.includes("calendar");
  const wantsNotionPage = /\b(create|add|new)\b/.test(t) &&
    tools.includes("notion");

  if (wantsSend && tools.includes("gmail")) {
    approval = {
      id: uid("appr"),
      actionType: "send_email",
      toolName: "Gmail",
      description: "Send an email summarizing the items found.",
      status: "pending",
      timeoutSeconds: APPROVAL_TIMEOUT_SECONDS,
      fields: [
        { key: "to", label: "To", value: "teammate@example.com" },
        { key: "subject", label: "Subject", value: "Summary from auto-chat" },
        {
          key: "body",
          label: "Body",
          value:
            "Hi,\n\nHere is the summary you asked for.\n\n— Sent via auto-chat",
          multiline: true,
        },
      ],
    };
  } else if (wantsEvent) {
    approval = {
      id: uid("appr"),
      actionType: "create_event",
      toolName: "Google Calendar",
      description: "Create a calendar event.",
      status: "pending",
      timeoutSeconds: APPROVAL_TIMEOUT_SECONDS,
      fields: [
        { key: "title", label: "Title", value: "New meeting" },
        { key: "start", label: "Start", value: "2026-06-28 10:00" },
        { key: "end", label: "End", value: "2026-06-28 10:30" },
        {
          key: "description",
          label: "Description",
          value: "Created via auto-chat.",
          multiline: true,
        },
      ],
    };
  } else if (wantsNotionPage) {
    approval = {
      id: uid("appr"),
      actionType: "create_notion_page",
      toolName: "Notion",
      description: "Create a Notion page.",
      status: "pending",
      timeoutSeconds: APPROVAL_TIMEOUT_SECONDS,
      fields: [
        { key: "title", label: "Title", value: "Auto-chat notes" },
        {
          key: "content",
          label: "Content",
          value: "Notes captured via auto-chat.",
          multiline: true,
        },
      ],
    };
  }

  if (approval) {
    steps.push({
      id: uid("step"),
      tool:
        approval.actionType === "create_event"
          ? "calendar"
          : approval.actionType === "create_notion_page"
            ? "notion"
            : "gmail",
      action: approval.description,
      status: "needs_approval",
      detail: "Waiting for your approval.",
    });
  }

  const toolList = used.map((u) => u).join(", ");
  const content =
    `Here's what I did using **${toolList || "no tools"}**:\n\n` +
    steps
      .filter((s) => s.status === "success")
      .map((s) => `- ✅ ${s.detail ?? s.action}`)
      .join("\n") +
    (approval
      ? `\n\n⚠️ One step needs your approval before I continue.`
      : `\n\nAll steps completed.`) +
    `\n\n_(Demo mode — connect real tools and an AI provider to run this for real.)_`;

  return { content, toolsUsed: used, steps, approval };
}

export function buildAssistantMessage(message: string): ClientMessage {
  const plan = planFromMessage(message);
  return {
    id: uid("msg"),
    role: "assistant",
    content: plan.content,
    createdAt: new Date().toISOString(),
    toolsUsed: plan.toolsUsed,
    steps: plan.steps,
    approval: plan.approval,
  };
}
