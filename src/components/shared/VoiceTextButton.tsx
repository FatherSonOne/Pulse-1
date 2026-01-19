/**
 * VoiceTextButton Component
 *
 * A reusable microphone button for voice-to-text input.
 * Can be added to any text input area to enable voice dictation.
 *
 * Features:
 * - Dual provider support (Web Speech API / OpenAI gpt-4o-transcribe)
 * - Visual feedback (pulsing animation when recording)
 * - Interim transcript preview (optional)
 * - Append mode (accumulates text across dictation sessions)
 */

import React, { useState, useEffect } from 'react';
import { useVoiceToText, VoiceToTextProvider } from '../../hooks/useVoiceToText';

export interface VoiceTextButtonProps {
  /** Called with final transcribed text (to append to input) */
  onTranscript: (text: string) => void;
  /** Called with interim transcript while speaking (for preview) */
  onInterimTranscript?: (text: string) => void;
  /** Called when listening state changes */
  onListeningChange?: (isListening: boolean) => void;
  /** Called on error */
  onError?: (error: string) => void;
  /** Disable the button */
  disabled?: boolean;
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Provider preference: 'auto' uses fallback logic */
  provider?: 'web-speech' | 'openai' | 'auto';
  /** OpenAI API key (optional, falls back to localStorage) */
  openaiApiKey?: string;
  /** Language for speech recognition */
  language?: string;
  /** Show provider indicator in tooltip */
  showProvider?: boolean;
  /** Enable keyboard shortcut (hold key to dictate) */
  enableKeyboardShortcut?: boolean;
  /** Key to hold for dictation (default: spacebar when not in input) */
  shortcutKey?: string;
}

export const VoiceTextButton: React.FC<VoiceTextButtonProps> = ({
  onTranscript,
  onInterimTranscript,
  onListeningChange,
  onError,
  disabled = false,
  size = 'md',
  className = '',
  provider = 'auto',
  openaiApiKey,
  language = 'en-US',
  showProvider = true,
  enableKeyboardShortcut = false,
  shortcutKey,
}) => {
  const [localInterim, setLocalInterim] = useState('');

  // Get API key from props or localStorage
  const apiKey = openaiApiKey || localStorage.getItem('openai_api_key') || '';

  const {
    isListening,
    isSupported,
    activeProvider,
    interimTranscript,
    error,
    startListening,
    stopListening,
  } = useVoiceToText({
    provider: provider === 'auto' ? undefined : provider,
    openaiApiKey: apiKey,
    language,
    onFinalResult: onTranscript,
    onInterimResult: (text) => {
      setLocalInterim(text);
      onInterimTranscript?.(text);
    },
    onError,
    enableKeyboardShortcut,
    shortcutKey,
  });

  // Notify parent of listening state changes
  useEffect(() => {
    onListeningChange?.(isListening);
  }, [isListening, onListeningChange]);

  // Clear interim when not listening
  useEffect(() => {
    if (!isListening) {
      setLocalInterim('');
    }
  }, [isListening]);

  // Don't render if not supported
  if (!isSupported) {
    return null;
  }

  // Size classes
  const sizeClasses: Record<string, string> = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };

  // Provider display name
  const providerName: Record<VoiceToTextProvider, string> = {
    'web-speech': 'Browser',
    'openai': 'OpenAI',
  };

  const handleClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const tooltipText = isListening
    ? 'Stop recording'
    : showProvider && activeProvider
    ? `Voice input (${providerName[activeProvider]})`
    : 'Voice input';

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`
          ${sizeClasses[size]}
          rounded-lg flex items-center justify-center transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-red-500/50
          ${isListening
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `}
        title={tooltipText}
        aria-label={tooltipText}
      >
        {/* Icon */}
        <i
          className={`fa-solid ${isListening ? 'fa-stop' : 'fa-microphone'}`}
        />

        {/* Pulsing animation when recording */}
        {isListening && (
          <>
            <span className="absolute inset-0 rounded-lg bg-red-500 animate-ping opacity-30" />
            <span className="absolute inset-0 rounded-lg bg-red-500 animate-pulse opacity-20" />
          </>
        )}
      </button>

      {/* Interim transcript preview (shows while speaking) */}
      {isListening && localInterim && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 rounded-lg text-xs text-zinc-300 whitespace-nowrap max-w-[200px] truncate shadow-lg border border-zinc-700 z-10">
          <i className="fa-solid fa-quote-left text-red-500 mr-1 text-[10px]" />
          {localInterim}
        </div>
      )}

      {/* Error indicator */}
      {error && !isListening && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-zinc-900" title={error} />
      )}
    </div>
  );
};

/**
 * Compact inline version for tight spaces
 */
export const VoiceTextButtonInline: React.FC<VoiceTextButtonProps> = (props) => {
  return <VoiceTextButton {...props} size="sm" showProvider={false} />;
};

export default VoiceTextButton;
