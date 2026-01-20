import React from 'react';
import { motion } from 'framer-motion';
import { MessageChannel } from '../../types/messages';

interface ThreadItemProps {
  channel: MessageChannel;
  isActive: boolean;
  isPinned: boolean;
  onClick: () => void;
}

const ThreadItem: React.FC<ThreadItemProps> = ({
  channel,
  isActive,
  isPinned,
  onClick
}) => {
  // Format timestamp
  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    // Show date for older messages
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Truncate message preview
  const truncateMessage = (text?: string, maxLength: number = 60) => {
    if (!text) return 'No messages yet';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Check if channel is a group
  const isGroup = channel.is_group || (channel.members && channel.members.length > 2);

  return (
    <motion.div
      className={`thread-item relative px-4 py-3 cursor-pointer transition-colors ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-4 border-transparent'
      }`}
      onClick={onClick}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.2 }}
      role="button"
      tabIndex={0}
      aria-label={`Thread: ${channel.name}`}
      aria-current={isActive ? 'true' : 'false'}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 relative">
          {isGroup ? (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
              <i className="fa-solid fa-users"></i>
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
              {getInitials(channel.name)}
            </div>
          )}

          {/* Unread badge */}
          {channel.unread_count && channel.unread_count > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {channel.unread_count > 99 ? '99+' : channel.unread_count}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            {/* Channel name */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h3
                className={`text-sm font-semibold truncate ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-zinc-900 dark:text-white'
                }`}
              >
                {channel.name}
              </h3>
              {isPinned && (
                <i
                  className="fa-solid fa-thumbtack text-xs text-zinc-400 flex-shrink-0"
                  aria-label="Pinned"
                  title="Pinned thread"
                ></i>
              )}
              {!channel.is_public && (
                <i
                  className="fa-solid fa-lock text-xs text-zinc-400 flex-shrink-0"
                  aria-label="Private"
                  title="Private thread"
                ></i>
              )}
            </div>

            {/* Timestamp */}
            <span className="text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0 ml-2">
              {formatTimestamp(channel.last_message_at)}
            </span>
          </div>

          {/* Message preview */}
          <p
            className={`text-sm truncate ${
              channel.unread_count && channel.unread_count > 0
                ? 'text-zinc-700 dark:text-zinc-300 font-medium'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {truncateMessage(channel.last_message)}
          </p>

          {/* Thread count indicator (if applicable) */}
          {(channel as any).thread_count > 0 && (
            <div className="flex items-center gap-1 mt-1 text-xs text-zinc-400">
              <i className="fa-solid fa-comment-dots"></i>
              <span>{(channel as any).thread_count} replies</span>
            </div>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div className="thread-item-actions absolute top-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1">
          <button
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              // Handle pin/unpin
            }}
            aria-label={isPinned ? 'Unpin thread' : 'Pin thread'}
            title={isPinned ? 'Unpin thread' : 'Pin thread'}
          >
            <i className={`fa-solid fa-thumbtack text-xs ${isPinned ? 'text-blue-500' : 'text-zinc-400'}`}></i>
          </button>
          <button
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              // Handle mute
            }}
            aria-label="Mute thread"
            title="Mute thread"
          >
            <i className="fa-solid fa-bell-slash text-xs text-zinc-400"></i>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ThreadItem;
