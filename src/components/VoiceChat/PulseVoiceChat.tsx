import React, { useState, useRef, useCallback, useEffect, Suspense, lazy } from 'react';
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
  Sparkles,
  Brain,
  Waves,
  Clock,
  Check,
  Edit3,
  ExternalLink,
  Loader2,
  AlertCircle,
  Paperclip,
  CloudUpload,
  FolderOpen,
  Inbox
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePulseAI } from '../../contexts/PulseAIContext';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import {
  RealtimeVoiceAgentRef,
  VoiceSettings,
  ContextFile,
  AIParticipantMode
} from '../WarRoom/RealtimeVoiceAgent';
import { RealtimeHistoryItem } from '../../services/realtimeAgentService';
import VoiceChatVisualizer from './VoiceChatVisualizer';
import './PulseVoiceChat.css';

// Lazy load the voice agent
const RealtimeVoiceAgent = lazy(() =>
  import('../WarRoom/RealtimeVoiceAgent').then(m => ({ default: m.RealtimeVoiceAgent }))
);

// Types
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

// Voice state types
type VoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

// Check if mobile
const isMobilePlatform = Capacitor.isNativePlatform() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const PulseVoiceChat: React.FC<PulseVoiceChatProps> = ({
  apiKey,
  userId = 'anonymous',
  onClose,
  onSendToArchive,
  onSendToEmail
}) => {
  // Ephemeral token fetched from the openai-realtime-token edge function.
  // Platform-managed keys only — never reads env/localStorage for the OpenAI key.
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [isResolvingToken, setIsResolvingToken] = useState<boolean>(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const resolveToken = async () => {
      setIsResolvingToken(true);
      setTokenError(null);
      try {
        // If a key was passed in as a prop (pre-fetched ephemeral token), prefer it
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

        if (error || !data?.token) {
          setTokenError('OpenAI Realtime unavailable. Please try again later.');
          setOpenaiApiKey('');
        } else {
          setOpenaiApiKey(data.token);
        }
      } catch (err) {
        if (!cancelled) {
          setTokenError('OpenAI Realtime unavailable. Please try again later.');
          setOpenaiApiKey('');
        }
      } finally {
        if (!cancelled) setIsResolvingToken(false);
      }
    };

    resolveToken();
    return () => { cancelled = true; };
  }, [apiKey]);

  // Voice states
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);

  // Conversation
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [history, setHistory] = useState<RealtimeHistoryItem[]>([]);

  // Notes
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  const [autoNotes, setAutoNotes] = useState(true);
  const [newNoteText, setNewNoteText] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voice: 'alloy',
    turnDetection: 'semantic_vad',
    noiseReduction: 'near_field',
    language: 'en'
  });
  const [aiMode, setAiMode] = useState<AIParticipantMode>('active');

  // Context files for RAG
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [contextText, setContextText] = useState('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const agentRef = useRef<RealtimeVoiceAgentRef>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // Detect if native platform
  const isNative = Capacitor.isNativePlatform();

  // Bridge: inject Pulse data context from the shared provider
  const pulseAI = usePulseAI();
  const pulseDataPrompt = pulseAI.buildPulseDataPrompt();

  // Notify shared context that voice is active
  useEffect(() => {
    pulseAI.setIsVoiceActive(true);
    return () => pulseAI.setIsVoiceActive(false);
  }, [pulseAI]);

  // Merge Pulse data context into context files for the voice agent
  const effectiveContextFiles = React.useMemo<ContextFile[]>(() => {
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

  // Generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // ============= VOICE AGENT CALLBACKS =============

  // Handle connection state changes
  const handleConnectionChange = useCallback((connected: boolean, connecting: boolean) => {
    console.log('[PulseVoiceChat] Connection change:', { connected, connecting });
    setIsConnected(connected);
    setIsConnecting(connecting);

    if (connected) {
      setVoiceState('listening');
      toast.success('Connected to voice AI');
    } else if (!connecting) {
      setVoiceState('idle');
    } else {
      setVoiceState('connecting');
    }
  }, []);

  // Handle transcript updates
  const handleTranscript = useCallback((text: string, role: 'user' | 'assistant', isFinal: boolean) => {
    setCurrentTranscript(text);

    if (role === 'user') {
      setVoiceState(isFinal ? 'thinking' : 'listening');
    } else {
      setVoiceState(isFinal ? 'listening' : 'speaking');
    }

    // Add to messages when final
    if (isFinal && text.trim()) {
      const newMessage: ConversationMessage = {
        id: generateId(),
        role,
        content: text,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newMessage]);

      // Auto-capture notes from assistant responses
      if (role === 'assistant' && autoNotes) {
        const keyPhrase = extractKeyPhrases(text);
        if (keyPhrase) {
          addNote({
            id: generateId(),
            content: keyPhrase,
            timestamp: new Date(),
            type: 'auto',
            speaker: 'assistant'
          });
        }
      }
    }
  }, [autoNotes]);

  // Handle audio level updates
  const handleAudioLevel = useCallback((level: number, isListening: boolean, isSpeaking: boolean) => {
    setAudioLevel(level);

    if (isConnected && !isPaused) {
      if (isSpeaking) {
        setVoiceState('speaking');
      } else if (isListening) {
        setVoiceState('listening');
      }
    }
  }, [isConnected, isPaused]);

  // Handle history updates
  const handleHistoryUpdate = useCallback((newHistory: RealtimeHistoryItem[]) => {
    setHistory(newHistory);

    // Check for thinking state
    const lastItem = newHistory[newHistory.length - 1];
    if (lastItem?.type === 'function_call') {
      setVoiceState('thinking');
    }
  }, []);

  // ============= NOTES FUNCTIONS =============

  // Extract key phrases (simplified - in real app this would use AI)
  const extractKeyPhrases = (text: string): string | null => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const importantPatterns = /\b(should|must|important|key|note|remember|action|todo|deadline|decision|agreed|confirmed|next steps?|follow[- ]?up)\b/i;

    const importantSentences = sentences.filter(s => importantPatterns.test(s));
    if (importantSentences.length > 0) {
      return importantSentences[0].trim();
    }
    return null;
  };

  // Add a note
  const addNote = useCallback((note: VoiceNote) => {
    setNotes(prev => [...prev, note]);
    setTimeout(() => {
      if (notesContainerRef.current) {
        notesContainerRef.current.scrollTop = notesContainerRef.current.scrollHeight;
      }
    }, 100);
  }, []);

  // Add manual note
  const handleAddManualNote = () => {
    if (!newNoteText.trim()) return;
    addNote({
      id: generateId(),
      content: newNoteText.trim(),
      timestamp: new Date(),
      type: 'manual'
    });
    setNewNoteText('');
    toast.success('Note added');
  };

  // Delete note
  const handleDeleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    toast.success('Note deleted');
  };

  // Edit note
  const handleStartEditNote = (note: VoiceNote) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  };

  const handleSaveEditNote = () => {
    if (!editingNoteId || !editingNoteContent.trim()) return;
    setNotes(prev => prev.map(n =>
      n.id === editingNoteId ? { ...n, content: editingNoteContent.trim() } : n
    ));
    setEditingNoteId(null);
    setEditingNoteContent('');
    toast.success('Note updated');
  };

  // Format notes for export
  const formatNotesForExport = useCallback((format: 'text' | 'markdown' | 'json'): string => {
    const header = `Pulse Voice Chat Notes\nSession: ${new Date().toLocaleString()}\n`;

    switch (format) {
      case 'markdown':
        return `# ${header}\n\n${notes.map(n =>
          `- **[${n.type.toUpperCase()}]** ${n.content}\n  *${n.timestamp.toLocaleTimeString()}*`
        ).join('\n\n')}`;

      case 'json':
        return JSON.stringify({
          exportedAt: new Date().toISOString(),
          sessionId: userId,
          notes: notes.map(n => ({
            content: n.content,
            type: n.type,
            timestamp: n.timestamp.toISOString(),
            speaker: n.speaker
          }))
        }, null, 2);

      default:
        return `${header}${'='.repeat(40)}\n\n${notes.map(n =>
          `[${n.type.toUpperCase()}] ${n.content}\n  - ${n.timestamp.toLocaleTimeString()}`
        ).join('\n\n')}`;
    }
  }, [notes, userId]);

  // Native share
  const handleNativeShare = async () => {
    const content = formatNotesForExport('text');

    if (isNative) {
      try {
        await Share.share({
          title: 'Pulse Voice Chat Notes',
          text: content,
          dialogTitle: 'Share your notes'
        });
        toast.success('Shared successfully');
      } catch (error) {
        console.error('Share failed:', error);
        toast.error('Share failed');
      }
    } else {
      try {
        await navigator.clipboard.writeText(content);
        toast.success('Notes copied to clipboard');
      } catch (error) {
        toast.error('Failed to copy notes');
      }
    }
    setShowExportMenu(false);
  };

  // Download notes
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

  // Send to archives
  const handleSendToArchive = () => {
    if (onSendToArchive) {
      onSendToArchive(notes);
      toast.success('Notes sent to Archives');
    } else {
      const existingArchives = JSON.parse(localStorage.getItem('pulse_voice_archives') || '[]');
      existingArchives.push({
        id: generateId(),
        notes,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('pulse_voice_archives', JSON.stringify(existingArchives));
      toast.success('Notes archived locally');
    }
    setShowExportMenu(false);
  };

  // Send to email
  const handleSendToEmail = () => {
    if (onSendToEmail) {
      onSendToEmail(notes);
    } else {
      const subject = encodeURIComponent('Pulse Voice Chat Notes');
      const body = encodeURIComponent(formatNotesForExport('text'));
      window.open(`mailto:?subject=${subject}&body=${body}`);
      toast.success('Email client opened');
    }
    setShowExportMenu(false);
  };

  // Copy to clipboard
  const handleCopyNotes = async () => {
    try {
      await navigator.clipboard.writeText(formatNotesForExport('text'));
      toast.success('Notes copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy notes');
    }
    setShowExportMenu(false);
  };

  // ============= VOICE CONNECTION =============

  // Connect to voice
  const handleConnect = useCallback(async () => {
    console.log('[PulseVoiceChat] Connecting...');

    // Set connecting state immediately for UI feedback
    setIsConnecting(true);

    // Wait for the lazy-loaded component to be ready (up to 3 seconds)
    let attempts = 0;
    const maxAttempts = 30;
    while (!agentRef.current && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!agentRef.current) {
      console.error('[PulseVoiceChat] Voice agent not ready after waiting');
      toast.error('Voice agent not ready. Please try again.');
      setIsConnecting(false);
      return;
    }

    try {
      await agentRef.current.connect();
    } catch (error) {
      console.error('[PulseVoiceChat] Connection failed:', error);
      
      let errorMessage = 'Failed to connect. Check your API key.';
      if (error instanceof Error) {
        if (error.message.includes('Microphone not found') || error.message.includes('NotFoundError')) {
          errorMessage = 'Microphone not available. Please check that your microphone is connected and enabled.';
        } else if (error.message.includes('not accessible') || error.message.includes('NotReadableError')) {
          errorMessage = 'Microphone is not accessible. It may be in use by another application.';
        } else if (error.message.includes('Permission denied') || error.message.includes('NotAllowedError')) {
          errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings.';
        } else {
          errorMessage = error.message || errorMessage;
        }
      }
      
      toast.error(errorMessage, { duration: 5000 });
      setVoiceState('idle');
      setIsConnecting(false);
    }
  }, []);

  // Disconnect from voice
  const handleDisconnect = useCallback(async () => {
    console.log('[PulseVoiceChat] Disconnecting...');
    if (agentRef.current) {
      await agentRef.current.disconnect();
    }
    setVoiceState('idle');
    setAudioLevel(0);
    setIsPaused(false);
    setCurrentTranscript('');
  }, []);

  // Toggle pause — mutes mic AND mutes remote audio playback
  const handleTogglePause = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    if (agentRef.current) {
      if (newPaused) {
        agentRef.current.pauseSession();
      } else {
        agentRef.current.resumeSession();
      }
    }
    toast.success(newPaused ? 'Paused' : 'Resumed');
  };

  // Toggle mute — actually disables the microphone audio track
  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (agentRef.current) {
      if (newMuted) {
        agentRef.current.muteAudio();
      } else {
        agentRef.current.unmuteAudio();
      }
    }
  };

  // ============= CONTEXT FILE MANAGEMENT =============

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const newFile: ContextFile = {
          id: generateId(),
          name: file.name,
          type: 'file',
          content,
          size: file.size
        };
        setContextFiles(prev => [...prev, newFile]);
        toast.success(`Added: ${file.name}`);
      };
      reader.readAsText(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleAddTextContext = useCallback(() => {
    if (!contextText.trim()) return;
    const newContext: ContextFile = {
      id: generateId(),
      name: `Note ${contextFiles.filter(f => f.type === 'text').length + 1}`,
      type: 'text',
      content: contextText.trim()
    };
    setContextFiles(prev => [...prev, newContext]);
    setContextText('');
    toast.success('Context added');
  }, [contextText, contextFiles]);

  const removeContextFile = useCallback((id: string) => {
    setContextFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Export conversation transcript
  const handleExportTranscript = useCallback(() => {
    if (messages.length === 0) {
      toast.error('No conversation to export');
      return;
    }
    const header = `# Pulse Voice Chat Transcript\n\n**Exported:** ${new Date().toLocaleString()}\n\n---\n\n`;
    const content = messages.map(msg => {
      const speaker = msg.role === 'user' ? '**You**' : '**Pulse AI**';
      return `${speaker} *(${msg.timestamp.toLocaleTimeString()})*:\n> ${msg.content.replace(/\n/g, '\n> ')}\n`;
    }).join('\n');

    const blob = new Blob([header + content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-voice-chat-${new Date().toISOString().slice(0, 10)}.md`;
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

  // ============= CLEANUP ON UNMOUNT =============

  // CRITICAL: Disconnect when component unmounts (user navigates away)
  useEffect(() => {
    return () => {
      console.log('[PulseVoiceChat] Component unmounting - disconnecting voice...');
      if (agentRef.current) {
        agentRef.current.disconnect().catch((err) => {
          console.error('[PulseVoiceChat] Error during cleanup disconnect:', err);
        });
      }
    };
  }, []);

  // Auto-scroll conversation history
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages]);

  // Canvas visualization extracted to VoiceChatVisualizer component

  // Session timer
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

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Simple state label for header
  const stateLabel = voiceState === 'connecting' ? 'Connecting...'
    : voiceState === 'listening' ? (isPaused ? 'Paused' : 'Listening...')
    : voiceState === 'thinking' ? 'Thinking...'
    : voiceState === 'speaking' ? 'Speaking...'
    : 'Ready to connect';

  return (
    <div className="pulse-voice-chat">
      {/* Header */}
      <header className="pvc-header">
        <div className="pvc-header-left">
          <div className="pvc-logo">
            <Waves className="pvc-logo-icon" />
          </div>
          <div className="pvc-header-text">
            <h1>Voice Chat</h1>
            <span className={`pvc-status pvc-status--${voiceState}`}>
              {isConnected ? stateLabel : 'Disconnected'}
              {isConnected && sessionElapsed > 0 && (
                <span className="pvc-timer"> {formatElapsed(sessionElapsed)}</span>
              )}
            </span>
          </div>
        </div>

        <div className="pvc-header-right">
          {/* Export transcript */}
          <button
            type="button"
            className="pvc-icon-btn"
            onClick={handleExportTranscript}
            disabled={messages.length === 0}
            title="Export Transcript"
          >
            <Download size={20} />
          </button>

          {/* Notes toggle */}
          <button
            type="button"
            className={`pvc-icon-btn ${showNotes ? 'pvc-icon-btn--active' : ''}`}
            onClick={() => setShowNotes(!showNotes)}
            title="Toggle Notes"
          >
            <FileText size={20} />
            {notes.length > 0 && (
              <span className="pvc-badge">{notes.length}</span>
            )}
          </button>

          {/* Settings */}
          <button
            type="button"
            className={`pvc-icon-btn ${showSettings ? 'pvc-icon-btn--active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings size={20} />
          </button>

          {/* Close */}
          <button type="button" className="pvc-icon-btn pvc-icon-btn--close" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="pvc-content">
        {/* Token resolution loading */}
        {isResolvingToken && (
          <div className="pvc-api-warning">
            <Loader2 size={20} className="animate-spin" />
            <div>
              <strong>Preparing voice session...</strong>
              <p>Fetching a secure session token.</p>
            </div>
          </div>
        )}

        {/* Token resolution error */}
        {!isResolvingToken && !openaiApiKey && (
          <div className="pvc-api-warning">
            <AlertCircle size={20} />
            <div>
              <strong>Voice chat unavailable</strong>
              <p>{tokenError || 'OpenAI Realtime is temporarily unavailable. Please try again later.'}</p>
            </div>
          </div>
        )}

        {/* Visualizer */}
        <VoiceChatVisualizer
          voiceState={voiceState}
          audioLevel={audioLevel}
          isPaused={isPaused}
          currentTranscript={currentTranscript}
          openaiApiKey={openaiApiKey}
        />

        {/* Controls */}
        <div className="pvc-controls">
          {/* Secondary controls */}
          <div className="pvc-controls-secondary">
            <button
              type="button"
              className={`pvc-control-btn pvc-control-btn--secondary ${isMuted ? 'pvc-control-btn--muted' : ''}`}
              onClick={handleToggleMute}
              disabled={!isConnected}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>

          {/* Main control */}
          <button
            type="button"
            className={`pvc-main-btn pvc-main-btn--${voiceState} ${isPaused ? 'pvc-main-btn--paused' : ''}`}
            onClick={isConnected ? handleTogglePause : handleConnect}
            disabled={!openaiApiKey || isConnecting}
          >
            <div className="pvc-main-btn-inner">
              {isConnecting ? (
                <Loader2 size={32} className="animate-spin" />
              ) : !isConnected ? (
                <Mic size={32} />
              ) : isPaused ? (
                <Play size={32} />
              ) : (
                <Pause size={32} />
              )}
            </div>
            <div className="pvc-main-btn-ring" />
            <div className="pvc-main-btn-ring pvc-main-btn-ring--delayed" />
          </button>

          {/* Secondary controls */}
          <div className="pvc-controls-secondary">
            <button
              type="button"
              className="pvc-control-btn pvc-control-btn--secondary pvc-control-btn--stop"
              onClick={handleDisconnect}
              disabled={!isConnected}
              title="End Session"
            >
              <MicOff size={20} />
            </button>
            <button
              type="button"
              className={`pvc-control-btn pvc-control-btn--secondary ${contextFiles.length > 0 ? 'pvc-control-btn--has-context' : ''}`}
              onClick={() => setShowContextDrawer(true)}
              title="Add Context"
            >
              <Paperclip size={20} />
              {contextFiles.length > 0 && (
                <span className="pvc-badge">{contextFiles.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* Conversation history */}
        {messages.length > 0 && (
          <div className="pvc-history">
            <div className="pvc-history-inner" ref={historyRef}>
              {messages.slice(-6).map(msg => (
                <div key={msg.id} className={`pvc-history-msg pvc-history-msg--${msg.role}`}>
                  <div className={`pvc-history-bubble pvc-history-bubble--${msg.role}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick note button */}
        <button
          type="button"
          className="pvc-quick-note-btn"
          onClick={() => {
            addNote({
              id: generateId(),
              content: `Quick note at ${new Date().toLocaleTimeString()}`,
              timestamp: new Date(),
              type: 'highlight'
            });
            toast.success('Quick note added');
          }}
        >
          <Sparkles size={16} />
          Quick Note
        </button>
      </div>

      {/* Hidden RealtimeVoiceAgent - handles actual connection */}
      {openaiApiKey && (
        <div className="hidden">
          <ErrorBoundary
            componentName="Voice Connection"
            onError={(error) => {
              console.error('[PulseVoiceChat] Voice agent error:', error);
              setIsConnected(false);
              setIsConnecting(false);
              setVoiceState('idle');
              toast.error(isMobilePlatform
                ? 'Voice features may be limited on mobile devices'
                : 'Voice connection failed. Please try again.');
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

      {/* Notes Panel */}
      <div className={`pvc-notes-panel ${showNotes ? 'pvc-notes-panel--open' : ''}`}>
        <div className="pvc-notes-header">
          <h2>
            <FileText size={18} />
            Session Notes
          </h2>
          <div className="pvc-notes-header-actions">
            {/* Export menu toggle */}
            <div className="pvc-export-menu-container">
              <button
                type="button"
                className={`pvc-icon-btn ${showExportMenu ? 'pvc-icon-btn--active' : ''}`}
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={notes.length === 0}
                title="Export Notes"
              >
                <Share2 size={18} />
              </button>

              {showExportMenu && (
                <div className="pvc-export-menu">
                  <button type="button" onClick={handleNativeShare}>
                    <ExternalLink size={16} />
                    Share
                  </button>
                  <button type="button" onClick={handleCopyNotes}>
                    <Copy size={16} />
                    Copy
                  </button>
                  <button type="button" onClick={() => handleDownloadNotes('text')}>
                    <Download size={16} />
                    Download TXT
                  </button>
                  <button type="button" onClick={() => handleDownloadNotes('markdown')}>
                    <Download size={16} />
                    Download MD
                  </button>
                  <button type="button" onClick={handleSendToArchive}>
                    <Archive size={16} />
                    Send to Archives
                  </button>
                  <button type="button" onClick={handleSendToEmail}>
                    <Mail size={16} />
                    Send to Email
                  </button>
                </div>
              )}
            </div>

            <button type="button" className="pvc-icon-btn" onClick={() => setShowNotes(false)} title="Close Notes">
              <ChevronDown size={18} />
            </button>
          </div>
        </div>

        {/* Auto-notes toggle */}
        <div className="pvc-notes-settings">
          <label className="pvc-toggle">
            <input
              type="checkbox"
              checked={autoNotes}
              onChange={(e) => setAutoNotes(e.target.checked)}
            />
            <span className="pvc-toggle-slider" />
            <span className="pvc-toggle-label">
              <Brain size={14} />
              Auto-capture key points
            </span>
          </label>
        </div>

        {/* Notes list */}
        <div className="pvc-notes-list" ref={notesContainerRef}>
          {notes.length === 0 ? (
            <div className="pvc-notes-empty">
              <FileText size={32} />
              <p>No notes yet</p>
              <span>Notes will appear here as you chat</span>
            </div>
          ) : (
            notes.map(note => (
              <div key={note.id} className={`pvc-note pvc-note--${note.type}`}>
                <div className="pvc-note-header">
                  <span className={`pvc-note-type pvc-note-type--${note.type}`}>
                    {note.type === 'auto' ? 'Auto' : note.type === 'highlight' ? 'Highlight' : 'Manual'}
                  </span>
                  <span className="pvc-note-time">
                    <Clock size={12} />
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
                        <Check size={14} />
                        Save
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
                      <button type="button" onClick={() => handleStartEditNote(note)} title="Edit">
                        <Edit3 size={14} />
                      </button>
                      <button type="button" onClick={() => handleDeleteNote(note.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add manual note */}
        <div className="pvc-notes-add">
          <input
            type="text"
            placeholder="Add a note..."
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddManualNote()}
          />
          <button
            type="button"
            onClick={handleAddManualNote}
            disabled={!newNoteText.trim()}
            title="Add Note"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="pvc-settings-panel">
          <div className="pvc-settings-header">
            <h2>
              <Settings size={18} />
              Voice Settings
            </h2>
            <button type="button" className="pvc-icon-btn" onClick={() => setShowSettings(false)} title="Close Settings">
              <X size={18} />
            </button>
          </div>

          <div className="pvc-settings-content">
            <div className="pvc-setting-group">
              <label htmlFor="voice-select">Voice</label>
              <select
                id="voice-select"
                value={voiceSettings.voice}
                onChange={(e) => setVoiceSettings(prev => ({ ...prev, voice: e.target.value as any }))}
                title="Select AI Voice"
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
                onChange={(e) => setVoiceSettings(prev => ({ ...prev, language: e.target.value as any }))}
                title="Select conversation language"
              >
                <option value="en">English</option>
                <option value="es">Spanish (Espanol)</option>
                <option value="fr">French (Francais)</option>
                <option value="de">German (Deutsch)</option>
                <option value="it">Italian (Italiano)</option>
                <option value="pt">Portuguese (Portugues)</option>
                <option value="nl">Dutch (Nederlands)</option>
                <option value="pl">Polish (Polski)</option>
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
                onChange={(e) => setVoiceSettings(prev => ({ ...prev, turnDetection: e.target.value as any }))}
                title="Select Turn Detection Mode"
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
                onChange={(e) => setVoiceSettings(prev => ({ ...prev, noiseReduction: e.target.value as any }))}
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
                {aiMode === 'active' ? 'AI actively participates' : 'AI only responds when prompted'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Context Drawer */}
      {showContextDrawer && (
        <div className="pvc-backdrop" onClick={() => setShowContextDrawer(false)} />
      )}
      <div className={`pvc-context-drawer ${showContextDrawer ? 'pvc-context-drawer--open' : ''}`}>
        <div className="pvc-context-drawer-handle" onClick={() => setShowContextDrawer(false)}>
          <div className="pvc-context-drawer-handle-bar" />
        </div>
        <div className="pvc-context-drawer-content">
          <div className="pvc-context-drawer-header">
            <h2>
              <FolderOpen size={18} />
              Conversation Context
            </h2>
            <button type="button" className="pvc-icon-btn" onClick={() => setShowContextDrawer(false)} title="Close context drawer">
              <ChevronDown size={18} />
            </button>
          </div>
          <p className="pvc-context-drawer-hint">Add documents or notes to provide context for your conversation.</p>

          {/* File upload */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.json,.csv,.pdf,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
            aria-label="Upload context files"
          />
          <button
            type="button"
            className="pvc-context-upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <CloudUpload size={18} />
            Upload Files
          </button>

          {/* Text input */}
          <div className="pvc-context-text-input">
            <textarea
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="Or paste text, notes, or URLs here..."
              aria-label="Context text input"
            />
            <button
              type="button"
              onClick={handleAddTextContext}
              disabled={!contextText.trim()}
            >
              <Plus size={16} />
              Add Context
            </button>
          </div>

          {/* File list */}
          {contextFiles.length > 0 ? (
            <div className="pvc-context-file-list">
              <h4>Added Context ({contextFiles.length})</h4>
              {contextFiles.map(file => (
                <div key={file.id} className="pvc-context-file-item">
                  <div className="pvc-context-file-info">
                    <Paperclip size={14} />
                    <span className="pvc-context-file-name">{file.name}</span>
                    <span className="pvc-context-file-size">
                      {file.type === 'file' ? formatFileSize(file.size) : `${file.content.length} chars`}
                    </span>
                  </div>
                  <button type="button" onClick={() => removeContextFile(file.id)} title="Remove">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="pvc-context-empty">
              <Inbox size={28} />
              <p>No context files added yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop for panels */}
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
