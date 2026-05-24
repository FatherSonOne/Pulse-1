// Record affordance — floats over the Relay pane, swaps icon + color while
// recording so the user always sees one button that says "press to toggle".
//
// Idle: rose CTA with halo ring animation (the "alive shadow" per DESIGN.md).
// Recording: red surface with stop icon, no halo (no more "press me" telegraph).

import React from 'react';
import { Mic, Square } from 'lucide-react';

import { useRelayStudio } from './RelayStudioContext';

import './floating-mic.css';

export const FloatingMic: React.FC = () => {
  const { isRecording, toggleRecording } = useRelayStudio();

  return (
    <button
      type="button"
      onClick={toggleRecording}
      className={`pulse-floating-mic ${isRecording ? 'pulse-floating-mic--recording' : 'pulse-floating-mic--idle'}`}
      aria-label={isRecording ? 'Stop recording' : 'Start recording (or press space)'}
      title={isRecording ? 'Stop recording' : 'Hold space to record'}
    >
      {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-6 h-6" />}
    </button>
  );
};

export default FloatingMic;
