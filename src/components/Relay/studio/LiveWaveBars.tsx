// LiveWaveBars — a real-time, mic-reactive bar waveform shared by every Relay
// recording surface (the StudioFooter RECORDING bar + the RelayComposer modal).
//
// Reads the live capture AnalyserNode each animation frame and writes bar
// heights straight to the DOM (no React re-render at 60fps). A per-bar
// attack/release envelope gives natural VU-style motion instead of jitter. When
// there's no analyser yet (mic still warming up) the bars rest at a quiet
// baseline. The host supplies the flex container (height + align-items:flex-end).

import React, { useEffect, useRef } from 'react';

export interface LiveWaveBarsProps {
  /** Live capture analyser; null until the mic is acquired. */
  analyser: AnalyserNode | null;
  barCount?: number;
  /** Bar colour (CSS). Footer uses red; the modal uses brand rose. */
  color?: string;
  /** Resting height (%) when idle / warming up. */
  baseline?: number;
}

export const LiveWaveBars: React.FC<LiveWaveBarsProps> = ({
  analyser,
  barCount = 56,
  color = '#ef4444',
  baseline = 10,
}) => {
  const barsRef = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    if (!analyser) {
      barsRef.current.forEach((el) => { if (el) el.style.height = `${baseline}%`; });
      return;
    }
    const bins = analyser.frequencyBinCount;
    const data = new Uint8Array(bins);
    // Voice energy concentrates in a handful of LOW bins, so a linear bar→bin
    // map leaves the right (high-freq) bars dead. Instead: (1) drop the deadest
    // top of the spectrum, (2) spread the low/mid band across most bars via a
    // power curve, and (3) lift the high end to offset the natural spectral
    // rolloff — so nearly all bars react to the voice.
    const usable = Math.max(1, Math.floor(bins * 0.6));
    const smoothed = new Float32Array(barCount);
    let raf = 0;

    const draw = () => {
      analyser.getByteFrequencyData(data);
      const n = barsRef.current.length;
      for (let i = 0; i < n; i++) {
        const frac = n > 1 ? i / (n - 1) : 0;               // 0..1 across the bars
        const bin = Math.min(usable - 1, Math.floor(Math.pow(frac, 1.7) * usable));
        const gain = 1 + frac * 0.9;                        // compensate HF rolloff
        const target = Math.min(1, (data[bin] / 255) * gain);
        // Attack fast, release slower for a natural VU feel.
        const k = target > smoothed[i] ? 0.6 : 0.25;
        smoothed[i] += (target - smoothed[i]) * k;
        const el = barsRef.current[i];
        if (el) el.style.height = `${Math.max(8, Math.min(100, smoothed[i] * 135))}%`;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser, barCount, baseline]);

  return (
    <>
      {Array.from({ length: barCount }).map((_, i) => (
        <i
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          style={{ width: 2, height: `${baseline}%`, background: color, borderRadius: 1 }}
        />
      ))}
    </>
  );
};

export default LiveWaveBars;
