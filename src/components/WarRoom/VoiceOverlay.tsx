/**
 * VoiceOverlay — Phase 6: Voice Input Layer
 *
 * Compact bottom bar that floats inside WarRoomLayout.
 * Renders below the 3-panel body when voice mode is active.
 *
 * Flow:
 *   1. User clicks mic button (or presses Space)
 *   2. Browser speech recognition starts
 *   3. Interim transcript shown in real time
 *   4. On final result → onSendMessage(text) is called
 *   5. Manual SEND button for when auto-final doesn't fire
 */

import React, { useState, useEffect, useRef } from 'react';
import { useVoiceToText } from '../../hooks/useVoiceToText';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceOverlayProps {
  onSendMessage: (text: string) => void;
  onClose: () => void;
}

// ─── Animated bars (lightweight — no canvas required) ─────────────────────────

const VoiceBars: React.FC<{ active: boolean; color: string }> = ({ active, color }) => {
  const BAR_COUNT = 20;
  const frameRef  = useRef<number>(0);
  const barsRef   = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!active) {
      barsRef.current.forEach((b) => { if (b) b.style.height = '4px'; });
      return;
    }
    const animate = () => {
      barsRef.current.forEach((b) => {
        if (!b) return;
        const h = 4 + Math.random() * 28;
        b.style.height = `${h}px`;
      });
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 36,
      }}
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          ref={(el) => { if (el) barsRef.current[i] = el; }}
          style={{
            width: 3,
            height: 4,
            borderRadius: 2,
            backgroundColor: color,
            opacity: active ? 0.9 : 0.25,
            transition: active ? 'none' : 'height 0.3s ease',
          }}
        />
      ))}
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const VoiceOverlay: React.FC<VoiceOverlayProps> = ({ onSendMessage, onClose }) => {
  const [pendingText, setPendingText] = useState('');

  const {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    clearTranscript,
  } = useVoiceToText({
    continuous: false,
    enableKeyboardShortcut: true,
    shortcutKey: ' ',
    onFinalResult: (text) => {
      if (text.trim()) {
        onSendMessage(text.trim());
        clearTranscript();
        setPendingText('');
      }
    },
  });

  // Sync transcript → pendingText for manual editing before send
  useEffect(() => {
    if (transcript) setPendingText(transcript);
  }, [transcript]);

  const displayText = interimTranscript || pendingText;

  const handleManualSend = () => {
    if (!pendingText.trim()) return;
    onSendMessage(pendingText.trim());
    clearTranscript();
    setPendingText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleManualSend();
    }
  };

  const micColor = isListening ? '#f43f5e' : 'var(--wr-accent-secondary)';

  return (
    <div
      style={{
        borderTop: '1px solid var(--wr-border)',
        backgroundColor: 'var(--wr-bg-secondary)',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Mic button */}
      <button
        onClick={isListening ? stopListening : startListening}
        disabled={!isSupported}
        title={isSupported ? (isListening ? 'Stop listening (Space)' : 'Start listening (Space)') : 'Speech not supported in this browser'}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: `2px solid ${micColor}`,
          backgroundColor: isListening ? `${micColor}22` : 'transparent',
          color: micColor,
          cursor: isSupported ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all var(--wr-transition-fast)',
          boxShadow: isListening ? `0 0 12px ${micColor}60` : 'none',
        }}
      >
        <i
          className={isListening ? 'fa fa-circle-stop' : 'fa fa-microphone'}
          style={{ fontSize: 16 }}
        />
      </button>

      {/* Visualizer bars */}
      <VoiceBars active={isListening} color={micColor} />

      {/* Transcript / input */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        {displayText ? (
          <textarea
            value={displayText}
            onChange={(e) => setPendingText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: interimTranscript ? 'var(--wr-text-muted)' : 'var(--wr-text-primary)',
              fontFamily: 'var(--wr-font-sans)',
              fontSize: 13,
              lineHeight: 1.5,
              padding: 0,
              fontStyle: interimTranscript ? 'italic' : 'normal',
              overflow: 'hidden',
            }}
          />
        ) : (
          <div
            style={{
              fontFamily: 'var(--wr-font-mono)',
              fontSize: 11,
              color: 'var(--wr-text-muted)',
              userSelect: 'none',
            }}
          >
            {isListening
              ? 'Listening… speak now'
              : isSupported
              ? 'Press mic or Space to start speaking'
              : 'Speech recognition not available'}
          </div>
        )}
      </div>

      {/* Send button — visible only when there's text */}
      {pendingText.trim() && !interimTranscript && (
        <button
          onClick={handleManualSend}
          title="Send (Enter)"
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--wr-radius-sm)',
            border: '1px solid var(--wr-accent-primary)',
            backgroundColor: 'var(--wr-accent-primary)',
            color: 'white',
            fontFamily: 'var(--wr-font-mono)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            cursor: 'pointer',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <i className="fa fa-paper-plane" style={{ fontSize: 11 }} />
          SEND
        </button>
      )}

      {/* Status label */}
      {isListening && (
        <span
          style={{
            fontFamily: 'var(--wr-font-mono)',
            fontSize: 9,
            color: micColor,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            flexShrink: 0,
            animation: 'wr-data-pulse 1.2s ease-in-out infinite',
          }}
        >
          REC
        </span>
      )}

      {/* Close button */}
      <button
        onClick={onClose}
        title="Close voice input"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--wr-text-muted)',
          fontSize: 14,
          padding: '4px 6px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <i className="fa fa-chevron-down" />
      </button>
    </div>
  );
};

export default VoiceOverlay;
