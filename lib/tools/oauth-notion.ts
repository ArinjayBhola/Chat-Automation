/**
 * Notion OAuth helpers. Notion access tokens are long-lived (no refresh flow),
 * so we only need authorize + code exchange.
 * Redirect URI: {origin}/api/tools/notion/callback
 */

const AUTH_ENDPOINT = "https://api.notion.com/v1/oauth/authorize";
const TOKEN_ENDPOINT = "https://api.notion.com/v1/oauth/token";

export function notionRedirectUri(origin: string): string {
  return `${origin}/api/tools/notion/callback`;
}

export function buildNotionAuthUrl(opts: {
  origin: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: process.env.NOTION_CLIENT_ID!,
    redirect_uri: notionRedirectUri(opts.origin),
    response_type: "code",
    owner: "user",
    state: opts.state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type NotionTokenResponse = {
  access_token: string;
  workspace_id?: string;
  workspace_name?: string;
  bot_id?: string;
};

export async function exchangeNotionCode(opts: {
  origin: string;
  code: string;
}): Promise<NotionTokenResponse> {
  const basic = Buffer.from(
    `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`,
  ).toString("base64");

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: notionRedirectUri(opts.origin),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as NotionTokenResponse;
}
