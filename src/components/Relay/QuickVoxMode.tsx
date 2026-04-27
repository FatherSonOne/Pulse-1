import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Mic,
  Play,
  Pause,
  Plus,
  Search,
  Check,
  CheckCheck,
  Clock,
  X,
  Edit2,
  Download,
  Archive,
  MoreVertical,
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import RecordingPreview from './RecordingPreview';
import VoxModeHeader from './VoxModeHeader';
import VoxModeToolbar from './VoxModeToolbar';
import VoxRecordArea from './VoxRecordArea';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { voxModeService } from '../../services/relay/voxModeService';
// analyticsCollector loaded dynamically to avoid svc-crm-analytics chunk TDZ
import { type QuickVoxFavorite, type QuickVoxMessage, type QuickVoxStatus } from '../../services/relay/voxModeTypes';
import toast from 'react-hot-toast';
import './Relay.css';

// Phase 2: Selection Mode
import { useVoxSelection, VoxSelectionItem } from '../../hooks/useVoxSelection';
import { VoxSelectToolbar } from './VoxSelectToolbar';
import VoxMessageMenu from './VoxMessageMenu';
import VoxDownloadModal from './VoxDownloadModal';
import { archiveRelayConversation } from '../../services/relay/relayArchiveService';

// Phase 5: AI Enhancements
import { MessageAIPanel, VoxSmartReplies } from './index';
import { summarizeConversation, generateSmartReplies } from '../../services/relay/relayAIService';
import type { ConversationSummary, SmartReply } from '../../services/relay/relayAIService';
import { useAIErrorHandler } from '../../hooks/useAIErrorHandler';

// Phase 6: Final Polish
import { useRelayKeyboardShortcuts } from '../../hooks/useRelayKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from './VoxKeyboardShortcutsHelp';
import { usePlaybackSpeed } from '../../hooks/usePlaybackSpeed';
import { PlaybackSpeedControl } from './PlaybackSpeedControl';
import { VoxEmptyState } from './VoxEmptyState';
import { getEmptyStateConfig } from './voxEmptyStates';

// Relay brand accent (rose-500) — per-mode colors retired in 2.1d.1.
const MODE_COLOR = '#f43f5e';

interface QuickVoxModeProps {
  apiKey?: string;
  onBack: () => void;
  isDarkMode?: boolean;
}

const QuickVoxMode: React.FC<QuickVoxModeProps> = ({
  apiKey,
  onBack,
  isDarkMode = false,
}) => {
  // AI-router error handler (cap exceeded / provider down → toast + CTA)
  const handleAIError = useAIErrorHandler();

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

  // Phase 2: Selection Mode State
  const {
    isSelectionMode,
    selectedItems,
    selectionCount,
    toggleSelection,
    selectAll,
    deselectAll,
    enterSelectionMode,
    exitSelectionMode,
    isSelected,
    getTotalDuration,
  } = useVoxSelection();

  // Phase 5: AI Enhancement States
  const [showSummary, setShowSummary] = useState(false);
  const [conversationSummary, setConversationSummary] = useState<ConversationSummary | null>(null);
  const [showSmartReplies, setShowSmartReplies] = useState(false);
  const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Phase 6: Final Polish States
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const { playbackSpeed: globalPlaybackSpeed, setPlaybackSpeed: setGlobalPlaybackSpeed, applyToElement } = usePlaybackSpeed();
  const emptyConfig = getEmptyStateConfig('quick_vox');

  // VoxMessageMenu state
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadItem, setDownloadItem] = useState<VoxSelectionItem | null>(null);

  // Use the recording hook for click-to-record with preview
  const {
    state: recordingState,
    duration: recordingDuration,
    analyser,
    recordingData,
    recordingMode,
    setRecordingMode,
    startRecording,
    stopRecording,
    cancelRecording,
    sendRecording,
    handlePointerDown,
    handlePointerUp,
    handleToggleRecording,
  } = useVoxRecording({
    onRecordingComplete: (_data) => {
      // Recording complete - ready for preview
    },
  });

  // VoxMessageMenu handler functions
  const handleArchiveMessage = async (message: any) => {
    const item: VoxSelectionItem = {
      id: message.id,
      type: 'audio',
      url: message.audioUrl || '',
      duration: message.duration || 0,
      timestamp: message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt || Date.now()),
      mode: 'quick_vox',
      contactName: message.senderName || message.recipientName,
    };
    try {
      await archiveRelayConversation([item], message.senderName || 'Quick Vox');
      toast.success('Archived to Pulse Archives');
    } catch {
      toast.error('Failed to archive');
    }
  };

  const handleDownloadMessage = (message: any) => {
    const item: VoxSelectionItem = {
      id: message.id,
      type: 'audio',
      url: message.audioUrl || '',
      duration: message.duration || 0,
      timestamp: message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt || Date.now()),
      mode: 'quick_vox',
      contactName: message.senderName || message.recipientName,
    };
    setDownloadItem(item);
    setShowDownloadModal(true);
  };

  // Phase 5: AI Handler Functions (defined before keyboard shortcuts to avoid TDZ)
  const handleSummarizeConversation = async () => {
    if (messages.length === 0) {
      toast.error('No messages to summarize');
      return;
    }

    if (!apiKey) {
      toast.error('Gemini API key not configured');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const messageData = messages.map(msg => ({
        id: msg.id,
        transcription: msg.transcript || '',
        sender: (msg.senderId === voxModeService.getUserId() ? 'me' : 'other') as 'me' | 'other',
        senderName: msg.senderName,
        timestamp: msg.createdAt,
        duration: msg.duration,
      }));

      const summary = await summarizeConversation(apiKey, messageData);
      if (summary) {
        setConversationSummary(summary);
        setShowSummary(true);
        toast.success('Conversation summarized!');
      } else {
        toast.error('Failed to generate summary');
      }
    } catch (error) {
      console.error('Summarization error:', error);
      if (!handleAIError(error)) {
        toast.error('Failed to generate summary');
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleGenerateSmartReplies = async () => {
    const recentMessages = messages.slice(-5);
    if (recentMessages.length === 0) {
      toast.error('No messages to analyze');
      return;
    }

    if (!apiKey) {
      toast.error('Gemini API key not configured');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const lastMessage = recentMessages[recentMessages.length - 1];
      const context = recentMessages.map(msg => ({
        id: msg.id,
        transcription: msg.transcript || '',
        sender: (msg.senderId === voxModeService.getUserId() ? 'me' : 'other') as 'me' | 'other',
        senderName: msg.senderName,
        timestamp: msg.createdAt,
        duration: msg.duration,
      }));

      const replies = await generateSmartReplies(apiKey, {
        id: lastMessage.id,
        transcription: lastMessage.transcript || '',
        sender: (lastMessage.senderId === voxModeService.getUserId() ? 'me' : 'other') as 'me' | 'other',
        senderName: lastMessage.senderName,
        timestamp: lastMessage.createdAt,
        duration: lastMessage.duration,
      }, context);

      if (replies.length > 0) {
        setSmartReplies(replies);
        setShowSmartReplies(true);
        toast.success('Smart replies generated!');
      } else {
        toast.error('Failed to generate smart replies');
      }
    } catch (error) {
      console.error('Smart replies error:', error);
      if (!handleAIError(error)) {
        toast.error('Failed to generate smart replies');
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSelectAllMessages = () => {
    if (!selectedContact) return;
    const allItems: VoxSelectionItem[] = messages.map(msg => ({
      id: msg.id,
      type: 'audio' as const,
      url: msg.audioUrl,
      duration: msg.duration,
      timestamp: msg.createdAt,
      sender: (msg.senderId === voxModeService.getUserId() ? 'me' : 'other') as 'me' | 'other',
      transcript: msg.transcript,
      mode: 'quick_vox' as const,
      contactId: selectedContact.id,
      contactName: selectedContact.name,
    }));
    selectAll(allItems);
  };

  // Phase 6: Keyboard Shortcuts (after handler functions are defined)
  useRelayKeyboardShortcuts({
    onToggleRecording: () => {
      if (recordingState === 'idle') startRecording();
      else if (recordingState === 'recording') stopRecording();
    },
    onStopRecording: () => {
      // Priority 1: close any open modal/overlay first
      if (showMessageMenu) { setShowMessageMenu(null); return; }
      if (showSummary) { setShowSummary(false); return; }
      if (showSmartReplies) { setShowSmartReplies(false); return; }
      if (showDownloadModal) { setShowDownloadModal(false); return; }
      if (showAddFavorite) { setShowAddFavorite(false); return; }
      if (showEditFavorites) { setShowEditFavorites(false); return; }
      // Priority 2: discard active recording
      if (recordingState === 'recording') { stopRecording(); return; }
      // Priority 3: exit selection mode
      if (isSelectionMode) { exitSelectionMode(); return; }
      // Priority 4: go back
      if (selectedContact) { setSelectedContact(null); return; }
      onBack();
    },
    onGoBack: () => {
      if (selectedContact) setSelectedContact(null);
      else onBack();
    },
    onSwitchMode: (_mode) => {
      // Mode switch handled by parent
    },
    onDownload: () => {
      if (isSelectionMode && selectionCount > 0) {
        // Download handled by selection toolbar
      }
    },
    onArchive: () => {
      if (isSelectionMode && selectionCount > 0) {
        (async () => {
          try {
            await archiveRelayConversation(Array.from(selectedItems), selectedContact?.contactName || selectedContact?.name || 'Quick Vox');
            exitSelectionMode();
            toast.success(`Archived ${selectionCount} message${selectionCount > 1 ? 's' : ''}`);
          } catch {
            toast.error('Failed to archive');
          }
        })();
      } else {
        toast.error('Select messages first (click selection button)');
      }
    },
    onSummarize: handleSummarizeConversation,
    onShowHelp: () => setShowShortcutsHelp(true),
  }, true);

  // Phase 6: Apply playback speed to audio elements
  useEffect(() => {
    if (audioRef.current) {
      applyToElement(audioRef.current);
    }
  }, [globalPlaybackSpeed, applyToElement]);

  // Persist recording mode preference
  useEffect(() => {
    localStorage.setItem('voxer-recording-mode', recordingMode);
  }, [recordingMode]);

  useEffect(() => {
    loadFavorites();
    loadPulseContacts();

    const contactIds = favorites.map(f => f.contactId);
    if (contactIds.length > 0) {
      let subscription: any = null;

      voxModeService.subscribeToRecordingStatus(
        contactIds,
        (status) => {
          setRecordingStatus(prev => new Map(prev).set(status.recipientId, status));
        }
      ).then(sub => {
        subscription = sub;
      });

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

      import('../../services/analyticsCollector').then(({ default: ac }) => {
        ac.trackMessageEvent({
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
      }).catch(() => {});
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
    btnPrimary: 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/25',
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
      <VoxModeToolbar
        onBack={onBack}
        modeIcon={<Zap className="w-5 h-5" />}
        modeTitle="Quick Vox"
        modeSubtitle="Fast Voice to Favorites"
        accentColor="#f43f5e"
        isDarkMode={isDarkMode}
        showAI={!!selectedContact}
        onSummarize={handleSummarizeConversation}
        onSmartReplies={handleGenerateSmartReplies}
        isSummarizing={isGeneratingAI}
        isGeneratingReplies={isGeneratingAI}
        hasContent={messages.length > 0}
        isSelectionMode={isSelectionMode}
        onToggleSelection={() => isSelectionMode ? exitSelectionMode() : enterSelectionMode()}
        onShowHelp={() => setShowShortcutsHelp(true)}
        customActions={[
          {
            icon: <Edit2 className="w-5 h-5" />,
            title: 'Edit favorites',
            onClick: () => setShowEditFavorites(!showEditFavorites),
            isActive: showEditFavorites,
          },
        ]}
      />

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
              {messages.length === 0 ? (
                <VoxEmptyState
                  {...emptyConfig}
                  isDarkMode={isDarkMode}
                  action={{ label: 'Start Recording', onClick: () => { if (recordingState === 'idle') startRecording(); } }}
                />
              ) : (
                messages.map((message) => {
                  const isMe = message.senderId === voxModeService.getUserId();
                  const isCurrentlyPlaying = playingMessageId === message.id;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} relative`}
                    >
                      <div
                        className={`flex items-center gap-2 md:gap-3 p-3 rounded-2xl max-w-xs border ${
                          isMe ? tc.messageMine : tc.messageOther
                        }`}
                      >
                        {/* Phase 2: Selection Checkbox */}
                        {isSelectionMode && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const selectionItem: VoxSelectionItem = {
                                id: message.id,
                                type: 'audio' as const,
                                url: message.audioUrl,
                                duration: message.duration,
                                timestamp: message.createdAt,
                                sender: message.senderId === voxModeService.getUserId() ? 'me' : 'other',
                                transcript: message.transcript,
                                mode: 'quick_vox' as const,
                                contactId: selectedContact?.contactId,
                                contactName: selectedContact?.contactName,
                              };
                              toggleSelection(selectionItem);
                            }}
                            className={`absolute top-1 ${isMe ? 'right-1' : 'left-1'} w-6 h-6 rounded-lg flex items-center justify-center transition-all shadow-lg hover:scale-110 active:scale-95 z-10 ${
                              isSelected(message.id)
                                ? 'bg-blue-500 border-2 border-blue-600'
                                : 'bg-white dark:bg-gray-700 border-2 border-gray-400 dark:border-gray-500'
                            }`}
                            style={{
                              boxShadow: isSelected(message.id)
                                ? '0 4px 12px rgba(59, 130, 246, 0.4)'
                                : '0 2px 8px rgba(0, 0, 0, 0.2)',
                            }}
                          >
                            {isSelected(message.id) && <Check className="w-4 h-4 text-white font-bold" />}
                          </button>
                        )}

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
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${tc.textMuted}`}>
                                {formatDuration(message.duration)}
                              </span>
                              {/* Phase 6: Playback Speed Control */}
                              <PlaybackSpeedControl
                                speed={globalPlaybackSpeed}
                                onSpeedChange={(newSpeed) => {
                                  setGlobalPlaybackSpeed(newSpeed);
                                  if (audioRef.current) audioRef.current.playbackRate = newSpeed;
                                }}
                                mode="compact"
                                isDarkMode={isDarkMode}
                                accentColor="#f43f5e"
                              />
                            </div>
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
                      <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setMenuAnchorRect(rect);
                            setShowMessageMenu(showMessageMenu === message.id ? null : message.id);
                          }}
                          className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                          title="More actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {showMessageMenu === message.id && (
                          <VoxMessageMenu
                            isDarkMode={isDarkMode}
                            accentColor="#f43f5e"
                            anchorRect={menuAnchorRect!}
                            onArchive={() => handleArchiveMessage(message)}
                            onDownload={() => handleDownloadMessage(message)}
                            onDelete={() => {
                              setMessages(prev => prev.filter(m => m.id !== message.id));
                              setShowMessageMenu(null);
                              toast.success('Message deleted');
                            }}
                            onClose={() => setShowMessageMenu(null)}
                          />
                      )}
                    </div>
                  );
                })
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
                <VoxRecordArea
                  modeColor={MODE_COLOR}
                  isDarkMode={isDarkMode}
                  isRecording={recordingState === 'recording'}
                  isPreviewing={recordingState === 'preview'}
                  recordingMode={recordingMode}
                  onToggleRecordingMode={() => setRecordingMode(recordingMode === 'hold' ? 'tap' : 'hold')}
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  onToggleRecording={handleToggleRecording}
                >
                  {/* Live Waveform */}
                  {recordingState === 'recording' && (
                    <div className="w-full max-w-md mx-auto">
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
                </VoxRecordArea>
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
                style={{ background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #e11d48 100%)` }}
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

      {/* Phase 2: Selection Toolbar */}
      {isSelectionMode && selectedContact && (
        <VoxSelectToolbar
          selectedItems={selectedItems}
          selectionCount={selectionCount}
          totalDuration={getTotalDuration()}
          onSelectAll={handleSelectAllMessages}
          onDeselectAll={deselectAll}
          onExitSelection={exitSelectionMode}
          contactName={selectedContact.contactName}
          isDarkMode={isDarkMode}
          accentColor="#f43f5e"
          allSelected={selectionCount === messages.length && messages.length > 0}
        />
      )}

      {/* Phase 5: AI Enhancement Modals */}

      {/* Conversation Summary Modal */}
      {conversationSummary && showSummary && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <MessageAIPanel
              summary={conversationSummary}
              isDarkMode={isDarkMode}
              onClose={() => setShowSummary(false)}
            />
          </div>
        </div>
      )}

      {/* Smart Replies Panel */}
      {smartReplies.length > 0 && showSmartReplies && (
        <div className="fixed bottom-20 right-4 z-40 w-96">
          <VoxSmartReplies
            replies={smartReplies}
            onSelectReply={(reply) => {
              navigator.clipboard.writeText(reply.text);
              toast.success('Smart reply copied! Use it in your next message.');
              setSmartReplies([]);
              setShowSmartReplies(false);
            }}
            onClose={() => setShowSmartReplies(false)}
            isDarkMode={isDarkMode}
            accentColor="#f43f5e"
          />
        </div>
      )}

      {/* Phase 6: Keyboard Shortcuts Help Modal */}
      <VoxKeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
        isDarkMode={isDarkMode}
      />

      {/* VoxDownloadModal */}
      {showDownloadModal && downloadItem && (
        <VoxDownloadModal
          isOpen={showDownloadModal}
          onClose={() => { setShowDownloadModal(false); setDownloadItem(null); }}
          items={[downloadItem]}
          isDarkMode={isDarkMode}
          accentColor="#f43f5e"
        />
      )}
    </div>
  );
};

export default QuickVoxMode;
