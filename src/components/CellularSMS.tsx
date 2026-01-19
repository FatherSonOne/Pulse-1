import React, { useState, useCallback } from 'react';
import { Thread, Message, Contact } from '../types';

interface CellularSMSProps {
  onBack: () => void;
  threads: Thread[];
  contacts: Contact[];
  onSelectThread: (threadId: string) => void;
  onSendMessage: (threadId: string, text: string) => void;
  onDeleteThread: (threadId: string) => void;
  onPinThread: (threadId: string) => void;
  onCreateThread: (contact: Contact) => void;
  activeThreadId: string | null;
}

export const CellularSMS: React.FC<CellularSMSProps> = ({
  onBack,
  threads,
  contacts,
  onSelectThread,
  onSendMessage,
  onDeleteThread,
  onPinThread,
  onCreateThread,
  activeThreadId,
}) => {
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDevBanner, setShowDevBanner] = useState(true);
  const [showContactSelector, setShowContactSelector] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');

  const activeThread = threads.find(t => t.id === activeThreadId);

  const filteredThreads = threads.filter(thread =>
    thread.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.messages.some(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSend = useCallback(() => {
    if (!inputText.trim() || !activeThreadId) return;
    onSendMessage(activeThreadId, inputText);
    setInputText('');
  }, [inputText, activeThreadId, onSendMessage]);

  // Filter contacts to only show SMS-enabled contacts (have phone, not Pulse users)
  const smsEnabledContacts = contacts.filter(contact => 
    contact.phone && !contact.pulseUserId
  );

  // Filter contacts based on search query
  const filteredSmsContacts = smsEnabledContacts.filter(contact =>
    contact.name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
    contact.phone?.toLowerCase().includes(contactSearchQuery.toLowerCase())
  );

  const handleSelectContact = (contact: Contact) => {
    onCreateThread(contact);
    setShowContactSelector(false);
    setContactSearchQuery('');
  };

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'sms': return <i className="fa-solid fa-comment-sms text-green-500 text-[10px]" />;
      case 'whatsapp': return <i className="fa-brands fa-whatsapp text-emerald-500 text-[10px]" />;
      case 'email': return <i className="fa-solid fa-envelope text-blue-500 text-[10px]" />;
      default: return <i className="fa-solid fa-message text-zinc-400 text-[10px]" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950">
      {/* Development Banner */}
      {showDevBanner && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <i className="fa-solid fa-flask text-white"></i>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Cellular SMS - Beta Testing</p>
              <p className="text-white/80 text-xs">This feature is under active development. Some functionality may be limited.</p>
            </div>
          </div>
          <button
            onClick={() => setShowDevBanner(false)}
            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition"
          >
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Thread List */}
        <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-900/50">
          {/* Header */}
          <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 bg-white dark:bg-zinc-950/80">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                title="Back to Pulse Messages"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <i className="fa-solid fa-mobile-screen-button text-white text-sm"></i>
                </div>
                <div>
                  <h1 className="text-sm font-bold text-zinc-900 dark:text-white">Cellular SMS</h1>
                  <p className="text-[10px] text-zinc-500">{threads.length} conversations</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowContactSelector(true)}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition flex items-center gap-2"
              title="New Message"
            >
              <i className="fa-solid fa-plus"></i>
              New Message
            </button>
          </div>

          {/* Search */}
          <div className="p-3">
            <div className="relative">
              <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm"></i>
              <input
                type="text"
                placeholder="Search SMS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            {filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                  <i className="fa-solid fa-comment-slash text-2xl text-zinc-400"></i>
                </div>
                <p className="text-zinc-500 text-sm font-medium">No SMS conversations</p>
                <p className="text-zinc-400 text-xs mt-1">SMS messages will appear here</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const lastMessage = thread.messages[thread.messages.length - 1];
                return (
                  <div
                    key={thread.id}
                    onClick={() => onSelectThread(thread.id)}
                    className={`p-3 rounded-xl cursor-pointer transition relative group flex items-center gap-3
                      ${activeThreadId === thread.id
                        ? 'bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-green-200 dark:ring-green-800'
                        : 'hover:bg-white dark:hover:bg-zinc-800/50'}`}
                  >
                    {/* Actions on hover */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex gap-1 z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); onPinThread(thread.id); }}
                        className={`w-6 h-6 rounded flex items-center justify-center ${thread.pinned ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-600'}`}
                        title={thread.pinned ? 'Unpin' : 'Pin'}
                      >
                        <i className="fa-solid fa-thumbtack text-[10px]"></i>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteThread(thread.id); }}
                        className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-red-500"
                        title="Delete"
                      >
                        <i className="fa-solid fa-trash text-[10px]"></i>
                      </button>
                    </div>

                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full ${thread.avatarColor} flex items-center justify-center text-white text-sm font-bold flex-shrink-0 relative`}>
                      {thread.contactName.charAt(0)}
                      {thread.pinned && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                          <i className="fa-solid fa-thumbtack text-[8px] text-white"></i>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h3 className={`text-sm truncate ${thread.unread ? 'font-bold dark:text-white' : 'font-medium text-zinc-700 dark:text-zinc-300'}`}>
                          {thread.contactName}
                        </h3>
                        <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-2">
                          {lastMessage?.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {getSourceIcon(lastMessage?.source)}
                        <p className="text-xs truncate text-zinc-500">
                          {lastMessage?.text || 'Attachment'}
                        </p>
                      </div>
                    </div>

                    {/* Unread badge */}
                    {thread.unread && (
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0"></div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Conversation View */}
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950">
          {activeThread ? (
            <>
              {/* Conversation Header */}
              <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 bg-white dark:bg-zinc-950/80">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${activeThread.avatarColor} flex items-center justify-center text-white font-bold`}>
                    {activeThread.contactName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-semibold text-zinc-900 dark:text-white">{activeThread.contactName}</h2>
                    <p className="text-xs text-zinc-500">SMS Conversation</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition" title="Call">
                    <i className="fa-solid fa-phone"></i>
                  </button>
                  <button className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition" title="More options">
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {activeThread.messages.map((message, index) => (
                  <div
                    key={message.id || index}
                    className={`flex ${message.isOutgoing ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                        message.isOutgoing
                          ? 'bg-green-500 text-white rounded-br-md'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                      <p className={`text-[10px] mt-1 ${message.isOutgoing ? 'text-green-100' : 'text-zinc-400'}`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <div className="flex items-center gap-3">
                  <button className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                    <i className="fa-solid fa-plus"></i>
                  </button>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim()}
                    className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fa-solid fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center">
                  <i className="fa-solid fa-comment-sms text-4xl text-green-600 dark:text-green-400"></i>
                </div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                  Select a Conversation
                </h2>
                <p className="text-zinc-500 mb-6">
                  Choose an SMS conversation from the list to view and reply to messages.
                </p>

                {/* Dev Notice */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-left">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-info-circle text-amber-600 dark:text-amber-400"></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Development Notice</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        SMS functionality requires device permissions and native integration.
                        Full functionality will be available in an upcoming release.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CellularSMS;
