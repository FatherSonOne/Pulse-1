/**
 * Comparative Analysis Component
 * Compare multiple documents with AI-powered insights
 */

import React, { useState, useEffect } from 'react';
import {
  ComparisonResult,
  ComparisonPoint,
  UniquePoint,
  Theme,
} from '../../../types/advancedAI';
import { compareDocuments } from '../../../services/advancedAIService';
import { KnowledgeDoc } from '../../../services/ragService';

interface ComparativeAnalysisProps {
  documents: KnowledgeDoc[];
  apiKey: string;
  onClose?: () => void;
}

export const ComparativeAnalysis: React.FC<ComparativeAnalysisProps> = ({
  documents,
  apiKey,
  onClose,
}) => {
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'agreements' | 'contradictions' | 'unique' | 'themes'>('overview');
  const [selectedDocFilter, setSelectedDocFilter] = useState<string | null>(null);

  useEffect(() => {
    if (documents.length >= 2 && apiKey) {
      runComparison();
    }
  }, [documents, apiKey]);

  const runComparison = async () => {
    setLoading(true);
    setError(null);
    setProgress(0);
    setStatus('Starting comparison...');

    try {
      const comparisonResult = await compareDocuments(
        documents,
        apiKey,
        (p, s) => {
          setProgress(p);
          setStatus(s);
        }
      );
      setResult(comparisonResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setLoading(false);
    }
  };

  const getDocColor = (index: number): string => {
    const colors = [
      'bg-blue-500',
      'bg-emerald-500',
      'bg-amber-500',
      'bg-rose-500',
      'bg-purple-500',
      'bg-cyan-500',
    ];
    return colors[index % colors.length];
  };

  const filteredAgreements = result?.agreements.filter(
    a => !selectedDocFilter || a.doc_sources.includes(selectedDocFilter)
  ) || [];

  const filteredContradictions = result?.contradictions.filter(
    c => !selectedDocFilter || c.doc_sources.includes(selectedDocFilter)
  ) || [];

  if (documents.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <i className="fas fa-balance-scale text-4xl mb-4 opacity-50" />
        <p>Select at least 2 documents to compare</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
            <i className="fas fa-balance-scale text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Comparative Analysis</h2>
            <p className="text-sm text-gray-400">
              Comparing {documents.length} documents
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <i className="fas fa-times" />
          </button>
        )}
      </div>

      {/* Document Pills */}
      <div className="flex flex-wrap gap-2 p-4 border-b border-gray-800">
        <button
          onClick={() => setSelectedDocFilter(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !selectedDocFilter
              ? 'bg-white/10 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          All
        </button>
        {documents.map((doc, index) => (
          <button
            key={doc.id}
            onClick={() => setSelectedDocFilter(selectedDocFilter === doc.id ? null : doc.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedDocFilter === doc.id
                ? 'bg-white/10 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${getDocColor(index)}`} />
            <span className="max-w-32 truncate">{doc.title}</span>
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="relative w-24 h-24 mb-6">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="44"
                fill="none"
                stroke="#374151"
                strokeWidth="8"
              />
              <circle
                cx="48"
                cy="48"
                r="44"
                fill="none"
                stroke="url(#progress-gradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${progress * 2.76} 276`}
                className="transition-all duration-300"
              />
              <defs>
                <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">{Math.round(progress)}%</span>
            </div>
          </div>
          <p className="text-gray-400">{status}</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="p-4 bg-red-500/10 rounded-full mb-4">
            <i className="fas fa-exclamation-triangle text-3xl text-red-400" />
          </div>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={runComparison}
            className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            {[
              { key: 'overview', label: 'Overview', icon: 'fa-eye' },
              { key: 'agreements', label: 'Agreements', icon: 'fa-check-circle', count: filteredAgreements.length },
              { key: 'contradictions', label: 'Contradictions', icon: 'fa-times-circle', count: filteredContradictions.length },
              { key: 'unique', label: 'Unique Points', icon: 'fa-fingerprint' },
              { key: 'themes', label: 'Themes', icon: 'fa-tags', count: result.themes.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <i className={`fas ${tab.icon}`} />
                {tab.label}
                {tab.count !== undefined && (
                  <span className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Summary */}
                <div className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
                  <h3 className="text-sm font-medium text-blue-400 mb-2">Summary</h3>
                  <p className="text-gray-300">{result.summary}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-800/50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-emerald-400">{result.agreements.length}</div>
                    <div className="text-sm text-gray-400">Agreements</div>
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-rose-400">{result.contradictions.length}</div>
                    <div className="text-sm text-gray-400">Contradictions</div>
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-amber-400">{result.unique_points.length}</div>
                    <div className="text-sm text-gray-400">Unique Sections</div>
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-400">{result.themes.length}</div>
                    <div className="text-sm text-gray-400">Common Themes</div>
                  </div>
                </div>

                {/* Synthesis */}
                <div className="p-4 bg-gray-800/50 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Synthesis</h3>
                  <p className="text-gray-300 leading-relaxed">{result.synthesis}</p>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>
                    <i className="fas fa-clock mr-1" />
                    Analyzed in {(result.analysis_duration_ms / 1000).toFixed(1)}s
                  </span>
                  <span>
                    <i className="fas fa-file-alt mr-1" />
                    ~{Math.round(result.total_tokens_analyzed / 4)} tokens processed
                  </span>
                </div>
              </div>
            )}

            {/* Agreements Tab */}
            {activeTab === 'agreements' && (
              <div className="space-y-4 animate-fadeIn">
                {filteredAgreements.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    No agreements found between selected documents
                  </div>
                ) : (
                  filteredAgreements.map((agreement, index) => (
                    <ComparisonPointCard
                      key={index}
                      point={agreement}
                      type="agreement"
                      documents={documents}
                      getDocColor={getDocColor}
                    />
                  ))
                )}
              </div>
            )}

            {/* Contradictions Tab */}
            {activeTab === 'contradictions' && (
              <div className="space-y-4 animate-fadeIn">
                {filteredContradictions.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    No contradictions found between selected documents
                  </div>
                ) : (
                  filteredContradictions.map((contradiction, index) => (
                    <ComparisonPointCard
                      key={index}
                      point={contradiction}
                      type="contradiction"
                      documents={documents}
                      getDocColor={getDocColor}
                    />
                  ))
                )}
              </div>
            )}

            {/* Unique Points Tab */}
            {activeTab === 'unique' && (
              <div className="space-y-4 animate-fadeIn">
                {result.unique_points
                  .filter(up => !selectedDocFilter || up.doc_id === selectedDocFilter)
                  .map((uniquePoint, index) => (
                    <UniquePointCard
                      key={index}
                      point={uniquePoint}
                      docIndex={documents.findIndex(d => d.id === uniquePoint.doc_id)}
                      getDocColor={getDocColor}
                    />
                  ))}
              </div>
            )}

            {/* Themes Tab */}
            {activeTab === 'themes' && (
              <div className="space-y-4 animate-fadeIn">
                {result.themes.map((theme, index) => (
                  <ThemeCard
                    key={index}
                    theme={theme}
                    documents={documents}
                    getDocColor={getDocColor}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Sub-components

interface ComparisonPointCardProps {
  point: ComparisonPoint;
  type: 'agreement' | 'contradiction';
  documents: KnowledgeDoc[];
  getDocColor: (index: number) => string;
}

const ComparisonPointCard: React.FC<ComparisonPointCardProps> = ({
  point,
  type,
  documents,
  getDocColor,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`p-4 rounded-lg border ${
      type === 'agreement'
        ? 'bg-emerald-500/5 border-emerald-500/20'
        : 'bg-rose-500/5 border-rose-500/20'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <i className={`fas ${type === 'agreement' ? 'fa-check-circle text-emerald-400' : 'fa-times-circle text-rose-400'}`} />
            <h4 className="font-medium text-white">{point.topic}</h4>
            <span className={`px-2 py-0.5 rounded text-xs ${
              point.confidence >= 0.8
                ? 'bg-emerald-500/20 text-emerald-400'
                : point.confidence >= 0.5
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-gray-500/20 text-gray-400'
            }`}>
              {Math.round(point.confidence * 100)}% confident
            </span>
          </div>
          <p className="text-gray-400 text-sm">{point.description}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {point.doc_sources.map((docId) => {
            const docIndex = documents.findIndex(d => d.id === docId);
            return (
              <span
                key={docId}
                className={`w-3 h-3 rounded-full ${getDocColor(docIndex)}`}
                title={documents[docIndex]?.title}
              />
            );
          })}
        </div>
      </div>

      {point.quotes && point.quotes.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <i className={`fas fa-${expanded ? 'minus' : 'plus'} mr-1`} />
            {expanded ? 'Hide' : 'Show'} quotes ({point.quotes.length})
          </button>

          {expanded && (
            <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-700 animate-slideDown">
              {point.quotes.map((quote, i) => {
                const docIndex = documents.findIndex(d => d.id === quote.docId);
                return (
                  <div key={i} className="text-sm">
                    <span className={`inline-block w-2 h-2 rounded-full ${getDocColor(docIndex)} mr-2`} />
                    <span className="text-gray-500 italic">"{quote.text}"</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface UniquePointCardProps {
  point: UniquePoint;
  docIndex: number;
  getDocColor: (index: number) => string;
}

const UniquePointCard: React.FC<UniquePointCardProps> = ({
  point,
  docIndex,
  getDocColor,
}) => {
  return (
    <div className="p-4 bg-gray-800/50 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-3 h-3 rounded-full ${getDocColor(docIndex)}`} />
        <h4 className="font-medium text-white">{point.doc_title}</h4>
        <span className={`px-2 py-0.5 rounded text-xs ${
          point.significance === 'high'
            ? 'bg-amber-500/20 text-amber-400'
            : point.significance === 'medium'
            ? 'bg-blue-500/20 text-blue-400'
            : 'bg-gray-500/20 text-gray-400'
        }`}>
          {point.significance} significance
        </span>
      </div>
      <ul className="space-y-2">
        {point.points.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
            <i className="fas fa-fingerprint text-purple-400 mt-1" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
};

interface ThemeCardProps {
  theme: Theme;
  documents: KnowledgeDoc[];
  getDocColor: (index: number) => string;
}

const ThemeCard: React.FC<ThemeCardProps> = ({
  theme,
  documents,
  getDocColor,
}) => {
  return (
    <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h4 className="font-medium text-white flex items-center gap-2">
            <i className="fas fa-tag text-purple-400" />
            {theme.name}
          </h4>
          <p className="text-sm text-gray-400 mt-1">{theme.description}</p>
        </div>
      </div>

      {/* Coverage indicators */}
      <div className="flex flex-wrap gap-2 mb-3">
        {theme.doc_coverage.map((coverage) => {
          const docIndex = documents.findIndex(d => d.id === coverage.docId);
          const doc = documents[docIndex];
          return (
            <div
              key={coverage.docId}
              className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/50 rounded text-xs"
            >
              <span className={`w-2 h-2 rounded-full ${getDocColor(docIndex)}`} />
              <span className="text-gray-400 max-w-24 truncate">{doc?.title}</span>
              <span className={`px-1.5 rounded ${
                coverage.coverage === 'full'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : coverage.coverage === 'partial'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-gray-500/20 text-gray-500'
              }`}>
                {coverage.coverage}
              </span>
            </div>
          );
        })}
      </div>

      {/* Key concepts */}
      <div className="flex flex-wrap gap-1.5">
        {theme.key_concepts.map((concept, i) => (
          <span
            key={i}
            className="px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded text-xs"
          >
            {concept}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ComparativeAnalysis;
