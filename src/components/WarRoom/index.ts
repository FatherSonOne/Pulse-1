/**
 * War Room Components Index
 * Exports all War Room components and utilities.
 */

// ── War Room Layout (Phase 1 redesign) ───────────────────────────────────────
export { StudioLayout } from './StudioLayout';
export type { StudioLayoutProps } from './StudioLayout';
export { StudioHeader } from './StudioHeader';
export { PulseStudio } from './PulseStudio';
export type { PulseStudioProps } from './PulseStudio';

// ── Core Components ───────────────────────────────────────────────────────────
export { ModeSwitcher } from './ModeSwitcher';
export type { WarRoomMode, MissionType, RoomType } from './ModeSwitcher';
export { VoiceControl } from './VoiceControl';
export { useVoiceSynthesis } from './VoiceSynthesis';

// ── Phase 2: Artifacts ───────────────────────────────────────────────────────
export { InlineArtifact } from './ArtifactRenderers';
export { parseMessageContent, hasLikelyArtifacts } from './artifactParser';
export type { Artifact, MessageSegment, ArtifactType } from './artifactParser';

// ── Phase 3: Commands ────────────────────────────────────────────────────────
export { useStudioCommands, STUDIO_COMMANDS, AGENT_MENTIONS } from './useStudioCommands';

// ── Phase 4: Utilities ───────────────────────────────────────────────────────
export { FocusTimer } from './FocusTimer';
export { StudioOnboarding, hasCompletedOnboarding } from './StudioOnboarding';
export { MarkdownContent } from './MarkdownContent';
export { useSwipeGesture } from './useSwipeGesture';

// ── OpenAI Realtime Voice Agent ──────────────────────────────────────────────
export { RealtimeVoiceAgent } from './RealtimeVoiceAgent';
export { VoiceSessionHistory } from './VoiceSessionHistory';
export { VoiceAgentPanel } from './VoiceAgentPanel';
