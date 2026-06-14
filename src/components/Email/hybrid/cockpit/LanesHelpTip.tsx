// LanesHelpTip — info chip next to "AUTO-SORTED" that explains how the
// Cockpit Lanes categorization works. Lives here (not as a generic tooltip)
// so the copy stays close to the categorize() implementation it documents.
import React, { useEffect, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';

export const LanesHelpTip: React.FC = () => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full pulse-ink-3-color hover:pulse-rose-color transition"
        title="How does auto-sort work?"
        aria-label="How does auto-sort work?"
        aria-expanded={open}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute right-0 top-full mt-1.5 z-30 w-[340px] rounded-xl border pulse-border-color overflow-hidden hybrid-popover origin-right"
          style={{
            background: 'var(--pulse-canvas-soft)',
            boxShadow: '0 22px 60px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.30)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b pulse-border-color">
            <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-rose-color">
              HOW AUTO-SORT WORKS
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-0.5 rounded hover:pulse-surface-raised pulse-ink-3-color"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-4 py-3 space-y-3 text-[12.5px] leading-relaxed">
            <p className="pulse-ink-2-color">
              Every email lands in exactly one lane. Pulse tries these rules in order until one matches:
            </p>

            <div className="space-y-2.5">
              <Rule
                label="TOOLS"
                body="Sender domain matches a known dev / infra / monitoring service (GitHub, Linear, Render, Sentry, Vercel, AWS, etc.)."
              />
              <Rule
                label="ADMIN"
                body='Subject looks like a calendar invite ("Invitation:", "Updated invitation:") or financial ("Receipt", "Invoice", "Payment", "Order #"), or the sender is billing@/receipts@/calendar.google.com.'
              />
              <Rule
                label="NEWSLETTERS"
                body='Subject is bracketed ("[Substack]") or contains digest/weekly/roundup; sender is newsletter@/updates@; snippet mentions "unsubscribe" or "view in browser".'
              />
              <Rule
                label="ADMIN"
                body="Gmail tagged the email CATEGORY_UPDATES (calendar, receipts, alerts)."
              />
              <Rule
                label="NEWSLETTERS"
                body="Gmail tagged CATEGORY_PROMOTIONS or CATEGORY_FORUMS."
              />
              <Rule
                label="PERSONAL"
                body="Gmail tagged CATEGORY_SOCIAL, OR the sender is on Gmail / iCloud / Outlook with no other matching rule."
              />
              <Rule
                label="WORK"
                body="Everything else. Custom business domains, signed customer + colleague emails, anything not obviously routine."
              />
            </div>

            <p className="text-[11px] pulse-ink-3-color pt-1 border-t pulse-border-color">
              Mis-categorized something? File a thought; categorization rules live in
              {' '}<code className="font-mono-pulse text-[11px] pulse-ink-2-color">data/emailRow.ts</code>
              {' '}and improve over time.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const Rule: React.FC<{ label: string; body: string }> = ({ label, body }) => (
  <div className="flex items-start gap-2.5">
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono-pulse tracking-wide-mono pulse-coral-bg-color pulse-coral-fg-color shrink-0 mt-0.5">
      {label}
    </span>
    <p className="pulse-ink-2-color flex-1">{body}</p>
  </div>
);

export default LanesHelpTip;
