import React, { useEffect, useRef, useState } from 'react';

interface VoiceAgentVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  audioLevel?: number;
  thinkingText?: string;
  transcriptText?: string;
  thinkingHighlights?: string[];
}

// Thinking highlights that rotate during AI processing
const DEFAULT_THINKING_HIGHLIGHTS = [
  "Analyzing your question...",
  "Considering context...",
  "Formulating response...",
  "Processing information...",
  "Connecting ideas...",
  "Preparing answer...",
];

export const VoiceAgentVisualizer: React.FC<VoiceAgentVisualizerProps> = ({
  isListening,
  isSpeaking,
  isThinking,
  audioLevel = 0,
  thinkingText = '',
  transcriptText = '',
  thinkingHighlights = DEFAULT_THINKING_HIGHLIGHTS
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const [currentThought, setCurrentThought] = useState(0);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // Canvas context failure fallback - prevents black screen
    if (!ctx) {
      console.warn('VoiceAgentVisualizer: Failed to get canvas context, using fallback');
      return;
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // Lower DPR on mobile for better performance
      const dpr = isMobile
        ? Math.max(1, Math.min(1.5, window.devicePixelRatio || 1))
        : Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    setTimeout(resize, 100);
    window.addEventListener('resize', resize);

    // Particle system for ambient movement
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      hue: number;
    }> = [];

    const draw = () => {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;

      ctx.clearRect(0, 0, w, h);

      const t = Date.now() / 1000;
      const cx = w / 2;
      const cy = h / 2;

      const isDark = document.documentElement.classList.contains('dark');

      // Determine activity level
      const isActive = isListening || isSpeaking;
      const activityMultiplier = isActive ? 1.5 + audioLevel * 2 : 1;

      // Ambient breathing (faster when active)
      const breathSpeed = isActive ? 2.5 : 1.1;
      const breath = 0.5 + 0.5 * Math.sin(t * breathSpeed);
      const calm = 1 + breath * (isActive ? 0.12 : 0.06);

      // Audio level with ambient baseline
      const ambientBreath = 0.08 + 0.04 * Math.sin(t * 0.7);
      const level = Math.max(ambientBreath, Math.min(1, audioLevel));

      // === AMBIENT FLOATING PARTICLES ===
      // Add particles based on activity - reduced on mobile for performance
      const particleRate = isMobile
        ? (isActive ? 1 : (isThinking ? 0.5 : 0.2))
        : (isActive ? 3 : (isThinking ? 2 : 0.5));
      if (Math.random() < particleRate * 0.1) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.min(w, h) * 0.15 + Math.random() * Math.min(w, h) * 0.1;
        particles.push({
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * (isActive ? 2 : 0.5),
          vy: (Math.random() - 0.5) * (isActive ? 2 : 0.5),
          size: 2 + Math.random() * (isActive ? 4 : 2),
          alpha: 0.3 + Math.random() * 0.4,
          hue: isThinking ? 270 : (isSpeaking ? 140 : (isListening ? 350 : 340)),
        });
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Gentle orbit around center when idle, scatter when active
        if (!isActive && !isThinking) {
          const dx = cx - p.x;
          const dy = cy - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const orbitalSpeed = 0.0005;
          p.vx += (-dy / dist) * orbitalSpeed;
          p.vy += (dx / dist) * orbitalSpeed;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.003;
        p.vx *= 0.99;
        p.vy *= 0.99;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, ${isDark ? 60 : 50}%, ${p.alpha})`;
        ctx.fill();
      }

      // Keep particle count manageable - lower limit on mobile
      const maxParticles = isMobile ? 20 : 50;
      while (particles.length > maxParticles) particles.shift();

      // === AMBIENT ORBIT RINGS ===
      const orbitCount = 3;
      for (let i = 0; i < orbitCount; i++) {
        const orbitR = Math.min(w, h) * (0.12 + i * 0.06) * calm;
        const orbitSpeed = (0.3 + i * 0.15) * (isActive ? 2 : 1);
        const orbitAlpha = 0.1 + (isActive ? 0.15 : 0) - i * 0.03;

        ctx.strokeStyle = isDark
          ? `rgba(244, 63, 94, ${orbitAlpha})`
          : `rgba(236, 72, 153, ${orbitAlpha})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();

        // Rotating dashed orbit
        const startAngle = t * orbitSpeed + i * Math.PI / 3;
        ctx.arc(cx, cy, orbitR, startAngle, startAngle + Math.PI * 1.5);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // === BACKGROUND GLOW ===
      const bgR = Math.min(w, h) * 0.35 * activityMultiplier;
      const bgGrad = ctx.createRadialGradient(cx, cy, bgR * 0.1, cx, cy, bgR);

      if (isThinking) {
        bgGrad.addColorStop(0, 'rgba(138, 92, 246, 0.2)');
        bgGrad.addColorStop(0.5, 'rgba(236, 72, 153, 0.1)');
        bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isSpeaking) {
        bgGrad.addColorStop(0, 'rgba(57, 255, 20, 0.2)');
        bgGrad.addColorStop(0.5, 'rgba(0, 255, 180, 0.1)');
        bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isListening) {
        const pulseIntensity = 0.15 + level * 0.15;
        bgGrad.addColorStop(0, `rgba(244, 63, 94, ${pulseIntensity})`);
        bgGrad.addColorStop(0.5, `rgba(236, 72, 153, ${pulseIntensity * 0.5})`);
        bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        // Gentle ambient glow
        const ambientPulse = 0.06 + breath * 0.04;
        bgGrad.addColorStop(0, `rgba(244, 63, 94, ${ambientPulse})`);
        bgGrad.addColorStop(0.5, `rgba(236, 72, 153, ${ambientPulse * 0.5})`);
        bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, bgR, 0, Math.PI * 2);
      ctx.fill();

      // === "EARS" - LISTENING INDICATORS ===
      if (isListening) {
        const earOffset = Math.min(w, h) * 0.18;
        const earR = Math.min(w, h) * 0.12 * calm * (1 + level * 0.25);
        const earWiggle = Math.sin(t * 14) * level * 8;

        ctx.strokeStyle = isDark ? 'rgba(244, 63, 94, 0.7)' : 'rgba(244, 63, 94, 0.8)';
        ctx.lineWidth = 2.5 + level * 2;
        ctx.globalAlpha = 0.9;

        [-1, 1].forEach((side) => {
          const ex = cx + side * earOffset;
          const ey = cy + earWiggle;
          ctx.beginPath();
          ctx.arc(ex, ey, earR, Math.PI * 0.15, Math.PI * 1.85, side === -1);
          ctx.stroke();

          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(ex, ey, earR * 0.72, Math.PI * 0.25, Math.PI * 1.75, side === -1);
          ctx.stroke();
          ctx.globalAlpha = 0.9;
        });
        ctx.globalAlpha = 1;
      }

      // === "MIND" ORB ===
      const baseMindR = Math.min(w, h) * 0.09;
      const mindR =
        baseMindR *
        calm *
        (isThinking ? 1.2 + 0.1 * Math.sin(t * 6) : 1) *
        (isListening ? 1 + level * 0.3 : 1) *
        (isSpeaking ? 1.1 + 0.05 * Math.sin(t * 8) : 1);

      const mindGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, mindR);

      if (isThinking) {
        mindGrad.addColorStop(0, isDark ? 'rgba(138, 92, 246, 0.95)' : 'rgba(139, 92, 246, 0.9)');
        mindGrad.addColorStop(0.6, isDark ? 'rgba(236, 72, 153, 0.6)' : 'rgba(244, 63, 94, 0.55)');
        mindGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isSpeaking) {
        mindGrad.addColorStop(0, isDark ? 'rgba(57, 255, 20, 0.9)' : 'rgba(34, 197, 94, 0.85)');
        mindGrad.addColorStop(0.6, isDark ? 'rgba(0, 255, 180, 0.45)' : 'rgba(16, 185, 129, 0.45)');
        mindGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isListening) {
        mindGrad.addColorStop(0, isDark ? 'rgba(244, 63, 94, 0.85)' : 'rgba(244, 63, 94, 0.8)');
        mindGrad.addColorStop(0.6, isDark ? 'rgba(236, 72, 153, 0.45)' : 'rgba(236, 72, 153, 0.4)');
        mindGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        // Gentle pulsing idle state
        const idleAlpha = 0.5 + breath * 0.15;
        mindGrad.addColorStop(0, isDark ? `rgba(244, 63, 94, ${idleAlpha})` : `rgba(244, 63, 94, ${idleAlpha * 0.9})`);
        mindGrad.addColorStop(0.6, isDark ? 'rgba(236, 72, 153, 0.25)' : 'rgba(236, 72, 153, 0.2)');
        mindGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.fillStyle = mindGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, mindR, 0, Math.PI * 2);
      ctx.fill();

      // === PULSE RINGS ===
      if (isThinking || isListening || isSpeaking) {
        const ringCount = isActive ? 3 : 2;
        for (let i = 0; i < ringCount; i++) {
          const phase = t * (3 + i) + i * Math.PI / 2;
          const ringR = mindR + 8 + 10 * Math.sin(phase) + i * 12;
          const ringAlpha = 0.4 - i * 0.12;

          ctx.strokeStyle = isThinking
            ? isDark ? `rgba(138, 92, 246, ${ringAlpha})` : `rgba(139, 92, 246, ${ringAlpha})`
            : isSpeaking
            ? isDark ? `rgba(57, 255, 20, ${ringAlpha})` : `rgba(34, 197, 94, ${ringAlpha})`
            : isDark ? `rgba(244, 63, 94, ${ringAlpha})` : `rgba(244, 63, 94, ${ringAlpha})`;
          ctx.lineWidth = 2 - i * 0.5;
          ctx.beginPath();
          ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // === "VOCAL CORDS" WAVEFORM WHEN SPEAKING ===
      if (isSpeaking) {
        const vocalY = cy + Math.min(w, h) * 0.18;
        const vocalW = Math.min(w, h) * 0.5;
        const bars = 28;
        const barW = vocalW / bars;

        for (let i = 0; i < bars; i++) {
          const x = cx - vocalW / 2 + i * barW;
          const amp = 0.3 + 0.7 * Math.sin(t * 10 + i * 0.5);
          const barH = amp * 32 * (0.5 + audioLevel * 0.5);

          ctx.fillStyle = isDark
            ? `rgba(57, 255, 20, ${0.4 + amp * 0.5})`
            : `rgba(34, 197, 94, ${0.4 + amp * 0.5})`;
          ctx.fillRect(x, vocalY - barH / 2, barW - 2, barH);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isListening, isSpeaking, isThinking, audioLevel, isMobile]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Fallback gradient background for when canvas fails or on mobile */}
      <div
        className="absolute inset-0 bg-gradient-radial from-rose-500/10 via-transparent to-transparent"
        style={{ zIndex: 0 }}
      />
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
              {/* Thought bubble shape */}
              <div className="relative bg-purple-500/15 dark:bg-purple-900/30 backdrop-blur-md border border-purple-500/40 rounded-3xl px-8 py-4 max-w-sm shadow-lg">
                {/* Bubble tail circles */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-purple-500/15 dark:bg-purple-900/30 border border-purple-500/40 rounded-full"></div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-4 w-2.5 h-2.5 bg-purple-500/15 dark:bg-purple-900/30 border border-purple-500/40 rounded-full"></div>

                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300 transition-all duration-500">
                    {thinkingHighlights[currentThought]}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isSpeaking && transcriptText && (
            <div className="bg-green-500/10 dark:bg-green-900/20 backdrop-blur-sm border border-green-500/30 rounded-2xl px-6 py-3 max-w-md">
              <p className="text-sm text-green-700 dark:text-green-300">
                <i className="fa fa-volume-up mr-2"></i>
                {transcriptText}
              </p>
            </div>
          )}

          {isListening && !isSpeaking && !isThinking && (
            <div className="bg-rose-500/15 dark:bg-rose-900/25 backdrop-blur-md border border-rose-500/40 rounded-2xl px-6 py-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-rose-500 rounded-full transition-all duration-75"
                      style={{
                        height: `${12 + Math.sin(Date.now() / 100 + i) * 8 + audioLevel * 16}px`,
                        animationDelay: `${i * 50}ms`
                      }}
                    />
                  ))}
                </div>
                <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                  Listening...
                </p>
              </div>
            </div>
          )}

          {!isListening && !isSpeaking && !isThinking && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Ready to listen...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
