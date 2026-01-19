import React, { useEffect, useRef } from 'react';

interface MatrixRainProps {
  color?: string;
  fontSize?: number;
  speed?: number;
  density?: number;
  opacity?: number;
  className?: string;
  fadeColor?: string;
  zIndex?: number;
}

export const MatrixRain: React.FC<MatrixRainProps> = ({
  color = '#0f0',
  fontSize = 16,
  speed = 33,
  density = 0.9,
  opacity = 0.3,
  className = '',
  fadeColor = 'rgba(0, 0, 0, 0.05)',
  zIndex = 0
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      const width = parent ? parent.clientWidth : window.innerWidth;
      const height = parent ? parent.clientHeight : window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resize();

    // Characters to display
    const chars = 'ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ01234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const charArray = chars.split('');

    const createDrops = () => {
      const columns = Math.floor(canvas.width / fontSize);
      return Array(columns).fill(1);
    };

    let drops: number[] = createDrops();

    const draw = () => {
      // Fade effect
      ctx.fillStyle = fadeColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = color;
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        // Random character
        const char = charArray[Math.floor(Math.random() * charArray.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillText(char, x, y);

        // Reset drop randomly
        if (y > canvas.height && Math.random() > density) {
          drops[i] = 0;
        }

        drops[i]++;
      }
    };

    const interval = setInterval(draw, speed);

    const handleResize = () => {
      resize();
      drops = createDrops();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, [color, fontSize, speed, density, fadeColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ zIndex, opacity }}
    />
  );
};
