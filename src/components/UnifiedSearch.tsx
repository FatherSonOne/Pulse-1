import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import './UnifiedSearch.css';

/**
 * Unified Search Component
 * Comprehensive search across all Pulse data sources with sticky notes/clipboard
 */

const resultTypeIcons: Record<SearchResultType, string> = {
  message: '💬',
  email: '📧',
  vox: '🎙️',
  note: '📝',
  task: '✅',
  event: '📅',
  thread: '🧵',
  contact: '👤',
  sms: '📱',
  unified_message: '💬',
  archive: '📁',
};

const resultTypeColors: Record<SearchResultType, string> = {
  message: '#4285F4',
  email: '#EA4335',
  vox: '#9C27B0',
  note: '#FF9800',
  task: '#4CAF50',
  event: '#2196F3',
  thread: '#00BCD4',
  contact: '#9E9E9E',
  sms: '#34A853',
  unified_message: '#4285F4',
  archive: '#795548',
};

type ViewMode = 'list' | 'grid' | 'timeline';
type ClipboardView = 'notes' | 'categories';

export default function UnifiedSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [showClipboard, setShowClipboard] = useState(false); // Default to collapsed
  const [clipboardExpanded, setClipboardExpanded] = useState(false); // Expanded state
  const [clipboardView, setClipboardView] = useState<ClipboardView>('notes');
  const [showResultsPanel, setShowResultsPanel] = useState(true);
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
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [linkingMode, setLinkingMode] = useState<string | null>(null);

  // Web search (Sonar) state
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [webSearchResult, setWebSearchResult] = useState<SonarWebResult | null>(null);
  const [webSearchLoading, setWebSearchLoading] = useState(false);
  const [webSearchModel, setWebSearchModel] = useState<'sonar' | 'sonar-pro' | 'sonar-reasoning'>('sonar');

  // Filters
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sortOptions, setSortOptions] = useState<SearchSortOptions>({ field: 'timestamp', order: 'desc' });
  const [selectedTypes, setSelectedTypes] = useState<Set<SearchResultType>>(new Set());

  const userId = dataService.getUserId();
  const apiKey = import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Perform enhanced search with AI
  const performSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setWebSearchResult(null);
      return;
    }

    setLoading(true);
    // Start web search in parallel if enabled
    if (useWebSearch) {
      setWebSearchLoading(true);
      searchEnhancements.sonarWebSearch(searchQuery, { model: webSearchModel })
        .then(result => {
          setWebSearchResult(result);
        })
        .catch(error => {
          console.error('Web search error:', error);
          setWebSearchResult(null);
        })
        .finally(() => {
          setWebSearchLoading(false);
        });
    } else {
      setWebSearchResult(null);
    }

    try {
      // Save to search history
      await searchEnhancements.saveSearchToHistory(userId, searchQuery);

      const activeFilters: SearchFilters = {
        ...filters,
        types: selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined,
      };

      // Use enhanced search with AI
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

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [performSearch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // / key to focus search
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Cmd/Ctrl + K for quick search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Esc to close panels
      if (e.key === 'Escape') {
        setShowFilters(false);
        setShowSuggestions(false);
        setSelectedResult(null);
        setShowSavedSearches(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-suggestions
  useEffect(() => {
    if (searchQuery.length > 0) {
      searchEnhancements.getSuggestions(searchQuery, userId, 8).then(sugs => {
        setSuggestions(sugs);
      });
    } else {
      setSuggestions([]);
    }
  }, [searchQuery, userId]);

  // Load saved searches
  useEffect(() => {
    savedSearchesService.getSavedSearches(userId)
      .then(setSavedSearches)
      .catch((err) => {
        console.error('Failed to load saved searches:', err);
        setSavedSearches([]);
      });
  }, [userId]);

  // Load clipboard items
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
  }, [loadClipboardItems]);

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<SearchResultType, SearchResult[]> = {} as any;
    searchResults.forEach(result => {
      if (!groups[result.type]) {
        groups[result.type] = [];
      }
      groups[result.type].push(result);
    });
    return groups;
  }, [searchResults]);

  // Get unique categories from clipboard
  const clipboardCategories = useMemo(() => {
    const cats = new Set<string>();
    clipboardItems.forEach(item => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats);
  }, [clipboardItems]);

  // Handlers
  const handleClipResult = async (result: SearchResult) => {
    try {
      await searchClipboardService.clipSearchResult(userId, result);
      await loadClipboardItems();
    } catch (error) {
      console.error('Error clipping result:', error);
    }
  };

  const handleCreateNote = async () => {
    if (!newClipboardNote.title.trim()) {
      alert('Please enter a title for the note');
      return;
    }

    try {
      const result = await searchClipboardService.createClipboardItem(userId, {
        title: newClipboardNote.title,
        content: newClipboardNote.content,
        contentType: 'note',
        tags: [],
        pinned: false,
        relatedItems: [],
        metadata: {},
      });

      if (result) {
        setNewClipboardNote({ title: '', content: '' });
        setShowNewNoteForm(false);
        await loadClipboardItems();
      } else {
        console.error('Failed to create note - no result returned');
        alert('Failed to save note. Please check your connection and try again.');
      }
    } catch (error) {
      console.error('Error creating note:', error);
      alert('Failed to save note. Please check your connection and try again.');
    }
  };

  // Quick note handler for collapsed clipboard
  const handleQuickNote = async () => {
    if (!quickNoteText.trim()) {
      return;
    }

    try {
      // Use first line or first 50 chars as title
      const lines = quickNoteText.trim().split('\n');
      const title = lines[0].length > 50 ? lines[0].substring(0, 50) + '...' : lines[0];
      const content = lines.length > 1 ? lines.slice(1).join('\n') : quickNoteText.trim();

      const result = await searchClipboardService.createClipboardItem(userId, {
        title: title || 'Quick Note',
        content: content || quickNoteText.trim(),
        contentType: 'note',
        tags: [],
        pinned: false,
        relatedItems: [],
        metadata: {},
      });

      if (result) {
        setQuickNoteText('');
        await loadClipboardItems();
      }
    } catch (error) {
      console.error('Error creating quick note:', error);
      alert('Failed to save note. Please try again.');
    }
  };

  const handleDeleteClipboardItem = async (itemId: string) => {
    try {
      await searchClipboardService.deleteClipboardItem(userId, itemId);
      await loadClipboardItems();
    } catch (error) {
      console.error('Error deleting clipboard item:', error);
    }
  };

  const handleTogglePin = async (itemId: string, currentPin: boolean) => {
    try {
      await searchClipboardService.updateClipboardItem(userId, itemId, { pinned: !currentPin });
      await loadClipboardItems();
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  // Voice search handler
  const handleVoiceSearch = async () => {
    if (!voiceSearchService.isVoiceSearchSupported()) {
      alert('Voice search is not supported in your browser');
      return;
    }

    setIsListening(true);
    try {
      const result = await voiceSearchService.startListening();
      setSearchQuery(result.transcript);
      setShowSuggestions(false);
    } catch (error) {
      console.error('Voice search error:', error);
      alert('Voice search failed. Please try again.');
    } finally {
      setIsListening(false);
    }
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

  // AI categorization handler
  const handleAICategorize = async (item: ClipboardItem) => {
    try {
      const category = await searchAI.categorizeContent(item.title, item.content, clipboardCategories);
      const tags = await searchAI.suggestTags(item.title, item.content, item.tags);
      await searchClipboardService.updateClipboardItem(userId, item.id, {
        category: category.category,
        tags: [...new Set([...item.tags, ...tags.tags])],
      });
      await loadClipboardItems();
    } catch (error) {
      console.error('AI categorization error:', error);
    }
  };

  // Batch operations
  const handleToggleSelectResult = (resultId: string) => {
    setSelectedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  };

  const handleBatchClip = async () => {
    for (const id of selectedResults) {
      const result = searchResults.find(r => r.id === id);
      if (result) {
        await handleClipResult(result);
      }
    }
    setSelectedResults(new Set());
  };

  // Note linking
  const handleLinkNote = async (targetId: string) => {
    if (linkingMode) {
      await searchClipboardService.linkItems(userId, linkingMode, targetId);
      setLinkingMode(null);
      await loadClipboardItems();
    } else {
      setLinkingMode(targetId);
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="unified-search">
      {/* Header */}
      <div className="search-header">
        <div className="header-left">
          <div className="header-title-row">
            <div className="header-icon-badge">
              <Sparkles size={24} />
            </div>
            <h2>Search</h2>
          </div>
          <p className="subtitle">
            {searchResults.length > 0
              ? `${searchResults.length} results found`
              : 'Find anything across your conversations'}
          </p>
        </div>
        <div className="header-actions">
          <button
            className={`icon-btn ${showClipboard ? 'active' : ''}`}
            onClick={() => setShowClipboard(!showClipboard)}
            title={showClipboard ? 'Hide clipboard panel - Store and organize search results' : 'Show clipboard panel - Store and organize search results'}
          >
            <StickyNote size={18} />
          </button>
          <button
            className={`icon-btn ${showSavedSearches ? 'active' : ''}`}
            onClick={() => setShowSavedSearches(!showSavedSearches)}
            title="Saved searches - Quickly access your saved search queries"
          >
            <Bookmark size={18} />
          </button>
          <button
            className={`icon-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Filters - Filter by content type, date range, and sender"
          >
            <Filter size={18} />
          </button>
          <button
            className="icon-btn"
            onClick={() => {
              const format = window.confirm('Export as CSV? (Click Cancel for Markdown)') ? 'csv' : 'markdown';
              handleExport(format);
            }}
            title="Export results - Download search results as CSV or Markdown"
          >
            <Download size={18} />
          </button>
          <button
            className="icon-btn"
            onClick={performSearch}
            title="Refresh - Re-run the current search"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Main Search Bar */}
      <div className="search-bar-container">
        <div className="search-bar-wrapper">
          <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search messages, emails, voxes, notes, tasks, events, people... (Press / or Cmd+K)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (searchQuery) setShowSuggestions(true);
              }}
              onBlur={(e) => {
                // Don't close if clicking on suggestions dropdown
                const relatedTarget = e.relatedTarget as HTMLElement;
                if (relatedTarget && relatedTarget.closest('.suggestions-dropdown')) {
                  return;
                }
                // Small delay to allow click events to fire
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              className="search-input"
              autoFocus
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => {
                setSearchQuery('');
                setShowSuggestions(false);
              }}>
                <X size={16} />
              </button>
            )}
            <button
              className={`voice-search-btn ${isListening ? 'listening' : ''}`}
              onClick={handleVoiceSearch}
              title="Voice Search"
              disabled={!voiceSearchService.isVoiceSearchSupported()}
            >
              <Mic size={16} />
            </button>
          </div>
          
          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div 
              className="suggestions-dropdown"
              onMouseDown={(e) => e.preventDefault()} // Prevent blur on mousedown
            >
              {suggestions.map((sug) => (
                <button
                  key={sug.id}
                  className="suggestion-item"
                  onClick={() => {
                    setSearchQuery(sug.text);
                    setShowSuggestions(false);
                    searchInputRef.current?.focus();
                  }}
                >
                  <span className="suggestion-icon">{sug.icon}</span>
                  <span className="suggestion-text">{sug.text}</span>
                  <span className="suggestion-type">{sug.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="view-mode-toggle">
          <button
            className={`icon-btn ${useAISearch ? 'active' : ''}`}
            onClick={() => setUseAISearch(!useAISearch)}
            title={useAISearch ? 'AI Search ON - Semantic ranking enabled. Click to disable' : 'AI Search OFF - Click to enable semantic ranking of results'}
          >
            <Sparkles size={16} />
          </button>
          <button
            className={`icon-btn ${useWebSearch ? 'active' : ''}`}
            onClick={() => setUseWebSearch(!useWebSearch)}
            title={useWebSearch ? 'Web Search ON - Perplexity Sonar enabled. Click to disable' : 'Web Search OFF - Click to enable real-time web search via Perplexity Sonar'}
          >
            <Globe size={16} />
          </button>
          {useWebSearch && (
            <select
              className="web-search-model-select"
              value={webSearchModel}
              onChange={(e) => setWebSearchModel(e.target.value as 'sonar' | 'sonar-pro' | 'sonar-reasoning')}
              title="Select Sonar model"
            >
              <option value="sonar">Sonar (Fast)</option>
              <option value="sonar-pro">Sonar Pro</option>
              <option value="sonar-reasoning">Sonar Reasoning</option>
            </select>
          )}
          <div className="view-separator" />
          <button
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List view - Display results in a vertical list"
          >
            <List size={16} />
          </button>
          <button
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid view - Display results in a card grid"
          >
            <Grid size={16} />
          </button>
          <button
            className={`view-btn ${viewMode === 'timeline' ? 'active' : ''}`}
            onClick={() => setViewMode('timeline')}
            title="Timeline view - Display results chronologically"
          >
            <Clock size={16} />
          </button>
        </div>
      </div>

      {/* Saved Searches Panel */}
      {showSavedSearches && (
        <div className="saved-searches-panel">
          <div className="saved-searches-header">
            <h4>Saved Searches</h4>
            <button onClick={() => setShowSavedSearches(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="saved-searches-list">
            {savedSearches.length === 0 ? (
              <p className="empty-text">No saved searches yet</p>
            ) : (
              savedSearches.map(search => (
                <button
                  key={search.id}
                  className="saved-search-item"
                  onClick={() => {
                    setSearchQuery(search.query);
                    setFilters(search.filters);
                    setShowSavedSearches(false);
                  }}
                >
                  <span>{search.name}</span>
                  {search.alertEnabled && <span className="alert-badge">🔔</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Batch Actions Bar */}
      {selectedResults.size > 0 && (
        <div className="batch-actions-bar">
          <span>{selectedResults.size} selected</span>
          <button onClick={handleBatchClip}>
            <Save size={14} /> Clip All
          </button>
          <button onClick={() => {
            const selected = searchResults.filter(r => selectedResults.has(r.id));
            searchExport.exportToCSV(selected, 'selected-results');
            setSelectedResults(new Set());
          }}>
            <Download size={14} /> Export
          </button>
          <button onClick={() => setSelectedResults(new Set())}>
            <X size={14} /> Clear
          </button>
        </div>
      )}

      {/* Advanced Filters */}
      {showFilters && (
        <div className="advanced-filters">
          <div className="filter-section">
            <label>Content Types</label>
            <div className="type-filters">
              {Object.keys(resultTypeIcons).map((type) => (
                <button
                  key={type}
                  className={`type-chip ${selectedTypes.has(type as SearchResultType) ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedTypes(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(type as SearchResultType)) {
                        newSet.delete(type as SearchResultType);
                      } else {
                        newSet.add(type as SearchResultType);
                      }
                      return newSet;
                    });
                  }}
                >
                  {resultTypeIcons[type as SearchResultType]} {type}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <label>Sort By</label>
            <div className="sort-controls">
              <select
                value={sortOptions.field}
                onChange={(e) => setSortOptions(prev => ({ ...prev, field: e.target.value as any }))}
              >
                <option value="timestamp">Date</option>
                <option value="relevance">Relevance</option>
                <option value="title">Title</option>
              </select>
              <button
                className="sort-order-btn"
                onClick={() => setSortOptions(prev => ({ ...prev, order: prev.order === 'asc' ? 'desc' : 'asc' }))}
              >
                {sortOptions.order === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>

          <div className="filter-section">
            <label>Date Range</label>
            <div className="date-range">
              <input
                type="date"
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  dateFrom: e.target.value ? new Date(e.target.value) : undefined,
                }))}
              />
              <span>to</span>
              <input
                type="date"
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  dateTo: e.target.value ? new Date(e.target.value) : undefined,
                }))}
              />
            </div>
          </div>

          <div className="filter-section">
            <label>Sender/People</label>
            <input
              type="text"
              placeholder="Filter by sender name..."
              onChange={(e) => setFilters(prev => ({
                ...prev,
                sender: e.target.value || undefined,
              }))}
            />
          </div>
        </div>
      )}

      {/* Clipboard Panel - Above Search Results */}
      <div className="clipboard-section">
        {!clipboardExpanded ? (
          /* Collapsed Clipboard - Quick Note Button */
          <div className="clipboard-collapsed">
            <div className="quick-note-container">
              <input
                type="text"
                placeholder="Quick note..."
                value={quickNoteText}
                onChange={(e) => setQuickNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleQuickNote();
                  }
                }}
                className="quick-note-input"
              />
              <button
                onClick={handleQuickNote}
                disabled={!quickNoteText.trim()}
                className="quick-note-save-btn"
                title="Save note (Enter)"
              >
                <Save size={16} />
              </button>
              <button
                onClick={() => setClipboardExpanded(true)}
                className="clipboard-expand-btn"
                title="Expand clipboard"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* Expanded Clipboard Panel */
          <div className="clipboard-panel expanded">
            <div className="clipboard-header">
              <h3>
                <StickyNote size={18} />
                Clipboard
              </h3>
              <div className="clipboard-header-actions">
                <button
                  className="icon-btn-small"
                  onClick={() => handleExport('markdown')}
                  title="Export all notes as Markdown"
                >
                  <Download size={14} />
                </button>
                <button
                  className="icon-btn-small"
                  onClick={() => setClipboardExpanded(false)}
                  title="Collapse clipboard"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>

            <div className="clipboard-view-toggle">
              <button
                className={`view-toggle-btn ${clipboardView === 'notes' ? 'active' : ''}`}
                onClick={() => setClipboardView('notes')}
              >
                Notes
              </button>
              <button
                className={`view-toggle-btn ${clipboardView === 'categories' ? 'active' : ''}`}
                onClick={() => setClipboardView('categories')}
              >
                Categories
              </button>
            </div>

            <div className="clipboard-content">
              {clipboardView === 'notes' ? (
                <>
                  {/* New Note Form */}
                  {showNewNoteForm ? (
                    <div className="new-note-form">
                      <input
                        type="text"
                        placeholder="Note title..."
                        value={newClipboardNote.title}
                        onChange={(e) => setNewClipboardNote(prev => ({ ...prev, title: e.target.value }))}
                        className="note-title-input"
                      />
                      <RichTextEditor
                        value={newClipboardNote.content}
                        onChange={(value) => setNewClipboardNote(prev => ({ ...prev, content: value }))}
                        placeholder="Note content..."
                        className="note-content-input"
                      />
                      <div className="note-form-actions">
                        <button onClick={handleCreateNote} className="save-btn">
                          <Save size={14} />
                          Save
                        </button>
                        <button onClick={() => setShowNewNoteForm(false)} className="cancel-btn">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="new-note-btn"
                      onClick={() => setShowNewNoteForm(true)}
                    >
                      <Plus size={16} />
                      New Note
                    </button>
                  )}

                  {/* Category Filter */}
                  {clipboardCategories.length > 0 && (
                    <div className="clipboard-categories">
                      <button
                        className={`category-chip ${selectedClipboardCategory === null ? 'active' : ''}`}
                        onClick={() => setSelectedClipboardCategory(null)}
                      >
                        All
                      </button>
                      {clipboardCategories.map(cat => (
                        <button
                          key={cat}
                          className={`category-chip ${selectedClipboardCategory === cat ? 'active' : ''}`}
                          onClick={() => setSelectedClipboardCategory(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Categories View */
                <div className="categories-view">
                  {clipboardCategories.length === 0 ? (
                    <div className="empty-categories">
                      <Folder size={32} />
                      <p>No categories yet</p>
                      <p className="empty-subtitle">Use AI categorize on notes to organize them</p>
                    </div>
                  ) : (
                    <div className="category-list">
                      {clipboardCategories.map(cat => {
                        const catItems = clipboardItems.filter(item => item.category === cat);
                        return (
                          <button
                            key={cat}
                            className="category-card"
                            onClick={() => {
                              setSelectedClipboardCategory(cat);
                              setClipboardView('notes');
                            }}
                          >
                            <div className="category-card-icon">
                              <Folder size={20} />
                            </div>
                            <div className="category-card-info">
                              <span className="category-card-name">{cat}</span>
                              <span className="category-card-count">{catItems.length} item{catItems.length !== 1 ? 's' : ''}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Clipboard Items - only show in notes view */}
              {clipboardView === 'notes' && (
                <div className="clipboard-items">
                  {clipboardItems.length === 0 ? (
                    <div className="empty-clipboard">
                      <StickyNote size={32} />
                      <p>No notes yet</p>
                      <p className="empty-subtitle">Clip search results or create notes</p>
                    </div>
                  ) : (
                    clipboardItems
                      .filter(item => selectedClipboardCategory === null || item.category === selectedClipboardCategory)
                      .map((item) => (
                        <div
                          key={item.id}
                          data-item-id={item.id}
                          className={`clipboard-item ${item.pinned ? 'pinned' : ''} ${linkingMode === item.id ? 'linking' : ''}`}
                          style={{ borderLeftColor: item.color }}
                        >
                          <div className="clipboard-item-header">
                            <span className="item-title">{item.title}</span>
                            <div className="item-actions">
                              <button
                                className={`icon-btn-small ${linkingMode === item.id ? 'active' : ''}`}
                                onClick={() => handleLinkNote(item.id)}
                                title={linkingMode ? 'Click another note to link' : 'Link note'}
                              >
                                <LinkIcon size={12} />
                              </button>
                              <button
                                className="icon-btn-small"
                                onClick={() => handleAICategorize(item)}
                                title="AI Categorize"
                              >
                                <Sparkles size={12} />
                              </button>
                              <button
                                className="icon-btn-small"
                                onClick={() => handleTogglePin(item.id, item.pinned || false)}
                                title={item.pinned ? 'Unpin' : 'Pin'}
                              >
                                <Pin size={12} style={{ fill: item.pinned ? 'currentColor' : 'none' }} />
                              </button>
                              <button
                                className="icon-btn-small"
                                onClick={() => handleDeleteClipboardItem(item.id)}
                                title="Delete note"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="clipboard-item-content" dangerouslySetInnerHTML={{ __html: item.content }} />
                          {item.relatedItems && item.relatedItems.length > 0 && (
                            <div className="clipboard-item-links">
                              <span className="links-label">Linked:</span>
                              {item.relatedItems.map((rel: any, idx: number) => {
                                const linkedItem = clipboardItems.find(i => i.id === rel.id);
                                return linkedItem ? (
                                  <button
                                    key={idx}
                                    className="link-chip"
                                    onClick={() => {
                                      const linkedElement = document.querySelector(`[data-item-id="${rel.id}"]`);
                                      linkedElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }}
                                  >
                                    {linkedItem.title}
                                  </button>
                                ) : null;
                              })}
                            </div>
                          )}
                          {item.tags && item.tags.length > 0 && (
                            <div className="clipboard-item-tags">
                              {item.tags.map((tag: string) => (
                                <span key={tag} className="tag-small">{tag}</span>
                              ))}
                            </div>
                          )}
                          <div className="clipboard-item-meta">
                            <span className="item-time">{formatTimestamp(item.timestamp || item.updatedAt)}</span>
                            {item.category && (
                              <span className="item-category">{item.category}</span>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area - Search Results */}
      <div className="search-content">
        {/* Search Results Panel */}
        {showResultsPanel && (
          <div className="results-panel">
            {/* Panel Header */}
            <div className="results-panel-header">
              <h3>
                <Search size={18} />
                Search Results
                {searchResults.length > 0 && (
                  <span className="results-count">({searchResults.length})</span>
                )}
              </h3>
              <div className="results-panel-header-actions">
                <button
                  className="icon-btn-small"
                  onClick={() => handleExport('csv')}
                  title="Export results as CSV"
                  disabled={searchResults.length === 0}
                >
                  <Download size={14} />
                </button>
                <button
                  className="icon-btn-small"
                  onClick={() => setShowResultsPanel(false)}
                  title="Hide results panel"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Panel Content */}
            <div className="results-panel-content">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Searching...</p>
            </div>
          )}

          {/* Web Search Results (Perplexity Sonar) */}
          {useWebSearch && searchQuery && (webSearchLoading || webSearchResult) && (
            <div className="web-search-results">
              <div className="web-search-header">
                <Globe size={18} />
                <span>Web Search</span>
                <span className="web-search-model-badge">{webSearchModel}</span>
                {webSearchLoading && <Loader2 size={14} className="spinning" />}
              </div>
              {webSearchLoading && !webSearchResult && (
                <div className="web-search-loading">
                  <p>Searching the web...</p>
                </div>
              )}
              {webSearchResult && (
                <div className="web-search-content">
                  <div className="web-search-answer">
                    {webSearchResult.answer}
                  </div>
                  {webSearchResult.citations.length > 0 && (
                    <div className="web-search-citations">
                      <span className="citations-label">Sources:</span>
                      <div className="citations-list">
                        {webSearchResult.citations.map((citation, idx) => (
                          <a
                            key={idx}
                            href={citation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="citation-link"
                          >
                            <ExternalLink size={12} />
                            <span>{new URL(citation).hostname}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {webSearchResult.relatedQuestions && webSearchResult.relatedQuestions.length > 0 && (
                    <div className="web-search-related">
                      <span className="related-label">Related:</span>
                      <div className="related-questions">
                        {webSearchResult.relatedQuestions.slice(0, 3).map((q, idx) => (
                          <button
                            key={idx}
                            className="related-question"
                            onClick={() => {
                              setSearchQuery(q);
                              performSearch();
                            }}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && searchQuery && searchResults.length === 0 && !webSearchResult && (
            <div className="empty-state">
              <Search size={48} className="empty-icon" />
              <p>No results found</p>
              <p className="empty-subtitle">Try adjusting your search or filters</p>
            </div>
          )}

          {!loading && !searchQuery && (
            <div className="empty-state">
              <Sparkles size={48} className="empty-icon" />
              <p>Start typing to search</p>
              <p className="empty-subtitle">
                Search across messages, emails, voxes, notes, tasks, events, contacts, and conversations
              </p>
            </div>
          )}

          {!loading && searchResults.length > 0 && viewMode === 'timeline' && (
            <div className="timeline-view">
              {searchResults
                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
                .map((result, index) => (
                  <div key={result.id} className="timeline-item">
                    <div className="timeline-marker" style={{ backgroundColor: resultTypeColors[result.type] }} />
                    <div className="timeline-content">
                      <div className="timeline-date">
                        {result.timestamp.toLocaleDateString()} {result.timestamp.toLocaleTimeString()}
                      </div>
                      <div
                        className={`result-card ${selectedResult?.id === result.id ? 'selected' : ''}`}
                        onClick={() => setSelectedResult(result)}
                      >
                        <div className="result-header">
                          <span
                            className="result-type-badge"
                            style={{ backgroundColor: resultTypeColors[result.type] }}
                          >
                            {resultTypeIcons[result.type]}
                          </span>
                          <span className="result-title">{result.title}</span>
                          <button
                            className="clip-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClipResult(result);
                            }}
                            title="Add to clipboard - Save this result to your notes"
                          >
                            <Save size={14} />
                          </button>
                        </div>
                        <div className="result-content">
                          {result.content.substring(0, 200)}
                          {result.content.length > 200 && '...'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {!loading && searchResults.length > 0 && viewMode !== 'timeline' && (
            <>
              {/* Results by Type */}
              <div className="results-by-type">
                {Object.entries(groupedResults).map(([type, results]) => (
                  <div key={type} className="result-group">
                    <div className="group-header">
                      <span className="group-icon">{resultTypeIcons[type as SearchResultType]}</span>
                      <span className="group-title">{type.replace('_', ' ')}</span>
                      <span className="group-count">({results.length})</span>
                    </div>
                    <div className={`result-list ${viewMode}`}>
                      {results.map((result) => (
                        <div
                          key={result.id}
                          className={`result-card ${selectedResult?.id === result.id ? 'selected' : ''} ${selectedResults.has(result.id) ? 'checked' : ''}`}
                          onClick={() => setSelectedResult(result)}
                        >
                          <button
                            className="result-checkbox"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSelectResult(result.id);
                            }}
                          >
                            {selectedResults.has(result.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                          <div className="result-header">
                            <span
                              className="result-type-badge"
                              style={{ backgroundColor: resultTypeColors[result.type] }}
                            >
                              {resultTypeIcons[result.type]}
                            </span>
                            <span className="result-title">{result.title}</span>
                            <span className="result-time">{formatTimestamp(result.timestamp)}</span>
                            <button
                              className="clip-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClipResult(result);
                              }}
                              title="Add to clipboard - Save this result to your notes"
                            >
                              <Save size={14} />
                            </button>
                          </div>
                          <div className="result-content">
                            {result.content.substring(0, 200)}
                            {result.content.length > 200 && '...'}
                          </div>
                          {result.sender && (
                            <div className="result-meta">
                              <span className="result-sender">{result.sender}</span>
                              {result.source && (
                                <span className="result-source">{result.source}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
            </div>
          </div>
        )}

        {/* Show Results Panel Button - when hidden */}
        {!showResultsPanel && (
          <button
            className="show-results-panel-btn"
            onClick={() => setShowResultsPanel(true)}
            title="Show search results panel"
          >
            <Search size={16} />
            Show Results
            {searchResults.length > 0 && (
              <span className="results-count-badge">{searchResults.length}</span>
            )}
          </button>
        )}

        {/* Result Detail Panel */}
        {selectedResult && (
          <div className="result-detail-panel">
            <div className="detail-header">
              <div className="detail-title">
                <span
                  className="detail-type-badge"
                  style={{ backgroundColor: resultTypeColors[selectedResult.type] }}
                >
                  {resultTypeIcons[selectedResult.type]}
                </span>
                <h3>{selectedResult.title}</h3>
              </div>
              <button className="close-detail" onClick={() => setSelectedResult(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="detail-content">
              <div className="detail-meta">
                <span className="detail-time">{selectedResult.timestamp.toLocaleString()}</span>
                {selectedResult.sender && (
                  <span className="detail-sender">From: {selectedResult.sender}</span>
                )}
                {selectedResult.source && (
                  <span className="detail-source">Source: {selectedResult.source}</span>
                )}
              </div>
              <div className="detail-text">{selectedResult.content}</div>
              {selectedResult.metadata && Object.keys(selectedResult.metadata).length > 0 && (
                <div className="detail-metadata">
                  <h4>Metadata</h4>
                  <pre>{JSON.stringify(selectedResult.metadata, null, 2)}</pre>
                </div>
              )}
              <div className="detail-actions">
                <button
                  className="action-btn primary"
                  onClick={() => handleClipResult(selectedResult)}
                >
                  <Save size={16} />
                  Add to Clipboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}