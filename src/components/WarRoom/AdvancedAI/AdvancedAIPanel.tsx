/**
 * Advanced AI Panel
 * Unified panel for advanced AI features: Comparative Analysis & Knowledge Graph
 */

import React, { useState } from 'react';
import { ComparativeAnalysis } from './ComparativeAnalysis';
import { KnowledgeGraphViewer } from './KnowledgeGraphViewer';
import { KnowledgeDoc } from '../../../services/ragService';

interface AdvancedAIPanelProps {
  documents: KnowledgeDoc[];
  apiKey: string;
  onClose?: () => void;
  initialView?: 'compare' | 'graph';
}

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

  return (
    <div className="h-full flex flex-col bg-gray-950 rounded-xl overflow-hidden border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-lg">
              <i className="fas fa-brain text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Advanced AI</h2>
          </div>

          {/* View Toggle */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveView('compare')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeView === 'compare'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <i className="fas fa-balance-scale" />
              Compare
            </button>
            <button
              onClick={() => setActiveView('graph')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeView === 'graph'
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <i className="fas fa-project-diagram" />
              Knowledge Graph
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Document count */}
          <span className="px-3 py-1 bg-gray-800 rounded-lg text-sm text-gray-400">
            {selectedDocs.length} / {documents.length} docs
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <i className="fas fa-times" />
            </button>
          )}
        </div>
      </div>

      {/* Document Selector Bar */}
      <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/30">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Documents:</span>
          <button
            onClick={selectAll}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Select All
          </button>
          <span className="text-gray-700">|</span>
          <button
            onClick={clearAll}
            className="text-xs text-gray-400 hover:text-gray-300"
          >
            Clear
          </button>
          <div className="flex-1 flex flex-wrap gap-1.5 ml-2">
            {documents.map((doc, index) => {
              const isSelected = selectedDocs.find(d => d.id === doc.id);
              const colors = [
                'border-blue-500 bg-blue-500/10',
                'border-emerald-500 bg-emerald-500/10',
                'border-amber-500 bg-amber-500/10',
                'border-rose-500 bg-rose-500/10',
                'border-purple-500 bg-purple-500/10',
                'border-cyan-500 bg-cyan-500/10',
              ];
              const color = colors[index % colors.length];

              return (
                <button
                  key={doc.id}
                  onClick={() => toggleDocument(doc)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${
                    isSelected
                      ? `${color} text-white`
                      : 'border-gray-700 bg-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <span className="max-w-24 truncate inline-block align-middle">
                    {doc.title}
                  </span>
                  {isSelected && (
                    <i className="fas fa-check ml-1 text-[10px]" />
                  )}
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
      <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/30 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>
            <i className="fas fa-info-circle mr-1" />
            {activeView === 'compare'
              ? 'Select 2+ documents to compare'
              : 'Build knowledge graph from selected documents'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <i className="fas fa-bolt text-amber-500" />
            Powered by Gemini AI
          </span>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAIPanel;
