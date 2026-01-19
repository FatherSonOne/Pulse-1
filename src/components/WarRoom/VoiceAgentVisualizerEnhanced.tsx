import React, { useEffect, useRef, useState, useCallback } from 'react';

interface VoiceAgentVisualizerEnhancedProps {
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  audioLevel?: number;
  inputFrequencies?: number[]; // Audio input frequency data
  outputFrequencies?: number[]; // Audio output frequency data
  thinkingText?: string;
  transcriptText?: string;
  thinkingHighlights?: string[];
  variant?: 'default' | 'minimal' | 'immersive';
}

const DEFAULT_THINKING_HIGHLIGHTS = [
  "Analyzing your question...",
  "Considering context...",
  "Formulating response...",
  "Processing information...",
  "Connecting ideas...",
  "Preparing answer...",
];

// Pulsating ring configuration
interface PulseRing {
  radius: number;
  targetRadius: number;
  opacity: number;
  speed: number;
  phase: number;
  thickness: number;
}

// Particle for neural network effect
interface NeuralParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  connections: number[];
  pulsePhase: number;
  energy: number;
}

export const VoiceAgentVisualizerEnhanced: React.FC<VoiceAgentVisualizerEnhancedProps> = ({
  isListening,
  isSpeaking,
  isThinking,
  audioLevel = 0,
  inputFrequencies = [],
  outputFrequencies = [],
  thinkingText = '',
  transcriptText = '',
  thinkingHighlights = DEFAULT_THINKING_HIGHLIGHTS,
  variant = 'default'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const [currentThought, setCurrentThought] = useState(0);
  const pulseRingsRef = useRef<PulseRing[]>([]);
  const neuralParticlesRef = useRef<NeuralParticle[]>([]);
  const lastPeakTimeRef = useRef(0);
  const smoothedLevelRef = useRef(0);

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 1024);
  });

  // Detect mobile for performance optimization
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 1024);
      setIsMobile(mobile);
    };
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Rotate through thinking highlights
  useEffect(() => {
    if (!isThinking) return;
    const interval = setInterval(() => {
      setCurrentThought(prev => (prev + 1) % thinkingHighlights.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isThinking, thinkingHighlights.length]);

  // Initialize pulse rings
  const initPulseRings = useCallback((count: number, baseRadius: number) => {
    const rings: PulseRing[] = [];
    for (let i = 0; i < count; i++) {
      rings.push({
        radius: baseRadius + i * 25,
        targetRadius: baseRadius + i * 25,
        opacity: 0.3 - i * 0.05,
        speed: 0.5 + i * 0.2,
        phase: (i * Math.PI) / count,
        thickness: 2 - i * 0.3
      });
    }
    return rings;
  }, []);

  // Initialize neural particles
  const initNeuralParticles = useCallback((count: number, cx: number, cy: number, radius: number) => {
    const particles: NeuralParticle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = radius * (0.3 + Math.random() * 0.5);
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 2 + Math.random() * 3,
        connections: [],
        pulsePhase: Math.random() * Math.PI * 2,
        energy: 0.5 + Math.random() * 0.5
      });
    }
    // Create connections
    particles.forEach((p, i) => {
      const connectionCount = 2 + Math.floor(Math.random() * 2);
      for (let j = 0; j < connectionCount; j++) {
        const target = (i + 1 + Math.floor(Math.random() * 3)) % particles.length;
        if (!p.connections.includes(target)) {
          p.connections.push(target);
        }
      }
    });
    return particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('VoiceAgentVisualizerEnhanced: Failed to get canvas context');
      return;
    }

    let w = 0, h = 0, cx = 0, cy = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = isMobile
        ? Math.max(1, Math.min(1.5, window.devicePixelRatio || 1))
        : Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      w = rect.width;
      h = rect.height;
      cx = w / 2;
      cy = h / 2;

      // Reinitialize elements
      const baseRadius = Math.min(w, h) * 0.12;
      pulseRingsRef.current = initPulseRings(isMobile ? 4 : 6, baseRadius);
      neuralParticlesRef.current = initNeuralParticles(isMobile ? 8 : 16, cx, cy, Math.min(w, h) * 0.35);
    };

    setTimeout(resize, 100);
    window.addEventListener('resize', resize);

    const draw = () => {
      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const t = Date.now() / 1000;
      const isDark = document.documentElement.classList.contains('dark');

      // Smooth audio level
      smoothedLevelRef.current += (audioLevel - smoothedLevelRef.current) * 0.15;
      const smoothLevel = smoothedLevelRef.current;

      // Detect audio peaks for ring generation
      if (smoothLevel > 0.3 && t - lastPeakTimeRef.current > 0.15) {
        lastPeakTimeRef.current = t;
        // Add new expanding ring on peak
        if ((isListening || isSpeaking) && pulseRingsRef.current.length < 10) {
          const baseRadius = Math.min(w, h) * 0.12;
          pulseRingsRef.current.push({
            radius: baseRadius,
            targetRadius: baseRadius + Math.min(w, h) * 0.4 * smoothLevel,
            opacity: 0.6 * smoothLevel,
            speed: 2 + smoothLevel * 3,
            phase: 0,
            thickness: 3 * smoothLevel
          });
        }
      }

      // Clear canvas
      ctx.clearRect(0, 0, w, h);

      // === LIGHT MODE VISIBILITY LAYER ===
      if (!isDark) {
        // Subtle backdrop for visibility
        const backdropGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.5);
        backdropGrad.addColorStop(0, 'rgba(244, 63, 94, 0.08)');
        backdropGrad.addColorStop(0.5, 'rgba(236, 72, 153, 0.04)');
        backdropGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = backdropGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(w, h) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Activity states
      const isActive = isListening || isSpeaking;
      const breath = 0.5 + 0.5 * Math.sin(t * (isActive ? 2.5 : 1.1));

      // === AMBIENT GLOW ===
      const glowRadius = Math.min(w, h) * 0.35 * (1 + smoothLevel * 0.5);
      const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);

      if (isThinking) {
        glowGrad.addColorStop(0, isDark ? 'rgba(138, 92, 246, 0.25)' : 'rgba(138, 92, 246, 0.15)');
        glowGrad.addColorStop(0.5, isDark ? 'rgba(236, 72, 153, 0.1)' : 'rgba(236, 72, 153, 0.08)');
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isSpeaking) {
        glowGrad.addColorStop(0, isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)');
        glowGrad.addColorStop(0.5, isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)');
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isListening) {
        const intensity = 0.15 + smoothLevel * 0.2;
        glowGrad.addColorStop(0, `rgba(244, 63, 94, ${intensity})`);
        glowGrad.addColorStop(0.5, `rgba(236, 72, 153, ${intensity * 0.5})`);
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        const ambientPulse = 0.08 + breath * 0.05;
        glowGrad.addColorStop(0, `rgba(244, 63, 94, ${ambientPulse})`);
        glowGrad.addColorStop(0.5, `rgba(236, 72, 153, ${ambientPulse * 0.5})`);
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // === AUDIO-RESPONSIVE PULSATING RINGS ===
      const rings = pulseRingsRef.current;
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];

        // Expand ring
        ring.radius += ring.speed * (isActive ? (1 + smoothLevel) : 0.5);
        ring.opacity -= 0.008 * (isActive ? 1.5 : 1);

        if (ring.opacity <= 0 || ring.radius > Math.min(w, h) * 0.6) {
          rings.splice(i, 1);
          continue;
        }

        // Audio modulation on ring radius
        const audioMod = isActive ? Math.sin(t * 8 + ring.phase) * smoothLevel * 10 : 0;
        const drawRadius = ring.radius + audioMod;

        // Draw ring with gradient stroke
        ctx.beginPath();
        ctx.arc(cx, cy, drawRadius, 0, Math.PI * 2);

        if (isThinking) {
          ctx.strokeStyle = isDark
            ? `rgba(138, 92, 246, ${ring.opacity})`
            : `rgba(139, 92, 246, ${ring.opacity * 1.5})`;
        } else if (isSpeaking) {
          ctx.strokeStyle = isDark
            ? `rgba(34, 197, 94, ${ring.opacity})`
            : `rgba(22, 163, 74, ${ring.opacity * 1.5})`;
        } else {
          ctx.strokeStyle = isDark
            ? `rgba(244, 63, 94, ${ring.opacity})`
            : `rgba(225, 29, 72, ${ring.opacity * 1.5})`;
        }

        ctx.lineWidth = Math.max(0.5, ring.thickness);
        ctx.stroke();
      }

      // === FREQUENCY SPECTRUM RINGS (if frequency data available) ===
      const freqData = isListening ? inputFrequencies : (isSpeaking ? outputFrequencies : []);
      if (freqData.length > 0 && !isMobile) {
        const freqBands = Math.min(freqData.length, 32);
        const baseFreqRadius = Math.min(w, h) * 0.15;

        for (let i = 0; i < freqBands; i++) {
          const angle = (i / freqBands) * Math.PI * 2 - Math.PI / 2;
          const freqValue = freqData[Math.floor(i * freqData.length / freqBands)] / 255;
          const barLength = freqValue * Math.min(w, h) * 0.15;

          const x1 = cx + Math.cos(angle) * baseFreqRadius;
          const y1 = cy + Math.sin(angle) * baseFreqRadius;
          const x2 = cx + Math.cos(angle) * (baseFreqRadius + barLength);
          const y2 = cy + Math.sin(angle) * (baseFreqRadius + barLength);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);

          const hue = isListening ? 350 : (isSpeaking ? 140 : 340);
          ctx.strokeStyle = isDark
            ? `hsla(${hue}, 80%, 60%, ${0.3 + freqValue * 0.5})`
            : `hsla(${hue}, 70%, 45%, ${0.4 + freqValue * 0.4})`;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }

      // === NEURAL NETWORK VISUALIZATION (Thinking State) ===
      if (isThinking && !isMobile) {
        const particles = neuralParticlesRef.current;

        // Update and draw particles
        particles.forEach((p, i) => {
          // Orbital movement
          const dx = cx - p.x;
          const dy = cy - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          p.vx += (-dy / dist) * 0.002;
          p.vy += (dx / dist) * 0.002;
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.98;
          p.vy *= 0.98;

          // Pulse energy
          p.pulsePhase += 0.05;
          const pulse = 0.5 + 0.5 * Math.sin(p.pulsePhase);

          // Draw connections
          ctx.strokeStyle = isDark
            ? `rgba(138, 92, 246, ${0.1 + pulse * 0.2})`
            : `rgba(139, 92, 246, ${0.15 + pulse * 0.2})`;
          ctx.lineWidth = 1;

          p.connections.forEach(targetIdx => {
            const target = particles[targetIdx];
            if (!target) return;

            // Synaptic pulse traveling along connection
            const pulsePos = (t * 2 + i * 0.5) % 1;
            const px = p.x + (target.x - p.x) * pulsePos;
            const py = p.y + (target.y - p.y) * pulsePos;

            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();

            // Pulse dot
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fillStyle = isDark
              ? `rgba(168, 85, 247, ${0.5 + pulse * 0.5})`
              : `rgba(147, 51, 234, ${0.6 + pulse * 0.4})`;
            ctx.fill();
          });

          // Draw particle
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * (0.8 + pulse * 0.4), 0, Math.PI * 2);
          ctx.fillStyle = isDark
            ? `rgba(138, 92, 246, ${0.6 + pulse * 0.4})`
            : `rgba(139, 92, 246, ${0.7 + pulse * 0.3})`;
          ctx.fill();
        });
      }

      // === CORE ORB ===
      const baseOrbRadius = Math.min(w, h) * 0.09;
      const orbRadius = baseOrbRadius * (1 + breath * 0.1) * (1 + smoothLevel * 0.3);

      // Outer glow
      const orbGlow = ctx.createRadialGradient(cx, cy, orbRadius * 0.5, cx, cy, orbRadius * 1.5);
      if (isThinking) {
        orbGlow.addColorStop(0, isDark ? 'rgba(138, 92, 246, 0.4)' : 'rgba(139, 92, 246, 0.3)');
        orbGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isSpeaking) {
        orbGlow.addColorStop(0, isDark ? 'rgba(34, 197, 94, 0.4)' : 'rgba(22, 163, 74, 0.3)');
        orbGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isListening) {
        orbGlow.addColorStop(0, isDark ? 'rgba(244, 63, 94, 0.4)' : 'rgba(225, 29, 72, 0.3)');
        orbGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        orbGlow.addColorStop(0, isDark ? 'rgba(244, 63, 94, 0.2)' : 'rgba(225, 29, 72, 0.15)');
        orbGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.fillStyle = orbGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Core orb
      const orbGrad = ctx.createRadialGradient(cx - orbRadius * 0.2, cy - orbRadius * 0.2, 0, cx, cy, orbRadius);
      if (isThinking) {
        orbGrad.addColorStop(0, isDark ? 'rgba(168, 85, 247, 0.95)' : 'rgba(147, 51, 234, 0.9)');
        orbGrad.addColorStop(0.7, isDark ? 'rgba(138, 92, 246, 0.7)' : 'rgba(139, 92, 246, 0.6)');
        orbGrad.addColorStop(1, isDark ? 'rgba(109, 40, 217, 0.4)' : 'rgba(124, 58, 237, 0.3)');
      } else if (isSpeaking) {
        orbGrad.addColorStop(0, isDark ? 'rgba(74, 222, 128, 0.95)' : 'rgba(34, 197, 94, 0.9)');
        orbGrad.addColorStop(0.7, isDark ? 'rgba(34, 197, 94, 0.7)' : 'rgba(22, 163, 74, 0.6)');
        orbGrad.addColorStop(1, isDark ? 'rgba(21, 128, 61, 0.4)' : 'rgba(22, 101, 52, 0.3)');
      } else if (isListening) {
        orbGrad.addColorStop(0, isDark ? 'rgba(251, 113, 133, 0.95)' : 'rgba(244, 63, 94, 0.9)');
        orbGrad.addColorStop(0.7, isDark ? 'rgba(244, 63, 94, 0.7)' : 'rgba(225, 29, 72, 0.6)');
        orbGrad.addColorStop(1, isDark ? 'rgba(190, 18, 60, 0.4)' : 'rgba(159, 18, 57, 0.3)');
      } else {
        const idleAlpha = 0.6 + breath * 0.2;
        orbGrad.addColorStop(0, isDark ? `rgba(251, 113, 133, ${idleAlpha})` : `rgba(244, 63, 94, ${idleAlpha * 0.9})`);
        orbGrad.addColorStop(0.7, isDark ? 'rgba(244, 63, 94, 0.4)' : 'rgba(225, 29, 72, 0.35)');
        orbGrad.addColorStop(1, isDark ? 'rgba(190, 18, 60, 0.2)' : 'rgba(159, 18, 57, 0.15)');
      }

      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius, 0, Math.PI * 2);
      ctx.fill();

      // === WAVEFORM OUTPUT (Speaking) - Enhanced continuous animation ===
      if (isSpeaking) {
        const waveY = cy + Math.min(w, h) * 0.2;
        const waveWidth = Math.min(w, h) * 0.55;
        const bars = isMobile ? 20 : 36;
        const barWidth = waveWidth / bars;
        const barGap = 2;

        // Create a flowing wave pattern driven by audio level
        for (let i = 0; i < bars; i++) {
          const x = cx - waveWidth / 2 + i * barWidth;
          const freqVal = outputFrequencies[Math.floor(i * outputFrequencies.length / bars)] || 0;

          // Multi-layer wave for organic speech feel
          const position = i / bars;
          const wave1 = Math.sin(t * 10 + i * 0.3) * 0.4;  // Fast syllable wave
          const wave2 = Math.sin(t * 4 + i * 0.15) * 0.25;  // Medium word wave
          const wave3 = Math.sin(t * 1.5 + i * 0.08) * 0.15; // Slow sentence rhythm
          const centerBias = 1 - Math.abs(position - 0.5) * 0.6; // Higher in center

          // Use real frequency data if available, otherwise use simulated waves
          const amp = freqVal > 0
            ? (freqVal / 255)
            : Math.max(0.15, (0.4 + wave1 + wave2 + wave3) * centerBias * (0.6 + smoothLevel * 0.8));

          const barHeight = amp * 40 * (0.5 + smoothLevel * 0.7);

          // Gradient with glow effect
          const barGrad = ctx.createLinearGradient(x, waveY - barHeight / 2, x, waveY + barHeight / 2);
          const intensity = 0.5 + amp * 0.5;
          barGrad.addColorStop(0, isDark
            ? `rgba(74, 222, 128, ${intensity})`
            : `rgba(34, 197, 94, ${intensity})`);
          barGrad.addColorStop(0.5, isDark
            ? `rgba(52, 211, 153, ${intensity * 0.9})`
            : `rgba(16, 185, 129, ${intensity * 0.9})`);
          barGrad.addColorStop(1, isDark
            ? `rgba(34, 197, 94, ${intensity * 0.6})`
            : `rgba(22, 163, 74, ${intensity * 0.6})`);

          ctx.fillStyle = barGrad;
          ctx.beginPath();
          ctx.roundRect(x, waveY - barHeight / 2, barWidth - barGap, barHeight, 3);
          ctx.fill();

          // Add glow beneath active bars
          if (amp > 0.3) {
            ctx.shadowColor = isDark ? 'rgba(74, 222, 128, 0.5)' : 'rgba(34, 197, 94, 0.4)';
            ctx.shadowBlur = 8 * amp;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }

        // Add flowing wave line above bars for extra visual feedback
        ctx.beginPath();
        ctx.moveTo(cx - waveWidth / 2, waveY - 25);
        for (let i = 0; i <= bars; i++) {
          const x = cx - waveWidth / 2 + (i / bars) * waveWidth;
          const wave = Math.sin(t * 8 + i * 0.25) * smoothLevel * 12;
          const y = waveY - 25 + wave;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = isDark
          ? `rgba(74, 222, 128, ${0.3 + smoothLevel * 0.4})`
          : `rgba(34, 197, 94, ${0.4 + smoothLevel * 0.4})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // === INPUT WAVES (Listening) - Enhanced audio-reactive visualization ===
      if (isListening) {
        const earOffsetX = Math.min(w, h) * 0.22;
        const baseEarRadius = Math.min(w, h) * 0.12;
        const earRadius = baseEarRadius * (1 + smoothLevel * 0.4);
        const waveCount = 4;

        [-1, 1].forEach((side) => {
          const ex = cx + side * earOffsetX;
          const ey = cy;

          // Sound wave arcs - more responsive to audio
          for (let i = 0; i < waveCount; i++) {
            // Audio-reactive wave expansion
            const audioReactivity = smoothLevel * 15 * (1 - i * 0.2);
            const waveRadius = earRadius * (0.5 + i * 0.35) + Math.sin(t * 8 + i * 0.5) * audioReactivity;
            const waveOpacity = (0.5 - i * 0.1) * (0.4 + smoothLevel * 0.6);

            ctx.beginPath();
            ctx.arc(ex, ey, waveRadius,
              side === -1 ? Math.PI * 0.55 : Math.PI * -0.45,
              side === -1 ? Math.PI * 1.45 : Math.PI * 0.45
            );
            ctx.strokeStyle = isDark
              ? `rgba(244, 63, 94, ${waveOpacity})`
              : `rgba(225, 29, 72, ${waveOpacity * 1.3})`;
            ctx.lineWidth = 2.5 + smoothLevel * 3;
            ctx.lineCap = 'round';
            ctx.stroke();
          }

          // Audio level indicator bars beside ears
          const barCount = 5;
          const barSpacing = 6;
          const maxBarHeight = 25;
          for (let i = 0; i < barCount; i++) {
            const barX = ex + side * (baseEarRadius + 8 + i * barSpacing);
            const barHeight = maxBarHeight * (smoothLevel * (1 - i * 0.15) + 0.1 + Math.sin(t * 10 + i) * 0.1);
            const barAlpha = 0.4 + smoothLevel * 0.5;

            ctx.fillStyle = isDark
              ? `rgba(244, 63, 94, ${barAlpha})`
              : `rgba(225, 29, 72, ${barAlpha})`;
            ctx.beginPath();
            ctx.roundRect(barX - 2, ey - barHeight / 2, 4, barHeight, 2);
            ctx.fill();
          }
        });

        // Central listening pulse ring
        const pulseRadius = baseEarRadius * 1.8 + Math.sin(t * 4) * smoothLevel * 20;
        const pulseAlpha = 0.15 + smoothLevel * 0.25;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = isDark
          ? `rgba(244, 63, 94, ${pulseAlpha})`
          : `rgba(225, 29, 72, ${pulseAlpha})`;
        ctx.lineWidth = 1.5 + smoothLevel * 2;
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isListening, isSpeaking, isThinking, audioLevel, inputFrequencies, outputFrequencies, isMobile, initPulseRings, initNeuralParticles]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Light mode visibility backdrop */}
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          background: 'radial-gradient(circle at center, rgba(244, 63, 94, 0.05) 0%, transparent 70%)',
          zIndex: 0
        }}
      />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
      />

      {/* State overlays */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
        <div className="text-center space-y-3 px-4">
          {/* Thinking Bubble */}
          {isThinking && (
            <div className="relative">
              <div className="relative bg-purple-500/15 dark:bg-purple-900/30 backdrop-blur-md border border-purple-500/40 dark:border-purple-500/30 rounded-3xl px-8 py-4 max-w-sm shadow-lg shadow-purple-500/10">
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-purple-500/15 dark:bg-purple-900/30 border border-purple-500/40 dark:border-purple-500/30 rounded-full"></div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-4 w-2.5 h-2.5 bg-purple-500/15 dark:bg-purple-900/30 border border-purple-500/40 dark:border-purple-500/30 rounded-full"></div>

                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-purple-600 dark:bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-purple-600 dark:bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-purple-600 dark:bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-300 transition-all duration-500">
                    {thinkingHighlights[currentThought]}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isSpeaking && transcriptText && (
            <div className="bg-green-500/15 dark:bg-green-900/20 backdrop-blur-sm border border-green-600/40 dark:border-green-500/30 rounded-2xl px-6 py-3 max-w-md shadow-lg shadow-green-500/10">
              <p className="text-sm text-green-800 dark:text-green-300">
                <i className="fa fa-volume-up mr-2"></i>
                {transcriptText}
              </p>
            </div>
          )}

          {isListening && !isSpeaking && !isThinking && (
            <div className="bg-rose-500/15 dark:bg-rose-900/25 backdrop-blur-md border border-rose-600/40 dark:border-rose-500/40 rounded-2xl px-6 py-3 shadow-lg shadow-rose-500/10">
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-rose-600 dark:bg-rose-500 rounded-full transition-all duration-75"
                      style={{
                        height: `${12 + Math.sin(Date.now() / 100 + i) * 8 + audioLevel * 16}px`,
                        animationDelay: `${i * 50}ms`
                      }}
                    />
                  ))}
                </div>
                <p className="text-sm font-medium text-rose-800 dark:text-rose-300">
                  Listening...
                </p>
              </div>
            </div>
          )}

          {!isListening && !isSpeaking && !isThinking && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ready to listen...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceAgentVisualizerEnhanced;
