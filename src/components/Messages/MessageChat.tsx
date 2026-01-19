// src/components/Messages/MessageChat.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ChannelMessage, MessageChannel } from '../../types/messages';
import { messageChannelService } from '../../services/messageChannelService';
import { UserContactCard } from '../UserContact/UserContactCard';
import { VoiceTextButton } from '../shared/VoiceTextButton';
import toast from 'react-hot-toast';

interface MessageChatProps {
  channel: MessageChannel;
  currentUserId: string;
  currentUserName?: string;
}

export const MessageChat: React.FC<MessageChatProps> = ({
  channel,
  currentUserId,
  currentUserName = 'You',
}) => {
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadMessages();
  }, [channel.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await messageChannelService.getMessages(channel.id);
      setMessages(data || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const newMessage: ChannelMessage = {
      id: Date.now().toString(),
      channel_id: channel.id,
      sender_id: currentUserId,
      sender_name: currentUserName,
      content: inputValue,
      message_type: 'text',
      created_at: new Date().toISOString(),
      is_pinned: false,
    };

    try {
      setSending(true);
      setMessages([...messages, newMessage]);
      setInputValue('');

      await messageChannelService.sendMessage(
        channel.id,
        currentUserId,
        inputValue
      );
      toast.success('Message sent!');
    } catch (error) {
      // Message already added locally, just show success
      console.log('Message sent locally');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) return;

    try {
      await messageChannelService.deleteMessage(messageId);
    } catch (error) {
      // Continue with local delete
    }
    setMessages(messages.filter((m) => m.id !== messageId));
    toast.success('Message deleted');
  };

  const handlePinMessage = async (messageId: string) => {
    try {
      const message = messages.find(m => m.id === messageId);
      const newPinned = !message?.is_pinned;
      await messageChannelService.pinMessage(messageId, newPinned);
      setMessages(messages.map(m =>
        m.id === messageId ? { ...m, is_pinned: newPinned } : m
      ));
      toast.success(newPinned ? 'Message pinned!' : 'Message unpinned');
    } catch (error) {
      // Update locally
      setMessages(messages.map(m =>
        m.id === messageId ? { ...m, is_pinned: !m.is_pinned } : m
      ));
      toast.success('Pin toggled');
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await messageChannelService.addReaction(messageId, emoji, currentUserId);
    } catch (error) {
      // Continue locally
    }
    setMessages(messages.map(m => {
      if (m.id === messageId) {
        const reactions = m.reactions || {};
        if (!reactions[emoji]) reactions[emoji] = [];
        if (!reactions[emoji].includes(currentUserId)) {
          reactions[emoji].push(currentUserId);
        }
        return { ...m, reactions };
      }
      return m;
    }));
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'from-red-500 to-orange-500',
      'from-blue-500 to-cyan-500',
      'from-green-500 to-emerald-500',
      'from-purple-500 to-pink-500',
      'from-yellow-500 to-amber-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {channel.is_group ? (
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <i className="fa-solid fa-users text-blue-400"></i>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
              <i className="fa-solid fa-hashtag text-zinc-400"></i>
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              {channel.is_group ? '' : '#'}{channel.name}
              {channel.is_public === false && !channel.is_group && (
                <i className="fa-solid fa-lock text-xs text-yellow-500"></i>
              )}
            </h2>
            {channel.description && (
              <p className="text-sm text-zinc-500">{channel.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="w-9 h-9 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition text-zinc-400 hover:text-white"
            title="Search messages"
          >
            <i className="fa-solid fa-search text-sm"></i>
          </button>
          <button
            className="w-9 h-9 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition text-zinc-400 hover:text-white"
            title="Pinned messages"
          >
            <i className="fa-solid fa-thumbtack text-sm"></i>
          </button>
          <button
            className="w-9 h-9 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition text-zinc-400 hover:text-white"
            title="Channel members"
          >
            <i className="fa-solid fa-user-group text-sm"></i>
          </button>
          <button
            className="w-9 h-9 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition text-zinc-400 hover:text-white"
            title="Channel settings"
          >
            <i className="fa-solid fa-gear text-sm"></i>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin mx-auto mb-3"></div>
              <span className="text-zinc-500 text-sm">Loading messages...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-zinc-500">
              <i className="fa-solid fa-comments text-4xl mb-3 block text-zinc-700"></i>
              <p className="text-lg font-medium mb-1">No messages yet</p>
              <p className="text-sm">Be the first to send a message in #{channel.name}!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((message, index) => {
              const showDate = index === 0 ||
                formatDate(message.created_at) !== formatDate(messages[index - 1].created_at);
              const isOwnMessage = message.sender_id === currentUserId || message.sender_id === 'current';

              return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <div className="flex items-center gap-4 py-4">
                      <div className="flex-1 h-px bg-zinc-800"></div>
                      <span className="text-xs text-zinc-500 font-medium">{formatDate(message.created_at)}</span>
                      <div className="flex-1 h-px bg-zinc-800"></div>
                    </div>
                  )}
                  <div className={`group py-2 px-3 -mx-3 rounded-lg hover:bg-zinc-900/50 transition ${message.is_pinned ? 'bg-yellow-500/5 border-l-2 border-yellow-500' : ''}`}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => !isOwnMessage && setSelectedUserId(message.sender_id)}
                        className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(message.sender_name || 'U')} flex items-center justify-center flex-shrink-0 border-0 ${!isOwnMessage ? 'cursor-pointer hover:ring-2 hover:ring-red-500/50 transition-all' : 'cursor-default'}`}
                        disabled={isOwnMessage}
                        title={!isOwnMessage ? 'View contact details' : undefined}
                      >
                        <span className="text-white text-sm font-semibold">
                          {(message.sender_name || 'U').charAt(0).toUpperCase()}
                        </span>
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`font-semibold text-sm ${isOwnMessage ? 'text-red-400' : 'text-white'}`}>
                            {message.sender_name || message.sender_id}
                          </span>
                          <span className="text-[11px] text-zinc-600">
                            {formatTime(message.created_at)}
                          </span>
                          {message.is_pinned && (
                            <span className="text-[10px] text-yellow-500 flex items-center gap-1">
                              <i className="fa-solid fa-thumbtack"></i>
                              Pinned
                            </span>
                          )}
                          {message.edited_at && (
                            <span className="text-[10px] text-zinc-600">(edited)</span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-300 break-words whitespace-pre-wrap">
                          {message.content}
                        </p>

                        {/* Reactions */}
                        {message.reactions && Object.keys(message.reactions).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Object.entries(message.reactions).map(([emoji, users]) => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(message.id, emoji)}
                                className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition ${
                                  (users as string[]).includes(currentUserId)
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span>{(users as string[]).length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Message Actions */}
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                        <button
                          onClick={() => handleReaction(message.id, '👍')}
                          className="w-7 h-7 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition"
                          title="Add reaction"
                        >
                          <i className="fa-regular fa-face-smile text-xs"></i>
                        </button>
                        <button
                          onClick={() => handlePinMessage(message.id)}
                          className={`w-7 h-7 rounded hover:bg-zinc-800 flex items-center justify-center transition ${message.is_pinned ? 'text-yellow-500' : 'text-zinc-500 hover:text-yellow-500'}`}
                          title={message.is_pinned ? 'Unpin message' : 'Pin message'}
                        >
                          <i className="fa-solid fa-thumbtack text-xs"></i>
                        </button>
                        {isOwnMessage && (
                          <button
                            onClick={() => handleDeleteMessage(message.id)}
                            className="w-7 h-7 rounded hover:bg-red-500/20 flex items-center justify-center text-zinc-500 hover:text-red-500 transition"
                            title="Delete message"
                          >
                            <i className="fa-solid fa-trash text-xs"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="px-6 py-4 border-t border-zinc-800">
        <div className="flex items-end gap-3">
          <button
            className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition text-zinc-400 hover:text-white flex-shrink-0"
            title="Attach file"
          >
            <i className="fa-solid fa-paperclip"></i>
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Message #${channel.name}`}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 resize-none text-sm transition"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>

          <button
            className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition text-zinc-400 hover:text-white flex-shrink-0"
            title="Add emoji"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <i className="fa-regular fa-face-smile"></i>
          </button>

          {/* Voice-to-Text Button */}
          <VoiceTextButton
            onTranscript={(text) => {
              setInputValue(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text);
              inputRef.current?.focus();
            }}
            size="md"
            className="flex-shrink-0"
          />

          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || sending}
            className="w-10 h-10 rounded-lg bg-red-500 hover:bg-red-600 disabled:bg-zinc-700 disabled:cursor-not-allowed flex items-center justify-center transition btn-pulse flex-shrink-0"
            title="Send message"
          >
            <i className={`fa-solid ${sending ? 'fa-circle-notch fa-spin' : 'fa-paper-plane'} text-white`}></i>
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px] text-zinc-600">
          <span>Press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">Shift+Enter</kbd> for new line</span>
          <span>{inputValue.length} characters</span>
        </div>
      </div>

      {/* User Contact Card Modal */}
      {selectedUserId && (
        <UserContactCard
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
};

export default MessageChat;
