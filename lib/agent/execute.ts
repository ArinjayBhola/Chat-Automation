import "server-only";
import { getValidAccessToken } from "../tools/connections";
import * as g from "../tools/google-api";
import * as n from "../tools/notion-api";
import { OP_TOOL, type ApprovalOp } from "./ops";

/**
 * Executes an approved sensitive action. Called by the approve route with the
 * (possibly user-edited) args. Returns a human-readable summary used in the UI
 * and audit log. Throws on failure so the route can report it.
 */
export async function executeApproval(
  userId: string,
  op: ApprovalOp,
  args: Record<string, unknown>,
): Promise<{ summary: string; data: unknown }> {
  const tool = OP_TOOL[op];
  const token = await getValidAccessToken(userId, tool);
  if (!token) {
    throw new Error(`${tool} is not connected — reconnect it and try again.`);
  }

  const s = (k: string) => String(args[k] ?? "");

  switch (op) {
    case "gmail.send": {
      const res = await g.gmailSendEmail(token, {
        to: s("to"),
        subject: s("subject"),
        body: s("body"),
      });
      return { summary: `Email sent to ${s("to")}.`, data: res };
    }
    case "calendar.create": {
      const res = await g.calendarCreate(token, {
        title: s("title"),
        start: s("start"),
        end: s("end"),
        description: s("description") || undefined,
      });
      return { summary: `Event "${res.summary}" created.`, data: res };
    }
    case "docs.create": {
      const res = await g.docsCreate(token, s("title"), s("content"));
      return { summary: `Doc "${s("title")}" created.`, data: res };
    }
    case "docs.append": {
      await g.docsAppend(token, s("documentId"), s("text"));
      return { summary: "Text appended to the document.", data: { ok: true } };
    }
    case "notion.create": {
      const res = await n.notionCreatePage(
        token,
        s("parentId"),
        s("title"),
        s("content"),
      );
      return { summary: `Notion page "${s("title")}" created.`, data: res };
    }
    case "notion.update": {
      const res = await n.notionUpdatePage(token, s("pageId"), s("content"));
      return { summary: "Notion page updated.", data: res };
    }
  }
}
