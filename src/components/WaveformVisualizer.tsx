import React, { useEffect, useRef, useCallback, useState } from 'react';

interface WaveformVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  isPlaying?: boolean;
  playbackProgress?: number;  // 0-1 for playback position
  duration?: number;
  audioBuffer?: AudioBuffer | null;  // Pre-recorded audio for static waveform
  color?: string;
  progressColor?: string;
  backgroundColor?: string;
  width?: number | 'full';  // 'full' for responsive full-width
  height?: number;
  barWidth?: number;
  barGap?: number;
  showMirror?: boolean;  // Mirror waveform like SoundCloud
  onSeek?: (position: number) => void;  // Callback when user clicks to seek
  sensitivity?: number;  // Multiplier for waveform amplitude (default 1)
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  analyser,
  isActive,
  isPlaying = false,
  playbackProgress = 0,
  duration = 0,
  audioBuffer = null,
  color = '#10b981',
  progressColor = '#34d399',
  backgroundColor = 'transparent',
  width = 600,
  height = 80,
  barWidth = 3,
  barGap = 1,
  showMirror = true,
  onSeek,
  sensitivity = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const waveformDataRef = useRef<number[]>([]);
  const peaksRef = useRef<number[]>([]);
  const animationRef = useRef<number>();
  const [isHovering, setIsHovering] = useState(false);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(typeof width === 'number' ? width : 600);

  // Handle responsive width
  useEffect(() => {
    if (width !== 'full' || !containerRef.current) {
      if (typeof width === 'number') {
        setCanvasWidth(width);
      }
      return;
    }

    const updateWidth = () => {
      if (containerRef.current) {
        setCanvasWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [width]);

  // Calculate number of bars based on canvas width
  const totalBarWidth = barWidth + barGap;
  const numBars = Math.floor(canvasWidth / totalBarWidth);

  // Extract peaks from audio buffer for static waveform display
  const extractPeaks = useCallback((buffer: AudioBuffer, numPeaks: number): number[] => {
    const channelData = buffer.getChannelData(0);
    const samplesPerPeak = Math.floor(channelData.length / numPeaks);
    const peaks: number[] = [];

    for (let i = 0; i < numPeaks; i++) {
      const start = i * samplesPerPeak;
      const end = start + samplesPerPeak;
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
      peaksRef.current = extractPeaks(audioBuffer, numBars);
    }
  }, [audioBuffer, numBars, extractPeaks]);

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

  // Main drawing function
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dataArray: Uint8Array;

    if (analyser) {
      analyser.fftSize = 256;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    } else {
      dataArray = new Uint8Array(numBars);
    }

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      // Clear canvas
      if (backgroundColor === 'transparent') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const centerY = showMirror ? canvas.height / 2 : canvas.height;
      const maxBarHeight = showMirror ? canvas.height / 2 - 2 : canvas.height - 4;

      // Get waveform data based on mode
      let values: number[] = [];

      if (isActive && analyser) {
        // Live recording mode - use frequency data for more visible movement
        analyser.getByteFrequencyData(dataArray);

        // Sample data array to get desired number of bars
        const step = Math.max(1, Math.floor(dataArray.length / numBars));
        for (let i = 0; i < numBars; i++) {
          const idx = Math.min(i * step, dataArray.length - 1);
          // Normalize from 0-255 and apply sensitivity multiplier
          // Use frequency data which has more dynamic range
          const normalized = (dataArray[idx] / 255) * sensitivity;
          // Boost quieter sounds with a power curve for more visible movement
          const boosted = Math.pow(normalized, 0.6) * 1.2;
          values.push(Math.min(boosted, 1));
        }

        // Smooth with previous values for flowing effect (less smoothing for more responsiveness)
        if (waveformDataRef.current.length === numBars) {
          values = values.map((v, i) =>
            waveformDataRef.current[i] * 0.2 + v * 0.8
          );
        }
        waveformDataRef.current = values;
      } else if (peaksRef.current.length > 0) {
        // Static waveform from audio buffer
        values = peaksRef.current;
      } else {
        // Idle animation - gentle wave
        const time = Date.now() / 1000;
        for (let i = 0; i < numBars; i++) {
          const x = i / numBars;
          const wave1 = Math.sin(x * Math.PI * 4 + time * 2) * 0.15;
          const wave2 = Math.sin(x * Math.PI * 8 + time * 3) * 0.08;
          const envelope = Math.sin(x * Math.PI) * 0.5; // Fade at edges
          values.push(Math.abs(wave1 + wave2) * envelope + 0.05);
        }
      }

      // Draw bars
      for (let i = 0; i < numBars; i++) {
        const x = i * totalBarWidth;
        const barHeight = Math.max(2, values[i] * maxBarHeight);

        // Determine if this bar is before or after playback position
        const barPosition = (i + 0.5) / numBars;
        const isPlayed = barPosition <= playbackProgress;
        const isHovered = isHovering && barPosition <= hoverPosition && !isPlayed;

        // Set color based on state
        if (isPlayed) {
          ctx.fillStyle = progressColor;
        } else if (isHovered) {
          ctx.fillStyle = `${color}99`;
        } else {
          ctx.fillStyle = `${color}66`;
        }

        // Add glow effect for active recording
        if (isActive && values[i] > 0.5) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = color;
        } else {
          ctx.shadowBlur = 0;
        }

        if (showMirror) {
          // Draw upper half
          const y = centerY - barHeight;
          roundRect(ctx, x, y, barWidth, barHeight, 1);

          // Draw lower half (mirror)
          ctx.fillStyle = isPlayed
            ? `${progressColor}88`
            : isHovered
              ? `${color}55`
              : `${color}44`;
          roundRect(ctx, x, centerY + 1, barWidth, barHeight * 0.7, 1);
        } else {
          // Single direction from bottom
          const y = canvas.height - barHeight - 2;
          roundRect(ctx, x, y, barWidth, barHeight, 1);
        }
      }

      // Draw playhead line
      if ((isPlaying || playbackProgress > 0) && playbackProgress < 1) {
        const playheadX = playbackProgress * canvas.width;
        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, canvas.height);
        ctx.stroke();

        // Draw time indicator
        if (duration > 0) {
          const currentTime = playbackProgress * duration;
          const timeText = formatTime(currentTime);
          ctx.font = '10px Inter, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(timeText, playheadX + 4, 12);
        }
      }

      // Draw hover indicator
      if (isHovering && duration > 0) {
        const hoverX = hoverPosition * canvas.width;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(hoverX, 0);
        ctx.lineTo(hoverX, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Show hover time
        const hoverTime = hoverPosition * duration;
        const hoverTimeText = formatTime(hoverTime);
        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        const textX = hoverX + 4 > canvas.width - 30 ? hoverX - 34 : hoverX + 4;
        ctx.fillText(hoverTimeText, textX, canvas.height - 4);
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    analyser, isActive, isPlaying, playbackProgress, duration,
    color, progressColor, backgroundColor, numBars, totalBarWidth,
    showMirror, isHovering, hoverPosition, barWidth, canvasWidth, sensitivity
  ]);

  // Helper function to draw rounded rectangle
  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();
  };

  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // If responsive width, wrap in container
  if (width === 'full') {
    return (
      <div ref={containerRef} className="w-full">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={height}
          className={`rounded-lg ${onSeek ? 'cursor-pointer' : ''}`}
          onClick={handleCanvasClick}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onMouseMove={handleMouseMove}
          style={{ width: '100%', height }}
        />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={height}
      className={`rounded-lg ${onSeek ? 'cursor-pointer' : ''}`}
      onClick={handleCanvasClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={handleMouseMove}
      style={{ width: canvasWidth, height }}
    />
  );
};

export default WaveformVisualizer;
