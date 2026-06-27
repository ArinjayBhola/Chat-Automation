import "server-only";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";

/** Cookie that carries the per-flow CSRF nonce, scoped to one tool. */
export function stateCookieName(tool: string): string {
  return `tool_oauth_state_${tool}`;
}

export function newState(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Resolve the public origin for building redirect URIs. Prefer an explicit
 * configured URL (correct behind proxies/Vercel) and fall back to the request.
 */
export function getOrigin(req: NextRequest): string {
  const configured = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
  if (configured) return configured.replace(/\/$/, "");
  return req.nextUrl.origin;
}
