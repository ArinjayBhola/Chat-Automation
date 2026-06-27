# auto-chat

An AI assistant that takes plain-English commands and orchestrates them across
**Gmail, Google Drive, Google Docs, Google Calendar, and Notion** — breaking
requests into steps, picking only the relevant tools, and asking for approval
before anything with real consequences (sending email, creating events, editing
docs).

> **Status:** Phase 1 of a phased build. The full UI, auth, demo mode, database
> schema, and multi-provider AI registry are in place. The real tool execution
> and streaming agent land in later phases (see [Roadmap](#roadmap)).

## ✨ Highlights

- **Demo mode** — runs with **zero external credentials**. Click _Try Demo_ and
  explore the entire UI with mock tool responses and a working approval gate.
- **Multi-provider AI** — Claude, OpenAI, Gemini, and open-source models (via an
  OpenAI-compatible cloud gateway such as OpenRouter/Groq/Together). Pick the
  model from the sidebar. No local/Ollama dependency — built for cloud deploy.
- **Google OAuth** login (Auth.js v5 / NextAuth) with 7-day JWT sessions.
- **Approval gates** with editable fields and a 30-second auto-skip countdown.
- **Postgres + Drizzle** schema for users, tool connections, chats, messages,
  and approvals — Neon-ready, with encrypted token storage.

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

| Capability            | Variables                                                         |
| --------------------- | ---------------------------------------------------------------- |
| Google login + tools  | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`         |
| Persistence (Postgres)| `DATABASE_URL` (Neon or any Postgres)                            |
| Token encryption      | `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`)               |
| Claude                | `ANTHROPIC_API_KEY`                                              |
| OpenAI                | `OPENAI_API_KEY`                                                 |
| Gemini                | `GOOGLE_GENERATIVE_AI_API_KEY`                                   |
| Open-source models    | `OPENSOURCE_BASE_URL`, `OPENSOURCE_API_KEY`, `OPENSOURCE_MODELS` |
| Notion                | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`                       |

Generate the Auth secret with `openssl rand -base64 32` and set
`GOOGLE_*` from an OAuth client at
<https://console.cloud.google.com/apis/credentials> with redirect URI
`http://localhost:3000/api/auth/callback/google`.

### Database

The app runs without a database (in-memory demo). To persist data:

```bash
# point DATABASE_URL at a Neon/Postgres instance, then:
npm run db:push      # create tables from lib/schema.ts
npm run db:studio    # optional: browse data
```

## 🧱 Tech stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS**
- **Auth.js v5** (NextAuth) — Google + one-click demo provider
- **Drizzle ORM** + **Neon** serverless Postgres
- **Vercel AI SDK v7** with `@ai-sdk/anthropic | openai | google | openai-compatible`
- **lucide-react** icons, **next-themes** light/dark

## 📁 Project structure

```
app/                     # routes (chat, auth, api)
  api/chat/route.ts      # message endpoint (mock plan in Phase 1)
  api/tools/status/      # tool connection status
components/chat/         # chat UI (sidebar, messages, approval panel, ...)
lib/
  schema.ts              # Drizzle tables (users, tool_connections, chats, ...)
  db.ts / db-queries.ts  # demo-safe data layer
  auth.ts / auth.config  # Auth.js v5 (split for edge middleware)
  ai/models.ts           # selectable models across providers
  ai/provider.ts         # resolve model id -> AI SDK LanguageModel
  ai/mock-agent.ts       # deterministic demo planner (preview of real agent)
```

## 🗺️ Roadmap

| Phase | Scope                                                          | Status |
| ----- | -------------------------------------------------------------- | ------ |
| 1     | Scaffold, DB schema, auth + demo, chat UI, AI registry        | ✅ done |
| 2     | Tool OAuth connect flows + encrypted token persistence        | ⏳     |
| 3     | Real streaming agent (tool calling, step execution)           | ⏳     |
| 4     | Approval persistence + execute-on-approve + audit trail       | ⏳     |
| 5     | Error handling, rate limits, Docker, deploy docs, tests       | ⏳     |

## 🔐 Security notes

- OAuth tokens are encrypted at rest (AES-256-GCM, `lib/crypto.ts`).
- Sessions are HTTP-only JWT cookies with CSRF protection via Auth.js.
- Sensitive actions require explicit approval before execution.

## 📜 License

MIT
