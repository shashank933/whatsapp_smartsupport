export interface WhatsAppConfig {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  verifyToken: string;
}

export interface BusinessProfile {
  name: string;
  industry: string;
  replyTone: 'professional' | 'friendly' | 'casual' | 'supportive';
  systemContext: string;
  autoReplyEnabled: boolean;
  minConfidence: number; // e.g. 0.8
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
}

export interface ChatThread {
  id: string;
  customerPhone: string;
  customerName: string;
  status: 'open' | 'pending' | 'resolved';
  lastMessageText: string;
  lastMessageTime: number;
  unreadCount: number;
  autoReplyActive: boolean;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  sender: 'customer' | 'agent' | 'system';
  content: string;
  timestamp: number;
  isAutoReplied?: boolean;
  aiConfidence?: number;
  aiExplanation?: string;
  draftResponse?: string;
}

export interface CannedResponse {
  id: string;
  shortcut: string; // e.g. "/welcome"
  text: string;
}

export interface WebhookLog {
  id: string;
  direction: 'inbound' | 'outbound' | 'verification';
  type: string;
  timestamp: number;
  success: boolean;
  summary: string;
  payload: string;
}
