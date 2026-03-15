// src/components/Messages/ChannelList.tsx
import React, { useState, useEffect } from 'react';
import { MessageChannel } from '../../types/messages';
import { messageChannelService } from '../../services/messageChannelService';
import toast from 'react-hot-toast';

import { Hash, Lock, MessageSquareX, Plus, Trash2, Users } from 'lucide-react';

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
    <div className="h-full flex flex-col bg-[#0f172a]">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/[0.07] bg-[#0f172a] flex items-center justify-between">
        <h2 className="text-[#e2e8f0] font-bold flex items-center gap-2">
          <Hash className="text-[#fb7185]" />
          Pulse Messages
        </h2>
        <button
          onClick={() => setShowNewChannel(true)}
          className="w-12 h-12 rounded-lg bg-gradient-to-br from-rose-500/10 to-pink-500/10 border border-rose-500/20 hover:from-rose-500/20 hover:to-pink-500/20 hover:border-rose-500/40 flex items-center justify-center transition-all hover-scale"
          title="Create channel"
        >
          <Plus className="text-sm text-rose-500" />
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
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition"
            autoFocus
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newChannelDesc}
            onChange={(e) => setNewChannelDesc(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isGroup}
              onChange={(e) => setIsGroup(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 text-rose-500 focus:ring-rose-500 bg-zinc-800"
            />
            <Users className="text-rose-400" />
            Private Group Chat
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleCreateChannel}
              className="flex-1 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all btn-pulse shadow-lg shadow-rose-500/30"
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
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-rose-500 rounded-full animate-spin mx-auto mb-2"></div>
            <span className="text-zinc-500 text-sm">Loading channels...</span>
          </div>
        ) : channels.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-500 text-sm">
            <MessageSquareX className="text-2xl mb-2 block" />
            No channels yet. Create one to start!
          </div>
        ) : (
          <>
            {/* Public Channels */}
            <div className="mb-4">
              <div className="px-4 py-2 text-[10px] font-bold text-[#f43f5e] uppercase tracking-[2px]">
                Channels
              </div>
              {channels.filter(c => !c.is_group).map((channel) => (
                <button
                  key={channel.id}
                  className={`channel-item ${selectedChannel?.id === channel.id ? 'active' : ''}`}
                  onClick={() => onSelectChannel(channel)}
                >
                  <div className="channel-icon">
                    {channel.is_public ? (
                      <Hash />
                    ) : (
                      <Lock />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="channel-name truncate block">{channel.name}</span>
                  </div>
                  {channel.unread_count && channel.unread_count > 0 && (
                    <span className="unread-badge">
                      {channel.unread_count}
                    </span>
                  )}
                  <button
                    onClick={(e) => handleDeleteChannel(channel.id, e)}
                    className="w-12 h-12 min-w-[48px] min-h-[48px] rounded opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 transition-all ml-2 flex items-center justify-center"
                    title="Delete channel"
                  >
                    <Trash2 className="text-sm text-rose-500" />
                  </button>
                </button>
              ))}
            </div>

            {/* Group Chats */}
            {channels.filter(c => c.is_group).length > 0 && (
              <div>
                <div className="px-4 py-2 text-[10px] font-bold text-[#94a3b8] uppercase tracking-[2px]">
                  Group Chats
                </div>
                {channels.filter(c => c.is_group).map((channel) => (
                  <button
                    key={channel.id}
                    className={`channel-item ${selectedChannel?.id === channel.id ? 'active' : ''}`}
                    onClick={() => onSelectChannel(channel)}
                  >
                    <div className="channel-icon">
                      <Users />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="channel-name truncate block">{channel.name}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteChannel(channel.id, e)}
                      className="w-12 h-12 min-w-[48px] min-h-[48px] rounded opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 transition-all ml-2 flex items-center justify-center"
                      title="Delete group"
                    >
                      <Trash2 className="text-sm text-rose-500" />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/[0.07]">
        <button
          onClick={() => setShowNewChannel(true)}
          className="w-full py-2 text-sm text-[#94a3b8] hover:text-[#fb7185] hover:bg-rose-500/[0.08] rounded-lg transition flex items-center justify-center gap-2"
        >
          <Plus className="text-xs" />
          Add Channel
        </button>
      </div>
    </div>
  );
};

export default ChannelList;
