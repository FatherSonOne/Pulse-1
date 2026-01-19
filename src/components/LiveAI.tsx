import React, { useState, useRef, useEffect } from 'react';
import { queryPerplexity, deepResearch, quickResearch, streamPerplexity, PerplexityModel, PERPLEXITY_MODELS } from '../services/perplexityService';
import { saveArchiveItem } from '../services/dbService';

interface LiveAIProps {
  apiKey: string; // Gemini API key (for future voice integration)
  perplexityKey?: string;
  onClose?: () => void;
}

interface SearchResult {
  id: string;
  query: string;
  answer: string;
  citations: string[];
  timestamp: Date;
  isStreaming?: boolean;
  relatedQueries?: string[];
}

type SearchMode = 'quick' | 'deep' | 'conversation';

const LiveAI: React.FC<LiveAIProps> = ({ apiKey, perplexityKey, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('quick');
  const [selectedModel, setSelectedModel] = useState<PerplexityModel>('sonar');
  const [showSettings, setShowSettings] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [results, streamingText]);

  const handleSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim() || !perplexityKey) return;

    setIsSearching(true);
    setQuery('');

    const newResult: SearchResult = {
      id: Date.now().toString(),
      query: searchQuery,
      answer: '',
      citations: [],
      timestamp: new Date(),
      isStreaming: searchMode === 'conversation'
    };

    setResults(prev => [...prev, newResult]);

    try {
      if (searchMode === 'conversation') {
        // Streaming mode
        let fullAnswer = '';
        await streamPerplexity(
          perplexityKey,
          searchQuery,
          (chunk) => {
            fullAnswer += chunk;
            setStreamingText(fullAnswer);
          },
          (citations) => {
            setResults(prev => prev.map(r =>
              r.id === newResult.id
                ? { ...r, answer: fullAnswer, citations, isStreaming: false }
                : r
            ));
            setStreamingText('');
          },
          { model: selectedModel }
        );
      } else if (searchMode === 'quick') {
        const result = await quickResearch(perplexityKey, searchQuery);
        if (result) {
          setResults(prev => prev.map(r =>
            r.id === newResult.id
              ? { ...r, answer: result.answer, citations: result.sources }
              : r
          ));
        }
      } else {
        const result = await deepResearch(perplexityKey, searchQuery);
        if (result) {
          setResults(prev => prev.map(r =>
            r.id === newResult.id
              ? { ...r, answer: result.answer, citations: result.citations, relatedQueries: result.relatedQueries }
              : r
          ));
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults(prev => prev.map(r =>
        r.id === newResult.id
          ? { ...r, answer: 'Search failed. Please try again.', isStreaming: false }
          : r
      ));
    }

    setIsSearching(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const saveToArchives = async (result: SearchResult) => {
    await saveArchiveItem({
      type: 'research',
      title: result.query,
      content: `${result.answer}\n\nSources:\n${result.citations.join('\n')}`,
      tags: ['perplexity', 'research', searchMode]
    });
  };

  const clearResults = () => {
    setResults([]);
    setStreamingText('');
  };

  if (!perplexityKey) {
    return (
      <div className="h-full bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center p-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-6">
          <i className="fa-solid fa-brain text-3xl text-white"></i>
        </div>
        <h2 className="text-xl font-bold dark:text-white text-zinc-900 mb-2">Live AI Research</h2>
        <p className="text-zinc-500 text-center mb-6 max-w-md">
          Configure your Perplexity API key in Settings to enable real-time web research with AI.
        </p>
        <a
          href="https://www.perplexity.ai/settings/api"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-bold hover:opacity-90 transition flex items-center gap-2"
        >
          <i className="fa-solid fa-key"></i> Get API Key
        </a>
      </div>
    );
  }

  return (
    <div className="h-full bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col animate-fade-in shadow-xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <i className="fa-solid fa-bolt text-white"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Live AI Research</h2>
            <p className="text-cyan-100 text-xs">Powered by Perplexity</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-9 h-9 rounded-lg bg-white/10 text-white hover:bg-white/20 transition flex items-center justify-center"
          >
            <i className="fa-solid fa-sliders"></i>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-white/10 text-white hover:bg-white/20 transition flex items-center justify-center"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 animate-slide-down">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-bold mb-1 block">Search Mode</label>
              <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                {(['quick', 'deep', 'conversation'] as SearchMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setSearchMode(mode)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                      searchMode === mode
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    {mode === 'quick' && <><i className="fa-solid fa-bolt mr-1"></i> Quick</>}
                    {mode === 'deep' && <><i className="fa-solid fa-microscope mr-1"></i> Deep</>}
                    {mode === 'conversation' && <><i className="fa-solid fa-comments mr-1"></i> Stream</>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-bold mb-1 block">Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as PerplexityModel)}
                className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm dark:text-white"
              >
                <option value="sonar">Sonar (Fast)</option>
                <option value="sonar-large">Sonar Large</option>
                <option value="sonar-huge">Sonar Huge (Best)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 flex items-center justify-center mb-6">
              <i className="fa-solid fa-magnifying-glass-chart text-4xl text-cyan-600 dark:text-cyan-400"></i>
            </div>
            <h3 className="text-lg font-semibold dark:text-white text-zinc-900 mb-2">Ask Anything</h3>
            <p className="text-zinc-500 text-sm max-w-md mb-6">
              Get real-time answers from the web with AI-powered research. Try asking about current events, technical topics, or any question.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                'Latest AI developments',
                'Best practices for React',
                'Current market trends'
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(suggestion);
                    handleSearch(suggestion);
                  }}
                  className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs text-zinc-600 dark:text-zinc-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 hover:text-cyan-700 dark:hover:text-cyan-400 transition"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {results.map((result) => (
          <div key={result.id} className="animate-slide-up">
            {/* Query */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-user text-zinc-500 text-sm"></i>
              </div>
              <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl rounded-tl-none px-4 py-3">
                <p className="text-sm dark:text-white text-zinc-900">{result.query}</p>
              </div>
            </div>

            {/* Answer */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-bolt text-white text-sm"></i>
              </div>
              <div className="flex-1">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl rounded-tl-none p-4">
                  {result.isStreaming ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="whitespace-pre-wrap">{streamingText}</p>
                      <span className="inline-block w-2 h-4 bg-cyan-500 animate-pulse ml-1"></span>
                    </div>
                  ) : result.answer ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.answer}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      <span className="text-sm">Researching...</span>
                    </div>
                  )}

                  {/* Citations */}
                  {result.citations.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="text-[10px] text-zinc-400 uppercase font-bold mb-2 flex items-center gap-1">
                        <i className="fa-solid fa-link"></i> Sources
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result.citations.slice(0, 5).map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition truncate max-w-[200px]"
                            title={url}
                          >
                            [{i + 1}] {new URL(url).hostname}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Related Queries */}
                  {result.relatedQueries && result.relatedQueries.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="text-[10px] text-zinc-400 uppercase font-bold mb-2">Related</div>
                      <div className="flex flex-wrap gap-2">
                        {result.relatedQueries.map((rq, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setQuery(rq);
                              handleSearch(rq);
                            }}
                            className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs text-zinc-600 dark:text-zinc-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 hover:text-cyan-700 dark:hover:text-cyan-400 transition"
                          >
                            {rq}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                {!result.isStreaming && result.answer && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(result.answer)}
                      className="px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
                    >
                      <i className="fa-regular fa-copy mr-1"></i> Copy
                    </button>
                    <button
                      onClick={() => saveToArchives(result)}
                      className="px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
                    >
                      <i className="fa-regular fa-bookmark mr-1"></i> Save
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={resultsEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        {results.length > 0 && (
          <button
            onClick={clearResults}
            className="mb-3 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
          >
            <i className="fa-solid fa-broom mr-1"></i> Clear conversation
          </button>
        )}
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            disabled={isSearching}
            className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm dark:text-white focus:border-cyan-500 outline-none transition disabled:opacity-50"
          />
          <button
            onClick={() => handleSearch()}
            disabled={isSearching || !query.trim()}
            className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold transition disabled:opacity-50 flex items-center gap-2"
          >
            {isSearching ? (
              <i className="fa-solid fa-circle-notch fa-spin"></i>
            ) : (
              <i className="fa-solid fa-paper-plane"></i>
            )}
            <span className="hidden md:inline">Search</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveAI;
