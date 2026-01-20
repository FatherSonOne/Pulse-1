import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageChannel, ChannelMessage } from '../../types/messages';

interface ConversationPanelProps {
  channel: MessageChannel | null;
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
  channel,
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
        <div className={`flex gap-2 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Avatar */}
          {!isOwnMessage && (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
              {message.sender_name ? message.sender_name.slice(0, 2).toUpperCase() : 'U'}
            </div>
          )}

          {/* Message content */}
          <div className="flex flex-col">
            {/* Sender name (for other users) */}
            {!isOwnMessage && message.sender_name && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 px-3">
                {message.sender_name}
              </span>
            )}

            {/* Message bubble */}
            <div
              className={`message-bubble px-4 py-2 rounded-2xl ${
                isOwnMessage
                  ? 'bg-blue-500 text-white rounded-br-md'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-bl-md'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

              {/* Edited indicator */}
              {message.edited_at && (
                <span className="text-xs opacity-70 mt-1 inline-block">(edited)</span>
              )}
            </div>

            {/* Reactions */}
            {message.reactions && Object.keys(message.reactions).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 px-3">
                {Object.entries(message.reactions).map(([emoji, users]) => (
                  <button
                    key={emoji}
                    className={`reaction-badge px-2 py-1 rounded-full text-xs flex items-center gap-1 transition-colors ${
                      users.includes(currentUserId)
                        ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'
                        : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                    onClick={() => onAddReaction?.(message.id, emoji)}
                    aria-label={`${emoji} reaction (${users.length})`}
                  >
                    <span>{emoji}</span>
                    <span className="text-zinc-600 dark:text-zinc-400">{users.length}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Timestamp */}
            <span
              className={`text-xs text-zinc-400 mt-1 px-3 ${isOwnMessage ? 'text-right' : 'text-left'}`}
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
      className={`conversation-panel flex flex-col h-full bg-white dark:bg-zinc-900 ${className}`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {channel ? (
        <>
          {/* Header */}
          <div className="conversation-header flex-shrink-0 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Channel avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                  {channel.is_group ? (
                    <i className="fa-solid fa-users"></i>
                  ) : (
                    channel.name.slice(0, 2).toUpperCase()
                  )}
                </div>

                {/* Channel info */}
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                    {channel.name}
                  </h2>
                  {channel.description && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{channel.description}</p>
                  )}
                  {channel.members && channel.members.length > 0 && (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      {channel.members.length} member{channel.members.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  aria-label="Thread details"
                  title="Thread details"
                >
                  <i className="fa-solid fa-info-circle text-zinc-600 dark:text-zinc-400"></i>
                </button>
                <button
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  aria-label="Search in thread"
                  title="Search in thread"
                >
                  <i className="fa-solid fa-search text-zinc-600 dark:text-zinc-400"></i>
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
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <i className="fa-solid fa-circle-notch fa-spin text-3xl text-zinc-400 mb-2"></i>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading messages...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <i className="fa-solid fa-comment text-2xl text-zinc-400"></i>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No messages yet</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                    Start the conversation!
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {Object.entries(messageGroups).map(([date, dateMessages]) => (
                  <div key={date} className="message-group mb-6">
                    {/* Date divider */}
                    <div className="flex items-center justify-center mb-4">
                      <div className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {date}
                      </div>
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
          <div className="message-input-area flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800">
            {renderMessageInput ? renderMessageInput() : null}
          </div>
        </>
      ) : (
        // Empty state - no channel selected
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <i className="fa-solid fa-comments text-3xl text-white"></i>
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">
              Select a thread
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Choose a conversation from the list to start messaging
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ConversationPanel;
