/**
 * Advanced AI Panel
 * Unified panel for advanced AI features: Comparative Analysis & Knowledge Graph
 *
 * Chrome reskinned onto the canonical --pulse-* tokens (Coral Cockpit) to match
 * the Notebook rail: tinted-neutral surfaces, coral-as-signal for active state,
 * Lucide icons, JetBrains-Mono metadata labels. No purple/blue/glass, no vendor
 * brag. WA-1 of docs/WAR_ROOM_STUDIO_RESKIN_HANDOFF_2026-06-02.md.
 */

import React, { useState } from 'react';
import { ComparativeAnalysis } from './ComparativeAnalysis';
import { KnowledgeGraphViewer } from './KnowledgeGraphViewer';
import { KnowledgeDoc } from '../../../services/ragService';

import { Brain, Check, GitFork, Info, Scale, X } from 'lucide-react';

interface AdvancedAIPanelProps {
  documents: KnowledgeDoc[];
  apiKey: string;
  onClose?: () => void;
  initialView?: 'compare' | 'graph';
}

// Shared inline-style fragments (Coral Cockpit tokens, theme-aware via vars).
const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--pulse-font-mono)',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

export const AdvancedAIPanel: React.FC<AdvancedAIPanelProps> = ({
  documents,
  apiKey,
  onClose,
  initialView = 'compare',
}) => {
  const [activeView, setActiveView] = useState<'compare' | 'graph'>(initialView);
  const [selectedDocs, setSelectedDocs] = useState<KnowledgeDoc[]>(documents);

  const toggleDocument = (doc: KnowledgeDoc) => {
    setSelectedDocs(prev => {
      if (prev.find(d => d.id === doc.id)) {
        return prev.filter(d => d.id !== doc.id);
      }
      return [...prev, doc];
    });
  };

  const selectAll = () => setSelectedDocs(documents);
  const clearAll = () => setSelectedDocs([]);

  const tabStyle = (active: boolean): React.CSSProperties =>
    active
      ? { background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }
      : { background: 'transparent', color: 'var(--pulse-ink-3)' };

  return (
    <div
      className="h-full flex flex-col rounded-xl overflow-hidden"
      style={{ background: 'var(--pulse-surface-modal)', border: '1px solid var(--pulse-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--pulse-border)', background: 'var(--pulse-surface-raised)' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className="p-2 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }}
            >
              <Brain size={16} />
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--pulse-ink)' }}>Advanced AI</h2>
          </div>

          {/* View Toggle */}
          <div className="flex rounded-lg p-1" style={{ background: 'var(--pulse-surface)' }}>
            <button
              onClick={() => setActiveView('compare')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={tabStyle(activeView === 'compare')}
            >
              <Scale size={14} />
              Compare
            </button>
            <button
              onClick={() => setActiveView('graph')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={tabStyle(activeView === 'graph')}
            >
              <GitFork size={14} />
              Knowledge Graph
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Document count */}
          <span
            className="px-3 py-1 rounded-lg"
            style={{ ...monoLabel, background: 'var(--pulse-surface)', color: 'var(--pulse-ink-3)' }}
          >
            {selectedDocs.length} / {documents.length} docs
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--pulse-ink-3)' }}
              aria-label="Close Advanced AI"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Document Selector Bar */}
      <div
        className="px-4 py-2"
        style={{ borderBottom: '1px solid var(--pulse-border)', background: 'var(--pulse-surface-raised)' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ ...monoLabel, color: 'var(--pulse-ink-3)' }}>Documents</span>
          <button
            onClick={selectAll}
            className="text-xs"
            style={{ color: 'var(--pulse-coral-fg)' }}
          >
            Select All
          </button>
          <span style={{ color: 'var(--pulse-border-strong)' }}>|</span>
          <button
            onClick={clearAll}
            className="text-xs"
            style={{ color: 'var(--pulse-ink-3)' }}
          >
            Clear
          </button>
          <div className="flex-1 flex flex-wrap gap-1.5 ml-2">
            {documents.map((doc) => {
              const isSelected = !!selectedDocs.find(d => d.id === doc.id);
              return (
                <button
                  key={doc.id}
                  onClick={() => toggleDocument(doc)}
                  className="px-2 py-0.5 rounded-full text-xs font-medium transition-all inline-flex items-center"
                  style={
                    isSelected
                      ? { background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)', border: '1px solid var(--pulse-rose)' }
                      : { background: 'transparent', color: 'var(--pulse-ink-3)', border: '1px solid var(--pulse-border)' }
                  }
                >
                  <span className="max-w-24 truncate inline-block align-middle">
                    {doc.title}
                  </span>
                  {isSelected && <Check size={10} className="ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'compare' ? (
          <div className="h-full animate-fadeIn">
            <ComparativeAnalysis
              documents={selectedDocs}
              apiKey={apiKey}
            />
          </div>
        ) : (
          <div className="h-full animate-fadeIn">
            <KnowledgeGraphViewer
              documents={selectedDocs}
              apiKey={apiKey}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div
        className="px-4 py-2 flex items-center justify-between text-xs"
        style={{ borderTop: '1px solid var(--pulse-border)', background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-3)' }}
      >
        <span className="flex items-center gap-1">
          <Info size={12} />
          {activeView === 'compare'
            ? 'Select 2+ documents to compare'
            : 'Build knowledge graph from selected documents'}
        </span>
      </div>
    </div>
  );
};

export default AdvancedAIPanel;
