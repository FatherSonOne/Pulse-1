/**
 * MessagesSplitView - Phase 2 Implementation
 * Split-view layout with thread list (30%) and conversation panel (70%)
 *
 * This component can be used as a drop-in replacement for the existing Messages component
 * or integrated into it as a layout mode.
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import ThreadListPanel from './ThreadListPanel';
import ConversationPanel from './ConversationPanel';
import { MessageChannel, ChannelMessage } from '../../types/messages';
import { useSplitViewMessages } from '../../hooks/useSplitViewMessages';
import './messages.css';

interface MessagesSplitViewProps {
  channels: MessageChannel[];
  messages: Record<string, ChannelMessage[]>;
  currentUserId: string;
  onSendMessage?: (channelId: string, content: string) => void;
  onAddReaction?: (messageId: string, emoji: string) => void;
  onLoadMessages?: (channelId: string) => Promise<void>;
  isLoading?: boolean;
  renderMessageInput?: () => React.ReactNode;
  renderMessageBubble?: (message: ChannelMessage) => React.ReactNode;
  className?: string;
}

const MessagesSplitView: React.FC<MessagesSplitViewProps> = ({
  channels,
  messages,
  currentUserId,
  onSendMessage,
  onAddReaction,
  onLoadMessages,
  isLoading = false,
  renderMessageInput,
  renderMessageBubble,
  className = ''
}) => {
  const {
    activeChannelId,
    searchQuery,
    isMobile,
    showMobileView,
    selectChannel,
    setSearchQuery,
    toggleMobileView
  } = useSplitViewMessages({
    channels,
    enableKeyboardShortcuts: true
  });

  const [loadingMessages, setLoadingMessages] = useState(false);

  // Load messages when channel changes
  useEffect(() => {
    const loadChannelMessages = async () => {
      if (activeChannelId && onLoadMessages) {
        setLoadingMessages(true);
        try {
          await onLoadMessages(activeChannelId);
        } catch (error) {
          console.error('Failed to load messages:', error);
        } finally {
          setLoadingMessages(false);
        }
      }
    };

    loadChannelMessages();
  }, [activeChannelId, onLoadMessages]);

  // Get active channel and its messages
  const activeChannel = channels.find(ch => ch.id === activeChannelId) || null;
  const channelMessages = activeChannelId ? (messages[activeChannelId] || []) : [];

  // Mobile view classes
  const mobileViewClass = isMobile
    ? showMobileView === 'threads'
      ? 'show-threads'
      : 'show-conversation'
    : '';

  return (
    <div className={`messages-split-view full-height ${mobileViewClass} ${className}`}>
      {/* Thread List Panel (30%) */}
      <ThreadListPanel
        channels={channels}
        activeChannelId={activeChannelId}
        onSelectChannel={selectChannel}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Conversation Panel (70%) */}
      <AnimatePresence mode="wait">
        <ConversationPanel
          key={activeChannelId || 'no-channel'}
          channel={activeChannel}
          messages={channelMessages}
          currentUserId={currentUserId}
          onSendMessage={
            onSendMessage && activeChannelId
              ? (content) => onSendMessage(activeChannelId, content)
              : undefined
          }
          onAddReaction={onAddReaction}
          isLoading={loadingMessages || isLoading}
          renderMessageInput={renderMessageInput}
          renderMessageBubble={renderMessageBubble}
        />
      </AnimatePresence>

      {/* Mobile back button overlay */}
      {isMobile && showMobileView === 'conversation' && (
        <button
          onClick={toggleMobileView}
          className="mobile-back-button fixed top-4 left-4 z-50 bg-white dark:bg-zinc-800 rounded-lg shadow-lg"
          aria-label="Back to threads"
        >
          <i className="fa-solid fa-arrow-left text-zinc-600 dark:text-zinc-400"></i>
          <span className="text-sm text-zinc-900 dark:text-white">Threads</span>
        </button>
      )}

      {/* Keyboard shortcuts helper (can be toggled with ?) */}
      <KeyboardShortcutsHelper />
    </div>
  );
};

/**
 * Keyboard Shortcuts Helper Component
 * Shows available keyboard shortcuts
 */
const KeyboardShortcutsHelper: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts with ? key
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        // Don't trigger if user is typing in an input
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsVisible(prev => !prev);
        }
      }

      // Hide with Escape
      if (e.key === 'Escape' && isVisible) {
        e.preventDefault();
        setIsVisible(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => setIsVisible(false)}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            Keyboard Shortcuts
          </h3>
          <button
            onClick={() => setIsVisible(false)}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <i className="fa-solid fa-times text-zinc-600 dark:text-zinc-400"></i>
          </button>
        </div>

        <div className="space-y-3">
          <ShortcutItem
            keys={['Ctrl', ']']}
            description="Next thread"
          />
          <ShortcutItem
            keys={['Ctrl', '[']}
            description="Previous thread"
          />
          <ShortcutItem
            keys={['Ctrl', 'J']}
            description="Jump to search"
          />
          <ShortcutItem
            keys={['Esc']}
            description="Clear search"
          />
          <ShortcutItem
            keys={['?']}
            description="Toggle shortcuts help"
          />
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
          Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">?</kbd> to toggle this help
        </div>
      </div>
    </div>
  );
};

interface ShortcutItemProps {
  keys: string[];
  description: string;
}

const ShortcutItem: React.FC<ShortcutItemProps> = ({ keys, description }) => {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <React.Fragment key={key}>
            <kbd className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono text-xs border border-zinc-200 dark:border-zinc-700">
              {key}
            </kbd>
            {index < keys.length - 1 && (
              <span className="text-zinc-400">+</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default MessagesSplitView;
