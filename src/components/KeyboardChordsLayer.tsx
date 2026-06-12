// ============================================================
// KeyboardChordsLayer
//
// Global Vim-style `g`-chord navigation + `?` reference overlay.
// Mount once at the App root. Listens for:
//   g d → Dashboard
//   g h → Dashboard (home alias)
//   g i → Messages (inbox)
//   g e → Email
//   g r → Relay
//   g k → Calendar
//   g v → Meetings (video)
//   g c → Contacts
//   g m → Map
//   g x → Decisions & Tasks
//   g a → Analytics
//   g s → Settings
//   g /  → Search (palette)
//   ?   → show chord reference overlay
// Chord timeout: 700ms between `g` and the second key.
// Skips when focus is inside <input>, <textarea>, or contenteditable.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AppView } from '../types';
import { isOverlayOpen } from '../lib/overlayStack';

interface ChordDef {
  key: string;
  label: string;
  view: AppView;
  /** Optional helper text shown in the `?` overlay. */
  hint?: string;
}

// Display-grouped chord registry. Maps the 2nd-key (after `g`) to its target.
const CHORDS: ChordDef[] = [
  { key: 'd', label: 'Dashboard',         view: AppView.DASHBOARD },
  { key: 'h', label: 'Home (alias)',      view: AppView.DASHBOARD },
  { key: 'i', label: 'Messages',          view: AppView.MESSAGES,        hint: 'unified inbox' },
  { key: 'e', label: 'Email',             view: AppView.EMAIL },
  { key: 'r', label: 'Relay',             view: AppView.RELAY,           hint: 'voice messages' },
  { key: 'k', label: 'Calendar',          view: AppView.CALENDAR },
  { key: 'v', label: 'Meetings',          view: AppView.MEETINGS,        hint: 'video calls' },
  { key: 'c', label: 'Contacts',          view: AppView.CONTACTS },
  { key: 'm', label: 'Map',               view: AppView.MAP },
  { key: 'x', label: 'Decisions & Tasks', view: AppView.DECISIONS_TASKS },
  { key: 'a', label: 'Analytics',         view: AppView.ANALYTICS },
  { key: 's', label: 'Settings',          view: AppView.SETTINGS },
];

const CHORD_TIMEOUT_MS = 700;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  return false;
}

const KeyboardChordsLayer: React.FC = () => {
  const [showOverlay, setShowOverlay] = useState(false);
  // Whether the user pressed `g` and is waiting for the second key.
  const armedRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Modifiers reserved for OS / browser / app shortcuts; never start a chord.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      // A sheet/modal is open — its trap owns the keyboard; don't navigate the
      // occluded view out from under it.
      if (isOverlayOpen()) return;

      // `?` opens the overlay. Shift+/ on US keyboards; the browser emits `?`
      // as the key string with shiftKey true.
      if (e.key === '?') {
        e.preventDefault();
        setShowOverlay(s => !s);
        return;
      }

      // ESC closes the overlay.
      if (e.key === 'Escape' && showOverlay) {
        e.preventDefault();
        setShowOverlay(false);
        return;
      }

      // Second key of a chord — only if armed within the timeout window.
      if (armedRef.current && Date.now() - armedRef.current <= CHORD_TIMEOUT_MS) {
        const lower = e.key.toLowerCase();
        armedRef.current = null;

        // Palette opener: `g /` triggers the existing global ⌘K palette.
        if (lower === '/') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('pulse:command-palette-open'));
          return;
        }

        const chord = CHORDS.find(c => c.key === lower);
        if (chord) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('pulse:navigate', {
            detail: { view: chord.view },
          }));
        }
        return;
      }

      // Start a chord: press `g`, then wait for the second key.
      if (e.key === 'g') {
        // Don't preventDefault — let `g` still type in case the user wanted
        // it (we already exited above if focus is in a typing target).
        armedRef.current = Date.now();
        // Self-disarm after the timeout window even if no second key comes.
        const at = armedRef.current;
        setTimeout(() => {
          if (armedRef.current === at) armedRef.current = null;
        }, CHORD_TIMEOUT_MS + 50);
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [showOverlay]);

  if (!showOverlay) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center px-4"
      style={{ background: 'rgba(15, 15, 15, 0.55)', backdropFilter: 'blur(4px)' }}
      onClick={() => setShowOverlay(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-white/10">
          <h2
            className="text-[11px] tracking-[0.1em] uppercase text-zinc-500 dark:text-zinc-400"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Keyboard chords
          </h2>
          <button
            type="button"
            onClick={() => setShowOverlay(false)}
            aria-label="Close"
            className="w-7 h-7 rounded-md inline-flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          <ul className="divide-y divide-zinc-100 dark:divide-white/5">
            {CHORDS.map(chord => (
              <li key={chord.key} className="flex items-center justify-between px-5 py-2.5">
                <span className="flex items-center gap-2">
                  <Kbd>g</Kbd>
                  <Kbd>{chord.key}</Kbd>
                </span>
                <span className="flex-1 ml-4 text-sm text-zinc-700 dark:text-zinc-200">
                  {chord.label}
                  {chord.hint && (
                    <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                      {chord.hint}
                    </span>
                  )}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between px-5 py-2.5">
              <span className="flex items-center gap-2">
                <Kbd>g</Kbd>
                <Kbd>/</Kbd>
              </span>
              <span className="flex-1 ml-4 text-sm text-zinc-700 dark:text-zinc-200">
                Search palette
                <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">also ⌘K</span>
              </span>
            </li>
            <li className="flex items-center justify-between px-5 py-2.5">
              <span className="flex items-center gap-2">
                <Kbd>?</Kbd>
              </span>
              <span className="flex-1 ml-4 text-sm text-zinc-700 dark:text-zinc-200">
                Show / hide this overlay
              </span>
            </li>
          </ul>
        </div>

        <p
          className="px-5 py-3 border-t border-zinc-200 dark:border-white/10 text-[10px] tracking-[0.1em] uppercase text-zinc-400 dark:text-zinc-500"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Press <span className="text-zinc-600 dark:text-zinc-300">g</span> then a letter within 0.7s
        </p>
      </div>
    </div>
  );
};

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd
    className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-[11px] text-zinc-700 dark:text-zinc-200"
    style={{ fontFamily: "'JetBrains Mono', monospace" }}
  >
    {children}
  </kbd>
);

export default KeyboardChordsLayer;
