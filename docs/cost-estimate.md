# Bright Smile Dental Clinic — Cost Estimate

## Actual Stack (from source code analysis)

| Layer | Technology | Pricing Model |
|---|---|---|
| **Primary LLM** | Google Gemini 2.0 Flash | $0.10 / 1M input tokens, $0.40 / 1M output tokens. Free tier: 1,500 requests/day, 1M tokens/day. |
| **Fallback LLM** | DeepSeek Chat (deepseek-chat) | $0.14 / 1M input tokens, $0.28 / 1M output tokens. No free tier. |
| **WhatsApp API** | Meta Cloud API v25.0 | First 1,000 service conversations free/month. Then: service $0.0179, marketing $0.0062, utility $0.0044 per conversation. |
| **Database** | SQLite (`better-sqlite3`) | $0 — embedded file database, no cloud costs. |
| **CRM** | HubSpot Private App | $0 — free CRM with standard API access. |
| **Hosting** | Docker container (Node.js) | $5–$20/month (Railway, Render, Fly.io, or any VPS). |
| **Container Registry** | Docker Hub | $0 — public repository. |
| **Translation** | Via LLM (Gemini/DeepSeek) | Counted in LLM usage below, no separate translation API cost. |

| **Not used** | OpenAI, Supabase, Google Sheets, MongoDB, Redis | No additional costs. |

---

## Per-Conversation LLM Token Usage

The response engine makes **2-3 LLM calls per customer message**:

| Step | LLM Call | Est. Input Tokens | Est. Output Tokens |
|---|---|---|---|
| 1. Translate to English | `llmTranslateToEnglish()` | 100 | 50 |
| 2. Intent + Reply generation | `callDeepSeek()` / `generateGeminiContent()` | 800–1,200 | 200–400 |
| 3. Translate back to Arabic (if needed) | `translateToLanguage()` | 100 | 100 |
| **Total per message turn** | | **~1,000–1,400** | **~350–550** |

A typical conversation is 2–3 turns (customer message → reply → customer follow-up → reply).  
So per full conversation: **~3,000 input / ~1,200 output tokens**.

---

## Monthly Operating Cost

### At 1,000 Conversations / Month

| Item | Gemini (Free Tier) | Gemini (Paid) | DeepSeek |
|---|---|---|---|
| Input tokens (3M) | $0.00 (within 1M/day free) | $0.30 | $0.42 |
| Output tokens (1.2M) | $0.00 | $0.48 | $0.34 |
| LLM Subtotal | **$0.00** | **$0.78** | **$0.76** |
| WhatsApp API | $0.00 (first 1K free) | $0.00 | $0.00 |
| Hosting (VPS) | $5–$10 | $5–$10 | $5–$10 |
| HubSpot CRM | $0.00 | $0.00 | $0.00 |
| **Total** | **~$5–$10/month** | **~$6–$11/month** | **~$6–$11/month** |

### At 5,000 Conversations / Month

| Item | Gemini | DeepSeek |
|---|---|---|
| Input tokens (15M) | $1.50 | $2.10 |
| Output tokens (6M) | $2.40 | $1.68 |
| LLM Subtotal | **$3.90** | **$3.78** |
| WhatsApp API (5K service convos, first 1K free) | ~$71.60 | ~$71.60 |
| Hosting (upgraded) | $20–$40 | $20–$40 |
| **Total** | **~$95–$115/month** | **~$95–$115/month** |

> ⚠️ WhatsApp becomes the dominant cost at scale ($0.0179/service convo). At 10K/month: ~$161 in WhatsApp fees alone.

---

## Cost-Saving Recommendations

### 1. WhatsApp API (highest savings potential)

- **Stay in the free 1,000 service conversations/month** as long as possible. Service conversations are user-initiated messages your bot replies to within 24 hours.
- **Use utility templates** ($0.0044/convo) for outbound appointment reminders instead of free-form messages.
- **Consider a WhatsApp Business Platform Partner (BSP)** — some offer bundled pricing at lower per-conversation rates.

### 2. LLM Optimization

- **Cache FAQ responses**: The prompt includes the full FAQ list on every call. Move FAQ matching to keyword/cosine-similarity lookup (client-side) and only call the LLM for non-FAQ messages. Estimated savings: 30-40% of LLM calls.
- **Batch translations**: If 3 consecutive messages are in Arabic, translate once and reuse. Currently each message triggers a separate translation call.
- **Use Gemini free tier aggressively**: 1,500 requests/day × 30 days = 45,000 free requests/month. Even at 3 LLM calls per turn × 3 turns per conversation, that's 9 calls per conversation — handling 5,000 conversations/month within the free tier.
- **DeepSeek is cheaper than paid Gemini**: $0.76 vs $0.78 per 1K conversations — nearly identical. Either works.

### 3. Infrastructure

- **SQLite is the right choice**: Zero cost, no cloud DB needed at this scale. If exceeding ~50K conversations, consider migrating appointment data to a hosted DB.
- **Docker image (150 MB)**: Fits on any $5/month VPS. Consider using a CDN for the React SPA assets if global latency matters.
- **HubSpot CRM sync is optional**: Disable `HUBSPOT_ACCESS_TOKEN` if not needed — no cost impact but simplifies deployment.

### 4. Feature-Level Cost Breakdown

| Feature | LLM Calls per Trigger | Tokens per Call | Monthly Impact (1K convos) |
|---|---|---|---|
| Each customer message reply | 2-3 | 1,500 | $0.00–$0.78 |
| Simulate incoming (testing) | 2-3 | 1,500 | Depends on testing volume |
| AI Draft generation (agent) | 1 | 800 | Negligible |
| Rule-based fallback | 0 (no LLM) | 0 | $0.00 |

---

## Summary

| Scale | Monthly Cost | Main Cost Driver |
|---|---|---|
| **Prototype (simulator only)** | $0 + your time | Local dev, no external APIs used |
| **1,000 conversations** | **$5–$10** | Hosting (LLM free tier covers everything) |
| **5,000 conversations** | **$95–$115** | WhatsApp API ($72) + Hosting ($30) |
| **10,000 conversations** | **$200–$250** | WhatsApp API ($161) + LLM ($8) + Hosting ($40) |

**Bottom line**: The LLM and database are practically free at all scales. WhatsApp API fees dominate at production volumes. The entire prototype runs on Gemini's free tier for up to ~5,000 conversations/month just on LLM costs.
