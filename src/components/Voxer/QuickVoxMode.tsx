import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Mic,
  Play,
  Pause,
  Plus,
  ChevronLeft,
  Search,
  Check,
  CheckCheck,
  Clock,
  X,
  Edit2,
  Square
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import RecordingPreview from './RecordingPreview';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { voxModeService } from '../../services/voxer/voxModeService';
import analyticsCollector from '../../services/analyticsCollector';
import type { QuickVoxFavorite, QuickVoxMessage, QuickVoxStatus } from '../../services/voxer/voxModeTypes';
import './Voxer.css';

// Mode color for Quick Vox
const MODE_COLOR = '#3B82F6';

interface QuickVoxModeProps {
  contacts?: any[];
  apiKey?: string;
  onBack: () => void;
  isDarkMode?: boolean;
}

const QuickVoxMode: React.FC<QuickVoxModeProps> = ({
  contacts = [],
  apiKey,
  onBack,
  isDarkMode = false,
}) => {
  const [favorites, setFavorites] = useState<QuickVoxFavorite[]>([]);
  const [selectedContact, setSelectedContact] = useState<QuickVoxFavorite | null>(null);
  const [messages, setMessages] = useState<QuickVoxMessage[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [showAddFavorite, setShowAddFavorite] = useState(false);
  const [showEditFavorites, setShowEditFavorites] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<Map<string, QuickVoxStatus>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [pulseContacts, setPulseContacts] = useState<any[]>([]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use the recording hook for click-to-record with preview
  const {
    state: recordingState,
    duration: recordingDuration,
    analyser,
    recordingData,
    startRecording,
    stopRecording,
    cancelRecording,
    sendRecording,
  } = useVoxRecording({
    onRecordingComplete: (data) => {
      console.log('Quick Vox recording complete:', data.duration, 'seconds');
    },
  });

  useEffect(() => {
    loadFavorites();
    loadPulseContacts();

    const contactIds = favorites.map(f => f.contactId);
    if (contactIds.length > 0) {
      const subscription = voxModeService.subscribeToRecordingStatus(
        contactIds,
        (status) => {
          setRecordingStatus(prev => new Map(prev).set(status.recipientId, status));
        }
      );

      return () => {
        subscription?.unsubscribe();
      };
    }
  }, []);

  const loadPulseContacts = async () => {
    const pulseUsers = await voxModeService.getPulseUsersAsContacts();
    setPulseContacts(pulseUsers);
  };

  useEffect(() => {
    if (selectedContact) {
      loadConversation(selectedContact.contactId);
    }
  }, [selectedContact]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    voxModeService.updateQuickVoxStatus(recordingState === 'recording');
  }, [recordingState]);

  const handleSendRecording = async () => {
    if (!recordingData) {
      console.error('Cannot send: no recording data');
      return;
    }
    if (!selectedContact) {
      console.error('Cannot send: no contact selected');
      return;
    }

    const message = await voxModeService.uploadAndSendQuickVox(
      selectedContact.contactId,
      recordingData.blob,
      recordingData.duration
    );

    if (message) {
      setMessages(prev => [...prev, message]);

      analyticsCollector.trackMessageEvent({
        id: message.id,
        channel: 'voxer',
        contactIdentifier: selectedContact.contactId,
        contactName: selectedContact.contactName,
        isSent: true,
        timestamp: new Date(),
        content: '[Quick Vox Recording]',
        duration: recordingData.duration,
        messageType: 'quick_vox'
      }).catch(err => console.error('Analytics tracking failed:', err));
    }

    sendRecording();
  };

  const handleRecordToggle = () => {
    if (recordingState === 'recording') {
      stopRecording();
    } else if (recordingState === 'idle') {
      startRecording();
    }
  };

  const loadFavorites = async () => {
    const data = await voxModeService.getQuickVoxFavorites();
    setFavorites(data);

    if (data.length > 0 && !selectedContact) {
      setSelectedContact(data[0]);
    }
  };

  const loadConversation = async (contactId: string) => {
    const data = await voxModeService.getQuickVoxConversation(contactId);
    setMessages(data);
  };

  const handlePlayMessage = (message: QuickVoxMessage) => {
    if (playingMessageId === message.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.src = message.audioUrl;
        audioRef.current.play();
        setPlayingMessageId(message.id);
        setIsPlaying(true);
      }
    }
  };

  const handleAddFavorite = async (contact: any) => {
    const newFavorite: Omit<QuickVoxFavorite, 'userId'> = {
      contactId: contact.id,
      contactHandle: contact.handle || contact.email || '',
      contactName: contact.name,
      avatarColor: contact.avatarColor || MODE_COLOR,
      position: favorites.length,
    };

    const updatedFavorites = [...favorites, newFavorite as QuickVoxFavorite];
    await voxModeService.setQuickVoxFavorites(updatedFavorites);
    setFavorites(updatedFavorites as QuickVoxFavorite[]);
    setShowAddFavorite(false);
  };

  const handleRemoveFavorite = async (contactId: string) => {
    const updatedFavorites = favorites.filter(f => f.contactId !== contactId);
    await voxModeService.setQuickVoxFavorites(updatedFavorites);
    setFavorites(updatedFavorites);
    if (selectedContact?.contactId === contactId) {
      setSelectedContact(updatedFavorites[0] || null);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sending': return <Clock className="w-3 h-3 text-gray-500" />;
      case 'sent': return <Check className="w-3 h-3 text-gray-500" />;
      case 'delivered': return <CheckCheck className="w-3 h-3 text-gray-500" />;
      case 'read':
      case 'played': return <CheckCheck className="w-3 h-3" style={{ color: MODE_COLOR }} />;
      default: return null;
    }
  };

  const filteredContacts = pulseContacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !favorites.find(f => f.contactId === c.id)
  );

  // Theme classes for consistent styling
  const tc = {
    // Backgrounds
    pageBg: isDarkMode
      ? 'bg-gradient-to-br from-gray-900 via-blue-900/10 to-gray-900'
      : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-white',
    panelBg: isDarkMode
      ? 'bg-gray-900/60 backdrop-blur-xl'
      : 'bg-white/80 backdrop-blur-xl',
    cardBg: isDarkMode
      ? 'bg-gray-800/40 backdrop-blur-sm'
      : 'bg-white/60 backdrop-blur-sm',
    inputBg: isDarkMode
      ? 'bg-gray-800/60 border-gray-700/50'
      : 'bg-white/80 border-gray-200/60',
    hoverBg: isDarkMode
      ? 'hover:bg-gray-800/60'
      : 'hover:bg-gray-100/80',
    activeBg: isDarkMode
      ? 'bg-blue-500/20'
      : 'bg-blue-500/10',

    // Borders
    border: isDarkMode ? 'border-gray-800/60' : 'border-gray-200/60',
    borderAccent: isDarkMode ? 'border-blue-500/30' : 'border-blue-400/40',

    // Text
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: isDarkMode ? 'text-gray-500' : 'text-gray-400',
    textAccent: 'text-blue-500',

    // Message bubbles
    messageMine: isDarkMode
      ? 'bg-blue-600/20 border-blue-500/30'
      : 'bg-blue-500/10 border-blue-400/30',
    messageOther: isDarkMode
      ? 'bg-gray-800/60 border-gray-700/50'
      : 'bg-gray-100/80 border-gray-200/50',

    // Buttons
    btnPrimary: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/25',
    btnSecondary: isDarkMode
      ? 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 border border-gray-700/50'
      : 'bg-white/80 hover:bg-gray-100/80 text-gray-700 border border-gray-200/60',
    btnGhost: isDarkMode
      ? 'hover:bg-gray-800/60 text-gray-400 hover:text-white'
      : 'hover:bg-gray-100/80 text-gray-500 hover:text-gray-900',

    // Modal
    modalOverlay: 'bg-black/60 backdrop-blur-sm',
    modalBg: isDarkMode
      ? 'bg-gray-900/95 backdrop-blur-xl border-gray-800/60'
      : 'bg-white/95 backdrop-blur-xl border-gray-200/60',
  };

  return (
    <div className={`h-full flex flex-col ${tc.pageBg}`}>
      {/* Header */}
      <div
        className={`px-4 md:px-6 py-4 border-b ${tc.border} ${tc.panelBg}`}
        style={{
          background: isDarkMode
            ? `linear-gradient(135deg, rgba(59,130,246,0.15) 0%, transparent 50%)`
            : `linear-gradient(135deg, rgba(59,130,246,0.1) 0%, transparent 50%)`
        }}
      >
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={onBack}
            className={`p-2 rounded-xl ${tc.btnGhost} transition-all duration-200`}
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div
            className="p-2.5 rounded-xl shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #06b6d4 100%)`,
              boxShadow: `0 8px 24px ${MODE_COLOR}40`
            }}
          >
            <Zap className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className={`text-lg md:text-xl font-bold ${tc.text}`}>Quick Vox</h1>
            <p className={`text-xs md:text-sm ${tc.textSecondary} hidden sm:block`}>One Tap. Instant Voice.</p>
          </div>

          <button
            onClick={() => setShowEditFavorites(!showEditFavorites)}
            className={`p-2 rounded-xl transition-all duration-200 ${
              showEditFavorites
                ? `${tc.activeBg} text-blue-500`
                : tc.btnGhost
            }`}
            aria-label="Edit favorites"
          >
            <Edit2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Favorites Bar */}
      <div className={`px-4 md:px-6 py-4 border-b ${tc.border} ${tc.cardBg} overflow-visible`}>
        <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-2 scrollbar-hide">
          {favorites.map((favorite) => {
            const status = recordingStatus.get(favorite.contactId);
            const isSelected = selectedContact?.contactId === favorite.contactId;

            return (
              <div key={favorite.contactId} className="relative overflow-visible shrink-0">
                <button
                  onClick={() => !showEditFavorites && setSelectedContact(favorite)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all min-w-[80px] ${
                    isSelected
                      ? `${tc.activeBg} border ${tc.borderAccent}`
                      : tc.hoverBg
                  }`}
                >
                  <div className="relative">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold text-white shadow-lg transition-transform hover:scale-105"
                      style={{
                        backgroundColor: favorite.avatarColor,
                        boxShadow: isSelected ? `0 4px 16px ${favorite.avatarColor}50` : 'none'
                      }}
                    >
                      {favorite.contactName.charAt(0)}
                    </div>

                    {/* Recording indicator */}
                    {status?.isRecording && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                        <Mic className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {/* Online indicator */}
                    {status?.isOnline && !status?.isRecording && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2" style={{ borderColor: isDarkMode ? '#1f2937' : '#ffffff' }} />
                    )}
                  </div>
                  <span className={`text-xs ${tc.textSecondary} truncate max-w-[70px]`}>
                    {favorite.contactName.split(' ')[0]}
                  </span>
                </button>

                {/* Remove button in edit mode */}
                {showEditFavorites && (
                  <button
                    onClick={() => handleRemoveFavorite(favorite.contactId)}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center z-10 hover:bg-red-600 transition-all shadow-lg"
                    aria-label="Remove from favorites"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add favorite button */}
          <button
            onClick={() => setShowAddFavorite(true)}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all min-w-[80px] ${tc.hoverBg}`}
          >
            <div
              className={`w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center ${
                isDarkMode ? 'bg-gray-800/50 border-gray-600' : 'bg-gray-100/50 border-gray-300'
              }`}
            >
              <Plus className={`w-6 h-6 ${tc.textMuted}`} />
            </div>
            <span className={`text-xs ${tc.textMuted}`}>Add</span>
          </button>
        </div>
      </div>

      {/* Conversation Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedContact ? (
          <>
            {/* Contact Header */}
            <div className={`px-4 md:px-6 py-3 border-b ${tc.border} ${tc.cardBg} flex items-center gap-3`}>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: selectedContact.avatarColor }}
              >
                {selectedContact.contactName.charAt(0)}
              </div>
              <div>
                <h2 className={`font-semibold ${tc.text}`}>{selectedContact.contactName}</h2>
                <p className={`text-xs ${tc.textMuted}`}>
                  {recordingStatus.get(selectedContact.contactId)?.isRecording
                    ? 'Recording...'
                    : recordingStatus.get(selectedContact.contactId)?.isOnline
                      ? 'Online'
                      : 'Offline'
                  }
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
              {messages.map((message) => {
                const isMe = message.senderId === voxModeService.getUserId();
                const isCurrentlyPlaying = playingMessageId === message.id;

                return (
                  <div
                    key={message.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`flex items-center gap-2 md:gap-3 p-3 rounded-2xl max-w-xs border ${
                        isMe ? tc.messageMine : tc.messageOther
                      }`}
                    >
                      <button
                        onClick={() => handlePlayMessage(message)}
                        className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
                        style={{
                          background: isCurrentlyPlaying && isPlaying
                            ? MODE_COLOR
                            : isDarkMode ? 'rgba(55,65,81,0.5)' : 'rgba(229,231,235,0.8)',
                          boxShadow: isCurrentlyPlaying && isPlaying ? `0 4px 12px ${MODE_COLOR}50` : 'none'
                        }}
                        aria-label={isCurrentlyPlaying && isPlaying ? 'Pause' : 'Play'}
                      >
                        {isCurrentlyPlaying && isPlaying ? (
                          <Pause className="w-4 h-4 text-white" />
                        ) : (
                          <Play className={`w-4 h-4 ml-0.5 ${isCurrentlyPlaying && isPlaying ? 'text-white' : tc.text}`} />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <VoxAudioVisualizer
                          analyser={null}
                          isActive={false}
                          isPlaying={isCurrentlyPlaying && isPlaying}
                          playbackProgress={isCurrentlyPlaying ? playbackProgress : 0}
                          mode="waveform"
                          color={MODE_COLOR}
                          height={24}
                          isDarkMode={isDarkMode}
                        />
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-xs ${tc.textMuted}`}>
                            {formatDuration(message.duration)}
                          </span>
                          {isMe && (
                            <div className="flex items-center gap-1">
                              <span className={`text-xs ${tc.textMuted}`}>
                                {formatTime(message.createdAt)}
                              </span>
                              {getStatusIcon(message.status)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {messages.length === 0 && (
                <div className={`text-center py-12 ${tc.textMuted}`}>
                  <div
                    className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${MODE_COLOR}20 0%, ${MODE_COLOR}10 100%)`,
                      border: `1px solid ${MODE_COLOR}30`
                    }}
                  >
                    <Zap className="w-8 h-8" style={{ color: MODE_COLOR, opacity: 0.6 }} />
                  </div>
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs mt-1">Click the mic to record a message</p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Recording Area */}
            <div className={`px-4 md:px-6 py-4 border-t ${tc.border} ${tc.panelBg}`}>
              {/* Preview Panel */}
              {recordingState === 'preview' && recordingData ? (
                <RecordingPreview
                  recordingData={recordingData}
                  onSend={handleSendRecording}
                  onCancel={cancelRecording}
                  onRetry={() => {
                    cancelRecording();
                    setTimeout(() => startRecording(), 100);
                  }}
                  isDarkMode={isDarkMode}
                  modeColor={MODE_COLOR}
                />
              ) : (
                <div className="flex flex-col items-center gap-4 w-full">
                  {/* Recording Button */}
                  <button
                    onClick={handleRecordToggle}
                    className="relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all duration-300 ease-out hover:scale-105 active:scale-95"
                    style={{
                      background: recordingState === 'recording'
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        : `linear-gradient(135deg, ${MODE_COLOR} 0%, #06b6d4 100%)`,
                      boxShadow: recordingState === 'recording'
                        ? '0 8px 32px rgba(239,68,68,0.5)'
                        : `0 8px 32px ${MODE_COLOR}40`
                    }}
                    aria-label={recordingState === 'recording' ? 'Stop recording' : 'Start recording'}
                  >
                    {recordingState === 'recording' && (
                      <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-40" />
                    )}
                    <span className="relative z-10">
                      {recordingState === 'recording' ? (
                        <Square className="w-6 h-6 md:w-8 md:h-8 text-white" />
                      ) : (
                        <Mic className="w-6 h-6 md:w-8 md:h-8 text-white" />
                      )}
                    </span>
                  </button>

                  {/* Duration or hint text */}
                  {recordingState === 'recording' ? (
                    <span className="text-sm font-mono" style={{ color: MODE_COLOR }}>
                      {formatDuration(recordingDuration)}
                    </span>
                  ) : (
                    <p className={`text-sm ${tc.textMuted}`}>Click to record</p>
                  )}

                  {/* Live Waveform */}
                  {recordingState === 'recording' && (
                    <div className="w-full max-w-md">
                      <VoxAudioVisualizer
                        analyser={analyser}
                        isActive={true}
                        mode="waveform"
                        color={MODE_COLOR}
                        height={48}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={`flex-1 flex items-center justify-center ${tc.textMuted}`}>
            <div className="text-center p-6">
              <div
                className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${MODE_COLOR}20 0%, ${MODE_COLOR}10 100%)`,
                  border: `1px solid ${MODE_COLOR}30`
                }}
              >
                <Zap className="w-10 h-10" style={{ color: MODE_COLOR, opacity: 0.6 }} />
              </div>
              <p className={`text-lg ${tc.text}`}>Add favorites to get started</p>
              <p className={`text-sm mt-1 ${tc.textSecondary}`}>Quick access to your most contacted people</p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => {
          const audio = e.target as HTMLAudioElement;
          setPlaybackProgress(audio.currentTime / audio.duration);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setPlaybackProgress(0);
        }}
      />

      {/* Add Favorite Modal */}
      {showAddFavorite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className={tc.modalOverlay} onClick={() => setShowAddFavorite(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border ${tc.modalBg} p-6`}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="p-2 rounded-xl"
                style={{ background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #06b6d4 100%)` }}
              >
                <Plus className="w-5 h-5 text-white" />
              </div>
              <h3 className={`text-xl font-bold ${tc.text}`}>Add to Favorites</h3>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${tc.textMuted}`} />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all`}
              />
            </div>

            {/* Contact List */}
            <div className={`max-h-64 overflow-y-auto space-y-1 rounded-xl p-2 ${tc.cardBg} border ${tc.border}`}>
              {filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleAddFavorite(contact)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${tc.hoverBg}`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: contact.avatarColor || MODE_COLOR }}
                  >
                    {contact.name.charAt(0)}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className={`text-sm font-medium ${tc.text} truncate`}>{contact.name}</p>
                    <p className={`text-xs ${tc.textMuted} truncate`}>{contact.email || contact.role}</p>
                  </div>
                  <Plus className={`w-5 h-5 ${tc.textMuted}`} />
                </button>
              ))}

              {filteredContacts.length === 0 && (
                <p className={`text-center py-4 text-sm ${tc.textMuted}`}>
                  No contacts found
                </p>
              )}
            </div>

            <button
              onClick={() => setShowAddFavorite(false)}
              className={`w-full mt-6 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnSecondary}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickVoxMode;
