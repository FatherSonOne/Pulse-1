# Unified Search - Complete Feature Integration

## 🎉 All Services Created Successfully!

All requested features have been implemented as services. Here's what's ready:

## ✅ Completed Services & Components

### Core Services:
1. ✅ **searchEnhancements.ts** - Search operators, AI semantic search, auto-suggestions
2. ✅ **searchAI.ts** - AI categorization and tagging
3. ✅ **searchExport.ts** - Export to CSV, PDF, Markdown
4. ✅ **savedSearches.ts** - Saved searches with alerts
5. ✅ **voiceSearch.ts** - Voice input using Web Speech API
6. ✅ **searchIntegrations.ts** - Scaffolding for Notion/Google Keep
7. ✅ **searchClipboardService.ts** - Enhanced with note linking

### Components:
1. ✅ **RichTextEditor.tsx** - Rich text editor for notes
2. ✅ **searchOperators.ts** - Operator parsing utility

### Database:
1. ✅ **010_search_enhancements.sql** - Search history and saved searches tables

## 🔧 Integration Steps

### Step 1: Update UnifiedSearch.tsx Imports

Add these imports at the top:

```typescript
import { searchEnhancements, SearchSuggestion } from '../services/searchEnhancements';
import { searchAI } from '../services/searchAI';
import { searchExport } from '../services/searchExport';
import { savedSearchesService, SavedSearch } from '../services/savedSearches';
import { voiceSearchService } from '../services/voiceSearch';
import { RichTextEditor } from './RichTextEditor';
import { parseSearchQuery } from '../utils/searchOperators';
import { Mic, Download, Link as LinkIcon, Share2 } from 'lucide-react';
```

### Step 2: Add New State Variables

```typescript
// Add after existing state declarations
const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
const [showSuggestions, setShowSuggestions] = useState(false);
const [useAISearch, setUseAISearch] = useState(true);
const [isListening, setIsListening] = useState(false);
const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
const [viewMode, setViewMode] = useState<'list' | 'grid' | 'timeline'>('list');
const searchInputRef = useRef<HTMLInputElement>(null);
const apiKey = import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
```

### Step 3: Add Keyboard Shortcuts

```typescript
// Add useEffect for keyboard shortcuts
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
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

### Step 4: Update Search to Use Enhanced Search

```typescript
// Replace performSearch function
const performSearch = useCallback(async () => {
  if (!searchQuery.trim()) {
    setSearchResults([]);
    return;
  }

  setLoading(true);
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
  } catch (error) {
    console.error('Search error:', error);
    setSearchResults([]);
  } finally {
    setLoading(false);
  }
}, [searchQuery, filters, selectedTypes, useAISearch, userId, apiKey]);
```

### Step 5: Add Auto-suggestions

```typescript
// Add useEffect for suggestions
useEffect(() => {
  if (searchQuery.length > 0) {
    searchEnhancements.getSuggestions(searchQuery, userId, 8).then(sugs => {
      setSuggestions(sugs);
      setShowSuggestions(true);
    });
  } else {
    setShowSuggestions(false);
  }
}, [searchQuery, userId]);
```

### Step 6: Add Voice Search Handler

```typescript
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
```

### Step 7: Update Search Bar with Voice Button & Suggestions

```typescript
// Replace search bar section with:
<div className="search-bar-container">
  <div className="search-bar">
    <Search size={20} className="search-icon" />
    <input
      ref={searchInputRef}
      type="text"
      placeholder="Search messages, emails, voxes, notes, tasks, events, people..."
      value={searchQuery}
      onChange={(e) => {
        setSearchQuery(e.target.value);
        setShowSuggestions(true);
      }}
      onFocus={() => {
        if (searchQuery) setShowSuggestions(true);
      }}
      className="search-input"
    />
    {searchQuery && (
      <button className="clear-search" onClick={() => setSearchQuery('')}>
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
    <div className="suggestions-dropdown">
      {suggestions.map((sug) => (
        <button
          key={sug.id}
          className="suggestion-item"
          onClick={() => {
            setSearchQuery(sug.text);
            setShowSuggestions(false);
          }}
        >
          <span className="suggestion-icon">{sug.icon}</span>
          <span className="suggestion-text">{sug.text}</span>
          <span className="suggestion-type">{sug.type}</span>
        </button>
      ))}
    </div>
  )}
  
  <div className="view-mode-toggle">
    {/* AI Search Toggle */}
    <button
      className={`icon-btn ${useAISearch ? 'active' : ''}`}
      onClick={() => setUseAISearch(!useAISearch)}
      title="Toggle AI Search"
    >
      <Sparkles size={16} />
    </button>
    
    <button
      className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
      onClick={() => setViewMode('list')}
    >
      <List size={16} />
    </button>
    <button
      className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
      onClick={() => setViewMode('grid')}
    >
      <Grid size={16} />
    </button>
    <button
      className={`view-btn ${viewMode === 'timeline' ? 'active' : ''}`}
      onClick={() => setViewMode('timeline')}
      title="Timeline View"
    >
      <Clock size={16} />
    </button>
  </div>
</div>
```

### Step 8: Replace Textarea with RichTextEditor

```typescript
// In the new note form, replace textarea with:
<RichTextEditor
  value={newClipboardNote.content}
  onChange={(value) => setNewClipboardNote(prev => ({ ...prev, content: value }))}
  placeholder="Note content..."
  className="note-content-input"
/>
```

### Step 9: Add Export Functionality

```typescript
// Add export handler
const handleExport = (format: 'csv' | 'pdf' | 'markdown') => {
  if (format === 'csv') {
    searchExport.exportToCSV(searchResults, 'search-results');
  } else if (format === 'pdf') {
    searchExport.exportToPDF(searchResults, 'Search Results');
  } else if (format === 'markdown') {
    searchExport.exportClipboardToMarkdown(clipboardItems, 'clipboard');
  }
};

// Add export button in header actions
<button
  className="icon-btn"
  onClick={() => {
    const format = window.confirm('Export as CSV? (Click Cancel for Markdown)') ? 'csv' : 'markdown';
    handleExport(format);
  }}
  title="Export"
>
  <Download size={18} />
</button>
```

### Step 10: Add AI Categorization Button

```typescript
// Add to clipboard item actions
<button
  className="icon-btn-small"
  onClick={async () => {
    const category = await searchAI.categorizeContent(item.title, item.content, clipboardCategories);
    const tags = await searchAI.suggestTags(item.title, item.content, item.tags);
    await searchClipboardService.updateClipboardItem(userId, item.id, {
      category: category.category,
      tags: [...item.tags, ...tags.tags],
    });
    await loadClipboardItems();
  }}
  title="AI Categorize"
>
  <Sparkles size={12} />
</button>
```

### Step 11: Add Batch Operations

```typescript
// Add batch selection
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

// Add batch actions bar
{selectedResults.size > 0 && (
  <div className="batch-actions-bar">
    <span>{selectedResults.size} selected</span>
    <button onClick={() => {
      // Clip all selected
      selectedResults.forEach(id => {
        const result = searchResults.find(r => r.id === id);
        if (result) handleClipResult(result);
      });
      setSelectedResults(new Set());
    }}>
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
```

### Step 12: Add Timeline View

```typescript
// Add timeline rendering
{viewMode === 'timeline' && (
  <div className="timeline-view">
    {searchResults
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((result, index) => (
        <div key={result.id} className="timeline-item">
          <div className="timeline-marker" />
          <div className="timeline-content">
            <div className="timeline-date">
              {result.timestamp.toLocaleDateString()} {result.timestamp.toLocaleTimeString()}
            </div>
            {/* Result card content */}
          </div>
        </div>
      ))}
  </div>
)}
```

### Step 13: Add Saved Searches

```typescript
// Load saved searches
useEffect(() => {
  savedSearchesService.getSavedSearches(userId).then(setSavedSearches);
}, [userId]);

// Add saved searches menu
<div className="saved-searches-menu">
  <h4>Saved Searches</h4>
  {savedSearches.map(search => (
    <button
      key={search.id}
      onClick={() => {
        setSearchQuery(search.query);
        setFilters(search.filters);
      }}
    >
      {search.name}
    </button>
  ))}
</div>
```

## 🎨 Additional CSS Needed

Add these styles to `UnifiedSearch.css`:

```css
/* Suggestions */
.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--search-white);
  border: 1px solid var(--search-gray-200);
  border-radius: 8px;
  margin-top: 4px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.suggestion-item:hover {
  background: var(--search-gray-100);
}

/* Voice Search */
.voice-search-btn {
  padding: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--search-gray-600);
}

.voice-search-btn.listening {
  color: var(--search-primary);
  animation: pulse 1s infinite;
}

/* Timeline View */
.timeline-view {
  position: relative;
  padding: 24px;
}

.timeline-item {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  position: relative;
}

.timeline-marker {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--search-primary);
  border: 2px solid var(--search-white);
  flex-shrink: 0;
  margin-top: 4px;
}

.timeline-content {
  flex: 1;
}

/* Batch Actions */
.batch-actions-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  background: var(--search-primary);
  color: white;
  position: sticky;
  top: 0;
  z-index: 10;
}
```

## 🚀 Running the Migrations

Don't forget to run the database migration:

```sql
-- Run in Supabase SQL Editor
-- File: supabase/migrations/010_search_enhancements.sql
```

## ✅ Testing Checklist

- [ ] Search operators work (`from:email`, `type:email`, etc.)
- [ ] Keyboard shortcuts work (`/`, `Cmd+K`)
- [ ] Auto-suggestions appear as you type
- [ ] Voice search works (if browser supports it)
- [ ] AI search toggle works
- [ ] Rich text editor works in notes
- [ ] Export functions work
- [ ] AI categorization works
- [ ] Timeline view displays correctly
- [ ] Saved searches load and execute
- [ ] Batch operations work

---

**Status**: ✅ All services ready, integration code provided above!