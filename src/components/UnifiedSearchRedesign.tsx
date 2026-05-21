import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import {
  Search,
  Filter,
  Clock,
  X,
  Sparkles,
  Plus,
  Pin,
  Bell,
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
  Loader2,
  Maximize2,
  Minimize2,
  Command,
  MapPin,
  History,
  ChevronRight,
} from 'lucide-react';
import { SearchResult, SearchResultType, SearchFilters, SearchSortOptions, SearchSourceError } from '../services/unifiedSearchService';
import { searchClipboardService, ClipboardItem } from '../services/searchClipboardService';
import { dataService } from '../services/dataService';
import { searchEnhancements, SearchSuggestion } from '../services/searchEnhancements';
import { searchExport } from '../services/searchExport';
import { savedSearchesService, SavedSearch } from '../services/savedSearches';
import { voiceSearchService } from '../services/voiceSearch';
import { searchAnalyticsService } from '../services/searchAnalyticsService';
import { GeoFilter, parseGeoQuery, describeGeoFilter } from '../services/geoSearchParser';
import { applyGeoFilter, resolveGeoCenter } from '../services/spatialSearchService';
import toast from 'react-hot-toast';
import './UnifiedSearchRedesign.css';
import { SearchResultSkeleton } from './SearchResultSkeleton';
import { OperatorReferencePopover } from './OperatorReferencePopover';
import { SaveSearchModal } from './SaveSearchModal';
import { SearchDetailPanel } from './SearchDetailPanel';
import { SearchResultCard } from './SearchResultCard';
import SearchMapView from './SearchMapView';

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

// ── Recent thread summary shape (mirrors dataService.getRecentThreads) ───────
interface RecentThread {
  id: string;
  counterpart: string;
  avatarColor: string | null;
  unread: boolean;
  lastActivityAt: Date;
}

// ── Browse-by-type row shown in working-memory empty state ───────────────────
const BROWSE_TYPES: {
  type: SearchResultType;
  label: string;
  icon: React.ElementType;
}[] = [
  { type: 'email',   label: 'Emails',   icon: Mail },
  { type: 'message', label: 'Messages', icon: MessageSquare },
  { type: 'task',    label: 'Tasks',    icon: CheckSquare },
  { type: 'contact', label: 'People',   icon: Users },
  { type: 'vox',     label: 'Vox',      icon: Mic },
  { type: 'note',    label: 'Notes',    icon: StickyNote },
];

// ── Types collapsed for the sidebar facet list (folds duplicates/unused) ──
const FACET_TYPES: SearchResultType[] = [
  'message', 'email', 'vox', 'note', 'task', 'event', 'contact', 'sms',
];

// ── Types ─────────────────────────────────────────────────────────────────────
type ViewMode      = 'list' | 'grid' | 'timeline' | 'map';
type ClipboardView = 'notes' | 'categories';
type GroupMode     = 'none' | 'conversation';

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
interface UnifiedSearchRedesignProps {
  isDarkMode?: boolean;
}

export default function UnifiedSearchRedesign({ isDarkMode = false }: UnifiedSearchRedesignProps = {}) {

  // ── Core state ───────────────────────────────────────────────────────────────
  const [searchQuery,   setSearchQuery]   = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [viewMode,      setViewMode]      = useState<ViewMode>(
    () => (localStorage.getItem('pulse:search:viewMode') as ViewMode) || 'timeline'
  );
  const [groupMode,     setGroupMode]     = useState<GroupMode>('conversation');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentThreads,  setRecentThreads]  = useState<RecentThread[]>([]);

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
  // Inline peek — ArrowRight expands the focused card, ArrowLeft / Escape collapses.
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

  // ── Search errors ────────────────────────────────────────────────────────────
  const [searchErrors, setSearchErrors] = useState<SearchSourceError[]>([]);

  // ── Geo modifier (B3) ────────────────────────────────────────────────────────
  // The composer parses trailing "near me" / "near <place>" / "within N mi"
  // off the query before search. activeGeoFilter is null when no modifier
  // is active; geoCenter holds the resolved {lat,lng} for the spatial filter
  // and the map view; geoFilterError surfaces "couldn't find that place"
  // and "location blocked" cases inline below the search input.
  const [activeGeoFilter, setActiveGeoFilter] = useState<GeoFilter | null>(null);
  const [geoCenter, setGeoCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [geoFilterError, setGeoFilterError] = useState<string | null>(null);

  // ── Filters ──────────────────────────────────────────────────────────────────
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

  // ── Operator date popover (after:/before: smart picker) ────────────────────
  const [openOperator, setOpenOperator] = useState<'after' | 'before' | null>(null);
  const operatorPopoverRef = useRef<HTMLDivElement>(null);

  // ── Pagination ───────────────────────────────────────────────────────────────
  const [visibleCount, setVisibleCount] = useState(20);

  // ── Heartbeat focus animation state ──────────────────────────────────────────
  const [searchBarHeartbeat, setSearchBarHeartbeat] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const searchInputRef   = useRef<HTMLInputElement>(null);
  const searchGeneration = useRef(0);
  const sentinelRef      = useRef<HTMLDivElement>(null);
  const heartbeatTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportMenuRef    = useRef<HTMLDivElement>(null);
  // Refs mirror state used by the global keydown handler so the handler
  // doesn't need to re-attach on every relevant state change. Updated below
  // in a tracking effect.
  const resumeRef = useRef<{
    isEmptyState: boolean;
    recents: string[];
    saved: SavedSearch[];
  }>({ isEmptyState: true, recents: [], saved: [] });

  const userId = dataService.getUserId();
  // API key no longer needed client-side — Gemini calls proxied through gemini-proxy edge function

  const isEmptyState = !loading && searchResults.length === 0 && !searchQuery.trim();

  // ── Live facet counts for the sidebar Content Type list ──────────────────
  const facetCounts = useMemo(() => {
    const m = new Map<SearchResultType, number>();
    for (const r of searchResults) m.set(r.type, (m.get(r.type) || 0) + 1);
    return m;
  }, [searchResults]);

  // ── Group results by counterpart/thread when groupMode === 'conversation'.
  // Falls back to flat ordering for queries with explicit operators (the user
  // already narrowed the field — don't re-group on top of their intent).
  const queryHasOperator = /\b(from|type|after|before|tag):/i.test(searchQuery);
  const shouldGroup = groupMode === 'conversation' && !queryHasOperator
    && viewMode !== 'map' && viewMode !== 'timeline';

  const groupedResults = useMemo(() => {
    if (!shouldGroup) return null;
    const buckets = new Map<string, { key: string; label: string; items: SearchResult[] }>();
    for (const r of searchResults.slice(0, visibleCount)) {
      const key = r.metadata?.threadId
        || r.sender
        || r.senderEmail
        || `__${r.type}__${r.id}`;
      const label = r.sender || r.metadata?.channelName || r.metadata?.subject || r.title;
      if (!buckets.has(key)) buckets.set(key, { key, label, items: [] });
      buckets.get(key)!.items.push(r);
    }
    return Array.from(buckets.values());
  }, [searchResults, visibleCount, shouldGroup]);

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
      // Skipped while typing so the literal '?' character still works.
      if (e.key === '?' && !inField) {
        e.preventDefault();
        setShowOperatorPopover(v => !v);
      }
      // Digits 1–5 in the empty state → run the corresponding Resume row.
      // Recent searches fill the slots first, then saved searches pad out
      // any remaining slots — same order as the rendered list.
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
  }, [debouncedSearchQuery]);

  // ── If Map view is active and the geo filter clears, fall back to Timeline ──
  useEffect(() => {
    if (viewMode === 'map' && !activeGeoFilter) {
      setViewMode('timeline');
      localStorage.setItem('pulse:search:viewMode', 'timeline');
    }
  }, [activeGeoFilter, viewMode]);

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

  // ── Action handlers ────────────────────────────────────────────────────────────
  const handleClipResult = async (result: SearchResult) => {
    searchAnalyticsService.trackClick(userId, searchQuery, result.type);
    try { await searchClipboardService.clipSearchResult(userId, result); await loadClipboardItems(); toast.success('Clipped to clipboard'); }
    catch { toast.error('Failed to clip result'); }
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
    if (!voiceSearchService.isVoiceSearchSupported()) { toast.error('Voice search is not supported in this browser'); return; }
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
  // ArrowDown/Up move focus between cards. ArrowRight peeks the focused card
  // (inline expansion, in-between affordance before the full detail panel).
  // ArrowLeft / Escape collapses the peek; Escape on a non-expanded card still
  // clears the query.
  const handleResultsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
  };

  // ResultCard is now extracted to SearchResultCard.tsx (React.memo'd)

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="search-redesign-container">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="search-redesign-header">
        <div className="search-title-section">
          <h2>Search</h2>
        </div>

        <div className="search-header-controls">
          {/* View mode strip — Map appears contextually when a geo filter is active */}
          <div className="view-toggle-group" role="group" aria-label="View mode">
            {(() => {
              const modes: { id: ViewMode; Icon: React.ElementType; label: string }[] = [
                { id: 'timeline', Icon: Clock, label: 'Timeline' },
                { id: 'list',     Icon: List,  label: 'List' },
                { id: 'grid',     Icon: Grid,  label: 'Grid' },
              ];
              if (activeGeoFilter) modes.push({ id: 'map', Icon: MapPin, label: 'Map' });
              return modes.map(({ id, Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`view-toggle-item ${viewMode === id ? 'active' : ''}`}
                  onClick={() => {
                    setViewMode(id);
                    localStorage.setItem('pulse:search:viewMode', id);
                  }}
                  title={`${label} view`}
                  aria-pressed={viewMode === id ? 'true' : 'false'}
                >
                  <Icon size={13} /><span>{label}</span>
                </button>
              ));
            })()}
          </div>

          <div className="search-header-divider" />

          <button type="button" className={`search-action-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(v => !v)} title="Toggle filters" aria-label="Toggle filters panel"><Filter size={15} /></button>
          <button type="button" className={`search-action-btn ${showClipboard ? 'active' : ''}`} onClick={() => setShowClipboard(v => !v)} title="Toggle clipboard" aria-label="Toggle clipboard panel"><StickyNote size={15} /></button>

          <div className="search-header-divider" />

          <button type="button" className="search-action-btn" title="Save search" disabled={!searchQuery.trim()} onClick={() => setShowSaveModal(true)} aria-label="Save current search"><Bookmark size={15} /></button>
          <div className="export-dropdown-wrapper" ref={exportMenuRef}>
            <button type="button" className="search-action-btn" title="Export" aria-label="Export results"
              onClick={() => setShowExportMenu(v => !v)}>
              <Download size={15} />
            </button>
            {showExportMenu && (
              <div className="export-dropdown">
                <button type="button" onClick={() => { handleExport('csv'); setShowExportMenu(false); }}>CSV</button>
                <button type="button" onClick={() => { handleExport('markdown'); setShowExportMenu(false); }}>Markdown</button>
                <button type="button" onClick={() => { handleExport('pdf'); setShowExportMenu(false); }}>PDF (Print)</button>
              </div>
            )}
          </div>
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
          gridTemplateColumns: `${showFilters ? 'var(--search-sidebar-width)' : '0px'} 1fr ${showClipboard ? (clipboardExpanded ? '420px' : 'var(--search-clipboard-width)') : '0px'}`,
        }}
      >
        {/* ── LEFT: Filters ────────────────────────────────────────────────── */}
        <aside className={`search-filters-sidebar ${showFilters ? '' : 'panel-hidden'}`}>

          <div className="filter-group">
            <h3>Saved Searches</h3>
            <div className="filter-options">
              {savedSearches.slice(0, 6).map(s => (
                <div key={s.id} className="filter-option-row">
                  <button type="button" className="filter-option-btn"
                    onClick={() => { setSearchQuery(s.query); setFilters(s.filters); }}>
                    <Bookmark size={13} />
                    <span className="filter-name-text">{s.name}</span>
                    {s.alertEnabled && (
                      <Bell
                        size={11}
                        className="filter-alert-indicator"
                        aria-label={`Alerts on: ${s.alertFrequency}`}
                      />
                    )}
                  </button>
                  <button type="button" className="filter-delete-btn"
                    title="Delete saved search" aria-label={`Delete saved search "${s.name}"`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      // Capture the record before deletion so Undo can recreate it.
                      const snapshot = s;
                      await savedSearchesService.deleteSavedSearch(userId, s.id);
                      const updated = await savedSearchesService.getSavedSearches(userId);
                      setSavedSearches(updated);
                      toast.success(
                        (t) => (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            Deleted "{snapshot.name}"
                            <button
                              type="button"
                              onClick={async () => {
                                toast.dismiss(t.id);
                                await savedSearchesService.createSavedSearch(userId, {
                                  name: snapshot.name,
                                  query: snapshot.query,
                                  filters: snapshot.filters,
                                  alertEnabled: snapshot.alertEnabled,
                                  alertFrequency: snapshot.alertFrequency,
                                });
                                const refreshed = await savedSearchesService.getSavedSearches(userId);
                                setSavedSearches(refreshed);
                                toast.success('Restored');
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
                    }}>
                    <X size={11} />
                  </button>
                </div>
              ))}
              {savedSearches.length === 0 && (
                <span className="filter-empty-note">No saved searches yet</span>
              )}
            </div>
          </div>

          <div className="filter-group">
            <h3>Content Type</h3>
            <div className="filter-options">
              {FACET_TYPES.map(type => {
                const Icon = resultTypeIcons[type];
                const count = facetCounts.get(type) || 0;
                const hasResults = searchResults.length > 0;
                // Hide zero-count facets only when a query is active — show all
                // 8 types in the empty state so they're discoverable.
                if (hasResults && count === 0 && !selectedTypes.has(type)) return null;
                return (
                  <button type="button" key={type}
                    className={`filter-option-btn ${selectedTypes.has(type) ? 'active' : ''}`}
                    onClick={() => toggleTypeFilter(type)}
                    aria-pressed={selectedTypes.has(type) ? 'true' : 'false'}>
                    <Icon size={13} />
                    <span className="filter-type-label">{type}</span>
                    {hasResults && count > 0 && (
                      <span className="filter-type-count">{count}</span>
                    )}
                  </button>
                );
              })}
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
            </div>
          </div>

          <div className="filter-group">
            <h3>Operators</h3>
            <div className="filter-options">
              {/* from: — opens contact autocomplete (existing /^from:/i effect fires on query change) */}
              <button type="button" className="filter-option-btn" title="Messages from a person"
                onClick={() => {
                  setSearchQuery('from:');
                  searchInputRef.current?.focus();
                  setShowOperatorHints(true);
                  setShowOperatorPopover(false);
                }}>
                <Command size={13} />
                <code className="filter-operator-code">from:</code>
              </button>

              {/* after: / before: — open inline date popover */}
              {(['after', 'before'] as const).map(op => (
                <div key={op} className="filter-operator-row">
                  <button type="button" className="filter-option-btn"
                    title={op === 'after' ? 'After a specific date' : 'Before a specific date'}
                    onClick={() => {
                      setOpenOperator(prev => prev === op ? null : op);
                      setShowOperatorPopover(false);
                    }}>
                    <Command size={13} />
                    <code className="filter-operator-code">{op}:</code>
                  </button>
                  {openOperator === op && (
                    <div className="operator-date-popover" ref={operatorPopoverRef}>
                      <input
                        type="date"
                        autoFocus
                        className="operator-date-input"
                        onChange={e => {
                          const d = e.target.value;
                          if (!d) return;
                          const insert = `${op}:${d} `;
                          setSearchQuery(q => q + (q && !q.endsWith(' ') ? ' ' : '') + insert);
                          setOpenOperator(null);
                          searchInputRef.current?.focus();
                        }}
                        aria-label={`${op} date`}
                      />
                    </div>
                  )}
                </div>
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
                onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); setShowOperatorPopover(false); }}
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

          {/* ── Empty state: working memory ──────────────────────────────────
              Resume (recent searches + saved) · Pinned clipboard · Browse by type.
              No tagline, no card gallery — the section opens to the user's
              actual recent activity, not a marketing hero. */}
          {isEmptyState && (
            <div className="search-working-memory">

              {/* Resume: recent searches + saved searches as a single keyboard-numbered list */}
              {(recentSearches.length > 0 || savedSearches.length > 0) && (
                <section className="wm-section">
                  <header className="wm-section-header">
                    <History size={11} />
                    <span>Resume</span>
                  </header>
                  <ul className="wm-resume-list">
                    {recentSearches.slice(0, 5).map((q, i) => (
                      <li key={`recent-${i}`}>
                        <button type="button" className="wm-resume-row"
                          onClick={() => { setSearchQuery(q); performSearch(); }}>
                          <span className="wm-resume-key">{i + 1}</span>
                          <span className="wm-resume-text">{q}</span>
                          <ChevronRight size={13} className="wm-resume-arrow" />
                        </button>
                      </li>
                    ))}
                    {savedSearches.slice(0, 5 - Math.min(recentSearches.length, 5)).map(s => (
                      <li key={s.id}>
                        <button type="button" className="wm-resume-row"
                          onClick={() => { setSearchQuery(s.query); setFilters(s.filters); }}>
                          <Bookmark size={12} className="wm-resume-saved-icon" />
                          <span className="wm-resume-text">{s.name}</span>
                          <ChevronRight size={13} className="wm-resume-arrow" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Recent Threads — cross-source counterpart roll-up. Click sets a
                  from:Counterpart query so the user lands in their full history
                  with that person, regardless of channel. */}
              {recentThreads.length > 0 && (
                <section className="wm-section">
                  <header className="wm-section-header">
                    <MessageSquare size={11} />
                    <span>Recent threads</span>
                  </header>
                  <ul className="wm-threads-list">
                    {recentThreads.map(t => (
                      <li key={t.id}>
                        <button type="button" className="wm-thread-row"
                          onClick={() => {
                            setSearchQuery(`from:${t.counterpart}`);
                            searchInputRef.current?.focus();
                          }}>
                          <span
                            className="wm-thread-avatar"
                            style={t.avatarColor ? { background: t.avatarColor } : undefined}
                            aria-hidden="true">
                            {t.counterpart.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="wm-thread-name">{t.counterpart}</span>
                          {t.unread && <span className="wm-thread-unread-dot" aria-label="Unread" />}
                          <span className="wm-thread-time">{formatTimestamp(t.lastActivityAt)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Pinned: the user's curated working memory from the clipboard */}
              {clipboardItems.some(i => i.pinned) && (
                <section className="wm-section">
                  <header className="wm-section-header">
                    <Pin size={11} />
                    <span>Pinned</span>
                  </header>
                  <ul className="wm-pinned-list">
                    {clipboardItems.filter(i => i.pinned).slice(0, 6).map(item => (
                      <li key={item.id}>
                        <button type="button" className="wm-pinned-row"
                          onClick={() => setSearchQuery(item.title)}>
                          <span className="wm-pinned-title">{item.title}</span>
                          <span className="wm-pinned-preview">{stripHtml(item.content).slice(0, 80)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Browse by type — a single mono row, not a card grid */}
              <section className="wm-section wm-browse">
                <header className="wm-section-header">
                  <span>Browse by type</span>
                </header>
                <div className="wm-browse-row">
                  {BROWSE_TYPES.map(({ type, label, icon: Icon }) => (
                    <button type="button" key={type} className="wm-browse-chip"
                      onClick={() => {
                        setSelectedTypes(new Set([type]));
                        setSearchQuery(`type:${type}`);
                      }}>
                      <Icon size={12} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Empty-empty state — first-time user with no history yet.
                  Teaches the operator vocabulary via one-click examples. */}
              {recentSearches.length === 0 && savedSearches.length === 0
                && recentThreads.length === 0
                && !clipboardItems.some(i => i.pinned) && (
                <section className="wm-section wm-onboard">
                  <p className="wm-empty-hint">
                    Search across messages, transcripts, notes, tasks, decisions.
                    Start typing, or try one of these.
                  </p>
                  <div className="wm-try-row">
                    {[
                      { query: 'from:',          caption: 'by person' },
                      { query: 'type:vox',       caption: 'voice notes' },
                      { query: 'after:2026-04-01', caption: 'by date' },
                      { query: 'decided',        caption: 'keyword' },
                    ].map(ex => (
                      <button type="button" key={ex.query} className="wm-try-chip"
                        onClick={() => {
                          setSearchQuery(ex.query);
                          searchInputRef.current?.focus();
                          // If the example is the from: trigger, surface the contact picker.
                          if (ex.query === 'from:') setShowOperatorHints(true);
                        }}>
                        <code className="wm-try-syntax">{ex.query}</code>
                        <span className="wm-try-caption">{ex.caption}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
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

          {/* ── No-results empty state ───────────────────────────────────────── */}
          {!loading && searchResults.length === 0 && searchQuery.trim() && (
            <div className="empty-dashboard-state">
              <Search className="empty-dashboard-icon" />
              {/* Brand-approved no-results copy — honest, never apologetic */}
              <h3>Nothing found for "{searchQuery}"</h3>
              <p>Try different keywords, or search by date, person, or topic.</p>
            </div>
          )}

          {/* ── Geo modifier chip (B3) ──────────────────────────────────────── */}
          {(activeGeoFilter || geoFilterError) && (
            <div className="geo-filter-bar" role="status">
              {activeGeoFilter && !geoFilterError && (
                <span className="geo-filter-chip">
                  <MapPin size={12} />
                  {describeGeoFilter(activeGeoFilter)}
                </span>
              )}
              {geoFilterError && (
                <span className="geo-filter-error">{geoFilterError}</span>
              )}
            </div>
          )}

          {/* ── Result count + group-by control ──────────────────────────── */}
          {searchResults.length > 0 && (
            <div className="results-meta-row">
              <p className="results-count-label">
                {Math.min(visibleCount, searchResults.length)} of {searchResults.length} results
              </p>
              {viewMode !== 'map' && viewMode !== 'timeline' && (
                <div className="group-by-control" role="group" aria-label="Group results">
                  <span className="group-by-label">Group</span>
                  {(['none', 'conversation'] as const).map(mode => (
                    <button type="button" key={mode}
                      className={`group-by-btn ${groupMode === mode ? 'active' : ''}`}
                      onClick={() => setGroupMode(mode)}
                      aria-pressed={groupMode === mode ? 'true' : 'false'}>
                      {mode === 'none' ? 'None' : 'Conversation'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Batch action toolbar ─────────────────────────────────────────── */}
          {selectedResults.size > 0 && (
            <div className="batch-toolbar">
              <span className="batch-toolbar-count">{selectedResults.size} selected</span>
              <button type="button" className="batch-btn-secondary" aria-label="Select all visible results"
                onClick={() => setSelectedResults(new Set(searchResults.slice(0, visibleCount).map(r => r.id)))}>
                Select all
              </button>
              <button type="button" className="batch-btn-primary" onClick={handleBatchClip}>Clip all</button>
              <button type="button" className="batch-btn-secondary" onClick={handleBatchExport}>Export CSV</button>
              <button type="button" className="batch-clear-btn" onClick={() => setSelectedResults(new Set())}>Clear</button>
            </div>
          )}

          {/* ── Results feed ─────────────────────────────────────────────────── */}
          <div className={`results-feed ${viewMode}`} role="search"
            aria-label="Search results" onKeyDown={handleResultsKeyDown}>
            {viewMode === 'map' ? (
              <SearchMapView
                results={searchResults}
                center={geoCenter}
                isDarkMode={isDarkMode}
                onSelect={setDetailResult}
              />
            ) : viewMode === 'timeline' ? (
              groupResultsByDate(searchResults.slice(0, visibleCount)).map(group => (
                <React.Fragment key={group.label}>
                  {/* Large section header — clear temporal grouping */}
                  <div className="timeline-date-header">
                    <div className="timeline-date-line" />
                    <span className="timeline-date-label">{group.label}</span>
                    <div className="timeline-date-line" />
                  </div>
                  {group.items.map(result => <SearchResultCard key={result.id} result={result} isSelected={selectedResults.has(result.id)} isExpanded={expandedResultId === result.id} onSelect={toggleResultSelect} onDetail={setDetailResult} />)}
                </React.Fragment>
              ))
            ) : groupedResults ? (
              groupedResults.map(group => (
                <React.Fragment key={group.key}>
                  <div className="conversation-group-header">
                    <span className="conversation-group-label">{group.label}</span>
                    <span className="conversation-group-count">{group.items.length}</span>
                    <div className="conversation-group-line" />
                  </div>
                  {group.items.map(result => <SearchResultCard key={result.id} result={result} isSelected={selectedResults.has(result.id)} isExpanded={expandedResultId === result.id} onSelect={toggleResultSelect} onDetail={setDetailResult} />)}
                </React.Fragment>
              ))
            ) : (
              searchResults.slice(0, visibleCount).map(result => (
                <SearchResultCard key={result.id} result={result} isSelected={selectedResults.has(result.id)} isExpanded={expandedResultId === result.id} onSelect={toggleResultSelect} onDetail={setDetailResult} />
              ))
            )}

            {loading && viewMode !== 'map' && <SearchResultSkeleton count={6} />}

            {!loading && viewMode !== 'map' && visibleCount < searchResults.length && (
              <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true" />
            )}
          </div>
        </main>

        {/* ── RIGHT: Clipboard sidebar ─────────────────────────────────────── */}
        <aside className={`clipboard-sidebar ${showClipboard ? '' : 'panel-hidden'}`}>

          <div className="clipboard-header">
            {/* Small caps section title */}
            <h3>Clipboard{clipboardItems.length > 0 && <span className="clipboard-count-badge">{clipboardItems.length}</span>}</h3>
            <div className="clipboard-header-actions">
              <button type="button" className="search-action-btn"
                onClick={() => setClipboardView(v => v === 'notes' ? 'categories' : 'notes')}
                title={clipboardView === 'notes' ? 'Show categories' : 'Show notes'}
                aria-label="Toggle clipboard view">
                {clipboardView === 'notes' ? <Folder size={14} /> : <StickyNote size={14} />}
              </button>
              <button type="button" className="search-action-btn"
                title={clipboardExpanded ? 'Collapse' : 'Expand'} aria-label={clipboardExpanded ? 'Collapse clipboard' : 'Expand clipboard'}
                onClick={() => setClipboardExpanded(v => !v)}>
                {clipboardExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
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
                  <p className="clipboard-item-title">{item.title}</p>
                  <div className="clipboard-item-actions">
                    <button type="button" className="clipboard-icon-btn"
                      title={item.pinned ? 'Unpin' : 'Pin'} aria-label={item.pinned ? 'Unpin item' : 'Pin item'}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await searchClipboardService.updateClipboardItem(userId, item.id, { pinned: !item.pinned });
                        loadClipboardItems();
                      }}>
                      <Pin size={11} className={`clipboard-pin-icon${item.pinned ? ' pinned' : ''}`} />
                    </button>
                    <button type="button" className="clipboard-icon-btn clipboard-delete-btn"
                      title="Remove" aria-label="Remove clipboard item"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await searchClipboardService.deleteClipboardItem(userId, item.id);
                        loadClipboardItems();
                      }}>
                      <X size={11} />
                    </button>
                  </div>
                </div>
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
