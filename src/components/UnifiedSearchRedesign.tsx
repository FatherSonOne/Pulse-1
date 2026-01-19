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
  Maximize2
} from 'lucide-react';
import { unifiedSearchService, SearchResult, SearchResultType, SearchFilters, SearchSortOptions } from '../services/unifiedSearchService';
import { searchClipboardService, ClipboardItem } from '../services/searchClipboardService';
import { dataService } from '../services/dataService';
import { searchEnhancements, SearchSuggestion, SonarWebResult } from '../services/searchEnhancements';
import { searchAI } from '../services/searchAI';
import { searchExport } from '../services/searchExport';
import { savedSearchesService, SavedSearch } from '../services/savedSearches';
import { voiceSearchService } from '../services/voiceSearch';
import { RichTextEditor } from './RichTextEditor';
import './UnifiedSearchRedesign.css';

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
  const [useAISearch, setUseAISearch] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [linkingMode, setLinkingMode] = useState<string | null>(null);

  // Web search (Sonar) state
  const [useWebSearch, setUseWebSearch] = useState(true);
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

  // Filters
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sortOptions, setSortOptions] = useState<SearchSortOptions>({ field: 'timestamp', order: 'desc' });
  const [selectedTypes, setSelectedTypes] = useState<Set<SearchResultType>>(new Set());

  const userId = dataService.getUserId();
  const apiKey = import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Logic copied from UnifiedSearch.tsx ---

  const performSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setWebSearchResult(null);
      return;
    }

    setLoading(true);
    
    // Web Search
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

      const results = await searchEnhancements.enhancedSearch(
        searchQuery,
        userId,
        apiKey,
        activeFilters,
        useAISearch
      );

      setSearchResults(results);
      setShowSuggestions(false);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters, selectedTypes, useAISearch, useWebSearch, webSearchModel, userId, apiKey]);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
        if (searchQuery.trim()) performSearch();
    }, 500); // Slower debounce for full dashboard
    return () => clearTimeout(timer);
  }, [searchQuery]); // Simplified dependency for debounce to avoid loops

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
                <div className="search-input-wrapper">
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
                    />
                    <div className="search-actions-right">
                        {searchQuery && (
                            <button className="search-action-btn" onClick={() => setSearchQuery('')}>
                                <X size={16} />
                            </button>
                        )}
                        <button 
                            className={`search-action-btn ${isListening ? 'active' : ''}`}
                            onClick={handleVoiceSearch}
                        >
                            <Mic size={18} />
                        </button>
                        <button 
                            className={`search-action-btn ${useWebSearch ? 'active' : ''}`}
                            onClick={() => setUseWebSearch(!useWebSearch)}
                            title="Toggle Web Search (Perplexity)"
                        >
                            <Globe size={18} />
                        </button>
                    </div>

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
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

            {/* Loading */}
            {loading && (
                <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin text-pink-500" size={32} />
                </div>
            )}

            {/* Empty State */}
            {!loading && !webSearchResult && searchResults.length === 0 && (
                <div className="empty-dashboard-state">
                    <Search className="empty-dashboard-icon" />
                    <h3>No results found</h3>
                    <p>Try adjusting your search terms or filters</p>
                </div>
            )}

            {/* Results List */}
            <div className={`results-feed ${viewMode}`}>
                {searchResults.map(result => {
                    const Icon = getIcon(result.type);
                    return (
                        <div key={result.id} className="result-card-modern group" onClick={() => handleClipResult(result)}>
                            <button 
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
                                <span className="result-source-badge">
                                    <Icon size={12} />
                                    <span className="capitalize">{result.type}</span>
                                </span>
                                <span className="result-timestamp">{formatTimestamp(result.timestamp)}</span>
                            </div>
                            <h4 className="result-title-modern">{result.title}</h4>
                            <p className="result-snippet">{result.content}</p>
                            
                            {/* Hover Actions Overlay could go here */}
                        </div>
                    );
                })}
            </div>

        </main>

        {/* RIGHT: Clipboard */}
        <aside className="clipboard-sidebar" style={{ display: showClipboard ? 'flex' : 'none' }}>
            <div className="clipboard-header">
                <h3>Clipboard</h3>
                <div className="flex gap-1">
                    <button className="search-action-btn" onClick={() => setClipboardView(clipboardView === 'notes' ? 'categories' : 'notes')}>
                        {clipboardView === 'notes' ? <Folder size={16} /> : <StickyNote size={16} />}
                    </button>
                    <button className="search-action-btn">
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
                    <button className="bg-pink-500 text-white p-2 rounded-lg" onClick={handleQuickNote}>
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
                            <span>{formatTimestamp(new Date(item.timestamp))}</span>
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
    </div>
  );
}
