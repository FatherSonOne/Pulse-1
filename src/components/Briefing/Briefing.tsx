/**
 * Pulse Weekly Briefing — quiet single-column reading surface.
 * Replaces the Observatory at /analytics. Surfaces are inline; this page
 * is the once-a-week digest.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, RefreshCw } from 'lucide-react';
import {
  getWeeklyBriefing,
  WeeklyBriefing,
  briefingThresholds,
} from '../../services/weeklyBriefingService';
import { BriefingHeader } from './BriefingHeader';
import { SignalLine } from './SignalLine';
import { WinsStrip } from './WinsStrip';
import { SignalDetailRouter } from './SignalDetail/SignalDetailRouter';
import { isOverlayOpen } from '../../lib/overlayStack';
import './Briefing.css';

export interface BriefingNavCallbacks {
  onOpenContact?: (contactIdentifier?: string) => void;
  onOpenMessages?: () => void;
  onOpenCalendar?: () => void;
}

interface BriefingProps extends BriefingNavCallbacks {
  onClose?: () => void;
}

const QUERY_WEEK = 'week';
const QUERY_SIGNAL = 'signal';

function readInitialWeek(): Date {
  if (typeof window === 'undefined') return new Date();
  try {
    const params = new URLSearchParams(window.location.search);
    const w = params.get(QUERY_WEEK);
    if (w) {
      const d = new Date(w + 'T00:00:00');
      if (!isNaN(d.getTime())) return d;
    }
  } catch {}
  return new Date();
}

function readInitialSignal(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get(QUERY_SIGNAL);
  } catch {
    return null;
  }
}

function writeUrl(week: Date, signalId: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    params.set(QUERY_WEEK, week.toISOString().slice(0, 10));
    if (signalId) params.set(QUERY_SIGNAL, signalId);
    else params.delete(QUERY_SIGNAL);
    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', next);
  } catch {}
}

export const Briefing: React.FC<BriefingProps> = ({
  onClose,
  onOpenContact,
  onOpenMessages,
  onOpenCalendar,
}) => {
  const [weekOf, setWeekOf] = useState<Date>(() => readInitialWeek());
  const [briefing, setBriefing] = useState<WeeklyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSignalId, setActiveSignalId] = useState<string | null>(() => readInitialSignal());
  const signalsListRef = useRef<HTMLOListElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWeeklyBriefing(weekOf);
      setBriefing(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this week’s briefing.');
      setBriefing(null);
    } finally {
      setLoading(false);
    }
  }, [weekOf]);

  useEffect(() => {
    void load();
  }, [load]);

  // Mirror state into the URL so refresh + share work.
  useEffect(() => {
    writeUrl(weekOf, activeSignalId);
  }, [weekOf, activeSignalId]);

  const stepWeek = (deltaDays: number) => {
    const next = new Date(weekOf);
    next.setDate(next.getDate() + deltaDays);
    setWeekOf(next);
  };

  const goToday = () => setWeekOf(new Date());

  const activeSignal = activeSignalId
    ? briefing?.signals.find(s => s.id === activeSignalId) ?? null
    : null;

  // Keyboard shortcuts: j/k between signals, Enter to open, [/] to step week, t for today.
  useEffect(() => {
    if (!briefing?.hasEnoughData) return;
    const onKey = (e: KeyboardEvent) => {
      // Don't intercept when the user is typing or a sheet is open.
      if (activeSignal) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (isOverlayOpen()) return;

      const list = signalsListRef.current;
      const buttons = list ? Array.from(list.querySelectorAll<HTMLButtonElement>('.briefing-signal-button')) : [];
      const focused = document.activeElement as HTMLElement | null;
      const idx = focused ? buttons.indexOf(focused as HTMLButtonElement) : -1;

      if (e.key === 'j' && buttons.length > 0) {
        e.preventDefault();
        const next = idx < 0 ? 0 : Math.min(idx + 1, buttons.length - 1);
        buttons[next]?.focus();
      } else if (e.key === 'k' && buttons.length > 0) {
        e.preventDefault();
        const next = idx <= 0 ? 0 : idx - 1;
        buttons[next]?.focus();
      } else if (e.key === '[') {
        e.preventDefault();
        stepWeek(-7);
      } else if (e.key === ']') {
        e.preventDefault();
        stepWeek(7);
      } else if (e.key === 't') {
        e.preventDefault();
        goToday();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [briefing?.hasEnoughData, activeSignal, weekOf]);

  return (
    <div className="pulse-briefing">
      <header className="briefing-topbar">
        <div className="briefing-topbar-inner">
          <BriefingHeader
            weekStart={briefing?.weekStart ?? null}
            weekEnd={briefing?.weekEnd ?? null}
            onPrevWeek={() => stepWeek(-7)}
            onNextWeek={() => stepWeek(7)}
            onToday={goToday}
          />
          {onClose && (
            <button
              type="button"
              className="briefing-close"
              onClick={onClose}
              aria-label="Close briefing"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <main className="briefing-main">
        {loading && (
          <div className="briefing-skeleton" aria-hidden="true">
            <div className="briefing-skel-lead" />
            <div className="briefing-skel-line" />
            <div className="briefing-skel-line briefing-skel-line-short" />
            <div className="briefing-skel-line" />
            <div className="briefing-skel-line briefing-skel-line-short" />
          </div>
        )}

        {!loading && error && (
          <section className="briefing-error" aria-live="assertive">
            <h2 className="briefing-error-title">Couldn’t draft this week’s briefing</h2>
            <p className="briefing-error-body">{error}</p>
            <button
              type="button"
              className="briefing-error-retry"
              onClick={load}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Try again
            </button>
          </section>
        )}

        {!loading && !error && briefing && !briefing.hasEnoughData && (
          <section className="briefing-empty" aria-live="polite">
            <h2 className="briefing-empty-title">Not enough data yet</h2>
            <p className="briefing-empty-body">
              Pulse needs about a week of activity to draft a briefing. You have{' '}
              <strong>{briefing.totalMessages}</strong>{' '}
              {briefing.totalMessages === 1 ? 'message' : 'messages'} across{' '}
              <strong>{briefing.daysWithActivity}</strong>{' '}
              {briefing.daysWithActivity === 1 ? 'day' : 'days'} so far.
            </p>
            <p className="briefing-empty-hint">
              Once you cross the threshold ({briefingThresholds.MIN_MESSAGES} messages over{' '}
              {briefingThresholds.MIN_DAYS} days), you’ll see relationships at risk,
              reply-time shifts, conflicts, kudos, and burnout signals here.
            </p>
          </section>
        )}

        {!loading && !error && briefing && briefing.hasEnoughData && (
          <article className="briefing-article">
            <p className="briefing-lead">
              {briefing.leadProvenance === 'pulse_ai' && (
                <span className="briefing-provenance briefing-provenance-ai">
                  PULSE AI · BRIEFING
                </span>
              )}
              {briefing.leadProvenance === 'template' && (
                <span className="briefing-provenance briefing-provenance-template">
                  PULSE · SUMMARY
                </span>
              )}
              <span className="briefing-lead-text">{briefing.lead}</span>
            </p>

            {briefing.signals.length === 0 ? (
              <p className="briefing-quiet">
                Quiet week. No signals worth flagging.
              </p>
            ) : (
              <ol className="briefing-signals" role="list" ref={signalsListRef}>
                {briefing.signals.map(signal => (
                  <SignalLine
                    key={signal.id}
                    signal={signal}
                    onOpen={() => setActiveSignalId(signal.id)}
                  />
                ))}
              </ol>
            )}

            {briefing.wins.length > 0 && (
              <WinsStrip wins={briefing.wins} />
            )}

            <footer className="briefing-footer">
              Pulse drafted this from {briefing.totalMessages} messages over{' '}
              {briefing.daysWithActivity} days. Press <kbd>j</kbd>/<kbd>k</kbd> to
              move between signals, <kbd>[</kbd>/<kbd>]</kbd> to step weeks.
            </footer>
          </article>
        )}
      </main>

      {activeSignal && (
        <SignalDetailRouter
          signal={activeSignal}
          onClose={() => setActiveSignalId(null)}
          onOpenContact={onOpenContact}
          onOpenMessages={onOpenMessages}
          onOpenCalendar={onOpenCalendar}
        />
      )}
    </div>
  );
};

export default Briefing;
