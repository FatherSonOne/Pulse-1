// useUnifiedSearch — the Search controller hook.
//
// Phase 1: a 1:1 lift-and-shift of the entire search controller out of
// UnifiedSearchRedesign.tsx. Every piece of state, every effect, every
// handler, and every memo is copied verbatim — only the read/write surface
// changes (local component state → returned hook API). No service signatures
// change; the 12 backend sources, operator grammar, geo parse, AI rerank,
// and analytics call sites are all preserved exactly.
//
// The single genuinely-new addition is `sort` (Recent/Relevance), applied
// CLIENT-SIDE over the fetched page per handoff §9.3 — the service is NOT
// given a sort param (that would change a signature). Default
// {timestamp, desc} reproduces today's ordering exactly, so parity holds.
//
// Spec: docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md §5.2
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import {
  SearchResult,
  SearchResultType,
  SearchFilters,
  SearchSortOptions,
  SearchSourceError,
} from '../../services/unifiedSearchService';
import { searchClipboardService, ClipboardItem } from '../../services/searchClipboardService';
import { dataService } from '../../services/dataService';
import { searchEnhancements, SearchSuggestion } from '../../services/searchEnhancements';
import { searchExport } from '../../services/searchExport';
import { savedSearchesService, SavedSearch } from '../../services/savedSearches';
import { voiceSearchService } from '../../services/voiceSearch';
import { searchAnalyticsService } from '../../services/searchAnalyticsService';
import { GeoFilter, parseGeoQuery } from '../../services/geoSearchParser';
import { applyGeoFilter, resolveGeoCenter } from '../../services/spatialSearchService';
import toast from 'react-hot-toast';

// ── View / grouping / clipboard modes ──────────────────────────────────────
// Workbench view set: Table (default) · Cards · Map. The legacy Timeline/List
// collapse into Table (grouping control), Grid → Cards (handoff §4.2).
// GroupMode extends to 'date' in Phase 4; kept at none|conversation here.
export type ViewMode      = 'table' | 'cards' | 'map';
export type ClipboardView = 'notes' | 'categories';
// 'date' → date lanes (table default); 'conversation' → thread grouping;
// 'none' → flat. (§4.2/§5.4)
export type GroupMode     = 'date' | 'conversation' | 'none';

// Migrate the persisted `pulse:search:viewMode` from the legacy vocabulary
// (timeline|list|grid|map) to the Workbench set (table|cards|map). §4.2.
function readPersistedViewMode(): ViewMode {
  const raw = (typeof localStorage !== 'undefined' && localStorage.getItem('pulse:search:viewMode')) || '';
  if (raw === 'grid' || raw === 'cards') return 'cards';
  if (raw === 'map') return 'map';
  // timeline | list | table | '' | anything else → table (the new default)
  return 'table';
}

// ── Recent thread summary shape (mirrors dataService.getRecentThreads) ─────
export interface RecentThread {
  id: string;
  counterpart: string;
  avatarColor: string | null;
  unread: boolean;
  lastActivityAt: Date;
}

export function useUnifiedSearch() {
  // ── Core state ───────────────────────────────────────────────────────────
  const [searchQuery,   setSearchQuery]   = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [viewMode,      setViewModeRaw]   = useState<ViewMode>(readPersistedViewMode);
  // Persisting setter — every view switch writes through to localStorage so the
  // choice survives reloads (replaces the per-onClick persistence in legacy).
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeRaw(mode);
    try { localStorage.setItem('pulse:search:viewMode', mode); } catch { /* sandboxed */ }
  }, []);
  const [groupMode,     setGroupMode]     = useState<GroupMode>('date');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentThreads,  setRecentThreads]  = useState<RecentThread[]>([]);

  // ── NEW: client-side sort (Recent / Relevance). Default reproduces the
  // service's own timestamp-desc ordering, so it is a no-op until surfaced. ──
  const [sort, setSort] = useState<SearchSortOptions>({ field: 'timestamp', order: 'desc' });

  // ── Panel visibility ───────────────────────────────────────────────────────
  const [showFilters,   setShowFilters]   = useState(true);
  const [showClipboard, setShowClipboard] = useState(true);

  // ── Clipboard ──────────────────────────────────────────────────────────────
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
  // Inline peek — ArrowRight expands the focused row, ArrowLeft / Escape collapses.
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

  // ── Search errors ────────────────────────────────────────────────────────────
  const [searchErrors, setSearchErrors] = useState<SearchSourceError[]>([]);

  // ── Geo modifier (B3) ──────────────────────────────────────────────────────
  const [activeGeoFilter, setActiveGeoFilter] = useState<GeoFilter | null>(null);
  const [geoCenter, setGeoCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [geoFilterError, setGeoFilterError] = useState<string | null>(null);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filters,       setFilters]       = useState<SearchFilters>({});
  const [selectedTypes, setSelectedTypes] = useState<Set<SearchResultType>>(new Set());

  // ── Operator autocomplete ─────────────────────────────────────────────────────
  const [operatorHints,       setOperatorHints]       = useState<string[]>([]);
  const [showOperatorHints,   setShowOperatorHints]   = useState(false);
  const [operatorHintsIndex,  setOperatorHintsIndex]  = useState(-1);
  const [showOperatorPopover, setShowOperatorPopover] = useState(false);

  // ── Modals & detail panel ────────────────────────────────────────────────────
  const [showSaveModal,  setShowSaveModal]  = useState(false);
  const [detailResult,   setDetailResult]   = useState<SearchResult | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [clipboardExpanded, setClipboardExpanded] = useState(false);

  // ── Operator date popover (after:/before: smart picker) ─────────────────────
  const [openOperator, setOpenOperator] = useState<'after' | 'before' | null>(null);
  const operatorPopoverRef = useRef<HTMLDivElement>(null);

  // ── Pagination ───────────────────────────────────────────────────────────────
  const [visibleCount, setVisibleCount] = useState(20);

  // ── Heartbeat focus animation state (legacy; slated for removal in Phase 9) ──
  const [searchBarHeartbeat, setSearchBarHeartbeat] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const searchInputRef   = useRef<HTMLInputElement>(null);
  const searchGeneration = useRef(0);
  const sentinelRef      = useRef<HTMLDivElement>(null);
  const heartbeatTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportMenuRef    = useRef<HTMLDivElement>(null);
  // Refs mirror state used by the global keydown handler so the handler
  // doesn't need to re-attach on every relevant state change.
  const resumeRef = useRef<{
    isEmptyState: boolean;
    recents: string[];
    saved: SavedSearch[];
  }>({ isEmptyState: true, recents: [], saved: [] });

  const userId = dataService.getUserId();

  const isEmptyState = !loading && searchResults.length === 0 && !searchQuery.trim();

  // ── Live facet counts for the sidebar Content Type list ───────────────────
  const facetCounts = useMemo(() => {
    const m = new Map<SearchResultType, number>();
    for (const r of searchResults) m.set(r.type, (m.get(r.type) || 0) + 1);
    return m;
  }, [searchResults]);

  // ── NEW: client-side sorted view. timestamp-desc short-circuits to the raw
  // array (the service already sorts that way) so it's referentially stable and
  // byte-identical to legacy ordering until the user picks Relevance. ───────
  const sortedResults = useMemo(() => {
    if (sort.field === 'timestamp' && sort.order === 'desc') return searchResults;
    const copy = [...searchResults];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sort.field === 'relevance')      cmp = (a.relevance || 0) - (b.relevance || 0);
      else if (sort.field === 'title')     cmp = (a.title || '').localeCompare(b.title || '');
      else                                 cmp = a.timestamp.getTime() - b.timestamp.getTime();
      return sort.order === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [searchResults, sort]);

  // ── Group results by counterpart/thread when groupMode === 'conversation'.
  // Falls back to flat ordering for queries with explicit operators. ─────────
  const queryHasOperator = /\b(from|type|after|before|tag):/i.test(searchQuery);
  // Map ignores grouping; Table & Cards honor conversation grouping.
  const shouldGroup = groupMode === 'conversation' && !queryHasOperator
    && viewMode !== 'map';

  const groupedResults = useMemo(() => {
    if (!shouldGroup) return null;
    const buckets = new Map<string, { key: string; label: string; items: SearchResult[] }>();
    for (const r of sortedResults.slice(0, visibleCount)) {
      const key = r.metadata?.threadId
        || r.sender
        || r.senderEmail
        || `__${r.type}__${r.id}`;
      const label = r.sender || r.metadata?.channelName || r.metadata?.subject || r.title;
      if (!buckets.has(key)) buckets.set(key, { key, label, items: [] });
      buckets.get(key)!.items.push(r);
    }
    return Array.from(buckets.values());
  }, [sortedResults, visibleCount, shouldGroup]);

  // ── Heartbeat focus handler — fires animation once per focus ─────────────────
  const handleSearchFocus = useCallback(() => {
    if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
    setSearchBarHeartbeat(false);
    requestAnimationFrame(() => {
      setSearchBarHeartbeat(true);
      heartbeatTimer.current = setTimeout(() => setSearchBarHeartbeat(false), 550);
    });
    setShowSuggestions(true);
  }, []);

  // ── Close export menu on outside click ───────────────────────────────────────
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showExportMenu]);

  // ── Close operator date popover on outside click ─────────────────────────────
  useEffect(() => {
    if (!openOperator) return;
    const handleClick = (e: MouseEvent) => {
      if (operatorPopoverRef.current && !operatorPopoverRef.current.contains(e.target as Node)) {
        setOpenOperator(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openOperator]);

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
      const inField = tag === 'INPUT' || tag === 'TEXTAREA';
      if (e.key === '/' && !inField) {
        e.preventDefault(); searchInputRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); searchInputRef.current?.focus();
      }
      // ? — open operator reference + keyboard map (universal convention).
      if (e.key === '?' && !inField) {
        e.preventDefault();
        setShowOperatorPopover(v => !v);
      }
      // Digits 1–5 in the empty state → run the corresponding Resume row.
      if (
        !inField
        && !e.metaKey && !e.ctrlKey && !e.altKey
        && /^[1-5]$/.test(e.key)
      ) {
        const { isEmptyState: empty, recents, saved } = resumeRef.current;
        if (!empty) return;
        const idx = parseInt(e.key, 10) - 1;
        const recentSlots = recents.slice(0, 5);
        if (idx < recentSlots.length) {
          e.preventDefault();
          setSearchQuery(recentSlots[idx]);
          return;
        }
        const savedSlot = saved[idx - recentSlots.length];
        if (savedSlot) {
          e.preventDefault();
          setSearchQuery(savedSlot.query);
          setFilters(savedSlot.filters);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keep the resume-shortcut data in sync without churning the listener.
  useEffect(() => {
    resumeRef.current = {
      isEmptyState,
      recents: recentSearches,
      saved: savedSearches.slice(0, 5),
    };
  }, [isEmptyState, recentSearches, savedSearches]);

  // ── Core search ──────────────────────────────────────────────────────────────
  const performSearch = useCallback(async () => {
    if (!debouncedSearchQuery.trim()) {
      setSearchResults([]);
      setActiveGeoFilter(null);
      setGeoCenter(null);
      setGeoFilterError(null);
      return;
    }

    const generation = ++searchGeneration.current;
    setLoading(true);
    setSearchErrors([]);
    setSearchResults([]);
    setVisibleCount(20);

    // B3: parse trailing geo modifier off the query before sending to backend.
    const { baseQuery, geoFilter } = parseGeoQuery(debouncedSearchQuery);
    const queryForBackend = geoFilter ? baseQuery : debouncedSearchQuery;
    setActiveGeoFilter(geoFilter);
    setGeoFilterError(null);

    try {
      await searchEnhancements.saveSearchToHistory(userId, debouncedSearchQuery);
      const activeFilters: SearchFilters = {
        ...filters,
        types: selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined,
      };

      const { results, errors } = await searchEnhancements.enhancedSearch(
        queryForBackend, userId, activeFilters, useAISearch,
        (partial) => {
          if (searchGeneration.current !== generation) return;
          // Don't show partial results while a geo filter is active —
          // the spatial pass runs once on the final result set.
          if (!geoFilter) setSearchResults(partial);
        }
      );

      if (searchGeneration.current !== generation) return;

      let finalResults = results;
      if (geoFilter) {
        const center = await resolveGeoCenter(geoFilter);
        if (searchGeneration.current !== generation) return;
        if (!center) {
          setGeoFilterError(
            geoFilter.kind === 'near-me'
              ? 'Location unavailable — enable location services to use "near me".'
              : `Could not find "${geoFilter.placeQuery}".`
          );
          setGeoCenter(null);
          finalResults = [];
        } else {
          setGeoCenter(center);
          finalResults = await applyGeoFilter(results, geoFilter, center);
          if (searchGeneration.current !== generation) return;
        }
      } else {
        setGeoCenter(null);
      }

      setSearchResults(finalResults);
      setSearchErrors(errors);
      setShowSuggestions(false);
      searchAnalyticsService.trackSearch(userId, debouncedSearchQuery, finalResults.length);
    } catch {
      if (searchGeneration.current === generation) setSearchResults([]);
    } finally {
      if (searchGeneration.current === generation) setLoading(false);
    }
  }, [debouncedSearchQuery, filters, selectedTypes, useAISearch, userId]);

  // ── Auto-search on debounced query change ─────────────────────────────────────
  useEffect(() => {
    if (debouncedSearchQuery.trim()) performSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery]);

  // ── If Map view is active and the geo filter clears, fall back to Table ──
  useEffect(() => {
    if (viewMode === 'map' && !activeGeoFilter) {
      setViewMode('table');
    }
  }, [activeGeoFilter, viewMode, setViewMode]);

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
    // Working-memory data: recent searches + recent threads
    searchEnhancements.getSuggestions('', userId, 5)
      .then(s => setRecentSearches(s.filter(x => x.type === 'recent').map(x => x.text)))
      .catch(() => setRecentSearches([]));
    dataService.getRecentThreads(8)
      .then(setRecentThreads)
      .catch(() => setRecentThreads([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── Saved-searches reload (used by Save modal + facet delete/undo) ─────────
  const reloadSavedSearches = useCallback(() => {
    savedSearchesService.getSavedSearches(userId).then(setSavedSearches).catch(console.error);
  }, [userId]);

  // ── Preference toggles ─────────────────────────────────────────────────────────
  const toggleAISearch = useCallback(() => setUseAISearch(v => {
    const next = !v; localStorage.setItem('pulse:search:useAI', String(next)); return next;
  }), []);

  // ── Action handlers ────────────────────────────────────────────────────────────
  const handleClipResult = useCallback(async (result: SearchResult) => {
    searchAnalyticsService.trackClick(userId, searchQuery, result.type);
    try { await searchClipboardService.clipSearchResult(userId, result); await loadClipboardItems(); toast.success('Clipped to clipboard'); }
    catch { toast.error('Failed to clip result'); }
  }, [userId, searchQuery, loadClipboardItems]);

  const handleQuickNote = useCallback(async () => {
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
  }, [quickNoteText, userId, loadClipboardItems]);

  const handleVoiceSearch = useCallback(async () => {
    if (!voiceSearchService.isVoiceSearchSupported()) { toast.error('Voice search is not supported in this browser'); return; }
    setIsListening(true);
    try { const res = await voiceSearchService.startListening(); setSearchQuery(res.transcript); performSearch(); }
    catch { /* silent */ }
    finally { setIsListening(false); }
  }, [performSearch]);

  const handleExport = useCallback((format: 'csv' | 'pdf' | 'markdown') => {
    if (format === 'csv')      searchExport.exportToCSV(searchResults, 'search-results');
    else if (format === 'pdf') searchExport.exportToPDF(searchResults, 'Search Results');
    else                       searchExport.exportClipboardToMarkdown(clipboardItems, 'clipboard');
  }, [searchResults, clipboardItems]);

  const handleBatchClip = useCallback(async () => {
    const items = searchResults.filter(r => selectedResults.has(r.id));
    // Collect the inserted clipboard item ids so Undo can roll the batch back.
    const insertedIds: string[] = [];
    for (const r of items) {
      try {
        const created = await searchClipboardService.clipSearchResult(userId, r);
        if (created?.id) insertedIds.push(created.id);
      } catch { /* skip */ }
    }
    await loadClipboardItems();
    setSelectedResults(new Set());

    const count = insertedIds.length;
    if (count === 0) return;
    toast.success(
      (t) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          Clipped {count} item{count !== 1 ? 's' : ''}
          <button
            type="button"
            onClick={async () => {
              toast.dismiss(t.id);
              for (const id of insertedIds) {
                try { await searchClipboardService.deleteClipboardItem(userId, id); } catch { /* skip */ }
              }
              await loadClipboardItems();
              toast.success('Undone');
            }}
            style={{
              background: 'transparent',
              border: '1px solid currentColor',
              color: 'inherit',
              padding: '2px 10px',
              borderRadius: 6,
              fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: 6000 }
    );
  }, [searchResults, selectedResults, userId, loadClipboardItems]);

  const handleBatchExport = useCallback(() => {
    searchExport.exportToCSV(searchResults.filter(r => selectedResults.has(r.id)), 'selected-results');
    setSelectedResults(new Set());
  }, [searchResults, selectedResults]);

  const toggleResultSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleTypeFilter = useCallback((type: SearchResultType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }, []);

  // ── Keyboard nav in results ────────────────────────────────────────────────────
  const handleResultsKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const cards   = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="article"]'));
    const focused = document.activeElement as HTMLElement;
    const idx     = cards.indexOf(focused);
    const focusedId = idx >= 0 ? focused.getAttribute('data-result-id') : null;

    if (e.key === 'ArrowDown')         { e.preventDefault(); (cards[idx + 1] ?? cards[0])?.focus(); }
    else if (e.key === 'ArrowUp')      { e.preventDefault(); idx <= 0 ? searchInputRef.current?.focus() : cards[idx - 1]?.focus(); }
    else if (e.key === 'ArrowRight' && focusedId) {
      e.preventDefault();
      setExpandedResultId(focusedId);
    }
    else if (e.key === 'ArrowLeft' && expandedResultId) {
      e.preventDefault();
      setExpandedResultId(null);
    }
    else if (e.key === 'Escape') {
      e.preventDefault();
      if (expandedResultId) setExpandedResultId(null);
      else { setSearchQuery(''); searchInputRef.current?.focus(); }
    }
  }, [expandedResultId]);

  return {
    // query + results
    searchQuery, setSearchQuery, debouncedSearchQuery,
    searchResults, sortedResults, loading,
    sort, setSort,
    // view / grouping
    viewMode, setViewMode, groupMode, setGroupMode,
    queryHasOperator, shouldGroup, groupedResults,
    // working memory
    recentSearches, recentThreads,
    // panels
    showFilters, setShowFilters, showClipboard, setShowClipboard,
    // clipboard / working set
    clipboardView, setClipboardView,
    quickNoteText, setQuickNoteText,
    clipboardItems, loadClipboardItems,
    selectedClipboardCategory, setSelectedClipboardCategory,
    clipboardExpanded, setClipboardExpanded,
    // suggestions / AI / voice
    suggestions, showSuggestions, setShowSuggestions,
    useAISearch, toggleAISearch,
    isListening,
    // selection / peek
    selectedResults, setSelectedResults, toggleResultSelect,
    expandedResultId, setExpandedResultId,
    // saved searches
    savedSearches, setSavedSearches, reloadSavedSearches,
    // errors / geo
    searchErrors,
    activeGeoFilter, geoCenter, geoFilterError,
    // filters / facets
    filters, setFilters,
    selectedTypes, setSelectedTypes, toggleTypeFilter,
    facetCounts,
    // operators
    operatorHints, showOperatorHints, setShowOperatorHints,
    operatorHintsIndex, setOperatorHintsIndex,
    showOperatorPopover, setShowOperatorPopover,
    openOperator, setOpenOperator, operatorPopoverRef,
    // modals / detail
    showSaveModal, setShowSaveModal,
    detailResult, setDetailResult,
    showExportMenu, setShowExportMenu, exportMenuRef,
    // pagination
    visibleCount, setVisibleCount, sentinelRef,
    // heartbeat (legacy; removed Phase 9)
    searchBarHeartbeat, handleSearchFocus,
    // refs
    searchInputRef,
    // derived
    userId, isEmptyState,
    // handlers
    performSearch,
    handleClipResult, handleQuickNote, handleVoiceSearch,
    handleExport, handleBatchClip, handleBatchExport,
    handleResultsKeyDown,
  };
}

export type UseUnifiedSearch = ReturnType<typeof useUnifiedSearch>;
