import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { normalizePhone } from "../utils/phone";
import {
  ChatThread,
  ChatMessage,
  Contact,
  BusinessProfile,
  FAQItem,
  WhatsAppConfig,
} from "../../src/types";
import {
  memoryThreads,
  memoryMessages,
  memoryFaqs,
  memoryProfile,
  memoryWhatsAppConfig,
} from "../db/memoryStore";

// -------------------------------------------------------------
// SQLite Database Initialization
// -------------------------------------------------------------
const DB_PATH = path.join(process.cwd(), "backend", "data", "support-agent.db");

function ensureDbDir(): void {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDbDir();
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma("foreign_keys = ON");

// -------------------------------------------------------------
// Schema Migration
// -------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    customerPhone TEXT UNIQUE NOT NULL,
    customerName TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    lastMessageText TEXT,
    lastMessageTime INTEGER NOT NULL,
    unreadCount INTEGER DEFAULT 0,
    autoReplyActive INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    threadId TEXT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    isAutoReplied INTEGER DEFAULT 0,
    aiConfidence REAL,
    aiExplanation TEXT,
    draftResponse TEXT,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (threadId) REFERENCES threads(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_messages_threadId ON messages(threadId)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_threads_customerPhone ON threads(customerPhone)
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone)
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    customerName TEXT NOT NULL,
    customerPhone TEXT NOT NULL,
    preferredDay TEXT NOT NULL,
    preferredTime TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    createdAt INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_appointments_phone ON appointments(customerPhone)
`);

// -------------------------------------------------------------
// Settings Persistence
// -------------------------------------------------------------
export function sqliteLoadWhatsAppConfig(): WhatsAppConfig | null {
  try {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get("whatsapp_config") as any;
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (parsed.phoneNumberId && parsed.accessToken && parsed.verifyToken) {
        return parsed as WhatsAppConfig;
      }
    }
  } catch (e) {
    console.warn("[SQLite] Failed to load WhatsApp config:", e);
  }
  return null;
}

export function sqliteSaveWhatsAppConfig(config: WhatsAppConfig): void {
  const json = JSON.stringify(config);
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run("whatsapp_config", json);
  console.log("[SQLite] WhatsApp config saved.");
}

// -------------------------------------------------------------
// Seed existing in-memory data if tables are empty
// -------------------------------------------------------------
const threadCount = db.prepare("SELECT COUNT(*) as cnt FROM threads").get() as any;
const msgCount = db.prepare("SELECT COUNT(*) as cnt FROM messages").get() as any;

if (threadCount.cnt === 0 && msgCount === 0 && memoryThreads.length > 0) {
  const insertThread = db.prepare(
    `INSERT INTO threads (id, customerPhone, customerName, status, lastMessageText, lastMessageTime, unreadCount, autoReplyActive, createdAt, updatedAt)
     VALUES (@id, @customerPhone, @customerName, @status, @lastMessageText, @lastMessageTime, @unreadCount, @autoReplyActive, @createdAt, @updatedAt)`
  );
  const insertMessage = db.prepare(
    `INSERT INTO messages (id, threadId, sender, content, timestamp, isAutoReplied, aiConfidence, aiExplanation, draftResponse, createdAt)
     VALUES (@id, @threadId, @sender, @content, @timestamp, @isAutoReplied, @aiConfidence, @aiExplanation, @draftResponse, @createdAt)`
  );

  const tx = db.transaction(() => {
    for (const thread of memoryThreads) {
      insertThread.run({
        id: thread.id,
        customerPhone: thread.customerPhone,
        customerName: thread.customerName,
        status: thread.status,
        lastMessageText: thread.lastMessageText,
        lastMessageTime: thread.lastMessageTime,
        unreadCount: thread.unreadCount,
        autoReplyActive: thread.autoReplyActive ? 1 : 0,
        createdAt: thread.lastMessageTime - 3600000,
        updatedAt: thread.lastMessageTime,
      });
    }
    for (const msg of memoryMessages) {
      insertMessage.run({
        id: msg.id,
        threadId: msg.threadId,
        sender: msg.sender,
        content: msg.content,
        timestamp: msg.timestamp,
        isAutoReplied: msg.isAutoReplied ? 1 : 0,
        aiConfidence: msg.aiConfidence ?? null,
        aiExplanation: msg.aiExplanation ?? null,
        draftResponse: msg.draftResponse ?? null,
        createdAt: msg.timestamp,
      });
    }
  });
  tx();
  console.log(`[SQLite] Seeded ${memoryThreads.length} threads and ${memoryMessages.length} messages.`);
}

// -------------------------------------------------------------
// Thread Operations
// -------------------------------------------------------------
export function sqliteGetAllThreads(status?: string): ChatThread[] {
  let query = `SELECT id, customerPhone, customerName, status, lastMessageText, lastMessageTime, unreadCount, autoReplyActive,
          createdAt, updatedAt
   FROM threads`;
  const params: any[] = [];

  if (status) {
    query += ` WHERE status = ?`;
    params.push(status);
  }

  query += ` ORDER BY lastMessageTime DESC`;

  const rows = db.prepare(query).all(...params) as any[];

  return rows.map((r) => ({
    id: r.id,
    customerPhone: r.customerPhone,
    customerName: r.customerName,
    status: r.status as ChatThread["status"],
    lastMessageText: r.lastMessageText,
    lastMessageTime: r.lastMessageTime,
    unreadCount: r.unreadCount,
    autoReplyActive: Boolean(r.autoReplyActive),
  }));
}

export function sqliteGetThreadById(threadId: string): ChatThread | undefined {
  const row = db.prepare(
    `SELECT id, customerPhone, customerName, status, lastMessageText, lastMessageTime, unreadCount, autoReplyActive,
            createdAt, updatedAt
     FROM threads WHERE id = ?`
  ).get(threadId) as any | undefined;

  if (!row) return undefined;
  return {
    id: row.id,
    customerPhone: row.customerPhone,
    customerName: row.customerName,
    status: row.status as ChatThread["status"],
    lastMessageText: row.lastMessageText,
    lastMessageTime: row.lastMessageTime,
    unreadCount: row.unreadCount,
    autoReplyActive: Boolean(row.autoReplyActive),
  };
}

export function sqliteGetThreadByPhone(customerPhone: string): ChatThread | undefined {
  const row = db.prepare(
    `SELECT id, customerPhone, customerName, status, lastMessageText, lastMessageTime, unreadCount, autoReplyActive,
            createdAt, updatedAt
     FROM threads WHERE customerPhone = ?`
  ).get(customerPhone) as any | undefined;

  if (!row) return undefined;
  return {
    id: row.id,
    customerPhone: row.customerPhone,
    customerName: row.customerName,
    status: row.status as ChatThread["status"],
    lastMessageText: row.lastMessageText,
    lastMessageTime: row.lastMessageTime,
    unreadCount: row.unreadCount,
    autoReplyActive: Boolean(row.autoReplyActive),
  };
}

export function sqliteCreateThread(thread: ChatThread): ChatThread {
  const now = Date.now();
  db.prepare(
    `INSERT INTO threads (id, customerPhone, customerName, status, lastMessageText, lastMessageTime, unreadCount, autoReplyActive, createdAt, updatedAt)
     VALUES (@id, @customerPhone, @customerName, @status, @lastMessageText, @lastMessageTime, @unreadCount, @autoReplyActive, @createdAt, @updatedAt)`
  ).run({
    id: thread.id,
    customerPhone: thread.customerPhone,
    customerName: thread.customerName,
    status: thread.status,
    lastMessageText: thread.lastMessageText,
    lastMessageTime: thread.lastMessageTime,
    unreadCount: thread.unreadCount,
    autoReplyActive: thread.autoReplyActive ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });
  return thread;
}

export function sqliteUpdateThread(threadId: string, updates: Partial<Pick<ChatThread, "status" | "lastMessageText" | "lastMessageTime" | "unreadCount" | "autoReplyActive">>): ChatThread | undefined {
  const existing = sqliteGetThreadById(threadId);
  if (!existing) return undefined;

  const now = Date.now();
  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.status !== undefined) { setClauses.push("status = ?"); values.push(updates.status); }
  if (updates.lastMessageText !== undefined) { setClauses.push("lastMessageText = ?"); values.push(updates.lastMessageText); }
  if (updates.lastMessageTime !== undefined) { setClauses.push("lastMessageTime = ?"); values.push(updates.lastMessageTime); }
  if (updates.unreadCount !== undefined) { setClauses.push("unreadCount = ?"); values.push(updates.unreadCount); }
  if (updates.autoReplyActive !== undefined) { setClauses.push("autoReplyActive = ?"); values.push(updates.autoReplyActive ? 1 : 0); }
  setClauses.push("updatedAt = ?");
  values.push(now);
  values.push(threadId);

  db.prepare(`UPDATE threads SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
  return sqliteGetThreadById(threadId);
}

export function sqliteArchiveThread(threadId: string): ChatThread | undefined {
  return sqliteUpdateThread(threadId, { status: "archived" });
}

export function sqliteDeleteThread(threadId: string): boolean {
  const existing = sqliteGetThreadById(threadId);
  if (!existing) return false;

  db.prepare(`DELETE FROM messages WHERE threadId = ?`).run(threadId);
  db.prepare(`DELETE FROM threads WHERE id = ?`).run(threadId);

  console.log(`[SQLite] Thread deleted: ${threadId} (${existing.customerName})`);
  return true;
}

export function sqliteUpsertThread(phone: string, name: string, messageText: string): ChatThread {
  const normalizedPhone = normalizePhone(phone);
  const existing = sqliteGetThreadByPhone(normalizedPhone);
  const now = Date.now();

  if (!existing) {
    const newThread: ChatThread = {
      id: "thread_" + Date.now(),
      customerPhone: normalizedPhone,
      customerName: name,
      status: "open",
      lastMessageText: messageText,
      lastMessageTime: now,
      unreadCount: 1,
      autoReplyActive: true,
    };
    sqliteCreateThread(newThread);
    return newThread;
  }

  sqliteUpdateThread(existing.id, {
    lastMessageText: messageText,
    lastMessageTime: now,
    unreadCount: existing.unreadCount + 1,
    status: "open",
  });
  return sqliteGetThreadById(existing.id)!;
}

// -------------------------------------------------------------
// Message Operations
// -------------------------------------------------------------
export function sqliteAddMessage(message: ChatMessage): ChatMessage {
  db.prepare(
    `INSERT INTO messages (id, threadId, sender, content, timestamp, isAutoReplied, aiConfidence, aiExplanation, draftResponse, createdAt)
     VALUES (@id, @threadId, @sender, @content, @timestamp, @isAutoReplied, @aiConfidence, @aiExplanation, @draftResponse, @createdAt)`
  ).run({
    id: message.id,
    threadId: message.threadId,
    sender: message.sender,
    content: message.content,
    timestamp: message.timestamp,
    isAutoReplied: message.isAutoReplied ? 1 : 0,
    aiConfidence: message.aiConfidence ?? null,
    aiExplanation: message.aiExplanation ?? null,
    draftResponse: message.draftResponse ?? null,
    createdAt: message.timestamp,
  });
  return message;
}

export function sqliteGetMessagesByThreadId(threadId: string): ChatMessage[] {
  const rows = db.prepare(
    `SELECT id, threadId, sender, content, timestamp, isAutoReplied, aiConfidence, aiExplanation, draftResponse, createdAt
     FROM messages
     WHERE threadId = ?
     ORDER BY timestamp ASC`
  ).all(threadId) as any[];

  return rows.map((r) => ({
    id: r.id,
    threadId: r.threadId,
    sender: r.sender as ChatMessage["sender"],
    content: r.content,
    timestamp: r.timestamp,
    isAutoReplied: Boolean(r.isAutoReplied),
    aiConfidence: r.aiConfidence ?? undefined,
    aiExplanation: r.aiExplanation ?? undefined,
    draftResponse: r.draftResponse ?? undefined,
  }));
}

// -------------------------------------------------------------
// Customer Context Builder
// -------------------------------------------------------------
export interface CustomerContext {
  customerName: string;
  customerPhone: string;
  threadId: string;
  threadStatus: string;
  autoReplyActive: boolean;
  recentMessages: Array<{ sender: string; content: string; timestamp: number }>;
  messageCount: number;
  pastAppointments: Array<{ day: string; time: string; timestamp: number }>;
  hasEmergencyHistory: boolean;
  hasBookingHistory: boolean;
}

export function buildCustomerContext(customerPhone: string): CustomerContext | null {
  const thread = sqliteGetThreadByPhone(customerPhone);
  if (!thread) return null;

  const messages = sqliteGetMessagesByThreadId(thread.id);
  const recentMessages = messages.slice(-10).map((m) => ({
    sender: m.sender,
    content: m.content,
    timestamp: m.timestamp,
  }));

  // Check for emergency/booking in history
  const hasEmergencyHistory = messages.some((m) => {
    const lower = m.content.toLowerCase();
    return (
      lower.includes("pain") ||
      lower.includes("emergency") ||
      lower.includes("bleeding") ||
      lower.includes("accident") ||
      lower.includes(" severe") ||
      lower.includes("فقدان") ||
      lower.includes("ألم") ||
      lower.includes("طوارئ") ||
      lower.includes("نزيف")
    );
  });

  const hasBookingHistory = messages.some((m) => {
    const lower = m.content.toLowerCase();
    return (
      lower.includes("book") ||
      lower.includes("appointment") ||
      lower.includes("حجز") ||
      lower.includes("موعد") ||
      lower.includes("sunday") ||
      lower.includes("monday") ||
      lower.includes("tuesday") ||
      lower.includes("wednesday") ||
      lower.includes("thursday") ||
      lower.includes("saturday")
    );
  });

  // Find past appointments for this customer
  const apptRows = db.prepare(
    `SELECT preferredDay, preferredTime, createdAt FROM appointments WHERE customerPhone = ? ORDER BY createdAt DESC`
  ).all(customerPhone) as any[];

  const pastAppointments = apptRows.map((a) => ({
    day: a.preferredDay,
    time: a.preferredTime,
    timestamp: a.createdAt,
  }));

  return {
    customerName: thread.customerName,
    customerPhone: thread.customerPhone,
    threadId: thread.id,
    threadStatus: thread.status,
    autoReplyActive: thread.autoReplyActive,
    recentMessages,
    messageCount: messages.length,
    pastAppointments,
    hasEmergencyHistory,
    hasBookingHistory,
  };
}

export function buildContextPrompt(context: CustomerContext): string {
  let prompt = `CUSTOMER HISTORY CONTEXT:\n`;
  prompt += `- Name: ${context.customerName}\n`;
  prompt += `- Phone: ${context.customerPhone}\n`;
  prompt += `- Total messages exchanged: ${context.messageCount}\n`;
  prompt += `- Thread status: ${context.threadStatus}\n`;
  prompt += `- Auto-reply active: ${context.autoReplyActive}\n`;

  if (context.pastAppointments.length > 0) {
    prompt += `- Past appointments: ${context.pastAppointments.map(a => `${a.day} at ${a.time}`).join(", ")}\n`;
  }

  if (context.hasEmergencyHistory) {
    prompt += `- NOTE: This customer has previously mentioned emergency-related symptoms. Be extra attentive to safety.\n`;
  }

  if (context.hasBookingHistory) {
    prompt += `- NOTE: This customer has previously discussed booking appointments.\n`;
  }

  if (context.recentMessages.length > 0) {
    prompt += `\nRECENT CONVERSATION (last ${Math.min(context.recentMessages.length, 10)} messages):\n`;
    context.recentMessages.forEach((m) => {
      prompt += `${m.sender === "customer" ? "Customer" : "Agent"}: "${m.content}"\n`;
    });
  }

  return prompt;
}

// -------------------------------------------------------------
// Contact Operations
// -------------------------------------------------------------
export function sqliteGetAllContacts(): Contact[] {
  const rows = db.prepare(
    `SELECT id, phone, name, createdAt, updatedAt FROM contacts ORDER BY name ASC`
  ).all() as any[];

  return rows.map((r) => ({
    id: r.id,
    phone: r.phone,
    name: r.name,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export function sqliteGetContactByPhone(phone: string): Contact | undefined {
  const row = db.prepare(
    `SELECT id, phone, name, createdAt, updatedAt FROM contacts WHERE phone = ?`
  ).get(phone) as any | undefined;

  if (!row) return undefined;
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function sqliteUpsertContact(phone: string, name: string): Contact {
  const normalizedPhone = normalizePhone(phone);
  const existing = sqliteGetContactByPhone(normalizedPhone);
  const now = Date.now();

  if (existing) {
    db.prepare(
      `UPDATE contacts SET name = ?, updatedAt = ? WHERE phone = ?`
    ).run(name, now, normalizedPhone);
    return sqliteGetContactByPhone(normalizedPhone)!;
  }

  const contact: Contact = {
    id: "contact_" + Date.now(),
    phone: normalizedPhone,
    name,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(
    `INSERT INTO contacts (id, phone, name, createdAt, updatedAt)
     VALUES (@id, @phone, @name, @createdAt, @updatedAt)`
  ).run({
    id: contact.id,
    phone: contact.phone,
    name: contact.name,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  });

  console.log(`[Contacts] New contact created: ${name} (${phone})`);
  return contact;
}

// Migration: add serviceType column if not present
try {
  const cols = db.prepare("PRAGMA table_info(appointments)").all() as any[];
  if (!cols.some((c: any) => c.name === "serviceType")) {
    db.exec("ALTER TABLE appointments ADD COLUMN serviceType TEXT DEFAULT 'Check-up'");
    console.log("[SQLite] Added serviceType column to appointments.");
  }
} catch (e) {
  console.warn("[SQLite] Migration for serviceType skipped:", e);
}

// -------------------------------------------------------------
// Appointment Operations
// -------------------------------------------------------------
export interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  preferredDay: string;
  preferredTime: string;
  serviceType: string;
  status: "confirmed" | "cancelled";
  createdAt: number;
}

export function sqliteAddAppointment(
  customerName: string,
  customerPhone: string,
  preferredDay: string,
  preferredTime: string,
  serviceType?: string
): Appointment {
  const appt: Appointment = {
    id: "appt_" + Date.now(),
    customerName,
    customerPhone,
    preferredDay,
    preferredTime,
    serviceType: serviceType || "Check-up",
    status: "confirmed",
    createdAt: Date.now(),
  };

  db.prepare(
    `INSERT INTO appointments (id, customerName, customerPhone, preferredDay, preferredTime, serviceType, status, createdAt)
     VALUES (@id, @customerName, @customerPhone, @preferredDay, @preferredTime, @serviceType, @status, @createdAt)`
  ).run({
    id: appt.id,
    customerName: appt.customerName,
    customerPhone: appt.customerPhone,
    preferredDay: appt.preferredDay,
    preferredTime: appt.preferredTime,
    serviceType: appt.serviceType,
    status: appt.status,
    createdAt: appt.createdAt,
  });

  console.log(`[Appointments] Booked: ${customerName} — ${preferredDay} at ${preferredTime}`);
  return appt;
}

export function sqliteGetAllAppointments(): Appointment[] {
  const rows = db.prepare(
    `SELECT id, customerName, customerPhone, preferredDay, preferredTime, serviceType, status, createdAt
     FROM appointments ORDER BY createdAt DESC`
  ).all() as any[];

  return rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    preferredDay: r.preferredDay,
    preferredTime: r.preferredTime,
    serviceType: r.serviceType || "Check-up",
    status: r.status as Appointment["status"],
    createdAt: r.createdAt,
  }));
}

export function sqliteGetAppointmentsByPhoneDay(phone: string, day: string): Appointment[] {
  const normalizedPhone = normalizePhone(phone);
  const rows = db.prepare(
    `SELECT id, customerName, customerPhone, preferredDay, preferredTime, serviceType, status, createdAt
     FROM appointments WHERE customerPhone = ? AND preferredDay = ? AND status = 'confirmed'`
  ).all(normalizedPhone, day) as any[];

  return rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    preferredDay: r.preferredDay,
    preferredTime: r.preferredTime,
    serviceType: r.serviceType || "Check-up",
    status: r.status as Appointment["status"],
    createdAt: r.createdAt,
  }));
}

export function sqliteGetAllAppointmentsByPhone(phone: string): Appointment[] {
  const normalizedPhone = normalizePhone(phone);
  const rows = db.prepare(
    `SELECT id, customerName, customerPhone, preferredDay, preferredTime, serviceType, status, createdAt
     FROM appointments WHERE customerPhone = ? AND status = 'confirmed'
     ORDER BY createdAt DESC`
  ).all(normalizedPhone) as any[];

  return rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    preferredDay: r.preferredDay,
    preferredTime: r.preferredTime,
    serviceType: r.serviceType || "Check-up",
    status: r.status as Appointment["status"],
    createdAt: r.createdAt,
  }));
}

export function sqliteGetAllAppointmentsByPhoneAll(phone: string): Appointment[] {
  const normalizedPhone = normalizePhone(phone);
  const rows = db.prepare(
    `SELECT id, customerName, customerPhone, preferredDay, preferredTime, serviceType, status, createdAt
     FROM appointments WHERE customerPhone = ?
     ORDER BY createdAt DESC`
  ).all(normalizedPhone) as any[];

  return rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    preferredDay: r.preferredDay,
    preferredTime: r.preferredTime,
    serviceType: r.serviceType || "Check-up",
    status: r.status as Appointment["status"],
    createdAt: r.createdAt,
  }));
}

export function sqliteCancelAppointment(apptId: string): boolean {
  const result = db.prepare(
    `UPDATE appointments SET status = 'cancelled' WHERE id = ? AND status = 'confirmed'`
  ).run(apptId);
  if (result.changes > 0) {
    console.log(`[Appointments] Cancelled: ${apptId}`);
    return true;
  }
  return false;
}

export function sqliteDeleteAppointment(apptId: string): boolean {
  const result = db.prepare(`DELETE FROM appointments WHERE id = ?`).run(apptId);
  if (result.changes > 0) {
    console.log(`[Appointments] Deleted: ${apptId}`);
    return true;
  }
  return false;
}
