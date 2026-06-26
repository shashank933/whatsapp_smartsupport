import { AIDraftOutput } from "./responseEngine";

export interface GuardrailResult {
  blocked: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// 1. Prompt Injection Detection
//    Catches attempts to override system instructions
// ---------------------------------------------------------------------------
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior|your)\s+(instructions?|rules?|prompts?|guidelines?)/i,
  /you\s+are\s+now\s+(a\s+|an\s+)?/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /act\s+as\s+(a\s+|an\s+)/i,
  /new\s+(system\s+)?(instructions?|rules?|prompts?)\s*(:|\n)/i,
  /override\s+(your\s+)?(instructions?|rules?|prompts?)/i,
  /forget\s+(all\s+)?(previous|earlier|your)\s+(instructions?|rules?|conversation)/i,
  /system\s*(prompt|message|instruction)\s*(:|=)/i,
  /you\s+must\s+(not|never)\s+follow/i,
  /disregard\s+(all\s+)?(previous|above|prior|earlier)/i,
];

export function detectPromptInjection(text: string): GuardrailResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "Prompt injection attempt detected." };
    }
  }
  return { blocked: false };
}

// ---------------------------------------------------------------------------
// 2. Abuse / Threat Detection
//    Basic keyword list — block clear abuse only
// ---------------------------------------------------------------------------
const ABUSE_KEYWORDS = [
  "kill you",
  "kill yourself",
  "i will kill",
  "bomb",
  "terrorist",
  "i will hurt",
  "i will find you",
  "shut the f",
  "motherf",
  "piece of s",
];

const ABUSE_ARABIC_KEYWORDS = [
  "سوف أقتل",
  "راح أقتل",
  "سوف أذبح",
  "راح أذبح",
  "سوف أفجر",
  "راح أفجر",
  "إرهابي",
  "كس أم",
  "أمك",
  "انقلع",
  "اخرس",
];

export function detectAbuse(text: string): GuardrailResult {
  const lower = text.toLowerCase();
  for (const kw of ABUSE_KEYWORDS) {
    if (lower.includes(kw)) {
      return { blocked: true, reason: "Abusive or threatening content detected." };
    }
  }
  for (const kw of ABUSE_ARABIC_KEYWORDS) {
    if (text.includes(kw)) {
      return { blocked: true, reason: "Abusive or threatening content detected." };
    }
  }
  return { blocked: false };
}

// ---------------------------------------------------------------------------
// 3. Off-Topic Detection
//     Blocks messages completely unrelated to dental care
// ---------------------------------------------------------------------------
const ON_TOPIC_PATTERNS = [
  /tooth|teeth|dental|dentist|gum|oral|mouth|cavity/i,

  /تبييض|تنظيف|حشو|خلع|تقويم|لثة|فم|مينا|جسر|طقم/i,

  /appointment|book|schedule|reserve|visit|check.?up/i,
  /موعد|حجز|زيارة|كشف|فحص|احجز|حاجز/i,

  /price|cost|fee|how much|expensive|cheap|ريال|دينار|كم سعر|كم تكلف/i,

  /hour|open|close|location|address|where|time|day/i,
  /ساعة|مفتوح|مغلق|عنوان|موقع|وين|متى|ايام|يوم/i,

  /pain|hurt|bleeding|swollen|ache|sore/i,
  /ألم|وجع|نزيف|ورم|منتفخ|يكسر/i,

  /hi|hello|hey|good morning|good evening|greetings/i,
  /مرحبا|السلام|اهلا|هلا|صباح الخير|مساء الخير/i,

  /cancel|reschedule|change|confirm/i,
  /الغي|إلغاء|تغيير|تأكيد|تاكيد/i,
];

export function detectOffTopic(text: string): GuardrailResult {
  for (const pattern of ON_TOPIC_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: false };
    }
  }
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length < 5) {
    return { blocked: false };
  }
  return { blocked: true, reason: "Message appears unrelated to dental care." };
}

// ---------------------------------------------------------------------------
// 4. PII Detection (flag only, don't block — log a warning)
// ---------------------------------------------------------------------------
const PII_PATTERNS = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b\d{12}\b/,
];

export function detectPII(text: string): boolean {
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 5. Medical Advice Re-Check (output guard)
//     Re-verifies the LLM response for leaked medical advice
// ---------------------------------------------------------------------------
const MEDICAL_ADVICE_PATTERNS = [
  /you\s+(should|must|need to|have to)\s+(take|apply|use|try|eat|drink)/i,
  /(take|apply|use|try)\s+(this|the|a|an|some)\s+(medicine|medication|pill|tablet|antibiotic|cream|gel|drops|oil)/i,
  /(this|that|it)\s+(is|could be|might be|sounds like)\s+(a|an)?\s*(infection|cavity|abscess|disease|condition|syndrome|injury|fracture|tumor|cancer)/i,
  /you\s+(likely|probably|definitely|most likely)\s+(have|are suffering from|are experiencing)/i,
  /I\s+(recommend|prescribe|suggest)\s+(you\s+)?(take|get|buy|use|try|apply)/i,
  /that\s+(needs|requires|demands)\s+(surgery|operation|extraction|treatment|medication|antibiotics|a root canal)/i,
];

const MEDICAL_ADVICE_PATTERNS_AR = [
  /أنت\s+(تحتاج|يجب|لازم|محتاج|بحاجة)\s+(إلى|ل|ان|أن)\s+(تأخذ|تستخدم|تشتري|تجرب|تطبق|تدهن)/i,
  /(خذ|استخدم|جرب|اشتري|ادهن)\s+(هذا|هذه|الدواء|العلاج|المضاد|الكريم|الجل|القطرة|الحبة|الحبوب)/i,
  /هذا\s+(التهاب|تسوس|خراج|مرض|ورم|كسر|عدوى|إصابة|سرطان)/i,
  /أنصحك\s+(ب|أن|بأن)/i,
  /تحتاج\s+(عملية|جراحة|خلع|علاج|مضاد|مضادات)/i,
];

export function detectMedicalAdviceInOutput(text: string): GuardrailResult {
  for (const pattern of MEDICAL_ADVICE_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "LLM generated potential medical advice; output blocked." };
    }
  }
  for (const pattern of MEDICAL_ADVICE_PATTERNS_AR) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "LLM generated potential medical advice; output blocked." };
    }
  }
  return { blocked: false };
}

// ---------------------------------------------------------------------------
// 6. Confidence Threshold Enforcement (output guard)
// ---------------------------------------------------------------------------
const MIN_CONFIDENCE = 0.5;

export function checkConfidence(confidence: number): GuardrailResult {
  if (confidence < MIN_CONFIDENCE) {
    return { blocked: true, reason: `AI confidence too low (${confidence.toFixed(2)} < ${MIN_CONFIDENCE}).` };
  }
  return { blocked: false };
}

// ---------------------------------------------------------------------------
// 7. Response Sanitization (output guard)
//     Strip hallucinated PII from LLM output
// ---------------------------------------------------------------------------
export function sanitizeOutput(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[REDACTED]");
  cleaned = cleaned.replace(/\b\d{12}\b/g, "[REDACTED]");
  cleaned = cleaned.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL]");
  return cleaned;
}

// ---------------------------------------------------------------------------
// Top-Level Hook: Apply All Input Guardrails
// ---------------------------------------------------------------------------
export function applyInputGuardrails(
  englishText: string,
  originalText: string
): { blocked: boolean; reason?: string; piiDetected?: boolean } {
  const injection = detectPromptInjection(englishText);
  if (injection.blocked) {
    console.warn(`[Guardrail] Input blocked: ${injection.reason}`);
    return { blocked: true, reason: injection.reason };
  }
  if (detectPromptInjection(originalText).blocked) {
    console.warn("[Guardrail] Input blocked (Arabic prompt injection).");
    return { blocked: true, reason: "Prompt injection attempt detected." };
  }

  const abuse = detectAbuse(englishText);
  if (abuse.blocked) {
    console.warn(`[Guardrail] Input blocked: ${abuse.reason}`);
    return { blocked: true, reason: abuse.reason };
  }

  const offTopic = detectOffTopic(englishText);
  if (offTopic.blocked && detectOffTopic(originalText).blocked) {
    console.warn(`[Guardrail] Input blocked: ${offTopic.reason}`);
    return { blocked: true, reason: offTopic.reason };
  }

  const hasPII = detectPII(englishText) || detectPII(originalText);
  if (hasPII) {
    console.log("[Guardrail] PII detected in user input — flagged for review.");
  }

  return { blocked: false, piiDetected: hasPII };
}

// ---------------------------------------------------------------------------
// Top-Level Hook: Apply All Output Guardrails
// ---------------------------------------------------------------------------
export function applyOutputGuardrails(result: AIDraftOutput): {
  blocked: boolean;
  reason?: string;
  correctedText?: string;
} {
  const medicalAdvice = detectMedicalAdviceInOutput(result.replyText);
  if (medicalAdvice.blocked) {
    console.warn(`[Guardrail] Output blocked: ${medicalAdvice.reason}`);
    return { blocked: true, reason: medicalAdvice.reason };
  }

  const confidence = checkConfidence(result.confidence);
  if (confidence.blocked) {
    console.warn(`[Guardrail] Output blocked: ${confidence.reason}`);
    return { blocked: true, reason: confidence.reason };
  }

  const sanitized = sanitizeOutput(result.replyText);
  if (sanitized !== result.replyText) {
    console.log("[Guardrail] Output sanitized — PII patterns redacted.");
    return { blocked: false, correctedText: sanitized };
  }

  return { blocked: false };
}
