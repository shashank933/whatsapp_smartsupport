import { Router } from "express";
import { ChatMessage } from "../../src/types";
import {
  memoryWhatsAppConfig,
  memoryProfile,
  memoryFaqs,
  addLog,
} from "../db/memoryStore";
import {
  sqliteUpsertThread,
  sqliteAddMessage,
  sqliteGetMessagesByThreadId,
  sqliteUpdateThread,
  sqliteUpsertContact,
} from "../db/sqliteStore";
import { generateAIResponseForMessage } from "../ai/responseEngine";
import { syncContactToHubSpot } from "../integrations/hubspot";
import { sseEmit } from "../sse";
import { normalizePhone } from "../utils/phone";

export const webhookRouter = Router();

// -------------------------------------------------------------
// Webhook Verification (Meta demands standard challenge handshake)
// -------------------------------------------------------------
webhookRouter.get("/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  addLog("verification", "Inbound Webhook Handshake", true, "Meta verification query received.", req.query);

  if (mode && token) {
    if (mode === "subscribe" && token === memoryWhatsAppConfig.verifyToken) {
      console.log("WHATSAPP_WEBHOOK: Verified successfully!");
      addLog("verification", "Webhook Successfully Verified", true, "Verify token matched Meta subscription requirements.", {
        mode,
        token,
      });
      return res.status(200).send(challenge);
    } else {
      console.warn("WHATSAPP_WEBHOOK: Token mismatch!");
      addLog("verification", "Webhook Verification Failed", false, "Verify token did NOT match configuration parameters.", {
        mode,
        token,
        expected: memoryWhatsAppConfig.verifyToken,
      });
      return res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// -------------------------------------------------------------
// Webhook Event Receiver (Standard Meta WhatsApp Event JSON Payload)
// -------------------------------------------------------------
webhookRouter.post("/whatsapp/webhook", async (req, res) => {
  const body = req.body;
  console.log("Inbound webhook raw data:", JSON.stringify(body, null, 2));

  if (body.object) {
    if (
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const message = body.entry[0].changes[0].value.messages[0];
      const customerPhone = "+" + normalizePhone(message.from);
      const customerName =
        body.entry[0].changes[0].value.contacts?.[0]?.profile?.name || `Customer (${customerPhone})`;
      const messageType = message.type;

      if (messageType === "text") {
        const messageText = message.text.body;
        addLog("inbound", "WhatsApp Live Message", true, `Live message: "${messageText}" from ${customerName}`, body);

        const thread = sqliteUpsertThread(customerPhone, customerName, messageText);
        sqliteUpsertContact(customerPhone, customerName);
        syncContactToHubSpot(customerPhone, customerName, messageText).catch((err) =>
          console.error("[HubSpot] Sync failed:", err)
        );

        const customerMsg: ChatMessage = {
          id: "msg_live_" + Date.now(),
          threadId: thread.id,
          sender: "customer",
          content: messageText,
          timestamp: Date.now(),
        };
        sqliteAddMessage(customerMsg);

        const history = sqliteGetMessagesByThreadId(thread.id);

        const aiResult = await generateAIResponseForMessage(messageText, history, memoryProfile, memoryFaqs, thread.customerPhone);
        const shouldAutoReply = memoryProfile.autoReplyEnabled && thread.autoReplyActive;

        if (shouldAutoReply) {
          const botResponseMsg: ChatMessage = {
            id: "msg_bot_" + Date.now(),
            threadId: thread.id,
            sender: "agent",
            content: aiResult.replyText,
            timestamp: Date.now(),
            isAutoReplied: true,
            aiConfidence: aiResult.confidence,
            aiExplanation: aiResult.explanation,
          };

          sqliteAddMessage(botResponseMsg);
          sqliteUpdateThread(thread.id, {
            lastMessageText: aiResult.replyText,
            lastMessageTime: Date.now(),
          });

          if (memoryWhatsAppConfig.phoneNumberId && memoryWhatsAppConfig.accessToken) {
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
                  to: customerPhone.replace("+", ""),
                  type: "text",
                  text: { body: aiResult.replyText },
                }),
              });
              const outputData = await response.json();
              addLog("outbound", "WhatsApp Cloud AI Send Active", response.ok, `Auto-response transmission initiated.`, outputData);
            } catch (postErr: any) {
              console.error("Meta post error:", postErr);
              addLog("outbound", "WhatsApp Cloud AI Send Error", false, `Failed to post to Cloud API: ${customerPhone}`, {
                message: postErr?.toString?.() || String(postErr),
              });
            }
          }
        } else {
          sqliteUpdateThread(customerMsg.threadId, {
            lastMessageText: messageText,
            lastMessageTime: Date.now(),
          });
          customerMsg.draftResponse = aiResult.replyText;
          customerMsg.aiConfidence = aiResult.confidence;
          customerMsg.aiExplanation =
            aiResult.explanation + (shouldAutoReply ? " (Confidence below reply threshold)" : " (Auto-reply disabled)");
        }
        sseEmit("refresh", { source: "webhook", threadId: thread.id });
      } else {
        addLog("inbound", "WhatsApp Live Message (Non-Text)", true, `Incoming non-text payload type: "${messageType}"`, body);
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(200);
    }
  } else {
    res.sendStatus(404);
  }
});