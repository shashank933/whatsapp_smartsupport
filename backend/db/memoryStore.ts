import {
  WhatsAppConfig,
  BusinessProfile,
  FAQItem,
  ChatThread,
  ChatMessage,
  CannedResponse,
  WebhookLog,
} from "../../src/types";
import fs from "fs";
import path from "path";

function loadPromptRules(): string {
  try {
    const docPath = path.join(process.cwd(), "docs", "prompt-behavior-rules.md");
    if (fs.existsSync(docPath)) {
      const raw = fs.readFileSync(docPath, "utf-8");
      const stripped = raw
        .replace(/^###.*$/gm, "")
        .replace(/^##.*$/gm, "")
        .replace(/^# .*$/gm, "")
        .replace(/^\s*$/gm, "")
        .replace(/```/g, "")
        .trim();
      return stripped;
    }
  } catch (e) {
    console.error("Failed to load prompt-behavior-rules.md:", e);
  }
  return "";
}

// -------------------------------------------------------------
// In-Memory Database — Bright Smile Dental Clinic
// -------------------------------------------------------------
export let memoryFaqs: FAQItem[] = [
  {
    id: "faq_hours",
    question: "What are your working hours?",
    answer:
      "Bright Smile Dental Clinic is open Saturday to Thursday, 9:00 AM to 9:00 PM. We are closed on Fridays.",
    keywords: ["hours", "open", "time", "working", "ساعات", "مفتوح", "وقت", "مواعيد", "friday", "الجمعة", "saturday", "السبت", "schedule", "جدول"],
  },
  {
    id: "faq_location",
    question: "Where is the clinic located?",
    answer:
      "We are located in Salmiya, Kuwait — Salem Al-Mubarak Street, Block 5, near the Al-Fanar Mall.",
    keywords: ["location", "address", "where", "salmiya", "الكويت", "موقع", "عنوان", "أين", "السالمية", "salem", "سالم", "المبارك", "fanar", "الفنار"],
  },
  {
    id: "faq_services",
    question: "What services do you offer and what are the prices?",
    answer:
      "Our services and prices:\n• Check-up: 15 KWD\n• Cleaning (Scaling & Polishing): 25 KWD\n• Teeth Whitening: 80 KWD\n• Filling: starting from 30 KWD",
    keywords: ["services", "prices", "cost", "price", "خدمات", "أسعار", "سعر", "تكلفة", "check-up", "كشف", "cleaning", "تنظيف", "whitening", "تبييض", "filling", "حشوة", "kwd", "دينار"],
  },
  {
    id: "faq_booking",
    question: "How can I book an appointment?",
    answer:
      "To book an appointment, just tell me your full name and your preferred day and time (e.g., 'Ahmed, Sunday at 3 PM'). I'll confirm it for you!",
    keywords: ["book", "appointment", "booking", "reserve", "حجز", "موعد", "احجز", "schedule", "جدولة", "name", "اسم", "day", "يوم", "time", "وقت"],
  },
];

const baseSystemContext =
  "Bright Smile Dental Clinic is a trusted dental practice in Salmiya, Kuwait. We are open Saturday to Thursday, 9 AM to 9 PM. Closed Friday. Services: Check-up 15 KWD, Cleaning 25 KWD, Whitening 80 KWD, Filling from 30 KWD. We NEVER give medical or clinical advice — patients must see a dentist in person for any diagnosis or treatment recommendations. For emergencies (severe pain, bleeding, swelling, trauma), we direct patients to seek immediate emergency care and flag the case for a human dentist to follow up. We reply in the same language the patient uses. Our tone is warm, professional, and caring.";

function buildSystemContext(): string {
  const rules = loadPromptRules();
  if (rules) {
    return baseSystemContext + "\n\nADDITIONAL BEHAVIOUR RULES:\n" + rules;
  }
  return baseSystemContext;
}

export let memoryProfile: BusinessProfile = {
  name: "Bright Smile Dental Clinic",
  industry: "Dental Care",
  replyTone: "supportive",
  systemContext: buildSystemContext(),
  autoReplyEnabled: true,
  minConfidence: 0.7,
};

export let memoryWhatsAppConfig: WhatsAppConfig = {
  phoneNumberId: "1234567890123",
  businessAccountId: "9876543210987",
  accessToken: "EAAWf...",
  verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || "bright_smile_verify_secure_token",
};

export let memoryCannedResponses: CannedResponse[] = [
  {
    id: "canned_1",
    shortcut: "/welcome",
    text: "Welcome to Bright Smile Dental Clinic! How can we help you today?",
  },
  {
    id: "canned_2",
    shortcut: "/hours",
    text: "We are open Saturday to Thursday, 9 AM to 9 PM. Closed Friday.",
  },
  {
    id: "canned_3",
    shortcut: "/emergency",
    text: "This sounds like a dental emergency. Please go to the nearest hospital emergency room immediately. We have flagged your case for the dentist to follow up with you.",
  },
];

// -------------------------------------------------------------
// LLM Provider Toggle
// -------------------------------------------------------------
export type LlmProvider = "gemini" | "deepseek" | "rule";

let currentLlmProvider: LlmProvider = "gemini";

export function getLlmProvider(): LlmProvider {
  return currentLlmProvider;
}

export function setLlmProvider(provider: LlmProvider): void {
  currentLlmProvider = provider;
  console.log(`LLM provider switched to: ${provider}`);
}

export let memoryThreads: ChatThread[] = [
  {
    id: "thread_customer_1",
    customerPhone: "+965 5551-2345",
    customerName: "Fatima Al-Ali",
    status: "open",
    lastMessageText: "Hi, I need to book a check-up for Thursday morning please.",
    lastMessageTime: Date.now() - 3600000 * 2,
    unreadCount: 1,
    autoReplyActive: true,
  },
  {
    id: "thread_customer_2",
    customerPhone: "+965 9988-7766",
    customerName: "Mohammed Al-Rashed",
    status: "open",
    lastMessageText: "How much is teeth whitening?",
    lastMessageTime: Date.now() - 1800000 * 4,
    unreadCount: 0,
    autoReplyActive: true,
  },
  {
    id: "thread_customer_3",
    customerPhone: "+965 6677-8899",
    customerName: "Noor Al-Sabah",
    status: "resolved",
    lastMessageText: "Thank you! I'll come on Sunday at 10 AM.",
    lastMessageTime: Date.now() - 3600000 * 24,
    unreadCount: 0,
    autoReplyActive: false,
  },
];

export let memoryMessages: ChatMessage[] = [
  {
    id: "msg_1",
    threadId: "thread_customer_1",
    sender: "customer",
    content: "Hi, I need to book a check-up for Thursday morning please.",
    timestamp: Date.now() - 3600000 * 2,
  },
  {
    id: "msg_2",
    threadId: "thread_customer_2",
    sender: "customer",
    content: "How much is teeth whitening?",
    timestamp: Date.now() - 1800000 * 4 - 300000,
  },
  {
    id: "msg_3",
    threadId: "thread_customer_2",
    sender: "agent",
    content: "Teeth whitening is 80 KWD. Would you like to book an appointment?",
    timestamp: Date.now() - 1800000 * 4,
    isAutoReplied: true,
    aiConfidence: 0.98,
    aiExplanation: "Matched FAQ for services/pricing.",
  },
  {
    id: "msg_4",
    threadId: "thread_customer_3",
    sender: "customer",
    content: "Are you open on Fridays?",
    timestamp: Date.now() - 3600000 * 24 - 120000,
  },
  {
    id: "msg_5",
    threadId: "thread_customer_3",
    sender: "agent",
    content:
      "Bright Smile Dental Clinic is open Saturday to Thursday, 9:00 AM to 9:00 PM. We are closed on Fridays.",
    timestamp: Date.now() - 3600000 * 24 - 60000,
    isAutoReplied: true,
    aiConfidence: 0.99,
    aiExplanation: "Perfect match found in FAQ 'faq_hours'",
  },
  {
    id: "msg_6",
    threadId: "thread_customer_3",
    sender: "customer",
    content: "Thank you! I'll come on Sunday at 10 AM.",
    timestamp: Date.now() - 3600000 * 24,
  },
];

export let memoryWebhookLogs: WebhookLog[] = [
  {
    id: "log_1",
    direction: "verification",
    type: "Webhook Challenge",
    timestamp: Date.now() - 3600000 * 5,
    success: true,
    summary: "Webhook verify token successfully verified with Meta Servers.",
    payload: JSON.stringify(
      {
        mode: "subscribe",
        challenge: "11524312",
        verify_token: "your_webhook_verify_token",
      },
      null,
      2
    ),
  },
];

// -------------------------------------------------------------
// Logging helper
// -------------------------------------------------------------
export function addLog(
  direction: "inbound" | "outbound" | "verification",
  type: string,
  success: boolean,
  summary: string,
  payload: any
) {
  const log: WebhookLog = {
    id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    direction,
    type,
    timestamp: Date.now(),
    success,
    summary,
    payload: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
  };
  memoryWebhookLogs.unshift(log);
  if (memoryWebhookLogs.length > 50) memoryWebhookLogs.pop();
}

// -------------------------------------------------------------
// Setter helpers
// -------------------------------------------------------------
export function updateProfile(p: BusinessProfile) {
  memoryProfile = p;
}
export function updateWhatsAppConfig(c: WhatsAppConfig) {
  memoryWhatsAppConfig = c;
}
export function setFaqs(faqs: FAQItem[]) {
  memoryFaqs = faqs;
}
export function setCannedResponses(cr: CannedResponse[]) {
  memoryCannedResponses = cr;
}

// -------------------------------------------------------------
// Thread & Message helpers
// -------------------------------------------------------------
export function getThreadsSorted(): ChatThread[] {
  return memoryThreads.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
}

export function getMessagesForThread(threadId: string): ChatMessage[] {
  return memoryMessages
    .filter((m) => m.threadId === threadId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function findOrCreateThread(
  customerPhone: string,
  customerName: string,
  messageText: string
): ChatThread {
  let thread = memoryThreads.find((t) => t.customerPhone === customerPhone);

  if (!thread) {
    thread = {
      id: "thread_" + Date.now(),
      customerPhone,
      customerName,
      status: "open",
      lastMessageText: messageText,
      lastMessageTime: Date.now(),
      unreadCount: 1,
      autoReplyActive: true,
    };
    memoryThreads.push(thread);
  } else {
    thread.lastMessageText = messageText;
    thread.lastMessageTime = Date.now();
    thread.unreadCount = (thread.unreadCount || 0) + 1;
    thread.status = "open";
  }

  return thread;
}