// Enhanced Smart Compose with Inline Autocomplete
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { SmartComposeSuggestion } from '../../types/messageEnhancements';

interface SmartComposeEnhancedProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  suggestions: SmartComposeSuggestion[];
  loading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Ghost text inline autocomplete
export const SmartComposeEnhanced: React.FC<SmartComposeEnhancedProps> = ({
  value,
  onChange,
  onSend,
  suggestions,
  loading = false,
  placeholder = 'Type a message...',
  disabled = false,
  className = ''
}) => {
  const [ghostText, setGhostText] = useState('');
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showSuggestionsList, setShowSuggestionsList] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  // Calculate ghost text from the best suggestion
  useEffect(() => {
    if (suggestions.length > 0 && value.length > 5) {
      const bestSuggestion = suggestions[selectedSuggestionIndex];
      if (bestSuggestion && bestSuggestion.text.toLowerCase().startsWith(value.toLowerCase())) {
        // Show the remaining text as ghost
        setGhostText(bestSuggestion.text.slice(value.length));
      } else if (bestSuggestion) {
        // If suggestion doesn't start with current text, show after cursor position
        const remainingText = bestSuggestion.text.replace(value, '');
        if (remainingText !== bestSuggestion.text) {
          setGhostText(remainingText);
        } else {
          setGhostText('');
        }
      }
    } else {
      setGhostText('');
    }
  }, [suggestions, value, selectedSuggestionIndex]);

  // Handle tab to accept ghost text
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && ghostText) {
      e.preventDefault();
      onChange(value + ghostText);
      setGhostText('');
    } else if (e.key === 'Escape') {
      setGhostText('');
      setShowSuggestionsList(false);
    } else if (e.key === 'ArrowDown' && showSuggestionsList) {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp' && showSuggestionsList) {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow shift+enter for new line
        return;
      }
      if (showSuggestionsList && suggestions.length > 0) {
        e.preventDefault();
        onChange(suggestions[selectedSuggestionIndex].text);
        setShowSuggestionsList(false);
      } else if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        onSend();
      }
    }
  }, [ghostText, value, onChange, showSuggestionsList, suggestions, selectedSuggestionIndex, onSend]);

  // Toggle suggestions list with keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === ' ' && document.activeElement === inputRef.current) {
        e.preventDefault();
        setShowSuggestionsList(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Ghost text overlay */}
      <div
        ref={ghostRef}
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{
          padding: '0.75rem 1rem',
          paddingRight: '3rem'
        }}
      >
        <span className="invisible whitespace-pre-wrap">{value}</span>
        <span className="text-zinc-400 dark:text-zinc-600 whitespace-pre-wrap">{ghostText}</span>
      </div>

      {/* Main textarea */}
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && value.length > 5 && setShowSuggestionsList(true)}
        onBlur={() => setTimeout(() => setShowSuggestionsList(false), 200)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-transparent resize-none outline-none text-zinc-900 dark:text-white"
        style={{
          padding: '0.75rem 1rem',
          paddingRight: '3rem',
          caretColor: 'auto'
        }}
        rows={1}
      />

      {/* Tab hint */}
      {ghostText && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
          <kbd className="font-mono">Tab</kbd>
          <span>to complete</span>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestionsList && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden z-50 animate-scale-in">
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-wand-magic-sparkles text-purple-500 text-xs" />
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Smart Suggestions</span>
            </div>
            <span className="text-[10px] text-zinc-400">
              <kbd className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded text-[9px]">↑↓</kbd> navigate
              <kbd className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded text-[9px] ml-1">↵</kbd> select
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  onChange(suggestion.text);
                  setShowSuggestionsList(false);
                }}
                onMouseEnter={() => setSelectedSuggestionIndex(index)}
                className={`w-full text-left px-3 py-2.5 transition-colors ${
                  index === selectedSuggestionIndex
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
                }`}
              >
                <div className="text-sm text-zinc-800 dark:text-zinc-200 line-clamp-2">
                  {suggestion.text}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    suggestion.type === 'complete' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                    suggestion.type === 'rephrase' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                    suggestion.type === 'time' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  }`}>
                    {suggestion.type}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-12 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full">
                      <div
                        className="h-1 bg-blue-500 rounded-full"
                        style={{ width: `${suggestion.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400">
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Quick phrases component for common responses
interface QuickPhrasesProps {
  onSelect: (phrase: string) => void;
  context?: 'greeting' | 'thanks' | 'follow-up' | 'general';
}

export const QuickPhrases: React.FC<QuickPhrasesProps> = ({ onSelect, context = 'general' }) => {
  const phrases: Record<string, string[]> = {
    greeting: [
      'Hi! Hope you\'re doing well.',
      'Good morning! How are you?',
      'Hey! Quick question for you.',
      'Hello! Just wanted to touch base.'
    ],
    thanks: [
      'Thanks so much!',
      'Really appreciate your help!',
      'Thank you, this is great!',
      'Thanks for getting back to me!'
    ],
    'follow-up': [
      'Just following up on this.',
      'Any updates on this?',
      'Checking in on the status.',
      'Let me know when you get a chance.'
    ],
    general: [
      'Sounds good!',
      'Got it, thanks!',
      'Let me know if you need anything.',
      'Perfect, I\'ll take care of it.'
    ]
  };

  const currentPhrases = phrases[context] || phrases.general;

  return (
    <div className="flex flex-wrap gap-1.5">
      {currentPhrases.map((phrase, index) => (
        <button
          key={index}
          onClick={() => onSelect(phrase)}
          className="px-2.5 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-300 transition-colors border border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-600"
        >
          {phrase}
        </button>
      ))}
    </div>
  );
};

// Tone adjuster component
interface ToneAdjusterProps {
  originalText: string;
  onAdjust: (tone: string, text: string) => void;
  loading?: boolean;
}

export const ToneAdjuster: React.FC<ToneAdjusterProps> = ({ originalText, onAdjust, loading }) => {
  const [selectedTone, setSelectedTone] = useState<string | null>(null);

  const tones = [
    { id: 'formal', label: 'Formal', icon: 'fa-user-tie', color: 'text-blue-500' },
    { id: 'friendly', label: 'Friendly', icon: 'fa-face-smile', color: 'text-amber-500' },
    { id: 'concise', label: 'Concise', icon: 'fa-compress', color: 'text-emerald-500' },
    { id: 'detailed', label: 'Detailed', icon: 'fa-expand', color: 'text-purple-500' },
    { id: 'urgent', label: 'Urgent', icon: 'fa-bolt', color: 'text-red-500' }
  ];

  if (!originalText || originalText.length < 10) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-bold">
        Adjust tone:
      </span>
      <div className="flex gap-1">
        {tones.map(tone => (
          <button
            key={tone.id}
            onClick={() => {
              setSelectedTone(tone.id);
              onAdjust(tone.id, originalText);
            }}
            disabled={loading}
            className={`p-1.5 rounded-lg transition-all ${
              selectedTone === tone.id
                ? 'bg-zinc-200 dark:bg-zinc-700 scale-110'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={tone.label}
          >
            <i className={`fa-solid ${tone.icon} ${tone.color} text-xs`} />
          </button>
        ))}
      </div>
      {loading && (
        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  );
};

export default SmartComposeEnhanced;
