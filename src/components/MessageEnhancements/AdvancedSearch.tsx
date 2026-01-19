// Advanced Search with Filters Component
import React, { useState, useMemo } from 'react';

interface SearchFilter {
  id: string;
  label: string;
  type: 'toggle' | 'select' | 'date-range' | 'multi-select';
  options?: string[];
  value: any;
}

interface SearchResult {
  id: string;
  type: 'message' | 'file' | 'decision' | 'task' | 'link' | 'mention';
  threadId: string;
  threadName: string;
  content: string;
  timestamp: string;
  sender: string;
  matchScore: number;
  context?: {
    before?: string;
    after?: string;
  };
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, any>;
  createdAt: string;
}

interface AdvancedSearchProps {
  onSearch: (query: string, filters: Record<string, any>) => Promise<SearchResult[]>;
  savedSearches?: SavedSearch[];
  onSaveSearch?: (name: string, query: string, filters: Record<string, any>) => void;
  onDeleteSavedSearch?: (id: string) => void;
  onResultClick?: (result: SearchResult) => void;
  contacts?: Array<{ id: string; name: string }>;
  compact?: boolean;
}

// Helper to highlight search terms safely (no innerHTML)
const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60 text-inherit rounded px-0.5">{part}</mark>
      : part
  );
};

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  savedSearches = [],
  onSaveSearch,
  onDeleteSavedSearch,
  onResultClick,
  contacts = [],
  compact = false
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');

  // Filters state
  const [filters, setFilters] = useState({
    type: 'all',
    dateRange: 'any',
    customDateFrom: '',
    customDateTo: '',
    sender: 'all',
    hasAttachment: false,
    hasReaction: false,
    isDecision: false,
    isTask: false,
    sortBy: 'relevance'
  });

  const filterOptions = useMemo(() => ({
    type: [
      { value: 'all', label: 'All Types' },
      { value: 'message', label: 'Messages' },
      { value: 'file', label: 'Files' },
      { value: 'decision', label: 'Decisions' },
      { value: 'task', label: 'Tasks' },
      { value: 'link', label: 'Links' }
    ],
    dateRange: [
      { value: 'any', label: 'Any Time' },
      { value: 'today', label: 'Today' },
      { value: 'week', label: 'This Week' },
      { value: 'month', label: 'This Month' },
      { value: 'quarter', label: 'Last 3 Months' },
      { value: 'year', label: 'This Year' },
      { value: 'custom', label: 'Custom Range' }
    ],
    sortBy: [
      { value: 'relevance', label: 'Most Relevant' },
      { value: 'newest', label: 'Newest First' },
      { value: 'oldest', label: 'Oldest First' }
    ]
  }), []);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const searchResults = await onSearch(query, filters);
      setResults(searchResults);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSearch = () => {
    if (saveSearchName.trim() && onSaveSearch) {
      onSaveSearch(saveSearchName.trim(), query, filters);
      setSaveSearchName('');
      setShowSaveModal(false);
    }
  };

  const applySavedSearch = (saved: SavedSearch) => {
    setQuery(saved.query);
    setFilters(prev => ({ ...prev, ...saved.filters }));
    // Trigger search
    setTimeout(() => handleSearch(), 100);
  };

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'message': return 'fa-comment';
      case 'file': return 'fa-file';
      case 'decision': return 'fa-gavel';
      case 'task': return 'fa-check-circle';
      case 'link': return 'fa-link';
      case 'mention': return 'fa-at';
    }
  };

  const getTypeColor = (type: SearchResult['type']) => {
    switch (type) {
      case 'message': return 'text-blue-500 bg-blue-100 dark:bg-blue-900/40';
      case 'file': return 'text-amber-500 bg-amber-100 dark:bg-amber-900/40';
      case 'decision': return 'text-purple-500 bg-purple-100 dark:bg-purple-900/40';
      case 'task': return 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/40';
      case 'link': return 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900/40';
      case 'mention': return 'text-pink-500 bg-pink-100 dark:bg-pink-900/40';
    }
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.type !== 'all') count++;
    if (filters.dateRange !== 'any') count++;
    if (filters.sender !== 'all') count++;
    if (filters.hasAttachment) count++;
    if (filters.hasReaction) count++;
    if (filters.isDecision) count++;
    if (filters.isTask) count++;
    return count;
  }, [filters]);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Search Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search messages, files, decisions..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg border transition flex items-center gap-2 ${
              showFilters || activeFiltersCount > 0
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700'
            }`}
          >
            <i className="fa-solid fa-filter" />
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSearching ? (
              <i className="fa-solid fa-circle-notch fa-spin" />
            ) : (
              'Search'
            )}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-4 animate-slide-down">
            {/* Type & Date Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Content Type
                </label>
                <select
                  value={filters.type}
                  onChange={e => handleFilterChange('type', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {filterOptions.type.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Date Range
                </label>
                <select
                  value={filters.dateRange}
                  onChange={e => handleFilterChange('dateRange', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {filterOptions.dateRange.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Date Range */}
            {filters.dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    From
                  </label>
                  <input
                    type="date"
                    value={filters.customDateFrom}
                    onChange={e => handleFilterChange('customDateFrom', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    To
                  </label>
                  <input
                    type="date"
                    value={filters.customDateTo}
                    onChange={e => handleFilterChange('customDateTo', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Sender & Sort Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  From
                </label>
                <select
                  value={filters.sender}
                  onChange={e => handleFilterChange('sender', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Anyone</option>
                  <option value="me">Me</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={e => handleFilterChange('sortBy', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {filterOptions.sortBy.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Toggle Filters */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'hasAttachment', label: 'Has Attachment', icon: 'fa-paperclip' },
                { key: 'hasReaction', label: 'Has Reactions', icon: 'fa-heart' },
                { key: 'isDecision', label: 'Decisions Only', icon: 'fa-gavel' },
                { key: 'isTask', label: 'Tasks Only', icon: 'fa-check-circle' }
              ].map(toggle => (
                <button
                  key={toggle.key}
                  onClick={() => handleFilterChange(toggle.key, !filters[toggle.key as keyof typeof filters])}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    filters[toggle.key as keyof typeof filters]
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                  }`}
                >
                  <i className={`fa-solid ${toggle.icon}`} />
                  {toggle.label}
                </button>
              ))}
            </div>

            {/* Clear & Save */}
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setFilters({
                  type: 'all',
                  dateRange: 'any',
                  customDateFrom: '',
                  customDateTo: '',
                  sender: 'all',
                  hasAttachment: false,
                  hasReaction: false,
                  isDecision: false,
                  isTask: false,
                  sortBy: 'relevance'
                })}
                className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Clear all filters
              </button>
              {query && (
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <i className="fa-solid fa-bookmark" />
                  Save this search
                </button>
              )}
            </div>
          </div>
        )}

        {/* Saved Searches */}
        {savedSearches.length > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider py-1">Saved:</span>
            {savedSearches.map(saved => (
              <button
                key={saved.id}
                onClick={() => applySavedSearch(saved)}
                className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition"
              >
                <i className="fa-solid fa-bookmark text-[10px]" />
                {saved.name}
                <button
                  onClick={e => { e.stopPropagation(); onDeleteSavedSearch?.(saved.id); }}
                  className="opacity-0 group-hover:opacity-100 ml-1 text-zinc-400 hover:text-red-500"
                >
                  <i className="fa-solid fa-times text-[10px]" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="max-h-80 overflow-y-auto">
          <div className="p-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {results.length} results found
            </span>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {results.map(result => (
              <button
                key={result.id}
                onClick={() => onResultClick?.(result)}
                className="w-full p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getTypeColor(result.type)}`}>
                    <i className={`fa-solid ${getTypeIcon(result.type)} text-xs`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-zinc-800 dark:text-white">
                        {result.threadName}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {result.sender}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      {highlightText(result.content, query)}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                      <span>{new Date(result.timestamp).toLocaleDateString()}</span>
                      <span>·</span>
                      <span>{Math.round(result.matchScore * 100)}% match</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {query && !isSearching && results.length === 0 && (
        <div className="p-8 text-center text-zinc-400 dark:text-zinc-500">
          <i className="fa-solid fa-search text-3xl mb-3" />
          <p className="text-sm">No results found for "{query}"</p>
          <p className="text-xs mt-1">Try different keywords or adjust filters</p>
        </div>
      )}

      {/* Save Search Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowSaveModal(false)}>
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="font-bold text-zinc-800 dark:text-white">Save Search</h3>
            </div>
            <div className="p-4">
              <input
                type="text"
                value={saveSearchName}
                onChange={e => setSaveSearchName(e.target.value)}
                placeholder="Search name..."
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSearch}
                disabled={!saveSearchName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;
