import { Router } from "express";
import { FAQItem, CannedResponse } from "../../src/types";
import { memoryFaqs, memoryCannedResponses } from "../db/memoryStore";

export const knowledgeRouter = Router();

// -------------------------------------------------------------
// FAQ Management
// -------------------------------------------------------------
knowledgeRouter.get("/faqs", (req, res) => {
  res.json(memoryFaqs);
});

knowledgeRouter.post("/faqs", (req, res) => {
  const { id, question, answer, keywords } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ error: "Question and answer are required." });
  }
  const item: FAQItem = {
    id: id || "faq_" + Date.now(),
    question,
    answer,
    keywords: keywords || [],
  };
  const index = memoryFaqs.findIndex((f) => f.id === item.id);
  if (index >= 0) {
    memoryFaqs[index] = item;
  } else {
    memoryFaqs.push(item);
  }
  res.json({ success: true, item });
});

knowledgeRouter.delete("/faqs/:id", (req, res) => {
  const idx = memoryFaqs.findIndex((f) => f.id === req.params.id);
  if (idx >= 0) memoryFaqs.splice(idx, 1);
  res.json({ success: true });
});

// -------------------------------------------------------------
// Canned Responses
// -------------------------------------------------------------
knowledgeRouter.get("/canned-responses", (req, res) => {
  res.json(memoryCannedResponses);
});

knowledgeRouter.post("/canned-responses", (req, res) => {
  const { id, shortcut, text } = req.body;
  if (!shortcut || !text) {
    return res.status(400).json({ error: "Shortcut and text are required." });
  }
  const item: CannedResponse = {
    id: id || "canned_" + Date.now(),
    shortcut,
    text,
  };
  const index = memoryCannedResponses.findIndex((r) => r.id === item.id);
  if (index >= 0) {
    memoryCannedResponses[index] = item;
  } else {
    memoryCannedResponses.push(item);
  }
  res.json({ success: true, item });
});

knowledgeRouter.delete("/canned-responses/:id", (req, res) => {
  const idx = memoryCannedResponses.findIndex((r) => r.id === req.params.id);
  if (idx >= 0) memoryCannedResponses.splice(idx, 1);
  res.json({ success: true });
});