# auto-chat

An AI assistant that takes plain-English commands and orchestrates them across
**Gmail, Google Drive, Google Docs, Google Calendar, and Notion** — breaking
requests into steps, picking only the relevant tools, and asking for approval
before anything with real consequences (sending email, creating events, editing
docs/pages).

> **Status:** all five build phases complete. Auth + demo mode, the streaming
> multi-provider agent, real tool execution, the approval workflow with
> execute-on-approve + audit trail, chat history, hardening, Docker, and tests
> are in place. Verified by `npm run test`, `npm run typecheck`, and
> `npm run build` (all green). A live model/DB smoke test is the last mile.

## ✨ Highlights

- **Demo mode** — runs with **zero external credentials**. Click _Try Demo_ and
  exercise the entire UI (streamed steps + approval gate) with mock data.
- **Multi-provider AI** — Claude, OpenAI, Gemini, and open-source models (via an
  OpenAI-compatible cloud gateway like OpenRouter/Groq/Together). Pick the model
  in the sidebar. No local/Ollama dependency — built for cloud deploy.
- **Real orchestration** — a streaming agent plans steps, calls only the
  connected tools, passes data between steps, and continues past failures.
- **Approval gates** — sensitive actions pause for approval with editable fields
  and a 30-second auto-skip; approving actually performs the action.
- **Persistence + audit** — chats, messages, approvals, and an append-only audit
  log in Postgres (Drizzle). OAuth tokens encrypted at rest (AES-256-GCM).

## 🚀 Quick start (demo mode, no credentials)

```bash
npm install
cp .env.example .env.local   # leave everything blank for demo mode
npm run dev
# open http://localhost:3000  →  click "Try Demo"
```

## 🔌 Enabling real integrations

Fill in the relevant values in `.env.local` (see `.env.example` for the full
list and how to obtain each):

| Capability             | Variables                                                        |
| ---------------------- | ---------------------------------------------------------------- |
| Google login + tools   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`        |
| Persistence (Postgres) | `DATABASE_URL` (Neon pooled string, or any Postgres)            |
| Token encryption       | `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`)              |
| Claude                 | `ANTHROPIC_API_KEY`                                             |
| OpenAI                 | `OPENAI_API_KEY`                                                |
| Gemini                 | `GOOGLE_GENERATIVE_AI_API_KEY`                                  |
| Open-source models     | `OPENSOURCE_BASE_URL`, `OPENSOURCE_API_KEY`, `OPENSOURCE_MODELS`|
| Notion                 | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`                      |

Google needs several authorized redirect URIs (login + one per tool) and the
Gmail/Drive/Docs/Calendar APIs enabled — see the comments in `.env.example`.

### Database

The app runs without a database (in-memory demo). To persist data:

```bash
# point DATABASE_URL at a Neon/Postgres instance, then:
npm run db:push      # create tables from lib/schema.ts
npm run db:studio    # optional: browse data
```

## 🐳 Run with Docker (app + Postgres)

```bash
# put AUTH_SECRET, TOKEN_ENCRYPTION_KEY, provider keys, etc. in a .env file
docker compose up --build
# first run only — create the tables against the compose Postgres:
DATABASE_URL=postgresql://postgres:password@localhost:5432/chat_automation npm run db:push
# open http://localhost:3000
```

The image uses Next.js standalone output (`output: "standalone"`) for a small
runtime. `db.ts` uses the `postgres` driver, so the same code works against the
Docker Postgres and against Neon/Supabase/RDS in production.

## ☁️ Deploy to Vercel

1. Import the repo in Vercel.
2. Add the env vars from the table above (use a **Neon pooled** `DATABASE_URL`).
3. Set the Google OAuth redirect URIs to your production origin.
4. Deploy, then run `npm run db:push` once (locally, pointed at the prod DB).

> The in-memory rate limiter is per-instance; for multi-instance production back
> `lib/rate-limit.ts` with Redis/Upstash (the call sites won't change).

## 🧪 Quality

```bash
npm run test        # vitest unit tests (crypto, sanitize, planner, ops)
npm run typecheck   # tsc --noEmit
npm run build       # next build (standalone)
```

## 🧱 Tech stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS**
- **Auth.js v5** (NextAuth) — Google + one-click demo provider
- **Drizzle ORM** + **Postgres** (`postgres` driver; Neon/Supabase/local)
- **Vercel AI SDK v7** — `@ai-sdk/anthropic | openai | google | openai-compatible`
- **lucide-react** icons, **next-themes** light/dark

## 📁 Project structure

```
app/
  api/chat/route.ts          # streaming agent (NDJSON) + chat list
  api/chat/[chatId]/route.ts # load/delete a chat
  api/approvals/...          # list + approve/reject/skip/edit
  api/tools/[tool]/...        # connect/callback/disconnect/test
components/chat/             # sidebar, history, messages, steps, approval panel
lib/
  schema.ts                  # users, tool_connections, chats, messages, approvals, audit_logs
  db.ts / db-queries.ts      # demo-safe data layer (postgres-js)
  auth.ts / auth.config.ts   # Auth.js v5 (split for edge proxy)
  crypto.ts / rate-limit.ts / sanitize.ts
  tools/                     # OAuth flows + Google/Notion API wrappers + token mgmt
  agent/                     # agent.ts, tools.ts, execute.ts, approvals.ts, events.ts, ops.ts
  ai/                        # model registry, provider resolver, mock planner
```

## 🔐 Security notes

- OAuth tokens encrypted at rest (AES-256-GCM, `lib/crypto.ts`).
- HTTP-only JWT sessions with CSRF protection via Auth.js; 7-day expiry.
- Sensitive actions require explicit approval before execution.
- Per-user rate limiting and input sanitization on API routes.
- Append-only `audit_logs` for every approval decision and execution.

## 🗺️ Build phases (all complete)

| Phase | Scope                                                   | Status  |
| ----- | ------------------------------------------------------- | ------- |
| 1     | Scaffold, DB schema, auth + demo, chat UI, AI registry  | ✅ done |
| 2     | Tool OAuth connect flows + encrypted token persistence  | ✅ done |
| 3     | Real streaming agent (tool calling, step execution)     | ✅ done |
| 4     | Approval persistence + execute-on-approve + audit trail | ✅ done |
| 5     | Hardening, chat history, Docker, deploy docs, tests     | ✅ done |

## 📜 License

MIT
