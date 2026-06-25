import { GoogleGenAI } from "@google/genai";
import { BusinessProfile, FAQItem, ChatMessage } from "../../src/types";
import { getLlmProvider } from "../db/memoryStore";
import { buildCustomerContext, buildContextPrompt, sqliteAddAppointment, sqliteGetAppointmentsByPhoneDay, sqliteGetAllAppointmentsByPhone, sqliteGetAllAppointmentsByPhoneAll, sqliteCancelAppointment } from "../db/sqliteStore";
import { normalizePhone } from "../utils/phone";
import * as fs from "fs";
import * as path from "path";
const DOCS_DIR = path.join(process.cwd(), "docs");

function loadDoc(filename: string): string {
  try {
    return fs.readFileSync(path.join(DOCS_DIR, filename), "utf-8").trim();
  } catch (e) {
    console.warn(`Failed to load doc: ${filename}`, e);
    return "";
  }
}

// -------------------------------------------------------------
// Initialize AI APIs
// -------------------------------------------------------------
let gemini: GoogleGenAI | null = null;
let deepseekKey: string | null = null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const GEMINI_MODEL_FALLBACKS = Array.from(new Set([GEMINI_MODEL, "gemini-flash-latest", "gemini-1.5-flash"]));

if (process.env.GEMINI_API_KEY) {
  try {
    gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log("Gemini API initialized.");
  } catch (err) {
    console.error("Failed to initialize Gemini:", err);
  }
}
if (process.env.DEEPSEEK_API_KEY) {
  deepseekKey = process.env.DEEPSEEK_API_KEY;
  console.log("DeepSeek API key loaded.");
}
if (!gemini && !deepseekKey) {
  console.warn("No LLM API keys. Using rule-based simulation.");
}

function isMissingGeminiModelError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("NOT_FOUND") || message.includes("is not found");
}

async function generateGeminiContent(
  request: Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">
) {
  if (!gemini) throw new Error("Gemini is not initialized.");

  let lastError: unknown;
  for (const model of GEMINI_MODEL_FALLBACKS) {
    try {
      return await gemini.models.generateContent({
        model,
        ...request,
      });
    } catch (err) {
      lastError = err;
      if (!isMissingGeminiModelError(err)) {
        throw err;
      }
      console.warn(`Gemini model "${model}" is unavailable. Trying next configured fallback.`);
    }
  }

  throw lastError;
}

// -------------------------------------------------------------
// Log File Helpers
// -------------------------------------------------------------
const LOG_DIR = path.join(process.cwd(), "logs");
const TRANSLATION_LOG = path.join(LOG_DIR, "translation-log.txt");

export function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function appendLog(entry: string): void {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  fs.appendFileSync(TRANSLATION_LOG, `[${timestamp}] ${entry}\n`, "utf-8");
}

// -------------------------------------------------------------
// AI Response Output Interface
// -------------------------------------------------------------
export interface AIDraftOutput {
  replyText: string;
  confidence: number;
  explanation: string;
  matchedFaqId?: string;
  isAutoRepliable: boolean;
  isEmergency?: boolean;
  isMedicalAdvice?: boolean;
  isBooking?: boolean;
  bookingName?: string;
  bookingDay?: string;
  bookingTime?: string;
  isCancel?: boolean;
  cancelAppointmentIndex?: number;
}

// -------------------------------------------------------------
// Keyword Arrays (Arabic keywords kept for detection, not user-visible)
// -------------------------------------------------------------
const EMERGENCY_KEYWORDS_AR = [
  "نزيف", "دم", "ينزف", "ورم", "متورم", "منتفخ", "وجع شديد", "ألم شديد",
  "الم شديد", "وجع قوي", "الم قوي", "طوارئ", "طارئ", "حادث", "كسر",
  "خدر", "تنميل", "ما بقدر أتحمل", "ما بقدر اتحمل", "فقدان وعي", "إغماء",
];
const EMERGENCY_KEYWORDS_EN = [
  "bleeding", "blood", "swollen", "swelling", "severe pain", "extreme pain",
  "unbearable pain", "emergency", "accident", "broke my tooth", "knocked out",
  "numb", "numbness", "can't take", "cant take", "worst pain", "trauma",
  "urgent", "immediately", "right now", "hospital", "fainted", "passed out",
  "abscess", "infection", "puss", "pus",
];

const MEDICAL_KEYWORDS_AR = [
  "نصيحة طبية", "تشخيص", "شخص", "مرض", "عندي", "يصير", "أعاني",
  "ألم في", "وجع في", "تسوس", "خراج", "لثتي", "لثة", "عصب", "حساسية",
  "دوخة", "صداع", "هل لازم", "تحتاج", "أحتاج", "متى", "ليش", "اسباب",
  "أسباب", "هل", "طبيعي", "عدوى",
];
const MEDICAL_KEYWORDS_EN = [
  "diagnose", "diagnosis", "sick", "disease", "i have a tooth", "i have pain",
  "suffering", "pain in my", "hurt", "hurts", "cavity", "decay", "gum", "nerve",
  "sensitivity", "sensitive", "should I", "do I need", "what is wrong",
  "why does", "cause", "causes", "normal", "infection", "infected",
  "prescribe", "prescription", "medicine", "medication", "antibiotic",
  "medical advice", "clinical advice", "tell me what to do",
];

const BOOKING_KEYWORDS_AR = [
  "حجز", "احجز", "موعد", "أريد", "ابي", "ابغى", "بغيت", "اريد",
  "بحجز", "عايز", "عايزة", "حابه", "حاب", "ودي", "بدي", "عاوز",
  "نبغى", "نبي", "بغى", "ابا", "أبا", "أبغى", "احتاج", "محتاج",
  "محتاجة", "بحتاج", "حاجز", "حاجزة", "باحجز", "هحجز",
];
const BOOKING_KEYWORDS_EN = [
  "book", "appointment", "schedule", "reserve", "I want", "I'd like",
  "I would like", "can I come", "make an appointment", "set up", "need to see",
  "see the dentist", "see a dentist", "visit",
];

const DAYS_MAP: Record<string, string> = {
  "saturday": "Saturday", "السبت": "Saturday",
  "sunday": "Sunday", "الأحد": "Sunday",
  "monday": "Monday", "الاثنين": "Monday", "الإثنين": "Monday",
  "tuesday": "Tuesday", "الثلاثاء": "Tuesday",
  "wednesday": "Wednesday", "الأربعاء": "Wednesday",
  "thursday": "Thursday", "الخميس": "Thursday",
  "friday": "Friday", "الجمعة": "Friday",
};

// -------------------------------------------------------------
// Helper Functions
// -------------------------------------------------------------
export function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

export function detectDay(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [key, day] of Object.entries(DAYS_MAP)) {
    if (lower.includes(key)) return day;
  }
  return null;
}

export function detectTime(text: string): string | null {
  const lower = text.toLowerCase();

  // --- Arabic word-to-digit mapping (e.g. العاشرة → 10, الساعة الثالثة → 3) ---
  const arabicNumberWords: Record<string, number> = {
    "الواحدة": 1, "الأولى": 1,
    "الثانية": 2,
    "الثالثة": 3,
    "الرابعة": 4,
    "الخامسة": 5,
    "السادسة": 6,
    "السابعة": 7,
    "الثامنة": 8,
    "التاسعة": 9,
    "العاشرة": 10,
    "الحادية عشرة": 11, "الحادية عشر": 11,
    "الثانية عشرة": 12, "الثانية عشر": 12,
  };

  // Sort by word length descending so "الثانية عشرة" matches before "الثانية"
  const sortedArabicWords = Object.entries(arabicNumberWords).sort(
    (a, b) => b[0].length - a[0].length
  );

  // Check for Arabic word hours: "الساعة العاشرة صباحاً" or just "العاشرة صباحاً"
  for (const [word, hour] of sortedArabicWords) {
    // Match "الساعة <word>" or standalone "<word>"
    const arabicWordPattern = new RegExp(`(?:الساعة\\s*)?${word}`);
    const wordMatch = lower.match(arabicWordPattern);
    if (wordMatch) {
      // Check for AM/PM suffix
      if (/صباح|الصبح/.test(lower)) return `${hour}:00 AM`;
      if (/مساء|العصر|الظهر/.test(lower)) return `${hour}:00 PM`;
      // Default: if صباحاً present, AM; if nothing, use context
      if (lower.includes("صباحاً") || lower.includes("صباحا") || lower.includes("صباح")) return `${hour}:00 AM`;
      // Heuristic based on clinic hours (9 AM - 9 PM)
      if (hour >= 9 && hour <= 11) return `${hour}:00 AM`;
      return `${hour}:00 PM`;
    }
  }

  // --- Numeric time patterns ---
  const timePatterns = [
    /(\d{1,2}):(\d{2})/,
    /(\d{1,2})\s*(am|pm|صباحاً|صباحا|صباح|مساءً|مساءا|مساء|العصر|ظهر|الظهر|الصبح)/i,
    /الساعة\s*(\d{1,2})/,
    /at\s*(\d{1,2})/i,
  ];
  for (const pat of timePatterns) {
    const m = lower.match(pat);
    if (m) {
      if (m[2]) {
        const suffix = m[2].toLowerCase();
        // Only treat m[2] as a time suffix if it matches known AM/PM indicators;
        // otherwise it's part of HH:MM (e.g. "10:30" — m[2] is "30")
        if (/^(am|pm|صباحاً|صباحا|صباح|مساءً|مساءا|مساء|العصر|ظهر|الظهر|الصبح)$/i.test(m[2])) {
          if (suffix === "am" || suffix.includes("صباح") || suffix.includes("الصبح")) return `${m[1]}:00 AM`;
          if (suffix === "pm" || suffix.includes("مساء") || suffix.includes("العصر") || suffix.includes("الظهر")) return `${m[1]}:00 PM`;
          return `${m[1]}:00 ${m[2].toUpperCase()}`;
        }
        // HH:MM format – ignore minutes, default AM/PM based on clinic hours
        const hh = parseInt(m[1], 10);
        if (hh >= 9 && hh <= 11) return `${hh}:00 AM`;
        return `${hh}:00 PM`;
      }
      const h = parseInt(m[1], 10);
      if (h >= 9 && h <= 11) return `${h}:00 AM`;
      return `${h}:00 PM`;
    }
  }
  const spacedMatch = lower.match(/(\d{1,2})\s+(am|pm|صباح|مساء|العصر|ظهر|الظهر|الصبح)/i);
  if (spacedMatch) {
    const suffix = spacedMatch[2].toLowerCase();
    if (["am", "صباح", "الصبح"].some(s => suffix.includes(s))) return `${spacedMatch[1]}:00 AM`;
    return `${spacedMatch[1]}:00 PM`;
  }
  return null;
}

export function extractName(text: string): string | null {
  const lower = text.toLowerCase();
  // English patterns
  const patternsEng = [/my name is\s+([a-z\s]{2,30})/i, /i'm\s+([a-z\s]{2,30})/i, /i am\s+([a-z\s]{2,30})/i, /this is\s+([a-z\s]{2,30})/i];
  for (const pat of patternsEng) {
    const m = lower.match(pat);
    if (m) return m[1].trim();
  }
  // Arabic patterns
  const arabicPatterns = [
    /اسمي\s+([\u0600-\u06FF\s]{2,30})/,
    /أنا\s+([\u0600-\u06FF\s]{2,30})/,
    /انا\s+([\u0600-\u06FF\s]{2,30})/,
    /معاك\s+([\u0600-\u06FF\s]{2,30})/,
    /معكم\s+([\u0600-\u06FF\s]{2,30})/,
  ];
  for (const pat of arabicPatterns) {
    const m = text.match(pat);
    if (m) {
      return m[1].replace(/[،,\.]/g, "").trim();
    }
  }
  return null;
}

// -------------------------------------------------------------
// LLM: Convert any language input to English
// ALL messages pass through here — no heuristic detection
// -------------------------------------------------------------
export async function llmTranslateToEnglish(message: string): Promise<{ originalLanguage: string; englishText: string }> {
  const prompt = `You are a language detector and translator.
Given the following message, detect what language it is in and translate it to English.
If it is ALREADY English, just return it unchanged.

Return ONLY a JSON object (no markdown fences, no extra text):
{
  "originalLanguage": "en" | "ar" | "fr" | "hi" | "ur" | ... (ISO 639-1 code),
  "englishText": "<the message in English>"
}

Message: "${message}"`;

  // Try Gemini
  if (gemini) {
    try {
      const response = await generateGeminiContent({
        contents: prompt,
      });
      const raw = response.text?.trim() || "";
      const result = JSON.parse(raw);
      appendLog(`[LLM TRANSLATE] Original (${result.originalLanguage}): "${message}" | English: "${result.englishText}"`);
      return result;
    } catch (err) {
      console.warn("Gemini translate-to-English failed:", err);
    }
  }

  // Try DeepSeek
  if (deepseekKey) {
    try {
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${deepseekKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 500,
          temperature: 0.3,
        }),
      });
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content?.trim() || "";
      const result = JSON.parse(raw);
      appendLog(`[LLM TRANSLATE] Original (${result.originalLanguage}): "${message}" | English: "${result.englishText}"`);
      return result;
    } catch (err) {
      console.warn("DeepSeek translate-to-English failed:", err);
    }
  }

  // Fallback: assume English
  console.log("[LLM TRANSLATE] No LLM available. Assuming English.");
  return { originalLanguage: "en", englishText: message };
}

// -------------------------------------------------------------
// Translation to target language via LLM
// -------------------------------------------------------------
export async function translateToLanguage(text: string, targetLang: string): Promise<string> {
  if (targetLang === "en") return text;

  const prompt = `Translate the following text to ${targetLang}. Return ONLY the translated text, nothing else:\n\n${text}`;

  // Try Gemini
  if (gemini) {
    try {
      const response = await generateGeminiContent({
        contents: prompt,
      });
      const translated = response.text?.trim() || "";
      if (translated && translated.length > 5) {
        appendLog(`[TRANSLATION] LLM: Gemini | English: "${text}" | Translated (${targetLang}): "${translated}"`);
        return translated;
      }
    } catch (err) {
      console.warn("Gemini translation failed:", err);
    }
  }

  // Try DeepSeek
  if (deepseekKey) {
    try {
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${deepseekKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
          temperature: 0.3,
        }),
      });
      const data = await res.json();
      const translated = data.choices?.[0]?.message?.content?.trim() || "";
      if (translated && translated.length > 5) {
        appendLog(`[TRANSLATION] LLM: DeepSeek | English: "${text}" | Translated (${targetLang}): "${translated}"`);
        return translated;
      }
    } catch (err) {
      console.warn("DeepSeek translation failed:", err);
    }
  }

  // Fallback: return English text
  appendLog(`[TRANSLATION] LLM: NONE | English: "${text}" | Translation unavailable, returning English.`);
  return text;
}

// -------------------------------------------------------------
// DeepSeek API call for general LLM queries
// -------------------------------------------------------------
async function callDeepSeek(prompt: string): Promise<AIDraftOutput | null> {
  if (!deepseekKey) return null;
  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${deepseekKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0.3,
      }),
    });
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    console.log("DeepSeek API response:", text);
    return JSON.parse(text) as AIDraftOutput;
  } catch (err) {
    console.error("DeepSeek API call failed:", err);
    return null;
  }
}

// -------------------------------------------------------------
// Main AI Response Engine
// -------------------------------------------------------------
export async function generateAIResponseForMessage(
  customerMessage: string,
  chatHistory: ChatMessage[],
  profile: BusinessProfile,
  faqs: FAQItem[],
  customerPhone?: string
): Promise<AIDraftOutput> {
  const { originalLanguage, englishText } = await llmTranslateToEnglish(customerMessage);
  const isNonEnglish = originalLanguage !== "en";

  const cleaned = englishText.toLowerCase();

  // Build customer context if phone is provided
  let customerContextStr = "";
  let appointmentsStr = "";
  if (customerPhone) {
    try {
      const context = buildCustomerContext(customerPhone);
      if (context) {
        customerContextStr = buildContextPrompt(context);
      }
    } catch (e) {
      console.warn("Failed to build customer context:", e);
    }
    const phone = normalizePhone(customerPhone);
    const appts = sqliteGetAllAppointmentsByPhoneAll(phone);
    if (appts.length > 0) {
      appointmentsStr = appts.map((a, i) => `[${i + 1}] ${a.preferredDay} at ${a.preferredTime} — ${a.serviceType} (${a.status})`).join("\n");
    }
  }

  // === Emergency check (safety critical — bypasses LLM) ===
  const emergencyHit = containsAny(cleaned, EMERGENCY_KEYWORDS_EN)
    || containsAny(customerMessage, EMERGENCY_KEYWORDS_AR);

  if (emergencyHit) {
    const englishReply = "This sounds like a dental emergency requiring immediate care. Please go to the nearest hospital emergency room right now. We have flagged your case for the dentist to follow up with you. Your safety matters.";
    const replyText = isNonEnglish
      ? await translateToLanguage(englishReply, originalLanguage)
      : englishReply;
    return {
      replyText,
      confidence: 1.0,
      explanation: "Dental emergency keywords detected. Escalating to human and directing to emergency care.",
      isAutoRepliable: true,
      isEmergency: true,
    };
  }

  // === LLM Path: Intent understanding + response ===
  const conversationContext = chatHistory
    .slice(-6)
    .map((m) => `${m.sender === "customer" ? "Customer" : "Agent"}: "${m.content}"`)
    .join("\n");

  const faqsText = faqs
    .map((f, i) => `${i + 1}. [FAQ ID: ${f.id}] Query: "${f.question}" -> Answer: "${f.answer}"`)
    .join("\n");

  let prompt = `You are a warm, professional AI customer support agent for "${profile.name}", a dental clinic in Salmiya, Kuwait.
Tone: ${profile.replyTone}.
Context: "${profile.systemContext}"

CRITICAL RULES:
1. NEVER give medical or clinical advice, diagnoses, or treatment recommendations. If a patient asks about symptoms, pain, medicine, or conditions, politely refuse and suggest they see the dentist in person.
2. If a patient confirms a booking with name, day, and time, respond with isBooking: true and include the bookingName, bookingDay, bookingTime.
3. If a patient asks to CANCEL an appointment, identify which one by index (the [N] numbers above) and set isCancel: true with cancelAppointmentIndex set to that number.
4. If a patient asks to RESCHEDULE, first cancel the old one (isCancel: true) and then create a new one (isBooking: true) — explain both steps in replyText.
5. If a patient asks about their appointments, list them from the "PATIENT APPOINTMENTS" section.
6. Before confirming a booking, check the PATIENT APPOINTMENTS list for duplicates on the same day that are still "confirmed". Ignore "cancelled" ones — they are no longer active. Warn only if a confirmed one exists.
7. Reject bookings for Friday (clinic closed).
8. If the message is unrelated to dental care, politely explain your scope.
9. Reply in the same language the patient used. Be warm, professional, and concise.
10. If you need more information to help, ask a clarifying question.
11. For bookings, infer the serviceType from the conversation (e.g., "Check-up", "Cleaning", "Whitening", "Filling"). Default to "Check-up".

CLINIC INFO:
- Location: Salem Al-Mubarak Street, Block 5, Salmiya, Kuwait (near Al-Fanar Mall)
- Hours: Saturday to Thursday, 9:00 AM to 9:00 PM. Closed Fridays.
- Services: Check-up 15 KWD, Cleaning 25 KWD, Whitening 80 KWD, Filling from 30 KWD

`;

  if (appointmentsStr) {
    prompt += `PATIENT APPOINTMENTS (already booked):\n${appointmentsStr}\n\n`;
  }

  if (customerContextStr) {
    prompt += `${customerContextStr}\n`;
  }

  prompt += `FAQs:
${faqsText}

CONVERSATION:
${conversationContext}

CUSTOMER MESSAGE: "${englishText}"

Respond ONLY with a valid JSON object (no markdown, no backticks):
{
  "replyText": "your full response in English",
  "confidence": 0.85,
  "explanation": "why you chose this response",
  "matchedFaqId": null,
  "isAutoRepliable": true,
  "isEmergency": false,
  "isMedicalAdvice": false,
  "isBooking": false,
  "bookingName": null,
  "bookingDay": null,
  "bookingTime": null,
  "isCancel": false,
  "cancelAppointmentIndex": null
}`;

  const provider = getLlmProvider();
  let result: AIDraftOutput | null = null;

  if (provider === "deepseek" && deepseekKey) {
    result = await callDeepSeek(prompt);
  }

  if (!result && gemini) {
    console.log("Using Gemini for AI response.");
    try {
      const response = await generateGeminiContent({
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      const text = response.text?.trim() || "";
      result = JSON.parse(text) as AIDraftOutput;
    } catch (err) {
      console.error("Gemini generation failed:", err);
    }
  }

  if (!result) {
    console.log("Falling back to DeepSeek after Gemini failure.");
    result = await callDeepSeek(prompt);
  }

  if (!result) {
    console.log("No LLM available. Using rule-based fallback.");
    const fallback = ruleBasedReply(englishText, profile, faqs);
    if (isNonEnglish) fallback.replyText = await translateToLanguage(fallback.replyText, originalLanguage);
    return fallback;
  }

  // Handle cancel if LLM detected one
  if (result.isCancel && result.cancelAppointmentIndex != null) {
    const phone = normalizePhone(customerPhone || "");
    const allAppts = sqliteGetAllAppointmentsByPhone(phone);
    if (allAppts[result.cancelAppointmentIndex - 1]) {
      const target = allAppts[result.cancelAppointmentIndex - 1];
      sqliteCancelAppointment(target.id);
      result.explanation += ` [CANCELLED: ${target.preferredDay} at ${target.preferredTime}]`;
    }
  }

  // Handle booking if LLM detected one
  if (result.isBooking && result.bookingName && result.bookingDay && result.bookingTime) {
    const phone = normalizePhone(customerPhone || "");
    if (result.bookingDay.toLowerCase() !== "friday") {
      const existingAppts = phone.length > 0
        ? sqliteGetAppointmentsByPhoneDay(phone, result.bookingDay)
        : [];
      if (existingAppts.length === 0) {
        sqliteAddAppointment(result.bookingName, phone, result.bookingDay, result.bookingTime);
        result.explanation += " [SAVED to DB]";
      }
    }
  }

  if (isNonEnglish) {
    result.replyText = await translateToLanguage(result.replyText, originalLanguage);
  }

  return result;
}

// -------------------------------------------------------------
// Rule-Based Fallback Engine (English only)
// -------------------------------------------------------------
export function ruleBasedReply(
  customerMessage: string,
  profile: BusinessProfile,
  faqs: FAQItem[]
): AIDraftOutput {
  const cleaned = customerMessage.toLowerCase();
  let bestMatch: FAQItem | null = null;
  let maxScore = 0;

  for (const faq of faqs) {
    let score = 0;
    faq.keywords.forEach((kw) => {
      if (cleaned.includes(kw.toLowerCase())) score += 1;
    });
    if (cleaned.includes(faq.question.toLowerCase()) || faq.question.toLowerCase().includes(cleaned)) score += 3;
    if (score > maxScore) { maxScore = score; bestMatch = faq; }
  }

  const confidence = bestMatch ? Math.min(0.6 + maxScore * 0.1, 0.98) : 0.4;
  const isAutoRepliable = confidence >= profile.minConfidence && bestMatch !== null;

  const replyText = bestMatch
    ? `Hello! ${bestMatch.answer}`
    : `Thank you for contacting ${profile.name}! One of our team members will get back to you shortly. If you'd like to book an appointment, just tell me your name and preferred day/time!`;

  return {
    replyText,
    confidence,
    explanation: bestMatch
      ? `Rule Match: "${bestMatch.question}" (Score: ${maxScore}).`
      : "No matching FAQ keywords found. General fallback response.",
    matchedFaqId: bestMatch?.id || undefined,
    isAutoRepliable,
  };
}
