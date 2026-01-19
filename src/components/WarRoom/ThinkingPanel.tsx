import React, { useState } from 'react';

interface ThinkingStep {
  step: number;
  thought: string;
  duration_ms: number;
}

interface RAGChunk {
  doc_title: string;
  content: string;
  similarity: number;
}

interface ThinkingPanelProps {
  steps: ThinkingStep[];
  ragContext?: RAGChunk[];
  expanded: boolean;
  onToggle: () => void;
  mode?: 'inline' | 'panel';
}

export const ThinkingPanel: React.FC<ThinkingPanelProps> = ({
  steps,
  ragContext = [],
  expanded,
  onToggle,
  mode = 'inline'
}) => {
  const [activeTab, setActiveTab] = useState<'steps' | 'rag' | 'timeline'>('steps');

  const totalTime = steps.reduce((sum, step) => sum + step.duration_ms, 0);

  if (!expanded) {
    return (
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 bg-purple-900/20 hover:bg-purple-900/30 border border-purple-500/30 rounded text-sm text-purple-300 flex items-center justify-between group transition-all"
      >
        <div className="flex items-center gap-2">
          <i className="fa fa-brain animate-pulse"></i>
          <span>AI Thinking Process</span>
          <span className="text-xs text-purple-400">
            ({steps.length} steps · {(totalTime / 1000).toFixed(2)}s)
          </span>
        </div>
        <i className="fa fa-chevron-down group-hover:translate-y-1 transition-transform"></i>
      </button>
    );
  }

  return (
    <div className={`bg-purple-900/20 border border-purple-500/30 rounded-lg overflow-hidden ${
      mode === 'panel' ? 'w-full h-full flex flex-col' : ''
    }`}>
      {/* Header */}
      <div className="px-4 py-3 bg-purple-900/40 border-b border-purple-500/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <i className="fa fa-brain text-purple-400"></i>
          <div>
            <div className="font-semibold text-purple-200">AI Thinking Process</div>
            <div className="text-xs text-purple-400">
              {steps.length} steps · {(totalTime / 1000).toFixed(2)}s total
            </div>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="px-3 py-1 hover:bg-purple-800/50 rounded text-sm"
        >
          <i className="fa fa-chevron-up"></i>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-purple-500/30 bg-black/20">
        <button
          onClick={() => setActiveTab('steps')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'steps'
              ? 'bg-purple-600/30 text-purple-200 border-b-2 border-purple-400'
              : 'text-purple-400 hover:bg-purple-900/20'
          }`}
        >
          <i className="fa fa-list-ol mr-2"></i>
          Steps
        </button>
        {ragContext.length > 0 && (
          <button
            onClick={() => setActiveTab('rag')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'rag'
                ? 'bg-purple-600/30 text-purple-200 border-b-2 border-purple-400'
                : 'text-purple-400 hover:bg-purple-900/20'
            }`}
          >
            <i className="fa fa-file-text mr-2"></i>
            RAG Context ({ragContext.length})
          </button>
        )}
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'timeline'
              ? 'bg-purple-600/30 text-purple-200 border-b-2 border-purple-400'
              : 'text-purple-400 hover:bg-purple-900/20'
          }`}
        >
          <i className="fa fa-clock mr-2"></i>
          Timeline
        </button>
      </div>

      {/* Content */}
      <div className={`p-4 overflow-y-auto ${mode === 'panel' ? 'flex-1' : 'max-h-96'}`}>
        {activeTab === 'steps' && (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold">
                    {step.step}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="w-0.5 h-full bg-purple-600/50 mt-2"></div>
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="text-sm text-purple-200 font-medium mb-1">
                    Step {step.step}
                  </div>
                  <div className="text-sm text-gray-300">{step.thought}</div>
                  <div className="text-xs text-purple-400 mt-1">
                    ⏱ {step.duration_ms}ms
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'rag' && (
          <div className="space-y-3">
            {ragContext.map((chunk, index) => (
              <div key={index} className="border border-purple-500/30 rounded-lg p-3 bg-black/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-purple-200 text-sm">
                    <i className="fa fa-file mr-2"></i>
                    {chunk.doc_title}
                  </div>
                  <div className="text-xs text-green-400">
                    {(chunk.similarity * 100).toFixed(1)}% match
                  </div>
                </div>
                <div className="text-xs text-gray-400 line-clamp-3">
                  {chunk.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-2">
            {steps.map((step, index) => {
              const percentage = (step.duration_ms / totalTime) * 100;
              return (
                <div key={index}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-purple-200">Step {step.step}</span>
                    <span className="text-purple-400">{step.duration_ms}ms ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-6 bg-purple-900/20 rounded overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center text-xs text-white font-medium"
                      style={{ width: `${percentage}%` }}
                    >
                      {percentage > 15 && `${percentage.toFixed(0)}%`}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="mt-4 pt-4 border-t border-purple-500/30 text-sm">
              <div className="flex justify-between text-purple-200">
                <span>Total Time:</span>
                <span className="font-bold">{(totalTime / 1000).toFixed(2)}s</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
