// Voice Threads Mode - CMF Nothing x Glassmorphism Avant-Garde Design
// Async threaded voice conversations with premium industrial aesthetic

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Mic,
  Play,
  Pause,
  Reply,
  ChevronRight,
  Plus,
  Search,
  MoreVertical,
  Check,
  CheckCheck,
  Quote,
  X,
  Users,
  Archive,
  Square,
  ChevronLeft,
  Pin,
  Heart,
  Smile,
  BookmarkPlus,
  Bookmark,
  Filter,
  Clock,
  Star,
  Trash2,
  Edit3,
  Volume2,
  VolumeX,
  Hash,
  AtSign,
  Forward,
  Download,
  Copy,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import RecordingPreview from './RecordingPreview';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { voxModeService } from '../../services/voxer/voxModeService';
import analyticsCollector from '../../services/analyticsCollector';
import type { VoiceThread, VoiceThreadMessage, PulseUser } from '../../services/voxer/voxModeTypes';
import toast from 'react-hot-toast';
import './VoiceThreadsMode.css';

// Mode color for Voice Threads - Emerald/Teal
const MODE_COLOR = '#10B981';
const MODE_COLOR_LIGHT = '#34D399';
const MODE_COLOR_DARK = '#059669';

// Quick reaction emojis
const QUICK_REACTIONS = ['❤️', '👍', '🎯', '🔥', '💡', '👏'];

// Thread status types
type ThreadStatus = 'active' | 'resolved' | 'archived' | 'pinned';
type FilterType = 'all' | 'unread' | 'pinned' | 'archived';
type SortType = 'recent' | 'oldest' | 'most_active' | 'unread_first';

// ============================================
// LAYERED AUDIO VISUALIZER COMPONENT
// ============================================

interface LayeredVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  height?: number;
  color?: string;
  isDarkMode?: boolean;
}

const LayeredVisualizer: React.FC<LayeredVisualizerProps> = ({
  analyser,
  isActive,
  height = 80,
  color = MODE_COLOR,
  isDarkMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const smoothedRef = useRef<number[]>([]);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) setWidth(containerRef.current.offsetWidth);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const numBars = Math.floor(width / 8);
    const dataArray = new Uint8Array(analyser?.frequencyBinCount || 128);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let values: number[] = [];
      const time = Date.now() / 1000;

      if (isActive && analyser) {
        analyser.getByteFrequencyData(dataArray);
        const step = Math.max(1, Math.floor(dataArray.length / numBars));
        for (let i = 0; i < numBars; i++) {
          const idx = Math.min(i * step, dataArray.length - 1);
          const normalized = dataArray[idx] / 255;
          const boosted = Math.pow(normalized, 0.7) * 1.2;
          values.push(Math.min(boosted, 1));
        }
        // Smooth
        if (smoothedRef.current.length === numBars) {
          values = values.map((v, i) => smoothedRef.current[i] * 0.3 + v * 0.7);
        }
        smoothedRef.current = values;
      } else {
        // Idle animation - gentle wave
        for (let i = 0; i < numBars; i++) {
          const x = i / numBars;
          const wave = Math.sin(x * Math.PI * 4 + time * 2) * 0.15;
          const wave2 = Math.sin(x * Math.PI * 8 + time * 3) * 0.08;
          values.push(Math.abs(wave + wave2) * Math.sin(x * Math.PI) + 0.05);
        }
      }

      const centerY = height / 2;
      const maxH = height / 2 - 8;

      // Layer 1: Background spectrum glow
      for (let i = 0; i < numBars; i++) {
        const x = (i / numBars) * width;
        const barW = width / numBars - 2;
        const val = values[i] || 0;
        const h = val * maxH * 0.6;

        const gradient = ctx.createLinearGradient(x, centerY - h, x, centerY + h);
        gradient.addColorStop(0, `${color}08`);
        gradient.addColorStop(0.5, `${color}20`);
        gradient.addColorStop(1, `${color}08`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, centerY - h, barW, h * 2);
      }

      // Layer 2: Mid-layer bars (spectrum style)
      ctx.shadowBlur = 12;
      ctx.shadowColor = `${color}60`;
      for (let i = 0; i < numBars; i++) {
        const x = (i / numBars) * width + 1;
        const barW = Math.max(2, width / numBars - 4);
        const val = values[i] || 0;
        const h = val * maxH;

        const gradient = ctx.createLinearGradient(x, centerY - h, x, centerY + h);
        gradient.addColorStop(0, `${MODE_COLOR_LIGHT}90`);
        gradient.addColorStop(0.5, `${color}`);
        gradient.addColorStop(1, `${MODE_COLOR_LIGHT}90`);
        ctx.fillStyle = gradient;

        // Upper bar
        ctx.beginPath();
        ctx.roundRect(x, centerY - h, barW, h, 2);
        ctx.fill();

        // Lower bar (mirror, fainter)
        ctx.fillStyle = `${color}40`;
        ctx.beginPath();
        ctx.roundRect(x, centerY + 2, barW, h * 0.5, 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Layer 3: Waveform line overlay
      ctx.beginPath();
      ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(16,185,129,0.6)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < numBars; i++) {
        const x = (i / numBars) * width;
        const val = values[i] || 0;
        const y = centerY - val * maxH * 0.8;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Particle effects when active
      if (isActive) {
        const particleCount = 8;
        for (let i = 0; i < particleCount; i++) {
          const px = (Math.sin(time * 2 + i) * 0.5 + 0.5) * width;
          const py = centerY + Math.cos(time * 3 + i * 2) * maxH * 0.5;
          const size = 2 + Math.sin(time * 5 + i) * 1.5;
          const alpha = 0.3 + Math.sin(time * 4 + i) * 0.2;

          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
          ctx.fill();
        }
      }
    };

    draw();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isActive, width, height, color, isDarkMode]);

  return (
    <div ref={containerRef} className="vt-visualizer-container" style={{ height }}>
      <div className="vt-visualizer-glow" style={{ background: `radial-gradient(ellipse at 50% 50%, ${color}25 0%, transparent 70%)` }} />
      <canvas ref={canvasRef} width={width} height={height} className="w-full h-full" style={{ width: '100%', height }} />
    </div>
  );
};

// ============================================
// MINI WAVEFORM VISUALIZER FOR MESSAGES
// ============================================

interface MiniWaveformProps {
  isPlaying: boolean;
  progress: number;
  duration: number;
  onSeek?: (position: number) => void;
  isDarkMode?: boolean;
}

const MiniWaveform: React.FC<MiniWaveformProps> = ({
  isPlaying,
  progress,
  duration,
  onSeek,
  isDarkMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const [width, setWidth] = useState(200);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverPosition, setHoverPosition] = useState(0);

  // Generate static waveform pattern (seeded by duration for consistency)
  const waveformData = useMemo(() => {
    const bars = Math.floor(width / 4);
    const data: number[] = [];
    const seed = duration * 1000;
    for (let i = 0; i < bars; i++) {
      const noise = Math.sin(seed + i * 0.5) * 0.3 + Math.cos(seed * 2 + i * 0.3) * 0.2;
      const envelope = Math.sin((i / bars) * Math.PI) * 0.4 + 0.3;
      data.push(Math.abs(noise + envelope) * 0.8 + 0.2);
    }
    return data;
  }, [width, duration]);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) setWidth(containerRef.current.offsetWidth);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const height = canvas.height;
      const centerY = height / 2;
      const barWidth = 2;
      const gap = 2;
      const maxBarHeight = height * 0.8;

      waveformData.forEach((value, i) => {
        const x = i * (barWidth + gap);
        const barHeight = value * maxBarHeight;
        const barProgress = x / width;

        // Color based on playback progress
        let color: string;
        if (barProgress <= progress) {
          color = MODE_COLOR;
        } else if (isHovering && barProgress <= hoverPosition) {
          color = isDarkMode ? 'rgba(52, 211, 153, 0.5)' : 'rgba(16, 185, 129, 0.5)';
        } else {
          color = isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)';
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 1);
        ctx.fill();
      });

      // Playhead
      if (isPlaying) {
        const playheadX = progress * width;
        ctx.fillStyle = MODE_COLOR;
        ctx.fillRect(playheadX - 1, 0, 2, height);
      }
    };

    draw();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [waveformData, progress, isPlaying, isHovering, hoverPosition, width, isDarkMode]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const position = Math.max(0, Math.min(1, x / rect.width));
    onSeek(position);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverPosition(Math.max(0, Math.min(1, x / rect.width)));
  };

  return (
    <div
      ref={containerRef}
      className="vt-mini-waveform"
      onClick={handleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={handleMouseMove}
    >
      <canvas ref={canvasRef} width={width} height={32} />
    </div>
  );
};

// ============================================
// INTERFACES
// ============================================

interface ExtendedVoiceThread extends VoiceThread {
  isPinned?: boolean;
  status?: ThreadStatus;
  unreadCount?: number;
  isMuted?: boolean;
  lastReadAt?: Date;
  tags?: string[];
}

interface ExtendedVoiceThreadMessage extends VoiceThreadMessage {
  reactions?: { emoji: string; userId: string; userName: string }[];
  isPinned?: boolean;
  isBookmarked?: boolean;
  isEdited?: boolean;
  forwardedFrom?: { threadId: string; threadName: string };
}

interface VoiceThreadsModeProps {
  contacts?: any[];
  apiKey?: string;
  onBack: () => void;
  isDarkMode?: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

const VoiceThreadsMode: React.FC<VoiceThreadsModeProps> = ({
  contacts = [],
  apiKey,
  onBack,
  isDarkMode = false,
}) => {
  // Thread state
  const [threads, setThreads] = useState<ExtendedVoiceThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ExtendedVoiceThread | null>(null);
  const [messages, setMessages] = useState<ExtendedVoiceThreadMessage[]>([]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Reply/Quote state
  const [replyingTo, setReplyingTo] = useState<ExtendedVoiceThreadMessage | null>(null);
  const [replyTimestamp, setReplyTimestamp] = useState<number | null>(null);
  const [quotingMessage, setQuotingMessage] = useState<ExtendedVoiceThreadMessage | null>(null);

  // UI state
  const [showNewThread, setShowNewThread] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [threadSubject, setThreadSubject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [pulseUsers, setPulseUsers] = useState<PulseUser[]>([]);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMessageActions, setShowMessageActions] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showThreadSettings, setShowThreadSettings] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);

  // Filter/Sort state
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('recent');
  const [showFilters, setShowFilters] = useState(false);

  // Bookmarks
  const [bookmarkedMessages, setBookmarkedMessages] = useState<Set<string>>(new Set());

  // Loading states
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  // Recording hook
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
      console.log('Voice Thread recording complete:', data.duration, 'seconds');
    },
  });

  // ============================================
  // LOAD PULSE USERS
  // ============================================

  useEffect(() => {
    const loadPulseUsers = async () => {
      const users = await voxModeService.getAllPulseUsers();
      const currentUserId = voxModeService.getUserId();
      const filteredUsers = users.filter(u => u.id !== currentUserId);
      setPulseUsers(filteredUsers);
    };
    loadPulseUsers();
  }, []);

  const availableContacts = useMemo(() => {
    if (pulseUsers.length > 0) {
      return pulseUsers.map(u => ({
        id: u.id,
        name: u.displayName,
        handle: u.handle,
        avatarColor: u.avatarColor,
      }));
    }
    return contacts.filter(c => c.pulse_handle || c.pulseHandle || c.handle);
  }, [pulseUsers, contacts]);

  // ============================================
  // LOAD THREADS
  // ============================================

  useEffect(() => {
    loadThreads();
  }, []);

  const loadThreads = async () => {
    setIsLoadingThreads(true);
    try {
      const data = await voxModeService.getMyVoiceThreads();
      // Extend with mock data for demo
      const extended: ExtendedVoiceThread[] = data.map((t, i) => ({
        ...t,
        isPinned: i === 0,
        status: i === 0 ? 'pinned' : 'active',
        unreadCount: Math.floor(Math.random() * 5),
        isMuted: false,
      }));
      setThreads(extended);
    } catch (error) {
      console.error('Failed to load threads:', error);
      toast.error('Failed to load threads');
    } finally {
      setIsLoadingThreads(false);
    }
  };

  // ============================================
  // LOAD MESSAGES
  // ============================================

  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread.id);
      setShowMobileSidebar(false);
    }
  }, [selectedThread]);

  const loadMessages = async (threadId: string) => {
    setIsLoadingMessages(true);
    try {
      const data = await voxModeService.getThreadMessages(threadId);
      // Extend with mock data for demo
      const extended: ExtendedVoiceThreadMessage[] = data.map((m, i) => ({
        ...m,
        reactions: i % 3 === 0 ? [{ emoji: '❤️', userId: 'demo', userName: 'Demo User' }] : [],
        isPinned: i === 0,
        isBookmarked: bookmarkedMessages.has(m.id),
      }));
      setMessages(extended);
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ============================================
  // SEND RECORDING
  // ============================================

  const handleSendRecording = async () => {
    if (!recordingData || !selectedThread) {
      console.error('Cannot send: no recording data or selected thread');
      return;
    }

    try {
      const message = await voxModeService.uploadAndSendVoiceThreadMessage(
        selectedThread.id,
        recordingData.blob,
        recordingData.duration,
        replyingTo?.id,
        replyTimestamp || undefined,
        replyingTo?.transcript?.slice(0, 100)
      );

      if (message) {
        const extendedMessage: ExtendedVoiceThreadMessage = {
          ...message,
          reactions: [],
          isPinned: false,
          isBookmarked: false,
        };
        setMessages(prev => [...prev, extendedMessage]);

        analyticsCollector.trackMessageEvent({
          id: message.id,
          channel: 'voxer',
          contactIdentifier: selectedThread.id,
          contactName: selectedThread.subject || 'Voice Thread',
          isSent: true,
          timestamp: new Date(),
          content: '[Voice Thread Message]',
          threadId: selectedThread.id,
          replyToId: replyingTo?.id,
          duration: recordingData.duration,
          messageType: 'voice_thread'
        }).catch(err => console.error('Analytics tracking failed:', err));

        toast.success('Message sent!');
      } else {
        toast.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending voice thread message:', error);
      toast.error('Error sending message');
    }

    sendRecording();
    setReplyingTo(null);
    setReplyTimestamp(null);
    setQuotingMessage(null);
  };

  // ============================================
  // RECORDING TOGGLE
  // ============================================

  const handleRecordToggle = () => {
    if (recordingState === 'recording') {
      stopRecording();
    } else if (recordingState === 'idle') {
      startRecording();
    }
  };

  // ============================================
  // CREATE THREAD
  // ============================================

  const handleCreateThread = async () => {
    if (selectedParticipants.length === 0 || isCreatingThread) return;

    setIsCreatingThread(true);
    try {
      const thread = await voxModeService.createVoiceThread(
        selectedParticipants,
        threadSubject || undefined
      );

      if (thread) {
        const extendedThread: ExtendedVoiceThread = {
          ...thread,
          isPinned: false,
          status: 'active',
          unreadCount: 0,
          isMuted: false,
        };
        setThreads([extendedThread, ...threads]);
        setSelectedThread(extendedThread);
        setShowNewThread(false);
        setSelectedParticipants([]);
        setThreadSubject('');
        toast.success('Thread created!');
      } else {
        toast.error('Failed to create thread');
      }
    } catch (error) {
      console.error('Error creating thread:', error);
      toast.error('Error creating thread');
    } finally {
      setIsCreatingThread(false);
    }
  };

  // ============================================
  // PLAYBACK
  // ============================================

  const handlePlayMessage = useCallback((message: ExtendedVoiceThreadMessage) => {
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
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.play();
        setPlayingMessageId(message.id);
        setIsPlaying(true);
      }
    }
  }, [playingMessageId, isPlaying, playbackSpeed]);

  const handleSeek = useCallback((position: number) => {
    if (audioRef.current && playingMessageId) {
      audioRef.current.currentTime = position * audioRef.current.duration;
    }
  }, [playingMessageId]);

  const cyclePlaybackSpeed = useCallback(() => {
    const speeds = [1, 1.25, 1.5, 2, 0.75];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
    toast.success(`Playback speed: ${newSpeed}x`);
  }, [playbackSpeed]);

  // ============================================
  // MESSAGE ACTIONS
  // ============================================

  const handleReply = useCallback((message: ExtendedVoiceThreadMessage, timestamp?: number) => {
    setReplyingTo(message);
    setReplyTimestamp(timestamp || null);
    setShowMessageActions(null);
  }, []);

  const handleQuote = useCallback((message: ExtendedVoiceThreadMessage) => {
    setQuotingMessage(message);
    setShowMessageActions(null);
  }, []);

  const handleTogglePin = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, isPinned: !m.isPinned } : m
    ));
    toast.success('Message pin toggled');
    setShowMessageActions(null);
  }, []);

  const handleToggleBookmark = useCallback((messageId: string) => {
    setBookmarkedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
        toast.success('Bookmark removed');
      } else {
        next.add(messageId);
        toast.success('Message bookmarked');
      }
      return next;
    });
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, isBookmarked: !m.isBookmarked } : m
    ));
    setShowMessageActions(null);
  }, []);

  const handleAddReaction = useCallback((messageId: string, emoji: string) => {
    const userId = voxModeService.getUserId();
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const existingReaction = m.reactions?.find(r => r.emoji === emoji && r.userId === userId);
      if (existingReaction) {
        return { ...m, reactions: m.reactions?.filter(r => !(r.emoji === emoji && r.userId === userId)) };
      } else {
        return {
          ...m,
          reactions: [...(m.reactions || []), { emoji, userId, userName: 'You' }]
        };
      }
    }));
    setShowReactionPicker(null);
  }, []);

  // ============================================
  // THREAD ACTIONS
  // ============================================

  const handleToggleThreadPin = useCallback((threadId: string) => {
    setThreads(prev => prev.map(t =>
      t.id === threadId ? { ...t, isPinned: !t.isPinned, status: !t.isPinned ? 'pinned' : 'active' } : t
    ));
    toast.success('Thread pin toggled');
  }, []);

  const handleToggleThreadMute = useCallback((threadId: string) => {
    setThreads(prev => prev.map(t =>
      t.id === threadId ? { ...t, isMuted: !t.isMuted } : t
    ));
    toast.success('Thread mute toggled');
    setShowThreadSettings(false);
  }, []);

  const handleArchiveThread = useCallback((threadId: string) => {
    setThreads(prev => prev.map(t =>
      t.id === threadId ? { ...t, status: 'archived' } : t
    ));
    toast.success('Thread archived');
    setShowThreadSettings(false);
    if (selectedThread?.id === threadId) {
      setSelectedThread(null);
    }
  }, [selectedThread]);

  // ============================================
  // FILTERING & SORTING
  // ============================================

  const filteredAndSortedThreads = useMemo(() => {
    let result = [...threads];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => {
        const participantNames = getParticipantNames(t).toLowerCase();
        return participantNames.includes(query) || t.subject?.toLowerCase().includes(query);
      });
    }

    // Apply type filter
    switch (filterType) {
      case 'unread':
        result = result.filter(t => (t.unreadCount || 0) > 0);
        break;
      case 'pinned':
        result = result.filter(t => t.isPinned);
        break;
      case 'archived':
        result = result.filter(t => t.status === 'archived');
        break;
      default:
        result = result.filter(t => t.status !== 'archived');
    }

    // Apply sorting
    switch (sortType) {
      case 'oldest':
        result.sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime());
        break;
      case 'most_active':
        result.sort((a, b) => b.messageCount - a.messageCount);
        break;
      case 'unread_first':
        result.sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0));
        break;
      default:
        result.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
    }

    // Always keep pinned threads at top (except in archived view)
    if (filterType !== 'archived') {
      const pinned = result.filter(t => t.isPinned);
      const unpinned = result.filter(t => !t.isPinned);
      result = [...pinned, ...unpinned];
    }

    return result;
  }, [threads, searchQuery, filterType, sortType]);

  // ============================================
  // HELPERS
  // ============================================

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
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getParticipantNames = (thread: ExtendedVoiceThread) => {
    const userId = voxModeService.getUserId();
    const otherParticipants = thread.participants.filter(p => p !== userId);
    const names = otherParticipants.map(id => {
      const contact = availableContacts.find(c => c.id === id);
      return contact?.name || 'Unknown';
    });
    return names.join(', ');
  };

  const getParticipantInitial = (thread: ExtendedVoiceThread) => {
    const userId = voxModeService.getUserId();
    const otherParticipants = thread.participants.filter(p => p !== userId);
    if (otherParticipants.length === 0) return '?';
    const contact = availableContacts.find(c => c.id === otherParticipants[0]);
    return contact?.name?.charAt(0).toUpperCase() || '?';
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={`voice-threads ${isDarkMode ? 'dark' : 'light'}`}>
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

      {/* Header */}
      <header className="vt-header">
        <button type="button" onClick={onBack} className="vt-back-btn" title="Back">
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setShowMobileSidebar(true)}
          className="vt-mobile-menu md:hidden"
          title="Show threads"
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        <div className="vt-title">
          <div className="vt-title-icon">
            <MessageSquare className="w-5 h-5" />
            <div className="vt-title-notch" />
          </div>
          <div className="hidden sm:block">
            <h1>Voice Threads</h1>
            <span className="vt-subtitle">Conversations That Flow</span>
          </div>
        </div>

        {/* Thread count indicator */}
        <div className="vt-header-stats">
          <div className="vt-stat">
            <MessageCircle className="w-4 h-4" />
            <span>{threads.length}</span>
          </div>
          {threads.filter(t => (t.unreadCount || 0) > 0).length > 0 && (
            <div className="vt-stat vt-stat-unread">
              <span>{threads.filter(t => (t.unreadCount || 0) > 0).length} unread</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowNewThread(true)}
          className="vt-new-btn"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Thread</span>
        </button>
      </header>

      <div className="vt-body">
        {/* Mobile Sidebar Overlay */}
        {showMobileSidebar && (
          <div className="vt-mobile-sidebar-overlay">
            <div className="vt-mobile-backdrop" onClick={() => setShowMobileSidebar(false)} />
            <aside className="vt-mobile-sidebar">
              <div className="vt-sidebar-header">
                <h2>Threads</h2>
                <button type="button" onClick={() => setShowMobileSidebar(false)} title="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search */}
              <div className="vt-search">
                <Search className="vt-search-icon" />
                <input
                  type="text"
                  placeholder="Search threads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Filters */}
              <div className="vt-filter-bar">
                <button
                  type="button"
                  className={`vt-filter-chip ${filterType === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterType('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`vt-filter-chip ${filterType === 'unread' ? 'active' : ''}`}
                  onClick={() => setFilterType('unread')}
                >
                  Unread
                </button>
                <button
                  type="button"
                  className={`vt-filter-chip ${filterType === 'pinned' ? 'active' : ''}`}
                  onClick={() => setFilterType('pinned')}
                >
                  <Pin className="w-3 h-3" />
                </button>
              </div>

              {/* Thread List */}
              <div className="vt-thread-list">
                {isLoadingThreads ? (
                  <div className="vt-loading">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Loading threads...</span>
                  </div>
                ) : filteredAndSortedThreads.length === 0 ? (
                  <div className="vt-empty-threads">
                    <MessageSquare className="w-12 h-12" />
                    <p>No threads found</p>
                    <span>Start a new conversation</span>
                  </div>
                ) : (
                  filteredAndSortedThreads.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => setSelectedThread(thread)}
                      className={`vt-thread-item ${selectedThread?.id === thread.id ? 'active' : ''} ${thread.isPinned ? 'pinned' : ''}`}
                    >
                      <div className="vt-thread-avatar">
                        {getParticipantInitial(thread)}
                        {thread.isPinned && <Pin className="vt-thread-pin-badge" />}
                      </div>
                      <div className="vt-thread-info">
                        <div className="vt-thread-header">
                          <span className="vt-thread-name">
                            {thread.subject || getParticipantNames(thread)}
                          </span>
                          <span className="vt-thread-time">{formatTime(thread.lastActivityAt)}</span>
                        </div>
                        <div className="vt-thread-meta">
                          <span className="vt-thread-count">{thread.messageCount} messages</span>
                          {(thread.unreadCount || 0) > 0 && (
                            <span className="vt-unread-badge">{thread.unreadCount}</span>
                          )}
                          {thread.isMuted && <VolumeX className="w-3 h-3 vt-muted-icon" />}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </aside>
          </div>
        )}

        {/* Desktop Sidebar */}
        <aside className="vt-sidebar">
          <div className="vt-sidebar-header">
            <h2>Threads</h2>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`vt-filter-toggle ${showFilters ? 'active' : ''}`}
              title="Filters"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="vt-search">
            <Search className="vt-search-icon" />
            <input
              type="text"
              placeholder="Search threads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="vt-filters-panel">
              <div className="vt-filter-group">
                <label>Filter</label>
                <div className="vt-filter-options">
                  {(['all', 'unread', 'pinned', 'archived'] as FilterType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`vt-filter-chip ${filterType === type ? 'active' : ''}`}
                      onClick={() => setFilterType(type)}
                    >
                      {type === 'pinned' && <Pin className="w-3 h-3" />}
                      {type === 'archived' && <Archive className="w-3 h-3" />}
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="vt-filter-group">
                <label>Sort</label>
                <select
                  value={sortType}
                  onChange={(e) => setSortType(e.target.value as SortType)}
                  className="vt-sort-select"
                >
                  <option value="recent">Most Recent</option>
                  <option value="oldest">Oldest First</option>
                  <option value="most_active">Most Active</option>
                  <option value="unread_first">Unread First</option>
                </select>
              </div>
            </div>
          )}

          {/* Quick Filter Chips */}
          {!showFilters && (
            <div className="vt-filter-bar">
              <button
                type="button"
                className={`vt-filter-chip ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`vt-filter-chip ${filterType === 'unread' ? 'active' : ''}`}
                onClick={() => setFilterType('unread')}
              >
                Unread
              </button>
              <button
                type="button"
                className={`vt-filter-chip ${filterType === 'pinned' ? 'active' : ''}`}
                onClick={() => setFilterType('pinned')}
              >
                <Pin className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Thread List */}
          <div className="vt-thread-list">
            {isLoadingThreads ? (
              <div className="vt-loading">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading threads...</span>
              </div>
            ) : filteredAndSortedThreads.length === 0 ? (
              <div className="vt-empty-threads">
                <MessageSquare className="w-12 h-12" />
                <p>No threads found</p>
                <span>Start a new conversation</span>
              </div>
            ) : (
              filteredAndSortedThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThread(thread)}
                  className={`vt-thread-item ${selectedThread?.id === thread.id ? 'active' : ''} ${thread.isPinned ? 'pinned' : ''}`}
                >
                  <div className="vt-thread-avatar">
                    {getParticipantInitial(thread)}
                    {thread.isPinned && <Pin className="vt-thread-pin-badge" />}
                  </div>
                  <div className="vt-thread-info">
                    <div className="vt-thread-header">
                      <span className="vt-thread-name">
                        {thread.subject || getParticipantNames(thread)}
                      </span>
                      <span className="vt-thread-time">{formatTime(thread.lastActivityAt)}</span>
                    </div>
                    <div className="vt-thread-meta">
                      <span className="vt-thread-count">{thread.messageCount} messages</span>
                      {(thread.unreadCount || 0) > 0 && (
                        <span className="vt-unread-badge">{thread.unreadCount}</span>
                      )}
                      {thread.isMuted && <VolumeX className="w-3 h-3 vt-muted-icon" />}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="vt-main">
          {selectedThread ? (
            <>
              {/* Thread Header */}
              <div className="vt-thread-header-bar">
                <div className="vt-thread-hero">
                  <div className="vt-thread-hero-icon">
                    <MessageSquare className="w-6 h-6" />
                    <div className="vt-thread-hero-rings">
                      <div className="ring ring-1" />
                      <div className="ring ring-2" />
                    </div>
                  </div>
                  <div className="vt-thread-hero-info">
                    <h2>{selectedThread.subject || getParticipantNames(selectedThread)}</h2>
                    <div className="vt-thread-hero-meta">
                      <span><Users className="w-3 h-3" /> {selectedThread.participants.length}</span>
                      <span><MessageCircle className="w-3 h-3" /> {selectedThread.messageCount}</span>
                      {selectedThread.isPinned && (
                        <span className="vt-pinned-label"><Pin className="w-3 h-3" /> Pinned</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="vt-thread-actions">
                  <button
                    type="button"
                    onClick={() => handleToggleThreadPin(selectedThread.id)}
                    className={`vt-action-btn ${selectedThread.isPinned ? 'active' : ''}`}
                    title={selectedThread.isPinned ? 'Unpin thread' : 'Pin thread'}
                  >
                    <Pin className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowThreadSettings(true)}
                    className="vt-action-btn"
                    title="Thread settings"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Pinned Messages Banner */}
              {messages.filter(m => m.isPinned).length > 0 && (
                <div className="vt-pinned-banner">
                  <Pin className="w-4 h-4" />
                  <span>{messages.filter(m => m.isPinned).length} pinned message(s)</span>
                  <button type="button" className="vt-view-pinned">View</button>
                </div>
              )}

              {/* Messages */}
              <div ref={messageContainerRef} className="vt-messages">
                {isLoadingMessages ? (
                  <div className="vt-loading">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Loading messages...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="vt-empty-messages">
                    <Sparkles className="w-12 h-12" />
                    <p>Start the conversation</p>
                    <span>Record your first message below</span>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isMe = message.senderId === voxModeService.getUserId();
                    const isCurrentlyPlaying = playingMessageId === message.id;

                    return (
                      <div
                        key={message.id}
                        className={`vt-message ${isMe ? 'vt-message-mine' : 'vt-message-other'} ${message.isPinned ? 'vt-message-pinned' : ''}`}
                      >
                        {/* Pinned indicator */}
                        {message.isPinned && (
                          <div className="vt-message-pinned-indicator">
                            <Pin className="w-3 h-3" />
                            <span>Pinned</span>
                          </div>
                        )}

                        {/* Reply Quote */}
                        {message.replyToId && (
                          <div className="vt-message-reply-quote">
                            <Reply className="w-3 h-3" />
                            <span>Replying to</span>
                            {message.quotedText && (
                              <p>"{message.quotedText}"</p>
                            )}
                            {message.replyToTimestamp && (
                              <span className="vt-reply-timestamp">at {formatDuration(message.replyToTimestamp)}</span>
                            )}
                          </div>
                        )}

                        {/* Sender */}
                        {!isMe && (
                          <div className="vt-message-sender">
                            <span>{message.senderName}</span>
                          </div>
                        )}

                        {/* Audio Player */}
                        <div className="vt-message-player">
                          <button
                            type="button"
                            onClick={() => handlePlayMessage(message)}
                            className={`vt-play-btn ${isCurrentlyPlaying && isPlaying ? 'playing' : ''}`}
                          >
                            {isCurrentlyPlaying && isPlaying ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 ml-0.5" />
                            )}
                          </button>
                          <div className="vt-message-waveform">
                            <MiniWaveform
                              isPlaying={isCurrentlyPlaying && isPlaying}
                              progress={isCurrentlyPlaying ? playbackProgress : 0}
                              duration={message.duration}
                              onSeek={isCurrentlyPlaying ? handleSeek : undefined}
                              isDarkMode={isDarkMode}
                            />
                          </div>
                          <span className="vt-message-duration">{formatDuration(message.duration)}</span>
                          {isCurrentlyPlaying && (
                            <button
                              type="button"
                              onClick={cyclePlaybackSpeed}
                              className="vt-speed-btn"
                              title="Change playback speed"
                            >
                              {playbackSpeed}x
                            </button>
                          )}
                        </div>

                        {/* Transcript */}
                        {message.transcript && (
                          <p className="vt-message-transcript">{message.transcript}</p>
                        )}

                        {/* Reactions */}
                        {message.reactions && message.reactions.length > 0 && (
                          <div className="vt-message-reactions">
                            {message.reactions.map((reaction, i) => (
                              <span key={`${reaction.emoji}-${i}`} className="vt-reaction">
                                {reaction.emoji}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="vt-message-footer">
                          <span className="vt-message-time">{formatTime(message.createdAt)}</span>
                          <div className="vt-message-actions-row">
                            {/* Quick reaction */}
                            <button
                              type="button"
                              onClick={() => setShowReactionPicker(showReactionPicker === message.id ? null : message.id)}
                              className="vt-quick-action"
                              title="Add reaction"
                            >
                              <Smile className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReply(message)}
                              className="vt-quick-action"
                              title="Reply"
                            >
                              <Reply className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowMessageActions(showMessageActions === message.id ? null : message.id)}
                              className="vt-quick-action"
                              title="More actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Read receipts */}
                          {isMe && (
                            <div className="vt-read-receipt">
                              {message.readBy.length > 1 ? (
                                <CheckCheck className="w-4 h-4" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Reaction Picker */}
                        {showReactionPicker === message.id && (
                          <div className="vt-reaction-picker">
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleAddReaction(message.id, emoji)}
                                className="vt-reaction-btn"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Message Actions Menu */}
                        {showMessageActions === message.id && (
                          <div className="vt-message-actions-menu">
                            <button type="button" onClick={() => handleReply(message)}>
                              <Reply className="w-4 h-4" /> Reply
                            </button>
                            <button type="button" onClick={() => handleQuote(message)}>
                              <Quote className="w-4 h-4" /> Quote
                            </button>
                            <button type="button" onClick={() => handleTogglePin(message.id)}>
                              <Pin className="w-4 h-4" /> {message.isPinned ? 'Unpin' : 'Pin'}
                            </button>
                            <button type="button" onClick={() => handleToggleBookmark(message.id)}>
                              {message.isBookmarked ? <Bookmark className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                              {message.isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
                            </button>
                            <button type="button">
                              <Forward className="w-4 h-4" /> Forward
                            </button>
                            <button type="button">
                              <Copy className="w-4 h-4" /> Copy Link
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Indicator */}
              {(replyingTo || quotingMessage) && (
                <div className="vt-reply-indicator">
                  <div className="vt-reply-content">
                    {replyingTo && (
                      <>
                        <Reply className="w-4 h-4" />
                        <span>Replying to <strong>{replyingTo.senderName}</strong></span>
                        {replyTimestamp && <span className="vt-reply-ts">at {formatDuration(replyTimestamp)}</span>}
                      </>
                    )}
                    {quotingMessage && (
                      <>
                        <Quote className="w-4 h-4" />
                        <span>Quoting <strong>{quotingMessage.senderName}</strong></span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyTimestamp(null);
                      setQuotingMessage(null);
                    }}
                    className="vt-reply-cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Recording Area */}
              <div className="vt-record-section">
                {recordingState === 'preview' && recordingData ? (
                  <div className="vt-preview-area">
                    <RecordingPreview
                      recordingData={recordingData}
                      onSend={handleSendRecording}
                      onCancel={() => {
                        cancelRecording();
                        setReplyingTo(null);
                        setReplyTimestamp(null);
                        setQuotingMessage(null);
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
                  <div className="vt-record-ui">
                    <button
                      type="button"
                      onClick={handleRecordToggle}
                      className={`vt-record-btn ${recordingState === 'recording' ? 'recording' : ''}`}
                    >
                      {recordingState === 'recording' ? (
                        <>
                          <Square className="w-5 h-5" />
                          <div className="vt-record-pulse" />
                        </>
                      ) : (
                        <Mic className="w-5 h-5" />
                      )}
                    </button>

                    {recordingState === 'recording' ? (
                      <div className="vt-recording-info">
                        <div className="vt-recording-indicator">
                          <div className="vt-recording-dot" />
                          <span>Recording</span>
                        </div>
                        <span className="vt-recording-duration">
                          {formatDuration(recordingDuration)}
                        </span>
                      </div>
                    ) : (
                      <p className="vt-record-hint">Click to record a message</p>
                    )}

                    {recordingState === 'recording' && (
                      <div className="vt-live-visualizer">
                        <LayeredVisualizer
                          analyser={analyser}
                          isActive={true}
                          height={60}
                          color={MODE_COLOR}
                          isDarkMode={isDarkMode}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="vt-empty-state">
              <div className="vt-empty-icon">
                <MessageSquare className="w-10 h-10" />
                <div className="vt-empty-rings">
                  <div className="ring ring-1" />
                  <div className="ring ring-2" />
                  <div className="ring ring-3" />
                </div>
              </div>
              <p>Select a thread to continue</p>
              <span>or start a new conversation</span>
              <button type="button" onClick={() => setShowNewThread(true)} className="vt-empty-cta">
                <Plus className="w-4 h-4" />
                Start New Thread
              </button>
            </div>
          )}
        </main>
      </div>

      {/* New Thread Modal */}
      {showNewThread && (
        <div className="vt-modal-overlay">
          <div className="vt-modal-backdrop" onClick={() => setShowNewThread(false)} />
          <div className="vt-modal">
            <div className="vt-modal-header">
              <div className="vt-modal-icon">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3>Start Voice Thread</h3>
              <button type="button" onClick={() => setShowNewThread(false)} title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="vt-modal-form">
              <div className="vt-form-group">
                <label>Subject (Optional)</label>
                <input
                  type="text"
                  value={threadSubject}
                  onChange={(e) => setThreadSubject(e.target.value)}
                  placeholder="What's this about?"
                />
              </div>

              <div className="vt-form-group">
                <label>Participants (Pulse Users)</label>
                <div className="vt-participant-list">
                  {availableContacts.length === 0 ? (
                    <div className="vt-no-contacts">No Pulse users found</div>
                  ) : (
                    availableContacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => {
                          if (selectedParticipants.includes(contact.id)) {
                            setSelectedParticipants(selectedParticipants.filter(p => p !== contact.id));
                          } else {
                            setSelectedParticipants([...selectedParticipants, contact.id]);
                          }
                        }}
                        className={`vt-participant ${selectedParticipants.includes(contact.id) ? 'selected' : ''}`}
                      >
                        <div className="vt-participant-avatar" style={{ backgroundColor: contact.avatarColor }}>
                          {contact.name.charAt(0)}
                        </div>
                        <div className="vt-participant-info">
                          <span>{contact.name}</span>
                          {contact.handle && <span className="vt-participant-handle">@{contact.handle}</span>}
                        </div>
                        {selectedParticipants.includes(contact.id) && (
                          <Check className="w-4 h-4 vt-check" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="vt-modal-actions">
              <button type="button" onClick={() => setShowNewThread(false)} className="vt-cancel-btn" disabled={isCreatingThread}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateThread}
                className="vt-submit-btn"
                disabled={selectedParticipants.length === 0 || isCreatingThread}
              >
                {isCreatingThread ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Start Thread'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thread Settings Modal */}
      {showThreadSettings && selectedThread && (
        <div className="vt-modal-overlay">
          <div className="vt-modal-backdrop" onClick={() => setShowThreadSettings(false)} />
          <div className="vt-modal">
            <div className="vt-modal-header">
              <h3>Thread Settings</h3>
              <button type="button" onClick={() => setShowThreadSettings(false)} title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="vt-settings-content">
              <div className="vt-settings-hero">
                <div className="vt-settings-icon">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <div>
                  <h4>{selectedThread.subject || getParticipantNames(selectedThread)}</h4>
                  <span>{selectedThread.participants.length} participants</span>
                </div>
              </div>

              <div className="vt-settings-section">
                <h5>Notifications</h5>
                <button
                  type="button"
                  onClick={() => handleToggleThreadMute(selectedThread.id)}
                  className="vt-settings-option"
                >
                  <div className="vt-option-icon">
                    {selectedThread.isMuted ? <VolumeX className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                  </div>
                  <div className="vt-option-info">
                    <p>{selectedThread.isMuted ? 'Unmute Thread' : 'Mute Thread'}</p>
                    <span>{selectedThread.isMuted ? 'Turn on notifications' : 'Turn off notifications'}</span>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="vt-settings-section">
                <h5>Actions</h5>
                <div className="vt-settings-actions">
                  <button type="button" onClick={() => handleToggleThreadPin(selectedThread.id)}>
                    <Pin className="w-5 h-5" /> {selectedThread.isPinned ? 'Unpin Thread' : 'Pin Thread'}
                  </button>
                  <button type="button">
                    <Users className="w-5 h-5" /> Manage Participants
                  </button>
                  <button type="button">
                    <Edit3 className="w-5 h-5" /> Edit Subject
                  </button>
                  <button type="button" onClick={() => handleArchiveThread(selectedThread.id)} className="danger">
                    <Archive className="w-5 h-5" /> Archive Thread
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceThreadsMode;
