/**
 * Signal Detail — drill-down sheet for a single Briefing signal.
 * Slides in from the right. One file, one layout, branches by SignalKind.
 * Each signal type gets a focused single-purpose view; no tabbed dashboard.
 */

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { BriefingSignal, SignalKind } from '../../../services/weeklyBriefingService';
import './SignalDetail.css';

interface SignalDetailRouterProps {
  signal: BriefingSignal;
  onClose: () => void;
  onOpenContact?: (contactIdentifier?: string) => void;
  onOpenMessages?: () => void;
  onOpenCalendar?: () => void;
}

const KIND_LABEL: Record<SignalKind, string> = {
  cooling: 'COOLING CONTACT',
  at_risk: 'AT-RISK CONTACT',
  velocity_shift: 'REPLY VELOCITY',
  conflict: 'CONFLICT DETECTED',
  win: 'WIN',
  burnout: 'BURNOUT SIGNAL',
};

interface PrimaryActionProps {
  signal: BriefingSignal;
  onOpenContact?: (contactIdentifier?: string) => void;
  onOpenMessages?: () => void;
  onOpenCalendar?: () => void;
}

function PrimaryAction({
  signal,
  onOpenContact,
  onOpenMessages,
  onOpenCalendar,
}: PrimaryActionProps): React.ReactElement {
  const subject = signal.subjectName || 'contact';
  switch (signal.kind) {
    case 'cooling':
    case 'at_risk':
      return (
        <button
          type="button"
          className="signal-cta"
          onClick={() => onOpenContact?.(signal.subjectId)}
          disabled={!onOpenContact}
        >
          Open {subject}
        </button>
      );
    case 'conflict':
      return (
        <button
          type="button"
          className="signal-cta"
          onClick={() => onOpenMessages?.()}
          disabled={!onOpenMessages}
        >
          Open conversation
        </button>
      );
    case 'velocity_shift':
      return (
        <button
          type="button"
          className="signal-cta"
          onClick={() => onOpenMessages?.()}
          disabled={!onOpenMessages}
        >
          Open inbox
        </button>
      );
    case 'win':
      return (
        <button
          type="button"
          className="signal-cta"
          onClick={() => onOpenContact?.(signal.subjectId)}
          disabled={!onOpenContact}
        >
          Send thanks
        </button>
      );
    case 'burnout':
      return (
        <button
          type="button"
          className="signal-cta"
          onClick={() => onOpenCalendar?.()}
          disabled={!onOpenCalendar}
        >
          Block focus time
        </button>
      );
  }
}

function SignalContext({ signal }: { signal: BriefingSignal }): React.ReactElement {
  switch (signal.kind) {
    case 'cooling':
    case 'at_risk':
      return (
        <div className="signal-context">
          <p className="signal-context-lead">
            Pulse flagged this contact because their reply cadence slipped below
            their usual rhythm.
          </p>
          <p className="signal-context-body">
            The full engagement history lives on the contact card. The action
            below opens that view.
          </p>
        </div>
      );
    case 'velocity_shift':
      return (
        <div className="signal-context">
          <p className="signal-context-lead">
            Reply time varies meaningfully across channels this week.
          </p>
          <p className="signal-context-body">
            The slowest-versus-fastest spread is summarised in the headline above.
            Open the channel to see its queue.
          </p>
        </div>
      );
    case 'conflict':
      return (
        <div className="signal-context">
          <p className="signal-context-lead">
            Tension was detected from sentiment shifts and keyword markers in
            this thread. Confidence: {Math.round(signal.confidence * 100)}%.
          </p>
          <p className="signal-context-body">
            Open the conversation to read the excerpts that triggered the signal
            and reply directly.
          </p>
        </div>
      );
    case 'win':
      return (
        <div className="signal-context">
          <p className="signal-context-lead">
            Recognition received this week.
          </p>
          <p className="signal-context-body">
            Reply with a thank-you, or open the contact to see the full kudos
            history.
          </p>
        </div>
      );
    case 'burnout':
      return (
        <div className="signal-context">
          <p className="signal-context-lead">
            Burnout indicator drawn from messaging hours, late-night activity,
            and response-time variance.
          </p>
          <p className="signal-context-body">
            The most useful response is usually a calendar block. Open Calendar
            to claim focus time today or tomorrow.
          </p>
        </div>
      );
  }
}

export const SignalDetailRouter: React.FC<SignalDetailRouterProps> = ({
  signal,
  onClose,
  onOpenContact,
  onOpenMessages,
  onOpenCalendar,
}) => {
  const sheetRef = useRef<HTMLElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Focus trap + ESC close + restore focus on unmount.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;

    // Move focus into the sheet on open.
    const focusables = sheet
      ? sheet.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
      : null;
    focusables?.[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !sheet) return;
      const items = Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="signal-detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signal-detail-title"
      onClick={onClose}
    >
      <aside
        ref={sheetRef}
        className="signal-detail-sheet"
        onClick={e => e.stopPropagation()}
      >
        <header className="signal-detail-header">
          <span className={`signal-detail-kind tone-${signal.kind}`}>
            {KIND_LABEL[signal.kind]}
          </span>
          <button
            type="button"
            className="signal-detail-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="signal-detail-body">
          <h2 id="signal-detail-title" className="signal-detail-title">
            {signal.text}
          </h2>

          <SignalContext signal={signal} />

          <div className="signal-detail-meta">
            <span className="signal-detail-meta-item">
              Confidence{' '}
              <strong>{Math.round(signal.confidence * 100)}%</strong>
            </span>
            <span className="signal-detail-provenance">
              PULSE AI · SIGNAL
            </span>
          </div>
        </div>

        <footer className="signal-detail-footer">
          <PrimaryAction
            signal={signal}
            onOpenContact={onOpenContact}
            onOpenMessages={onOpenMessages}
            onOpenCalendar={onOpenCalendar}
          />
        </footer>
      </aside>
    </div>
  );
};

export default SignalDetailRouter;
