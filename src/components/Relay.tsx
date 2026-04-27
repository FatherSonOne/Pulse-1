import React, { useState } from 'react';
import { Contact } from '../types';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

// Keyboard shortcuts
import { useRelayKeyboardShortcuts } from '../hooks/useRelayKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from './Relay/VoxKeyboardShortcutsHelp';

// Audience renderers — RelayMode buckets render one of these as the body.
// Stage 2.1d.2: ClassicMode is the default 'messages' renderer until the
// audience picker is built in 2.1d.4. VoxNotesMode and PulseRadio are the
// 'notes' and 'live' bodies respectively.
import {
  ClassicMode,
  VoxNotesMode,
  PulseRadio,
} from './Relay/index';
import { RelayMode, mapVoxToRelay } from '../services/relay/voxModeTypes';

interface RelayProps {
  apiKey: string;
  contacts: Contact[];
  initialContactId?: string;
  isDarkMode?: boolean;
}

// Top-level views inside Relay. Triage is the default landing experience and
// is rebuilt in 2.1d.3; the other three are RelayMode audience renderers.
type RelayView = 'triage' | RelayMode;

const RELAY_VIEW_LABELS: Record<RelayView, string> = {
  triage: 'Triage',
  messages: 'Messages',
  notes: 'Notes',
  live: 'Live',
};

const RELAY_VIEWS: readonly RelayView[] = ['triage', 'messages', 'notes', 'live'] as const;

const Relay: React.FC<RelayProps> = ({ apiKey, contacts: _contacts, initialContactId: _initialContactId, isDarkMode = false }) => {
  // Keep auth hook wired in for downstream consumers (audience pickers etc.).
  useAuth();

  const [view, setView] = useState<RelayView>('triage');
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Map legacy 1–7 mode switches into RelayView buckets so existing keyboard
  // shortcuts continue to land somewhere sensible during the transition.
  // Top-level T/M/N/L letter shortcuts go through onSwitchView directly.
  useRelayKeyboardShortcuts({
    onSwitchMode: (legacyMode) => {
      const next: RelayView = mapVoxToRelay(legacyMode);
      setView(next);
      toast.success(`Switched to ${RELAY_VIEW_LABELS[next]}`, { duration: 1500 });
    },
    onSwitchView: (newView) => {
      setView(newView);
      toast.success(`Switched to ${RELAY_VIEW_LABELS[newView]}`, { duration: 1500 });
    },
    onShowHelp: () => setShowShortcutsHelp(true),
  }, true);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fade-in shadow-xl">
      {/* Mode nav — Triage / Messages / Notes / Live */}
      <nav
        className="flex items-center gap-1 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800"
        role="tablist"
        aria-label="Relay views"
      >
        {RELAY_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-[0.1em] transition ${
              view === v
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            {RELAY_VIEW_LABELS[v]}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-hidden">
        {view === 'triage' && (
          <div className="h-full flex items-center justify-center px-6 text-center">
            <div className="max-w-md">
              <p
                className="text-sm text-zinc-500 dark:text-zinc-400"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                Triage stream coming soon — the prioritized voice-message inbox lands in 2.1d.3.
              </p>
            </div>
          </div>
        )}
        {view === 'messages' && (
          <ClassicMode
            onBack={() => setView('triage')}
            apiKey={apiKey}
            isDarkMode={isDarkMode}
          />
        )}
        {view === 'notes' && (
          <VoxNotesMode
            onBack={() => setView('triage')}
            apiKey={apiKey}
            isDarkMode={isDarkMode}
          />
        )}
        {view === 'live' && (
          <PulseRadio
            onBack={() => setView('triage')}
            apiKey={apiKey}
            isDarkMode={isDarkMode}
          />
        )}
      </div>

      <VoxKeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default Relay;
