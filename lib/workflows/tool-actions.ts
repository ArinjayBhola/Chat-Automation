import "server-only";
import type { ToolId } from "@/lib/types";
import * as g from "@/lib/tools/google-api";
import * as n from "@/lib/tools/notion-api";

/**
 * Catalog of workflow tool actions. Each action maps a (toolName, action) pair
 * to a real call against the existing API wrappers (lib/tools/*), plus a
 * `simulate` form used by dry-run / "Test" so no external calls happen. Actions
 * flagged `write: true` are consequential (they create/send/modify) and are
 * never performed during a dry run.
 */

type ParamBag = Record<string, unknown>;

const str = (p: ParamBag, k: string, d = ""): string => String(p[k] ?? d);
const numOr = (p: ParamBag, k: string, d: number): number => {
  const v = Number(p[k]);
  return Number.isFinite(v) ? v : d;
};

export interface ToolAction {
  /** Whether the action mutates external state (send/create/update/delete). */
  write: boolean;
  run: (token: string, params: ParamBag) => Promise<unknown>;
  simulate: (params: ParamBag) => unknown;
}

export const TOOL_ACTIONS: Record<ToolId, Record<string, ToolAction>> = {
  gmail: {
    search_emails: {
      write: false,
      run: (t, p) => g.gmailSearch(t, str(p, "query"), numOr(p, "maxResults", 10)),
      simulate: () => ({ messages: [], count: 0, simulated: true }),
    },
    read_email: {
      write: false,
      run: (t, p) => g.gmailReadEmail(t, str(p, "emailId") || str(p, "id")),
      simulate: () => ({ id: "dry-run", from: "", subject: "", body: "", simulated: true }),
    },
    send_email: {
      write: true,
      run: (t, p) =>
        g.gmailSendEmail(t, {
          to: str(p, "to"),
          subject: str(p, "subject"),
          body: str(p, "body"),
        }),
      simulate: (p) => ({ success: true, to: str(p, "to"), simulated: true }),
    },
    mark_read: {
      write: true,
      run: async (t, p) => {
        await g.gmailMarkRead(t, str(p, "emailId") || str(p, "id"));
        return { ok: true };
      },
      simulate: () => ({ ok: true, simulated: true }),
    },
  },

  drive: {
    search_files: {
      write: false,
      run: (t, p) =>
        g.driveSearch(t, str(p, "query"), str(p, "mimeType") || undefined, numOr(p, "limit", 10)),
      simulate: () => ({ files: [], simulated: true }),
    },
    list_files: {
      write: false,
      run: (t, p) => g.driveList(t, str(p, "folderId") || undefined, numOr(p, "limit", 20)),
      simulate: () => ({ files: [], simulated: true }),
    },
    read_file: {
      write: false,
      run: async (t, p) => ({ content: await g.driveReadFile(t, str(p, "fileId")) }),
      simulate: () => ({ content: "", simulated: true }),
    },
    save_file: {
      write: true,
      run: (t, p) =>
        g.driveSaveFile(t, str(p, "name"), str(p, "content"), str(p, "mimeType") || undefined),
      simulate: (p) => ({ id: "dry-run", name: str(p, "name"), simulated: true }),
    },
  },

  docs: {
    read_doc: {
      write: false,
      run: (t, p) => g.docsRead(t, str(p, "documentId")),
      simulate: () => ({ title: "", text: "", simulated: true }),
    },
    create_doc: {
      write: true,
      run: (t, p) => g.docsCreate(t, str(p, "title"), str(p, "content")),
      simulate: (p) => ({ documentId: "dry-run", title: str(p, "title"), simulated: true }),
    },
    append_doc: {
      write: true,
      run: async (t, p) => {
        await g.docsAppend(t, str(p, "documentId"), str(p, "text"));
        return { ok: true };
      },
      simulate: () => ({ ok: true, simulated: true }),
    },
  },

  calendar: {
    list_events: {
      write: false,
      run: (t, p) => g.calendarList(t, numOr(p, "daysAhead", 7)),
      simulate: () => ({ events: [], simulated: true }),
    },
    search_events: {
      write: false,
      run: (t, p) => g.calendarSearch(t, str(p, "query")),
      simulate: () => ({ events: [], simulated: true }),
    },
    create_event: {
      write: true,
      run: (t, p) =>
        g.calendarCreate(t, {
          title: str(p, "title"),
          start: str(p, "start"),
          end: str(p, "end"),
          description: str(p, "description") || undefined,
        }),
      simulate: (p) => ({ id: "dry-run", summary: str(p, "title"), simulated: true }),
    },
  },

  notion: {
    search_pages: {
      write: false,
      run: (t, p) => n.notionSearch(t, str(p, "query")),
      simulate: () => ({ pages: [], simulated: true }),
    },
    read_page: {
      write: false,
      run: (t, p) => n.notionReadPage(t, str(p, "pageId")),
      simulate: () => ({ id: "dry-run", text: "", simulated: true }),
    },
    create_page: {
      write: true,
      run: (t, p) =>
        n.notionCreatePage(t, str(p, "parentId"), str(p, "title"), str(p, "content")),
      simulate: (p) => ({ id: "dry-run", title: str(p, "title"), simulated: true }),
    },
    update_page: {
      write: true,
      run: (t, p) => n.notionUpdatePage(t, str(p, "pageId"), str(p, "content")),
      simulate: () => ({ id: "dry-run", simulated: true }),
    },
  },
};

export function getToolAction(
  toolName: string,
  action: string,
): ToolAction | null {
  const tool = TOOL_ACTIONS[toolName as ToolId];
  if (!tool) return null;
  return tool[action] ?? null;
}

export function listToolActions(toolName: string): string[] {
  const tool = TOOL_ACTIONS[toolName as ToolId];
  return tool ? Object.keys(tool) : [];
}
