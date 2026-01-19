// Voxer Components - Main Export
// Comprehensive suite of voice communication components

// Core Components
export { PTTButton, MiniPTTButton } from './PTTButton';
export type { PTTState, RecordingMode, MediaMode } from './PTTButton';

export { AIAnalysisPanel, AnalysisBadge } from './AIAnalysisPanel';
export { AIFeedbackModal } from './AIFeedbackModal';
export { VoxBubble } from './VoxBubble';
export { LiveVoxSession } from './LiveVoxSession';
export { VoiceRooms } from './VoiceRooms';

// Advanced Features
export { VoxReactions, QuickReactionBar } from './VoxReactions';
export { AIVoiceCoach } from './AIVoiceCoach';
export { PriorityVoxSelector, PriorityBadge, EmergencyAlert, AcknowledgedList } from './PriorityVox';
export { VoxThreads, ThreadIndicator } from './VoxThreads';
export { TimeCapsuleVox, ScheduledCapsuleCard } from './TimeCapsuleVox';
export { VoiceBookmarks } from './VoiceBookmarks';
export { SilentModePanel, SilentModeIndicator, DEFAULT_SILENT_MODE_SETTINGS } from './SilentMode';
export { VoxPlaylists, AddToPlaylistModal } from './VoxPlaylists';
export { CollaborativeVox } from './CollaborativeVox';
export { VoiceCommandsHub, FloatingVoiceButton } from './VoiceCommandsHub';
export { VoxPreviewPanel } from './VoxPreviewPanel';

// ============================================
// VOX MODE SYSTEM - 7 Communication Styles
// ============================================

// Vox Mode Selector - Main menu for choosing communication style
export { default as VoxModeSelector } from './VoxModeSelector';

// Classic Voxer Mode - Direct contact messaging (avant-garde redesign)
export { default as ClassicVoxerMode } from './ClassicVoxerMode';

// Individual Vox Mode Components
export { default as PulseRadio } from './PulseRadio';           // Broadcast to followers
export { default as VoiceThreadsMode } from './VoiceThreadsMode'; // Async threaded conversations
export { default as TeamVoxMode } from './TeamVoxMode';         // Workspace/team focused
export { default as VoxNotesMode } from './VoxNotesMode';       // Personal voice memos
export { default as QuickVoxMode } from './QuickVoxMode';       // One-tap instant communication
export { default as VoxDropMode } from './VoxDropMode';         // Time-capsule scheduled messages
export { default as VideoVoxMode } from './VideoVoxMode';       // Cinematic video messages