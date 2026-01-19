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
  Sparkles,
  Brain,
  Waves,
  MessageCircle,
  Clock,
  Check,
  Edit3,
  ExternalLink,
  Loader2,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import {
  RealtimeVoiceAgentRef,
  VoiceSettings,
  ContextFile,
  AIParticipantMode
} from '../WarRoom/RealtimeVoiceAgent';
import { RealtimeHistoryItem } from '../../services/realtimeAgentService';
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
  // Get OpenAI API key
  const openaiApiKey = localStorage.getItem('openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY || '';

  // Voice states
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

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

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const agentRef = useRef<RealtimeVoiceAgentRef>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const smoothedLevelRef = useRef(0);
  const phaseRef = useRef(0);

  // Detect if native platform
  const isNative = Capacitor.isNativePlatform();

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

  // Toggle pause
  const handleTogglePause = () => {
    setIsPaused(prev => !prev);
    toast.success(isPaused ? 'Resumed' : 'Paused');
  };

  // Toggle mute
  const handleToggleMute = () => {
    setIsMuted(prev => !prev);
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

  // ============= CANVAS VISUALIZATION =============

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, cx = 0, cy = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      w = rect.width;
      h = rect.height;
      cx = w / 2;
      cy = h / 2;
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const t = Date.now() / 1000;
      const isDark = document.documentElement.classList.contains('dark');

      // Smooth audio level
      smoothedLevelRef.current += (audioLevel - smoothedLevelRef.current) * 0.12;
      const smoothLevel = smoothedLevelRef.current;

      // Update phase
      phaseRef.current += 0.02 + smoothLevel * 0.05;

      ctx.clearRect(0, 0, w, h);

      // Determine colors based on state
      let primaryColor: string;
      let secondaryColor: string;
      let glowColor: string;

      switch (voiceState) {
        case 'listening':
          primaryColor = isDark ? '#f43f5e' : '#e11d48';
          secondaryColor = isDark ? '#fb7185' : '#f43f5e';
          glowColor = 'rgba(244, 63, 94, 0.3)';
          break;
        case 'thinking':
          primaryColor = isDark ? '#8b5cf6' : '#7c3aed';
          secondaryColor = isDark ? '#a78bfa' : '#8b5cf6';
          glowColor = 'rgba(139, 92, 246, 0.3)';
          break;
        case 'speaking':
          primaryColor = isDark ? '#22c55e' : '#16a34a';
          secondaryColor = isDark ? '#4ade80' : '#22c55e';
          glowColor = 'rgba(34, 197, 94, 0.3)';
          break;
        case 'connecting':
          primaryColor = isDark ? '#f59e0b' : '#d97706';
          secondaryColor = isDark ? '#fbbf24' : '#f59e0b';
          glowColor = 'rgba(245, 158, 11, 0.3)';
          break;
        default:
          primaryColor = isDark ? '#6b7280' : '#9ca3af';
          secondaryColor = isDark ? '#9ca3af' : '#d1d5db';
          glowColor = 'rgba(156, 163, 175, 0.2)';
      }

      // === AMBIENT BACKGROUND GLOW ===
      const ambientRadius = Math.min(w, h) * 0.45;
      const ambientGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ambientRadius);

      if (voiceState !== 'idle') {
        ambientGrad.addColorStop(0, `${glowColor.replace('0.3', '0.15')}`);
        ambientGrad.addColorStop(0.5, `${glowColor.replace('0.3', '0.05')}`);
        ambientGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = ambientGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // === MAIN ORB ===
      const baseOrbRadius = Math.min(w, h) * 0.18;
      const breathe = 1 + Math.sin(t * 1.5) * 0.08;
      const audioExpand = 1 + smoothLevel * 0.25;
      const orbRadius = baseOrbRadius * breathe * audioExpand;

      // Outer glow rings
      for (let i = 4; i >= 0; i--) {
        const ringRadius = orbRadius * (1.2 + i * 0.15) + Math.sin(t * 2 + i) * smoothLevel * 15;
        const ringAlpha = (0.15 - i * 0.025) * (voiceState === 'idle' ? 0.5 : 1);

        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = primaryColor.replace(')', `, ${ringAlpha})`).replace('rgb', 'rgba').replace('#', '');

        // Convert hex to rgba for proper alpha
        if (primaryColor.startsWith('#')) {
          const r = parseInt(primaryColor.slice(1, 3), 16);
          const g = parseInt(primaryColor.slice(3, 5), 16);
          const b = parseInt(primaryColor.slice(5, 7), 16);
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${ringAlpha})`;
        }

        ctx.lineWidth = 2 - i * 0.3;
        ctx.stroke();
      }

      // Core orb with gradient
      const orbGrad = ctx.createRadialGradient(
        cx - orbRadius * 0.2,
        cy - orbRadius * 0.2,
        0,
        cx,
        cy,
        orbRadius
      );
      orbGrad.addColorStop(0, secondaryColor);
      orbGrad.addColorStop(0.7, primaryColor);
      orbGrad.addColorStop(1, isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)');

      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius, 0, Math.PI * 2);
      ctx.fillStyle = orbGrad;
      ctx.fill();

      // === STATE-SPECIFIC VISUALIZATIONS ===

      // LISTENING MODE - Radial sound waves coming IN
      if (voiceState === 'listening' && !isPaused) {
        const waveCount = 24;
        const maxWaveLength = Math.min(w, h) * 0.35;

        for (let i = 0; i < waveCount; i++) {
          const angle = (i / waveCount) * Math.PI * 2;
          const wavePhase = t * 3 + i * 0.3;
          const waveAmplitude = smoothLevel * maxWaveLength * (0.3 + Math.sin(wavePhase) * 0.7);
          const waveWidth = 3 + smoothLevel * 4;

          const outerX = cx + Math.cos(angle) * (orbRadius * 2 + maxWaveLength);
          const outerY = cy + Math.sin(angle) * (orbRadius * 2 + maxWaveLength);
          const innerX = cx + Math.cos(angle) * (orbRadius + maxWaveLength - waveAmplitude);
          const innerY = cy + Math.sin(angle) * (orbRadius + maxWaveLength - waveAmplitude);

          const grad = ctx.createLinearGradient(outerX, outerY, innerX, innerY);
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(0.5, `rgba(244, 63, 94, ${0.6 * smoothLevel})`);
          grad.addColorStop(1, primaryColor);

          ctx.beginPath();
          ctx.moveTo(outerX, outerY);
          ctx.lineTo(innerX, innerY);
          ctx.strokeStyle = grad;
          ctx.lineWidth = waveWidth;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // Pulsing inner ring
        const pulseRadius = orbRadius * (1.1 + Math.sin(t * 4) * smoothLevel * 0.15);
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(244, 63, 94, ${0.5 + smoothLevel * 0.3})`;
        ctx.lineWidth = 3 + smoothLevel * 3;
        ctx.stroke();
      }

      // THINKING MODE - Neural network / constellation
      if (voiceState === 'thinking') {
        const nodeCount = 12;
        const orbitRadius = orbRadius * 1.8;
        const nodes: { x: number; y: number; size: number }[] = [];

        for (let i = 0; i < nodeCount; i++) {
          const angle = (i / nodeCount) * Math.PI * 2 + t * 0.5;
          const wobble = Math.sin(t * 2 + i) * 15;
          const x = cx + Math.cos(angle) * (orbitRadius + wobble);
          const y = cy + Math.sin(angle) * (orbitRadius + wobble);
          const size = 4 + Math.sin(t * 3 + i * 0.5) * 2;
          nodes.push({ x, y, size });
        }

        // Draw connections
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            if ((i + j) % 3 === 0) {
              ctx.beginPath();
              ctx.moveTo(nodes[i].x, nodes[i].y);
              ctx.lineTo(nodes[j].x, nodes[j].y);
              ctx.stroke();
            }
          }
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(cx, cy);
          ctx.stroke();
        }

        // Draw nodes
        nodes.forEach((node, i) => {
          const pulse = 0.5 + Math.sin(t * 4 + i) * 0.5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(139, 92, 246, ${0.5 + pulse * 0.5})`;
          ctx.fill();
        });

        // Rotating inner elements
        for (let i = 0; i < 3; i++) {
          const ringAngle = t * (1 + i * 0.5) + (i * Math.PI * 2 / 3);
          const ringX = cx + Math.cos(ringAngle) * orbRadius * 0.5;
          const ringY = cy + Math.sin(ringAngle) * orbRadius * 0.5;

          ctx.beginPath();
          ctx.arc(ringX, ringY, 6, 0, Math.PI * 2);
          ctx.fillStyle = secondaryColor;
          ctx.fill();
        }
      }

      // SPEAKING MODE - Outward emanating waves / bars
      if (voiceState === 'speaking' && !isPaused) {
        const barCount = 32;
        const baseLength = orbRadius * 0.3;
        const maxLength = Math.min(w, h) * 0.25;

        for (let i = 0; i < barCount; i++) {
          const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;

          const freq = 0.3 + Math.sin(t * 8 + i * 0.4) * 0.3 + Math.sin(t * 12 + i * 0.2) * 0.2;
          const barLength = baseLength + freq * smoothLevel * maxLength;

          const startX = cx + Math.cos(angle) * (orbRadius + 5);
          const startY = cy + Math.sin(angle) * (orbRadius + 5);
          const endX = cx + Math.cos(angle) * (orbRadius + barLength);
          const endY = cy + Math.sin(angle) * (orbRadius + barLength);

          const grad = ctx.createLinearGradient(startX, startY, endX, endY);
          grad.addColorStop(0, primaryColor);
          grad.addColorStop(1, `rgba(34, 197, 94, ${0.3 * smoothLevel})`);

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 4 + freq * 4;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // Concentric expanding rings
        const ringCount = 3;
        for (let i = 0; i < ringCount; i++) {
          const ringPhase = ((t * 2 + i * 0.5) % 1);
          const ringRadius = orbRadius * (1.2 + ringPhase * 1.5);
          const ringAlpha = (1 - ringPhase) * 0.4 * smoothLevel;

          ctx.beginPath();
          ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(34, 197, 94, ${ringAlpha})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }

      // CONNECTING MODE - Spinning loader
      if (voiceState === 'connecting') {
        const spinAngle = t * 3;
        const arcLength = Math.PI * 0.6;

        ctx.beginPath();
        ctx.arc(cx, cy, orbRadius * 1.3, spinAngle, spinAngle + arcLength);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, orbRadius * 1.3, spinAngle + Math.PI, spinAngle + Math.PI + arcLength);
        ctx.strokeStyle = secondaryColor;
        ctx.stroke();
      }

      // === CENTER ICON ===
      ctx.save();
      ctx.translate(cx, cy);

      const iconSize = orbRadius * 0.4;
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.95)';

      if (voiceState === 'listening') {
        // Microphone icon
        ctx.beginPath();
        ctx.roundRect(-iconSize * 0.25, -iconSize * 0.5, iconSize * 0.5, iconSize * 0.7, 8);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -iconSize * 0.1, iconSize * 0.35, Math.PI, 0, false);
        ctx.strokeStyle = ctx.fillStyle as string;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, iconSize * 0.25);
        ctx.lineTo(0, iconSize * 0.5);
        ctx.stroke();
      } else if (voiceState === 'thinking' || voiceState === 'connecting') {
        // Dots animation
        const dotCount = 3;
        for (let i = 0; i < dotCount; i++) {
          const dotX = (i - 1) * iconSize * 0.4;
          const dotY = Math.sin(t * 5 + i * 0.5) * iconSize * 0.15;
          ctx.beginPath();
          ctx.arc(dotX, dotY, iconSize * 0.12, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (voiceState === 'speaking') {
        // Sound waves icon
        for (let i = 0; i < 3; i++) {
          const waveRadius = iconSize * (0.2 + i * 0.15);
          const waveAlpha = 1 - i * 0.25;
          ctx.beginPath();
          ctx.arc(0, 0, waveRadius, -Math.PI * 0.4, Math.PI * 0.4);
          ctx.strokeStyle = `rgba(255,255,255,${waveAlpha})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      } else {
        // Idle - simple circle
        ctx.beginPath();
        ctx.arc(0, 0, iconSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [voiceState, audioLevel, isPaused]);

  // State label
  const stateLabel = useMemo(() => {
    switch (voiceState) {
      case 'connecting': return 'Connecting...';
      case 'listening': return isPaused ? 'Paused' : 'Listening...';
      case 'thinking': return 'Thinking...';
      case 'speaking': return 'Speaking...';
      default: return 'Ready to connect';
    }
  }, [voiceState, isPaused]);

  // State sublabel
  const stateSubLabel = useMemo(() => {
    switch (voiceState) {
      case 'connecting': return 'Establishing connection to OpenAI';
      case 'listening': return 'Speak naturally, I\'m hearing you';
      case 'thinking': return 'Processing your message';
      case 'speaking': return 'Responding to you';
      default: return openaiApiKey ? 'Tap the button to start' : 'OpenAI API key required';
    }
  }, [voiceState, openaiApiKey]);

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
            </span>
          </div>
        </div>

        <div className="pvc-header-right">
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
        {/* API Key Warning */}
        {!openaiApiKey && (
          <div className="pvc-api-warning">
            <AlertCircle size={20} />
            <div>
              <strong>OpenAI API Key Required</strong>
              <p>Add your API key in Settings &gt; AI Lab to enable voice chat.</p>
            </div>
          </div>
        )}

        {/* Visualizer */}
        <div className="pvc-visualizer-container">
          <canvas ref={canvasRef} className="pvc-visualizer-canvas" />

          {/* State label overlay */}
          <div className="pvc-state-label">
            <span className="pvc-state-label-main">{stateLabel}</span>
            <span className="pvc-state-label-sub">{stateSubLabel}</span>
          </div>

          {/* Transcript preview */}
          {currentTranscript && (
            <div className="pvc-transcript-preview">
              <MessageCircle size={14} />
              <span>{currentTranscript}</span>
            </div>
          )}
        </div>

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
          </div>
        </div>

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
                contextFiles={contextFiles}
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
            onKeyPress={(e) => e.key === 'Enter' && handleAddManualNote()}
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
