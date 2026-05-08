import React, { useState, useRef, useCallback, useEffect, useMemo, Suspense, lazy } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  X,
  Settings,
  FileText,
  Share2,
  Download,
  Archive,
  Mail,
  Copy,
  Trash2,
  Plus,
  ChevronDown,
  Volume2,
  VolumeX,
  Brain,
  Clock,
  Check,
  Edit3,
  ExternalLink,
  Loader2,
  AlertCircle,
  Paperclip,
  CloudUpload,
  FolderOpen,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePulseAI } from '../../contexts/PulseAIContext';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import {
  RealtimeVoiceAgentRef,
  VoiceSettings,
  ContextFile,
  AIParticipantMode,
} from '../WarRoom/RealtimeVoiceAgent';
import { RealtimeHistoryItem } from '../../services/realtimeAgentService';
import TranscriptBreathing, { type RailLine, type VoiceState } from './TranscriptBreathing';
import SessionsCanvas, { type LiveSessionView } from './SessionsCanvas';
import {
  loadVoiceSessions,
  saveVoiceSession,
  deleteVoiceSession,
  summarizeForTakeaway,
  formatDuration,
  type VoiceSessionRecord,
  type StoredVoiceNote,
} from './voiceSessionStore';
import './PulseVoiceChat.css';

const RealtimeVoiceAgent = lazy(() =>
  import('../WarRoom/RealtimeVoiceAgent').then((m) => ({ default: m.RealtimeVoiceAgent }))
);

export interface VoiceNote {
  id: string;
  content: string;
  timestamp: Date;
  type: 'auto' | 'manual' | 'highlight';
  speaker?: 'user' | 'assistant';
  duration?: number;
  isEditing?: boolean;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioLevel?: number;
}

interface PulseVoiceChatProps {
  apiKey?: string;
  userId?: string;
  onClose: () => void;
  onSendToArchive?: (notes: VoiceNote[]) => void;
  onSendToEmail?: (notes: VoiceNote[]) => void;
}

const isMobilePlatform =
  Capacitor.isNativePlatform() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const EXAMPLE_PROMPTS = [
  'Summarize my unread Pulse messages',
  'Review my next 3 meetings',
  'Draft replies to overdue threads',
];

const RAIL_LINE_MAX = 60;

const truncateForRail = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.length <= RAIL_LINE_MAX) return trimmed;
  return trimmed.slice(0, RAIL_LINE_MAX - 1) + '…';
};

const PulseVoiceChat: React.FC<PulseVoiceChatProps> = ({
  apiKey,
  userId = 'anonymous',
  onClose,
  onSendToArchive,
  onSendToEmail,
}) => {
  /* ── Token resolution ─────────────────────────────────────── */
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [isResolvingToken, setIsResolvingToken] = useState<boolean>(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenAttempt, setTokenAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const resolveToken = async () => {
      setIsResolvingToken(true);
      setTokenError(null);
      try {
        if (apiKey) {
          if (!cancelled) {
            setOpenaiApiKey(apiKey);
            setIsResolvingToken(false);
          }
          return;
        }
        const { supabase } = await import('../../services/supabase');
        const { data, error } = await supabase.functions.invoke('openai-realtime-token', {
          body: { model: 'gpt-4o-realtime-preview', voice: 'alloy' },
        });
        if (cancelled) return;

        // Distinguish auth (401) failures from upstream/runtime failures so the
        // recovery path can be specific. Supabase's FunctionsHttpError surfaces
        // the status either on `error.context.status` or in the message.
        const status =
          (error as any)?.context?.status ??
          (error as any)?.status ??
          (typeof error?.message === 'string' && /401|unauthorized/i.test(error.message)
            ? 401
            : undefined);

        if (error || !data?.token) {
          if (status === 401) {
            setTokenError('Your sign-in expired. Reload Pulse or sign in again to reconnect voice.');
          } else {
            setTokenError('OpenAI Realtime is temporarily unavailable. Try again in a moment.');
          }
          setOpenaiApiKey('');
        } else {
          setOpenaiApiKey(data.token);
        }
      } catch {
        if (!cancelled) {
          setTokenError('OpenAI Realtime is temporarily unavailable. Try again in a moment.');
          setOpenaiApiKey('');
        }
      } finally {
        if (!cancelled) setIsResolvingToken(false);
      }
    };
    resolveToken();
    return () => {
      cancelled = true;
    };
  }, [apiKey, tokenAttempt]);

  const retryToken = useCallback(() => {
    setTokenAttempt((n) => n + 1);
  }, []);

  /* ── Voice + session state ────────────────────────────────── */
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const sessionIdRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [history, setHistory] = useState<RealtimeHistoryItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<VoiceSessionRecord[]>([]);

  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  const [autoNotes, setAutoNotes] = useState(true);
  const [newNoteText, setNewNoteText] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voice: 'alloy',
    turnDetection: 'semantic_vad',
    noiseReduction: 'near_field',
    language: 'en',
  });
  const [aiMode, setAiMode] = useState<AIParticipantMode>('active');

  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [contextText, setContextText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const agentRef = useRef<RealtimeVoiceAgentRef>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const isNative = Capacitor.isNativePlatform();

  /* ── Pulse AI bridge ──────────────────────────────────────── */
  const pulseAI = usePulseAI();
  const pulseDataPrompt = pulseAI.buildPulseDataPrompt();

  useEffect(() => {
    pulseAI.setIsVoiceActive(true);
    return () => pulseAI.setIsVoiceActive(false);
  }, [pulseAI]);

  const effectiveContextFiles = useMemo<ContextFile[]>(() => {
    if (!pulseDataPrompt || pulseDataPrompt === 'No Pulse data context available.') {
      return contextFiles;
    }
    const pulseContextFile: ContextFile = {
      id: 'pulse-data-context',
      name: 'Pulse App Data',
      content: `You are Pulse AI voice assistant. You have access to the user's live Pulse data.\n\n${pulseDataPrompt}`,
      type: 'text',
    };
    return [pulseContextFile, ...contextFiles];
  }, [contextFiles, pulseDataPrompt]);

  /* ── Past sessions hydration ──────────────────────────────── */
  useEffect(() => {
    setRecentSessions(loadVoiceSessions());
  }, []);

  /* ── Helpers ──────────────────────────────────────────────── */
  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  const extractKeyPhrases = (text: string): string | null => {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    const importantPatterns =
      /\b(should|must|important|key|note|remember|action|todo|deadline|decision|agreed|confirmed|next steps?|follow[- ]?up)\b/i;
    const importantSentences = sentences.filter((s) => importantPatterns.test(s));
    return importantSentences[0]?.trim() ?? null;
  };

  const addNote = useCallback((note: VoiceNote) => {
    setNotes((prev) => [...prev, note]);
    setTimeout(() => {
      if (notesContainerRef.current) {
        notesContainerRef.current.scrollTop = notesContainerRef.current.scrollHeight;
      }
    }, 100);
  }, []);

  const handleQuickCapture = useCallback(() => {
    addNote({
      id: generateId(),
      content: `Capture at ${new Date().toLocaleTimeString()}`,
      timestamp: new Date(),
      type: 'highlight',
    });
    toast.success('Pinned to session', { duration: 1400 });
  }, [addNote]);

  /* ── Voice agent callbacks ────────────────────────────────── */
  const handleConnectionChange = useCallback((connected: boolean, connecting: boolean) => {
    setIsConnected(connected);
    setIsConnecting(connecting);
    if (connected) {
      setVoiceState('listening');
      if (!sessionIdRef.current) sessionIdRef.current = generateId();
      toast.success('Connected', { duration: 1400 });
    } else if (!connecting) {
      setVoiceState('idle');
    } else {
      setVoiceState('connecting');
    }
  }, []);

  const handleTranscript = useCallback(
    (text: string, role: 'user' | 'assistant', isFinal: boolean) => {
      setCurrentTranscript(text);

      if (role === 'user') {
        setVoiceState(isFinal ? 'thinking' : 'listening');
      } else {
        setVoiceState(isFinal ? 'listening' : 'speaking');
      }

      if (isFinal && text.trim()) {
        const newMessage: ConversationMessage = {
          id: generateId(),
          role,
          content: text,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMessage]);

        if (role === 'assistant' && autoNotes) {
          const keyPhrase = extractKeyPhrases(text);
          if (keyPhrase) {
            addNote({
              id: generateId(),
              content: keyPhrase,
              timestamp: new Date(),
              type: 'auto',
              speaker: 'assistant',
            });
          }
        }
      }
    },
    [autoNotes, addNote]
  );

  const handleAudioLevel = useCallback(
    (level: number, isListening: boolean, isSpeaking: boolean) => {
      setAudioLevel(level);
      if (isConnected && !isPaused) {
        if (isSpeaking) setVoiceState('speaking');
        else if (isListening) setVoiceState('listening');
      }
    },
    [isConnected, isPaused]
  );

  const handleHistoryUpdate = useCallback((newHistory: RealtimeHistoryItem[]) => {
    setHistory(newHistory);
    const lastItem = newHistory[newHistory.length - 1];
    if (lastItem?.type === 'function_call') setVoiceState('thinking');
  }, []);

  /* ── Notes export ─────────────────────────────────────────── */
  const formatNotesForExport = useCallback(
    (format: 'text' | 'markdown' | 'json'): string => {
      const header = `Pulse Chat Notes\nSession: ${new Date().toLocaleString()}\n`;
      switch (format) {
        case 'markdown':
          return `# ${header}\n\n${notes
            .map(
              (n) =>
                `- **[${n.type.toUpperCase()}]** ${n.content}\n  *${n.timestamp.toLocaleTimeString()}*`
            )
            .join('\n\n')}`;
        case 'json':
          return JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              sessionId: userId,
              notes: notes.map((n) => ({
                content: n.content,
                type: n.type,
                timestamp: n.timestamp.toISOString(),
                speaker: n.speaker,
              })),
            },
            null,
            2
          );
        default:
          return `${header}${'='.repeat(40)}\n\n${notes
            .map(
              (n) =>
                `[${n.type.toUpperCase()}] ${n.content}\n  - ${n.timestamp.toLocaleTimeString()}`
            )
            .join('\n\n')}`;
      }
    },
    [notes, userId]
  );

  const handleNativeShare = async () => {
    const content = formatNotesForExport('text');
    if (isNative) {
      try {
        await Share.share({
          title: 'Pulse Chat Notes',
          text: content,
          dialogTitle: 'Share your notes',
        });
        toast.success('Shared successfully');
      } catch {
        toast.error('Share failed');
      }
    } else {
      try {
        await navigator.clipboard.writeText(content);
        toast.success('Notes copied to clipboard');
      } catch {
        toast.error('Failed to copy notes');
      }
    }
    setShowExportMenu(false);
  };

  const handleDownloadNotes = (format: 'text' | 'markdown' | 'json') => {
    const content = formatNotesForExport(format);
    const extensions = { text: 'txt', markdown: 'md', json: 'json' };
    const mimeTypes = { text: 'text/plain', markdown: 'text/markdown', json: 'application/json' };
    const blob = new Blob([content], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-notes-${new Date().toISOString().slice(0, 10)}.${extensions[format]}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Notes downloaded as ${format.toUpperCase()}`);
    setShowExportMenu(false);
  };

  const handleSendToArchiveLocal = () => {
    if (onSendToArchive) {
      onSendToArchive(notes);
      toast.success('Notes sent to Archives');
    } else {
      const existingArchives = JSON.parse(localStorage.getItem('pulse_voice_archives') || '[]');
      existingArchives.push({
        id: generateId(),
        notes,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('pulse_voice_archives', JSON.stringify(existingArchives));
      toast.success('Notes archived locally');
    }
    setShowExportMenu(false);
  };

  const handleSendToEmail = () => {
    if (onSendToEmail) {
      onSendToEmail(notes);
    } else {
      const subject = encodeURIComponent('Pulse Chat Notes');
      const body = encodeURIComponent(formatNotesForExport('text'));
      window.open(`mailto:?subject=${subject}&body=${body}`);
      toast.success('Email client opened');
    }
    setShowExportMenu(false);
  };

  const handleCopyNotes = async () => {
    try {
      await navigator.clipboard.writeText(formatNotesForExport('text'));
      toast.success('Notes copied to clipboard');
    } catch {
      toast.error('Failed to copy notes');
    }
    setShowExportMenu(false);
  };

  const handleAddManualNote = () => {
    if (!newNoteText.trim()) return;
    addNote({
      id: generateId(),
      content: newNoteText.trim(),
      timestamp: new Date(),
      type: 'manual',
    });
    setNewNoteText('');
    toast.success('Note added');
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    toast.success('Note deleted');
  };

  const handleStartEditNote = (note: VoiceNote) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  };

  const handleSaveEditNote = () => {
    if (!editingNoteId || !editingNoteContent.trim()) return;
    setNotes((prev) =>
      prev.map((n) => (n.id === editingNoteId ? { ...n, content: editingNoteContent.trim() } : n))
    );
    setEditingNoteId(null);
    setEditingNoteContent('');
    toast.success('Note updated');
  };

  /* ── Voice connection ─────────────────────────────────────── */
  const connectInFlightRef = useRef(false);

  const handleConnect = useCallback(async () => {
    // Guard against double-firing from rapid Space presses or click+kbd races.
    if (connectInFlightRef.current) return;
    connectInFlightRef.current = true;
    setIsConnecting(true);

    // Wait for the lazy-loaded agent to mount. We poll the ref instead of using
    // a promise because the lazy boundary doesn't expose a ready signal — but
    // we cap to 3s and surface a clear retry path instead of hanging forever.
    let attempts = 0;
    const maxAttempts = 30;
    while (!agentRef.current && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    if (!agentRef.current) {
      toast.error('Voice agent did not load. Reload Pulse to retry.');
      setIsConnecting(false);
      connectInFlightRef.current = false;
      return;
    }
    try {
      await agentRef.current.connect();
    } catch (error) {
      let errorMessage = 'Failed to connect. Try again or check your sign-in.';
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes('Microphone not found') || msg.includes('NotFoundError')) {
          errorMessage = 'Microphone not found. Connect a mic and try again.';
        } else if (msg.includes('not accessible') || msg.includes('NotReadableError')) {
          errorMessage = 'Microphone is in use by another app. Close it and retry.';
        } else if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
          errorMessage = 'Microphone access blocked. Allow it in browser settings, then retry.';
        } else if (/401|unauthorized|invalid.*token|expired/i.test(msg)) {
          errorMessage = 'Sign-in expired. Reload Pulse or sign in again to reconnect.';
          // Surface the warning banner so the user has a recovery path.
          setOpenaiApiKey('');
          setTokenError('Sign-in expired. Reload Pulse or sign in again to reconnect voice.');
        } else {
          errorMessage = msg || errorMessage;
        }
      }
      toast.error(errorMessage, { duration: 5000 });
      setVoiceState('idle');
      setIsConnecting(false);
    } finally {
      connectInFlightRef.current = false;
    }
  }, []);

  /* ── Persist session on disconnect / unmount ─────────────── */
  const persistSession = useCallback(() => {
    if (!sessionIdRef.current) return;
    if (notes.length === 0 && messages.length === 0) {
      sessionIdRef.current = null;
      return;
    }
    const startedAt = sessionStartTime ?? Date.now() - sessionElapsed * 1000;
    const endedAt = Date.now();
    const storedNotes: StoredVoiceNote[] = notes.map((n) => ({
      id: n.id,
      content: n.content,
      timestamp: n.timestamp.getTime(),
      type: n.type,
      speaker: n.speaker,
    }));
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    const record: VoiceSessionRecord = {
      id: sessionIdRef.current,
      startedAt,
      endedAt,
      durationSec: Math.max(1, sessionElapsed),
      captureCount: notes.length,
      takeaway: summarizeForTakeaway(storedNotes),
      lastLine: lastAssistant
        ? lastAssistant.content.length > 200
          ? lastAssistant.content.slice(0, 197) + '…'
          : lastAssistant.content
        : undefined,
      notes: storedNotes,
    };
    const next = saveVoiceSession(record);
    setRecentSessions(next);
    sessionIdRef.current = null;
  }, [notes, messages, sessionElapsed, sessionStartTime]);

  const handleDisconnect = useCallback(async () => {
    if (agentRef.current) {
      await agentRef.current.disconnect();
    }
    persistSession();
    setVoiceState('idle');
    setAudioLevel(0);
    setIsPaused(false);
    setCurrentTranscript('');
  }, [persistSession]);

  const handleTogglePause = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    if (agentRef.current) {
      if (newPaused) agentRef.current.pauseSession();
      else agentRef.current.resumeSession();
    }
    toast.success(newPaused ? 'Paused' : 'Resumed', { duration: 1200 });
  };

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (agentRef.current) {
        if (next) agentRef.current.muteAudio();
        else agentRef.current.unmuteAudio();
      }
      return next;
    });
  }, []);

  /* ── Context file management ─────────────────────────────── */
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const newFile: ContextFile = {
          id: generateId(),
          name: file.name,
          type: 'file',
          content,
          size: file.size,
        };
        setContextFiles((prev) => [...prev, newFile]);
        toast.success(`Added: ${file.name}`);
      };
      reader.readAsText(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleAddTextContext = useCallback(() => {
    if (!contextText.trim()) return;
    const newContext: ContextFile = {
      id: generateId(),
      name: `Note ${contextFiles.filter((f) => f.type === 'text').length + 1}`,
      type: 'text',
      content: contextText.trim(),
    };
    setContextFiles((prev) => [...prev, newContext]);
    setContextText('');
    toast.success('Context added');
  }, [contextText, contextFiles]);

  const removeContextFile = useCallback((id: string) => {
    setContextFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleExportTranscript = useCallback(() => {
    if (messages.length === 0) {
      toast.error('No conversation to export');
      return;
    }
    const header = `# Pulse Chat Transcript\n\n**Exported:** ${new Date().toLocaleString()}\n\n---\n\n`;
    const content = messages
      .map((msg) => {
        const speaker = msg.role === 'user' ? '**You**' : '**Pulse AI**';
        return `${speaker} *(${msg.timestamp.toLocaleTimeString()})*:\n> ${msg.content.replace(
          /\n/g,
          '\n> '
        )}\n`;
      })
      .join('\n');
    const blob = new Blob([header + content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript exported');
  }, [messages]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /* ── Cleanup on unmount ──────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (agentRef.current) {
        agentRef.current.disconnect().catch(() => {});
      }
      persistSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Auto-scroll history (notes panel) ───────────────────── */
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages]);

  /* ── Session timer ───────────────────────────────────────── */
  useEffect(() => {
    if (isConnected && !sessionStartTime) {
      setSessionStartTime(Date.now());
    }
    if (!isConnected && sessionStartTime) {
      setSessionStartTime(null);
      setSessionElapsed(0);
    }
  }, [isConnected, sessionStartTime]);

  useEffect(() => {
    if (!sessionStartTime) return;
    const interval = setInterval(() => {
      setSessionElapsed(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  /* ── Reset captures when session ends ─────────────────────── */
  useEffect(() => {
    if (!isConnected && !isConnecting) {
      // After persistSession runs and disconnect propagates, clear in-memory captures
      // so the next session starts fresh. Recent sessions list now holds the prior data.
      setNotes([]);
      setMessages([]);
    }
    // intentional: only reset when transitioning away from connected
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, isConnecting]);

  /* ── Keyboard shortcuts ──────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }
      // Ignore meta-modified shortcuts so we don't shadow browser ones
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!openaiApiKey || isResolvingToken) return;
        if (isConnecting) return;
        if (!isConnected) handleConnect();
        else handleTogglePause();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleQuickCapture();
      } else if (e.key === 'm' || e.key === 'M') {
        if (!isConnected) return;
        e.preventDefault();
        handleToggleMute();
      } else if (e.key === 'Escape') {
        if (showExportMenu) setShowExportMenu(false);
        else if (showSettings) setShowSettings(false);
        else if (showContextDrawer) setShowContextDrawer(false);
        else if (showNotes) setShowNotes(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    openaiApiKey,
    isResolvingToken,
    isConnecting,
    isConnected,
    handleConnect,
    handleQuickCapture,
    handleToggleMute,
    showExportMenu,
    showSettings,
    showContextDrawer,
    showNotes,
    onClose,
  ]);

  /* ── Derived view models ─────────────────────────────────── */
  const railLines: RailLine[] = useMemo(() => {
    return messages.slice(-5).map((m) => ({
      id: m.id,
      text: truncateForRail(m.content),
      role: m.role,
    }));
  }, [messages]);

  const modelLabel = useMemo(() => {
    const v = (voiceSettings.voice ?? 'alloy').toUpperCase();
    const lang = (voiceSettings.language ?? 'en').toUpperCase();
    return `GPT-4O · ${v} · ${lang}`;
  }, [voiceSettings.voice, voiceSettings.language]);

  const liveSession: LiveSessionView | undefined = useMemo(() => {
    if (!isConnected && !isConnecting) return undefined;
    return {
      startedAt: sessionStartTime ?? Date.now(),
      durationSec: sessionElapsed,
      captures: notes.map((n) => ({
        id: n.id,
        content: n.content,
        type: n.type,
        speaker: n.speaker,
      })),
      takeawayDraft:
        notes.find((n) => n.type === 'highlight')?.content ??
        notes.find((n) => n.type === 'auto')?.content,
      currentTranscript,
    };
  }, [isConnected, isConnecting, sessionStartTime, sessionElapsed, notes, currentTranscript]);

  const stateLabel =
    voiceState === 'connecting'
      ? 'Connecting'
      : voiceState === 'listening'
      ? isPaused
        ? 'Paused'
        : 'Listening'
      : voiceState === 'thinking'
      ? 'Thinking'
      : voiceState === 'speaking'
      ? 'Speaking'
      : isConnected
      ? 'Connected'
      : 'Disconnected';

  const sessionTimerText = sessionStartTime ? formatDuration(sessionElapsed) : undefined;

  /* ── Prompt selection: stash as text context, then connect ── */
  const handlePromptSelect = useCallback(
    (prompt: string) => {
      const promptContext: ContextFile = {
        id: generateId(),
        name: 'Opening prompt',
        type: 'text',
        content: `Opening prompt the user wants you to start with:\n\n"${prompt}"`,
      };
      setContextFiles((prev) => [promptContext, ...prev]);
      toast(`Try asking: "${prompt}"`, { duration: 3500 });
      handleConnect();
    },
    [handleConnect]
  );

  const handleSessionDelete = useCallback((id: string) => {
    const next = deleteVoiceSession(id);
    setRecentSessions(next);
    toast.success('Session removed');
  }, []);

  const handleSessionView = useCallback(
    (session: VoiceSessionRecord) => {
      setNotes(
        session.notes.map((n) => ({
          id: n.id,
          content: n.content,
          timestamp: new Date(n.timestamp),
          type: n.type,
          speaker: n.speaker,
        }))
      );
      setShowNotes(true);
      toast.success('Loaded notes from session');
    },
    []
  );

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="pulse-voice-chat">
      {/* HEADER */}
      <header className="pvc-header">
        <div className="pvc-header-left">
          <span className="pvc-brand" aria-hidden="true" />
          <div className="pvc-header-text">
            <h1>Pulse Chat</h1>
            <span className={`pvc-status pvc-status--${isPaused ? 'paused' : voiceState}`}>
              {stateLabel}
              {sessionTimerText && <span className="pvc-timer">{sessionTimerText}</span>}
            </span>
          </div>
        </div>

        <div className="pvc-header-right">
          <button
            type="button"
            className="pvc-icon-btn"
            onClick={handleExportTranscript}
            disabled={messages.length === 0}
            title="Export transcript"
          >
            <Download size={18} />
          </button>

          <button
            type="button"
            className={`pvc-icon-btn ${showNotes ? 'pvc-icon-btn--active' : ''}`}
            onClick={() => setShowNotes((s) => !s)}
            title="Toggle notes"
          >
            <FileText size={18} />
            {notes.length > 0 && <span className="pvc-badge">{notes.length}</span>}
          </button>

          <button
            type="button"
            className={`pvc-icon-btn ${showSettings ? 'pvc-icon-btn--active' : ''}`}
            onClick={() => setShowSettings((s) => !s)}
            title="Settings"
          >
            <Settings size={18} />
          </button>

          <button
            type="button"
            className="pvc-icon-btn pvc-icon-btn--close"
            onClick={onClose}
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* MAIN GRID */}
      <div className="pvc-main">
        <TranscriptBreathing
          voiceState={voiceState}
          audioLevel={audioLevel}
          isPaused={isPaused}
          recentLines={railLines}
          modelLabel={modelLabel}
          sessionTimer={sessionTimerText}
        />

        <div className="pvc-canvas">
          {/* Token resolution feedback */}
          {(isResolvingToken || (!isResolvingToken && !openaiApiKey)) && (
            <div style={{ padding: '0.75rem 2rem 0' }}>
              {isResolvingToken && (
                <div className="pvc-api-warning">
                  <Loader2 size={18} className="animate-spin" />
                  <div>
                    <strong>Preparing voice session</strong>
                    <p>Fetching a secure session token.</p>
                  </div>
                </div>
              )}
              {!isResolvingToken && !openaiApiKey && (
                <div className="pvc-api-warning" role="alert">
                  <AlertCircle size={18} />
                  <div>
                    <strong>Voice chat unavailable</strong>
                    <p>
                      {tokenError ?? 'OpenAI Realtime is temporarily unavailable. Try again in a moment.'}
                    </p>
                    <button type="button" className="pvc-api-warning-retry" onClick={retryToken}>
                      <RefreshCw size={13} aria-hidden="true" />
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <SessionsCanvas
            isConnected={isConnected}
            isConnecting={isConnecting}
            liveSession={liveSession}
            recentSessions={recentSessions}
            examplePrompts={EXAMPLE_PROMPTS}
            onConnect={handleConnect}
            onPromptSelect={handlePromptSelect}
            onSessionView={handleSessionView}
            onSessionDelete={handleSessionDelete}
          />

          {/* Controls row */}
          <div className="pvc-controls">
            <button
              type="button"
              className={`pvc-control-btn ${isMuted ? 'pvc-control-btn--muted' : ''}`}
              onClick={handleToggleMute}
              disabled={!isConnected}
              title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            <button
              type="button"
              className={`pvc-main-btn pvc-main-btn--${voiceState} ${
                isPaused ? 'pvc-main-btn--paused' : ''
              }`}
              onClick={isConnected ? handleTogglePause : handleConnect}
              disabled={!openaiApiKey || isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Connecting</span>
                </>
              ) : !isConnected ? (
                <>
                  <Mic size={14} />
                  <span>Connect</span>
                  <span className="pvc-main-btn-key">SPACE</span>
                </>
              ) : isPaused ? (
                <>
                  <Play size={14} />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause size={14} />
                  <span>Pause</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="pvc-control-btn pvc-control-btn--stop"
              onClick={handleDisconnect}
              disabled={!isConnected}
              title="End session"
            >
              <MicOff size={16} />
            </button>

            <button
              type="button"
              className={`pvc-control-btn ${
                contextFiles.length > 0 ? 'pvc-control-btn--has-context' : ''
              }`}
              onClick={() => setShowContextDrawer(true)}
              title="Add context"
            >
              <Paperclip size={16} />
              {contextFiles.length > 0 && <span className="pvc-badge">{contextFiles.length}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* LEGEND */}
      <nav className="pvc-legend" aria-label="Pulse Chat keyboard shortcuts">
        <span className="pvc-legend-item">
          <kbd className="pvc-legend-key">SPACE</kbd>
          <span>Connect</span>
        </span>
        <span className="pvc-legend-item">
          <kbd className="pvc-legend-key">N</kbd>
          <span>Capture</span>
        </span>
        <span className="pvc-legend-item">
          <kbd className="pvc-legend-key">M</kbd>
          <span>Mute</span>
        </span>
        <span className="pvc-legend-item">
          <kbd className="pvc-legend-key">ESC</kbd>
          <span>Close</span>
        </span>
      </nav>

      {/* Hidden RealtimeVoiceAgent — handles actual connection */}
      {openaiApiKey && (
        <div className="hidden">
          <ErrorBoundary
            componentName="Voice Connection"
            onError={() => {
              setIsConnected(false);
              setIsConnecting(false);
              setVoiceState('idle');
              toast.error(
                isMobilePlatform
                  ? 'Voice features may be limited on mobile devices'
                  : 'Voice connection failed. Please try again.'
              );
            }}
          >
            <Suspense fallback={null}>
              <RealtimeVoiceAgent
                ref={agentRef}
                userId={userId}
                sessionId="pulse-voice-chat"
                openaiApiKey={openaiApiKey}
                voiceSettings={voiceSettings}
                contextFiles={effectiveContextFiles}
                aiMode={aiMode}
                onTranscript={handleTranscript}
                onHistoryUpdate={handleHistoryUpdate}
                onConnectionChange={handleConnectionChange}
                onAudioLevel={handleAudioLevel}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {/* NOTES PANEL */}
      <div className={`pvc-notes-panel ${showNotes ? 'pvc-notes-panel--open' : ''}`}>
        <div className="pvc-notes-header">
          <h2>
            <FileText size={16} />
            Session Notes
          </h2>
          <div className="pvc-notes-header-actions">
            <div className="pvc-export-menu-container">
              <button
                type="button"
                className={`pvc-icon-btn ${showExportMenu ? 'pvc-icon-btn--active' : ''}`}
                onClick={() => setShowExportMenu((s) => !s)}
                disabled={notes.length === 0}
                title="Export notes"
              >
                <Share2 size={16} />
              </button>
              {showExportMenu && (
                <div className="pvc-export-menu">
                  <button type="button" onClick={handleNativeShare}>
                    <ExternalLink size={14} /> Share
                  </button>
                  <button type="button" onClick={handleCopyNotes}>
                    <Copy size={14} /> Copy
                  </button>
                  <button type="button" onClick={() => handleDownloadNotes('text')}>
                    <Download size={14} /> Download TXT
                  </button>
                  <button type="button" onClick={() => handleDownloadNotes('markdown')}>
                    <Download size={14} /> Download MD
                  </button>
                  <button type="button" onClick={handleSendToArchiveLocal}>
                    <Archive size={14} /> Send to Archives
                  </button>
                  <button type="button" onClick={handleSendToEmail}>
                    <Mail size={14} /> Send to Email
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="pvc-icon-btn"
              onClick={() => setShowNotes(false)}
              title="Close notes"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>

        <div className="pvc-notes-settings">
          <label className="pvc-toggle">
            <input
              type="checkbox"
              checked={autoNotes}
              onChange={(e) => setAutoNotes(e.target.checked)}
            />
            <span className="pvc-toggle-slider" />
            <span className="pvc-toggle-label">
              <Brain size={13} />
              Auto-capture key points
            </span>
          </label>
        </div>

        <div className="pvc-notes-list" ref={notesContainerRef}>
          {notes.length === 0 ? (
            <div className="pvc-notes-empty">
              <FileText size={28} />
              <p>No notes yet</p>
              <span>Press N to capture</span>
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className={`pvc-note pvc-note--${note.type}`}>
                <div className="pvc-note-header">
                  <span className={`pvc-note-type pvc-note-type--${note.type}`}>
                    {note.type === 'auto' ? 'Auto' : note.type === 'highlight' ? 'Pin' : 'Manual'}
                  </span>
                  <span className="pvc-note-time">
                    <Clock size={11} />
                    {note.timestamp.toLocaleTimeString()}
                  </span>
                </div>

                {editingNoteId === note.id ? (
                  <div className="pvc-note-edit">
                    <textarea
                      value={editingNoteContent}
                      onChange={(e) => setEditingNoteContent(e.target.value)}
                      aria-label="Edit note"
                      autoFocus
                    />
                    <div className="pvc-note-edit-actions">
                      <button type="button" onClick={handleSaveEditNote}>
                        <Check size={13} /> Save
                      </button>
                      <button type="button" onClick={() => setEditingNoteId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="pvc-note-content">{note.content}</p>
                    <div className="pvc-note-actions">
                      <button
                        type="button"
                        onClick={() => handleStartEditNote(note)}
                        title="Edit"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note.id)}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="pvc-notes-add">
          <input
            type="text"
            placeholder="Add a note…"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddManualNote()}
          />
          <button
            type="button"
            onClick={handleAddManualNote}
            disabled={!newNoteText.trim()}
            title="Add note"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* SETTINGS PANEL */}
      {showSettings && (
        <div className="pvc-settings-panel">
          <div className="pvc-settings-header">
            <h2>
              <Settings size={16} />
              Voice Settings
            </h2>
            <button
              type="button"
              className="pvc-icon-btn"
              onClick={() => setShowSettings(false)}
              title="Close settings"
            >
              <X size={16} />
            </button>
          </div>

          <div className="pvc-settings-content">
            <div className="pvc-setting-group">
              <label htmlFor="voice-select">Voice</label>
              <select
                id="voice-select"
                value={voiceSettings.voice}
                onChange={(e) =>
                  setVoiceSettings((prev) => ({ ...prev, voice: e.target.value as any }))
                }
                title="Select AI voice"
              >
                <option value="alloy">Alloy (Neutral)</option>
                <option value="ash">Ash (Neutral)</option>
                <option value="ballad">Ballad (Female)</option>
                <option value="coral">Coral (Female)</option>
                <option value="echo">Echo (Male)</option>
                <option value="sage">Sage (Neutral)</option>
                <option value="shimmer">Shimmer (Female)</option>
                <option value="verse">Verse (Neutral)</option>
                <option value="marin">Marin (Female)</option>
                <option value="cedar">Cedar (Male)</option>
              </select>
            </div>

            <div className="pvc-setting-group">
              <label htmlFor="language-select">Language</label>
              <select
                id="language-select"
                value={voiceSettings.language || 'en'}
                onChange={(e) =>
                  setVoiceSettings((prev) => ({ ...prev, language: e.target.value as any }))
                }
                title="Select conversation language"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="nl">Dutch</option>
                <option value="pl">Polish</option>
                <option value="ru">Russian</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="zh">Chinese</option>
              </select>
            </div>

            <div className="pvc-setting-group">
              <label htmlFor="turn-detection">Turn Detection</label>
              <select
                id="turn-detection"
                value={voiceSettings.turnDetection}
                onChange={(e) =>
                  setVoiceSettings((prev) => ({ ...prev, turnDetection: e.target.value as any }))
                }
                title="Select turn detection mode"
              >
                <option value="semantic_vad">Semantic VAD (Smart)</option>
                <option value="server_vad">Server VAD (Fast)</option>
              </select>
            </div>

            <div className="pvc-setting-group">
              <label htmlFor="noise-reduction">Noise Reduction</label>
              <select
                id="noise-reduction"
                value={voiceSettings.noiseReduction || 'near_field'}
                onChange={(e) =>
                  setVoiceSettings((prev) => ({ ...prev, noiseReduction: e.target.value as any }))
                }
                title="Select noise reduction mode"
              >
                <option value="near_field">Near Field (Close Mic)</option>
                <option value="far_field">Far Field (Room Mic)</option>
              </select>
            </div>

            <div className="pvc-setting-group">
              <label className="pvc-toggle">
                <input
                  type="checkbox"
                  checked={autoNotes}
                  onChange={(e) => setAutoNotes(e.target.checked)}
                />
                <span className="pvc-toggle-slider" />
                <span className="pvc-toggle-label">Auto-capture notes</span>
              </label>
            </div>

            <div className="pvc-setting-group">
              <label className="pvc-toggle">
                <input
                  type="checkbox"
                  checked={aiMode === 'active'}
                  onChange={(e) => setAiMode(e.target.checked ? 'active' : 'observer')}
                />
                <span className="pvc-toggle-slider" />
                <span className="pvc-toggle-label">Active AI Mode</span>
              </label>
              <p className="pvc-setting-hint">
                {aiMode === 'active'
                  ? 'AI actively participates'
                  : 'AI only responds when prompted'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CONTEXT DRAWER */}
      {showContextDrawer && (
        <div className="pvc-backdrop" onClick={() => setShowContextDrawer(false)} />
      )}
      <div className={`pvc-context-drawer ${showContextDrawer ? 'pvc-context-drawer--open' : ''}`}>
        <div
          className="pvc-context-drawer-handle"
          onClick={() => setShowContextDrawer(false)}
        >
          <div className="pvc-context-drawer-handle-bar" />
        </div>
        <div className="pvc-context-drawer-content">
          <div className="pvc-context-drawer-header">
            <h2>
              <FolderOpen size={16} />
              Conversation Context
            </h2>
            <button
              type="button"
              className="pvc-icon-btn"
              onClick={() => setShowContextDrawer(false)}
              title="Close context drawer"
            >
              <ChevronDown size={16} />
            </button>
          </div>
          <p className="pvc-context-drawer-hint">
            Add documents or notes to ground the conversation.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.json,.csv"
            onChange={handleFileUpload}
            className="hidden"
            aria-label="Upload context files"
          />
          <button
            type="button"
            className="pvc-context-upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <CloudUpload size={16} />
            Upload Files
          </button>

          <div className="pvc-context-text-input">
            <textarea
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="Or paste text, notes, or URLs here…"
              aria-label="Context text input"
            />
            <button type="button" onClick={handleAddTextContext} disabled={!contextText.trim()}>
              <Plus size={14} />
              Add Context
            </button>
          </div>

          {contextFiles.length > 0 ? (
            <div className="pvc-context-file-list">
              <h4>Added Context ({contextFiles.length})</h4>
              {contextFiles.map((file) => (
                <div key={file.id} className="pvc-context-file-item">
                  <div className="pvc-context-file-info">
                    <Paperclip size={13} />
                    <span className="pvc-context-file-name">{file.name}</span>
                    <span className="pvc-context-file-size">
                      {file.type === 'file'
                        ? formatFileSize(file.size)
                        : `${file.content.length} chars`}
                    </span>
                  </div>
                  <button type="button" onClick={() => removeContextFile(file.id)} title="Remove">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="pvc-context-empty">
              <Inbox size={24} />
              <p>No context files added yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop for popovers */}
      {(showExportMenu || showSettings) && (
        <div
          className="pvc-backdrop"
          onClick={() => {
            setShowExportMenu(false);
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
};

export default PulseVoiceChat;
