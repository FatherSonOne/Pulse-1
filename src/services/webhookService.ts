// ============================================
// WEBHOOK SERVICE
// Generic webhook handler for external integrations
// ============================================

import { UnifiedMessage, MessageSource } from '../types';
import { unifiedInboxService } from './unifiedInboxService';
import { entomateService, EntomateWebhookPayload } from './entomateService';

/**
 * Webhook Event Types
 */
export type WebhookSource =
  | 'slack'
  | 'gmail'
  | 'twilio'
  | 'entomate'
  | 'logos_vision'
  | 'github'
  | 'custom';

export interface WebhookEvent {
  id: string;
  source: WebhookSource;
  eventType: string;
  payload: Record<string, any>;
  timestamp: Date;
  signature?: string;
  verified: boolean;
}

export interface WebhookConfig {
  source: WebhookSource;
  secret?: string;
  enabled: boolean;
  endpoint: string;
  events: string[];
}

export interface WebhookLogEntry {
  id: string;
  webhookId: string;
  source: WebhookSource;
  eventType: string;
  status: 'received' | 'processed' | 'failed' | 'ignored';
  timestamp: Date;
  processingTime?: number;
  error?: string;
}

/**
 * Webhook Service
 * Handles incoming webhooks from various integrations
 */
export class WebhookService {
  private configs: Map<WebhookSource, WebhookConfig> = new Map();
  private eventHandlers: Map<string, (event: WebhookEvent) => Promise<void>> = new Map();
  private logs: WebhookLogEntry[] = [];

  constructor() {
    this.setupDefaultHandlers();
  }

  // ==================== CONFIGURATION ====================

  /**
   * Register a webhook configuration
   */
  registerWebhook(config: WebhookConfig): void {
    this.configs.set(config.source, config);
  }

  /**
   * Get webhook configuration
   */
  getConfig(source: WebhookSource): WebhookConfig | undefined {
    return this.configs.get(source);
  }

  /**
   * Enable/disable webhook
   */
  setEnabled(source: WebhookSource, enabled: boolean): void {
    const config = this.configs.get(source);
    if (config) {
      config.enabled = enabled;
    }
  }

  // ==================== EVENT HANDLERS ====================

  /**
   * Register custom event handler
   */
  registerHandler(
    source: WebhookSource,
    eventType: string,
    handler: (event: WebhookEvent) => Promise<void>
  ): void {
    const key = `${source}:${eventType}`;
    this.eventHandlers.set(key, handler);
  }

  /**
   * Setup default handlers for known integrations
   */
  private setupDefaultHandlers(): void {
    // Slack event handler
    this.registerHandler('slack', 'message', async (event) => {
      const message = await unifiedInboxService.normalizeMessage(
        event.payload,
        'slack'
      );
      // Store or process message
      console.log('Processed Slack webhook message:', message.id);
    });

    // Entomate event handler
    this.registerHandler('entomate', 'automation.completed', async (event) => {
      const entomateEvent = entomateService.processWebhook(
        event.payload as EntomateWebhookPayload
      );
      const message = entomateService.mapEventToUnified(entomateEvent);
      console.log('Processed Entomate webhook:', message.id);
    });

    // Gmail event handler
    this.registerHandler('gmail', 'message.received', async (event) => {
      const message = await unifiedInboxService.normalizeMessage(
        event.payload,
        'email'
      );
      console.log('Processed Gmail webhook message:', message.id);
    });

    // Twilio event handler
    this.registerHandler('twilio', 'message.received', async (event) => {
      const message = await unifiedInboxService.normalizeMessage(
        event.payload,
        'sms'
      );
      console.log('Processed Twilio webhook message:', message.id);
    });

    // GitHub event handler (for development notifications)
    this.registerHandler('github', 'push', async (event) => {
      const { repository, commits, pusher } = event.payload;
      console.log(`GitHub push: ${commits?.length || 0} commits to ${repository?.name} by ${pusher?.name}`);
    });
  }

  // ==================== WEBHOOK PROCESSING ====================

  /**
   * Process incoming webhook
   * Call this from your webhook endpoint
   */
  async processWebhook(
    source: WebhookSource,
    eventType: string,
    payload: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<WebhookEvent> {
    const startTime = Date.now();
    const config = this.configs.get(source);

    // Create event object
    const event: WebhookEvent = {
      id: `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source,
      eventType,
      payload,
      timestamp: new Date(),
      signature: headers?.['x-signature'] || headers?.['x-hub-signature-256'],
      verified: false,
    };

    // Check if webhook is enabled
    if (config && !config.enabled) {
      this.logEvent(event, 'ignored', Date.now() - startTime);
      throw new Error(`Webhook for ${source} is disabled`);
    }

    // Verify signature if secret is configured
    if (config?.secret && event.signature) {
      event.verified = await this.verifySignature(
        payload,
        event.signature,
        config.secret
      );

      if (!event.verified) {
        this.logEvent(event, 'failed', Date.now() - startTime, 'Invalid signature');
        throw new Error('Webhook signature verification failed');
      }
    } else {
      // No signature required
      event.verified = true;
    }

    // Find and execute handler
    const handlerKey = `${source}:${eventType}`;
    const handler = this.eventHandlers.get(handlerKey);

    if (handler) {
      try {
        await handler(event);
        this.logEvent(event, 'processed', Date.now() - startTime);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logEvent(event, 'failed', Date.now() - startTime, errorMessage);
        throw error;
      }
    } else {
      // No specific handler, mark as received
      this.logEvent(event, 'received', Date.now() - startTime);
    }

    return event;
  }

  /**
   * Verify webhook signature (HMAC-SHA256)
   */
  private async verifySignature(
    payload: Record<string, any>,
    signature: string,
    secret: string
  ): Promise<boolean> {
    try {
      // Browser-compatible signature verification
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(payload));
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
      const signatureArray = Array.from(new Uint8Array(signatureBuffer));
      const computedSignature = signatureArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // Compare signatures (handle sha256= prefix)
      const providedSig = signature.replace(/^sha256=/, '');
      return computedSignature === providedSig;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  // ==================== LOGGING ====================

  /**
   * Log webhook event
   */
  private logEvent(
    event: WebhookEvent,
    status: WebhookLogEntry['status'],
    processingTime: number,
    error?: string
  ): void {
    const logEntry: WebhookLogEntry = {
      id: `log-${Date.now()}`,
      webhookId: event.id,
      source: event.source,
      eventType: event.eventType,
      status,
      timestamp: new Date(),
      processingTime,
      error,
    };

    this.logs.push(logEntry);

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  /**
   * Get recent webhook logs
   */
  getLogs(options?: {
    source?: WebhookSource;
    status?: WebhookLogEntry['status'];
    limit?: number;
  }): WebhookLogEntry[] {
    let filtered = [...this.logs];

    if (options?.source) {
      filtered = filtered.filter((l) => l.source === options.source);
    }
    if (options?.status) {
      filtered = filtered.filter((l) => l.status === options.status);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get webhook statistics
   */
  getStats(): {
    totalReceived: number;
    totalProcessed: number;
    totalFailed: number;
    bySource: Record<WebhookSource, number>;
    avgProcessingTime: number;
  } {
    const bySource: Record<string, number> = {};
    let totalTime = 0;
    let timeCount = 0;

    for (const log of this.logs) {
      bySource[log.source] = (bySource[log.source] || 0) + 1;
      if (log.processingTime) {
        totalTime += log.processingTime;
        timeCount++;
      }
    }

    return {
      totalReceived: this.logs.filter((l) => l.status === 'received').length,
      totalProcessed: this.logs.filter((l) => l.status === 'processed').length,
      totalFailed: this.logs.filter((l) => l.status === 'failed').length,
      bySource: bySource as Record<WebhookSource, number>,
      avgProcessingTime: timeCount > 0 ? totalTime / timeCount : 0,
    };
  }

  // ==================== UTILITIES ====================

  /**
   * Generate webhook URL for a source
   */
  generateWebhookUrl(source: WebhookSource, baseUrl: string): string {
    return `${baseUrl}/api/webhooks/${source}`;
  }

  /**
   * Generate webhook secret
   */
  generateSecret(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(
    url: string,
    source: WebhookSource,
    eventType: string
  ): Promise<boolean> {
    try {
      const testPayload = {
        test: true,
        source,
        eventType,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Test': 'true',
        },
        body: JSON.stringify(testPayload),
      });

      return response.ok;
    } catch (error) {
      console.error('Webhook test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const webhookService = new WebhookService();
