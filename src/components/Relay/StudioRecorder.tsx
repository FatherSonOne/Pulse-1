// StudioRecorder — THE one canonical Relay recorder (app-dev Phase 2a).
//
// Relay's capture layer was fragmented: ClassicMode owned a bespoke
// MediaRecorder (+ destructive enhancement), RelayComposer drove useVoxRecording,
// the Dashboard strip had a third. Audio-quality fixes and the durable-outbox
// wiring kept landing on the wrong one. This component is the convergence point:
//
//   • ONE capture core — the proven, leak-safe useVoxRecording (Opus/preset
//     codec, closes every AudioContext, publishes the presence flag).
//   • Settings-aware — useVoxCaptureSettings feeds the real Audio I/O choices
//     (device, quality preset, EC/NS/AGC) that the old recorders ignored.
//   • Studio-driven — registers through useRelayModeRecorder, so the shell's
//     FloatingMic + SPACE + StudioFooter RECORDING surface drive it (no per-mode
//     record button). Stop → this in-pane preview → send.
//   • Sends through the service chokepoint uploadAndSendQuickVox — the single
//     place Phase 2b makes durable, so every surface inherits durability at once.
//
// Phase 2a wires it into Direct/ClassicMode ONLY, behind `relayStudioRecorder`
// (default OFF). The recipient is the open Direct thread's contact, so no picker
// is needed yet — the picker-bearing entry points (FloatingMic/SPACE/palette/
// Dashboard) migrate in Phase 2c. While OFF, ClassicMode's proven recorder is
// untouched and this renders nothing.

import React, { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { useVoxCaptureSettings } from '../../hooks/useVoxCaptureSettings';
import { useRelayModeRecorder } from './studio/useRelayModeRecorder';
import RecordingPreview from './RecordingPreview';
import { voxModeService } from '../../services/relay/voxModeService';
import { sendQuickVoxDurable } from '../../services/relay/relayOutboxProcessor';

// 1:1 voice messages stay short — mirror the RelayComposer ceiling so behaviour
// is identical across the surfaces we're consolidating.
const MAX_DURATION_SEC = 180;

export interface StudioRecorderProps {
  /** When false, registers no recorder and renders nothing — the flag-OFF /
   *  no-recipient case. Hooks still run (rules of hooks); registration is gated. */
  enabled: boolean;
  /** Send target — the open Direct thread's Pulse user id. Null disables send. */
  recipientId: string | null | undefined;
  isDarkMode?: boolean;
  /** Fired after a confirmed successful send (e.g. to nudge a thread refresh). */
  onSent?: () => void;
  /** When true, send through the durable outbox (offline-safe, survives refresh);
   *  the host thread paints the bubble from outbox events. When false, send
   *  directly and refresh via onSent. Mirrors the relayDurableOutbox flag. */
  durable?: boolean;
}

export const StudioRecorder: React.FC<StudioRecorderProps> = ({
  enabled,
  recipientId,
  isDarkMode = false,
  onSent,
  durable = false,
}) => {
  const capture = useVoxCaptureSettings();

  const rec = useVoxRecording({
    qualityPreset: capture.qualityPreset,
    deviceId: capture.deviceId,
    customAudioConstraints: capture.customAudioConstraints,
    maxDuration: MAX_DURATION_SEC,
  });

  // Bridge capture into the studio shell. Only registers while enabled AND a
  // recipient exists (mirrors ClassicMode's own `enabled: !!activeContactId`),
  // so toggleRecording drives exactly one recorder at a time.
  useRelayModeRecorder({
    start: rec.startRecording,
    stop: rec.stopRecording,
    cancel: rec.cancelRecording,
    // Treat 'starting' as recording for the shell so the footer RECORDING
    // surface appears the instant you tap, not after the ~3s mic warm-up.
    recording: rec.state === 'recording' || rec.state === 'starting',
    enabled: enabled && !!recipientId,
  });

  const handleSend = useCallback(async () => {
    if (!rec.recordingData || !recipientId) return;
    const spentUrl = rec.recordingData.url;
    try {
      if (durable) {
        // Durable path: persist to the outbox and return immediately. The host
        // thread paints an optimistic 'sending' bubble from the 'enqueued' event
        // and the processor delivers with retry/backoff — offline-safe, survives
        // a refresh. Only 'error' (no session to scope the entry) is a dead end.
        const result = await sendQuickVoxDurable({
          recipientId,
          blob: rec.recordingData.blob,
          duration: rec.recordingData.duration,
        });
        if (result.status === 'error') {
          toast.error('Could not send. Try again.');
          return;
        }
        rec.sendRecording(); // state → idle; hides the preview (bubble is in-thread)
        // The outbox bubble owns the blob via its own object URL, so release ours.
        try { URL.revokeObjectURL(spentUrl); } catch { /* already revoked */ }
        return;
      }

      // Direct path (durability off): upload + send now; refresh the thread on
      // success so the sent message appears.
      const result = await voxModeService.uploadAndSendQuickVox(
        recipientId,
        rec.recordingData.blob,
        rec.recordingData.duration,
      );
      if (!result) {
        toast.error('Could not send. Try again.');
        return;
      }
      toast.success('Sent');
      rec.sendRecording();
      onSent?.();
      try { URL.revokeObjectURL(spentUrl); } catch { /* already revoked */ }
    } catch (err) {
      console.error('StudioRecorder.handleSend', err);
      toast.error('Could not send. Try again.');
    }
  }, [rec, recipientId, onSent, durable]);

  if (!enabled) return null;
  if (rec.state !== 'preview' || !rec.recordingData) return null;

  return (
    <div className="classic-preview-overlay">
      <div className="classic-preview-card">
        <RecordingPreview
          recordingData={rec.recordingData}
          onSend={handleSend}
          onCancel={rec.cancelRecording}
          // Studio-driven capture has no in-pane record button, so "re-record"
          // discards back to idle; the user re-triggers via the FloatingMic /
          // SPACE. (Phase 2c gives the studio surface an explicit re-arm.)
          onRetry={rec.cancelRecording}
          isAnalyzing={false}
          showAnalysis={false}
          isDarkMode={isDarkMode}
        />
      </div>
    </div>
  );
};

export default StudioRecorder;
