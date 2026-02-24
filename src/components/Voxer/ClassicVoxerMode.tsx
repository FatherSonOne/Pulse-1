// Classic Voxer Mode - Avant-Garde CMF Nothing x Glassmorphism Design
// Full-featured direct contact messaging with bold industrial aesthetic

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  Plus,
  Mic,
  Send,
  Play,
  Pause,
  Trash2,
  RotateCcw,
  ChevronRight,
  Check,
  CheckCheck,
  Sparkles,
  Loader2,
  X,
  Settings,
  Star,
  Clock,
  MessageCircle,
  Volume2,
  Users,
  Download,
  Archive,
  Bookmark,
  BookmarkCheck,
  Share2,
  Forward,
  Reply,
  Heart,
  ThumbsUp,
  Smile,
  MoreVertical,
  Sliders,
  Phone,
  Radio,
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import RecordingPreview from './RecordingPreview';
import VoxModeHeader from './VoxModeHeader';
import VoxRecordArea from './VoxRecordArea';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { blobToBase64 } from '../../services/audioService';
import { transcribeMedia, processWithModel } from '../../services/geminiService';
import { dataService } from '../../services/dataService';
import { userContactService } from '../../services/userContactService';
import { whisperService } from '../../services/voxer/whisperService';
import { audioEnhancementService } from '../../services/voxer/audioEnhancementService';
import type { EnrichedUserProfile } from '../../types/userContact';
import toast from 'react-hot-toast';
import './ClassicVoxerMode.css';

// Phase 2: Selection Mode
import { useVoxSelection } from '../../hooks/useVoxSelection';
import type { VoxSelectionItem } from '../../hooks/useVoxSelection';
import { VoxSelectToolbar } from './VoxSelectToolbar';

// Phase 5: AI Enhancements
import {
  VoxConversationSummary,
  VoxSmartReplies,
  VoxMeetingNotes,
  VoxAutoChapters,
} from './index';

import {
  summarizeConversation,
  generateSmartReplies,
  generateMeetingNotes,
  generateAutoChapters,
  ConversationSummary,
  SmartReply,
  MeetingNotes,
  Chapter,
} from '../../services/voxer/voxerAIService';

// Phase 6: Final Polish
import { useVoxerKeyboardShortcuts } from '../../hooks/useVoxerKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from './VoxKeyboardShortcutsHelp';
import { usePlaybackSpeed } from '../../hooks/usePlaybackSpeed';
import { PlaybackSpeedControl } from './PlaybackSpeedControl';
import { VoxEmptyState } from './VoxEmptyState';
import { getEmptyStateConfig } from './voxEmptyStates';

// ============================================
// TYPES
// ============================================

interface Recording {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  timestamp: Date;
  transcription?: string;
  isTranscribing?: boolean;
  sender: 'me' | 'other';
  contactId: string;
  status?: 'sent' | 'delivered' | 'read';
  analysis?: {
    sentiment?: string;
    topics?: string[];
    actionItems?: string[];
  };
  starred?: boolean;
  bookmarked?: boolean;
  reactions?: { emoji: string; userId: string; timestamp: Date }[];
  replyToId?: string;
  forwarded?: boolean;
  listenCount?: number;
  // Whisper transcription metadata
  whisperTranscription?: {
    text: string;
    language?: string;
    words?: { word: string; start: number; end: number }[];
  };
  // Audio enhancement metadata
  enhanced?: boolean;
  enhancementApplied?: string[];
}

// Quick reactions for Vox messages
const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '🔥', '👏'];

// Settings interface
interface VoxerSettings {
  audioQuality: 'standard' | 'high' | 'ultra';
  autoTranscribe: boolean;
  transcriptionEngine: 'gemini' | 'whisper';
  playbackSpeed: number;
  visualizerSensitivity: number;
  noiseReduction: boolean;
  audioEnhancement: boolean;
  enhanceVoiceClarity: boolean;
}

interface ClassicVoxerModeProps {
  onBack: () => void;
  apiKey: string;
  isDarkMode?: boolean;
}

// ============================================
// CLASSIC VOXER MODE COMPONENT
// ============================================

const ClassicVoxerMode: React.FC<ClassicVoxerModeProps> = ({
  onBack,
  apiKey,
  isDarkMode = false,
}) => {
  // State
  const [activeContactId, setActiveContactId] = useState<string>('');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showNewVoxModal, setShowNewVoxModal] = useState(false);
  const [pendingRecording, setPendingRecording] = useState<{
    blob: Blob;
    url: string;
    duration: number;
    audioBuffer?: AudioBuffer;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const isPreviewing = !!pendingRecording;

  // Settings and controls state
  const [showSettings, setShowSettings] = useState(false);
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Recording | null>(null);
  const [settings, setSettings] = useState<VoxerSettings>({
    audioQuality: 'high',
    autoTranscribe: true,
    transcriptionEngine: 'whisper',
    playbackSpeed: 1,
    visualizerSensitivity: 0.7,
    noiseReduction: true,
    audioEnhancement: true,
    enhanceVoiceClarity: true,
  });

  // Real-time audio visualization state
  const [liveAudioLevel, setLiveAudioLevel] = useState<number[]>(new Array(32).fill(0));

  // Pulse users state
  const [pulseUsers, setPulseUsers] = useState<EnrichedUserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Recording mode state
  const [recordingMode, setRecordingMode] = useState<'hold' | 'tap'>(() => {
    const saved = localStorage.getItem('voxer-recording-mode');
    return (saved === 'hold' || saved === 'tap') ? saved : 'hold';
  });

  // Persist recording mode preference
  useEffect(() => {
    localStorage.setItem('voxer-recording-mode', recordingMode);
  }, [recordingMode]);

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

  const [meetingNotes, setMeetingNotes] = useState<MeetingNotes | null>(null);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  const [activeChapters, setActiveChapters] = useState<Chapter[]>([]);
  const [chapterRecordingId, setChapterRecordingId] = useState<string | null>(null);

  // Phase 6: Final Polish States
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const { playbackSpeed, setPlaybackSpeed, applyToElement } = usePlaybackSpeed();
  const emptyConfig = getEmptyStateConfig('classic');

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Theme colors
  const accentColor = '#F97316'; // Classic Voxer orange

  // Load recordings on mount
  useEffect(() => {
    const loadRecordings = async () => {
      try {
        const dbRecordings = await dataService.getVoxerRecordings();
        const loadedRecordings: Recording[] = await Promise.all(
          dbRecordings.map(async (dbRec: any) => {
            let blob: Blob | null = null;
            let url = dbRec.audio_url || '';

            if (url) {
              try {
                // Check if URL is a data URL (base64)
                if (url.startsWith('data:')) {
                  // Data URL - convert to blob and create object URL for playback
                  const response = await fetch(url);
                  blob = await response.blob();
                  url = URL.createObjectURL(blob);
                } else if (url.startsWith('blob:')) {
                  // Old blob URL - skip it as it's no longer valid
                  console.warn('Skipping invalid blob URL:', url);
                  url = '';
                } else {
                  // Regular URL (Supabase storage) - fetch and create blob URL
                  const response = await fetch(url);
                  blob = await response.blob();
                  url = URL.createObjectURL(blob);
                }
              } catch (e) {
                console.error('Error loading recording from URL:', url, e);
                url = '';
              }
            }

            return {
              id: dbRec.id,
              blob: blob || new Blob(),
              url: url || '',
              duration: dbRec.duration || 0,
              timestamp: new Date(dbRec.recorded_at || dbRec.created_at),
              transcription: dbRec.transcript || undefined,
              isTranscribing: false,
              sender: dbRec.sender === 'me' ? 'me' : 'other',
              contactId: dbRec.contact_id || '',
              status: dbRec.status || 'sent',
              analysis: dbRec.analysis || undefined,
              starred: dbRec.starred || false,
            };
          })
        );
        setRecordings(loadedRecordings);
      } catch (error) {
        console.error('Error loading recordings:', error);
      }
    };
    loadRecordings();
  }, []);

  // Load Pulse users on mount (for contacts with existing conversations)
  useEffect(() => {
    const loadInitialPulseUsers = async () => {
      try {
        const users = await userContactService.getAllPulseUsers({
          excludeBlocked: true,
          limit: 100
        });
        setPulseUsers(users);
      } catch (error) {
        console.error('Error loading initial Pulse users:', error);
      }
    };
    loadInitialPulseUsers();
  }, []);

  // Reload Pulse users when modal opens with search
  useEffect(() => {
    if (showNewVoxModal) {
      const loadPulseUsers = async () => {
        setIsLoadingUsers(true);
        try {
          const users = await userContactService.getAllPulseUsers({
            searchQuery: modalSearchQuery || undefined,
            excludeBlocked: true,
            limit: 50
          });
          setPulseUsers(users);
        } catch (error) {
          console.error('Error loading Pulse users:', error);
          toast.error('Failed to load contacts');
        } finally {
          setIsLoadingUsers(false);
        }
      };
      loadPulseUsers();
    } else {
      // Reset modal search when closed
      setModalSearchQuery('');
    }
  }, [showNewVoxModal, modalSearchQuery]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [recordings, activeContactId]);

  // Phase 6: Apply playback speed to audio elements
  useEffect(() => {
    if (audioRef.current) {
      applyToElement(audioRef.current);
    }
  }, [playbackSpeed, applyToElement]);

  // Contacts with Vox conversations (Pulse users who have recordings)
  const contactsWithVoxes = useMemo(() => {
    const contactIds = new Set(recordings.map(r => r.contactId));
    return pulseUsers.filter(u => contactIds.has(u.id));
  }, [pulseUsers, recordings]);

  // Filtered contacts for sidebar (only those with recordings)
  const filteredContacts = useMemo(() => {
    return contactsWithVoxes.filter(u => {
      const displayName = u.displayName || u.fullName || u.handle || '';
      const role = u.role || '';
      return displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             role.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [contactsWithVoxes, searchQuery]);

  // Active contact recordings
  const activeThreadRecordings = useMemo(() => {
    return recordings
      .filter(r => r.contactId === activeContactId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [recordings, activeContactId]);

  const activeContact = pulseUsers.find(u => u.id === activeContactId);

  // ============================================
  // PHASE 5: AI ENHANCEMENT HANDLERS
  // ============================================

  // Summarize conversation
  const handleSummarizeConversation = useCallback(async () => {
    if (activeThreadRecordings.length === 0) return;

    setIsSummarizing(true);
    try {
      const messages = activeThreadRecordings.map(rec => ({
        id: rec.id,
        transcription: rec.transcription || '',
        sender: rec.sender,
        senderName: rec.sender === 'other' ? activeContact?.displayName || activeContact?.handle : undefined,
        timestamp: rec.timestamp,
        duration: rec.duration,
      }));

      const summary = await summarizeConversation(apiKey, messages);
      if (summary) {
        setConversationSummary(summary);
        setShowSummary(true);
        toast.success('Conversation summarized!');
      } else {
        toast.error('Failed to generate summary');
      }
    } catch (error) {
      console.error('Summarization error:', error);
      toast.error('Failed to generate summary');
    } finally {
      setIsSummarizing(false);
    }
  }, [activeThreadRecordings, activeContact, apiKey]);

  // ============================================
  // RECORDING FUNCTIONS
  // ============================================

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Set up audio analysis
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        let blob = new Blob(chunksRef.current, { type: mimeType });
        const duration = (Date.now() - startTimeRef.current) / 1000;

        // Apply audio enhancement if enabled
        if (settings.audioEnhancement) {
          try {
            toast.loading('Enhancing audio...', { id: 'audio-enhance' });
            const enhancedResult = await audioEnhancementService.enhanceAudio(blob, {
              noiseReduction: settings.noiseReduction,
              normalize: true,
              enhanceClarity: settings.enhanceVoiceClarity,
              enhanceVoice: settings.enhanceVoiceClarity,
            });
            blob = enhancedResult.blob;
            toast.success(`Audio enhanced (${enhancedResult.appliedEnhancements.join(', ')})`, { id: 'audio-enhance' });
          } catch (e) {
            console.error('Audio enhancement error:', e);
            toast.error('Enhancement failed, using original', { id: 'audio-enhance' });
          }
        }

        const url = URL.createObjectURL(blob);

        // Decode audio for waveform
        let audioBuffer: AudioBuffer | undefined;
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const audioCtx = new AudioContext();
          audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
          console.error('Error decoding audio:', e);
        }

        setPendingRecording({ blob, url, duration, audioBuffer });

        // Start transcription based on engine selection
        if (settings.autoTranscribe) {
          setIsAnalyzing(true);
          try {
            if (settings.transcriptionEngine === 'whisper') {
              // Use OpenAI Whisper API
              const isWhisperConfigured = await whisperService.isConfigured();
              if (isWhisperConfigured) {
                toast.loading('Transcribing with Whisper...', { id: 'transcribe' });
                const result = await whisperService.transcribeWithWordTimestamps(blob);
                setTranscript(result.text || '');
                toast.success(`Transcribed (${result.language || 'detected'})`, { id: 'transcribe' });
              } else {
                // Fallback to Gemini if Whisper not configured
                toast.loading('Transcribing...', { id: 'transcribe' });
                if (apiKey) {
                  const base64 = await blobToBase64(blob);
                  const transcriptText = await transcribeMedia(apiKey, base64, 'audio/webm');
                  setTranscript(transcriptText || '');
                }
                toast.success('Transcribed', { id: 'transcribe' });
              }
            } else {
              // Use Gemini
              if (apiKey) {
                toast.loading('Transcribing with Gemini...', { id: 'transcribe' });
                const base64 = await blobToBase64(blob);
                const transcriptText = await transcribeMedia(apiKey, base64, 'audio/webm');
                setTranscript(transcriptText || '');
                toast.success('Transcribed', { id: 'transcribe' });
              }
            }
          } catch (e) {
            console.error('Transcription error:', e);
            toast.error('Transcription failed', { id: 'transcribe' });
          }
          setIsAnalyzing(false);
        }
      };

      startTimeRef.current = Date.now();
      mediaRecorderRef.current.start(100);
      setIsRecording(true);

      // Update duration timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((Date.now() - startTimeRef.current) / 1000);

        // Update audio level
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(avg / 255);
        }
      }, 50);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone');
    }
  }, [apiKey]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setRecordingDuration(0);
      setAudioLevel(0);
    }
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const cancelRecording = useCallback(() => {
    setPendingRecording(null);
    setTranscript('');
  }, []);

  const sendRecording = useCallback(async () => {
    if (!pendingRecording || !activeContactId) return;

    const newRecording: Recording = {
      id: `rec-${Date.now()}`,
      blob: pendingRecording.blob,
      url: pendingRecording.url,
      duration: pendingRecording.duration,
      timestamp: new Date(),
      transcription: transcript || undefined,
      sender: 'me',
      contactId: activeContactId,
      status: 'sent',
    };

    setRecordings(prev => [...prev, newRecording]);
    setPendingRecording(null);
    setTranscript('');

    // Save to database (don't pass id - let database generate UUID)
    try {
      await dataService.saveVoxerRecording({
        audio_url: newRecording.url,
        duration: newRecording.duration,
        contact_id: activeContactId,
        is_outgoing: true,
        transcript: transcript,
        recorded_at: new Date().toISOString(),
      });
      toast.success('Vox sent!');
    } catch (e) {
      console.error('Error saving recording:', e);
    }
  }, [pendingRecording, activeContactId, transcript]);

  const retryRecording = useCallback(() => {
    setPendingRecording(null);
    setTranscript('');
    startRecording();
  }, [startRecording]);

  // ============================================
  // PLAYBACK FUNCTIONS
  // ============================================

  const playRecording = useCallback((recording: Recording) => {
    if (audioRef.current) {
      audioRef.current.src = recording.url;
      audioRef.current.play();
      setPlayingId(recording.id);
    }
  }, []);

  const pausePlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
    }
  }, []);

  const toggleStar = useCallback(async (recordingId: string) => {
    setRecordings(prev => prev.map(r =>
      r.id === recordingId ? { ...r, starred: !r.starred } : r
    ));
    const recording = recordings.find(r => r.id === recordingId);
    if (recording) {
      await dataService.updateVoxerRecording(recordingId, { starred: !recording.starred });
    }
  }, [recordings]);

  const deleteRecording = useCallback(async (recordingId: string) => {
    setRecordings(prev => prev.filter(r => r.id !== recordingId));
    await dataService.deleteVoxerRecording(recordingId);
    toast.success('Vox deleted');
  }, []);

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get last vox for contact
  const getLastVox = (contactId: string) => {
    return recordings.filter(r => r.contactId === contactId).pop();
  };

  // ============================================
  // VOX MESSAGE ACTIONS
  // ============================================

  // Download a single Vox message
  const downloadVoxMessage = useCallback(async (recording: Recording) => {
    try {
      const contact = pulseUsers.find(u => u.id === recording.contactId);
      const contactName = contact?.displayName || contact?.handle || 'unknown';
      const dateStr = recording.timestamp.toISOString().split('T')[0];
      const timeStr = recording.timestamp.toTimeString().split(' ')[0].replace(/:/g, '-');
      const filename = `vox_${contactName}_${dateStr}_${timeStr}.webm`;

      // Create download link
      const url = URL.createObjectURL(recording.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Vox downloaded!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download Vox');
    }
  }, [pulseUsers]);

  // Archive all messages from a conversation
  const archiveConversation = useCallback(async (contactId: string) => {
    try {
      const contact = pulseUsers.find(u => u.id === contactId);
      const contactName = contact?.displayName || contact?.handle || 'unknown';
      const conversationRecordings = recordings.filter(r => r.contactId === contactId);

      if (conversationRecordings.length === 0) {
        toast.error('No messages to archive');
        return;
      }

      // Create a manifest file with metadata
      const manifest = {
        contact: contactName,
        contactId,
        exportDate: new Date().toISOString(),
        messageCount: conversationRecordings.length,
        messages: conversationRecordings.map(r => ({
          id: r.id,
          sender: r.sender,
          duration: r.duration,
          timestamp: r.timestamp.toISOString(),
          transcription: r.transcription,
          starred: r.starred,
          bookmarked: r.bookmarked,
        })),
      };

      // Create zip-like structure using data URLs (simplified for browser)
      // In production, you'd use JSZip or similar
      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
      const manifestUrl = URL.createObjectURL(manifestBlob);
      const a = document.createElement('a');
      a.href = manifestUrl;
      a.download = `voxer_archive_${contactName}_${new Date().toISOString().split('T')[0]}_manifest.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(manifestUrl);

      // Download each audio file
      for (let i = 0; i < conversationRecordings.length; i++) {
        const rec = conversationRecordings[i];
        setTimeout(() => downloadVoxMessage(rec), i * 500); // Stagger downloads
      }

      toast.success(`Archiving ${conversationRecordings.length} messages...`);
    } catch (error) {
      console.error('Archive error:', error);
      toast.error('Failed to archive conversation');
    }
  }, [pulseUsers, recordings, downloadVoxMessage]);

  // Toggle bookmark on a message
  const toggleBookmark = useCallback(async (recordingId: string) => {
    setRecordings(prev => prev.map(r =>
      r.id === recordingId ? { ...r, bookmarked: !r.bookmarked } : r
    ));
    const recording = recordings.find(r => r.id === recordingId);
    if (recording) {
      await dataService.updateVoxerRecording(recordingId, { bookmarked: !recording.bookmarked });
      toast.success(recording.bookmarked ? 'Bookmark removed' : 'Bookmarked!');
    }
  }, [recordings]);

  // Add reaction to a message
  const addReaction = useCallback(async (recordingId: string, emoji: string) => {
    setRecordings(prev => prev.map(r => {
      if (r.id === recordingId) {
        const reactions = r.reactions || [];
        const existingIdx = reactions.findIndex(rx => rx.emoji === emoji);
        if (existingIdx >= 0) {
          // Remove if same emoji
          return { ...r, reactions: reactions.filter((_, i) => i !== existingIdx) };
        }
        return { ...r, reactions: [...reactions, { emoji, userId: 'me', timestamp: new Date() }] };
      }
      return r;
    }));
    setShowReactionPicker(null);
    toast.success('Reaction added!');
  }, []);

  // Forward a message (copy to clipboard or select new recipient)
  const forwardMessage = useCallback((recording: Recording) => {
    // For now, copy the URL to clipboard
    navigator.clipboard.writeText(`Vox message: ${recording.transcription || 'Voice message'}`);
    toast.success('Message copied to clipboard');
    setShowMessageMenu(null);
  }, []);

  // Set reply context
  const setReplyContext = useCallback((recording: Recording) => {
    setReplyingTo(recording);
    setShowMessageMenu(null);
  }, []);

  // ============================================
  // PHASE 5: AI ENHANCEMENT HANDLERS (CONTINUED)
  // ============================================

  // Generate smart replies
  const handleGenerateSmartReplies = async () => {
    const lastOtherMessage = activeThreadRecordings
      .filter(r => r.sender === 'other')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (!lastOtherMessage || !lastOtherMessage.transcription) {
      toast.error('No message to reply to');
      return;
    }

    setIsGeneratingReplies(true);
    try {
      const context = activeThreadRecordings.slice(-5).map(rec => ({
        id: rec.id,
        transcription: rec.transcription || '',
        sender: rec.sender,
        senderName: rec.sender === 'other' ? activeContact?.displayName || activeContact?.handle : undefined,
        timestamp: rec.timestamp,
        duration: rec.duration,
      }));

      const replies = await generateSmartReplies(apiKey, {
        id: lastOtherMessage.id,
        transcription: lastOtherMessage.transcription,
        sender: lastOtherMessage.sender,
        senderName: activeContact?.displayName || activeContact?.handle,
        timestamp: lastOtherMessage.timestamp,
        duration: lastOtherMessage.duration,
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
      setIsGeneratingReplies(false);
    }
  };

  // Generate meeting notes
  const handleGenerateMeetingNotes = async () => {
    if (activeThreadRecordings.length === 0) return;

    setIsGeneratingNotes(true);
    try {
      const messages = activeThreadRecordings.map(rec => ({
        id: rec.id,
        transcription: rec.transcription || '',
        sender: rec.sender,
        senderName: rec.sender === 'other' ? activeContact?.displayName || activeContact?.handle : undefined,
        timestamp: rec.timestamp,
        duration: rec.duration,
      }));

      const notes = await generateMeetingNotes(
        apiKey,
        messages,
        `Conversation with ${activeContact?.displayName || activeContact?.handle || 'Contact'}`
      );

      if (notes) {
        setMeetingNotes(notes);
        toast.success('Meeting notes generated!');
      } else {
        toast.error('Failed to generate meeting notes');
      }
    } catch (error) {
      console.error('Meeting notes error:', error);
      toast.error('Failed to generate meeting notes');
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  // Generate chapters for long message
  const handleGenerateChapters = async (recording: Recording) => {
    if (recording.duration < 120 || !recording.transcription) {
      toast.error('Message too short for chapters (need 2+ min with transcription)');
      return;
    }

    try {
      toast.loading('Generating chapters...', { id: 'chapters' });
      const chapters = await generateAutoChapters(
        apiKey,
        recording.transcription,
        recording.duration
      );

      if (chapters.length > 0) {
        setActiveChapters(chapters);
        setChapterRecordingId(recording.id);
        toast.success(`${chapters.length} chapters generated!`, { id: 'chapters' });
      } else {
        toast.error('Failed to generate chapters', { id: 'chapters' });
      }
    } catch (error) {
      console.error('Chapters error:', error);
      toast.error('Failed to generate chapters', { id: 'chapters' });
    }
  };

  // Handle smart reply selection
  const handleSelectSmartReply = (replyText: string) => {
    navigator.clipboard.writeText(replyText);
    toast.success('Smart reply copied! Use it in your next message.');
    setSmartReplies([]);
  };

  // ============================================
  // PHASE 6: KEYBOARD SHORTCUTS (After all handlers defined)
  // ============================================

  useVoxerKeyboardShortcuts({
    onToggleRecording: () => {
      if (!isRecording) startRecording();
      else stopRecording();
    },
    onStopRecording: () => {
      if (isRecording) stopRecording();
    },
    onGoBack: () => {
      if (activeContactId) setActiveContactId('');
    },
    onSwitchMode: (mode) => {
      // Handle mode switching - would need to be passed from parent
      console.log('Switch to mode:', mode);
    },
    onDownload: () => {
      if (isSelectionMode && selectionCount > 0) {
        // Trigger download modal
        console.log('Download selected items');
      }
    },
    onArchive: () => {
      if (isSelectionMode && selectionCount > 0) {
        // Trigger archive
        console.log('Archive selected items');
      }
    },
    onSummarize: handleSummarizeConversation,
    onShowHelp: () => setShowShortcutsHelp(true),
  }, true);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={`classic-voxer ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingId(null)}
        onPause={() => setPlayingId(null)}
      />

      {/* Contact List Sidebar */}
      <aside className={`classic-voxer-sidebar ${mobileView === 'list' ? 'visible' : 'hidden-mobile'}`}>
        {/* Header */}
        <VoxModeHeader
          modeName="Classic Voxer"
          modeTagline="Hold to talk"
          modeColor="#F97316"
          modeIcon={Radio}
          onBack={onBack}
          isDarkMode={isDarkMode}
          actions={
            <button
              type="button"
              onClick={() => setShowNewVoxModal(true)}
              className="classic-voxer-new-btn"
              title="New Vox"
              aria-label="Start new Vox conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          }
        />

        {/* Search */}
        <div className="classic-voxer-search">
          <Search className="w-4 h-4" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Contact List */}
        <div className="classic-voxer-contacts">
          {filteredContacts.length === 0 ? (
            <div className="classic-voxer-empty">
              <MessageCircle className="w-8 h-8" />
              <p>No conversations yet</p>
              <span>Start a new Vox to begin</span>
            </div>
          ) : (
            filteredContacts.map(user => {
              const lastVox = getLastVox(user.id);
              const isActive = activeContactId === user.id;
              const displayName = user.displayName || user.fullName || user.handle || 'Unknown';
              const initials = displayName.charAt(0).toUpperCase();

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setActiveContactId(user.id);
                    setMobileView('thread');
                  }}
                  className={`classic-voxer-contact ${isActive ? 'active' : ''}`}
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={displayName}
                      className="classic-voxer-avatar-img"
                    />
                  ) : (
                    <div className="classic-voxer-avatar classic-voxer-avatar-placeholder">
                      {initials}
                    </div>
                  )}
                  <div className={`classic-voxer-status ${user.onlineStatus === 'online' ? 'online' : ''}`} />
                  <div className="classic-voxer-contact-info">
                    <div className="classic-voxer-contact-header">
                      <h3>{displayName}</h3>
                      {lastVox && (
                        <span className="classic-voxer-time">
                          {lastVox.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="classic-voxer-preview">
                      {lastVox ? (
                        <>
                          <Mic className="w-3 h-3" />
                          <span>{lastVox.sender === 'me' ? 'You: ' : ''}Voice message</span>
                        </>
                      ) : (
                        <span>Tap to start vox</span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 classic-voxer-chevron" />
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Thread Area */}
      <main className={`classic-voxer-main ${mobileView === 'thread' ? 'visible' : 'hidden-mobile'}`}>
        {activeContact ? (
          <>
            {/* Thread Header */}
            <header className="classic-voxer-thread-header">
              <button
                type="button"
                onClick={() => setMobileView('list')}
                className="classic-voxer-mobile-back"
                title="Back to contacts"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {activeContact.avatarUrl ? (
                <img
                  src={activeContact.avatarUrl}
                  alt={activeContact.displayName || activeContact.handle || 'User'}
                  className="classic-voxer-avatar-img"
                />
              ) : (
                <div className="classic-voxer-avatar classic-voxer-avatar-placeholder">
                  {(activeContact.displayName || activeContact.fullName || activeContact.handle || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="classic-voxer-thread-info">
                <h2>{activeContact.displayName || activeContact.fullName || activeContact.handle || 'Unknown User'}</h2>
                <span>{activeContact.role || (activeContact.handle ? `@${activeContact.handle}` : activeContact.onlineStatus)}</span>
              </div>
              <div className="classic-voxer-thread-actions">
                {/* AI Enhancement Buttons */}
                <div className="flex items-center gap-2 border-r border-zinc-200 dark:border-zinc-800 pr-2 mr-2">
                  <button
                    type="button"
                    onClick={handleSummarizeConversation}
                    disabled={activeThreadRecordings.length === 0 || isSummarizing}
                    className="px-3 py-1.5 rounded-lg bg-purple-500 text-white text-xs font-medium hover:bg-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="AI Summarize Conversation"
                  >
                    {isSummarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    <span className="ml-1.5 hidden md:inline">Summarize</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateSmartReplies}
                    disabled={isGeneratingReplies}
                    className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Generate Smart Replies"
                  >
                    {isGeneratingReplies ? <Loader2 className="w-3 h-3 animate-spin" /> : <Reply className="w-3 h-3" />}
                    <span className="ml-1.5 hidden md:inline">Quick Reply</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateMeetingNotes}
                    disabled={activeThreadRecordings.length === 0 || isGeneratingNotes}
                    className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Generate Meeting Notes"
                  >
                    {isGeneratingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageCircle className="w-3 h-3" />}
                    <span className="ml-1.5 hidden md:inline">Notes</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="classic-voxer-action-btn"
                  title="Select messages"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    enterSelectionMode();
                  }}
                  style={{
                    background: isSelectionMode ? '#F97316' : undefined,
                    color: isSelectionMode ? 'white' : undefined,
                  }}
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="classic-voxer-action-btn"
                  title="Archive conversation"
                  onClick={() => archiveConversation(activeContactId)}
                >
                  <Archive className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="classic-voxer-action-btn"
                  title="Voxer settings"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Messages */}
            <div className="classic-voxer-messages">
              {activeThreadRecordings.length === 0 ? (
                <VoxEmptyState
                  {...emptyConfig}
                  isDarkMode={isDarkMode}
                  action={{
                    label: 'Start Recording',
                    onClick: () => {
                      if (!isRecording) startRecording();
                    },
                  }}
                />
              ) : (
                activeThreadRecordings.map(recording => (
                  <div
                    key={recording.id}
                    className={`classic-voxer-message ${recording.sender === 'me' ? 'sent' : 'received'}`}
                  >
                    <div className="classic-voxer-message-content">
                      {/* Selection mode checkbox */}
                      {isSelectionMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const selectionItem: VoxSelectionItem = {
                              id: recording.id,
                              type: 'audio',
                              url: recording.url,
                              duration: recording.duration,
                              timestamp: recording.timestamp,
                              sender: recording.sender,
                              transcript: recording.transcription,
                              mode: 'classic',
                              contactId: recording.contactId,
                              contactName: activeContact?.displayName || activeContact?.handle,
                            };
                            toggleSelection(selectionItem);
                          }}
                          className={`absolute top-3 ${recording.sender === 'me' ? 'left-3' : 'right-3'} w-7 h-7 rounded-lg flex items-center justify-center transition-all shadow-lg hover:scale-110 active:scale-95 z-10 ${
                            isSelected(recording.id)
                              ? 'bg-orange-500 border-2 border-orange-600'
                              : 'bg-white dark:bg-gray-700 border-2 border-gray-400 dark:border-gray-500'
                          }`}
                          style={{
                            boxShadow: isSelected(recording.id)
                              ? '0 4px 12px rgba(249, 115, 22, 0.4)'
                              : '0 2px 8px rgba(0, 0, 0, 0.2)',
                          }}
                        >
                          {isSelected(recording.id) && <Check className="w-5 h-5 text-white font-bold" />}
                        </button>
                      )}

                      {/* Playback controls */}
                      <button
                        type="button"
                        onClick={() =>
                          playingId === recording.id
                            ? pausePlayback()
                            : playRecording(recording)
                        }
                        className="classic-voxer-play-btn"
                      >
                        {playingId === recording.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>

                      {/* Waveform placeholder */}
                      <div className="classic-voxer-waveform">
                        <div className="classic-voxer-waveform-bars">
                          {[...Array(24)].map((_, i) => (
                            <div
                              key={i}
                              className="classic-voxer-waveform-bar"
                              style={{
                                height: `${30 + Math.random() * 50}%`,
                                opacity: playingId === recording.id ? 1 : 0.5,
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Phase 6: Playback Speed Control */}
                      <PlaybackSpeedControl
                        speed={playbackSpeed}
                        onSpeedChange={setPlaybackSpeed}
                        isDarkMode={isDarkMode}
                        compact={true}
                      />

                    </div>

                    {/* Message Actions Bar */}
                    <div className="classic-voxer-message-actions-bar">
                      <button
                        type="button"
                        onClick={() => toggleStar(recording.id)}
                        className={`classic-voxer-action-icon ${recording.starred ? 'active' : ''}`}
                        title="Star"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleBookmark(recording.id)}
                        className={`classic-voxer-action-icon ${recording.bookmarked ? 'active' : ''}`}
                        title="Bookmark"
                      >
                        {recording.bookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyContext(recording)}
                        className="classic-voxer-action-icon"
                        title="Reply"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowReactionPicker(showReactionPicker === recording.id ? null : recording.id)}
                        className="classic-voxer-action-icon"
                        title="Add reaction"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMessageMenu(showMessageMenu === recording.id ? null : recording.id)}
                        className="classic-voxer-action-icon"
                        title="More actions"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Reaction Picker */}
                    {showReactionPicker === recording.id && (
                      <div className="classic-voxer-reaction-picker">
                        {QUICK_REACTIONS.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => addReaction(recording.id, emoji)}
                            className="classic-voxer-reaction-btn"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Message Menu */}
                    {showMessageMenu === recording.id && (
                      <div className="classic-voxer-message-menu">
                        <button type="button" onClick={() => downloadVoxMessage(recording)}>
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </button>
                        <button type="button" onClick={() => forwardMessage(recording)}>
                          <Forward className="w-4 h-4" />
                          <span>Forward</span>
                        </button>
                        <button type="button" onClick={() => forwardMessage(recording)}>
                          <Share2 className="w-4 h-4" />
                          <span>Share</span>
                        </button>
                        <button type="button" onClick={() => deleteRecording(recording.id)} className="danger">
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}

                    {/* Reactions Display */}
                    {recording.reactions && recording.reactions.length > 0 && (
                      <div className="classic-voxer-reactions-display">
                        {recording.reactions.map((reaction, idx) => (
                          <span key={idx} className="classic-voxer-reaction-badge">
                            {reaction.emoji}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Transcription */}
                    {recording.transcription && (
                      <div className="classic-voxer-transcription">
                        <Sparkles className="w-3 h-3" />
                        <p>{recording.transcription}</p>
                      </div>
                    )}

                    {/* Chapter button for long messages */}
                    {recording.duration >= 120 && recording.transcription && (
                      <button
                        type="button"
                        onClick={() => handleGenerateChapters(recording)}
                        className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline mt-1 flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3" />
                        Show Chapters
                      </button>
                    )}

                    {/* Meta info */}
                    <div className="classic-voxer-message-meta">
                      <span>{recording.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {recording.sender === 'me' && (
                        <span className="classic-voxer-status-icon">
                          {recording.status === 'read' ? (
                            <CheckCheck className="w-3 h-3" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Recording Preview */}
            {pendingRecording && (
              <div className="classic-voxer-preview-overlay">
                <div className="classic-voxer-preview-card">
                  <RecordingPreview
                    recordingData={{
                      blob: pendingRecording.blob,
                      url: pendingRecording.url,
                      duration: pendingRecording.duration,
                      audioBuffer: pendingRecording.audioBuffer,
                    }}
                    onSend={sendRecording}
                    onCancel={cancelRecording}
                    onRetry={retryRecording}
                    isAnalyzing={isAnalyzing}
                    transcript={transcript}
                    color={accentColor}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>
            )}

            {/* Recording Controls */}
            <div className="classic-voxer-controls">
              <VoxRecordArea
                modeColor="#F97316"
                isDarkMode={isDarkMode}
                isRecording={isRecording}
                isPreviewing={isPreviewing}
                recordingMode={recordingMode}
                onToggleRecordingMode={() => setRecordingMode(mode => mode === 'hold' ? 'tap' : 'hold')}
                onPointerDown={startRecording}
                onPointerUp={stopRecording}
                onToggleRecording={toggleRecording}
              />
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="classic-voxer-empty-state">
            <div className="classic-voxer-empty-icon">
              <div className="classic-voxer-empty-rings">
                <div className="ring ring-1" />
                <div className="ring ring-2" />
                <div className="ring ring-3" />
              </div>
              <div className="classic-voxer-walkie">
                <div className="walkie-antenna" />
                <div className="walkie-body">
                  <div className="walkie-speaker" />
                  <div className="walkie-indicator" />
                </div>
              </div>
            </div>
            <h2>Ready to Vox</h2>
            <p>Select a contact or start a new conversation</p>
          </div>
        )}
      </main>

      {/* New Vox Modal - Pulse Users Only */}
      {showNewVoxModal && (
        <div className="classic-voxer-modal-overlay" onClick={() => setShowNewVoxModal(false)}>
          <div className="classic-voxer-modal" onClick={e => e.stopPropagation()}>
            <header className="classic-voxer-modal-header">
              <h3>New Vox</h3>
              <button type="button" onClick={() => setShowNewVoxModal(false)} title="Close">
                <X className="w-5 h-5" />
              </button>
            </header>
            <div className="classic-voxer-modal-search">
              <Search className="w-4 h-4" />
              <input
                type="text"
                placeholder="Search Pulse users..."
                value={modalSearchQuery}
                onChange={(e) => setModalSearchQuery(e.target.value)}
              />
            </div>
            <div className="classic-voxer-modal-contacts">
              {isLoadingUsers ? (
                <div className="classic-voxer-modal-loading">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Loading Pulse users...</span>
                </div>
              ) : pulseUsers.length === 0 ? (
                <div className="classic-voxer-modal-empty">
                  <Users className="w-8 h-8" />
                  <p>No Pulse users found</p>
                  <span>Invite others to join Pulse</span>
                </div>
              ) : (
                pulseUsers.map(user => {
                  const displayName = user.displayName || user.fullName || user.handle || 'Unknown';
                  const initials = displayName.charAt(0).toUpperCase();
                  const subtitle = user.role || (user.handle ? `@${user.handle}` : user.company) || '';

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setActiveContactId(user.id);
                        setMobileView('thread');
                        setShowNewVoxModal(false);
                      }}
                      className="classic-voxer-modal-contact"
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={displayName}
                          className="classic-voxer-avatar-img"
                        />
                      ) : (
                        <div className="classic-voxer-avatar classic-voxer-avatar-placeholder">
                          {initials}
                        </div>
                      )}
                      <div className={`classic-voxer-modal-status ${user.onlineStatus === 'online' ? 'online' : ''}`} />
                      <div className="classic-voxer-modal-contact-info">
                        <h4>{displayName}</h4>
                        <span>{subtitle}</span>
                      </div>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="classic-voxer-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="classic-voxer-settings-modal" onClick={e => e.stopPropagation()}>
            <header className="classic-voxer-modal-header">
              <h3>Voxer Settings</h3>
              <button type="button" onClick={() => setShowSettings(false)} title="Close">
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="classic-voxer-settings-content">
              {/* Audio Quality */}
              <div className="classic-voxer-setting-item">
                <div className="classic-voxer-setting-label">
                  <Volume2 className="w-4 h-4" />
                  <span>Audio Quality</span>
                </div>
                <select
                  value={settings.audioQuality}
                  onChange={(e) => setSettings(prev => ({ ...prev, audioQuality: e.target.value as 'standard' | 'high' | 'ultra' }))}
                  className="classic-voxer-setting-select"
                  title="Select audio quality"
                  aria-label="Audio quality"
                >
                  <option value="standard">Standard</option>
                  <option value="high">High</option>
                  <option value="ultra">Ultra HD</option>
                </select>
              </div>

              {/* Visualizer Sensitivity */}
              <div className="classic-voxer-setting-item">
                <div className="classic-voxer-setting-label">
                  <Sliders className="w-4 h-4" />
                  <span>Visualizer Sensitivity</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={settings.visualizerSensitivity}
                  onChange={(e) => setSettings(prev => ({ ...prev, visualizerSensitivity: parseFloat(e.target.value) }))}
                  className="classic-voxer-setting-slider"
                  title="Adjust visualizer sensitivity"
                  aria-label="Visualizer sensitivity"
                />
                <span className="classic-voxer-setting-value">{Math.round(settings.visualizerSensitivity * 100)}%</span>
              </div>

              {/* Playback Speed */}
              <div className="classic-voxer-setting-item">
                <div className="classic-voxer-setting-label">
                  <Clock className="w-4 h-4" />
                  <span>Playback Speed</span>
                </div>
                <select
                  value={settings.playbackSpeed}
                  onChange={(e) => {
                    const speed = parseFloat(e.target.value);
                    setSettings(prev => ({ ...prev, playbackSpeed: speed }));
                    if (audioRef.current) audioRef.current.playbackRate = speed;
                  }}
                  className="classic-voxer-setting-select"
                  title="Select playback speed"
                  aria-label="Playback speed"
                >
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1x (Normal)</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>

              {/* Auto Transcribe */}
              <div className="classic-voxer-setting-item">
                <div className="classic-voxer-setting-label">
                  <Sparkles className="w-4 h-4" />
                  <span>Auto-Transcribe Messages</span>
                </div>
                <label className="classic-voxer-toggle">
                  <input
                    type="checkbox"
                    checked={settings.autoTranscribe}
                    onChange={(e) => setSettings(prev => ({ ...prev, autoTranscribe: e.target.checked }))}
                    title="Toggle auto-transcribe"
                    aria-label="Auto-transcribe messages"
                  />
                  <span className="classic-voxer-toggle-slider" />
                </label>
              </div>

              {/* Transcription Engine */}
              <div className="classic-voxer-setting-item">
                <div className="classic-voxer-setting-label">
                  <MessageCircle className="w-4 h-4" />
                  <span>Transcription Engine</span>
                </div>
                <select
                  value={settings.transcriptionEngine}
                  onChange={(e) => setSettings(prev => ({ ...prev, transcriptionEngine: e.target.value as 'gemini' | 'whisper' }))}
                  className="classic-voxer-setting-select"
                  title="Select transcription engine"
                  aria-label="Transcription engine"
                >
                  <option value="whisper">OpenAI Whisper (Recommended)</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>

              {/* Divider */}
              <div className="classic-voxer-settings-divider">
                <span>Audio Enhancement</span>
              </div>

              {/* Audio Enhancement */}
              <div className="classic-voxer-setting-item">
                <div className="classic-voxer-setting-label">
                  <Volume2 className="w-4 h-4" />
                  <span>AI Audio Enhancement</span>
                </div>
                <label className="classic-voxer-toggle">
                  <input
                    type="checkbox"
                    checked={settings.audioEnhancement}
                    onChange={(e) => setSettings(prev => ({ ...prev, audioEnhancement: e.target.checked }))}
                    title="Toggle audio enhancement"
                    aria-label="AI audio enhancement"
                  />
                  <span className="classic-voxer-toggle-slider" />
                </label>
              </div>

              {/* Noise Reduction */}
              <div className="classic-voxer-setting-item">
                <div className="classic-voxer-setting-label">
                  <Mic className="w-4 h-4" />
                  <span>Noise Reduction</span>
                </div>
                <label className="classic-voxer-toggle">
                  <input
                    type="checkbox"
                    checked={settings.noiseReduction}
                    onChange={(e) => setSettings(prev => ({ ...prev, noiseReduction: e.target.checked }))}
                    title="Toggle noise reduction"
                    aria-label="Noise reduction"
                  />
                  <span className="classic-voxer-toggle-slider" />
                </label>
              </div>

              {/* Voice Clarity Enhancement */}
              <div className="classic-voxer-setting-item">
                <div className="classic-voxer-setting-label">
                  <Sparkles className="w-4 h-4" />
                  <span>Enhance Voice Clarity</span>
                </div>
                <label className="classic-voxer-toggle">
                  <input
                    type="checkbox"
                    checked={settings.enhanceVoiceClarity}
                    onChange={(e) => setSettings(prev => ({ ...prev, enhanceVoiceClarity: e.target.checked }))}
                    title="Toggle voice clarity enhancement"
                    aria-label="Enhance voice clarity"
                  />
                  <span className="classic-voxer-toggle-slider" />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reply Context Bar */}
      {replyingTo && (
        <div className="classic-voxer-reply-bar">
          <Reply className="w-4 h-4" />
          <span>Replying to: {replyingTo.transcription?.slice(0, 50) || 'Voice message'}...</span>
          <button type="button" onClick={() => setReplyingTo(null)} title="Cancel reply">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Phase 2: Selection Toolbar */}
      {isSelectionMode && (
        <VoxSelectToolbar
          selectedItems={selectedItems}
          selectionCount={selectionCount}
          totalDuration={getTotalDuration()}
          onSelectAll={() => {
            const allItems: VoxSelectionItem[] = activeThreadRecordings.map(rec => ({
              id: rec.id,
              type: 'audio' as const,
              url: rec.url,
              duration: rec.duration,
              timestamp: rec.timestamp,
              sender: rec.sender,
              transcript: rec.transcription,
              mode: 'classic' as const,
              contactId: rec.contactId,
              contactName: activeContact?.displayName || activeContact?.handle,
            }));
            selectAll(allItems);
          }}
          onDeselectAll={deselectAll}
          onExitSelection={exitSelectionMode}
          contactName={activeContact?.displayName || activeContact?.handle}
          isDarkMode={isDarkMode}
          accentColor="#F97316"
          allSelected={selectionCount === activeThreadRecordings.length && activeThreadRecordings.length > 0}
        />
      )}

      {/* Phase 5: AI Enhancement Panels */}

      {/* Conversation Summary Modal */}
      {conversationSummary && showSummary && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <VoxConversationSummary
              summary={conversationSummary}
              isDarkMode={isDarkMode}
              accentColor="#A855F7"
              onClose={() => setShowSummary(false)}
            />
          </div>
        </div>
      )}

      {/* Smart Replies Panel */}
      {smartReplies.length > 0 && (
        <div className="fixed bottom-20 right-4 z-40 w-96">
          <VoxSmartReplies
            replies={smartReplies}
            onSelectReply={handleSelectSmartReply}
            isDarkMode={isDarkMode}
            accentColor="#3B82F6"
          />
        </div>
      )}

      {/* Meeting Notes Modal */}
      {meetingNotes && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <VoxMeetingNotes
              notes={meetingNotes}
              isDarkMode={isDarkMode}
              accentColor="#10B981"
              onClose={() => setMeetingNotes(null)}
            />
          </div>
        </div>
      )}

      {/* Auto-Chapters Panel */}
      {activeChapters.length > 0 && chapterRecordingId && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-2xl mx-auto">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setActiveChapters([]);
                setChapterRecordingId(null);
              }}
              className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-cyan-500 text-white hover:bg-cyan-600 transition flex items-center justify-center shadow-lg"
              title="Close chapters"
            >
              <X className="w-4 h-4" />
            </button>
            <VoxAutoChapters
              chapters={activeChapters}
              currentTime={0}
              onSeek={(time) => {
                // Implement seek functionality if needed
                console.log('Seek to:', time);
              }}
              isDarkMode={isDarkMode}
              accentColor="#06B6D4"
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
    </div>
  );
};

export default ClassicVoxerMode;
