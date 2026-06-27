import "server-only";

/**
 * Thin, typed wrappers over the Google REST APIs (Gmail, Drive, Docs,
 * Calendar). Each takes an already-valid access token (see connections.ts) and
 * throws a descriptive Error on failure so the agent can report it as a failed
 * step.
 */

async function googleFetch(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body && !(init.headers as Record<string, string>)?.["Content-Type"]
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } })?.error?.message ??
      `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ===========================================================================
// Gmail
// ===========================================================================
export type EmailSummary = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};

function header(
  headers: { name: string; value: string }[] | undefined,
  name: string,
): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function gmailSearch(
  token: string,
  query: string,
  max = 10,
): Promise<EmailSummary[]> {
  const list = (await googleFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${max}`,
    token,
  )) as { messages?: { id: string; threadId: string }[] };

  if (!list.messages?.length) return [];

  return Promise.all(
    list.messages.map(async (m) => {
      const msg = (await googleFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        token,
      )) as {
        id: string;
        threadId: string;
        snippet: string;
        payload?: { headers?: { name: string; value: string }[] };
      };
      return {
        id: msg.id,
        threadId: msg.threadId,
        from: header(msg.payload?.headers, "From"),
        subject: header(msg.payload?.headers, "Subject"),
        date: header(msg.payload?.headers, "Date"),
        snippet: msg.snippet ?? "",
      };
    }),
  );
}

export async function gmailReadEmail(
  token: string,
  id: string,
): Promise<EmailSummary & { body: string }> {
  const msg = (await googleFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    token,
  )) as {
    id: string;
    threadId: string;
    snippet: string;
    payload?: {
      headers?: { name: string; value: string }[];
      mimeType?: string;
      body?: { data?: string };
      parts?: { mimeType: string; body?: { data?: string } }[];
    };
  };

  const decodePart = (data?: string) =>
    data ? Buffer.from(data, "base64url").toString("utf8") : "";

  let body = decodePart(msg.payload?.body?.data);
  if (!body && msg.payload?.parts) {
    const plain =
      msg.payload.parts.find((p) => p.mimeType === "text/plain") ??
      msg.payload.parts[0];
    body = decodePart(plain?.body?.data);
  }

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: header(msg.payload?.headers, "From"),
    subject: header(msg.payload?.headers, "Subject"),
    date: header(msg.payload?.headers, "Date"),
    snippet: msg.snippet ?? "",
    body: body.slice(0, 8000),
  };
}

export async function gmailSendEmail(
  token: string,
  input: { to: string; subject: string; body: string },
): Promise<{ id: string }> {
  const mime = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    input.body,
  ].join("\r\n");
  const raw = Buffer.from(mime).toString("base64url");

  const res = (await googleFetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    token,
    { method: "POST", body: JSON.stringify({ raw }) },
  )) as { id: string };
  return { id: res.id };
}

export async function gmailMarkRead(token: string, id: string): Promise<void> {
  await googleFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`,
    token,
    { method: "POST", body: JSON.stringify({ removeLabelIds: ["UNREAD"] }) },
  );
}

// ===========================================================================
// Drive
// ===========================================================================
export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
};

export async function driveSearch(
  token: string,
  query: string,
  mimeType?: string,
  limit = 10,
): Promise<DriveFile[]> {
  const qParts = [`name contains '${query.replace(/'/g, "\\'")}'`, "trashed = false"];
  if (mimeType) qParts.push(`mimeType = '${mimeType}'`);
  const q = encodeURIComponent(qParts.join(" and "));
  const res = (await googleFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=${limit}&fields=files(id,name,mimeType,modifiedTime,webViewLink)`,
    token,
  )) as { files?: DriveFile[] };
  return res.files ?? [];
}

export async function driveList(
  token: string,
  folderId?: string,
  limit = 20,
): Promise<DriveFile[]> {
  const q = encodeURIComponent(
    `${folderId ? `'${folderId}' in parents and ` : ""}trashed = false`,
  );
  const res = (await googleFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=${limit}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime,webViewLink)`,
    token,
  )) as { files?: DriveFile[] };
  return res.files ?? [];
}

export async function driveReadFile(
  token: string,
  fileId: string,
): Promise<string> {
  // Google-native docs must be exported; binary/text files use alt=media.
  const meta = (await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name`,
    token,
  )) as { mimeType: string; name: string };

  if (meta.mimeType.startsWith("application/vnd.google-apps")) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    return (await res.text()).slice(0, 8000);
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return (await res.text()).slice(0, 8000);
}

export async function driveSaveFile(
  token: string,
  name: string,
  content: string,
  mimeType = "text/plain",
): Promise<DriveFile> {
  const boundary = "auto-chat-boundary-" + Math.random().toString(36).slice(2);
  const metadata = JSON.stringify({ name, mimeType });
  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    metadata +
    `\r\n--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    `\r\n--${boundary}--`;

  const res = (await googleFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink",
    token,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  )) as DriveFile;
  return res;
}

// ===========================================================================
// Docs
// ===========================================================================
export async function docsRead(
  token: string,
  documentId: string,
): Promise<{ title: string; text: string }> {
  const doc = (await googleFetch(
    `https://docs.googleapis.com/v1/documents/${documentId}`,
    token,
  )) as {
    title: string;
    body?: {
      content?: {
        paragraph?: { elements?: { textRun?: { content?: string } }[] };
      }[];
    };
  };

  const text = (doc.body?.content ?? [])
    .flatMap((c) => c.paragraph?.elements ?? [])
    .map((e) => e.textRun?.content ?? "")
    .join("");

  return { title: doc.title, text: text.slice(0, 8000) };
}

export async function docsCreate(
  token: string,
  title: string,
  content: string,
): Promise<{ documentId: string; url: string }> {
  const created = (await googleFetch(
    "https://docs.googleapis.com/v1/documents",
    token,
    { method: "POST", body: JSON.stringify({ title }) },
  )) as { documentId: string };

  if (content) {
    await docsAppend(token, created.documentId, content);
  }
  return {
    documentId: created.documentId,
    url: `https://docs.google.com/document/d/${created.documentId}/edit`,
  };
}

export async function docsAppend(
  token: string,
  documentId: string,
  text: string,
): Promise<void> {
  await googleFetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [
          { insertText: { endOfSegmentLocation: {}, text: `${text}\n` } },
        ],
      }),
    },
  );
}

// ===========================================================================
// Calendar
// ===========================================================================
export type CalendarEvent = {
  id: string;
  summary: string;
  start?: string;
  end?: string;
  description?: string;
  htmlLink?: string;
};

function normalizeEvent(e: {
  id: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}): CalendarEvent {
  return {
    id: e.id,
    summary: e.summary ?? "(no title)",
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    description: e.description,
    htmlLink: e.htmlLink,
  };
}

export async function calendarList(
  token: string,
  daysAhead = 7,
): Promise<CalendarEvent[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 86400000).toISOString();
  const res = (await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=25`,
    token,
  )) as { items?: Parameters<typeof normalizeEvent>[0][] };
  return (res.items ?? []).map(normalizeEvent);
}

export async function calendarSearch(
  token: string,
  query: string,
): Promise<CalendarEvent[]> {
  const res = (await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${encodeURIComponent(query)}&singleEvents=true&orderBy=startTime&maxResults=25`,
    token,
  )) as { items?: Parameters<typeof normalizeEvent>[0][] };
  return (res.items ?? []).map(normalizeEvent);
}

export async function calendarCreate(
  token: string,
  input: { title: string; start: string; end: string; description?: string },
): Promise<CalendarEvent> {
  const res = (await googleFetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    token,
    {
      method: "POST",
      body: JSON.stringify({
        summary: input.title,
        description: input.description,
        start: { dateTime: new Date(input.start).toISOString() },
        end: { dateTime: new Date(input.end).toISOString() },
      }),
    },
  )) as Parameters<typeof normalizeEvent>[0];
  return normalizeEvent(res);
}
