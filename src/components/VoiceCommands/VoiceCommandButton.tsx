/**
 * VoiceCommandButton Component
 *
 * Floating action button for activating voice commands.
 * Opens the VoiceCommandModal with OpenAI Realtime voice feedback.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useVoiceCommands, VOICE_COMMAND_TEMPLATES } from '../../hooks/useVoiceCommands';
import { VoiceCommandModal } from './VoiceCommandModal';
import './VoiceCommands.css';

interface VoiceCommandButtonProps {
  /** Position on screen */
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  /** Callback when navigation command is issued */
  onNavigate?: (view: string) => void;
  /** Show quick command palette on long press */
  enableQuickCommands?: boolean;
  /** Custom class name */
  className?: string;
  /** Whether button is minimized */
  minimized?: boolean;
  /** OpenAI API key for voice feedback */
  openaiApiKey?: string;
  /** User ID for session tracking */
  userId?: string;
  /** Use full-screen modal instead of inline UI */
  useModal?: boolean;
}

export const VoiceCommandButton: React.FC<VoiceCommandButtonProps> = ({
  position = 'bottom-right',
  onNavigate,
  enableQuickCommands = true,
  className = '',
  minimized = false,
  openaiApiKey,
  userId,
  useModal = true,
}) => {
  const [showPalette, setShowPalette] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Get OpenAI API key from localStorage if not provided
  const effectiveOpenaiKey = openaiApiKey || localStorage.getItem('openai_api_key') || '';

  const voiceCommands = useVoiceCommands({
    enableSpokenFeedback: !useModal, // Use modal's voice feedback instead
    enableAIParsing: true,
    autoExecute: true,
    onNavigate,
    onActiveChange: (active) => {
      if (!active) {
        setShowPalette(false);
      }
    },
  });

  const {
    status,
    isActive,
    isSupported,
    interimTranscript,
    currentTranscript,
    lastCommand,
    lastResult,
    error,
    toggle,
    executeText,
    getCommands,
    deactivate,
  } = voiceCommands;

  // Handle long press for quick commands
  const handleMouseDown = () => {
    if (enableQuickCommands && !isActive) {
      longPressTimerRef.current = setTimeout(() => {
        setShowPalette(true);
      }, 500);
    }
  };

  const handleMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Handle click
  const handleClick = () => {
    if (showPalette) {
      setShowPalette(false);
      return;
    }

    // Open modal if useModal is true
    if (useModal) {
      setShowModal(true);
      return;
    }

    toggle();
  };

  // Handle quick command selection
  const handleQuickCommand = async (command: string) => {
    setShowPalette(false);
    await executeText(command);
  };

  // Close palette on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setShowPalette(false);
        setShowHelp(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Escape to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isActive) {
          deactivate();
        }
        setShowPalette(false);
        setShowHelp(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, deactivate]);

  if (!isSupported) {
    return null;
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'listening':
        return (
          <svg className="voice-icon voice-icon-listening" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        );
      case 'processing':
        return (
          <svg className="voice-icon voice-icon-processing" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="31.4" strokeDashoffset="0">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
            </circle>
          </svg>
        );
      case 'executing':
        return (
          <svg className="voice-icon voice-icon-executing" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="voice-icon voice-icon-error" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        );
      default:
        return (
          <svg className="voice-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        );
    }
  };

  const getStatusClass = () => {
    const classes = ['voice-command-button'];
    if (isActive) classes.push('voice-command-button-active');
    if (status === 'listening') classes.push('voice-command-button-listening');
    if (status === 'processing') classes.push('voice-command-button-processing');
    if (status === 'executing') classes.push('voice-command-button-executing');
    if (status === 'error') classes.push('voice-command-button-error');
    if (minimized) classes.push('voice-command-button-minimized');
    if (className) classes.push(className);
    return classes.join(' ');
  };

  const containerClass = `voice-command-container voice-container-${position}`;

  return (
    <div className={containerClass}>
      {/* Transcript display */}
      {(isActive || status === 'processing') && (
        <div className="voice-transcript-display">
          <div className="voice-transcript-status">
            {status === 'listening' && 'Listening...'}
            {status === 'processing' && 'Processing...'}
            {status === 'executing' && 'Executing...'}
          </div>
          {(interimTranscript || currentTranscript) && (
            <div className="voice-transcript-text">
              {interimTranscript || currentTranscript}
            </div>
          )}
          {lastCommand && status !== 'listening' && (
            <div className="voice-command-detected">
              {lastCommand.suggestedAction}
            </div>
          )}
          {lastResult && lastResult.success && (
            <div className="voice-result-success">
              {lastResult.message}
            </div>
          )}
          {error && (
            <div className="voice-result-error">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Quick command palette */}
      {showPalette && (
        <div className="voice-quick-palette">
          <div className="voice-palette-header">
            <span>Quick Commands</span>
            <button
              className="voice-palette-help"
              onClick={(e) => {
                e.stopPropagation();
                setShowHelp(!showHelp);
              }}
            >
              ?
            </button>
          </div>

          <div className="voice-palette-section">
            <div className="voice-palette-section-title">Navigation</div>
            <div className="voice-palette-buttons">
              {VOICE_COMMAND_TEMPLATES.navigation.slice(0, 4).map((item, i) => (
                <button
                  key={i}
                  className="voice-palette-btn"
                  onClick={() => handleQuickCommand(item.command)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="voice-palette-section">
            <div className="voice-palette-section-title">Quick Actions</div>
            <div className="voice-palette-buttons">
              {VOICE_COMMAND_TEMPLATES.quickActions.slice(0, 3).map((item, i) => (
                <button
                  key={i}
                  className="voice-palette-btn"
                  onClick={() => handleQuickCommand(item.command)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="voice-palette-footer">
            <button
              className="voice-palette-voice-btn"
              onClick={() => {
                setShowPalette(false);
                toggle();
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              Speak Command
            </button>
          </div>
        </div>
      )}

      {/* Help overlay */}
      {showHelp && (
        <div className="voice-help-overlay">
          <div className="voice-help-header">
            <span>Voice Commands</span>
            <button onClick={() => setShowHelp(false)}>×</button>
          </div>
          <div className="voice-help-content">
            {getCommands().map((cmd, i) => (
              <div key={i} className="voice-help-command">
                <div className="voice-help-command-type">{cmd.type.replace('_', ' ')}</div>
                <div className="voice-help-command-desc">{cmd.description}</div>
                <div className="voice-help-command-examples">
                  {cmd.examples.slice(0, 2).map((ex, j) => (
                    <span key={j}>"{ex}"</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main button */}
      <button
        ref={buttonRef}
        className={getStatusClass()}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        title={isActive ? 'Stop listening' : 'Voice command (hold for quick commands)'}
        aria-label={isActive ? 'Stop voice command' : 'Start voice command'}
      >
        {getStatusIcon()}
        {isActive && (
          <div className="voice-ripple-container">
            <div className="voice-ripple voice-ripple-1" />
            <div className="voice-ripple voice-ripple-2" />
            <div className="voice-ripple voice-ripple-3" />
          </div>
        )}
      </button>

      {/* Voice Command Modal */}
      {useModal && (
        <VoiceCommandModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onNavigate={onNavigate}
          openaiApiKey={effectiveOpenaiKey}
          userId={userId}
        />
      )}
    </div>
  );
};

export default VoiceCommandButton;
