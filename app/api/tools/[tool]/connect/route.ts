import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { isToolId, TOOL_PROVIDER, toolProviderConfigured } from "@/lib/tools/registry";
import { buildGoogleAuthUrl } from "@/lib/tools/oauth-google";
import { buildNotionAuthUrl } from "@/lib/tools/oauth-notion";
import { getOrigin, newState, stateCookieName } from "@/lib/tools/oauth-state";
import { limiterKey, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/tools/[tool]/connect
 * Starts the OAuth flow for a tool and returns the provider authorization URL.
 * The client redirects the browser to that URL.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tool: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(limiterKey("connect", session.user.id), 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many connection attempts. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const { tool } = await ctx.params;
  if (!isToolId(tool)) {
    return NextResponse.json({ error: "Unknown tool" }, { status: 404 });
  }

  if (session.user.isDemo) {
    return NextResponse.json(
      {
        error:
          "Demo accounts can't link real tools. Sign in with Google to connect.",
      },
      { status: 400 },
    );
  }

  if (!toolProviderConfigured(tool)) {
    const provider = TOOL_PROVIDER[tool];
    return NextResponse.json(
      {
        error: `${provider === "google" ? "Google" : "Notion"} OAuth is not configured on this server.`,
      },
      { status: 400 },
    );
  }

  if (!isDbEnabled) {
    return NextResponse.json(
      { error: "A database (DATABASE_URL) is required to store connections." },
      { status: 400 },
    );
  }

  const origin = getOrigin(req);
  const state = newState();

  const url =
    TOOL_PROVIDER[tool] === "google"
      ? buildGoogleAuthUrl({ origin, tool, state })
      : buildNotionAuthUrl({ origin, state });

  const res = NextResponse.json({ url });
  res.cookies.set(stateCookieName(tool), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });
  return res;
}
