/**
 * War Room Components Index
 * Exports all War Room related components and utilities.
 *
 * Phase 1 changes:
 *  - Added WarRoomLayout, ModeToolbar (new foundation components)
 *  - NeuralTerminal, SentientInterface, XRayMode, LivingAI, ElegantInterface
 *    moved to ./archived/ — import from there if needed
 */

// ── Foundation (Phase 1) ─────────────────────────────────────────────────────
export { WarRoomLayout } from './WarRoomLayout';
export type { WarRoomLayoutProps } from './WarRoomLayout';
export { ModeToolbar } from './ModeToolbar';

// ── Core Components ───────────────────────────────────────────────────────────
export { AudioVisualizer } from './AudioVisualizer';
export { ModeSwitcher } from './ModeSwitcher';
export type { WarRoomMode, MissionType, RoomType } from './ModeSwitcher';
export { TokenStream } from './TokenStream';
export { VoiceControl } from './VoiceControl';
export { ThinkingPanel } from './ThinkingPanel';
export { VoiceSynthesis, useVoiceSynthesis } from './VoiceSynthesis';

// ── Mode Components (canonical) ───────────────────────────────────────────────
export { CommandCenter } from './modes/CommandCenter';

// ── Effect Components ─────────────────────────────────────────────────────────
export { MatrixRain } from './effects/MatrixRain';
export { GlitchEffect } from './effects/GlitchEffect';
export { ParticleField } from './effects/ParticleField';

// ── OpenAI Realtime Voice Agent ───────────────────────────────────────────────
export { RealtimeVoiceAgent } from './RealtimeVoiceAgent';
export { VoiceSessionHistory } from './VoiceSessionHistory';
export { VoiceAgentPanel } from './VoiceAgentPanel';

// ── Redesigned War Room Shell ─────────────────────────────────────────────────
export { WarRoomRedesigned } from './WarRoomRedesigned';
export { WarRoomHub } from './WarRoomHub';
export { FloatingModeDock } from './FloatingModeDock';
