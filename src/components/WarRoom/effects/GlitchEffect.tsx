import React, { useEffect, useRef } from 'react';

interface GlitchEffectProps {
  trigger?: boolean;
  intensity?: number;
  duration?: number;
  children: React.ReactNode;
}

export const GlitchEffect: React.FC<GlitchEffectProps> = ({
  trigger = false,
  intensity = 1,
  duration = 500,
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trigger || !containerRef.current) return;

    const element = containerRef.current;
    element.classList.add('glitch-active');

    const timeout = setTimeout(() => {
      element.classList.remove('glitch-active');
    }, duration);

    return () => clearTimeout(timeout);
  }, [trigger, duration]);

  return (
    <div
      ref={containerRef}
      className="glitch-container relative"
      style={{
        ['--glitch-intensity' as any]: intensity
      }}
    >
      {children}
      <style>{`
        .glitch-container {
          position: relative;
        }

        .glitch-active {
          animation: glitch ${duration}ms ease-in-out;
        }

        .glitch-active::before,
        .glitch-active::after {
          content: '';
          position: absolute;
          inset: 0;
          background: inherit;
          opacity: 0.8;
          animation: glitch-layer ${duration}ms ease-in-out infinite;
        }

        .glitch-active::before {
          left: calc(2px * var(--glitch-intensity));
          text-shadow: -2px 0 #ff0000;
          clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
          animation-delay: 0ms;
        }

        .glitch-active::after {
          left: calc(-2px * var(--glitch-intensity));
          text-shadow: 2px 0 #00ffff;
          clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%);
          animation-delay: ${duration / 2}ms;
        }

        @keyframes glitch {
          0%, 100% {
            transform: translate(0);
          }
          20% {
            transform: translate(-2px, 2px);
          }
          40% {
            transform: translate(2px, -2px);
          }
          60% {
            transform: translate(-2px, 2px);
          }
          80% {
            transform: translate(2px, -2px);
          }
        }

        @keyframes glitch-layer {
          0% {
            clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
          }
          10% {
            clip-path: polygon(0 20%, 100% 20%, 100% 60%, 0 60%);
          }
          20% {
            clip-path: polygon(0 40%, 100% 40%, 100% 80%, 0 80%);
          }
          30% {
            clip-path: polygon(0 10%, 100% 10%, 100% 50%, 0 50%);
          }
          40% {
            clip-path: polygon(0 30%, 100% 30%, 100% 70%, 0 70%);
          }
          50% {
            clip-path: polygon(0 0%, 100% 0%, 100% 40%, 0 40%);
          }
          60% {
            clip-path: polygon(0 50%, 100% 50%, 100% 90%, 0 90%);
          }
          70% {
            clip-path: polygon(0 25%, 100% 25%, 100% 65%, 0 65%);
          }
          80% {
            clip-path: polygon(0 15%, 100% 15%, 100% 55%, 0 55%);
          }
          90% {
            clip-path: polygon(0 35%, 100% 35%, 100% 75%, 0 75%);
          }
          100% {
            clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
          }
        }
      `}</style>
    </div>
  );
};
