/**
 * React Hook for Analytics Tracking
 * Provides easy integration with analytics collector
 */

import { useCallback, useEffect } from 'react';
import analyticsCollector, { MessageEvent } from '../services/analyticsCollector';

export function useAnalyticsTracking() {
  /**
   * Track a message being sent or received
   */
  const trackMessage = useCallback(async (event: MessageEvent) => {
    await analyticsCollector.trackMessageEvent(event);
  }, []);

  /**
   * Track multiple messages in batch
   */
  const trackMessageBatch = useCallback(async (events: MessageEvent[]) => {
    await analyticsCollector.trackMessageBatch(events);
  }, []);

  /**
   * Run backfill for historical data
   */
  const backfillAnalytics = useCallback(async (daysBack: number = 90) => {
    await analyticsCollector.backfillAnalytics(daysBack);
  }, []);

  /**
   * Run daily aggregation
   */
  const runDailyAggregation = useCallback(async () => {
    await analyticsCollector.runDailyAggregation();
  }, []);

  // Run daily aggregation on mount (once per session)
  useEffect(() => {
    const lastRun = localStorage.getItem('analytics_last_aggregation');
    const today = new Date().toDateString();
    
    if (lastRun !== today) {
      runDailyAggregation().then(() => {
        localStorage.setItem('analytics_last_aggregation', today);
      });
    }
  }, [runDailyAggregation]);

  return {
    trackMessage,
    trackMessageBatch,
    backfillAnalytics,
    runDailyAggregation
  };
}

/**
 * Helper function to create MessageEvent from various message formats
 */
export function createMessageEvent(
  message: any,
  channel: 'email' | 'sms' | 'slack',
  isSent: boolean
): MessageEvent {
  return {
    id: message.id || message.external_id,
    channel,
    contactIdentifier: message.sender_id || message.from || message.contact_id || 'unknown',
    contactName: message.sender_name || message.contact_name,
    isSent,
    timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
    threadId: message.thread_id,
    replyToId: message.reply_to_id || message.in_reply_to,
    content: message.content || message.body || message.text
  };
}
