// src/components/MessageInput/AIComposer.tsx
// AI Suggestions Overlay Component

import React from 'react';
import { motion } from 'framer-motion';
import type { AIComposerProps, AISuggestion } from './types';

const AIComposer: React.FC<AIComposerProps> = ({
  suggestions,
  isLoading,
  onAcceptSuggestion,
  onDismissSuggestion,
  onClose,
}) => {
  const getConfidenceLevel = (confidence: number): 'high' | 'medium' | 'low' => {
    if (confidence >= 80) return 'high';
    if (confidence >= 50) return 'medium';
    return 'low';
  };

  const getConfidenceColor = (level: 'high' | 'medium' | 'low'): string => {
    switch (level) {
      case 'high':
        return 'var(--confidence-high, #10B981)';
      case 'medium':
        return 'var(--confidence-medium, #F59E0B)';
      case 'low':
        return 'var(--confidence-low, #EF4444)';
    }
  };

  return (
    <motion.div
      className="ai-composer-overlay"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      role="complementary"
      aria-label="AI message suggestions"
      aria-live="polite"
    >
      {/* Header */}
      <div className="ai-composer-header">
        <i className="fa-solid fa-wand-magic-sparkles ai-composer-icon" aria-hidden="true" />
        <h3 className="ai-composer-title">AI Suggestions</h3>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-zinc-400 hover:text-white transition"
          aria-label="Close AI suggestions"
        >
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      {/* Loading State */}
      {isLoading && suggestions.length === 0 && (
        <div className="ai-loading-skeleton">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton-suggestion" />
          ))}
        </div>
      )}

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <div className="suggestions-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {suggestions.map((suggestion) => (
            <motion.button
              type="button"
              key={suggestion.id}
              className="suggestion-card"
              onClick={() => onAcceptSuggestion(suggestion)}
              role="option"
              aria-label={`Suggestion: ${suggestion.text}. Confidence: ${suggestion.confidence}%`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <p className="suggestion-text">{suggestion.text}</p>

              <div className="suggestion-footer">
                {/* Confidence Bar */}
                <div className="confidence-bar-container" aria-hidden="true">
                  <div className="confidence-bar">
                    <div
                      className="confidence-fill"
                      data-level={getConfidenceLevel(suggestion.confidence)}
                      style={{
                        width: `${suggestion.confidence}%`,
                        backgroundColor: getConfidenceColor(suggestion.confidenceLevel),
                      }}
                    />
                  </div>
                  <span className="confidence-percentage">{suggestion.confidence}%</span>
                </div>

                {/* Action Buttons */}
                <div className="suggestion-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAcceptSuggestion(suggestion);
                    }}
                    className="suggestion-action-accept"
                    aria-label="Accept suggestion"
                    title="Accept suggestion"
                    style={{
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '4px',
                      color: '#10B981',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    <i className="fa-solid fa-check text-xs" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismissSuggestion(suggestion.id);
                    }}
                    className="suggestion-action-dismiss"
                    aria-label="Dismiss suggestion"
                    title="Dismiss suggestion"
                    style={{
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '4px',
                      color: '#EF4444',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    <i className="fa-solid fa-xmark text-xs" />
                  </button>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* No Suggestions State */}
      {!isLoading && suggestions.length === 0 && (
        <div className="text-center py-6 text-zinc-500 text-sm">
          <i className="fa-solid fa-lightbulb text-2xl mb-2 opacity-50" />
          <p>Type more to get AI suggestions</p>
        </div>
      )}
    </motion.div>
  );
};

export default AIComposer;
