// src/services/smsService.ts
// SMS service layer - ready for real Twilio integration

import { SMSConversation, SMSMessage, SendSMSResponse } from '../types/sms';

// In-memory storage for SMS data (will be replaced with real Twilio integration)
let conversations: SMSConversation[] = [];
let messagesMap: Map<string, SMSMessage[]> = new Map();

// Helper functions
const generateId = () => Math.random().toString(36).substring(2, 15);

const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

const getContactColor = (phone: string): string => {
  const colors = ['#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
  const hash = phone.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

const getContactName = (phone: string): string => {
  // In a real app, this would look up from contacts
  return formatPhoneNumber(phone);
};

export const smsService = {
  /**
   * Check if SMS is running in mock mode
   */
  isMockMode: (): boolean => {
    // Will be false when real Twilio is integrated
    return true;
  },

  /**
   * Get all SMS conversations
   */
  getConversations(): SMSConversation[] {
    return conversations;
  },

  /**
   * Get a specific conversation by ID
   */
  getConversation(conversationId: string): SMSConversation | undefined {
    return conversations.find(c => c.id === conversationId);
  },

  /**
   * Get messages for a conversation
   */
  getMessages(conversationId: string): SMSMessage[] {
    return messagesMap.get(conversationId) || [];
  },

  /**
   * Send an SMS message
   */
  async sendMessage(conversationId: string, body: string): Promise<SendSMSResponse> {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) {
      return { success: false, error: 'Conversation not found' };
    }

    const message: SMSMessage = {
      id: generateId(),
      conversationId,
      body,
      direction: 'outbound',
      status: 'sent',
      timestamp: new Date().toISOString(),
    };

    const conversationMessages = messagesMap.get(conversationId) || [];
    conversationMessages.push(message);
    messagesMap.set(conversationId, conversationMessages);

    // Update conversation
    conversation.lastMessage = body;
    conversation.lastMessageTime = message.timestamp;

    // Simulate delivery status update
    setTimeout(() => {
      message.status = 'delivered';
    }, 1000);

    return { success: true, message };
  },

  /**
   * Create a new conversation and optionally send first message
   */
  async createConversation(phoneNumber: string, initialMessage?: string): Promise<SMSConversation> {
    const id = generateId();
    const now = new Date().toISOString();

    const conversation: SMSConversation = {
      id,
      phoneNumber,
      contactName: getContactName(phoneNumber),
      contactColor: getContactColor(phoneNumber),
      lastMessage: initialMessage || '',
      lastMessageTime: now,
      unreadCount: 0,
      isArchived: false,
    };

    conversations.unshift(conversation);
    messagesMap.set(id, []);

    if (initialMessage) {
      await this.sendMessage(id, initialMessage);
    }

    return conversation;
  },

  /**
   * Mark a conversation as read
   */
  markAsRead(conversationId: string): void {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      conversation.unreadCount = 0;
    }
  },

  /**
   * Get total unread message count across all conversations
   */
  getUnreadCount(): number {
    return conversations.reduce((total, c) => total + c.unreadCount, 0);
  },

  /**
   * Delete a conversation
   */
  deleteConversation(conversationId: string): void {
    conversations = conversations.filter(c => c.id !== conversationId);
    messagesMap.delete(conversationId);
  },

  /**
   * Archive a conversation
   */
  archiveConversation(conversationId: string): void {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      conversation.isArchived = true;
    }
  },

  /**
   * Simulate an incoming message (for testing purposes only)
   */
  simulateIncomingMessage(conversationId: string, body: string): SMSMessage {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const message: SMSMessage = {
      id: generateId(),
      conversationId,
      body,
      direction: 'inbound',
      status: 'received',
      timestamp: new Date().toISOString(),
    };

    const conversationMessages = messagesMap.get(conversationId) || [];
    conversationMessages.push(message);
    messagesMap.set(conversationId, conversationMessages);

    conversation.lastMessage = body;
    conversation.lastMessageTime = message.timestamp;
    conversation.unreadCount++;

    return message;
  },

  /**
   * Get contact name for a phone number
   */
  getContactName,

  /**
   * Get contact avatar color for a phone number
   */
  getContactColor,

  /**
   * Format phone number for display
   */
  formatPhoneNumber,
};

export default smsService;
