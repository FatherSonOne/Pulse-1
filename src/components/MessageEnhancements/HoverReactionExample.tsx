/**
 * Example Usage: Hover Reaction System Integration
 *
 * This file demonstrates how to integrate the hover reaction system into message components.
 *
 * Component Flow:
 * 1. HoverReactionTrigger wraps message content
 * 2. Detects hover (300ms delay) or long-press (500ms on mobile)
 * 3. Shows QuickReactionBar with smart positioning
 * 4. User selects reaction emoji
 * 5. AnimatedReactions displays all reactions with floating animations
 */

import React, { useState } from 'react';
import { HoverReactionTrigger } from './HoverReactionTrigger';
import { QuickReactionBar, AnimatedReactions } from './AnimatedReactions';

interface Message {
  id: string;
  content: string;
  sender: string;
  reactions: Array<{
    emoji: string;
    count: number;
    me: boolean;
  }>;
}

interface ExampleMessageProps {
  message: Message;
  currentUserId: string;
  onReactionAdd: (messageId: string, emoji: string) => void;
  onReactionRemove: (messageId: string, emoji: string) => void;
}

/**
 * Example: Basic Message with Hover Reactions
 */
export const MessageWithHoverReactions: React.FC<ExampleMessageProps> = ({
  message,
  currentUserId,
  onReactionAdd,
  onReactionRemove,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const isMe = message.sender === currentUserId;

  // Handle reaction toggle (add if not present, remove if already reacted)
  const handleReaction = (messageId: string, emoji: string) => {
    const existingReaction = message.reactions.find(r => r.emoji === emoji && r.me);

    if (existingReaction) {
      onReactionRemove(messageId, emoji);
    } else {
      onReactionAdd(messageId, emoji);
    }
  };

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-md ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
        {/* Message Content with Hover Trigger */}
        <HoverReactionTrigger
          messageId={message.id}
          isMe={isMe}
          onReact={handleReaction}
          onShowMore={() => setShowEmojiPicker(true)}
          className="w-full"
          enableMobileLongPress={true}
          renderReactionBar={({ onReact, onShowMore, position }) => (
            <QuickReactionBar
              onReact={onReact}
              onShowMore={onShowMore}
              position={position}
            />
          )}
        >
          {/* Message Bubble */}
          <div
            className={`
              px-4 py-2 rounded-2xl
              ${isMe
                ? 'bg-blue-500 text-white rounded-br-md'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-md'
              }
            `}
          >
            {message.content}
          </div>
        </HoverReactionTrigger>

        {/* Reactions Display */}
        {message.reactions.length > 0 && (
          <AnimatedReactions
            reactions={message.reactions}
            onReact={(emoji) => handleReaction(message.id, emoji)}
            isMe={isMe}
            showPicker={showEmojiPicker}
            onPickerToggle={() => setShowEmojiPicker(!showEmojiPicker)}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Example: Message Thread with Multiple Messages
 */
export const MessageThreadExample: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hey! How are you doing today?',
      sender: 'user-123',
      reactions: [
        { emoji: '👍', count: 2, me: false },
        { emoji: '❤️', count: 1, me: true },
      ],
    },
    {
      id: '2',
      content: 'I am doing great! Thanks for asking.',
      sender: 'current-user',
      reactions: [
        { emoji: '😊', count: 1, me: false },
      ],
    },
    {
      id: '3',
      content: 'That is awesome! Want to grab coffee later?',
      sender: 'user-123',
      reactions: [],
    },
  ]);

  const currentUserId = 'current-user';

  const handleReactionAdd = (messageId: string, emoji: string) => {
    setMessages(prevMessages =>
      prevMessages.map(msg => {
        if (msg.id !== messageId) return msg;

        const existingReaction = msg.reactions.find(r => r.emoji === emoji);

        if (existingReaction) {
          // Increment count and mark as me
          return {
            ...msg,
            reactions: msg.reactions.map(r =>
              r.emoji === emoji
                ? { ...r, count: r.count + 1, me: true }
                : r
            ),
          };
        } else {
          // Add new reaction
          return {
            ...msg,
            reactions: [...msg.reactions, { emoji, count: 1, me: true }],
          };
        }
      })
    );

    // In a real app, send to backend here
    console.log('Adding reaction:', { messageId, emoji });
  };

  const handleReactionRemove = (messageId: string, emoji: string) => {
    setMessages(prevMessages =>
      prevMessages.map(msg => {
        if (msg.id !== messageId) return msg;

        return {
          ...msg,
          reactions: msg.reactions
            .map(r =>
              r.emoji === emoji
                ? { ...r, count: r.count - 1, me: false }
                : r
            )
            .filter(r => r.count > 0), // Remove if count reaches 0
        };
      })
    );

    // In a real app, send to backend here
    console.log('Removing reaction:', { messageId, emoji });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-2">
      {messages.map(message => (
        <MessageWithHoverReactions
          key={message.id}
          message={message}
          currentUserId={currentUserId}
          onReactionAdd={handleReactionAdd}
          onReactionRemove={handleReactionRemove}
        />
      ))}
    </div>
  );
};

/**
 * Example: Advanced Usage with Custom Configuration
 */
export const AdvancedHoverReactionExample: React.FC<ExampleMessageProps> = ({
  message,
  currentUserId,
  onReactionAdd,
}) => {
  const isMe = message.sender === currentUserId;

  return (
    <HoverReactionTrigger
      messageId={message.id}
      isMe={isMe}
      onReact={onReactionAdd}
      hoverDelay={200} // Faster hover trigger (200ms instead of 300ms)
      enableMobileLongPress={true}
      disabled={false} // Can be disabled conditionally
      className="custom-message-wrapper"
      renderReactionBar={({ onReact, onShowMore, position }) => (
        <QuickReactionBar
          onReact={onReact}
          onShowMore={onShowMore}
          position={position}
          className="custom-reaction-bar"
        />
      )}
    >
      <div className="message-content">
        {message.content}
      </div>
    </HoverReactionTrigger>
  );
};

/**
 * Integration Notes:
 *
 * 1. Desktop Behavior:
 *    - Hover over message for 300ms
 *    - QuickReactionBar appears with smooth animation
 *    - Click emoji to react
 *    - Bar disappears after selection
 *
 * 2. Mobile Behavior:
 *    - Long-press message for 500ms
 *    - Haptic feedback vibration (10ms)
 *    - QuickReactionBar appears
 *    - Tap emoji to react
 *    - Release to dismiss
 *
 * 3. Edge Cases Handled:
 *    - Rapid hover/unhover: Timer cancelled, no bar shown
 *    - Scrolling: Bar dismissed immediately
 *    - Moving finger during long-press: Cancelled if moved >10px
 *    - Viewport boundaries: Smart positioning above/below
 *
 * 4. Accessibility:
 *    - Keyboard: Tab to focus, Enter/Space to show reactions, Escape to hide
 *    - Screen readers: Full ARIA labels for reactions
 *    - Focus indicators: Visible focus states
 *    - Semantic HTML: Proper button and toolbar roles
 *
 * 5. Performance:
 *    - Debounced hover timers
 *    - Optimized re-renders with React.memo (recommended)
 *    - Cleanup of timers on unmount
 *    - Passive event listeners for scroll
 */

export default MessageWithHoverReactions;
