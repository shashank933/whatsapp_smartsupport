# WhatsApp SmartSupport

AI-powered WhatsApp customer support platform for any business. Handles appointment booking, FAQ responses, and HubSpot CRM sync — all via WhatsApp messaging.

## Features

- **WhatsApp Webhook Integration** — receives and responds to customer messages via the Meta WhatsApp Cloud API (Graph API v25)
- **AI-Powered Responses** — Gemini and DeepSeek LLM providers with automatic language detection (Arabic/English)
- **Appointment Booking** — NLP-driven booking flow with duplicate prevention (persisted in SQLite)
- **FAQ Matching** — rule-based keyword matching for common questions (hours, location, services, pricing)
- **HubSpot Sync** — auto-creates/updates contacts in HubSpot when new customers message
- **Configurable Guardrails** — content safety checks for prompt injection, abuse, off-topic, and unsafe advice detection
- **Admin Dashboard** — React SPA with thread management, appointment list, contacts, webhook logs, and LLM provider toggle
- **SSE Live Updates** — dashboard refreshes in real-time without polling

## Quick Start

**Prerequisites:** Node.js 18+

```bash
npm install
```

Copy the environment template and fill in your keys:

```bash
cp .env.example .env
```

**.env** — required variables:

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key (required for LLM) |
| `DEEPSEEK_API_KEY` | DeepSeek API key (optional fallback provider) |
| `GEMINI_MODEL` | Gemini model name (default: `gemini-flash-latest`) |
| `APP_URL` | Public URL where the app is hosted |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot private app token (optional CRM sync) |
| `WEBHOOK_VERIFY_TOKEN` | Token used by Meta to verify the WhatsApp webhook endpoint |

Run the app:

```bash
npm run dev
```

The server starts at `http://localhost:3000`. Access the admin dashboard at the root URL.

## Project Structure

```
├── backend/
│   ├── ai/            # Response engine, guardrails, translation
│   ├── db/            # SQLite store + in-memory seed data
│   ├── integrations/  # HubSpot CRM sync
│   ├── routes/        # Express routes (webhooks, threads, admin, knowledge)
│   └── utils/         # Phone normalization, logging
├── src/               # React frontend (Vite + Tailwind CSS)
│   └── types.ts       # Shared TypeScript types
├── docs/              # Project overview, prompt rules, cost estimates
├── .env.example       # Environment variable template
├── docker-compose.yml # Docker deployment with env var references
└── server.ts          # Express entry point
```

## WhatsApp Setup

1. Create a Meta Business App with WhatsApp product
2. Configure the webhook callback URL: `https://<APP_URL>/api/whatsapp/webhook`
3. Set the verify token to match `WEBHOOK_VERIFY_TOKEN` in your `.env`
4. Subscribe to `messages` webhook field
5. Add your phone number to the app's test numbers, or go live with a verified Business

## Docker

```bash
docker compose up -d
```

All secrets are passed via environment variables — no keys are hardcoded in the compose file. Persistent data (SQLite) and logs are stored in Docker volumes.

## Tech Stack

- **Backend:** Express.js, better-sqlite3, Google GenAI SDK, DeepSeek API
- **Frontend:** React, Vite, Tailwind CSS
- **Integrations:** WhatsApp Cloud API v25, HubSpot CRM
- **Infrastructure:** Docker, Docker Compose
