import { useState, useEffect, useRef } from 'react';
import {
  Wand2,
  MessageCircle,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  Users,
  ThumbsUp,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Mic,
  MicOff
} from 'lucide-react';
import { analyzeDraftIntent } from '../../services/geminiService';
import { DraftAnalysis } from '../../types';
import { VoiceTextButton } from '../shared/VoiceTextButton';
import './IntentComposer.css';

interface IntentComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend?: () => void;
  placeholder?: string;
  apiKey: string;
  showAnalysis?: boolean;
  minRows?: number;
  maxRows?: number;
  disabled?: boolean;
}

const intentConfig: Record<DraftAnalysis['intent'], {
  icon: React.ReactNode;
  label: string;
  color: string;
  suggestion: string;
}> = {
  decision: {
    icon: <ThumbsUp size={16} />,
    label: 'Decision',
    color: '#8b5cf6',
    suggestion: 'Consider creating a formal decision with voting'
  },
  fyi: {
    icon: <MessageCircle size={16} />,
    label: 'FYI',
    color: '#3b82f6',
    suggestion: 'This looks informational - keep it concise'
  },
  request: {
    icon: <HelpCircle size={16} />,
    label: 'Request',
    color: '#f59e0b',
    suggestion: 'Make sure to specify deadlines and expectations'
  },
  brainstorm: {
    icon: <Lightbulb size={16} />,
    label: 'Brainstorm',
    color: '#10b981',
    suggestion: 'Consider using a shared doc for collaborative ideas'
  },
  social: {
    icon: <Users size={16} />,
    label: 'Social',
    color: '#ec4899',
    suggestion: 'Keep it warm and authentic!'
  }
};

export const IntentComposer: React.FC<IntentComposerProps> = ({
  value,
  onChange,
  onSend,
  placeholder = 'Type your message...',
  apiKey,
  showAnalysis = true,
  minRows = 2,
  maxRows = 8,
  disabled = false
}) => {
  const [analysis, setAnalysis] = useState<DraftAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showImprovement, setShowImprovement] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const lineHeight = 24;
      const minHeight = minRows * lineHeight;
      const maxHeight = maxRows * lineHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
  }, [value, minRows, maxRows]);

  // Debounced intent analysis
  useEffect(() => {
    if (!showAnalysis || !apiKey || !value || value.length < 10) {
      setAnalysis(null);
      return;
    }

    // Clear previous timeout
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }

    // Debounce analysis by 1 second
    analysisTimeoutRef.current = setTimeout(async () => {
      setIsAnalyzing(true);
      try {
        const result = await analyzeDraftIntent(apiKey, value);
        if (result) {
          setAnalysis(result);
        }
      } catch (error) {
        console.error('Intent analysis error:', error);
      }
      setIsAnalyzing(false);
    }, 1000);

    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, [value, apiKey, showAnalysis]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend?.();
    }
  };

  const handleApplyImprovement = () => {
    if (analysis?.improvedText) {
      onChange(analysis.improvedText);
      setShowImprovement(false);
      setAnalysis(null);
    }
  };

  const handleCopyImprovement = () => {
    if (analysis?.improvedText) {
      navigator.clipboard.writeText(analysis.improvedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVoiceInput = (text: string) => {
    const newValue = value + (value && !value.endsWith(' ') ? ' ' : '') + text;
    onChange(newValue);
  };

  const intentInfo = analysis ? intentConfig[analysis.intent] : null;

  return (
    <div className={`intent-composer ${disabled ? 'disabled' : ''}`}>
      <div className="composer-main">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={minRows}
        />

        <div className="composer-actions">
          <VoiceTextButton
            onTranscript={handleVoiceInput}
            size="sm"
          />
        </div>
      </div>

      {/* Intent Analysis Panel */}
      {showAnalysis && analysis && intentInfo && (
        <div className={`analysis-panel ${showPanel ? 'expanded' : 'collapsed'}`}>
          <div
            className="analysis-header"
            onClick={() => setShowPanel(!showPanel)}
          >
            <div className="intent-badge" style={{ backgroundColor: intentInfo.color }}>
              {intentInfo.icon}
              <span>{intentInfo.label}</span>
            </div>

            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{
                  width: `${analysis.confidence * 100}%`,
                  backgroundColor: intentInfo.color
                }}
              />
            </div>

            <button className="toggle-panel">
              {showPanel ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>

          {showPanel && (
            <div className="analysis-content">
              <p className="intent-suggestion">{analysis.suggestion}</p>

              {analysis.improvedText && analysis.improvedText !== value && (
                <div className="improvement-section">
                  <button
                    className="improvement-toggle"
                    onClick={() => setShowImprovement(!showImprovement)}
                  >
                    <Sparkles size={14} />
                    <span>View AI improvement</span>
                    {showImprovement ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showImprovement && (
                    <div className="improvement-content">
                      <div className="improved-text">
                        {analysis.improvedText}
                      </div>
                      <div className="improvement-actions">
                        <button onClick={handleApplyImprovement}>
                          <Check size={14} />
                          Apply
                        </button>
                        <button onClick={handleCopyImprovement}>
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                          {copied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading Indicator */}
      {isAnalyzing && (
        <div className="analyzing-indicator">
          <Wand2 className="analyzing-icon" size={14} />
          <span>Analyzing intent...</span>
        </div>
      )}
    </div>
  );
};

// Quick suggestion chips for common message types
export const IntentSuggestionChips: React.FC<{
  onSelect: (template: string, intent: DraftAnalysis['intent']) => void;
}> = ({ onSelect }) => {
  const suggestions = [
    { intent: 'decision' as const, label: 'Propose Decision', template: '📋 Decision: [Title]\n\nProposal: [Description]\n\nOptions:\n1. Option A\n2. Option B\n\nPlease vote by EOD.' },
    { intent: 'request' as const, label: 'Request Action', template: '🎯 Request: [Task]\n\nDetails: [Context]\n\nDeadline: [Date]\n\nPlease let me know if you have questions.' },
    { intent: 'fyi' as const, label: 'Share Update', template: '📢 FYI: [Topic]\n\n[Key update]\n\nNo action needed, just keeping you informed.' },
    { intent: 'brainstorm' as const, label: 'Start Brainstorm', template: '💡 Brainstorm: [Topic]\n\nContext: [Background]\n\nLooking for ideas on:\n• [Area 1]\n• [Area 2]\n\nShare your thoughts!' },
  ];

  return (
    <div className="intent-suggestion-chips">
      {suggestions.map((s) => {
        const config = intentConfig[s.intent];
        return (
          <button
            key={s.intent}
            className="suggestion-chip"
            style={{ borderColor: config.color }}
            onClick={() => onSelect(s.template, s.intent)}
          >
            {config.icon}
            <span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
};
