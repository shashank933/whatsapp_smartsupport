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
// In-Memory Database — WhatsApp SmartSupport
// -------------------------------------------------------------
export let memoryFaqs: FAQItem[] = [
  {
    id: "faq_hours",
    question: "What are your opening hours?",
    answer:
      "We are open Sunday to Thursday from 12:00 PM to 11:00 PM, and Friday to Saturday from 1:00 PM to 11:30 PM.",
    keywords: ["hours", "open", "time", "working", "ساعات", "مفتوح", "وقت", "مواعيد", "weekend", "عطلة", "sunday", "monday", "الاثنين", "schedule", "جدول", "close", "متى", "تسكرون", "تفتحون", "closing", "opening"],
  },
  {
    id: "faq_location",
    question: "Where are you located?",
    answer:
      "We are located at [Restaurant Address]. You can find us on Google Maps. Parking is available on-site for our dine-in guests.",
    keywords: ["location", "address", "where", "located", "directions", "map", "parking", "موقع", "عنوان", "وين", "فين", "موقعكم", "خرائط", "مواقف", "park"],
  },
  {
    id: "faq_menu",
    question: "What is on your menu? / What food do you serve?",
    answer:
      "We serve a variety of dishes including appetizers, main courses, and desserts. Please let us know what you're looking for (e.g., vegetarian options, grilled dishes, seafood) and we'll be happy to help!",
    keywords: ["menu", "food", "dishes", "eat", "serve", "cuisine", "منيو", "قائمة", "طعام", "أكل", "أطباق", "عندكم", "ماذا", "اطباق", "وجبات", "مأكولات", "cooking", "kitchen", "مطبخ"],
  },
  {
    id: "faq_dietary",
    question: "Do you have vegetarian / vegan / gluten-free options?",
    answer:
      "Yes, we offer vegetarian and vegan options on our menu. For gluten-free and other dietary requirements, please let us know your specific needs and we'll confirm what's available. If you have severe allergies, please inform our staff when you arrive.",
    keywords: ["vegetarian", "vegan", "gluten", "dietary", "halal", "dairy", "allergy", "allergen", "nuts", "نباتي", "حلال", "خالي", "جلوتين", "حساسية", "تحسس", "diet", "حليب", "lactose", "مكسرات", "فول"],
  },
  {
    id: "faq_reservation",
    question: "How can I make a reservation / book a table?",
    answer:
      "To book a table, just tell me your full name, preferred day and time, and how many guests. For example: 'Ahmed, Sunday at 7 PM for 4 people'. I'll confirm your reservation right away!",
    keywords: ["book", "booking", "reserve", "reservation", "table", "حجز", "موعد", "احجز", "schedule", "جدولة", "name", "اسم", "day", "يوم", "time", "وقت", "guests", "people", "persons", "ضيوف", "أشخاص", "طاولة"],
  },
  {
    id: "faq_delivery",
    question: "Do you deliver? What are your delivery areas?",
    answer:
      "Yes, we offer delivery through our own service and partner apps. Please share your area or neighborhood and we'll confirm if we deliver to your location. Delivery hours are the same as our operating hours.",
    keywords: ["delivery", "deliver", "takeaway", "take out", "home", "توصيل", "ديليفري", "توصيل", "طلبات", "بيت", "منزل", "pickup", "استلام", "area", "منطقة"],
  },
  {
    id: "faq_catering",
    question: "Do you offer catering or private events?",
    answer:
      "Yes, we offer catering services and can host private events! Please tell us the type of event, number of guests, and preferred date, and we'll have our events team reach out with a custom proposal.",
    keywords: ["catering", "event", "party", "private", "large group", "celebration", "birthday", "حفلة", "مناسبة", "عيد ميلاد", "تجهيز", "حفلات", "مجموعة", "كبير", "corporate", "شركات"],
  },
  {
    id: "faq_contact",
    question: "How can I contact you?",
    answer:
      "You can reach us via WhatsApp here, call us at [Phone Number], or email us at [Email]. You can also find us on Instagram @[handle]. We respond within a few hours during business hours.",
    keywords: ["contact", "phone", "email", "reach", "help", "call", "اتصال", "دعم", "مساعدة", "بريد", "تواصل", "رقم", "هاتف", "جوال", "instagram", "انستقرام"],
  },
];

const baseSystemContext =
  "We are a restaurant serving delicious meals to our guests. We operate Sunday to Thursday, 12:00 PM to 11:00 PM, and Friday to Saturday, 1:00 PM to 11:30 PM. We offer dine-in, takeaway, and delivery services. We reply in the same language the customer uses. Our tone is warm, hospitable, and inviting. For allergen and dietary questions, we provide information but always remind guests to inform staff of severe allergies as cross-contamination is possible.";

function buildSystemContext(): string {
  const rules = loadPromptRules();
  if (rules) {
    return baseSystemContext + "\n\nADDITIONAL BEHAVIOUR RULES:\n" + rules;
  }
  return baseSystemContext;
}

export let memoryProfile: BusinessProfile = {
  name: "WhatsApp SmartSupport",
  industry: "Restaurant",
  replyTone: "hospitable",
  systemContext: buildSystemContext(),
  autoReplyEnabled: true,
  minConfidence: 0.7,
};

export let memoryWhatsAppConfig: WhatsAppConfig = {
  phoneNumberId: "1234567890123",
  businessAccountId: "9876543210987",
  accessToken: "EAAWf...",
  verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || "smartsupport_verify_secure_token",
};

export let memoryCannedResponses: CannedResponse[] = [
  {
    id: "canned_1",
    shortcut: "/welcome",
    text: "Welcome to [Restaurant Name]! How can we help you today? We'd love to take your reservation or answer any questions about our menu. 🍽️",
  },
  {
    id: "canned_2",
    shortcut: "/hours",
    text: "We are open Sunday to Thursday 12:00 PM to 11:00 PM, and Friday to Saturday 1:00 PM to 11:30 PM.",
  },
  {
    id: "canned_3",
    shortcut: "/followup",
    text: "A member of our team will follow up with you shortly. Thank you for reaching out — we look forward to serving you! 😊",
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
    lastMessageText: "Hi, I need to book an appointment for Thursday morning please.",
    lastMessageTime: Date.now() - 3600000 * 2,
    unreadCount: 1,
    autoReplyActive: true,
  },
  {
    id: "thread_customer_2",
    customerPhone: "+965 9988-7766",
    customerName: "Mohammed Al-Rashed",
    status: "open",
    lastMessageText: "What are your business hours?",
    lastMessageTime: Date.now() - 1800000 * 4,
    unreadCount: 0,
    autoReplyActive: true,
  },
  {
    id: "thread_customer_3",
    customerPhone: "+965 6677-8899",
    customerName: "Noor Al-Sabah",
    status: "resolved",
    lastMessageText: "Thank you! I'll come on Monday at 10 AM.",
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
    content: "Hi, I need to book an appointment for Thursday morning please.",
    timestamp: Date.now() - 3600000 * 2,
  },
  {
    id: "msg_2",
    threadId: "thread_customer_2",
    sender: "customer",
    content: "What are your business hours?",
    timestamp: Date.now() - 1800000 * 4 - 300000,
  },
  {
    id: "msg_3",
    threadId: "thread_customer_2",
    sender: "agent",
    content: "We are open Sunday to Thursday 12:00 PM to 11:00 PM, and Friday to Saturday 1:00 PM to 11:30 PM.",
    timestamp: Date.now() - 1800000 * 4,
    isAutoReplied: true,
    aiConfidence: 0.98,
    aiExplanation: "Matched FAQ for business hours.",
  },
  {
    id: "msg_4",
    threadId: "thread_customer_3",
    sender: "customer",
    content: "Are you open on weekends?",
    timestamp: Date.now() - 3600000 * 24 - 120000,
  },
  {
    id: "msg_5",
    threadId: "thread_customer_3",
    sender: "agent",
    content:
      "We are open Sunday to Thursday 12:00 PM to 11:00 PM, and Friday to Saturday 1:00 PM to 11:30 PM.",
    timestamp: Date.now() - 3600000 * 24 - 60000,
    isAutoReplied: true,
    aiConfidence: 0.99,
    aiExplanation: "Perfect match found in FAQ 'faq_hours'",
  },
  {
    id: "msg_6",
    threadId: "thread_customer_3",
    sender: "customer",
    content: "Thank you! I'll come on Sunday at 7 PM for dinner.",
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