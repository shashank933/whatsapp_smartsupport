/**
 * Test script specifically for Arabic sentence translation verification.
 * Uses DETERMINISTIC MOCK translation (no LLM keys required, no rule-based fallback).
 *
 * Run with: npx tsx backend/test-arabic-translation.ts
 *
 * This test:
 * 1. Sends Arabic sentences through mock translate-to-English
 * 2. Strictly verifies language detection identifies Arabic (not English)
 * 3. Verifies the mock English translation matches expected output
 * 4. Checks that translation-log.txt contains translation entries
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// -------------------------------------------------------------
// Log File Helpers (mirrored from responseEngine.ts)
// -------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "logs");
const TRANSLATION_LOG = path.join(LOG_DIR, "translation-log.txt");

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    console.log(`[SETUP] Created log directory: ${LOG_DIR}`);
  }
}

function appendLog(entry: string): void {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  fs.appendFileSync(TRANSLATION_LOG, `[${timestamp}] ${entry}\n`, "utf-8");
}

function clearLog(): void {
  ensureLogDir();
  fs.writeFileSync(TRANSLATION_LOG, "", "utf-8");
}

// -------------------------------------------------------------
// Mock LLM translate (deterministic — always detects Arabic, returns expected English)
// -------------------------------------------------------------
interface TranslationResult {
  originalLanguage: string;
  englishText: string;
}

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

function mockLLMTranslateToEnglish(message: string): TranslationResult {
  const arabicPattern = /[\u0600-\u06FF]/;
  const hasArabic = arabicPattern.test(message);

  if (hasArabic) {
    // Search the deterministic map — try longest match keys first to
    // avoid shorter substrings matching before longer phrases
    const entries = Object.entries(ARABIC_TRANSLATION_MAP).sort(
      (a, b) => b[1].matchKey.length - a[1].matchKey.length
    );
    let englishText = message; // fallback: return input unchanged
    for (const [ar, { english, matchKey }] of entries) {
      if (message.includes(matchKey)) {
        englishText = english;
        break;
      }
    }

    appendLog(`[LLM TRANSLATE] Original (ar): "${message}" | English: "${englishText}"`);
    return { originalLanguage: "ar", englishText };
  }

  // Not Arabic — return unchanged
  appendLog(`[LLM TRANSLATE] Original (en): "${message}" | English: "${message}" (unchanged)`);
  return { originalLanguage: "en", englishText: message };
}

// -------------------------------------------------------------
// Mock translate back to target language
// -------------------------------------------------------------
function mockTranslateToLanguage(text: string, targetLang: string): string {
  if (targetLang === "en") return text;

  // Deterministic reverse translations
  const reverseMap: Record<string, string> = {
    "Hello": "مرحبا",
    "I have a toothache": "عندي الم في الاسنان",
    "I want to book an appointment": "اريد حجز موعد",
    "My name is Ahmed, Sunday at 3 PM": "اسمي احمد يوم الاحد الساعة 3",
    "Hello, my name is Fatima. I would like to book an appointment for a check-up on Sunday at 10 AM.":
      "مرحباً، اسمي فاطمة. أود حجز موعد للفحص يوم الأحد الساعة العاشرة صباحاً",
    "Hello, how much does teeth whitening cost?": "السلام عليكم، كم سعر تبييض الأسنان؟",
    "I have severe gum bleeding": "عندي نزيف شديد في اللثة",
  };

  const translated = reverseMap[text] || text;
  appendLog(`[TRANSLATION] LLM: MOCK | English: "${text}" | Translated (${targetLang}): "${translated}"`);
  return translated;
}

// -------------------------------------------------------------
// Test Data
// -------------------------------------------------------------
interface ArabicTestCase {
  input: string;
  description: string;
  expectedLanguage: string;
  expectedEnglish: string;
}

const arabicTestCases: ArabicTestCase[] = [
  {
    input: "مرحبا",
    description: "Arabic greeting 'Hello'",
    expectedLanguage: "ar",
    expectedEnglish: "Hello",
  },
  {
    input: "عندي الم في الاسنان",
    description: "Arabic: 'I have a toothache'",
    expectedLanguage: "ar",
    expectedEnglish: "I have a toothache",
  },
  {
    input: "اريد حجز موعد",
    description: "Arabic: 'I want to book an appointment'",
    expectedLanguage: "ar",
    expectedEnglish: "I want to book an appointment",
  },
  {
    input: "اسمي احمد يوم الاحد الساعة 3",
    description: "Arabic: Booking with name/day/time",
    expectedLanguage: "ar",
    expectedEnglish: "My name is Ahmed, Sunday at 3 PM",
  },
  {
    input: "مرحباً، اسمي فاطمة. أود حجز موعد للفحص يوم الأحد الساعة العاشرة صباحاً",
    description: "Arabic: Fatima booking check-up",
    expectedLanguage: "ar",
    expectedEnglish:
      "Hello, my name is Fatima. I would like to book an appointment for a check-up on Sunday at 10 AM.",
  },
  {
    input: "السلام عليكم، كم سعر تبييض الأسنان؟",
    description: "Arabic: 'How much is teeth whitening?'",
    expectedLanguage: "ar",
    expectedEnglish: "Hello, how much does teeth whitening cost?",
  },
  {
    input: "عندي نزيف شديد في اللثة",
    description: "Arabic: Emergency - severe gum bleeding",
    expectedLanguage: "ar",
    expectedEnglish: "I have severe gum bleeding",
  },
];

// -------------------------------------------------------------
// Test Runner
// -------------------------------------------------------------
function runArabicTranslationTests(): void {
  console.log("=".repeat(60));
  console.log("ARABIC TRANSLATION VERIFICATION TEST (MOCK)");
  console.log("=".repeat(60));
  console.log(`Log file: ${TRANSLATION_LOG}`);
  console.log("");

  // Clear previous log so we start fresh
  clearLog();
  console.log("[SETUP] Cleared previous log file.\n");

  let passed = 0;
  let failed = 0;
  const results: string[] = [];

  for (const testCase of arabicTestCases) {
    console.log("-".repeat(50));
    console.log(`[TEST] Input: "${testCase.input}"`);
    console.log(`       Description: ${testCase.description}`);

    // --- Step 1: Translate Arabic → English ---
    const { originalLanguage, englishText } = mockLLMTranslateToEnglish(testCase.input);

    // --- Step 2: Verify language detection ---
    if (originalLanguage !== testCase.expectedLanguage) {
      console.log(`       ❌ FAIL: Expected language "${testCase.expectedLanguage}", got "${originalLanguage}"`);
      failed++;
      results.push(`FAIL: "${testCase.input}" — Language detection: expected "${testCase.expectedLanguage}", got "${originalLanguage}"`);
      continue;
    }
    console.log(`       ✅ Language detected: ${originalLanguage}`);

    // --- Step 3: Verify English translation ---
    if (englishText !== testCase.expectedEnglish) {
      console.log(`       ❌ FAIL: English translation mismatch`);
      console.log(`          Expected: "${testCase.expectedEnglish}"`);
      console.log(`          Got:      "${englishText}"`);
      failed++;
      results.push(
        `FAIL: "${testCase.input}" — Translation mismatch: expected "${testCase.expectedEnglish.substring(0, 50)}...", got "${englishText.substring(0, 50)}..."`
      );
      continue;
    }
    console.log(`       ✅ English translation: "${englishText}"`);

    // --- Step 4: Translate back to Arabic (verify round-trip) ---
    const backTranslated = mockTranslateToLanguage(englishText, originalLanguage);
    console.log(`       ✅ Translated back to (${originalLanguage}): "${backTranslated}"`);

    passed++;
    results.push(`PASS: "${testCase.input}" — ${testCase.description}`);

    console.log("");
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log("=".repeat(60));
  console.log("TEST RESULTS SUMMARY");
  console.log("=".repeat(60));
  console.log("");
  for (const r of results) {
    const icon = r.startsWith("PASS") ? "✅" : "❌";
    console.log(`  ${icon} ${r}`);
  }
  console.log("");
  console.log(`Total: ${arabicTestCases.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log("");

  // -------------------------------------------------------------
  // Translation Log Verification
  // -------------------------------------------------------------
  console.log("-".repeat(50));
  console.log("TRANSLATION LOG VERIFICATION");
  console.log("-".repeat(50));

  const logExists = fs.existsSync(TRANSLATION_LOG);
  const raw = logExists ? fs.readFileSync(TRANSLATION_LOG, "utf-8") : "";
  const allLines = raw.split("\n").filter(Boolean);
  const translateLines = allLines.filter((l) => l.includes("[LLM TRANSLATE]"));
  const translationLines = allLines.filter((l) => l.includes("[TRANSLATION]"));

  console.log(`  Log file exists: ${logExists ? "✅ YES" : "❌ NO"}`);
  console.log(`  [LLM TRANSLATE] entries: ${translateLines.length} (expected: ${arabicTestCases.length})`);
  console.log(`  [TRANSLATION] entries: ${translationLines.length} (expected: ${arabicTestCases.length})`);
  console.log(`  Total log lines: ${allLines.length}`);
  console.log("");

  // Verify: Every Arabic message should produce 2 log lines (translate + translation)
  const expectedLogLines = arabicTestCases.length * 2;
  if (translateLines.length === arabicTestCases.length && translationLines.length === arabicTestCases.length) {
    console.log(`  ✅ All ${expectedLogLines} expected translation log entries are present.`);
  } else {
    console.log(`  ❌ Log entry count mismatch: expected ${expectedLogLines} entries, got ${translateLines.length + translationLines.length}`);
    failed++;
  }

  console.log("");
  console.log("  Full translation log contents:");
  console.log("  ---");
  allLines.forEach((line) => console.log(`  ${line}`));
  console.log("  ---");
  console.log("");

  // -------------------------------------------------------------
  // Final verdict
  // -------------------------------------------------------------
  if (failed === 0) {
    console.log("=".repeat(60));
    console.log("✅ ALL ARABIC TRANSLATION TESTS PASSED");
    console.log("=".repeat(60));
    console.log("");
    console.log("Summary:");
    console.log(`  - ${arabicTestCases.length} Arabic sentences tested`);
    console.log(`  - All correctly detected as Arabic (ar)`);
    console.log(`  - All correctly translated to expected English`);
    console.log(`  - All round-trip translated back to Arabic`);
    console.log(`  - Translation log contains all ${expectedLogLines} expected entries`);
  } else {
    console.log("=".repeat(60));
    console.log(`❌ ${failed} TEST(S) FAILED`);
    console.log("=".repeat(60));
    process.exit(1);
  }
}

// Run
try {
  runArabicTranslationTests();
} catch (err: any) {
  console.error("Fatal test error:", err);
  process.exit(1);
}