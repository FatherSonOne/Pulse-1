// EmailReaderPanel — slide-out right-rail reader for non-Signal rows.
// Phase 12.4. Lane rows, Folder rows, and Search-result rows are too compact
// for inline expansion; they open the email in this panel instead. Signal
// rows keep their inline InlineReader because they're already roomy cards
// and inline reading there is what users expect.
//
// Mounted at EmailHybridClient's view-shell container level so it overlays
// the active view. Reads readerPanelEmailId from emailUIStore; on Esc /
// backdrop click / X button → clears the slot and the panel unmounts.
import React from 'react';
import { X } from 'lucide-react';
import { useEmailStore } from '../../../store/emailStore';
import { useEmailUIStore } from '../../../store/emailUIStore';
import { Avatar } from './primitives';
import { InlineReader } from './cockpit/InlineReader';
import { cachedEmailToRow } from './data/emailRow';

export const EmailReaderPanel: React.FC = () => {
  const emails = useEmailStore((s) => s.emails);
  const readerPanelEmailId = useEmailUIStore((s) => s.readerPanelEmailId);
  const setReaderPanelEmailId = useEmailUIStore((s) => s.setReaderPanelEmailId);

  if (!readerPanelEmailId) return null;

  const email = emails.find((e) => e.id === readerPanelEmailId);
  if (!email) {
    // Email was removed from the store (archived/trashed elsewhere). Close.
    setTimeout(() => setReaderPanelEmailId(null), 0);
    return null;
  }

  const row = cachedEmailToRow(email);
  const onClose = () => setReaderPanelEmailId(null);

  return (
    <>
      <div
        className="reader-panel-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="reader-panel"
        role="dialog"
        aria-label={`Email from ${row.from}: ${row.subject}`}
      >
        <button
          type="button"
          className="reader-panel-close"
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close reader panel"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="reader-panel-header">
          <Avatar name={row.from} size={36} />
          <div className="flex-1 min-w-0 pr-9">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-[13px] font-semibold pulse-ink-color">{row.from}</span>
              {row.org && (
                <>
                  <span className="text-[11px] pulse-ink-3-color">·</span>
                  <span className="text-[11px] pulse-ink-3-color">{row.org}</span>
                </>
              )}
              <span className="ml-auto text-[11px] font-mono-pulse pulse-ink-3-color tnum">{row.when}</span>
            </div>
            <h2
              className="cockpit-headline text-[17px] pulse-ink-color leading-snug mt-1.5"
              style={{ fontFamily: 'var(--pulse-font-serif)', fontWeight: 500 }}
            >
              {row.subject}
            </h2>
          </div>
        </div>

        <InlineReader email={row} />
      </aside>
    </>
  );
};

export default EmailReaderPanel;
