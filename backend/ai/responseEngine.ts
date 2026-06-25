import { GoogleGenAI } from "@google/genai";
import { BusinessProfile, FAQItem, ChatMessage } from "../../src/types";
import { addAppointment, getLlmProvider } from "../db/memoryStore";
import { buildCustomerContext, buildContextPrompt } from "../db/sqliteStore";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
const LOG_DIR = path.join(__dirname, "..", "logs");
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
  "diagnose", "diagnosis", "sick", "disease", "I have", "suffering",
  "pain in my", "hurt", "hurts", "cavity", "decay", "gum", "nerve",
  "sensitivity", "sensitive", "should I", "do I need", "what is wrong",
  "why does", "cause", "causes", "normal", "infection", "infected",
  "prescribe", "prescription", "medicine", "medication", "antibiotic",
  "medical advice", "clinical advice", "tell me what to do",
];

const BOOKING_KEYWORDS_AR = [
  "حجز", "احجز", "موعد", "أريد", "ابي", "ابغى", "بغيت", "اريد",
  "بحجز", "عايز", "عايزة", "حابه", "حاب", "ودي",
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
      // Heuristic: hours 1-9 are AM unless otherwise stated (dental clinic context)
      return hour >= 10 ? `${hour}:00 AM` : `${hour}:00`;
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
        // HH:MM format – ignore minutes, return just the hour
        return `${m[1]}:00`;
      }
      return `${m[1]}:00`;
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
  // Arabic pattern: اسمي <name>  (ismi = my name is)
  const arabicNameMatch = text.match(/اسمي\s+([\u0600-\u06FF\s]{2,30})/);
  if (arabicNameMatch) {
    // Clean: remove trailing punctuation and extra spaces
    return arabicNameMatch[1].replace(/[،,\.]/g, "").trim();
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
  // ALWAYS pass to LLM: detect language and translate to English
  const { originalLanguage, englishText } = await llmTranslateToEnglish(customerMessage);
  const isNonEnglish = originalLanguage !== "en";

  const cleaned = englishText.toLowerCase();

  // Build customer context if phone is provided
  let customerContextStr = "";
  if (customerPhone) {
    try {
      const context = buildCustomerContext(customerPhone);
      if (context) {
        customerContextStr = buildContextPrompt(context);
      }
    } catch (e) {
      console.warn("Failed to build customer context:", e);
    }
  }

  // === CHECK: Emergency ===
  const emergencyHit = isNonEnglish
    ? containsAny(cleaned, EMERGENCY_KEYWORDS_AR)
    : containsAny(cleaned, EMERGENCY_KEYWORDS_EN) || containsAny(cleaned, EMERGENCY_KEYWORDS_AR);

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

  // === CHECK: Medical Advice Request ===
  const medicalHit = isNonEnglish
    ? containsAny(cleaned, MEDICAL_KEYWORDS_AR)
    : containsAny(cleaned, MEDICAL_KEYWORDS_EN) || containsAny(cleaned, MEDICAL_KEYWORDS_AR);

  if (medicalHit) {
    const englishReply = "Thank you for reaching out! Unfortunately, I can't provide medical or clinical advice over WhatsApp — that requires an in-person examination by the dentist. I'd recommend booking a check-up (15 KWD) so the dentist can examine you properly and give you the right diagnosis and treatment plan. Would you like me to book an appointment? Just tell me your name and preferred day/time!";
    const replyText = isNonEnglish
      ? await translateToLanguage(englishReply, originalLanguage)
      : englishReply;
    return {
      replyText,
      confidence: 0.95,
      explanation: "Medical/clinical advice request detected. Politely refused; directed to book an in-person checkup.",
      isAutoRepliable: true,
      isMedicalAdvice: true,
    };
  }

  // === CHECK: Booking Intent ===
  const bookingHit = isNonEnglish
    ? containsAny(cleaned, BOOKING_KEYWORDS_AR)
    : containsAny(cleaned, BOOKING_KEYWORDS_EN) || containsAny(cleaned, BOOKING_KEYWORDS_AR);

  if (bookingHit) {
    const detectedDay = detectDay(englishText);
    const detectedTime = detectTime(englishText);
    const detectedName = extractName(englishText);

    if (detectedName && detectedDay && detectedTime) {
      if (detectedDay === "Friday") {
        const englishReply = "Sorry, we're closed on Fridays. Would you like to book another day? We're available Saturday to Thursday, 9 AM to 9 PM.";
        const replyText = isNonEnglish
          ? await translateToLanguage(englishReply, originalLanguage)
          : englishReply;
        return {
          replyText,
          confidence: 1.0,
          explanation: "Booking attempted for Friday (clinic closed). Redirecting to choose another day.",
          isAutoRepliable: true,
          isBooking: true,
          bookingName: detectedName,
          bookingDay: detectedDay,
          bookingTime: detectedTime,
        };
      }
      const phone = chatHistory.length > 0 ? "from-chat" : "unknown";
      addAppointment(detectedName, phone, detectedDay, detectedTime);
      const englishReply = `Your appointment is confirmed! ✅\n\nName: ${detectedName}\nDay: ${detectedDay}\nTime: ${detectedTime}\nCheck-up: 15 KWD\nBright Smile Dental Clinic - Salmiya\n\nSee you soon!`;
      const replyText = isNonEnglish
        ? await translateToLanguage(
            `Your appointment is confirmed! Name: ${detectedName} Day: ${detectedDay} Time: ${detectedTime} Check-up: 15 KWD Location: Bright Smile Dental Clinic - Salmiya, Kuwait`,
            originalLanguage
          )
        : englishReply;
      return {
        replyText,
        confidence: 0.99,
        explanation: `Booking confirmed for ${detectedName} on ${detectedDay} at ${detectedTime}.`,
        isAutoRepliable: true,
        isBooking: true,
        bookingName: detectedName,
        bookingDay: detectedDay,
        bookingTime: detectedTime,
      };
    }

    const missing: string[] = [];
    if (!detectedName) missing.push("your full name");
    if (!detectedDay) missing.push("your preferred day");
    if (!detectedTime) missing.push("your preferred time");

    const englishReply = `I'd love to book that for you! 😊\n\nI just need a few details:\n${missing.map((m, i) => `${i + 1}. ${m}`).join("\n")}\n\nExample: "Ahmed, Sunday at 3 PM"\n\nThe clinic is available Saturday to Thursday, 9 AM - 9 PM.`;
    const replyText = isNonEnglish
      ? await translateToLanguage(
          `I'd love to book that for you! I just need a few details: ${missing.join(", ")}. Example: "Ahmed, Sunday at 3 PM". The clinic is available Saturday to Thursday, 9 AM - 9 PM.`,
          originalLanguage
        )
      : englishReply;
    return {
      replyText,
      confidence: 0.9,
      explanation: `Booking intent detected but missing: ${missing.join(", ")}.`,
      isAutoRepliable: true,
      isBooking: true,
      bookingName: detectedName || undefined,
      bookingDay: detectedDay || undefined,
      bookingTime: detectedTime || undefined,
    };
  }

  // === LLM Path: FAQ matching and general queries ===
  const conversationContext = chatHistory
    .slice(-6)
    .map((m) => `${m.sender === "customer" ? "Customer" : "Agent"}: "${m.content}"`)
    .join("\n");

  const faqsText = faqs
    .map((f, i) => `${i + 1}. [FAQ ID: ${f.id}] Query: "${f.question}" -> Answer: "${f.answer}"`)
    .join("\n");

  // Always use English for the LLM prompt
  let prompt = `You are a warm, professional AI customer support agent for "${profile.name}", a dental clinic in Salmiya, Kuwait.
Tone: ${profile.replyTone}.
Context: "${profile.systemContext}"

`;

  if (customerContextStr) {
    prompt += `\n${customerContextStr}\n`;
  }

  prompt += `FAQs:
${faqsText}

Conversation:
${conversationContext}

Customer message: "${englishText}"

Respond ONLY with a JSON object (no markdown fences):
{
  "replyText": "your response in English",
  "confidence": 0.85,
  "explanation": "Brief reason",
  "matchedFaqId": null,
  "isAutoRepliable": true,
  "isEmergency": false,
  "isMedicalAdvice": false,
  "isBooking": false
}`;

  const provider = getLlmProvider();

  // Try DeepSeek if selected
  if (provider === "deepseek" && deepseekKey) {
    console.log("Using DeepSeek for AI response.");
    const result = await callDeepSeek(prompt);
    if (result) {
      if (isNonEnglish) result.replyText = await translateToLanguage(result.replyText, originalLanguage);
      return result;
    }
    console.log("DeepSeek failed, falling back.");
  }

  // Try Gemini
  if ((provider === "gemini" || provider === "deepseek") && gemini) {
    console.log("Using Gemini for AI response.");
    try {
      const response = await generateGeminiContent({
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      const text = response.text?.trim() || "";
      console.log("Gemini response:", text);
      const result = JSON.parse(text) as AIDraftOutput;
      if (isNonEnglish) result.replyText = await translateToLanguage(result.replyText, originalLanguage);
      return result;
    } catch (err) {
      console.error("Gemini generation failed:", err);
    }
  }

  // === Fallback: Rule-Based Engine ===
  console.log("Using rule-based simulation.");
  const result = ruleBasedReply(englishText, profile, faqs);
  if (isNonEnglish) result.replyText = await translateToLanguage(result.replyText, originalLanguage);
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
