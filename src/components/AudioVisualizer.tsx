import React, { useEffect, useRef, useState } from 'react';
import { generateImage } from '../services/geminiService';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  color?: string;
  backgroundColor?: string;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  apiKey?: string;
  width?: number;
  height?: number;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
  analyser, 
  isActive, 
  color = '#10b981', 
  backgroundColor = 'transparent',
  canvasRef,
  apiKey,
  width = 600,
  height = 160
}) => {
  const localRef = useRef<HTMLCanvasElement>(null);
  const ref = canvasRef || localRef;
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const generatingRef = useRef(false);

  // Generate placeholder background if provided API key and currently inactive/empty
  useEffect(() => {
    if (apiKey && !bgImage && !generatingRef.current && (!analyser || !isActive)) {
        generatingRef.current = true;
        // Generate a sleek, minimalist background matching the app's aesthetic
        generateImage(apiKey, "abstract fluid sound waves background, dark mode, minimalist, 8k resolution, smooth gradients, no text, subtle neon lighting")
            .then(url => {
                if (url) {
                    const img = new Image();
                    img.src = url;
                    img.onload = () => setBgImage(img);
                }
            })
            .catch(err => console.error("Failed to generate visualizer background", err));
    }
  }, [apiKey, analyser, isActive, bgImage]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let dataArray: Uint8Array;
    let bufferLength: number;

    // Initialize Analyser or Fallback configuration
    if (analyser) {
        analyser.fftSize = 256; 
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
    } else {
        bufferLength = 64; // Fewer bars for idle animation
        dataArray = new Uint8Array(bufferLength);
    }

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      
      // 1. Fetch Data or Generate Idle Animation
      if (isActive && analyser) {
        analyser.getByteFrequencyData(dataArray);
      } else if (!isActive) {
        // Generate Organic Idle Wave
        const time = Date.now() / 800;
        for (let i = 0; i < bufferLength; i++) {
             // Combine sine waves for a "breathing" effect
             const x = i / bufferLength;
             // Wave 1: Slow rolling
             const w1 = Math.sin(x * 6 + time);
             // Wave 2: Faster ripple
             const w2 = Math.cos(x * 12 - time * 2) * 0.5;
             
             // Normalize to range 0-255 roughly
             const v = (w1 + w2 + 2) * 20 + 10;
             dataArray[i] = v;
        }
      } else {
        // Active but no analyser (edge case), silence
        dataArray.fill(0);
      }

      // 2. Clear & Background
      if (bgImage) {
        // Draw image covering canvas with a dark overlay to ensure bars are visible
        ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Darken background for contrast
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (backgroundColor === 'transparent') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 3. Draw Bars
      const barWidth = (canvas.width / bufferLength) * 0.7; // 70% width, 30% gap
      const gap = (canvas.width / bufferLength) * 0.3;
      let x = gap / 2;

      // Gradient Setup
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
      gradient.addColorStop(0, `${color}20`); // Fade out at bottom
      gradient.addColorStop(0.6, color); 
      gradient.addColorStop(1, '#ffffff'); // Bright white tips

      ctx.fillStyle = gradient;

      for (let i = 0; i < bufferLength; i++) {
        let value = dataArray[i];
        
        // Scale for canvas height
        // Boost low values for visibility, clamp high values
        let barHeight = (value / 255) * canvas.height * 1.2; 
        
        if (barHeight > canvas.height) barHeight = canvas.height;
        if (barHeight < 4) barHeight = 4; // Minimum rounded pill size

        // Dynamic Glow Effect based on loudness
        if (isActive && value > 80) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = color;
        } else {
            ctx.shadowBlur = 0;
        }

        const y = canvas.height - barHeight;
        
        // Draw Rounded Bar
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
        } else {
            // Fallback for older browsers
            ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();

        x += barWidth + gap;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isActive, color, backgroundColor, ref, bgImage, width, height]);

  return (
    <canvas 
      ref={ref} 
      width={width}
      height={height}
      className="w-full h-full rounded-md"
    />
  );
};

export default AudioVisualizer;