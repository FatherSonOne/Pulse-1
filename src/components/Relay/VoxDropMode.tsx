import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Mic,
  Play,
  Pause,
  Plus,
  Calendar,
  Users,
  Gift,
  Trash2,
  Edit3,
  Send,
  Check,
  Repeat,
  MapPin,
  Lock,
  Timer,
  Sparkles,
  TrendingUp,
  Loader2,
  Download,
  Archive,
  MoreVertical,
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import RecordingPreview from './RecordingPreview';
import VoxModeToolbar from './VoxModeToolbar';
import VoxRecordArea from './VoxRecordArea';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { voxModeService } from '../../services/relay/voxModeService';
import { VOX_MODES, type VoxDrop } from '../../services/relay/voxModeTypes';
import './Relay.css';

// Phase 2: Selection Mode
import { useVoxSelection, VoxSelectionItem } from '../../hooks/useVoxSelection';
import { VoxSelectToolbar } from './VoxSelectToolbar';
import VoxMessageMenu from './VoxMessageMenu';
import VoxDownloadModal from './VoxDownloadModal';
import { archiveRelayConversation } from '../../services/relay/relayArchiveService';

// Phase 5: AI Enhancements
import { VoxConversationSummary, VoxSmartReplies } from './index';
import { summarizeConversation, generateSmartReplies } from '../../services/relay/relayAIService';
import type { ConversationSummary, SmartReply } from '../../services/relay/relayAIService';
import toast from 'react-hot-toast';

// Phase 6: Final Polish
import { useRelayKeyboardShortcuts } from '../../hooks/useRelayKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from './VoxKeyboardShortcutsHelp';
import { usePlaybackSpeed } from '../../hooks/usePlaybackSpeed';
import { PlaybackSpeedControl } from './PlaybackSpeedControl';
import { VoxEmptyState } from './VoxEmptyState';
import { getEmptyStateConfig } from './voxEmptyStates';

// Mode color from shared palette
const MODE_COLOR = VOX_MODES.vox_drop.color;

interface VoxDropModeProps {
  apiKey?: string;
  onBack: () => void;
  isDarkMode?: boolean;
}

const VoxDropMode: React.FC<VoxDropModeProps> = ({
  apiKey,
  onBack,
  isDarkMode = false,
}) => {
  const [scheduledDrops, setScheduledDrops] = useState<VoxDrop[]>([]);
  const [receivedDrops, setReceivedDrops] = useState<VoxDrop[]>([]);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'received'>('scheduled');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingDropId, setPlayingDropId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [showNewDrop, setShowNewDrop] = useState(false);
  const [pulseContacts, setPulseContacts] = useState<any[]>([]);

  // New drop form state
  const [dropTitle, setDropTitle] = useState('');
  const [dropMessage, setDropMessage] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('yearly');
  const [revealType, setRevealType] = useState<'date' | 'location' | 'custom' | null>(null);
  const [revealValue, setRevealValue] = useState('');

  const audioRef = useRef<HTMLAudioElement>(null);

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
  const emptyConfig = getEmptyStateConfig('vox_drop');

  // VoxMessageMenu state
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadItem, setDownloadItem] = useState<VoxSelectionItem | null>(null);

  // Inline edit state for scheduled drops
  const [editingDropId, setEditingDropId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editScheduleDate, setEditScheduleDate] = useState('');
  const [editScheduleTime, setEditScheduleTime] = useState('');

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
  const handleArchiveDrop = async (drop: any) => {
    const item: VoxSelectionItem = {
      id: drop.id,
      type: 'audio',
      url: drop.audioUrl || '',
      duration: drop.duration || 0,
      timestamp: drop.createdAt instanceof Date ? drop.createdAt : new Date(drop.createdAt || Date.now()),
      mode: 'vox_drop',
      contactName: drop.title || 'Vox Drop',
      transcript: drop.transcript,
    };
    try {
      await archiveRelayConversation([item], drop.title || 'Vox Drop');
      toast.success('Archived to Pulse Archives');
    } catch {
      toast.error('Failed to archive');
    }
  };

  const handleDownloadDrop = (drop: any) => {
    const item: VoxSelectionItem = {
      id: drop.id,
      type: 'audio',
      url: drop.audioUrl || '',
      duration: drop.duration || 0,
      timestamp: drop.createdAt instanceof Date ? drop.createdAt : new Date(drop.createdAt || Date.now()),
      mode: 'vox_drop',
      contactName: drop.title || 'Vox Drop',
      transcript: drop.transcript,
    };
    setDownloadItem(item);
    setShowDownloadModal(true);
  };

  // Phase 5: AI Handler Functions (defined before keyboard shortcuts to avoid TDZ)
  const handleSummarizeDrops = async () => {
    const drops = activeTab === 'scheduled' ? scheduledDrops : receivedDrops;
    if (drops.length === 0) {
      toast.error('No drops to summarize');
      return;
    }

    if (!apiKey) {
      toast.error('Gemini API key not configured');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const messageData = drops.map(drop => ({
        id: drop.id,
        transcription: drop.transcript || '',
        sender: drop.senderId === voxModeService.getUserId() ? 'me' : 'other' as 'me' | 'other',
        senderName: drop.senderName,
        timestamp: drop.scheduledFor,
        duration: drop.duration,
      }));

      const summary = await summarizeConversation(apiKey, messageData);
      if (summary) {
        setConversationSummary(summary);
        setShowSummary(true);
        toast.success('Drops summarized!');
      } else {
        toast.error('AI summarizer unavailable — try again later');
      }
    } catch (error: any) {
      console.error('Summarization error:', error);
      const msg = error?.message || '';
      if (msg.includes('API key') || msg.includes('API_KEY') || msg.includes('invalid') || msg.includes('unauthorized')) {
        toast.error('AI features require API configuration');
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
        toast.error('Network error — please try again');
      } else {
        toast.error('AI summarizer unavailable (beta)');
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleGenerateSmartReplies = async () => {
    const drops = receivedDrops;
    if (drops.length === 0) {
      toast.error('No drops to analyze');
      return;
    }

    if (!apiKey) {
      toast.error('Gemini API key not configured');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const recentDrops = drops.slice(0, 5);
      const lastDrop = recentDrops[0];
      const context = recentDrops.map(drop => ({
        id: drop.id,
        transcription: drop.transcript || '',
        sender: drop.senderId === voxModeService.getUserId() ? 'me' : 'other' as 'me' | 'other',
        senderName: drop.senderName,
        timestamp: drop.scheduledFor,
        duration: drop.duration,
      }));

      const replies = await generateSmartReplies(apiKey, {
        id: lastDrop.id,
        transcription: lastDrop.transcript || '',
        sender: lastDrop.senderId === voxModeService.getUserId() ? 'me' : 'other' as 'me' | 'other',
        senderName: lastDrop.senderName,
        timestamp: lastDrop.scheduledFor,
        duration: lastDrop.duration,
      }, context);

      if (replies.length > 0) {
        setSmartReplies(replies);
        setShowSmartReplies(true);
        toast.success('Smart replies generated!');
      } else {
        toast.error('Smart replies unavailable — try again later');
      }
    } catch (error: any) {
      console.error('Smart replies error:', error);
      const msg = error?.message || '';
      if (msg.includes('API key') || msg.includes('API_KEY') || msg.includes('invalid') || msg.includes('unauthorized')) {
        toast.error('AI features require API configuration');
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
        toast.error('Network error — please try again');
      } else {
        toast.error('Smart replies unavailable (beta)');
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSelectAllDrops = () => {
    const drops = activeTab === 'scheduled' ? scheduledDrops : receivedDrops;
    const allItems: VoxSelectionItem[] = drops.map(drop => ({
      id: drop.id,
      type: 'audio' as const,
      url: drop.audioUrl,
      duration: drop.duration,
      timestamp: drop.scheduledFor,
      sender: drop.senderId === voxModeService.getUserId() ? 'me' : 'other' as 'me' | 'other',
      transcript: drop.transcript,
      mode: 'vox_drop' as const,
      contactId: drop.recipientId || drop.senderId,
      contactName: drop.senderName,
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
      if (showNewDrop) { setShowNewDrop(false); return; }
      // Priority 2: discard active recording
      if (recordingState === 'recording') { stopRecording(); return; }
      // Priority 3: exit selection mode
      if (isSelectionMode) { exitSelectionMode(); return; }
      onBack();
    },
    onGoBack: onBack,
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
            await archiveRelayConversation(Array.from(selectedItems), 'Vox Drop');
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
    onSummarize: handleSummarizeDrops,
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
    loadDrops();
    loadPulseContacts();
  }, []);

  const loadPulseContacts = async () => {
    const pulseUsers = await voxModeService.getPulseUsersAsContacts();
    setPulseContacts(pulseUsers);
  };

  const loadDrops = async () => {
    const [scheduled, received] = await Promise.all([
      voxModeService.getMyScheduledDrops(),
      voxModeService.getReceivedDrops(),
    ]);
    setScheduledDrops(scheduled);
    setReceivedDrops(received);
  };

  const handlePlayDrop = (drop: VoxDrop) => {
    if (playingDropId === drop.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.src = drop.audioUrl;
        audioRef.current.play();
        setPlayingDropId(drop.id);
        setIsPlaying(true);
      }
    }
  };

  const handleCancelDrop = async (dropId: string) => {
    const success = await voxModeService.cancelVoxDrop(dropId);
    if (success) {
      setScheduledDrops(scheduledDrops.filter(d => d.id !== dropId));
    }
  };

  const handleStartEdit = (drop: VoxDrop) => {
    setEditingDropId(drop.id);
    setEditTitle(drop.title || '');
    setEditMessage(drop.message || '');
    const d = drop.scheduledFor;
    setEditScheduleDate(d.toISOString().slice(0, 10));
    setEditScheduleTime(d.toTimeString().slice(0, 5));
  };

  const handleCancelEdit = () => {
    setEditingDropId(null);
    setEditTitle('');
    setEditMessage('');
    setEditScheduleDate('');
    setEditScheduleTime('');
  };

  const handleSaveEdit = async () => {
    if (!editingDropId) return;
    const scheduledFor = editScheduleDate && editScheduleTime
      ? new Date(`${editScheduleDate}T${editScheduleTime}`)
      : undefined;
    const updated = await voxModeService.updateVoxDrop(editingDropId, {
      title: editTitle || undefined,
      message: editMessage || undefined,
      scheduledFor,
    });
    if (updated) {
      setScheduledDrops(prev => prev.map(d => d.id === editingDropId ? updated : d));
      toast.success('Drop updated');
    } else {
      toast.error('Failed to update drop');
    }
    handleCancelEdit();
  };

  const handleScheduleDrop = async () => {
    if (!recordingData || selectedRecipients.length === 0 || !scheduledDate || !scheduledTime) {
      return;
    }

    const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);

    const drop = await voxModeService.uploadAndScheduleVoxDrop(
      selectedRecipients,
      recordingData.blob,
      recordingData.duration,
      scheduledFor,
      dropTitle || undefined,
      dropMessage || undefined
    );

    if (drop) {
      setScheduledDrops([drop, ...scheduledDrops]);
      resetForm();
    }
  };

  const resetForm = () => {
    setShowNewDrop(false);
    setDropTitle('');
    setDropMessage('');
    setSelectedRecipients([]);
    setScheduledDate('');
    setScheduledTime('');
    setIsRecurring(false);
    setRevealType(null);
    setRevealValue('');
    cancelRecording();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatScheduledDate = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 0) return 'Overdue';
    if (hours < 1) return 'Less than an hour';
    if (hours < 24) return `In ${hours} hours`;
    if (days === 1) return 'Tomorrow';
    if (days < 7) return `In ${days} days`;
    if (days < 30) return `In ${Math.floor(days / 7)} weeks`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'text-blue-400 bg-blue-500/20';
      case 'delivered': return 'text-green-400 bg-green-500/20';
      case 'opened': return 'text-purple-400 bg-purple-500/20';
      case 'expired': return 'text-gray-400 bg-gray-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getMinDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  // Theme classes for consistent styling
  const tc = {
    // Backgrounds
    pageBg: isDarkMode
      ? 'bg-gradient-to-br from-gray-900 via-red-900/10 to-gray-900'
      : 'bg-gradient-to-br from-slate-50 via-red-50/30 to-white',
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
      ? 'bg-red-500/20'
      : 'bg-red-500/10',

    // Borders
    border: isDarkMode ? 'border-gray-800/60' : 'border-gray-200/60',
    borderAccent: isDarkMode ? 'border-red-500/30' : 'border-red-400/40',

    // Text
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: isDarkMode ? 'text-gray-500' : 'text-gray-400',
    textAccent: 'text-red-500',

    // Buttons
    btnPrimary: 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-lg shadow-red-500/25',
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
        modeTitle="Vox Drop"
        modeSubtitle="Scheduled Voice Messages"
        modeIcon={<Clock className="w-5 h-5" />}
        accentColor={MODE_COLOR}
        isDarkMode={isDarkMode}
        showAI={true}
        onSummarize={handleSummarizeDrops}
        onSmartReplies={handleGenerateSmartReplies}
        isSummarizing={isGeneratingAI}
        isGeneratingReplies={isGeneratingAI}
        hasContent={(activeTab === 'scheduled' ? scheduledDrops.length : receivedDrops.length) > 0}
        isSelectionMode={isSelectionMode}
        onToggleSelection={() => isSelectionMode ? exitSelectionMode() : enterSelectionMode()}
        onShowHelp={() => setShowShortcutsHelp(true)}
        selectionCount={selectionCount}
        customActions={[
          {
            icon: <Plus className="w-4 h-4" />,
            label: 'New Drop',
            title: 'Create new drop',
            onClick: () => setShowNewDrop(true),
          },
        ]}
      />

      {/* Tabs */}
      <div className={`px-4 md:px-6 py-3 border-b ${tc.border} ${tc.cardBg}`}>
        <div className={`flex gap-1 rounded-xl p-1 w-fit ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100/80'}`}>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'scheduled'
                ? `${tc.btnPrimary}`
                : `${tc.textSecondary} ${tc.hoverBg}`
            }`}
          >
            <Send className="w-4 h-4 inline mr-2" />
            Scheduled ({scheduledDrops.length})
          </button>
          <button
            onClick={() => setActiveTab('received')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'received'
                ? `${tc.btnPrimary}`
                : `${tc.textSecondary} ${tc.hoverBg}`
            }`}
          >
            <Gift className="w-4 h-4 inline mr-2" />
            Received ({receivedDrops.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {activeTab === 'scheduled' ? (
          <div className="space-y-4">
            {scheduledDrops.length === 0 ? (
              <VoxEmptyState
                {...emptyConfig}
                isDarkMode={isDarkMode}
                action={{ label: 'Create Drop', onClick: () => setShowNewDrop(true) }}
              />
            ) : (
              scheduledDrops.map((drop) => (
                <div
                  key={drop.id}
                  className={`p-4 rounded-2xl border transition-all group relative ${tc.cardBg} ${tc.border} hover:border-red-500/30`}
                >
                  {/* Phase 2: Selection Checkbox */}
                  {isSelectionMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const selectionItem: VoxSelectionItem = {
                          id: drop.id,
                          type: 'audio' as const,
                          url: drop.audioUrl,
                          duration: drop.duration,
                          timestamp: drop.scheduledFor,
                          sender: drop.senderId === voxModeService.getUserId() ? 'me' : 'other',
                          transcript: drop.message,
                          mode: 'vox_drop' as const,
                          contactId: drop.recipientIds[0],
                          contactName: drop.title || 'Vox Drop',
                        };
                        toggleSelection(selectionItem);
                      }}
                      className={`absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center transition-all shadow-lg hover:scale-110 active:scale-95 z-10 ${
                        isSelected(drop.id)
                          ? 'bg-red-500 border-2 border-red-600'
                          : 'bg-white dark:bg-gray-700 border-2 border-gray-400 dark:border-gray-500'
                      }`}
                      style={{
                        boxShadow: isSelected(drop.id)
                          ? '0 4px 12px rgba(239, 68, 68, 0.4)'
                          : '0 2px 8px rgba(0, 0, 0, 0.2)',
                      }}
                    >
                      {isSelected(drop.id) && <Check className="w-5 h-5 text-white font-bold" />}
                    </button>
                  )}

                  <div className="flex items-start gap-3 md:gap-4">
                    {/* Play Button */}
                    <button
                      onClick={() => handlePlayDrop(drop)}
                      className="w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
                      style={{
                        background: playingDropId === drop.id && isPlaying
                          ? MODE_COLOR
                          : isDarkMode ? 'rgba(55,65,81,0.5)' : 'rgba(229,231,235,0.8)',
                        boxShadow: playingDropId === drop.id && isPlaying ? `0 4px 12px ${MODE_COLOR}50` : 'none'
                      }}
                      aria-label={playingDropId === drop.id && isPlaying ? 'Pause' : 'Play'}
                    >
                      {playingDropId === drop.id && isPlaying ? (
                        <Pause className="w-5 h-5 text-white" />
                      ) : (
                        <Play className="w-5 h-5 text-white ml-0.5" />
                      )}
                    </button>

                  <div className="flex-1 min-w-0">
                    {editingDropId === drop.id ? (
                      /* Inline Edit Mode */
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Drop title"
                          className={`w-full px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                            isDarkMode
                              ? 'bg-gray-700/60 border-gray-600 text-white placeholder-gray-400'
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                          } focus:outline-none focus:ring-2 focus:ring-red-500/40`}
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={editScheduleDate}
                            onChange={(e) => setEditScheduleDate(e.target.value)}
                            title="Scheduled date"
                            aria-label="Scheduled date"
                            className={`flex-1 px-3 py-1.5 rounded-lg text-sm border ${
                              isDarkMode
                                ? 'bg-gray-700/60 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            } focus:outline-none focus:ring-2 focus:ring-red-500/40`}
                          />
                          <input
                            type="time"
                            value={editScheduleTime}
                            onChange={(e) => setEditScheduleTime(e.target.value)}
                            title="Scheduled time"
                            aria-label="Scheduled time"
                            className={`w-28 px-3 py-1.5 rounded-lg text-sm border ${
                              isDarkMode
                                ? 'bg-gray-700/60 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            } focus:outline-none focus:ring-2 focus:ring-red-500/40`}
                          />
                        </div>
                        <textarea
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          placeholder="Message (optional)"
                          rows={2}
                          className={`w-full px-3 py-1.5 rounded-lg text-sm border resize-none ${
                            isDarkMode
                              ? 'bg-gray-700/60 border-gray-600 text-white placeholder-gray-400'
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                          } focus:outline-none focus:ring-2 focus:ring-red-500/40`}
                        />
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="px-3 py-1 rounded-lg text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className={`px-3 py-1 rounded-lg text-xs font-medium ${tc.btnGhost}`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                    {/* Title & Status */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className={`font-semibold truncate ${tc.text}`}>
                        {drop.title || 'Untitled Drop'}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(drop.status)}`}>
                        {drop.status}
                      </span>
                      {drop.isRecurring && (
                        <Repeat className={`w-4 h-4 ${tc.textMuted}`} />
                      )}
                    </div>

                    {/* Recipients */}
                    <div className="flex items-center gap-2 mb-2">
                      <Users className={`w-4 h-4 ${tc.textMuted}`} />
                      <span className={`text-sm ${tc.textSecondary}`}>
                        {drop.recipientIds.length} recipient{drop.recipientIds.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Scheduled Time */}
                    <div className="flex items-center gap-3 md:gap-4 text-sm flex-wrap">
                      <span className="flex items-center gap-1" style={{ color: MODE_COLOR }}>
                        <Calendar className="w-4 h-4" />
                        {formatScheduledDate(drop.scheduledFor)}
                      </span>
                      <span className={tc.textMuted}>
                        {drop.scheduledFor.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`flex items-center gap-1 ${tc.textMuted}`}>
                        <Timer className="w-3 h-3" />
                        {formatDuration(drop.duration)}
                      </span>
                    </div>

                    {/* Reveal Condition */}
                    {drop.revealCondition && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-purple-400">
                        <Lock className="w-3 h-3" />
                        {drop.revealCondition.description}
                      </div>
                    )}

                    {/* Message */}
                    {drop.message && (
                      <p className={`mt-2 text-sm line-clamp-2 ${tc.textSecondary}`}>
                        {drop.message}
                      </p>
                    )}
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 md:gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => handleStartEdit(drop)}
                      className={`p-2 rounded-xl ${tc.btnGhost}`}
                      aria-label="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCancelDrop(drop.id)}
                      className={`p-2 rounded-xl ${tc.btnGhost} hover:text-red-400`}
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setMenuAnchorRect(rect);
                        setShowMessageMenu(showMessageMenu === drop.id ? null : drop.id);
                      }}
                        className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                        title="More actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {showMessageMenu === drop.id && (
                        <VoxMessageMenu
                          isDarkMode={isDarkMode}
                          accentColor={MODE_COLOR}
                          anchorRect={menuAnchorRect!}
                          onArchive={() => handleArchiveDrop(drop)}
                          onDownload={() => handleDownloadDrop(drop)}
                          onDelete={async () => {
                            const success = await voxModeService.cancelVoxDrop(drop.id);
                            if (success) {
                              setScheduledDrops(prev => prev.filter(d => d.id !== drop.id));
                              toast.success('Drop deleted');
                            } else {
                              toast.error('Failed to delete drop');
                            }
                            setShowMessageMenu(null);
                          }}
                          onClose={() => setShowMessageMenu(null)}
                        />
                    )}
                  </div>
                </div>

                {/* Waveform for playing */}
                {playingDropId === drop.id && (
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1">
                      <VoxAudioVisualizer
                        analyser={null}
                        isActive={false}
                        isPlaying={isPlaying}
                        playbackProgress={playbackProgress}
                        mode="waveform"
                        color={MODE_COLOR}
                        height={40}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                    {/* Phase 6: Playback Speed Control */}
                    <PlaybackSpeedControl
                      speed={globalPlaybackSpeed}
                      onSpeedChange={(newSpeed) => {
                        setGlobalPlaybackSpeed(newSpeed);
                        if (audioRef.current) audioRef.current.playbackRate = newSpeed;
                      }}
                      isDarkMode={isDarkMode}
                      compact={true}
                    />
                  </div>
                )}
              </div>
            ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {receivedDrops.length === 0 ? (
              <div className={`text-center py-12 ${tc.textMuted}`}>
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${MODE_COLOR}20 0%, ${MODE_COLOR}10 100%)`,
                    border: `1px solid ${MODE_COLOR}30`
                  }}
                >
                  <Gift className="w-8 h-8" style={{ color: MODE_COLOR, opacity: 0.6 }} />
                </div>
                <p className={tc.text}>No received drops yet</p>
                <p className={`text-sm mt-1 ${tc.textSecondary}`}>Time capsules from others will appear here</p>
              </div>
            ) : (
              receivedDrops.map((drop) => (
                <div
                  key={drop.id}
                  className="p-4 rounded-2xl border transition-all group relative"
                  style={{
                    background: `linear-gradient(135deg, ${MODE_COLOR}10 0%, rgba(236,72,153,0.1) 100%)`,
                    borderColor: `${MODE_COLOR}30`
                  }}
                >
                  {/* Phase 2: Selection Checkbox */}
                  {isSelectionMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const selectionItem: VoxSelectionItem = {
                          id: drop.id,
                          type: 'audio' as const,
                          url: drop.audioUrl,
                          duration: drop.duration,
                          timestamp: drop.scheduledFor,
                          sender: drop.senderId === voxModeService.getUserId() ? 'me' : 'other',
                          transcript: drop.message,
                          mode: 'vox_drop' as const,
                          contactId: drop.recipientIds[0],
                          contactName: drop.title || 'Vox Drop',
                        };
                        toggleSelection(selectionItem);
                      }}
                      className={`absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center transition-all shadow-lg hover:scale-110 active:scale-95 z-10 ${
                        isSelected(drop.id)
                          ? 'bg-red-500 border-2 border-red-600'
                          : 'bg-white dark:bg-gray-700 border-2 border-gray-400 dark:border-gray-500'
                      }`}
                      style={{
                        boxShadow: isSelected(drop.id)
                          ? '0 4px 12px rgba(239, 68, 68, 0.4)'
                          : '0 2px 8px rgba(0, 0, 0, 0.2)',
                      }}
                    >
                      {isSelected(drop.id) && <Check className="w-5 h-5 text-white font-bold" />}
                    </button>
                  )}

                  <div className="flex items-start gap-3 md:gap-4">
                    {/* Gift Icon / Play */}
                    <button
                      onClick={() => handlePlayDrop(drop)}
                      className="w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
                      style={{
                        background: playingDropId === drop.id && isPlaying
                          ? MODE_COLOR
                          : `${MODE_COLOR}30`,
                        boxShadow: playingDropId === drop.id && isPlaying ? `0 4px 12px ${MODE_COLOR}50` : 'none'
                      }}
                      aria-label={playingDropId === drop.id && isPlaying ? 'Pause' : 'Play'}
                    >
                      {drop.status === 'delivered' ? (
                        <Gift className="w-5 h-5" style={{ color: MODE_COLOR }} />
                      ) : playingDropId === drop.id && isPlaying ? (
                        <Pause className="w-5 h-5 text-white" />
                      ) : (
                        <Play className="w-5 h-5 text-white ml-0.5" />
                      )}
                    </button>

                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold mb-1 ${tc.text}`}>
                      {drop.title || 'A message for you'}
                    </h3>
                    <p className={`text-sm mb-2 ${tc.textSecondary}`}>
                      Delivered {drop.deliveredAt?.toLocaleDateString()}
                    </p>
                    {drop.message && (
                      <p className={`text-sm ${tc.textSecondary}`}>{drop.message}</p>
                    )}
                  </div>
                  <button
                      type="button"
                      onClick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                      setMenuAnchorRect(rect);
                      setShowMessageMenu(showMessageMenu === drop.id ? null : drop.id);
                    }}
                      className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                      title="More actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {showMessageMenu === drop.id && (
                      <VoxMessageMenu
                        isDarkMode={isDarkMode}
                        accentColor={MODE_COLOR}
                        anchorRect={menuAnchorRect!}
                        onArchive={() => handleArchiveDrop(drop)}
                        onDownload={() => handleDownloadDrop(drop)}
                        onDelete={() => {
                          setReceivedDrops(prev => prev.filter(d => d.id !== drop.id));
                          setShowMessageMenu(null);
                          toast.success('Drop deleted');
                        }}
                        onClose={() => setShowMessageMenu(null)}
                      />
                  )}
                </div>

                {playingDropId === drop.id && (
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1">
                      <VoxAudioVisualizer
                        analyser={null}
                        isActive={false}
                        isPlaying={isPlaying}
                        playbackProgress={playbackProgress}
                        mode="waveform"
                        color={MODE_COLOR}
                        height={40}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                    {/* Phase 6: Playback Speed Control */}
                    <PlaybackSpeedControl
                      speed={globalPlaybackSpeed}
                      onSpeedChange={(newSpeed) => {
                        setGlobalPlaybackSpeed(newSpeed);
                        if (audioRef.current) audioRef.current.playbackRate = newSpeed;
                      }}
                      isDarkMode={isDarkMode}
                      compact={true}
                    />
                  </div>
                )}
              </div>
            ))
            )}
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

      {/* New Drop Modal */}
      {showNewDrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className={tc.modalOverlay} onClick={resetForm} />
          <div className={`relative w-full max-w-4xl rounded-2xl border ${tc.modalBg} p-6 my-8 max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="p-2 rounded-xl"
                style={{ background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #ec4899 100%)` }}
              >
                <Clock className="w-5 h-5 text-white" />
              </div>
              <h3 className={`text-xl font-bold ${tc.text}`}>Schedule a Vox Drop</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT COLUMN: Recording Section */}
              <div className="space-y-5">
                <div>
                  <label className={`block text-sm font-medium mb-3 ${tc.textSecondary}`}>
                    Record Your Message
                  </label>
                  <div className={`p-4 rounded-xl ${tc.cardBg} border ${tc.border}`}>
                  {recordingState === 'preview' && recordingData ? (
                    <RecordingPreview
                      recordingData={recordingData}
                      onSend={() => sendRecording()}
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
                      {recordingState === 'recording' && (
                        <div className="w-full max-w-md mx-auto">
                          <VoxAudioVisualizer
                            analyser={analyser}
                            isActive={true}
                            mode="waveform"
                            color={MODE_COLOR}
                            height={40}
                            isDarkMode={isDarkMode}
                          />
                        </div>
                      )}
                    </VoxRecordArea>
                  )}
                </div>
                </div>

                {/* Title */}
                <div>
                <label className={`block text-sm font-medium mb-2 ${tc.textSecondary}`}>
                  Title (Optional)
                </label>
                <input
                  type="text"
                  value={dropTitle}
                  onChange={(e) => setDropTitle(e.target.value)}
                  placeholder="Birthday Surprise, Future Self Note..."
                  className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all`}
                />
              </div>

              {/* Message */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${tc.textSecondary}`}>
                  Message (Optional)
                </label>
                <textarea
                  value={dropMessage}
                  onChange={(e) => setDropMessage(e.target.value)}
                  placeholder="Add a text note to accompany your vox..."
                  rows={2}
                  className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all resize-none`}
                />
                </div>
              </div>

              {/* RIGHT COLUMN: Recipients & Settings */}
              <div className="space-y-5">
              {/* Recipients */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${tc.textSecondary}`}>
                  Recipients
                </label>
                <div className={`max-h-32 overflow-y-auto space-y-1 rounded-xl p-2 ${tc.cardBg} border ${tc.border}`}>
                  {pulseContacts.slice(0, 10).map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => {
                        if (selectedRecipients.includes(contact.id)) {
                          setSelectedRecipients(selectedRecipients.filter(id => id !== contact.id));
                        } else {
                          setSelectedRecipients([...selectedRecipients, contact.id]);
                        }
                      }}
                      className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${
                        selectedRecipients.includes(contact.id)
                          ? `${tc.activeBg} border ${tc.borderAccent}`
                          : tc.hoverBg
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: contact.avatarColor }}
                      >
                        {contact.name.charAt(0)}
                      </div>
                      <span className={`text-sm flex-1 text-left ${tc.text}`}>{contact.name}</span>
                      {selectedRecipients.includes(contact.id) && (
                        <Check className="w-4 h-4" style={{ color: MODE_COLOR }} />
                      )}
                    </button>
                  ))}
                  {pulseContacts.length === 0 && (
                    <p className={`text-center py-4 text-sm ${tc.textMuted}`}>No Pulse users found</p>
                  )}
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${tc.textSecondary}`}>
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={getMinDate()}
                    className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${tc.textSecondary}`}>
                    Delivery Time
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all`}
                  />
                </div>
              </div>

              {/* Recurring Option */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
                    isRecurring
                      ? `${tc.activeBg} border ${tc.borderAccent}`
                      : `${tc.cardBg} border ${tc.border} ${tc.textSecondary}`
                  }`}
                  style={isRecurring ? { color: MODE_COLOR } : undefined}
                >
                  <Repeat className="w-4 h-4" />
                  Recurring
                </button>

                {isRecurring && (
                  <select
                    value={recurringFrequency}
                    onChange={(e) => setRecurringFrequency(e.target.value as any)}
                    className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 ${tc.inputBg} ${tc.text} border`}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                )}
              </div>

              {/* Special Reveal Conditions */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${tc.textSecondary}`}>
                  Special Reveal Condition (Optional)
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setRevealType(revealType === 'location' ? null : 'location')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all ${
                      revealType === 'location'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : `${tc.cardBg} border ${tc.border} ${tc.textSecondary}`
                    }`}
                  >
                    <MapPin className="w-3 h-3" />
                    Location
                  </button>
                  <button
                    onClick={() => setRevealType(revealType === 'custom' ? null : 'custom')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all ${
                      revealType === 'custom'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : `${tc.cardBg} border ${tc.border} ${tc.textSecondary}`
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    Custom
                  </button>
                </div>
                {revealType && (
                  <input
                    type="text"
                    value={revealValue}
                    onChange={(e) => setRevealValue(e.target.value)}
                    placeholder={
                      revealType === 'location'
                        ? 'Enter location name...'
                        : 'Enter reveal condition...'
                    }
                    className={`w-full mt-2 px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${tc.inputBg} ${tc.text} border`}
                  />
                )}
              </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={resetForm}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnSecondary}`}
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleDrop}
                disabled={!recordingData || selectedRecipients.length === 0 || !scheduledDate || !scheduledTime}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnPrimary} disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                <Clock className="w-4 h-4" />
                Schedule Drop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2: Selection Toolbar */}
      {isSelectionMode && (
        <VoxSelectToolbar
          selectedItems={selectedItems}
          selectionCount={selectionCount}
          totalDuration={getTotalDuration()}
          onSelectAll={handleSelectAllDrops}
          onDeselectAll={deselectAll}
          onExitSelection={exitSelectionMode}
          contactName="Vox Drops"
          isDarkMode={isDarkMode}
          accentColor={MODE_COLOR}
          allSelected={selectionCount === (activeTab === 'scheduled' ? scheduledDrops.length : receivedDrops.length) && (activeTab === 'scheduled' ? scheduledDrops.length : receivedDrops.length) > 0}
        />
      )}

      {/* Phase 5: AI Enhancement Modals */}

      {/* Conversation Summary Modal */}
      {conversationSummary && showSummary && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <VoxConversationSummary
              summary={conversationSummary}
              isDarkMode={isDarkMode}
              accentColor={MODE_COLOR}
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
            accentColor={MODE_COLOR}
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
          accentColor={MODE_COLOR}
        />
      )}
    </div>
  );
};

export default VoxDropMode;
