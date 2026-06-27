import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isToolId, TOOL_PROVIDER } from "@/lib/tools/registry";
import { exchangeGoogleCode } from "@/lib/tools/oauth-google";
import { exchangeNotionCode } from "@/lib/tools/oauth-notion";
import { storeConnection } from "@/lib/tools/connections";
import { getOrigin, stateCookieName } from "@/lib/tools/oauth-state";

/**
 * GET /api/tools/[tool]/callback
 * OAuth redirect target: verifies CSRF state, exchanges the code for tokens,
 * stores them encrypted, then redirects back to /chat with a status flag.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tool: string }> },
) {
  const { tool } = await ctx.params;
  const origin = getOrigin(req);
  const back = (params: Record<string, string>) => {
    const url = new URL("/chat", origin);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = NextResponse.redirect(url);
    if (isToolId(tool)) res.cookies.delete(stateCookieName(tool));
    return res;
  };

  if (!isToolId(tool)) {
    return back({ tool_error: "unknown_tool" });
  }

  const session = await auth();
  if (!session?.user) {
    return back({ tool_error: "not_authenticated" });
  }

  const { searchParams } = req.nextUrl;
  const error = searchParams.get("error");
  if (error) {
    return back({ tool_error: error, tool });
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = req.cookies.get(stateCookieName(tool))?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return back({ tool_error: "invalid_state", tool });
  }

  try {
    if (TOOL_PROVIDER[tool] === "google") {
      const tokens = await exchangeGoogleCode({ origin, tool, code });
      await storeConnection({
        userId: session.user.id,
        tool,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresInSeconds: tokens.expires_in,
        scope: tokens.scope ?? null,
      });
    } else {
      const tokens = await exchangeNotionCode({ origin, code });
      await storeConnection({
        userId: session.user.id,
        tool,
        accessToken: tokens.access_token,
        refreshToken: null,
        expiresInSeconds: null,
        scope: tokens.workspace_name ?? null,
      });
    }
    return back({ connected: tool });
  } catch (e) {
    console.error(`[tools] ${tool} callback failed:`, e);
    return back({ tool_error: "exchange_failed", tool });
  }
}
