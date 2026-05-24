// Public surface of the Relay Voice Studio primitives. Mode bodies + the
// Relay shell import from here; CSS modules ride along automatically.

export { RelayStudioProvider, useRelayStudio, useRelayStudioOptional } from './RelayStudioContext';
export type { NowPlayingVoice, RelayStudioState, RelayStudioApi, RelayRecorder } from './RelayStudioContext';

export { useRelayModeRecorder } from './useRelayModeRecorder';
export type { RelayModeRecorderApi } from './useRelayModeRecorder';

export { useElementWidth } from './useElementWidth';

export { Waveform } from './Waveform';
export type { WaveformProps } from './Waveform';

export { StudioCard } from './StudioCard';
export type { StudioCardProps } from './StudioCard';

export { SourcesRail } from './SourcesRail';
export type { SourcesRailProps } from './SourcesRail';

export { StudioFooter } from './StudioFooter';
export { FloatingMic } from './FloatingMic';
