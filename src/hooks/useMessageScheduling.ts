/**
 * useMessageScheduling Hook
 * Manages scheduled messages state and logic
 */

import { useState, useCallback, useEffect } from 'react';

export interface ScheduledMessage {
  id: string;
  text: string;
  scheduledFor: Date;
  threadId: string;
}

export interface UseMessageSchedulingReturn {
  // Modal State
  showScheduleModal: boolean;
  setShowScheduleModal: (show: boolean) => void;

  // Form State
  scheduleDate: string;
  setScheduleDate: (date: string) => void;
  scheduleTime: string;
  setScheduleTime: (time: string) => void;

  // Scheduled Messages
  scheduledMessages: ScheduledMessage[];

  // Actions
  scheduleMessage: (text: string, threadId: string) => boolean;
  cancelScheduledMessage: (id: string) => void;
  getScheduledMessagesForThread: (threadId: string) => ScheduledMessage[];
  clearScheduleForm: () => void;
}

export function useMessageScheduling(): UseMessageSchedulingReturn {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);

  // Check for messages that need to be sent
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setScheduledMessages(prev => {
        const toSend = prev.filter(msg => msg.scheduledFor <= now);
        const remaining = prev.filter(msg => msg.scheduledFor > now);

        // In a real implementation, you would send the messages here
        toSend.forEach(msg => {
          console.log('Sending scheduled message:', msg);
          // TODO: Integrate with actual message sending
        });

        return remaining;
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const scheduleMessage = useCallback((text: string, threadId: string): boolean => {
    if (!text.trim() || !scheduleDate || !scheduleTime) {
      return false;
    }

    const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledFor <= new Date()) {
      return false; // Can't schedule in the past
    }

    const newMessage: ScheduledMessage = {
      id: `scheduled-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      scheduledFor,
      threadId,
    };

    setScheduledMessages(prev => [...prev, newMessage]);
    return true;
  }, [scheduleDate, scheduleTime]);

  const cancelScheduledMessage = useCallback((id: string) => {
    setScheduledMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  const getScheduledMessagesForThread = useCallback((threadId: string) => {
    return scheduledMessages.filter(msg => msg.threadId === threadId);
  }, [scheduledMessages]);

  const clearScheduleForm = useCallback(() => {
    setScheduleDate('');
    setScheduleTime('');
  }, []);

  return {
    // Modal State
    showScheduleModal,
    setShowScheduleModal,

    // Form State
    scheduleDate,
    setScheduleDate,
    scheduleTime,
    setScheduleTime,

    // Scheduled Messages
    scheduledMessages,

    // Actions
    scheduleMessage,
    cancelScheduledMessage,
    getScheduledMessagesForThread,
    clearScheduleForm,
  };
}

export default useMessageScheduling;
