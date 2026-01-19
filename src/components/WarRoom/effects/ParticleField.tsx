import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
}

interface ParticleFieldProps {
  count?: number;
  color?: string;
  speed?: number;
  size?: [number, number];
  connectDistance?: number;
}

export const ParticleField: React.FC<ParticleFieldProps> = ({
  count = 100,
  color = '#f43f5e',
  speed = 0.5,
  size = [1, 3],
  connectDistance = 100
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize particles
    particlesRef.current = [];
    for (let i = 0; i < count; i++) {
      particlesRef.current.push(createParticle(canvas.width, canvas.height));
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current.forEach((particle, index) => {
        // Update position
        particle.x += particle.vx * speed;
        particle.y += particle.vy * speed;
        particle.life--;

        // Respawn if dead
        if (particle.life <= 0) {
          particlesRef.current[index] = createParticle(canvas.width, canvas.height);
          return;
        }

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Update alpha based on life
        particle.alpha = particle.life / particle.maxLife;

        // Draw particle
        ctx.fillStyle = `${particle.color}${Math.floor(particle.alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();

        // Connect nearby particles
        if (connectDistance > 0) {
          particlesRef.current.forEach(other => {
            const dx = particle.x - other.x;
            const dy = particle.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < connectDistance) {
              const alpha2 = (1 - dist / connectDistance) * particle.alpha * other.alpha * 0.3;
              ctx.strokeStyle = `${particle.color}${Math.floor(alpha2 * 255).toString(16).padStart(2, '0')}`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(particle.x, particle.y);
              ctx.lineTo(other.x, other.y);
              ctx.stroke();
            }
          });
        }
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [count, color, speed, connectDistance]);

  const createParticle = (width: number, height: number): Particle => {
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 0.5 + 0.2;
    
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: Math.random() * 300 + 200,
      maxLife: 500,
      size: Math.random() * (size[1] - size[0]) + size[0],
      color: color,
      alpha: 1
    };
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
};
