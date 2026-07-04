# Relay

> An AI assistant that turns plain-English requests into real actions across Gmail, Google Drive, Google Docs, Google Calendar, and Notion — with human approval before anything consequential happens.

**Next.js 16 · React 19 · Auth.js v5 · Drizzle ORM · PostgreSQL · Vercel AI SDK v7**

---

## Overview

Relay is an autonomous AI assistant that plans multi-step workflows, chooses the right tools, passes information between them, and pauses before performing any action that could have real consequences.

Unlike demo agents, Relay executes against **real APIs** using **real AI models**. There are **no mocked tool calls or fake responses**.

For example, you can ask Relay:

- "Find every email from Stripe this month and summarize them."
- "Create a meeting next Friday with the design team."
- "Upload this report to Drive and share it."
- "Update my Notion roadmap."
- "Draft a reply to John's email."

Relay performs the research automatically, then asks for approval before sending emails, editing documents, creating calendar events, or modifying Notion pages.

---

# Features

## Autonomous AI Agent

- Breaks complex requests into multiple steps
- Chooses only the connected tools it needs
- Passes results between tools automatically
- Continues even if individual tool calls fail
- Supports up to 8 reasoning/tool steps per request

## Human-in-the-Loop Approvals

Before any write operation, Relay pauses and generates an approval request.

Examples include:

- Sending email
- Creating calendar events
- Editing Google Docs
- Updating Notion pages

Each proposal:

- can be edited before approval
- expires after 30 seconds if ignored
- executes only after approval
- is permanently recorded in an audit log

## Bring Your Own Model

Choose a model for every conversation.

### Anthropic

- Claude Opus 4.8
- Claude Sonnet 4.6
- Claude Haiku 4.5

### OpenAI

- GPT-4o
- GPT-4o mini

### Google

- Gemini 2.0 Flash
- Gemini 1.5 Pro

### OpenRouter

- Hermes 3 (405B / 70B)
- Llama 3.3 70B
- Qwen 2.5 72B
- DeepSeek V3
- Mistral Large

### Groq

- Llama 3.3 70B
- Llama 3.1 8B
- DeepSeek R1 Distill
- Gemma 2

### Custom Gateway

Supports any OpenAI-compatible endpoint including:

- Together AI
- Fireworks AI
- LiteLLM gateways
- Self-hosted providers

## Integrations

- Gmail
- Google Drive
- Google Docs
- Google Calendar
- Notion

Each integration is connected independently through OAuth and user tokens are encrypted at rest.

## Authentication

- Google OAuth
- Email/password login
- Auth.js v5
- HTTP-only JWT sessions
- AES-256-GCM token encryption
- scrypt password hashing
- Per-user rate limiting
- Input sanitization

## Persistent Storage

Relay stores:

- conversations
- messages
- approvals
- audit logs
- chat history

using PostgreSQL with Drizzle ORM.

---

# Tech Stack

| Area           | Technology                                    |
| -------------- | --------------------------------------------- |
| Framework      | Next.js 16 (App Router), React 19, TypeScript |
| Styling        | Tailwind CSS, Radix UI, shadcn/ui             |
| Authentication | Auth.js v5                                    |
| Database       | PostgreSQL + Drizzle ORM                      |
| AI             | Vercel AI SDK v7                              |
| Deployment     | Vercel / Docker                               |

---

# Getting Started

## Prerequisites

- Node.js 22+
- PostgreSQL
- Google Cloud OAuth Client
- At least one supported AI provider API key

---

## Installation

```bash
npm install

cp .env.example .env.local
```

---

## Environment Variables

| Purpose        | Variables                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Authentication | `AUTH_SECRET`, `NEXTAUTH_URL`                                                                               |
| Google OAuth   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                                  |
| Database       | `DATABASE_URL`                                                                                              |
| Encryption     | `TOKEN_ENCRYPTION_KEY`                                                                                      |
| AI Providers   | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY` |
| Notion         | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`                                                                  |

---

## Google OAuth Redirects

```
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/tools/gmail/callback
http://localhost:3000/api/tools/drive/callback
http://localhost:3000/api/tools/docs/callback
http://localhost:3000/api/tools/calendar/callback
http://localhost:3000/api/tools/notion/callback
```

Enable the following APIs in Google Cloud:

- Gmail API
- Drive API
- Docs API
- Calendar API

---

## Run Locally

```bash
npm run db:push

npm run dev
```

Open:

```
http://localhost:3000
```

Create an account, connect your tools, choose an AI model, and start chatting.

---

# Deployment

## Vercel

1. Import the repository
2. Add all environment variables
3. Use a pooled PostgreSQL database (recommended: Neon)
4. Update Google OAuth redirect URIs
5. Deploy
6. Run

```bash
npm run db:push
```

once against production.

> For multi-instance deployments, replace the default in-memory rate limiter with Redis or Upstash.

---

## Docker

```bash
docker compose up --build
```

First run:

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/chat_automation npm run db:push
```

---

# Development

```bash
npm run dev

npm run test

npm run typecheck

npm run build
```

---

# Project Structure

```
app/
  api/
  ...

components/
  ...

lib/
  agent/
  ai/
  auth/
  crypto/
  db/
  schema/
  tools/
```

---

# How Relay Works

1. A user sends a request.
2. The AI agent plans the workflow.
3. Only connected tools are made available.
4. Read-only actions execute immediately.
5. Write actions become approval requests.
6. Once approved, Relay executes the action against the real API.
7. Every approval and execution is written to the audit log.

---

# Security

- AES-256-GCM encrypted OAuth tokens
- HTTP-only JWT sessions
- CSRF protection
- Approval required for all write operations
- Per-user rate limiting
- Input sanitization
- Append-only audit logs
