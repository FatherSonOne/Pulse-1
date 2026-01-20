// src/components/Messages/index.tsx
// Main Messages component with channels and chat

import React, { useState } from 'react';
import { ChannelList } from './ChannelList';
import { MessageChat } from './MessageChat';
import { MessageChannel } from '../../types/messages';
import { useAuth } from '../../hooks/useAuth';

interface MessagesViewProps {
  workspaceId?: string;
  currentUserId?: string;
  currentUserName?: string;
}

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
    <div className="h-full flex bg-zinc-950 animate-fadeIn">
      {/* Channel Sidebar - Hidden on mobile when chat is open */}
      <div className={`w-64 flex-shrink-0 border-r border-zinc-800 ${
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
            <div className="md:hidden px-4 py-2 border-b border-zinc-800">
              <button
                onClick={() => setShowChannelList(true)}
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition"
              >
                <i className="fa-solid fa-arrow-left"></i>
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
          <div className="flex-1 flex items-center justify-center bg-zinc-950">
            <div className="text-center text-zinc-500 p-8">
              <div className="w-20 h-20 rounded-2xl bg-zinc-900 flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-comments text-3xl text-zinc-700"></i>
              </div>
              <p className="text-xl font-medium mb-2 text-white">Select a channel</p>
              <p className="text-sm text-zinc-500 max-w-xs mx-auto">
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
