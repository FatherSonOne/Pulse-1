/**
 * Pulse Notification Hooks
 * Easy-to-use hooks for sending notifications from any component
 */

import { useCallback } from 'react';
import { useNotificationStore } from '../store/notificationStore';
import { NotificationCategory, NotificationPriority, NotificationSource } from '../types/notifications';

/**
 * Hook for sending notifications
 * Provides convenient methods for all notification types
 */
export function useNotifications() {
  const {
    addNotification,
    notifyMessage,
    notifyEmail,
    notifyTask,
    notifyCalendar,
    notifyAI,
    notifyVoice,
    notifyDecision,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    testSound,
    notifications,
    preferences,
    permissionStatus,
    requestPermission,
  } = useNotificationStore();

  // Quick notification helper
  const notify = useCallback(async (
    title: string,
    body: string,
    options?: {
      category?: NotificationCategory;
      priority?: NotificationPriority;
      source?: NotificationSource;
      actionUrl?: string;
      senderName?: string;
      senderAvatar?: string;
    }
  ) => {
    await addNotification({
      title,
      body,
      category: options?.category || 'system',
      priority: options?.priority || 'medium',
      source: options?.source || 'pulse',
      actionUrl: options?.actionUrl,
      senderName: options?.senderName,
      senderAvatar: options?.senderAvatar,
    });
  }, [addNotification]);

  // Success notification
  const notifySuccess = useCallback(async (title: string, body: string) => {
    await notify(title, body, { category: 'system', priority: 'low' });
  }, [notify]);

  // Error notification
  const notifyError = useCallback(async (title: string, body: string) => {
    await notify(title, body, { category: 'system', priority: 'high' });
  }, [notify]);

  // Warning notification
  const notifyWarning = useCallback(async (title: string, body: string) => {
    await notify(title, body, { category: 'system', priority: 'medium' });
  }, [notify]);

  return {
    // Basic notification
    notify,
    notifySuccess,
    notifyError,
    notifyWarning,

    // Type-specific notifications
    notifyMessage,
    notifyEmail,
    notifyTask,
    notifyCalendar,
    notifyAI,
    notifyVoice,
    notifyDecision,

    // Actions
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    testSound,
    requestPermission,

    // State
    notifications,
    preferences,
    permissionStatus,
    unreadCount: notifications.filter(n => !n.read && !n.dismissed).length,
  };
}

/**
 * Hook specifically for message notifications
 */
export function useMessageNotifications() {
  const { notifyMessage } = useNotificationStore();

  const sendMessageNotification = useCallback(async (
    senderName: string,
    message: string,
    options?: {
      senderAvatar?: string;
      channelName?: string;
      threadId?: string;
      actionUrl?: string;
    }
  ) => {
    await notifyMessage({
      senderName,
      message,
      senderAvatar: options?.senderAvatar,
      channelName: options?.channelName,
      threadId: options?.threadId,
      actionUrl: options?.actionUrl,
    });
  }, [notifyMessage]);

  return { sendMessageNotification };
}

/**
 * Hook specifically for email notifications
 */
export function useEmailNotifications() {
  const { notifyEmail } = useNotificationStore();

  const sendEmailNotification = useCallback(async (
    senderName: string,
    senderEmail: string,
    subject: string,
    preview: string,
    options?: {
      isImportant?: boolean;
      actionUrl?: string;
    }
  ) => {
    await notifyEmail({
      senderName,
      senderEmail,
      subject,
      preview,
      isImportant: options?.isImportant,
      actionUrl: options?.actionUrl,
    });
  }, [notifyEmail]);

  return { sendEmailNotification };
}

/**
 * Hook specifically for task notifications
 */
export function useTaskNotifications() {
  const { notifyTask } = useNotificationStore();

  const sendTaskNotification = useCallback(async (
    type: 'assigned' | 'due_soon' | 'overdue' | 'completed' | 'updated',
    taskTitle: string,
    options?: {
      assigneeName?: string;
      dueDate?: Date;
      actionUrl?: string;
    }
  ) => {
    await notifyTask({
      type,
      taskTitle,
      assigneeName: options?.assigneeName,
      dueDate: options?.dueDate,
      actionUrl: options?.actionUrl,
    });
  }, [notifyTask]);

  return { sendTaskNotification };
}

/**
 * Hook specifically for calendar notifications
 */
export function useCalendarNotifications() {
  const { notifyCalendar } = useNotificationStore();

  const sendCalendarNotification = useCallback(async (
    type: 'reminder' | 'invite' | 'updated' | 'cancelled',
    eventTitle: string,
    startTime: Date,
    options?: {
      location?: string;
      organizerName?: string;
      actionUrl?: string;
    }
  ) => {
    await notifyCalendar({
      type,
      eventTitle,
      startTime,
      location: options?.location,
      organizerName: options?.organizerName,
      actionUrl: options?.actionUrl,
    });
  }, [notifyCalendar]);

  return { sendCalendarNotification };
}

/**
 * Hook specifically for AI/War Room notifications
 */
export function useAINotifications() {
  const { notifyAI } = useNotificationStore();

  const sendAINotification = useCallback(async (
    type: 'response_ready' | 'processing' | 'error',
    message: string,
    actionUrl?: string
  ) => {
    await notifyAI({
      type,
      message,
      actionUrl,
    });
  }, [notifyAI]);

  return { sendAINotification };
}

export default useNotifications;
