import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ThreadSearchProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
}

const ThreadSearch: React.FC<ThreadSearchProps> = ({
  value,
  onChange,
  placeholder = 'Search threads...',
  autoFocus = false,
  onFocus,
  onBlur,
  className = ''
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+J or Cmd+J to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        inputRef.current?.focus();
      }

      // Escape to blur search
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        e.preventDefault();
        inputRef.current?.blur();
        if (onChange) {
          onChange(''); // Clear search on escape
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onChange]);

  const handleClear = () => {
    if (onChange) {
      onChange('');
    }
    inputRef.current?.focus();
  };

  return (
    <div className={`thread-search relative ${className}`}>
      <div className="relative">
        {/* Search icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <i className="fa-solid fa-search text-zinc-400 text-sm"></i>
        </div>

        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          aria-label="Search threads"
          aria-describedby="search-hint"
        />

        {/* Clear button */}
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Clear search"
            title="Clear search"
          >
            <i className="fa-solid fa-times text-zinc-400 text-sm"></i>
          </motion.button>
        )}
      </div>

      {/* Keyboard shortcut hint */}
      <div
        id="search-hint"
        className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 flex items-center justify-between px-1"
      >
        <span>Press Ctrl+J to focus</span>
        {value && (
          <span className="text-zinc-500 dark:text-zinc-400">
            Press Esc to clear
          </span>
        )}
      </div>
    </div>
  );
};

export default ThreadSearch;
