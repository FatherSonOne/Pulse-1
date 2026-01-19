// Silent Mode with Live Transcription Component
// View incoming voxes as text when you can't listen

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SilentModeSettings, TranscriptionModeMessage } from '../../services/voxer/advancedVoxerTypes';

// ============================================
// TYPES
// ============================================

interface SilentModeProps {
  isEnabled: boolean;
  onToggle: () => void;
  settings: SilentModeSettings;
  onUpdateSettings: (settings: Partial<SilentModeSettings>) => void;
  incomingMessages: TranscriptionModeMessage[];
  onReply: (messageId: string, text: string) => void;
  onMarkRead: (messageId: string) => void;
}

interface SilentModeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SilentModeSettings;
  onSave: (settings: SilentModeSettings) => void;
}

interface QuickReplyEditorProps {
  replies: string[];
  onUpdate: (replies: string[]) => void;
}

// ============================================
// DEFAULT SETTINGS
// ============================================

export const DEFAULT_SILENT_MODE_SETTINGS: SilentModeSettings = {
  enabled: false,
  autoTranscribe: true,
  showNotifications: true,
  vibrate: true,
  textToSpeechReply: false,
  quickReplies: [
    "Got it, thanks!",
    "I'll get back to you soon",
    "Can't talk right now",
    "In a meeting",
    "Call me later",
  ],
  schedule: undefined,
};

// ============================================
// SILENT MODE INDICATOR (for header)
// ============================================

interface SilentModeIndicatorProps {
  isEnabled: boolean;
  onClick: () => void;
  unreadCount: number;
}

export const SilentModeIndicator: React.FC<SilentModeIndicatorProps> = ({
  isEnabled,
  onClick,
  unreadCount,
}) => {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
        isEnabled
          ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
      }`}
    >
      <i className={`fa-solid ${isEnabled ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
      <span className="hidden sm:inline">{isEnabled ? 'Silent Mode' : 'Normal'}</span>
      
      {isEnabled && unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
};

// ============================================
// TRANSCRIPTION MESSAGE CARD
// ============================================

interface TranscriptionMessageCardProps {
  message: TranscriptionModeMessage;
  onReply: (text: string) => void;
  onMarkRead: () => void;
  quickReplies: string[];
}

const TranscriptionMessageCard: React.FC<TranscriptionMessageCardProps> = ({
  message,
  onReply,
  onMarkRead,
  quickReplies,
}) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  const handleSendReply = () => {
    if (replyText.trim()) {
      onReply(replyText.trim());
      setReplyText('');
      setShowReplyInput(false);
    }
  };

  useEffect(() => {
    if (!message.isRead) {
      const timer = setTimeout(onMarkRead, 2000);
      return () => clearTimeout(timer);
    }
  }, [message.isRead, onMarkRead]);

  return (
    <div className={`p-4 rounded-xl border transition ${
      message.isRead 
        ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800' 
        : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm dark:text-white">{message.sender}</span>
          {!message.isRead && (
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
          )}
        </div>
        <span className="text-xs text-zinc-400">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Transcription */}
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 mb-3">
        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {message.transcription}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-zinc-400">
            <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>
            Auto-transcribed
          </span>
          <span className="text-[10px] text-zinc-400">
            •
          </span>
          <span className="text-[10px] text-zinc-400">
            {Math.round(message.confidence * 100)}% confidence
          </span>
        </div>
      </div>

      {/* Reply Section */}
      {message.replied ? (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">
            <i className="fa-solid fa-reply mr-1"></i>
            Your reply (sent as voice):
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">"{message.replyText}"</p>
        </div>
      ) : showReplyInput ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
              placeholder="Type your reply (will be sent as voice)..."
              className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm border-0 focus:ring-2 focus:ring-purple-500 dark:text-white"
              autoFocus
            />
            <button
              onClick={handleSendReply}
              disabled={!replyText.trim()}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              <i className="fa-solid fa-microphone mr-1"></i>
              Send
            </button>
          </div>
          <button
            onClick={() => setShowQuickReplies(!showQuickReplies)}
            className="text-xs text-purple-500 hover:text-purple-600"
          >
            <i className="fa-solid fa-bolt mr-1"></i>
            Quick replies
          </button>
          {showQuickReplies && (
            <div className="flex flex-wrap gap-1.5">
              {quickReplies.map((reply, i) => (
                <button
                  key={i}
                  onClick={() => { setReplyText(reply); setShowQuickReplies(false); }}
                  className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-xs transition"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setShowReplyInput(true)}
            className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 transition"
          >
            <i className="fa-solid fa-reply mr-2"></i>
            Reply
          </button>
          <button
            onClick={() => setShowQuickReplies(!showQuickReplies)}
            className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 rounded-lg text-sm font-medium text-purple-600 dark:text-purple-400 transition"
          >
            <i className="fa-solid fa-bolt"></i>
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================
// SILENT MODE SETTINGS MODAL
// ============================================

const SilentModeSettingsModal: React.FC<SilentModeSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-scaleIn">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-volume-xmark text-purple-500"></i>
            Silent Mode Settings
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Auto Transcribe */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm dark:text-white">Auto-transcribe</div>
              <div className="text-xs text-zinc-500">Automatically convert incoming voxes to text</div>
            </div>
            <button
              onClick={() => setLocalSettings(s => ({ ...s, autoTranscribe: !s.autoTranscribe }))}
              className={`w-12 h-6 rounded-full transition ${localSettings.autoTranscribe ? 'bg-purple-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transform transition ${localSettings.autoTranscribe ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm dark:text-white">Show notifications</div>
              <div className="text-xs text-zinc-500">Visual alerts for new messages</div>
            </div>
            <button
              onClick={() => setLocalSettings(s => ({ ...s, showNotifications: !s.showNotifications }))}
              className={`w-12 h-6 rounded-full transition ${localSettings.showNotifications ? 'bg-purple-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transform transition ${localSettings.showNotifications ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Vibrate */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm dark:text-white">Vibrate</div>
              <div className="text-xs text-zinc-500">Haptic feedback for new messages</div>
            </div>
            <button
              onClick={() => setLocalSettings(s => ({ ...s, vibrate: !s.vibrate }))}
              className={`w-12 h-6 rounded-full transition ${localSettings.vibrate ? 'bg-purple-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transform transition ${localSettings.vibrate ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Text to Speech Reply */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm dark:text-white">Text-to-voice replies</div>
              <div className="text-xs text-zinc-500">Convert your text replies to voice</div>
            </div>
            <button
              onClick={() => setLocalSettings(s => ({ ...s, textToSpeechReply: !s.textToSpeechReply }))}
              className={`w-12 h-6 rounded-full transition ${localSettings.textToSpeechReply ? 'bg-purple-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transform transition ${localSettings.textToSpeechReply ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Quick Replies */}
          <div>
            <div className="font-medium text-sm dark:text-white mb-2">Quick replies</div>
            <div className="space-y-2">
              {localSettings.quickReplies.map((reply, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={reply}
                    onChange={(e) => {
                      const newReplies = [...localSettings.quickReplies];
                      newReplies[i] = e.target.value;
                      setLocalSettings(s => ({ ...s, quickReplies: newReplies }));
                    }}
                    className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm border-0 focus:ring-2 focus:ring-purple-500 dark:text-white"
                  />
                  <button
                    onClick={() => {
                      const newReplies = localSettings.quickReplies.filter((_, idx) => idx !== i);
                      setLocalSettings(s => ({ ...s, quickReplies: newReplies }));
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-500 transition"
                  >
                    <i className="fa-solid fa-trash text-xs"></i>
                  </button>
                </div>
              ))}
              {localSettings.quickReplies.length < 8 && (
                <button
                  onClick={() => setLocalSettings(s => ({ ...s, quickReplies: [...s.quickReplies, ''] }))}
                  className="w-full py-2 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-500 hover:border-purple-500 hover:text-purple-500 transition"
                >
                  <i className="fa-solid fa-plus mr-2"></i>
                  Add quick reply
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-medium text-zinc-700 dark:text-zinc-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN SILENT MODE PANEL
// ============================================

export const SilentModePanel: React.FC<SilentModeProps> = ({
  isEnabled,
  onToggle,
  settings,
  onUpdateSettings,
  incomingMessages,
  onReply,
  onMarkRead,
}) => {
  const [showSettings, setShowSettings] = useState(false);

  const unreadCount = incomingMessages.filter(m => !m.isRead).length;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isEnabled ? 'bg-purple-500' : 'bg-zinc-200 dark:bg-zinc-800'
          }`}>
            <i className={`fa-solid ${isEnabled ? 'fa-volume-xmark text-white' : 'fa-volume-high text-zinc-500'}`}></i>
          </div>
          <div>
            <h3 className="font-bold dark:text-white">Silent Mode</h3>
            <p className="text-xs text-zinc-500">
              {isEnabled ? `${unreadCount} unread transcriptions` : 'Tap to enable'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition"
          >
            <i className="fa-solid fa-gear"></i>
          </button>
          <button
            onClick={onToggle}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              isEnabled
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {isEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!isEnabled ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-volume-high text-3xl text-zinc-400"></i>
            </div>
            <h4 className="font-semibold dark:text-white mb-2">Silent Mode is Off</h4>
            <p className="text-sm text-zinc-500 max-w-xs mx-auto">
              Enable silent mode to receive voxes as text transcriptions instead of audio
            </p>
          </div>
        ) : incomingMessages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-closed-captioning text-3xl text-purple-500"></i>
            </div>
            <h4 className="font-semibold dark:text-white mb-2">No Messages Yet</h4>
            <p className="text-sm text-zinc-500 max-w-xs mx-auto">
              Incoming voxes will appear here as text transcriptions
            </p>
          </div>
        ) : (
          incomingMessages.map(message => (
            <TranscriptionMessageCard
              key={message.id}
              message={message}
              onReply={(text) => onReply(message.id, text)}
              onMarkRead={() => onMarkRead(message.id)}
              quickReplies={settings.quickReplies}
            />
          ))
        )}
      </div>

      {/* Settings Modal */}
      <SilentModeSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={(newSettings) => onUpdateSettings(newSettings)}
      />
    </div>
  );
};

export default SilentModePanel;
