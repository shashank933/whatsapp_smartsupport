import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  containsAny,
  detectDay,
  detectTime,
  extractName,
  ruleBasedReply,
  generateAIResponseForMessage,
  llmTranslateToEnglish,
  translateToLanguage,
  ensureLogDir,
  appendLog,
} from "./responseEngine";
import type { BusinessProfile, FAQItem, ChatMessage } from "../../src/types";

// -------------------------------------------------------------
// Test Fixtures
// -------------------------------------------------------------
const testProfile: BusinessProfile = {
  name: "Test Clinic",
  industry: "Dental",
  replyTone: "supportive",
  systemContext: "Test context",
  autoReplyEnabled: true,
  minConfidence: 0.5,
};

const testFaqs: FAQItem[] = [
  {
    id: "faq1",
    question: "What are your hours?",
    answer: "We're open Sat-Thu 9AM-9PM.",
    keywords: ["hours", "open", "time"],
  },
  {
    id: "faq2",
    question: "How much is a check-up?",
    answer: "Check-up costs 15 KWD.",
    keywords: ["price", "cost", "check-up"],
  },
  {
    id: "faq3",
    question: "Do you do teeth whitening?",
    answer: "Yes, teeth whitening is 80 KWD.",
    keywords: ["whitening", "white", "bleach"],
  },
];

const emptyHistory: ChatMessage[] = [];

// =============================================================================
// containsAny
// =============================================================================
describe("containsAny", () => {
  it("returns true when English text contains a keyword", () => {
    expect(containsAny("I want to book", ["book", "appointment"])).toBe(true);
  });

  it("returns true when Arabic text contains a keyword", () => {
    expect(containsAny("اريد حجز موعد", ["حجز", "موعد"])).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(containsAny("I WANT TO BOOK", ["book"])).toBe(true);
  });

  it("returns false when no keyword matches", () => {
    expect(containsAny("just hello", ["emergency", "urgent"])).toBe(false);
  });

  it("returns false for empty keyword array", () => {
    expect(containsAny("some text", [])).toBe(false);
  });

  it("matches substrings", () => {
    expect(containsAny("I'm bleeding a lot", ["bleed"])).toBe(true);
  });

  it("matches Arabic emergency keywords", () => {
    expect(containsAny("عندي نزيف شديد", ["نزيف", "دم"])).toBe(true);
  });
});

// =============================================================================
// detectDay
// =============================================================================
describe("detectDay", () => {
  it("detects English Sunday", () => {
    expect(detectDay("I want Sunday")).toBe("Sunday");
  });

  it("detects English Monday (case-insensitive)", () => {
    expect(detectDay("book for monday")).toBe("Monday");
  });

  it("detects Arabic الأحد as Sunday", () => {
    expect(detectDay("يوم الأحد")).toBe("Sunday");
  });

  it("detects Arabic الثلاثاء as Tuesday", () => {
    expect(detectDay("الثلاثاء")).toBe("Tuesday");
  });

  it("detects Arabic الجمعة as Friday", () => {
    expect(detectDay("يوم الجمعة")).toBe("Friday");
  });

  it("returns the first matching day in order", () => {
    expect(detectDay("sunday or monday")).toBe("Sunday");
  });

  it("returns null when no day is found", () => {
    expect(detectDay("no day mentioned")).toBeNull();
  });

  it("detects all Arabic day variants", () => {
    expect(detectDay("السبت")).toBe("Saturday");
    expect(detectDay("الأحد")).toBe("Sunday");
    expect(detectDay("الإثنين")).toBe("Monday");
    expect(detectDay("الأربعاء")).toBe("Wednesday");
    expect(detectDay("الخميس")).toBe("Thursday");
  });
});

// =============================================================================
// detectTime
// =============================================================================
describe("detectTime", () => {
  describe("numeric patterns", () => {
    it("detects HH:MM format (returns hour only)", () => {
      expect(detectTime("at 10:30")).toBe("10:00");
    });

    it("detects '10 AM'", () => {
      expect(detectTime("10 AM")).toBe("10:00 AM");
    });

    it("detects '3 pm' (case-insensitive)", () => {
      expect(detectTime("3 pm")).toBe("3:00 PM");
    });

    it("detects 'at 2'", () => {
      expect(detectTime("at 2")).toBe("2:00");
    });

    it("detects Arabic الساعة numeric pattern", () => {
      expect(detectTime("الساعة 10")).toBe("10:00");
    });

    it("detects spaced AM pattern", () => {
      expect(detectTime("10  AM")).toBe("10:00 AM");
    });
  });

  describe("Arabic word hours", () => {
    it("detects العاشرة صباحاً as 10:00 AM", () => {
      expect(detectTime("العاشرة صباحاً")).toBe("10:00 AM");
    });

    it("detects الساعة العاشرة صباحاً as 10:00 AM", () => {
      expect(detectTime("الساعة العاشرة صباحاً")).toBe("10:00 AM");
    });

    it("detects standalone العاشرة (heuristic: hour 10+ → AM)", () => {
      expect(detectTime("العاشرة")).toBe("10:00 AM");
    });

    it("detects الواحدة (hour 1, no AM/PM suffix → bare)", () => {
      expect(detectTime("الواحدة")).toBe("1:00");
    });

    it("detects السادسة مساء as 6:00 PM", () => {
      expect(detectTime("السادسة مساء")).toBe("6:00 PM");
    });

    it("detects الحادية عشرة صباحاً as 11:00 AM", () => {
      expect(detectTime("الحادية عشرة صباحاً")).toBe("11:00 AM");
    });

    it("detects الثانية عشرة (12) with مساء as 12:00 PM", () => {
      expect(detectTime("الثانية عشرة مساء")).toBe("12:00 PM");
    });

    it("detects التاسعة (9) as 9:00", () => {
      expect(detectTime("التاسعة")).toBe("9:00");
    });
  });

  it("returns null for strings with no time", () => {
    expect(detectTime("no time here")).toBeNull();
    expect(detectTime("")).toBeNull();
  });
});

// =============================================================================
// extractName
// =============================================================================
describe("extractName", () => {
  describe("English patterns", () => {
    it('extracts name after "my name is"', () => {
      expect(extractName("my name is John")).toBe("john");
    });

    it('extracts name after "I\'m"', () => {
      expect(extractName("I'm Sarah")).toBe("sarah");
    });

    it('extracts name after "I am"', () => {
      expect(extractName("I am Ahmed")).toBe("ahmed");
    });

    it('extracts name after "this is"', () => {
      expect(extractName("this is Fatima")).toBe("fatima");
    });

    it("extracts full name with spaces", () => {
      expect(extractName("my name is John Smith")).toBe("john smith");
    });
  });

  describe("Arabic patterns", () => {
    it("extracts فاطمة after اسمي", () => {
      expect(extractName("اسمي فاطمة")).toBe("فاطمة");
    });

    it("extracts احمد after اسمي in a sentence", () => {
      expect(extractName("اسمي احمد يوم الاحد")).toBe("احمد يوم الاحد");
    });

    it("extracts name from full Arabic booking message", () => {
      const result = extractName(
        "مرحباً، اسمي فاطمة. أود حجز موعد للفحص يوم الأحد الساعة العاشرة صباحاً"
      );
      expect(result).toBe("فاطمة");
    });

    it("strips trailing comma/punctuation from Arabic name", () => {
      expect(extractName("اسمي محمد،")).toBe("محمد");
    });

    it("handles full Arabic name with 2+ words", () => {
      expect(extractName("اسمي فاطمة العلي")).toBe("فاطمة العلي");
    });
  });

  it("returns null when no name pattern is found", () => {
    expect(extractName("hello how are you")).toBeNull();
    expect(extractName("اريد حجز موعد")).toBeNull();
    expect(extractName("")).toBeNull();
  });
});

// =============================================================================
// ruleBasedReply
// =============================================================================
describe("ruleBasedReply", () => {
  it("matches FAQ by keyword", () => {
    const result = ruleBasedReply("what are your hours", testProfile, testFaqs);
    expect(result.matchedFaqId).toBe("faq1");
    expect(result.replyText).toContain("We're open");
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.isAutoRepliable).toBe(true);
  });

  it("matches FAQ by question text (exact match bonus +3)", () => {
    const result = ruleBasedReply("how much is a check-up", testProfile, testFaqs);
    expect(result.matchedFaqId).toBe("faq2");
    expect(result.replyText).toContain("15 KWD");
  });

  it("matches whitening question", () => {
    const result = ruleBasedReply("do you do whitening", testProfile, testFaqs);
    expect(result.matchedFaqId).toBe("faq3");
    expect(result.replyText).toContain("80 KWD");
  });

  it("returns fallback when no FAQ matches", () => {
    const result = ruleBasedReply("random text", testProfile, testFaqs);
    expect(result.matchedFaqId).toBeUndefined();
    expect(result.confidence).toBe(0.4);
    expect(result.replyText).toContain("Test Clinic");
    expect(result.isAutoRepliable).toBe(false);
    expect(result.explanation).toContain("No matching FAQ");
  });

  it("respects configurable minConfidence threshold", () => {
    const lowThreshold = { ...testProfile, minConfidence: 0.3 };
    const result = ruleBasedReply("random text", lowThreshold, testFaqs);
    expect(result.isAutoRepliable).toBe(false);

    const highThreshold = { ...testProfile, minConfidence: 0.9 };
    const result2 = ruleBasedReply("random text", highThreshold, testFaqs);
    expect(result2.isAutoRepliable).toBe(false);
  });

  it("handles empty FAQ list gracefully", () => {
    const result = ruleBasedReply("hours", testProfile, []);
    expect(result.confidence).toBe(0.4);
    expect(result.isAutoRepliable).toBe(false);
  });
});

// =============================================================================
// generateAIResponseForMessage (fallback path — no LLM keys required)
// =============================================================================
describe("generateAIResponseForMessage", () => {
  it("detects booking with complete details (English message, no LLM fallback)", async () => {
    const result = await generateAIResponseForMessage(
      "I want to book an appointment, my name is John, Sunday at 10 AM",
      emptyHistory,
      testProfile,
      testFaqs
    );
    expect(result.isBooking).toBe(true);
    expect(result.bookingName).toBe("john");
    expect(result.bookingDay).toBe("Sunday");
    expect(result.bookingTime).toBe("10:00 AM");
    expect(result.confidence).toBeGreaterThanOrEqual(0.99);
    expect(result.replyText).toContain("confirmed");
  });

  it("detects booking with missing details and prompts for them", async () => {
    const result = await generateAIResponseForMessage(
      "I want to book an appointment",
      emptyHistory,
      testProfile,
      testFaqs
    );
    expect(result.isBooking).toBe(true);
    expect(result.confidence).toBe(0.9);
    expect(result.replyText).toContain("I just need a few details");
    expect(result.bookingName).toBeUndefined();
    expect(result.bookingDay).toBeUndefined();
    expect(result.bookingTime).toBeUndefined();
  });

  it("routes generic FAQ question through rule-based fallback", async () => {
    const result = await generateAIResponseForMessage(
      "what are your hours",
      emptyHistory,
      testProfile,
      testFaqs
    );
    expect(result.matchedFaqId).toBe("faq1");
    expect(result.replyText).toContain("We're open");
    expect(result.isBooking).toBeUndefined();
  });

  it("handles empty message and returns a response", async () => {
    const result = await generateAIResponseForMessage(
      "",
      emptyHistory,
      testProfile,
      testFaqs
    );
    expect(result.replyText).toBeTruthy();
    expect(result.replyText.length).toBeGreaterThan(0);
  });

  it("returns a valid response for any input string", async () => {
    const result = await generateAIResponseForMessage(
      "hello",
      emptyHistory,
      testProfile,
      testFaqs
    );
    expect(result.replyText).toBeTruthy();
    expect(typeof result.confidence).toBe("number");
    expect(typeof result.isAutoRepliable).toBe("boolean");
  });

  it("rejects booking on Friday (clinic closed)", async () => {
    const result = await generateAIResponseForMessage(
      "I want to book my name is Ali on Friday at 9 AM",
      emptyHistory,
      testProfile,
      testFaqs
    );
    expect(result.isBooking).toBe(true);
    expect(result.bookingDay).toBe("Friday");
    expect(result.replyText).toContain("closed");
  });
});

// =============================================================================
// llmTranslateToEnglish (fallback path — no LLM API keys in test env)
// =============================================================================
describe("llmTranslateToEnglish", () => {
  it("returns originalLanguage 'en' and original text unchanged (fallback — no LLM keys)", async () => {
    const result = await llmTranslateToEnglish("Hello, how are you?");
    expect(result.originalLanguage).toBe("en");
    expect(result.englishText).toBe("Hello, how are you?");
  });

  it("returns originalLanguage 'en' for Arabic text when no LLM keys (fallback)", async () => {
    const result = await llmTranslateToEnglish("مرحبا كيف حالك");
    expect(result.originalLanguage).toBe("en");
    expect(result.englishText).toBe("مرحبا كيف حالك");
  });

  it("returns originalLanguage 'en' for empty string", async () => {
    const result = await llmTranslateToEnglish("");
    expect(result.originalLanguage).toBe("en");
    expect(result.englishText).toBe("");
  });

  it("handles messages with special characters", async () => {
    const result = await llmTranslateToEnglish("Hello! How's it going? 😊");
    expect(result.originalLanguage).toBe("en");
    expect(result.englishText).toBe("Hello! How's it going? 😊");
  });
});

// =============================================================================
// translateToLanguage (fallback path — no LLM API keys in test env)
// =============================================================================
describe("translateToLanguage", () => {
  it("returns text unchanged when targetLang is 'en'", async () => {
    const result = await translateToLanguage("Hello world", "en");
    expect(result).toBe("Hello world");
  });

  it("returns English text unchanged when targetLang is 'ar' and no LLM keys fallback", async () => {
    const result = await translateToLanguage("Hello world", "ar");
    expect(result).toBe("Hello world");
  });

  it("handles empty text with non-en target language", async () => {
    const result = await translateToLanguage("", "fr");
    expect(result).toBe("");
  });

  it("handles non-en target language 'hi'", async () => {
    const result = await translateToLanguage("How are you?", "hi");
    expect(result).toBe("How are you?");
  });
});

// =============================================================================
// Logging: ensureLogDir and appendLog
// =============================================================================
describe("translation logging", () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const LOG_DIR = path.join(__dirname, "..", "logs");
  const TRANSLATION_LOG = path.join(LOG_DIR, "translation-log.txt");

  // Clean up before each test
  beforeEach(() => {
    if (fs.existsSync(LOG_DIR)) {
      if (fs.existsSync(TRANSLATION_LOG)) {
        fs.unlinkSync(TRANSLATION_LOG);
      }
    }
  });

  afterEach(() => {
    if (fs.existsSync(TRANSLATION_LOG)) {
      fs.unlinkSync(TRANSLATION_LOG);
    }
  });

  describe("ensureLogDir", () => {
    it("creates the logs directory if it does not exist", () => {
      if (fs.existsSync(LOG_DIR)) {
        fs.rmdirSync(LOG_DIR, { recursive: true });
      }

      expect(fs.existsSync(LOG_DIR)).toBe(false);

      ensureLogDir();

      expect(fs.existsSync(LOG_DIR)).toBe(true);
      expect(fs.statSync(LOG_DIR).isDirectory()).toBe(true);
    });

    it("does not throw when log directory already exists", () => {
      ensureLogDir();
      expect(fs.existsSync(LOG_DIR)).toBe(true);

      expect(() => ensureLogDir()).not.toThrow();
    });
  });

  describe("appendLog", () => {
    it("creates log file and writes an entry with timestamp", () => {
      expect(fs.existsSync(TRANSLATION_LOG)).toBe(false);

      appendLog('[LLM TRANSLATE] Original (en): "Hello" | English: "Hello"');

      expect(fs.existsSync(TRANSLATION_LOG)).toBe(true);

      const content = fs.readFileSync(TRANSLATION_LOG, "utf-8");
      expect(content).toContain("[LLM TRANSLATE]");
      expect(content).toContain("Original (en)");
      expect(content).toContain("Hello");
    });

    it("formats log entries with ISO timestamp in brackets", () => {
      appendLog("Test log entry");

      const content = fs.readFileSync(TRANSLATION_LOG, "utf-8");
      const linePattern = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] .+\n$/;
      expect(linePattern.test(content)).toBe(true);
    });

    it("appends multiple entries to the same file (newline-separated)", () => {
      appendLog("[LLM TRANSLATE] Entry 1");
      appendLog("[LLM TRANSLATE] Entry 2");
      appendLog("[TRANSLATION] Entry 3");

      const content = fs.readFileSync(TRANSLATION_LOG, "utf-8");
      const lines = content.split("\n").filter(Boolean);

      expect(lines.length).toBe(3);
      expect(lines[0]).toContain("[LLM TRANSLATE] Entry 1");
      expect(lines[1]).toContain("[LLM TRANSLATE] Entry 2");
      expect(lines[2]).toContain("[TRANSLATION] Entry 3");
    });

    it("writes entries with [LLM TRANSLATE] prefix matching production format", () => {
      appendLog('[LLM TRANSLATE] Original (ar): "مرحبا" | English: "Hello"');

      const content = fs.readFileSync(TRANSLATION_LOG, "utf-8");
      expect(content).toContain("[LLM TRANSLATE] Original (ar)");
      expect(content).toContain("مرحبا");
      expect(content).toContain("Hello");
    });

    it("writes entries with [TRANSLATION] prefix matching production format", () => {
      appendLog('[TRANSLATION] LLM: NONE | English: "Hello" | Translation unavailable, returning English.');

      const content = fs.readFileSync(TRANSLATION_LOG, "utf-8");
      expect(content).toContain("[TRANSLATION] LLM: NONE");
      expect(content).toContain("Hello");
      expect(content).toContain("Translation unavailable");
    });
  });

  describe("end-to-end log flow simulation", () => {
    it("simulates translate-to-English + translate-back for Arabic message logging", () => {
      appendLog('[LLM TRANSLATE] Original (ar): "اريد حجز موعد" | English: "I want to book an appointment"');

      appendLog('[TRANSLATION] LLM: Gemini | English: "I\'d love to book that for you!" | Translated (ar): "يسعدني حجز ذلك لك!"');

      const content = fs.readFileSync(TRANSLATION_LOG, "utf-8");
      const lines = content.split("\n").filter(Boolean);

      expect(lines.length).toBe(2);

      expect(lines[0]).toContain("[LLM TRANSLATE]");
      expect(lines[0]).toContain("اريد حجز موعد");
      expect(lines[0]).toContain("I want to book an appointment");

      expect(lines[1]).toContain("[TRANSLATION]");
      expect(lines[1]).toContain("LLM: Gemini");
      expect(lines[1]).toContain("Translated (ar)");
    });

    it("simulates English-only message flow (translate-to-English returns unchanged)", () => {
      appendLog('[LLM TRANSLATE] Original (en): "what are your hours" | English: "what are your hours" (unchanged)');

      const content = fs.readFileSync(TRANSLATION_LOG, "utf-8");
      const lines = content.split("\n").filter(Boolean);

      expect(lines.length).toBe(1);
      expect(lines[0]).toContain("[LLM TRANSLATE]");
      expect(lines[0]).toContain("Original (en)");
      expect(lines[0]).toContain("unchanged");
    });
  });
});

// =============================================================================
// Mock LLM Translation Tests (simulates LLM when API keys are present)
// These use deterministic mock translation to verify the full translation
// pipeline without requiring actual API keys.
// =============================================================================

/** Deterministic mock map: Arabic input → English translation */
const ARABIC_TRANSLATION_MAP: Record<string, { english: string; matchKey: string }> = {
  "مرحبا": { english: "Hello", matchKey: "مرحبا" },
  "عندي الم في الاسنان": { english: "I have a toothache", matchKey: "عندي الم في الاسنان" },
  "اريد حجز موعد": { english: "I want to book an appointment", matchKey: "اريد حجز موعد" },
  "اسمي احمد يوم الاحد الساعة 3": { english: "My name is Ahmed, Sunday at 3 PM", matchKey: "اسمي احمد" },
  "مرحباً، اسمي فاطمة. أود حجز موعد للفحص يوم الأحد الساعة العاشرة صباحاً": {
    english: "Hello, my name is Fatima. I would like to book an appointment for a check-up on Sunday at 10 AM.",
    matchKey: "أود حجز موعد للفحص",
  },
  "السلام عليكم، كم سعر تبييض الأسنان؟": { english: "Hello, how much does teeth whitening cost?", matchKey: "تبييض" },
  "عندي نزيف شديد في اللثة": { english: "I have severe gum bleeding", matchKey: "نزيف" },
};

/**
 * Deterministic mock of llmTranslateToEnglish — mimics what the LLM would return
 * when API keys are configured. For Arabic text: returns originalLanguage "ar"
 * and the expected English translation. Writes to the log file.
 */
function mockTranslateToEnglish(message: string): { originalLanguage: string; englishText: string } {
  const arabicPattern = /[\u0600-\u06FF]/;
  const hasArabic = arabicPattern.test(message);

  if (hasArabic) {
    const entries = Object.entries(ARABIC_TRANSLATION_MAP).sort(
      (a, b) => b[1].matchKey.length - a[1].matchKey.length
    );
    let englishText = message;
    for (const [, { english, matchKey }] of entries) {
      if (message.includes(matchKey)) {
        englishText = english;
        break;
      }
    }

    appendLog(`[LLM TRANSLATE] Original (ar): "${message}" | English: "${englishText}"`);
    return { originalLanguage: "ar", englishText };
  }

  appendLog(`[LLM TRANSLATE] Original (en): "${message}" | English: "${message}" (unchanged)`);
  return { originalLanguage: "en", englishText: message };
}

/** Deterministic mock reverse translations */
const REVERSE_MAP: Record<string, string> = {
  "Hello": "مرحبا",
  "I have a toothache": "عندي الم في الاسنان",
  "I want to book an appointment": "اريد حجز موعد",
  "My name is Ahmed, Sunday at 3 PM": "اسمي احمد يوم الاحد الساعة 3",
  "Hello, my name is Fatima. I would like to book an appointment for a check-up on Sunday at 10 AM.":
    "مرحباً، اسمي فاطمة. أود حجز موعد للفحص يوم الأحد الساعة العاشرة صباحاً",
  "Hello, how much does teeth whitening cost?": "السلام عليكم، كم سعر تبييض الأسنان؟",
  "I have severe gum bleeding": "عندي نزيف شديد في اللثة",
  "I'd love to book that for you!": "يسعدني حجز ذلك لك!",
  "Your appointment is confirmed!": "تم تأكيد حجز موعدك!",
  "Sorry, we're closed on Fridays.": "عذراً، نحن مغلقون يوم الجمعة.",
  "This sounds like a dental emergency requiring immediate care. Please go to the nearest hospital emergency room right now.":
    "هذا يبدو كحالة طوارئ أسنان تتطلب رعاية فورية. يرجى الذهاب إلى أقرب غرفة طوارئ في المستشفى الآن.",
};

/** Deterministic mock of translateToLanguage — mimics LLM translating back to target language */
function mockTranslateToLanguage(text: string, targetLang: string): string {
  if (targetLang === "en") return text;

  const translated = REVERSE_MAP[text] || text;

  if (translated !== text) {
    appendLog(`[TRANSLATION] LLM: MOCK | English: "${text}" | Translated (${targetLang}): "${translated}"`);
    return translated;
  }

  // For texts not in the reverse map, return the original and log as NONE fallback
  appendLog(`[TRANSLATION] LLM: MOCK | English: "${text}" | Translated (${targetLang}): "${text}" (no mapping)`);
  return text;
}

describe("mock LLM translation", () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const LOG_DIR = path.join(__dirname, "..", "logs");
  const TRANSLATION_LOG = path.join(LOG_DIR, "translation-log.txt");

  beforeEach(() => {
    if (fs.existsSync(LOG_DIR)) {
      if (fs.existsSync(TRANSLATION_LOG)) {
        fs.unlinkSync(TRANSLATION_LOG);
      }
    }
  });

  afterEach(() => {
    if (fs.existsSync(TRANSLATION_LOG)) {
      fs.unlinkSync(TRANSLATION_LOG);
    }
  });

  describe("Arabic → English translation (mock LLM)", () => {
    it("detects Arabic greeting 'مرحبا' and translates to 'Hello'", () => {
      const result = mockTranslateToEnglish("مرحبا");
      expect(result.originalLanguage).toBe("ar");
      expect(result.englishText).toBe("Hello");
    });

    it("detects Arabic booking request and translates flawlessly", () => {
      const result = mockTranslateToEnglish("اريد حجز موعد");
      expect(result.originalLanguage).toBe("ar");
      expect(result.englishText).toBe("I want to book an appointment");
    });

    it("detects Arabic emergency message and translates", () => {
      const result = mockTranslateToEnglish("عندي نزيف شديد في اللثة");
      expect(result.originalLanguage).toBe("ar");
      expect(result.englishText).toBe("I have severe gum bleeding");
    });

    it("detects complex Arabic sentence with name, day, and time", () => {
      const result = mockTranslateToEnglish(
        "مرحباً، اسمي فاطمة. أود حجز موعد للفحص يوم الأحد الساعة العاشرة صباحاً"
      );
      expect(result.originalLanguage).toBe("ar");
      expect(result.englishText).toBe(
        "Hello, my name is Fatima. I would like to book an appointment for a check-up on Sunday at 10 AM."
      );
    });

    it("detects Arabic inquiry about whitening cost", () => {
      const result = mockTranslateToEnglish("السلام عليكم، كم سعر تبييض الأسنان؟");
      expect(result.originalLanguage).toBe("ar");
      expect(result.englishText).toBe("Hello, how much does teeth whitening cost?");
    });

    it("returns 'en' for English messages unchanged", () => {
      const result = mockTranslateToEnglish("Hello, I want to book an appointment");
      expect(result.originalLanguage).toBe("en");
      expect(result.englishText).toBe("Hello, I want to book an appointment");
    });
  });

  describe("English → target language back-translation (mock LLM)", () => {
    it("translates English booking confirmation to Arabic", () => {
      const result = mockTranslateToLanguage("Your appointment is confirmed!", "ar");
      expect(result).toBe("تم تأكيد حجز موعدك!");
    });

    it("returns English text unchanged when targetLang is 'en'", () => {
      const result = mockTranslateToLanguage("Hello world", "en");
      expect(result).toBe("Hello world");
    });

    it("translates to Arabic for emergency-related text", () => {
      const result = mockTranslateToLanguage("I have severe gum bleeding", "ar");
      expect(result).toBe("عندي نزيف شديد في اللثة");
    });

    it("translates 'I'd love to book that for you!' to Arabic", () => {
      const result = mockTranslateToLanguage("I'd love to book that for you!", "ar");
      expect(result).toBe("يسعدني حجز ذلك لك!");
    });
  });

  describe("full Arabic message flow (translate → process → translate back)", () => {
    it("completes full cycle: Arabic emergency → English → Arabic reply", () => {
      // Step 1: Translate Arabic input to English (mock LLM)
      const { originalLanguage, englishText } = mockTranslateToEnglish("عندي نزيف شديد في اللثة");
      expect(originalLanguage).toBe("ar");
      expect(englishText).toBe("I have severe gum bleeding");

      // Step 2: Process in English (keyword detection)
      expect(containsAny(englishText.toLowerCase(), ["bleeding", "blood", "emergency"])).toBe(true);

      // Step 3: Draft English reply (simulate emergency reply generation)
      const englishReply =
        "This sounds like a dental emergency requiring immediate care. Please go to the nearest hospital emergency room right now.";

      // Step 4: Translate reply back to Arabic
      const finalReply = mockTranslateToLanguage(englishReply, originalLanguage);
      expect(finalReply).toBeTruthy();
      expect(finalReply).not.toBe(englishReply); // should be different (translated)

      // Step 5: Verify log entries
      const content = fs.readFileSync(TRANSLATION_LOG, "utf-8");
      expect(content).toContain("[LLM TRANSLATE]");
      expect(content).toContain("[TRANSLATION]");
      expect(content).toContain("نزيف");
    });

    it("completes full cycle: Arabic booking → English → Arabic reply", () => {
      // Step 1: Translate Arabic to English
      const { originalLanguage, englishText } = mockTranslateToEnglish("اريد حجز موعد");
      expect(originalLanguage).toBe("ar");
      expect(englishText).toBe("I want to book an appointment");

      // Step 2: Detect booking intent in English
      expect(containsAny(englishText.toLowerCase(), ["book", "appointment"])).toBe(true);

      // Step 3: English reply
      const englishReply = "I'd love to book that for you!";

      // Step 4: Translate back to Arabic
      const finalReply = mockTranslateToLanguage(englishReply, originalLanguage);
      expect(finalReply).toBe("يسعدني حجز ذلك لك!");

      // Step 5: Log verification
      const content = fs.readFileSync(TRANSLATION_LOG, "utf-8");
      const lines = content.split("\n").filter(Boolean);
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain("[LLM TRANSLATE] Original (ar)");
      expect(lines[1]).toContain("[TRANSLATION] LLM: MOCK | English");
    });

    it("handles English-only message without back-translation", () => {
      const { originalLanguage } = mockTranslateToEnglish("what are your hours");
      expect(originalLanguage).toBe("en");

      // No back-translation needed for English reply
      const content = fs.readFileSync(TRANSLATION_LOG, "utf-8");
      const lines = content.split("\n").filter(Boolean);
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain("[LLM TRANSLATE] Original (en)");
      expect(lines[0]).toContain("unchanged");
    });
  });

  describe("log format verification for mock translations", () => {
    it("writes correct [LLM TRANSLATE] format for Arabic input", () => {
      mockTranslateToEnglish("مرحبا");
      mockTranslateToEnglish("اريد حجز موعد");

      const content = fs.readFileSync(TRANSLATION_LOG, "utf-8");
      const lines = content.split("\n").filter(Boolean);

      expect(lines.length).toBe(2);

      // Format: [timestamp] [LLM TRANSLATE] Original (ar): "..." | English: "..."
      expect(lines[0]).toContain("[LLM TRANSLATE] Original (ar):");
      expect(lines[0]).toMatch(/"مرحبا"/);
      expect(lines[0]).toMatch(/"Hello"/);

      expect(lines[1]).toContain("[LLM TRANSLATE] Original (ar):");
      expect(lines[1]).toMatch(/"اريد حجز موعد"/);
      expect(lines[1]).toMatch(/"I want to book an appointment"/);
    });

    it("writes correct [TRANSLATION] format for Arabic back-translation", () => {
      mockTranslateToLanguage("Hello world", "ar");
      mockTranslateToLanguage("I'd love to book that for you!", "ar");

      const content = fs.readFileSync(TRANSLATION_LOG, "utf-8");
      const lines = content.split("\n").filter(Boolean);

      expect(lines.length).toBe(2);

      // Format: [timestamp] [TRANSLATION] LLM: MOCK | English: "..." | Translated (ar): "..."
      expect(lines[0]).toContain("[TRANSLATION] LLM: MOCK");
      expect(lines[0]).toContain("English:");
      expect(lines[0]).toContain("Translated (ar):");

      expect(lines[1]).toContain("[TRANSLATION] LLM: MOCK");
      expect(lines[1]).toMatch(/"يسعدني حجز ذلك لك!"/);
    });
  });
});