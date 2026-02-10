/**
 * Search Panel Component
 * Full-text search for messages with filters
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { searchService, SearchResult, SearchOptions } from '../../services/searchService';
import { supabase } from '../../services/supabase';

// ==================== Types ====================

interface SearchFilters {
  threadId?: string;
  senderIds?: string[];
  dateRange?: { start: Date; end: Date };
  hasAttachments?: boolean;
}

interface SearchPanelProps {
  onResultClick?: (result: SearchResult) => void;
  onClose?: () => void;
  className?: string;
}

// ==================== Sub-Components ====================

interface DateRangeFilterProps {
  value?: { start: Date; end: Date };
  onChange: (range: { start: Date; end: Date } | undefined) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ value, onChange }) => {
  const presets = [
    { label: 'All time', value: undefined },
    { label: 'Today', days: 0 },
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
  ];

  const handlePreset = (days: number | undefined) => {
    if (days === undefined) {
      onChange(undefined);
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      onChange({ start, end });
    }
  };

  return (
    <div className="flex flex-wrap gap-1">
      {presets.map((preset, idx) => (
        <button
          key={idx}
          onClick={() => handlePreset(preset.days)}
          className={`px-2 py-1 text-xs rounded-md transition ${
            (!value && preset.value === undefined) ||
            (value && preset.days !== undefined)
              ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
};

interface AttachmentFilterProps {
  value?: boolean;
  onChange: (has: boolean | undefined) => void;
}

const AttachmentFilter: React.FC<AttachmentFilterProps> = ({ value, onChange }) => {
  return (
    <div className="flex gap-1">
      {[
        { label: 'Any', value: undefined },
        { label: 'With attachments', value: true },
        { label: 'No attachments', value: false },
      ].map((opt, idx) => (
        <button
          key={idx}
          onClick={() => onChange(opt.value)}
          className={`px-2 py-1 text-xs rounded-md transition ${
            value === opt.value
              ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

/**
 * Render highlighted text safely without using dangerouslySetInnerHTML
 * Parses **bold** markers and renders them as styled spans
 */
const HighlightedText: React.FC<{ text: string }> = ({ text }) => {
  // Parse **bold** markers and create React elements
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          // This is a highlighted match - render with highlight style
          const content = part.slice(2, -2);
          return (
            <mark key={idx} className="bg-rose-200 dark:bg-rose-800 rounded px-0.5">
              {content}
            </mark>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
};

interface SearchResultItemProps {
  result: SearchResult;
  onClick: () => void;
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({ result, onClick }) => {
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Get display text - use highlight if available, otherwise content
  const displayText = result.highlights && result.highlights.length > 0
    ? result.highlights[0]
    : result.content;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-rose-300 dark:hover:border-rose-600 transition"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
          <span className="text-rose-600 dark:text-rose-400 font-medium text-sm">
            {result.senderName?.charAt(0).toUpperCase() || '?'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
              {result.senderName || 'Unknown'}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0">
              {formatDate(result.createdAt)}
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
            <HighlightedText text={displayText} />
          </p>
          {result.attachments && result.attachments.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-zinc-500">
              <i className="fa-solid fa-paperclip" />
              <span>{result.attachments.length} attachment{result.attachments.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
};

// ==================== Main Component ====================

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onResultClick,
  onClose,
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(searchService.getRecentSearches());
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const searchResults = await searchService.searchMessages({
        query,
        ...filters
      });

      setResults(searchResults);
      searchService.saveRecentSearch(query);
      setRecentSearches(searchService.getRecentSearches());
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [query, filters]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        handleSearch();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, filters, handleSearch]);

  const handleResultClick = (result: SearchResult) => {
    onResultClick?.(result);
  };

  const handleRecentSearchClick = (search: string) => {
    setQuery(search);
  };

  const clearRecentSearches = () => {
    searchService.clearRecentSearches();
    setRecentSearches([]);
  };

  const resultCount = results.length;

  return (
    <div className={`bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-search text-rose-500" />
            Search Messages
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition"
            >
              <i className="fa-solid fa-xmark text-zinc-400" />
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`mt-2 flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition ${
            showFilters
              ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
              : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'
          }`}
        >
          <i className="fa-solid fa-filter" />
          Filters
          <i className={`fa-solid fa-chevron-${showFilters ? 'up' : 'down'} text-[10px]`} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              Date Range
            </label>
            <DateRangeFilter
              value={filters.dateRange}
              onChange={(range) => setFilters(prev => ({ ...prev, dateRange: range }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              Attachments
            </label>
            <AttachmentFilter
              value={filters.hasAttachments}
              onChange={(has) => setFilters(prev => ({ ...prev, hasAttachments: has }))}
            />
          </div>
          {Object.keys(filters).length > 0 && (
            <button
              onClick={() => setFilters({})}
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {/* Recent Searches (when no query) */}
        {!query && recentSearches.length > 0 && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Recent searches
              </span>
              <button
                onClick={clearRecentSearches}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recentSearches.map((search, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRecentSearchClick(search)}
                  className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                >
                  {search}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isSearching && (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Searching...</p>
          </div>
        )}

        {/* Results */}
        {!isSearching && query.length >= 2 && (
          <>
            {results.length > 0 ? (
              <div className="p-3 space-y-2">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                  {resultCount} result{resultCount !== 1 ? 's' : ''} found
                </p>
                {results.map((result) => (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    onClick={() => handleResultClick(result)}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                  <i className="fa-solid fa-search text-zinc-400" />
                </div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  No results found
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Try different keywords or adjust filters
                </p>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!isSearching && query.length === 0 && recentSearches.length === 0 && (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mx-auto mb-3">
              <i className="fa-solid fa-search text-rose-500" />
            </div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Search your messages
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Find any message by content, sender, or date
            </p>
          </div>
        )}

        {/* Minimum Query Length */}
        {!isSearching && query.length === 1 && (
          <div className="p-4 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Type at least 2 characters to search
            </p>
          </div>
        )}
      </div>

      {/* Footer with Keyboard Hints */}
      <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-800 rounded border border-zinc-300 dark:border-zinc-600 text-[10px]">
              Enter
            </kbd>
            {' '}to search
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-800 rounded border border-zinc-300 dark:border-zinc-600 text-[10px]">
              Esc
            </kbd>
            {' '}to close
          </span>
        </div>
      </div>
    </div>
  );
};

// Compact Search Button
interface QuickSearchButtonProps {
  onClick: () => void;
}

export const QuickSearchButton: React.FC<QuickSearchButtonProps> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
    title="Search messages (Ctrl+/)"
  >
    <i className="fa-solid fa-search text-zinc-500 text-sm" />
    <span className="text-sm text-zinc-500 dark:text-zinc-400">Search...</span>
    <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-white dark:bg-zinc-900 rounded border border-zinc-300 dark:border-zinc-600 text-[10px] text-zinc-400">
      Ctrl+/
    </kbd>
  </button>
);

export default SearchPanel;
