import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Fuse from 'fuse.js';
import { KnowledgeDoc } from '../../../services/ragService';

interface SearchResult {
  doc: KnowledgeDoc;
  matchType: 'title' | 'content' | 'summary' | 'keywords';
  matchedText: string;
  matchOffset: number;
  score: number;
}

interface DocumentSearchProps {
  documents: KnowledgeDoc[];
  activeContextIds: Set<string>;
  onResultClick: (doc: KnowledgeDoc, highlightText?: string, offset?: number) => void;
  className?: string;
}

export const DocumentSearch: React.FC<DocumentSearchProps> = ({
  documents,
  activeContextIds,
  onResultClick,
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'active-context'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [fileTypeFilter, setFileTypeFilter] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get documents based on scope
  const scopedDocuments = useMemo(() => {
    if (scope === 'active-context' && activeContextIds.size > 0) {
      return documents.filter(d => activeContextIds.has(d.id));
    }
    return documents;
  }, [documents, scope, activeContextIds]);

  // Apply file type filter
  const filteredDocuments = useMemo(() => {
    if (fileTypeFilter.length === 0) return scopedDocuments;
    return scopedDocuments.filter(d =>
      fileTypeFilter.includes(d.file_type?.toLowerCase() || 'text')
    );
  }, [scopedDocuments, fileTypeFilter]);

  // Configure Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(filteredDocuments, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'ai_summary', weight: 1.5 },
        { name: 'ai_keywords', weight: 1 },
        { name: 'text_content', weight: 0.5 }
      ],
      threshold: 0.4,
      includeMatches: true,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
      findAllMatches: true
    });
  }, [filteredDocuments]);

  // Perform search
  const results = useMemo((): SearchResult[] => {
    if (query.length < 2) return [];

    const fuseResults = fuse.search(query);

    return fuseResults.slice(0, 10).map(result => {
      const doc = result.item;
      let matchType: 'title' | 'content' | 'summary' | 'keywords' = 'content';
      let matchedText = '';
      let matchOffset = 0;

      // Find best match
      if (result.matches && result.matches.length > 0) {
        const match = result.matches[0];
        matchType = match.key === 'title' ? 'title' :
                    match.key === 'ai_summary' ? 'summary' :
                    match.key === 'ai_keywords' ? 'keywords' : 'content';

        if (typeof match.value === 'string') {
          // Extract context around match
          const indices = match.indices?.[0];
          if (indices) {
            const [start, end] = indices;
            const contextStart = Math.max(0, start - 30);
            const contextEnd = Math.min(match.value.length, end + 50);
            matchedText = (contextStart > 0 ? '...' : '') +
                          match.value.slice(contextStart, contextEnd) +
                          (contextEnd < match.value.length ? '...' : '');
            matchOffset = start;
          } else {
            matchedText = match.value.slice(0, 100) + (match.value.length > 100 ? '...' : '');
          }
        }
      }

      return {
        doc,
        matchType,
        matchedText,
        matchOffset,
        score: result.score || 1
      };
    });
  }, [query, fuse]);

  // Get unique file types for filter
  const availableFileTypes = useMemo(() => {
    const types = new Set<string>();
    documents.forEach(d => {
      types.add(d.file_type?.toLowerCase() || 'text');
    });
    return Array.from(types);
  }, [documents]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('');
      setIsExpanded(false);
      inputRef.current?.blur();
    }
  }, []);

  // Highlight matching text
  const highlightMatch = (text: string, searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) return text;

    const regex = new RegExp(`(${escapeRegex(searchQuery)})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getMatchIcon = (matchType: string) => {
    switch (matchType) {
      case 'title': return 'fa-heading';
      case 'summary': return 'fa-sparkles';
      case 'keywords': return 'fa-tags';
      default: return 'fa-file-lines';
    }
  };

  return (
    <div className={`${className}`}>
      {/* Search Input */}
      <div className="p-3 war-room-divider">
        <div className="relative">
          <i className="fa fa-search absolute left-3 top-1/2 -translate-y-1/2 war-room-text-secondary text-sm"></i>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.length > 0) setIsExpanded(true);
            }}
            onFocus={() => setIsExpanded(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search documents..."
            className="war-room-input pl-10 pr-8 text-sm"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 war-room-text-secondary hover:text-rose-400 transition-colors"
            >
              <i className="fa fa-times text-xs"></i>
            </button>
          )}
        </div>

        {/* Scope Toggle */}
        {isExpanded && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setScope('all')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                scope === 'all'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'war-room-panel-inset war-room-text-secondary hover:text-rose-400'
              }`}
            >
              <i className="fa fa-globe mr-1"></i>
              All ({documents.length})
            </button>
            <button
              onClick={() => setScope('active-context')}
              disabled={activeContextIds.size === 0}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                scope === 'active-context'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'war-room-panel-inset war-room-text-secondary hover:text-rose-400 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              <i className="fa fa-check-circle mr-1"></i>
              Active ({activeContextIds.size})
            </button>
          </div>
        )}

        {/* Filters Toggle */}
        {isExpanded && availableFileTypes.length > 1 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="mt-2 text-xs war-room-text-secondary hover:text-rose-400 transition-colors flex items-center gap-1"
          >
            <i className={`fa ${showFilters ? 'fa-chevron-up' : 'fa-filter'}`}></i>
            {showFilters ? 'Hide filters' : 'Show filters'}
            {fileTypeFilter.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-rose-500/20 text-rose-400 rounded text-xs">
                {fileTypeFilter.length}
              </span>
            )}
          </button>
        )}

        {/* File Type Filters */}
        {showFilters && (
          <div className="mt-2 flex flex-wrap gap-1">
            {availableFileTypes.map(type => (
              <button
                key={type}
                onClick={() => {
                  setFileTypeFilter(prev =>
                    prev.includes(type)
                      ? prev.filter(t => t !== type)
                      : [...prev, type]
                  );
                }}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  fileTypeFilter.includes(type)
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'war-room-panel-inset war-room-text-secondary hover:text-rose-400'
                }`}
              >
                {type.toUpperCase()}
              </button>
            ))}
            {fileTypeFilter.length > 0 && (
              <button
                onClick={() => setFileTypeFilter([])}
                className="px-2 py-1 text-xs war-room-text-secondary hover:text-rose-400"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search Results */}
      {isExpanded && query.length >= 2 && (
        <div className="max-h-64 overflow-y-auto war-room-scrollbar">
          {results.length === 0 ? (
            <div className="p-4 text-center">
              <i className="fa fa-search-minus text-2xl war-room-text-secondary mb-2"></i>
              <p className="text-sm war-room-text-secondary">
                No results for "{query}"
              </p>
              <p className="text-xs war-room-text-muted mt-1">
                Try different keywords or check your filters
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              <div className="px-2 py-1 text-xs war-room-text-secondary">
                {results.length} result{results.length !== 1 ? 's' : ''} found
              </div>
              {results.map((result, index) => (
                <button
                  key={`${result.doc.id}-${index}`}
                  onClick={() => onResultClick(result.doc, query, result.matchOffset)}
                  className="w-full p-2 rounded-lg text-left transition-all hover:bg-rose-500/10 war-room-panel-inset group"
                >
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 mt-0.5">
                      <i className={`fa ${getMatchIcon(result.matchType)} text-xs war-room-text-secondary group-hover:text-rose-400`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate group-hover:text-rose-400">
                        {highlightMatch(result.doc.title, query)}
                      </div>
                      {result.matchedText && result.matchType !== 'title' && (
                        <div className="text-xs war-room-text-secondary mt-0.5 line-clamp-2">
                          {highlightMatch(result.matchedText, query)}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs war-room-text-muted">
                          {result.doc.file_type || 'text'}
                        </span>
                        {activeContextIds.has(result.doc.id) && (
                          <span className="text-xs text-emerald-400">
                            <i className="fa fa-check-circle mr-0.5"></i>
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <i className="fa fa-arrow-right text-xs war-room-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Stats when not searching */}
      {isExpanded && query.length < 2 && (
        <div className="p-3 text-xs war-room-text-secondary">
          <div className="flex items-center justify-between">
            <span>
              <i className="fa fa-file-lines mr-1"></i>
              {filteredDocuments.length} documents
            </span>
            {activeContextIds.size > 0 && (
              <span className="text-emerald-400">
                <i className="fa fa-check-circle mr-1"></i>
                {activeContextIds.size} in context
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Utility function to escape regex special characters
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default DocumentSearch;
