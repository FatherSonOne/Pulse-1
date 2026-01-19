// src/types/sms.ts
// SMS messaging type definitions

export interface SMSMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  timestamp: Date;
  twilioSid?: string;
}

export interface SMSConversation {
  id: string;
  phoneNumber: string;
  contactName?: string;
  messages: SMSMessage[];
  lastMessageAt: Date;
  unreadCount: number;
  isArchived: boolean;
}

export interface SMSContact {
  phoneNumber: string;
  name: string;
  avatarColor?: string;
}

export interface SendSMSRequest {
  to: string;
  body: string;
}

export interface SendSMSResponse {
  success: boolean;
  message?: SMSMessage;
  error?: string;
}
