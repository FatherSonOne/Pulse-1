import React from 'react';
import { motion } from 'framer-motion';
import { MessageChannel } from '../../types/messages';
import ThreadItem from './ThreadItem';
import ThreadSearch from './ThreadSearch';

interface ThreadListPanelProps {
  channels: MessageChannel[];
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onSearchChange?: (query: string) => void;
  searchQuery?: string;
  className?: string;
}

const ThreadListPanel: React.FC<ThreadListPanelProps> = ({
  channels,
  activeChannelId,
  onSelectChannel,
  onSearchChange,
  searchQuery = '',
  className = ''
}) => {
  // Separate pinned and regular channels
  const pinnedChannels = channels.filter(channel =>
    // Check if channel has a pinned flag or unread count > 0
    (channel as any).is_pinned === true
  );

  const regularChannels = channels.filter(channel =>
    (channel as any).is_pinned !== true
  );

  // Filter channels based on search query
  const filterChannels = (channelList: MessageChannel[]) => {
    if (!searchQuery.trim()) return channelList;

    const query = searchQuery.toLowerCase();
    return channelList.filter(channel =>
      channel.name.toLowerCase().includes(query) ||
      channel.description?.toLowerCase().includes(query) ||
      channel.last_message?.toLowerCase().includes(query)
    );
  };

  const filteredPinned = filterChannels(pinnedChannels);
  const filteredRegular = filterChannels(regularChannels);

  return (
    <motion.div
      className={`thread-list-panel flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 ${className}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="thread-list-header flex-shrink-0 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            Messages
          </h2>
          <button
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Create new thread"
            title="Create new thread"
          >
            <i className="fa-solid fa-plus text-zinc-600 dark:text-zinc-400"></i>
          </button>
        </div>

        {/* Search */}
        <ThreadSearch
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search threads..."
        />
      </div>

      {/* Thread List */}
      <div className="thread-list-content flex-1 overflow-y-auto">
        {/* Pinned Threads */}
        {filteredPinned.length > 0 && (
          <div className="pinned-threads-section mb-2">
            <div className="px-4 py-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Pinned
            </div>
            {filteredPinned.map((channel) => (
              <ThreadItem
                key={channel.id}
                channel={channel}
                isActive={channel.id === activeChannelId}
                isPinned={true}
                onClick={() => onSelectChannel(channel.id)}
              />
            ))}
          </div>
        )}

        {/* Regular Threads */}
        {filteredRegular.length > 0 && (
          <div className="regular-threads-section">
            {filteredPinned.length > 0 && (
              <div className="px-4 py-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                All Threads
              </div>
            )}
            {filteredRegular.map((channel) => (
              <ThreadItem
                key={channel.id}
                channel={channel}
                isActive={channel.id === activeChannelId}
                isPinned={false}
                onClick={() => onSelectChannel(channel.id)}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredPinned.length === 0 && filteredRegular.length === 0 && (
          <div className="empty-state px-4 py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <i className="fa-solid fa-inbox text-2xl text-zinc-400"></i>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {searchQuery ? 'No threads found' : 'No threads yet'}
            </p>
            {!searchQuery && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Start a new conversation to get started
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer with thread count */}
      <div className="thread-list-footer flex-shrink-0 px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
        {channels.length > 0 ? (
          <span>
            {channels.length} thread{channels.length !== 1 ? 's' : ''}
            {filteredPinned.length > 0 && ` • ${filteredPinned.length} pinned`}
          </span>
        ) : (
          <span>No threads</span>
        )}
      </div>
    </motion.div>
  );
};

export default ThreadListPanel;
