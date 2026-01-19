// src/components/SMS/index.tsx
// Main SMS component with conversation list and chat

import React, { useState, useCallback } from 'react';
import { ConversationList } from './ConversationList';
import { SMSChat } from './SMSChat';
import { SMSConversation } from '../../types/sms';
import { smsService } from '../../services/smsService';

interface SMSViewProps {
  contacts?: any[]; // Optional contacts for integration
}

export const SMSView: React.FC<SMSViewProps> = () => {
  const [selectedConversation, setSelectedConversation] = useState<SMSConversation | null>(null);
  const [showConversationList, setShowConversationList] = useState(true);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectConversation = (conversation: SMSConversation) => {
    setSelectedConversation(conversation);
    setShowConversationList(false);
    // Mark as read
    smsService.markAsRead(conversation.id);
  };

  const handleBack = () => {
    setShowConversationList(true);
  };

  const handleConversationUpdate = useCallback(() => {
    // Refresh the conversation list
    setRefreshKey(prev => prev + 1);
    // Also refresh selected conversation
    if (selectedConversation) {
      const updated = smsService.getConversation(selectedConversation.id);
      if (updated) {
        setSelectedConversation(updated);
      }
    }
  }, [selectedConversation]);

  const handleNewMessage = () => {
    setShowNewMessageModal(true);
    setNewPhoneNumber('');
  };

  const handleCreateConversation = async () => {
    if (!newPhoneNumber.trim()) return;

    // Format phone number - add +1 if not present
    let formattedNumber = newPhoneNumber.trim().replace(/\D/g, '');
    if (formattedNumber.length === 10) {
      formattedNumber = '+1' + formattedNumber;
    } else if (!formattedNumber.startsWith('+')) {
      formattedNumber = '+' + formattedNumber;
    }

    const newConv = await smsService.createConversation(formattedNumber);
    setSelectedConversation(newConv);
    setShowConversationList(false);
    setShowNewMessageModal(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="h-full flex bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 animate-fadeIn">
      {/* Conversation List Sidebar */}
      <div
        className={`w-full md:w-80 flex-shrink-0 border-r border-zinc-800 ${
          selectedConversation && !showConversationList ? 'hidden md:block' : ''
        }`}
      >
        <ConversationList
          key={refreshKey}
          selectedConversation={selectedConversation}
          onSelectConversation={handleSelectConversation}
          onNewMessage={handleNewMessage}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <SMSChat
            conversation={selectedConversation}
            onBack={handleBack}
            onConversationUpdate={handleConversationUpdate}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-zinc-950">
            <div className="text-center text-zinc-500 p-8">
              <div className="w-20 h-20 rounded-2xl bg-zinc-900 flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-mobile-screen-button text-3xl text-green-600"></i>
              </div>
              <p className="text-xl font-medium mb-2 text-white">SMS Messages</p>
              <p className="text-sm text-zinc-500 max-w-xs mx-auto mb-6">
                Select a conversation from the sidebar or start a new message to begin texting.
              </p>
              <button
                onClick={handleNewMessage}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition"
              >
                <i className="fa-solid fa-plus"></i>
                New Message
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-md p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">New SMS Message</h3>
              <button
                onClick={() => setShowNewMessageModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <i className="fa-solid fa-phone absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"></i>
                  <input
                    type="tel"
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-green-600 transition"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Enter a 10-digit phone number or include country code
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowNewMessageModal(false)}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateConversation}
                  disabled={!newPhoneNumber.trim()}
                  className={`flex-1 px-4 py-2.5 rounded-lg transition ${
                    newPhoneNumber.trim()
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  Start Conversation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { ConversationList } from './ConversationList';
export { SMSChat } from './SMSChat';
export default SMSView;
