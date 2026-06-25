# Bright Smile Dental Clinic — WhatsApp AI Support Agent

## Project Overview

A full-stack WhatsApp AI assistant for a dental clinic in Salmiya, Kuwait. The agent handles incoming WhatsApp messages from patients — auto-replying to booking requests, medical enquiries, Arabic/English messages, and emergency alerts — all through a real-time admin dashboard.

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **Frontend** | React 19 + Vite + Tailwind CSS v4 | Admin dashboard with real-time chat, dashboard, simulator, and Meta API config |
| **Backend** | Node.js + Express (TypeScript) | WhatsApp webhook receiver, AI response engine, REST API |
| **Runtime** | `tsx` (dev) / esbuild + Node (prod) | TS execution in dev, CJS bundle for Docker production |
| **AI / LLM** | Google Gemini 2.0 Flash + DeepSeek Chat | Intent understanding, natural replies, booking extraction, language translation |
| **Database** | SQLite (`better-sqlite3`) | Threads, messages, contacts, appointments, WhatsApp config — all persisted |
| **CRM** | HubSpot API | Auto-syncs new contacts to HubSpot CRM on first WhatsApp message |
| **Messaging** | Meta WhatsApp Cloud API v25 | Live webhook receiver + outbound message sender |
| **Container** | Docker + Docker Compose | Multi-stage build, slim production image (~150 MB) |
| **Registry** | Docker Hub | `talapelliwars/whatsapp-support-agent-hub:latest` |

---

## Architecture

```
WhatsApp User
     │
     ▼
Meta Cloud API (webhook)
     │
     ▼ POST /api/whatsapp/webhook
┌─────────────────────────────────┐
│  Express Server (server.ts)     │
│  ┌───────────────────────────┐  │
│  │  Webhook Routes            │  │
│  │  - Verify (GET handshake)  │  │
│  │  - Receive (POST message)  │  │
│  └───────────┬───────────────┘  │
│              ▼                  │
│  ┌───────────────────────────┐  │
│  │  AI Response Engine        │  │
│  │  1. Translate to English  │  │
│  │  2. Emergency check       │  │
│  │  3. LLM Intent + Reply    │  │
│  │  4. Booking DB write      │  │
│  │  5. Translate back        │  │
│  └───────────┬───────────────┘  │
│              ▼                  │
│  ┌───────────────────────────┐  │
│  │  SQLite Database           │  │
│  │  - threads, messages       │  │
│  │  - contacts, appointments  │  │
│  │  - settings (config)       │  │
│  └───────────────────────────┘  │
│              │                  │
│  ┌───────────┴───────────────┐  │
│  │  HubSpot CRM Sync          │  │
│  │  - Auto-create contacts    │  │
│  │  - Contact reason detection│  │
│  └───────────────────────────┘  │
│              │                  │
│  ┌───────────┴───────────────┐  │
│  │  SSE (Server-Sent Events)  │  │
│  │  - Real-time UI updates    │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
     │
     ▼
Meta Cloud API (send message)
     │
     ▼
Admin Dashboard (React)
  - Chat panel, Simulator, Dashboard, FAQ KB, Meta Config, Webhook Logs
```

---

## Key Features

### AI Response Engine
- **LLM-first architecture**: Messages route through Gemini/DeepSeek for intent understanding (not hardcoded keywords)
- **Emergency bypass**: Bleeding, trauma, severe pain → immediate ER direction (keyword check, safety critical)
- **LLM prompt includes**: full FAQ knowledge base, patient's appointment history, conversation context, clinic facts, behavior rules from `docs/prompt-behavior-rules.md`
- **Booking auto-save**: LLM returns structured JSON with booking fields → validated and saved to SQLite
- **Duplicate prevention**: Checks DB for same-day confirmed appointments before booking
- **Cancel/reschedule**: LLM detects cancel intent, references appointment by index, auto-cancels in DB
- **Multi-language**: Auto-translates Arabic ↔ English via LLM, replies in patient's language

### Admin Dashboard
- **Chat panel**: Thread list (open/pending/resolved filter), message thread, AI draft generation, manual send with canned responses
- **Dashboard view**: Stats cards, appointments list (with service type), enquiries by status tabs, contacts list, cancel/delete actions
- **Simulator tab**: Test incoming WhatsApp messages without live webhook
- **Meta API config**: Phone number ID, access token, verify token — persisted to SQLite
- **FAQ knowledge base**: CRUD for clinic FAQs (editable in right panel, fed to LLM prompt)
- **Bulk operations**: Multi-select threads → bulk resolve or bulk delete
- **SSE**: Real-time updates — no fixed polling, events push on webhook/simulate/send

### Database (SQLite)
| Table | Purpose |
|---|---|
| `threads` | Customer chat threads (phone, status, auto-reply state) |
| `messages` | Individual messages with sender, content, AI metadata |
| `contacts` | Auto-created on first message, linked to HubSpot |
| `appointments` | Bookings with name, phone, day, time, service type, status |
| `settings` | WhatsApp API credentials, persisted across restarts |

### Docker
- Multi-stage build: Node 22 slim → build tools (python3, make, g++) → compile native modules → prune dev deps → slim runtime
- `docker-compose.yml` with runtime env vars, persistent volumes for DB and logs
- Published to Docker Hub: `talapelliwars/whatsapp-support-agent-hub:latest`

---

## File Structure

```
whatsapp-support-agent-hub/
├── server.ts                      # Express server entry point
├── src/
│   ├── App.tsx                    # Main React admin dashboard
│   ├── types.ts                   # TypeScript interfaces
│   └── index.css                  # Tailwind CSS
├── backend/
│   ├── ai/
│   │   └── responseEngine.ts      # AI response engine (LLM + emergency + booking)
│   ├── db/
│   │   ├── sqliteStore.ts         # SQLite schema + all CRUD operations
│   │   └── memoryStore.ts         # In-memory state + file-based fallbacks
│   ├── routes/
│   │   ├── webhookRoutes.ts       # WhatsApp webhook (GET verify + POST receive)
│   │   ├── threadRoutes.ts        # Threads, messages, bulk ops, SSE, appointments
│   │   ├── adminRoutes.ts         # Profile, WhatsApp config, LLM provider
│   │   └── knowledgeRoutes.ts     # FAQ CRUD
│   ├── integrations/
│   │   └── hubspot.ts            # HubSpot CRM contact sync
│   ├── utils/
│   │   └── phone.ts              # Phone number normalization
│   ├── sse.ts                     # Server-Sent Events manager
│   └── test-webhook-e2e.ts       # End-to-end test suite
├── docs/
│   ├── prompt-behavior-rules.md   # LLM behavior rules (synced to systemContext)
│   ├── project-overview.md        # This file
│   ├── cost-estimate.md           # Cost analysis
│   └── test-sheet.md              # Test cases
├── Dockerfile                     # Multi-stage production build
├── docker-compose.yml             # Local Docker setup with env vars
├── package.json                   # Dependencies + scripts
├── .env.example                   # Environment variable template
└── vite.config.ts                 # Vite + Tailwind config
```

---

## Environment Variables

```
GEMINI_API_KEY=           # Google Gemini API key (required for LLM)
DEEPSEEK_API_KEY=         # DeepSeek Chat API key (optional fallback)
GEMINI_MODEL=gemini-flash-latest
APP_URL=                  # Public URL for webhook callback
PORT=3000
HUBSPOT_ACCESS_TOKEN=     # HubSpot private app token (optional CRM sync)
```

---

## Running Locally

```bash
npm install
# Set GEMINI_API_KEY in .env
npm run dev         # Frontend (Vite HMR) + Backend (tsx server.ts)
```

For Docker:
```bash
docker compose up -d   # Builds image, starts container on :3000
```

---

## E2E Testing

```bash
npm run dev              # Start server first
npx tsx backend/test-webhook-e2e.ts   # Runs 22 tests across webhook, simulate, threads, contacts, archive/delete
```
