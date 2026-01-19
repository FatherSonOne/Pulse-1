import { UnifiedMessage } from '../types';

/**
 * Twilio SMS Service
 * Browser-compatible Twilio integration using Twilio API
 */

export interface TwilioMessage {
  sid: string;
  from: string;
  to: string;
  body: string;
  dateCreated: string;
  dateSent: string;
  status: string;
  direction: 'inbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
}

export class TwilioService {
  private accountSid: string;
  private authToken: string;
  private proxyURL = 'http://localhost:3003/api/twilio/proxy';

  constructor(accountSid: string, authToken: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
  }

  /**
   * Make a Twilio API request through proxy server
   */
  private async twilioRequest(endpoint: string, params: Record<string, any> = {}) {
    const response = await fetch(this.proxyURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        accountSid: this.accountSid,
        authToken: this.authToken,
        params
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || data.error || 'Twilio API request failed');
    }
    return data;
  }

  /**
   * Format phone number for display
   */
  private formatPhoneNumber(phone: string): string {
    // Remove +1 country code for US numbers
    if (phone.startsWith('+1') && phone.length === 12) {
      const cleaned = phone.slice(2);
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  }

  /**
   * Extract name from phone number or use formatted number
   */
  private getSenderName(phone: string): string {
    // In a real app, you'd look this up in contacts
    return this.formatPhoneNumber(phone);
  }

  /**
   * Convert Twilio message to UnifiedMessage format
   */
  private convertToUnifiedMessage(twilioMsg: TwilioMessage): UnifiedMessage {
    const isInbound = twilioMsg.direction === 'inbound';
    const senderPhone = isInbound ? twilioMsg.from : twilioMsg.to;
    const timestamp = new Date(twilioMsg.dateSent || twilioMsg.dateCreated);

    return {
      id: `sms-${twilioMsg.sid}`,
      source: 'sms',
      type: 'text',
      content: twilioMsg.body,
      senderId: senderPhone,
      senderName: this.getSenderName(senderPhone),
      senderEmail: '', // SMS doesn't have email
      channelId: 'sms-inbox',
      channelName: 'SMS',
      timestamp: timestamp,
      conversationGraphId: senderPhone, // Group by phone number
      isRead: false,
      starred: false,
      tags: [twilioMsg.direction, twilioMsg.status],
      metadata: {
        twilioSid: twilioMsg.sid,
        from: twilioMsg.from,
        to: twilioMsg.to,
        direction: twilioMsg.direction,
        status: twilioMsg.status,
        formattedPhone: this.formatPhoneNumber(senderPhone),
      },
    };
  }

  /**
   * Get list of SMS messages from Twilio
   */
  async getMessages(limit: number = 50): Promise<UnifiedMessage[]> {
    try {
      const response = await this.twilioRequest('Messages.json', {
        PageSize: limit,
      });

      if (!response.messages || response.messages.length === 0) {
        return [];
      }

      const messages: UnifiedMessage[] = response.messages.map((msg: TwilioMessage) =>
        this.convertToUnifiedMessage(msg)
      );

      return messages;
    } catch (error) {
      console.error('Error fetching Twilio messages:', error);
      throw error;
    }
  }

  /**
   * Test Twilio connection
   */
  async testConnection(): Promise<{ success: boolean; phoneNumber?: string; error?: string }> {
    try {
      // Test by fetching account info
      const response = await this.twilioRequest('', {}); // Empty endpoint gets account info

      return {
        success: true,
        phoneNumber: response.friendly_name || this.accountSid,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get message count
   */
  async getMessageCount(): Promise<number> {
    try {
      const response = await this.twilioRequest('Messages.json', {
        PageSize: 1,
      });
      return response.total || 0;
    } catch (error) {
      console.error('Error getting message count:', error);
      return 0;
    }
  }
}
