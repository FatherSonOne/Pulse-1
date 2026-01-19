// Vox Audio Visualizer - Premium Audio Visualization Component
// Features: Waveform, Circular, Bars, and Organic blob visualizations

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import './Voxer.css';

// ============================================
// TYPES
// ============================================

export type VisualizerMode = 'waveform' | 'bars' | 'circular' | 'blob';

interface VoxAudioVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  isPlaying?: boolean;
  playbackProgress?: number;
  audioBuffer?: AudioBuffer | null;
  duration?: number;
  mode?: VisualizerMode;
  color?: string;
  progressColor?: string;
  height?: number;
  isDarkMode?: boolean;
  showGlow?: boolean;
  onSeek?: (position: number) => void;
  className?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const getGradientColors = (color: string, isDark: boolean) => {
  // Return gradient array based on primary color
  const baseColor = color || '#6366f1';
  return {
    primary: baseColor,
    secondary: isDark ? '#818cf8' : '#4f46e5',
    glow: `${baseColor}40`,
    background: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
  };
};

// ============================================
// COMPONENT
// ============================================

const VoxAudioVisualizer: React.FC<VoxAudioVisualizerProps> = ({
  analyser,
  isActive,
  isPlaying = false,
  playbackProgress = 0,
  audioBuffer = null,
  duration = 0,
  mode = 'waveform',
  color = '#6366f1',
  progressColor = '#818cf8',
  height = 80,
  isDarkMode = false,
  showGlow = true,
  onSeek,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const smoothedDataRef = useRef<number[]>([]);
  const peaksRef = useRef<number[]>([]);
  const [canvasWidth, setCanvasWidth] = useState(600);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverPosition, setHoverPosition] = useState(0);

  const colors = useMemo(() => getGradientColors(color, isDarkMode), [color, isDarkMode]);

  // Handle responsive width
  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        setCanvasWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Extract peaks from audio buffer
  const extractPeaks = useCallback((buffer: AudioBuffer, numPeaks: number): number[] => {
    const channelData = buffer.getChannelData(0);
    const samplesPerPeak = Math.floor(channelData.length / numPeaks);
    const peaks: number[] = [];

    for (let i = 0; i < numPeaks; i++) {
      const start = i * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, channelData.length);
      let max = 0;

      for (let j = start; j < end; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > max) max = abs;
      }

      peaks.push(max);
    }

    return peaks;
  }, []);

  // Update peaks when audio buffer changes
  useEffect(() => {
    if (audioBuffer) {
      const numBars = mode === 'circular' ? 64 : Math.floor(canvasWidth / 6);
      peaksRef.current = extractPeaks(audioBuffer, numBars);
    }
  }, [audioBuffer, canvasWidth, mode, extractPeaks]);

  // Handle canvas click for seeking
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const position = x / rect.width;
    onSeek(Math.max(0, Math.min(1, position)));
  }, [onSeek]);

  // Handle mouse move for hover preview
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverPosition(x / rect.width);
  }, []);

  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================
  // DRAWING FUNCTIONS
  // ============================================

  const drawWaveform = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    values: number[]
  ) => {
    const barWidth = 4;
    const gap = 3;
    const totalBarWidth = barWidth + gap;
    const numBars = Math.floor(width / totalBarWidth);
    const centerY = height / 2;
    const maxBarHeight = height / 2 - 4;

    // Resample values if needed
    const sampledValues = values.length === numBars ? values :
      Array.from({ length: numBars }, (_, i) => {
        const idx = Math.floor((i / numBars) * values.length);
        return values[idx] || 0;
      });

    for (let i = 0; i < numBars; i++) {
      const x = i * totalBarWidth;
      const value = sampledValues[i] || 0;
      const barHeight = Math.max(3, value * maxBarHeight);
      const barPosition = (i + 0.5) / numBars;
      const isPlayed = barPosition <= playbackProgress;
      const isHovered = isHovering && barPosition <= hoverPosition && !isPlayed;

      // Create gradient for bar
      const gradient = ctx.createLinearGradient(x, centerY - barHeight, x, centerY + barHeight);

      if (isPlayed) {
        gradient.addColorStop(0, progressColor);
        gradient.addColorStop(1, color);
      } else if (isHovered) {
        gradient.addColorStop(0, `${color}99`);
        gradient.addColorStop(1, `${color}66`);
      } else {
        gradient.addColorStop(0, `${color}66`);
        gradient.addColorStop(1, `${color}33`);
      }

      ctx.fillStyle = gradient;

      // Add glow for active bars
      if (isActive && showGlow && value > 0.5) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = colors.glow;
      } else {
        ctx.shadowBlur = 0;
      }

      // Upper bar
      ctx.beginPath();
      ctx.roundRect(x, centerY - barHeight, barWidth, barHeight, 2);
      ctx.fill();

      // Lower bar (mirror)
      ctx.fillStyle = isPlayed
        ? `${progressColor}66`
        : isHovered
          ? `${color}44`
          : `${color}22`;
      ctx.beginPath();
      ctx.roundRect(x, centerY + 2, barWidth, barHeight * 0.6, 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;

    // Draw playhead
    if ((isPlaying || playbackProgress > 0) && playbackProgress < 1) {
      const playheadX = playbackProgress * width;

      // Playhead glow
      const playheadGradient = ctx.createLinearGradient(playheadX - 10, 0, playheadX + 10, 0);
      playheadGradient.addColorStop(0, 'transparent');
      playheadGradient.addColorStop(0.5, `${progressColor}40`);
      playheadGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = playheadGradient;
      ctx.fillRect(playheadX - 10, 0, 20, height);

      // Playhead line
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Time indicator
      if (duration > 0) {
        const currentTime = playbackProgress * duration;
        ctx.font = '11px "Inter", system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(formatTime(currentTime), playheadX + 6, 14);
      }
    }

    // Hover time indicator
    if (isHovering && duration > 0) {
      const hoverX = hoverPosition * width;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      const hoverTime = hoverPosition * duration;
      ctx.font = '10px "Inter", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const textX = hoverX + 6 > width - 35 ? hoverX - 35 : hoverX + 6;
      ctx.fillText(formatTime(hoverTime), textX, height - 6);
    }
  }, [color, progressColor, playbackProgress, isPlaying, isHovering, hoverPosition, duration, isActive, showGlow, colors.glow]);

  const drawBars = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    values: number[]
  ) => {
    const barWidth = 6;
    const gap = 4;
    const totalBarWidth = barWidth + gap;
    const numBars = Math.floor(width / totalBarWidth);
    const maxBarHeight = height - 8;

    const sampledValues = values.length === numBars ? values :
      Array.from({ length: numBars }, (_, i) => {
        const idx = Math.floor((i / numBars) * values.length);
        return values[idx] || 0;
      });

    for (let i = 0; i < numBars; i++) {
      const x = i * totalBarWidth + gap / 2;
      const value = sampledValues[i] || 0;
      const barHeight = Math.max(4, value * maxBarHeight);
      const barPosition = (i + 0.5) / numBars;
      const isPlayed = barPosition <= playbackProgress;

      // Create vertical gradient
      const gradient = ctx.createLinearGradient(x, height - barHeight - 4, x, height - 4);

      if (isPlayed) {
        gradient.addColorStop(0, progressColor);
        gradient.addColorStop(1, color);
      } else {
        gradient.addColorStop(0, `${color}88`);
        gradient.addColorStop(1, `${color}44`);
      }

      ctx.fillStyle = gradient;

      if (isActive && showGlow && value > 0.5) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = colors.glow;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.roundRect(x, height - barHeight - 4, barWidth, barHeight, 3);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }, [color, progressColor, playbackProgress, isActive, showGlow, colors.glow]);

  const drawCircular = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    values: number[]
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;
    const innerRadius = radius * 0.4;
    const numBars = 64;

    const sampledValues = values.length === numBars ? values :
      Array.from({ length: numBars }, (_, i) => {
        const idx = Math.floor((i / numBars) * values.length);
        return values[idx] || 0;
      });

    // Draw background circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw inner glow when active
    if (isActive && showGlow) {
      const glowGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      glowGradient.addColorStop(0, colors.glow);
      glowGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw bars
    for (let i = 0; i < numBars; i++) {
      const angle = (i / numBars) * Math.PI * 2 - Math.PI / 2;
      const value = sampledValues[i] || 0;
      const barLength = value * (radius - innerRadius - 10) + 5;
      const barPosition = i / numBars;
      const isPlayed = barPosition <= playbackProgress;

      const x1 = centerX + Math.cos(angle) * innerRadius;
      const y1 = centerY + Math.sin(angle) * innerRadius;
      const x2 = centerX + Math.cos(angle) * (innerRadius + barLength);
      const y2 = centerY + Math.sin(angle) * (innerRadius + barLength);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isPlayed ? progressColor : `${color}88`;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      if (isActive && showGlow && value > 0.6) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = colors.glow;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // Draw center circle with icon area
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius - 5, 0, Math.PI * 2);
    ctx.fillStyle = isDarkMode ? 'rgba(20,20,30,0.9)' : 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [color, progressColor, playbackProgress, isDarkMode, isActive, showGlow, colors.glow]);

  const drawBlob = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    values: number[],
    time: number
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) / 3;
    const numPoints = 32;

    // Calculate average amplitude
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length || 0;

    // Draw glow
    if (showGlow) {
      const glowGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, baseRadius * (1.5 + avgValue * 0.5)
      );
      glowGradient.addColorStop(0, `${color}40`);
      glowGradient.addColorStop(0.5, `${color}20`);
      glowGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw blob
    ctx.beginPath();
    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const valueIdx = Math.floor((i / numPoints) * values.length) % values.length;
      const value = values[valueIdx] || 0;

      // Organic movement with multiple frequencies
      const wave1 = Math.sin(angle * 3 + time * 2) * 0.1;
      const wave2 = Math.sin(angle * 5 + time * 3) * 0.05;
      const wave3 = Math.cos(angle * 2 + time) * 0.08;

      const radius = baseRadius * (1 + value * 0.4 + wave1 + wave2 + wave3);

      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        // Use bezier curves for smooth blob
        const prevAngle = ((i - 1) / numPoints) * Math.PI * 2;
        const prevValueIdx = Math.floor(((i - 1) / numPoints) * values.length) % values.length;
        const prevValue = values[prevValueIdx] || 0;
        const prevRadius = baseRadius * (1 + prevValue * 0.4 +
          Math.sin(prevAngle * 3 + time * 2) * 0.1 +
          Math.sin(prevAngle * 5 + time * 3) * 0.05 +
          Math.cos(prevAngle * 2 + time) * 0.08
        );

        const cpRadius = (radius + prevRadius) / 2;
        const cpAngle = (angle + prevAngle) / 2;
        const cpX = centerX + Math.cos(cpAngle) * cpRadius * 1.02;
        const cpY = centerY + Math.sin(cpAngle) * cpRadius * 1.02;

        ctx.quadraticCurveTo(cpX, cpY, x, y);
      }
    }
    ctx.closePath();

    // Gradient fill
    const gradient = ctx.createRadialGradient(
      centerX - baseRadius * 0.3, centerY - baseRadius * 0.3, 0,
      centerX, centerY, baseRadius * 1.5
    );
    gradient.addColorStop(0, progressColor);
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, `${color}88`);

    ctx.fillStyle = gradient;
    ctx.fill();

    // Inner highlight
    ctx.beginPath();
    ctx.arc(centerX - baseRadius * 0.2, centerY - baseRadius * 0.2, baseRadius * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();
  }, [color, progressColor, showGlow]);

  // ============================================
  // MAIN DRAWING EFFECT
  // ============================================

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dataArray: Uint8Array;
    const numBars = mode === 'circular' ? 64 : Math.floor(canvasWidth / 6);

    if (analyser) {
      analyser.fftSize = 256;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    } else {
      dataArray = new Uint8Array(numBars);
    }

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Get values
      let values: number[] = [];

      if (isActive && analyser) {
        // Live recording mode
        analyser.getByteFrequencyData(dataArray);

        const step = Math.max(1, Math.floor(dataArray.length / numBars));
        for (let i = 0; i < numBars; i++) {
          const idx = Math.min(i * step, dataArray.length - 1);
          const normalized = (dataArray[idx] / 255);
          const boosted = Math.pow(normalized, 0.6) * 1.3;
          values.push(Math.min(boosted, 1));
        }

        // Smooth with previous values
        if (smoothedDataRef.current.length === numBars) {
          values = values.map((v, i) =>
            lerp(smoothedDataRef.current[i], v, 0.7)
          );
        }
        smoothedDataRef.current = values;
      } else if (peaksRef.current.length > 0) {
        // Static waveform from audio buffer
        values = peaksRef.current;
      } else {
        // Idle animation
        const time = Date.now() / 1000;
        for (let i = 0; i < numBars; i++) {
          const x = i / numBars;
          const wave1 = Math.sin(x * Math.PI * 4 + time * 2) * 0.12;
          const wave2 = Math.sin(x * Math.PI * 8 + time * 3) * 0.06;
          const envelope = Math.sin(x * Math.PI) * 0.5;
          values.push(Math.abs(wave1 + wave2) * envelope + 0.03);
        }
      }

      // Draw based on mode
      const time = Date.now() / 1000;
      switch (mode) {
        case 'bars':
          drawBars(ctx, canvas.width, canvas.height, values);
          break;
        case 'circular':
          drawCircular(ctx, canvas.width, canvas.height, values);
          break;
        case 'blob':
          drawBlob(ctx, canvas.width, canvas.height, values, time);
          break;
        case 'waveform':
        default:
          drawWaveform(ctx, canvas.width, canvas.height, values);
          break;
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    analyser, isActive, mode, canvasWidth, height, drawWaveform, drawBars, drawCircular, drawBlob
  ]);

  return (
    <div
      ref={containerRef}
      className={`vox-visualizer-container ${isActive ? 'recording' : ''} ${className}`}
      style={{ height }}
    >
      {showGlow && <div className="vox-visualizer-glow" style={{
        background: `radial-gradient(circle at 50% 50%, ${colors.glow} 0%, transparent 70%)`
      }} />}
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={height}
        className={`w-full h-full ${onSeek ? 'cursor-pointer' : ''}`}
        onClick={handleCanvasClick}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onMouseMove={handleMouseMove}
        style={{ width: '100%', height }}
      />
    </div>
  );
};

export default VoxAudioVisualizer;
