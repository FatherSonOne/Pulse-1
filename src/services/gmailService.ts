import { UnifiedMessage } from '../types';
import { supabase } from './supabase';

/**
 * Gmail Service
 * Browser-compatible Gmail integration using Gmail API
 * Uses Supabase OAuth token for authentication
 */

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ mimeType: string; body?: { data?: string } }>;
  };
  internalDate: string;
  labelIds?: string[];
}

export interface GmailDraft {
  id: string;
  message: GmailMessage;
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  content: string; // Base64 encoded content
  size: number;
}

export interface SendEmailParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  threadId?: string; // For replies
  inReplyTo?: string; // Message-ID header for threading
  attachments?: EmailAttachment[];
}

export class GmailService {
  private accessToken: string | null = null;
  private userEmail: string | null = null;
  private tokenRefreshAttempted = false;
  private tokenExpiresAt: number | null = null;

  constructor(accessToken?: string) {
    if (accessToken) {
      this.accessToken = accessToken;
    }
  }

  /**
   * Refresh Google access token using the refresh token
   * This is needed because Supabase doesn't automatically refresh Google's provider_token
   */
  private async refreshGoogleToken(refreshToken: string): Promise<string | null> {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId || !refreshToken) {
      console.warn('[GmailService] Missing client ID or refresh token for Google token refresh');
      return null;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[GmailService] Google token refresh failed:', errorData);
        return null;
      }

      const data = await response.json();

      if (data.access_token) {
        console.log('[GmailService] Successfully refreshed Google access token');
        this.accessToken = data.access_token;
        // Set expiry (Google tokens typically last 3600 seconds/1 hour)
        this.tokenExpiresAt = Date.now() + ((data.expires_in || 3600) * 1000) - 60000; // Refresh 1 min early
        return data.access_token;
      }

      return null;
    } catch (error) {
      console.error('[GmailService] Error refreshing Google token:', error);
      return null;
    }
  }

  /**
   * Check if the current token is expired or about to expire
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return false; // Unknown expiry, try using it
    return Date.now() >= this.tokenExpiresAt;
  }

  /**
   * Get the access token from Supabase session
   */
  private async getAccessToken(forceRefresh = false): Promise<string> {
    // Return cached token if valid and not forcing refresh
    if (this.accessToken && !forceRefresh && !this.isTokenExpired()) {
      return this.accessToken;
    }

    // Try to get a fresh session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error('Your Google session has expired. Please sign out and sign back in with Google.');
    }

    // If we have a provider_token and it hasn't expired (or we don't know), use it
    if (session?.provider_token && !forceRefresh) {
      this.accessToken = session.provider_token;
      return this.accessToken;
    }

    // Try to refresh using Google's refresh token
    const refreshToken = (session as any)?.provider_refresh_token;
    if (refreshToken) {
      const newToken = await this.refreshGoogleToken(refreshToken);
      if (newToken) {
        return newToken;
      }
    }

    // Last resort: try Supabase session refresh (this refreshes Supabase token, not Google's)
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !refreshData.session?.provider_token) {
      // Create a specific error that can be caught gracefully by callers
      const error = new Error('Your Google session has expired. Please sign out and sign back in with Google.');
      (error as any).isSessionExpired = true;
      (error as any).code = 'GOOGLE_SESSION_EXPIRED';
      throw error;
    }

    this.accessToken = refreshData.session.provider_token;
    return this.accessToken;
  }

  /**
   * Clear cached token (call on auth errors to force refresh)
   */
  clearToken(): void {
    this.accessToken = null;
    this.tokenRefreshAttempted = false;
    this.tokenExpiresAt = null;
  }

  /**
   * Make a direct Gmail API request with automatic token refresh on 401
   */
  private async gmailRequest(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      params?: Record<string, any>;
    } = {}
  ): Promise<any> {
    const token = await this.getAccessToken();
    const { method = 'GET', body, params } = options;

    let url = `https://gmail.googleapis.com/gmail/v1/${endpoint}`;

    // Add query params
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      }
      url += `?${searchParams.toString()}`;
    }

    const makeRequest = async (authToken: string) => {
      return fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    };

    let response = await makeRequest(token);

    // If 401 Unauthorized, try refreshing the Google token once
    if (response.status === 401 && !this.tokenRefreshAttempted) {
      console.log('[GmailService] Got 401, attempting Google token refresh...');
      this.tokenRefreshAttempted = true;
      this.accessToken = null;
      this.tokenExpiresAt = null;

      try {
        const newToken = await this.getAccessToken(true);
        response = await makeRequest(newToken);
        this.tokenRefreshAttempted = false; // Reset on success
        console.log('[GmailService] Token refresh successful, request retried');
      } catch (refreshError) {
        this.tokenRefreshAttempted = false;
        // Don't log as error since this is handled gracefully by callers
        const error = new Error('Your Google session has expired. Please sign out and sign back in.');
        (error as any).isSessionExpired = true;
        (error as any).code = 'GOOGLE_SESSION_EXPIRED';
        throw error;
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Gmail API error: ${response.status}`;

      // Provide user-friendly messages for common errors
      if (response.status === 401) {
        const error = new Error('Your Google session has expired. Please sign out and sign back in.');
        (error as any).isSessionExpired = true;
        (error as any).code = 'GOOGLE_SESSION_EXPIRED';
        throw error;
      }
      if (response.status === 403) {
        throw new Error('Permission denied. Please ensure Gmail access is enabled for this app.');
      }

      throw new Error(errorMessage);
    }

    // Some endpoints return empty response
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  /**
   * Get email header value
   */
  private getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header?.value || '';
  }

  /**
   * Decode base64url encoded string
   */
  private decodeBase64Url(str: string): string {
    try {
      // Replace URL-safe characters and add padding
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - (base64.length % 4)) % 4);
      return decodeURIComponent(escape(atob(base64 + padding)));
    } catch (error) {
      console.error('Error decoding base64url:', error);
      return '';
    }
  }

  /**
   * Extract email body from message payload
   */
  private getEmailBody(message: GmailMessage): string {
    // Try direct body first
    if (message.payload.body?.data) {
      return this.decodeBase64Url(message.payload.body.data);
    }

    // Try parts (multipart message)
    if (message.payload.parts) {
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return this.decodeBase64Url(part.body.data);
        }
      }
      // Fallback to HTML part
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          const html = this.decodeBase64Url(part.body.data);
          // Strip HTML tags (basic)
          return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }
    }

    // Fallback to snippet
    return message.snippet || '';
  }

  /**
   * Convert Gmail message to UnifiedMessage format
   */
  private convertToUnifiedMessage(gmailMsg: GmailMessage): UnifiedMessage {
    const headers = gmailMsg.payload.headers;
    const from = this.getHeader(headers, 'From');
    const subject = this.getHeader(headers, 'Subject');
    const to = this.getHeader(headers, 'To');
    const date = this.getHeader(headers, 'Date');

    // Extract sender name and email
    const fromMatch = from.match(/^(.*?)\s*<(.+?)>$/) || [null, from, from];
    const senderName = fromMatch[1]?.trim() || from;
    const senderEmail = fromMatch[2] || from;

    const body = this.getEmailBody(gmailMsg);
    const timestamp = date
      ? new Date(date)
      : new Date(parseInt(gmailMsg.internalDate));

    const isUnread = gmailMsg.labelIds?.includes('UNREAD') || false;
    const isStarred = gmailMsg.labelIds?.includes('STARRED') || false;

    return {
      id: `gmail-${gmailMsg.id}`,
      source: 'email',
      type: 'text',
      content: subject ? `${subject}\n\n${body}` : body,
      senderId: senderEmail,
      senderName: senderName,
      senderEmail: senderEmail,
      channelId: 'inbox',
      channelName: 'Gmail',
      timestamp: timestamp,
      conversationGraphId: gmailMsg.threadId,
      isRead: !isUnread,
      starred: isStarred,
      tags: gmailMsg.labelIds || [],
      metadata: {
        gmailMessageId: gmailMsg.id,
        gmailThreadId: gmailMsg.threadId,
        subject: subject,
        to: to,
        labels: gmailMsg.labelIds || [],
      },
    };
  }

  /**
   * Get list of messages from Gmail inbox
   */
  async getMessages(maxResults: number = 50, labelIds: string = 'INBOX'): Promise<UnifiedMessage[]> {
    try {
      // Get list of message IDs
      const listResponse = await this.gmailRequest('users/me/messages', {
        params: { maxResults, labelIds }
      });

      if (!listResponse.messages || listResponse.messages.length === 0) {
        return [];
      }

      // Fetch full message details for each ID
      const messages: UnifiedMessage[] = [];
      for (const msgRef of listResponse.messages) {
        try {
          const fullMessage = await this.gmailRequest(`users/me/messages/${msgRef.id}`, {
            params: { format: 'full' }
          });
          messages.push(this.convertToUnifiedMessage(fullMessage));
        } catch (error) {
          console.error(`Error fetching message ${msgRef.id}:`, error);
        }
      }

      return messages;
    } catch (error) {
      console.error('Error fetching Gmail messages:', error);
      throw error;
    }
  }

  /**
   * Get user's email profile
   */
  async getProfile(): Promise<{ email: string; messagesTotal: number; threadsTotal: number }> {
    const response = await this.gmailRequest('users/me/profile');
    this.userEmail = response.emailAddress;
    return {
      email: response.emailAddress,
      messagesTotal: response.messagesTotal || 0,
      threadsTotal: response.threadsTotal || 0
    };
  }

  /**
   * Test Gmail connection
   */
  async testConnection(): Promise<{ success: boolean; email?: string; error?: string }> {
    try {
      const profile = await this.getProfile();
      return {
        success: true,
        email: profile.email,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const response = await this.gmailRequest('users/me/labels/INBOX');
      return response.messagesUnread || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Encode string to base64url format (Gmail API requirement)
   */
  private encodeBase64Url(str: string): string {
    // First encode to base64
    const base64 = btoa(unescape(encodeURIComponent(str)));
    // Then convert to base64url
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Build a raw email message in RFC 2822 format
   */
  private buildRawEmail(params: SendEmailParams, fromEmail?: string): string {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2)}`;
    const hasAttachments = params.attachments && params.attachments.length > 0;

    const lines: string[] = [];

    // Headers - From is required by Gmail API
    if (fromEmail) {
      lines.push(`From: ${fromEmail}`);
    }
    lines.push(`To: ${params.to.join(', ')}`);
    if (params.cc && params.cc.length > 0) {
      lines.push(`Cc: ${params.cc.join(', ')}`);
    }
    if (params.bcc && params.bcc.length > 0) {
      lines.push(`Bcc: ${params.bcc.join(', ')}`);
    }
    lines.push(`Subject: ${params.subject}`);
    lines.push('MIME-Version: 1.0');

    // Threading headers for replies
    if (params.inReplyTo) {
      lines.push(`In-Reply-To: ${params.inReplyTo}`);
      lines.push(`References: ${params.inReplyTo}`);
    }

    if (hasAttachments) {
      // Multipart/mixed for attachments
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      lines.push('');

      // Body part
      lines.push(`--${boundary}`);
      if (params.isHtml) {
        lines.push('Content-Type: text/html; charset="UTF-8"');
      } else {
        lines.push('Content-Type: text/plain; charset="UTF-8"');
      }
      lines.push('');
      lines.push(params.body);
      lines.push('');

      // Attachment parts
      for (const attachment of params.attachments!) {
        lines.push(`--${boundary}`);
        lines.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`);
        lines.push('Content-Transfer-Encoding: base64');
        lines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
        lines.push('');
        // Split base64 content into 76-character lines (RFC 2045)
        const base64Content = attachment.content;
        const chunkSize = 76;
        for (let i = 0; i < base64Content.length; i += chunkSize) {
          lines.push(base64Content.slice(i, i + chunkSize));
        }
        lines.push('');
      }

      lines.push(`--${boundary}--`);
    } else if (params.isHtml) {
      lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      lines.push('');
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('');
      // Strip HTML for plain text version
      lines.push(params.body.replace(/<[^>]*>/g, ''));
      lines.push('');
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push('');
      lines.push(params.body);
      lines.push('');
      lines.push(`--${boundary}--`);
    } else {
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('');
      lines.push(params.body);
    }

    return lines.join('\r\n');
  }

  /**
   * Send an email via Gmail API
   */
  async sendEmail(params: SendEmailParams): Promise<{ id: string; threadId: string }> {
    // Validate recipients
    if (!params.to || params.to.length === 0) {
      throw new Error('Recipient address required');
    }

    // Filter out empty strings
    const validRecipients = params.to.filter(email => email && email.trim().length > 0);
    if (validRecipients.length === 0) {
      throw new Error('Recipient address required');
    }

    // Log for debugging
    console.log('Sending email to:', validRecipients);

    // Get user's email address for the From header
    let fromEmail = this.userEmail;
    if (!fromEmail) {
      try {
        const profile = await this.getProfile();
        fromEmail = profile.email;
      } catch (e) {
        console.warn('Could not get user profile for From header');
      }
    }

    // Create params with validated recipients
    const validatedParams = { ...params, to: validRecipients };
    const rawEmail = this.buildRawEmail(validatedParams, fromEmail || undefined);

    console.log('Raw email (first 500 chars):', rawEmail.substring(0, 500));

    const encodedEmail = this.encodeBase64Url(rawEmail);

    const requestBody: any = { raw: encodedEmail };
    if (params.threadId) {
      requestBody.threadId = params.threadId;
    }

    const response = await this.gmailRequest('users/me/messages/send', {
      method: 'POST',
      body: requestBody
    });

    return {
      id: response.id,
      threadId: response.threadId
    };
  }

  /**
   * Create a draft email
   */
  async createDraft(params: SendEmailParams): Promise<{ id: string; message: any }> {
    // Get user's email for From header
    let fromEmail = this.userEmail;
    if (!fromEmail) {
      try {
        const profile = await this.getProfile();
        fromEmail = profile.email;
      } catch (e) {
        console.warn('Could not get user profile for From header');
      }
    }

    const rawEmail = this.buildRawEmail(params, fromEmail || undefined);
    const encodedEmail = this.encodeBase64Url(rawEmail);

    const requestBody: any = {
      message: { raw: encodedEmail }
    };
    if (params.threadId) {
      requestBody.message.threadId = params.threadId;
    }

    const response = await this.gmailRequest('users/me/drafts', {
      method: 'POST',
      body: requestBody
    });

    return {
      id: response.id,
      message: response.message
    };
  }

  /**
   * Get all drafts
   */
  async getDrafts(): Promise<GmailDraft[]> {
    try {
      const response = await this.gmailRequest('users/me/drafts');
      return response.drafts || [];
    } catch (error) {
      console.error('Error fetching drafts:', error);
      return [];
    }
  }

  /**
   * Delete a draft
   */
  async deleteDraft(draftId: string): Promise<void> {
    await this.gmailRequest(`users/me/drafts/${draftId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.gmailRequest(`users/me/messages/${messageId}/modify`, {
      method: 'POST',
      body: {
        removeLabelIds: ['UNREAD']
      }
    });
  }

  /**
   * Mark message as unread
   */
  async markAsUnread(messageId: string): Promise<void> {
    await this.gmailRequest(`users/me/messages/${messageId}/modify`, {
      method: 'POST',
      body: {
        addLabelIds: ['UNREAD']
      }
    });
  }

  /**
   * Star a message
   */
  async starMessage(messageId: string): Promise<void> {
    await this.gmailRequest(`users/me/messages/${messageId}/modify`, {
      method: 'POST',
      body: {
        addLabelIds: ['STARRED']
      }
    });
  }

  /**
   * Unstar a message
   */
  async unstarMessage(messageId: string): Promise<void> {
    await this.gmailRequest(`users/me/messages/${messageId}/modify`, {
      method: 'POST',
      body: {
        removeLabelIds: ['STARRED']
      }
    });
  }

  /**
   * Archive a message (remove from INBOX)
   */
  async archiveMessage(messageId: string): Promise<void> {
    await this.gmailRequest(`users/me/messages/${messageId}/modify`, {
      method: 'POST',
      body: {
        removeLabelIds: ['INBOX']
      }
    });
  }

  /**
   * Move message to trash
   */
  async trashMessage(messageId: string): Promise<void> {
    await this.gmailRequest(`users/me/messages/${messageId}/trash`, {
      method: 'POST'
    });
  }

  /**
   * Permanently delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.gmailRequest(`users/me/messages/${messageId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get all labels
   */
  async getLabels(): Promise<Array<{ id: string; name: string; type: string }>> {
    const response = await this.gmailRequest('users/me/labels');
    return response.labels || [];
  }

  /**
   * Search messages
   */
  async searchMessages(query: string, maxResults: number = 20): Promise<UnifiedMessage[]> {
    try {
      const listResponse = await this.gmailRequest('users/me/messages', {
        params: { q: query, maxResults }
      });

      if (!listResponse.messages || listResponse.messages.length === 0) {
        return [];
      }

      const messages: UnifiedMessage[] = [];
      for (const msgRef of listResponse.messages) {
        try {
          const fullMessage = await this.gmailRequest(`users/me/messages/${msgRef.id}`, {
            params: { format: 'full' }
          });
          messages.push(this.convertToUnifiedMessage(fullMessage));
        } catch (error) {
          console.error(`Error fetching message ${msgRef.id}:`, error);
        }
      }

      return messages;
    } catch (error) {
      console.error('Error searching Gmail messages:', error);
      return [];
    }
  }

  /**
   * Get sent messages
   */
  async getSentMessages(maxResults: number = 50): Promise<UnifiedMessage[]> {
    return this.getMessages(maxResults, 'SENT');
  }

  /**
   * Get starred messages
   */
  async getStarredMessages(maxResults: number = 50): Promise<UnifiedMessage[]> {
    return this.getMessages(maxResults, 'STARRED');
  }

  /**
   * Get trash messages
   */
  async getTrashMessages(maxResults: number = 50): Promise<UnifiedMessage[]> {
    return this.getMessages(maxResults, 'TRASH');
  }
}

// Singleton instance
let gmailServiceInstance: GmailService | null = null;

export const getGmailService = (): GmailService => {
  if (!gmailServiceInstance) {
    gmailServiceInstance = new GmailService();
  }
  return gmailServiceInstance;
};

// Reset service (useful when user logs out/in)
export const resetGmailService = (): void => {
  gmailServiceInstance = null;
};
