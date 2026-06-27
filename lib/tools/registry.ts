import type { ToolId } from "../types";

/**
 * Static metadata for each connectable tool: which OAuth provider backs it and
 * the scopes/capabilities required. Pure data (no Node imports) so it can be
 * referenced from both client and server.
 */

export type ToolProvider = "google" | "notion";

export const TOOL_PROVIDER: Record<ToolId, ToolProvider> = {
  gmail: "google",
  drive: "google",
  docs: "google",
  calendar: "google",
  notion: "notion",
};

/** OAuth scopes requested when connecting each Google-backed tool. */
export const GOOGLE_SCOPES: Record<
  Extract<ToolId, "gmail" | "drive" | "docs" | "calendar">,
  string[]
> = {
  gmail: ["https://www.googleapis.com/auth/gmail.modify"],
  drive: ["https://www.googleapis.com/auth/drive"],
  docs: ["https://www.googleapis.com/auth/documents"],
  calendar: ["https://www.googleapis.com/auth/calendar"],
};

export const ALL_TOOL_IDS: ToolId[] = [
  "gmail",
  "drive",
  "docs",
  "calendar",
  "notion",
];

export function isToolId(value: string): value is ToolId {
  return (ALL_TOOL_IDS as string[]).includes(value);
}

/** Whether the credentials for a tool's provider are present in the env. */
export function toolProviderConfigured(tool: ToolId): boolean {
  const provider = TOOL_PROVIDER[tool];
  if (provider === "google") {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    );
  }
  return Boolean(
    process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET,
  );
}

export function googleScopesFor(tool: ToolId): string[] {
  if (tool === "notion") return [];
  return GOOGLE_SCOPES[tool];
}
