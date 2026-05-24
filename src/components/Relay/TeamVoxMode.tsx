import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Mic,
  Play,
  Pause,
  Plus,
  Hash,
  Volume2,
  Bell,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Pin,
  CheckSquare,
  AtSign,
  Sparkles,
  Smile,
  X,
  UserPlus,
  Megaphone,
  Calendar,
  Menu,
  Briefcase,
  Check,
  Download,
  Archive,
  MoreVertical,
  List,
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import RecordingPreview from './RecordingPreview';
import RecordButton from './RecordButton';
import VoxModeToolbar from './VoxModeToolbar';
import VoxRecordArea from './VoxRecordArea';
import RelayPanelShell from './RelayPanelShell';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { voxModeService } from '../../services/relay/voxModeService';
// analyticsCollector loaded dynamically to avoid svc-crm-analytics chunk TDZ
import { type VoxWorkspace, type VoxTeamChannel, type TeamVoxMessage } from '../../services/relay/voxModeTypes';
import toast from 'react-hot-toast';
import './Relay.css';

// Phase 2: Selection Mode
import { useVoxSelection, VoxSelectionItem } from '../../hooks/useVoxSelection';
import { VoxSelectToolbar } from './VoxSelectToolbar';
import VoxMessageMenu from './VoxMessageMenu';
import VoxDownloadModal from './VoxDownloadModal';
import { archiveRelayConversation, archiveMeetingNotes } from '../../services/relay/relayArchiveService';

// Phase 5: AI Enhancements
import { MessageAIPanel, VoxSmartReplies } from './index';
import { summarizeConversation, generateSmartReplies, generateMeetingNotes, generateAutoChapters } from '../../services/relay/relayAIService';
import type { ConversationSummary, SmartReply, MeetingNotes, Chapter } from '../../services/relay/relayAIService';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';

// Phase 6: Final Polish
import { useRelayKeyboardShortcuts } from '../../hooks/useRelayKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from './VoxKeyboardShortcutsHelp';
import { PlaybackSpeedControl } from './PlaybackSpeedControl';
import { useRelayStudio, useRelayModeRecorder } from './studio';
import { VoxEmptyState } from './VoxEmptyState';
import { getEmptyStateConfig } from './voxEmptyStates';

// Relay brand accent (rose-500) — per-mode colors retired in 2.1d.1.
const MODE_COLOR = '#f43f5e';

interface TeamVoxModeProps {
  apiKey?: string;
  onBack: () => void;
  isDarkMode?: boolean;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  general: <Hash className="w-4 h-4" />,
  standup: <Calendar className="w-4 h-4" />,
  announcement: <Megaphone className="w-4 h-4" />,
  project: <CheckSquare className="w-4 h-4" />,
};

const TeamVoxMode: React.FC<TeamVoxModeProps> = ({
  apiKey,
  onBack,
  isDarkMode = false,
}) => {
  const [workspaces, setWorkspaces] = useState<VoxWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<VoxWorkspace | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<VoxTeamChannel | null>(null);
  const [messages, setMessages] = useState<TeamVoxMessage[]>([]);
  // Playback flows through the shared Voice Studio transport (single <audio>,
  // persistent footer). Active-row state is derived from studio.nowPlaying /
  // studio.isPlaying / studio.progress rather than local state.
  const studio = useRelayStudio();
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDesc, setWorkspaceDesc] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'general' | 'standup' | 'announcement' | 'project'>('general');
  const [messageType, setMessageType] = useState<'normal' | 'standup' | 'announcement'>('normal');
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [mentionSearchQuery, setMentionSearchQuery] = useState('');
  const [pulseContacts, setPulseContacts] = useState<any[]>([]);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadItem, setDownloadItem] = useState<VoxSelectionItem | null>(null);

  // Y3: Notification preference state (persisted to localStorage)
  const [notificationPref, setNotificationPref] = useState<'all' | 'mentions' | 'mute'>('all');

  // Y4: Channel settings edit state
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelDesc, setEditChannelDesc] = useState('');

  // Y5: Reaction picker state
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

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
  const [meetingNotes, setMeetingNotes] = useState<MeetingNotes | null>(null);
  const [isGeneratingMeetingNotes, setIsGeneratingMeetingNotes] = useState(false);
  const [activeChapters, setActiveChapters] = useState<Chapter[]>([]);
  const [chapterMessageId, setChapterMessageId] = useState<string | null>(null);

  // Phase 6: Final Polish States
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const emptyConfig = getEmptyStateConfig('team_vox');

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

  // Tier 2 (unify trigger): the studio shell's FloatingMic + footer RECORDING
  // surface drive this channel's capture. Enabled only when a channel is
  // selected (the send target); the in-pane record button is retired.
  useRelayModeRecorder({
    start: startRecording,
    stop: stopRecording,
    cancel: cancelRecording,
    recording: recordingState === 'recording',
    enabled: !!selectedChannel,
  });

  // Phase 5: AI Handler Functions (defined before keyboard shortcuts to avoid TDZ)
  const handleSummarizeChannel = async () => {
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
        toast.success('Channel summarized!');
      } else {
        toast.error('Failed to generate summary');
      }
    } catch (error) {
      console.error('Summarization error:', error);
      toast.error('Failed to generate summary');
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
        toast.success('Smart replies generated!');
      } else {
        toast.error('Failed to generate smart replies');
      }
    } catch (error) {
      console.error('Smart replies error:', error);
      toast.error('Failed to generate smart replies');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleGenerateChapters = async (message: TeamVoxMessage) => {
    if (!message.transcript) {
      toast.error('No transcription available for chapters');
      return;
    }
    if (message.duration < 30) {
      toast.error('Message too short for chapters (need 30+ seconds)');
      return;
    }
    try {
      toast.loading('Generating chapters...', { id: 'tv-chapters' });
      const chapters = await generateAutoChapters(apiKey || '', message.transcript, message.duration);
      if (chapters.length > 0) {
        setActiveChapters(chapters);
        setChapterMessageId(message.id);
        toast.success(`${chapters.length} chapters generated!`, { id: 'tv-chapters' });
      } else {
        toast.error('Could not generate chapters for this message', { id: 'tv-chapters' });
      }
    } catch {
      toast.error('Failed to generate chapters', { id: 'tv-chapters' });
    }
  };

  const handleGenerateMeetingNotes = async () => {
    if (messages.length < 2) {
      toast.error('Need at least 2 messages to generate meeting notes');
      return;
    }

    if (!apiKey) {
      toast.error('Gemini API key not configured');
      return;
    }

    setIsGeneratingMeetingNotes(true);
    try {
      const messageData = messages.map(msg => ({
        id: msg.id,
        transcription: msg.transcript || '',
        sender: (msg.senderId === voxModeService.getUserId() ? 'me' : 'other') as 'me' | 'other',
        senderName: msg.senderName,
        timestamp: msg.createdAt,
        duration: msg.duration,
      }));

      const notes = await generateMeetingNotes(
        apiKey,
        messageData,
        selectedChannel ? `#${selectedChannel.name}` : 'Team Meeting'
      );
      if (notes) {
        setMeetingNotes(notes);
        toast.success('Meeting notes generated!');
      } else {
        toast.error('AI meeting notes unavailable. Try again later.');
      }
    } catch (error: any) {
      console.error('Meeting notes generation error:', error);
      const msg = error?.message || '';
      if (msg.includes('API key') || msg.includes('API_KEY')) {
        toast.error('AI features require API configuration');
      } else {
        toast.error('AI meeting notes unavailable (beta)');
      }
    } finally {
      setIsGeneratingMeetingNotes(false);
    }
  };

  const handleSelectAllMessages = () => {
    const allItems: VoxSelectionItem[] = messages.map(msg => ({
      id: msg.id,
      type: 'audio' as const,
      url: msg.audioUrl,
      duration: msg.duration,
      timestamp: msg.createdAt,
      sender: msg.senderId === voxModeService.getUserId() ? 'me' : 'other',
      transcript: msg.transcript,
      mode: 'team_vox' as const,
      contactId: selectedChannel?.id,
      contactName: selectedChannel?.name,
    }));
    selectAll(allItems);
  };

  // Handle sending the recording
  const handleSendRecording = async () => {
    if (!recordingData) {
      console.error('Cannot send: no recording data');
      return;
    }
    if (!selectedWorkspace) {
      console.error('Cannot send: no workspace selected');
      return;
    }
    if (!selectedChannel) {
      console.error('Cannot send: no channel selected');
      return;
    }

    const message = await voxModeService.uploadAndSendTeamVoxMessage(
      selectedChannel.id,
      selectedWorkspace.id,
      recordingData.blob,
      recordingData.duration,
      undefined,
      messageType,
      selectedMentions
    );

    if (message) {
      setMessages(prev => [...prev, message]);

      import('../../services/analyticsCollector').then(({ default: ac }) => {
        ac.trackMessageEvent({
          id: message.id,
          channel: 'voxer',
          contactIdentifier: selectedChannel.id,
          contactName: `#${selectedChannel.name}`,
          isSent: true,
          timestamp: new Date(),
          content: `[Team Vox - ${messageType}]`,
          duration: recordingData.duration,
          messageType: 'team_vox'
        }).catch(err => console.error('Analytics tracking failed:', err));
      }).catch(() => {});
    }

    setSelectedMentions([]);
    sendRecording();
  };

  // Toggle recording
  const handleRecordToggle = () => {
    if (recordingState === 'recording') {
      stopRecording();
    } else if (recordingState === 'idle') {
      startRecording();
    }
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
      if (meetingNotes) { setMeetingNotes(null); return; }
      if (showSummary) { setShowSummary(false); return; }
      if (showSmartReplies) { setShowSmartReplies(false); return; }
      if (showDownloadModal) { setShowDownloadModal(false); return; }
      if (showMentionPicker) { setShowMentionPicker(false); return; }
      if (showAddMember) { setShowAddMember(false); return; }
      if (showNotificationSettings) { setShowNotificationSettings(false); return; }
      if (showChannelSettings) { setShowChannelSettings(false); return; }
      // Priority 2: discard active recording
      if (recordingState === 'recording') { stopRecording(); return; }
      // Priority 3: exit selection mode
      if (isSelectionMode) { exitSelectionMode(); return; }
      // Priority 4: close channel → go back
      if (selectedChannel) { setSelectedChannel(null); return; }
      onBack();
    },
    onGoBack: () => {
      if (selectedChannel) setSelectedChannel(null);
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
            await archiveRelayConversation(Array.from(selectedItems), selectedChannel?.name || 'Team Vox');
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
    onSummarize: handleSummarizeChannel,
    onShowHelp: () => setShowShortcutsHelp(true),
  }, true);

  useEffect(() => {
    loadWorkspaces();
    loadPulseContacts();
  }, []);

  useEffect(() => {
    if (selectedChannel) {
      loadMessages();
      // Y3: Load persisted notification preference for this channel
      try {
        const stored = localStorage.getItem(`vox_team_notif_${selectedChannel.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setNotificationPref(parsed.pref || 'all');
        } else {
          setNotificationPref('all');
        }
      } catch {
        setNotificationPref('all');
      }
    }
  }, [selectedChannel]);

  // Y4: Populate channel settings edit fields when modal opens
  useEffect(() => {
    if (showChannelSettings && selectedChannel) {
      setEditChannelName(selectedChannel.name);
      setEditChannelDesc(selectedChannel.description || '');
    }
  }, [showChannelSettings, selectedChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close workspace dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(event.target as Node)) {
        setShowWorkspaceDropdown(false);
      }
    };

    if (showWorkspaceDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showWorkspaceDropdown]);

  const loadMessages = async () => {
    if (!selectedChannel) return;
    const data = await voxModeService.getChannelMessages(selectedChannel.id);
    setMessages(data);
  };

  const loadPulseContacts = async () => {
    const pulseUsers = await voxModeService.getPulseUsersAsContacts();
    setPulseContacts(pulseUsers);
  };

  const loadWorkspaces = async () => {
    const data = await voxModeService.getMyWorkspaces();
    setWorkspaces(data);
    if (data.length > 0) {
      setSelectedWorkspace(data[0]);
      setExpandedWorkspaces(new Set([data[0].id]));
      if (data[0].channels.length > 0) {
        setSelectedChannel(data[0].channels[0]);
      }
    }
  };

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) return;

    const workspace = await voxModeService.createWorkspace(workspaceName, workspaceDesc);
    if (workspace) {
      setWorkspaces([workspace, ...workspaces]);
      setSelectedWorkspace(workspace);
      setExpandedWorkspaces(new Set([...expandedWorkspaces, workspace.id]));
      setShowNewWorkspace(false);
      setWorkspaceName('');
      setWorkspaceDesc('');
    }
  };

  const handleCreateChannel = async () => {
    if (!channelName.trim() || !selectedWorkspace) return;

    const channel = await voxModeService.createTeamChannel(
      selectedWorkspace.id,
      channelName,
      '',
      channelType
    );

    if (channel) {
      const updatedWorkspace = {
        ...selectedWorkspace,
        channels: [...selectedWorkspace.channels, channel],
      };
      setWorkspaces(workspaces.map(w =>
        w.id === selectedWorkspace.id ? updatedWorkspace : w
      ));
      setSelectedWorkspace(updatedWorkspace);
      setSelectedChannel(channel);
      setShowNewChannel(false);
      setChannelName('');
    }
  };

  const handlePlayMessage = (message: TeamVoxMessage) => {
    if (studio.nowPlaying?.id === message.id) {
      studio.togglePlay();
      return;
    }
    studio.play({
      id: message.id,
      sender: message.senderName || 'Channel',
      dur: formatDuration(message.duration),
      type: 'CHANNEL',
      transcript: message.transcript ?? null,
      source: 'channel',
      audioUrl: message.audioUrl,
    });
  };

  const handleArchiveMessage = async (msg: any) => {
    const item: VoxSelectionItem = {
      id: msg.id,
      type: 'audio',
      url: msg.audioUrl || '',
      duration: msg.duration || 0,
      timestamp: msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt || Date.now()),
      mode: 'team_vox',
      contactName: msg.senderName,
      transcript: msg.transcript,
    };
    try {
      await archiveRelayConversation([item], msg.senderName || 'Team Vox');
      toast.success('Archived to Pulse Archives');
    } catch {
      toast.error('Failed to archive');
    }
  };

  const handleDownloadMessage = (msg: any) => {
    const item: VoxSelectionItem = {
      id: msg.id,
      type: 'audio',
      url: msg.audioUrl || '',
      duration: msg.duration || 0,
      timestamp: msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt || Date.now()),
      mode: 'team_vox',
      contactName: msg.senderName,
      transcript: msg.transcript,
    };
    setDownloadItem(item);
    setShowDownloadModal(true);
  };

  const toggleWorkspaceExpanded = (workspaceId: string) => {
    const newExpanded = new Set(expandedWorkspaces);
    if (newExpanded.has(workspaceId)) {
      newExpanded.delete(workspaceId);
    } else {
      newExpanded.add(workspaceId);
    }
    setExpandedWorkspaces(newExpanded);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) return 'Today';

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString();
  };

  const getMessageTypeStyle = (type: string) => {
    switch (type) {
      case 'standup':
        // Neutral hairline + faint surface; status is carried by the existing
        // "Standup" pill, so coral here was decorative wallpaper (coral budget).
        return isDarkMode
          ? 'border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)]'
          : 'border-zinc-200 bg-zinc-50';
      case 'announcement':
        // Full hairline + tinted bg; status carried by the existing "Announcement" pill.
        return isDarkMode
          ? 'border-red-500/40 bg-red-500/10'
          : 'border-red-500/40 bg-red-500/5';
      default:
        return '';
    }
  };

  // Theme classes for consistent styling
  const tc = {
    // Backgrounds (Pulse brand surfaces — translucent over true-black in dark)
    pageBg: isDarkMode
      ? 'bg-black'
      : 'bg-[#f8f8f8]',
    panelBg: isDarkMode
      ? 'bg-[rgba(255,255,255,0.03)]'
      : 'bg-white',
    cardBg: isDarkMode
      ? 'bg-[rgba(255,255,255,0.055)]'
      : 'bg-white',
    inputBg: isDarkMode
      ? 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.10)]'
      : 'bg-white border-[rgba(0,0,0,0.08)]',
    hoverBg: isDarkMode
      ? 'hover:bg-[rgba(255,255,255,0.055)]'
      : 'hover:bg-[#f2f2f2]',
    activeBg: isDarkMode
      ? 'bg-[rgba(244,63,94,0.12)]'
      : 'bg-[rgba(244,63,94,0.08)]',

    // Borders
    border: isDarkMode ? 'border-[rgba(255,255,255,0.06)]' : 'border-[rgba(0,0,0,0.08)]',
    borderAccent: 'border-[#f43f5e]',

    // Text
    text: isDarkMode ? 'text-[#fafafa]' : 'text-[#0f0f0f]',
    textSecondary: isDarkMode ? 'text-[#b4b4b8]' : 'text-[#52525b]',
    textMuted: 'text-[#6b7280]',
    textAccent: 'text-[#f43f5e]',

    // Buttons
    btnPrimary: 'btn-brand-primary',
    btnSecondary: isDarkMode
      ? 'bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.055)] text-[#fafafa] border border-[rgba(255,255,255,0.10)]'
      : 'bg-white hover:bg-[#f2f2f2] text-[#0f0f0f] border border-[rgba(0,0,0,0.08)]',
    btnGhost: isDarkMode
      ? 'hover:bg-[rgba(255,255,255,0.055)] text-[#b4b4b8] hover:text-[#fafafa]'
      : 'hover:bg-[#f2f2f2] text-[#52525b] hover:text-[#0f0f0f]',

    // Modal
    modalOverlay: 'pulse-modal-scrim',
    modalBg: isDarkMode
      ? 'bg-[#0a0a0a] border-[rgba(255,255,255,0.06)]'
      : 'bg-white border-[rgba(0,0,0,0.08)]',
  };

  // Render sidebar content (shared between mobile and desktop)
  const renderSidebarContent = () => (
    <div className="flex-1 overflow-y-auto py-2">
      {workspaces.map((workspace, wsIndex) => (
        <div key={workspace.id} className={wsIndex > 0 ? 'mt-4' : ''}>
          {/* Workspace Header */}
          <button
            onClick={() => toggleWorkspaceExpanded(workspace.id)}
            className={`w-full px-3 py-2.5 flex items-center gap-2 transition-all border-l ${
              selectedWorkspace?.id === workspace.id
                ? `border-[#f43f5e]/60 ${tc.activeBg}`
                : `border-transparent ${tc.hoverBg}`
            }`}
          >
            {expandedWorkspaces.has(workspace.id) ? (
              <ChevronDown className={`w-4 h-4 ${selectedWorkspace?.id === workspace.id ? 'text-[#f43f5e]' : tc.textMuted}`} />
            ) : (
              <ChevronRight className={`w-4 h-4 ${selectedWorkspace?.id === workspace.id ? 'text-[#f43f5e]' : tc.textMuted}`} />
            )}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm"
              style={{
                background: selectedWorkspace?.id === workspace.id
                  ? MODE_COLOR
                  : isDarkMode ? 'rgba(55,65,81,0.5)' : 'rgba(229,231,235,0.8)'
              }}
            >
              <span className={`text-xs font-bold ${selectedWorkspace?.id === workspace.id ? 'text-white' : tc.textSecondary}`}>
                {workspace.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <span className={`font-semibold text-sm truncate block ${selectedWorkspace?.id === workspace.id ? 'text-[#f43f5e]' : tc.text}`}>
                {workspace.name}
              </span>
              <span className={`text-xs ${tc.textMuted}`}>
                {workspace.channels.length} channel{workspace.channels.length !== 1 ? 's' : ''}
              </span>
            </div>
          </button>

          {/* Channels */}
          {expandedWorkspaces.has(workspace.id) && (
            <div className={`ml-8 border-l ${selectedWorkspace?.id === workspace.id ? 'border-[#f43f5e]/30' : tc.border} pl-3 space-y-0.5 mt-1`}>
              {workspace.channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => {
                    setSelectedWorkspace(workspace);
                    setSelectedChannel(channel);
                    setShowMobileSidebar(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center gap-2 rounded-r-lg text-sm transition-all group ${
                    selectedChannel?.id === channel.id
                      ? `${tc.activeBg} text-[#f43f5e] font-medium`
                      : `${tc.textSecondary} ${tc.hoverBg} hover:text-[#f43f5e]`
                  }`}
                  title={`${channel.type.charAt(0).toUpperCase() + channel.type.slice(1)} channel`}
                >
                  <span className={selectedChannel?.id === channel.id ? 'text-[#f43f5e]' : tc.textMuted}>
                    {CHANNEL_ICONS[channel.type]}
                  </span>
                  <span className="truncate flex-1 text-left">{channel.name}</span>
                  {channel.unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-[#f43f5e] text-white rounded-full font-semibold">
                      {channel.unreadCount}
                    </span>
                  )}
                  {channel.isPinned && (
                    <Pin className={`w-3 h-3 ${selectedChannel?.id === channel.id ? 'text-[#f43f5e]' : tc.textMuted}`} />
                  )}
                </button>
              ))}

              {/* Add Channel Button */}
              <button
                onClick={() => {
                  setSelectedWorkspace(workspace);
                  setShowNewChannel(true);
                }}
                className={`w-full px-3 py-2 flex items-center gap-2 rounded-r-lg text-sm ${tc.textMuted} hover:text-[#f43f5e] hover:bg-[#f43f5e]/10 transition-all mt-1`}
                title="Create a new channel in this workspace"
              >
                <Plus className="w-4 h-4" />
                <span className="font-medium">Add Channel</span>
              </button>
            </div>
          )}
        </div>
      ))}

      {workspaces.length === 0 && (
        <div className={`text-center py-12 ${tc.textMuted}`}>
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No workspaces yet</p>
          <p className="text-xs mt-1">Create one to get started</p>
        </div>
      )}
    </div>
  );

  // Playback active-state helpers — derived from the shared studio transport.
  const isMsgActive = (id: string) => studio.nowPlaying?.id === id;
  const isMsgPlaying = (id: string) => isMsgActive(id) && studio.isPlaying;

  return (
    <div className={`h-full flex flex-col ${tc.pageBg}`}>
      {/* Unified Mode Header */}
      <VoxModeToolbar
        onBack={onBack}
        modeIcon={<Users className="w-5 h-5" />}
        eyebrow={selectedWorkspace ? `CHANNEL · ${selectedWorkspace.name.toUpperCase()}` : 'CHANNELS'}
        modeTitle={selectedChannel?.name || 'Channels'}
        accentColor="#f43f5e"
        isDarkMode={isDarkMode}
        showAI={!!(selectedChannel)}
        onSummarize={selectedChannel ? handleSummarizeChannel : undefined}
        onSmartReplies={selectedChannel ? handleGenerateSmartReplies : undefined}
        onMeetingNotes={selectedChannel ? handleGenerateMeetingNotes : undefined}
        isSummarizing={isGeneratingAI}
        isGeneratingReplies={isGeneratingAI}
        isGeneratingNotes={isGeneratingMeetingNotes}
        hasContent={messages.length > 0}
        isSelectionMode={isSelectionMode}
        onToggleSelection={() => isSelectionMode ? exitSelectionMode() : enterSelectionMode()}
        onShowHelp={() => setShowShortcutsHelp(true)}
        customActions={[
          {
            icon: <Menu className="w-5 h-5" />,
            title: 'Show workspaces',
            onClick: () => setShowMobileSidebar(true),
          },
          {
            icon: <Plus className="w-4 h-4" />,
            title: 'New Workspace',
            label: 'New Workspace',
            onClick: () => setShowNewWorkspace(true),
          },
        ]}
      >
        {/* Workspace Selector (all viewports — mobile hamburger is hard to discover) */}
        {selectedWorkspace && (
          <div ref={workspaceDropdownRef} className="relative">
            <button
              onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${tc.btnSecondary} border hover:border-[#f43f5e]/50`}
              title="Switch workspace"
            >
              <Briefcase className="w-4 h-4" />
              <span className="max-w-[150px] truncate">{selectedWorkspace.name}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showWorkspaceDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Workspace Dropdown — anchor-positioned popover, shares modal border/scrim vocabulary minus the centered scrim */}
            {showWorkspaceDropdown && (
              <div className="absolute top-full right-0 mt-2 w-64 z-50">
                <div className={`rounded-xl border ${tc.modalBg} shadow-2xl overflow-hidden`}>
                  <div className={`px-4 py-3 border-b ${tc.border}`}>
                    <p className={`text-[11px] font-mono uppercase tracking-[0.1em] ${tc.textSecondary}`}>Switch workspace</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-2">
                    {workspaces.map((workspace) => (
                      <button
                        key={workspace.id}
                        onClick={() => {
                          setSelectedWorkspace(workspace);
                          setExpandedWorkspaces(new Set([workspace.id]));
                          if (workspace.channels.length > 0) {
                            setSelectedChannel(workspace.channels[0]);
                          } else {
                            setSelectedChannel(null);
                          }
                          setShowWorkspaceDropdown(false);
                        }}
                        className={`w-full px-4 py-3 flex items-center gap-3 transition-all ${
                          selectedWorkspace?.id === workspace.id
                            ? `${tc.activeBg} text-[#f43f5e]`
                            : `${tc.hoverBg} ${tc.text}`
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background: selectedWorkspace?.id === workspace.id
                              ? MODE_COLOR
                              : isDarkMode ? 'rgba(55,65,81,0.5)' : 'rgba(229,231,235,0.8)'
                          }}
                        >
                          <span className={`text-sm font-bold ${selectedWorkspace?.id === workspace.id ? 'text-white' : tc.textSecondary}`}>
                            {workspace.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className={`font-medium truncate ${selectedWorkspace?.id === workspace.id ? 'text-[#f43f5e]' : tc.text}`}>
                            {workspace.name}
                          </p>
                          <p className={`text-xs ${tc.textMuted} truncate`}>
                            {workspace.channels.length} channel{workspace.channels.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {selectedWorkspace?.id === workspace.id && (
                          <div className="w-2 h-2 rounded-full bg-[#f43f5e]" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className={`px-2 py-2 border-t ${tc.border}`}>
                    <button
                      onClick={() => {
                        setShowWorkspaceDropdown(false);
                        setShowNewWorkspace(true);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${tc.hoverBg} hover:text-[#f43f5e]`}
                    >
                      <Plus className="w-4 h-4" />
                      Create New Workspace
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </VoxModeToolbar>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {showMobileSidebar && (
          <div className="md:hidden fixed inset-0 z-40">
            <div
              className={tc.modalOverlay}
              onClick={() => setShowMobileSidebar(false)}
            />
            <div className={`absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] ${tc.panelBg} border-r ${tc.border} flex flex-col animate-slide-in`}>
              <div className={`p-4 border-b ${tc.border} flex items-center justify-between`}>
                <h2 className={`font-semibold ${tc.text}`}>Workspaces</h2>
                <button
                  onClick={() => setShowMobileSidebar(false)}
                  className={`p-2 rounded-lg ${tc.btnGhost}`}
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {renderSidebarContent()}
            </div>
          </div>
        )}

        {/* Desktop Sidebar */}
        <div className={`hidden md:flex w-64 shrink-0 border-r ${tc.border} flex-col ${tc.panelBg}`}>
          {renderSidebarContent()}
        </div>

        {/* Main Content — min-w-0 lets it shrink so the members rail (a
            shrink-0 sibling) isn't pushed past the overflow-hidden row edge. */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {selectedChannel ? (
            <>
              {/* Channel Header */}
              <div className={`px-4 md:px-6 py-3 md:py-4 border-b ${tc.border} ${tc.cardBg} flex items-center justify-between`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100/80'}`}>
                    {CHANNEL_ICONS[selectedChannel.type]}
                  </div>
                  <div className="min-w-0">
                    {/* Breadcrumb-style navigation */}
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-xs ${tc.textMuted} truncate max-w-[120px]`}>
                        {selectedWorkspace?.name}
                      </span>
                      <ChevronRight className={`w-3 h-3 ${tc.textMuted} shrink-0`} />
                      <h2 className={`text-base md:text-lg font-semibold ${tc.text} truncate`}>
                        {selectedChannel.name}
                      </h2>
                    </div>
                    <p className={`text-xs md:text-sm ${tc.textSecondary}`}>
                      {selectedChannel.memberIds.length || selectedWorkspace?.memberIds.length || 0} members
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <button
                    onClick={() => setShowAddMember(true)}
                    className={`p-2 rounded-xl ${tc.btnGhost} transition-all duration-200`}
                    aria-label="Add member"
                    title="Add team members to this channel"
                  >
                    <UserPlus className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  <button
                    onClick={() => setShowNotificationSettings(true)}
                    className={`p-2 rounded-xl ${tc.btnGhost} transition-all duration-200`}
                    aria-label="Notification settings"
                    title="Manage notification preferences"
                  >
                    <Bell className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  <button
                    onClick={() => setShowChannelSettings(true)}
                    className={`p-2 rounded-xl ${tc.btnGhost} transition-all duration-200`}
                    aria-label="Channel settings"
                    title="Channel settings and options"
                  >
                    <Settings className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {messages.length === 0 ? (
                  <VoxEmptyState
                    {...emptyConfig}
                    isDarkMode={isDarkMode}
                    action={{ label: 'Start Recording', onClick: () => { if (recordingState === 'idle') startRecording(); } }}
                  />
                ) : (
                  // TODO(impeccable phase 3 task 6 — RelayVoiceMessage migration):
                  // Migrate this Channel message render to <RelayVoiceMessage />
                  // from `./RelayVoiceMessage`. Surface slots needed:
                  // messageTypePill (already supported), audienceMeta (mentions),
                  // plus pending API additions: meeting-notes button slot and
                  // chapters trigger slot in footerExtras. Do this after the
                  // surface-migration API gap noted at the top of
                  // RelayVoiceMessage.tsx is filled.
                  <div className="space-y-4">
                    {messages.map((message, index) => {
                      const showDate = index === 0 ||
                        formatDate(message.createdAt) !== formatDate(messages[index - 1].createdAt);

                      return (
                        <React.Fragment key={message.id}>
                          {showDate && (
                            <div className="flex items-center gap-4 my-6">
                              <div className={`flex-1 h-px ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
                              <span className={`text-xs ${tc.textMuted} font-medium`}>
                                {formatDate(message.createdAt)}
                              </span>
                              <div className={`flex-1 h-px ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
                            </div>
                          )}

                          <div
                            className={`group rounded-xl p-4 ${tc.cardBg} border ${tc.border} ${getMessageTypeStyle(message.messageType)} relative transition-shadow`}
                            style={isMsgActive(message.id)
                              ? { boxShadow: '0 0 0 1px var(--pulse-rose), 0 8px 28px var(--pulse-rose-glow)', borderColor: 'transparent' }
                              : undefined}
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
                                    mode: 'team_vox' as const,
                                    contactId: selectedChannel?.id,
                                    contactName: selectedChannel?.name,
                                  };
                                  toggleSelection(selectionItem);
                                }}
                                className={`absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center transition-all shadow-lg hover:scale-110 active:scale-95 z-10 ${
                                  isSelected(message.id)
                                    ? 'bg-[#f43f5e] border-2 border-[#e11d48]'
                                    : 'bg-white dark:bg-gray-700 border-2 border-gray-400 dark:border-gray-500'
                                }`}
                                style={{
                                  boxShadow: isSelected(message.id)
                                    ? '0 4px 12px rgba(249, 115, 22, 0.4)'
                                    : '0 2px 8px rgba(0, 0, 0, 0.2)',
                                }}
                              >
                                {isSelected(message.id) && <Check className="w-5 h-5 text-white font-bold" />}
                              </button>
                            )}

                            <div className="flex items-start gap-3">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium shrink-0"
                                style={{ backgroundColor: MODE_COLOR }}
                              >
                                {message.senderName.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className={`font-semibold ${tc.text}`}>
                                    {message.senderName}
                                  </span>
                                  {message.messageType === 'standup' && (
                                    <span className="px-2 py-0.5 text-xs bg-[#f43f5e]/20 text-[#f43f5e] rounded-full">
                                      Standup
                                    </span>
                                  )}
                                  {message.messageType === 'announcement' && (
                                    <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-500 rounded-full">
                                      Announcement
                                    </span>
                                  )}
                                  <span className={`text-xs ${tc.textMuted}`}>
                                    {formatTime(message.createdAt)}
                                  </span>
                                </div>

                                {/* Audio Player */}
                                <div className="flex items-center gap-2 md:gap-3 mb-2">
                                  <button
                                    onClick={() => handlePlayMessage(message)}
                                    className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
                                    style={{
                                      background: isMsgPlaying(message.id)
                                        ? MODE_COLOR
                                        : isDarkMode ? 'rgba(55,65,81,0.5)' : 'rgba(229,231,235,0.8)',
                                      boxShadow: isMsgPlaying(message.id) ? `0 4px 12px ${MODE_COLOR}50` : 'none'
                                    }}
                                  >
                                    {isMsgPlaying(message.id) ? (
                                      <Pause className="w-4 h-4 text-white" />
                                    ) : (
                                      <Play className={`w-4 h-4 ml-0.5 ${isMsgPlaying(message.id) ? 'text-white' : tc.text}`} />
                                    )}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <VoxAudioVisualizer
                                      analyser={null}
                                      isActive={false}
                                      isPlaying={isMsgPlaying(message.id)}
                                      playbackProgress={isMsgActive(message.id) ? studio.progress : 0}
                                      mode="waveform"
                                      color={MODE_COLOR}
                                      height={32}
                                      isDarkMode={isDarkMode}
                                    />
                                  </div>
                                  {/* Phase 6: Playback Speed Control */}
                                  <PlaybackSpeedControl
                                    speed={studio.playbackRate}
                                    onSpeedChange={studio.setPlaybackRate}
                                    compact
                                    isDarkMode={isDarkMode}
                                  />
                                  <span className={`text-xs ${tc.textMuted} shrink-0`}>
                                    {formatDuration(message.duration)}
                                  </span>
                                </div>

                                {/* Transcript — labeled as machine-generated so the
                                    feed differentiates AI text from the sender's voice. */}
                                {message.transcript && (
                                  <div className="mb-2">
                                    <div className="mb-1">
                                      <AIProvenanceChip vendor="PULSE AI" type="TRANSCRIPT" />
                                    </div>
                                    <p className={`text-sm ${tc.textSecondary}`}>
                                      {message.transcript}
                                    </p>
                                  </div>
                                )}

                                {/* AI Chapters button — for transcribed messages >= 30s */}
                                {message.transcript && message.duration >= 30 && (
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateChapters(message)}
                                    className="mb-2 flex items-center gap-1 text-xs hover:underline"
                                    style={{ color: MODE_COLOR }}
                                    title="Generate AI chapter markers for this message"
                                  >
                                    <List className="w-3 h-3" />
                                    {chapterMessageId === message.id
                                      ? 'Chapters shown ↓'
                                      : `Generate Chapters (${Math.round(message.duration)}s)`}
                                  </button>
                                )}

                                {/* Action Items */}
                                {message.actionItems && message.actionItems.length > 0 && (
                                  <div className={`mt-3 p-3 rounded-lg ${isDarkMode ? 'bg-gray-900/50' : 'bg-gray-100/80'}`}>
                                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: MODE_COLOR }}>
                                      <CheckSquare className="w-3 h-3" />
                                      Action Items
                                    </h4>
                                    <ul className="space-y-1">
                                      {message.actionItems.map((item, i) => (
                                        <li key={i} className={`text-xs ${tc.textSecondary} flex items-start gap-2`}>
                                          <span className={tc.textMuted}>•</span>
                                          {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Reactions */}
                                {Object.keys(message.reactions).length > 0 ? (
                                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                                    {Object.entries(message.reactions).map(([emoji, userIds]) => (
                                      <button
                                        key={emoji}
                                        className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${tc.cardBg} border ${tc.border} ${tc.hoverBg}`}
                                        onClick={() => {
                                          const userId = voxModeService.getUserId();
                                          setMessages((prev) =>
                                            prev.map((m) => {
                                              if (m.id !== message.id) return m;
                                              const reactions = { ...m.reactions };
                                              const existing = reactions[emoji] || [];
                                              if (existing.includes(userId)) {
                                                reactions[emoji] = existing.filter((id: string) => id !== userId);
                                                if (reactions[emoji].length === 0) delete reactions[emoji];
                                              } else {
                                                reactions[emoji] = [...existing, userId];
                                              }
                                              return { ...m, reactions };
                                            })
                                          );
                                        }}
                                      >
                                        <span>{emoji}</span>
                                        <span className={tc.textMuted}>{userIds.length}</span>
                                      </button>
                                    ))}
                                    <div className="relative">
                                      <button
                                        className={`p-1 rounded-full ${tc.btnGhost}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReactionPickerMessageId(
                                            reactionPickerMessageId === message.id ? null : message.id
                                          );
                                        }}
                                        title="Add reaction"
                                      >
                                        <Smile className={`w-4 h-4 ${tc.textMuted}`} />
                                      </button>
                                      {reactionPickerMessageId === message.id && (
                                        <div
                                          className={`absolute bottom-full left-0 mb-1 flex gap-1 p-2 rounded-xl border ${tc.cardBg} ${tc.border} shadow-lg z-20`}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {['👍', '❤️', '😂', '🔥', '👏', '🎉'].map((emoji) => (
                                            <button
                                              key={emoji}
                                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f43f5e]/20 transition-colors text-lg"
                                              onClick={() => {
                                                const userId = voxModeService.getUserId();
                                                setMessages((prev) =>
                                                  prev.map((m) => {
                                                    if (m.id !== message.id) return m;
                                                    const reactions = { ...m.reactions };
                                                    const existing = reactions[emoji] || [];
                                                    if (existing.includes(userId)) {
                                                      reactions[emoji] = existing.filter((id: string) => id !== userId);
                                                      if (reactions[emoji].length === 0) delete reactions[emoji];
                                                    } else {
                                                      reactions[emoji] = [...existing, userId];
                                                    }
                                                    return { ...m, reactions };
                                                  })
                                                );
                                                setReactionPickerMessageId(null);
                                              }}
                                            >
                                              {emoji}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  /* Y5: Show reaction trigger even when no reactions exist */
                                  <div className="relative mt-2">
                                    <button
                                      className={`p-1 rounded-full ${tc.btnGhost} opacity-0 group-hover:opacity-100 transition-opacity`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReactionPickerMessageId(
                                          reactionPickerMessageId === message.id ? null : message.id
                                        );
                                      }}
                                      title="Add reaction"
                                    >
                                      <Smile className={`w-4 h-4 ${tc.textMuted}`} />
                                    </button>
                                    {reactionPickerMessageId === message.id && (
                                      <div
                                        className={`absolute bottom-full left-0 mb-1 flex gap-1 p-2 rounded-xl border ${tc.cardBg} ${tc.border} shadow-lg z-20`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {['👍', '❤️', '😂', '🔥', '👏', '🎉'].map((emoji) => (
                                          <button
                                            key={emoji}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f43f5e]/20 transition-colors text-lg"
                                            onClick={() => {
                                              const userId = voxModeService.getUserId();
                                              setMessages((prev) =>
                                                prev.map((m) => {
                                                  if (m.id !== message.id) return m;
                                                  const reactions = { ...m.reactions };
                                                  const existing = reactions[emoji] || [];
                                                  if (existing.includes(userId)) {
                                                    reactions[emoji] = existing.filter((id: string) => id !== userId);
                                                    if (reactions[emoji].length === 0) delete reactions[emoji];
                                                  } else {
                                                    reactions[emoji] = [...existing, userId];
                                                  }
                                                  return { ...m, reactions };
                                                })
                                              );
                                              setReactionPickerMessageId(null);
                                            }}
                                          >
                                            {emoji}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* More Actions Menu */}
                            {!isSelectionMode && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                    setMenuAnchorRect(rect);
                                    setShowMessageMenu(showMessageMenu === message.id ? null : message.id);
                                  }}
                                  className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
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
                                    onDelete={async () => {
                                      const success = await voxModeService.deleteTeamVoxMessage(message.id);
                                      if (success) {
                                        setMessages(prev => prev.filter(m => m.id !== message.id));
                                        toast.success('Message deleted');
                                      } else {
                                        toast.error('Failed to delete message');
                                      }
                                      setShowMessageMenu(null);
                                    }}
                                    onClose={() => setShowMessageMenu(null)}
                                  />
                                )}
                              </>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Unified Recording Area */}
              {recordingState === 'preview' && recordingData ? (
                <div className={`px-4 md:px-6 py-4 border-t ${tc.border} ${tc.panelBg}`}>
                  <RecordingPreview
                    recordingData={recordingData}
                    onSend={handleSendRecording}
                    onCancel={cancelRecording}
                    onRetry={() => {
                      cancelRecording();
                      setTimeout(() => startRecording(), 100);
                    }}
                    isDarkMode={isDarkMode}
                  />
                </div>
              ) : (
                /* Compose bar — the in-pane record button is retired (Tier 2:
                   the FloatingMic + StudioFooter RECORDING surface drive
                   capture). The channel-specific composition controls (message
                   type + mention) stay; they apply when the recording is sent
                   from the preview. */
                <div className={`px-4 md:px-6 py-3 border-t ${tc.border} ${tc.panelBg}`}>
                  {/* Message Type Selector */}
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <span className={`text-xs ${tc.textMuted}`}>Message type:</span>
                    {(['normal', 'standup', 'announcement'] as const).map((type) => {
                      const tooltips = {
                        normal: 'Regular team message',
                        standup: 'Daily standup update - automatically extracts action items',
                        announcement: 'Important team announcement - notifies all members'
                      };
                      return (
                        <button
                          key={type}
                          onClick={() => setMessageType(type)}
                          title={tooltips[type]}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                            messageType === type
                              ? type === 'announcement'
                                ? 'bg-red-500/20 text-red-500'
                                : type === 'standup'
                                  ? 'bg-[#f43f5e]/20 text-[#f43f5e]'
                                  : `${tc.activeBg} ${tc.text}`
                              : `${tc.cardBg} ${tc.textSecondary} ${tc.hoverBg}`
                          }`}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setShowMentionPicker(!showMentionPicker)}
                      className={`ml-1 p-2 rounded-xl ${tc.btnGhost} transition-all duration-200`}
                      aria-label="Mention someone"
                      title="Mention someone"
                    >
                      <AtSign className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={`flex-1 flex items-center justify-center ${tc.textMuted}`}>
              <div className="text-center p-6">
                <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center border ${tc.border} ${isDarkMode ? 'bg-white/[0.03]' : 'bg-zinc-100'}`}>
                  <Users className={`w-7 h-7 ${tc.textMuted}`} />
                </div>
                <p className={`text-lg ${tc.text}`}>Select a channel</p>
                <p className={`text-sm mt-1 ${tc.textSecondary}`}>to start collaborating with your team</p>
              </div>
            </div>
          )}
        </div>

        {/* Members rail — Path C 3rd column (Tier 3). Members resolve from the
            channel/workspace memberIds × loaded contacts. No online/offline
            split: presence isn't wired here and we don't fabricate it. The
            Channel AI digest reuses the generated channel summary (coral is
            sanctioned for AI output). Shown at md+ to match the channels
            sidebar (collapse the SourcesRail if the row feels tight). */}
        {selectedChannel && (() => {
          const ids: string[] = (selectedChannel.memberIds?.length
            ? selectedChannel.memberIds
            : selectedWorkspace?.memberIds) ?? [];
          const members = ids
            .map((id) => pulseContacts.find((c: any) => c.id === id))
            .filter(Boolean) as any[];
          return (
            <aside className={`hidden md:flex w-52 shrink-0 flex-col border-l ${tc.border} ${tc.panelBg} overflow-y-auto`}>
              <div className={`px-3 py-2.5 text-[10px] font-mono uppercase tracking-[0.18em] ${tc.textMuted}`}>
                Members · {ids.length}
              </div>
              <div className="px-1.5 pb-2">
                {members.length === 0 ? (
                  <p className={`px-2 py-2 text-[11px] ${tc.textMuted} leading-relaxed`}>
                    {ids.length > 0
                      ? 'Member profiles sync from your contacts.'
                      : 'No members yet — add teammates from the channel header.'}
                  </p>
                ) : (
                  members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 px-2 py-1.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
                        style={{ backgroundColor: m.avatarColor || MODE_COLOR }}
                        aria-hidden="true"
                      >
                        {(m.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className={`text-[12px] truncate flex-1 ${tc.text}`}>{m.name}</span>
                      {m.role && (
                        <span className={`text-[9px] font-mono uppercase tracking-[0.1em] shrink-0 ${tc.textMuted}`}>
                          {m.role}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className={`px-3 pt-3 pb-1 text-[10px] font-mono uppercase tracking-[0.18em] ${tc.textMuted}`}>
                Channel AI
              </div>
              <div className="px-2 pb-3">
                {conversationSummary ? (
                  <div className="rounded-lg p-3" style={{ background: 'var(--pulse-coral-bg-12)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3 h-3" style={{ color: 'var(--pulse-coral-fg)' }} />
                      <span className="text-[9px] font-mono uppercase tracking-[0.1em]" style={{ color: 'var(--pulse-coral-fg)' }}>
                        Digest
                      </span>
                    </div>
                    <p className={`text-[11.5px] leading-snug ${tc.text}`}>{conversationSummary.overview}</p>
                  </div>
                ) : (
                  <p className={`px-1 text-[11px] ${tc.textMuted} leading-relaxed`}>
                    Run <span className="font-medium">Summarize</span> in the toolbar to generate a channel digest.
                  </p>
                )}
              </div>
            </aside>
          );
        })()}
      </div>

      {/* Audio playback is owned by the shared RelayStudioProvider (single
          <audio>) — no local element here. */}

      {/* New Workspace Modal */}
      {showNewWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className={tc.modalOverlay} onClick={() => setShowNewWorkspace(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border ${tc.modalBg} p-6`}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="p-2 rounded-xl"
                style={{ background: MODE_COLOR }}
              >
                <Users className="w-5 h-5 text-white" />
              </div>
              <h3 className={`text-xl font-bold ${tc.text}`}>Create Workspace</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${tc.textSecondary} mb-2`}>
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="My Team"
                  className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-[#f43f5e]/50 transition-all`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${tc.textSecondary} mb-2`}>
                  Description (Optional)
                </label>
                <textarea
                  value={workspaceDesc}
                  onChange={(e) => setWorkspaceDesc(e.target.value)}
                  placeholder="What's this workspace for?"
                  rows={3}
                  className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-[#f43f5e]/50 transition-all resize-none`}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewWorkspace(false)}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnSecondary}`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkspace}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnPrimary}`}
              >
                Create Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Channel Modal */}
      {showNewChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className={tc.modalOverlay} onClick={() => setShowNewChannel(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border ${tc.modalBg} p-6`}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="p-2 rounded-xl"
                style={{ background: MODE_COLOR }}
              >
                <Hash className="w-5 h-5 text-white" />
              </div>
              <h3 className={`text-xl font-bold ${tc.text}`}>Create Channel</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${tc.textSecondary} mb-2`}>
                  Channel Name
                </label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="new-channel"
                  className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-[#f43f5e]/50 transition-all`}
                />
              </div>
              {/* Channel Type — segmented control replaces the 2×2 icon-card
                  grid (DESIGN.md identical-card-grid risk). Mono-uppercase
                  labels match the section's chip vocabulary. */}
              <div>
                <label className={`block text-sm font-medium ${tc.textSecondary} mb-2`}>
                  Channel Type
                </label>
                <div
                  className={`inline-flex w-full p-0.5 rounded-md ${isDarkMode ? 'bg-[rgba(255,255,255,0.055)]' : 'bg-[#f2f2f2]'}`}
                  role="radiogroup"
                  aria-label="Channel type"
                >
                  {(['general', 'standup', 'announcement', 'project'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={channelType === type}
                      onClick={() => setChannelType(type)}
                      className={`flex-1 px-3 py-1.5 rounded font-mono text-[11px] uppercase tracking-[0.1em] transition ${
                        channelType === type
                          ? 'bg-[rgba(244,63,94,0.10)] text-[#e11d48] dark:text-[#fb7185]'
                          : isDarkMode
                            ? 'text-[#b4b4b8] hover:text-[#fafafa]'
                            : 'text-[#52525b] hover:text-[#0f0f0f]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewChannel(false)}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnSecondary}`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChannel}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnPrimary}`}
              >
                Create Channel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Panel */}
      <RelayPanelShell
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        label="Add member"
        tc={tc}
      >
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search Pulse users..."
            value={memberSearchQuery}
            onChange={(e) => setMemberSearchQuery(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-[#f43f5e]/50 transition-all`}
          />
        </div>

        <div className={`max-h-64 overflow-y-auto space-y-1 rounded-xl p-2 ${tc.cardBg} border ${tc.border}`}>
          {pulseContacts.filter(c =>
            c.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) &&
            !selectedWorkspace?.memberIds.includes(c.id)
          ).map((contact) => (
            <button
              key={contact.id}
              onClick={async () => {
                if (!selectedWorkspace) return;
                const success = await voxModeService.addMemberToWorkspace(selectedWorkspace.id, contact.id);
                if (success) {
                  setSelectedWorkspace(prev => prev ? {
                    ...prev,
                    memberIds: [...prev.memberIds, contact.id]
                  } : null);
                  setWorkspaces(prev => prev.map(ws =>
                    ws.id === selectedWorkspace.id
                      ? { ...ws, memberIds: [...ws.memberIds, contact.id] }
                      : ws
                  ));
                }
                setShowAddMember(false);
              }}
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
          {pulseContacts.filter(c => c.name.toLowerCase().includes(memberSearchQuery.toLowerCase())).length === 0 && (
            <p className={`text-center py-4 text-sm ${tc.textMuted}`}>No Pulse users found</p>
          )}
        </div>
      </RelayPanelShell>

      {/* Notification Settings Panel */}
      <RelayPanelShell
        open={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
        label="Notifications"
        tc={tc}
        footer={
          <button
            onClick={() => {
              if (selectedChannel) {
                try {
                  localStorage.setItem(
                    `vox_team_notif_${selectedChannel.id}`,
                    JSON.stringify({ pref: notificationPref, updatedAt: new Date().toISOString() })
                  );
                  toast.success(`Notifications set to "${notificationPref === 'all' ? 'All Messages' : notificationPref === 'mentions' ? 'Mentions Only' : 'Muted'}"`);
                } catch {
                  toast.error('Failed to save notification settings');
                }
              }
              setShowNotificationSettings(false);
            }}
            className={`w-full px-4 py-3 rounded-xl font-medium transition-all ${tc.btnPrimary}`}
          >
            Save
          </button>
        }
      >
        <div className="space-y-2">
          {[
            { value: 'all' as const, label: 'All messages', desc: 'Get notified for every message' },
            { value: 'mentions' as const, label: 'Mentions only', desc: "Only when you're @mentioned" },
            { value: 'mute' as const, label: 'Mute', desc: 'No notifications' }
          ].map((option) => (
            <label
              key={option.value}
              className={`flex items-center justify-between p-4 rounded-xl cursor-pointer ${tc.cardBg} border ${tc.border} ${tc.hoverBg} transition-all`}
            >
              <div>
                <p className={`font-medium ${tc.text}`}>{option.label}</p>
                <p className={`text-sm ${tc.textSecondary}`}>{option.desc}</p>
              </div>
              <input
                type="radio"
                name="notification"
                checked={notificationPref === option.value}
                onChange={() => setNotificationPref(option.value)}
                className="w-4 h-4 text-[#f43f5e]"
              />
            </label>
          ))}
        </div>
      </RelayPanelShell>

      {/* Channel Settings Panel */}
      <RelayPanelShell
        open={showChannelSettings && !!selectedChannel}
        onClose={() => setShowChannelSettings(false)}
        label="Channel settings"
        tc={tc}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setShowChannelSettings(false)}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnSecondary}`}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!selectedChannel) return;
                const trimmedName = editChannelName.trim();
                if (!trimmedName) {
                  toast.error('Channel name cannot be empty');
                  return;
                }
                const desc = editChannelDesc.trim();
                try {
                  const updated = await voxModeService.updateTeamChannel(selectedChannel.id, {
                    name: trimmedName,
                    description: desc,
                  });
                  if (updated) {
                    setSelectedChannel({ ...selectedChannel, name: trimmedName, description: desc });
                    setWorkspaces(prev => prev.map(ws => ({
                      ...ws,
                      channels: ws.channels.map(ch =>
                        ch.id === selectedChannel.id ? { ...ch, name: trimmedName, description: desc } : ch
                      ),
                    })));
                    if (selectedWorkspace) {
                      setSelectedWorkspace({
                        ...selectedWorkspace,
                        channels: selectedWorkspace.channels.map(ch =>
                          ch.id === selectedChannel.id ? { ...ch, name: trimmedName, description: desc } : ch
                        ),
                      });
                    }
                    toast.success('Channel settings saved');
                  } else {
                    toast.error('Failed to save channel settings');
                  }
                } catch {
                  toast.error('Failed to save channel settings');
                }
                setShowChannelSettings(false);
              }}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnPrimary}`}
            >
              Save
            </button>
          </div>
        }
      >
        {selectedChannel && (
          <div className="space-y-4">
            <div>
              <label htmlFor="channel-settings-name" className={`block text-sm font-medium ${tc.textSecondary} mb-2`}>Channel name</label>
              <input
                id="channel-settings-name"
                type="text"
                value={editChannelName}
                onChange={(e) => setEditChannelName(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-[#f43f5e]/50 transition-all`}
              />
            </div>
            <div>
              <label htmlFor="channel-settings-desc" className={`block text-sm font-medium ${tc.textSecondary} mb-2`}>Description</label>
              <textarea
                id="channel-settings-desc"
                value={editChannelDesc}
                onChange={(e) => setEditChannelDesc(e.target.value)}
                placeholder="What's this channel about?"
                rows={3}
                className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-[#f43f5e]/50 transition-all resize-none`}
              />
            </div>
            <div className={`p-4 rounded-xl ${tc.cardBg} border ${tc.border}`}>
              <p className={`text-sm ${tc.textSecondary}`}>
                <strong>Type:</strong> {selectedChannel.type.charAt(0).toUpperCase() + selectedChannel.type.slice(1)}
              </p>
              <p className={`text-sm mt-1 ${tc.textSecondary}`}>
                <strong>Members:</strong> {selectedChannel.memberIds.length || 'All workspace members'}
              </p>
            </div>
          </div>
        )}
      </RelayPanelShell>

      {/* Mention Picker Panel */}
      <RelayPanelShell
        open={showMentionPicker}
        onClose={() => setShowMentionPicker(false)}
        label="Mention people"
        tc={tc}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => {
                setSelectedMentions([]);
                setMentionSearchQuery('');
                setShowMentionPicker(false);
              }}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnSecondary}`}
            >
              Clear all
            </button>
            <button
              onClick={() => {
                setMentionSearchQuery('');
                setShowMentionPicker(false);
              }}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnPrimary}`}
            >
              Done ({selectedMentions.length})
            </button>
          </div>
        }
      >
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search team members..."
            value={mentionSearchQuery}
            onChange={(e) => setMentionSearchQuery(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-[#f43f5e]/50 transition-all`}
          />
        </div>

        {selectedMentions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedMentions.map(mentionId => {
              const contact = pulseContacts.find(c => c.id === mentionId);
              return contact ? (
                <span
                  key={mentionId}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm"
                  style={{ background: `${MODE_COLOR}20`, color: MODE_COLOR }}
                >
                  @{contact.name}
                  <button
                    onClick={() => setSelectedMentions(selectedMentions.filter(id => id !== mentionId))}
                    className="hover:opacity-70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : null;
            })}
          </div>
        )}

        <div className={`max-h-64 overflow-y-auto space-y-1 rounded-xl p-2 ${tc.cardBg} border ${tc.border}`}>
          {pulseContacts.filter(c =>
            c.name.toLowerCase().includes(mentionSearchQuery.toLowerCase()) &&
            !selectedMentions.includes(c.id)
          ).map((contact) => (
            <button
              key={contact.id}
              onClick={() => {
                setSelectedMentions([...selectedMentions, contact.id]);
              }}
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
              <AtSign className={`w-4 h-4 ${tc.textMuted}`} />
            </button>
          ))}
          {pulseContacts.filter(c => c.name.toLowerCase().includes(mentionSearchQuery.toLowerCase())).length === 0 && (
            <p className={`text-center py-4 text-sm ${tc.textMuted}`}>No team members found</p>
          )}
        </div>
      </RelayPanelShell>

      {/* Phase 2: Selection Toolbar */}
      {isSelectionMode && selectedChannel && (
        <VoxSelectToolbar
          selectedItems={selectedItems}
          selectionCount={selectionCount}
          totalDuration={getTotalDuration()}
          onSelectAll={handleSelectAllMessages}
          onDeselectAll={deselectAll}
          onExitSelection={exitSelectionMode}
          contactName={selectedChannel.name}
          isDarkMode={isDarkMode}
          accentColor="#f43f5e"
          allSelected={selectionCount === messages.length && messages.length > 0}
        />
      )}

      {/* Phase 5: AI Enhancement Modals */}

      {/* Conversation Summary Modal */}
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

      {/* Meeting Notes Modal */}
      {meetingNotes && (
        <div
          className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setMeetingNotes(null)}
        >
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <MessageAIPanel
              meetingNotes={meetingNotes}
              isDarkMode={isDarkMode}
              onClose={() => setMeetingNotes(null)}
              defaultOpen={{ meetingNotes: true }}
              onArchive={async () => {
                await archiveMeetingNotes(
                  meetingNotes,
                  selectedChannel ? `Team Vox / #${selectedChannel.name}` : 'Team Vox'
                );
                toast.success('Meeting notes archived to Pulse Archives');
              }}
            />
          </div>
        </div>
      )}

      {/* AI Auto-Chapters Panel */}
      {activeChapters.length > 0 && chapterMessageId && (
        <div className="fixed bottom-4 left-4 right-4 z-[200] max-w-2xl mx-auto">
          <div className="relative">
            <button
              type="button"
              onClick={() => { setActiveChapters([]); setChapterMessageId(null); }}
              className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full text-white hover:opacity-90 transition flex items-center justify-center shadow-lg"
              style={{ backgroundColor: MODE_COLOR }}
              title="Close chapters"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <MessageAIPanel
              chapters={activeChapters}
              currentTime={0}
              isDarkMode={isDarkMode}
              defaultOpen={{ chapters: true }}
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

      {/* Download Modal */}
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

export default TeamVoxMode;
