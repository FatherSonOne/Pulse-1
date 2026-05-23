import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import EnhancedLoadingScreen from '../EnhancedLoadingScreen';
import { ChannelMessage } from '../../types/messages';
import {
  Conversation,
  conversationDisplayName,
  conversationDescription,
  conversationIsGroup,
} from '../../types/conversations';

import { Info, MessageSquare, MessagesSquare, Search, Users } from 'lucide-react';

interface ConversationPanelProps {
  /** The selected conversation — channel or Pulse DM. */
  conversation: Conversation | null;
  /** Messages already normalized to ChannelMessage shape by the host.
   *  PulseMessage → ChannelMessage adaptation lives in the messageStore
   *  (Phase 5c.7 / Phase 5d) so this panel doesn't need to know about
   *  the underlying message kind. */
  messages: ChannelMessage[];
  currentUserId: string;
  onSendMessage?: (content: string) => void;
  onAddReaction?: (messageId: string, emoji: string) => void;
  isLoading?: boolean;
  className?: string;
  renderMessageInput?: () => React.ReactNode;
  renderMessageBubble?: (message: ChannelMessage) => React.ReactNode;
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({
  conversation,
  messages,
  currentUserId,
  onSendMessage,
  onAddReaction,
  isLoading = false,
  className = '',
  renderMessageInput,
  renderMessageBubble
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Screen-reader announcement for incoming messages (WCAG 4.1.3 Status Messages).
  // Announces only NEW messages from OTHER users — your own sends don't get
  // announced, and a full thread reload doesn't either (count diff, not
  // identity check, is intentional: works for both append and prepend).
  const [announcement, setAnnouncement] = useState('');

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Announce incoming messages
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    if (messages.length > prevCount) {
      const last = messages[messages.length - 1];
      if (last && last.sender_id !== currentUserId) {
        const sender = last.sender_name || 'Someone';
        const preview = (last.content || '').slice(0, 100);
        setAnnouncement(`New message from ${sender}: ${preview}`);
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, currentUserId]);

  // Format timestamp for message
  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Group messages by date
  const groupMessagesByDate = (messages: ChannelMessage[]) => {
    const groups: { [key: string]: ChannelMessage[] } = {};

    messages.forEach((message) => {
      const date = new Date(message.created_at);
      const dateKey = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  // Group consecutive messages from the same sender (within 3 minutes)
  // so the mono sender header renders once per block. Returns the same
  // ordered array with a `grouped` flag on every message except the
  // first of each block.
  const GROUP_WINDOW_MS = 3 * 60 * 1000;
  const annotateGrouping = (list: ChannelMessage[]) => {
    return list.map((m, i) => {
      const prev = list[i - 1];
      const grouped = !!prev
        && prev.sender_id === m.sender_id
        && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_WINDOW_MS;
      return { message: m, grouped };
    });
  };

  // Identify the latest own-message — that's the one carrying the
  // DELIVERED / READ receipt. Older own-messages just show their bubble.
  // (Read state will upgrade once read_by lands on ChannelMessage; for
  // now the receipt is always DELIVERED.)
  const latestOwnId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === currentUserId) return messages[i].id;
    }
    return null;
  })();

  // Default message bubble renderer — Pulse Coral Cockpit hybrid:
  // received = quote-style with coral leading hairline, sent = coral
  // glass card with a heartbeat hairline.
  const defaultRenderMessageBubble = (message: ChannelMessage, grouped: boolean) => {
    const isOwnMessage = message.sender_id === currentUserId;
    const senderInitials = message.sender_name
      ? message.sender_name.slice(0, 2).toUpperCase()
      : 'U';
    const senderLabel = isOwnMessage ? 'YOU' : (message.sender_name || 'UNKNOWN').toUpperCase();
    const showReceipt = isOwnMessage && message.id === latestOwnId;

    return (
      <motion.div
        key={message.id}
        data-grouped={grouped ? 'true' : 'false'}
        className={`message-bubble-wrapper flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={`flex gap-2.5 max-w-[78%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Avatar — only rendered on first message of a received block */}
          {!isOwnMessage && !grouped && (
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-mono font-semibold tracking-[0.05em] mt-[2px]">
              {senderInitials}
            </div>
          )}
          {/* Grouped received messages — keep the indent without re-drawing the avatar */}
          {!isOwnMessage && grouped && (
            <div className="flex-shrink-0 w-7" aria-hidden="true" />
          )}

          {/* Message column */}
          <div className={`flex flex-col min-w-0 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
            {/* Mono sender · timestamp header — once per group */}
            <div className="msg-sender-header">
              <span className="msg-sender-name">{senderLabel}</span>
              <span className="msg-sep" aria-hidden="true">·</span>
              <span className="msg-timestamp">{formatMessageTime(message.created_at)}</span>
            </div>

            {/* Message body */}
            <div
              className={`message-bubble ${isOwnMessage ? 'message-bubble-sent' : 'message-bubble-received'}`}
            >
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                {message.content}
              </p>

              {/* Edited indicator — mono, muted */}
              {message.edited_at && (
                <span className="ml-2 align-baseline font-mono uppercase tracking-[0.1em] text-[9px] opacity-60">
                  edited
                </span>
              )}
            </div>

            {/* Reactions */}
            {message.reactions && Object.keys(message.reactions).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {Object.entries(message.reactions).map(([emoji, users]) => (
                  <button
                    key={emoji}
                    className={`reaction-badge px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-colors ${
                      users.includes(currentUserId)
                        ? 'bg-rose-500/20 border border-rose-500/30 text-[#fb7185]'
                        : 'bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] text-[#94a3b8] hover:bg-[rgba(255,255,255,0.06)]'
                    }`}
                    onClick={() => onAddReaction?.(message.id, emoji)}
                    aria-label={`${emoji} reaction (${users.length})`}
                  >
                    <span>{emoji}</span>
                    <span>{users.length}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Receipt — only the latest own-message in the thread carries it.
                Default state is "delivered"; future read_by wiring upgrades it. */}
            {showReceipt && (
              <div className="msg-receipt" data-state="delivered">
                <span className="msg-receipt-dot" aria-hidden="true" />
                <span>DELIVERED</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      className={`conversation-panel flex flex-col h-full bg-[var(--pulse-canvas)] ${className}`}
      role="region"
      aria-label="Active conversation"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {conversation ? (
        <>
          {/* Header */}
          <div className="conversation-header flex-shrink-0 px-6 py-4 border-b border-white/[0.07]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Avatar — channel uses initials/group icon; DM uses
                 *  the other user's avatar_url when available. */}
                {(() => {
                  const name = conversationDisplayName(conversation);
                  const isGroup = conversationIsGroup(conversation);
                  const dmAvatarUrl = conversation.kind === 'dm' ? conversation.pulse.other_user?.avatar_url : null;
                  if (dmAvatarUrl) {
                    return (
                      <img
                        src={dmAvatarUrl}
                        alt={name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    );
                  }
                  return (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center text-white font-bold">
                      {isGroup ? <Users /> : name.slice(0, 2).toUpperCase()}
                    </div>
                  );
                })()}

                {/* Channel/DM info */}
                <div>
                  <h2 className="text-lg font-bold text-[var(--pulse-ink)]">
                    {conversationDisplayName(conversation)}
                  </h2>
                  {conversationDescription(conversation) && (
                    <p className="text-sm text-[var(--pulse-ink-2)]">{conversationDescription(conversation)}</p>
                  )}
                  {conversation.kind === 'channel' && conversation.channel.members && conversation.channel.members.length > 0 && (
                    <p className="text-xs text-[var(--pulse-ink-3)]">
                      {conversation.channel.members.length} member{conversation.channel.members.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  className="p-2 rounded-lg hover:bg-rose-500/[0.12] transition-colors"
                  aria-label="Thread details"
                  title="Thread details"
                >
                  <Info className="text-[var(--pulse-ink-2)] hover:text-[var(--pulse-rose)]" />
                </button>
                <button
                  className="p-2 rounded-lg hover:bg-rose-500/[0.12] transition-colors"
                  aria-label="Search in thread"
                  title="Search in thread"
                >
                  <Search className="text-[var(--pulse-ink-2)] hover:text-[var(--pulse-rose)]" />
                </button>
              </div>
            </div>
          </div>

          {/* SR-only live region for incoming-message announcements */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {announcement}
          </div>

          {/* Messages area */}
          <div
            ref={messagesContainerRef}
            className="messages-area flex-1 overflow-y-auto px-6 py-4"
          >
            {isLoading ? (
              <EnhancedLoadingScreen
                currentStage="loading-messages"
                currentStageLabel="Loading messages..."
                progress={50}
                contained
              />
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/[0.1] flex items-center justify-center">
                    <MessageSquare className="text-2xl text-[var(--pulse-rose)]" />
                  </div>
                  <p className="text-sm text-[var(--pulse-ink-2)]">No messages yet</p>
                  <p className="text-xs text-[var(--pulse-ink-3)] mt-1">
                    Start the conversation!
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {Object.entries(messageGroups).map(([date, dateMessages]) => {
                  const annotated = annotateGrouping(dateMessages);
                  return (
                    <div key={date} className="message-group mb-6">
                      {/* Pulse date divider — coral dot + mono label, no center pill */}
                      <div className="date-divider">
                        <span className="date-divider-dot" aria-hidden="true" />
                        <span className="date-divider-label">{date}</span>
                        <span className="date-divider-line" aria-hidden="true" />
                      </div>

                      {/* Messages for this date — pass grouping flag */}
                      {annotated.map(({ message, grouped }) =>
                        renderMessageBubble
                          ? renderMessageBubble(message)
                          : defaultRenderMessageBubble(message, grouped)
                      )}
                    </div>
                  );
                })}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input area */}
          <div className="message-input-area flex-shrink-0 border-t border-white/[0.07]">
            {renderMessageInput ? renderMessageInput() : null}
          </div>
        </>
      ) : (
        // Empty state - no channel selected
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-rose-500/[0.1] border border-rose-500/20 flex items-center justify-center">
              <MessagesSquare className="text-3xl text-[var(--pulse-rose)]" />
            </div>
            <h3 className="text-lg font-bold text-[var(--pulse-ink)] mb-2">
              Select a thread
            </h3>
            <p className="text-sm text-[var(--pulse-ink-2)]">
              Choose a conversation from the list to start messaging
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ConversationPanel;
