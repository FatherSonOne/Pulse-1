// Native SMS Service for Capacitor Android
// Handles sending SMS via native device capabilities and syncing messages

import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

export interface NativeSmsMessage {
  id: string;
  phone_number: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  timestamp: Date;
  contact_name?: string;
  user_id?: string;
  synced_at?: string;
}

export interface NativeSmsConversation {
  id: string;
  phone_number: string;
  contact_name?: string;
  last_message_at: Date;
  last_message_preview: string;
  unread_count: number;
  messages: NativeSmsMessage[];
}

class NativeSmsService {
  /**
   * Check if we're running on a native platform that can send SMS
   */
  canSendSms(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Check if we're on a platform that can only view SMS (not send)
   */
  isViewOnly(): boolean {
    return !Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'web';
  }

  /**
   * Send SMS using native device SMS intent
   * This opens the native SMS app with the message pre-filled
   */
  async sendSms(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
    if (!this.canSendSms()) {
      return { success: false, error: 'SMS sending is only available on mobile devices' };
    }

    try {
      // Format phone number
      const formattedNumber = this.formatPhoneNumber(phoneNumber);

      // Use the native SMS intent via URL scheme
      // This opens the default SMS app with the message pre-filled
      const smsUrl = `sms:${formattedNumber}?body=${encodeURIComponent(message)}`;

      // Open the SMS app
      window.location.href = smsUrl;

      // Log the outbound message for sync
      await this.logOutboundMessage(formattedNumber, message);

      return { success: true };
    } catch (error: any) {
      console.error('Failed to send SMS:', error);
      return { success: false, error: error.message || 'Failed to open SMS app' };
    }
  }

  /**
   * Log an outbound message for syncing to other devices
   */
  private async logOutboundMessage(phoneNumber: string, body: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('sms_messages').insert({
        user_id: user.id,
        phone_number: phoneNumber,
        body: body,
        direction: 'outbound',
        status: 'sent',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log SMS message:', error);
    }
  }

  /**
   * Get synced SMS conversations from Supabase
   * These are messages synced from mobile devices for viewing on PC
   */
  async getSyncedConversations(): Promise<NativeSmsConversation[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: messages, error } = await supabase
        .from('sms_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!messages || messages.length === 0) return [];

      // Group messages by phone number into conversations
      const conversationMap = new Map<string, NativeSmsConversation>();

      for (const msg of messages) {
        const key = msg.phone_number;

        if (!conversationMap.has(key)) {
          conversationMap.set(key, {
            id: key,
            phone_number: key,
            contact_name: msg.contact_name,
            last_message_at: new Date(msg.timestamp),
            last_message_preview: msg.body.slice(0, 50),
            unread_count: 0,
            messages: []
          });
        }

        const conv = conversationMap.get(key)!;
        conv.messages.push({
          id: msg.id,
          phone_number: msg.phone_number,
          body: msg.body,
          direction: msg.direction,
          status: msg.status,
          timestamp: new Date(msg.timestamp),
          contact_name: msg.contact_name,
          user_id: msg.user_id,
          synced_at: msg.synced_at
        });
      }

      // Sort messages within each conversation
      conversationMap.forEach(conv => {
        conv.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      });

      return Array.from(conversationMap.values())
        .sort((a, b) => b.last_message_at.getTime() - a.last_message_at.getTime());
    } catch (error) {
      console.error('Failed to get synced conversations:', error);
      return [];
    }
  }

  /**
   * Get a single synced conversation
   */
  async getSyncedConversation(phoneNumber: string): Promise<NativeSmsConversation | null> {
    const conversations = await this.getSyncedConversations();
    return conversations.find(c => c.phone_number === phoneNumber) || null;
  }

  /**
   * Format phone number for display
   */
  formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // Format as US number if 10 digits
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    // Format as US number with country code if 11 digits starting with 1
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }

    // Return original with + prefix for international
    if (!phone.startsWith('+') && digits.length > 10) {
      return '+' + digits;
    }

    return phone;
  }

  /**
   * Get a deterministic color for a phone number (for avatar)
   */
  getContactColor(phone: string): string {
    const colors = [
      '#ef4444', '#f97316', '#eab308', '#22c55e',
      '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'
    ];
    const hash = phone.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  /**
   * Get initials from a name or phone number
   */
  getInitials(name: string | undefined, phone: string): string {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    // Use last 2 digits of phone
    const digits = phone.replace(/\D/g, '');
    return digits.slice(-2);
  }

  /**
   * Check if a phone number belongs to a Pulse user
   */
  async isPulseUser(phoneNumber: string): Promise<{ isPulse: boolean; userId?: string }> {
    try {
      const formattedNumber = phoneNumber.replace(/\D/g, '');

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('phone', formattedNumber)
        .single();

      if (error || !data) {
        return { isPulse: false };
      }

      return { isPulse: true, userId: data.id };
    } catch {
      return { isPulse: false };
    }
  }
}

export const nativeSmsService = new NativeSmsService();
