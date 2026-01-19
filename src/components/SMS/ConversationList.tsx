// src/components/SMS/ConversationList.tsx
// Left panel showing SMS conversations list

import React, { useState, useEffect } from 'react';
import { SMSConversation } from '../../types/sms';
import { smsService } from '../../services/smsService';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListProps {
  selectedConversation: SMSConversation | null;
  onSelectConversation: (conversation: SMSConversation) => void;
  onNewMessage: () => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  selectedConversation,
  onSelectConversation,
  onNewMessage,
}) => {
  const [conversations, setConversations] = useState<SMSConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = () => {
    setIsLoading(true);
    const data = smsService.getConversations();
    setConversations(data.filter(c => !c.isArchived));
    setIsLoading(false);
  };

  const filteredConversations = conversations.filter(conv => {
    const searchLower = searchQuery.toLowerCase();
    const name = conv.contactName || smsService.formatPhoneNumber(conv.phoneNumber);
    const lastMessage = conv.messages[conv.messages.length - 1]?.body || '';
    return (
      name.toLowerCase().includes(searchLower) ||
      conv.phoneNumber.includes(searchQuery) ||
      lastMessage.toLowerCase().includes(searchLower)
    );
  });

  const getLastMessagePreview = (conv: SMSConversation): string => {
    if (conv.messages.length === 0) return 'No messages';
    const lastMsg = conv.messages[conv.messages.length - 1];
    const prefix = lastMsg.direction === 'outbound' ? 'You: ' : '';
    const text = lastMsg.body;
    return prefix + (text.length > 40 ? text.slice(0, 40) + '...' : text);
  };

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
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <i className="fa-solid fa-mobile-screen-button text-green-500"></i>
            SMS Messages
          </h2>
          <button
            onClick={onNewMessage}
            className="w-8 h-8 rounded-lg bg-green-600 hover:bg-green-500 flex items-center justify-center text-white transition"
            title="New Message"
          >
            <i className="fa-solid fa-plus text-sm"></i>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm"></i>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-green-600 transition"
          />
        </div>

        {/* Mock Mode Indicator */}
        {smsService.isMockMode() && (
          <div className="mt-3 px-3 py-1.5 bg-amber-900/30 border border-amber-700/50 rounded-lg">
            <p className="text-xs text-amber-400 flex items-center gap-2">
              <i className="fa-solid fa-flask"></i>
              Demo Mode - Using mock data
            </p>
          </div>
        )}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-zinc-500">
            <i className="fa-solid fa-message-slash text-2xl mb-2 block"></i>
            <p className="text-sm">No conversations found</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {filteredConversations.map((conversation) => {
              const displayName = conversation.contactName || smsService.formatPhoneNumber(conversation.phoneNumber);
              const avatarColor = smsService.getContactColor(conversation.phoneNumber);
              const isSelected = selectedConversation?.id === conversation.id;

              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation)}
                  className={`w-full p-4 flex items-start gap-3 transition-colors text-left ${
                    isSelected
                      ? 'bg-green-900/30 border-l-2 border-green-500'
                      : 'hover:bg-zinc-900 border-l-2 border-transparent'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {getInitials(displayName)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium truncate ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                        {displayName}
                      </span>
                      <span className="text-xs text-zinc-500 flex-shrink-0 ml-2">
                        {formatDistanceToNow(conversation.lastMessageAt, { addSuffix: false })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {getLastMessagePreview(conversation)}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <span className="ml-2 w-5 h-5 rounded-full bg-green-600 text-white text-xs flex items-center justify-center flex-shrink-0">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</span>
          <span>{smsService.getUnreadCount()} unread</span>
        </div>
      </div>
    </div>
  );
};

export default ConversationList;
