<h1 align="center">Relay</h1>

<p align="center">
  <strong>An AI assistant that relays your plain-English commands across
  Gmail, Drive, Docs, Calendar &amp; Notion — and hands off the consequential
  actions only when you approve.</strong>
</p>

<p align="center">
  Next.js 16 · React 19 · Auth.js v5 · Drizzle + Postgres · Vercel AI SDK v7
</p>

---

Relay breaks a request into steps, picks only the tools it needs, passes data
between them, and pauses for your approval before anything with real
consequences — sending email, creating events, editing docs or Notion pages.
Every model response comes from a real provider and every tool call hits the
real API; there is no mock data.

## Features

- **Autonomous multi-tool agent.** Plans steps, selects only the connected
  tools, passes results between steps, and continues past individual failures.
- **Human-in-the-loop approvals.** Sensitive actions pause with editable fields
  and a 30-second auto-skip. Approving actually performs the action; every
  decision is written to an append-only audit log.
- **Bring your own model.** Pick per-conversation from:
  - **Anthropic** — Claude Opus 4.8, Sonnet 4.6, Haiku 4.5
  - **OpenAI** — GPT-4o, GPT-4o mini
  - **Google** — Gemini 2.0 Flash, Gemini 1.5 Pro
  - **OpenRouter** — Hermes 3 (405B/70B), Llama 3.3 70B, Qwen 2.5 72B,
    DeepSeek V3, Mistral Large
  - **Groq** — Llama 3.3 70B, Llama 3.1 8B, DeepSeek R1 Distill, Gemma2
  - **Custom gateway** — any OpenAI-compatible endpoint (Together, Fireworks, …)
- **Five integrations.** Gmail, Google Drive, Google Docs, Google Calendar, and
  Notion — connected per-user via OAuth, with tokens encrypted at rest.
- **Secure by default.** Google sign-in (Auth.js v5), HTTP-only JWT sessions,
  AES-256-GCM token encryption, per-user rate limiting, and input sanitization.
- **Real persistence.** Chats, messages, approvals, and audit logs in Postgres
  via Drizzle, with a chat-history sidebar.

## Tech stack

| Area     | Choice                                                              |
| -------- | ------------------------------------------------------------------ |
| Framework| Next.js 16 (App Router), React 19, TypeScript                      |
| UI       | Tailwind CSS, shadcn-style components on Radix UI, lucide-react    |
| Auth     | Auth.js v5 (NextAuth) — Google OAuth                               |
| Data     | Drizzle ORM + Postgres (`postgres` driver; Neon/Supabase/local)   |
| AI       | Vercel AI SDK v7 — Anthropic / OpenAI / Google / OpenAI-compatible |

## Getting started

### 1. Prerequisites

- Node.js 22+
- A Postgres database (Neon, Supabase, or local/Docker)
- A Google Cloud OAuth client (for login + tool access)
- At least one AI provider API key

### 2. Configure

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Purpose            | Variables                                                        |
| ------------------ | ---------------------------------------------------------------- |
| Auth               | `AUTH_SECRET` (`openssl rand -base64 32`), `NEXTAUTH_URL`        |
| Google login+tools | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                       |
| Database           | `DATABASE_URL`                                                   |
| Token encryption   | `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`)              |
| AI (any subset)    | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY` |
| Notion (optional)  | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`                       |

In the Google Cloud console, enable the **Gmail, Drive, Docs, and Calendar**
APIs and register these authorized redirect URIs (swap the origin in
production):

```
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/tools/gmail/callback
http://localhost:3000/api/tools/drive/callback
http://localhost:3000/api/tools/docs/callback
http://localhost:3000/api/tools/calendar/callback
http://localhost:3000/api/tools/notion/callback
```

### 3. Create tables & run

```bash
npm run db:push     # apply the Drizzle schema
npm run dev         # http://localhost:3000
```

Sign in with Google, connect tools from the sidebar, pick a model, and start
giving Relay instructions.

## Deployment

### Vercel

1. Import the repo and add every env var (use a **Neon pooled** `DATABASE_URL`).
2. Set the Google OAuth redirect URIs to your production origin.
3. Deploy, then run `npm run db:push` once against the production database.

> The default rate limiter is in-memory (per instance). For multi-instance
> production, back `lib/rate-limit.ts` with Redis/Upstash — the call sites don't
> change.

### Docker

```bash
# put AUTH_SECRET, TOKEN_ENCRYPTION_KEY, GOOGLE_*, and a provider key in .env
docker compose up --build
# first run only — create tables against the compose Postgres:
DATABASE_URL=postgresql://postgres:password@localhost:5432/chat_automation npm run db:push
```

The image uses Next.js standalone output, and the same `postgres` driver works
against the compose database and managed Postgres in production.

## Development

```bash
npm run dev         # dev server
npm run test        # vitest unit tests (crypto, sanitize, ops)
npm run typecheck   # tsc --noEmit
npm run build       # production build (standalone)
```

## Project structure

```
app/
  api/chat/route.ts          # streaming agent (NDJSON) + chat list
  api/chat/[chatId]/route.ts # load / delete a chat
  api/approvals/...          # list + approve / reject / skip / edit
  api/tools/[tool]/...        # connect / callback / disconnect / test
components/
  brand/logo.tsx             # Relay mark + wordmark (app/icon.svg = favicon)
  ui/                        # shadcn-style primitives (Radix + Tailwind)
  chat/                      # sidebar, history, messages, steps, approval panel
lib/
  schema.ts                  # users, tool_connections, chats, messages, approvals, audit_logs
  db.ts / db-queries.ts      # Drizzle data layer (postgres-js)
  auth.ts / auth.config.ts   # Auth.js v5 (split for the edge proxy)
  crypto.ts / rate-limit.ts / sanitize.ts
  tools/                     # OAuth flows + Google/Notion API wrappers + token mgmt
  agent/                     # agent, tools, execute, approvals, events, ops
  ai/                        # model registry + provider resolver
```

## How it works

1. You send a message. The chat route streams NDJSON events
   (`text` / `step` / `approval` / `tools` / `meta`) back to the client.
2. The agent (`streamText`, Vercel AI SDK v7) is given only the tools for the
   services you've connected, and runs up to 8 steps.
3. Read actions (search email, list events, read a doc) execute immediately.
4. Write actions return an **approval proposal** instead of executing. The
   proposal is persisted and surfaced in the UI.
5. When you approve, the action runs against the real API with your (optionally
   edited) values, and the result + an audit entry are recorded.

## Security

- OAuth tokens encrypted at rest with AES-256-GCM (`lib/crypto.ts`).
- HTTP-only JWT sessions with CSRF protection via Auth.js; 7-day expiry.
- Every consequential action requires explicit approval.
- Per-user rate limiting and input sanitization on API routes.
- Append-only `audit_logs` for every approval decision and execution.

## License

MIT
