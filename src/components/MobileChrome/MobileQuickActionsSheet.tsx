// MobileQuickActionsSheet — the slim bar's "+" sheet. Carries the action
// list, email gating, and inline vox contact picker over from the retired
// GlobalQuickActions FAB (Phase 5b) with behavior intact: same eight
// actions, same App intent handlers, Escape steps back from the picker
// before it closes the sheet. ArrowUp/Down move focus through the rows —
// the FAB's role="menu" promised keyboard nav and never delivered; here
// the rows are plain buttons (no false ARIA menu contract) and the arrows
// are real.

import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { AppView, Contact } from '../../types';
import { useFeatures } from '../../contexts/FeatureContext';
import MobileSheet from './MobileSheet';

interface MobileQuickActionsSheetProps {
  contacts: Contact[];
  /** App's raw view setter (navigate-only actions). */
  setView: (view: AppView) => void;
  onNewTask: () => void;
  onNewContact: () => void;
  onComposeEmail: () => void;
  onStartMeeting: () => void;
  onVoxContact: (id: string) => void;
  onClose: () => void;
}

interface SheetAction {
  id: string;
  label: string;
  /** Font Awesome solid class, e.g. 'fa-check' (carried from the FAB). */
  icon: string;
  run: () => void;
  hidden?: boolean;
}

const rowClass =
  'w-full flex items-center gap-3 px-4 min-h-[48px] text-sm text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/[0.04] active:bg-zinc-100 dark:active:bg-white/[0.06] hover:text-rose-600 dark:hover:text-rose-400 focus-visible:outline-none focus-visible:bg-zinc-50 dark:focus-visible:bg-white/[0.04] transition-colors duration-150';

export const MobileQuickActionsSheet: React.FC<MobileQuickActionsSheetProps> = ({
  contacts,
  setView,
  onNewTask,
  onNewContact,
  onComposeEmail,
  onStartMeeting,
  onVoxContact,
  onClose,
}) => {
  const { features } = useFeatures();
  // Quick Relay opens a contact picker in place rather than navigating blind —
  // a voice message needs a target, so we pick one and hand it to onVoxContact.
  const [voxPicker, setVoxPicker] = useState(false);
  const [voxQuery, setVoxQuery] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  // Escape steps back from the picker first, then closes the sheet — the
  // FAB's layered-Escape behavior, preserved.
  const handleEscape = () => {
    if (voxPicker) {
      setVoxPicker(false);
      setVoxQuery('');
    } else {
      onClose();
    }
  };

  const actions = useMemo<SheetAction[]>(
    () =>
      [
        { id: 'task', label: 'New task', icon: 'fa-check', run: () => { onNewTask(); onClose(); } },
        { id: 'message', label: 'Send message', icon: 'fa-message', run: () => { setView(AppView.MESSAGES); onClose(); } },
        { id: 'meeting', label: 'Start a meeting', icon: 'fa-video', run: () => { onStartMeeting(); onClose(); } },
        { id: 'email', label: 'Compose email', icon: 'fa-envelope', hidden: !features.emailEnabled, run: () => { onComposeEmail(); onClose(); } },
        { id: 'vox', label: 'Quick Relay', icon: 'fa-microphone', run: () => setVoxPicker(true) },
        { id: 'contact', label: 'New contact', icon: 'fa-user-plus', run: () => { onNewContact(); onClose(); } },
        { id: 'warroom', label: 'War Room', icon: 'fa-book-open', run: () => { setView(AppView.LIVE_AI); onClose(); } },
        { id: 'search', label: 'Search', icon: 'fa-magnifying-glass', run: () => { setView(AppView.MULTI_MODAL); onClose(); } },
      ].filter(a => !a.hidden),
    [features.emailEnabled, onNewTask, onStartMeeting, onComposeEmail, onNewContact, setView, onClose]
  );

  const voxMatches = useMemo(() => {
    const q = voxQuery.trim().toLowerCase();
    const base = contacts.filter(c => c.name || c.email);
    const filtered = q
      ? base.filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      : base;
    return filtered.slice(0, 6);
  }, [contacts, voxQuery]);

  // ArrowUp/Down roving focus across the visible row buttons.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const root = bodyRef.current;
    if (!root) return;
    const rows = Array.from(root.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    if (rows.length === 0) return;
    e.preventDefault();
    const idx = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === 'ArrowDown'
        ? rows[Math.min(idx + 1, rows.length - 1)]
        : rows[Math.max(idx - 1, 0)];
    next?.focus();
  };

  return (
    <MobileSheet title="Quick actions" onClose={onClose} onEscape={handleEscape}>
      <div ref={bodyRef} onKeyDown={handleKeyDown}>
        {!voxPicker ? (
          <ul className="py-1" aria-label="Quick actions">
            {actions.map(action => (
              <li key={action.id}>
                <button type="button" onClick={action.run} className={rowClass}>
                  <i className={`fa-solid ${action.icon} w-4 text-center text-zinc-400 dark:text-zinc-500`} aria-hidden="true" />
                  <span>{action.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => { setVoxPicker(false); setVoxQuery(''); }}
                aria-label="Back to quick actions"
                className="shrink-0 w-8 h-8 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <input
                value={voxQuery}
                onChange={e => setVoxQuery(e.target.value)}
                placeholder="Voice message to…"
                autoFocus
                spellCheck={false}
                className="flex-1 bg-transparent border-0 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-0"
                aria-label="Search contacts for a voice message"
              />
            </div>
            <ul className="py-1" aria-label="Contacts">
              {voxMatches.length === 0 ? (
                <li className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">No contacts match.</li>
              ) : (
                voxMatches.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => { onVoxContact(c.id); onClose(); }}
                      className={rowClass}
                    >
                      <i className="fa-solid fa-microphone w-4 text-center text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
                      <span className="truncate">{c.name || c.email}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </MobileSheet>
  );
};

export default MobileQuickActionsSheet;
