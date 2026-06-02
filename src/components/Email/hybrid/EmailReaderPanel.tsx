// EmailReaderPanel — slide-out (or full-page when maximized) reader.
// Phase 12.4. Lane / Folder / Search row clicks open this in slide-out mode.
// Phase 12.10. Signal cards + Triage cards have an "Open full page" button
// that opens this panel pre-maximized; the panel itself has a maximize /
// minimize toggle so the user can flip between the two modes at will.
//
// Mounted at EmailHybridClient's view-shell container level so it overlays
// the active view. Reads readerPanelEmailId + readerPanelMaximized from
// emailUIStore; Esc / backdrop click / X button → clears the slot.
import React, { useState } from 'react';
import { X, Maximize2, Minimize2, UserRound } from 'lucide-react';
import { useEmailStore } from '../../../store/emailStore';
import { useEmailUIStore } from '../../../store/emailUIStore';
import { Avatar } from './primitives';
import { InlineReader } from './cockpit/InlineReader';
import { RelationshipPanel } from '../RelationshipPanel';
import { cachedEmailToRow } from './data/emailRow';

export const EmailReaderPanel: React.FC = () => {
  const emails = useEmailStore((s) => s.emails);
  const readerPanelEmailId = useEmailUIStore((s) => s.readerPanelEmailId);
  const setReaderPanelEmailId = useEmailUIStore((s) => s.setReaderPanelEmailId);
  const maximized = useEmailUIStore((s) => s.readerPanelMaximized);
  const setMaximized = useEmailUIStore((s) => s.setReaderPanelMaximized);

  // Contact-context sidebar (WI-7). Only shown in maximized/full-page mode
  // where there's room; the slide-out reader is left unchanged. Default-on
  // in maximized; the Contact toggle hides/shows it.
  const [showRelationship, setShowRelationship] = useState(true);

  if (!readerPanelEmailId) return null;

  const email = emails.find((e) => e.id === readerPanelEmailId);
  if (!email) {
    // Email was removed from the store (archived/trashed elsewhere). Close.
    setTimeout(() => setReaderPanelEmailId(null), 0);
    return null;
  }

  const row = cachedEmailToRow(email);
  const onClose = () => setReaderPanelEmailId(null);
  const toggleMaximize = () => setMaximized(!maximized);

  return (
    <>
      {/* Backdrop only renders in slide-out mode; when maximized the panel
          covers the entire view-shell and a backdrop is meaningless. */}
      {!maximized && (
        <div
          className="reader-panel-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`reader-panel ${maximized ? 'is-maximized' : ''}`}
        role="dialog"
        aria-label={`Email from ${row.from}: ${row.subject}`}
      >
        <div className="absolute top-3 right-3 z-[2] flex items-center gap-1.5">
          {maximized && (
            <button
              type="button"
              onClick={() => setShowRelationship((v) => !v)}
              className="reader-panel-close"
              title={showRelationship ? 'Hide contact panel' : 'Show contact panel'}
              aria-label={showRelationship ? 'Hide contact panel' : 'Show contact panel'}
              aria-pressed={showRelationship}
              style={{ position: 'static' }}
            >
              <UserRound className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleMaximize}
            className="reader-panel-close"
            title={maximized ? 'Restore to side panel' : 'Open full page'}
            aria-label={maximized ? 'Restore to side panel' : 'Open full page'}
            style={{ position: 'static' }}
          >
            {maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="reader-panel-close"
            title="Close (Esc)"
            aria-label="Close reader panel"
            style={{ position: 'static' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="reader-panel-header">
          <Avatar name={row.from} size={36} />
          <div className="flex-1 min-w-0 pr-24">
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

        {maximized && showRelationship ? (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <InlineReader email={row} />
            <RelationshipPanel
              email={email}
              onClose={() => setShowRelationship(false)}
            />
          </div>
        ) : (
          <InlineReader email={row} />
        )}
      </aside>
    </>
  );
};

export default EmailReaderPanel;
