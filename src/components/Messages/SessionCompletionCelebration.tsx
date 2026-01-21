/**
 * SessionCompletionCelebration Component
 * Displays celebration animation when focus session completes
 * Features: Confetti animation, session stats, streak indicator, start another CTA
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

interface SessionStats {
  duration: number; // minutes
  messagesBlocked: number;
  breaksTaken: number;
  focusScore: number; // 0-100
}

interface StreakInfo {
  currentStreak: number; // days
  isNewRecord: boolean;
  longestStreak: number;
}

interface SessionCompletionCelebrationProps {
  isVisible: boolean;
  stats: SessionStats;
  streak: StreakInfo;
  onStartAnother: () => void;
  onClose: () => void;
  onViewStats: () => void;
}

// Confetti particle interface
interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  velocity: { x: number; y: number };
  rotationSpeed: number;
  delay: number;
}

// Animation variants
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.3, delay: 0.2 },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
    y: 50,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: -30,
    transition: { duration: 0.3 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
};

const trophyVariants = {
  hidden: { scale: 0, rotate: -180 },
  visible: {
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 15,
      delay: 0.3,
    },
  },
};

const statCountVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
};

const confettiColors = [
  '#FFD700', // Gold
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Light Gold
  '#BB8FCE', // Purple
];

// Confetti Canvas Component
const ConfettiCanvas: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ConfettiParticle[]>([]);
  const animationFrameRef = useRef<number>();

  const createParticles = useCallback(() => {
    const particles: ConfettiParticle[] = [];
    const particleCount = 150;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: -20 - Math.random() * 100,
        rotation: Math.random() * 360,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        size: 8 + Math.random() * 8,
        velocity: {
          x: (Math.random() - 0.5) * 8,
          y: 3 + Math.random() * 4,
        },
        rotationSpeed: (Math.random() - 0.5) * 10,
        delay: Math.random() * 1000,
      });
    }

    return particles;
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particlesRef.current = particlesRef.current.filter((particle) => {
      // Update position
      particle.x += particle.velocity.x;
      particle.y += particle.velocity.y;
      particle.rotation += particle.rotationSpeed;
      particle.velocity.y += 0.1; // Gravity
      particle.velocity.x *= 0.99; // Air resistance

      // Draw particle
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate((particle.rotation * Math.PI) / 180);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
      ctx.restore();

      // Keep particle if still visible
      return particle.y < canvas.height + 50;
    });

    if (particlesRef.current.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        particlesRef.current = createParticles();
        animate();
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, createParticles, animate]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};

// Animated Counter Component
const AnimatedCounter: React.FC<{ value: number; suffix?: string; duration?: number }> = ({
  value,
  suffix = '',
  duration = 1500,
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }, [value, duration]);

  return (
    <span>
      {displayValue}
      {suffix}
    </span>
  );
};

export const SessionCompletionCelebration: React.FC<SessionCompletionCelebrationProps> = ({
  isVisible,
  stats,
  streak,
  onStartAnother,
  onClose,
  onViewStats,
}) => {
  const [showConfetti, setShowConfetti] = useState(false);
  const controls = useAnimation();

  useEffect(() => {
    if (isVisible) {
      setShowConfetti(true);
      controls.start('visible');

      // Play success sound
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 chord
        frequencies.forEach((freq, index) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.frequency.value = freq;
          oscillator.type = 'sine';
          const startTime = audioContext.currentTime + index * 0.1;
          gainNode.gain.setValueAtTime(0.15, startTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.8);
          oscillator.start(startTime);
          oscillator.stop(startTime + 0.8);
        });
      } catch (e) {
        console.log('Audio not available');
      }

      // Stop confetti after a delay
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, controls]);

  // Calculate focus score grade
  const getScoreGrade = (score: number): { grade: string; color: string } => {
    if (score >= 90) return { grade: 'A+', color: 'text-green-400' };
    if (score >= 80) return { grade: 'A', color: 'text-green-400' };
    if (score >= 70) return { grade: 'B', color: 'text-blue-400' };
    if (score >= 60) return { grade: 'C', color: 'text-yellow-400' };
    return { grade: 'D', color: 'text-orange-400' };
  };

  const scoreGrade = getScoreGrade(stats.focusScore);

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Confetti Effect */}
          {showConfetti && <ConfettiCanvas isActive={showConfetti} />}

          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          >
            <motion.div
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700 shadow-2xl"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Decorative Background Elements */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                  className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/10 blur-3xl"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-gradient-to-tr from-blue-500/20 to-purple-500/10 blur-3xl"
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.5, 0.7, 0.5],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                />
              </div>

              <div className="relative p-8">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Trophy Icon */}
                <motion.div
                  className="flex justify-center mb-6"
                  variants={trophyVariants}
                >
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/30">
                      <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                    </div>
                    {/* Sparkle Effects */}
                    <motion.div
                      className="absolute -top-1 -right-1 w-4 h-4 text-yellow-300"
                      animate={{
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0],
                        rotate: [0, 180],
                      }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                    >
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                      </svg>
                    </motion.div>
                    <motion.div
                      className="absolute -bottom-2 -left-2 w-3 h-3 text-yellow-200"
                      animate={{
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0],
                      }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
                    >
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                      </svg>
                    </motion.div>
                  </div>
                </motion.div>

                {/* Title */}
                <motion.div className="text-center mb-8" variants={itemVariants}>
                  <h2 className="text-2xl font-bold text-white mb-2">Session Complete!</h2>
                  <p className="text-gray-400">Great work staying focused</p>
                </motion.div>

                {/* Stats Grid */}
                <motion.div
                  className="grid grid-cols-2 gap-4 mb-6"
                  variants={itemVariants}
                >
                  {/* Duration */}
                  <motion.div
                    className="p-4 rounded-2xl bg-gray-800/50 border border-gray-700/50"
                    variants={statCountVariants}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Duration</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      <AnimatedCounter value={stats.duration} suffix="m" />
                    </div>
                  </motion.div>

                  {/* Messages Blocked */}
                  <motion.div
                    className="p-4 rounded-2xl bg-gray-800/50 border border-gray-700/50"
                    variants={statCountVariants}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Blocked</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      <AnimatedCounter value={stats.messagesBlocked} />
                    </div>
                  </motion.div>

                  {/* Focus Score */}
                  <motion.div
                    className="p-4 rounded-2xl bg-gray-800/50 border border-gray-700/50"
                    variants={statCountVariants}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Score</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-bold ${scoreGrade.color}`}>{scoreGrade.grade}</span>
                      <span className="text-sm text-gray-500">
                        <AnimatedCounter value={stats.focusScore} suffix="%" />
                      </span>
                    </div>
                  </motion.div>

                  {/* Breaks */}
                  <motion.div
                    className="p-4 rounded-2xl bg-gray-800/50 border border-gray-700/50"
                    variants={statCountVariants}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                        </svg>
                      </div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Breaks</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      <AnimatedCounter value={stats.breaksTaken} />
                    </div>
                  </motion.div>
                </motion.div>

                {/* Streak Banner */}
                {streak.currentStreak > 0 && (
                  <motion.div
                    className={`mb-6 p-4 rounded-2xl border ${
                      streak.isNewRecord
                        ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30'
                        : 'bg-gray-800/50 border-gray-700/50'
                    }`}
                    variants={itemVariants}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            streak.isNewRecord ? 'bg-yellow-500/30' : 'bg-orange-500/20'
                          }`}
                          animate={streak.isNewRecord ? { scale: [1, 1.1, 1] } : {}}
                          transition={{ duration: 0.5, repeat: streak.isNewRecord ? Infinity : 0, repeatDelay: 1 }}
                        >
                          <svg
                            className={`w-5 h-5 ${streak.isNewRecord ? 'text-yellow-400' : 'text-orange-400'}`}
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                          </svg>
                        </motion.div>
                        <div>
                          <p className={`font-semibold ${streak.isNewRecord ? 'text-yellow-400' : 'text-white'}`}>
                            {streak.currentStreak} Day Streak!
                          </p>
                          {streak.isNewRecord && (
                            <p className="text-xs text-yellow-400/80">New Personal Record!</p>
                          )}
                          {!streak.isNewRecord && streak.longestStreak > streak.currentStreak && (
                            <p className="text-xs text-gray-500">
                              Best: {streak.longestStreak} days
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {Array.from({ length: Math.min(streak.currentStreak, 7) }).map((_, i) => (
                          <motion.div
                            key={i}
                            className={`w-2 h-6 rounded-full ${
                              streak.isNewRecord ? 'bg-yellow-500' : 'bg-orange-500'
                            }`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 24, opacity: 1 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Action Buttons */}
                <motion.div className="space-y-3" variants={itemVariants}>
                  <motion.button
                    className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-lg shadow-lg shadow-blue-500/25 transition-all duration-200"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onStartAnother}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Start Another Session
                    </span>
                  </motion.button>

                  <div className="flex gap-3">
                    <motion.button
                      className="flex-1 py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-medium transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onViewStats}
                    >
                      View Stats
                    </motion.button>
                    <motion.button
                      className="flex-1 py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-medium transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onClose}
                    >
                      Done
                    </motion.button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SessionCompletionCelebration;
