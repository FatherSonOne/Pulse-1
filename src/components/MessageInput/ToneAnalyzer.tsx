// src/components/MessageInput/ToneAnalyzer.tsx
// Tone Analysis Badge Component

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ToneAnalyzerProps } from './types';

const ToneAnalyzer: React.FC<ToneAnalyzerProps> = ({ analysis, isAnalyzing, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!analysis && !isAnalyzing) return null;

  const getToneIcon = (tone: string): string => {
    switch (tone) {
      case 'positive':
        return '😊';
      case 'neutral':
        return '😐';
      case 'negative':
        return '😟';
      case 'mixed':
        return '🤔';
      default:
        return '😐';
    }
  };

  const getToneLabel = (tone: string): string => {
    return tone.charAt(0).toUpperCase() + tone.slice(1);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className={`tone-analyzer-badge ${analysis ? `tone-${analysis.tone}` : ''}`}
        onClick={() => {
          setShowTooltip(!showTooltip);
          onClick?.();
        }}
        aria-label={
          analysis
            ? `Message tone: ${analysis.tone}, click for details`
            : 'Analyzing message tone...'
        }
        aria-expanded={showTooltip}
        aria-controls="tone-tooltip"
        style={{
          position: 'absolute',
          top: 'var(--space-3, 0.75rem)',
          right: 'var(--space-3, 0.75rem)',
          zIndex: 10,
        }}
      >
        <span className="tone-icon" aria-hidden="true">
          {isAnalyzing ? (
            <i className="fa-solid fa-circle-notch fa-spin text-xs" />
          ) : analysis ? (
            getToneIcon(analysis.tone)
          ) : (
            '😐'
          )}
        </span>
        <span className="tone-label">{analysis ? getToneLabel(analysis.tone) : 'Analyzing...'}</span>
      </button>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && analysis && (
          <motion.div
            className="tone-tooltip"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            id="tone-tooltip"
            role="tooltip"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              background: '#18181B',
              border: '1px solid #3F3F46',
              borderRadius: 'var(--ai-radius-lg, 0.75rem)',
              padding: 'var(--space-4, 1rem)',
              minWidth: '280px',
              boxShadow: 'var(--ai-shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1))',
              zIndex: 'var(--z-dropdown, 50)',
            }}
          >
            <div className="tone-tooltip-header">
              <h4
                style={{
                  fontSize: 'var(--text-sm, 0.875rem)',
                  fontWeight: 600,
                  color: '#E4E4E7',
                  marginBottom: 'var(--space-3, 0.75rem)',
                }}
              >
                Tone Analysis
              </h4>
            </div>

            <div className="tone-analysis-content">
              {/* Main Tone */}
              <div
                className="tone-analysis-item"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2, 0.5rem) 0',
                  borderBottom: '1px solid #27272A',
                }}
              >
                <span className="tone-metric-label" style={{ fontSize: 'var(--text-sm, 0.875rem)', color: '#A1A1AA' }}>
                  Overall Tone
                </span>
                <span className="tone-metric-value" style={{ fontSize: 'var(--text-sm, 0.875rem)', fontWeight: 600, color: '#E4E4E7' }}>
                  {getToneLabel(analysis.tone)}
                </span>
              </div>

              {/* Sentiment Score */}
              <div
                className="tone-analysis-item"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2, 0.5rem) 0',
                  borderBottom: '1px solid #27272A',
                }}
              >
                <span className="tone-metric-label" style={{ fontSize: 'var(--text-sm, 0.875rem)', color: '#A1A1AA' }}>
                  Sentiment
                </span>
                <span className="tone-metric-value" style={{ fontSize: 'var(--text-sm, 0.875rem)', fontWeight: 600, color: '#E4E4E7' }}>
                  {analysis.sentiment > 0 ? '+' : ''}
                  {(analysis.sentiment * 100).toFixed(0)}%
                </span>
              </div>

              {/* Confidence */}
              <div
                className="tone-analysis-item"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2, 0.5rem) 0',
                  borderBottom: '1px solid #27272A',
                }}
              >
                <span className="tone-metric-label" style={{ fontSize: 'var(--text-sm, 0.875rem)', color: '#A1A1AA' }}>
                  Confidence
                </span>
                <span className="tone-metric-value" style={{ fontSize: 'var(--text-sm, 0.875rem)', fontWeight: 600, color: '#E4E4E7' }}>
                  {(analysis.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {/* Additional Metrics */}
              {analysis.metrics && (
                <>
                  <div
                    className="tone-analysis-item"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: 'var(--space-2, 0.5rem) 0',
                      borderBottom: '1px solid #27272A',
                    }}
                  >
                    <span className="tone-metric-label" style={{ fontSize: 'var(--text-sm, 0.875rem)', color: '#A1A1AA' }}>
                      Formality
                    </span>
                    <span className="tone-metric-value" style={{ fontSize: 'var(--text-sm, 0.875rem)', fontWeight: 600, color: '#E4E4E7' }}>
                      {(analysis.metrics.formality * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div
                    className="tone-analysis-item"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: 'var(--space-2, 0.5rem) 0',
                      borderBottom: '1px solid #27272A',
                    }}
                  >
                    <span className="tone-metric-label" style={{ fontSize: 'var(--text-sm, 0.875rem)', color: '#A1A1AA' }}>
                      Emotionality
                    </span>
                    <span className="tone-metric-value" style={{ fontSize: 'var(--text-sm, 0.875rem)', fontWeight: 600, color: '#E4E4E7' }}>
                      {(analysis.metrics.emotionality * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div
                    className="tone-analysis-item"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: 'var(--space-2, 0.5rem) 0',
                    }}
                  >
                    <span className="tone-metric-label" style={{ fontSize: 'var(--text-sm, 0.875rem)', color: '#A1A1AA' }}>
                      Urgency
                    </span>
                    <span className="tone-metric-value" style={{ fontSize: 'var(--text-sm, 0.875rem)', fontWeight: 600, color: '#E4E4E7' }}>
                      {(analysis.metrics.urgency * 100).toFixed(0)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ToneAnalyzer;
