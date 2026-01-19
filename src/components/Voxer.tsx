
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import AudioVisualizer from './AudioVisualizer';
import WaveformVisualizer from './WaveformVisualizer';
import { blobToBase64 } from '../services/audioService';
import { transcribeMedia, processWithModel } from '../services/geminiService';
import { saveArchiveItem } from '../services/dbService';
import { dataService } from '../services/dataService';
import { Contact } from '../types';
import toast from 'react-hot-toast';
import { getVoxerAnalysisService } from '../services/voxer/voxerAnalysisService';
import { getVoxerFeedbackService } from '../services/voxer/voxerFeedbackService';
import { audioEnhancementService } from '../services/voxer/audioEnhancementService';
import { VoxAnalysis as VoxAnalysisType, VoxFeedback } from '../services/voxer/voxerTypes';

// New Voxer Components
import { LiveVoxSession } from './Voxer/LiveVoxSession';
import { VoiceRooms } from './Voxer/VoiceRooms';
import { VoxReactions, QuickReactionBar } from './Voxer/VoxReactions';
import { AIVoiceCoach } from './Voxer/AIVoiceCoach';
import { AIAnalysisPanel } from './Voxer/AIAnalysisPanel';
import { AIFeedbackModal } from './Voxer/AIFeedbackModal';
import { PriorityVoxSelector, PriorityBadge, EmergencyAlert } from './Voxer/PriorityVox';
import { VoxThreads, ThreadIndicator } from './Voxer/VoxThreads';
import { TimeCapsuleVox, ScheduledCapsuleCard } from './Voxer/TimeCapsuleVox';
import { VoiceBookmarks } from './Voxer/VoiceBookmarks';
import { SilentModePanel, SilentModeIndicator, DEFAULT_SILENT_MODE_SETTINGS } from './Voxer/SilentMode';
import { VoxPlaylists, AddToPlaylistModal } from './Voxer/VoxPlaylists';
import { CollaborativeVox } from './Voxer/CollaborativeVox';
import { VoiceCommandsHub, FloatingVoiceButton } from './Voxer/VoiceCommandsHub';
import { VoxPreviewPanel } from './Voxer/VoxPreviewPanel';

// Vox Mode System - 7 Communication Styles
import {
  VoxModeSelector,
  ClassicVoxerMode,
  PulseRadio,
  VoiceThreadsMode,
  TeamVoxMode,
  VoxNotesMode,
  QuickVoxMode,
  VoxDropMode,
  VideoVoxMode,
} from './Voxer/index';
import { VoxMode, VOX_MODES } from '../services/voxer/voxModeTypes';
import { 
  RealtimeTranscriptionService,
  RealtimeTranscriptSegment,
  RealtimeTranscriptionState 
} from '../services/voxer/realtimeTranscriptionService';
import {
  VoxReaction,
  VoxThread,
  VoxThreadReply,
  TimeCapsuleVox as TimeCapsuleType,
  VoiceBookmark,
  SilentModeSettings,
  TranscriptionModeMessage,
  VoxPlaylist,
  CollaborativeVox as CollabVoxType,
  PriorityLevel,
  WakeWordConfig,
  DEFAULT_WAKE_WORD_CONFIG,
} from '../services/voxer/advancedVoxerTypes';

// Enhanced types for voice intelligence
type SentimentType = 'positive' | 'neutral' | 'negative' | 'mixed';
type UrgencyLevel = 'low' | 'medium' | 'high' | 'urgent';

// Legacy interface - kept for backward compatibility
interface VoiceAnalysis {
  sentiment: SentimentType;
  urgency: UrgencyLevel;
  actionItems: string[];
  keyTopics: string[];
  summary?: string;
}

interface VoiceNote {
  id: string;
  recordingId: string;
  content: string;
  timestamp: Date;
}

interface Recording {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  timestamp: Date;
  transcription?: string;
  isTranscribing?: boolean;
  type: 'audio' | 'video';
  sender: 'me' | 'other';
  recipientId: string; // If sender is 'me', this is the contactId
  contactId: string;   // The other person in the conversation
  quality?: string;
  status?: 'sent' | 'delivered' | 'read';
  playedAt?: Date;
  // Enhanced fields
  analysis?: VoiceAnalysis | VoxAnalysisType; // Support both legacy and new analysis
  isAnalyzing?: boolean;
  starred?: boolean;
  tags?: string[];
  notes?: VoiceNote[];
}

interface VoxGroup {
  id: string;
  name: string;
  members: Contact[];
  avatarColor: string;
  createdAt: Date;
}

interface VoxerProps {
  apiKey: string;
  contacts: Contact[];
  initialContactId?: string;
  isDarkMode?: boolean;
}

type VideoQuality = '480p' | '720p' | '1080p';
type SortOption = 'date' | 'duration' | 'sentiment' | 'urgency';
type FilterOption = 'all' | 'starred' | 'actionItems' | 'unplayed';

// Predefined tags for quick tagging
const PREDEFINED_TAGS = ['Important', 'Follow-up', 'Decision', 'Question', 'Idea', 'Personal'];

const Voxer: React.FC<VoxerProps> = ({ apiKey, contacts, initialContactId, isDarkMode = false }) => {
  const [activeContactId, setActiveContactId] = useState<string>(initialContactId || '');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [permissionError, setPermissionError] = useState(false);

  // New Vox / Group Vox state
  const [showNewVoxModal, setShowNewVoxModal] = useState(false);
  const [newVoxType, setNewVoxType] = useState<'individual' | 'group'>('individual');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Contact[]>([]);
  const [groupName, setGroupName] = useState('');
  const [newVoxSearchQuery, setNewVoxSearchQuery] = useState('');
  const newVoxButtonRef = useRef<HTMLButtonElement>(null);
  const [groups, setGroups] = useState<VoxGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Recorder State
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<'audio' | 'video'>('audio'); // Default audio for quick vox
  const [recordingMode, setRecordingMode] = useState<'hold' | 'tap'>('hold');
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('720p');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');

  // Playback State
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Device State
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');

  // Enhanced Voice Intelligence State
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [autoGainControl, setAutoGainControl] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedRecordingForDetails, setSelectedRecordingForDetails] = useState<Recording | null>(null);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [showTagModal, setShowTagModal] = useState(false);
  const [selectedTagRecordingId, setSelectedTagRecordingId] = useState<string | null>(null);
  
  // New Features State
  const [showLiveSession, setShowLiveSession] = useState(false);
  const [showVoiceRooms, setShowVoiceRooms] = useState(false);
  const [realtimeTranscript, setRealtimeTranscript] = useState<string>('');
  const [isRealtimeActive, setIsRealtimeActive] = useState(() => {
    const saved = localStorage.getItem('voxer_realtime_transcription');
    return saved ? JSON.parse(saved) : true; // Enabled by default
  });
  const [transcriptionState, setTranscriptionState] = useState<RealtimeTranscriptionState>('idle');
  const realtimeServiceRef = useRef<RealtimeTranscriptionService | null>(null);
  
  // Advanced Features State
  // 1. Vox Reactions
  const [reactions, setReactions] = useState<Record<string, VoxReaction[]>>({});
  
  // 2. AI Voice Coach
  const [showVoiceCoach, setShowVoiceCoach] = useState(false);
  const [pendingVoxBlob, setPendingVoxBlob] = useState<Blob | null>(null);
  const [pendingVoxTranscript, setPendingVoxTranscript] = useState('');
  const [pendingVoxDuration, setPendingVoxDuration] = useState(0);
  
  // 3. Priority Vox
  const [showPrioritySelector, setShowPrioritySelector] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel>('normal');
  const [emergencyVox, setEmergencyVox] = useState<any>(null);
  
  // 4. Vox Threads
  const [threads, setThreads] = useState<Record<string, VoxThread>>({});
  const [activeThreadVoxId, setActiveThreadVoxId] = useState<string | null>(null);
  
  // 5. Time Capsule
  const [showTimeCapsule, setShowTimeCapsule] = useState(false);
  const [scheduledCapsules, setScheduledCapsules] = useState<TimeCapsuleType[]>([]);
  
  // 6. Voice Bookmarks
  const [bookmarks, setBookmarks] = useState<Record<string, VoiceBookmark[]>>({});
  
  // 7. Silent Mode
  const [silentModeEnabled, setSilentModeEnabled] = useState(false);
  const [silentModeSettings, setSilentModeSettings] = useState<SilentModeSettings>(DEFAULT_SILENT_MODE_SETTINGS);
  const [silentModeMessages, setSilentModeMessages] = useState<TranscriptionModeMessage[]>([]);
  const [showSilentModePanel, setShowSilentModePanel] = useState(false);
  
  // 8. Vox Playlists
  const [playlists, setPlaylists] = useState<VoxPlaylist[]>([]);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [addToPlaylistVoxId, setAddToPlaylistVoxId] = useState<string | null>(null);
  
  // 9. Collaborative Vox
  const [showCollabVox, setShowCollabVox] = useState(false);
  const [activeCollabs, setActiveCollabs] = useState<CollabVoxType[]>([]);
  
  // 10. Voice Commands
  const [voiceCommandsEnabled, setVoiceCommandsEnabled] = useState(false);
  const [showVoiceCommands, setShowVoiceCommands] = useState(false);
  const [voiceCommandConfig, setVoiceCommandConfig] = useState<WakeWordConfig>(DEFAULT_WAKE_WORD_CONFIG);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  
  // 11. Preview Before Send Mode
  const [previewModeEnabled, setPreviewModeEnabled] = useState(() => {
    const saved = localStorage.getItem('voxer_preview_mode');
    return saved ? JSON.parse(saved) : true; // Enabled by default
  });
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);
  const [pendingRecording, setPendingRecording] = useState<{
    blob: Blob;
    url: string;
    duration: number;
    transcription: string;
    isTranscribing: boolean;
  } | null>(null);

  // AI Settings
  const [autoAnalyzeEnabled, setAutoAnalyzeEnabled] = useState(() => {
    const saved = localStorage.getItem('voxer_auto_analyze');
    return saved ? JSON.parse(saved) : true; // Enabled by default
  });
  const [autoFeedbackEnabled, setAutoFeedbackEnabled] = useState(() => {
    const saved = localStorage.getItem('voxer_auto_feedback');
    return saved ? JSON.parse(saved) : true; // Enabled by default
  });
  const [autoEnhanceEnabled, setAutoEnhanceEnabled] = useState(() => {
    const saved = localStorage.getItem('voxer_auto_enhance');
    return saved ? JSON.parse(saved) : true; // Enabled by default
  });

  // AI Feedback State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<VoxFeedback | null>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

  // 12. Vox Mode System - 6 Communication Styles
  // Show mode selector by default when entering Voxer (no mode selected initially)
  const [currentVoxMode, setCurrentVoxMode] = useState<VoxMode | null>(null);
  const [showVoxModeSelector, setShowVoxModeSelector] = useState(true); // Show selector on load
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);

  // Initialize Active Contact
  useEffect(() => {
      if (initialContactId) {
          setActiveContactId(initialContactId);
          setMobileView('thread');
      } else if (contacts.length > 0 && !activeContactId) {
          setActiveContactId(contacts[0].id);
      }
  }, [initialContactId, contacts]);

  // Load recordings from database on mount
  useEffect(() => {
    const loadRecordings = async () => {
      try {
        const dbRecordings = await dataService.getVoxerRecordings();
        
        // Convert database recordings to component Recording format
        const loadedRecordings: Recording[] = await Promise.all(
          dbRecordings.map(async (dbRec: any) => {
            // Create blob URL from stored URL
            let blob: Blob | null = null;
            let url = dbRec.audio_url || '';
            
            if (url) {
              try {
                // Fetch the blob from the URL
                const response = await fetch(url);
                blob = await response.blob();
                url = URL.createObjectURL(blob);
              } catch (e) {
                console.error('Error loading recording blob:', e);
              }
            }

            // Check for video URL in analysis JSON
            const videoUrl = dbRec.analysis?.video_url;
            const mediaUrl = dbRec.audio_url || videoUrl;
            
            return {
              id: dbRec.id,
              blob: blob || new Blob(),
              url: url || '',
              duration: dbRec.duration || 0,
              timestamp: new Date(dbRec.recorded_at || dbRec.created_at),
              transcription: dbRec.transcript || undefined,
              isTranscribing: false,
              type: videoUrl ? 'video' : 'audio',
              sender: dbRec.is_outgoing ? 'me' : 'other',
              recipientId: dbRec.contact_id || '',
              contactId: dbRec.contact_id || '',
              quality: undefined,
              status: 'delivered' as const,
              starred: dbRec.starred || false,
              tags: dbRec.tags || [],
              analysis: dbRec.analysis ? (videoUrl ? { ...dbRec.analysis, video_url: undefined } : dbRec.analysis) : undefined,
              notes: dbRec.notes || [],
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

  // Save preview mode preference
  useEffect(() => {
    localStorage.setItem('voxer_preview_mode', JSON.stringify(previewModeEnabled));
  }, [previewModeEnabled]);

  // Stream Management
  useEffect(() => {
    let isCancelled = false;

    const startStream = async () => {
      // 1. Cleanup existing streams and contexts
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
         try { await audioContextRef.current.close(); } catch(e) { console.error(e); }
         audioContextRef.current = null;
      }

      try {
        // 2. Prepare constraints (Use 'ideal' instead of 'exact' to prevent timeouts/errors)
        const constraints: MediaStreamConstraints = {
          audio: selectedAudioInput ? { deviceId: selectedAudioInput } : true,
          video: mode === 'video' 
             ? (selectedVideoInput ? { deviceId: selectedVideoInput, width: { ideal: 1280 } } : true)
             : false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // 3. Check cancellation
        if (isCancelled) {
             stream.getTracks().forEach(t => t.stop());
             return;
        }

        streamRef.current = stream;

        // 4. Setup Audio Context & Analyser
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        
        // Only connect if audio tracks exist
        if (stream.getAudioTracks().length > 0) {
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
        }

        // 5. Setup Video Preview
        if (cameraPreviewRef.current && mode === 'video') {
           cameraPreviewRef.current.srcObject = stream;
        }
        setPermissionError(false);
      } catch (err) {
        if (!isCancelled) {
            console.error("Stream error", err);
            setPermissionError(true);
            toast.error('Microphone/camera access denied. Please enable permissions.', {
              duration: 4000,
            });
        }
      }
    };

    startStream();

    return () => {
      isCancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
         audioContextRef.current.close().catch(e => console.error(e));
      }
    };
  }, [mode, selectedAudioInput, selectedVideoInput]);

  const startRecording = async () => {
    if (!streamRef.current) {
      console.warn('No media stream available. Trying to reinitialize...');
      toast.error('Microphone not ready. Please check permissions.', { duration: 2000 });
      return;
    }
    if (isRecording) return;
    try {
      let recordingStream = streamRef.current;
      let mimeType = 'audio/webm';

      if (mode === 'video') {
         mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      } else {
         // If audio mode, try to capture visualizer stream for a video file, or just audio
         if (visualizerCanvasRef.current) {
            const canvasStream = visualizerCanvasRef.current.captureStream(30);
            recordingStream = new MediaStream([
                ...streamRef.current.getAudioTracks(),
                ...canvasStream.getVideoTracks()
            ]);
            mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
         } else {
             mimeType = 'audio/webm';
         }
      }

      const mediaRecorder = new MediaRecorder(recordingStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        let blob = new Blob(chunksRef.current, { type: mimeType });

        // ============================================
        // AUDIO ENHANCEMENT: Apply AI-powered audio processing
        // ============================================
        if (autoEnhanceEnabled && mode === 'audio' && blob.size > 100) {
          try {
            const enhancementResult = await audioEnhancementService.enhanceAudio(blob, {
              noiseReduction: true,
              normalize: true,
              enhanceClarity: true,
              removeBackground: false,
              enhanceVoice: true,
            });
            blob = enhancementResult.blob;

            toast.success(`Audio enhanced: ${enhancementResult.appliedEnhancements.join(', ')}`, {
              icon: '✨',
              duration: 2000,
            });
          } catch (error) {
            console.error('Audio enhancement failed:', error);
            // Continue with original blob if enhancement fails
            toast.error('Audio enhancement failed, using original', {
              icon: '⚠️',
              duration: 2000,
            });
          }
        }

        const url = URL.createObjectURL(blob);
        const duration = (Date.now() - startTimeRef.current) / 1000;
        
        // ============================================
        // PREVIEW MODE: Show preview panel instead of auto-sending
        // ============================================
        if (previewModeEnabled) {
          // Set pending recording for preview
          setPendingRecording({
            blob,
            url,
            duration,
            transcription: realtimeTranscript || '',
            isTranscribing: !realtimeTranscript && apiKey ? true : false,
          });
          setShowPreviewPanel(true);
          
          // Start background transcription if no real-time transcript
          if (!realtimeTranscript && apiKey && blob.size > 100) {
            try {
              const base64 = await blobToBase64(blob);
              const text = await transcribeMedia(apiKey, base64, mimeType);
              setPendingRecording(prev => prev ? {
                ...prev,
                transcription: text || "Transcription failed.",
                isTranscribing: false,
              } : null);
            } catch (e) {
              setPendingRecording(prev => prev ? {
                ...prev,
                transcription: "Error transcribing.",
                isTranscribing: false,
              } : null);
            }
          } else if (!realtimeTranscript) {
            setPendingRecording(prev => prev ? {
              ...prev,
              transcription: duration < 1 ? "Audio too short." : "",
              isTranscribing: false,
            } : null);
          }
          
          return; // Don't auto-send in preview mode
        }
        
        // ============================================
        // NORMAL MODE: Auto-send (existing behavior)
        // ============================================
        const id = Date.now().toString();
        
        const newRecording: Recording = {
          id,
          blob,
          url,
          duration,
          timestamp: new Date(),
          isTranscribing: true,
          type: mode,
          sender: 'me',
          recipientId: activeContactId,
          contactId: activeContactId,
          quality: mode === 'video' ? videoQuality : undefined,
          status: 'sent'
        };

        // Simulate delivery after 1 second
        setTimeout(() => {
          setRecordings(prev => prev.map(r =>
            r.id === id ? { ...r, status: 'delivered' } : r
          ));
        }, 1000);

        setRecordings(prev => [...prev, newRecording]);

        // Toast notification for sent vox
        const recipientName = contacts.find(c => c.id === activeContactId)?.name || 'contact';
        toast.success(`Vox sent to ${recipientName}`, {
          icon: '🎙️',
          duration: 2000,
        });

        // Save to database
        const saveRecording = async () => {
          try {
            // Upload blob to storage
            const mediaUrl = await dataService.uploadVoxerMedia(blob, id, mode);
            
            // Save recording metadata
            await dataService.saveVoxerRecording({
              id,
              audio_url: mode === 'audio' ? mediaUrl : undefined,
              video_url: mode === 'video' ? mediaUrl : undefined,
              duration: Math.round(duration),
              contact_id: activeContactId,
              contact_name: recipientName,
              is_outgoing: true,
              recorded_at: new Date().toISOString(),
            });
          } catch (error) {
            console.error('Error saving recording:', error);
          }
        };
        saveRecording();

        // Real replies will come through real-time subscriptions or API callbacks

        if (apiKey && blob.size > 100) { 
           try {
             const base64 = await blobToBase64(blob);
             const text = await transcribeMedia(apiKey, base64, mimeType);
             setRecordings(prev => prev.map(rec => 
               rec.id === id ? { ...rec, transcription: text || "Transcription failed.", isTranscribing: false } : rec
             ));
             
             // Update transcription in database
             if (text) {
               await dataService.updateVoxerRecording(id, { transcript: text });
               await saveArchiveItem({
                   type: 'vox_transcript',
                   title: `Voxer to ${contacts.find(c => c.id === activeContactId)?.name}`,
                   content: text,
                   tags: ['voxer', mode],
                   relatedContactId: activeContactId
               });
               toast.success('Transcription complete', {
                 icon: '📝',
                 duration: 2000,
               });

               // AI Analysis Integration - Analyze after transcription completes
               if (autoAnalyzeEnabled && text.length > 10) {
                 setRecordings(prev => prev.map(rec =>
                   rec.id === id ? { ...rec, isAnalyzing: true } : rec
                 ));

                 try {
                   const analysisService = getVoxerAnalysisService(apiKey);
                   const contactName = contacts.find(c => c.id === activeContactId)?.name;

                   const analysis = await analysisService.analyzeVox(text, {
                     senderName: 'You',
                     channelType: 'direct',
                   });

                   setRecordings(prev => prev.map(rec =>
                     rec.id === id ? { ...rec, analysis, isAnalyzing: false } : rec
                   ));

                   // Update analysis in database
                   await dataService.updateVoxerRecording(id, {
                     analysis: JSON.stringify(analysis)
                   });

                   toast.success('AI analysis complete', {
                     icon: '🤖',
                     duration: 2000,
                   });
                 } catch (error) {
                   console.error('AI analysis error:', error);
                   setRecordings(prev => prev.map(rec =>
                     rec.id === id ? { ...rec, isAnalyzing: false } : rec
                   ));
                   toast.error('AI analysis failed', {
                     icon: '⚠️',
                     duration: 2000,
                   });
                 }
               }
             }
           } catch (e) {
             setRecordings(prev => prev.map(rec => 
               rec.id === id ? { ...rec, transcription: "Error processing media.", isTranscribing: false } : rec
             ));
           }
        } else {
           setRecordings(prev => prev.map(rec => rec.id === id ? { ...rec, isTranscribing: false, transcription: "Audio too short." } : rec));
        }
      };

      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setIsRecording(true);
      
      // Start real-time transcription if enabled
      if (isRealtimeActive && streamRef.current) {
        startRealtimeTranscription(streamRef.current);
      }
    } catch (err) {
      console.error(err);
      setPermissionError(true);
    }
  };

  // Real-time transcription functions
  const startRealtimeTranscription = async (stream: MediaStream) => {
    try {
      realtimeServiceRef.current = new RealtimeTranscriptionService();
      setRealtimeTranscript('');
      
      await realtimeServiceRef.current.start(
        stream,
        {
          onTranscript: (segment: RealtimeTranscriptSegment) => {
            if (segment.isFinal) {
              setRealtimeTranscript(prev => prev + segment.text + ' ');
            } else {
              // Show interim results
              setRealtimeTranscript(prev => {
                const lastFinalIndex = prev.lastIndexOf('. ');
                const finalPart = lastFinalIndex >= 0 ? prev.slice(0, lastFinalIndex + 2) : prev;
                return finalPart + segment.text;
              });
            }
          },
          onError: (error) => {
            console.error('Realtime transcription error:', error);
            toast.error('Transcription error', { icon: '⚠️', duration: 2000 });
          },
          onStateChange: setTranscriptionState,
        },
        { language: 'en-US' }
      );
    } catch (error) {
      console.error('Failed to start real-time transcription:', error);
    }
  };

  const stopRealtimeTranscription = (): string => {
    if (realtimeServiceRef.current) {
      const fullTranscript = realtimeServiceRef.current.stop();
      realtimeServiceRef.current = null;
      return fullTranscript;
    }
    return realtimeTranscript;
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop real-time transcription
      if (isRealtimeActive) {
        stopRealtimeTranscription();
      }
    }
  };

  const handleRecordToggle = () => isRecording ? stopRecording() : startRecording();

  // --- Playback Handlers ---
  const handlePlay = (rec: Recording) => {
    const mediaElements = document.querySelectorAll('audio, video');
    mediaElements.forEach((el: any) => {
      if (el.dataset.recId !== rec.id) {
        el.pause();
      }
    });

    setPlayingId(rec.id);

    // Mark as read if it's from other and not already read
    if (rec.sender === 'other' && rec.status !== 'read') {
      setRecordings(prev => prev.map(r =>
        r.id === rec.id ? { ...r, status: 'read', playedAt: new Date() } : r
      ));
    }
  };

  const handlePause = () => {
    setPlayingId(null);
  };

  const cyclePlaybackSpeed = () => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIndex]);

    // Apply to all media elements
    document.querySelectorAll('audio, video').forEach((el: any) => {
      el.playbackRate = speeds[nextIndex];
    });
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'read': return 'fa-check-double text-blue-500';
      case 'delivered': return 'fa-check-double text-zinc-400';
      case 'sent': return 'fa-check text-zinc-400';
      default: return 'fa-check text-zinc-300';
    }
  };

  // ============================================
  // PREVIEW MODE HANDLERS
  // ============================================

  // Get AI feedback on pending recording
  const getAIFeedback = useCallback(async () => {
    if (!pendingRecording || !pendingRecording.transcription || !apiKey) return;

    setIsFeedbackLoading(true);

    try {
      const feedbackService = getVoxerFeedbackService(apiKey);
      const contactName = contacts.find(c => c.id === activeContactId)?.name;

      const feedback = await feedbackService.analyzeFeedback(
        pendingRecording.transcription,
        {
          recipientName: contactName,
          relationship: 'professional', // Could be determined from contact type
          purpose: 'general',
        }
      );

      setCurrentFeedback(feedback);
      setShowFeedbackModal(true);
    } catch (error) {
      console.error('AI feedback error:', error);
      toast.error('Failed to get AI feedback', {
        icon: '⚠️',
        duration: 2000,
      });
    } finally {
      setIsFeedbackLoading(false);
    }
  }, [pendingRecording, apiKey, contacts, activeContactId]);

  const handleSendPendingRecording = useCallback(async () => {
    if (!pendingRecording) return;

    // Check if AI feedback is enabled and should be shown
    if (autoFeedbackEnabled && pendingRecording.transcription && pendingRecording.transcription.length > 10) {
      await getAIFeedback();
      return; // Wait for user to review feedback
    }

    // Proceed with sending (either feedback disabled or user clicked "Send Anyway")
    await sendRecordingNow();
  }, [pendingRecording, autoFeedbackEnabled]);

  // Actually send the recording (called after feedback review or if feedback disabled)
  const sendRecordingNow = useCallback(async () => {
    if (!pendingRecording) return;
    
    const { blob, url, duration, transcription } = pendingRecording;
    const id = Date.now().toString();
    
    const newRecording: Recording = {
      id,
      blob,
      url,
      duration,
      timestamp: new Date(),
      isTranscribing: false,
      transcription: transcription || '',
      type: mode,
      sender: 'me',
      recipientId: activeContactId,
      contactId: activeContactId,
      quality: mode === 'video' ? videoQuality : undefined,
      status: 'sent'
    };

    // Simulate delivery after 1 second
    setTimeout(() => {
      setRecordings(prev => prev.map(r =>
        r.id === id ? { ...r, status: 'delivered' } : r
      ));
    }, 1000);

    setRecordings(prev => [...prev, newRecording]);

    // Toast notification for sent vox
    const recipientName = contacts.find(c => c.id === activeContactId)?.name || 'contact';
    toast.success(`Vox sent to ${recipientName}`, {
      icon: '🎙️',
      duration: 2000,
    });

    // Save to database
    try {
      // Upload blob to storage
      const mediaUrl = await dataService.uploadVoxerMedia(pendingRecording.blob, id, mode);
      
      // Save recording metadata
      await dataService.saveVoxerRecording({
        id,
        audio_url: mode === 'audio' ? mediaUrl : undefined,
        video_url: mode === 'video' ? mediaUrl : undefined,
        duration: Math.round(pendingRecording.duration),
        transcript: transcription,
        contact_id: activeContactId,
        contact_name: recipientName,
        is_outgoing: true,
        recorded_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error saving recording:', error);
    }

    // Save to archive if transcription exists
    if (transcription) {
      await saveArchiveItem({
        type: 'vox_transcript',
        title: `Voxer to ${contacts.find(c => c.id === activeContactId)?.name}`,
        content: transcription,
        tags: ['voxer', mode],
        relatedContactId: activeContactId
      });
    }

    // Real replies will come through real-time subscriptions or API callbacks

    // Clean up
    setShowPreviewPanel(false);
    setShowFeedbackModal(false);
    setCurrentFeedback(null);
    setPendingRecording(null);
    setRealtimeTranscript('');
  }, [pendingRecording, mode, activeContactId, videoQuality, contacts]);

  const handleReRecord = useCallback(() => {
    // Clean up the pending recording
    if (pendingRecording?.url) {
      URL.revokeObjectURL(pendingRecording.url);
    }
    setPendingRecording(null);
    setShowPreviewPanel(false);
    setShowFeedbackModal(false);
    setCurrentFeedback(null);
    setRealtimeTranscript('');
    toast('Ready to re-record', { icon: '🔄', duration: 1500 });
  }, [pendingRecording]);

  // Feedback Modal Handlers
  const handleFeedbackSendAnyway = useCallback(async () => {
    setShowFeedbackModal(false);
    await sendRecordingNow();
  }, []);

  const handleFeedbackClose = useCallback(() => {
    setShowFeedbackModal(false);
    setCurrentFeedback(null);
    // Keep the pending recording so user can review and decide
  }, []);

  const handleClosePreview = useCallback(() => {
    // Keep the recording but close the panel
    setShowPreviewPanel(false);
  }, []);

  const handlePreviewOpenFullCoach = useCallback(() => {
    if (pendingRecording) {
      setPendingVoxBlob(pendingRecording.blob);
      setPendingVoxTranscript(pendingRecording.transcription);
      setPendingVoxDuration(pendingRecording.duration);
      setShowVoiceCoach(true);
      setShowPreviewPanel(false);
    }
  }, [pendingRecording]);

  // ============================================
  // ADVANCED FEATURE HANDLERS
  // ============================================

  // 1. Vox Reactions Handlers
  const handleAddReaction = useCallback((voxId: string, reaction: Omit<VoxReaction, 'id' | 'timestamp'>) => {
    const newReaction: VoxReaction = {
      ...reaction,
      id: `reaction-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    };
    setReactions(prev => ({
      ...prev,
      [voxId]: [...(prev[voxId] || []), newReaction],
    }));
    toast.success('Reaction added!', { duration: 1000, icon: reaction.emoji });
  }, []);

  const handleRemoveReaction = useCallback((voxId: string, reactionId: string) => {
    setReactions(prev => ({
      ...prev,
      [voxId]: (prev[voxId] || []).filter(r => r.id !== reactionId),
    }));
  }, []);

  // 2. AI Voice Coach Handler
  const handleVoiceCoachAnalysis = useCallback((blob: Blob, transcript: string, duration: number) => {
    setPendingVoxBlob(blob);
    setPendingVoxTranscript(transcript);
    setPendingVoxDuration(duration);
    setShowVoiceCoach(true);
  }, []);

  const handleSendAfterCoach = useCallback(() => {
    // Send the pending vox
    if (pendingVoxBlob) {
      // Add recording logic here
      toast.success('Vox sent!');
    }
    setShowVoiceCoach(false);
    setPendingVoxBlob(null);
    setPendingVoxTranscript('');
    setPendingVoxDuration(0);
  }, [pendingVoxBlob]);

  // 3. Priority Vox Handlers
  const handlePrioritySelect = useCallback((priority: PriorityLevel, options: any) => {
    setSelectedPriority(priority);
    setShowPrioritySelector(false);
    if (priority !== 'normal') {
      toast(`Priority set to ${priority}`, { icon: priority === 'emergency' ? '🚨' : '⚡' });
    }
  }, []);

  const handleAcknowledgeEmergency = useCallback(() => {
    if (emergencyVox) {
      toast.success('Emergency acknowledged');
      setEmergencyVox(null);
    }
  }, [emergencyVox]);

  // 4. Vox Threads Handlers
  const handleCreateThread = useCallback((voxId: string, timestamp?: number) => {
    const newThread: VoxThread = {
      id: `thread-${Date.now()}`,
      parentVoxId: voxId,
      parentTimestamp: timestamp,
      replies: [],
      createdAt: new Date(),
      lastActivityAt: new Date(),
      participantIds: [],
    };
    setThreads(prev => ({ ...prev, [voxId]: newThread }));
    setActiveThreadVoxId(voxId);
  }, []);

  const handleAddThreadReply = useCallback((threadId: string, audioBlob: Blob, parentReplyId?: string) => {
    const voxId = Object.keys(threads).find(k => threads[k].id === threadId);
    if (voxId) {
      const newReply: VoxThreadReply = {
        id: `reply-${Date.now()}`,
        threadId,
        parentReplyId,
        voxId: `vox-${Date.now()}`,
        userId: 'current-user',
        userName: 'Me',
        userAvatarColor: 'bg-orange-500',
        audioUrl: URL.createObjectURL(audioBlob),
        duration: 5, // Would be calculated
        timestamp: new Date(),
        reactions: [],
        depth: parentReplyId ? 1 : 0,
      };
      setThreads(prev => ({
        ...prev,
        [voxId]: {
          ...prev[voxId],
          replies: [...prev[voxId].replies, newReply],
          lastActivityAt: new Date(),
        },
      }));
      toast.success('Reply added to thread');
    }
  }, [threads]);

  // 5. Time Capsule Handlers
  const handleScheduleCapsule = useCallback((capsule: Omit<TimeCapsuleType, 'id' | 'status' | 'createdAt'>) => {
    const newCapsule: TimeCapsuleType = {
      ...capsule,
      id: `capsule-${Date.now()}`,
      status: 'scheduled',
      createdAt: new Date(),
    };
    setScheduledCapsules(prev => [...prev, newCapsule]);
    setShowTimeCapsule(false);
    toast.success(`Time capsule scheduled for ${new Date(capsule.scheduledFor).toLocaleDateString()}`, { icon: '⏰' });
  }, []);

  const handleCancelCapsule = useCallback((capsuleId: string) => {
    setScheduledCapsules(prev => 
      prev.map(c => c.id === capsuleId ? { ...c, status: 'cancelled' as const } : c)
    );
    toast('Time capsule cancelled', { icon: '🗑️' });
  }, []);

  // 6. Voice Bookmarks Handlers
  const handleAddBookmark = useCallback((voxId: string, bookmark: Omit<VoiceBookmark, 'id' | 'createdAt'>) => {
    const newBookmark: VoiceBookmark = {
      ...bookmark,
      id: `bookmark-${Date.now()}`,
      createdAt: new Date(),
    };
    setBookmarks(prev => ({
      ...prev,
      [voxId]: [...(prev[voxId] || []), newBookmark],
    }));
    toast.success(`Bookmark added at ${Math.floor(bookmark.timestamp / 60)}:${(bookmark.timestamp % 60).toString().padStart(2, '0')}`);
  }, []);

  const handleRemoveBookmark = useCallback((voxId: string, bookmarkId: string) => {
    setBookmarks(prev => ({
      ...prev,
      [voxId]: (prev[voxId] || []).filter(b => b.id !== bookmarkId),
    }));
  }, []);

  const handleUpdateBookmark = useCallback((voxId: string, bookmarkId: string, updates: Partial<VoiceBookmark>) => {
    setBookmarks(prev => ({
      ...prev,
      [voxId]: (prev[voxId] || []).map(b => b.id === bookmarkId ? { ...b, ...updates } : b),
    }));
  }, []);

  // 7. Silent Mode Handlers
  const handleToggleSilentMode = useCallback(() => {
    setSilentModeEnabled(prev => {
      const newState = !prev;
      toast(newState ? 'Silent mode enabled' : 'Silent mode disabled', { 
        icon: newState ? '🔇' : '🔊' 
      });
      return newState;
    });
  }, []);

  const handleSilentModeReply = useCallback((messageId: string, text: string) => {
    setSilentModeMessages(prev => 
      prev.map(m => m.id === messageId ? { ...m, replied: true, replyText: text } : m)
    );
    toast.success('Reply sent as voice message');
  }, []);

  const handleMarkSilentMessageRead = useCallback((messageId: string) => {
    setSilentModeMessages(prev => 
      prev.map(m => m.id === messageId ? { ...m, isRead: true } : m)
    );
  }, []);

  // 8. Vox Playlists Handlers
  const handleCreatePlaylist = useCallback((playlist: Omit<VoxPlaylist, 'id' | 'createdAt' | 'updatedAt' | 'totalDuration'>) => {
    const newPlaylist: VoxPlaylist = {
      ...playlist,
      id: `playlist-${Date.now()}`,
      totalDuration: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setPlaylists(prev => [...prev, newPlaylist]);
    toast.success(`Playlist "${playlist.name}" created!`);
  }, []);

  const handleUpdatePlaylist = useCallback((id: string, updates: Partial<VoxPlaylist>) => {
    setPlaylists(prev => 
      prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p)
    );
  }, []);

  const handleDeletePlaylist = useCallback((id: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
    toast('Playlist deleted', { icon: '🗑️' });
  }, []);

  const handleAddToPlaylist = useCallback((playlistId: string, voxId: string) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        const newItem = {
          id: `item-${Date.now()}`,
          playlistId,
          voxId,
          addedAt: new Date(),
          addedBy: 'current-user',
          order: p.items.length,
        };
        return { ...p, items: [...p.items, newItem], updatedAt: new Date() };
      }
      return p;
    }));
    setShowAddToPlaylist(false);
    setAddToPlaylistVoxId(null);
    toast.success('Added to playlist');
  }, []);

  const handlePlayPlaylist = useCallback((playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist && playlist.items.length > 0) {
      toast.success(`Playing "${playlist.name}"`);
      // Would implement sequential playback
    }
  }, [playlists]);

  // 9. Collaborative Vox Handlers
  const handleCreateCollab = useCallback((collab: Omit<CollabVoxType, 'id' | 'createdAt'>) => {
    const newCollab: CollabVoxType = {
      ...collab,
      id: `collab-${Date.now()}`,
      createdAt: new Date(),
    };
    setActiveCollabs(prev => [...prev, newCollab]);
    toast.success('Collaborative vox started!');
  }, []);

  const handleSendCollab = useCallback((collabId: string, recipientIds: string[]) => {
    setActiveCollabs(prev => prev.filter(c => c.id !== collabId));
    setShowCollabVox(false);
    toast.success('Collaborative vox sent!');
  }, []);

  // 10. Voice Commands Handlers
  const handleToggleVoiceCommands = useCallback(() => {
    setVoiceCommandsEnabled(prev => {
      const newState = !prev;
      toast(newState ? 'Voice commands enabled' : 'Voice commands disabled', { 
        icon: newState ? '🎤' : '🔇' 
      });
      return newState;
    });
  }, []);

  const handleVoiceCommandExecute = useCallback((command: any, params: Record<string, any>) => {
    console.log('Executing voice command:', command.action, params);
    
    switch (command.action) {
      case 'NAVIGATE_VOXER':
        // Already in Voxer
        toast('You\'re already in Voxer!', { icon: '🎤' });
        break;
      case 'PLAY_UNREAD':
        const unread = recordings.filter(r => r.sender === 'other' && r.status !== 'read');
        if (unread.length > 0) {
          handlePlay(unread[0]);
          toast(`Playing ${unread.length} unread messages`);
        } else {
          toast('No unread messages', { icon: 'ℹ️' });
        }
        break;
      case 'PAUSE_PLAYBACK':
        handlePause();
        toast('Playback paused');
        break;
      case 'START_RECORDING':
        startRecording();
        break;
      case 'STOP_RECORDING':
        stopRecording();
        break;
      case 'TOGGLE_SILENT_MODE':
        handleToggleSilentMode();
        break;
      default:
        toast(`Command: ${command.description}`, { icon: '🎯' });
    }
    
    setIsVoiceListening(false);
  }, [recordings, handlePause, handleToggleSilentMode]);

  // --- Filtering Logic ---
  // Only show contacts that have at least one vox recording (threads)
  const filteredContacts = useMemo(() => {
      const contactsWithVoxes = contacts.filter(c => {
          const hasRecordings = recordings.some(r => r.contactId === c.id);
          return hasRecordings;
      });
      
      // Then apply search filter
      return contactsWithVoxes.filter(c => 
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          c.role.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [contacts, searchQuery, recordings]);

  const activeThreadRecordings = useMemo(() => {
      return recordings.filter(r => r.contactId === activeContactId);
  }, [recordings, activeContactId]);

  const activeContact = contacts.find(c => c.id === activeContactId);
  const activeGroup = groups.find(g => g.id === activeGroupId);

  // Create new group
  const handleCreateGroup = () => {
    if (selectedGroupMembers.length < 2) {
      toast.error('Select at least 2 members for a group');
      return;
    }
    if (!groupName.trim()) {
      toast.error('Enter a group name');
      return;
    }

    const colors = ['bg-purple-600', 'bg-blue-600', 'bg-emerald-600', 'bg-orange-600', 'bg-pink-600'];
    const newGroup: VoxGroup = {
      id: `group-${Date.now()}`,
      name: groupName,
      members: selectedGroupMembers,
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
      createdAt: new Date(),
    };

    setGroups(prev => [...prev, newGroup]);
    setActiveGroupId(newGroup.id);
    setActiveContactId('');
    setMobileView('thread');
    setShowNewVoxModal(false);
    setGroupName('');
    setSelectedGroupMembers([]);
    toast.success(`Group "${groupName}" created!`, { icon: '👥' });
  };

  // Start new individual vox
  const handleStartIndividualVox = (contact: Contact) => {
    setActiveContactId(contact.id);
    setActiveGroupId(null);
    setMobileView('thread');
    setShowNewVoxModal(false);
  };

  // Delete contact/thread (removes all recordings for that contact)
  const handleDeleteThread = useCallback(async (contactId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the contact
    
    if (window.confirm('Delete this thread? All voxes with this contact will be removed.')) {
      // Get recordings to delete
      const recordingsToDelete = recordings.filter(r => r.contactId === contactId);
      
      // Delete from database
      for (const rec of recordingsToDelete) {
        await dataService.deleteVoxerRecording(rec.id);
      }
      
      // Remove all recordings for this contact
      setRecordings(prev => prev.filter(r => r.contactId !== contactId));
      
      // If this was the active contact, clear it
      if (activeContactId === contactId) {
        setActiveContactId('');
      }
      
      toast.success('Thread deleted', { icon: '🗑️' });
    }
  }, [activeContactId, recordings]);

  // Toggle group member selection
  const toggleGroupMember = (contact: Contact) => {
    setSelectedGroupMembers(prev =>
      prev.find(c => c.id === contact.id)
        ? prev.filter(c => c.id !== contact.id)
        : [...prev, contact]
    );
  };

  // Filter contacts for new vox modal
  const filteredNewVoxContacts = useMemo(() => {
    if (!newVoxSearchQuery.trim()) return contacts;
    
    const query = newVoxSearchQuery.toLowerCase();
    return contacts.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.role.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query)
    );
  }, [contacts, newVoxSearchQuery]);

  const getVideoDimensions = () => {
    switch (videoQuality) {
        case '480p': return { width: 854, height: 480 };
        case '1080p': return { width: 1920, height: 1080 };
        case '720p': default: return { width: 1280, height: 720 };
    }
  };
  const { width: cvWidth, height: cvHeight } = getVideoDimensions();

  // ============================================
  // VOICE INTELLIGENCE FUNCTIONS
  // ============================================

  // Analyze voice message for sentiment, urgency, and action items
  const analyzeVoiceMessage = useCallback(async (recordingId: string, transcription: string) => {
    if (!apiKey || !transcription || transcription.length < 10) return;

    setRecordings(prev => prev.map(r =>
      r.id === recordingId ? { ...r, isAnalyzing: true } : r
    ));

    try {
      const analysisService = getVoxerAnalysisService(apiKey);
      const recording = recordings.find(r => r.id === recordingId);
      const contactName = contacts.find(c => c.id === recording?.contactId)?.name;

      const analysis = await analysisService.analyzeVox(transcription, {
        senderName: recording?.sender === 'me' ? 'You' : contactName,
        channelType: 'direct',
      });

      setRecordings(prev => prev.map(r =>
        r.id === recordingId ? { ...r, analysis, isAnalyzing: false } : r
      ));

      // Save analysis to database
      await dataService.updateVoxerRecording(recordingId, {
        analysis: JSON.stringify(analysis)
      });

      toast.success('AI analysis complete', {
        icon: '🤖',
        duration: 2000,
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      setRecordings(prev => prev.map(r =>
        r.id === recordingId ? { ...r, isAnalyzing: false } : r
      ));
      toast.error('Analysis failed', {
        icon: '⚠️',
        duration: 2000,
      });
    }
  }, [apiKey, recordings, contacts]);

  // Toggle star on recording
  const toggleStar = useCallback(async (recordingId: string) => {
    const recording = recordings.find(r => r.id === recordingId);
    if (!recording) return;
    
    const newStarred = !recording.starred;
    setRecordings(prev => prev.map(r =>
      r.id === recordingId ? { ...r, starred: newStarred } : r
    ));
    
    // Update in database
    await dataService.updateVoxerRecording(recordingId, { starred: newStarred });
  }, [recordings]);

  // Add tag to recording
  const addTag = useCallback(async (recordingId: string, tag: string) => {
    const recording = recordings.find(r => r.id === recordingId);
    if (!recording) return;
    
    const newTags = [...(recording.tags || []), tag].filter((t, i, a) => a.indexOf(t) === i);
    setRecordings(prev => prev.map(r =>
      r.id === recordingId ? { ...r, tags: newTags } : r
    ));
    
    // Update in database
    await dataService.updateVoxerRecording(recordingId, { tags: newTags });
    
    setShowTagModal(false);
    setSelectedTagRecordingId(null);
    toast.success(`Tag "${tag}" added`);
  }, [recordings]);

  // Remove tag from recording
  const removeTag = useCallback(async (recordingId: string, tag: string) => {
    const recording = recordings.find(r => r.id === recordingId);
    if (!recording) return;
    
    const newTags = (recording.tags || []).filter(t => t !== tag);
    setRecordings(prev => prev.map(r =>
      r.id === recordingId ? { ...r, tags: newTags } : r
    ));
    
    // Update in database
    await dataService.updateVoxerRecording(recordingId, { tags: newTags });
    
    toast.success(`Tag "${tag}" removed`);
  }, [recordings]);

  // Add note to recording
  const addNote = useCallback(async (recordingId: string, content: string) => {
    if (!content.trim()) return;
    
    const recording = recordings.find(r => r.id === recordingId);
    if (!recording) return;
    
    const newNote: VoiceNote = {
      id: Date.now().toString(),
      recordingId,
      content: content.trim(),
      timestamp: new Date(),
    };
    const newNotes = [...(recording.notes || []), newNote];
    
    setRecordings(prev => prev.map(r =>
      r.id === recordingId ? { ...r, notes: newNotes } : r
    ));
    
    // Update notes in database (stored in notes JSONB column)
    await dataService.updateVoxerRecording(recordingId, { 
      notes: newNotes 
    } as any);
    
    setShowAddNoteModal(false);
    setNewNoteText('');
    toast.success('Note added');
  }, [recordings]);

  // Delete note
  const deleteNote = useCallback(async (recordingId: string, noteId: string) => {
    const recording = recordings.find(r => r.id === recordingId);
    if (!recording) return;
    
    const newNotes = (recording.notes || []).filter(n => n.id !== noteId);
    
    setRecordings(prev => prev.map(r =>
      r.id === recordingId ? { ...r, notes: newNotes } : r
    ));
    
    // Update notes in database
    await dataService.updateVoxerRecording(recordingId, { 
      notes: newNotes 
    } as any);
  }, [recordings]);

  // Get sentiment color
  const getSentimentColor = useCallback((sentiment?: SentimentType) => {
    switch (sentiment) {
      case 'positive': return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20';
      case 'negative': return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      case 'mixed': return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
      default: return 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800';
    }
  }, []);

  // Get urgency color
  const getUrgencyColor = useCallback((urgency?: UrgencyLevel) => {
    switch (urgency) {
      case 'urgent': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      default: return 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800';
    }
  }, []);

  // Statistics computation
  const stats = useMemo(() => {
    const threadRecs = recordings.filter(r => r.contactId === activeContactId);
    const totalDuration = threadRecs.reduce((sum, r) => sum + r.duration, 0);
    const sentCount = threadRecs.filter(r => r.sender === 'me').length;
    const receivedCount = threadRecs.filter(r => r.sender === 'other').length;
    const avgDuration = threadRecs.length > 0 ? totalDuration / threadRecs.length : 0;
    const starredCount = threadRecs.filter(r => r.starred).length;
    const withActionsCount = threadRecs.filter(r => r.analysis?.actionItems?.length).length;

    return {
      total: threadRecs.length,
      totalDuration,
      sentCount,
      receivedCount,
      avgDuration,
      starredCount,
      withActionsCount,
    };
  }, [recordings, activeContactId]);

  // Filtered and sorted recordings
  const filteredThreadRecordings = useMemo(() => {
    let recs = recordings.filter(r => r.contactId === activeContactId);

    // Apply filter
    switch (filterBy) {
      case 'starred':
        recs = recs.filter(r => r.starred);
        break;
      case 'actionItems':
        recs = recs.filter(r => r.analysis?.actionItems?.length);
        break;
      case 'unplayed':
        recs = recs.filter(r => r.sender === 'other' && r.status !== 'read');
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      recs = recs.filter(r =>
        r.transcription?.toLowerCase().includes(query) ||
        r.tags?.some(t => t.toLowerCase().includes(query))
      );
    }

    // Apply sort
    switch (sortBy) {
      case 'duration':
        recs.sort((a, b) => b.duration - a.duration);
        break;
      case 'sentiment':
        const sentimentOrder = { positive: 0, neutral: 1, mixed: 2, negative: 3 };
        recs.sort((a, b) =>
          (sentimentOrder[a.analysis?.sentiment || 'neutral'] || 1) -
          (sentimentOrder[b.analysis?.sentiment || 'neutral'] || 1)
        );
        break;
      case 'urgency':
        const urgencyOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        recs.sort((a, b) =>
          (urgencyOrder[a.analysis?.urgency || 'low'] || 3) -
          (urgencyOrder[b.analysis?.urgency || 'low'] || 3)
        );
        break;
      default:
        recs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    return recs;
  }, [recordings, activeContactId, filterBy, searchQuery, sortBy]);

  // Handle mode selection callback
  const handleBackToSelector = () => {
    setCurrentVoxMode(null);
    setShowVoxModeSelector(true);
  };

  const handleSelectMode = (mode: VoxMode | null) => {
    setCurrentVoxMode(mode);
    setShowVoxModeSelector(false);
  };

  // If a Vox Mode is selected, render that mode's full interface instead of the default Voxer
  if (currentVoxMode) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fade-in shadow-xl">
        {currentVoxMode === 'pulse_radio' && (
          <PulseRadio onBack={handleBackToSelector} apiKey={apiKey} isDarkMode={isDarkMode} />
        )}
        {currentVoxMode === 'voice_threads' && (
          <VoiceThreadsMode onBack={handleBackToSelector} contacts={contacts} apiKey={apiKey} isDarkMode={isDarkMode} />
        )}
        {currentVoxMode === 'team_vox' && (
          <TeamVoxMode onBack={handleBackToSelector} contacts={contacts} apiKey={apiKey} isDarkMode={isDarkMode} />
        )}
        {currentVoxMode === 'vox_notes' && (
          <VoxNotesMode onBack={handleBackToSelector} apiKey={apiKey} isDarkMode={isDarkMode} />
        )}
        {currentVoxMode === 'quick_vox' && (
          <QuickVoxMode onBack={handleBackToSelector} contacts={contacts} apiKey={apiKey} isDarkMode={isDarkMode} />
        )}
        {currentVoxMode === 'vox_drop' && (
          <VoxDropMode onBack={handleBackToSelector} contacts={contacts} apiKey={apiKey} isDarkMode={isDarkMode} />
        )}
        {currentVoxMode === 'video_vox' && (
          <VideoVoxMode onClose={handleBackToSelector} isDarkMode={isDarkMode} />
        )}

        {/* Vox Mode Selector Modal (can be opened from within modes) */}
        <VoxModeSelector
          isOpen={showVoxModeSelector}
          onClose={() => setShowVoxModeSelector(false)}
          onSelectMode={handleSelectMode}
          currentMode={currentVoxMode}
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  // Show mode selector as landing page when no mode is selected
  if (showVoxModeSelector && !currentVoxMode) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fade-in shadow-xl">
        <VoxModeSelector
          isOpen={true}
          onClose={() => {
            // If user closes without selecting, default to classic mode
            setShowVoxModeSelector(false);
          }}
          onSelectMode={handleSelectMode}
          currentMode={null}
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  // Classic Voxer Mode - When no vox mode is selected, show the new ClassicVoxerMode
  // This replaces the old broken page with the avant-garde redesigned Classic Voxer
  if (!currentVoxMode) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fade-in shadow-xl">
        <ClassicVoxerMode
          onBack={handleBackToSelector}
          apiKey={apiKey}
          isDarkMode={isDarkMode}
        />

        {/* Vox Mode Selector Modal (can be opened from within Classic mode) */}
        <VoxModeSelector
          isOpen={showVoxModeSelector}
          onClose={() => setShowVoxModeSelector(false)}
          onSelectMode={handleSelectMode}
          currentMode={null}
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  // Legacy fallback - this should not be reached but kept for safety
  return (
    <>
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
      <div className="h-full flex bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fade-in shadow-xl">

      {/* LEFT SIDEBAR: Threads */}
      <div className={`w-full md:w-80 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 ${mobileView === 'list' ? 'flex' : 'hidden md:flex'} relative`}>

         <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 relative z-10 flex-shrink-0">
             <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-bold dark:text-white text-zinc-900 flex items-center gap-2">
                    <i className="fa-solid fa-walkie-talkie text-orange-500"></i> Voxer
                 </h2>
                 <div className="flex items-center gap-2">
                   {/* Vox Mode Selector Button */}
                   <button
                      onClick={() => setShowVoxModeSelector(true)}
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 flex items-center justify-center transition shadow-lg hover:shadow-orange-500/25"
                      title="Choose Vox Mode"
                   >
                      <i className="fa-solid fa-layer-group text-xs text-white"></i>
                   </button>
                   <button
                      onClick={() => setShowNewVoxModal(!showNewVoxModal)}
                      className={`w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition ${showNewVoxModal ? 'bg-orange-500 text-white' : ''}`}
                   >
                      <i className={`fa-solid fa-plus text-xs transition-transform duration-200 ${showNewVoxModal ? 'rotate-45' : ''}`}></i>
                   </button>
                 </div>
             </div>
             
             {!showNewVoxModal && (
               <div className="relative">
                   <input 
                      type="text" 
                      placeholder="Search contacts..."
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 transition dark:text-white"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                   />
                   <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-zinc-400 text-xs"></i>
               </div>
             )}

          {/* New Vox Dropdown - Inside Sidebar */}
          {showNewVoxModal && (
            <div 
              className="absolute top-full left-0 right-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-lg z-20 overflow-hidden max-h-[calc(100vh-200px)] flex flex-col"
              style={{
                animation: 'slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transformOrigin: 'top',
              }}
            >
              {/* Search Bar */}
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={newVoxSearchQuery}
                    onChange={(e) => setNewVoxSearchQuery(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 transition dark:text-white"
                    autoFocus
                  />
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-zinc-400 text-xs"></i>
                </div>
              </div>

              {/* Type Toggle */}
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewVoxType('individual')}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                      newVoxType === 'individual'
                        ? 'bg-orange-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <i className="fa-solid fa-user mr-2"></i>
                    Individual
                  </button>
                  <button
                    onClick={() => setNewVoxType('group')}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                      newVoxType === 'group'
                        ? 'bg-orange-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <i className="fa-solid fa-users mr-2"></i>
                    Group
                  </button>
                </div>
              </div>

              {/* Group Name Input */}
              {newVoxType === 'group' && (
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                  <input
                    type="text"
                    placeholder="Group name..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-orange-500 transition"
                  />
                </div>
              )}

              {/* Selected Members (for group) */}
              {newVoxType === 'group' && selectedGroupMembers.length > 0 && (
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Selected ({selectedGroupMembers.length})</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedGroupMembers.map(contact => (
                      <span
                        key={contact.id}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs"
                      >
                        <span className={`w-5 h-5 rounded-full ${contact.avatarColor} flex items-center justify-center text-white text-[10px] font-bold`}>
                          {contact.name.charAt(0)}
                        </span>
                        {contact.name.split(' ')[0]}
                        <button onClick={() => toggleGroupMember(contact)} className="hover:text-red-500">
                          <i className="fa-solid fa-times text-[10px]"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Contacts List */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {filteredNewVoxContacts.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400">
                    <i className="fa-solid fa-user-slash text-2xl mb-2"></i>
                    <p className="text-sm">No contacts found</p>
                  </div>
                ) : (
                  filteredNewVoxContacts.map(contact => (
                  <div
                    key={contact.id}
                    onClick={() => {
                      if (newVoxType === 'individual') {
                        handleStartIndividualVox(contact);
                      } else {
                        toggleGroupMember(contact);
                      }
                    }}
                    className={`p-3 flex items-center gap-3 cursor-pointer transition hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                      newVoxType === 'group' && selectedGroupMembers.find(c => c.id === contact.id)
                        ? 'bg-orange-50 dark:bg-orange-900/20'
                        : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full ${contact.avatarColor} flex items-center justify-center text-white font-bold relative`}>
                      {contact.name.charAt(0)}
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-900 ${contact.status === 'online' ? 'bg-emerald-500' : 'bg-zinc-400'}`}></div>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium dark:text-white">{contact.name}</div>
                      <div className="text-xs text-zinc-500">{contact.role}</div>
                    </div>
                    {newVoxType === 'group' && (
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                        selectedGroupMembers.find(c => c.id === contact.id)
                          ? 'border-orange-500 bg-orange-500 text-white'
                          : 'border-zinc-300 dark:border-zinc-700'
                      }`}>
                        {selectedGroupMembers.find(c => c.id === contact.id) && (
                          <i className="fa-solid fa-check text-xs"></i>
                        )}
                      </div>
                    )}
                    {newVoxType === 'individual' && (
                      <i className="fa-solid fa-chevron-right text-zinc-400 text-xs"></i>
                    )}
                  </div>
                )))}
              </div>

              {/* Create Group Button */}
              {newVoxType === 'group' && (
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <button
                    onClick={handleCreateGroup}
                    disabled={selectedGroupMembers.length < 2 || !groupName.trim()}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition disabled:cursor-not-allowed"
                  >
                    <i className="fa-solid fa-users mr-2"></i>
                    Create Group ({selectedGroupMembers.length} members)
                  </button>
                </div>
              )}
            </div>
          )}
         </div>

          <div className={`flex-1 overflow-y-auto p-2 space-y-1 ${showNewVoxModal ? 'opacity-30 pointer-events-none' : ''}`}>
             {/* Groups Section */}
             {groups.length > 0 && (
               <>
                 <div className="px-2 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Groups</div>
                 {groups.map(group => {
                   const lastVox = recordings.filter(r => r.contactId === group.id).pop();
                   return (
                     <div
                       key={group.id}
                       onClick={() => { setActiveGroupId(group.id); setActiveContactId(''); setMobileView('thread'); }}
                       className={`p-3 rounded-xl cursor-pointer transition flex items-center gap-3 group ${activeGroupId === group.id ? 'bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800/50 border border-transparent'}`}
                     >
                       <div className={`w-12 h-12 rounded-full ${group.avatarColor} flex items-center justify-center text-white font-bold relative flex-shrink-0`}>
                         <i className="fa-solid fa-users text-lg"></i>
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-baseline">
                           <h3 className={`text-sm truncate ${activeGroupId === group.id ? 'font-bold dark:text-white text-zinc-900' : 'font-medium dark:text-zinc-200 text-zinc-700'}`}>{group.name}</h3>
                           {lastVox && <span className="text-[10px] text-zinc-400">{lastVox.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
                         </div>
                         <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                           {group.members.length} members
                         </p>
                       </div>
                     </div>
                   );
                 })}
                 <div className="px-2 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-2">Direct</div>
               </>
             )}

             {/* Contacts List */}
             {filteredContacts.map(contact => {
                 const lastVox = recordings.filter(r => r.contactId === contact.id).pop();
                 return (
                     <div
                        key={contact.id}
                        onClick={() => { setActiveContactId(contact.id); setActiveGroupId(null); setMobileView('thread'); }}
                        className={`p-3 rounded-xl cursor-pointer transition flex items-center gap-3 group ${activeContactId === contact.id && !activeGroupId ? 'bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800/50 border border-transparent'}`}
                     >
                         <div className={`w-12 h-12 rounded-full ${contact.avatarColor} flex items-center justify-center text-white font-bold relative flex-shrink-0`}>
                             {contact.name.charAt(0)}
                             <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 ${contact.status === 'online' ? 'bg-emerald-500' : 'bg-zinc-400'}`}></div>
                         </div>
                         <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-baseline">
                                 <h3 className={`text-sm truncate ${activeContactId === contact.id && !activeGroupId ? 'font-bold dark:text-white text-zinc-900' : 'font-medium dark:text-zinc-200 text-zinc-700'}`}>{contact.name}</h3>
                                 {lastVox && <span className="text-[10px] text-zinc-400">{lastVox.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
                             </div>
                             <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1">
                                 {lastVox ? (
                                     <>
                                        <i className={`fa-solid ${lastVox.type === 'video' ? 'fa-video' : 'fa-microphone'} text-[10px]`}></i>
                                        {lastVox.sender === 'me' ? 'You: ' : ''} Vox sent
                                     </>
                                 ) : 'Tap to start vox'}
                             </p>
                         </div>
                         <button
                            onClick={(e) => handleDeleteThread(contact.id, e)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500 hover:text-red-600"
                            title="Delete thread"
                         >
                            <i className="fa-solid fa-trash text-xs"></i>
                         </button>
                     </div>
                 );
             })}
         </div>
      </div>

      {/* MAIN AREA: Conversation */}
      <div className={`flex-1 flex flex-col bg-white dark:bg-zinc-950 relative ${mobileView === 'thread' ? 'flex' : 'hidden md:flex'}`}>
          
          {/* Header - Only show when a contact is selected */}
          {activeContactId && (
            <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-10 absolute top-0 left-0 right-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => setMobileView('list')} className="md:hidden text-zinc-500"><i className="fa-solid fa-arrow-left"></i></button>
                    {activeContact && (
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full ${activeContact.avatarColor} flex items-center justify-center text-white text-sm font-bold`}>
                                {activeContact.name.charAt(0)}
                            </div>
                            <div>
                                <div className="font-bold text-sm dark:text-white text-zinc-900">{activeContact.name}</div>
                                <div className="text-[10px] text-zinc-500">{activeContact.role}</div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex gap-1.5 items-center">
                    {/* Silent Mode Indicator */}
                    <SilentModeIndicator
                      isEnabled={silentModeEnabled}
                      onClick={() => setShowSilentModePanel(true)}
                      unreadCount={silentModeMessages.filter(m => !m.isRead).length}
                    />
                    
                    {/* Feature Buttons */}
                    <button
                      onClick={() => setShowLiveSession(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition flex items-center gap-1.5"
                      title="Live Vox Session"
                    >
                      <i className="fa-solid fa-podcast"></i>
                      <span className="hidden lg:inline">Live</span>
                    </button>
                    <button
                      onClick={() => setShowVoiceRooms(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold transition flex items-center gap-1.5"
                      title="Voice Rooms"
                    >
                      <i className="fa-solid fa-tower-broadcast"></i>
                      <span className="hidden lg:inline">Rooms</span>
                    </button>
                    <button
                      onClick={() => setShowCollabVox(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-semibold transition flex items-center gap-1.5"
                      title="Collaborative Vox"
                    >
                      <i className="fa-solid fa-users-rectangle"></i>
                      <span className="hidden lg:inline">Collab</span>
                    </button>
                    <button
                      onClick={() => setShowTimeCapsule(true)}
                      className="w-8 h-8 rounded-full hover:bg-pink-100 dark:hover:bg-pink-900/30 text-zinc-400 hover:text-pink-500 transition flex items-center justify-center"
                      title="Time Capsule"
                    >
                      <i className="fa-solid fa-clock-rotate-left"></i>
                    </button>
                    <button
                      onClick={() => setShowPlaylists(true)}
                      className="w-8 h-8 rounded-full hover:bg-orange-100 dark:hover:bg-orange-900/30 text-zinc-400 hover:text-orange-500 transition flex items-center justify-center"
                      title="Playlists"
                    >
                      <i className="fa-solid fa-rectangle-list"></i>
                    </button>
                    <button
                      onClick={() => setShowVoiceCommands(true)}
                      className={`w-8 h-8 rounded-full transition flex items-center justify-center ${voiceCommandsEnabled ? 'bg-orange-500/20 text-orange-500' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-orange-500'}`}
                      title="Voice Commands"
                    >
                      <i className="fa-solid fa-microphone-lines"></i>
                    </button>
                    <button
                      onClick={() => setShowStats(true)}
                      className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition flex items-center justify-center"
                      title="Stats"
                    >
                      <i className="fa-solid fa-chart-simple"></i>
                    </button>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition flex items-center justify-center"
                      title="Settings"
                    >
                      <i className="fa-solid fa-gear"></i>
                    </button>
                    <button className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition flex items-center justify-center"><i className="fa-solid fa-phone"></i></button>
                    <button className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition flex items-center justify-center"><i className="fa-solid fa-video"></i></button>
                </div>
            </div>
          )}

          {/* Filter/Sort Bar - Only show when a contact is selected */}
          {activeContactId && (
            <div className="absolute top-16 left-0 right-0 px-4 py-2 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 z-10">
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs border-0"
              >
                <option value="all">All</option>
                <option value="starred">Starred</option>
                <option value="actionItems">With Actions</option>
                <option value="unplayed">Unplayed</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs border-0"
              >
                <option value="date">By Date</option>
                <option value="duration">By Duration</option>
                <option value="sentiment">By Sentiment</option>
                <option value="urgency">By Urgency</option>
              </select>
              <span className="text-[10px] text-zinc-400 ml-auto">{filteredThreadRecordings.length} voxes</span>
            </div>
          )}

          {/* Messages Area */}
          <div className={`flex-1 overflow-y-auto p-4 pb-40 space-y-6 ${activeContactId ? 'pt-28' : 'pt-4'}`}>
              {!activeContactId && !activeGroupId && (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                      {/* Animated Walkie-Talkie Landing Screen */}
                      <div className="relative mb-8">
                          {/* Outer pulsing ring */}
                          <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-32 h-32 rounded-full border-2 border-orange-500/30 animate-ping"></div>
                          </div>
                          {/* Middle pulsing ring */}
                          <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-24 h-24 rounded-full border-2 border-orange-500/40 animate-ping" style={{ animationDelay: '0.5s' }}></div>
                          </div>
                          {/* Walkie-Talkie Icon Container */}
                          <div className="relative w-20 h-20 flex items-center justify-center">
                              {/* Walkie-Talkie Body */}
                              <div className="relative w-16 h-20 bg-gradient-to-b from-orange-500 to-orange-600 rounded-lg shadow-lg flex flex-col items-center justify-center">
                                  {/* Antenna */}
                                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-1 h-4 bg-orange-400 rounded-t-full"></div>
                                  {/* Speaker Grille */}
                                  <div className="w-10 h-6 bg-orange-700/30 rounded flex items-center justify-center mb-1">
                                      <div className="grid grid-cols-3 gap-0.5 w-8">
                                          {[...Array(9)].map((_, i) => (
                                              <div key={i} className="w-1.5 h-1.5 bg-orange-300/50 rounded-sm"></div>
                                          ))}
                                      </div>
                                  </div>
                                  {/* Transmitting Indicator */}
                                  <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                  {/* Control Buttons */}
                                  <div className="flex gap-1 mt-1">
                                      <div className="w-2 h-2 bg-orange-300/50 rounded-full"></div>
                                      <div className="w-2 h-2 bg-orange-300/50 rounded-full"></div>
                                  </div>
                              </div>
                              {/* Signal Waves */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="absolute w-24 h-24 border-2 border-orange-400/20 rounded-full animate-pulse"></div>
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="absolute w-28 h-28 border-2 border-orange-400/10 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                              </div>
                          </div>
                      </div>
                      <h3 className="text-xl font-light text-zinc-900 dark:text-white mb-2">Ready to Vox</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
                          Select a contact from the list or start a new conversation to begin sending voice messages
                      </p>
                  </div>
              )}
              {activeContactId && filteredThreadRecordings.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400 opacity-50">
                      <i className="fa-solid fa-walkie-talkie text-5xl mb-4"></i>
                      <p>No voxes yet.</p>
                  </div>
              )}

              {filteredThreadRecordings.map((rec) => (
                  <div key={rec.id} className={`flex flex-col ${rec.sender === 'me' ? 'items-end' : 'items-start'} animate-slide-up`}>
                      <div className={`max-w-[85%] md:max-w-[60%] rounded-2xl p-3 border ${rec.sender === 'me' ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800 rounded-br-none' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-bl-none'} ${rec.starred ? 'ring-2 ring-yellow-400' : ''}`}>

                          {/* Top Bar: Quality, Tags, Star */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {rec.quality && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 rounded font-mono">
                                  {rec.quality}
                                </span>
                              )}
                              {rec.analysis?.sentiment && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${getSentimentColor(rec.analysis.sentiment)}`}>
                                  {rec.analysis.sentiment}
                                </span>
                              )}
                              {rec.analysis?.urgency && rec.analysis.urgency !== 'low' && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${getUrgencyColor(rec.analysis.urgency)}`}>
                                  {rec.analysis.urgency}
                                </span>
                              )}
                              {rec.tags?.map(tag => {
                                const tagColors: Record<string, string> = {
                                  'Important': 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800',
                                  'Follow-up': 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800',
                                  'Decision': 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800',
                                  'Question': 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
                                  'Idea': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
                                  'Personal': 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800',
                                };
                                return (
                                  <span 
                                    key={tag} 
                                    className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${tagColors[tag] || 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
                                  >
                                    <i className="fa-solid fa-tag text-[8px]"></i>
                                    {tag}
                                  </span>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => toggleStar(rec.id)}
                              className={`w-6 h-6 flex items-center justify-center rounded transition ${rec.starred ? 'text-yellow-500' : 'text-zinc-300 hover:text-yellow-500'}`}
                            >
                              <i className={`fa-${rec.starred ? 'solid' : 'regular'} fa-star text-xs`}></i>
                            </button>
                          </div>

                          {/* Media Player */}
                          <div className="mb-2 rounded-xl overflow-hidden bg-black relative shadow-sm">
                              {rec.type === 'video' ? (
                                  <video
                                      src={rec.url}
                                      controls
                                      className="w-full aspect-video object-cover"
                                      data-rec-id={rec.id}
                                      onPlay={() => handlePlay(rec)}
                                      onPause={handlePause}
                                  />
                              ) : (
                                  <div className="w-full bg-zinc-900 p-4 flex items-center gap-3">
                                      <button
                                          onClick={() => {
                                              const audio = document.querySelector(`audio[data-rec-id="${rec.id}"]`) as HTMLAudioElement;
                                              if (audio) {
                                                  if (audio.paused) {
                                                      audio.playbackRate = playbackSpeed;
                                                      audio.play();
                                                      handlePlay(rec);
                                                  } else {
                                                      audio.pause();
                                                      handlePause();
                                                  }
                                              }
                                          }}
                                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 hover:scale-105 transition ${playingId === rec.id ? 'bg-orange-500' : 'bg-orange-600'}`}
                                      >
                                          <i className={`fa-solid ${playingId === rec.id ? 'fa-pause' : 'fa-play'}`}></i>
                                      </button>
                                      <div className="h-8 flex-1">
                                           {/* Visualizer Placeholder for playback */}
                                           <div className="w-full h-full flex items-end gap-0.5 opacity-50">
                                               {Array.from({length: 20}).map((_, i) => (
                                                   <div key={i} className="flex-1 bg-white" style={{ height: `${Math.random() * 100}%` }}></div>
                                               ))}
                                           </div>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                          <span className="text-xs font-mono text-zinc-400">{rec.duration.toFixed(0)}s</span>
                                          <button
                                              onClick={cyclePlaybackSpeed}
                                              className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition font-mono"
                                          >
                                              {playbackSpeed}x
                                          </button>
                                      </div>
                                  </div>
                              )}
                              {/* Hidden audio element for playback */}
                              {rec.type === 'audio' && (
                                  <audio
                                      src={rec.url}
                                      data-rec-id={rec.id}
                                      onPlay={() => handlePlay(rec)}
                                      onPause={handlePause}
                                      onEnded={handlePause}
                                  />
                              )}
                          </div>

                          {/* Transcription */}
                          <div className="px-1">
                             {rec.isTranscribing ? (
                                 <div className="flex items-center gap-2 text-xs text-zinc-400 italic">
                                     <i className="fa-solid fa-circle-notch fa-spin"></i> Transcribing...
                                 </div>
                             ) : (
                                 <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-light">
                                     {rec.transcription || <span className="italic text-zinc-400">No transcription available</span>}
                                 </p>
                             )}
                          </div>

                          {/* AI Analysis Panel */}
                          {rec.analysis && 'summary' in rec.analysis && (
                            <div className="mt-3 px-1">
                              <AIAnalysisPanel
                                analysis={rec.analysis as VoxAnalysisType}
                                isLoading={rec.isAnalyzing}
                                compact={true}
                                className="text-xs"
                              />
                            </div>
                          )}

                          {/* Analyzing indicator */}
                          {rec.isAnalyzing && (
                            <div className="mt-3 px-1">
                              <div className="flex items-center gap-2 text-xs text-purple-500 italic">
                                <i className="fa-solid fa-circle-notch fa-spin"></i> Analyzing voice message...
                              </div>
                            </div>
                          )}

                          {/* ADVANCED FEATURE ACTIONS */}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                            {/* Vox Reactions */}
                            <VoxReactions
                              voxId={rec.id}
                              reactions={reactions[rec.id] || []}
                              currentUserId="me"
                              currentUserName="You"
                              onAddReaction={(reaction) => handleAddReaction(rec.id, reaction)}
                              onRemoveReaction={(reactionId) => handleRemoveReaction(rec.id, reactionId)}
                              compact
                            />

                            {/* Quick Actions */}
                            <div className="flex items-center gap-1">
                              {/* Thread */}
                              <button
                                onClick={() => setActiveThreadVoxId(rec.id)}
                                className="w-7 h-7 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-orange-500 transition"
                                title="Start thread"
                              >
                                <i className="fa-solid fa-comments text-xs"></i>
                              </button>
                              {threads[rec.id] && threads[rec.id].replies.length > 0 && (
                                <ThreadIndicator
                                  replyCount={threads[rec.id].replies.length}
                                  onClick={() => setActiveThreadVoxId(rec.id)}
                                />
                              )}

                              {/* Add to Playlist */}
                              <button
                                onClick={() => { setAddToPlaylistVoxId(rec.id); setShowAddToPlaylist(true); }}
                                className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 flex items-center justify-center text-zinc-400 hover:text-orange-500 transition"
                                title="Add to playlist"
                              >
                                <i className="fa-solid fa-list text-xs"></i>
                              </button>

                              {/* Tag */}
                              <button
                                onClick={() => { setSelectedTagRecordingId(rec.id); setShowTagModal(true); }}
                                className="w-7 h-7 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-blue-500 transition"
                                title="Add tag"
                              >
                                <i className="fa-solid fa-tag text-xs"></i>
                              </button>

                              {/* Analysis */}
                              {rec.transcription && (
                                <button
                                  onClick={() => analyzeVoiceMessage(rec.id, rec.transcription!)}
                                  disabled={rec.isAnalyzing}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                                    rec.isAnalyzing ? 'text-purple-500 animate-spin' : 
                                    rec.analysis ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-500' : 
                                    'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-purple-500'
                                  }`}
                                  title={rec.analysis ? 'View analysis' : 'Analyze'}
                                >
                                  <i className={`fa-solid ${rec.isAnalyzing ? 'fa-circle-notch' : 'fa-brain'} text-xs`}></i>
                                </button>
                              )}

                              {/* Bookmark */}
                              <button
                                onClick={() => {
                                  const newBookmark = {
                                    voxId: rec.id,
                                    userId: 'me',
                                    timestamp: 0,
                                    label: 'Quick Bookmark',
                                    color: 'bg-orange-500',
                                  };
                                  handleAddBookmark(rec.id, newBookmark);
                                }}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                                  bookmarks[rec.id]?.length > 0 
                                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-500' 
                                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-orange-500'
                                }`}
                                title={bookmarks[rec.id]?.length > 0 ? `${bookmarks[rec.id].length} bookmarks` : 'Add bookmark'}
                              >
                                <i className="fa-solid fa-bookmark text-xs"></i>
                              </button>

                              {/* More Options Dropdown */}
                              <div className="relative">
                                <button
                                  onClick={() => setSelectedRecordingForDetails(selectedRecordingForDetails?.id === rec.id ? null : rec)}
                                  className="w-7 h-7 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
                                  title="More options"
                                >
                                  <i className="fa-solid fa-ellipsis text-xs"></i>
                                </button>
                                
                                {/* Dropdown Menu */}
                                {selectedRecordingForDetails?.id === rec.id && (
                                  <>
                                    <div className="fixed inset-0 z-30" onClick={() => setSelectedRecordingForDetails(null)} />
                                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden z-40 min-w-[180px] animate-scaleIn origin-top-right">
                                      <button
                                        onClick={() => { 
                                          handleVoiceCoachAnalysis(rec.blob, rec.transcription || '', rec.duration);
                                          setSelectedRecordingForDetails(null);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition flex items-center gap-3"
                                      >
                                        <i className="fa-solid fa-user-graduate text-purple-500 w-4"></i>
                                        AI Voice Coach
                                      </button>
                                      <button
                                        onClick={() => { 
                                          setShowAddNoteModal(true);
                                          setSelectedRecordingForDetails(null);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition flex items-center gap-3"
                                      >
                                        <i className="fa-solid fa-sticky-note text-yellow-500 w-4"></i>
                                        Add Note
                                      </button>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(rec.transcription || '');
                                          toast.success('Transcription copied!');
                                          setSelectedRecordingForDetails(null);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition flex items-center gap-3"
                                      >
                                        <i className="fa-solid fa-copy text-blue-500 w-4"></i>
                                        Copy Transcription
                                      </button>
                                      <button
                                        onClick={() => {
                                          const link = document.createElement('a');
                                          link.href = rec.url;
                                          link.download = `vox-${rec.id}.webm`;
                                          link.click();
                                          setSelectedRecordingForDetails(null);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition flex items-center gap-3"
                                      >
                                        <i className="fa-solid fa-download text-emerald-500 w-4"></i>
                                        Download
                                      </button>
                                      <div className="border-t border-zinc-200 dark:border-zinc-700 my-1"></div>
                                      <button
                                        onClick={async () => {
                                          // Delete from database
                                          await dataService.deleteVoxerRecording(rec.id);
                                          setRecordings(prev => prev.filter(r => r.id !== rec.id));
                                          toast('Vox deleted', { icon: '🗑️' });
                                          setSelectedRecordingForDetails(null);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center gap-3"
                                      >
                                        <i className="fa-solid fa-trash w-4"></i>
                                        Delete
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Voice Bookmarks (if any exist) */}
                          {bookmarks[rec.id] && bookmarks[rec.id].length > 0 && (
                            <div className="mt-2">
                              <VoiceBookmarks
                                voxId={rec.id}
                                duration={rec.duration}
                                audioUrl={rec.url}
                                bookmarks={bookmarks[rec.id] || []}
                                onAddBookmark={(bm) => handleAddBookmark(rec.id, bm)}
                                onRemoveBookmark={(bmId) => handleRemoveBookmark(rec.id, bmId)}
                                onUpdateBookmark={(bmId, updates) => handleUpdateBookmark(rec.id, bmId, updates)}
                                currentUserId="me"
                              />
                            </div>
                          )}
                      </div>
                      {/* Timestamp and Status */}
                      <div className="flex items-center gap-2 mt-1 px-1">
                          <span className="text-[10px] text-zinc-400">{rec.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                          {rec.sender === 'me' && (
                              <i className={`fa-solid ${getStatusIcon(rec.status)} text-[10px]`}></i>
                          )}
                          {rec.sender === 'other' && rec.status === 'read' && rec.playedAt && (
                              <span className="text-[9px] text-blue-500">Played</span>
                          )}
                      </div>
                  </div>
              ))}
          </div>

          {/* Recorder Footer */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 p-4 z-20 shadow-2xl">
              
              {/* Preview Window (Video Mode) */}
              {mode === 'video' && (
                  <div className="absolute bottom-full left-4 mb-4 w-48 aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-zinc-800 animate-scale-in origin-bottom-left">
                      <video ref={cameraPreviewRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                      {isRecording && <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow"></div>}
                  </div>
              )}

              {/* Controls Grid */}
              <div className="max-w-3xl mx-auto flex items-end gap-4">
                  
                  {/* Mode Toggle */}
                  <div className="flex flex-col gap-2">
                      <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-1 flex border border-zinc-200 dark:border-zinc-800">
                          <button onClick={() => setMode('audio')} className={`p-2 rounded-md transition ${mode === 'audio' ? 'bg-white dark:bg-zinc-800 shadow text-zinc-900 dark:text-white' : 'text-zinc-400'}`}><i className="fa-solid fa-microphone"></i></button>
                          <button onClick={() => setMode('video')} className={`p-2 rounded-md transition ${mode === 'video' ? 'bg-white dark:bg-zinc-800 shadow text-zinc-900 dark:text-white' : 'text-zinc-400'}`}><i className="fa-solid fa-video"></i></button>
                      </div>
                      
                      {/* Hold/Tap Toggle */}
                      <button 
                        onClick={() => setRecordingMode(recordingMode === 'hold' ? 'tap' : 'hold')}
                        className="text-[10px] uppercase font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
                      >
                          {recordingMode === 'hold' ? 'Hold Mode' : 'Tap Mode'}
                      </button>
                      {/* Real-time Transcription Toggle */}
                      <button 
                        onClick={() => setIsRealtimeActive(!isRealtimeActive)}
                        className={`text-[10px] uppercase font-bold transition flex items-center gap-1 ${isRealtimeActive ? 'text-emerald-500' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                        title="Real-time transcription"
                      >
                        <i className={`fa-solid fa-closed-captioning ${isRealtimeActive ? 'animate-pulse' : ''}`}></i>
                        Live
                      </button>
                      {/* Preview Mode Toggle */}
                      <button 
                        onClick={() => setPreviewModeEnabled(!previewModeEnabled)}
                        className={`text-[10px] uppercase font-bold transition flex items-center gap-1 ${previewModeEnabled ? 'text-purple-500' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                        title="Preview before sending"
                      >
                        <i className={`fa-solid fa-eye ${previewModeEnabled ? '' : 'opacity-50'}`}></i>
                        Preview
                      </button>
                  </div>

                  {/* Visualizer / Status Area */}
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="bg-zinc-100 dark:bg-zinc-900 rounded-2xl h-16 border border-zinc-200 dark:border-zinc-800 overflow-hidden relative flex items-center justify-center px-2 w-full min-w-[200px]">
                         <WaveformVisualizer
                            analyser={analyserRef.current}
                            isActive={isRecording}
                            color="#f97316"
                            progressColor="#fb923c"
                            backgroundColor="transparent"
                            width={400}
                            height={56}
                            showMirror={true}
                            barWidth={3}
                            barGap={2}
                         />
                         {!isRecording && (
                             <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-xs font-medium bg-white/50 dark:bg-zinc-950/50 backdrop-blur-[1px]">
                                 {recordingMode === 'hold' ? 'Hold Button to Record' : 'Tap Button to Start'}
                             </div>
                         )}
                    </div>
                    
                    {/* Real-time Transcription Display */}
                    {isRealtimeActive && isRecording && (
                      <div className="bg-zinc-900/90 rounded-xl px-3 py-2 animate-fade-in">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                          <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">Live Transcript</span>
                        </div>
                        <p className="text-sm text-white/90 leading-relaxed min-h-[1.5rem]">
                          {realtimeTranscript || <span className="text-zinc-500 italic">Listening...</span>}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Record Controls */}
                  <div className="flex items-center gap-3">
                    {/* Priority Badge (before recording) */}
                    {!isRecording && selectedPriority !== 'normal' && (
                      <PriorityBadge level={selectedPriority} size="md" showLabel />
                    )}

                    {/* Priority Selector Button */}
                    <button
                      onClick={() => setShowPrioritySelector(true)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                        selectedPriority === 'emergency' ? 'bg-red-500 text-white' :
                        selectedPriority === 'urgent' ? 'bg-orange-500 text-white' :
                        selectedPriority === 'important' ? 'bg-blue-500 text-white' :
                        'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                      title="Set Priority"
                    >
                      <i className="fa-solid fa-bell"></i>
                    </button>

                    {/* Record Button */}
                    <button
                      onMouseDown={recordingMode === 'hold' ? startRecording : undefined}
                      onMouseUp={recordingMode === 'hold' ? stopRecording : undefined}
                      onMouseLeave={recordingMode === 'hold' ? stopRecording : undefined}
                      onTouchStart={recordingMode === 'hold' ? startRecording : undefined}
                      onTouchEnd={recordingMode === 'hold' ? stopRecording : undefined}
                      onClick={recordingMode === 'tap' ? handleRecordToggle : undefined}
                      disabled={isRecording && mode === 'video' && recordingMode === 'hold'}
                      className={`relative w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center text-2xl
                        transition-all duration-200 ease-out shadow-xl hover:scale-105 active:scale-95 ${
                          isRecording
                          ? 'bg-orange-600 text-white ring-4 ring-orange-500/30 shadow-orange-500/50'
                          : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg'
                      }`}
                    >
                        {isRecording && (
                          <span className="absolute inset-0 rounded-full animate-ping bg-orange-400 opacity-50" />
                        )}
                        <span className="relative z-10">
                          <i className={`fa-solid ${isRecording ? 'fa-stop' : (mode === 'video' ? 'fa-video' : 'fa-microphone')}`}></i>
                        </span>
                    </button>

                    {/* AI Voice Coach Button */}
                    <button
                      onClick={() => {
                        if (recordings.length > 0) {
                          const lastRec = recordings[recordings.length - 1];
                          if (lastRec.transcription) {
                            handleVoiceCoachAnalysis(lastRec.blob, lastRec.transcription, lastRec.duration);
                          } else {
                            toast('Record a vox first, then analyze it', { icon: 'ℹ️' });
                          }
                        } else {
                          toast('Record a vox first', { icon: 'ℹ️' });
                        }
                      }}
                      className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-purple-500 hover:bg-purple-100 dark:hover:bg-purple-900/30 flex items-center justify-center transition"
                      title="AI Voice Coach"
                    >
                      <i className="fa-solid fa-user-graduate"></i>
                    </button>
                  </div>

              </div>
          </div>

      </div>


      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold dark:text-white">Voice Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-zinc-400 hover:text-zinc-600">
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm dark:text-white">Noise Suppression</div>
                  <div className="text-xs text-zinc-500">Reduce background noise</div>
                </div>
                <button
                  onClick={() => setNoiseSuppression(!noiseSuppression)}
                  className={`w-12 h-6 rounded-full transition ${noiseSuppression ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transform transition ${noiseSuppression ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm dark:text-white">Echo Cancellation</div>
                  <div className="text-xs text-zinc-500">Remove audio feedback</div>
                </div>
                <button
                  onClick={() => setEchoCancellation(!echoCancellation)}
                  className={`w-12 h-6 rounded-full transition ${echoCancellation ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transform transition ${echoCancellation ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm dark:text-white">Auto Gain Control</div>
                  <div className="text-xs text-zinc-500">Normalize volume levels</div>
                </div>
                <button
                  onClick={() => setAutoGainControl(!autoGainControl)}
                  className={`w-12 h-6 rounded-full transition ${autoGainControl ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transform transition ${autoGainControl ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                </button>
              </div>
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Video Quality</label>
                <div className="flex gap-2">
                  {(['480p', '720p', '1080p'] as VideoQuality[]).map(q => (
                    <button
                      key={q}
                      onClick={() => setVideoQuality(q)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                        videoQuality === q ? 'bg-orange-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStats && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowStats(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold dark:text-white">Conversation Stats</h3>
              <button onClick={() => setShowStats(false)} className="text-zinc-400 hover:text-zinc-600">
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.total}</div>
                <div className="text-xs text-orange-600/70">Total Voxes</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{Math.round(stats.totalDuration)}s</div>
                <div className="text-xs text-blue-600/70">Total Duration</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">{stats.sentCount}</div>
                <div className="text-xs text-emerald-600/70">Sent</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.receivedCount}</div>
                <div className="text-xs text-purple-600/70">Received</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.starredCount}</div>
                <div className="text-xs text-yellow-600/70">Starred</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{stats.withActionsCount}</div>
                <div className="text-xs text-red-600/70">With Actions</div>
              </div>
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="text-xs text-zinc-500 text-center">
                Average duration: {stats.avgDuration.toFixed(1)}s per vox
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tag Modal */}
      {showTagModal && selectedTagRecordingId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => { setShowTagModal(false); setSelectedTagRecordingId(null); }}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold dark:text-white">Add Tag</h3>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {PREDEFINED_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => addTag(selectedTagRecordingId, tag)}
                  className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg text-sm transition"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Live Vox Session Modal */}
      <LiveVoxSession
        isOpen={showLiveSession}
        onClose={() => setShowLiveSession(false)}
        participants={activeContact ? [
          activeContact,
          { id: 'me', name: 'You', role: 'User', status: 'online', avatarColor: 'bg-orange-500' }
        ] : contacts.slice(0, 2).concat([{ id: 'me', name: 'You', role: 'User', status: 'online', avatarColor: 'bg-orange-500' }])}
        currentUserId="me"
        geminiApiKey={apiKey}
      />

      {/* Voice Rooms Modal */}
      <VoiceRooms
        isOpen={showVoiceRooms}
        onClose={() => setShowVoiceRooms(false)}
        contacts={contacts}
        currentUser={{
          id: 'me',
          name: 'You',
          avatarColor: 'bg-orange-500',
        }}
      />

      {/* ============================================ */}
      {/* ADVANCED FEATURE MODALS */}
      {/* ============================================ */}

      {/* AI Voice Coach Modal */}
      {showVoiceCoach && (
        <AIVoiceCoach
          isOpen={showVoiceCoach}
          onClose={() => setShowVoiceCoach(false)}
          transcription={pendingVoxTranscript}
          audioDuration={pendingVoxDuration}
          audioBlob={pendingVoxBlob || undefined}
          apiKey={apiKey}
          onSendAnyway={handleSendAfterCoach}
          onReRecord={() => {
            setShowVoiceCoach(false);
            setPendingVoxBlob(null);
            setPendingVoxTranscript('');
            setPendingVoxDuration(0);
          }}
          recipientName={activeContact?.name}
        />
      )}

      {/* Priority Vox Selector */}
      <PriorityVoxSelector
        isOpen={showPrioritySelector}
        onClose={() => setShowPrioritySelector(false)}
        onSelect={handlePrioritySelect}
        currentPriority={selectedPriority}
      />

      {/* Emergency Alert */}
      {emergencyVox && (
        <EmergencyAlert
          vox={emergencyVox}
          senderName={contacts.find(c => c.id === emergencyVox.senderId)?.name || 'Unknown'}
          audioUrl={emergencyVox.audioUrl || ''}
          onAcknowledge={handleAcknowledgeEmergency}
          onDismiss={() => setEmergencyVox(null)}
          onPlay={() => {}}
        />
      )}

      {/* Vox Threads Modal */}
      {activeThreadVoxId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <VoxThreads
            thread={threads[activeThreadVoxId] || null}
            parentVoxDuration={recordings.find(r => r.id === activeThreadVoxId)?.duration || 0}
            parentVoxTranscription={recordings.find(r => r.id === activeThreadVoxId)?.transcription}
            currentUserId="me"
            currentUserName="You"
            currentUserAvatarColor="bg-orange-500"
            onCreateThread={(timestamp) => handleCreateThread(activeThreadVoxId, timestamp)}
            onAddReply={(threadId, blob, parentReplyId) => handleAddThreadReply(threadId, blob, parentReplyId)}
            onClose={() => setActiveThreadVoxId(null)}
          />
        </div>
      )}

      {/* Time Capsule Modal */}
      <TimeCapsuleVox
        isOpen={showTimeCapsule}
        onClose={() => setShowTimeCapsule(false)}
        contacts={contacts}
        currentUserId="me"
        onSchedule={handleScheduleCapsule}
      />

      {/* Silent Mode Panel */}
      {showSilentModePanel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50" onClick={() => setShowSilentModePanel(false)}>
          <div 
            className="bg-white dark:bg-zinc-900 w-full md:w-[450px] md:rounded-2xl h-[85vh] md:h-[70vh] shadow-2xl overflow-hidden" 
            onClick={e => e.stopPropagation()}
          >
            <SilentModePanel
              isEnabled={silentModeEnabled}
              onToggle={handleToggleSilentMode}
              settings={silentModeSettings}
              onUpdateSettings={(updates) => setSilentModeSettings(prev => ({ ...prev, ...updates }))}
              incomingMessages={silentModeMessages}
              onReply={handleSilentModeReply}
              onMarkRead={handleMarkSilentMessageRead}
            />
          </div>
        </div>
      )}

      {/* Vox Playlists Modal */}
      {showPlaylists && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50" onClick={() => setShowPlaylists(false)}>
          <div 
            className="bg-white dark:bg-zinc-900 w-full md:w-[500px] md:rounded-2xl h-[85vh] md:h-[75vh] shadow-2xl overflow-hidden" 
            onClick={e => e.stopPropagation()}
          >
            <VoxPlaylists
              playlists={playlists}
              onCreatePlaylist={handleCreatePlaylist}
              onUpdatePlaylist={handleUpdatePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onAddToPlaylist={handleAddToPlaylist}
              onRemoveFromPlaylist={() => {}}
              onPlayPlaylist={handlePlayPlaylist}
              currentUserId="me"
            />
          </div>
        </div>
      )}

      {/* Add to Playlist Modal */}
      {showAddToPlaylist && addToPlaylistVoxId && (
        <AddToPlaylistModal
          isOpen={showAddToPlaylist}
          onClose={() => { setShowAddToPlaylist(false); setAddToPlaylistVoxId(null); }}
          playlists={playlists}
          voxId={addToPlaylistVoxId}
          onAdd={(playlistId) => handleAddToPlaylist(playlistId, addToPlaylistVoxId)}
          onCreate={() => {
            setShowAddToPlaylist(false);
            setShowPlaylists(true);
          }}
        />
      )}

      {/* Collaborative Vox Modal */}
      <CollaborativeVox
        isOpen={showCollabVox}
        onClose={() => setShowCollabVox(false)}
        contacts={contacts}
        currentUser={{
          id: 'me',
          name: 'You',
          avatarColor: 'bg-orange-500',
        }}
        onCreateCollab={handleCreateCollab}
        onAddSegment={() => {}}
        onRemoveSegment={() => {}}
        onReorderSegments={() => {}}
        onSendCollab={handleSendCollab}
      />

      {/* Voice Commands Modal */}
      {showVoiceCommands && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50" onClick={() => setShowVoiceCommands(false)}>
          <div 
            className="bg-white dark:bg-zinc-900 w-full md:w-[450px] md:rounded-2xl h-[85vh] md:h-[75vh] shadow-2xl overflow-hidden" 
            onClick={e => e.stopPropagation()}
          >
            <VoiceCommandsHub
              isEnabled={voiceCommandsEnabled}
              onToggle={handleToggleVoiceCommands}
              wakeWordConfig={voiceCommandConfig}
              onUpdateConfig={(updates) => setVoiceCommandConfig(prev => ({ ...prev, ...updates }))}
              onExecuteCommand={handleVoiceCommandExecute}
              contactNames={contacts.map(c => c.name)}
            />
          </div>
        </div>
      )}

      {/* Floating Voice Button (always visible when voice commands enabled) */}
      <FloatingVoiceButton
        onPress={() => setShowVoiceCommands(true)}
        isEnabled={voiceCommandsEnabled}
        isListening={isVoiceListening}
      />

      {/* Vox Preview Panel (Preview Before Send) */}
      {pendingRecording && (
        <VoxPreviewPanel
          isOpen={showPreviewPanel}
          onClose={handleClosePreview}
          audioBlob={pendingRecording.blob}
          duration={pendingRecording.duration}
          transcription={pendingRecording.transcription}
          isTranscribing={pendingRecording.isTranscribing}
          onSend={handleSendPendingRecording}
          onReRecord={handleReRecord}
          onOpenFullCoach={handlePreviewOpenFullCoach}
          recipientName={activeContact?.name}
          apiKey={apiKey}
        />
      )}

      {/* AI Feedback Modal (Pre-Send Review) */}
      {pendingRecording && (
        <AIFeedbackModal
          isOpen={showFeedbackModal}
          feedback={currentFeedback}
          transcription={pendingRecording.transcription}
          isLoading={isFeedbackLoading}
          onClose={handleFeedbackClose}
          onSendAnyway={handleFeedbackSendAnyway}
          onReRecord={handleReRecord}
        />
      )}

      {/* Vox Mode Selector Modal */}
      <VoxModeSelector
        isOpen={showVoxModeSelector}
        onClose={() => setShowVoxModeSelector(false)}
        onSelectMode={(mode) => {
          setCurrentVoxMode(mode);
          setShowVoxModeSelector(false);
        }}
        currentMode={currentVoxMode}
        isDarkMode={isDarkMode}
      />
      </div>
    </>
  );
};

export default Voxer;
