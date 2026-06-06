import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Plus, ArrowLeft, Search } from 'lucide-react';
import { AppView, Contact } from '../types';
import { useFeatures } from '../contexts/FeatureContext';

// ─── GlobalQuickActions ─────────────────────────────────────────────────────────
// The app-wide quick-actions FAB (Phase 5b). Previously lived in Dashboard and
// only navigated (setView); now it floats on every view and fires REAL actions
// via App's existing intent handlers — open the task/contact composer, open the
// email composer, instant-start a Pulse meeting, or pick a contact for a quick
// voice message. Mounted once at App level (inside FeatureProvider, so it can
// gate the email action on emailEnabled). The "?" keyboard-help button that used
// to sit beside the FAB was dropped: the global KeyboardChordsLayer already owns
// the `?` overlay, so a second one here would be redundant.

interface GlobalQuickActionsProps {
  contacts: Contact[];
  /** App's raw view setter (navigate-only actions). */
  setView: (view: AppView) => void;
  onNewTask: () => void;
  onNewContact: () => void;
  onComposeEmail: () => void;
  onStartMeeting: () => void;
  onVoxContact: (id: string) => void;
}

interface FabAction {
  id: string;
  label: string;
  /** Font Awesome solid class, e.g. 'fa-check'. */
  icon: string;
  run: () => void;
  hidden?: boolean;
}

const itemClass =
  'w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/[0.04] hover:text-rose-600 dark:hover:text-rose-400 focus-visible:outline-none focus-visible:bg-zinc-50 dark:focus-visible:bg-white/[0.04] transition-colors duration-150';

export const GlobalQuickActions: React.FC<GlobalQuickActionsProps> = ({
  contacts,
  setView,
  onNewTask,
  onNewContact,
  onComposeEmail,
  onStartMeeting,
  onVoxContact,
}) => {
  const { features } = useFeatures();
  const [open, setOpen] = useState(false);
  // Quick Relay opens a contact picker in place rather than navigating blind —
  // a voice message needs a target, so we pick one and hand it to onVoxContact.
  const [voxPicker, setVoxPicker] = useState(false);
  const [voxQuery, setVoxQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setVoxPicker(false);
    setVoxQuery('');
  };

  // Escape steps back from the picker, then closes the menu. Outside-click closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (voxPicker) {
          setVoxPicker(false);
          setVoxQuery('');
        } else {
          setOpen(false);
        }
      }
    };
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, voxPicker]);

  const actions = useMemo<FabAction[]>(
    () =>
      [
        { id: 'task', label: 'New task', icon: 'fa-check', run: () => { onNewTask(); close(); } },
        { id: 'message', label: 'Send message', icon: 'fa-message', run: () => { setView(AppView.MESSAGES); close(); } },
        { id: 'meeting', label: 'Start a meeting', icon: 'fa-video', run: () => { onStartMeeting(); close(); } },
        { id: 'email', label: 'Compose email', icon: 'fa-envelope', hidden: !features.emailEnabled, run: () => { onComposeEmail(); close(); } },
        { id: 'vox', label: 'Quick Relay', icon: 'fa-microphone', run: () => setVoxPicker(true) },
        { id: 'contact', label: 'New contact', icon: 'fa-user-plus', run: () => { onNewContact(); close(); } },
        { id: 'warroom', label: 'War Room', icon: 'fa-book-open', run: () => { setView(AppView.LIVE_AI); close(); } },
        { id: 'search', label: 'Search', icon: 'fa-magnifying-glass', run: () => { setView(AppView.MULTI_MODAL); close(); } },
      ].filter(a => !a.hidden),
    [features.emailEnabled, onNewTask, onStartMeeting, onComposeEmail, onNewContact, setView]
  );

  const voxMatches = useMemo(() => {
    const q = voxQuery.trim().toLowerCase();
    const base = contacts.filter(c => c.name || c.email);
    const filtered = q
      ? base.filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      : base;
    return filtered.slice(0, 6);
  }, [contacts, voxQuery]);

  return ReactDOM.createPortal(
    <div ref={containerRef} className="fixed bottom-6 right-6 z-[9999]">
      {open && (
        <div
          className="absolute bottom-full right-0 mb-3 w-64 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.08] shadow-lg overflow-hidden animate-fade-in"
          role="menu"
        >
          {!voxPicker ? (
            <ul className="py-1">
              {actions.map(action => (
                <li key={action.id}>
                  <button onClick={action.run} className={itemClass} role="menuitem">
                    <i className={`fa-solid ${action.icon} w-4 text-center text-zinc-400 dark:text-zinc-500`} />
                    <span>{action.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 dark:border-white/[0.06]">
                <button
                  onClick={() => { setVoxPicker(false); setVoxQuery(''); }}
                  aria-label="Back to quick actions"
                  className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
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
              <ul className="py-1 max-h-64 overflow-y-auto" role="listbox">
                {voxMatches.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">No contacts match.</li>
                ) : (
                  voxMatches.map(c => (
                    <li key={c.id}>
                      <button onClick={() => { onVoxContact(c.id); close(); }} className={itemClass} role="option">
                        <i className="fa-solid fa-microphone w-4 text-center text-zinc-400 dark:text-zinc-500" />
                        <span className="truncate">{c.name || c.email}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label={open ? 'Close quick actions' : 'Open quick actions'}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 ${
          open
            ? 'bg-zinc-200 dark:bg-white/[0.08] text-zinc-700 dark:text-zinc-200 rotate-45'
            : 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white shadow-md shadow-rose-500/20'
        }`}
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>,
    document.body
  );
};

export default GlobalQuickActions;
