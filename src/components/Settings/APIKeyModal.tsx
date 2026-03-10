import React, { useState, useEffect } from 'react';
import { Key, X, CheckCircle, AlertCircle, Eye, EyeOff, ExternalLink } from 'lucide-react';
import './APIKeyModal.css';

export interface APIKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (apiKey: string) => void;
}

export const APIKeyModal: React.FC<APIKeyModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing API key on mount
  useEffect(() => {
    if (isOpen) {
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) {
        setApiKey(savedKey);
        setIsSaved(true);
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    // Basic validation
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    // Validate format (Gemini API keys typically start with "AI" and are alphanumeric)
    if (!apiKey.match(/^[A-Za-z0-9_-]{30,}$/)) {
      setError('Invalid API key format. Please check your key and try again.');
      return;
    }

    // Save to localStorage
    try {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      setIsSaved(true);
      setError(null);

      // Call onSave callback if provided
      if (onSave) {
        onSave(apiKey.trim());
      }

      // Close modal after brief success message
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError('Failed to save API key. Please try again.');
    }
  };

  const handleClear = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setIsSaved(false);
    setError(null);
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="api-key-modal-overlay" onClick={handleClose}>
      <div className="api-key-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="api-key-modal-header">
          <div className="api-key-modal-header-left">
            <div className="api-key-icon">
              <Key size={24} />
            </div>
            <div>
              <h2>Configure API Key</h2>
              <p>Securely store your Gemini API key for AI features</p>
            </div>
          </div>
          <button
            className="api-key-close-button"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="api-key-modal-content">
          {/* Info Section */}
          <div className="api-key-info">
            <h3>Why do I need an API key?</h3>
            <p>
              Pulse uses Google's Gemini AI to power intelligent features like task prioritization,
              decision analysis, and conversational assistance. Your API key enables these features.
            </p>

            <div className="api-key-steps">
              <h4>How to get your API key:</h4>
              <ol>
                <li>
                  Visit{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="api-key-link"
                  >
                    Google AI Studio <ExternalLink size={14} />
                  </a>
                </li>
                <li>Sign in with your Google account</li>
                <li>Click "Create API Key"</li>
                <li>Copy your API key and paste it below</li>
              </ol>
            </div>

            <div className="api-key-security">
              <AlertCircle size={16} />
              <p>
                Your API key is stored securely in your browser's local storage and is never sent
                to our servers. It's only used to make direct requests to Google's Gemini API.
              </p>
            </div>
          </div>

          {/* Input Section */}
          <div className="api-key-input-section">
            <label htmlFor="api-key-input" className="api-key-label">
              API Key
            </label>
            <div className="api-key-input-wrapper">
              <input
                id="api-key-input"
                type={showApiKey ? 'text' : 'password'}
                className="api-key-input"
                placeholder="Enter your Gemini API key..."
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError(null);
                  setIsSaved(false);
                }}
                autoComplete="off"
              />
              <button
                className="api-key-toggle-visibility"
                onClick={() => setShowApiKey(!showApiKey)}
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                type="button"
              >
                {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <div className="api-key-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {isSaved && !error && (
              <div className="api-key-success">
                <CheckCircle size={16} />
                <span>API key saved successfully!</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="api-key-modal-footer">
          <button className="api-key-button secondary" onClick={handleClear}>
            Clear Key
          </button>
          <div className="api-key-footer-actions">
            <button className="api-key-button tertiary" onClick={handleClose}>
              Cancel
            </button>
            <button className="api-key-button primary" onClick={handleSave}>
              <Key size={16} />
              Save API Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
