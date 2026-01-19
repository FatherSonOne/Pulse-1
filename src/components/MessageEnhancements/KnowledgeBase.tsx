// Knowledge Base Integration Component
import React, { useState, useMemo } from 'react';

interface KnowledgeArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  relevanceScore: number;
  source: 'internal' | 'external' | 'ai-generated';
  lastUpdated: string;
  author?: string;
  url?: string;
}

interface SuggestedContext {
  id: string;
  type: 'fact' | 'policy' | 'procedure' | 'contact' | 'resource';
  title: string;
  content: string;
  confidence: number;
  source: string;
}

interface KnowledgeBaseProps {
  conversationContext: string[];
  suggestedArticles: KnowledgeArticle[];
  suggestedContext: SuggestedContext[];
  onArticleSelect?: (article: KnowledgeArticle) => void;
  onInsertContext?: (context: string) => void;
  onSearch?: (query: string) => Promise<KnowledgeArticle[]>;
  compact?: boolean;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({
  conversationContext = [],
  suggestedArticles = [],
  suggestedContext = [],
  onArticleSelect,
  onInsertContext,
  onSearch,
  compact = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeArticle[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  const [activeTab, setActiveTab] = useState<'suggested' | 'context' | 'search'>('suggested');

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      if (onSearch) {
        const results = await onSearch(query);
        setSearchResults(results);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const getSourceIcon = (source: KnowledgeArticle['source']) => {
    switch (source) {
      case 'internal': return 'fa-building';
      case 'external': return 'fa-globe';
      case 'ai-generated': return 'fa-wand-magic-sparkles';
    }
  };

  const getContextTypeIcon = (type: SuggestedContext['type']) => {
    switch (type) {
      case 'fact': return 'fa-check-circle';
      case 'policy': return 'fa-file-shield';
      case 'procedure': return 'fa-list-check';
      case 'contact': return 'fa-user';
      case 'resource': return 'fa-folder';
    }
  };

  const getContextTypeColor = (type: SuggestedContext['type']) => {
    switch (type) {
      case 'fact': return 'text-blue-500 bg-blue-100 dark:bg-blue-900/40';
      case 'policy': return 'text-purple-500 bg-purple-100 dark:bg-purple-900/40';
      case 'procedure': return 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/40';
      case 'contact': return 'text-amber-500 bg-amber-100 dark:bg-amber-900/40';
      case 'resource': return 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900/40';
    }
  };

  if (compact) {
    const totalSuggestions = suggestedArticles.length + suggestedContext.length;
    if (totalSuggestions === 0) return null;

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-xs font-medium">
          <i className="fa-solid fa-lightbulb" />
          <span>{totalSuggestions} helpful resources</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <i className="fa-solid fa-book-open text-amber-500 text-sm" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Knowledge Base</h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Relevant resources for this conversation
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="relative">
          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search knowledge base..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-800 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
          />
          {isSearching && (
            <i className="fa-solid fa-circle-notch fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700">
        <button
          onClick={() => setActiveTab('suggested')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition ${
            activeTab === 'suggested'
              ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          Suggested ({suggestedArticles.length})
        </button>
        <button
          onClick={() => setActiveTab('context')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition ${
            activeTab === 'context'
              ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          Quick Context ({suggestedContext.length})
        </button>
        {searchResults.length > 0 && (
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 px-3 py-2 text-xs font-medium transition ${
              activeTab === 'search'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            Results ({searchResults.length})
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto">
        {activeTab === 'suggested' && (
          <div className="p-2">
            {suggestedArticles.length === 0 ? (
              <div className="text-center py-6 text-zinc-400 dark:text-zinc-500">
                <i className="fa-solid fa-file-circle-question text-2xl mb-2" />
                <p className="text-xs">No relevant articles found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {suggestedArticles.map(article => (
                  <button
                    key={article.id}
                    onClick={() => {
                      setSelectedArticle(article);
                      onArticleSelect?.(article);
                    }}
                    className="w-full p-3 rounded-lg text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition border border-zinc-100 dark:border-zinc-700"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-medium text-zinc-800 dark:text-white line-clamp-1">
                        {article.title}
                      </h4>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                        <i className={`fa-solid ${getSourceIcon(article.source)}`} />
                        <span>{Math.round(article.relevanceScore * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-2">
                      {article.summary}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {article.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                        >
                          {tag}
                        </span>
                      ))}
                      <span className="text-[9px] text-zinc-400">{article.category}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'context' && (
          <div className="p-2">
            {suggestedContext.length === 0 ? (
              <div className="text-center py-6 text-zinc-400 dark:text-zinc-500">
                <i className="fa-solid fa-puzzle-piece text-2xl mb-2" />
                <p className="text-xs">No context suggestions available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {suggestedContext.map(ctx => (
                  <div
                    key={ctx.id}
                    className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition"
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${getContextTypeColor(ctx.type)}`}>
                        <i className={`fa-solid ${getContextTypeIcon(ctx.type)} text-xs`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-zinc-800 dark:text-white">
                            {ctx.title}
                          </span>
                          <span className="text-[9px] text-zinc-400">
                            {Math.round(ctx.confidence * 100)}% match
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                          {ctx.content}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[9px] text-zinc-400">
                            Source: {ctx.source}
                          </span>
                          <button
                            onClick={() => onInsertContext?.(ctx.content)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition"
                          >
                            <i className="fa-solid fa-plus" />
                            Insert
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="p-2">
            {searchResults.length === 0 ? (
              <div className="text-center py-6 text-zinc-400 dark:text-zinc-500">
                <p className="text-xs">No results found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map(article => (
                  <button
                    key={article.id}
                    onClick={() => {
                      setSelectedArticle(article);
                      onArticleSelect?.(article);
                    }}
                    className="w-full p-3 rounded-lg text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition border border-zinc-100 dark:border-zinc-700"
                  >
                    <h4 className="text-sm font-medium text-zinc-800 dark:text-white line-clamp-1 mb-1">
                      {article.title}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {article.summary}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Article Preview Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedArticle(null)}>
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-zinc-800 dark:text-white">
                    {selectedArticle.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{selectedArticle.category}</span>
                    <span>·</span>
                    <span>Updated {new Date(selectedArticle.lastUpdated).toLocaleDateString()}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedArticle(null)} className="text-zinc-400 hover:text-zinc-600">
                  <i className="fa-solid fa-times" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-96">
              <p className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                {selectedArticle.content}
              </p>
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-between">
              {selectedArticle.url && (
                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <i className="fa-solid fa-external-link" />
                  Open source
                </a>
              )}
              <button
                onClick={() => {
                  onInsertContext?.(selectedArticle.summary);
                  setSelectedArticle(null);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition"
              >
                Insert Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Inline knowledge suggestion chip
export const KnowledgeSuggestionChip: React.FC<{
  title: string;
  onClick?: () => void;
}> = ({ title, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-medium hover:bg-amber-200 dark:hover:bg-amber-900/60 transition"
  >
    <i className="fa-solid fa-lightbulb" />
    {title}
  </button>
);

export default KnowledgeBase;
