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
  AlignLeft,
  BellRing,
  Trash2,
  Edit3,
  CheckCheck,
  Tower,
  MoreVertical,
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import RecordingPreview from './RecordingPreview';
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
} from './index';
import {
  summarizeConversation,
  ConversationSummary,
} from '../../services/relay/relayAIService';

// Phase 6: Final Polish
import { useRelayKeyboardShortcuts } from '../../hooks/useRelayKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from './VoxKeyboardShortcutsHelp';
import { PlaybackSpeedControl } from './PlaybackSpeedControl';
import { useRelayStudio, useRelayModeRecorder, StudioCard, StudioMasthead, Waveform } from './studio';
import { VoxEmptyState } from './VoxEmptyState';
import { getEmptyStateConfig } from './voxEmptyStates';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';
import { useWorkspaceData, useWorkspacePermissions } from '../../contexts/WorkspaceContext';
import { navigateToTeamInvite } from '../../utils/inviteTeammateNavigation';

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
  const [discussionResponses, setDiscussionResponses] = useState<Broadcast[]>([]);
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

  // Phase 6: Final Polish States
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Message Menu & Download States
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadItem, setDownloadItem] = useState<VoxSelectionItem | null>(null);
  const emptyConfig = getEmptyStateConfig('pulse_radio');

  // AC3: a broadcast with no audience is a solo dead-end — route still-solo
  // admins toward team activation. Member-count proxy + canManageMembers gate.
  const { currentWorkspace, members } = useWorkspaceData();
  const { canManageMembers } = useWorkspacePermissions();
  const inviteSecondaryAction =
    members.length < 2 && canManageMembers
      ? {
          label: 'Invite a teammate',
          onClick: () =>
            navigateToTeamInvite({ workspaceId: currentWorkspace?.id ?? null, source: 'relay-broadcast-empty' }),
        }
      : undefined;


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

    const wasLiked = likedBroadcasts.has(broadcastId);
    // Optimistic toggle — the heart fill is the feedback (no toast noise).
    setLikedBroadcasts((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(broadcastId);
      else next.add(broadcastId);
      return next;
    });

    const result = await voxModeService.toggleBroadcastLike(broadcastId);
    if (result === null) {
      // Persist failed — roll the optimistic toggle back.
      setLikedBroadcasts((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(broadcastId);
        else next.delete(broadcastId);
        return next;
      });
      toast.error('Could not update like');
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
      [], // No special notifications for responses
      activeBroadcastRoom.id, // parent => threaded discussion response
    );

    if (response) {
      // Refresh the thread — responses surface in the room, not the channel feed.
      const refreshed = await voxModeService.getBroadcastResponses(activeBroadcastRoom.id);
      setDiscussionResponses(refreshed);

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
      // Keep the room open so the user sees their response land in the thread.
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

  // Load the discussion thread when a broadcast room opens.
  useEffect(() => {
    if (!activeBroadcastRoom) { setDiscussionResponses([]); return; }
    let cancelled = false;
    voxModeService.getBroadcastResponses(activeBroadcastRoom.id).then((r) => {
      if (!cancelled) setDiscussionResponses(r);
    });
    return () => { cancelled = true; };
  }, [activeBroadcastRoom]);

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
    // Hydrate the current user's like state so hearts reflect reality on load.
    const liked = await voxModeService.getLikedBroadcastIds(data.map((b) => b.id));
    setLikedBroadcasts(liked);
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
        // Summarize the actual voice transcript, not just the title — the
        // transcript is the content; titles alone gave shallow summaries.
        transcription: b.transcript || b.title || 'Untitled broadcast',
        sender: 'other' as const,
        senderName: b.authorName || 'Unknown',
        timestamp: b.publishedAt,
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

  // Featured = the broadcast currently playing in this channel, else the
  // latest; the rest fall into the related grid (PathCBroadcast hero + grid).
  const featuredBroadcast = broadcasts.find((b) => isBroadcastActive(b.id)) ?? broadcasts[0];
  const relatedBroadcasts = broadcasts.filter((b) => b.id !== featuredBroadcast?.id);

  return (
    <div className={`pulse-radio ${isDarkMode ? 'dark' : 'light'} ${studio.singlePane ? 'pulse-radio--single-pane' : ''}`}>
      {/* Audio playback is owned by the shared RelayStudioProvider (single
          <audio>) — no local element here. */}

      <div className="pulse-radio-body">
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
                {studio.singlePane && (
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--pulse-ink-2)] hover:text-[var(--pulse-ink)] transition"
                    aria-label="Back to channels"
                    title="Back to channels"
                  >
                    <ChevronLeft className="w-4 h-4" /> Channels
                  </button>
                )}
                <StudioMasthead
                  tone="rose"
                  eyebrowIcon={<Radio className="w-3 h-3" />}
                  eyebrow={featuredBroadcast
                    ? `Broadcast · ${new Date(featuredBroadcast.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                    : `Broadcast · ${selectedChannel.name}`}
                  title={featuredBroadcast?.title || selectedChannel.name}
                  subtitle={featuredBroadcast
                    ? `${selectedChannel.name} · ${featuredBroadcast.listenCount} listeners · ${formatDuration(featuredBroadcast.duration)}`
                    : selectedChannel.description}
                  right={
                    <>
                      {broadcasts.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={handleSummarizeChannel}
                            disabled={isSummarizing}
                            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-[0.12em] text-rose-700 dark:text-rose-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40 transition"
                            title="AI summarize"
                          >
                            {isSummarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlignLeft className="w-3 h-3" />}
                            <span className="hidden sm:inline">Summarize</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => (isSelectionMode ? exitSelectionMode() : enterSelectionMode())}
                            title={isSelectionMode ? 'Exit selection' : 'Select broadcasts'}
                            aria-label={isSelectionMode ? 'Exit selection' : 'Select broadcasts'}
                            className={`p-2 rounded-md transition ${
                              isSelectionMode
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                            }`}
                          >
                            <CheckCheck className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowChannelSettings(true)}
                        title="Channel settings"
                        aria-label="Channel settings"
                        className="p-2 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </>
                  }
                />

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

              {/* Featured broadcast hero + related grid (PathCBroadcast). The
                  featured player carries playback + the AI summary +
                  like/discuss/share; the rest become a compact related grid
                  (click to play, hover More for archive/download/delete, or
                  toggle in selection mode). */}
              {broadcasts.length === 0 ? (
                <div className="pulse-radio-broadcasts">
                  <VoxEmptyState
                    {...emptyConfig}
                    eyebrow="Broadcast"
                    isDarkMode={isDarkMode}
                    action={{
                      label: 'Start Broadcasting',
                      onClick: () => {
                        if (recordingState === 'idle') startRecording();
                      },
                    }}
                    secondaryAction={inviteSecondaryAction}
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto px-6 pt-1 pb-12">
                  {featuredBroadcast && (() => {
                    const fb = featuredBroadcast;
                    const isLiked = likedBroadcasts.has(fb.id);
                    const active = isBroadcastActive(fb.id);
                    const playing = isBroadcastPlaying(fb.id);
                    const curSec = active ? Math.floor(studio.progress * fb.duration) : 0;
                    const cur = `${Math.floor(curSec / 60)}:${String(curSec % 60).padStart(2, '0')}`;
                    return (
                      <StudioCard active={active} className="p-5">
                        <div className="flex items-center gap-4 mb-4">
                          <button
                            type="button"
                            onClick={() => handlePlayBroadcast(fb)}
                            className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition ${
                              active
                                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-rose-500 hover:text-white'
                            }`}
                            aria-label={playing ? 'Pause' : 'Play'}
                          >
                            {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span style={{ color: active ? 'var(--pulse-rose)' : 'var(--pulse-ink-2)', display: 'block' }}>
                              <Waveform seed={fb.id} count={120} height={48} tall progress={active ? studio.progress : 0} />
                            </span>
                            <div className="flex items-center justify-between mt-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                              <span>{cur}</span>
                              <span>{formatDuration(fb.duration)}</span>
                            </div>
                          </div>
                        </div>
                        {fb.transcript && (
                          <div className="rounded-lg p-4" style={{ background: 'var(--pulse-coral-bg-12)' }}>
                            <AIProvenanceChip vendor="WHISPER" type="TRANSCRIPT" />
                            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed mt-2">
                              {fb.transcript}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-4 flex-wrap">
                          <PlaybackSpeedControl
                            speed={studio.playbackRate}
                            onSpeedChange={studio.setPlaybackRate}
                            isDarkMode={isDarkMode}
                            compact
                          />
                          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            <Headphones className="w-3.5 h-3.5" />
                            {fb.listenCount}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleLikeBroadcast(fb.id, e)}
                            className={`inline-flex items-center gap-1.5 text-[12px] transition ${
                              isLiked ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                            Like
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveBroadcastRoom(fb)}
                            className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Discuss
                          </button>
                          <button
                            type="button"
                            onClick={() => { navigator.clipboard.writeText(fb.audioUrl); toast.success('Link copied!'); }}
                            className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            Share
                          </button>
                        </div>
                      </StudioCard>
                    );
                  })()}

                  {relatedBroadcasts.length > 0 && (
                    <div className="mt-6">
                      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400 mb-3">
                        Related broadcasts
                      </div>
                      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                        {relatedBroadcasts.map((b) => {
                          const sel = isSelected(b.id);
                          return (
                            <StudioCard
                              key={b.id}
                              active={sel}
                              onClick={() => {
                                if (isSelectionMode) {
                                  toggleSelection({
                                    id: b.id,
                                    type: 'audio',
                                    url: b.audioUrl || '',
                                    duration: b.duration,
                                    timestamp: b.publishedAt,
                                    sender: 'other',
                                    transcript: b.transcript,
                                    mode: 'pulse_radio',
                                    contactId: selectedChannel?.id,
                                    contactName: selectedChannel?.name,
                                  } as VoxSelectionItem);
                                } else {
                                  handlePlayBroadcast(b);
                                }
                              }}
                              className="group relative p-3 cursor-pointer"
                            >
                              <div className="flex items-center gap-2 mb-1 pr-6">
                                <Radio className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{b.title}</span>
                                {b.episodeNumber ? (
                                  <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-zinc-400 shrink-0">EP {b.episodeNumber}</span>
                                ) : null}
                              </div>
                              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {selectedChannel.name} · {b.listenCount} · {formatDuration(b.duration)}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mt-1">
                                {new Date(b.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </div>
                              {!isSelectionMode && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setMenuAnchorRect(rect);
                                    setShowMessageMenu(showMessageMenu === b.id ? null : b.id);
                                  }}
                                  className="absolute right-2 top-2 w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                                  aria-label="More actions"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {showMessageMenu === b.id && menuAnchorRect && (
                                <VoxMessageMenu
                                  isDarkMode={isDarkMode}
                                  accentColor="#f43f5e"
                                  anchorRect={menuAnchorRect}
                                  onArchive={() => handleArchiveBroadcast(b)}
                                  onDownload={() => handleDownloadBroadcast(b)}
                                  onDelete={() => {
                                    setShowMessageMenu(null);
                                    toast((t) => (
                                      <span className="flex flex-col gap-2 min-w-[14rem]">
                                        <span className="text-sm">Delete this broadcast forever? This can't be undone.</span>
                                        <div className="flex items-center gap-2 justify-end">
                                          <button
                                            type="button"
                                            onClick={() => toast.dismiss(t.id)}
                                            className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              toast.dismiss(t.id);
                                              const snapshot = broadcasts;
                                              setBroadcasts((cur) => cur.filter((x) => x.id !== b.id));
                                              const ok = await voxModeService.deleteBroadcast(b.id);
                                              if (ok) {
                                                toast.success('Broadcast deleted');
                                              } else {
                                                setBroadcasts(snapshot);
                                                toast.error("Couldn't delete — you may not own this broadcast.");
                                              }
                                            }}
                                            className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded bg-rose-500 hover:bg-rose-600 text-white"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </span>
                                    ), { duration: 8000 });
                                  }}
                                  onClose={() => setShowMessageMenu(null)}
                                />
                              )}
                            </StudioCard>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
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

            {/* Discussion thread — the voice responses to this broadcast. */}
            {discussionResponses.length > 0 && (
              <div className="mt-3 space-y-2 max-h-52 overflow-y-auto">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400 px-1">
                  {discussionResponses.length} {discussionResponses.length === 1 ? 'response' : 'responses'}
                </div>
                {discussionResponses.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handlePlayBroadcast(r)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
                  >
                    <span className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                      {isBroadcastPlaying(r.id) ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 truncate">{r.authorName}</p>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {formatDuration(r.duration)} · {new Date(r.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

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
