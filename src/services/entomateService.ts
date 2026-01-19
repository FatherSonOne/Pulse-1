// ============================================
// ENTOMATE INTEGRATION SERVICE
// Sync automation events from entomate platform
// ============================================

import { UnifiedMessage, MessageSource } from '../types';

/**
 * Entomate Automation Event Types
 */
export interface EntomateEvent {
  id: string;
  automationId: string;
  automationName: string;
  eventType: 'trigger' | 'action' | 'condition' | 'error' | 'completed';
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  timestamp: Date;
  data: Record<string, any>;
  metadata?: {
    executionTime?: number;
    triggeredBy?: string;
    errorMessage?: string;
    retryCount?: number;
  };
}

export interface EntomateAutomation {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  triggerType: string;
  lastRunAt?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntomateWebhookPayload {
  event: string;
  automation_id: string;
  automation_name: string;
  execution_id: string;
  status: string;
  timestamp: string;
  data: Record<string, any>;
  error?: string;
}

/**
 * Entomate Service
 * Handles integration with entomate automation platform
 */
export class EntomateService {
  private apiUrl: string;
  private apiKey: string;
  private events: Map<string, EntomateEvent> = new Map();
  private automations: Map<string, EntomateAutomation> = new Map();

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  // ==================== AUTOMATIONS ====================

  /**
   * Fetch all automations from entomate
   */
  async getAutomations(): Promise<EntomateAutomation[]> {
    try {
      const response = await fetch(`${this.apiUrl}/automations`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch automations: ${response.statusText}`);
      }

      const data = await response.json();
      const automations = (data.automations || []).map(this.mapToAutomation);

      // Cache automations
      automations.forEach((a: EntomateAutomation) => this.automations.set(a.id, a));

      return automations;
    } catch (error) {
      console.error('Error fetching entomate automations:', error);
      throw error;
    }
  }

  /**
   * Get single automation by ID
   */
  async getAutomation(automationId: string): Promise<EntomateAutomation | null> {
    // Check cache first
    if (this.automations.has(automationId)) {
      return this.automations.get(automationId)!;
    }

    try {
      const response = await fetch(`${this.apiUrl}/automations/${automationId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to fetch automation: ${response.statusText}`);
      }

      const data = await response.json();
      const automation = this.mapToAutomation(data);
      this.automations.set(automation.id, automation);

      return automation;
    } catch (error) {
      console.error('Error fetching entomate automation:', error);
      throw error;
    }
  }

  // ==================== EVENTS ====================

  /**
   * Sync automation events from entomate
   */
  async syncAutomationEvents(since?: Date): Promise<EntomateEvent[]> {
    try {
      const params = new URLSearchParams();
      if (since) {
        params.append('since', since.toISOString());
      }
      params.append('limit', '100');

      const response = await fetch(`${this.apiUrl}/events?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.statusText}`);
      }

      const data = await response.json();
      const events = (data.events || []).map(this.mapToEvent);

      // Cache events
      events.forEach((e: EntomateEvent) => this.events.set(e.id, e));

      return events;
    } catch (error) {
      console.error('Error syncing entomate events:', error);
      throw error;
    }
  }

  /**
   * Get events for a specific automation
   */
  async getAutomationEvents(automationId: string, limit: number = 50): Promise<EntomateEvent[]> {
    try {
      const response = await fetch(
        `${this.apiUrl}/automations/${automationId}/events?limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch automation events: ${response.statusText}`);
      }

      const data = await response.json();
      return (data.events || []).map(this.mapToEvent);
    } catch (error) {
      console.error('Error fetching automation events:', error);
      throw error;
    }
  }

  // ==================== WEBHOOK HANDLER ====================

  /**
   * Process incoming webhook from entomate
   * Call this from your webhook endpoint
   */
  processWebhook(payload: EntomateWebhookPayload): EntomateEvent {
    const event: EntomateEvent = {
      id: payload.execution_id,
      automationId: payload.automation_id,
      automationName: payload.automation_name,
      eventType: this.mapEventType(payload.event),
      status: this.mapStatus(payload.status),
      timestamp: new Date(payload.timestamp),
      data: payload.data,
      metadata: {
        errorMessage: payload.error,
      },
    };

    // Cache the event
    this.events.set(event.id, event);

    return event;
  }

  // ==================== UNIFIED MESSAGE CONVERSION ====================

  /**
   * Convert entomate event to UnifiedMessage for inbox display
   */
  mapEventToUnified(event: EntomateEvent): UnifiedMessage {
    const statusEmoji = this.getStatusEmoji(event.status);
    const content = this.buildEventContent(event);

    return {
      id: `entomate-${event.id}`,
      source: 'pulse' as MessageSource, // Using pulse as source for internal events
      type: 'text',
      content,
      senderName: 'Entomate',
      senderId: 'entomate-system',
      channelId: `automation-${event.automationId}`,
      channelName: event.automationName,
      timestamp: event.timestamp,
      conversationGraphId: event.automationId,
      isRead: false,
      starred: event.status === 'failed',
      tags: [event.eventType, event.status],
      metadata: {
        source: 'entomate',
        automationId: event.automationId,
        automationName: event.automationName,
        eventType: event.eventType,
        status: event.status,
        statusEmoji,
        executionTime: event.metadata?.executionTime,
        errorMessage: event.metadata?.errorMessage,
      },
    };
  }

  /**
   * Convert multiple events to UnifiedMessages
   */
  mapEventsToUnified(events: EntomateEvent[]): UnifiedMessage[] {
    return events.map((e) => this.mapEventToUnified(e));
  }

  // ==================== STATISTICS ====================

  /**
   * Get automation statistics
   */
  async getAutomationStats(automationId: string): Promise<{
    totalRuns: number;
    successRate: number;
    averageExecutionTime: number;
    lastRunAt: Date | null;
    recentErrors: string[];
  }> {
    const events = await this.getAutomationEvents(automationId, 100);

    const completedEvents = events.filter((e) =>
      e.eventType === 'completed' || e.status === 'success' || e.status === 'failed'
    );

    const successfulEvents = completedEvents.filter((e) => e.status === 'success');
    const failedEvents = completedEvents.filter((e) => e.status === 'failed');

    const executionTimes = events
      .filter((e) => e.metadata?.executionTime)
      .map((e) => e.metadata!.executionTime!);

    return {
      totalRuns: completedEvents.length,
      successRate: completedEvents.length > 0
        ? (successfulEvents.length / completedEvents.length) * 100
        : 0,
      averageExecutionTime: executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
        : 0,
      lastRunAt: events.length > 0 ? events[0].timestamp : null,
      recentErrors: failedEvents
        .slice(0, 5)
        .map((e) => e.metadata?.errorMessage || 'Unknown error'),
    };
  }

  // ==================== PRIVATE HELPERS ====================

  private mapToAutomation(data: any): EntomateAutomation {
    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      isActive: data.is_active ?? data.isActive ?? true,
      triggerType: data.trigger_type || data.triggerType || 'manual',
      lastRunAt: data.last_run_at ? new Date(data.last_run_at) : undefined,
      runCount: data.run_count || data.runCount || 0,
      successCount: data.success_count || data.successCount || 0,
      failureCount: data.failure_count || data.failureCount || 0,
      createdAt: new Date(data.created_at || data.createdAt),
      updatedAt: new Date(data.updated_at || data.updatedAt),
    };
  }

  private mapToEvent(data: any): EntomateEvent {
    return {
      id: data.id || data.execution_id,
      automationId: data.automation_id || data.automationId,
      automationName: data.automation_name || data.automationName || 'Unknown',
      eventType: data.event_type || data.eventType || 'action',
      status: data.status || 'pending',
      timestamp: new Date(data.timestamp || data.created_at),
      data: data.data || {},
      metadata: {
        executionTime: data.execution_time || data.executionTime,
        triggeredBy: data.triggered_by || data.triggeredBy,
        errorMessage: data.error_message || data.error,
        retryCount: data.retry_count || data.retryCount,
      },
    };
  }

  private mapEventType(event: string): EntomateEvent['eventType'] {
    const typeMap: Record<string, EntomateEvent['eventType']> = {
      'automation.triggered': 'trigger',
      'automation.action': 'action',
      'automation.condition': 'condition',
      'automation.error': 'error',
      'automation.completed': 'completed',
    };
    return typeMap[event] || 'action';
  }

  private mapStatus(status: string): EntomateEvent['status'] {
    const statusMap: Record<string, EntomateEvent['status']> = {
      'pending': 'pending',
      'running': 'running',
      'success': 'success',
      'completed': 'success',
      'failed': 'failed',
      'error': 'failed',
      'skipped': 'skipped',
    };
    return statusMap[status.toLowerCase()] || 'pending';
  }

  private getStatusEmoji(status: EntomateEvent['status']): string {
    const emojiMap: Record<EntomateEvent['status'], string> = {
      pending: '⏳',
      running: '🔄',
      success: '✅',
      failed: '❌',
      skipped: '⏭️',
    };
    return emojiMap[status] || '❓';
  }

  private buildEventContent(event: EntomateEvent): string {
    const statusEmoji = this.getStatusEmoji(event.status);
    let content = `${statusEmoji} **${event.automationName}** - ${event.eventType}`;

    if (event.status === 'failed' && event.metadata?.errorMessage) {
      content += `\n\nError: ${event.metadata.errorMessage}`;
    }

    if (event.metadata?.executionTime) {
      content += `\n\nExecution time: ${event.metadata.executionTime}ms`;
    }

    return content;
  }

  // ==================== HEALTH CHECK ====================

  /**
   * Check connection to entomate API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch (error) {
      console.error('Entomate health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance (configure with your entomate credentials)
export const entomateService = new EntomateService(
  import.meta.env.VITE_ENTOMATE_API_URL || 'http://localhost:3002/api',
  import.meta.env.VITE_ENTOMATE_API_KEY || ''
);
