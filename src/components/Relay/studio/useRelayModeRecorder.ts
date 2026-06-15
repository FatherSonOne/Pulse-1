// useRelayModeRecorder — wire a mode's OWN capture pipeline into the studio
// shell (Tier 2 "unify trigger" model).
//
// The mode keeps full ownership of recording: getUserMedia, codec choice,
// audio enhancement, transcription, and the in-pane preview → send step all
// stay where they are. This hook only hands the shell three levers — start /
// stop / cancel — and mirrors the mode's live recording flag back so the
// FloatingMic icon + the StudioFooter RECORDING surface reflect the truth.
//
// Why the ref dance: the registered controller is captured ONCE (deps are the
// stable context callbacks only) so it survives the context value churning on
// every playback tick. The controller delegates through a ref that always
// holds the latest start/stop/cancel, so re-registration never happens and an
// in-flight recording is never reset by an unrelated re-render.

import { useEffect, useRef } from 'react';
import { useRelayStudio } from './RelayStudioContext';
import { toastMicError } from '../../../utils/micErrors';

export interface RelayModeRecorderApi {
  /** Begin capture (the mode's own getUserMedia + MediaRecorder). */
  start: () => void | Promise<void>;
  /** Stop capture → hand off to the mode's in-pane preview. */
  stop: () => void;
  /** Discard the in-flight recording. */
  cancel: () => void;
  /** True while the mode is actively capturing. Mirrored to the footer. */
  recording: boolean;
  /** When false, the mode registers no recorder (the FloatingMic hides, the
   *  footer stays a pure transport). Use for modes that can only record once a
   *  target exists — a selected channel, broadcast, or contact. Default true. */
  enabled?: boolean;
}

export function useRelayModeRecorder({ start, stop, cancel, recording, enabled = true }: RelayModeRecorderApi): void {
  const { registerRecorder, notifyRecording } = useRelayStudio();

  // Latest handlers in a ref so the registered controller stays stable.
  const handlersRef = useRef({ start, stop, cancel });
  handlersRef.current = { start, stop, cancel };

  // Register while enabled; unregister on disable/unmount. registerRecorder is
  // a []-deps useCallback, so this effect only re-runs when `enabled` flips —
  // never on the context value churning during playback.
  useEffect(() => {
    if (!enabled) return;
    return registerRecorder({
      start: () => {
        // Surface a mic-acquisition failure (denied / no device / in use)
        // instead of swallowing the rejection. Modes that handle it internally
        // (ClassicMode) resolve here, so this never double-reports for them.
        Promise.resolve(handlersRef.current.start()).catch(toastMicError);
      },
      stop: () => handlersRef.current.stop(),
      cancel: () => handlersRef.current.cancel(),
    });
  }, [registerRecorder, enabled]);

  // Mirror the live capture flag — fires only on real recording transitions.
  useEffect(() => {
    notifyRecording(enabled && recording);
  }, [notifyRecording, enabled, recording]);
}

export default useRelayModeRecorder;
