/**
 * War Room Components Index
 * Exports all War Room related components and utilities
 */

// Core Components
export { AudioVisualizer } from './AudioVisualizer';
export { ModeSwitcher } from './ModeSwitcher';
export type { WarRoomMode } from './ModeSwitcher';
export { TokenStream } from './TokenStream';
export { VoiceControl } from './VoiceControl';
export { ThinkingPanel } from './ThinkingPanel';
export { VoiceSynthesis, useVoiceSynthesis } from './VoiceSynthesis';

// Mode Components
export { NeuralTerminal } from './modes/NeuralTerminal';
export { SentientInterface } from './modes/SentientInterface';
export { XRayMode } from './modes/XRayMode';
export { CommandCenter } from './modes/CommandCenter';

// Effect Components
export { MatrixRain } from './effects/MatrixRain';
export { GlitchEffect } from './effects/GlitchEffect';
export { ParticleField } from './effects/ParticleField';

// OpenAI Realtime Voice Agent Components
export { RealtimeVoiceAgent } from './RealtimeVoiceAgent';
export { VoiceSessionHistory } from './VoiceSessionHistory';
export { VoiceAgentPanel } from './VoiceAgentPanel';

// Redesigned War Room
export { WarRoomRedesigned } from './WarRoomRedesigned';
export { WarRoomHub } from './WarRoomHub';
export { FloatingModeDock } from './FloatingModeDock';
