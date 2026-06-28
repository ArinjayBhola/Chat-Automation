# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Relay** (npm package name `relay`; the directory is still named `auto-chat`). A Next.js app where plain-English commands drive an autonomous AI agent that orchestrates the user's Gmail, Drive, Docs, Calendar, and Notion tools, pausing for human approval before any consequential (write) action.

## Commands

```bash
npm install          # use npm, NOT pnpm/yarn
npm run dev          # dev server at http://localhost:3000
npm run build        # production build (Next standalone output)
npm run lint         # next lint
npm run typecheck    # tsc --noEmit
npm run test         # vitest run (one-off)
npm run test:watch   # vitest watch mode

npx vitest run tests/crypto.test.ts   # run a single test file

npm run db:push      # apply Drizzle schema to the DB (use after schema.ts changes)
npm run db:generate  # generate SQL migrations
npm run db:migrate   # run migrations
npm run db:studio    # Drizzle Studio
```

Verification is build + tests + typecheck; the dev server has historically not been run during development. After editing `lib/schema.ts`, run `npm run db:push`.

## Architecture

### Request → agent → stream
1. `POST /api/chat` (`app/api/chat/route.ts`) is the orchestration entry point. It authenticates, rate-limits, sanitizes input, loads the user's connected tools, and opens a `ReadableStream`.
2. `lib/agent/agent.ts` (`createAgentStream`) runs the Vercel AI SDK v7 `streamText` with `stopWhen: stepCountIs(8)`, a system prompt, and **only the tools for services the user has connected** (`lib/agent/tools.ts` `buildTools` gates each tool by `ctx.connected`).
3. The route consumes the SDK `fullStream` in `runReal` and re-emits a custom **NDJSON event protocol** (`lib/agent/events.ts`: `text`/`step`/`approval`/`tools`/`meta`/`error`/`done`), one JSON object per line. The client (`lib/hooks/use-chat.ts`) parses these directly — we deliberately did **not** adopt `@ai-sdk/react`'s `useChat`, to keep the custom streamed-text + live-steps + approval UI.
4. SDK field names are read defensively (`text`/`textDelta`/`delta`, `input`/`args`, `output`/`result`) for v7 robustness.

### Approval workflow (human-in-the-loop)
- **Read tools execute live** (search/list/read). **Sensitive write tools do NOT execute** — they return `{ status: "approval_required", approval, op, args, note }` (`approvalResult` in `lib/agent/tools.ts`). The agent's system prompt instructs the model to stop and not retry when it sees this.
- Each sensitive action carries an `ApprovalOp` discriminator (`lib/agent/ops.ts`, e.g. `"gmail.send"`, `"docs.append"`). The op is persisted inside `approvals.actionData` under the key `__op` (`OP_KEY`).
- When the DB is enabled, `persistTurn` writes the chat, user/assistant messages, approval rows, and an audit log entry, then emits `meta{chatId}`.
- On approve: `app/api/approvals/[id]/approve` → `lib/agent/approvals.ts` `decideApproval()` → `lib/agent/execute.ts` `executeApproval()` dispatches `op` → the real Google/Notion write fn, with the user's (possibly edited) field values. Results + status changes are written to the append-only `audit_logs`. Execution failure keeps the approval pending for retry.
- Other approval routes: `GET /api/approvals` (list), `POST .../[id]/{approve,reject,skip}`, `PUT .../[id]` (edit fields).

### Tools & OAuth
- Tool definitions, scopes, and metadata live in `lib/tools/registry.ts`. The five tools are `gmail`, `drive`, `docs`, `calendar`, `notion` (`ToolId`).
- Tool OAuth is **separate from login**: a per-tool flow at `/api/tools/{tool}/{connect,callback,disconnect,test}` with incremental Google scopes; Notion uses its own OAuth. CSRF via a per-tool httpOnly state cookie (`lib/tools/oauth-state.ts`).
- Tokens are stored AES-256-GCM-encrypted (`lib/crypto.ts`) in the `tool_connections` table. `lib/tools/connections.ts` `getValidAccessToken` auto-refreshes expired Google tokens on read. Live API wrappers: `lib/tools/google-api.ts`, `lib/tools/notion-api.ts`.

### AI providers
- `lib/ai/models.ts` is the model registry (id → provider/modelName); `lib/ai/provider.ts` `resolveModel` lazily imports the right `@ai-sdk/*` package so the app builds/runs even when a provider package or key is absent. Providers: `anthropic`, `openai`, `google`, plus `openrouter`/`groq`/`opensource` (custom gateway) via `@ai-sdk/openai-compatible` with fixed base URLs. Returns `null` when the provider isn't configured — the chat route then tells the user to add a key (there is **no mock/fabricated data**).
- Default model id is `claude-opus-4-8`.

### Auth & DB
- Auth.js v5 (`next-auth@beta`), JWT 7-day sessions. Config is **split**: `auth.config.ts` is edge-safe (no Node-only imports — used by `proxy.ts`, Next 16's renamed middleware, and the `authorized` callback); `lib/auth.ts` adds the providers (Google OAuth + email/password Credentials). Password hashing is scrypt in `lib/password.ts` (no native dep). `POST /api/register` creates accounts and must stay allowlisted in the `authorized` callback since it's hit while logged out.
- DB is **optional at boot**: `lib/db.ts` exposes `db` as `null` when `DATABASE_URL` is unset (`isDbEnabled`), and the query layer no-ops so the app still boots before a DB is provisioned. Use `requireDb()` where a DB is mandatory. Driver is `postgres-js`, client cached on `globalThis` for HMR/serverless. Schema: `lib/schema.ts` (`users`, `tool_connections`, `chats`, `messages`, `approvals`, `audit_logs`); queries in `lib/db-queries.ts`.
- Cross-cutting on API routes: `lib/rate-limit.ts` (in-memory fixed-window, per-user — chat 20/min, approve 30/min, connect 10/min) and `lib/sanitize.ts`.

## Conventions & gotchas

- **Stack reality differs from any older spec**: this uses **AI SDK v7** (`ai@7`, `@ai-sdk/*@4`), **npm**, and Next 16's `proxy.ts` (not `middleware.ts`). `zod` must be `>=3.25.76` for the AI SDK peer dep. AI SDK v7 uses `tool({ inputSchema })`, `ModelMessage`, and `ToolSet`.
- Server-only modules use `import "server-only"`. Tests can still import them because `vitest.config.ts` aliases `server-only` → `tests/server-only-stub.ts` (and `@` → repo root).
- **UI copy rules**: NO gradients anywhere; avoid em dashes in user-facing copy (use hyphens/commas). UI primitives are shadcn-style on Radix in `components/ui/`; the brand mark is in `components/brand/logo.tsx` and the favicon is `app/icon.svg`.
- Writing literal C0 control bytes via the editor tools gets mangled — use `\uXXXX` escapes / `String.fromCharCode` / `new RegExp(string)` instead.
