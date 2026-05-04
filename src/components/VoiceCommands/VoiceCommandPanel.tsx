/**
 * VoiceCommandPanel Component
 *
 * Full-featured voice command panel with command history,
 * available commands list, and settings.
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Mic, X, Send, Undo2, Check } from 'lucide-react';
import { useVoiceCommands, VOICE_COMMAND_TEMPLATES } from '../../hooks/useVoiceCommands';
import { VoiceCommand } from '../../services/voiceCommandService';
import './VoiceCommands.css';

interface VoiceCommandPanelProps {
  /** Panel visibility */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Navigation callback */
  onNavigate?: (view: string) => void;
  /** Panel position */
  position?: 'right' | 'left' | 'center';
}

type TabType = 'library' | 'history' | 'shortcuts' | 'settings';

export const VoiceCommandPanel: React.FC<VoiceCommandPanelProps> = ({
  isOpen,
  onClose,
  onNavigate,
  position = 'right',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('library');
  const [commandInput, setCommandInput] = useState('');
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('pulse:voice-command-settings');
      if (saved) return JSON.parse(saved);
    } catch { /* use defaults */ }
    return {
      spokenFeedback: false,
      aiParsing: true,
      autoExecute: true,
      language: 'en-US',
    };
  });

  // Persist settings changes
  useEffect(() => {
    try {
      localStorage.setItem('pulse:voice-command-settings', JSON.stringify(settings));
    } catch { /* storage full or unavailable */ }
  }, [settings]);

  // Read OpenAI key for Whisper fallback when Web Speech API fails
  const openaiApiKey = localStorage.getItem('openai_api_key') || '';

  const voiceCommands = useVoiceCommands({
    enableSpokenFeedback: settings.spokenFeedback,
    enableAIParsing: settings.aiParsing,
    autoExecute: settings.autoExecute,
    language: settings.language,
    openaiApiKey,
    onNavigate,
  });

  const {
    status,
    isActive,
    isSupported,
    interimTranscript,
    currentTranscript,
    lastCommand,
    lastResult,
    pendingCommand,
    error,
    toggle,
    executeText,
    confirmPending,
    cancelPending,
    getCommands,
    getHistory,
    deactivate,
    clear,
  } = voiceCommands;

  const commands = getCommands();
  const history = getHistory();

  // Close on Escape, switch tabs with digits
  useEffect(() => {
    if (!isOpen) return;
    const tabOrder: TabType[] = ['library', 'history', 'shortcuts', 'settings'];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isActive) deactivate();
        else onClose();
        return;
      }

      // Don't hijack digits while the user is typing a command
      const target = e.target as HTMLElement | null;
      const isTextField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isTextField) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx >= 0) {
        e.preventDefault();
        setActiveTab(tabOrder[idx]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isActive, deactivate, onClose]);

  // Reset error state when panel opens so stale errors don't persist,
  // and land focus on the command input so power users can type immediately.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen) {
      clear();
      // Defer focus so the panel's enter-animation doesn't fight the focus call
      const id = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Pending-confirm strip: 2-second cancel window for destructive voice commands
  // ("send sms", "create task", etc.) before they auto-execute. Misheard utterances
  // get a brief abort handle; quiet utterances ship through.
  const [pendingSecondsLeft, setPendingSecondsLeft] = useState(0);
  const pendingTimerRef = useRef<number | null>(null);
  const pendingPausedRef = useRef(false);

  useEffect(() => {
    if (!pendingCommand) {
      if (pendingTimerRef.current) window.clearInterval(pendingTimerRef.current);
      pendingTimerRef.current = null;
      pendingPausedRef.current = false;
      setPendingSecondsLeft(0);
      return;
    }

    setPendingSecondsLeft(2);
    pendingPausedRef.current = false;
    if (pendingTimerRef.current) window.clearInterval(pendingTimerRef.current);
    pendingTimerRef.current = window.setInterval(() => {
      // Pause-on-hover/focus: hold the countdown while the user is reading the strip
      if (pendingPausedRef.current) return;
      setPendingSecondsLeft(prev => {
        if (prev <= 1) {
          if (pendingTimerRef.current) window.clearInterval(pendingTimerRef.current);
          pendingTimerRef.current = null;
          // Auto-confirm at zero. confirmPending reads its own ref, so calling here is safe.
          confirmPending();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (pendingTimerRef.current) window.clearInterval(pendingTimerRef.current);
      pendingTimerRef.current = null;
    };
  }, [pendingCommand, confirmPending]);

  // Undo strip: appears for 3s after a successful auto-executed command.
  const [undoCommand, setUndoCommand] = useState<VoiceCommand | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const undoTimerRef = useRef<number | null>(null);
  const seenCommandRef = useRef<VoiceCommand | null>(null);

  useEffect(() => {
    if (!settings.autoExecute) return;
    if (!lastCommand || !lastResult || !lastResult.success) return;
    if (lastCommand === seenCommandRef.current) return;
    seenCommandRef.current = lastCommand;

    setUndoCommand(lastCommand);
    setUndoSecondsLeft(3);

    if (undoTimerRef.current) window.clearInterval(undoTimerRef.current);
    undoTimerRef.current = window.setInterval(() => {
      setUndoSecondsLeft(prev => {
        if (prev <= 1) {
          if (undoTimerRef.current) window.clearInterval(undoTimerRef.current);
          undoTimerRef.current = null;
          setUndoCommand(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [lastCommand, lastResult, settings.autoExecute]);

  useEffect(() => () => {
    if (undoTimerRef.current) window.clearInterval(undoTimerRef.current);
  }, []);

  const dismissUndo = () => {
    if (undoTimerRef.current) window.clearInterval(undoTimerRef.current);
    undoTimerRef.current = null;
    setUndoCommand(null);
    setUndoSecondsLeft(0);
  };

  const handleUndo = () => {
    if (undoCommand?.type === 'navigate' || undoCommand?.type === 'open_conversation' || undoCommand?.type === 'open_contact' || undoCommand?.type === 'open_project') {
      try { window.history.back(); } catch { /* noop */ }
    }
    // Other types: no programmatic undo available; the strip dismisses and the
    // user can re-issue the corrective command. Honesty > fake undo.
    dismissUndo();
  };

  // Handle manual command input
  const handleSubmitCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    await executeText(commandInput);
    setCommandInput('');
  };

  // Handle template command
  const handleTemplateClick = async (command: string) => {
    // If command has placeholders like [name], prompt or just set in input
    if (command.includes('[')) {
      setCommandInput(command);
    } else {
      await executeText(command);
    }
  };

  if (!isOpen) return null;

  const panel = (
    <div
      className="voice-panel-overlay"
      onClick={() => {
        if (isActive) {
          deactivate();
        } else {
          onClose();
        }
      }}
    >
      <div
        className={`voice-panel voice-panel-${position}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="voice-panel-header">
          <div className="voice-panel-title">
            <span className="voice-panel-title-mark" aria-hidden="true">
              <Mic size={16} strokeWidth={2.25} />
            </span>
            <span>Voice Commands</span>
          </div>
          <button
            type="button"
            className="voice-panel-close"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isActive) deactivate();
              onClose();
            }}
            aria-label="Close voice commands"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

      {/* Browser-support banner (hoisted from settings) */}
      {!isSupported && (
        <div className="voice-panel-banner" role="alert">
          Voice recognition isn't available in this browser. Type commands instead, or open Pulse in Chrome or Edge.
        </div>
      )}

      {/* Pending-confirm strip — cancel window for destructive voice commands */}
      {pendingCommand && (
        <div
          className="voice-pending-strip"
          role="alertdialog"
          aria-live="assertive"
          aria-label="Confirm destructive command"
          onMouseEnter={() => { pendingPausedRef.current = true; }}
          onMouseLeave={() => { pendingPausedRef.current = false; }}
          onFocusCapture={() => { pendingPausedRef.current = true; }}
          onBlurCapture={() => { pendingPausedRef.current = false; }}
        >
          <span className="voice-pending-label">
            <span className="voice-pending-tag">PENDING</span>
            {pendingCommand.suggestedAction || pendingCommand.rawTranscript || pendingCommand.type.replace(/_/g, ' ')}
          </span>
          <span className="voice-pending-actions">
            <button
              type="button"
              className="voice-pending-cancel"
              onClick={() => cancelPending()}
              aria-label="Cancel pending command"
            >
              <X size={12} strokeWidth={2.5} />
              Cancel
            </button>
            <button
              type="button"
              className="voice-pending-confirm"
              onClick={() => confirmPending()}
              aria-label="Run pending command now"
            >
              <Check size={12} strokeWidth={2.5} />
              Run
              <span className="voice-pending-count">{pendingSecondsLeft}</span>
            </button>
          </span>
        </div>
      )}

      {/* Undo strip — auto-execute safety net */}
      {undoCommand && (
        <div className="voice-undo-strip" role="status" aria-live="polite">
          <span className="voice-undo-label">
            <span className="voice-undo-tag">RAN</span>
            {undoCommand.type.replace(/_/g, ' ')}
          </span>
          <button className="voice-undo-action" onClick={handleUndo} type="button">
            <Undo2 size={12} strokeWidth={2.25} />
            Undo
            <span className="voice-undo-count">{undoSecondsLeft}</span>
          </button>
        </div>
      )}

      {/* Voice Status */}
      <div className={`voice-panel-status voice-panel-status-${status}`}>
        <div className="voice-status-indicator">
          {status === 'listening' && (
            <>
              <div className="voice-waveform" aria-hidden="true">
                <div className="voice-waveform-bar" />
                <div className="voice-waveform-bar" />
                <div className="voice-waveform-bar" />
                <div className="voice-waveform-bar" />
                <div className="voice-waveform-bar" />
              </div>
              <span>Listening</span>
            </>
          )}
          {status === 'processing' && <span>Parsing</span>}
          {status === 'executing' && <span>Executing</span>}
          {status === 'pending' && <span>Confirm</span>}
          {status === 'idle' && <span>Ready</span>}
          {status === 'error' && (
            <span className="voice-error">
              {error?.includes('network') || error?.includes('Network')
                ? 'Offline. Type instead.'
                : error}
            </span>
          )}
        </div>

        <button
          type="button"
          className={`voice-panel-toggle ${isActive ? 'active' : ''}`}
          onClick={toggle}
          disabled={status === 'processing' || status === 'executing' || status === 'pending'}
        >
          {status === 'listening' && 'Stop'}
          {status === 'processing' && 'Parsing…'}
          {status === 'executing' && 'Running…'}
          {status === 'pending' && 'Confirm'}
          {status === 'error' && 'Try again'}
          {status === 'idle' && 'Listen'}
        </button>
      </div>

      {/* Transcript */}
      {(interimTranscript || currentTranscript) && (
        <div className="voice-panel-transcript">
          <span className="voice-transcript-label">Heard</span>
          <span className="voice-transcript-value">
            {interimTranscript || currentTranscript}
          </span>
        </div>
      )}

      {/* Last Result */}
      {lastResult && (
        <div className={`voice-panel-result ${lastResult.success ? 'success' : 'error'}`}>
          <span className="voice-panel-result-message">{lastResult.message}</span>
          {!lastResult.success && lastCommand?.rawTranscript && (
            <button
              type="button"
              className="voice-panel-result-retry"
              onClick={() => {
                const transcript = lastCommand.rawTranscript;
                setCommandInput(transcript);
                inputRef.current?.focus();
                inputRef.current?.select();
              }}
              aria-label="Edit and retry the failed command"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Manual Input */}
      <form className="voice-panel-input" onSubmit={handleSubmitCommand}>
        <input
          ref={inputRef}
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder="Tell Pulse what to do…"
          aria-label="Command input"
        />
        <button type="submit" disabled={!commandInput.trim()} aria-label="Run command">
          <Send size={16} strokeWidth={2.25} />
        </button>
      </form>

      {/* Tabs */}
      <div className="voice-panel-tabs" role="tablist">
        {(['library', 'history', 'shortcuts', 'settings'] as TabType[]).map((tab, idx) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`voice-panel-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <span className="voice-panel-tab-label">{tab}</span>
            <span className="voice-panel-tab-key" aria-hidden="true">{idx + 1}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="voice-panel-content">
        {/* Library Tab — merged Commands + Templates */}
        {activeTab === 'library' && (
          <div className="voice-library">
            <div className="voice-commands-list">
              {commands.map((cmd, index) => (
                <div key={index} className="voice-command-item">
                  <div className="voice-command-type">
                    {cmd.type.replace(/_/g, ' ')}
                  </div>
                  <div className="voice-command-description">
                    {cmd.description}
                  </div>
                  <div className="voice-command-examples">
                    {cmd.examples.map((example, i) => (
                      <button
                        key={i}
                        className="voice-example-btn"
                        onClick={() => handleTemplateClick(example)}
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="voice-library-divider">
              <span>Quick fills</span>
            </div>

            <div className="voice-templates-list">
              {Object.entries(VOICE_COMMAND_TEMPLATES).map(([category, items]) => (
                <div key={category} className="voice-template-category">
                  <div className="voice-template-category-title">
                    {category.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="voice-template-items">
                    {items.map((item, index) => {
                      const needsFill = item.command.includes('[');
                      return (
                        <button
                          key={index}
                          className="voice-template-btn"
                          onClick={() => handleTemplateClick(item.command)}
                        >
                          <span className="voice-template-row">
                            <span className="voice-template-label">{item.label}</span>
                            {needsFill && <span className="voice-template-fill">FILL</span>}
                          </span>
                          <span className="voice-template-command">{item.command}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shortcuts Tab */}
        {activeTab === 'shortcuts' && (
          <div className="voice-shortcuts-list">
            <div className="voice-shortcut-row">
              <span className="voice-shortcut-label">Toggle voice panel</span>
              <span className="voice-shortcut-keys">
                <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>V</kbd>
              </span>
            </div>
            <div className="voice-shortcut-row">
              <span className="voice-shortcut-label">Run typed command</span>
              <span className="voice-shortcut-keys"><kbd>Enter</kbd></span>
            </div>
            <div className="voice-shortcut-row">
              <span className="voice-shortcut-label">Stop listening</span>
              <span className="voice-shortcut-keys"><kbd>Esc</kbd></span>
            </div>
            <div className="voice-shortcut-row">
              <span className="voice-shortcut-label">Close panel</span>
              <span className="voice-shortcut-keys"><kbd>Esc</kbd> <span className="voice-shortcut-or">when not listening</span></span>
            </div>
            <div className="voice-shortcut-row">
              <span className="voice-shortcut-label">Switch tabs</span>
              <span className="voice-shortcut-keys"><kbd>1</kbd>–<kbd>4</kbd></span>
            </div>
            <div className="voice-shortcut-note">
              Pulse listens for <em>hey pulse</em>, <em>ok pulse</em>, <em>pulse</em> globally. Say one to open this panel.
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="voice-history-list">
            {history.length === 0 ? (
              <div className="voice-history-empty">
                <div className="voice-history-empty-title">Nothing run yet</div>
                <div className="voice-history-empty-hint">
                  Try <button className="voice-empty-suggestion" onClick={() => handleTemplateClick("Open today's calendar")}>Open today's calendar</button> or hit <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd> and speak.
                </div>
              </div>
            ) : (
              history.map((cmd, index) => (
                <div key={index} className="voice-history-item">
                  <div className="voice-history-transcript">
                    {cmd.rawTranscript}
                  </div>
                  <div className="voice-history-details">
                    <span className={`voice-history-type voice-type-${cmd.type}`}>
                      {cmd.type.replace(/_/g, ' ')}
                    </span>
                    <span className="voice-history-confidence" title={`${Math.round(cmd.confidence * 100)}% match confidence`}>
                      CONF · {Math.round(cmd.confidence * 100)}%
                    </span>
                  </div>
                  {cmd.suggestedAction && (
                    <div className="voice-history-action">
                      {cmd.suggestedAction}
                    </div>
                  )}
                </div>
              ))
            )}
            {history.length > 0 && (
              <button className="voice-history-clear" onClick={clear}>
                Clear History
              </button>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="voice-settings-list">
            <label className="voice-setting-item">
              <span className="voice-setting-label">
                <strong>Spoken Feedback</strong>
                <small>Read command results aloud</small>
              </span>
              <input
                type="checkbox"
                checked={settings.spokenFeedback}
                onChange={(e) => setSettings(s => ({ ...s, spokenFeedback: e.target.checked }))}
              />
            </label>

            <label className="voice-setting-item">
              <span className="voice-setting-label">
                <strong>AI-Powered Parsing</strong>
                <small>Use Gemini for better command understanding</small>
              </span>
              <input
                type="checkbox"
                checked={settings.aiParsing}
                onChange={(e) => setSettings(s => ({ ...s, aiParsing: e.target.checked }))}
              />
            </label>

            <label className="voice-setting-item">
              <span className="voice-setting-label">
                <strong>Auto-Execute</strong>
                <small>Run commands instantly. Sends and tasks pause 2 seconds for confirmation. Undo navigation within 3 seconds.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.autoExecute}
                onChange={(e) => setSettings(s => ({ ...s, autoExecute: e.target.checked }))}
              />
            </label>

            <label className="voice-setting-item">
              <span className="voice-setting-label">
                <strong>Language</strong>
                <small>Speech recognition language</small>
              </span>
              <select
                value={settings.language}
                onChange={(e) => setSettings(s => ({ ...s, language: e.target.value }))}
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Spanish</option>
                <option value="fr-FR">French</option>
                <option value="de-DE">German</option>
                <option value="it-IT">Italian</option>
                <option value="pt-BR">Portuguese (BR)</option>
                <option value="ja-JP">Japanese</option>
                <option value="zh-CN">Chinese (Simplified)</option>
              </select>
            </label>

          </div>
        )}
      </div>
      </div>
    </div>
  );

  // IMPORTANT: Render in a portal to avoid being clipped by transformed parents (e.g., the sidebar)
  // which can break `position: fixed` in some browsers.
  return typeof document !== 'undefined' ? createPortal(panel, document.body) : panel;
};

export default VoiceCommandPanel;
