/**
 * Pulse Studio Components Index
 * Exports all Studio-related components and utilities.
 */

// ── Studio Layout (Phase 1 redesign) ────────────────────────────────────────
export { StudioLayout } from './StudioLayout';
export type { StudioLayoutProps } from './StudioLayout';
export { StudioHeader } from './StudioHeader';
export { PulseStudio } from './PulseStudio';
export type { PulseStudioProps } from './PulseStudio';

// ── Core Components ───────────────────────────────────────────────────────────
export { AudioVisualizer } from './AudioVisualizer';
export { ModeSwitcher } from './ModeSwitcher';
export type { WarRoomMode, MissionType, RoomType } from './ModeSwitcher';
export { TokenStream } from './TokenStream';
export { VoiceControl } from './VoiceControl';
export { ThinkingPanel } from './ThinkingPanel';
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
