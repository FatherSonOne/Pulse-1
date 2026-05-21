// src/components/Messages/index.tsx
//
// @deprecated  Channel-only `MessagesView` — never wired into production.
//
// This was an early experiment at a channels-only Messages surface.
// Production `MessagesWithProviders` mounts the legacy `Messages.tsx`
// monolith; the canonical replacement is `MessagesSplitView`. This
// component duplicates a subset of `MessagesSplitView`'s responsibility
// and should be deleted once Phase 5b/c consolidation is complete.
//
// The barrel re-exports below remain useful — those are the components
// that compose `MessagesSplitView`. Only the `MessagesView` default
// export is deprecated.

import React, { useState } from 'react';
import { ChannelList } from './ChannelList';
import { MessageChat } from './MessageChat';
import { MessageChannel } from '../../types/messages';
import { useAuth } from '../../hooks/useAuth';

import { ArrowLeft, MessagesSquare } from 'lucide-react';

interface MessagesViewProps {
  workspaceId?: string;
  currentUserId?: string;
  currentUserName?: string;
}

/**
 * @deprecated  Use `MessagesSplitView` instead. Slated for removal in
 * Phase 5c. See docs/deep-dives/messages_PHASED_PLAN_2026-04-26.md.
 */
export const MessagesView: React.FC<MessagesViewProps> = ({
  workspaceId = 'default-workspace',
  currentUserId: propUserId,
  currentUserName = 'You',
}) => {
  // Get user from auth context, fallback to prop or 'guest'
  const { user } = useAuth();
  const currentUserId = propUserId || user?.id || 'guest';
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel | null>(null);
  const [showChannelList, setShowChannelList] = useState(true);

  return (
    <div className="h-full flex bg-gray-50 dark:bg-slate-900 animate-fadeIn">
      {/* Channel Sidebar - Hidden on mobile when chat is open */}
      <div className={`w-64 flex-shrink-0 border-r border-gray-200 dark:border-white/[0.07] ${
        selectedChannel && !showChannelList ? 'hidden md:block' : ''
      }`}>
        <ChannelList
          workspaceId={workspaceId}
          selectedChannel={selectedChannel}
          onSelectChannel={(channel) => {
            setSelectedChannel(channel);
            setShowChannelList(false);
          }}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChannel ? (
          <>
            {/* Mobile back button */}
            <div className="md:hidden px-4 py-2 border-b border-gray-200 dark:border-[rgba(255,255,255,0.06)]">
              <button
                onClick={() => setShowChannelList(true)}
                className="flex items-center gap-2 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition"
              >
                <ArrowLeft />
                <span className="text-sm">Back to channels</span>
              </button>
            </div>
            <MessageChat
              channel={selectedChannel}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-slate-900">
            <div className="text-center p-8">
              <div className="w-20 h-20 rounded-2xl bg-rose-500/[0.1] border border-rose-500/20 flex items-center justify-center mx-auto mb-5">
                <MessagesSquare className="text-3xl text-rose-500 dark:text-[#fb7185]" />
              </div>
              <p className="text-xl font-bold mb-2 text-gray-900 dark:text-[#e2e8f0]">Select a channel</p>
              <p className="text-sm text-gray-600 dark:text-[#94a3b8] max-w-xs mx-auto">
                Choose a channel from the sidebar or create a new one to start messaging your team.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { ChannelList } from './ChannelList';
export { MessageChat } from './MessageChat';

// Bot Message Cards
export { MeetingRecapCard } from './MeetingRecapCard';
export { MeetingBriefingCard } from './MeetingBriefingCard';
export { ActionItemsCard } from './ActionItemsCard';

// Split-View Components (Phase 2)
export { default as ThreadListPanel } from './ThreadListPanel';
export { default as ThreadItem } from './ThreadItem';
export { default as ConversationPanel } from './ConversationPanel';
export { default as ThreadSearch } from './ThreadSearch';
export { default as MessagesSplitView } from './MessagesSplitView';

// Enhanced Split-View Container (Phase 2.1)
export { default as SplitViewMessagesContainer } from './SplitViewMessagesContainer';

// Focus Mode Components (Phase 5)
export { default as FocusMode } from './FocusMode';
export { FocusTimer } from './FocusTimer';
export { FocusControls } from './FocusControls';

export default MessagesView;
