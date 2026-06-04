/**
 * useMicLevel — a 0..1 microphone loudness level for voice visualizers.
 *
 * Opens a getUserMedia stream + AnalyserNode while `active`, samples the
 * waveform RMS each animation frame, eases it, and returns it. Returns 0 and
 * fully tears down (tracks stopped, context closed) when inactive or denied.
 *
 * It only TAPS the mic for visualization — it does not transcribe — so it
 * composes with the Web Speech API path in useVoiceToText (which captures
 * audio internally, not via getUserMedia). If the mic is denied, the level
 * just stays at 0 and the caller's waveform degrades to its idle motion.
 */

import { useEffect, useRef, useState } from 'react';

export function useMicLevel(active: boolean): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let analyser: AnalyserNode | null = null;
    const data = new Uint8Array(2048);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        ctxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        let eased = 0;
        const tick = () => {
          if (cancelled || !analyser) return;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);   // ~0..1, small for speech
          const norm = Math.min(1, rms * 3.2);         // boost into a usable range
          eased += (norm - eased) * 0.3;               // smooth
          setLevel(eased);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // mic denied / unavailable — leave level at 0; the waveform stays calm
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
      if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null; }
      setLevel(0);
    };
  }, [active]);

  return level;
}

export default useMicLevel;
