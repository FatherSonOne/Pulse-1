// Record affordance — floats over the Relay pane, swaps icon + color while
// recording so the user always sees one button that says "press to toggle".
//
// Idle: rose CTA with halo ring animation (the "alive shadow" per DESIGN.md).
// Recording: red surface with stop icon, no halo (no more "press me" telegraph).

import React from 'react';
import { Mic, Square } from 'lucide-react';

import { useRelayStudio } from './RelayStudioContext';

import './floating-mic.css';

export interface FloatingMicProps {
  /** Override click handler. Phase 1 uses this to keep opening the existing
   *  RelayComposer modal (real audio capture lives there). Phase 2 omits it
   *  so the default — studio.toggleRecording — drives inline recording.
   *  When omitted, the icon also flips to Square while studio.isRecording. */
  onClick?: () => void;
  /** Override the live-state icon. Useful when consumers route the click
   *  somewhere else (modal open) and the floating mic should keep showing
   *  the resting "Mic" affordance instead of "Square (Stop)". Default:
   *  derived from studio.isRecording. */
  forceIdleIcon?: boolean;
}

export const FloatingMic: React.FC<FloatingMicProps> = ({ onClick, forceIdleIcon }) => {
  const { isRecording, toggleRecording } = useRelayStudio();
  const handleClick = onClick ?? toggleRecording;
  const showStopIcon = !forceIdleIcon && isRecording;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`pulse-floating-mic ${showStopIcon ? 'pulse-floating-mic--recording' : 'pulse-floating-mic--idle'}`}
      aria-label={showStopIcon ? 'Stop recording' : 'Start recording (or press space)'}
      title={showStopIcon ? 'Stop recording' : 'Hold space to record'}
    >
      {showStopIcon ? <Square className="w-5 h-5" /> : <Mic className="w-6 h-6" />}
    </button>
  );
};

export default FloatingMic;
