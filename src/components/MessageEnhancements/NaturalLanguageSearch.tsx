import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

// Types
interface SearchResult {
  id: string;
  type: 'message' | 'attachment' | 'decision' | 'task' | 'mention';
  messageId: string;
  conversationId: string;
  conversationName: string;
  content: string;
  sender: string;
  timestamp: Date;
  relevanceScore: number;
  highlights: string[];
  context?: {
    before?: string;
    after?: string;
  };
  metadata?: {
    attachmentType?: string;
    attachmentName?: string;
    taskStatus?: string;
    decisionOutcome?: string;
  };
}

interface SearchSuggestion {
  id: string;
  query: string;
  type: 'recent' | 'suggested' | 'filter';
  icon: string;
  description?: string;
}

interface SearchFilter {
  type?: SearchResult['type'][];
  dateRange?: { start: Date; end: Date };
  contacts?: string[];
  conversations?: string[];
  hasAttachment?: boolean;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

interface NaturalLanguageSearchProps {
  onSearch?: (query: string, filters: SearchFilter) => Promise<SearchResult[]>;
  onResultClick?: (result: SearchResult) => void;
  recentSearches?: string[];
  onSaveSearch?: (query: string) => void;
  onClose?: () => void;
}

// Parse natural language into structured filters
const parseNaturalLanguageQuery = (query: string): { cleanQuery: string; filters: SearchFilter } => {
  const filters: SearchFilter = {};
  let cleanQuery = query;

  // Parse date references
  const datePatterns = [
    { pattern: /\b(today|yesterday|this week|last week|this month|last month)\b/i, handler: (match: string) => {
      const now = new Date();
      const start = new Date();
      const end = new Date();

      switch (match.toLowerCase()) {
        case 'today':
          start.setHours(0, 0, 0, 0);
          break;
        case 'yesterday':
          start.setDate(start.getDate() - 1);
          start.setHours(0, 0, 0, 0);
          end.setDate(end.getDate() - 1);
          end.setHours(23, 59, 59, 999);
          break;
        case 'this week':
          start.setDate(start.getDate() - start.getDay());
          start.setHours(0, 0, 0, 0);
          break;
        case 'last week':
          start.setDate(start.getDate() - start.getDay() - 7);
          start.setHours(0, 0, 0, 0);
          end.setDate(end.getDate() - end.getDay() - 1);
          end.setHours(23, 59, 59, 999);
          break;
        case 'this month':
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
          break;
        case 'last month':
          start.setMonth(start.getMonth() - 1);
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
          end.setDate(0);
          end.setHours(23, 59, 59, 999);
          break;
      }

      filters.dateRange = { start, end };
    }},
    { pattern: /\b(in|from)\s+(\d{1,2})\s+(days?|weeks?|months?)\s*(ago)?\b/i, handler: (match: string, _, num: string, unit: string) => {
      const start = new Date();
      const n = parseInt(num);

      if (unit.toLowerCase().startsWith('day')) {
        start.setDate(start.getDate() - n);
      } else if (unit.toLowerCase().startsWith('week')) {
        start.setDate(start.getDate() - n * 7);
      } else if (unit.toLowerCase().startsWith('month')) {
        start.setMonth(start.getMonth() - n);
      }

      filters.dateRange = { start, end: new Date() };
    }},
  ];

  datePatterns.forEach(({ pattern, handler }) => {
    const match = cleanQuery.match(pattern);
    if (match) {
      handler(match[0], ...match.slice(1));
      cleanQuery = cleanQuery.replace(pattern, '').trim();
    }
  });

  // Parse type filters
  const typePatterns = [
    { pattern: /\b(files?|attachments?|documents?|images?|pdfs?)\b/i, type: 'attachment' as const },
    { pattern: /\b(decisions?|decided)\b/i, type: 'decision' as const },
    { pattern: /\b(tasks?|todos?|action items?)\b/i, type: 'task' as const },
    { pattern: /\b(mentions?|mentioned|@)\b/i, type: 'mention' as const },
  ];

  typePatterns.forEach(({ pattern, type }) => {
    if (pattern.test(cleanQuery)) {
      filters.type = [...(filters.type || []), type];
      cleanQuery = cleanQuery.replace(pattern, '').trim();
    }
  });

  // Parse "from" contact
  const fromMatch = cleanQuery.match(/\bfrom\s+["']?([^"']+)["']?\b/i);
  if (fromMatch) {
    filters.contacts = [fromMatch[1].trim()];
    cleanQuery = cleanQuery.replace(fromMatch[0], '').trim();
  }

  // Parse sentiment
  if (/\b(positive|happy|good)\b/i.test(cleanQuery)) {
    filters.sentiment = 'positive';
    cleanQuery = cleanQuery.replace(/\b(positive|happy|good)\b/i, '').trim();
  } else if (/\b(negative|upset|bad|angry)\b/i.test(cleanQuery)) {
    filters.sentiment = 'negative';
    cleanQuery = cleanQuery.replace(/\b(negative|upset|bad|angry)\b/i, '').trim();
  }

  // Clean up extra spaces
  cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim();

  return { cleanQuery, filters };
};

// Generate mock search results
const generateMockResults = (query: string): SearchResult[] => {
  if (!query.trim()) return [];

  const now = Date.now();
  const results: SearchResult[] = [
    {
      id: 'result-1',
      type: 'message',
      messageId: 'msg-1',
      conversationId: 'conv-1',
      conversationName: 'Alice Johnson',
      content: `I think we should proceed with the ${query} approach. Let me know your thoughts.`,
      sender: 'Alice',
      timestamp: new Date(now - 2 * 60 * 60 * 1000),
      relevanceScore: 0.95,
      highlights: [query],
      context: {
        before: 'Regarding our discussion...',
        after: 'I\'ll follow up tomorrow.',
      },
    },
    {
      id: 'result-2',
      type: 'decision',
      messageId: 'msg-2',
      conversationId: 'conv-2',
      conversationName: 'Bob Smith',
      content: `Decision: We agreed to use ${query} for the new feature implementation.`,
      sender: 'Bob',
      timestamp: new Date(now - 24 * 60 * 60 * 1000),
      relevanceScore: 0.88,
      highlights: [query],
      metadata: { decisionOutcome: 'approved' },
    },
    {
      id: 'result-3',
      type: 'task',
      messageId: 'msg-3',
      conversationId: 'conv-1',
      conversationName: 'Alice Johnson',
      content: `TODO: Review the ${query} documentation and prepare summary`,
      sender: 'You',
      timestamp: new Date(now - 3 * 24 * 60 * 60 * 1000),
      relevanceScore: 0.82,
      highlights: [query],
      metadata: { taskStatus: 'pending' },
    },
    {
      id: 'result-4',
      type: 'attachment',
      messageId: 'msg-4',
      conversationId: 'conv-3',
      conversationName: 'Charlie Brown',
      content: `Here's the ${query} report you requested.`,
      sender: 'Charlie',
      timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000),
      relevanceScore: 0.75,
      highlights: [query],
      metadata: { attachmentType: 'pdf', attachmentName: `${query}_report.pdf` },
    },
    {
      id: 'result-5',
      type: 'mention',
      messageId: 'msg-5',
      conversationId: 'conv-2',
      conversationName: 'Bob Smith',
      content: `@You mentioned ${query} in the meeting. Can you elaborate?`,
      sender: 'Bob',
      timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000),
      relevanceScore: 0.70,
      highlights: [query, '@You'],
    },
  ];

  return results;
};

const defaultSuggestions: SearchSuggestion[] = [
  { id: 'sug-1', query: 'messages from last week', type: 'suggested', icon: '📅', description: 'Recent messages' },
  { id: 'sug-2', query: 'files and attachments', type: 'filter', icon: '📎', description: 'Shared files' },
  { id: 'sug-3', query: 'decisions made this month', type: 'suggested', icon: '✅', description: 'Key decisions' },
  { id: 'sug-4', query: 'tasks assigned to me', type: 'filter', icon: '📋', description: 'Your tasks' },
  { id: 'sug-5', query: 'mentions of me', type: 'filter', icon: '@', description: 'Where you were mentioned' },
];

// Safe text highlighter component - no innerHTML needed
const HighlightedText: React.FC<{ text: string; highlights: string[] }> = ({ text, highlights }) => {
  if (!highlights.length) return <>{text}</>;

  // Create a case-insensitive regex pattern from highlights
  const pattern = highlights.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        const isHighlight = highlights.some(h => h.toLowerCase() === part.toLowerCase());
        return isHighlight ? (
          <mark
            key={i}
            style={{
              background: 'rgba(139, 92, 246, 0.3)',
              color: 'white',
              padding: '0 2px',
              borderRadius: '2px',
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
};

export const NaturalLanguageSearch: React.FC<NaturalLanguageSearchProps> = ({
  onSearch,
  onResultClick,
  recentSearches: propRecentSearches,
  onSaveSearch,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<SearchFilter>({});
  const [activeTab, setActiveTab] = useState<'all' | 'messages' | 'files' | 'decisions' | 'tasks'>('all');
  const [parsedInfo, setParsedInfo] = useState<{ cleanQuery: string; filters: SearchFilter } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const recentSearches = useMemo(() =>
    propRecentSearches || ['project update', 'meeting notes', 'budget report'],
    [propRecentSearches]
  );

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Parse query and show parsed info
  useEffect(() => {
    if (query.trim()) {
      const parsed = parseNaturalLanguageQuery(query);
      setParsedInfo(parsed);
    } else {
      setParsedInfo(null);
    }
  }, [query]);

  // Perform search
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    const parsed = parseNaturalLanguageQuery(query);

    try {
      let searchResults: SearchResult[];
      if (onSearch) {
        searchResults = await onSearch(parsed.cleanQuery, { ...selectedFilters, ...parsed.filters });
      } else {
        // Use mock results
        await new Promise(resolve => setTimeout(resolve, 500));
        searchResults = generateMockResults(parsed.cleanQuery);
      }

      setResults(searchResults);
      onSaveSearch?.(query);
    } finally {
      setIsSearching(false);
    }
  }, [query, selectedFilters, onSearch, onSaveSearch]);

  // Filter results by tab
  const filteredResults = useMemo(() => {
    if (activeTab === 'all') return results;

    const typeMap: Record<string, SearchResult['type'][]> = {
      messages: ['message'],
      files: ['attachment'],
      decisions: ['decision'],
      tasks: ['task'],
    };

    return results.filter(r => typeMap[activeTab]?.includes(r.type));
  }, [results, activeTab]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'message': return '💬';
      case 'attachment': return '📎';
      case 'decision': return '✅';
      case 'task': return '📋';
      case 'mention': return '@';
    }
  };

  const getTypeColor = (type: SearchResult['type']) => {
    switch (type) {
      case 'message': return '#3b82f6';
      case 'attachment': return '#8b5cf6';
      case 'decision': return '#22c55e';
      case 'task': return '#f59e0b';
      case 'mention': return '#ec4899';
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(20, 20, 35, 0.98))',
      borderRadius: '16px',
      padding: '24px',
      color: 'white',
      maxWidth: '700px',
      width: '100%',
      maxHeight: '85vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🔍</span>
            Smart Search
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Search using natural language
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Search Input */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        padding: '4px',
        marginBottom: '16px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
        }}>
          <span style={{ fontSize: '1.2rem', opacity: 0.6 }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder='Try: "messages from Alice last week" or "files about budget"'
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '1rem',
              outline: 'none',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim() || isSearching}
            style={{
              background: query.trim() ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              cursor: query.trim() && !isSearching ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              fontSize: '0.9rem',
            }}
          >
            {isSearching ? '...' : 'Search'}
          </button>
        </div>

        {/* Parsed Query Info */}
        {parsedInfo && (parsedInfo.filters.dateRange || parsedInfo.filters.type || parsedInfo.filters.contacts) && (
          <div style={{
            padding: '8px 16px 12px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
          }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>Detected:</span>
            {parsedInfo.filters.dateRange && (
              <span style={{
                fontSize: '0.75rem',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                padding: '2px 8px',
                borderRadius: '10px',
              }}>
                📅 {parsedInfo.filters.dateRange.start.toLocaleDateString()} - {parsedInfo.filters.dateRange.end.toLocaleDateString()}
              </span>
            )}
            {parsedInfo.filters.type?.map(t => (
              <span
                key={t}
                style={{
                  fontSize: '0.75rem',
                  background: `${getTypeColor(t)}30`,
                  color: getTypeColor(t),
                  padding: '2px 8px',
                  borderRadius: '10px',
                  textTransform: 'capitalize',
                }}
              >
                {getTypeIcon(t)} {t}
              </span>
            ))}
            {parsedInfo.filters.contacts?.map(c => (
              <span
                key={c}
                style={{
                  fontSize: '0.75rem',
                  background: 'rgba(236, 72, 153, 0.2)',
                  color: '#f472b6',
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}
              >
                👤 {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* No search yet - show suggestions */}
        {results.length === 0 && !isSearching && (
          <div>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '10px' }}>
                  Recent Searches
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {recentSearches.map((search, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(search)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span style={{ opacity: 0.5 }}>🕐</span>
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            <div>
              <h4 style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '10px' }}>
                Try These Searches
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {defaultSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => setQuery(suggestion.query)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      color: 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{suggestion.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500' }}>{suggestion.query}</div>
                      {suggestion.description && (
                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{suggestion.description}</div>
                      )}
                    </div>
                    <span style={{ opacity: 0.3 }}>→</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div style={{
              marginTop: '24px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              padding: '16px',
            }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💡</span> Search Tips
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', opacity: 0.8 }}>
                <li>Use dates: "last week", "yesterday", "in 3 days"</li>
                <li>Filter by sender: "from Alice"</li>
                <li>Find files: "attachments", "pdfs", "images"</li>
                <li>Find decisions: "decisions made this month"</li>
                <li>Combine filters: "files from Bob last week"</li>
              </ul>
            </div>
          </div>
        )}

        {/* Loading */}
        {isSearching && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '3px solid rgba(139, 92, 246, 0.3)',
              borderTopColor: '#8b5cf6',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{ opacity: 0.6 }}>Searching...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && !isSearching && (
          <div>
            {/* Result Tabs */}
            <div style={{
              display: 'flex',
              gap: '4px',
              marginBottom: '16px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: '12px',
            }}>
              {[
                { id: 'all', label: 'All', count: results.length },
                { id: 'messages', label: 'Messages', count: results.filter(r => r.type === 'message').length },
                { id: 'files', label: 'Files', count: results.filter(r => r.type === 'attachment').length },
                { id: 'decisions', label: 'Decisions', count: results.filter(r => r.type === 'decision').length },
                { id: 'tasks', label: 'Tasks', count: results.filter(r => r.type === 'task').length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  style={{
                    background: activeTab === tab.id ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: activeTab === tab.id ? '#a78bfa' : 'rgba(255,255,255,0.6)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span style={{
                      fontSize: '0.7rem',
                      background: 'rgba(255,255,255,0.1)',
                      padding: '1px 5px',
                      borderRadius: '8px',
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Results List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredResults.map((result) => (
                <div
                  key={result.id}
                  onClick={() => onResultClick?.(result)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    padding: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderLeft: `3px solid ${getTypeColor(result.type)}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: `${getTypeColor(result.type)}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      flexShrink: 0,
                    }}>
                      {getTypeIcon(result.type)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{result.sender}</span>
                        <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>in {result.conversationName}</span>
                        <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.75rem' }}>
                          {formatDate(result.timestamp)}
                        </span>
                      </div>

                      <p style={{
                        margin: '0 0 8px',
                        fontSize: '0.9rem',
                        lineHeight: 1.5,
                      }}>
                        <HighlightedText text={result.content} highlights={result.highlights} />
                      </p>

                      {/* Context */}
                      {result.context && (
                        <div style={{
                          fontSize: '0.8rem',
                          opacity: 0.6,
                          fontStyle: 'italic',
                        }}>
                          {result.context.before && <span>...{result.context.before} </span>}
                          {result.context.after && <span> {result.context.after}...</span>}
                        </div>
                      )}

                      {/* Metadata */}
                      {result.metadata && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          {result.metadata.attachmentName && (
                            <span style={{
                              fontSize: '0.75rem',
                              background: 'rgba(139, 92, 246, 0.2)',
                              padding: '2px 8px',
                              borderRadius: '10px',
                            }}>
                              📄 {result.metadata.attachmentName}
                            </span>
                          )}
                          {result.metadata.taskStatus && (
                            <span style={{
                              fontSize: '0.75rem',
                              background: result.metadata.taskStatus === 'completed'
                                ? 'rgba(34, 197, 94, 0.2)'
                                : 'rgba(245, 158, 11, 0.2)',
                              color: result.metadata.taskStatus === 'completed' ? '#4ade80' : '#fbbf24',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              textTransform: 'capitalize',
                            }}>
                              {result.metadata.taskStatus}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Relevance indicator */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '8px',
                        fontSize: '0.75rem',
                        opacity: 0.5,
                      }}>
                        <span>Relevance:</span>
                        <div style={{
                          width: '50px',
                          height: '4px',
                          background: 'rgba(255,255,255,0.1)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${result.relevanceScore * 100}%`,
                            height: '100%',
                            background: '#8b5cf6',
                          }} />
                        </div>
                        <span>{Math.round(result.relevanceScore * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                  No results in this category
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Quick search button
export const QuickSearchButton: React.FC<{
  onClick?: () => void;
}> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        padding: '10px 16px',
        color: 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        fontSize: '0.9rem',
      }}
    >
      <span>🔍</span>
      <span>Search messages...</span>
      <span style={{
        fontSize: '0.75rem',
        background: 'rgba(255,255,255,0.1)',
        padding: '2px 8px',
        borderRadius: '4px',
        marginLeft: 'auto',
      }}>
        ⌘K
      </span>
    </button>
  );
};

export default NaturalLanguageSearch;
