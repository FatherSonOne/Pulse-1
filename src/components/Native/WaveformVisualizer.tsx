import { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
  waveformData: Float32Array | null;
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
  className?: string;
}

/**
 * WaveformVisualizer Component
 * Real-time waveform visualization for voice recording
 */
export function WaveformVisualizer({
  waveformData,
  width = 300,
  height = 100,
  color = '#10b981',
  backgroundColor = 'transparent',
  className = ''
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw waveform
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / waveformData.length;
    let x = 0;

    for (let i = 0; i < waveformData.length; i++) {
      const v = waveformData[i];
      const y = ((v + 1) / 2) * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }, [waveformData, width, height, color, backgroundColor]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
    />
  );
}

/**
 * Frequency Visualizer Component
 * Bar-style frequency visualization
 */
export function FrequencyVisualizer({
  frequencyData,
  width = 300,
  height = 100,
  barColor = '#10b981',
  barGap = 2,
  className = ''
}: {
  frequencyData: Uint8Array | null;
  width?: number;
  height?: number;
  barColor?: string;
  barGap?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frequencyData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const barWidth = (width / frequencyData.length) - barGap;

    for (let i = 0; i < frequencyData.length; i++) {
      const barHeight = (frequencyData[i] / 255) * height;
      const x = i * (barWidth + barGap);
      const y = height - barHeight;

      // Gradient color based on height
      const alpha = 0.3 + (frequencyData[i] / 255) * 0.7;
      ctx.fillStyle = `${barColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }, [frequencyData, width, height, barColor, barGap]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
    />
  );
}
