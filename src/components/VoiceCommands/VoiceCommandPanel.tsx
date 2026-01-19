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
  const [settings, setSettings] = useState({
    spokenFeedback: false,
    aiParsing: true,
    autoExecute: true,
    language: 'en-US',
  });

  const voiceCommands = useVoiceCommands({
    enableSpokenFeedback: settings.spokenFeedback,
    enableAIParsing: settings.aiParsing,
    autoExecute: settings.autoExecute,
    language: settings.language,
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

  // Auto-start listening when panel opens (no extra click)
  useEffect(() => {
    if (!isOpen) return;
    if (!isSupported) return;
    if (isActive) return;
    toggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSupported]);

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
          {status === 'error' && <span className="voice-error">{error}</span>}
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

// Panel-specific styles
const panelStyles = `
.voice-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  /* Light dim + ensures click outside closes */
  background: rgba(0, 0, 0, 0.25);
}

.voice-panel {
  position: fixed;
  top: 0;
  bottom: 0;
  width: min(400px, 100vw);
  background: #111827;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 9999;
  /* Stabilize compositing to prevent hover-induced flicker/jitter */
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  will-change: transform;
  /* Avoid transform animations entirely (common flicker source on some GPUs) */
  animation: fadeIn 0.12s ease-out both;
}

.voice-panel-right { right: 0; }
.voice-panel-left { left: 0; border-left: none; border-right: 1px solid rgba(255, 255, 255, 0.1); }
.voice-panel-center {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  bottom: auto;
  height: 80vh;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.voice-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.voice-panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #f3f4f6;
}

.voice-panel-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  outline: none;
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  will-change: background-color, color;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.voice-panel-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.voice-panel-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(99, 102, 241, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.voice-panel-status-listening {
  background: rgba(16, 185, 129, 0.15);
}

.voice-panel-status-processing {
  background: rgba(245, 158, 11, 0.15);
}

.voice-panel-status-error {
  background: rgba(239, 68, 68, 0.15);
}

.voice-status-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #e5e7eb;
}

.voice-error {
  color: #ef4444;
}

.voice-panel-toggle {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.voice-panel-toggle:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.voice-panel-toggle.active {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.voice-panel-transcript {
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 14px;
}

.voice-transcript-label {
  color: #9ca3af;
  margin-right: 8px;
}

.voice-transcript-value {
  color: #f3f4f6;
}

.voice-panel-result {
  padding: 12px 20px;
  font-size: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.voice-panel-result.success {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.voice-panel-result.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.voice-panel-input {
  display: flex;
  padding: 16px 20px;
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.voice-panel-input input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  color: #f3f4f6;
  font-size: 14px;
}

.voice-panel-input input:focus {
  outline: none;
  border-color: #6366f1;
}

.voice-panel-input button {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: none;
  background: #6366f1;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.voice-panel-input button:hover:not(:disabled) {
  background: #7c3aed;
}

.voice-panel-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.voice-panel-tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.voice-panel-tab {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.voice-panel-tab:hover {
  color: #e5e7eb;
  background: rgba(255, 255, 255, 0.03);
}

.voice-panel-tab.active {
  color: #a78bfa;
  border-bottom-color: #a78bfa;
}

.voice-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

/* Commands List */
.voice-commands-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.voice-command-item {
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.voice-command-type {
  font-size: 13px;
  font-weight: 600;
  color: #a78bfa;
  text-transform: capitalize;
  margin-bottom: 4px;
}

.voice-command-description {
  font-size: 14px;
  color: #e5e7eb;
  margin-bottom: 10px;
}

.voice-command-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.voice-example-btn {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.voice-example-btn:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.4);
  color: white;
}

/* Templates */
.voice-templates-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.voice-template-category-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #6b7280;
  margin-bottom: 10px;
}

.voice-template-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.voice-template-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.voice-template-btn:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
}

.voice-template-label {
  font-size: 14px;
  font-weight: 500;
  color: #e5e7eb;
}

.voice-template-command {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
}

/* History */
.voice-history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.voice-history-empty {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
  font-size: 14px;
}

.voice-history-item {
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.voice-history-transcript {
  font-size: 14px;
  color: #e5e7eb;
  font-style: italic;
  margin-bottom: 8px;
}

.voice-history-details {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.voice-history-type {
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(167, 139, 250, 0.2);
  color: #a78bfa;
  text-transform: capitalize;
}

.voice-history-confidence {
  color: #6b7280;
}

.voice-history-action {
  margin-top: 8px;
  font-size: 13px;
  color: #9ca3af;
}

.voice-history-clear {
  margin-top: 16px;
  padding: 10px;
  width: 100%;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: transparent;
  color: #ef4444;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.voice-history-clear:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Settings */
.voice-settings-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.voice-setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.voice-setting-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.voice-setting-label {
  display: flex;
  flex-direction: column;
}

.voice-setting-label strong {
  font-size: 14px;
  color: #e5e7eb;
}

.voice-setting-label small {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.voice-setting-item input[type="checkbox"] {
  width: 20px;
  height: 20px;
  accent-color: #6366f1;
}

.voice-setting-item select {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  color: #e5e7eb;
  font-size: 13px;
}

.voice-setting-warning {
  padding: 12px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  color: #f59e0b;
  font-size: 13px;
}

@media (max-width: 768px) {
  .voice-panel {
    width: 100%;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'voice-panel-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = panelStyles;
    document.head.appendChild(style);
  }
}

export default VoiceCommandPanel;
