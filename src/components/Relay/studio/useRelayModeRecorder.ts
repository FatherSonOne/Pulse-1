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

export interface RelayModeRecorderApi {
  /** Begin capture (the mode's own getUserMedia + MediaRecorder). */
  start: () => void | Promise<void>;
  /** Stop capture → hand off to the mode's in-pane preview. */
  stop: () => void;
  /** Discard the in-flight recording. */
  cancel: () => void;
  /** True while the mode is actively capturing. Mirrored to the footer. */
  recording: boolean;
}

export function useRelayModeRecorder({ start, stop, cancel, recording }: RelayModeRecorderApi): void {
  const { registerRecorder, notifyRecording } = useRelayStudio();

  // Latest handlers in a ref so the registered controller stays stable.
  const handlersRef = useRef({ start, stop, cancel });
  handlersRef.current = { start, stop, cancel };

  // Register once; unregister on unmount. registerRecorder is a []-deps
  // useCallback, so this effect does not re-run on context value changes.
  useEffect(
    () =>
      registerRecorder({
        start: () => {
          void handlersRef.current.start();
        },
        stop: () => handlersRef.current.stop(),
        cancel: () => handlersRef.current.cancel(),
      }),
    [registerRecorder],
  );

  // Mirror the live capture flag — fires only on real recording transitions.
  useEffect(() => {
    notifyRecording(recording);
  }, [notifyRecording, recording]);
}

export default useRelayModeRecorder;
