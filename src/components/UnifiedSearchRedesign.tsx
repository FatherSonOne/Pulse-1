import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Search,
  Filter,
  RefreshCw,
  Star,
  Clock,
  Tag,
  X,
  Sparkles,
  Plus,
  Pin,
  StickyNote,
  Save,
  Users,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  FileText,
  CheckSquare,
  Square,
  TrendingUp,
  List,
  Grid,
  ChevronDown,
  Folder,
  Mic,
  Download,
  Link as LinkIcon,
  Share2,
  Bookmark,
  Globe,
  ExternalLink,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Layout,
  Maximize2,
  Command
} from 'lucide-react';
import { unifiedSearchService, SearchResult, SearchResultType, SearchFilters, SearchSortOptions, SearchSourceError } from '../services/unifiedSearchService';
import { searchClipboardService, ClipboardItem } from '../services/searchClipboardService';
import { dataService } from '../services/dataService';
import { searchEnhancements, SearchSuggestion, SonarWebResult } from '../services/searchEnhancements';
import { searchAI } from '../services/searchAI';
import { searchExport } from '../services/searchExport';
import { savedSearchesService, SavedSearch } from '../services/savedSearches';
import { voiceSearchService } from '../services/voiceSearch';
import { searchAnalyticsService } from '../services/searchAnalyticsService';
import { RichTextEditor } from './RichTextEditor';
import './UnifiedSearchRedesign.css';
import { SearchResultSkeleton } from './SearchResultSkeleton';
import { OperatorReferencePopover } from './OperatorReferencePopover';
import { SaveSearchModal } from './SaveSearchModal';
import { SearchDetailPanel } from './SearchDetailPanel';

/**
 * Unified Search Redesign
 * 3-Column Modern Layout: Filters | Results | Clipboard
 */

const resultTypeIcons: Record<SearchResultType, any> = {
  message: MessageSquare,
  email: Mail,
  vox: Mic,
  note: StickyNote,
  task: CheckSquare,
  event: Calendar,
  thread: Hash,
  contact: Users,
  sms: Phone,
  unified_message: MessageSquare,
  archive: Folder,
};

// Fallback icon helper
function getIcon(type: SearchResultType) {
  return resultTypeIcons[type] || FileText;
}

function Hash(props: any) { return <span {...props}>#</span> } // Fallback for thread icon

type ViewMode = 'list' | 'grid' | 'timeline';
type ClipboardView = 'notes' | 'categories';

export default function UnifiedSearchRedesign() {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // Layout State
  const [showFilters, setShowFilters] = useState(true);
  const [showClipboard, setShowClipboard] = useState(true);
  
  // Clipboard State
  const [clipboardView, setClipboardView] = useState<ClipboardView>('notes');
  const [quickNoteText, setQuickNoteText] = useState('');
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>([]);
  const [selectedClipboardCategory, setSelectedClipboardCategory] = useState<string | null>(null);
  const [newClipboardNote, setNewClipboardNote] = useState({ title: '', content: '' });
  const [showNewNoteForm, setShowNewNoteForm] = useState(false);

  // Enhanced features state
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [useAISearch, setUseAISearch] = useState(
    () => localStorage.getItem('pulse:search:useAI') !== 'false'
  );
  const [isListening, setIsListening] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [linkingMode, setLinkingMode] = useState<string | null>(null);

  // Search source errors (from Promise.allSettled)
  const [searchErrors, setSearchErrors] = useState<SearchSourceError[]>([]);

  // Web search (Sonar) state
  const [useWebSearch, setUseWebSearch] = useState(
    () => localStorage.getItem('pulse:search:useWeb') !== 'false'
  );
  const [webSearchResult, setWebSearchResult] = useState<SonarWebResult | null>(null);
  const [webSearchLoading, setWebSearchLoading] = useState(false);
  const [webSearchModel, setWebSearchModel] = useState<'sonar' | 'sonar-pro' | 'sonar-reasoning'>('sonar');

  // Allow other parts of the app (e.g., voice commands) to set the search query
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ query?: string }>;
      const q = (ce.detail?.query || '').trim();
      if (q) setSearchQuery(q);
    };
    window.addEventListener('pulse:set-search-query', handler as EventListener);
    return () => window.removeEventListener('pulse:set-search-query', handler as EventListener);
  }, []);

  // Focus search input when Cmd+K navigates here
  useEffect(() => {
    const handler = () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener('pulse:focus-search', handler);
    return () => window.removeEventListener('pulse:focus-search', handler);
  }, []);

  // Filters
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sortOptions, setSortOptions] = useState<SearchSortOptions>({ field: 'timestamp', order: 'desc' });
  const [selectedTypes, setSelectedTypes] = useState<Set<SearchResultType>>(new Set());

  const userId = dataService.getUserId();
  const apiKey = import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Streaming / stale-result guard
  const searchGeneration = useRef(0);

  // Infinite scroll
  const [visibleCount, setVisibleCount] = useState(20);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Save Search modal
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Result detail panel
  const [detailResult, setDetailResult] = useState<SearchResult | null>(null);

  // Operator autocomplete
  const [operatorHints, setOperatorHints] = useState<string[]>([]);
  const [showOperatorHints, setShowOperatorHints] = useState(false);
  const [operatorHintsIndex, setOperatorHintsIndex] = useState(-1);
  const [showOperatorPopover, setShowOperatorPopover] = useState(false);

  // --- Logic copied from UnifiedSearch.tsx ---

  const performSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setWebSearchResult(null);
      return;
    }

    const generation = ++searchGeneration.current;
    setLoading(true);
    setSearchErrors([]);
    setSearchResults([]);   // clear previous
    setVisibleCount(20);    // reset pagination

    // Web Search (fire and forget)
    if (useWebSearch) {
      setWebSearchLoading(true);
      searchEnhancements.sonarWebSearch(searchQuery, { model: webSearchModel })
        .then(setWebSearchResult)
        .catch(error => {
          console.error('Web search error:', error);
          setWebSearchResult(null);
        })
        .finally(() => setWebSearchLoading(false));
    } else {
      setWebSearchResult(null);
    }

    try {
      await searchEnhancements.saveSearchToHistory(userId, searchQuery);
      const activeFilters: SearchFilters = {
        ...filters,
        types: selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined,
      };

      const { results, errors } = await searchEnhancements.enhancedSearch(
        searchQuery,
        userId,
        apiKey,
        activeFilters,
        useAISearch,
        (partial) => {
          if (searchGeneration.current !== generation) return; // stale guard
          setSearchResults(partial);
        }
      );

      if (searchGeneration.current !== generation) return;
      setSearchResults(results);
      setSearchErrors(errors);
      setShowSuggestions(false);
      searchAnalyticsService.trackSearch(userId, searchQuery, results.length);
    } catch (error) {
      console.error('Search error:', error);
      if (searchGeneration.current === generation) setSearchResults([]);
    } finally {
      if (searchGeneration.current === generation) setLoading(false);
    }
  }, [searchQuery, filters, selectedTypes, useAISearch, useWebSearch, webSearchModel, userId, apiKey]);

  // Debounce (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) performSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Preferences toggles (persist to localStorage)
  const toggleAISearch = () => {
    setUseAISearch(v => {
      const next = !v;
      localStorage.setItem('pulse:search:useAI', String(next));
      return next;
    });
  };
  const toggleWebSearch = () => {
    setUseWebSearch(v => {
      const next = !v;
      localStorage.setItem('pulse:search:useWeb', String(next));
      return next;
    });
  };

  // Infinite scroll — load more when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setVisibleCount(c => c + 20); },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [searchResults.length]);

  // Operator autocomplete hints
  useEffect(() => {
    const q = searchQuery;
    if (/^from:/i.test(q)) {
      // getSuggestions handles from: prefix and returns contact suggestions
      searchEnhancements.getSuggestions(q, userId, 5).then(suggestions => {
        const hints = suggestions.filter(s => s.type === 'contact').map(s => s.text);
        setOperatorHints(hints);
        setShowOperatorHints(hints.length > 0);
      });
    } else if (/^(after|before):/i.test(q)) {
      const prefix = (q.match(/^(after|before):/i) || [''])[0];
      const hints = ['today', 'last week', 'last month', 'this year'].map(d => `${prefix}${d}`);
      setOperatorHints(hints);
      setShowOperatorHints(true);
    } else {
      setOperatorHints([]);
      setShowOperatorHints(false);
    }
    setOperatorHintsIndex(-1);
  }, [searchQuery, userId]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Suggestions
  useEffect(() => {
    if (searchQuery.length > 0) {
      searchEnhancements.getSuggestions(searchQuery, userId, 6).then(setSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery, userId]);

  // Load Saved Data
  useEffect(() => {
    savedSearchesService.getSavedSearches(userId).then(setSavedSearches).catch(console.error);
    loadClipboardItems();
  }, [userId]);

  const loadClipboardItems = useCallback(async () => {
    try {
      const items = await searchClipboardService.getClipboardItems(userId, {
        category: selectedClipboardCategory || undefined,
      });
      setClipboardItems(items);
    } catch (error) {
      console.error('Error loading clipboard items:', error);
    }
  }, [userId, selectedClipboardCategory]);

  useEffect(() => {
      loadClipboardItems();
  }, [selectedClipboardCategory, loadClipboardItems]);

  // Helpers
  const handleClipResult = async (result: SearchResult) => {
    searchAnalyticsService.trackClick(userId, searchQuery, result.type);
    try {
      await searchClipboardService.clipSearchResult(userId, result);
      await loadClipboardItems();
    } catch (error) { console.error(error); }
  };

  const handleQuickNote = async () => {
    if (!quickNoteText.trim()) return;
    try {
        const lines = quickNoteText.trim().split('\n');
        const title = lines[0].length > 50 ? lines[0].substring(0, 50) + '...' : lines[0];
        const content = lines.length > 1 ? lines.slice(1).join('\n') : quickNoteText.trim();
        await searchClipboardService.createClipboardItem(userId, {
            title: title || 'Quick Note',
            content: content || quickNoteText.trim(),
            contentType: 'note',
            tags: [],
            pinned: false,
            relatedItems: [],
            metadata: {}
        });
        setQuickNoteText('');
        await loadClipboardItems();
    } catch (e) { console.error(e); }
  };

  const handleVoiceSearch = async () => {
      if (!voiceSearchService.isVoiceSearchSupported()) return alert('Voice search not supported');
      setIsListening(true);
      try {
          const res = await voiceSearchService.startListening();
          setSearchQuery(res.transcript);
          performSearch(); // Trigger search immediately
      } catch (e) { console.error(e); }
      finally { setIsListening(false); }
  };

  // Export handlers
  const handleExport = (format: 'csv' | 'pdf' | 'markdown') => {
    if (format === 'csv') {
      searchExport.exportToCSV(searchResults, 'search-results');
    } else if (format === 'pdf') {
      searchExport.exportToPDF(searchResults, 'Search Results');
    } else if (format === 'markdown') {
      searchExport.exportClipboardToMarkdown(clipboardItems, 'clipboard');
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Keyboard navigation across result cards
  const handleResultsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const cards = Array.from(
      (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="article"]')
    );
    const focused = document.activeElement as HTMLElement;
    const idx = cards.indexOf(focused);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = cards[idx + 1] ?? cards[0];
      next?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx <= 0) {
        searchInputRef.current?.focus();
      } else {
        cards[idx - 1]?.focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchQuery('');
      searchInputRef.current?.focus();
    }
  };

  // ── Timeline grouping helper ───────────────────────────────────────────────
  const groupResultsByDate = (results: SearchResult[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86_400_000);
    const weekAgo = new Date(today.getTime() - 7 * 86_400_000);
    const monthAgo = new Date(today.getTime() - 30 * 86_400_000);

    const buckets: { label: string; items: SearchResult[] }[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'This Week', items: [] },
      { label: 'This Month', items: [] },
      { label: 'Older', items: [] },
    ];

    for (const r of results) {
      const d = new Date(r.timestamp.getFullYear(), r.timestamp.getMonth(), r.timestamp.getDate());
      if (d >= today) buckets[0].items.push(r);
      else if (d >= yesterday) buckets[1].items.push(r);
      else if (d >= weekAgo) buckets[2].items.push(r);
      else if (d >= monthAgo) buckets[3].items.push(r);
      else buckets[4].items.push(r);
    }
    return buckets.filter(b => b.items.length > 0);
  };

  // ── Batch action handlers ─────────────────────────────────────────────────
  const handleBatchClip = async () => {
    const toClip = searchResults.filter(r => selectedResults.has(r.id));
    for (const result of toClip) {
      try { await searchClipboardService.clipSearchResult(userId, result); } catch { /* continue */ }
    }
    await loadClipboardItems();
    setSelectedResults(new Set());
  };

  const handleBatchExport = () => {
    const toExport = searchResults.filter(r => selectedResults.has(r.id));
    searchExport.exportToCSV(toExport, 'selected-results');
    setSelectedResults(new Set());
  };

  // --- Render ---

  return (
    <div className="search-redesign-container">
      {/* 1. Header */}
      <header className="search-redesign-header">
        <div className="search-title-section">
          <Sparkles className="text-pink-500" size={24} />
          <h2>Search</h2>
        </div>
        <div className="search-header-controls">
          <button 
            className={`search-action-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle Filters"
          >
            <Filter size={20} />
          </button>
          <button 
            className={`search-action-btn ${showClipboard ? 'active' : ''}`}
            onClick={() => setShowClipboard(!showClipboard)}
            title="Toggle Clipboard"
          >
            <StickyNote size={20} />
          </button>
          <div className="w-px h-6 bg-gray-200 mx-2" />
          <button
            type="button"
            className="search-action-btn"
            title="Save current search"
            aria-label="Save current search"
            onClick={() => setShowSaveModal(true)}
            disabled={!searchQuery.trim()}
          >
            <Bookmark size={20} />
          </button>
          <button
            className="search-action-btn"
            title="Export"
            onClick={() => {
                const format = window.confirm('Export as CSV? (Click Cancel for Markdown)') ? 'csv' : 'markdown';
                handleExport(format);
            }}
          >
            <Download size={20} />
          </button>
        </div>
      </header>

      {/* Save Search Modal */}
      <SaveSearchModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        query={searchQuery}
        filters={{ ...filters, types: selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined }}
        userId={userId}
        onSaved={() => savedSearchesService.getSavedSearches(userId).then(setSavedSearches).catch(console.error)}
      />

      {/* 2. Body Grid */}
      <div className={`search-redesign-body ${showClipboard ? 'clipboard-open' : ''}`} style={{
          gridTemplateColumns: `${showFilters ? '260px' : '0px'} 1fr ${showClipboard ? '320px' : '0px'}`
      }}>
        
        {/* LEFT: Filters */}
        <aside className="search-filters-sidebar" style={{ display: showFilters ? 'flex' : 'none' }}>
            <div className="filter-group">
                <h3>Views</h3>
                <div className="filter-options">
                    <button className={`filter-option-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
                        <List size={16} /> List View
                    </button>
                    <button className={`filter-option-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
                        <Grid size={16} /> Grid View
                    </button>
                    <button className={`filter-option-btn ${viewMode === 'timeline' ? 'active' : ''}`} onClick={() => setViewMode('timeline')}>
                        <Clock size={16} /> Timeline
                    </button>
                </div>
            </div>

            <div className="filter-group">
                <h3>Saved Searches</h3>
                <div className="filter-options">
                    {savedSearches.slice(0, 5).map(s => (
                        <button key={s.id} className="filter-option-btn" onClick={() => {
                            setSearchQuery(s.query);
                            setFilters(s.filters);
                        }}>
                            <Bookmark size={14} /> {s.name}
                        </button>
                    ))}
                    {savedSearches.length === 0 && <span className="text-xs text-gray-400 px-3">No saved searches</span>}
                </div>
            </div>

            <div className="filter-group">
                <h3>Content Type</h3>
                <div className="filter-options">
                    {Object.entries(resultTypeIcons).map(([type, Icon]) => (
                        <button
                            key={type}
                            className={`filter-option-btn ${selectedTypes.has(type as SearchResultType) ? 'active' : ''}`}
                            onClick={() => {
                                const newTypes = new Set(selectedTypes);
                                if (newTypes.has(type as SearchResultType)) newTypes.delete(type as SearchResultType);
                                else newTypes.add(type as SearchResultType);
                                setSelectedTypes(newTypes);
                            }}
                        >
                            <Icon size={14} /> 
                            <span className="capitalize">{type.replace('_', ' ')}</span>
                        </button>
                    ))}
                </div>
            </div>
        </aside>

        {/* CENTER: Results */}
        <main className="search-results-area">
            {/* Hero Search Bar */}
            <div className="hero-search-container">
                <div className="search-input-wrapper relative">
                    <Search className="text-gray-400 ml-2" size={20} />
                    <input
                        ref={searchInputRef}
                        className="main-search-input"
                        placeholder="Search everything... (/)"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onKeyDown={(e) => {
                            if (!showOperatorHints || operatorHints.length === 0) return;
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setOperatorHintsIndex(i => Math.min(i + 1, operatorHints.length - 1));
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setOperatorHintsIndex(i => Math.max(i - 1, -1));
                            } else if (e.key === 'Enter' && operatorHintsIndex >= 0) {
                                e.preventDefault();
                                setSearchQuery(operatorHints[operatorHintsIndex]);
                                setShowOperatorHints(false);
                            } else if (e.key === 'Escape') {
                                setShowOperatorHints(false);
                            }
                        }}
                    />
                    <div className="search-actions-right">
                        {searchQuery && (
                            <button type="button" className="search-action-btn" onClick={() => setSearchQuery('')} title="Clear search" aria-label="Clear search">
                                <X size={16} />
                            </button>
                        )}
                        <button
                            className={`search-action-btn ${isListening ? 'active' : ''}`}
                            onClick={handleVoiceSearch}
                            title="Voice search"
                        >
                            <Mic size={18} />
                        </button>
                        <button
                            className={`search-action-btn ${useWebSearch ? 'active' : ''}`}
                            onClick={toggleWebSearch}
                            title="Toggle Web Search (Perplexity)"
                        >
                            <Globe size={18} />
                        </button>
                        <button
                            className={`search-action-btn ${showOperatorPopover ? 'active' : ''}`}
                            onClick={() => setShowOperatorPopover(v => !v)}
                            title="Search operators"
                        >
                            <Command size={16} />
                        </button>
                    </div>

                    {/* Operator reference popover */}
                    <OperatorReferencePopover
                        isOpen={showOperatorPopover}
                        onClose={() => setShowOperatorPopover(false)}
                        onInsert={(text) => {
                            const input = searchInputRef.current;
                            if (!input) { setSearchQuery(q => q + text); return; }
                            const start = input.selectionStart ?? searchQuery.length;
                            const end = input.selectionEnd ?? searchQuery.length;
                            const next = searchQuery.slice(0, start) + text + searchQuery.slice(end);
                            setSearchQuery(next);
                            setTimeout(() => {
                                input.focus();
                                input.setSelectionRange(start + text.length, start + text.length);
                            }, 0);
                        }}
                    />

                    {/* Operator autocomplete dropdown */}
                    {showOperatorHints && operatorHints.length > 0 && (
                        <ul className="absolute left-0 top-full mt-1 z-50 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md text-sm overflow-hidden">
                            {operatorHints.map((hint, i) => (
                                <li
                                    key={hint}
                                    className={`px-3 py-2 cursor-pointer ${i === operatorHintsIndex ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                    onMouseDown={(e) => {
                                        e.preventDefault(); // keep input focused
                                        setSearchQuery(hint);
                                        setShowOperatorHints(false);
                                    }}
                                >
                                    <code className="font-mono">{hint}</code>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Suggestions Dropdown */}
                    {showSuggestions && !showOperatorHints && suggestions.length > 0 && (
                        <div className="modern-suggestions">
                            {suggestions.map(s => (
                                <div
                                    key={s.id}
                                    className="suggestion-row"
                                    onClick={() => {
                                        setSearchQuery(s.text);
                                        setShowSuggestions(false);
                                        performSearch();
                                    }}
                                >
                                    <Search size={14} className="text-gray-400" />
                                    <span>{s.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Source Error Badges */}
            {searchErrors.length > 0 && (
                <div className="flex gap-2 flex-wrap px-1 py-2">
                    {searchErrors.map(err => (
                        <span
                            key={err.source}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                            title={err.error}
                        >
                            ⚠ {err.source === 'gmail' ? 'Gmail disconnected' : `${err.source} unavailable`}
                        </span>
                    ))}
                </div>
            )}

            {/* AI/Web Answer Card */}
            {webSearchResult && (
                <div className="ai-answer-card">
                    <div className="ai-answer-header">
                        <Sparkles size={16} />
                        AI Overview
                    </div>
                    <div className="ai-answer-content prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{webSearchResult.answer}</ReactMarkdown>
                    </div>
                    {webSearchResult.citations.length > 0 && (
                        <div className="flex gap-2 mt-4 flex-wrap">
                            {webSearchResult.citations.map((c, i) => (
                                <a key={i} href={c} target="_blank" rel="noopener noreferrer" className="text-xs bg-white/50 dark:bg-zinc-800/50 px-2 py-1 rounded-full border border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300 truncate max-w-[200px] hover:bg-pink-50 dark:hover:bg-pink-900/30 transition-colors">
                                    {new URL(c).hostname}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Empty State */}
            {!loading && !webSearchResult && searchResults.length === 0 && searchQuery.trim() && (
                <div className="empty-dashboard-state">
                    <Search className="empty-dashboard-icon" />
                    <h3>No results found</h3>
                    <p>Try adjusting your search terms or filters</p>
                </div>
            )}

            {/* Result count */}
            {searchResults.length > 0 && (
                <p className="text-xs text-gray-400 px-1 py-1">
                    Showing {Math.min(visibleCount, searchResults.length)} of {searchResults.length} results
                </p>
            )}

            {/* ARIA live region — announces result count to screen readers */}
            <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {loading ? 'Searching...' : searchResults.length > 0 ? `${searchResults.length} results for "${searchQuery}"` : ''}
            </div>

            {/* Batch Action Toolbar */}
            {selectedResults.size > 0 && (
                <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-lg bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-700 text-sm">
                    <span className="font-medium text-pink-700 dark:text-pink-300">{selectedResults.size} selected</span>
                    <button type="button" onClick={handleBatchClip} className="px-3 py-1 rounded-md bg-pink-500 text-white text-xs font-medium hover:bg-pink-600 transition-colors">
                        Clip all
                    </button>
                    <button type="button" onClick={handleBatchExport} className="px-3 py-1 rounded-md bg-white dark:bg-gray-800 border border-pink-200 dark:border-pink-700 text-pink-700 dark:text-pink-300 text-xs font-medium hover:bg-pink-50 dark:hover:bg-pink-900/30 transition-colors">
                        Export CSV
                    </button>
                    <button type="button" onClick={() => setSelectedResults(new Set())} className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        Clear selection
                    </button>
                </div>
            )}

            {/* Results List */}
            <div
                className={`results-feed ${viewMode}`}
                role="search"
                aria-label="Search results"
                onKeyDown={handleResultsKeyDown}
            >
                {viewMode === 'timeline'
                  ? groupResultsByDate(searchResults.slice(0, visibleCount)).map(group => (
                      <React.Fragment key={group.label}>
                          <div className="timeline-date-header flex items-center gap-2 py-2 px-1 mt-2 first:mt-0">
                              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">{group.label}</span>
                              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                          </div>
                          {group.items.map(result => {
                              const Icon = getIcon(result.type);
                              return (
                                  <div
                                      key={result.id}
                                      className="result-card-modern group"
                                      role="article"
                                      tabIndex={0}
                                      onClick={() => setDetailResult(result)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') setDetailResult(result); }}
                                  >
                                      <button
                                          type="button"
                                          title={selectedResults.has(result.id) ? 'Deselect' : 'Select'}
                                          aria-label={selectedResults.has(result.id) ? 'Deselect result' : 'Select result'}
                                          className={`absolute top-4 right-4 p-1 rounded-full z-10 transition-all ${selectedResults.has(result.id) ? 'bg-pink-500 text-white opacity-100' : 'bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100'}`}
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              const newSet = new Set(selectedResults);
                                              if (newSet.has(result.id)) newSet.delete(result.id);
                                              else newSet.add(result.id);
                                              setSelectedResults(newSet);
                                          }}
                                      >
                                          <CheckSquare size={14} />
                                      </button>
                                      <div className="result-header-row">
                                          <span className="result-source-badge"><Icon size={12} /><span className="capitalize">{result.type}</span></span>
                                          <span className="result-timestamp">{formatTimestamp(result.timestamp)}</span>
                                      </div>
                                      <h4 className="result-title-modern">{result.title}</h4>
                                      <p className="result-snippet">{result.content}</p>
                                  </div>
                              );
                          })}
                      </React.Fragment>
                    ))
                  : searchResults.slice(0, visibleCount).map(result => {
                      const Icon = getIcon(result.type);
                      return (
                          <div
                              key={result.id}
                              className="result-card-modern group"
                              role="article"
                              tabIndex={0}
                              onClick={() => setDetailResult(result)}
                              onKeyDown={(e) => { if (e.key === 'Enter') setDetailResult(result); }}
                          >
                              <button
                                  type="button"
                                  title={selectedResults.has(result.id) ? 'Deselect' : 'Select'}
                                  aria-label={selectedResults.has(result.id) ? 'Deselect result' : 'Select result'}
                                  className={`absolute top-4 right-4 p-1 rounded-full z-10 transition-all ${selectedResults.has(result.id) ? 'bg-pink-500 text-white opacity-100' : 'bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100'}`}
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      const newSet = new Set(selectedResults);
                                      if (newSet.has(result.id)) newSet.delete(result.id);
                                      else newSet.add(result.id);
                                      setSelectedResults(newSet);
                                  }}
                              >
                                  <CheckSquare size={14} />
                              </button>
                              <div className="result-header-row">
                                  <span className="result-source-badge"><Icon size={12} /><span className="capitalize">{result.type}</span></span>
                                  <span className="result-timestamp">{formatTimestamp(result.timestamp)}</span>
                              </div>
                              <h4 className="result-title-modern">{result.title}</h4>
                              <p className="result-snippet">{result.content}</p>
                          </div>
                      );
                    })
                }

                {/* Skeleton cards shown at end of list while loading */}
                {loading && <SearchResultSkeleton count={8} />}

                {/* Infinite scroll sentinel */}
                {!loading && visibleCount < searchResults.length && (
                    <div ref={sentinelRef} className="scroll-sentinel h-1" aria-hidden="true" />
                )}
            </div>

        </main>

        {/* RIGHT: Clipboard */}
        <aside className="clipboard-sidebar" style={{ display: showClipboard ? 'flex' : 'none' }}>
            <div className="clipboard-header">
                <h3>Clipboard</h3>
                <div className="flex gap-1">
                    <button type="button" className="search-action-btn" onClick={() => setClipboardView(clipboardView === 'notes' ? 'categories' : 'notes')} title={clipboardView === 'notes' ? 'Show categories' : 'Show notes'} aria-label={clipboardView === 'notes' ? 'Show categories' : 'Show notes'}>
                        {clipboardView === 'notes' ? <Folder size={16} /> : <StickyNote size={16} />}
                    </button>
                    <button type="button" className="search-action-btn" title="Expand clipboard" aria-label="Expand clipboard">
                        <Maximize2 size={16} />
                    </button>
                </div>
            </div>

            <div className="new-note-input-area">
                <div className="flex gap-2">
                    <input 
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-400"
                        placeholder="Quick note..."
                        value={quickNoteText}
                        onChange={e => setQuickNoteText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleQuickNote()}
                    />
                    <button type="button" className="bg-pink-500 text-white p-2 rounded-lg" onClick={handleQuickNote} title="Add note" aria-label="Add note">
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            <div className="clipboard-content-area">
                {clipboardItems.map(item => (
                    <div key={item.id} className="clipboard-item-card">
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-semibold text-sm line-clamp-1">{item.title}</span>
                            <Pin size={12} className={item.pinned ? 'text-yellow-500' : 'text-gray-300'} />
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-3 mb-2" dangerouslySetInnerHTML={{ __html: item.content }} />
                        <div className="flex justify-between items-center text-xs text-gray-400">
                            <span>{formatTimestamp(new Date(item.createdAt))}</span>
                            {item.category && <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{item.category}</span>}
                        </div>
                    </div>
                ))}
                {clipboardItems.length === 0 && (
                    <div className="text-center text-gray-400 py-10">
                        <StickyNote size={24} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs">Clipboard is empty</p>
                    </div>
                )}
            </div>
        </aside>

      </div>

      {/* Result Detail Panel */}
      <SearchDetailPanel
        result={detailResult}
        onClose={() => setDetailResult(null)}
        onClip={(r) => { handleClipResult(r); setDetailResult(null); }}
      />
    </div>
  );
}
