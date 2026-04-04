import React, { useRef, useEffect, useMemo } from 'react';
import { MessageCircle } from 'lucide-react';

type VoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

interface VoiceChatVisualizerProps {
  voiceState: VoiceState;
  audioLevel: number;
  isPaused: boolean;
  currentTranscript: string;
  openaiApiKey: string;
}

const VoiceChatVisualizer: React.FC<VoiceChatVisualizerProps> = ({
  voiceState,
  audioLevel,
  isPaused,
  currentTranscript,
  openaiApiKey,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const smoothedLevelRef = useRef(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, cx = 0, cy = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      w = rect.width;
      h = rect.height;
      cx = w / 2;
      cy = h / 2;
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const t = Date.now() / 1000;
      const isDark = document.documentElement.classList.contains('dark');

      // Smooth audio level
      smoothedLevelRef.current += (audioLevel - smoothedLevelRef.current) * 0.12;
      const smoothLevel = smoothedLevelRef.current;

      // Update phase
      phaseRef.current += 0.02 + smoothLevel * 0.05;

      ctx.clearRect(0, 0, w, h);

      // Determine colors based on state
      let primaryColor: string;
      let secondaryColor: string;
      let glowColor: string;

      switch (voiceState) {
        case 'listening':
          primaryColor = isDark ? '#f43f5e' : '#e11d48';
          secondaryColor = isDark ? '#fb7185' : '#f43f5e';
          glowColor = 'rgba(244, 63, 94, 0.3)';
          break;
        case 'thinking':
          primaryColor = isDark ? '#8b5cf6' : '#7c3aed';
          secondaryColor = isDark ? '#a78bfa' : '#8b5cf6';
          glowColor = 'rgba(139, 92, 246, 0.3)';
          break;
        case 'speaking':
          primaryColor = isDark ? '#22c55e' : '#16a34a';
          secondaryColor = isDark ? '#4ade80' : '#22c55e';
          glowColor = 'rgba(34, 197, 94, 0.3)';
          break;
        case 'connecting':
          primaryColor = isDark ? '#f59e0b' : '#d97706';
          secondaryColor = isDark ? '#fbbf24' : '#f59e0b';
          glowColor = 'rgba(245, 158, 11, 0.3)';
          break;
        default:
          primaryColor = isDark ? '#6b7280' : '#9ca3af';
          secondaryColor = isDark ? '#9ca3af' : '#d1d5db';
          glowColor = 'rgba(156, 163, 175, 0.2)';
      }

      // === AMBIENT BACKGROUND GLOW ===
      const ambientRadius = Math.min(w, h) * 0.45;
      const ambientGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ambientRadius);

      if (voiceState !== 'idle') {
        ambientGrad.addColorStop(0, `${glowColor.replace('0.3', '0.15')}`);
        ambientGrad.addColorStop(0.5, `${glowColor.replace('0.3', '0.05')}`);
        ambientGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = ambientGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // === MAIN ORB ===
      const baseOrbRadius = Math.min(w, h) * 0.18;
      const breathe = 1 + Math.sin(t * 1.5) * 0.08;
      const audioExpand = 1 + smoothLevel * 0.25;
      const orbRadius = baseOrbRadius * breathe * audioExpand;

      // Outer glow rings
      for (let i = 4; i >= 0; i--) {
        const ringRadius = orbRadius * (1.2 + i * 0.15) + Math.sin(t * 2 + i) * smoothLevel * 15;
        const ringAlpha = (0.15 - i * 0.025) * (voiceState === 'idle' ? 0.5 : 1);

        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);

        if (primaryColor.startsWith('#')) {
          const r = parseInt(primaryColor.slice(1, 3), 16);
          const g = parseInt(primaryColor.slice(3, 5), 16);
          const b = parseInt(primaryColor.slice(5, 7), 16);
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${ringAlpha})`;
        }

        ctx.lineWidth = 2 - i * 0.3;
        ctx.stroke();
      }

      // Core orb with gradient
      const orbGrad = ctx.createRadialGradient(
        cx - orbRadius * 0.2, cy - orbRadius * 0.2, 0,
        cx, cy, orbRadius
      );
      orbGrad.addColorStop(0, secondaryColor);
      orbGrad.addColorStop(0.7, primaryColor);
      orbGrad.addColorStop(1, isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)');

      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius, 0, Math.PI * 2);
      ctx.fillStyle = orbGrad;
      ctx.fill();

      // === STATE-SPECIFIC VISUALIZATIONS ===

      // LISTENING MODE
      if (voiceState === 'listening' && !isPaused) {
        const waveCount = 24;
        const maxWaveLength = Math.min(w, h) * 0.35;

        for (let i = 0; i < waveCount; i++) {
          const angle = (i / waveCount) * Math.PI * 2;
          const wavePhase = t * 3 + i * 0.3;
          const waveAmplitude = smoothLevel * maxWaveLength * (0.3 + Math.sin(wavePhase) * 0.7);

          const outerX = cx + Math.cos(angle) * (orbRadius * 2 + maxWaveLength);
          const outerY = cy + Math.sin(angle) * (orbRadius * 2 + maxWaveLength);
          const innerX = cx + Math.cos(angle) * (orbRadius + maxWaveLength - waveAmplitude);
          const innerY = cy + Math.sin(angle) * (orbRadius + maxWaveLength - waveAmplitude);

          const grad = ctx.createLinearGradient(outerX, outerY, innerX, innerY);
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(0.5, `rgba(244, 63, 94, ${0.6 * smoothLevel})`);
          grad.addColorStop(1, primaryColor);

          ctx.beginPath();
          ctx.moveTo(outerX, outerY);
          ctx.lineTo(innerX, innerY);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 3 + smoothLevel * 4;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        const pulseRadius = orbRadius * (1.1 + Math.sin(t * 4) * smoothLevel * 0.15);
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(244, 63, 94, ${0.5 + smoothLevel * 0.3})`;
        ctx.lineWidth = 3 + smoothLevel * 3;
        ctx.stroke();
      }

      // THINKING MODE
      if (voiceState === 'thinking') {
        const nodeCount = 12;
        const orbitRadius = orbRadius * 1.8;
        const nodes: { x: number; y: number; size: number }[] = [];

        for (let i = 0; i < nodeCount; i++) {
          const angle = (i / nodeCount) * Math.PI * 2 + t * 0.5;
          const wobble = Math.sin(t * 2 + i) * 15;
          const x = cx + Math.cos(angle) * (orbitRadius + wobble);
          const y = cy + Math.sin(angle) * (orbitRadius + wobble);
          const size = 4 + Math.sin(t * 3 + i * 0.5) * 2;
          nodes.push({ x, y, size });
        }

        ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            if ((i + j) % 3 === 0) {
              ctx.beginPath();
              ctx.moveTo(nodes[i].x, nodes[i].y);
              ctx.lineTo(nodes[j].x, nodes[j].y);
              ctx.stroke();
            }
          }
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(cx, cy);
          ctx.stroke();
        }

        nodes.forEach((node, i) => {
          const pulse = 0.5 + Math.sin(t * 4 + i) * 0.5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(139, 92, 246, ${0.5 + pulse * 0.5})`;
          ctx.fill();
        });

        for (let i = 0; i < 3; i++) {
          const ringAngle = t * (1 + i * 0.5) + (i * Math.PI * 2 / 3);
          const ringX = cx + Math.cos(ringAngle) * orbRadius * 0.5;
          const ringY = cy + Math.sin(ringAngle) * orbRadius * 0.5;
          ctx.beginPath();
          ctx.arc(ringX, ringY, 6, 0, Math.PI * 2);
          ctx.fillStyle = secondaryColor;
          ctx.fill();
        }
      }

      // SPEAKING MODE
      if (voiceState === 'speaking' && !isPaused) {
        const barCount = 32;
        const baseLength = orbRadius * 0.3;
        const maxLength = Math.min(w, h) * 0.25;

        for (let i = 0; i < barCount; i++) {
          const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
          const freq = 0.3 + Math.sin(t * 8 + i * 0.4) * 0.3 + Math.sin(t * 12 + i * 0.2) * 0.2;
          const barLength = baseLength + freq * smoothLevel * maxLength;

          const startX = cx + Math.cos(angle) * (orbRadius + 5);
          const startY = cy + Math.sin(angle) * (orbRadius + 5);
          const endX = cx + Math.cos(angle) * (orbRadius + barLength);
          const endY = cy + Math.sin(angle) * (orbRadius + barLength);

          const grad = ctx.createLinearGradient(startX, startY, endX, endY);
          grad.addColorStop(0, primaryColor);
          grad.addColorStop(1, `rgba(34, 197, 94, ${0.3 * smoothLevel})`);

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 4 + freq * 4;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        const ringCount = 3;
        for (let i = 0; i < ringCount; i++) {
          const ringPhase = ((t * 2 + i * 0.5) % 1);
          const ringRadius = orbRadius * (1.2 + ringPhase * 1.5);
          const ringAlpha = (1 - ringPhase) * 0.4 * smoothLevel;
          ctx.beginPath();
          ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(34, 197, 94, ${ringAlpha})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }

      // CONNECTING MODE
      if (voiceState === 'connecting') {
        const spinAngle = t * 3;
        const arcLength = Math.PI * 0.6;

        ctx.beginPath();
        ctx.arc(cx, cy, orbRadius * 1.3, spinAngle, spinAngle + arcLength);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, orbRadius * 1.3, spinAngle + Math.PI, spinAngle + Math.PI + arcLength);
        ctx.strokeStyle = secondaryColor;
        ctx.stroke();
      }

      // === CENTER ICON ===
      ctx.save();
      ctx.translate(cx, cy);

      const iconSize = orbRadius * 0.4;
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.95)';

      if (voiceState === 'listening') {
        ctx.beginPath();
        ctx.roundRect(-iconSize * 0.25, -iconSize * 0.5, iconSize * 0.5, iconSize * 0.7, 8);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -iconSize * 0.1, iconSize * 0.35, Math.PI, 0, false);
        ctx.strokeStyle = ctx.fillStyle as string;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, iconSize * 0.25);
        ctx.lineTo(0, iconSize * 0.5);
        ctx.stroke();
      } else if (voiceState === 'thinking' || voiceState === 'connecting') {
        const dotCount = 3;
        for (let i = 0; i < dotCount; i++) {
          const dotX = (i - 1) * iconSize * 0.4;
          const dotY = Math.sin(t * 5 + i * 0.5) * iconSize * 0.15;
          ctx.beginPath();
          ctx.arc(dotX, dotY, iconSize * 0.12, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (voiceState === 'speaking') {
        for (let i = 0; i < 3; i++) {
          const waveRadius = iconSize * (0.2 + i * 0.15);
          const waveAlpha = 1 - i * 0.25;
          ctx.beginPath();
          ctx.arc(0, 0, waveRadius, -Math.PI * 0.4, Math.PI * 0.4);
          ctx.strokeStyle = `rgba(255,255,255,${waveAlpha})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, iconSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [voiceState, audioLevel, isPaused]);

  const stateLabel = useMemo(() => {
    switch (voiceState) {
      case 'connecting': return 'Connecting...';
      case 'listening': return isPaused ? 'Paused' : 'Listening...';
      case 'thinking': return 'Thinking...';
      case 'speaking': return 'Speaking...';
      default: return 'Ready to connect';
    }
  }, [voiceState, isPaused]);

  const stateSubLabel = useMemo(() => {
    switch (voiceState) {
      case 'connecting': return 'Establishing connection to OpenAI';
      case 'listening': return 'Speak naturally, I\'m hearing you';
      case 'thinking': return 'Processing your message';
      case 'speaking': return 'Responding to you';
      default: return openaiApiKey ? 'Tap the button to start' : 'OpenAI API key required';
    }
  }, [voiceState, openaiApiKey]);

  return (
    <div className="pvc-visualizer-container" role="img" aria-label={`Voice chat: ${stateLabel}`}>
      <canvas ref={canvasRef} className="pvc-visualizer-canvas" />

      <div className="pvc-state-label">
        <span className="pvc-state-label-main">{stateLabel}</span>
        <span className="pvc-state-label-sub">{stateSubLabel}</span>
      </div>

      {currentTranscript && (
        <div className="pvc-transcript-preview">
          <MessageCircle size={14} />
          <span>{currentTranscript}</span>
        </div>
      )}
    </div>
  );
};

export default VoiceChatVisualizer;
