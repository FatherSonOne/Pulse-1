// =====================================================
// USE MESSAGE TRIGGER HOOK
// Convenience hook for triggering in-app messages
// =====================================================

import { useCallback } from 'react';
import { useMessages } from '../components/MessageContainer';
import type { TriggerEvent, MessageEventTrigger } from '../types/inAppMessages';

/**
 * Hook for triggering in-app messages from any component
 *
 * @example
 * ```tsx
 * const { triggerMessage } = useMessageTrigger();
 *
 * // Trigger on user action
 * const handleSendMessage = () => {
 *   // ... send message logic
 *   triggerMessage('first_message_sent', { workspace_id: workspaceId });
 * };
 * ```
 */
export function useMessageTrigger() {
  const { triggerMessage: trigger, queueSize } = useMessages();

  /**
   * Trigger a message for a specific event
   */
  const triggerMessage = useCallback(
    (event: TriggerEvent, metadata?: Record<string, any>) => {
      trigger(event, metadata);
    },
    [trigger]
  );

  /**
   * Trigger multiple events at once
   */
  const triggerMultiple = useCallback(
    (events: TriggerEvent[], metadata?: Record<string, any>) => {
      events.forEach((event) => trigger(event, metadata));
    },
    [trigger]
  );

  /**
   * Conditional trigger based on a predicate
   */
  const triggerIf = useCallback(
    (
      condition: boolean,
      event: TriggerEvent,
      metadata?: Record<string, any>
    ) => {
      if (condition) {
        trigger(event, metadata);
      }
    },
    [trigger]
  );

  return {
    triggerMessage,
    triggerMultiple,
    triggerIf,
    queueSize,
  };
}

/**
 * Hook for common trigger patterns
 * Provides pre-configured triggers for typical user actions
 */
export function useCommonTriggers(userId: string) {
  const { triggerMessage } = useMessageTrigger();

  const createTriggerEvent = useCallback((type: MessageEventTrigger, metadata?: Record<string, any>): TriggerEvent => ({
    type,
    userId,
    metadata,
    timestamp: new Date(),
  }), [userId]);

  const onUserSignup = useCallback(
    () => {
      triggerMessage(createTriggerEvent('user_signup'));
    },
    [triggerMessage, createTriggerEvent]
  );

  const onFirstMessage = useCallback(
    (workspaceId: string) => {
      triggerMessage(createTriggerEvent('first_message_sent', { workspace_id: workspaceId }));
    },
    [triggerMessage, createTriggerEvent]
  );

  const onFirstGroupJoined = useCallback(
    (groupId: string) => {
      triggerMessage(createTriggerEvent('first_group_joined', { group_id: groupId }));
    },
    [triggerMessage, createTriggerEvent]
  );

  const onWorkspaceCreated = useCallback(
    (workspaceId: string) => {
      triggerMessage(createTriggerEvent('workspace_created', { workspace_id: workspaceId }));
    },
    [triggerMessage, createTriggerEvent]
  );

  const onTeamInvited = useCallback(
    (invitedEmails: string[]) => {
      triggerMessage(createTriggerEvent('team_invited', {
        invited_count: invitedEmails.length,
        emails: invitedEmails,
      }));
    },
    [triggerMessage, createTriggerEvent]
  );

  const onProfileIncomplete = useCallback(
    (missingFields: string[]) => {
      triggerMessage(createTriggerEvent('profile_incomplete', {
        missing_fields: missingFields,
      }));
    },
    [triggerMessage, createTriggerEvent]
  );

  const onMessageSent = useCallback(
    (messageId: string, workspaceId: string) => {
      triggerMessage(createTriggerEvent('message_sent', {
        message_id: messageId,
        workspace_id: workspaceId,
      }));
    },
    [triggerMessage, createTriggerEvent]
  );

  const onGroupCreated = useCallback(
    (groupId: string, groupName: string) => {
      triggerMessage(createTriggerEvent('group_created', {
        group_id: groupId,
        group_name: groupName,
      }));
    },
    [triggerMessage, createTriggerEvent]
  );

  const onPageView = useCallback(
    (pageName: string) => {
      triggerMessage(createTriggerEvent('page_view', {
        page: pageName,
        timestamp: new Date().toISOString(),
      }));
    },
    [triggerMessage, createTriggerEvent]
  );

  return {
    onUserSignup,
    onFirstMessage,
    onFirstGroupJoined,
    onWorkspaceCreated,
    onTeamInvited,
    onProfileIncomplete,
    onMessageSent,
    onGroupCreated,
    onPageView,
  };
}

/**
 * Hook for tracking user activity (for dormancy triggers)
 * Note: This requires integration with your activity tracking system
 */
export function useActivityTracking(userId: string) {
  const { triggerMessage } = useMessageTrigger();

  const createTriggerEvent = useCallback((type: MessageEventTrigger, metadata?: Record<string, any>): TriggerEvent => ({
    type,
    userId,
    metadata,
    timestamp: new Date(),
  }), [userId]);

  const checkInactivity = useCallback(
    (lastActiveDate: Date) => {
      const now = new Date();
      const hoursSinceActive = (now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60);

      // Check for 24-hour inactivity
      if (hoursSinceActive >= 24 && hoursSinceActive < 48) {
        triggerMessage(createTriggerEvent('no_activity_24h', {
          hours_inactive: Math.floor(hoursSinceActive),
        }));
      }

      // Check for 7-day inactivity
      if (hoursSinceActive >= 168 && hoursSinceActive < 336) {
        triggerMessage(createTriggerEvent('no_activity_7d', {
          days_inactive: Math.floor(hoursSinceActive / 24),
        }));
      }
    },
    [triggerMessage, createTriggerEvent]
  );

  return {
    checkInactivity,
  };
}

export default useMessageTrigger;
