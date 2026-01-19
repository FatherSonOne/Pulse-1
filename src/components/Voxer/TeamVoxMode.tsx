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
  Smile,
  X,
  UserPlus,
  Megaphone,
  Calendar,
  Square,
  Menu
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import RecordingPreview from './RecordingPreview';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { voxModeService } from '../../services/voxer/voxModeService';
import analyticsCollector from '../../services/analyticsCollector';
import type { VoxWorkspace, VoxTeamChannel, TeamVoxMessage } from '../../services/voxer/voxModeTypes';
import './Voxer.css';

// Mode color for Team Vox
const MODE_COLOR = '#F59E0B';

interface TeamVoxModeProps {
  contacts?: any[];
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
  contacts = [],
  apiKey,
  onBack,
  isDarkMode = false,
}) => {
  const [workspaces, setWorkspaces] = useState<VoxWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<VoxWorkspace | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<VoxTeamChannel | null>(null);
  const [messages, setMessages] = useState<TeamVoxMessage[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
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
      console.log('Team Vox recording complete:', data.duration, 'seconds');
    },
  });

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

      analyticsCollector.trackMessageEvent({
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

  useEffect(() => {
    loadWorkspaces();
    loadPulseContacts();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        return isDarkMode
          ? 'border-l-4 border-amber-500 bg-amber-500/10'
          : 'border-l-4 border-amber-500 bg-amber-500/5';
      case 'announcement':
        return isDarkMode
          ? 'border-l-4 border-red-500 bg-red-500/10'
          : 'border-l-4 border-red-500 bg-red-500/5';
      default:
        return '';
    }
  };

  // Theme classes for consistent styling
  const tc = {
    // Backgrounds
    pageBg: isDarkMode
      ? 'bg-gradient-to-br from-gray-900 via-amber-900/10 to-gray-900'
      : 'bg-gradient-to-br from-slate-50 via-amber-50/30 to-white',
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
      ? 'bg-amber-500/20'
      : 'bg-amber-500/10',

    // Borders
    border: isDarkMode ? 'border-gray-800/60' : 'border-gray-200/60',
    borderAccent: isDarkMode ? 'border-amber-500/30' : 'border-amber-400/40',

    // Text
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: isDarkMode ? 'text-gray-500' : 'text-gray-400',
    textAccent: 'text-amber-500',

    // Buttons
    btnPrimary: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25',
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

  // Render sidebar content (shared between mobile and desktop)
  const renderSidebarContent = () => (
    <div className="flex-1 overflow-y-auto py-2">
      {workspaces.map((workspace) => (
        <div key={workspace.id}>
          {/* Workspace Header */}
          <button
            onClick={() => toggleWorkspaceExpanded(workspace.id)}
            className={`w-full px-3 py-2 flex items-center gap-2 transition-all ${tc.hoverBg} ${
              selectedWorkspace?.id === workspace.id ? tc.activeBg : ''
            }`}
          >
            {expandedWorkspaces.has(workspace.id) ? (
              <ChevronDown className={`w-4 h-4 ${tc.textMuted}`} />
            ) : (
              <ChevronRight className={`w-4 h-4 ${tc.textMuted}`} />
            )}
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #ea580c 100%)` }}
            >
              <span className="text-xs font-bold text-white">
                {workspace.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className={`font-medium text-sm truncate ${tc.text}`}>
              {workspace.name}
            </span>
          </button>

          {/* Channels */}
          {expandedWorkspaces.has(workspace.id) && (
            <div className={`ml-4 border-l ${tc.border} pl-2 space-y-0.5`}>
              {workspace.channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => {
                    setSelectedWorkspace(workspace);
                    setSelectedChannel(channel);
                    setShowMobileSidebar(false);
                  }}
                  className={`w-full px-3 py-1.5 flex items-center gap-2 rounded-r-lg text-sm transition-all ${
                    selectedChannel?.id === channel.id
                      ? `${tc.activeBg} text-amber-500`
                      : `${tc.textSecondary} ${tc.hoverBg}`
                  }`}
                >
                  {CHANNEL_ICONS[channel.type]}
                  <span className="truncate">{channel.name}</span>
                  {channel.unreadCount > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                      {channel.unreadCount}
                    </span>
                  )}
                  {channel.isPinned && (
                    <Pin className={`w-3 h-3 ${tc.textMuted}`} />
                  )}
                </button>
              ))}

              {/* Add Channel Button */}
              <button
                onClick={() => {
                  setSelectedWorkspace(workspace);
                  setShowNewChannel(true);
                }}
                className={`w-full px-3 py-1.5 flex items-center gap-2 rounded-r-lg text-sm ${tc.textMuted} hover:text-amber-500 transition-all`}
              >
                <Plus className="w-4 h-4" />
                Add Channel
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

  return (
    <div className={`h-full flex flex-col ${tc.pageBg}`}>
      {/* Header */}
      <div
        className={`px-4 md:px-6 py-4 border-b ${tc.border} ${tc.panelBg}`}
        style={{
          background: isDarkMode
            ? `linear-gradient(135deg, rgba(245,158,11,0.15) 0%, transparent 50%)`
            : `linear-gradient(135deg, rgba(245,158,11,0.1) 0%, transparent 50%)`
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
              background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #ea580c 100%)`,
              boxShadow: `0 8px 24px ${MODE_COLOR}40`
            }}
          >
            <Users className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className={`text-lg md:text-xl font-bold ${tc.text}`}>Team Vox</h1>
            <p className={`text-xs md:text-sm ${tc.textSecondary} hidden sm:block`}>Your Team's Voice Hub</p>
          </div>

          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setShowMobileSidebar(true)}
            className={`md:hidden p-2 rounded-xl ${tc.btnGhost} transition-all`}
            aria-label="Show workspaces"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowNewWorkspace(true)}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${tc.btnPrimary}`}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Workspace</span>
          </button>
        </div>
      </div>

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
        <div className={`hidden md:flex w-64 border-r ${tc.border} flex-col ${tc.panelBg}`}>
          {renderSidebarContent()}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedChannel ? (
            <>
              {/* Channel Header */}
              <div className={`px-4 md:px-6 py-3 md:py-4 border-b ${tc.border} ${tc.cardBg} flex items-center justify-between`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100/80'}`}>
                    {CHANNEL_ICONS[selectedChannel.type]}
                  </div>
                  <div className="min-w-0">
                    <h2 className={`text-base md:text-lg font-semibold ${tc.text} truncate`}>
                      {selectedChannel.name}
                    </h2>
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
                  >
                    <UserPlus className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  <button
                    onClick={() => setShowNotificationSettings(true)}
                    className={`p-2 rounded-xl ${tc.btnGhost} transition-all duration-200`}
                    aria-label="Notification settings"
                  >
                    <Bell className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  <button
                    onClick={() => setShowChannelSettings(true)}
                    className={`p-2 rounded-xl ${tc.btnGhost} transition-all duration-200`}
                    aria-label="Channel settings"
                  >
                    <Settings className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {messages.length === 0 ? (
                  <div className={`text-center py-12 ${tc.textMuted}`}>
                    <div
                      className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${MODE_COLOR}20 0%, ${MODE_COLOR}10 100%)`,
                        border: `1px solid ${MODE_COLOR}30`
                      }}
                    >
                      <Volume2 className="w-10 h-10" style={{ color: MODE_COLOR, opacity: 0.6 }} />
                    </div>
                    <p className={tc.text}>No messages in this channel yet</p>
                    <p className={`text-sm mt-1 ${tc.textSecondary}`}>Be the first to send a vox!</p>
                  </div>
                ) : (
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

                          <div className={`rounded-xl p-4 ${tc.cardBg} border ${tc.border} ${getMessageTypeStyle(message.messageType)}`}>
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
                                    <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-500 rounded-full">
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
                                      background: playingMessageId === message.id && isPlaying
                                        ? MODE_COLOR
                                        : isDarkMode ? 'rgba(55,65,81,0.5)' : 'rgba(229,231,235,0.8)',
                                      boxShadow: playingMessageId === message.id && isPlaying ? `0 4px 12px ${MODE_COLOR}50` : 'none'
                                    }}
                                  >
                                    {playingMessageId === message.id && isPlaying ? (
                                      <Pause className="w-4 h-4 text-white" />
                                    ) : (
                                      <Play className={`w-4 h-4 ml-0.5 ${playingMessageId === message.id && isPlaying ? 'text-white' : tc.text}`} />
                                    )}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <VoxAudioVisualizer
                                      analyser={null}
                                      isActive={false}
                                      isPlaying={playingMessageId === message.id && isPlaying}
                                      playbackProgress={playingMessageId === message.id ? playbackProgress : 0}
                                      mode="waveform"
                                      color={MODE_COLOR}
                                      height={32}
                                      isDarkMode={isDarkMode}
                                    />
                                  </div>
                                  <span className={`text-xs ${tc.textMuted} shrink-0`}>
                                    {formatDuration(message.duration)}
                                  </span>
                                </div>

                                {/* Transcript */}
                                {message.transcript && (
                                  <p className={`text-sm ${tc.textSecondary} mb-2`}>
                                    {message.transcript}
                                  </p>
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
                                {Object.keys(message.reactions).length > 0 && (
                                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                                    {Object.entries(message.reactions).map(([emoji, userIds]) => (
                                      <button
                                        key={emoji}
                                        className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${tc.cardBg} border ${tc.border} ${tc.hoverBg}`}
                                      >
                                        <span>{emoji}</span>
                                        <span className={tc.textMuted}>{userIds.length}</span>
                                      </button>
                                    ))}
                                    <button className={`p-1 rounded-full ${tc.btnGhost}`}>
                                      <Smile className={`w-4 h-4 ${tc.textMuted}`} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
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
                  <>
                    {/* Message Type Selector */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={`text-xs ${tc.textMuted}`}>Message type:</span>
                      {(['normal', 'standup', 'announcement'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setMessageType(type)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                            messageType === type
                              ? type === 'announcement'
                                ? 'bg-red-500/20 text-red-500'
                                : type === 'standup'
                                  ? 'bg-amber-500/20 text-amber-500'
                                  : `${tc.activeBg} ${tc.text}`
                              : `${tc.cardBg} ${tc.textSecondary} ${tc.hoverBg}`
                          }`}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col items-center gap-4 w-full">
                      {/* Recording controls row */}
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setShowMentionPicker(!showMentionPicker)}
                          className={`p-2 rounded-xl ${tc.btnGhost} transition-all duration-200`}
                          aria-label="Mention someone"
                        >
                          <AtSign className="w-5 h-5" />
                        </button>
                        <button
                          onClick={handleRecordToggle}
                          className="relative w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all duration-300 ease-out hover:scale-105 active:scale-95"
                          style={{
                            background: recordingState === 'recording'
                              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                              : `linear-gradient(135deg, ${MODE_COLOR} 0%, #ea580c 100%)`,
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
                              <Square className="w-5 h-5 md:w-6 md:h-6 text-white" />
                            ) : (
                              <Mic className="w-5 h-5 md:w-6 md:h-6 text-white" />
                            )}
                          </span>
                        </button>
                      </div>

                      {/* Duration or hint text */}
                      {recordingState === 'recording' ? (
                        <span className="text-sm font-mono" style={{ color: MODE_COLOR }}>
                          {Math.floor(recordingDuration / 60)}:{Math.floor(recordingDuration % 60).toString().padStart(2, '0')}
                        </span>
                      ) : (
                        <p className={`text-sm ${tc.textMuted}`}>
                          Click to record a team vox
                        </p>
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
                  </>
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
                  <Users className="w-10 h-10" style={{ color: MODE_COLOR, opacity: 0.6 }} />
                </div>
                <p className={`text-lg ${tc.text}`}>Select a channel</p>
                <p className={`text-sm mt-1 ${tc.textSecondary}`}>to start collaborating with your team</p>
              </div>
            </div>
          )}
        </div>
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

      {/* New Workspace Modal */}
      {showNewWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className={tc.modalOverlay} onClick={() => setShowNewWorkspace(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border ${tc.modalBg} p-6`}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="p-2 rounded-xl"
                style={{ background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #ea580c 100%)` }}
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
                  className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all`}
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
                  className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all resize-none`}
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
                style={{ background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #ea580c 100%)` }}
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
                  className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${tc.textSecondary} mb-2`}>
                  Channel Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['general', 'standup', 'announcement', 'project'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setChannelType(type)}
                      className={`p-3 rounded-xl flex items-center gap-2 transition-all border ${
                        channelType === type
                          ? `${tc.activeBg} ${tc.borderAccent} text-amber-500`
                          : `${tc.cardBg} ${tc.border} ${tc.textSecondary} ${tc.hoverBg}`
                      }`}
                    >
                      {CHANNEL_ICONS[type]}
                      <span className="text-sm capitalize">{type}</span>
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

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className={tc.modalOverlay} onClick={() => setShowAddMember(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border ${tc.modalBg} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #ea580c 100%)` }}
                >
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <h3 className={`text-xl font-bold ${tc.text}`}>Add Member</h3>
              </div>
              <button onClick={() => setShowAddMember(false)} className={`p-2 rounded-xl ${tc.btnGhost}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search Pulse users..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all`}
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
          </div>
        </div>
      )}

      {/* Notification Settings Modal */}
      {showNotificationSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className={tc.modalOverlay} onClick={() => setShowNotificationSettings(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border ${tc.modalBg} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #ea580c 100%)` }}
                >
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <h3 className={`text-xl font-bold ${tc.text}`}>Notification Settings</h3>
              </div>
              <button onClick={() => setShowNotificationSettings(false)} className={`p-2 rounded-xl ${tc.btnGhost}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { value: 'all', label: 'All Messages', desc: 'Get notified for every message' },
                { value: 'mentions', label: 'Mentions Only', desc: "Only when you're @mentioned" },
                { value: 'mute', label: 'Mute', desc: 'No notifications' }
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
                    defaultChecked={option.value === 'all'}
                    className="w-4 h-4 text-amber-500"
                  />
                </label>
              ))}
            </div>

            <button
              onClick={() => setShowNotificationSettings(false)}
              className={`w-full mt-6 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnPrimary}`}
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Channel Settings Modal */}
      {showChannelSettings && selectedChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className={tc.modalOverlay} onClick={() => setShowChannelSettings(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border ${tc.modalBg} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #ea580c 100%)` }}
                >
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <h3 className={`text-xl font-bold ${tc.text}`}>Channel Settings</h3>
              </div>
              <button onClick={() => setShowChannelSettings(false)} className={`p-2 rounded-xl ${tc.btnGhost}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${tc.textSecondary} mb-2`}>Channel Name</label>
                <input
                  type="text"
                  defaultValue={selectedChannel.name}
                  className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${tc.textSecondary} mb-2`}>Description</label>
                <textarea
                  defaultValue={selectedChannel.description}
                  placeholder="What's this channel about?"
                  rows={3}
                  className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all resize-none`}
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

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowChannelSettings(false)}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnSecondary}`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log('Saving channel settings');
                  setShowChannelSettings(false);
                }}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnPrimary}`}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mention Picker Modal */}
      {showMentionPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className={tc.modalOverlay} onClick={() => setShowMentionPicker(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border ${tc.modalBg} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #ea580c 100%)` }}
                >
                  <AtSign className="w-5 h-5 text-white" />
                </div>
                <h3 className={`text-xl font-bold ${tc.text}`}>Mention People</h3>
              </div>
              <button onClick={() => setShowMentionPicker(false)} className={`p-2 rounded-xl ${tc.btnGhost}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search team members..."
                value={mentionSearchQuery}
                onChange={(e) => setMentionSearchQuery(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all`}
              />
            </div>

            {/* Selected mentions */}
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

            {/* Contact List */}
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

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setSelectedMentions([]);
                  setMentionSearchQuery('');
                  setShowMentionPicker(false);
                }}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnSecondary}`}
              >
                Clear All
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
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamVoxMode;
