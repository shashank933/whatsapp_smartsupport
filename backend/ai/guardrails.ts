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
//     Blocks messages completely unrelated to business scope
//     Uses generic business patterns instead of domain-specific ones
// ---------------------------------------------------------------------------
const ON_TOPIC_PATTERNS: RegExp[] = [];

export function detectOffTopic(text: string): GuardrailResult {
  // No on-topic patterns defined — pass all messages through.
  // Business scope is enforced by the LLM prompt and FAQ matching.
  return { blocked: false };
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
// 5. Unsafe Advice Re-Check (output guard)
//     Re-verifies the LLM response for leaked professional advice
//     Configure these patterns based on your industry requirements
// ---------------------------------------------------------------------------
const UNSAFE_ADVICE_PATTERNS: RegExp[] = [];

const UNSAFE_ADVICE_PATTERNS_AR: RegExp[] = [];

export function detectUnsafeAdviceInOutput(text: string): GuardrailResult {
  for (const pattern of UNSAFE_ADVICE_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "LLM generated potentially unsafe advice; output blocked." };
    }
  }
  for (const pattern of UNSAFE_ADVICE_PATTERNS_AR) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "LLM generated potentially unsafe advice; output blocked." };
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
  const unsafeAdvice = detectUnsafeAdviceInOutput(result.replyText);
  if (unsafeAdvice.blocked) {
    console.warn(`[Guardrail] Output blocked: ${unsafeAdvice.reason}`);
    return { blocked: true, reason: unsafeAdvice.reason };
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
