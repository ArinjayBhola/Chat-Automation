import type { ToolId } from "../types";
import { googleScopesFor } from "./registry";

/**
 * Google OAuth 2.0 helpers for connecting individual tools (separate from the
 * Auth.js login flow so we can request incremental scopes and persist refresh
 * tokens per tool). Each tool uses its own registered redirect URI:
 *   {origin}/api/tools/{tool}/callback
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export function googleRedirectUri(origin: string, tool: ToolId): string {
  return `${origin}/api/tools/${tool}/callback`;
}

export function buildGoogleAuthUrl(opts: {
  origin: string;
  tool: ToolId;
  state: string;
}): string {
  const { origin, tool, state } = opts;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(origin, tool),
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
    scope: googleScopesFor(tool).join(" "),
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

export async function exchangeGoogleCode(opts: {
  origin: string;
  tool: ToolId;
  code: string;
}): Promise<GoogleTokenResponse> {
  const { origin, tool, code } = opts;
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(origin, tool),
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export async function refreshGoogleToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${text}`);
  }
  return (await res.json()) as { access_token: string; expires_in: number };
}
