// useVoxerFeatures - Advanced Voxer features state management
// Consolidates state for reactions, threads, bookmarks, playlists, etc.

import { useState } from 'react';
import {
  VoxReaction,
  VoxThread,
  TimeCapsuleVox,
  VoiceBookmark,
  SilentModeSettings,
  TranscriptionModeMessage,
  VoxPlaylist,
  CollaborativeVox,
  PriorityLevel,
  WakeWordConfig,
  DEFAULT_WAKE_WORD_CONFIG,
} from '../services/voxer/advancedVoxerTypes';
import { VoxFeedback } from '../services/voxer/voxerTypes';
import { DEFAULT_SILENT_MODE_SETTINGS } from '../components/Voxer/SilentMode';

export interface VoxerFeaturesState {
  // 1. Vox Reactions
  reactions: Record<string, VoxReaction[]>;
  setReactions: React.Dispatch<React.SetStateAction<Record<string, VoxReaction[]>>>;

  // 2. AI Voice Coach
  showVoiceCoach: boolean;
  setShowVoiceCoach: React.Dispatch<React.SetStateAction<boolean>>;
  pendingVoxBlob: Blob | null;
  setPendingVoxBlob: React.Dispatch<React.SetStateAction<Blob | null>>;
  pendingVoxTranscript: string;
  setPendingVoxTranscript: React.Dispatch<React.SetStateAction<string>>;
  pendingVoxDuration: number;
  setPendingVoxDuration: React.Dispatch<React.SetStateAction<number>>;

  // 3. Priority Vox
  showPrioritySelector: boolean;
  setShowPrioritySelector: React.Dispatch<React.SetStateAction<boolean>>;
  selectedPriority: PriorityLevel;
  setSelectedPriority: React.Dispatch<React.SetStateAction<PriorityLevel>>;
  emergencyVox: any;
  setEmergencyVox: React.Dispatch<React.SetStateAction<any>>;

  // 4. Vox Threads
  threads: Record<string, VoxThread>;
  setThreads: React.Dispatch<React.SetStateAction<Record<string, VoxThread>>>;
  activeThreadVoxId: string | null;
  setActiveThreadVoxId: React.Dispatch<React.SetStateAction<string | null>>;

  // 5. Time Capsule
  showTimeCapsule: boolean;
  setShowTimeCapsule: React.Dispatch<React.SetStateAction<boolean>>;
  scheduledCapsules: TimeCapsuleVox[];
  setScheduledCapsules: React.Dispatch<React.SetStateAction<TimeCapsuleVox[]>>;

  // 6. Voice Bookmarks
  bookmarks: Record<string, VoiceBookmark[]>;
  setBookmarks: React.Dispatch<React.SetStateAction<Record<string, VoiceBookmark[]>>>;

  // 7. Silent Mode
  silentModeEnabled: boolean;
  setSilentModeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  silentModeSettings: SilentModeSettings;
  setSilentModeSettings: React.Dispatch<React.SetStateAction<SilentModeSettings>>;
  silentModeMessages: TranscriptionModeMessage[];
  setSilentModeMessages: React.Dispatch<React.SetStateAction<TranscriptionModeMessage[]>>;
  showSilentModePanel: boolean;
  setShowSilentModePanel: React.Dispatch<React.SetStateAction<boolean>>;

  // 8. Vox Playlists
  playlists: VoxPlaylist[];
  setPlaylists: React.Dispatch<React.SetStateAction<VoxPlaylist[]>>;
  showPlaylists: boolean;
  setShowPlaylists: React.Dispatch<React.SetStateAction<boolean>>;
  showAddToPlaylist: boolean;
  setShowAddToPlaylist: React.Dispatch<React.SetStateAction<boolean>>;
  addToPlaylistVoxId: string | null;
  setAddToPlaylistVoxId: React.Dispatch<React.SetStateAction<string | null>>;

  // 9. Collaborative Vox
  showCollabVox: boolean;
  setShowCollabVox: React.Dispatch<React.SetStateAction<boolean>>;
  activeCollabs: CollaborativeVox[];
  setActiveCollabs: React.Dispatch<React.SetStateAction<CollaborativeVox[]>>;

  // 10. Voice Commands
  voiceCommandsEnabled: boolean;
  setVoiceCommandsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  showVoiceCommands: boolean;
  setShowVoiceCommands: React.Dispatch<React.SetStateAction<boolean>>;
  voiceCommandConfig: WakeWordConfig;
  setVoiceCommandConfig: React.Dispatch<React.SetStateAction<WakeWordConfig>>;
  isVoiceListening: boolean;
  setIsVoiceListening: React.Dispatch<React.SetStateAction<boolean>>;

  // 11. Preview Before Send Mode
  previewModeEnabled: boolean;
  setPreviewModeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  showPreviewPanel: boolean;
  setShowPreviewPanel: React.Dispatch<React.SetStateAction<boolean>>;
  pendingRecording: {
    blob: Blob;
    url: string;
    duration: number;
    transcription: string;
    isTranscribing: boolean;
  } | null;
  setPendingRecording: React.Dispatch<React.SetStateAction<{
    blob: Blob;
    url: string;
    duration: number;
    transcription: string;
    isTranscribing: boolean;
  } | null>>;

  // 12. AI Feedback
  showFeedbackModal: boolean;
  setShowFeedbackModal: React.Dispatch<React.SetStateAction<boolean>>;
  currentFeedback: VoxFeedback | null;
  setCurrentFeedback: React.Dispatch<React.SetStateAction<VoxFeedback | null>>;
  isFeedbackLoading: boolean;
  setIsFeedbackLoading: React.Dispatch<React.SetStateAction<boolean>>;

  // 13. Live Session
  showLiveSession: boolean;
  setShowLiveSession: React.Dispatch<React.SetStateAction<boolean>>;

  // 14. Voice Rooms
  showVoiceRooms: boolean;
  setShowVoiceRooms: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Custom hook for managing advanced Voxer features state
 * Consolidates state for reactions, threads, bookmarks, playlists, AI features, etc.
 */
export function useVoxerFeatures(): VoxerFeaturesState {
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
  const [scheduledCapsules, setScheduledCapsules] = useState<TimeCapsuleVox[]>([]);

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
  const [activeCollabs, setActiveCollabs] = useState<CollaborativeVox[]>([]);

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

  // 12. AI Feedback
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<VoxFeedback | null>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

  // 13. Live Session
  const [showLiveSession, setShowLiveSession] = useState(false);

  // 14. Voice Rooms
  const [showVoiceRooms, setShowVoiceRooms] = useState(false);

  return {
    // 1. Vox Reactions
    reactions,
    setReactions,

    // 2. AI Voice Coach
    showVoiceCoach,
    setShowVoiceCoach,
    pendingVoxBlob,
    setPendingVoxBlob,
    pendingVoxTranscript,
    setPendingVoxTranscript,
    pendingVoxDuration,
    setPendingVoxDuration,

    // 3. Priority Vox
    showPrioritySelector,
    setShowPrioritySelector,
    selectedPriority,
    setSelectedPriority,
    emergencyVox,
    setEmergencyVox,

    // 4. Vox Threads
    threads,
    setThreads,
    activeThreadVoxId,
    setActiveThreadVoxId,

    // 5. Time Capsule
    showTimeCapsule,
    setShowTimeCapsule,
    scheduledCapsules,
    setScheduledCapsules,

    // 6. Voice Bookmarks
    bookmarks,
    setBookmarks,

    // 7. Silent Mode
    silentModeEnabled,
    setSilentModeEnabled,
    silentModeSettings,
    setSilentModeSettings,
    silentModeMessages,
    setSilentModeMessages,
    showSilentModePanel,
    setShowSilentModePanel,

    // 8. Vox Playlists
    playlists,
    setPlaylists,
    showPlaylists,
    setShowPlaylists,
    showAddToPlaylist,
    setShowAddToPlaylist,
    addToPlaylistVoxId,
    setAddToPlaylistVoxId,

    // 9. Collaborative Vox
    showCollabVox,
    setShowCollabVox,
    activeCollabs,
    setActiveCollabs,

    // 10. Voice Commands
    voiceCommandsEnabled,
    setVoiceCommandsEnabled,
    showVoiceCommands,
    setShowVoiceCommands,
    voiceCommandConfig,
    setVoiceCommandConfig,
    isVoiceListening,
    setIsVoiceListening,

    // 11. Preview Before Send Mode
    previewModeEnabled,
    setPreviewModeEnabled,
    showPreviewPanel,
    setShowPreviewPanel,
    pendingRecording,
    setPendingRecording,

    // 12. AI Feedback
    showFeedbackModal,
    setShowFeedbackModal,
    currentFeedback,
    setCurrentFeedback,
    isFeedbackLoading,
    setIsFeedbackLoading,

    // 13. Live Session
    showLiveSession,
    setShowLiveSession,

    // 14. Voice Rooms
    showVoiceRooms,
    setShowVoiceRooms,
  };
}
