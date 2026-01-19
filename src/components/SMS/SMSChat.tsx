// src/components/SMS/SMSChat.tsx
// Right panel showing SMS conversation chat interface

import React, { useState, useEffect, useRef } from 'react';
import { SMSConversation, SMSMessage } from '../../types/sms';
import { smsService } from '../../services/smsService';
import { VoiceTextButton } from '../shared/VoiceTextButton';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

interface SMSChatProps {
  conversation: SMSConversation;
  onBack?: () => void;
  onConversationUpdate?: () => void;
}

export const SMSChat: React.FC<SMSChatProps> = ({
  conversation,
  onBack,
  onConversationUpdate,
}) => {
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const SMS_CHAR_LIMIT = 160;

  useEffect(() => {
    loadMessages();
    // Mark conversation as read when opened
    smsService.markAsRead(conversation.id);
  }, [conversation.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = () => {
    const convData = smsService.getConversation(conversation.id);
    if (convData) {
      setMessages(convData.messages);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const result = await smsService.sendMessage(conversation.id, newMessage.trim());
      if (result.success && result.message) {
        setMessages(prev => [...prev, result.message!]);
        setNewMessage('');
        onConversationUpdate?.();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (date: Date): string => {
    if (isToday(date)) {
      return format(date, 'h:mm a');
    }
    if (isYesterday(date)) {
      return 'Yesterday ' + format(date, 'h:mm a');
    }
    return format(date, 'MMM d, h:mm a');
  };

  const formatDateDivider = (date: Date): string => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d');
  };

  const shouldShowDateDivider = (currentMsg: SMSMessage, prevMsg: SMSMessage | null): boolean => {
    if (!prevMsg) return true;
    return !isSameDay(currentMsg.timestamp, prevMsg.timestamp);
  };

  const displayName = conversation.contactName || smsService.formatPhoneNumber(conversation.phoneNumber);
  const avatarColor = smsService.getContactColor(conversation.phoneNumber);
  const charCount = newMessage.length;
  const isOverLimit = charCount > SMS_CHAR_LIMIT;

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          {/* Back button (mobile) */}
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 transition"
            >
              <i className="fa-solid fa-arrow-left text-sm"></i>
            </button>
          )}

          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
            style={{ backgroundColor: avatarColor }}
          >
            {getInitials(displayName)}
          </div>

          {/* Contact Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{displayName}</h3>
            <p className="text-xs text-zinc-500">
              {smsService.formatPhoneNumber(conversation.phoneNumber)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-green-500 transition"
              title="Call"
            >
              <i className="fa-solid fa-phone text-sm"></i>
            </button>
            <button
              className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
              title="More options"
            >
              <i className="fa-solid fa-ellipsis-vertical text-sm"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((message, index) => {
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const showDateDivider = shouldShowDateDivider(message, prevMessage);

          return (
            <React.Fragment key={message.id}>
              {showDateDivider && (
                <div className="flex items-center justify-center py-3">
                  <span className="px-3 py-1 bg-zinc-900 rounded-full text-xs text-zinc-500">
                    {formatDateDivider(message.timestamp)}
                  </span>
                </div>
              )}

              <div
                className={`flex ${
                  message.direction === 'outbound' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    message.direction === 'outbound'
                      ? 'bg-green-600 text-white rounded-br-md'
                      : 'bg-zinc-800 text-zinc-100 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                  <div
                    className={`flex items-center gap-1 mt-1 ${
                      message.direction === 'outbound' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span
                      className={`text-[10px] ${
                        message.direction === 'outbound' ? 'text-green-200' : 'text-zinc-500'
                      }`}
                    >
                      {formatMessageTime(message.timestamp)}
                    </span>
                    {message.direction === 'outbound' && (
                      <i
                        className={`fa-solid text-[10px] ${
                          message.status === 'delivered'
                            ? 'fa-check-double text-green-200'
                            : message.status === 'sent'
                            ? 'fa-check text-green-200'
                            : message.status === 'pending'
                            ? 'fa-clock text-green-300'
                            : 'fa-exclamation text-red-400'
                        }`}
                      ></i>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder:text-zinc-500 focus:outline-none resize-none transition ${
                isOverLimit
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-zinc-800 focus:border-green-600'
              }`}
              style={{
                minHeight: '44px',
                maxHeight: '120px',
              }}
            />
            {/* Character count */}
            <div
              className={`absolute right-3 bottom-2 text-[10px] ${
                isOverLimit ? 'text-red-400' : charCount > SMS_CHAR_LIMIT * 0.8 ? 'text-amber-400' : 'text-zinc-600'
              }`}
            >
              {charCount}/{SMS_CHAR_LIMIT}
            </div>
          </div>

          {/* Voice-to-Text Button */}
          <VoiceTextButton
            onTranscript={(text) => setNewMessage(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text)}
            size="md"
            className="flex-shrink-0"
          />

          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSending || isOverLimit}
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-white transition ${
              !newMessage.trim() || isSending || isOverLimit
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            {isSending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            ) : (
              <i className="fa-solid fa-paper-plane text-sm"></i>
            )}
          </button>
        </div>

        {/* SMS Info */}
        <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-600">
          <span>Press Enter to send, Shift+Enter for new line</span>
          {isOverLimit && (
            <span className="text-red-400">Message exceeds SMS limit</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SMSChat;
