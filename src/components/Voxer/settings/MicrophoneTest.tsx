// MicrophoneTest Component - Real-time microphone testing with visualization
// "Control Room" aesthetic - professional broadcast studio feel

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, Play, Square } from 'lucide-react';

interface MicrophoneTestProps {
  deviceId?: string;
  isDarkMode?: boolean;
  accentColor?: string;
}

export const MicrophoneTest: React.FC<MicrophoneTestProps> = ({
  deviceId,
  isDarkMode = false,
  accentColor = '#8B5CF6',
}) => {
  const [isActive, setIsActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const peakDecayRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const startTest = useCallback(async () => {
    setError(null);
    cleanup();

    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsActive(true);

      // Start visualization loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate RMS level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const level = Math.min(rms / 128, 1); // Normalize to 0-1

        setAudioLevel(level);

        // Peak hold with decay
        if (level > peakDecayRef.current) {
          peakDecayRef.current = level;
          setPeakLevel(level);
        } else {
          peakDecayRef.current *= 0.995; // Slow decay
          setPeakLevel(peakDecayRef.current);
        }

        animationRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err: any) {
      console.error('Mic test error:', err);
      setError(err.name === 'NotAllowedError'
        ? 'Permission denied'
        : 'Failed to access microphone');
      setIsActive(false);
    }
  }, [deviceId, cleanup]);

  const stopTest = useCallback(() => {
    cleanup();
    setIsActive(false);
    setAudioLevel(0);
    setPeakLevel(0);
    peakDecayRef.current = 0;
  }, [cleanup]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Stop and restart if device changes while active
  useEffect(() => {
    if (isActive && deviceId) {
      stopTest();
      setTimeout(() => startTest(), 100);
    }
  }, [deviceId]);

  // Generate meter bars
  const bars = Array.from({ length: 20 }, (_, i) => {
    const threshold = (i + 1) / 20;
    const isLit = audioLevel >= threshold;
    const isPeak = peakLevel >= threshold && peakLevel < threshold + 0.05;

    let barColor = accentColor;
    if (i >= 16) barColor = '#EF4444'; // Red zone
    else if (i >= 12) barColor = '#F59E0B'; // Yellow zone

    return { threshold, isLit, isPeak, barColor };
  });

  const tc = {
    bg: isDarkMode ? 'bg-gray-900/80' : 'bg-white/90',
    border: isDarkMode ? 'border-gray-700/50' : 'border-gray-200/60',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textMuted: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    meterBg: isDarkMode ? 'bg-gray-800' : 'bg-gray-100',
  };

  return (
    <div className={`rounded-xl border ${tc.border} ${tc.bg} backdrop-blur-sm overflow-hidden`}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          background: isDarkMode
            ? `linear-gradient(135deg, ${accentColor}15 0%, transparent 50%)`
            : `linear-gradient(135deg, ${accentColor}10 0%, transparent 50%)`
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${accentColor}20` }}
          >
            <Mic className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <span className={`text-sm font-medium ${tc.text}`}>Microphone Test</span>
        </div>

        <button
          onClick={isActive ? stopTest : startTest}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: isActive
              ? 'rgba(239, 68, 68, 0.15)'
              : `${accentColor}15`,
            color: isActive ? '#EF4444' : accentColor,
          }}
        >
          {isActive ? (
            <>
              <Square className="w-3.5 h-3.5" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Test
            </>
          )}
        </button>
      </div>

      {/* Meter Display */}
      <div className="p-4">
        {error ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <MicOff className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-500">{error}</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* VU Meter Bars */}
            <div className={`flex items-end gap-1 h-12 p-2 rounded-lg ${tc.meterBg}`}>
              {bars.map((bar, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm transition-all duration-75"
                  style={{
                    height: '100%',
                    background: bar.isLit
                      ? bar.barColor
                      : isDarkMode
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(0,0,0,0.05)',
                    boxShadow: bar.isLit
                      ? `0 0 8px ${bar.barColor}50`
                      : 'none',
                    opacity: bar.isPeak ? 1 : bar.isLit ? 0.9 : 0.4,
                  }}
                />
              ))}
            </div>

            {/* Level Labels */}
            <div className="flex justify-between px-1">
              <span className={`text-[10px] uppercase tracking-wider ${tc.textMuted}`}>
                -∞
              </span>
              <span className={`text-[10px] uppercase tracking-wider ${tc.textMuted}`}>
                -20dB
              </span>
              <span className={`text-[10px] uppercase tracking-wider ${tc.textMuted}`}>
                -10dB
              </span>
              <span className="text-[10px] uppercase tracking-wider text-amber-500">
                -6dB
              </span>
              <span className="text-[10px] uppercase tracking-wider text-red-500">
                0dB
              </span>
            </div>

            {/* Status */}
            <div className="flex items-center justify-center gap-2 pt-1">
              {isActive ? (
                <>
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: accentColor }}
                  />
                  <span className={`text-xs ${tc.textMuted}`}>
                    Listening... Speak to test your microphone
                  </span>
                </>
              ) : (
                <span className={`text-xs ${tc.textMuted}`}>
                  Click Test to check your microphone
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MicrophoneTest;
