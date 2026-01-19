/**
 * SearchBox Component
 * Search input with fuzzy matching and keyboard navigation
 */

import React, { useState, useEffect, useRef } from 'react';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  resultsCount?: number;
}

export const SearchBox: React.FC<SearchBoxProps> = ({
  value,
  onChange,
  placeholder = 'Search tools...',
  resultsCount
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      {/* Search Input */}
      <div
        className={`
          relative flex items-center
          bg-zinc-50 dark:bg-zinc-950
          border rounded-xl
          transition-all duration-200
          ${isFocused
            ? 'border-purple-500 ring-2 ring-purple-500/20'
            : 'border-zinc-200 dark:border-zinc-800'
          }
        `}
      >
        {/* Search Icon */}
        <div className="absolute left-3 flex items-center pointer-events-none">
          <i className={`fa-solid fa-magnifying-glass text-sm ${
            isFocused ? 'text-purple-500' : 'text-zinc-400'
          }`}></i>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="
            w-full pl-10 pr-20 py-2.5
            bg-transparent
            text-sm text-zinc-900 dark:text-white
            placeholder:text-zinc-400
            focus:outline-none
          "
          aria-label="Search tools"
        />

        {/* Clear Button */}
        {value && (
          <button
            onClick={handleClear}
            className="
              absolute right-10 w-6 h-6 rounded-md
              flex items-center justify-center
              bg-zinc-200 dark:bg-zinc-800
              text-zinc-500 dark:text-zinc-400
              hover:bg-zinc-300 dark:hover:bg-zinc-700
              transition-colors duration-150
            "
            aria-label="Clear search"
          >
            <i className="fa-solid fa-times text-xs"></i>
          </button>
        )}

        {/* Keyboard Shortcut Hint */}
        {!value && !isFocused && (
          <div className="absolute right-3 flex items-center gap-1 text-xs text-zinc-400 pointer-events-none">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono">⌘</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono">K</kbd>
          </div>
        )}
      </div>

      {/* Results Count */}
      {value && resultsCount !== undefined && (
        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {resultsCount === 0 ? (
            <span>No tools found</span>
          ) : (
            <span>{resultsCount} {resultsCount === 1 ? 'tool' : 'tools'} found</span>
          )}
        </div>
      )}
    </div>
  );
};
