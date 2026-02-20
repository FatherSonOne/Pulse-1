// ============================================
// AI CONTACT SEARCH
// Natural language search bar for the People mode.
// Falls back to regular string search for short/simple queries.
// ============================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Contact } from '../../types';
import { searchContactsNL } from '../../services/contactSearchAIService';
import { supabase } from '../../services/supabase';

// ==================== TYPES ====================

interface AIContactSearchProps {
  contacts: Contact[];
  onResults: (contacts: Contact[], isAI: boolean, explanation: string) => void;
  onClear: () => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 400;
const NL_MIN_CHARS = 10; // below this, always simple search

// ==================== COMPONENT ====================

export const AIContactSearch: React.FC<AIContactSearchProps> = ({
  contacts,
  onResults,
  onClear,
  placeholder = 'Search contacts or ask anything…',
}) => {
  const [query, setQuery] = useState('');
  const [isAIMode, setIsAIMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resolve userId
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setIsAIMode(false);
      setExplanation('');
      onClear();
      return;
    }

    if (!userId) {
      // No auth yet — simple filter only
      const filtered = contacts.filter(c =>
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.email?.toLowerCase().includes(q.toLowerCase()) ||
        c.company?.toLowerCase().includes(q.toLowerCase())
      );
      onResults(filtered, false, '');
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchContactsNL(q, contacts, userId);
      setIsAIMode(result.isNLQuery);
      setExplanation(result.explanation);
      onResults(result.contacts, result.isNLQuery, result.explanation);
    } catch {
      // Fallback
      const filtered = contacts.filter(c =>
        c.name.toLowerCase().includes(q.toLowerCase())
      );
      setIsAIMode(false);
      setExplanation('');
      onResults(filtered, false, '');
    } finally {
      setIsSearching(false);
    }
  }, [contacts, userId, onResults, onClear]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), DEBOUNCE_MS);
  };

  const handleClear = () => {
    setQuery('');
    setIsAIMode(false);
    setExplanation('');
    onClear();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleClear();
    if (e.key === 'Enter' && query.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      runSearch(query);
    }
  };

  return (
    <div className="relative">
      {/* Search input */}
      <div className={`
        flex items-center gap-2 px-3 py-2 rounded-xl border transition-all
        bg-white dark:bg-zinc-900
        ${isAIMode
          ? 'border-indigo-300 dark:border-indigo-600 ring-1 ring-indigo-300 dark:ring-indigo-600'
          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
        }
        focus-within:border-indigo-400 dark:focus-within:border-indigo-500
        focus-within:ring-1 focus-within:ring-indigo-400 dark:focus-within:ring-indigo-500
      `}>
        {/* Icon: spinner when searching, sparkle for AI, magnifying glass otherwise */}
        {isSearching ? (
          <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-sm flex-shrink-0" />
        ) : isAIMode ? (
          <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 text-sm flex-shrink-0" />
        ) : (
          <i className="fa-solid fa-magnifying-glass text-zinc-400 text-sm flex-shrink-0" />
        )}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          data-contacts-search
          className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none min-w-0"
        />

        {/* AI badge */}
        {isAIMode && !isSearching && (
          <span className="flex-shrink-0 px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-medium rounded-full">
            AI
          </span>
        )}

        {/* Clear button */}
        {query && (
          <button
            onClick={handleClear}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        )}
      </div>

      {/* AI explanation chip */}
      {isAIMode && explanation && (
        <div className="mt-1.5 flex items-center gap-1.5 px-2">
          <i className="fa-solid fa-sparkles text-xs text-indigo-400" />
          <span className="text-xs text-indigo-600 dark:text-indigo-400 leading-tight">
            {explanation}
          </span>
        </div>
      )}

      {/* Hint (shown when empty, unfocused) */}
      {!query && (
        <p className="mt-1 px-2 text-xs text-zinc-400 dark:text-zinc-600">
          Try: "people I haven't talked to in 30 days"
        </p>
      )}
    </div>
  );
};

export default AIContactSearch;
