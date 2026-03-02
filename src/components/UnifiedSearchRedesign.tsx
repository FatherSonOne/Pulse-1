import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Search,
  Filter,
  Clock,
  X,
  Sparkles,
  Plus,
  Pin,
  StickyNote,
  Users,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  FileText,
  CheckSquare,
  List,
  Grid,
  Folder,
  Mic,
  Download,
  Bookmark,
  Globe,
  ExternalLink,
  Loader2,
  Maximize2,
  Command,
} from 'lucide-react';
import { SearchResult, SearchResultType, SearchFilters, SearchSortOptions, SearchSourceError } from '../services/unifiedSearchService';
import { searchClipboardService, ClipboardItem } from '../services/searchClipboardService';
import { dataService } from '../services/dataService';
import { searchEnhancements, SearchSuggestion, SonarWebResult } from '../services/searchEnhancements';
import { searchExport } from '../services/searchExport';
import { savedSearchesService, SavedSearch } from '../services/savedSearches';
import { voiceSearchService } from '../services/voiceSearch';
import { searchAnalyticsService } from '../services/searchAnalyticsService';
import './UnifiedSearchRedesign.css';
import { SearchResultSkeleton } from './SearchResultSkeleton';
import { OperatorReferencePopover } from './OperatorReferencePopover';
import { SaveSearchModal } from './SaveSearchModal';
import { SearchDetailPanel } from './SearchDetailPanel';

// ── Icon maps ─────────────────────────────────────────────────────────────────

const resultTypeIcons: Record<SearchResultType, React.ElementType> = {
  message:         MessageSquare,
  email:           Mail,
  vox:             Mic,
  note:            StickyNote,
  task:            CheckSquare,
  event:           Calendar,
  thread:          MessageSquare,
  contact:         Users,
  sms:             Phone,
  unified_message: MessageSquare,
  archive:         Folder,
};

function getIcon(type: SearchResultType): React.ElementType {
  return resultTypeIcons[type] || FileText;
}

// ── Strip HTML tags to plain text (safe clipboard preview) ────────────────────
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Quick-access category cards shown in welcome state ────────────────────────
const QUICK_CATEGORIES: {
  type: SearchResultType;
  label: string;
  icon: React.ElementType;
  query: string;
}[] = [
  { type: 'email',   label: 'Emails',   icon: Mail,          query: 'type:email' },
  { type: 'message', label: 'Messages', icon: MessageSquare, query: 'type:message' },
  { type: 'task',    label: 'Tasks',    icon: CheckSquare,   query: 'type:task' },
  { type: 'contact', label: 'People',   icon: Users,         query: 'type:contact' },
  { type: 'vox',     label: 'Vox',      icon: Mic,           query: 'type:vox' },
  { type: 'note',    label: 'Notes',    icon: StickyNote,    query: 'type:note' },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type ViewMode      = 'list' | 'grid' | 'timeline';
type ClipboardView = 'notes' | 'categories';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTimestamp(date: Date): string {
  const now    = Date.now();
  const diff   = now - date.getTime();
  const minute = 60_000;
  const hour   = 60 * minute;
  const day    = 24 * hour;

  if (diff < minute)   return 'just now';
  if (diff < hour)     return `${Math.floor(diff / minute)}m ago`;
  if (diff < day)      return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day)  return `${Math.floor(diff / day)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function groupResultsByDate(results: SearchResult[]) {
  const now       = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const weekAgo   = new Date(today.getTime() - 7  * 86_400_000);
  const monthAgo  = new Date(today.getTime() - 30 * 86_400_000);

  const buckets: { label: string; items: SearchResult[] }[] = [
    { label: 'Today',      items: [] },
    { label: 'Yesterday',  items: [] },
    { label: 'This Week',  items: [] },
    { label: 'This Month', items: [] },
    { label: 'Older',      items: [] },
  ];

  for (const r of results) {
    const d = new Date(r.timestamp.getFullYear(), r.timestamp.getMonth(), r.timestamp.getDate());
    if      (d >= today)     buckets[0].items.push(r);
    else if (d >= yesterday) buckets[1].items.push(r);
    else if (d >= weekAgo)   buckets[2].items.push(r);
    else if (d >= monthAgo)  buckets[3].items.push(r);
    else                     buckets[4].items.push(r);
  }
  return buckets.filter(b => b.items.length > 0);
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function UnifiedSearchRedesign() {

  // ── Core state ───────────────────────────────────────────────────────────────
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [viewMode,      setViewMode]      = useState<ViewMode>('list');

  // ── Panel visibility ─────────────────────────────────────────────────────────
  const [showFilters,   setShowFilters]   = useState(true);
  const [showClipboard, setShowClipboard] = useState(true);

  // ── Clipboard ────────────────────────────────────────────────────────────────
  const [clipboardView,             setClipboardView]             = useState<ClipboardView>('notes');
  const [quickNoteText,             setQuickNoteText]             = useState('');
  const [clipboardItems,            setClipboardItems]            = useState<ClipboardItem[]>([]);
  const [selectedClipboardCategory, setSelectedClipboardCategory] = useState<string | null>(null);

  // ── Enhanced features ────────────────────────────────────────────────────────
  const [suggestions,     setSuggestions]     = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [useAISearch,     setUseAISearch]     = useState(
    () => localStorage.getItem('pulse:search:useAI') !== 'false'
  );
  const [isListening,     setIsListening]     = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [savedSearches,   setSavedSearches]   = useState<SavedSearch[]>([]);

  // ── Search errors ────────────────────────────────────────────────────────────
  const [searchErrors, setSearchErrors] = useState<SearchSourceError[]>([]);

  // ── Web search (Sonar) ───────────────────────────────────────────────────────
  const [useWebSearch,     setUseWebSearch]     = useState(
    () => localStorage.getItem('pulse:search:useWeb') !== 'false'
  );
  const [webSearchResult,  setWebSearchResult]  = useState<SonarWebResult | null>(null);
  const [webSearchLoading, setWebSearchLoading] = useState(false);
  const [webSearchModel,   setWebSearchModel]   = useState<'sonar' | 'sonar-pro' | 'sonar-reasoning'>('sonar');

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [filters,       setFilters]       = useState<SearchFilters>({});
  const [selectedTypes, setSelectedTypes] = useState<Set<SearchResultType>>(new Set());

  // ── Operator autocomplete ─────────────────────────────────────────────────────
  const [operatorHints,       setOperatorHints]       = useState<string[]>([]);
  const [showOperatorHints,   setShowOperatorHints]   = useState(false);
  const [operatorHintsIndex,  setOperatorHintsIndex]  = useState(-1);
  const [showOperatorPopover, setShowOperatorPopover] = useState(false);

  // ── Modals & detail panel ────────────────────────────────────────────────────
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [detailResult,  setDetailResult]  = useState<SearchResult | null>(null);

  // ── Pagination ───────────────────────────────────────────────────────────────
  const [visibleCount, setVisibleCount] = useState(20);

  // ── Heartbeat focus animation state ──────────────────────────────────────────
  const [searchBarHeartbeat, setSearchBarHeartbeat] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const searchInputRef   = useRef<HTMLInputElement>(null);
  const searchGeneration = useRef(0);
  const sentinelRef      = useRef<HTMLDivElement>(null);
  const heartbeatTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = dataService.getUserId();
  const apiKey = import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';

  const isEmptyState = !loading && searchResults.length === 0 && !webSearchResult && !searchQuery.trim();

  // ── Heartbeat focus handler — fires animation once per focus ─────────────────
  const handleSearchFocus = () => {
    if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
    setSearchBarHeartbeat(false);
    // Force re-trigger by removing then re-adding class on next tick
    requestAnimationFrame(() => {
      setSearchBarHeartbeat(true);
      // Remove class after animation completes (500ms) so it can re-fire next focus
      heartbeatTimer.current = setTimeout(() => setSearchBarHeartbeat(false), 550);
    });
    setShowSuggestions(true);
  };

  // ── External event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const setQuery = (e: Event) => {
      const q = ((e as CustomEvent<{ query?: string }>).detail?.query || '').trim();
      if (q) setSearchQuery(q);
    };
    const focusSearch = () => { searchInputRef.current?.focus(); searchInputRef.current?.select(); };
    window.addEventListener('pulse:set-search-query', setQuery as EventListener);
    window.addEventListener('pulse:focus-search', focusSearch);
    return () => {
      window.removeEventListener('pulse:set-search-query', setQuery as EventListener);
      window.removeEventListener('pulse:focus-search', focusSearch);
    };
  }, []);

  // ── Global keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault(); searchInputRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Core search ──────────────────────────────────────────────────────────────
  const performSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setWebSearchResult(null);
      return;
    }

    const generation = ++searchGeneration.current;
    setLoading(true);
    setSearchErrors([]);
    setSearchResults([]);
    setVisibleCount(20);

    // Web search — fire and forget
    if (useWebSearch) {
      setWebSearchLoading(true);
      searchEnhancements
        .sonarWebSearch(searchQuery, { model: webSearchModel })
        .then(setWebSearchResult)
        .catch(() => setWebSearchResult(null))
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
        searchQuery, userId, apiKey, activeFilters, useAISearch,
        (partial) => {
          if (searchGeneration.current !== generation) return;
          setSearchResults(partial);
        }
      );

      if (searchGeneration.current !== generation) return;
      setSearchResults(results);
      setSearchErrors(errors);
      setShowSuggestions(false);
      searchAnalyticsService.trackSearch(userId, searchQuery, results.length);
    } catch {
      if (searchGeneration.current === generation) setSearchResults([]);
    } finally {
      if (searchGeneration.current === generation) setLoading(false);
    }
  }, [searchQuery, filters, selectedTypes, useAISearch, useWebSearch, webSearchModel, userId, apiKey]);

  // ── Debounced auto-search ─────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { if (searchQuery.trim()) performSearch(); }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Operator hints ────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = searchQuery;
    if (/^from:/i.test(q)) {
      searchEnhancements.getSuggestions(q, userId, 5).then(s => {
        const hints = s.filter(x => x.type === 'contact').map(x => x.text);
        setOperatorHints(hints);
        setShowOperatorHints(hints.length > 0);
      });
    } else if (/^(after|before):/i.test(q)) {
      const prefix = (q.match(/^(after|before):/i) || [''])[0];
      setOperatorHints(['today', 'last week', 'last month', 'this year'].map(d => `${prefix}${d}`));
      setShowOperatorHints(true);
    } else {
      setOperatorHints([]);
      setShowOperatorHints(false);
    }
    setOperatorHintsIndex(-1);
  }, [searchQuery, userId]);

  // ── Suggestions ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchQuery.length > 0) searchEnhancements.getSuggestions(searchQuery, userId, 6).then(setSuggestions);
    else setSuggestions([]);
  }, [searchQuery, userId]);

  // ── Load saved data ────────────────────────────────────────────────────────────
  const loadClipboardItems = useCallback(async () => {
    try {
      const items = await searchClipboardService.getClipboardItems(userId, {
        category: selectedClipboardCategory || undefined,
      });
      setClipboardItems(items);
    } catch { /* silent */ }
  }, [userId, selectedClipboardCategory]);

  useEffect(() => {
    savedSearchesService.getSavedSearches(userId).then(setSavedSearches).catch(console.error);
    loadClipboardItems();
  }, [userId]);

  useEffect(() => { loadClipboardItems(); }, [selectedClipboardCategory, loadClipboardItems]);

  // ── Infinite scroll ────────────────────────────────────────────────────────────
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

  // ── Preference toggles ─────────────────────────────────────────────────────────
  const toggleAISearch = () => setUseAISearch(v => {
    const next = !v; localStorage.setItem('pulse:search:useAI', String(next)); return next;
  });
  const toggleWebSearch = () => setUseWebSearch(v => {
    const next = !v; localStorage.setItem('pulse:search:useWeb', String(next)); return next;
  });

  // ── Action handlers ────────────────────────────────────────────────────────────
  const handleClipResult = async (result: SearchResult) => {
    searchAnalyticsService.trackClick(userId, searchQuery, result.type);
    try { await searchClipboardService.clipSearchResult(userId, result); await loadClipboardItems(); }
    catch { /* silent */ }
  };

  const handleQuickNote = async () => {
    if (!quickNoteText.trim()) return;
    try {
      const lines   = quickNoteText.trim().split('\n');
      const title   = lines[0].length > 50 ? lines[0].substring(0, 50) + '…' : lines[0];
      const content = lines.length > 1 ? lines.slice(1).join('\n') : quickNoteText.trim();
      await searchClipboardService.createClipboardItem(userId, {
        title: title || 'Quick Note', content: content || quickNoteText.trim(),
        contentType: 'note', tags: [], pinned: false, relatedItems: [], metadata: {},
      });
      setQuickNoteText('');
      await loadClipboardItems();
    } catch { /* silent */ }
  };

  const handleVoiceSearch = async () => {
    if (!voiceSearchService.isVoiceSearchSupported()) return alert('Voice search not supported');
    setIsListening(true);
    try { const res = await voiceSearchService.startListening(); setSearchQuery(res.transcript); performSearch(); }
    catch { /* silent */ }
    finally { setIsListening(false); }
  };

  const handleExport = (format: 'csv' | 'pdf' | 'markdown') => {
    if (format === 'csv')      searchExport.exportToCSV(searchResults, 'search-results');
    else if (format === 'pdf') searchExport.exportToPDF(searchResults, 'Search Results');
    else                       searchExport.exportClipboardToMarkdown(clipboardItems, 'clipboard');
  };

  const handleBatchClip = async () => {
    for (const r of searchResults.filter(r => selectedResults.has(r.id))) {
      try { await searchClipboardService.clipSearchResult(userId, r); } catch { /* skip */ }
    }
    await loadClipboardItems();
    setSelectedResults(new Set());
  };

  const handleBatchExport = () => {
    searchExport.exportToCSV(searchResults.filter(r => selectedResults.has(r.id)), 'selected-results');
    setSelectedResults(new Set());
  };

  const toggleResultSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedResults);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedResults(next);
  };

  const toggleTypeFilter = (type: SearchResultType) => {
    const next = new Set(selectedTypes);
    if (next.has(type)) next.delete(type); else next.add(type);
    setSelectedTypes(next);
  };

  // ── Keyboard nav in results ────────────────────────────────────────────────────
  const handleResultsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const cards   = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="article"]'));
    const focused = document.activeElement as HTMLElement;
    const idx     = cards.indexOf(focused);

    if (e.key === 'ArrowDown')    { e.preventDefault(); (cards[idx + 1] ?? cards[0])?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx <= 0 ? searchInputRef.current?.focus() : cards[idx - 1]?.focus(); }
    else if (e.key === 'Escape')  { e.preventDefault(); setSearchQuery(''); searchInputRef.current?.focus(); }
  };

  // ── Result card ────────────────────────────────────────────────────────────────
  const ResultCard = ({ result }: { result: SearchResult }) => {
    const Icon       = getIcon(result.type);
    const isSelected = selectedResults.has(result.id);
    return (
      <div
        className={`result-card-modern group ${isSelected ? 'selected' : ''}`}
        role="article"
        tabIndex={0}
        onClick={() => setDetailResult(result)}
        onKeyDown={e => { if (e.key === 'Enter') setDetailResult(result); }}
      >
        <button
          type="button"
          className={`result-select-btn ${isSelected ? 'selected' : ''}`}
          title={isSelected ? 'Deselect' : 'Select'}
          aria-label={isSelected ? 'Deselect result' : 'Select result'}
          onClick={e => toggleResultSelect(result.id, e)}
        >
          <CheckSquare size={13} />
        </button>

        {/* Badge + timestamp row */}
        <div className="result-header-row">
          <span className="result-source-badge">
            <Icon size={11} />
            <span>{result.type.replace('_', ' ')}</span>
          </span>
          <span className="result-timestamp">{formatTimestamp(result.timestamp)}</span>
        </div>

        {/* Title — topic level, prominent */}
        <h4 className="result-title-modern">{result.title}</h4>

        {/* Snippet — content level, subordinate */}
        <p className="result-snippet">{result.content}</p>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="search-redesign-container">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="search-redesign-header">
        <div className="search-title-section">
          <Sparkles size={18} color="#f43f5e" />
          <h2>Search</h2>
        </div>

        <div className="search-header-controls">
          {/* View mode strip */}
          <div className="view-toggle-group" role="group" aria-label="View mode">
            {([['list', List, 'List'], ['grid', Grid, 'Grid'], ['timeline', Clock, 'Timeline']] as const).map(
              ([mode, Icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`view-toggle-item ${viewMode === mode ? 'active' : ''}`}
                  onClick={() => setViewMode(mode as ViewMode)}
                  title={`${label} view`}
                  aria-pressed={viewMode === mode ? 'true' : 'false'}
                >
                  <Icon size={13} /><span>{label}</span>
                </button>
              )
            )}
          </div>

          <div className="search-header-divider" />

          <button type="button" className={`search-action-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(v => !v)} title="Toggle filters" aria-label="Toggle filters panel"><Filter size={15} /></button>
          <button type="button" className={`search-action-btn ${showClipboard ? 'active' : ''}`} onClick={() => setShowClipboard(v => !v)} title="Toggle clipboard" aria-label="Toggle clipboard panel"><StickyNote size={15} /></button>

          <div className="search-header-divider" />

          <button type="button" className="search-action-btn" title="Save search" disabled={!searchQuery.trim()} onClick={() => setShowSaveModal(true)} aria-label="Save current search"><Bookmark size={15} /></button>
          <button type="button" className="search-action-btn" title="Export" onClick={() => handleExport(window.confirm('Export as CSV? (Cancel = Markdown)') ? 'csv' : 'markdown')} aria-label="Export results"><Download size={15} /></button>
        </div>
      </header>

      {/* Save search modal */}
      <SaveSearchModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        query={searchQuery}
        filters={{ ...filters, types: selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined }}
        userId={userId}
        onSaved={() => savedSearchesService.getSavedSearches(userId).then(setSavedSearches).catch(console.error)}
      />

      {/* ── 3-Column body ────────────────────────────────────────────────── */}
      <div
        className={`search-redesign-body ${showClipboard ? 'clipboard-open' : ''}`}
        style={{
          gridTemplateColumns: `${showFilters ? 'var(--search-sidebar-width)' : '0px'} 1fr ${showClipboard ? 'var(--search-clipboard-width)' : '0px'}`,
        }}
      >
        {/* ── LEFT: Filters ────────────────────────────────────────────────── */}
        <aside className={`search-filters-sidebar ${showFilters ? '' : 'panel-hidden'}`}>

          <div className="filter-group">
            <h3>Saved Searches</h3>
            <div className="filter-options">
              {savedSearches.slice(0, 6).map(s => (
                <button type="button" key={s.id} className="filter-option-btn"
                  onClick={() => { setSearchQuery(s.query); setFilters(s.filters); }}>
                  <Bookmark size={13} />
                  <span className="filter-name-text">{s.name}</span>
                </button>
              ))}
              {savedSearches.length === 0 && (
                <span className="filter-empty-note">No saved searches yet</span>
              )}
            </div>
          </div>

          <div className="filter-group">
            <h3>Content Type</h3>
            <div className="filter-options">
              {(Object.entries(resultTypeIcons) as [SearchResultType, React.ElementType][]).map(([type, Icon]) => (
                <button type="button" key={type}
                  className={`filter-option-btn ${selectedTypes.has(type) ? 'active' : ''}`}
                  onClick={() => toggleTypeFilter(type)}
                  aria-pressed={selectedTypes.has(type) ? 'true' : 'false'}>
                  <Icon size={13} />
                  <span className="filter-type-label">{type.replace('_', ' ')}</span>
                </button>
              ))}
              {selectedTypes.size > 0 && (
                <button type="button" className="filter-option-btn filter-clear-option" onClick={() => setSelectedTypes(new Set())}>
                  <X size={13} /><span>Clear filters</span>
                </button>
              )}
            </div>
          </div>

          <div className="filter-group">
            <h3>Intelligence</h3>
            <div className="filter-options">
              <button type="button" className={`filter-option-btn ${useAISearch ? 'active' : ''}`} onClick={toggleAISearch} aria-pressed={useAISearch ? 'true' : 'false'}>
                <Sparkles size={13} /><span>AI ranking</span>
              </button>
              <button type="button" className={`filter-option-btn ${useWebSearch ? 'active' : ''}`} onClick={toggleWebSearch} aria-pressed={useWebSearch ? 'true' : 'false'}>
                <Globe size={13} /><span>Web search</span>
              </button>
            </div>
          </div>

          <div className="filter-group">
            <h3>Operators</h3>
            <div className="filter-options">
              {[
                { op: 'from:name',   hint: 'Messages from a person' },
                { op: 'after:date',  hint: 'After a specific date' },
                { op: 'before:date', hint: 'Before a specific date' },
                { op: 'type:email',  hint: 'Filter by content type' },
              ].map(({ op, hint }) => (
                <button type="button" key={op} className="filter-option-btn" title={hint}
                  onClick={() => { setSearchQuery(op + ' '); searchInputRef.current?.focus(); }}>
                  <Command size={13} />
                  <code className="filter-operator-code">{op}</code>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── CENTER: Main ─────────────────────────────────────────────────── */}
        <main className={`search-results-area${isEmptyState ? ' empty-mode' : ''}`} id="search-main">

          {/* ARIA live region */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {loading ? 'Searching…' : searchResults.length > 0 ? `${searchResults.length} results for "${searchQuery}"` : ''}
          </div>

          {/* ── Hero search bar ─────────────────────────────────────────────── */}
          <div className="hero-search-container">
            {/* heartbeat-active fires once per focus — Compositor-only animation */}
            <div className={`search-input-wrapper${searchBarHeartbeat ? ' heartbeat-active' : ''}`}>
              <Search size={17} color="var(--search-text-muted)" className="search-bar-icon" />
              <input
                ref={searchInputRef}
                className="main-search-input"
                placeholder="Search everything — messages, tasks, contacts, decisions…"
                value={searchQuery}
                autoComplete="off"
                spellCheck={false}
                aria-label="Search across everything"
                aria-autocomplete="list"
                onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={handleSearchFocus}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={e => {
                  if (showOperatorHints && operatorHints.length > 0) {
                    if (e.key === 'ArrowDown')        { e.preventDefault(); setOperatorHintsIndex(i => Math.min(i + 1, operatorHints.length - 1)); }
                    else if (e.key === 'ArrowUp')     { e.preventDefault(); setOperatorHintsIndex(i => Math.max(i - 1, -1)); }
                    else if (e.key === 'Enter' && operatorHintsIndex >= 0) { e.preventDefault(); setSearchQuery(operatorHints[operatorHintsIndex]); setShowOperatorHints(false); }
                    else if (e.key === 'Escape')      setShowOperatorHints(false);
                  }
                }}
              />

              <div className="search-actions-right">
                {searchQuery && (
                  <button type="button" className="search-action-btn"
                    onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                    title="Clear" aria-label="Clear search">
                    <X size={14} />
                  </button>
                )}
                {loading && (
                  <Loader2 size={16} color="var(--search-primary)" className="search-loading-spinner" />
                )}
                <button type="button" className={`search-action-btn ${isListening ? 'listening' : ''}`}
                  onClick={handleVoiceSearch} title="Voice search"
                  aria-label={isListening ? 'Listening…' : 'Voice search'}>
                  <Mic size={15} />
                </button>
                <button type="button" className={`search-action-btn ${useWebSearch ? 'active' : ''}`}
                  onClick={toggleWebSearch} title="Toggle web search"
                  aria-label="Toggle web search">
                  <Globe size={15} />
                </button>
                <button type="button" className={`search-action-btn ${showOperatorPopover ? 'active' : ''}`}
                  onClick={() => setShowOperatorPopover(v => !v)}
                  title="Search operators" aria-label="Show search operators">
                  <Command size={14} />
                </button>
              </div>

              {/* Operator reference popover */}
              <OperatorReferencePopover
                isOpen={showOperatorPopover}
                onClose={() => setShowOperatorPopover(false)}
                onInsert={text => {
                  const input = searchInputRef.current;
                  if (!input) { setSearchQuery(q => q + text); return; }
                  const start = input.selectionStart ?? searchQuery.length;
                  const end   = input.selectionEnd   ?? searchQuery.length;
                  setSearchQuery(searchQuery.slice(0, start) + text + searchQuery.slice(end));
                  setTimeout(() => { input.focus(); input.setSelectionRange(start + text.length, start + text.length); }, 0);
                }}
              />

              {/* Operator autocomplete dropdown */}
              {showOperatorHints && operatorHints.length > 0 && (
                <ul className="modern-suggestions" role="listbox">
                  {operatorHints.map((hint, i) => (
                    <li key={hint} className={`suggestion-row ${i === operatorHintsIndex ? 'active' : ''}`}
                      role="option" aria-selected={i === operatorHintsIndex ? 'true' : 'false'}
                      onMouseDown={e => { e.preventDefault(); setSearchQuery(hint); setShowOperatorHints(false); }}>
                      <Command size={13} />
                      <code className="suggestion-code">{hint}</code>
                    </li>
                  ))}
                </ul>
              )}

              {/* Suggestions dropdown */}
              {showSuggestions && !showOperatorHints && suggestions.length > 0 && (
                <div className="modern-suggestions" role="listbox">
                  {suggestions.map(s => (
                    <div key={s.id} className="suggestion-row" role="option"
                      onClick={() => { setSearchQuery(s.text); setShowSuggestions(false); performSearch(); }}>
                      <Search size={13} color="var(--search-text-muted)" />
                      <span>{s.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Welcome / empty state ────────────────────────────────────────── */}
          {isEmptyState && (
            <div className="search-welcome-state">

              {/* Zone A: Faint cardiogram SVG texture — BG spec: static, opacity 0.06, rose */}
              <div className="search-welcome-cardiogram" aria-hidden="true">
                <svg viewBox="0 0 800 56" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                  <polyline
                    points="0,28 80,28 100,28 110,6 120,50 130,28 160,28 200,28 210,12 215,44 220,28 260,28 340,28 350,8 355,48 360,28 400,28 480,28 490,14 495,42 500,28 540,28 620,28 630,10 635,46 640,28 680,28 760,28 800,28"
                    fill="none"
                    stroke="rgba(244,63,94,0.06)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* Zone B: Brand-approved copy */}
              <div className="search-welcome-heading search-welcome-zone-b">
                <h1>Everything in one place.</h1>
                <p>Ask anything.</p>
              </div>

              {/* Category cards — quick access */}
              <div className="search-category-grid" role="list">
                {QUICK_CATEGORIES.map(cat => {
                  const CatIcon = cat.icon;
                  return (
                    <button type="button" key={cat.type} className="search-category-card" role="listitem"
                      onClick={() => { setSearchQuery(cat.query); searchInputRef.current?.focus(); }}>
                      <CatIcon size={22} className="category-icon" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Suggestion chips — pre-populated queries (Brand Moment) */}
              <div className="search-recent-chips">
                <span className="search-recent-label">Try searching</span>
                {[
                  { label: 'Recent decisions', query: 'type:archive decided' },
                  { label: 'Overdue tasks', query: 'type:task overdue' },
                  { label: 'Unread messages', query: 'type:message unread' },
                ].map(chip => (
                  <button type="button" key={chip.label} className="search-recent-chip"
                    onClick={() => { setSearchQuery(chip.query); performSearch(); }}>
                    <Clock size={11} />{chip.label}
                  </button>
                ))}
                {/* Also show user's saved searches */}
                {savedSearches.slice(0, 3).map(s => (
                  <button type="button" key={s.id} className="search-recent-chip"
                    onClick={() => { setSearchQuery(s.query); setFilters(s.filters); }}>
                    <Bookmark size={11} />{s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Source error badges ──────────────────────────────────────────── */}
          {searchErrors.length > 0 && (
            <div className="source-error-badges">
              {searchErrors.map(err => (
                <span key={err.source} className="source-error-badge" title={err.error}>
                  ⚠ {err.source === 'gmail' ? 'Gmail disconnected' : `${err.source} unavailable`}
                </span>
              ))}
            </div>
          )}

          {/* ── AI / Web answer card ─────────────────────────────────────────── */}
          {webSearchResult && (
            <div className="ai-answer-card">
              <div className="ai-answer-header">
                <Sparkles size={15} color="#f43f5e" />
                {/* Brand-approved label — signals intelligence origin */}
                <span className="ai-answer-header-text">Pulse AI · Synthesized from your data</span>
                {webSearchLoading && <Loader2 size={13} color="#f43f5e"
                  style={{ animation: 'spin 0.8s linear infinite', marginLeft: 'auto' }} />}
              </div>
              {/* AI answer body — smaller readable text */}
              <div className="ai-answer-content prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{webSearchResult.answer}</ReactMarkdown>
              </div>
              {webSearchResult.citations.length > 0 && (
                <div className="ai-citations">
                  {webSearchResult.citations.map((c, i) => {
                    let hostname = c;
                    try { hostname = new URL(c).hostname; } catch { /* raw url */ }
                    return (
                      <a key={i} href={c} target="_blank" rel="noopener noreferrer"
                        className="ai-citation-chip" title={c}>
                        <ExternalLink size={10} />{hostname}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── No-results empty state ───────────────────────────────────────── */}
          {!loading && !webSearchResult && searchResults.length === 0 && searchQuery.trim() && (
            <div className="empty-dashboard-state">
              <Search className="empty-dashboard-icon" />
              {/* Brand-approved no-results copy — honest, never apologetic */}
              <h3>Nothing found for "{searchQuery}"</h3>
              <p>Try different keywords, or search by date, person, or topic.</p>
            </div>
          )}

          {/* ── Result count ─────────────────────────────────────────────────── */}
          {searchResults.length > 0 && (
            <p className="results-count-label">
              {Math.min(visibleCount, searchResults.length)} of {searchResults.length} results
            </p>
          )}

          {/* ── Batch action toolbar ─────────────────────────────────────────── */}
          {selectedResults.size > 0 && (
            <div className="batch-toolbar">
              <span className="batch-toolbar-count">{selectedResults.size} selected</span>
              <button type="button" className="batch-btn-primary" onClick={handleBatchClip}>Clip all</button>
              <button type="button" className="batch-btn-secondary" onClick={handleBatchExport}>Export CSV</button>
              <button type="button" className="batch-clear-btn" onClick={() => setSelectedResults(new Set())}>Clear</button>
            </div>
          )}

          {/* ── Results feed ─────────────────────────────────────────────────── */}
          <div className={`results-feed ${viewMode}`} role="search"
            aria-label="Search results" onKeyDown={handleResultsKeyDown}>
            {viewMode === 'timeline'
              ? groupResultsByDate(searchResults.slice(0, visibleCount)).map(group => (
                  <React.Fragment key={group.label}>
                    {/* Large section header — clear temporal grouping */}
                    <div className="timeline-date-header">
                      <div className="timeline-date-line" />
                      <span className="timeline-date-label">{group.label}</span>
                      <div className="timeline-date-line" />
                    </div>
                    {group.items.map(result => <ResultCard key={result.id} result={result} />)}
                  </React.Fragment>
                ))
              : searchResults.slice(0, visibleCount).map(result => (
                  <ResultCard key={result.id} result={result} />
                ))
            }

            {loading && <SearchResultSkeleton count={6} />}

            {!loading && visibleCount < searchResults.length && (
              <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true" />
            )}
          </div>
        </main>

        {/* ── RIGHT: Clipboard sidebar ─────────────────────────────────────── */}
        <aside className={`clipboard-sidebar ${showClipboard ? '' : 'panel-hidden'}`}>

          <div className="clipboard-header">
            {/* Small caps section title */}
            <h3>Clipboard</h3>
            <div className="clipboard-header-actions">
              <button type="button" className="search-action-btn"
                onClick={() => setClipboardView(v => v === 'notes' ? 'categories' : 'notes')}
                title={clipboardView === 'notes' ? 'Show categories' : 'Show notes'}
                aria-label="Toggle clipboard view">
                {clipboardView === 'notes' ? <Folder size={14} /> : <StickyNote size={14} />}
              </button>
              <button type="button" className="search-action-btn"
                title="Expand" aria-label="Expand clipboard">
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          {/* Quick note input */}
          <div className="new-note-input-area">
            <div className="new-note-input-row">
              <input
                className="new-note-input"
                placeholder="Quick note… Enter to save"
                title="Quick note input"
                value={quickNoteText}
                onChange={e => setQuickNoteText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleQuickNote()}
                aria-label="Add quick note to clipboard"
              />
              <button type="button" className="new-note-add-btn"
                onClick={handleQuickNote} title="Add note" aria-label="Add note">
                <Plus size={15} />
              </button>
            </div>
          </div>

          <div className="clipboard-content-area">
            {clipboardItems.map(item => (
              <div key={item.id} className="clipboard-item-card">
                <div className="clipboard-item-row">
                  {/* Item title — small but readable */}
                  <p className="clipboard-item-title">{item.title}</p>
                  <Pin size={11} className={`clipboard-pin-icon${item.pinned ? ' pinned' : ''}`} />
                </div>
                {/* Safe plain-text preview — no HTML injection */}
                <p className="clipboard-item-preview">{stripHtml(item.content)}</p>
                <div className="clipboard-item-meta">
                  <span>{formatTimestamp(new Date(item.createdAt))}</span>
                  {item.category && (
                    <span className="clipboard-item-category-tag">{item.category}</span>
                  )}
                </div>
              </div>
            ))}

            {clipboardItems.length === 0 && (
              <div className="clipboard-empty">
                <StickyNote size={28} className="clipboard-empty-icon" />
                <p>Clip search results or<br />add quick notes here</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Result detail panel */}
      <SearchDetailPanel
        result={detailResult}
        onClose={() => setDetailResult(null)}
        onClip={r => { handleClipResult(r); setDetailResult(null); }}
      />
    </div>
  );
}
