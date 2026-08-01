import "server-only";

/**
 * Minimal Notion API wrappers. Token is the stored Notion access token.
 */

const NOTION_VERSION = "2022-06-28";

async function notionFetch(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<unknown> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (data as { message?: string })?.message ?? `Notion ${res.status}`,
    );
  }
  return data;
}

export type NotionPage = {
  id: string;
  title: string;
  url: string;
};

const MAX_RICH_TEXT = 2000;

function richText(content: string) {
  const chunks: { text: { content: string } }[] = [];
  for (let i = 0; i < content.length; i += MAX_RICH_TEXT) {
    chunks.push({ text: { content: content.slice(i, i + MAX_RICH_TEXT) } });
  }
  return chunks;
}

function paragraphBlocks(content: string) {
  if (!content) return [];
  return content.split(/\r?\n/).map((line) => ({
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: richText(line) },
  }));
}

function plainTitle(props: Record<string, unknown> | undefined): string {
  if (!props) return "(untitled)";
  for (const value of Object.values(props)) {
    const v = value as { type?: string; title?: { plain_text: string }[] };
    if (v?.type === "title") {
      return v.title?.map((t) => t.plain_text).join("") || "(untitled)";
    }
  }
  return "(untitled)";
}

export async function notionSearch(
  token: string,
  query: string,
): Promise<NotionPage[]> {
  const res = (await notionFetch("/search", token, {
    method: "POST",
    body: JSON.stringify({
      query,
      page_size: 10,
      filter: { property: "object", value: "page" },
    }),
  })) as {
    results?: {
      id: string;
      url: string;
      properties?: Record<string, unknown>;
    }[];
  };
  return (res.results ?? []).map((p) => ({
    id: p.id,
    url: p.url,
    title: plainTitle(p.properties),
  }));
}

export async function notionReadPage(
  token: string,
  pageId: string,
): Promise<{ id: string; text: string }> {
  const res = (await notionFetch(
    `/blocks/${pageId}/children?page_size=50`,
    token,
  )) as {
    results?: {
      type: string;
      [key: string]: unknown;
    }[];
  };

  const text = (res.results ?? [])
    .map((block) => {
      const b = block as Record<string, { rich_text?: { plain_text: string }[] }>;
      const content = b[block.type];
      return content?.rich_text?.map((t) => t.plain_text).join("") ?? "";
    })
    .filter(Boolean)
    .join("\n");

  return { id: pageId, text: text.slice(0, 8000) };
}

export async function notionCreatePage(
  token: string,
  parentId: string,
  title: string,
  content: string,
): Promise<NotionPage> {
  if (!parentId || !parentId.trim()) {
    throw new Error(
      "No Notion parent page selected. Pick an existing parent page or create a new one first, then retry.",
    );
  }
  const res = (await notionFetch("/pages", token, {
    method: "POST",
    body: JSON.stringify({
      parent: { page_id: parentId },
      properties: {
        title: { title: richText(title) },
      },
      children: paragraphBlocks(content),
    }),
  })) as { id: string; url: string };
  return { id: res.id, url: res.url, title };
}

export async function notionUpdatePage(
  token: string,
  pageId: string,
  content: string,
): Promise<{ id: string }> {
  if (!pageId.trim()) throw new Error("A Notion page id is required.");

  // Notion has no single "replace page body" endpoint. Archive the current
  // top-level blocks, then append the requested replacement content.
  const existing = (await notionFetch(
    `/blocks/${pageId}/children?page_size=100`,
    token,
  )) as { results?: { id: string }[] };
  await Promise.all(
    (existing.results ?? []).map((block) =>
      notionFetch(`/blocks/${block.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      }),
    ),
  );

  const children = paragraphBlocks(content);
  if (children.length) {
    await notionFetch(`/blocks/${pageId}/children`, token, {
      method: "PATCH",
      body: JSON.stringify({ children }),
    });
  }
  return { id: pageId };
}
