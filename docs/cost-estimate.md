# Bright Smile Dental Clinic — Cost Estimate

## Stack & Tools Used

| Component | Choice | Why |
|-----------|--------|-----|
| **Frontend** | React + Vite + Tailwind CSS | Already in the project, fast HMR, clean UI |
| **Backend** | Node.js + Express (TypeScript) | Already in project, zero-config, fast dev |
| **LLM** | Google Gemini 2.0 Flash (free tier) | No cost for <1,500 requests/day; fast; supports Arabic natively |
| **WhatsApp API** | Meta WhatsApp Cloud API (optional) | Simulator mode works without WhatsApp; live API is pay-as-you-go |
| **Appointment Storage** | JSON file on disk (`appointments.json`) | Zero cost, zero setup, simple logging |
| **Hosting** | Not deployed (local dev only) | For demo — any cheap VPS or Railway/Render would work |

## Monthly Operating Cost for ~1,000 Conversations

### Option A: Gemini-only (no WhatsApp API, Simulator mode)

| Item | Monthly Cost |
|------|-------------|
| Gemini 2.0 Flash (free tier: 1,500 req/day free) | **$0.00** |
| Server hosting (optional, e.g. Railway Hobby) | $5.00 |
| **Total** | **~$0 – $5/month** |

1,000 conversations ≈ ~2,000–3,000 requests (2–3 turns each). At Gemini Flash pricing ($0.10/1M input tokens, $0.40/1M output tokens), ~3K requests × ~200 tokens each ≈ $0.03/month. Free tier covers it fully.

### Option B: WhatsApp Cloud API + Gemini

| Item | Monthly Cost |
|------|-------------|
| WhatsApp Cloud API (1,000 conversations) | $0.00 (first 1,000 are free) |
| Gemini 2.0 Flash | **$0.00** (within free tier) |
| Server hosting | $5–$20/month |
| **Total** | **~$5 – $20/month** |

**Note:** WhatsApp charges per conversation after the first 1,000. At 1K/month, you stay within the free tier. Beyond 1K, WhatsApp is ~$0.005/conversation (marketing) to ~$0.02/conversation (service).

### Option C: OpenAI (GPT-4o-mini) instead of Gemini

| Item | Monthly Cost |
|------|-------------|
| GPT-4o-mini (~3K requests × 200 tokens) | ~$0.10/month |
| WhatsApp Cloud API | $0 (free tier) |
| Hosting | $5–$20/month |
| **Total** | **~$5 – $20/month** |

GPT-4o-mini is $0.15/1M input, $0.60/1M output tokens — still negligible for 1K conversations.

## Summary

**For 1,000 conversations/month: approximately $0–$20/month total.**

The prototype runs with **zero API costs** in Simulator mode using rule-based keyword matching. Adding a Gemini API key enables the LLM for better handling of unusual phrasings, still within the free tier.

### Recommended Production Stack

- **LLM:** Gemini 2.0 Flash (free tier) or GPT-4o-mini (~$0.10/month for 1K convos)
- **WhatsApp API:** Meta Cloud API (free for first 1K conversations)
- **Appointment DB:** Google Sheets API (free) or Supabase (free tier)
- **Hosting:** Railway / Render / Fly.io (~$5–$20/month)
- **Total monthly:** ~$5–$25 for a fully production dental clinic assistant