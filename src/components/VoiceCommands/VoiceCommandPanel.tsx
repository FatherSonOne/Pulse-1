/**
 * VoiceCommandPanel Component
 *
 * Full-featured voice command panel with command history,
 * available commands list, and settings.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

type TabType = 'commands' | 'history' | 'templates' | 'settings';

export const VoiceCommandPanel: React.FC<VoiceCommandPanelProps> = ({
  isOpen,
  onClose,
  onNavigate,
  position = 'right',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('commands');
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
    error,
    toggle,
    executeText,
    getCommands,
    getHistory,
    deactivate,
    clear,
  } = voiceCommands;

  const commands = getCommands();
  const history = getHistory();

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isActive) {
          deactivate();
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isActive, deactivate, onClose]);

  // Reset error state when panel opens so stale errors don't persist
  useEffect(() => {
    if (isOpen) {
      clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
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
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

      {/* Voice Status */}
      <div className={`voice-panel-status voice-panel-status-${status}`}>
        <div className="voice-status-indicator">
          {status === 'listening' && (
            <>
              <div className="voice-waveform">
                <div className="voice-waveform-bar" />
                <div className="voice-waveform-bar" />
                <div className="voice-waveform-bar" />
                <div className="voice-waveform-bar" />
                <div className="voice-waveform-bar" />
              </div>
              <span>Listening...</span>
            </>
          )}
          {status === 'processing' && <span>Processing command...</span>}
          {status === 'executing' && <span>Executing...</span>}
          {status === 'idle' && <span>Ready for voice command</span>}
          {status === 'error' && (
            <span className="voice-error">
              {error?.includes('network') || error?.includes('Network')
                ? 'Voice recognition requires an internet connection. Use the text input below instead.'
                : error}
            </span>
          )}
        </div>

        <button
          className={`voice-panel-toggle ${isActive ? 'active' : ''}`}
          onClick={toggle}
        >
          {isActive ? 'Stop' : 'Start Listening'}
        </button>
      </div>

      {/* Transcript */}
      {(interimTranscript || currentTranscript) && (
        <div className="voice-panel-transcript">
          <span className="voice-transcript-label">Heard:</span>
          <span className="voice-transcript-value">
            {interimTranscript || currentTranscript}
          </span>
        </div>
      )}

      {/* Last Result */}
      {lastResult && (
        <div className={`voice-panel-result ${lastResult.success ? 'success' : 'error'}`}>
          {lastResult.message}
        </div>
      )}

      {/* Manual Input */}
      <form className="voice-panel-input" onSubmit={handleSubmitCommand}>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder="Type a command or say it..."
        />
        <button type="submit" disabled={!commandInput.trim()}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>

      {/* Tabs */}
      <div className="voice-panel-tabs">
        {(['commands', 'templates', 'history', 'settings'] as TabType[]).map((tab) => (
          <button
            key={tab}
            className={`voice-panel-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="voice-panel-content">
        {/* Commands Tab */}
        {activeTab === 'commands' && (
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
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="voice-templates-list">
            {Object.entries(VOICE_COMMAND_TEMPLATES).map(([category, items]) => (
              <div key={category} className="voice-template-category">
                <div className="voice-template-category-title">
                  {category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1')}
                </div>
                <div className="voice-template-items">
                  {items.map((item, index) => (
                    <button
                      key={index}
                      className="voice-template-btn"
                      onClick={() => handleTemplateClick(item.command)}
                    >
                      <span className="voice-template-label">{item.label}</span>
                      <span className="voice-template-command">{item.command}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="voice-history-list">
            {history.length === 0 ? (
              <div className="voice-history-empty">
                No command history yet. Try saying a command!
              </div>
            ) : (
              history.map((cmd, index) => (
                <div key={index} className="voice-history-item">
                  <div className="voice-history-transcript">
                    "{cmd.rawTranscript}"
                  </div>
                  <div className="voice-history-details">
                    <span className={`voice-history-type voice-type-${cmd.type}`}>
                      {cmd.type.replace(/_/g, ' ')}
                    </span>
                    <span className="voice-history-confidence">
                      {Math.round(cmd.confidence * 100)}% confidence
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
                <small>Execute commands without confirmation</small>
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

            {!isSupported && (
              <div className="voice-setting-warning">
                Voice commands are not supported in this browser.
                Try using Chrome or Edge for the best experience.
              </div>
            )}
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
