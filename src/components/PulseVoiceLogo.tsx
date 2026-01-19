/**
 * PulseVoiceLogo Component
 *
 * Interactive Pulse logo that activates voice commands.
 * Features pulse and vibrate animations to entice user interaction.
 * Supports keyboard shortcut (Ctrl+Shift+V) and wake word detection.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceCommandModal } from './VoiceCommands/VoiceCommandModal';
import { VoiceCommandPanel } from './VoiceCommands/VoiceCommandPanel';

interface PulseVoiceLogoProps {
  onNavigate?: (view: string) => void;
  userId?: string;
  collapsed?: boolean;
  onLogoClick?: () => void;
  variant?: 'modal' | 'panel';
}

// Wake word detection configuration
const WAKE_WORDS = ['hey pulse', 'ok pulse', 'pulse'];
const WAKE_WORD_CONFIDENCE = 0.7;

export const PulseVoiceLogo: React.FC<PulseVoiceLogoProps> = ({
  onNavigate,
  userId,
  collapsed = false,
  onLogoClick,
  variant = 'panel',
}) => {
  const [showVoiceUI, setShowVoiceUI] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [wakeWordActive, setWakeWordActive] = useState(false);
  const [wakeWordListening, setWakeWordListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const wakeWordTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get OpenAI API key from localStorage
  const openaiApiKey = localStorage.getItem('openai_api_key') || '';

  // Keyboard shortcut handler (Ctrl+Shift+V or Cmd+Shift+V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setShowVoiceUI(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Wake word detection using Web Speech API
  const startWakeWordDetection = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.log('Wake word detection not supported');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const results = Array.from(event.results);
      const transcript = results
        .map((result: any) => result[0].transcript.toLowerCase().trim())
        .join(' ');

      // Check for wake words
      for (const wakeWord of WAKE_WORDS) {
        if (transcript.includes(wakeWord)) {
          // Wake word detected!
          setWakeWordActive(true);
          recognition.stop();

          // Clear any existing timeout
          if (wakeWordTimeoutRef.current) {
            clearTimeout(wakeWordTimeoutRef.current);
          }

          // Show visual feedback briefly, then open modal
          wakeWordTimeoutRef.current = setTimeout(() => {
            setWakeWordActive(false);
            setShowModal(true);
          }, 500);

          return;
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.log('Wake word recognition error:', event.error);
      }
    };

    recognition.onend = () => {
      // Restart wake word detection if still enabled and modal not open
      if (wakeWordListening && !showModal) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            // Already started or other error
          }
        }, 100);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.log('Could not start wake word detection');
    }
  }, [wakeWordListening, showVoiceUI]);

  // Toggle wake word detection
  const toggleWakeWord = useCallback(() => {
    if (wakeWordListening) {
      setWakeWordListening(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    } else {
      setWakeWordListening(true);
    }
  }, [wakeWordListening]);

  // Start/stop wake word detection based on state
  useEffect(() => {
    if (wakeWordListening && !showVoiceUI) {
      startWakeWordDetection();
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (wakeWordTimeoutRef.current) {
        clearTimeout(wakeWordTimeoutRef.current);
      }
    };
  }, [wakeWordListening, showVoiceUI, startWakeWordDetection]);

  // Stop wake word detection when modal opens
  useEffect(() => {
    if (showVoiceUI && recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, [showVoiceUI]);

  const handleLogoClick = () => {
    setShowVoiceUI(true);
  };

  const handleLogoRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Right-click navigates to dashboard (original behavior)
    onLogoClick?.();
  };

  return (
    <>
      <div
        className={`pulse-voice-logo-container ${collapsed ? 'collapsed' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Main logo button */}
        <button
          className={`pulse-voice-logo ${isHovered ? 'hovered' : ''} ${wakeWordActive ? 'wake-word-active' : ''} ${wakeWordListening ? 'listening' : ''}`}
          onClick={handleLogoClick}
          onContextMenu={handleLogoRightClick}
          title="Click for voice commands (Ctrl+Shift+V)"
          aria-label="Activate voice commands"
        >
          {/* Animated rings */}
          <div className="pulse-rings">
            <div className="pulse-ring pulse-ring-1"></div>
            <div className="pulse-ring pulse-ring-2"></div>
            <div className="pulse-ring pulse-ring-3"></div>
          </div>

          {/* Logo SVG */}
          <div className="pulse-logo-inner">
            <svg viewBox="0 0 64 64" className="pulse-logo-svg">
              <defs>
                <linearGradient id="pulse-grad-voice" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f43f5e"/>
                  <stop offset="100%" stopColor="#ec4899"/>
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <path
                d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32"
                stroke="url(#pulse-grad-voice)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                filter="url(#glow)"
                className="pulse-path"
              />
            </svg>
          </div>

          {/* Microphone indicator */}
          <div className="pulse-mic-indicator">
            <i className="fa fa-microphone"></i>
          </div>
        </button>

        {/* Brand text */}
        {!collapsed && (
          <div className="pulse-brand-text">
            <span className="pulse-brand-name">Pulse</span>
            <span className="pulse-voice-hint">
              {wakeWordListening ? (
                <span className="wake-word-status">
                  <span className="wake-dot"></span>
                  Say "Hey Pulse"
                </span>
              ) : (
                'Voice Ready'
              )}
            </span>
          </div>
        )}

        {/* Wake word toggle (only visible when expanded) */}
        {!collapsed && (
          <button
            className={`wake-word-toggle ${wakeWordListening ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleWakeWord();
            }}
            title={wakeWordListening ? 'Disable wake word' : 'Enable "Hey Pulse" wake word'}
          >
            <i className={`fa ${wakeWordListening ? 'fa-ear-listen' : 'fa-ear-deaf'}`}></i>
          </button>
        )}
      </div>

      {/* Voice Commands UI */}
      {variant === 'modal' ? (
        <VoiceCommandModal
          isOpen={showVoiceUI}
          onClose={() => setShowVoiceUI(false)}
          onNavigate={onNavigate}
          openaiApiKey={openaiApiKey}
          userId={userId}
        />
      ) : (
        <VoiceCommandPanel
          isOpen={showVoiceUI}
          onClose={() => setShowVoiceUI(false)}
          onNavigate={onNavigate}
          position="left"
        />
      )}

      <style>{`
        .pulse-voice-logo-container {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          position: relative;
        }

        .pulse-voice-logo-container.collapsed {
          justify-content: center;
          width: 100%;
        }

        .pulse-voice-logo {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow:
            0 4px 15px rgba(244, 63, 94, 0.2),
            0 0 0 0 rgba(244, 63, 94, 0);
          animation: pulse-entice 3s ease-in-out infinite;
          flex-shrink: 0;
        }

        .pulse-voice-logo:hover {
          transform: scale(1.08);
          box-shadow:
            0 6px 25px rgba(244, 63, 94, 0.35),
            0 0 20px rgba(244, 63, 94, 0.2);
        }

        .pulse-voice-logo.hovered {
          animation: pulse-vibrate 0.3s ease-in-out infinite;
        }

        .pulse-voice-logo.wake-word-active {
          animation: pulse-activated 0.5s ease-out;
          box-shadow:
            0 0 30px rgba(244, 63, 94, 0.6),
            0 0 60px rgba(236, 72, 153, 0.4);
        }

        .pulse-voice-logo.listening {
          box-shadow:
            0 4px 15px rgba(34, 197, 94, 0.3),
            0 0 0 0 rgba(34, 197, 94, 0);
        }

        /* Animated pulse rings */
        .pulse-rings {
          position: absolute;
          inset: -8px;
          pointer-events: none;
        }

        .pulse-ring {
          position: absolute;
          inset: 0;
          border-radius: 18px;
          border: 2px solid rgba(244, 63, 94, 0.3);
          opacity: 0;
        }

        .pulse-voice-logo:hover .pulse-ring,
        .pulse-voice-logo.hovered .pulse-ring {
          animation: ring-pulse 1.5s ease-out infinite;
        }

        .pulse-ring-1 { animation-delay: 0s; }
        .pulse-ring-2 { animation-delay: 0.5s; }
        .pulse-ring-3 { animation-delay: 1s; }

        /* Logo inner */
        .pulse-logo-inner {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pulse-logo-svg {
          width: 100%;
          height: 100%;
        }

        .pulse-path {
          transition: all 0.3s ease;
        }

        .pulse-voice-logo:hover .pulse-path {
          filter: url(#glow) drop-shadow(0 0 4px rgba(244, 63, 94, 0.5));
        }

        /* Microphone indicator */
        .pulse-mic-indicator {
          position: absolute;
          bottom: -4px;
          right: -4px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f43f5e, #ec4899);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          color: white;
          box-shadow: 0 2px 8px rgba(244, 63, 94, 0.4);
          opacity: 0;
          transform: scale(0.8);
          transition: all 0.3s ease;
        }

        .pulse-voice-logo:hover .pulse-mic-indicator,
        .pulse-voice-logo.hovered .pulse-mic-indicator {
          opacity: 1;
          transform: scale(1);
        }

        /* Brand text */
        .pulse-brand-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .pulse-brand-name {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #f43f5e, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          transition: opacity 0.2s ease;
        }

        .pulse-voice-logo-container:hover .pulse-brand-name {
          opacity: 0.85;
        }

        .pulse-voice-hint {
          font-size: 10px;
          color: #71717a;
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .wake-word-status {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #22c55e;
        }

        .wake-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          animation: wake-dot-pulse 1.5s ease-in-out infinite;
        }

        /* Wake word toggle button */
        .wake-word-toggle {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 1px solid #27272a;
          background: #18181b;
          color: #71717a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s ease;
          opacity: 0;
        }

        .pulse-voice-logo-container:hover .wake-word-toggle {
          opacity: 1;
        }

        .wake-word-toggle:hover {
          background: #27272a;
          color: #a1a1aa;
          border-color: #3f3f46;
        }

        .wake-word-toggle.active {
          background: rgba(34, 197, 94, 0.15);
          border-color: rgba(34, 197, 94, 0.3);
          color: #22c55e;
          opacity: 1;
        }

        /* Animations */
        @keyframes pulse-entice {
          0%, 100% {
            box-shadow:
              0 4px 15px rgba(244, 63, 94, 0.2),
              0 0 0 0 rgba(244, 63, 94, 0);
          }
          50% {
            box-shadow:
              0 4px 20px rgba(244, 63, 94, 0.3),
              0 0 0 8px rgba(244, 63, 94, 0.05);
          }
        }

        @keyframes pulse-vibrate {
          0%, 100% { transform: scale(1.08) rotate(0deg); }
          25% { transform: scale(1.08) rotate(-1deg) translateX(-1px); }
          50% { transform: scale(1.08) rotate(0deg); }
          75% { transform: scale(1.08) rotate(1deg) translateX(1px); }
        }

        @keyframes pulse-activated {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1.08); }
        }

        @keyframes ring-pulse {
          0% {
            transform: scale(0.95);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }

        @keyframes wake-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        /* Dark mode adjustments */
        .dark .pulse-voice-logo {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        }

        .dark .pulse-voice-hint {
          color: #52525b;
        }

        /* Collapsed state adjustments */
        .pulse-voice-logo-container.collapsed .pulse-voice-logo {
          width: 40px;
          height: 40px;
          border-radius: 12px;
        }

        .pulse-voice-logo-container.collapsed .pulse-logo-inner {
          width: 28px;
          height: 28px;
        }

        .pulse-voice-logo-container.collapsed .pulse-mic-indicator {
          width: 16px;
          height: 16px;
          font-size: 8px;
          bottom: -3px;
          right: -3px;
        }
      `}</style>
    </>
  );
};

export default PulseVoiceLogo;
