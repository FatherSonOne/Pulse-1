import React from 'react';
import { motion } from 'framer-motion';
import {
  Conversation,
  conversationDisplayName,
  conversationLastMessagePreview,
  conversationDescription,
  conversationId,
} from '../../types/conversations';
import ThreadItem from './ThreadItem';
import ThreadSearch from './ThreadSearch';

import { Inbox, Plus } from 'lucide-react';

interface ThreadListPanelProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onSearchChange?: (query: string) => void;
  searchQuery?: string;
  className?: string;
}

const ThreadListPanel: React.FC<ThreadListPanelProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onSearchChange,
  searchQuery = '',
  className = ''
}) => {
  // Pinned vs regular — channels expose `is_pinned` via an ad-hoc flag
  // on MessageChannel. DMs don't have a pinned concept yet (Phase 5d.1).
  const pinnedConversations = conversations.filter((c) =>
    c.kind === 'channel' && (c.channel as any).is_pinned === true
  );
  const regularConversations = conversations.filter((c) =>
    !(c.kind === 'channel' && (c.channel as any).is_pinned === true)
  );

  // Filter by search query against display name, description, and last preview.
  const filterConversations = (list: Conversation[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((c) =>
      conversationDisplayName(c).toLowerCase().includes(q) ||
      (conversationDescription(c)?.toLowerCase().includes(q) ?? false) ||
      conversationLastMessagePreview(c).toLowerCase().includes(q)
    );
  };

  const filteredPinned = filterConversations(pinnedConversations);
  const filteredRegular = filterConversations(regularConversations);

  return (
    <motion.div
      className={`thread-list-panel flex flex-col h-full bg-[#0f172a] border-r border-white/[0.07] ${className}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="thread-list-header flex-shrink-0 px-4 py-3 border-b border-white/[0.07]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-[#e2e8f0]">
            Messages
          </h2>
          <button
            className="p-2 rounded-lg hover:bg-rose-500/[0.12] transition-colors"
            aria-label="Create new thread"
            title="Create new thread"
          >
            <Plus className="text-[#fb7185]" />
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
        {/* Pinned */}
        {filteredPinned.length > 0 && (
          <div className="pinned-threads-section mb-2">
            <div className="px-4 py-2 text-[10px] font-bold text-[#f43f5e] uppercase tracking-[2px]">
              Pinned
            </div>
            {filteredPinned.map((c) => {
              const id = conversationId(c);
              return (
                <ThreadItem
                  key={id}
                  conversation={c}
                  isActive={id === activeConversationId}
                  isPinned={true}
                  onClick={() => onSelectConversation(id)}
                />
              );
            })}
          </div>
        )}

        {/* Regular */}
        {filteredRegular.length > 0 && (
          <div className="regular-threads-section">
            {filteredPinned.length > 0 && (
              <div className="px-4 py-2 text-[10px] font-bold text-[#94a3b8] uppercase tracking-[2px]">
                All Threads
              </div>
            )}
            {filteredRegular.map((c) => {
              const id = conversationId(c);
              return (
                <ThreadItem
                  key={id}
                  conversation={c}
                  isActive={id === activeConversationId}
                  isPinned={false}
                  onClick={() => onSelectConversation(id)}
                />
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {filteredPinned.length === 0 && filteredRegular.length === 0 && (
          <div className="empty-state px-4 py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/[0.1] flex items-center justify-center">
              <Inbox className="text-2xl text-[#fb7185]" />
            </div>
            <p className="text-sm text-[#94a3b8]">
              {searchQuery ? 'No threads found' : 'No threads yet'}
            </p>
            {!searchQuery && (
              <p className="text-xs text-[#94a3b8]/70 mt-1">
                Start a new conversation to get started
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="thread-list-footer flex-shrink-0 px-4 py-2 border-t border-white/[0.07] text-[11px] text-[#94a3b8]">
        {conversations.length > 0 ? (
          <span>
            {conversations.length} thread{conversations.length !== 1 ? 's' : ''}
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
