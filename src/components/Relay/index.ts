// Relay Components - Main Export
// Comprehensive suite of voice communication components

// Core Components
export { PTTButton, MiniPTTButton } from './PTTButton';
export type { PTTState, RecordingMode, MediaMode } from './PTTButton';

export { MessageAIPanel } from './MessageAIPanel';
export type { MessageAIPanelProps } from './MessageAIPanel';
// VoxBubble was retired during the /impeccable extract evaluation: confirmed
// unused by every 6-peer surface (Direct/Channel/Broadcast/Notes/Triage/Live
// all render bubbles inline). It carried FontAwesome icon strings + status-
// color sentiment badges. A shared <RelayVoiceMessage> with surface slots
// remains a worthwhile follow-up; for now, the four inline implementations
// at least no longer have a "canonical" candidate that lies about being the
// shared component.
export { VoiceRooms } from './VoiceRooms';

// Advanced Features (PriorityVox, TimeCapsuleVox, VoxReactions, VoxThreads,
// VoiceBookmarks, SilentMode, CollaborativeVox, VoxPreviewPanel, AIVoiceCoach,
// VoxPlaylists, VoiceCommandsHub, LiveVoxSession) were never wired into any of
// the 6 Relay surfaces — removed 2026-06-14 (launch-readiness S2-1). Recoverable
// from git history if any is revived.

// Phase 5: AI Enhancements
// VoxConversationSummary, VoxMeetingNotes, VoxAutoChapters, AIAnalysisPanel were
// consolidated into MessageAIPanel (Stage 2.1c, Voxer→Relay rework).
export { VoxSmartReplies } from './VoxSmartReplies';

// Phase 6: Final Polish
export { VoxKeyboardShortcutsHelp } from './VoxKeyboardShortcutsHelp';
export { PlaybackSpeedControl } from './PlaybackSpeedControl';
export { VoxEmptyState } from './VoxEmptyState';
export { VOX_EMPTY_STATES, getEmptyStateConfig } from './voxEmptyStates';
export type { VoxEmptyStateConfig } from './voxEmptyStates';

// ============================================
// VOX MODE SYSTEM - 7 Communication Styles
// ============================================

// VoxModeSelector was retired in Stage 2.1d.2 of the Voxer→Relay rework.
// The wall-of-tiles mode picker violated brand and was replaced by the inline
// horizontal mode-nav inside Relay.tsx (Triage / Messages / Notes / Live).

// Unified toolbar component for all Vox modes
export { default as VoxModeToolbar } from './VoxModeToolbar';
export type { VoxModeToolbarProps, VoxToolbarCustomAction } from './VoxModeToolbar';

// Classic Mode - Direct contact messaging (avant-garde redesign)
export { default as ClassicMode } from './ClassicMode';

// Individual Vox Mode Components
export { default as PulseRadio } from './PulseRadio';           // Broadcast to followers
export { default as TeamVoxMode } from './TeamVoxMode';         // Workspace/team focused
export { default as VoxNotesMode } from './VoxNotesMode';       // Personal voice memos
// VoiceThreadsMode / QuickVoxMode / VoxDropMode removed 2026-06-14 (S2-1, dead —
// never rendered). VideoVoxMode moved out of Relay in sub-stage 1.5c (2026-04-27);
// now lives at src/components/Glimpse/.