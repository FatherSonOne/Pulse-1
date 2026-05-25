// Pulse Radio Mode - CMF Nothing x Glassmorphism Avant-Garde Design
// Broadcast your voice with premium industrial aesthetic

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  Mic,
  Play,
  Pause,
  Users,
  Heart,
  MessageSquare,
  Share2,
  Plus,
  Settings,
  Clock,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Globe,
  Lock,
  Headphones,
  Loader2,
  BellRing,
  Trash2,
  Edit3,
  CheckCheck,
  Tower,
  Reply,
  MoreVertical,
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import RecordingPreview from './RecordingPreview';
import VoxModeHeader from './VoxModeHeader';
import VoxModeToolbar from './VoxModeToolbar';
import VoxRecordArea from './VoxRecordArea';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { voxModeService } from '../../services/relay/voxModeService';
import { supabase } from '../../services/supabase';
// analyticsCollector loaded dynamically to avoid svc-crm-analytics chunk TDZ
import { type PulseChannel, type Broadcast } from '../../services/relay/voxModeTypes';
import toast from 'react-hot-toast';
import './PulseRadio.css';

// Phase 2: Selection Mode & Archive/Download
import { useVoxSelection } from '../../hooks/useVoxSelection';
import type { VoxSelectionItem } from '../../hooks/useVoxSelection';
import VoxMessageMenu from './VoxMessageMenu';
import VoxDownloadModal from './VoxDownloadModal';
import { archiveRelayConversation } from '../../services/relay/relayArchiveService';
import { VoxSelectToolbar } from './VoxSelectToolbar';

// Phase 5: AI Enhancements
import {
  MessageAIPanel,
  VoxSmartReplies,
} from './index';
import {
  summarizeConversation,
  generateSmartReplies,
  ConversationSummary,
  SmartReply,
} from '../../services/relay/relayAIService';

// Phase 6: Final Polish
import { useRelayKeyboardShortcuts } from '../../hooks/useRelayKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from './VoxKeyboardShortcutsHelp';
import { PlaybackSpeedControl } from './PlaybackSpeedControl';
import { RelayVoiceMessage } from './RelayVoiceMessage';
import { useRelayStudio, useRelayModeRecorder } from './studio';
import { VoxEmptyState } from './VoxEmptyState';
import { getEmptyStateConfig } from './voxEmptyStates';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';

interface PulseRadioProps {
  apiKey?: string;
  onBack: () => void;
  isDarkMode?: boolean;
  /** Broadcast id to scroll to / select on mount (e.g. triage deep-link). */
  initialBroadcastId?: string;
}

// Relay brand accent (rose-500) — per-mode colors retired in 2.1d.1.
const MODE_COLOR = '#f43f5e';
const MODE_COLOR_LIGHT = '#fb7185'; // rose-400

// ============================================
// MAIN COMPONENT
// ============================================
// The LayeredVisualizer (3-layer canvas + particles + glow + ambient idle
// wave) was retired during the /impeccable distill pass — its decoration
// collided with the Coral Cockpit philosophy (category-reflex "broadcast =
// glowing radio waves"). The shared VoxAudioVisualizer now carries the
// signal, matching Direct / Channel / Notes.

const PulseRadio: React.FC<PulseRadioProps> = ({ onBack, apiKey, isDarkMode = false, initialBroadcastId }) => {
  const [channels, setChannels] = useState<PulseChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<PulseChannel | null>(null);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  // Single-pane (narrow) nav: channels list vs the selected channel's feed.
  // Decoupled from selectedChannel; inert when the pane is wide enough. Mirrors
  // Direct/Channel. 'detail' = the broadcast feed for the selected channel.
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  // Playback flows through the shared Voice Studio transport. Active-broadcast
  // state derives from studio.nowPlaying / studio.isPlaying / studio.progress.
  const studio = useRelayStudio();
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [showNotifyUsers, setShowNotifyUsers] = useState(false);
  const [selectedNotifyUsers, setSelectedNotifyUsers] = useState<string[]>([]);
  const [pulseUsers, setPulseUsers] = useState<any[]>([]);
  const [activeBroadcastRoom, setActiveBroadcastRoom] = useState<Broadcast | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [likedBroadcasts, setLikedBroadcasts] = useState<Set<string>>(new Set());
  const [editingChannel, setEditingChannel] = useState(false);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelDescription, setEditChannelDescription] = useState('');

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
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
  const [isGeneratingReplies, setIsGeneratingReplies] = useState(false);

  // Phase 6: Final Polish States
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Message Menu & Download States
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadItem, setDownloadItem] = useState<VoxSelectionItem | null>(null);
  const emptyConfig = getEmptyStateConfig('pulse_radio');


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
    defaultRecordingMode: 'tap',
  });

  // Persist recording mode preference
  useEffect(() => {
    localStorage.setItem('voxer-recording-mode', recordingMode);
  }, [recordingMode]);

  // Tier 2 (unify trigger): the studio shell's FloatingMic + footer RECORDING
  // surface drive Broadcast's capture; the in-pane record buttons are retired.
  // Enabled when a channel is selected (compose a new broadcast) or a broadcast
  // room is open (discussion response). The title input + preview → send stay
  // in-pane and route to the right handler based on the active view.
  useRelayModeRecorder({
    start: startRecording,
    stop: stopRecording,
    cancel: cancelRecording,
    recording: recordingState === 'recording',
    enabled: !!(selectedChannel || activeBroadcastRoom),
  });

  // Phase 6: Keyboard Shortcuts
  useRelayKeyboardShortcuts({
    onToggleRecording: () => {
      if (recordingState === 'idle') startRecording();
      else if (recordingState === 'recording') stopRecording();
    },
    onStopRecording: () => {
      // Priority 1: close any open modal/overlay first
      if (showMessageMenu) { setShowMessageMenu(null); return; }
      if (showSummary) { setShowSummary(false); return; }
      if (showDownloadModal) { setShowDownloadModal(false); return; }
      if (showChannelSettings) { setShowChannelSettings(false); return; }
      if (showNotifyUsers) { setShowNotifyUsers(false); return; }
      if (showNewChannel) { setShowNewChannel(false); return; }
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
            await archiveRelayConversation(Array.from(selectedItems), 'Pulse Radio');
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
    onSummarize: () => {
      if (broadcasts.length > 0) {
        handleSummarizeChannel();
      }
    },
    onShowHelp: () => setShowShortcutsHelp(true),
  }, true);

  // ============================================
  // HANDLERS
  // ============================================

  const handleLikeBroadcast = useCallback(async (broadcastId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const newLiked = new Set(likedBroadcasts);
    if (newLiked.has(broadcastId)) {
      newLiked.delete(broadcastId);
      toast.success('Removed like');
    } else {
      newLiked.add(broadcastId);
      toast.success('Liked broadcast!');
    }
    setLikedBroadcasts(newLiked);

    // Update in database (optional - add your like service here)
    try {
      await voxModeService.toggleBroadcastLike?.(broadcastId);
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  }, [likedBroadcasts]);

  const handleSendBroadcast = async () => {
    if (!recordingData || !selectedChannel) return;
    if (!broadcastTitle.trim()) {
      toast.error('Please enter a broadcast title');
      return;
    }

    const broadcast = await voxModeService.uploadAndPublishBroadcast(
      selectedChannel.id,
      broadcastTitle,
      recordingData.blob,
      recordingData.duration,
      selectedNotifyUsers.length > 0 ? selectedNotifyUsers : undefined
    );

    if (broadcast) {
      setBroadcasts([broadcast, ...broadcasts]);
      import('../../services/analyticsCollector').then(({ default: ac }) => {
        ac.trackMessageEvent({
          id: broadcast.id,
          channel: 'voxer',
          contactIdentifier: selectedChannel.id,
          contactName: `📻 ${selectedChannel.name}`,
          isSent: true,
          timestamp: new Date(),
          content: broadcastTitle,
          duration: recordingData.duration,
          messageType: 'broadcast'
        }).catch(console.error);
      }).catch(() => {});

      sendRecording();
      setBroadcastTitle('');
      setSelectedNotifyUsers([]);
      toast.success('Broadcast published!');
    } else {
      toast.error('Failed to publish broadcast');
    }
  };

  const handleSendDiscussionResponse = async () => {
    if (!recordingData || !activeBroadcastRoom) {
      console.error('Cannot send discussion response: no recording or active broadcast');
      return;
    }

    // Discussion responses are broadcasts that reply to the original broadcast
    const response = await voxModeService.uploadAndPublishBroadcast(
      activeBroadcastRoom.channelId,
      `Re: ${activeBroadcastRoom.title}`,
      recordingData.blob,
      recordingData.duration,
      [] // No special notifications for responses
    );

    if (response) {
      // Optionally reload broadcasts to show the response
      loadBroadcasts(activeBroadcastRoom.channelId);

      import('../../services/analyticsCollector').then(({ default: ac }) => {
        ac.trackMessageEvent({
          id: response.id,
          channel: 'voxer',
          contactIdentifier: activeBroadcastRoom.channelId,
          contactName: `📻 Discussion Response`,
          isSent: true,
          timestamp: new Date(),
          content: `Re: ${activeBroadcastRoom.title}`,
          duration: recordingData.duration,
          messageType: 'broadcast_response'
        }).catch(console.error);
      }).catch(() => {});

      sendRecording();
      setActiveBroadcastRoom(null);
      toast.success('Response added to discussion!');
    } else {
      toast.error('Failed to send response');
    }
  };

  useEffect(() => {
    loadChannels();
    loadPulseUsers();
  }, []);

  useEffect(() => {
    if (selectedChannel) {
      loadBroadcasts(selectedChannel.id);
    }
  }, [selectedChannel]);

  // Deep-link: when the parent passed a broadcast id (e.g. from a triage row
  // click), scroll the matching broadcast row into view once it's loaded.
  // If the broadcast lives on a channel we haven't auto-selected, the row
  // won't be in `broadcasts` yet — gracefully degrades to "land on the
  // section" without further routing.
  useEffect(() => {
    if (!initialBroadcastId || broadcasts.length === 0) return;
    const match = broadcasts.find((b) => b.id === initialBroadcastId);
    if (!match) return;
    const el = document.querySelector<HTMLElement>(
      `[data-broadcast-id="${initialBroadcastId}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [initialBroadcastId, broadcasts]);

  const loadPulseUsers = async () => {
    const users = await voxModeService.getAllPulseUsers();
    const currentUserId = voxModeService.getUserId();
    setPulseUsers(users.filter(u => u.id !== currentUserId));
  };

  const loadChannels = async () => {
    const data = await voxModeService.getMyChannels();
    setChannels(data);
    if (data.length > 0 && !selectedChannel) {
      setSelectedChannel(data[0]);
    }
  };

  const loadBroadcasts = async (channelId: string) => {
    const data = await voxModeService.getChannelBroadcasts(channelId);
    setBroadcasts(data);
  };

  // Phase 5: AI Enhancement Handlers
  const handleSummarizeChannel = async () => {
    if (broadcasts.length === 0) {
      toast.error('No broadcasts to summarize');
      return;
    }

    if (!apiKey) {
      toast.error('Gemini API key not configured');
      return;
    }

    setIsSummarizing(true);
    try {
      const messages = broadcasts.map(b => ({
        id: b.id,
        transcription: b.title || 'Untitled broadcast',
        sender: 'other' as const,
        senderName: b.broadcaster || 'Unknown',
        timestamp: b.timestamp,
        duration: 0,
      }));

      const summary = await summarizeConversation(apiKey, messages);
      if (summary) {
        setConversationSummary(summary);
        setShowSummary(true);
        toast.success('Broadcasts summarized!');
      } else {
        toast.error('AI summarizer unavailable. Try again later.');
      }
    } catch (error: any) {
      console.error('Summarization failed:', error);
      const msg = error?.message || '';
      if (msg.includes('API key') || msg.includes('API_KEY')) {
        toast.error('AI features require API configuration');
      } else if (msg.includes('network') || msg.includes('fetch')) {
        toast.error('Network error. Please try again.');
      } else {
        toast.error('AI summarizer unavailable (beta)');
      }
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateSmartReplies = async () => {
    if (broadcasts.length === 0) {
      toast.error('No broadcasts to analyze');
      return;
    }

    if (!apiKey) {
      toast.error('Gemini API key not configured');
      return;
    }

    setIsGeneratingReplies(true);
    try {
      const recentBroadcasts = broadcasts.slice(0, 5);
      const lastBroadcast = recentBroadcasts[0];

      const context = recentBroadcasts.map(b => ({
        id: b.id,
        transcription: b.title || 'Untitled broadcast',
        sender: 'other' as const,
        senderName: b.broadcaster || 'Unknown',
        timestamp: b.timestamp,
        duration: 0,
      }));

      const replies = await generateSmartReplies(apiKey, {
        id: lastBroadcast.id,
        transcription: lastBroadcast.title || 'Untitled broadcast',
        sender: 'other' as const,
        senderName: lastBroadcast.broadcaster || 'Unknown',
        timestamp: lastBroadcast.timestamp,
        duration: 0,
      }, context);
      if (replies.length > 0) {
        setSmartReplies(replies);
        toast.success('Smart replies generated!');
      } else {
        toast.error('AI replies unavailable. Try again later.');
      }
    } catch (error: any) {
      console.error('Smart reply generation failed:', error);
      const msg = error?.message || '';
      if (msg.includes('API key') || msg.includes('API_KEY')) {
        toast.error('AI features require API configuration');
      } else {
        toast.error('AI replies unavailable (beta)');
      }
    } finally {
      setIsGeneratingReplies(false);
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || isCreatingChannel) return;

    setIsCreatingChannel(true);
    try {
      const channel = await voxModeService.createChannel(newChannelName, newChannelDesc, isPublic);
      if (channel) {
        setChannels([channel, ...channels]);
        setSelectedChannel(channel);
        setShowNewChannel(false);
        setNewChannelName('');
        setNewChannelDesc('');
        setIsPublic(true);
        toast.success('Channel created!');
      } else {
        toast.error('Failed to create channel');
      }
    } catch (error) {
      toast.error('Error creating channel');
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handlePlayBroadcast = (broadcast: Broadcast) => {
    if (studio.nowPlaying?.id === broadcast.id) {
      studio.togglePlay();
      return;
    }
    studio.play({
      id: broadcast.id,
      sender: broadcast.title || 'Broadcast',
      dur: formatDuration(broadcast.duration),
      type: 'BROADCAST',
      transcript: broadcast.transcript ?? null,
      source: 'broadcast',
      audioUrl: broadcast.audioUrl,
    });
  };

  const handleArchiveBroadcast = async (broadcast: any) => {
    const item: VoxSelectionItem = {
      id: broadcast.id,
      type: 'audio',
      url: broadcast.audioUrl || '',
      duration: broadcast.duration || 0,
      timestamp: broadcast.createdAt instanceof Date ? broadcast.createdAt : new Date(broadcast.createdAt || Date.now()),
      mode: 'pulse_radio',
      contactName: broadcast.title || broadcast.hostName,
    };
    try {
      await archiveRelayConversation([item], broadcast.title || 'Pulse Radio');
      toast.success('Archived to Pulse Archives');
    } catch {
      toast.error('Failed to archive');
    }
  };

  const handleDownloadBroadcast = (broadcast: any) => {
    const item: VoxSelectionItem = {
      id: broadcast.id,
      type: 'audio',
      url: broadcast.audioUrl || '',
      duration: broadcast.duration || 0,
      timestamp: broadcast.createdAt instanceof Date ? broadcast.createdAt : new Date(broadcast.createdAt || Date.now()),
      mode: 'pulse_radio',
      contactName: broadcast.title || broadcast.hostName,
    };
    setDownloadItem(item);
    setShowDownloadModal(true);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  // ============================================
  // RENDER
  // ============================================

  // Playback active-state helpers — derived from the shared studio transport.
  const isBroadcastActive = (id: string) => studio.nowPlaying?.id === id;
  const isBroadcastPlaying = (id: string) => isBroadcastActive(id) && studio.isPlaying;

  return (
    <div className={`pulse-radio ${isDarkMode ? 'dark' : 'light'} ${studio.singlePane ? 'pulse-radio--single-pane' : ''}`}>
      {/* Audio playback is owned by the shared RelayStudioProvider (single
          <audio>) — no local element here. */}

      {/* Header */}
      <VoxModeToolbar
        onBack={onBack}
        modeIcon={<Radio className="w-5 h-5" />}
        eyebrow="BROADCAST"
        eyebrowTone="rose"
        modeTitle="Broadcast"
        accentColor="#f43f5e"
        isDarkMode={isDarkMode}
        showAI
        onSummarize={handleSummarizeChannel}
        onSmartReplies={handleGenerateSmartReplies}
        isSummarizing={isSummarizing}
        isGeneratingReplies={isGeneratingReplies}
        hasContent={broadcasts.length > 0}
        isSelectionMode={isSelectionMode}
        onToggleSelection={() => isSelectionMode ? exitSelectionMode() : enterSelectionMode()}
        onShowHelp={() => setShowShortcutsHelp(true)}
        customActions={[
          {
            icon: <Users className="w-5 h-5" />,
            title: 'Toggle channels',
            onClick: () => setShowMobileSidebar(!showMobileSidebar),
          },
          {
            icon: <Plus className="w-4 h-4" />,
            title: 'Create channel',
            onClick: () => setShowNewChannel(true),
          },
        ]}
      />

      <div className="pulse-radio-body">
        {/* Mobile Sidebar Overlay */}
        {showMobileSidebar && (
          <div className="pulse-radio-mobile-sidebar-overlay">
            <div className="pulse-radio-mobile-backdrop" onClick={() => setShowMobileSidebar(false)} />
            <aside className="pulse-radio-mobile-sidebar">
              <div className="pulse-radio-sidebar-header">
                <h2>My Channels</h2>
                <button type="button" onClick={() => setShowMobileSidebar(false)} title="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="pulse-radio-channels">
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => {
                      setSelectedChannel(channel);
                      setMobileView('detail');
                      setShowMobileSidebar(false);
                    }}
                    className={`pulse-radio-channel ${selectedChannel?.id === channel.id ? 'active' : ''}`}
                  >
                    <div className="pulse-radio-channel-icon">
                      <Radio className="w-5 h-5" />
                    </div>
                    <div className="pulse-radio-channel-info">
                      <div className="pulse-radio-channel-name">
                        <span>{channel.name}</span>
                        {channel.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </div>
                      <div className="pulse-radio-channel-stats">
                        <Users className="w-3 h-3" />
                        {channel.subscriberCount}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        )}

        {/* Channels sidebar. Pane-driven single-pane (see .pulse-radio--single-pane
            CSS): full-width list when single-pane, hidden once a channel's feed
            is open (back chevron returns). Side-by-side when the pane is wide. */}
        <aside className={`pulse-radio-sidebar ${
          studio.singlePane ? (selectedChannel && mobileView === 'detail' ? 'pane-hidden' : 'pane-visible') : ''
        }`}>
          <div className="pulse-radio-sidebar-header">
            <h2>My Channels</h2>
          </div>
          <div className="pulse-radio-channels">
            {channels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() => { setSelectedChannel(channel); setMobileView('detail'); }}
                className={`pulse-radio-channel ${selectedChannel?.id === channel.id ? 'active' : ''}`}
              >
                <div className="pulse-radio-channel-icon">
                  <Radio className="w-5 h-5" />
                </div>
                <div className="pulse-radio-channel-info">
                  <div className="pulse-radio-channel-name">
                    <span>{channel.name}</span>
                    {channel.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  </div>
                  <div className="pulse-radio-channel-stats">
                    <Users className="w-3 h-3" />
                    {channel.subscriberCount}
                  </div>
                </div>
              </button>
            ))}

            {channels.length === 0 && (
              <div className="pulse-radio-empty-channels">
                <Radio className="w-12 h-12" />
                <p>No channels yet</p>
                <span>Create your first channel to start broadcasting.</span>
                <button
                  type="button"
                  onClick={() => setShowNewChannel(true)}
                  className="pulse-radio-empty-cta"
                >
                  <Plus className="w-4 h-4" />
                  Create Channel
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className={`pulse-radio-main ${
          studio.singlePane ? (selectedChannel && mobileView === 'detail' ? 'pane-visible' : 'pane-hidden') : ''
        }`}>
          {selectedChannel ? (
            <>
              {/* Channel Header */}
              <div className="pulse-radio-channel-header">
                <div className="pulse-radio-channel-hero">
                  {studio.singlePane && (
                    <button
                      type="button"
                      onClick={() => setMobileView('list')}
                      className="shrink-0 -ml-1 mr-1 p-1.5 rounded-lg text-[var(--pulse-ink-2)] hover:bg-[var(--pulse-surface-raised)] transition self-start"
                      aria-label="Back to channels"
                      title="Back to channels"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  {/* Hero glyph is chrome — coral is reserved for live state
                      (recording, active broadcast). The concentric ring
                      decoration was retired during /impeccable distill:
                      category-reflex (radio → rings) collided with the
                      Coral-As-Signal rule. */}
                  <div className="pulse-radio-hero-icon">
                    <Radio className="w-8 h-8" />
                  </div>
                  <div className="pulse-radio-hero-info">
                    <h2>{selectedChannel.name}</h2>
                    <p>{selectedChannel.description}</p>
                    <div className="pulse-radio-hero-stats">
                      <span><Users className="w-4 h-4" /> {selectedChannel.subscriberCount}</span>
                      <span><Headphones className="w-4 h-4" /> {selectedChannel.totalListens}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowChannelSettings(true)}
                    className="pulse-radio-settings-btn"
                    title="Channel settings"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>

                {/* Recording Section */}
                <div className="pulse-radio-record-section">
                  {recordingState === 'preview' && recordingData ? (
                    <div className="pulse-radio-preview">
                      <input
                        type="text"
                        placeholder="Broadcast title (required)..."
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        className="pulse-radio-title-input"
                      />
                      <RecordingPreview
                        recordingData={recordingData}
                        onSend={handleSendBroadcast}
                        onCancel={() => {
                          cancelRecording();
                          setBroadcastTitle('');
                        }}
                        onRetry={() => {
                          cancelRecording();
                          setTimeout(() => startRecording(), 100);
                        }}
                        color={MODE_COLOR}
                        progressColor={MODE_COLOR_LIGHT}
                        showAnalysis={false}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                  ) : (
                    /* The in-pane record button is retired (Tier 2: the
                       FloatingMic + StudioFooter RECORDING surface drive
                       capture). The broadcast title stays — it applies when the
                       recording is sent from the preview. */
                    <div className="pulse-radio-record-ui">
                      <input
                        type="text"
                        placeholder="Enter broadcast title, then tap the mic to record…"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        className="pulse-radio-title-input"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Broadcasts List */}
              <div className="pulse-radio-broadcasts">
                <h3 className="pulse-radio-section-title">Recent Broadcasts</h3>

                <div className="pulse-radio-broadcast-list">
                  {/* TODO(impeccable phase 3 task 6 — RelayVoiceMessage migration):
                      Migrate this Broadcast episode render to <RelayVoiceMessage />
                      from `./RelayVoiceMessage`. Surface slots needed:
                      episodeChip (already supported), leadingAudienceLabel
                      for "PUBLIC"/"PRIVATE", plus pending API addition:
                      listener-count chip and like/share buttons in
                      footerExtras. Do this after the surface-migration API
                      gap noted at the top of RelayVoiceMessage.tsx is filled. */}
                  {broadcasts.map((broadcast) => {
                    const isLiked = likedBroadcasts.has(broadcast.id);
                    const isCurrentlyPlaying = isBroadcastPlaying(broadcast.id);

                    return (
                      <div key={broadcast.id} className="group relative mb-2">
                        <RelayVoiceMessage
                          id={broadcast.id}
                          audioUrl={broadcast.audioUrl || ''}
                          duration={broadcast.duration}
                          timestamp={broadcast.publishedAt}
                          sender="other"
                          senderName={broadcast.title}
                          isPlaying={isCurrentlyPlaying}
                          onPlay={() => handlePlayBroadcast(broadcast)}
                          onPause={() => handlePlayBroadcast(broadcast)}
                          isActive={isBroadcastActive(broadcast.id)}
                          progress={studio.progress}
                          transcript={broadcast.transcript || undefined}
                          waveformSeed={broadcast.id}
                          isDarkMode={isDarkMode}
                          maxWidth="100%"
                          episodeChip={broadcast.episodeNumber ? (
                            <span className="pulse-radio-episode">EP {broadcast.episodeNumber}</span>
                          ) : undefined}
                          onMore={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuAnchorRect(rect);
                            setShowMessageMenu(showMessageMenu === broadcast.id ? null : broadcast.id);
                          }}
                          selectionCheckbox={isSelectionMode ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const selectionItem: VoxSelectionItem = {
                                  id: broadcast.id,
                                  type: 'audio',
                                  url: broadcast.audioUrl || '',
                                  duration: broadcast.duration,
                                  timestamp: broadcast.publishedAt,
                                  sender: 'other',
                                  transcript: broadcast.transcript,
                                  mode: 'pulse_radio',
                                  contactId: selectedChannel?.id,
                                  contactName: selectedChannel?.name,
                                };
                                toggleSelection(selectionItem);
                              }}
                              className={`w-7 h-7 shrink-0 self-center rounded-lg flex items-center justify-center transition-all ${
                                isSelected(broadcast.id)
                                  ? 'bg-[#f43f5e] border-2 border-[#e11d48]'
                                  : 'bg-white dark:bg-gray-700 border-2 border-gray-400 dark:border-gray-500'
                              }`}
                              aria-label={isSelected(broadcast.id) ? 'Deselect broadcast' : 'Select broadcast'}
                            >
                              {isSelected(broadcast.id) && <Check className="w-4 h-4 text-white" />}
                            </button>
                          ) : undefined}
                          footerExtras={
                            <div className="flex items-center gap-3 flex-wrap">
                              <PlaybackSpeedControl
                                speed={studio.playbackRate}
                                onSpeedChange={studio.setPlaybackRate}
                                isDarkMode={isDarkMode}
                                compact={true}
                              />
                              <span className="pulse-radio-listens">
                                <Headphones className="w-3 h-3" />
                                {broadcast.listenCount}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleLikeBroadcast(broadcast.id, e)}
                                className={`pulse-radio-action-btn ${isLiked ? 'liked' : ''}`}
                                title={isLiked ? 'Unlike' : 'Like'}
                              >
                                <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                                <span>Like</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveBroadcastRoom(broadcast)}
                                className="pulse-radio-action-btn"
                                title="Discuss"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Discuss</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(broadcast.audioUrl);
                                  toast.success('Link copied!');
                                }}
                                className="pulse-radio-action-btn"
                                title="Share"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                <span>Share</span>
                              </button>
                            </div>
                          }
                        />

                        {/* More menu — sibling overlay anchored to the More button */}
                        {showMessageMenu === broadcast.id && (
                          <VoxMessageMenu
                            isDarkMode={isDarkMode}
                            accentColor="#f43f5e"
                            anchorRect={menuAnchorRect!}
                            onArchive={() => handleArchiveBroadcast(broadcast)}
                            onDownload={() => handleDownloadBroadcast(broadcast)}
                            onDelete={() => {
                              setBroadcasts(prev => prev.filter(b => b.id !== broadcast.id));
                              setShowMessageMenu(null);
                              toast.success('Broadcast deleted');
                            }}
                            onClose={() => setShowMessageMenu(null)}
                          />
                        )}
                      </div>
                    );
                  })}

                  {broadcasts.length === 0 && (
                    <VoxEmptyState
                      {...emptyConfig}
                      isDarkMode={isDarkMode}
                      action={{
                        label: 'Start Broadcasting',
                        onClick: () => {
                          if (recordingState === 'idle') startRecording();
                        },
                      }}
                    />
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="pulse-radio-empty-state">
              {/* Quiet empty state — the decorative wave-1/2/3 layer was the
                  AI-slop tell. A single Radio glyph carries the same meaning
                  without the category reflex. */}
              <div className="pulse-radio-empty-icon">
                <Radio className="w-10 h-10" />
              </div>
              <p>Select or create a channel</p>
              <span>to start broadcasting</span>
            </div>
          )}
        </main>
      </div>

      {/* New Channel Modal */}
      {showNewChannel && (
        <div className="pulse-radio-modal-overlay">
          <div className="pulse-radio-modal-backdrop" onClick={() => setShowNewChannel(false)} />
          <div className="pulse-radio-modal">
            <h3>Create Channel</h3>
            <div className="pulse-radio-modal-form">
              <div className="pulse-radio-form-group">
                <label>Channel Name</label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="My Awesome Channel"
                />
              </div>
              <div className="pulse-radio-form-group">
                <label>Description</label>
                <textarea
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="What's this channel about?"
                  rows={3}
                />
              </div>
              <div className="pulse-radio-visibility-toggle">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={isPublic ? 'active' : ''}
                >
                  <Globe className="w-4 h-4" />
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={!isPublic ? 'active' : ''}
                >
                  <Lock className="w-4 h-4" />
                  Private
                </button>
              </div>
            </div>
            <div className="pulse-radio-modal-actions">
              <button type="button" onClick={() => setShowNewChannel(false)} className="pulse-radio-cancel-btn" disabled={isCreatingChannel}>
                Cancel
              </button>
              <button type="button" onClick={handleCreateChannel} className="pulse-radio-submit-btn" disabled={isCreatingChannel || !newChannelName.trim()}>
                {isCreatingChannel ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Channel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Channel Settings Modal */}
      {showChannelSettings && selectedChannel && (
        <div className="pulse-radio-modal-overlay">
          <div className="pulse-radio-modal-backdrop" onClick={() => setShowChannelSettings(false)} />
          <div className="pulse-radio-modal">
            <div className="pulse-radio-modal-header">
              <h3>Channel Settings</h3>
              <button type="button" onClick={() => setShowChannelSettings(false)} title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="pulse-radio-settings-content">
              <div className="pulse-radio-settings-hero">
                <div className="pulse-radio-settings-icon">
                  <Radio className="w-8 h-8" />
                </div>
                <div>
                  {editingChannel ? (
                    <div className="pulse-radio-inline-edit-fields">
                      <input
                        type="text"
                        value={editChannelName}
                        onChange={(e) => setEditChannelName(e.target.value)}
                        placeholder="Channel name"
                        className="pulse-radio-inline-input"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editChannelDescription}
                        onChange={(e) => setEditChannelDescription(e.target.value)}
                        placeholder="Channel description"
                        className="pulse-radio-inline-input"
                      />
                      <div className="pulse-radio-inline-edit-actions">
                        <button
                          type="button"
                          className="pulse-radio-inline-save"
                          onClick={async () => {
                            if (!editChannelName.trim()) {
                              toast.error('Channel name cannot be empty');
                              return;
                            }
                            try {
                              const { error } = await supabase
                                .from('pulse_channels')
                                .update({ name: editChannelName.trim(), description: editChannelDescription.trim() })
                                .eq('id', selectedChannel.id);
                              if (error) throw error;
                              setChannels(channels.map(ch =>
                                ch.id === selectedChannel.id
                                  ? { ...ch, name: editChannelName.trim(), description: editChannelDescription.trim() }
                                  : ch
                              ));
                              setSelectedChannel({ ...selectedChannel, name: editChannelName.trim(), description: editChannelDescription.trim() });
                              setEditingChannel(false);
                              toast.success('Channel updated');
                            } catch (err) {
                              console.error('Failed to update channel:', err);
                              toast.error('Failed to update channel');
                            }
                          }}
                        >
                          <Check className="w-4 h-4" /> Save
                        </button>
                        <button
                          type="button"
                          className="pulse-radio-inline-cancel"
                          onClick={() => setEditingChannel(false)}
                        >
                          <X className="w-4 h-4" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h4>{selectedChannel.name}</h4>
                      <span>{selectedChannel.subscriberCount} subscribers</span>
                    </>
                  )}
                </div>
              </div>

              <div className="pulse-radio-settings-section">
                <h5>Broadcast Notifications</h5>
                <button
                  type="button"
                  onClick={() => {
                    setShowChannelSettings(false);
                    setShowNotifyUsers(true);
                  }}
                  className="pulse-radio-settings-option"
                >
                  <div className="pulse-radio-option-icon">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div className="pulse-radio-option-info">
                    <p>Notify Users</p>
                    <span>Select who gets notified</span>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="pulse-radio-settings-section">
                <h5>Actions</h5>
                <div className="pulse-radio-settings-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setEditChannelName(selectedChannel.name);
                      setEditChannelDescription(selectedChannel.description || '');
                      setEditingChannel(true);
                    }}
                  >
                    <Edit3 className="w-5 h-5" /> Edit Channel
                  </button>
                  <button
                    type="button"
                    onClick={() => toast('Subscriber management coming soon', { icon: '\u2139\uFE0F' })}
                  >
                    <Users className="w-5 h-5" /> Manage Subscribers
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={async () => {
                      const confirmed = window.confirm(`Delete channel "${selectedChannel.name}"? This cannot be undone.`);
                      if (!confirmed) return;
                      try {
                        const { error } = await supabase
                          .from('pulse_channels')
                          .delete()
                          .eq('id', selectedChannel.id);
                        if (error) throw error;
                        setChannels(channels.filter(ch => ch.id !== selectedChannel.id));
                        setSelectedChannel(null);
                        setBroadcasts([]);
                        setShowChannelSettings(false);
                        toast.success('Channel deleted');
                      } catch (err) {
                        console.error('Failed to delete channel:', err);
                        toast.error('Failed to delete channel');
                      }
                    }}
                  >
                    <Trash2 className="w-5 h-5" /> Delete Channel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notify Users Modal */}
      {showNotifyUsers && (
        <div className="pulse-radio-modal-overlay">
          <div className="pulse-radio-modal-backdrop" onClick={() => setShowNotifyUsers(false)} />
          <div className="pulse-radio-modal">
            <div className="pulse-radio-modal-header">
              <h3>Notify Users</h3>
              <button type="button" onClick={() => setShowNotifyUsers(false)} title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="pulse-radio-modal-desc">Select users to notify when you publish a broadcast.</p>

            <div className="pulse-radio-user-list">
              {pulseUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    if (selectedNotifyUsers.includes(user.id)) {
                      setSelectedNotifyUsers(selectedNotifyUsers.filter(id => id !== user.id));
                    } else {
                      setSelectedNotifyUsers([...selectedNotifyUsers, user.id]);
                    }
                  }}
                  className={`pulse-radio-user ${selectedNotifyUsers.includes(user.id) ? 'selected' : ''}`}
                >
                  <div className="pulse-radio-user-avatar" style={{ backgroundColor: user.avatarColor || MODE_COLOR }}>
                    {user.displayName?.charAt(0) || '?'}
                  </div>
                  <div className="pulse-radio-user-info">
                    <p>{user.displayName}</p>
                    {user.handle && <span>@{user.handle}</span>}
                  </div>
                  {selectedNotifyUsers.includes(user.id) && <Check className="w-5 h-5" />}
                </button>
              ))}
              {pulseUsers.length === 0 && (
                <p className="pulse-radio-no-users">No users found</p>
              )}
            </div>

            <div className="pulse-radio-modal-actions">
              <button type="button" onClick={() => setShowNotifyUsers(false)} className="pulse-radio-cancel-btn">
                Cancel
              </button>
              <button type="button" onClick={() => setShowNotifyUsers(false)} className="pulse-radio-submit-btn">
                Save ({selectedNotifyUsers.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Discussion Room Modal */}
      {activeBroadcastRoom && (
        <div className="pulse-radio-modal-overlay">
          <div className="pulse-radio-modal-backdrop" onClick={() => setActiveBroadcastRoom(null)} />
          <div className="pulse-radio-modal pulse-radio-discussion-modal">
            <div className="pulse-radio-modal-header">
              <div className="pulse-radio-discussion-icon">
                <Radio className="w-6 h-6" />
              </div>
              <div className="pulse-radio-discussion-title">
                <h3>{activeBroadcastRoom.title}</h3>
                <span>Discussion Room</span>
              </div>
              <button type="button" onClick={() => setActiveBroadcastRoom(null)} title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="pulse-radio-discussion-player">
              <button
                type="button"
                onClick={() => handlePlayBroadcast(activeBroadcastRoom)}
                className={`pulse-radio-mini-play ${isBroadcastPlaying(activeBroadcastRoom.id) ? 'playing' : ''}`}
              >
                {isBroadcastPlaying(activeBroadcastRoom.id) ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>
              <div>
                <p>Original Broadcast</p>
                <span>{formatDuration(activeBroadcastRoom.duration)}</span>
              </div>
            </div>

            {recordingState === 'preview' && recordingData ? (
              <div className="pulse-radio-preview">
                <RecordingPreview
                  recordingData={recordingData}
                  onSend={handleSendDiscussionResponse}
                  onCancel={() => {
                    cancelRecording();
                  }}
                  onRetry={() => {
                    cancelRecording();
                    setTimeout(() => startRecording(), 100);
                  }}
                  isDarkMode={isDarkMode}
                  modeColor={MODE_COLOR}
                />
              </div>
            ) : (
              /* The in-pane record button is retired (Tier 2: the FloatingMic
                 + StudioFooter RECORDING surface drive the response capture). */
              <div className="pulse-radio-discussion-content">
                <MessageSquare className="w-12 h-12" />
                <p>Join the Discussion</p>
                <span>Tap the mic to record a voice response</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phase 2: Selection Toolbar */}
      {isSelectionMode && (
        <VoxSelectToolbar
          selectedItems={selectedItems}
          selectionCount={selectionCount}
          totalDuration={getTotalDuration()}
          onSelectAll={() => {
            const allItems: VoxSelectionItem[] = broadcasts.map(b => ({
              id: b.id,
              type: 'audio' as const,
              url: b.audioUrl || '',
              duration: b.duration,
              timestamp: b.publishedAt,
              sender: 'other' as const,
              transcript: b.transcript,
              mode: 'pulse_radio' as const,
              contactId: selectedChannel?.id,
              contactName: selectedChannel?.name,
            }));
            selectAll(allItems);
          }}
          onDeselectAll={deselectAll}
          onExitSelection={exitSelectionMode}
          contactName={selectedChannel?.name || 'Channel'}
          isDarkMode={isDarkMode}
          accentColor="#f43f5e"
          allSelected={selectionCount === broadcasts.length && broadcasts.length > 0}
        />
      )}

      {/* Phase 5: AI Enhancement Modals */}
      {conversationSummary && showSummary && (
        <div className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <MessageAIPanel
              summary={conversationSummary}
              isDarkMode={isDarkMode}
              onClose={() => setShowSummary(false)}
            />
          </div>
        </div>
      )}

      {smartReplies.length > 0 && (
        <VoxSmartReplies
          replies={smartReplies}
          onSelectReply={(reply) => {
            // Use the reply - could set it as broadcastTitle or copy to clipboard
            setBroadcastTitle(reply);
            setSmartReplies([]);
            toast.success('Reply suggestion applied');
          }}
          onClose={() => setSmartReplies([])}
          isDarkMode={isDarkMode}
          accentColor="#f43f5e"
        />
      )}

      {/* Phase 6: Keyboard Shortcuts Help Modal */}
      <VoxKeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
        isDarkMode={isDarkMode}
      />

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

export default PulseRadio;
