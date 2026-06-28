import "server-only";
import type { ToolId } from "@/lib/types";
import { getValidAccessToken } from "@/lib/tools/connections";
import { getToolAction } from "./tool-actions";

/** Thrown when a tool isn't connected (no valid token). Mapped to an "auth" error. */
export class ToolAuthError extends Error {
  constructor(tool: string) {
    super(`${tool} is not connected. Connect it and try again.`);
    this.name = "ToolAuthError";
  }
}

export interface ToolRunResult {
  data: unknown;
  /** Whether this was a consequential write action. */
  write: boolean;
  /** Whether the call was simulated (dry run). */
  simulated: boolean;
}

/**
 * Dispatches a tool action to the real API wrappers, resolving the user's
 * (auto-refreshed) access token. In dry-run mode it returns the action's
 * simulated result instead of making any external call.
 */
export class ToolExecutor {
  private readonly userId: string;
  private readonly dryRun: boolean;
  private readonly tokenCache = new Map<ToolId, string | null>();

  constructor(userId: string, dryRun = false) {
    this.userId = userId;
    this.dryRun = dryRun;
  }

  async execute(
    toolName: string,
    action: string,
    params: Record<string, unknown>,
  ): Promise<ToolRunResult> {
    const def = getToolAction(toolName, action);
    if (!def) {
      throw new Error(`Unknown tool action: ${toolName}.${action}`);
    }

    if (this.dryRun) {
      return { data: def.simulate(params), write: def.write, simulated: true };
    }

    const token = await this.token(toolName as ToolId);
    if (!token) throw new ToolAuthError(toolName);

    const data = await def.run(token, params);
    return { data, write: def.write, simulated: false };
  }

  private async token(tool: ToolId): Promise<string | null> {
    if (this.tokenCache.has(tool)) return this.tokenCache.get(tool) ?? null;
    const token = await getValidAccessToken(this.userId, tool);
    this.tokenCache.set(tool, token);
    return token;
  }
}
