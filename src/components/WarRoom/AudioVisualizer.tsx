import React, { useState, useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  type: 'listening' | 'thinking' | 'speaking' | 'idle';
  isActive: boolean;
  audioData?: number[];
  color?: string;
  style?: 'waveform' | 'orb' | 'particles' | 'spectral';
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  type,
  isActive,
  audioData = [],
  color = '#f43f5e',
  style = 'waveform'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      if (style === 'waveform') {
        drawWaveform(ctx, width, height, audioData, color, type);
      } else if (style === 'orb') {
        drawOrb(ctx, width, height, type, color, isActive);
      } else if (style === 'particles') {
        drawParticles(ctx, width, height, audioData, color);
      } else if (style === 'spectral') {
        drawSpectral(ctx, width, height, audioData, color);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [type, isActive, audioData, color, style]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      width={800}
      height={200}
    />
  );
};

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: number[],
  color: string,
  type: string
) {
  const centerY = height / 2;
  const barCount = 60;
  const barWidth = width / barCount;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  for (let i = 0; i < barCount; i++) {
    const x = i * barWidth;
    const dataIndex = Math.floor((i / barCount) * data.length);
    const amplitude = data[dataIndex] || (type === 'idle' ? Math.sin(Date.now() / 1000 + i) * 10 : 0);
    
    const barHeight = Math.abs(amplitude) * (height / 2) * 0.8;
    
    ctx.beginPath();
    ctx.moveTo(x, centerY - barHeight);
    ctx.lineTo(x, centerY + barHeight);
    ctx.stroke();
  }
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  type: string,
  color: string,
  isActive: boolean
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const baseRadius = Math.min(width, height) * 0.3;
  
  // Breathing animation
  const breathe = Math.sin(Date.now() / 1000) * 0.1 + 1;
  const radius = baseRadius * breathe;

  // Glow effect
  const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.3, centerX, centerY, radius);
  
  if (type === 'listening') {
    gradient.addColorStop(0, color + 'ff');
    gradient.addColorStop(0.5, color + '88');
    gradient.addColorStop(1, color + '00');
  } else if (type === 'thinking') {
    gradient.addColorStop(0, '#8b5cf6ff');
    gradient.addColorStop(0.5, '#8b5cf688');
    gradient.addColorStop(1, '#8b5cf600');
  } else if (type === 'speaking') {
    gradient.addColorStop(0, '#10b981ff');
    gradient.addColorStop(0.5, '#10b98188');
    gradient.addColorStop(1, '#10b98100');
  } else {
    gradient.addColorStop(0, color + '44');
    gradient.addColorStop(0.5, color + '22');
    gradient.addColorStop(1, color + '00');
  }

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  // Pulse ring
  if (isActive) {
    const pulseRadius = radius + (Math.sin(Date.now() / 300) * 20);
    ctx.strokeStyle = color + '44';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: number[],
  color: string
) {
  const particleCount = 50;
  const time = Date.now() / 1000;

  ctx.fillStyle = color;
  
  for (let i = 0; i < particleCount; i++) {
    const x = (Math.sin(time + i) * 0.5 + 0.5) * width;
    const y = (Math.cos(time * 0.7 + i * 0.5) * 0.5 + 0.5) * height;
    const size = 2 + Math.sin(time + i) * 2;
    
    ctx.globalAlpha = 0.3 + Math.sin(time + i) * 0.3;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.globalAlpha = 1;
}

function drawSpectral(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: number[],
  color: string
) {
  const bars = 32;
  const barWidth = width / bars;

  for (let i = 0; i < bars; i++) {
    const value = data[i] || Math.random() * 0.5;
    const barHeight = value * height * 0.8;
    
    const hue = (i / bars) * 60 + 300; // Purple to pink range
    ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.8)`;
    
    ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
  }
}
