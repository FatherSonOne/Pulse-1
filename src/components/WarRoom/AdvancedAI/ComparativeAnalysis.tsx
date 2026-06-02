/**
 * Comparative Analysis Component
 * Compare multiple documents with AI-powered insights.
 *
 * Chrome reskinned onto the Coral Cockpit --pulse-* tokens (WA-2 of
 * docs/WAR_ROOM_STUDIO_RESKIN_HANDOFF_2026-06-02.md): tinted-neutral surfaces,
 * coral-as-signal for active state, Lucide icons, mono labels, GEMINI provenance
 * tag. Agreement/contradiction now read via leading icon + status tint, not card
 * confetti; doc dots are neutral (titles/tooltips carry identity).
 *
 * UX: the analysis is now gated behind an explicit "Generate" CTA instead of
 * auto-running on mount. (The old auto-run guarded on `apiKey`, which is the
 * deprecated no-op '' — so it never fired anyway; compareDocuments ignores
 * apiKey and routes through the ai-router.)
 */

import React, { useState } from 'react';
import {
  ComparisonResult,
  ComparisonPoint,
  UniquePoint,
  Theme,
} from '../../../types/advancedAI';
import { compareDocuments } from '../../../services/advancedAIService';
import { KnowledgeDoc } from '../../../services/ragService';
import { ProvenanceTag } from '../ProvenanceTag';

import { AlertTriangle, CheckCircle, Clock, Eye, FileText, Fingerprint, Minus, Plus, Scale, Tag, X, XCircle } from 'lucide-react';

interface ComparativeAnalysisProps {
  documents: KnowledgeDoc[];
  apiKey: string;
  onClose?: () => void;
}

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--pulse-font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const dotStyle: React.CSSProperties = { background: 'var(--pulse-ink-3)' };

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

  const filteredAgreements = result?.agreements.filter(
    a => !selectedDocFilter || a.doc_sources.includes(selectedDocFilter)
  ) || [];

  const filteredContradictions = result?.contradictions.filter(
    c => !selectedDocFilter || c.doc_sources.includes(selectedDocFilter)
  ) || [];

  if (documents.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-64" style={{ color: 'var(--pulse-ink-3)' }}>
        <Scale size={40} className="mb-4 opacity-50" />
        <p>Select at least 2 documents to compare</p>
      </div>
    );
  }

  const TABS: { key: typeof activeTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'overview', label: 'Overview', icon: <Eye size={14} /> },
    { key: 'agreements', label: 'Agreements', icon: <CheckCircle size={14} />, count: filteredAgreements.length },
    { key: 'contradictions', label: 'Contradictions', icon: <XCircle size={14} />, count: filteredContradictions.length },
    { key: 'unique', label: 'Unique Points', icon: <Fingerprint size={14} /> },
    { key: 'themes', label: 'Themes', icon: <Tag size={14} />, count: result?.themes.length },
  ];

  return (
    <div className="h-full flex flex-col rounded-lg overflow-hidden" style={{ background: 'var(--pulse-surface-modal)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--pulse-border)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg flex items-center justify-center" style={{ background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }}>
            <Scale size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--pulse-ink)' }}>Comparative Analysis</h2>
              {result && <ProvenanceTag model="GEMINI" kind="COMPARISON" />}
            </div>
            <p className="text-sm" style={{ color: 'var(--pulse-ink-3)' }}>
              Comparing {documents.length} documents
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--pulse-ink-3)' }}
            aria-label="Close Comparative Analysis"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Document filter pills */}
      <div className="flex flex-wrap gap-2 p-4" style={{ borderBottom: '1px solid var(--pulse-border)' }}>
        <button
          onClick={() => setSelectedDocFilter(null)}
          className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
          style={!selectedDocFilter
            ? { background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }
            : { background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-3)' }}
        >
          All
        </button>
        {documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => setSelectedDocFilter(selectedDocFilter === doc.id ? null : doc.id)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={selectedDocFilter === doc.id
              ? { background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }
              : { background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-3)' }}
          >
            <span className="w-2 h-2 rounded-full" style={dotStyle} />
            <span className="max-w-32 truncate">{doc.title}</span>
          </button>
        ))}
      </div>

      {/* Intro / CTA — explicit generate (no auto-run) */}
      {!loading && !error && !result && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="p-3 rounded-lg mb-4 flex items-center justify-center" style={{ background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }}>
            <Scale size={24} />
          </div>
          <p className="mb-1" style={{ color: 'var(--pulse-ink)' }}>Compare these {documents.length} documents</p>
          <p className="text-sm mb-5" style={{ color: 'var(--pulse-ink-3)' }}>Find agreements, contradictions, unique points, and shared themes.</p>
          <button onClick={runComparison} className="war-room-btn-primary px-4 py-2 rounded-lg text-sm font-medium">
            Generate Comparison
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="relative w-24 h-24 mb-6">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r="44" fill="none" stroke="var(--pulse-border-strong)" strokeWidth="8" />
              <circle
                cx="48" cy="48" r="44" fill="none"
                stroke="var(--pulse-rose)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${progress * 2.76} 276`}
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: 'var(--pulse-ink)' }}>{Math.round(progress)}%</span>
            </div>
          </div>
          <p style={{ color: 'var(--pulse-ink-3)' }}>{status}</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="p-4 rounded-full mb-4" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <AlertTriangle size={28} style={{ color: '#ef4444' }} />
          </div>
          <p className="mb-4" style={{ color: '#ef4444' }}>{error}</p>
          <button
            onClick={runComparison}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink)' }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Tabs */}
          <div className="flex" style={{ borderBottom: '1px solid var(--pulse-border)' }}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors"
                style={activeTab === tab.key
                  ? { borderBottom: '2px solid var(--pulse-rose)', color: 'var(--pulse-coral-fg)' }
                  : { borderBottom: '2px solid transparent', color: 'var(--pulse-ink-3)' }}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && (
                  <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--pulse-surface-raised)' }}>
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
                <div className="p-4 rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
                  <h3 className="mb-2" style={{ ...monoLabel, color: 'var(--pulse-ink-3)' }}>Summary</h3>
                  <p style={{ color: 'var(--pulse-ink-2)' }}>{result.summary}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { n: result.agreements.length, label: 'Agreements' },
                    { n: result.contradictions.length, label: 'Contradictions' },
                    { n: result.unique_points.length, label: 'Unique Sections' },
                    { n: result.themes.length, label: 'Common Themes' },
                  ].map((s) => (
                    <div key={s.label} className="p-4 rounded-lg text-center" style={{ background: 'var(--pulse-surface-raised)' }}>
                      <div className="text-2xl font-bold" style={{ color: 'var(--pulse-ink)' }}>{s.n}</div>
                      <div className="text-sm" style={{ color: 'var(--pulse-ink-3)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Synthesis */}
                <div className="p-4 rounded-lg" style={{ background: 'var(--pulse-surface-raised)' }}>
                  <h3 className="mb-2" style={{ ...monoLabel, color: 'var(--pulse-ink-3)' }}>Synthesis</h3>
                  <p className="leading-relaxed" style={{ color: 'var(--pulse-ink-2)' }}>{result.synthesis}</p>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    Analyzed in {(result.analysis_duration_ms / 1000).toFixed(1)}s
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText size={12} />
                    ~{Math.round(result.total_tokens_analyzed / 4)} tokens processed
                  </span>
                </div>
              </div>
            )}

            {/* Agreements Tab */}
            {activeTab === 'agreements' && (
              <div className="space-y-4 animate-fadeIn">
                {filteredAgreements.length === 0 ? (
                  <div className="text-center py-8" style={{ color: 'var(--pulse-ink-3)' }}>
                    No agreements found between selected documents
                  </div>
                ) : (
                  filteredAgreements.map((agreement, index) => (
                    <ComparisonPointCard key={index} point={agreement} type="agreement" documents={documents} />
                  ))
                )}
              </div>
            )}

            {/* Contradictions Tab */}
            {activeTab === 'contradictions' && (
              <div className="space-y-4 animate-fadeIn">
                {filteredContradictions.length === 0 ? (
                  <div className="text-center py-8" style={{ color: 'var(--pulse-ink-3)' }}>
                    No contradictions found between selected documents
                  </div>
                ) : (
                  filteredContradictions.map((contradiction, index) => (
                    <ComparisonPointCard key={index} point={contradiction} type="contradiction" documents={documents} />
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
                    <UniquePointCard key={index} point={uniquePoint} />
                  ))}
              </div>
            )}

            {/* Themes Tab */}
            {activeTab === 'themes' && (
              <div className="space-y-4 animate-fadeIn">
                {result.themes.map((theme, index) => (
                  <ThemeCard key={index} theme={theme} documents={documents} />
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
}

const ComparisonPointCard: React.FC<ComparisonPointCardProps> = ({
  point,
  type,
  documents,
}) => {
  const [expanded, setExpanded] = useState(false);
  const isAgreement = type === 'agreement';
  const accent = isAgreement ? '#10b981' : '#ef4444'; // status: decided vs overdue

  const confidenceStyle: React.CSSProperties =
    point.confidence >= 0.8
      ? { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
      : point.confidence >= 0.5
      ? { background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-2)' }
      : { background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-3)' };

  return (
    <div className="p-4 rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {isAgreement ? <CheckCircle size={14} style={{ color: accent }} /> : <XCircle size={14} style={{ color: accent }} />}
            <h4 className="font-medium" style={{ color: 'var(--pulse-ink)' }}>{point.topic}</h4>
            <span className="px-2 py-0.5 rounded text-xs" style={confidenceStyle}>
              {Math.round(point.confidence * 100)}% confident
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>{point.description}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {point.doc_sources.map((docId) => {
            const docIndex = documents.findIndex(d => d.id === docId);
            return (
              <span key={docId} className="w-3 h-3 rounded-full" style={dotStyle} title={documents[docIndex]?.title} />
            );
          })}
        </div>
      </div>

      {point.quotes && point.quotes.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 text-sm flex items-center gap-1 transition-colors"
            style={{ color: 'var(--pulse-ink-3)' }}
          >
            {expanded ? <Minus size={12} /> : <Plus size={12} />}
            {expanded ? 'Hide' : 'Show'} quotes ({point.quotes.length})
          </button>

          {expanded && (
            <div className="mt-3 space-y-2 pl-4 animate-slideDown" style={{ borderLeft: '2px solid var(--pulse-border)' }}>
              {point.quotes.map((quote, i) => (
                <div key={i} className="text-sm">
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={dotStyle} />
                  <span className="italic" style={{ color: 'var(--pulse-ink-3)' }}>"{quote.text}"</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface UniquePointCardProps {
  point: UniquePoint;
}

const UniquePointCard: React.FC<UniquePointCardProps> = ({ point }) => {
  const sig = point.significance;
  const sigStyle: React.CSSProperties =
    sig === 'high'
      ? { background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }
      : { background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-3)' };

  return (
    <div className="p-4 rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-3 h-3 rounded-full" style={dotStyle} />
        <h4 className="font-medium" style={{ color: 'var(--pulse-ink)' }}>{point.doc_title}</h4>
        <span className="px-2 py-0.5 rounded text-xs" style={sigStyle}>
          {point.significance} significance
        </span>
      </div>
      <ul className="space-y-2">
        {point.points.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
            <Fingerprint size={14} style={{ color: 'var(--pulse-coral-fg)', marginTop: 2 }} />
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
}

const ThemeCard: React.FC<ThemeCardProps> = ({ theme, documents }) => {
  return (
    <div className="p-4 rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h4 className="font-medium flex items-center gap-2" style={{ color: 'var(--pulse-ink)' }}>
            <Tag size={14} style={{ color: 'var(--pulse-coral-fg)' }} />
            {theme.name}
          </h4>
          <p className="text-sm mt-1" style={{ color: 'var(--pulse-ink-3)' }}>{theme.description}</p>
        </div>
      </div>

      {/* Coverage indicators */}
      <div className="flex flex-wrap gap-2 mb-3">
        {theme.doc_coverage.map((coverage) => {
          const docIndex = documents.findIndex(d => d.id === coverage.docId);
          const doc = documents[docIndex];
          const covStyle: React.CSSProperties =
            coverage.coverage === 'full'
              ? { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
              : { background: 'var(--pulse-surface)', color: 'var(--pulse-ink-3)' };
          return (
            <div
              key={coverage.docId}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
              style={{ background: 'var(--pulse-surface)' }}
            >
              <span className="w-2 h-2 rounded-full" style={dotStyle} />
              <span className="max-w-24 truncate" style={{ color: 'var(--pulse-ink-3)' }}>{doc?.title}</span>
              <span className="px-1.5 rounded" style={covStyle}>
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
            className="px-2 py-0.5 rounded text-xs"
            style={{ background: 'var(--pulse-coral-bg-08)', color: 'var(--pulse-coral-fg)' }}
          >
            {concept}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ComparativeAnalysis;
