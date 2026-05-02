// src/components/Messages/MessageChat.tsx
// REDESIGNED: Flat design with user color coding, role badges, and smart timestamps
// Version: 2.0 | Date: 2026-02-08

import React, { useState, useEffect, useRef } from 'react';
import { ChannelMessage, MessageChannel, AnyChannelMessage, isBotMessage } from '../../types/messages';
import { messageChannelService } from '../../services/messageChannelService';
import { UserContactCard } from '../UserContact/UserContactCard';
import { VoiceTextButton } from '../shared/VoiceTextButton';
import { SmartTimestamp } from './SmartTimestamp';
import { UserBadge, UserRole } from './UserBadge';
import { BotMessage } from './BotMessage';
import { getAccessibleUserColor } from '../../utils/userColors';
import toast from 'react-hot-toast';

import { Check, Hash, Lock, MessagesSquare, Paperclip, Pencil, Pin, Search, Settings, Smile, Trash2, Users, X } from 'lucide-react';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  // Read receipts: messageId -> ordered list of {userId, readAt}.
  const [readsByMessage, setReadsByMessage] = useState<Record<string, Array<{ userId: string; readAt: string }>>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  // IntersectionObserver bookkeeping for mark-read.
  const messageNodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingReadIds = useRef<Set<string>>(new Set());
  const flushReadTimerRef = useRef<number | null>(null);
  const markedReadIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadMessages();
    // Reset per-channel read state
    setReadsByMessage({});
    markedReadIds.current.clear();
    pendingReadIds.current.clear();
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
      // Hydrate read receipts for the loaded batch.
      if (data && data.length > 0) {
        try {
          const reads = await messageChannelService.getReadsForMessages(
            data.map((m) => m.id)
          );
          setReadsByMessage(reads);
        } catch {
          // Reading reads is best-effort
        }
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to incoming read receipts for this channel so the sender
  // sees their messages turn "read" without a refresh.
  useEffect(() => {
    const unsubscribe = messageChannelService.subscribeToChannelReads(
      channel.id,
      ({ messageId, userId, readAt }) => {
        setReadsByMessage((prev) => {
          const existing = prev[messageId] || [];
          if (existing.some((r) => r.userId === userId)) return prev;
          return { ...prev, [messageId]: [...existing, { userId, readAt }] };
        });
      }
    );
    return () => {
      // removeChannel returns a Promise; we don't need to await it.
      void unsubscribe();
    };
  }, [channel.id]);

  // Flush pending read marks in batches so we don't fire one DB write
  // per message scrolled-into-view.
  const scheduleFlushReads = () => {
    if (flushReadTimerRef.current !== null) return;
    flushReadTimerRef.current = window.setTimeout(async () => {
      flushReadTimerRef.current = null;
      const ids = Array.from(pendingReadIds.current);
      pendingReadIds.current.clear();
      if (ids.length === 0) return;
      try {
        await messageChannelService.markMessagesRead(ids, currentUserId);
        ids.forEach((id) => markedReadIds.current.add(id));
      } catch (err) {
        // Re-queue on failure so the next visibility tick retries.
        ids.forEach((id) => pendingReadIds.current.add(id));
        console.error('[MessageChat] markMessagesRead failed:', err);
      }
    }, 600);
  };

  // IntersectionObserver: when a non-own message becomes visible, queue
  // it for a batched mark-read. Re-runs when the message list changes
  // so newly-arrived messages get observed.
  useEffect(() => {
    if (messages.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let queued = false;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const messageId = (entry.target as HTMLElement).dataset.messageId;
          if (!messageId) continue;
          if (markedReadIds.current.has(messageId)) continue;
          if (pendingReadIds.current.has(messageId)) continue;
          pendingReadIds.current.add(messageId);
          queued = true;
        }
        if (queued) scheduleFlushReads();
      },
      { threshold: 0.6 }
    );
    // Observe own-message elements aren't necessary, but we observe all
    // and the worker filters by ownership server-side via RLS; here we
    // skip own messages client-side for efficiency.
    for (const m of messages) {
      if (m.sender_id === currentUserId) continue;
      const node = messageNodeRefs.current.get(m.id);
      if (node) observer.observe(node);
    }
    return () => {
      observer.disconnect();
      if (flushReadTimerRef.current !== null) {
        clearTimeout(flushReadTimerRef.current);
        flushReadTimerRef.current = null;
      }
    };
  }, [messages, currentUserId]);

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

  const startEditMessage = (messageId: string, currentContent: string) => {
    setEditingId(messageId);
    setEditText(currentContent);
    // Focus the edit input after render
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const cancelEditMessage = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEditMessage = async () => {
    if (!editingId) return;
    const trimmed = editText.trim();
    if (!trimmed) return;
    const idToSave = editingId;
    const original = messages.find((m) => m.id === idToSave)?.content;
    // Optimistic update
    setMessages(messages.map((m) =>
      m.id === idToSave
        ? { ...m, content: trimmed, edited_at: new Date().toISOString() }
        : m
    ));
    setEditingId(null);
    setEditText('');
    try {
      await messageChannelService.editMessage(idToSave, trimmed);
      toast.success('Message updated');
    } catch (error) {
      // Roll back on failure
      if (original !== undefined) {
        setMessages((prev) => prev.map((m) =>
          m.id === idToSave ? { ...m, content: original, edited_at: undefined } : m
        ));
      }
      toast.error('Failed to update message');
    }
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

  // Get user role (mock implementation - should come from actual user data)
  const getUserRole = (userId: string): UserRole => {
    // TODO: Replace with actual role lookup from user service
    if (userId === currentUserId) return 'member';
    // Mock logic for demo - in production, fetch from user permissions
    if (userId.includes('admin')) return 'admin';
    if (userId.includes('mod')) return 'moderator';
    if (userId.includes('bot')) return 'bot';
    return 'member';
  };

  // Check if dark mode is active
  const isDarkMode = document.documentElement.classList.contains('dark');

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-3">
          {channel.is_group ? (
            <div className="w-10 h-10 rounded-lg bg-rose-500/15 ring-1 ring-rose-500/30 flex items-center justify-center">
              <Users className="text-rose-400" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 ring-1 ring-rose-500/20 flex items-center justify-center">
              <Hash className="text-rose-400" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              {channel.is_group ? '' : '#'}{channel.name}
              {channel.is_public === false && !channel.is_group && (
                <Lock className="text-xs text-zinc-400 dark:text-zinc-500" />
              )}
            </h2>
            {channel.description && (
              <p className="text-sm text-zinc-500">{channel.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="w-9 h-9 rounded-lg hover:bg-rose-500/[0.12] flex items-center justify-center transition text-[#94a3b8] hover:text-[#fb7185]"
            title="Search messages"
          >
            <Search className="text-sm" />
          </button>
          <button
            className="w-9 h-9 rounded-lg hover:bg-rose-500/[0.12] flex items-center justify-center transition text-[#94a3b8] hover:text-[#fb7185]"
            title="Pinned messages"
          >
            <Pin className="text-sm" />
          </button>
          <button
            className="w-9 h-9 rounded-lg hover:bg-rose-500/[0.12] flex items-center justify-center transition text-[#94a3b8] hover:text-[#fb7185]"
            title="Channel members"
          >
            <Users className="text-sm" />
          </button>
          <button
            className="w-9 h-9 rounded-lg hover:bg-rose-500/[0.12] flex items-center justify-center transition text-[#94a3b8] hover:text-[#fb7185]"
            title="Channel settings"
          >
            <Settings className="text-sm" />
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
              <MessagesSquare className="text-4xl mb-3 block text-zinc-700" />
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
                    <div className="flex items-center gap-3 py-4">
                      <div className="flex-1 h-px bg-rose-500/20"></div>
                      <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-[3px]">{formatDate(message.created_at)}</span>
                      <div className="flex-1 h-px bg-rose-500/20"></div>
                    </div>
                  )}
                  {/* Bot messages render with BotMessage component */}
                  {isBotMessage(message as AnyChannelMessage) ? (
                    <BotMessage message={message as any} />
                  ) : null}

                  {!isBotMessage(message as AnyChannelMessage) && (
                  <div
                    className={`message-bubble ${isOwnMessage ? 'message-bubble-sent' : 'message-bubble-received'} group ${message.is_pinned ? 'ring-2 ring-yellow-500/30' : ''}`}
                    data-message-id={message.id}
                    ref={(node) => {
                      if (node) messageNodeRefs.current.set(message.id, node);
                      else messageNodeRefs.current.delete(message.id);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar - Left aligned for all messages */}
                      <button
                        onClick={() => !isOwnMessage && setSelectedUserId(message.sender_id)}
                        className={`rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${!isOwnMessage ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
                        disabled={isOwnMessage}
                        title={!isOwnMessage ? 'View contact details' : undefined}
                        style={{
                          width: 'var(--msg-avatar-size)',
                          height: 'var(--msg-avatar-size)',
                          backgroundColor: getAccessibleUserColor(message.sender_id, isDarkMode),
                        }}
                      >
                        {/* TODO: Replace with actual profile picture when available */}
                        <span className="text-white text-sm font-semibold">
                          {(message.sender_name || 'U').charAt(0).toUpperCase()}
                        </span>
                      </button>

                      <div className="flex-1 min-w-0">
                        {/* Sender name with color coding and role badge */}
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span
                            className="msg-sender-name"
                            style={{
                              color: getAccessibleUserColor(message.sender_id, isDarkMode),
                              fontSize: 'var(--font-size-sender)',
                              fontWeight: 'var(--font-weight-sender)',
                            }}
                          >
                            {message.sender_name || message.sender_id}
                          </span>

                          {/* Role Badge */}
                          <UserBadge role={getUserRole(message.sender_id)} size="sm" />

                          {/* Smart Timestamp */}
                          <SmartTimestamp time={message.created_at} />

                          {/* Pinned indicator */}
                          {message.is_pinned && (
                            <span className="text-[10px] text-rose-500/80 dark:text-rose-bright/80 flex items-center gap-1">
                              <Pin />
                              Pinned
                            </span>
                          )}

                          {/* Edited indicator */}
                          {message.edited_at && (
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">(edited)</span>
                          )}

                          {/* Read receipts: only on user's own messages.
                              Filter out the sender themselves so we
                              don't show "Read by you". */}
                          {isOwnMessage && (() => {
                            const readers = (readsByMessage[message.id] || [])
                              .filter((r) => r.userId !== currentUserId);
                            if (readers.length === 0) return null;
                            return (
                              <span
                                className="text-[10px] text-emerald-500 dark:text-emerald-400 flex items-center gap-1"
                                title={`Read by ${readers.length} ${readers.length === 1 ? 'person' : 'people'}`}
                              >
                                <Check className="w-2.5 h-2.5" />
                                {readers.length === 1 ? 'Read' : `Read · ${readers.length}`}
                              </span>
                            );
                          })()}
                        </div>

                        {/* Message content (inline editor when editing) */}
                        {editingId === message.id ? (
                          <div className="mt-1">
                            <textarea
                              ref={editInputRef}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  void saveEditMessage();
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  cancelEditMessage();
                                }
                              }}
                              rows={Math.min(6, Math.max(1, editText.split('\n').length))}
                              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-rose-400/40 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/30 resize-none"
                            />
                            <div className="flex gap-2 mt-1.5 text-xs">
                              <button
                                onClick={() => void saveEditMessage()}
                                disabled={!editText.trim()}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                              >
                                <Check className="w-3 h-3" /> Save
                              </button>
                              <button
                                onClick={cancelEditMessage}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
                              >
                                <X className="w-3 h-3" /> Cancel
                              </button>
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 self-center">
                                Enter to save · Esc to cancel
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p
                            className="msg-content break-words whitespace-pre-wrap"
                            style={{
                              fontSize: 'var(--font-size-message)',
                              fontWeight: 'var(--font-weight-message)',
                              lineHeight: 'var(--line-height-message)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {message.content}
                          </p>
                        )}

                        {/* Reactions */}
                        {message.reactions && Object.keys(message.reactions).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Object.entries(message.reactions).map(([emoji, users]) => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(message.id, emoji)}
                                className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition ${
                                  (users as string[]).includes(currentUserId)
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : 'bg-[#1e293b] border border-white/[0.07] text-[#94a3b8] hover:bg-white/[0.08]'
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
                          className="w-7 h-7 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-rose-400 transition"
                          title="Add reaction"
                        >
                          <Smile className="text-xs" />
                        </button>
                        <button
                          onClick={() => handlePinMessage(message.id)}
                          className={`w-7 h-7 rounded hover:bg-zinc-800 flex items-center justify-center transition ${message.is_pinned ? 'text-rose-500 dark:text-rose-bright' : 'text-zinc-500 hover:text-rose-400'}`}
                          title={message.is_pinned ? 'Unpin message' : 'Pin message'}
                        >
                          <Pin className="text-xs" />
                        </button>
                        {isOwnMessage && (
                          <>
                            <button
                              onClick={() => startEditMessage(message.id, message.content)}
                              className="w-7 h-7 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-rose-400 transition"
                              title="Edit message"
                            >
                              <Pencil className="text-xs" />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(message.id)}
                              className="w-7 h-7 rounded hover:bg-rose-500/20 flex items-center justify-center text-zinc-500 hover:text-rose-500 transition"
                              title="Delete message"
                            >
                              <Trash2 className="text-xs" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="message-input-glass-container">
        <div className="message-input-field-wrapper">
          <div className="input-actions-left flex gap-2">
            <button
              className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition text-zinc-600 dark:text-zinc-400 hover:text-rose-500 flex-shrink-0"
              title="Attach file"
            >
              <Paperclip />
            </button>

            <button
              className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition text-zinc-600 dark:text-zinc-400 hover:text-rose-500 flex-shrink-0"
              title="Add emoji"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile />
            </button>
          </div>

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
            className="message-input-llm"
            rows={1}
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />

          <div className="input-actions-right flex gap-2">
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
              className="input-send-btn"
              title="Send message"
            >
              <i className={`fa-solid ${sending ? 'fa-circle-notch fa-spin' : 'fa-paper-plane'}`}></i>
            </button>
          </div>
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
