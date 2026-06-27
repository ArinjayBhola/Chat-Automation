import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isToolId } from "@/lib/tools/registry";
import { getValidAccessToken } from "@/lib/tools/connections";
import type { ToolId } from "@/lib/types";

/**
 * POST /api/tools/[tool]/test — verify a connection by making a cheap,
 * read-only call to the provider with the stored (refreshed) token.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ tool: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tool } = await ctx.params;
  if (!isToolId(tool)) {
    return NextResponse.json({ error: "Unknown tool" }, { status: 404 });
  }

  if (session.user.isDemo) {
    return NextResponse.json({
      ok: false,
      error: "Demo mode — no real connection to test.",
    });
  }

  const token = await getValidAccessToken(session.user.id, tool);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Not connected." }, { status: 200 });
  }

  try {
    const info = await probe(tool, token);
    return NextResponse.json({ ok: true, info });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "Connection test failed.",
    });
  }
}

async function probe(tool: ToolId, token: string): Promise<string> {
  const auth = { Authorization: `Bearer ${token}` };

  switch (tool) {
    case "gmail": {
      const r = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        { headers: auth },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Gmail error");
      return `Gmail: ${j.emailAddress}`;
    }
    case "drive": {
      const r = await fetch(
        "https://www.googleapis.com/drive/v3/about?fields=user",
        { headers: auth },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Drive error");
      return `Drive: ${j.user?.emailAddress ?? "ok"}`;
    }
    case "calendar": {
      const r = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
        { headers: auth },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Calendar error");
      return `Calendar: ${j.items?.length ?? 0} calendar(s) visible`;
    }
    case "docs": {
      // Docs has no list endpoint; validate the token itself.
      const r = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`,
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error_description ?? "Docs token invalid");
      return "Docs: token valid";
    }
    case "notion": {
      const r = await fetch("https://api.notion.com/v1/users/me", {
        headers: { ...auth, "Notion-Version": "2022-06-28" },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Notion error");
      return `Notion: ${j.bot?.workspace_name ?? j.name ?? "connected"}`;
    }
  }
}
