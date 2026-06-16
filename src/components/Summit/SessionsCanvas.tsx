/**
 * SessionsCanvas — the hero of Summit.
 *
 * Three states:
 *   1. Idle, no recent       → example prompts + keyboard primer
 *   2. Idle, has recent      → recent-sessions grid (live notes, takeaways)
 *   3. Connected (live)      → live session card hero + (recent below)
 *
 * Captures (notes), AI takeaways, and follow-ups are the canvas — the
 * voice itself is now a side-rail breathing transcript, not the hero.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Trash2,
  Sparkles,
  MessageSquareQuote,
  Inbox,
  MoreHorizontal,
  Download,
  BookOpen,
  Mail,
} from 'lucide-react';
import {
  formatDuration,
  formatRelative,
  type VoiceSessionRecord,
} from './voiceSessionStore';

/** Display label for the live model. The Summit realtime stack runs OpenAI's
 *  `gpt-realtime` (see realtimeAgentService connect()), NOT GPT-4o — keep this
 *  the single source so the masthead, rail, and empty-hero never drift apart. */
export const REALTIME_MODEL_LABEL = 'GPT-REALTIME';

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

export type SessionExportTarget = 'markdown' | 'warRoom' | 'email';

/** Monthly Summit-minutes meter shown in the live session header. */
export interface SummitMeterView {
  /** True when this session is using a personal OpenAI key (no cap). */
  isByoSession: boolean;
  /** Minutes consumed in the current calendar month (hosted mode only). */
  usedMinutes: number;
  /** Plan allowance in minutes/month (hosted mode only). 0 = no plan cap. */
  capMinutes: number;
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
  /** Re-export a past session to a chosen target. Implemented by Summit.tsx. */
  onSessionExport?: (session: VoiceSessionRecord, target: SessionExportTarget) => void;
  /** Optional usage meter — rendered in the live-session header. */
  summitMeter?: SummitMeterView;
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
  onSessionExport,
  summitMeter,
}) => {
  // Live meter text. BYO shows mode only; hosted shows used/cap with live
  // ticks during the session by adding the current session's duration on
  // top of the persisted monthly total.
  const renderMeter = (live?: LiveSessionView): React.ReactNode => {
    if (!summitMeter) return null;
    if (summitMeter.isByoSession) {
      return <span className="pvc-summit-meter">YOUR OPENAI KEY</span>;
    }
    if (summitMeter.capMinutes <= 0) return null;
    const liveMin = live ? Math.ceil(live.durationSec / 60) : 0;
    const effectiveUsed = Math.min(summitMeter.capMinutes, summitMeter.usedMinutes + liveMin);
    const remaining = Math.max(0, summitMeter.capMinutes - effectiveUsed);
    const ratio = effectiveUsed / summitMeter.capMinutes;
    const cls =
      ratio >= 1 ? 'pvc-summit-meter pvc-summit-meter--over'
      : ratio >= 0.8 ? 'pvc-summit-meter pvc-summit-meter--warn'
      : 'pvc-summit-meter';
    return (
      <span className={cls}>
        {effectiveUsed} / {summitMeter.capMinutes} MIN
        {remaining > 0 && remaining <= 10 ? ` · ${remaining} LEFT` : ''}
      </span>
    );
  };

  const showExamples = !isConnected && recentSessions.length === 0 && !liveSession;
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the export menu on outside-click or Escape. Only mounted while a
  // menu is open so we're not running listeners idly.
  useEffect(() => {
    if (!openMenuId) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenuId]);

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
              {renderMeter(liveSession) && (
                <>
                  <span className="pvc-live-meta-sep" aria-hidden="true">·</span>
                  {renderMeter(liveSession)}
                </>
              )}
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
                  {onSessionExport && (
                    <div
                      className="pvc-recent-card-menu-wrap"
                      ref={openMenuId === s.id ? menuRef : undefined}
                    >
                      <button
                        type="button"
                        className="pvc-recent-card-btn"
                        onClick={() =>
                          setOpenMenuId((id) => (id === s.id ? null : s.id))
                        }
                        aria-label="Export session"
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === s.id}
                        title="Export"
                      >
                        <MoreHorizontal size={13} />
                      </button>
                      {openMenuId === s.id && (
                        <div
                          className="pvc-recent-card-menu"
                          role="menu"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onSessionExport(s, 'markdown');
                              setOpenMenuId(null);
                            }}
                          >
                            <Download size={12} />
                            Download MD
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onSessionExport(s, 'warRoom');
                              setOpenMenuId(null);
                            }}
                          >
                            <BookOpen size={12} />
                            Send to War Room
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onSessionExport(s, 'email');
                              setOpenMenuId(null);
                            }}
                          >
                            <Mail size={12} />
                            Email draft
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
            <span>{REALTIME_MODEL_LABEL}</span>
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
