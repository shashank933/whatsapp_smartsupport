/**
 * E2E test: mock WhatsApp webhook calls and verify backend + frontend APIs.
 * Run with: npx tsx backend/test-webhook-e2e.ts
 *
 * Prerequisites: dev server must be running on localhost:3000
 */

const BASE = "http://localhost:3000";

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];
let totalPassed = 0;
let totalFailed = 0;

function logTest(name: string, testPassed: boolean, detail: string) {
  const icon = testPassed ? "✓" : "✗";
  console.log(`  ${icon} ${name}${detail ? ` — ${detail}` : ""}`);
  results.push({ name, passed: testPassed, detail });
  if (testPassed) totalPassed++; else totalFailed++;
}

async function get(url: string) {
  const res = await fetch(`${BASE}${url}`);
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch {}
  return { status: res.status, body };
}

async function post(url: string, data: any) {
  const res = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, body };
}

async function del(url: string) {
  const res = await fetch(`${BASE}${url}`, { method: "DELETE" });
  return { status: res.status };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// -------------------------------------------------------------
// 1. WEBHOOK VERIFICATION (GET handshake)
// -------------------------------------------------------------
async function testWebhookVerification() {
  console.log("\n=== Webhook Verification (GET) ===");

  const correct = await get(
    "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=bright_smile_verify_secure_token&hub.challenge=challenge_abc123"
  );
  logTest(
    "Correct verify token returns challenge",
    correct.status === 200 && correct.body === "challenge_abc123",
    `status=${correct.status} body=${JSON.stringify(correct.body)}`
  );

  const wrong = await get(
    "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test"
  );
  logTest(
    "Wrong verify token returns 403",
    wrong.status === 403,
    `status=${wrong.status}`
  );

  const missing = await get("/api/whatsapp/webhook");
  logTest(
    "Missing params returns 400",
    missing.status === 400,
    `status=${missing.status}`
  );
}

// -------------------------------------------------------------
// 2. WEBHOOK POST (incoming WhatsApp messages)
// -------------------------------------------------------------
async function testWebhookPost() {
  console.log("\n=== Webhook POST (Incoming Messages) ===");

  const emergencyPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "test_entry_1",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15551234567",
                phone_number_id: "123456789",
              },
              contacts: [{ profile: { name: "Ahmed Emergency" } }],
              messages: [
                {
                  from: "+96555510001",
                  id: "wamid.emergency",
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "I need urgent support, please help!" },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const res1 = await post("/api/whatsapp/webhook", emergencyPayload);
  logTest(
    "Emergency message accepted (200)",
    res1.status === 200,
    `status=${res1.status}`
  );

  await sleep(500);

  const bookingPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "test_entry_2",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15551234567",
                phone_number_id: "123456789",
              },
              contacts: [{ profile: { name: "Sara Booking" } }],
              messages: [
                {
                  from: "+96555510002",
                  id: "wamid.booking",
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "I want to book an appointment for Sunday at 10 AM" },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const res2 = await post("/api/whatsapp/webhook", bookingPayload);
  logTest(
    "Booking message accepted (200)",
    res2.status === 200,
    `status=${res2.status}`
  );

  await sleep(500);

  const pricingPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "test_entry_3",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15551234567",
                phone_number_id: "123456789",
              },
              contacts: [{ profile: { name: "Khalid Inquiry" } }],
              messages: [
                {
                  from: "+96555510003",
                  id: "wamid.pricing",
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "How much does Educational Support Hub cost?" },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const res3 = await post("/api/whatsapp/webhook", pricingPayload);
  logTest(
    "Pricing message accepted (200)",
    res3.status === 200,
    `status=${res3.status}`
  );

  await sleep(500);

  const arabicPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "test_entry_4",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15551234567",
                phone_number_id: "123456789",
              },
              contacts: [{ profile: { name: "فاطمة المري" } }],
              messages: [
                {
                  from: "+96555510004",
                  id: "wamid.arabic",
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "السلام عليكم، عندي الم في الضرس واحتاج موعد" },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const res4 = await post("/api/whatsapp/webhook", arabicPayload);
  logTest(
    "Arabic message accepted (200)",
    res4.status === 200,
    `status=${res4.status}`
  );
}

// -------------------------------------------------------------
// 3. SIMULATE INCOMING (sandbox endpoint)
// -------------------------------------------------------------
async function testSimulateIncoming() {
  console.log("\n=== Simulate Incoming ===");

  const res = await post("/api/simulate-incoming", {
    customerPhone: "+96566612345",
    customerName: "Test User Sim",
    messageText: "Hi, I need an appointment for Thursday at 2 PM",
  });

  logTest(
    "Simulate returns 200 with thread data",
    res.status === 200 && res.body?.thread?.id != null,
    `status=${res.status} threadId=${res.body?.thread?.id}`
  );

  logTest(
    "Simulate triggered auto-reply",
    res.body?.triggeredAutoReply === true,
    `autoReply=${res.body?.triggeredAutoReply}`
  );

  logTest(
    "Simulate has AI analysis",
    res.body?.aiAnalysis?.replyText != null,
    `confidence=${res.body?.aiAnalysis?.confidence}`
  );
}

// -------------------------------------------------------------
// 4. VERIFY THREADS API
// -------------------------------------------------------------
async function testThreadsApi() {
  console.log("\n=== Threads API ===");

  const all = await get("/api/threads");
  logTest(
    "GET /api/threads returns array",
    Array.isArray(all.body) && all.status === 200,
    `count=${all.body?.length}`
  );

  logTest(
    "At least 5 threads from webhook + simulate",
    all.body?.length >= 5,
    `found ${all.body?.length}`
  );

  const openThreads = await get("/api/threads?status=open");
  logTest(
    "Status filter works (?status=open)",
    openThreads.body?.every((t: any) => t.status === "open"),
    `open count=${openThreads.body?.length}`
  );

  if (all.body?.length > 0) {
    const first = all.body[0];
    const messages = await get(`/api/threads/${first.id}/messages`);
    logTest(
      "Thread messages are accessible",
      Array.isArray(messages.body) && messages.status === 200,
      `msg count=${messages.body?.length}`
    );

    const draft = await post(`/api/threads/${first.id}/draft`, {});
    logTest(
      "Draft generation works",
      draft.status === 200 && draft.body?.draftText != null,
      `draft=${draft.body?.draftText?.substring(0, 40)}...`
    );
  }
}

// -------------------------------------------------------------
// 5. VERIFY CONTACTS API
// -------------------------------------------------------------
async function testContactsApi() {
  console.log("\n=== Contacts API ===");

  const contacts = await get("/api/contacts");
  logTest(
    "GET /api/contacts returns array",
    Array.isArray(contacts.body) && contacts.status === 200,
    `count=${contacts.body?.length}`
  );

  logTest(
    "Contacts auto-created from webhook messages",
    contacts.body?.length >= 4,
    `found ${contacts.body?.length} contacts`
  );

  if (contacts.body?.length > 0) {
    const c = contacts.body[0];
    logTest(
      "Contact has required fields",
      c.id != null && c.phone != null && c.name != null,
      `${c.name} / ${c.phone}`
    );
  }
}

// -------------------------------------------------------------
// 6. ARCHIVE + DELETE THREADS
// -------------------------------------------------------------
async function testArchiveDelete() {
  console.log("\n=== Archive & Delete ===");

  const all = await get("/api/threads");
  if (all.body?.length > 0) {
    const thread = all.body[0];

    const archive = await post(`/api/threads/${thread.id}/archive`, {});
    logTest(
      "Archive sets status to archived",
      archive.status === 200 && archive.body?.thread?.status === "archived",
      `status=${archive.body?.thread?.status}`
    );

    const archivedList = await get("/api/threads?status=archived");
    logTest(
      "Archived threads are queryable",
      archivedList.body?.some((t: any) => t.id === thread.id),
      `archived count=${archivedList.body?.length}`
    );
  }

  const sim = await post("/api/simulate-incoming", {
    customerPhone: "+96577788899",
    customerName: "Delete Test",
    messageText: "Hello",
  });
  await sleep(300);

  if (sim.body?.thread?.id) {
    const deleteRes = await del(`/api/threads/${sim.body.thread.id}`);
    logTest(
      "Delete returns success",
      deleteRes.status === 200,
      `status=${deleteRes.status}`
    );

    const verify = await get(`/api/threads/${sim.body.thread.id}/messages`);
    const isValid = verify.status === 200 && Array.isArray(verify.body) && verify.body.length === 0;
    logTest(
      "Deleted thread messages return empty array",
      isValid,
      `status=${verify.status} count=${verify.body?.length}`
    );
  }
}

// -------------------------------------------------------------
// 7. WEBHOOK LOGS
// -------------------------------------------------------------
async function testWebhookLogs() {
  console.log("\n=== Webhook Logs ===");

  const logs = await get("/api/webhook-logs");
  logTest(
    "GET /api/webhook-logs returns array",
    Array.isArray(logs.body) && logs.status === 200,
    `count=${logs.body?.length}`
  );
}

// -------------------------------------------------------------
// MAIN
// -------------------------------------------------------------
async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║  WhatsApp Webhook E2E Test Suite    ║");
  console.log("╚══════════════════════════════════════╝");

  const health = await fetch(`${BASE}/`).catch(() => null);
  if (!health || health.status !== 200) {
    console.error(
      "\n✗ Server not reachable at http://localhost:3000"
    );
    console.error("  Start with: npm run dev");
    process.exit(1);
  }
  console.log(`  Server: ONLINE (${BASE})\n`);

  await testWebhookVerification();
  await testWebhookPost();
  await testSimulateIncoming();
  await testThreadsApi();
  await testContactsApi();
  await testArchiveDelete();
  await testWebhookLogs();

  console.log("\n═══════════════════════════════════════");
  console.log(`  Results: ${totalPassed} passed, ${totalFailed} failed`);

  if (totalFailed > 0) {
    console.error("FAILED TESTS:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`  ✗ ${r.name} — ${r.detail}`);
    });
    process.exit(1);
  }

  console.log("All tests passed!\n");
}

main().catch((e) => {
  console.error("Test suite error:", e);
  process.exit(1);
});
