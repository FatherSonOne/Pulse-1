// =====================================================
// MESSAGE CONTAINER COMPONENT
// Manages message queue and display lifecycle
// =====================================================

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { MessagePrompt } from './MessagePrompt';
import { messageService } from '../services/messageService';
import type {
  InAppMessage,
  TriggerEvent,
  MessageEventTrigger,
} from '../types/inAppMessages';

interface MessageQueueItem {
  message: InAppMessage;
  context: {
    message: InAppMessage;
    user_id: string;
    trigger_event: MessageEventTrigger;
    metadata?: Record<string, any>;
  };
  queued_at: Date;
}

// =====================================================
// MESSAGE CONTEXT
// =====================================================

interface MessageContextType {
  triggerMessage: (event: TriggerEvent, metadata?: Record<string, any>) => void;
  queueSize: number;
}

const MessageContext = createContext<MessageContextType | null>(null);

/**
 * Hook to access message context
 */
export const useMessages = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessages must be used within MessageContainer');
  }
  return context;
};

// =====================================================
// MESSAGE CONTAINER PROPS
// =====================================================

interface MessageContainerProps {
  userId: string;
  children: React.ReactNode;
  maxQueueSize?: number;
}

/**
 * MessageContainer Component
 * Wraps the app and manages in-app message display
 */
const MessageContainer: React.FC<MessageContainerProps> = ({
  userId,
  children,
  maxQueueSize = 3,
}) => {
  const [messageQueue, setMessageQueue] = useState<MessageQueueItem[]>([]);
  const [currentMessage, setCurrentMessage] = useState<InAppMessage | null>(null);
  const [shownAt, setShownAt] = useState<Date | null>(null);

  // ==================== QUEUE MANAGEMENT ====================

  /**
   * Add message to queue
   */
  const enqueueMessage = useCallback(
    (message: InAppMessage, eventType: MessageEventTrigger, metadata?: Record<string, any>) => {
      // Check if message is already in queue
      const alreadyQueued = messageQueue.some((item) => item.message.id === message.id);
      if (alreadyQueued) return;

      const queueItem: MessageQueueItem = {
        message,
        context: {
          message,
          user_id: userId,
          trigger_event: eventType,
          metadata,
        },
        queued_at: new Date(),
      };

      setMessageQueue((prev) => {
        const newQueue = [...prev, queueItem];
        // Limit queue size
        if (newQueue.length > maxQueueSize) {
          return newQueue.slice(-maxQueueSize);
        }
        return newQueue;
      });
    },
    [messageQueue, userId, maxQueueSize]
  );

  /**
   * Show next message from queue
   */
  const showNextMessage = useCallback(async () => {
    if (messageQueue.length === 0 || currentMessage) return;

    const nextItem = messageQueue[0];
    setCurrentMessage(nextItem.message);
    setShownAt(new Date());

    // Remove from queue
    setMessageQueue((prev) => prev.slice(1));

    // Track 'shown' interaction
    try {
      await messageService.recordMessageShown(
        nextItem.message.id,
        userId,
        nextItem.context.trigger_event,
        nextItem.message.segment,
        {
          sessionId: undefined,
          pageUrl: window.location.href,
          deviceType: /Mobile/.test(navigator.userAgent) ? 'mobile' : 'desktop',
        }
      );
    } catch (err) {
      console.error('Failed to track message shown:', err);
    }
  }, [messageQueue, currentMessage, userId]);

  // Auto-show next message when queue changes and no message is displayed
  useEffect(() => {
    if (!currentMessage && messageQueue.length > 0) {
      // Small delay to prevent rapid-fire messages
      const timer = setTimeout(showNextMessage, 500);
      return () => clearTimeout(timer);
    }
  }, [currentMessage, messageQueue, showNextMessage]);

  // ==================== EVENT HANDLERS ====================
  const [interactionId, setInteractionId] = useState<string | null>(null);

  /**
   * Handle message opened (when user expands/reads)
   */
  const handleMessageOpened = useCallback(async () => {
    if (!currentMessage || !interactionId) return;

    try {
      await messageService.recordMessageOpened(interactionId);
    } catch (err) {
      console.error('Failed to track message opened:', err);
    }
  }, [currentMessage, interactionId]);

  /**
   * Handle CTA click
   */
  const handleCTAClick = useCallback(async () => {
    if (!currentMessage || !interactionId) return;

    try {
      await messageService.recordMessageClicked(interactionId, userId);
    } catch (err) {
      console.error('Failed to track CTA click:', err);
    }
  }, [currentMessage, userId, interactionId]);

  /**
   * Handle message dismiss
   */
  const handleDismiss = useCallback(async () => {
    if (!currentMessage || !interactionId) return;

    try {
      await messageService.recordMessageDismissed(interactionId);
    } catch (err) {
      console.error('Failed to track message dismiss:', err);
    }

    setCurrentMessage(null);
    setShownAt(null);
    setInteractionId(null);
  }, [currentMessage, interactionId]);

  // ==================== TRIGGER FUNCTION ====================

  /**
   * Trigger messages for a specific event
   */
  const triggerMessage = useCallback(
    async (event: TriggerEvent, metadata?: Record<string, any>) => {
      try {
        const messages = await messageService.getMessagesToDisplay(event);

        // Enqueue matched messages
        for (const message of messages) {
          enqueueMessage(message, event.type, metadata);
        }
      } catch (error) {
        console.error('Failed to trigger message:', error);
      }
    },
    [userId, enqueueMessage]
  );

  // Store interactionId when message is shown
  useEffect(() => {
    if (currentMessage && !interactionId) {
      messageService.recordMessageShown(
        currentMessage.id,
        userId,
        currentMessage.eventTrigger,
        currentMessage.segment,
        {
          sessionId: undefined,
          pageUrl: window.location.href,
          deviceType: /Mobile/.test(navigator.userAgent) ? 'mobile' : 'desktop',
        }
      ).then((id) => setInteractionId(id))
        .catch((err) => console.error('Failed to record message shown:', err));
    }
  }, [currentMessage, interactionId, userId]);

  // ==================== CONTEXT VALUE ====================

  const contextValue: MessageContextType = {
    triggerMessage,
    queueSize: messageQueue.length,
  };

  // ==================== RENDER ====================

  return (
    <MessageContext.Provider value={contextValue}>
      {children}

      {/* Render current message */}
      {currentMessage && (
        <MessagePrompt
          message={currentMessage}
          onOpened={handleMessageOpened}
          onClicked={handleCTAClick}
          onDismissed={handleDismiss}
        />
      )}
    </MessageContext.Provider>
  );
};

export default MessageContainer;
export { MessageContext };
