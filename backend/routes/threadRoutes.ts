import { Router } from "express";
import { ChatThread, ChatMessage } from "../../src/types";
import {
  memoryProfile,
  memoryFaqs,
  memoryWhatsAppConfig,
  memoryWebhookLogs,
  memoryAppointments,
  addLog,
  getAppointments,
} from "../db/memoryStore";
import {
  sqliteGetAllThreads,
  sqliteGetThreadById,
  sqliteGetThreadByPhone,
  sqliteCreateThread,
  sqliteUpdateThread,
  sqliteUpsertThread,
  sqliteAddMessage,
  sqliteGetMessagesByThreadId,
  buildCustomerContext,
  sqliteUpsertContact,
  sqliteGetAllContacts,
  sqliteArchiveThread,
  sqliteDeleteThread,
} from "../db/sqliteStore";
import { generateAIResponseForMessage } from "../ai/responseEngine";
import { syncContactToHubSpot } from "../integrations/hubspot";

export const threadRouter = Router();

// -------------------------------------------------------------
// Thread Management
// -------------------------------------------------------------
threadRouter.get("/threads", (req, res) => {
  const status = req.query.status as string | undefined;
  res.json(sqliteGetAllThreads(status));
});

threadRouter.post("/threads", (req, res) => {
  const { customerPhone, customerName } = req.body;
  if (!customerPhone || !customerName) {
    return res.status(400).json({ error: "Phone and name are required." });
  }
  const existing = sqliteGetThreadByPhone(customerPhone);
  if (existing) {
    return res.status(400).json({ error: "Thread already exists for this phone number." });
  }
  const thread: ChatThread = {
    id: "thread_" + Date.now(),
    customerPhone,
    customerName,
    status: "open",
    lastMessageText: "Thread initialized manually",
    lastMessageTime: Date.now(),
    unreadCount: 0,
    autoReplyActive: true,
  };
  sqliteCreateThread(thread);
  res.json(thread);
});

// -------------------------------------------------------------
// Messages per Thread
// -------------------------------------------------------------
threadRouter.get("/threads/:id/messages", (req, res) => {
  const messages = sqliteGetMessagesByThreadId(req.params.id);

  const thread = sqliteGetThreadById(req.params.id);
  if (thread && thread.unreadCount > 0) {
    sqliteUpdateThread(thread.id, { unreadCount: 0 });
  }
  res.json(messages);
});

// -------------------------------------------------------------
// Thread-level auto-reply toggle
// -------------------------------------------------------------
threadRouter.post("/threads/:id/auto-reply", (req, res) => {
  const { enabled } = req.body;
  const updated = sqliteUpdateThread(req.params.id, { autoReplyActive: enabled });
  if (!updated) {
    return res.status(404).json({ error: "Thread not found." });
  }
  res.json({ success: true, thread: updated });
});

// -------------------------------------------------------------
// Thread Status Update
// -------------------------------------------------------------
threadRouter.post("/threads/:id/status", (req, res) => {
  const { status } = req.body;
  if (!["open", "pending", "resolved", "archived"].includes(status)) {
    return res.status(400).json({ error: "Invalid status code." });
  }
  const updated = sqliteUpdateThread(req.params.id, { status });
  if (!updated) {
    return res.status(404).json({ error: "Thread not found." });
  }
  res.json({ success: true, thread: updated });
});

// -------------------------------------------------------------
// Archive Thread
// -------------------------------------------------------------
threadRouter.post("/threads/:id/archive", (req, res) => {
  const updated = sqliteArchiveThread(req.params.id);
  if (!updated) {
    return res.status(404).json({ error: "Thread not found." });
  }
  res.json({ success: true, thread: updated });
});

// -------------------------------------------------------------
// Delete Thread
// -------------------------------------------------------------
threadRouter.delete("/threads/:id", (req, res) => {
  const deleted = sqliteDeleteThread(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Thread not found." });
  }
  res.json({ success: true });
});

// -------------------------------------------------------------
// Agent Manual Message Send
// -------------------------------------------------------------
threadRouter.post("/threads/:id/send", async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: "Message content cannot be empty." });
  }

  const thread = sqliteGetThreadById(req.params.id);
  if (!thread) {
    return res.status(404).json({ error: "Thread not found." });
  }

  const message: ChatMessage = {
    id: "msg_agent_" + Date.now(),
    threadId: thread.id,
    sender: "agent",
    content,
    timestamp: Date.now(),
  };

  sqliteAddMessage(message);
  sqliteUpdateThread(thread.id, {
    lastMessageText: content,
    lastMessageTime: Date.now(),
    unreadCount: 0,
    autoReplyActive: false,
  });

  if (
    memoryWhatsAppConfig.phoneNumberId &&
    memoryWhatsAppConfig.accessToken &&
    !memoryWhatsAppConfig.phoneNumberId.startsWith("12345")
  ) {
    try {
      const url = `https://graph.facebook.com/v25.0/${memoryWhatsAppConfig.phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${memoryWhatsAppConfig.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: thread.customerPhone.replace(/[^0-9+]/g, ""),
          type: "text",
          text: { body: content },
        }),
      });
      const data = await response.json();
      addLog("outbound", "WhatsApp API Manual Send", response.ok, `Sent manual message to ${thread.customerPhone}`, data);
    } catch (whError: any) {
      console.error("Failed to send real WhatsApp outbound payload:", whError);
      addLog("outbound", "WhatsApp API Send Error", false, `HTTP send fail to ${thread.customerPhone}`, {
        message: whError?.toString?.() || String(whError),
      });
    }
  }

  res.json({ success: true, message, thread: sqliteGetThreadById(thread.id) });
});

// -------------------------------------------------------------
// AI Draft Generation for a Thread
// -------------------------------------------------------------
threadRouter.post("/threads/:id/draft", async (req, res) => {
  const thread = sqliteGetThreadById(req.params.id);
  if (!thread) {
    return res.status(404).json({ error: "Thread not found." });
  }

  const messages = sqliteGetMessagesByThreadId(thread.id);
  const lastCustomerMessageObj = [...messages].reverse().find((m) => m.sender === "customer");
  const queryText = lastCustomerMessageObj ? lastCustomerMessageObj.content : "Hello!";

  const aiDraft = await generateAIResponseForMessage(queryText, messages, memoryProfile, memoryFaqs, thread.customerPhone);
  res.json({ success: true, draftText: aiDraft.replyText, aiDetails: aiDraft });
});

// -------------------------------------------------------------
// Sandbox Simulator (simulated inbound WhatsApp traffic)
// -------------------------------------------------------------
threadRouter.post("/simulate-incoming", async (req, res) => {
  const { customerPhone, customerName, messageText } = req.body;
  if (!customerPhone || !customerName || !messageText) {
    return res.status(400).json({ error: "SIMULATE error: phone, name, and text are required." });
  }

  const thread = sqliteUpsertThread(customerPhone, customerName, messageText);
  sqliteUpsertContact(customerPhone, customerName);
  syncContactToHubSpot(customerPhone, customerName, messageText).catch((err) =>
    console.error("[HubSpot] Sync failed:", err)
  );

  const customerMsg: ChatMessage = {
    id: "msg_cust_" + Date.now(),
    threadId: thread.id,
    sender: "customer",
    content: messageText,
    timestamp: Date.now(),
  };
  sqliteAddMessage(customerMsg);

  const history = sqliteGetMessagesByThreadId(thread.id);

  addLog("inbound", "Simulated Phone Message", true, `Received message: "${messageText}" from ${customerName}`, {
    sender: customerName,
    phone: customerPhone,
    text: messageText,
    timestamp: new Date().toISOString(),
  });

  let botResponseMsg: ChatMessage | null = null;
  const shouldAutoReply = memoryProfile.autoReplyEnabled && thread.autoReplyActive;
  const aiResult = await generateAIResponseForMessage(messageText, history, memoryProfile, memoryFaqs, thread.customerPhone);

  if (shouldAutoReply) {
    botResponseMsg = {
      id: "msg_bot_" + Date.now(),
      threadId: thread.id,
      sender: "agent",
      content: aiResult.replyText,
      timestamp: Date.now() + 1000,
      isAutoReplied: true,
      aiConfidence: aiResult.confidence,
      aiExplanation: aiResult.explanation,
    };

    sqliteAddMessage(botResponseMsg);
    sqliteUpdateThread(thread.id, {
      lastMessageText: aiResult.replyText,
      lastMessageTime: Date.now() + 1000,
      unreadCount: 0,
      status: "open",
    });

    addLog("outbound", "AI Auto-Reply Sent", true, `Auto-replied to ${customerName}: "${aiResult.replyText}"`, {
      ruleMatched: aiResult.explanation,
      confidence: aiResult.confidence,
      messageText: aiResult.replyText,
    });
  } else {
    sqliteUpdateThread(customerMsg.threadId, {
      lastMessageText: messageText,
      lastMessageTime: Date.now(),
    });
    customerMsg.draftResponse = aiResult.replyText;
    customerMsg.aiConfidence = aiResult.confidence;
    customerMsg.aiExplanation =
      aiResult.explanation +
      (shouldAutoReply
        ? " (Confidence below trigger threshold: " + Math.round(memoryProfile.minConfidence * 100) + "%)"
        : " (Auto-Reply is globally disabled)");

    addLog("outbound", "AI Response Drafted (Pending Agent Approval)", true, `Draft prepared for ${customerName}`, {
      explanation: customerMsg.aiExplanation,
      draft: aiResult.replyText,
    });
  }

  res.json({
    success: true,
    thread: sqliteGetThreadById(thread.id),
    receivedMessage: customerMsg,
    triggeredAutoReply: !!botResponseMsg,
    autoMessage: botResponseMsg,
    aiAnalysis: aiResult,
  });
});

// -------------------------------------------------------------
// Webhook Logs
// -------------------------------------------------------------
threadRouter.get("/webhook-logs", (req, res) => {
  res.json(memoryWebhookLogs);
});

// -------------------------------------------------------------
// Appointments
// -------------------------------------------------------------
threadRouter.get("/appointments", (req, res) => {
  res.json(getAppointments());
});

// -------------------------------------------------------------
// Contacts
// -------------------------------------------------------------
threadRouter.get("/contacts", (req, res) => {
  res.json(sqliteGetAllContacts());
});
