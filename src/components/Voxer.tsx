
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
import { useAuth } from '../hooks/useAuth';
import { useVoxerFeatures } from '../hooks/useVoxerFeatures';
import { useVoxerSettings } from '../hooks/useVoxerSettings';
import {
  CheckCheck, Check, Radio, Layers, Plus, Search, User, Users, X, UserX,
  ChevronRight, Video, Mic, Trash2, ArrowLeft, Podcast, Tower, History,
  List, Mic2, BarChart3, Settings, Phone, Tag, Star, Pause, Play, Loader2,
  MessageSquare, Brain, Bookmark, MoreHorizontal, GraduationCap, StickyNote,
  Copy, Download, ClosedCaptioning, Eye, Bell, Square
} from 'lucide-react';

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
import { VoxPreviewPanel } from './Voxer/VoxPreviewPanel';

// Selection and Archive/Download functionality
import { useVoxSelection } from '../hooks/useVoxSelection';
import { VoxSelectToolbar } from './Voxer/VoxSelectToolbar';
import VoxDownloadModal from './Voxer/VoxDownloadModal';

// Keyboard shortcuts
import { useVoxerKeyboardShortcuts } from '../hooks/useVoxerKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from './Voxer/VoxKeyboardShortcutsHelp';

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

const Voxer: React.FC<VoxerProps> = ({ apiKey, contacts, initialContactId, isDarkMode = false }) => {
  // Get user from auth context
  const { user } = useAuth();
  const userId = user?.id || 'guest';

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

  // Use custom hooks for consolidated state management
  const settings = useVoxerSettings();
  const features = useVoxerFeatures();

  // Recorder State
  const [isRecording, setIsRecording] = useState(false);

  // Playback State
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Enhanced Voice Intelligence State
  const [selectedRecordingForDetails, setSelectedRecordingForDetails] = useState<Recording | null>(null);

  // New Features State
  const [realtimeTranscript, setRealtimeTranscript] = useState<string>('');
  const [transcriptionState, setTranscriptionState] = useState<RealtimeTranscriptionState>('idle');
  const realtimeServiceRef = useRef<RealtimeTranscriptionService | null>(null);

  // 9. Selection Mode for Archive/Download
  const {
    isSelectionMode,
    selectedItems,
    selectionCount,
    totalDuration,
    toggleSelection,
    selectAll,
    deselectAll,
    enterSelectionMode,
    exitSelectionMode,
  } = useVoxSelection();

  // 12. Vox Mode System - 6 Communication Styles
  // Show mode selector by default when entering Voxer (no mode selected initially)
  const [currentVoxMode, setCurrentVoxMode] = useState<VoxMode | null>(null);
  const [showVoxModeSelector, setShowVoxModeSelector] = useState(true); // Show selector on load
  const [lastVoxMode, setLastVoxMode] = useState<VoxMode | null>(null); // Track last active mode for selector indicator
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  
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
          audio: settings.selectedAudioInput ? { deviceId: settings.selectedAudioInput } : true,
          video: settings.mode === 'video'
             ? (settings.selectedVideoInput ? { deviceId: settings.selectedVideoInput, width: { ideal: 1280 } } : true)
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
        if (cameraPreviewRef.current && settings.mode === 'video') {
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
  }, [settings.mode, settings.selectedAudioInput, settings.selectedVideoInput]);

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

      if (settings.mode === 'video') {
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
        if (settings.autoEnhanceEnabled && settings.mode === 'audio' && blob.size > 100) {
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
              duration: 2000,
            });
          } catch (error) {
            console.error('Audio enhancement failed:', error);
            // Continue with original blob if enhancement fails
            toast.error('Audio enhancement failed, using original', {
              duration: 2000,
            });
          }
        }

        const url = URL.createObjectURL(blob);
        const duration = (Date.now() - startTimeRef.current) / 1000;

        // ============================================
        // PREVIEW MODE: Show preview panel instead of auto-sending
        // ============================================
        if (features.previewModeEnabled) {
          // Set pending recording for preview
          features.setPendingRecording({
            blob,
            url,
            duration,
            transcription: realtimeTranscript || '',
            isTranscribing: !realtimeTranscript && apiKey ? true : false,
          });
          features.setShowPreviewPanel(true);
          
          // Start background transcription if no real-time transcript
          if (!realtimeTranscript && apiKey && blob.size > 100) {
            try {
              const base64 = await blobToBase64(blob);
              const text = await transcribeMedia(apiKey, base64, mimeType);
              features.setPendingRecording(prev => prev ? {
                ...prev,
                transcription: text || "Transcription failed.",
                isTranscribing: false,
              } : null);
            } catch (e) {
              features.setPendingRecording(prev => prev ? {
                ...prev,
                transcription: "Error transcribing.",
                isTranscribing: false,
              } : null);
            }
          } else if (!realtimeTranscript) {
            features.setPendingRecording(prev => prev ? {
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
          type: settings.mode,
          sender: 'me',
          recipientId: activeContactId,
          contactId: activeContactId,
          quality: settings.mode === 'video' ? settings.videoQuality : undefined,
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
          duration: 2000,
        });

        // Save to database
        const saveRecording = async () => {
          try {
            // Upload blob to storage
            const mediaUrl = await dataService.uploadVoxerMedia(blob, id, settings.mode);

            // Save recording metadata
            await dataService.saveVoxerRecording({
              id,
              audio_url: settings.mode === 'audio' ? mediaUrl : undefined,
              video_url: settings.mode === 'video' ? mediaUrl : undefined,
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
                   tags: ['voxer', settings.mode],
                   relatedContactId: activeContactId
               });
               toast.success('Transcription complete', {
                 duration: 2000,
               });

               // AI Analysis Integration - Analyze after transcription completes
               if (settings.autoAnalyzeEnabled && text.length > 10) {
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
                     duration: 2000,
                   });
                 } catch (error) {
                   console.error('AI analysis error:', error);
                   setRecordings(prev => prev.map(rec =>
                     rec.id === id ? { ...rec, isAnalyzing: false } : rec
                   ));
                   toast.error('AI analysis failed', {
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
      if (settings.isRealtimeActive && streamRef.current) {
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
            toast.error('Transcription error', { duration: 2000 });
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
      if (settings.isRealtimeActive) {
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
    const currentIndex = speeds.indexOf(settings.playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    settings.setPlaybackSpeed(speeds[nextIndex]);

    // Apply to all media elements
    document.querySelectorAll('audio, video').forEach((el: any) => {
      el.playbackRate = speeds[nextIndex];
    });
  };

  // ============================================
  // PREVIEW MODE HANDLERS
  // ============================================

  // Get AI feedback on pending recording
  const getAIFeedback = useCallback(async () => {
    if (!features.pendingRecording || !features.pendingRecording.transcription || !apiKey) return;

    features.setIsFeedbackLoading(true);

    try {
      const feedbackService = getVoxerFeedbackService(apiKey);
      const contactName = contacts.find(c => c.id === activeContactId)?.name;

      const feedback = await feedbackService.analyzeFeedback(
        features.pendingRecording.transcription,
        {
          recipientName: contactName,
          relationship: 'professional', // Could be determined from contact type
          purpose: 'general',
        }
      );

      features.setCurrentFeedback(feedback);
      features.setShowFeedbackModal(true);
    } catch (error) {
      console.error('AI feedback error:', error);
      toast.error('Failed to get AI feedback', {
        duration: 2000,
      });
    } finally {
      features.setIsFeedbackLoading(false);
    }
  }, [features.pendingRecording, apiKey, contacts, activeContactId, features]);

  const handleSendPendingRecording = useCallback(async () => {
    if (!features.pendingRecording) return;

    // Check if AI feedback is enabled and should be shown
    if (settings.autoFeedbackEnabled && features.pendingRecording.transcription && features.pendingRecording.transcription.length > 10) {
      await getAIFeedback();
      return; // Wait for user to review feedback
    }

    // Proceed with sending (either feedback disabled or user clicked "Send Anyway")
    await sendRecordingNow();
  }, [features.pendingRecording, settings.autoFeedbackEnabled, getAIFeedback]);

  // Actually send the recording (called after feedback review or if feedback disabled)
  const sendRecordingNow = useCallback(async () => {
    if (!features.pendingRecording) return;

    const { blob, url, duration, transcription } = features.pendingRecording;
    const id = Date.now().toString();

    const newRecording: Recording = {
      id,
      blob,
      url,
      duration,
      timestamp: new Date(),
      isTranscribing: false,
      transcription: transcription || '',
      type: settings.mode,
      sender: 'me',
      recipientId: activeContactId,
      contactId: activeContactId,
      quality: settings.mode === 'video' ? settings.videoQuality : undefined,
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
      duration: 2000,
    });

    // Save to database
    try {
      // Upload blob to storage
      const mediaUrl = await dataService.uploadVoxerMedia(features.pendingRecording.blob, id, settings.mode);

      // Save recording metadata
      await dataService.saveVoxerRecording({
        id,
        audio_url: settings.mode === 'audio' ? mediaUrl : undefined,
        video_url: settings.mode === 'video' ? mediaUrl : undefined,
        duration: Math.round(features.pendingRecording.duration),
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
        tags: ['voxer', settings.mode],
        relatedContactId: activeContactId
      });
    }

    // Real replies will come through real-time subscriptions or API callbacks

    // Clean up
    features.setShowPreviewPanel(false);
    features.setShowFeedbackModal(false);
    features.setCurrentFeedback(null);
    features.setPendingRecording(null);
    setRealtimeTranscript('');
  }, [features, settings.mode, activeContactId, settings.videoQuality, contacts]);

  const handleReRecord = useCallback(() => {
    // Clean up the pending recording
    if (features.pendingRecording?.url) {
      URL.revokeObjectURL(features.pendingRecording.url);
    }
    features.setPendingRecording(null);
    features.setShowPreviewPanel(false);
    features.setShowFeedbackModal(false);
    features.setCurrentFeedback(null);
    setRealtimeTranscript('');
    toast('Ready to re-record', { duration: 1500 });
  }, [features]);

  // Feedback Modal Handlers
  const handleFeedbackSendAnyway = useCallback(async () => {
    features.setShowFeedbackModal(false);
    await sendRecordingNow();
  }, [features, sendRecordingNow]);

  const handleFeedbackClose = useCallback(() => {
    features.setShowFeedbackModal(false);
    features.setCurrentFeedback(null);
    // Keep the pending recording so user can review and decide
  }, [features]);

  const handleClosePreview = useCallback(() => {
    // Keep the recording but close the panel
    features.setShowPreviewPanel(false);
  }, [features]);

  const handlePreviewOpenFullCoach = useCallback(() => {
    if (features.pendingRecording) {
      features.setPendingVoxBlob(features.pendingRecording.blob);
      features.setPendingVoxTranscript(features.pendingRecording.transcription);
      features.setPendingVoxDuration(features.pendingRecording.duration);
      features.setShowVoiceCoach(true);
      features.setShowPreviewPanel(false);
    }
  }, [features]);

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
    features.setReactions(prev => ({
      ...prev,
      [voxId]: [...(prev[voxId] || []), newReaction],
    }));
    toast.success('Reaction added!', { duration: 1000, icon: reaction.emoji });
  }, [features]);

  const handleRemoveReaction = useCallback((voxId: string, reactionId: string) => {
    features.setReactions(prev => ({
      ...prev,
      [voxId]: (prev[voxId] || []).filter(r => r.id !== reactionId),
    }));
  }, [features]);

  // 2. AI Voice Coach Handler
  const handleVoiceCoachAnalysis = useCallback((blob: Blob, transcript: string, duration: number) => {
    features.setPendingVoxBlob(blob);
    features.setPendingVoxTranscript(transcript);
    features.setPendingVoxDuration(duration);
    features.setShowVoiceCoach(true);
  }, [features]);

  const handleSendAfterCoach = useCallback(() => {
    // Send the pending vox
    if (features.pendingVoxBlob) {
      // Add recording logic here
      toast.success('Vox sent!');
    }
    features.setShowVoiceCoach(false);
    features.setPendingVoxBlob(null);
    features.setPendingVoxTranscript('');
    features.setPendingVoxDuration(0);
  }, [features]);

  // 3. Priority Vox Handlers
  const handlePrioritySelect = useCallback((priority: PriorityLevel, options: any) => {
    features.setSelectedPriority(priority);
    features.setShowPrioritySelector(false);
    if (priority !== 'normal') {
      toast(`Priority set to ${priority}`, { icon: priority === 'emergency' ? '🚨' : '⚡' });
    }
  }, [features]);

  const handleAcknowledgeEmergency = useCallback(() => {
    if (features.emergencyVox) {
      toast.success('Emergency acknowledged');
      features.setEmergencyVox(null);
    }
  }, [features]);

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
    features.setThreads(prev => ({ ...prev, [voxId]: newThread }));
    features.setActiveThreadVoxId(voxId);
  }, [features]);

  const handleAddThreadReply = useCallback((threadId: string, audioBlob: Blob, parentReplyId?: string) => {
    const voxId = Object.keys(features.threads).find(k => features.threads[k].id === threadId);
    if (voxId) {
      const newReply: VoxThreadReply = {
        id: `reply-${Date.now()}`,
        threadId,
        parentReplyId,
        voxId: `vox-${Date.now()}`,
        userId: userId,
        userName: 'Me',
        userAvatarColor: 'bg-orange-500',
        audioUrl: URL.createObjectURL(audioBlob),
        duration: 5, // Would be calculated
        timestamp: new Date(),
        reactions: [],
        depth: parentReplyId ? 1 : 0,
      };
      features.setThreads(prev => ({
        ...prev,
        [voxId]: {
          ...prev[voxId],
          replies: [...prev[voxId].replies, newReply],
          lastActivityAt: new Date(),
        },
      }));
      toast.success('Reply added to thread');
    }
  }, [features, userId]);

  // 5. Time Capsule Handlers
  const handleScheduleCapsule = useCallback((capsule: Omit<TimeCapsuleType, 'id' | 'status' | 'createdAt'>) => {
    const newCapsule: TimeCapsuleType = {
      ...capsule,
      id: `capsule-${Date.now()}`,
      status: 'scheduled',
      createdAt: new Date(),
    };
    features.setScheduledCapsules(prev => [...prev, newCapsule]);
    features.setShowTimeCapsule(false);
    toast.success(`Time capsule scheduled for ${new Date(capsule.scheduledFor).toLocaleDateString()}`);
  }, [features]);

  const handleCancelCapsule = useCallback((capsuleId: string) => {
    features.setScheduledCapsules(prev =>
      prev.map(c => c.id === capsuleId ? { ...c, status: 'cancelled' as const } : c)
    );
    toast('Time capsule cancelled');
  }, [features]);

  // 6. Voice Bookmarks Handlers
  const handleAddBookmark = useCallback((voxId: string, bookmark: Omit<VoiceBookmark, 'id' | 'createdAt'>) => {
    const newBookmark: VoiceBookmark = {
      ...bookmark,
      id: `bookmark-${Date.now()}`,
      createdAt: new Date(),
    };
    features.setBookmarks(prev => ({
      ...prev,
      [voxId]: [...(prev[voxId] || []), newBookmark],
    }));
    toast.success(`Bookmark added at ${Math.floor(bookmark.timestamp / 60)}:${(bookmark.timestamp % 60).toString().padStart(2, '0')}`);
  }, [features]);

  const handleRemoveBookmark = useCallback((voxId: string, bookmarkId: string) => {
    features.setBookmarks(prev => ({
      ...prev,
      [voxId]: (prev[voxId] || []).filter(b => b.id !== bookmarkId),
    }));
  }, [features]);

  const handleUpdateBookmark = useCallback((voxId: string, bookmarkId: string, updates: Partial<VoiceBookmark>) => {
    features.setBookmarks(prev => ({
      ...prev,
      [voxId]: (prev[voxId] || []).map(b => b.id === bookmarkId ? { ...b, ...updates } : b),
    }));
  }, [features]);

  // 7. Silent Mode Handlers
  const handleToggleSilentMode = useCallback(() => {
    features.setSilentModeEnabled(prev => {
      const newState = !prev;
      toast(newState ? 'Silent mode enabled' : 'Silent mode disabled', {
        icon: newState ? '🔇' : '🔊'
      });
      return newState;
    });
  }, [features]);

  const handleSilentModeReply = useCallback((messageId: string, text: string) => {
    features.setSilentModeMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, replied: true, replyText: text } : m)
    );
    toast.success('Reply sent as voice message');
  }, [features]);

  const handleMarkSilentMessageRead = useCallback((messageId: string) => {
    features.setSilentModeMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, isRead: true } : m)
    );
  }, [features]);

  // 8. Vox Playlists Handlers
  const handleCreatePlaylist = useCallback((playlist: Omit<VoxPlaylist, 'id' | 'createdAt' | 'updatedAt' | 'totalDuration'>) => {
    const newPlaylist: VoxPlaylist = {
      ...playlist,
      id: `playlist-${Date.now()}`,
      totalDuration: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    features.setPlaylists(prev => [...prev, newPlaylist]);
    toast.success(`Playlist "${playlist.name}" created!`);
  }, [features]);

  const handleUpdatePlaylist = useCallback((id: string, updates: Partial<VoxPlaylist>) => {
    features.setPlaylists(prev =>
      prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p)
    );
  }, [features]);

  const handleDeletePlaylist = useCallback((id: string) => {
    features.setPlaylists(prev => prev.filter(p => p.id !== id));
    toast('Playlist deleted');
  }, [features]);

  const handleAddToPlaylist = useCallback((playlistId: string, voxId: string) => {
    features.setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        const newItem = {
          id: `item-${Date.now()}`,
          playlistId,
          voxId,
          addedAt: new Date(),
          addedBy: userId,
          order: p.items.length,
        };
        return { ...p, items: [...p.items, newItem], updatedAt: new Date() };
      }
      return p;
    }));
    features.setShowAddToPlaylist(false);
    features.setAddToPlaylistVoxId(null);
    toast.success('Added to playlist');
  }, [features, userId]);

  const handlePlayPlaylist = useCallback((playlistId: string) => {
    const playlist = features.playlists.find(p => p.id === playlistId);
    if (playlist && playlist.items.length > 0) {
      toast.success(`Playing "${playlist.name}"`);
      // Would implement sequential playback
    }
  }, [features.playlists]);

  // 9. Collaborative Vox Handlers
  const handleCreateCollab = useCallback((collab: Omit<CollabVoxType, 'id' | 'createdAt'>) => {
    const newCollab: CollabVoxType = {
      ...collab,
      id: `collab-${Date.now()}`,
      createdAt: new Date(),
    };
    features.setActiveCollabs(prev => [...prev, newCollab]);
    toast.success('Collaborative vox started!');
  }, [features]);

  const handleSendCollab = useCallback((collabId: string, recipientIds: string[]) => {
    features.setActiveCollabs(prev => prev.filter(c => c.id !== collabId));
    features.setShowCollabVox(false);
    toast.success('Collaborative vox sent!');
  }, [features]);

  // 10. Voice Commands Handlers
  const handleToggleVoiceCommands = useCallback(() => {
    features.setVoiceCommandsEnabled(prev => {
      const newState = !prev;
      toast(newState ? 'Voice commands enabled' : 'Voice commands disabled', {
        icon: newState ? '🎤' : '🔇'
      });
      return newState;
    });
  }, [features]);

  const handleVoiceCommandExecute = useCallback((command: any, params: Record<string, any>) => {
    console.log('Executing voice command:', command.action, params);

    switch (command.action) {
      case 'NAVIGATE_VOXER':
        // Already in Voxer
        toast('You\'re already in Voxer!');
        break;
      case 'PLAY_UNREAD':
        const unread = recordings.filter(r => r.sender === 'other' && r.status !== 'read');
        if (unread.length > 0) {
          handlePlay(unread[0]);
          toast(`Playing ${unread.length} unread messages`);
        } else {
          toast('No unread messages');
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
        toast(`Command: ${command.description}`);
    }

    features.setIsVoiceListening(false);
  }, [recordings, handlePause, handleToggleSilentMode, features]);

  // --- Active Thread Recordings ---
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
    setShowNewVoxModal(false);
    setGroupName('');
    setSelectedGroupMembers([]);
    toast.success(`Group "${groupName}" created!`);
  };

  // Start new individual vox
  const handleStartIndividualVox = (contact: Contact) => {
    setActiveContactId(contact.id);
    setActiveGroupId(null);
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
      
      toast.success('Thread deleted');
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
    switch (settings.videoQuality) {
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
        duration: 2000,
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      setRecordings(prev => prev.map(r =>
        r.id === recordingId ? { ...r, isAnalyzing: false } : r
      ));
      toast.error('Analysis failed', {
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


  // Mode names for keyboard shortcut toast notifications
  const MODE_NAMES: Record<string, string> = {
    classic: 'Classic Voxer',
    pulse_radio: 'Pulse Radio',
    voice_threads: 'Voice Threads',
    team_vox: 'Team Vox',
    vox_notes: 'Vox Notes',
    quick_vox: 'Quick Vox',
    vox_drop: 'Vox Drop',
    video_vox: 'Video Vox',
  };

  // Handle mode selection callback
  const handleBackToSelector = () => {
    setCurrentVoxMode(null);
    setShowVoxModeSelector(true);
  };

  const handleSelectMode = (mode: VoxMode | null) => {
    if (mode !== null) setLastVoxMode(mode);
    setCurrentVoxMode(mode);
    setShowVoxModeSelector(false);
  };

  // Global keyboard shortcuts — mode switching (1-8) and help (?)
  // Escape/go-back is only handled here when NO mode is active, to avoid double-firing
  // with per-mode keyboard shortcut handlers each mode component registers.
  useVoxerKeyboardShortcuts({
    onSwitchMode: (mode) => {
      const voxMode = mode === 'classic' ? null : mode as VoxMode;
      setCurrentVoxMode(voxMode);
      setShowVoxModeSelector(false);
      toast.success(`Switched to ${MODE_NAMES[mode] || mode}`, { duration: 1500 });
    },
    onShowHelp: () => setShowShortcutsHelp(true),
    // Only handle Escape at parent level when no mode component is mounted (no child handler)
    onGoBack: !currentVoxMode ? () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false);
      else if (showVoxModeSelector) setShowVoxModeSelector(false);
    } : undefined,
  }, true);

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
          <VideoVoxMode onClose={handleBackToSelector} apiKey={apiKey} isDarkMode={isDarkMode} />
        )}

        {/* Vox Mode Selector Modal (can be opened from within modes) */}
        <VoxModeSelector
          isOpen={showVoxModeSelector}
          onClose={() => setShowVoxModeSelector(false)}
          onSelectMode={handleSelectMode}
          currentMode={currentVoxMode}
          isDarkMode={isDarkMode}
        />

        {/* Global keyboard shortcuts help modal */}
        <VoxKeyboardShortcutsHelp
          isOpen={showShortcutsHelp}
          onClose={() => setShowShortcutsHelp(false)}
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
          currentMode={lastVoxMode}
          isDarkMode={isDarkMode}
        />

        {/* Global keyboard shortcuts help modal */}
        <VoxKeyboardShortcutsHelp
          isOpen={showShortcutsHelp}
          onClose={() => setShowShortcutsHelp(false)}
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

        {/* Global keyboard shortcuts help modal */}
        <VoxKeyboardShortcutsHelp
          isOpen={showShortcutsHelp}
          onClose={() => setShowShortcutsHelp(false)}
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  // This fallback should never be reached - all code paths above return a mode component
  // If you see this error, there's a bug in the mode routing logic
  return (
    <div className="h-full flex items-center justify-center bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <div className="text-center p-8">
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
          Voxer Mode Error
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          No valid mode selected. This is a bug - please report it.
        </p>
        <button
          onClick={() => {
            setCurrentVoxMode(null);
            setShowVoxModeSelector(true);
          }}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
        >
          Open Mode Selector
        </button>
      </div>
    </div>
  );
};

export default Voxer;
