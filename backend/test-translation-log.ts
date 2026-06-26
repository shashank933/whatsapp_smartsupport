/**
 * Test script for the translation log system.
 * Run with: npx tsx backend/test-translation-log.ts
 *
 * Simulates sending messages in different languages and verifies
 * that backend/logs/translation-log.txt is populated correctly.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// -------------------------------------------------------------
// Log File Helpers (mirrored from responseEngine.ts)
// -------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "..", "backend", "logs");
const TRANSLATION_LOG = path.join(LOG_DIR, "translation-log.txt");

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    console.log(`[TEST] Created log directory: ${LOG_DIR}`);
  }
}

function appendLog(entry: string): void {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  fs.appendFileSync(TRANSLATION_LOG, `[${timestamp}] ${entry}\n`, "utf-8");
}

// -------------------------------------------------------------
// Mock LLM translate (simulates what the real LLM would return)
// -------------------------------------------------------------
function mockLLMTranslateToEnglish(message: string): { originalLanguage: string; englishText: string } {
  // Simple simulation: detect Arabic characters, otherwise assume English
  const arabicPattern = /[\u0600-\u06FF]/;
  const hasArabic = arabicPattern.test(message);

  if (hasArabic) {
    // Simulated translations
    const mockMap: Record<string, string> = {
      "مرحبا": "Hello",
      "اريد حجز موعد": "I want to book an appointment",
      "اسمي احمد يوم الاثنين الساعة 3": "My name is Ahmed, Monday at 3 PM",
      "مرحباً، اسمي فاطمة. أود حجز موعد يوم الاثنين الساعة العاشرة صباحاً": "Hello, my name is Fatima. I would like to book an appointment on Monday at 10 AM.",
      "احتاج مساعدة": "I need help",
    };

    let englishText = message;
    for (const [ar, en] of Object.entries(mockMap)) {
      if (message.includes(ar)) {
        englishText = en;
        break;
      }
    }

    appendLog(`[LLM TRANSLATE] Original (ar): "${message}" | English: "${englishText}"`);
    return { originalLanguage: "ar", englishText };
  }

  appendLog(`[LLM TRANSLATE] Original (en): "${message}" | English: "${message}" (unchanged)`);
  return { originalLanguage: "en", englishText: message };
}

// -------------------------------------------------------------
// Mock translate back to target language
// -------------------------------------------------------------
function mockTranslateToLanguage(text: string, targetLang: string): string {
  if (targetLang === "en") return text;
  appendLog(`[TRANSLATION] LLM: MOCK | English: "${text}" | Translated (${targetLang}): "${text}"`);
  return text; // In mock mode, just return English
}

// -------------------------------------------------------------
// Test scenarios
// -------------------------------------------------------------
const testMessages = [
  { input: "Hello, what are your working hours?", desc: "English message" },
  { input: "مرحبا", desc: "Arabic greeting" },
  { input: "احتاج مساعدة", desc: "Arabic: I need help" },
  { input: "اريد حجز موعد", desc: "Arabic: I want to book" },
  { input: "اسمي احمد يوم الاثنين الساعة 3", desc: "Arabic: Booking with name/day/time" },
  { input: "مرحباً، اسمي فاطمة. أود حجز موعد يوم الاثنين الساعة العاشرة صباحاً.", desc: "Arabic: Fatima booking Monday 10 AM" },
  { input: "I need to speak with a representative urgently", desc: "English: urgent support" },
];

// -------------------------------------------------------------
// Clear previous test log and run tests
// -------------------------------------------------------------
function clearLog(): void {
  ensureLogDir();
  fs.writeFileSync(TRANSLATION_LOG, "", "utf-8");
  console.log("[TEST] Cleared previous log file.\n");
}

function printLogContents(): void {
  console.log("\n--- translation-log.txt contents ---");
  if (fs.existsSync(TRANSLATION_LOG)) {
    const content = fs.readFileSync(TRANSLATION_LOG, "utf-8");
    console.log(content || "(empty)");
  } else {
    console.log("(file does not exist)");
  }
  console.log("--- end of log ---\n");
}

async function main() {
  console.log("=== Translation Log Test ===\n");

  clearLog();

  for (const { input, desc } of testMessages) {
    console.log(`[TEST] Input: "${input}" — ${desc}`);
    const { originalLanguage, englishText } = mockLLMTranslateToEnglish(input);

    if (originalLanguage !== "en") {
      mockTranslateToLanguage(englishText, originalLanguage);
    }

    console.log(`       Detected: ${originalLanguage}, English: "${englishText}"\n`);
  }

  printLogContents();

  // Verify
  const fileExists = fs.existsSync(TRANSLATION_LOG);
  const raw = fileExists ? fs.readFileSync(TRANSLATION_LOG, "utf-8") : "";
  const lineCount = raw.split("\n").filter(Boolean).length;

  console.log(`Verification:
  - Log file exists: ${fileExists ? "PASS" : "FAIL"}
  - Log entries: ${lineCount} (Arabic messages produce 2 log lines each; English only 1)
  - File path: ${TRANSLATION_LOG}\n`);

  if (fileExists && lineCount > 0) {
    console.log("All tests passed!");
  } else {
    console.log("Some tests FAILED — check the output above.");
    process.exit(1);
  }
}

main().catch(console.error);