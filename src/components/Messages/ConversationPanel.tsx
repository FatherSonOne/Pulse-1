import React, { useRef, useEffect } from 'react';
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  // Default message bubble renderer
  const defaultRenderMessageBubble = (message: ChannelMessage) => {
    const isOwnMessage = message.sender_id === currentUserId;

    return (
      <motion.div
        key={message.id}
        className={`message-bubble-wrapper flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className={`flex gap-2.5 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Avatar */}
          {!isOwnMessage && (
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
              {message.sender_name ? message.sender_name.slice(0, 2).toUpperCase() : 'U'}
            </div>
          )}

          {/* Message content */}
          <div className="flex flex-col">
            {/* Sender name (for other users) */}
            {!isOwnMessage && message.sender_name && (
              <span className="text-[13px] font-semibold text-[#fb7185] mb-1 px-3">
                {message.sender_name}
              </span>
            )}

            {/* Message bubble */}
            <div
              className={`message-bubble ${
                isOwnMessage
                  ? 'message-bubble-sent'
                  : 'message-bubble-received'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>

              {/* Edited indicator */}
              {message.edited_at && (
                <span className="text-xs opacity-60 mt-1 inline-block">(edited)</span>
              )}
            </div>

            {/* Reactions */}
            {message.reactions && Object.keys(message.reactions).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5 px-1">
                {Object.entries(message.reactions).map(([emoji, users]) => (
                  <button
                    key={emoji}
                    className={`reaction-badge px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-colors ${
                      users.includes(currentUserId)
                        ? 'bg-rose-500/20 border border-rose-500/30 text-[#fb7185]'
                        : 'bg-[#1e293b] border border-white/[0.07] text-[#94a3b8] hover:bg-white/[0.08]'
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

            {/* Timestamp */}
            <span
              className={`text-[11px] text-[#94a3b8] mt-1 px-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}
            >
              {formatMessageTime(message.created_at)}
            </span>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      className={`conversation-panel flex flex-col h-full bg-black ${className}`}
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
                  <h2 className="text-lg font-bold text-[#e2e8f0]">
                    {conversationDisplayName(conversation)}
                  </h2>
                  {conversationDescription(conversation) && (
                    <p className="text-sm text-[#94a3b8]">{conversationDescription(conversation)}</p>
                  )}
                  {conversation.kind === 'channel' && conversation.channel.members && conversation.channel.members.length > 0 && (
                    <p className="text-xs text-[#94a3b8]/70">
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
                  <Info className="text-[#94a3b8] hover:text-[#fb7185]" />
                </button>
                <button
                  className="p-2 rounded-lg hover:bg-rose-500/[0.12] transition-colors"
                  aria-label="Search in thread"
                  title="Search in thread"
                >
                  <Search className="text-[#94a3b8] hover:text-[#fb7185]" />
                </button>
              </div>
            </div>
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
                    <MessageSquare className="text-2xl text-[#fb7185]" />
                  </div>
                  <p className="text-sm text-[#94a3b8]">No messages yet</p>
                  <p className="text-xs text-[#94a3b8]/60 mt-1">
                    Start the conversation!
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {Object.entries(messageGroups).map(([date, dateMessages]) => (
                  <div key={date} className="message-group mb-6">
                    {/* Date divider */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1 h-px bg-rose-500/20" />
                      <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-[3px] flex-shrink-0">{date}</span>
                      <div className="flex-1 h-px bg-rose-500/20" />
                    </div>

                    {/* Messages for this date */}
                    {dateMessages.map((message) =>
                      renderMessageBubble
                        ? renderMessageBubble(message)
                        : defaultRenderMessageBubble(message)
                    )}
                  </div>
                ))}
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
              <MessagesSquare className="text-3xl text-[#fb7185]" />
            </div>
            <h3 className="text-lg font-bold text-[#e2e8f0] mb-2">
              Select a thread
            </h3>
            <p className="text-sm text-[#94a3b8]">
              Choose a conversation from the list to start messaging
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ConversationPanel;
