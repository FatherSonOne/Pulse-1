/**
 * Voice Agent Integration Component
 *
 * Main integration wrapper for adding voice agents to the War Room.
 * Provides a self-contained, ready-to-use voice agent experience.
 *
 * Features:
 * - Automatic API key handling from environment or localStorage
 * - Ephemeral token generation
 * - Session management
 * - Multiple display modes (floating, embedded, fullscreen)
 * - Keyboard shortcuts
 * - Mobile responsive
 */

import React, { useState, useCallback, useEffect } from 'react';
import { VoiceAgentPanel } from './VoiceAgentPanel';
import toast from 'react-hot-toast';

interface VoiceAgentIntegrationProps {
  // User context
  userId: string;
  projectId?: string;
  sessionId?: string;

  // API configuration
  apiKey?: string;  // OpenAI API key, falls back to env/localStorage

  // Display options
  mode?: 'floating' | 'embedded' | 'fullscreen';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  defaultExpanded?: boolean;

  // Callbacks
  onReady?: () => void;
  onError?: (error: Error) => void;
  onClose?: () => void;

  // Styling
  className?: string;
}

export const VoiceAgentIntegration: React.FC<VoiceAgentIntegrationProps> = ({
  userId,
  projectId,
  sessionId,
  apiKey,
  mode = 'floating',
  position = 'bottom-right',
  defaultExpanded = false,
  onReady,
  onError,
  onClose,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(mode !== 'floating' || defaultExpanded);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [resolvedApiKey, setResolvedApiKey] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve API key from props, environment, or localStorage
  useEffect(() => {
    const resolveApiKey = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Priority: props > env > localStorage
        const key = apiKey
          || import.meta.env.VITE_OPENAI_API_KEY
          || localStorage.getItem('openai_api_key')
          || '';

        if (!key) {
          const errorMsg = 'OpenAI API key not found. Please configure VITE_OPENAI_API_KEY or set it in settings.';
          setError(errorMsg);
          onError?.(new Error(errorMsg));
          return;
        }

        setResolvedApiKey(key);
        onReady?.();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to resolve API key';
        setError(errorMsg);
        onError?.(new Error(errorMsg));
      } finally {
        setIsLoading(false);
      }
    };

    resolveApiKey();
  }, [apiKey, onReady, onError]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+V to toggle voice panel
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }

      // Escape to close (only if floating and visible)
      if (e.key === 'Escape' && mode === 'floating' && isVisible) {
        setIsVisible(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, isVisible]);

  // Toggle visibility
  const handleToggle = useCallback(() => {
    setIsVisible(prev => !prev);
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    setIsVisible(false);
    onClose?.();
  }, [onClose]);

  // Toggle expanded
  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Position classes for floating mode
  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-right':
        return 'top-20 right-4';
      case 'top-left':
        return 'top-20 left-4';
      default:
        return 'bottom-4 right-4';
    }
  };

  // Render error state
  if (error) {
    return (
      <div className={`voice-agent-error p-4 ${className}`}>
        <div className="flex items-center gap-3 text-red-500 dark:text-red-400">
          <i className="fa fa-exclamation-triangle text-xl" />
          <div>
            <p className="font-medium">Voice Agent Unavailable</p>
            <p className="text-sm opacity-75">{error}</p>
          </div>
        </div>
        <button
          onClick={() => window.location.href = '/settings'}
          className="mt-3 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors text-sm"
        >
          Configure in Settings
        </button>
      </div>
    );
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className={`voice-agent-loading p-4 flex items-center gap-3 ${className}`}>
        <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        <span className="text-gray-500">Loading Voice Agent...</span>
      </div>
    );
  }

  // Floating mode - render toggle button + panel
  if (mode === 'floating') {
    return (
      <>
        {/* Floating Toggle Button */}
        {!isVisible && (
          <button
            onClick={handleToggle}
            className={`fixed ${getPositionClasses()} z-50 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group`}
            title="Open Voice Agent (Ctrl+Shift+V)"
          >
            <i className="fa fa-microphone text-xl group-hover:scale-110 transition-transform" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          </button>
        )}

        {/* Floating Panel */}
        {isVisible && (
          <div
            className={`fixed ${getPositionClasses()} z-50 ${
              isExpanded ? 'inset-4' : 'w-96 max-h-[80vh]'
            } transition-all duration-300`}
          >
            <VoiceAgentPanel
              userId={userId}
              projectId={projectId}
              sessionId={sessionId}
              openaiApiKey={resolvedApiKey}
              onClose={handleClose}
              isExpanded={isExpanded}
              onToggleExpand={handleToggleExpand}
              className="h-full"
            />
          </div>
        )}
      </>
    );
  }

  // Embedded mode - render panel inline
  if (mode === 'embedded') {
    return (
      <div className={`voice-agent-embedded ${className}`}>
        <VoiceAgentPanel
          userId={userId}
          projectId={projectId}
          sessionId={sessionId}
          openaiApiKey={resolvedApiKey}
          onClose={onClose}
          isExpanded={isExpanded}
          onToggleExpand={handleToggleExpand}
        />
      </div>
    );
  }

  // Fullscreen mode - render fullscreen overlay
  if (mode === 'fullscreen') {
    return (
      <div className={`fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-xl ${className}`}>
        <VoiceAgentPanel
          userId={userId}
          projectId={projectId}
          sessionId={sessionId}
          openaiApiKey={resolvedApiKey}
          onClose={onClose}
          isExpanded={true}
          className="h-full"
        />
      </div>
    );
  }

  return null;
};

// Export a hook for programmatic control
export function useVoiceAgent() {
  const [isVisible, setIsVisible] = useState(false);

  const show = useCallback(() => setIsVisible(true), []);
  const hide = useCallback(() => setIsVisible(false), []);
  const toggle = useCallback(() => setIsVisible(prev => !prev), []);

  return {
    isVisible,
    show,
    hide,
    toggle,
  };
}

// Export a simpler version for quick integration
export const VoiceAgentButton: React.FC<{
  userId: string;
  projectId?: string;
  sessionId?: string;
  apiKey?: string;
}> = (props) => {
  const [showPanel, setShowPanel] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowPanel(true)}
        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
      >
        <i className="fa fa-microphone" />
        <span>Voice Agent</span>
      </button>

      {showPanel && (
        <VoiceAgentIntegration
          {...props}
          mode="floating"
          defaultExpanded={true}
          onClose={() => setShowPanel(false)}
        />
      )}
    </>
  );
};

export default VoiceAgentIntegration;
