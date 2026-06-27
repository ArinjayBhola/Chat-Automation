import "server-only";
import type { ToolId } from "../types";
import { decrypt, encrypt } from "../crypto";
import {
  getToolConnection,
  updateToolAccessToken,
  upsertToolConnection,
} from "../db-queries";
import { TOOL_PROVIDER } from "./registry";
import { refreshGoogleToken } from "./oauth-google";

/**
 * Server-side connection management: encrypts tokens before persistence and
 * transparently refreshes expired Google access tokens on read.
 */

// Refresh a little early so in-flight calls don't race the expiry.
const EXPIRY_SKEW_MS = 60_000;

export async function storeConnection(input: {
  userId: string;
  tool: ToolId;
  accessToken: string;
  refreshToken?: string | null;
  expiresInSeconds?: number | null;
  scope?: string | null;
}) {
  const expiresAt = input.expiresInSeconds
    ? new Date(Date.now() + input.expiresInSeconds * 1000)
    : null;

  return upsertToolConnection({
    userId: input.userId,
    tool: input.tool,
    accessToken: encrypt(input.accessToken),
    refreshToken: input.refreshToken ? encrypt(input.refreshToken) : null,
    expiresAt,
    scope: input.scope ?? null,
  });
}

/**
 * Returns a usable (decrypted, non-expired) access token for the tool, or null
 * if the tool isn't connected. Refreshes Google tokens when needed.
 */
export async function getValidAccessToken(
  userId: string,
  tool: ToolId,
): Promise<string | null> {
  const conn = await getToolConnection(userId, tool);
  if (!conn || !conn.accessToken) return null;

  const provider = TOOL_PROVIDER[tool];
  const expired =
    conn.expiresAt && conn.expiresAt.getTime() - EXPIRY_SKEW_MS < Date.now();

  if (provider === "google" && expired) {
    if (!conn.refreshToken) {
      // No refresh token — caller must re-connect.
      return null;
    }
    const refreshToken = decrypt(conn.refreshToken);
    const refreshed = await refreshGoogleToken(refreshToken);
    await updateToolAccessToken({
      userId,
      tool,
      accessToken: encrypt(refreshed.access_token),
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    });
    return refreshed.access_token;
  }

  return decrypt(conn.accessToken);
}

export async function isConnected(
  userId: string,
  tool: ToolId,
): Promise<boolean> {
  const conn = await getToolConnection(userId, tool);
  return Boolean(conn?.accessToken);
}
