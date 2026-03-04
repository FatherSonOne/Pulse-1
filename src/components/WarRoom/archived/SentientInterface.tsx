import React, { useEffect, useRef } from 'react';
import { AIMessage, ThinkingStep } from '../../services/ragService';

interface SentientInterfaceProps {
  messages: AIMessage[];
  isLoading: boolean;
  isListening: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
}

export const SentientInterface: React.FC<SentientInterfaceProps> = ({
  messages,
  isLoading,
  isListening,
  thinkingLogs,
  onSendMessage
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>();

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
  }

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
    for (let i = 0; i < 100; i++) {
      particlesRef.current.push(createParticle(canvas.width, canvas.height));
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
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

        // Draw particle
        const alpha = particle.life / particle.maxLife;
        ctx.fillStyle = `rgba(244, 63, 94, ${alpha * 0.3})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();

        // Connect nearby particles (skip every other for performance)
        particlesRef.current.forEach((other, otherIndex) => {
          // Skip some connections for performance
          if (otherIndex % 2 !== 0) return;

          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 100) {
            const alpha2 = (1 - dist / 100) * 0.2;
            ctx.strokeStyle = `rgba(244, 63, 94, ${alpha2})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        });
      });

      // Draw central orb
      drawOrb(ctx, canvas.width, canvas.height, isLoading, isListening);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLoading, isListening]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createParticle = (width: number, height: number): Particle => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    life: Math.random() * 300 + 200,
    maxLife: 500,
    size: Math.random() * 2 + 1
  });

  const drawOrb = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    loading: boolean,
    listening: boolean
  ) => {
    const centerX = width / 2;
    const centerY = 150;
    const time = Date.now() / 1000;
    const baseRadius = 60;
    const breathe = Math.sin(time) * 0.15 + 1;
    const radius = baseRadius * breathe;

    // Determine color based on state
    let color = '#f43f5e'; // rose (idle)
    if (listening) color = '#3b82f6'; // blue (listening)
    if (loading) color = '#a855f7'; // purple (thinking)

    // Outer glow rings
    for (let i = 3; i > 0; i--) {
      const ringRadius = radius + i * 20;
      const gradient = ctx.createRadialGradient(
        centerX, centerY, ringRadius * 0.5,
        centerX, centerY, ringRadius
      );
      gradient.addColorStop(0, color + '00');
      gradient.addColorStop(0.5, color + '11');
      gradient.addColorStop(1, color + '00');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Main orb gradient
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, radius
    );
    gradient.addColorStop(0, color + 'ff');
    gradient.addColorStop(0.5, color + 'aa');
    gradient.addColorStop(1, color + '44');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Pulse ring when active
    if (loading || listening) {
      const pulseRadius = radius + (Math.sin(time * 3) * 0.5 + 0.5) * 30;
      ctx.strokeStyle = color + '88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Status text
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    const statusText = listening ? '◉ LISTENING' : loading ? '◉ THINKING' : '◉ READY';
    ctx.fillText(statusText, centerX, centerY + radius + 30);
  };

  const handleSubmit = () => {
    if (inputRef.current && inputRef.current.value.trim()) {
      onSendMessage(inputRef.current.value.trim());
      inputRef.current.value = '';
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = target.scrollHeight + 'px';
  };

  return (
    <div className="h-full min-h-0 bg-gradient-to-br from-gray-50 via-white to-purple-50 dark:from-gray-900 dark:via-black dark:to-purple-900/30 flex flex-col overflow-hidden relative">
      {/* Particle Background Canvas - hidden on mobile for performance */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none opacity-50 dark:opacity-100 hidden md:block"
      />

      {/* Content Container */}
      <div className="relative z-0 flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="px-3 md:px-6 py-2 md:py-4 bg-white/40 dark:bg-black/40 backdrop-blur-xl border-b border-rose-500/20 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-pink-500 dark:from-rose-400 dark:to-pink-400">
                Sentient Interface
              </h2>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 hidden sm:block">Living AI Presence</p>
            </div>
            <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm">
              <div className={`px-2 md:px-3 py-1 rounded-full border ${
                isListening
                  ? 'bg-blue-100 dark:bg-blue-600/20 border-blue-500/50 text-blue-700 dark:text-blue-300'
                  : isLoading
                  ? 'bg-purple-100 dark:bg-purple-600/20 border-purple-500/50 text-purple-700 dark:text-purple-300'
                  : 'bg-rose-100 dark:bg-rose-600/20 border-rose-500/50 text-rose-700 dark:text-rose-300'
              }`}>
                {isListening ? '🎤' : isLoading ? '🧠' : '💫'} <span className="hidden sm:inline">{isListening ? 'Listening' : isLoading ? 'Thinking' : 'Ready'}</span>
              </div>
              <span className="text-gray-500 dark:text-gray-500 hidden sm:inline">{messages.length} messages</span>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-3 md:px-6 py-3 md:py-4 space-y-4 md:space-y-6 min-h-0">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="mb-8">
                  {/* Orb is in canvas background */}
                </div>
                <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-pink-500 dark:from-rose-400 dark:to-pink-400 mb-4">
                  I'm Here for You
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  This is a sentient AI interface. I adapt to your presence and respond with awareness.
                  What would you like to explore?
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={() => onSendMessage('Tell me about yourself')}
                    className="px-4 py-2 bg-rose-50 dark:bg-rose-600/20 hover:bg-rose-100 dark:hover:bg-rose-600/30 border border-rose-200 dark:border-rose-500/30 rounded-lg text-sm text-rose-700 dark:text-white transition-all shadow-sm"
                  >
                    Tell me about yourself
                  </button>
                  <button
                    onClick={() => onSendMessage('What can you do?')}
                    className="px-4 py-2 bg-rose-50 dark:bg-rose-600/20 hover:bg-rose-100 dark:hover:bg-rose-600/30 border border-rose-200 dark:border-rose-500/30 rounded-lg text-sm text-rose-700 dark:text-white transition-all shadow-sm"
                  >
                    What can you do?
                  </button>
                  <button
                    onClick={() => onSendMessage('Help me with...')}
                    className="px-4 py-2 bg-rose-50 dark:bg-rose-600/20 hover:bg-rose-100 dark:hover:bg-rose-600/30 border border-rose-200 dark:border-rose-500/30 rounded-lg text-sm text-rose-700 dark:text-white transition-all shadow-sm"
                  >
                    Help me with...
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md'
                      : 'bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm border border-rose-200 dark:border-rose-500/20 text-gray-800 dark:text-gray-100 shadow-sm'
                  } rounded-2xl px-6 py-4`}>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2 text-rose-500 dark:text-rose-400 text-sm font-medium">
                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                        Pulse AI
                      </div>
                    )}
                    
                    <div className={`prose max-w-none ${msg.role === 'user' ? 'prose-invert' : 'dark:prose-invert'} prose-rose`}>
                      {msg.content.split('\n').map((line, i) => (
                        <p key={i} className="leading-relaxed mb-2 last:mb-0">
                          {line || <br />}
                        </p>
                      ))}
                    </div>

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-rose-500/20 flex items-center gap-2 flex-wrap">
                        <span className={`text-xs ${msg.role === 'user' ? 'text-rose-100' : 'text-rose-500 dark:text-rose-400'}`}>Sources:</span>
                        {msg.citations.map((cit: any, i: number) => (
                          <span key={i} className={`text-xs px-2 py-1 rounded ${
                            msg.role === 'user' 
                              ? 'bg-white/20 text-white' 
                              : 'bg-rose-100 dark:bg-rose-600/20 text-rose-700 dark:text-rose-300'
                          }`}>
                            {cit.title}
                          </span>
                        ))}
                      </div>
                    )}

                    {thinkingLogs.has(msg.id) && msg.role === 'assistant' && (
                      <div className="mt-3 pt-3 border-t border-rose-500/20">
                        <details className="text-xs">
                          <summary className="cursor-pointer text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300">
                            View thinking process ({thinkingLogs.get(msg.id)?.length} steps)
                          </summary>
                          <div className="mt-2 space-y-1 text-gray-500 dark:text-gray-400">
                            {thinkingLogs.get(msg.id)?.map((step, i) => (
                              <div key={i} className="flex gap-2">
                                <span className="text-rose-500">•</span>
                                <span>{step.thought} ({step.duration_ms}ms)</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}

                    <div className={`text-xs mt-2 ${msg.role === 'user' ? 'text-rose-100/70' : 'text-gray-400 dark:text-gray-500'}`}>
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm border border-rose-200 dark:border-rose-500/20 rounded-2xl px-6 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Contemplating...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 bg-white/40 dark:bg-black/40 backdrop-blur-xl border-t border-rose-500/20 shrink-0">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder="Speak your thoughts..."
              className="flex-1 px-4 py-3 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-rose-500/30 rounded-xl focus:border-rose-500 focus:outline-none resize-none min-h-[50px] max-h-[200px] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-inner"
              rows={1}
            />
            <button
              onClick={handleSubmit}
              className="px-6 py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 rounded-xl font-medium transition-all shrink-0 text-white shadow-md hover:shadow-lg"
            >
              <i className="fa fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
