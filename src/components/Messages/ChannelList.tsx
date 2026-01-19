// src/components/Messages/ChannelList.tsx
import React, { useState, useEffect } from 'react';
import { MessageChannel } from '../../types/messages';
import { messageChannelService } from '../../services/messageChannelService';
import toast from 'react-hot-toast';

interface ChannelListProps {
  workspaceId: string;
  selectedChannel: MessageChannel | null;
  onSelectChannel: (channel: MessageChannel) => void;
}

export const ChannelList: React.FC<ChannelListProps> = ({
  workspaceId,
  selectedChannel,
  onSelectChannel,
}) => {
  const [channels, setChannels] = useState<MessageChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [isGroup, setIsGroup] = useState(false);

  useEffect(() => {
    loadChannels();
  }, [workspaceId]);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const data = await messageChannelService.getChannels(workspaceId);
      setChannels(data || []);
      // Auto-select first channel
      if (data && data.length > 0 && !selectedChannel) {
        onSelectChannel(data[0]);
      }
    } catch (error) {
      console.error('Failed to load channels:', error);
      setChannels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error('Channel name required');
      return;
    }

    try {
      const newChannel = await messageChannelService.createChannel(
        workspaceId,
        newChannelName,
        newChannelDesc,
        isGroup
      );
      setChannels([...channels, newChannel]);
      onSelectChannel(newChannel);
      setNewChannelName('');
      setNewChannelDesc('');
      setShowNewChannel(false);
      toast.success(`${isGroup ? 'Group' : 'Channel'} created!`);
    } catch (error) {
      console.error('Failed to create channel:', error);
      toast.error(`Failed to create ${isGroup ? 'group' : 'channel'}. Please try again.`);
    }
  };

  const handleDeleteChannel = async (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this channel? This cannot be undone.')) return;

    try {
      await messageChannelService.deleteChannel(channelId);
      const remaining = channels.filter((c) => c.id !== channelId);
      setChannels(remaining);
      if (selectedChannel?.id === channelId && remaining.length > 0) {
        onSelectChannel(remaining[0]);
      }
      toast.success('Channel deleted');
    } catch (error) {
      console.error('Failed to delete channel:', error);
      toast.error('Failed to delete channel. Please try again.');
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="px-4 py-4 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <i className="fa-solid fa-hashtag text-red-500"></i>
          Channels
        </h2>
        <button
          onClick={() => setShowNewChannel(true)}
          className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-all hover-scale"
          title="Create channel"
        >
          <i className="fa-solid fa-plus text-xs text-red-500"></i>
        </button>
      </div>

      {/* New Channel Form */}
      {showNewChannel && (
        <div className="px-4 py-4 border-b border-zinc-800 space-y-3 animate-slideInDown bg-zinc-900/50">
          <input
            type="text"
            placeholder="Channel name..."
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition"
            autoFocus
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newChannelDesc}
            onChange={(e) => setNewChannelDesc(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isGroup}
              onChange={(e) => setIsGroup(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 text-red-500 focus:ring-red-500 bg-zinc-800"
            />
            <i className="fa-solid fa-users-rectangle text-blue-400"></i>
            Private Group Chat
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleCreateChannel}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all btn-pulse"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowNewChannel(false);
                setNewChannelName('');
                setNewChannelDesc('');
              }}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-xs font-medium transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="px-4 py-8 text-center">
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin mx-auto mb-2"></div>
            <span className="text-zinc-500 text-sm">Loading channels...</span>
          </div>
        ) : channels.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-500 text-sm">
            <i className="fa-solid fa-comment-slash text-2xl mb-2 block"></i>
            No channels yet. Create one to start!
          </div>
        ) : (
          <>
            {/* Public Channels */}
            <div className="mb-4">
              <div className="px-4 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Channels
              </div>
              {channels.filter(c => !c.is_group).map((channel) => (
                <div
                  key={channel.id}
                  className={`mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all group flex items-center justify-between ${
                    selectedChannel?.id === channel.id
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                  onClick={() => onSelectChannel(channel)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {channel.is_public ? (
                      <i className="fa-solid fa-hashtag text-xs text-zinc-500"></i>
                    ) : (
                      <i className="fa-solid fa-lock text-xs text-yellow-500"></i>
                    )}
                    <span className="text-sm font-medium truncate">{channel.name}</span>
                    {channel.unread_count && channel.unread_count > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {channel.unread_count}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDeleteChannel(channel.id, e)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all ml-2"
                    title="Delete channel"
                  >
                    <i className="fa-solid fa-trash text-[10px] text-red-500"></i>
                  </button>
                </div>
              ))}
            </div>

            {/* Group Chats */}
            {channels.filter(c => c.is_group).length > 0 && (
              <div>
                <div className="px-4 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Group Chats
                </div>
                {channels.filter(c => c.is_group).map((channel) => (
                  <div
                    key={channel.id}
                    className={`mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all group flex items-center justify-between ${
                      selectedChannel?.id === channel.id
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                    }`}
                    onClick={() => onSelectChannel(channel)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <i className="fa-solid fa-users text-xs text-blue-400"></i>
                      <span className="text-sm font-medium truncate">{channel.name}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteChannel(channel.id, e)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all ml-2"
                      title="Delete group"
                    >
                      <i className="fa-solid fa-trash text-[10px] text-red-500"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800">
        <button
          onClick={() => setShowNewChannel(true)}
          className="w-full py-2 text-sm text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-plus text-xs"></i>
          Add Channel
        </button>
      </div>
    </div>
  );
};

export default ChannelList;
