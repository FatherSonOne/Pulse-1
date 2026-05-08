/**
 * SessionsCanvas — the hero of Pulse Chat.
 *
 * Three states:
 *   1. Idle, no recent       → example prompts + keyboard primer
 *   2. Idle, has recent      → recent-sessions grid (live notes, takeaways)
 *   3. Connected (live)      → live session card hero + (recent below)
 *
 * Captures (notes), AI takeaways, and follow-ups are the canvas — the
 * voice itself is now a side-rail breathing transcript, not the hero.
 */

import React from 'react';
import { Trash2, Sparkles, MessageSquareQuote, Inbox } from 'lucide-react';
import {
  formatDuration,
  formatRelative,
  type VoiceSessionRecord,
} from './voiceSessionStore';

export interface LiveCapture {
  id: string;
  content: string;
  type: 'auto' | 'manual' | 'highlight';
  speaker?: 'user' | 'assistant';
}

export interface LiveSessionView {
  startedAt: number;
  durationSec: number;
  captures: LiveCapture[];
  takeawayDraft?: string;
  currentTranscript?: string;
}

interface SessionsCanvasProps {
  isConnected: boolean;
  isConnecting: boolean;
  liveSession?: LiveSessionView;
  recentSessions: VoiceSessionRecord[];
  examplePrompts: string[];
  onConnect: () => void;
  onPromptSelect: (prompt: string) => void;
  onSessionView?: (session: VoiceSessionRecord) => void;
  onSessionDelete?: (id: string) => void;
}

const SessionsCanvas: React.FC<SessionsCanvasProps> = ({
  isConnected,
  isConnecting,
  liveSession,
  recentSessions,
  examplePrompts,
  onConnect,
  onPromptSelect,
  onSessionView,
  onSessionDelete,
}) => {
  const showExamples = !isConnected && recentSessions.length === 0 && !liveSession;

  return (
    <div className="pvc-canvas-scroll">
      {/* LIVE SESSION HERO */}
      {liveSession && (
        <article className="pvc-live-card" aria-label="Active voice session">
          <header className="pvc-live-card-head">
            <span className="pvc-live-pill">
              <span className="pvc-live-pill-dot" aria-hidden="true" />
              LIVE
            </span>
            <span className="pvc-live-meta">
              {formatDuration(liveSession.durationSec)}
              <span className="pvc-live-meta-sep" aria-hidden="true">·</span>
              {liveSession.captures.length} CAPTURED
            </span>
          </header>

          <div className="pvc-live-card-body">
            {liveSession.takeawayDraft ? (
              <div className="pvc-takeaway">
                <span className="pvc-takeaway-tag">PULSE AI · TAKEAWAY</span>
                <p className="pvc-takeaway-text">{liveSession.takeawayDraft}</p>
              </div>
            ) : (
              <div className="pvc-takeaway pvc-takeaway--empty">
                <span className="pvc-takeaway-tag">PULSE AI · LISTENING</span>
                <p className="pvc-takeaway-text">
                  Takeaways assemble here as you speak. Press <kbd>N</kbd> to capture a thought.
                </p>
              </div>
            )}

            {liveSession.captures.length > 0 ? (
              <ul className="pvc-capture-list">
                {liveSession.captures.slice(-6).map((c) => (
                  <li key={c.id} className={`pvc-capture pvc-capture--${c.type}`}>
                    <span className="pvc-capture-tag">
                      {c.type === 'auto' ? 'AUTO' : c.type === 'highlight' ? 'PIN' : 'NOTE'}
                    </span>
                    <span className="pvc-capture-text">{c.content}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pvc-capture-empty">No captures yet. Speak naturally; Pulse pins what matters.</p>
            )}
          </div>
        </article>
      )}

      {/* RECENT SESSIONS */}
      {recentSessions.length > 0 && (
        <section className="pvc-recent" aria-label="Recent sessions">
          <header className="pvc-recent-head">
            <span className="pvc-recent-label">RECENT</span>
            <span className="pvc-recent-count">{recentSessions.length}</span>
          </header>

          <ul className="pvc-recent-grid">
            {recentSessions.slice(0, 6).map((s) => (
              <li key={s.id} className="pvc-recent-card">
                <header className="pvc-recent-card-head">
                  <span className="pvc-recent-card-time">{formatRelative(s.endedAt)}</span>
                  <span className="pvc-recent-card-meta">
                    {formatDuration(s.durationSec)}
                    <span className="pvc-recent-card-meta-sep" aria-hidden="true">·</span>
                    {s.captureCount} pinned
                  </span>
                </header>

                {s.takeaway ? (
                  <p className="pvc-recent-card-takeaway">{s.takeaway}</p>
                ) : (
                  <p className="pvc-recent-card-takeaway pvc-recent-card-takeaway--empty">
                    No takeaway captured.
                  </p>
                )}

                {s.lastLine && (
                  <p className="pvc-recent-card-snippet">"{s.lastLine}"</p>
                )}

                <footer className="pvc-recent-card-foot">
                  <button
                    type="button"
                    className="pvc-recent-card-btn"
                    onClick={() => onSessionView?.(s)}
                  >
                    <MessageSquareQuote size={13} />
                    Open notes
                  </button>
                  <button
                    type="button"
                    className="pvc-recent-card-btn pvc-recent-card-btn--danger"
                    onClick={() => onSessionDelete?.(s.id)}
                    aria-label="Delete session"
                    title="Delete session"
                  >
                    <Trash2 size={13} />
                  </button>
                </footer>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* EMPTY HERO: example prompts */}
      {showExamples && (
        <section className="pvc-empty" aria-label="Get started">
          <h2 className="pvc-empty-title">Start by asking.</h2>
          <p className="pvc-empty-sub">
            Pulse listens, pins what matters, and leaves the takeaway here when you hang up.
            Pick a prompt or press <kbd>Space</kbd> and speak.
          </p>

          <ul className="pvc-prompt-grid">
            {examplePrompts.map((prompt) => (
              <li key={prompt}>
                <button
                  type="button"
                  className="pvc-prompt"
                  onClick={() => onPromptSelect(prompt)}
                  disabled={isConnecting}
                >
                  <Sparkles size={14} aria-hidden="true" />
                  <span>{prompt}</span>
                </button>
              </li>
            ))}
          </ul>

          <p className="pvc-empty-meta" aria-label="Voice session details">
            <span>LIVE VOICE</span>
            <span aria-hidden="true">·</span>
            <span>GPT-4O REALTIME</span>
            <span aria-hidden="true">·</span>
            <span>AUDIO NOT STORED</span>
          </p>
        </section>
      )}

      {/* Live + no recent + no captures yet → reassurance below the live card */}
      {isConnected && !liveSession && (
        <div className="pvc-canvas-fallback" role="status">
          <Inbox size={20} />
          <p>Connecting captures.</p>
        </div>
      )}
    </div>
  );
};

export default SessionsCanvas;
