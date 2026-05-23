import React from 'react';
import {
  Conversation,
  conversationDisplayName,
  conversationLastMessageAt,
  conversationLastMessagePreview,
  conversationUnreadCount,
  conversationIsGroup,
  conversationId,
} from '../../types/conversations';

import { BellOff, Lock, MessageCircle, Pin, Users } from 'lucide-react';

interface ThreadItemProps {
  conversation: Conversation;
  isActive: boolean;
  isPinned: boolean;
  onClick: () => void;
}

const ThreadItem: React.FC<ThreadItemProps> = ({
  conversation,
  isActive,
  isPinned,
  onClick
}) => {
  // Format timestamp
  const formatTimestamp = (timestamp?: string | null) => {
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

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const truncateMessage = (text?: string, maxLength: number = 60) => {
    if (!text) return 'No messages yet';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const name = conversationDisplayName(conversation);
  const lastAt = conversationLastMessageAt(conversation);
  const preview = conversationLastMessagePreview(conversation);
  const unread = conversationUnreadCount(conversation);
  const isGroup = conversationIsGroup(conversation);
  // Channel-only: private channels show a lock; DMs are always private.
  const isPrivateChannel = conversation.kind === 'channel' && !conversation.channel.is_public;
  // DM avatar: use the other user's avatar_url if available; else initials.
  const dmAvatarUrl = conversation.kind === 'dm' ? conversation.pulse.other_user?.avatar_url : null;

  return (
    <div
      className={`thread-item group relative px-4 py-3 cursor-pointer transition-[background-color,transform] duration-200 ease-out hover:translate-x-[2px] motion-reduce:hover:translate-x-0 ${
        isActive
          ? 'active bg-rose-500/[0.08]'
          : 'hover:bg-white/[0.04]'
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Thread: ${name}`}
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
          {dmAvatarUrl ? (
            <img
              src={dmAvatarUrl}
              alt={name}
              loading="lazy"
              decoding="async"
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : isGroup ? (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-600 to-rose-400 flex items-center justify-center text-white font-bold text-sm">
              <Users />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
              {getInitials(name)}
            </div>
          )}

          {/* Unread badge */}
          {unread > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--pulse-rose)] text-white text-xs font-bold flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h3
                className={`text-sm font-semibold truncate ${
                  isActive
                    ? 'text-[var(--pulse-rose)]'
                    : 'text-[var(--pulse-ink)]'
                }`}
              >
                {name}
              </h3>
              {isPinned && (
                <Pin className="text-xs text-zinc-400 flex-shrink-0" />
              )}
              {isPrivateChannel && (
                <Lock className="text-xs text-zinc-400 flex-shrink-0" />
              )}
            </div>

            <span className="text-xs text-[var(--pulse-ink-2)] flex-shrink-0 ml-2">
              {formatTimestamp(lastAt)}
            </span>
          </div>

          {/* Message preview */}
          <p
            className={`text-sm truncate ${
              unread > 0
                ? 'text-[var(--pulse-ink)] font-medium'
                : 'text-[var(--pulse-ink-2)]'
            }`}
          >
            {truncateMessage(preview)}
          </p>

          {/* Thread count (channels only — DMs don't have threads) */}
          {conversation.kind === 'channel' && (conversation.channel as any).thread_count > 0 && (
            <div className="flex items-center gap-1 mt-1 text-xs text-[var(--pulse-ink-2)]">
              <MessageCircle />
              <span>{(conversation.channel as any).thread_count} replies</span>
            </div>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div className="thread-item-actions absolute top-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1">
          <button
            className="p-1 rounded hover:bg-white/[0.08] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              // Handle pin/unpin
            }}
            aria-label={isPinned ? 'Unpin thread' : 'Pin thread'}
            title={isPinned ? 'Unpin thread' : 'Pin thread'}
          >
            <i className={`fa-solid fa-thumbtack text-xs ${isPinned ? 'text-[var(--pulse-rose)]' : 'text-[var(--pulse-ink-2)]'}`}></i>
          </button>
          <button
            className="p-1 rounded hover:bg-white/[0.08] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              // Handle mute
            }}
            aria-label="Mute thread"
            title="Mute thread"
          >
            <BellOff className="text-xs text-[var(--pulse-ink-2)]" />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Custom comparator: re-render only when stable identity, active state,
 * pin state, unread count, or last-message time actually changes.
 * Skips onClick reference changes (parent typically passes a fresh arrow
 * each render — including it would defeat memoization entirely).
 */
const arePropsEqual = (
  prev: ThreadItemProps,
  next: ThreadItemProps,
): boolean => {
  if (prev.isActive !== next.isActive) return false;
  if (prev.isPinned !== next.isPinned) return false;
  if (conversationId(prev.conversation) !== conversationId(next.conversation)) return false;
  if (conversationUnreadCount(prev.conversation) !== conversationUnreadCount(next.conversation)) return false;
  if (conversationLastMessageAt(prev.conversation) !== conversationLastMessageAt(next.conversation)) return false;
  if (conversationLastMessagePreview(prev.conversation) !== conversationLastMessagePreview(next.conversation)) return false;
  if (conversationDisplayName(prev.conversation) !== conversationDisplayName(next.conversation)) return false;
  return true;
};

export default React.memo(ThreadItem, arePropsEqual);
