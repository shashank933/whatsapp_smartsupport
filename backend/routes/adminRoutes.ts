import { Router } from "express";
import {
  memoryProfile,
  memoryWhatsAppConfig,
  updateProfile,
  updateWhatsAppConfig,
  getLlmProvider,
  setLlmProvider,
  type LlmProvider,
} from "../db/memoryStore";
import * as fs from "fs";
import * as path from "path";

export const adminRouter = Router();

// -------------------------------------------------------------
// Business Profile Config
// -------------------------------------------------------------
adminRouter.get("/profile", (req, res) => {
  res.json(memoryProfile);
});

adminRouter.post("/profile", (req, res) => {
  const { name, industry, replyTone, systemContext, autoReplyEnabled, minConfidence } = req.body;
  updateProfile({
    name: name || "My Business",
    industry: industry || "Retail",
    replyTone: replyTone || "friendly",
    systemContext: systemContext || "",
    autoReplyEnabled: autoReplyEnabled !== undefined ? autoReplyEnabled : true,
    minConfidence: minConfidence !== undefined ? Number(minConfidence) : 0.75,
  });
  // Also sync systemContext to prompt-behavior-rules.md
  if (systemContext !== undefined) {
    const docPath = path.join(DOCS_DIR, "prompt-behavior-rules.md");
    try {
      if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
      fs.writeFileSync(docPath, systemContext, "utf-8");
    } catch (e) {
      console.error("Failed to sync prompt-behavior-rules.md:", e);
    }
  }
  res.json({ success: true, profile: memoryProfile });
});

// -------------------------------------------------------------
// WhatsApp Meta Cloud API Configuration
// -------------------------------------------------------------
adminRouter.get("/whatsapp-config", (req, res) => {
  res.json(memoryWhatsAppConfig);
});

adminRouter.post("/whatsapp-config", (req, res) => {
  const { phoneNumberId, businessAccountId, accessToken, verifyToken } = req.body;
  updateWhatsAppConfig({
    phoneNumberId: phoneNumberId || "",
    businessAccountId: businessAccountId || "",
    accessToken: accessToken || "",
    verifyToken: verifyToken || "",
  });
  res.json({ success: true, config: memoryWhatsAppConfig });
});

// -------------------------------------------------------------
// LLM Provider Toggle
// -------------------------------------------------------------
adminRouter.get("/llm-provider", (req, res) => {
  res.json({ provider: getLlmProvider() });
});

adminRouter.post("/llm-provider", (req, res) => {
  const { provider } = req.body;
  if (!["gemini", "deepseek", "rule"].includes(provider)) {
    return res.status(400).json({ error: "Invalid provider. Use: gemini, deepseek, or rule" });
  }
  setLlmProvider(provider as LlmProvider);
  res.json({ success: true, provider });
});

// -------------------------------------------------------------
// Runtime Docs (read from disk on every request)
// -------------------------------------------------------------
const DOCS_DIR = path.join(process.cwd(), "docs");

adminRouter.get("/docs/:filename", (req, res) => {
  const filename = req.params.filename;
  if (!filename.endsWith(".md")) {
    return res.status(400).json({ error: "Only .md files are supported." });
  }
  const fullPath = path.join(DOCS_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "Document not found." });
  }
  res.send(fs.readFileSync(fullPath, "utf-8"));
});

adminRouter.get("/docs", (req, res) => {
  let files: string[] = [];
  if (fs.existsSync(DOCS_DIR)) {
    files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
  }
  const docs = files.map((f) => ({
    filename: f,
    name: f.replace(/\.md$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
  res.json(docs);
});

adminRouter.get("/app-url", (req, res) => {
  const url = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
  res.json({ url });
});

adminRouter.post("/docs/:filename", (req, res) => {
  const filename = req.params.filename;
  if (!filename.endsWith(".md")) {
    return res.status(400).json({ error: "Only .md files are supported." });
  }
  const { content } = req.body;
  if (typeof content !== "string") {
    return res.status(400).json({ error: "content field is required." });
  }
  const fullPath = path.join(DOCS_DIR, filename);
  try {
    if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
    res.json({ success: true, filename });
  } catch (e) {
    console.error("Failed to save doc:", e);
    res.status(500).json({ error: "Failed to save document." });
  }
});