// Animated Reactions Component with Spring Animations
import React, { useState, useEffect, useRef } from 'react';

interface Reaction {
  emoji: string;
  count: number;
  me: boolean;
}

interface AnimatedReactionsProps {
  reactions: Reaction[];
  onReact: (emoji: string) => void;
  isMe?: boolean;
  showPicker?: boolean;
  onPickerToggle?: () => void;
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  y: number;
}

const COMMON_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const REACTION_CATEGORIES = {
  'Frequently Used': ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '🙏'],
  'Smileys': ['😀', '😊', '😄', '🤔', '😎', '🥳', '😍', '🤩'],
  'Gestures': ['👏', '🙌', '✌️', '🤝', '💪', '👊', '🫡', '✅'],
  'Objects': ['💡', '📌', '⚡', '🚀', '💯', '🎯', '⭐', '💎'],
};

// Single Reaction Bubble with animation
const ReactionBubble: React.FC<{
  reaction: Reaction;
  onClick: () => void;
  onFloat: (emoji: string) => void;
}> = ({ reaction, onClick, onFloat }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [scale, setScale] = useState(1);
  const [isPressed, setIsPressed] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleClick = () => {
    setIsAnimating(true);
    setScale(1.3);
    onFloat(reaction.emoji);

    // Spring back animation
    setTimeout(() => setScale(1.1), 100);
    setTimeout(() => setScale(0.95), 200);
    setTimeout(() => setScale(1), 300);
    setTimeout(() => setIsAnimating(false), 400);

    onClick();
  };

  // Handle mobile long-press for additional interaction
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsPressed(true);

    // Haptic feedback on press
    if ('vibrate' in navigator) {
      navigator.vibrate(5);
    }

    longPressTimerRef.current = setTimeout(() => {
      // Long-press detected - trigger enhanced animation
      setScale(1.2);
      if ('vibrate' in navigator) {
        navigator.vibrate([10, 5, 10]);
      }
    }, 300);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    // Cancel if moved more than 10px
    if (deltaX > 10 || deltaY > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      setIsPressed(false);
      setScale(1);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsPressed(false);
    setScale(1);
    touchStartRef.current = null;
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  return (
    <button
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`
        px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5
        transition-all duration-200 ease-out
        hover:scale-110 active:scale-95
        ${reaction.me
          ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500 shadow-sm shadow-blue-200 dark:shadow-blue-900/50'
          : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
        }
        ${isAnimating ? 'animate-bounce' : ''}
        ${isPressed ? 'ring-2 ring-blue-300 ring-opacity-50' : ''}
      `}
      style={{ transform: `scale(${scale})` }}
      aria-label={`${reaction.emoji} reaction, ${reaction.count} ${reaction.count === 1 ? 'person' : 'people'}${reaction.me ? ', including you' : ''}`}
      aria-pressed={reaction.me ? 'true' : 'false'}
    >
      <span className={`transition-transform ${isAnimating ? 'animate-wiggle' : ''}`}>
        {reaction.emoji}
      </span>
      <span className={`font-medium ${reaction.me ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
        {reaction.count}
      </span>
    </button>
  );
};

// Floating emoji animation overlay
const FloatingEmojiOverlay: React.FC<{
  emojis: FloatingEmoji[];
  onComplete: (id: string) => void;
}> = ({ emojis, onComplete }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {emojis.map(emoji => (
        <FloatingEmojiItem
          key={emoji.id}
          emoji={emoji}
          onComplete={() => onComplete(emoji.id)}
        />
      ))}
    </div>
  );
};

const FloatingEmojiItem: React.FC<{
  emoji: FloatingEmoji;
  onComplete: () => void;
}> = ({ emoji, onComplete }) => {
  const [opacity, setOpacity] = useState(1);
  const [translateY, setTranslateY] = useState(0);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    // Animate in
    setTimeout(() => setScale(1.5), 50);
    setTimeout(() => setScale(1.2), 150);

    // Float up
    const interval = setInterval(() => {
      setTranslateY(prev => prev - 3);
      setOpacity(prev => Math.max(0, prev - 0.03));
    }, 16);

    // Cleanup
    const timeout = setTimeout(() => {
      clearInterval(interval);
      onComplete();
    }, 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <div
      className="absolute text-2xl transition-transform"
      style={{
        left: emoji.x,
        top: emoji.y,
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
      }}
    >
      {emoji.emoji}
    </div>
  );
};

// Extended Emoji Picker
const EmojiPicker: React.FC<{
  onSelect: (emoji: string) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('Frequently Used');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full mb-2 left-0 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-3 z-50 animate-scale-in"
      style={{ minWidth: '280px' }}
    >
      {/* Category Tabs */}
      <div className="flex gap-1 mb-3 pb-2 border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto">
        {Object.keys(REACTION_CATEGORIES).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="grid grid-cols-8 gap-1">
        {REACTION_CATEGORIES[activeCategory as keyof typeof REACTION_CATEGORIES].map(emoji => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center text-lg rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:scale-125 transition-all"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

// Main Component
export const AnimatedReactions: React.FC<AnimatedReactionsProps> = ({
  reactions,
  onReact,
  isMe = false,
  showPicker = false,
  onPickerToggle
}) => {
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [localPickerOpen, setLocalPickerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFloat = (emoji: string) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const newEmoji: FloatingEmoji = {
      id: Math.random().toString(36).substr(2, 9),
      emoji,
      x: Math.random() * rect.width,
      y: rect.height - 20
    };

    setFloatingEmojis(prev => [...prev, newEmoji]);
  };

  const handleFloatComplete = (id: string) => {
    setFloatingEmojis(prev => prev.filter(e => e.id !== id));
  };

  const handleEmojiSelect = (emoji: string) => {
    handleFloat(emoji);
    onReact(emoji);
    setLocalPickerOpen(false);
    onPickerToggle?.();
  };

  const isPickerOpen = showPicker || localPickerOpen;

  return (
    <div
      ref={containerRef}
      className={`relative flex gap-1.5 flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}
    >
      <FloatingEmojiOverlay
        emojis={floatingEmojis}
        onComplete={handleFloatComplete}
      />

      {reactions.map((r, idx) => (
        <ReactionBubble
          key={`${r.emoji}-${idx}`}
          reaction={r}
          onClick={() => onReact(r.emoji)}
          onFloat={handleFloat}
        />
      ))}

      {/* Add Reaction Button */}
      <button
        onClick={() => {
          setLocalPickerOpen(!localPickerOpen);
          onPickerToggle?.();
        }}
        className={`
          px-2 py-1 rounded-full text-xs flex items-center gap-1
          bg-zinc-100 dark:bg-zinc-800 border border-dashed border-zinc-300 dark:border-zinc-600
          text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300
          hover:border-zinc-400 dark:hover:border-zinc-500
          hover:bg-zinc-200 dark:hover:bg-zinc-700
          transition-all hover:scale-105
        `}
      >
        <span className="text-base">+</span>
      </button>

      {isPickerOpen && (
        <EmojiPicker
          onSelect={handleEmojiSelect}
          onClose={() => {
            setLocalPickerOpen(false);
            onPickerToggle?.();
          }}
        />
      )}
    </div>
  );
};

// Emoji tooltip labels for accessibility
const EMOJI_LABELS: Record<string, string> = {
  '👍': 'Thumbs up',
  '❤️': 'Love',
  '😂': 'Laugh',
  '😮': 'Wow',
  '😢': 'Sad',
  '🔥': 'Fire',
  '🎉': 'Celebrate',
  '🙏': 'Thanks',
};

// Quick Reaction Bar (for hover state on messages)
export const QuickReactionBar: React.FC<{
  onReact: (emoji: string) => void;
  onShowMore: () => void;
  position?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  className?: string;
  isExiting?: boolean;
}> = ({ onReact, onShowMore, position = {}, className = '', isExiting = false }) => {
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [showRipple, setShowRipple] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const positionStyles = {
    ...(position.top !== undefined && { top: `${position.top}px` }),
    ...(position.bottom !== undefined && { bottom: `${position.bottom}px` }),
    ...(position.left !== undefined && { left: `${position.left}px` }),
    ...(position.right !== undefined && { right: `${position.right}px` }),
  };

  // Handle emoji selection with visual feedback
  const handleEmojiClick = (e: React.MouseEvent, emoji: string) => {
    e.stopPropagation();

    // Trigger selection animation
    setSelectedEmoji(emoji);
    setShowRipple(emoji);

    // Clear ripple after animation
    setTimeout(() => setShowRipple(null), 400);

    // Trigger haptic feedback on mobile
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    // Call onReact after brief visual feedback
    setTimeout(() => {
      onReact(emoji);
    }, 100);
  };

  // Handle keyboard navigation within the bar
  const handleKeyDown = (e: React.KeyboardEvent, emoji: string, index: number) => {
    const buttons = barRef.current?.querySelectorAll('button');
    if (!buttons) return;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        const nextIndex = Math.min(index + 1, buttons.length - 1);
        (buttons[nextIndex] as HTMLButtonElement).focus();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        const prevIndex = Math.max(index - 1, 0);
        (buttons[prevIndex] as HTMLButtonElement).focus();
        break;
      case 'Home':
        e.preventDefault();
        (buttons[0] as HTMLButtonElement).focus();
        break;
      case 'End':
        e.preventDefault();
        (buttons[buttons.length - 1] as HTMLButtonElement).focus();
        break;
    }
  };

  return (
    <div
      ref={barRef}
      className={`
        quick-reaction-bar
        ${isExiting ? 'quick-reaction-bar-exit' : 'quick-reaction-bar-enter'}
        ${className}
      `}
      style={positionStyles}
      role="toolbar"
      aria-label="Quick reactions - Use arrow keys to navigate"
    >
      {COMMON_REACTIONS.slice(0, 6).map((emoji, index) => (
        <button
          key={emoji}
          onClick={(e) => handleEmojiClick(e, emoji)}
          onMouseEnter={() => setHoveredEmoji(emoji)}
          onMouseLeave={() => setHoveredEmoji(null)}
          onKeyDown={(e) => handleKeyDown(e, emoji, index)}
          className={`
            quick-reaction-emoji
            ${hoveredEmoji === emoji ? 'scale-125' : ''}
            ${selectedEmoji === emoji ? 'quick-reaction-emoji-selected' : ''}
          `}
          aria-label={`React with ${EMOJI_LABELS[emoji] || emoji}`}
          data-tooltip={EMOJI_LABELS[emoji]}
          tabIndex={index === 0 ? 0 : -1}
        >
          <span className="relative z-10" aria-hidden="true">{emoji}</span>
          {showRipple === emoji && (
            <span className="quick-reaction-emoji-ripple" aria-hidden="true" />
          )}
        </button>
      ))}

      {/* Divider */}
      <div className="quick-reaction-divider" aria-hidden="true" />

      {/* More Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onShowMore();
        }}
        onKeyDown={(e) => handleKeyDown(e, 'more', 6)}
        className="quick-reaction-more"
        aria-label="Show all reactions"
        aria-haspopup="dialog"
        tabIndex={-1}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="7" y1="3" x2="7" y2="11" />
          <line x1="3" y1="7" x2="11" y2="7" />
        </svg>
        <span className="sr-only">Show more reactions</span>
      </button>
    </div>
  );
};

export default AnimatedReactions;
