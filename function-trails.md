# Function Call Trails

## Trail 1: Simulated User Input (`POST /api/simulate-incoming`)

This flow handles messages sent from the **Patient Simulator** tab in the agent dashboard UI (`src/App.tsx`) or from E2E test scripts (`backend/test-webhook-e2e.ts`).

### Entry: Frontend UI → `handleSimulateInbound()`
**File:** `src/App.tsx:230`

```
User fills form (phone, name, message) → clicks "Dispatch Incoming WhatsApp"
  │
  ▼
handleSimulateInbound()  [src/App.tsx:230]
  │
  │  POST /api/simulate-incoming
  │  Body: { customerPhone, customerName, messageText }
  │
  ▼
```

### Step 1: Route Handler
**File:** `backend/routes/threadRoutes.ts:252`

```
threadRouter.post("/simulate-incoming", ...)
```

### Step 2: Normalize Phone
**File:** `backend/utils/phone.ts:1`

```
normalizePhone(customerPhone)
  Strips non-digit/non-`+` characters
```

### Step 3: Upsert Thread
**File:** `backend/db/sqliteStore.ts:321`

```
sqliteUpsertThread(normalizedPhone, customerName, messageText)
  ├─ normalizePhone()                               [backend/utils/phone.ts:1]
  ├─ sqliteGetThreadByPhone()                       [sqliteStore.ts:245]
  │   SELECT * FROM threads WHERE customerPhone = ?
  │
  ├─ [thread not found]  sqliteCreateThread()        [sqliteStore.ts:265]
  │   INSERT new thread (status: "open", autoReplyActive: true)
  │
  └─ [thread found]      sqliteUpdateThread()        [sqliteStore.ts:285]
      UPDATE lastMessageText, lastMessageTime, unreadCount++, status="open"
```

### Step 4: Upsert Contact
**File:** `backend/db/sqliteStore.ts:539`

```
sqliteUpsertContact(normalizedPhone, customerName)
  ├─ normalizePhone()                               [backend/utils/phone.ts:1]
  ├─ sqliteGetContactByPhone()                      [sqliteStore.ts:524]
  │   SELECT * FROM contacts WHERE phone = ?
  │
  ├─ [found]    UPDATE contacts SET name=?, updatedAt=?
  └─ [not found] INSERT INTO contacts (...)
```

### Step 5: Sync to HubSpot (fire-and-forget)
**File:** `backend/integrations/hubspot.ts:93`

```
syncContactToHubSpot(phone, name, messageText)
  ├─ getToken()                                     [hubspot.ts:3]
  │   Reads process.env.HUBSPOT_ACCESS_TOKEN; returns early if null
  │
  ├─ detectContactReason(messageText)               [hubspot.ts:7]
  │   Keyword matching: emergency, medical_advice, booking, pricing, etc.
  │
  ├─ searchHubSpotContact(phone)                    [hubspot.ts:49]
  │   POST /crm/v3/objects/contacts/search
  │
  ├─ [existing]  PATCH /crm/v3/objects/contacts/{id}
  └─ [new]       POST  /crm/v3/objects/contacts
```

### Step 6: Store Customer Message
**File:** `backend/db/sqliteStore.ts:353`

```
sqliteAddMessage(customerMsg)
  INSERT INTO messages (...)
  Message ID prefix: "msg_cust_"
```

### Step 7: Fetch Message History
**File:** `backend/db/sqliteStore.ts:372`

```
sqliteGetMessagesByThreadId(thread.id)
  SELECT * FROM messages WHERE threadId = ? ORDER BY timestamp ASC
```

### Step 8: Log Inbound Event
**File:** `backend/db/memoryStore.ts:267`

```
addLog("inbound", "Simulated Phone Message", ...)
  Pushes WebhookLog entry into memoryWebhookLogs[] (capped at 50)
```

### Step 9: Generate AI Response (with Guardrails)
**File:** `backend/ai/responseEngine.ts:435`

```
generateAIResponseForMessage(messageText, history, memoryProfile, memoryFaqs, phone)
  │
  ├─ llmTranslateToEnglish(customerMessage)          [responseEngine.ts:286]
  │   Detects language (Arabic → English) using:
  │   ├─ generateGeminiContent()                     [responseEngine.ts:48]
  │   │   Google GenAI SDK with model fallbacks (GEMINI_MODEL_FALLBACKS)
  │   │
  │   ├─ DeepSeek API                                [responseEngine.ts:317]
  │   │   POST https://api.deepseek.com/v1/chat/completions
  │   │
  │   └─ [fallback] assume English                   [responseEngine.ts:342]
  │
  ├─ ** INPUT GUARDRAILS **                          [responseEngine.ts:448]
  │   applyInputGuardrails(englishText, originalText)  [guardrails.ts:198]
  │   │
  │   ├─ detectPromptInjection()                     [guardrails.ts:21]
  │   │   10 regex patterns for "ignore all rules", "you are now", etc.
  │   │   Checks both English AND original message
  │   │
  │   ├─ detectAbuse()                               [guardrails.ts:49]
  │   │   English + Arabic keyword lists: threats, profanity
  │   │
  │   ├─ detectOffTopic()                            [guardrails.ts:84]
  │   │   15+ dental-related patterns (EN + AR). Short messages (<5 chars) pass.
  │   │   Blocks only if NO dental/business pattern matches
  │   │
  │   ├─ detectPII()                                 [guardrails.ts:117]
  │   │   Credit card / civil ID / SSN patterns. FLAGS only (does not block).
  │   │
  │   └─ [blocked] → polite refusal returned immediately
  │       "I'm sorry, I can't process that request." (translated if needed)
  │
  ├─ buildCustomerContext(phone)                     [sqliteStore.ts:409]
  │   ├─ sqliteGetThreadByPhone()                    [sqliteStore.ts:245]
  │   ├─ sqliteGetMessagesByThreadId()               [sqliteStore.ts:372]
  │   ├─ Scans for emergency/pain keywords (EN + AR)
  │   ├─ Scans for booking/day keywords
  │   ├─ SELECT appointments WHERE customerPhone = ?
  │   └─ buildContextPrompt()                        [sqliteStore.ts:477]
  │       Formats context as string for LLM
  │
  ├─ sqliteGetAllAppointmentsByPhoneAll(phone)       [sqliteStore.ts:692]
  │   SELECT * FROM appointments WHERE customerPhone = ? (all statuses)
  │
  ├─ Emergency Check                                 [responseEngine.ts:480]
  │   ├─ containsAny(cleaned, EMERGENCY_KEYWORDS_EN) [responseEngine.ts:165]
  │   ├─ containsAny(message, EMERGENCY_KEYWORDS_AR) [responseEngine.ts:165]
  │   │
  │   └─ [emergency hit] → translateToLanguage()    [responseEngine.ts:349]
  │       Returns emergency redirect (confidence=1.0, isEmergency=true)
  │
  ├─ [No emergency] Construct LLM Prompt             [responseEngine.ts:508]
  │   Includes: clinic info, FAQs, conversation history, context, appointments
  │
  ├─ Router: getLlmProvider()                        [memoryStore.ts:89]
  │   Returns "gemini", "deepseek", or "rule"
  │
  ├─ DeepSeek Path                                   [responseEngine.ts:568]
  │   callDeepSeek(prompt)                           [responseEngine.ts:405]
  │   POST https://api.deepseek.com/v1/chat/completions
  │
  ├─ Gemini Path                                     [responseEngine.ts:572]
  │   generateGeminiContent({responseMimeType:"application/json"})
  │
  ├─ Fallback: DeepSeek retry                        [responseEngine.ts:586]
  │
  ├─ Final Fallback: ruleBasedReply()                [responseEngine.ts:663]
  │   Keyword-scoring rule engine matching FAQs
  │
  ├─ [Cancel detected] sqliteCancelAppointment()     [sqliteStore.ts:712]
  │   UPDATE appointments SET status = 'cancelled'
  │
  ├─ [Booking detected] sqliteAddAppointment()       [sqliteStore.ts:599]
  │   Rejects Fridays; checks duplicate; INSERT appointment
  │
  ├─ ** OUTPUT GUARDRAILS **                         [responseEngine.ts:634]
  │   applyOutputGuardrails(result)                   [guardrails.ts:237]
  │   │
  │   ├─ detectMedicalAdviceInOutput()               [guardrails.ts:132]
  │   │   10 English + 4 Arabic regex patterns scanning LLM reply
  │   │   Catches leaked clinical advice despite prompt rules
  │   │
  │   ├─ checkConfidence()                           [guardrails.ts:155]
  │   │   Enforces confidence >= 0.5 minimum threshold
  │   │
  │   ├─ sanitizeOutput()                            [guardrails.ts:165]
  │   │   Redacts PII patterns LLM might hallucinate into reply
  │   │
  │   └─ [blocked] → falls back to ruleBasedReply()
  │       [still blocked] → safe apology message
  │
  └─ translateToLanguage(replyText, originalLang)    [responseEngine.ts:349]
      Gemini → DeepSeek fallback translation
```

### Step 10: Handle Auto-Reply or Draft

```
shouldAutoReply = memoryProfile.autoReplyEnabled && thread.autoReplyActive
  │
  ├─ [YES, auto-reply]  threadRoutes.ts:~290
  │   ├─ sqliteAddMessage(botResponseMsg)            [sqliteStore.ts:353]
  │   │   sender: "agent", isAutoReplied: true
  │   │
  │   ├─ sqliteUpdateThread()                        [sqliteStore.ts:285]
  │   │   Updates lastMessageText, lastMessageTime
  │   │
  │   └─ addLog("outbound", "AI Auto-Reply Sent")    [memoryStore.ts:267]
  │
  └─ [NO, draft mode]  threadRoutes.ts:~315
      ├─ sqliteUpdateThread()                        [sqliteStore.ts:285]
      └─ Sets draftResponse, aiConfidence on customerMsg
```

### Step 11: SSE Refresh + Response
**File:** `backend/sse.ts:20`

```
sseEmit("refresh", { threadId: thread.id })
  Broadcasts SSE "refresh" event to all connected UI clients

res.json({ success, thread, receivedMessage, autoMessage, aiAnalysis, triggeredAutoReply })
```

### Key Difference from Webhook
- **No actual WhatsApp Cloud API call** is made
- Message ID prefix is `"msg_cust_"` (vs `"msg_live_"` for webhook)
- Log type is `"Simulated Phone Message"` (vs `"WhatsApp Live Message"`)

---

## Trail 2: WhatsApp Webhook (`POST /api/whatsapp/webhook`)

This flow handles **real WhatsApp messages** forwarded by the Meta Cloud API.

### PATH A: Webhook Verification (GET)
**File:** `backend/routes/webhookRoutes.ts:26`

```
Meta calls GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...

  ├─ addLog("verification", "Inbound Webhook Handshake")  [memoryStore.ts:267]
  │
  ├─ [token match]    res.status(200).send(challenge)
  └─ [token mismatch] res.sendStatus(403)
```

### PATH B: Event Receiver (POST)
**File:** `backend/routes/webhookRoutes.ts:58`

```
Meta POSTs JSON payload → /api/whatsapp/webhook
  │
  ▼
webhookRouter.post("/whatsapp/webhook", ...)
```

### Phase 1: Message Parsing

```
1. Validate Meta payload structure:
   body.entry[0].changes[0].value.messages[0]

2. Extract:
   ├─ message.from → normalizePhone() + "+"          [utils/phone.ts:1]
   ├─ customerName from value.contacts[0].profile.name
   ├─ messageType from message.type
   └─ messageText from message.text.body
```

### Phase 2: Data Persistence (same as simulated)

```
├─ addLog("inbound", "WhatsApp Live Message")         [memoryStore.ts:267]
├─ sqliteUpsertThread(phone, name, messageText)       [sqliteStore.ts:321]
│   (same internal chain as simulated)
├─ sqliteUpsertContact(phone, name)                   [sqliteStore.ts:539]
│   (same internal chain as simulated)
└─ syncContactToHubSpot(phone, name, msgText)         [hubspot.ts:93]
    (same internal chain as simulated, fire-and-forget)
```

### Phase 3: Store Message + Fetch History

```
├─ sqliteAddMessage(customerMsg)                      [sqliteStore.ts:353]
│   Message ID prefix: "msg_live_"
│
└─ sqliteGetMessagesByThreadId(thread.id)             [sqliteStore.ts:372]
```

### Phase 4: AI Response (with Guardrails)
**File:** `backend/ai/responseEngine.ts:435`

```
generateAIResponseForMessage(messageText, history, memoryProfile, memoryFaqs, phone)
  (IDENTICAL chain as simulated flow — see Trail 1 Step 9 for full breakdown)
  Includes: INPUT GUARDRAILS → LLM → OUTPUT GUARDRAILS
```

### Phase 5: Auto-Reply Decision

```
shouldAutoReply = memoryProfile.autoReplyEnabled && thread.autoReplyActive
  │
  ├─ [YES, auto-reply active]
  │   ├─ sqliteAddMessage(botResponseMsg)            [sqliteStore.ts:353]
  │   ├─ sqliteUpdateThread()                        [sqliteStore.ts:285]
  │   │
  │   └─ WHATSAPP CLOUD API SEND                    [webhookRoutes.ts:120]
  │       POST https://graph.facebook.com/v25.0/{phoneNumberId}/messages
  │       Headers: Authorization: Bearer {accessToken}
  │       Body: { messaging_product, to, type, text }
  │
  │       ├─ [success] addLog("outbound", "WhatsApp Cloud AI Send Active")
  │       └─ [error]   addLog("outbound", "WhatsApp Cloud AI Send Error", false)
  │
  └─ [NO, manual review]
      ├─ sqliteUpdateThread()                        [sqliteStore.ts:285]
      └─ Sets draftResponse, aiConfidence on customerMsg
```

### Phase 6: Final

```
sseEmit("refresh", { source: "webhook", threadId: thread.id })   [sse.ts:20]
  Broadcasts SSE event to all connected frontend clients

res.sendStatus(200)  → acknowledge to Meta
```

### Edge Cases

```
Non-text message (image, audio, etc.):
  ├─ addLog("inbound", "WhatsApp Live Message (Non-Text)")   [memoryStore.ts:267]
  └─ res.sendStatus(200)

Malformed payload (no messages):
  └─ res.sendStatus(200)  (prevents Meta retries)

Missing body.object:
  └─ res.sendStatus(404)
```

### Key Difference from Simulated
- **Real WhatsApp Cloud API call** sends the AI reply to the customer via Meta Graph API v25.0
- Message ID prefix is `"msg_live_"` (vs `"msg_cust_"` for simulated)
- SSE event includes `source: "webhook"`
- Log type is `"WhatsApp Live Message"` (vs `"Simulated Phone Message"`)

---

## Guardrail Decision Flow

Both trails pass through the same guardrail pipeline inside `generateAIResponseForMessage()`:

```
User Message
  │
  ▼
llmTranslateToEnglish()          [responseEngine.ts:286]
  │
  ▼
applyInputGuardrails()           [guardrails.ts:198]
  │
  ├─ detectPromptInjection()     [guardrails.ts:21]   → BLOCK
  ├─ detectAbuse()               [guardrails.ts:49]   → BLOCK
  ├─ detectOffTopic()            [guardrails.ts:84]   → BLOCK only if no match
  └─ detectPII()                 [guardrails.ts:117]  → FLAG only (log warning)
  │
  ├─ [BLOCKED] → polite refusal, isAutoRepliable: false
  │
  └─ [PASS] ──────────────────────────────────────────────┐
                                                          │
                                                          ▼
                                              Emergency Check → LLM → Booking/Cancel
                                                          │
                                                          ▼
                                        applyOutputGuardrails()     [guardrails.ts:237]
                                                          │
                                        ├─ detectMedicalAdviceInOutput()  [guardrails.ts:132] → BLOCK
                                        ├─ checkConfidence()              [guardrails.ts:155] → BLOCK if < 0.5
                                        └─ sanitizeOutput()               [guardrails.ts:165] → CORRECT (redact PII)
                                                          │
                                        ├─ [BLOCKED] → ruleBasedReply() fallback → safe apology
                                        │
                                        └─ [PASS] → translateToLanguage() → return to caller
```

---

## Shared Downstream Functions

Both trails converge on the same core pipeline:

| Function | File | Line |
|---|---|---|
| `normalizePhone()` | `backend/utils/phone.ts` | 1 |
| `sqliteUpsertThread()` | `backend/db/sqliteStore.ts` | 321 |
| `sqliteUpsertContact()` | `backend/db/sqliteStore.ts` | 539 |
| `sqliteAddMessage()` | `backend/db/sqliteStore.ts` | 353 |
| `sqliteGetMessagesByThreadId()` | `backend/db/sqliteStore.ts` | 372 |
| `generateAIResponseForMessage()` | `backend/ai/responseEngine.ts` | 435 |
| `llmTranslateToEnglish()` | `backend/ai/responseEngine.ts` | 286 |
| `translateToLanguage()` | `backend/ai/responseEngine.ts` | 349 |
| `callDeepSeek()` | `backend/ai/responseEngine.ts` | 405 |
| `generateGeminiContent()` | `backend/ai/responseEngine.ts` | 48 |
| `ruleBasedReply()` | `backend/ai/responseEngine.ts` | 663 |
| `containsAny()` | `backend/ai/responseEngine.ts` | 165 |
| `buildCustomerContext()` | `backend/db/sqliteStore.ts` | 409 |
| `buildContextPrompt()` | `backend/db/sqliteStore.ts` | 477 |
| `syncContactToHubSpot()` | `backend/integrations/hubspot.ts` | 93 |
| `detectContactReason()` | `backend/integrations/hubspot.ts` | 7 |
| `searchHubSpotContact()` | `backend/integrations/hubspot.ts` | 49 |
| `addLog()` | `backend/db/memoryStore.ts` | 267 |
| `sseEmit()` | `backend/sse.ts` | 20 |

### Guardrail Functions

| Function | File | Line | Type |
|---|---|---|---|
| `applyInputGuardrails()` | `backend/ai/guardrails.ts` | 198 | Top-level input hook |
| `applyOutputGuardrails()` | `backend/ai/guardrails.ts` | 237 | Top-level output hook |
| `detectPromptInjection()` | `backend/ai/guardrails.ts` | 21 | Input — blocks |
| `detectAbuse()` | `backend/ai/guardrails.ts` | 49 | Input — blocks |
| `detectOffTopic()` | `backend/ai/guardrails.ts` | 84 | Input — blocks if no match |
| `detectPII()` | `backend/ai/guardrails.ts` | 117 | Input — flags only |
| `detectMedicalAdviceInOutput()` | `backend/ai/guardrails.ts` | 132 | Output — blocks |
| `checkConfidence()` | `backend/ai/guardrails.ts` | 155 | Output — blocks if < 0.5 |
| `sanitizeOutput()` | `backend/ai/guardrails.ts` | 165 | Output — corrects |

---

## Files Involved

| File | Role |
|---|---|
| `server.ts:60-61` | Mounts `threadRouter` under `/api`, `webhookRouter` under `/api` |
| `src/App.tsx:113-115,230,239-245` | Frontend simulator form state, dispatch, preset loader |
| `backend/routes/threadRoutes.ts:252` | `POST /api/simulate-incoming` handler |
| `backend/routes/webhookRoutes.ts:26,58` | `GET` verification + `POST` event handler |
| `backend/utils/phone.ts:1` | `normalizePhone()` |
| `backend/db/memoryStore.ts:57-62,47-55,89-91,267` | In-memory config, profile, LLM provider, webhook logs |
| `backend/db/sqliteStore.ts` | All SQLite persistence (threads, messages, contacts, appointments) |
| `backend/ai/responseEngine.ts` | Full AI pipeline (translation, LLM, emergency check, booking) |
| `backend/ai/guardrails.ts` | Input/output guardrails (prompt injection, abuse, off-topic, PII, medical advice, confidence, sanitization) |
| `backend/integrations/hubspot.ts` | HubSpot CRM sync |
| `backend/sse.ts:5,20` | SSE connection and broadcast |
| `backend/test-webhook-e2e.ts:250-276` | E2E test calling simulate endpoint |
