import React, { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Contact } from '../types';
import { useAuth } from '../hooks/useAuth';

// Keyboard shortcuts
import { useRelayKeyboardShortcuts } from '../hooks/useRelayKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from './Relay/VoxKeyboardShortcutsHelp';

// Audience renderers — RelayMode buckets render one of these as the body.
// VoxNotesMode and PulseRadio are the 'notes' and 'live' bodies; 'messages'
// renders ClassicMode through the audience picker.
import {
  ClassicMode,
  VoxNotesMode,
  PulseRadio,
  TeamVoxMode,
} from './Relay/index';
import { RelayTriageStream } from './Relay/RelayTriageStream';
import { RelayComposer, type ComposerReplyTo } from './Relay/RelayComposer';
import { RelaySettings } from './Relay/RelaySettings';
import {
  MessagesAudiencePicker,
  type MessagesAudience,
} from './Relay/MessagesAudiencePicker';
import { RelayMode } from '../services/relay/voxModeTypes';

interface RelayProps {
  apiKey: string;
  contacts: Contact[];
  /** Pulse user id to land on inside Messages (e.g. opening a contact's DM). */
  initialContactId?: string;
  isDarkMode?: boolean;
}

// Top-level views inside Relay. Triage is the default landing experience and
// is rebuilt in 2.1d.3; the other three are RelayMode audience renderers.
type RelayView = 'triage' | RelayMode;

const RELAY_VIEWS: readonly RelayView[] = ['triage', 'messages', 'notes', 'live'] as const;

const RELAY_VIEW_LABELS: Record<RelayView, string> = {
  triage: 'Triage',
  messages: 'Messages',
  notes: 'Notes',
  live: 'Live',
};

const Relay: React.FC<RelayProps> = ({ apiKey, contacts, initialContactId, isDarkMode = false }) => {
  // user.id powers the Triage stream's voice-source queries.
  const { user } = useAuth();

  // If the parent passed an initialContactId we land on Messages so the
  // contact is reachable. ClassicMode owns the per-contact selection (an
  // explicit prop hand-off would couple this wrapper to its internal state),
  // so the value is forwarded below.
  const [view, setView] = useState<RelayView>(initialContactId ? 'messages' : 'triage');
  // Audience switch inside the Messages view — collapses the old 7-mode
  // VoxModeSelector down to Direct / Channel / Broadcast (Stage 5 P1 #9).
  const [messagesAudience, setMessagesAudience] = useState<MessagesAudience>('direct');
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerPrefillRecipientId, setComposerPrefillRecipientId] = useState<string | null>(null);
  const [composerReplyTo, setComposerReplyTo] = useState<ComposerReplyTo | null>(null);

  const openComposer = (recipientId: string | null = null) => {
    setComposerPrefillRecipientId(recipientId);
    setComposerReplyTo(null);
    setComposerOpen(true);
  };

  const openComposerReply = (replyTo: ComposerReplyTo) => {
    setComposerPrefillRecipientId(null);
    setComposerReplyTo(replyTo);
    setComposerOpen(true);
  };

  // T/M/N/L switches the view directly. The active-tab style on the nav
  // already communicates the change, so no toast is fired — repeated
  // T/M/N/L taps would otherwise stack four toasts in a couple of seconds.
  useRelayKeyboardShortcuts({
    onSwitchView: (newView) => setView(newView),
    onShowHelp: () => setShowShortcutsHelp(true),
    onToggleRecording: () => openComposer(null),
  }, true);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fade-in shadow-xl">
      {/* Mode nav — Triage / Messages / Notes / Live + settings affordance */}
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
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="ml-auto p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          aria-label="Open Relay settings"
          title="Relay settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </nav>

      <div className="flex-1 overflow-hidden">
        {view === 'triage' && (
          <RelayTriageStream
            user={user}
            contacts={contacts}
            onOpenView={setView}
            onCompose={() => openComposer(null)}
            onReply={(recipientId) => openComposer(recipientId)}
            onReplyToThread={(threadId, threadLabel) =>
              openComposerReply({ kind: 'thread', threadId, threadLabel })
            }
          />
        )}
        {view === 'messages' && (
          <div className="h-full relative">
            {/* Audience picker floats at the top-right of the Messages body
                so the top nav stays the single mode signal. The renderer
                below fills the full body — its own header (search, contact
                list, etc.) flows underneath without competing chrome. */}
            <div className="absolute top-2 right-3 z-20">
              <MessagesAudiencePicker
                audience={messagesAudience}
                onChange={setMessagesAudience}
                isDarkMode={isDarkMode}
              />
            </div>
            <div className="h-full overflow-hidden">
              {messagesAudience === 'direct' && (
                <ClassicMode
                  onBack={() => setView('triage')}
                  apiKey={apiKey}
                  isDarkMode={isDarkMode}
                  initialContactId={initialContactId}
                />
              )}
              {messagesAudience === 'channel' && (
                <TeamVoxMode
                  onBack={() => setView('triage')}
                  apiKey={apiKey}
                  isDarkMode={isDarkMode}
                />
              )}
              {messagesAudience === 'broadcast' && (
                <PulseRadio
                  onBack={() => setView('triage')}
                  apiKey={apiKey}
                  isDarkMode={isDarkMode}
                />
              )}
            </div>
          </div>
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

      <RelayComposer
        isOpen={composerOpen}
        onClose={() => {
          setComposerOpen(false);
          setComposerPrefillRecipientId(null);
          setComposerReplyTo(null);
        }}
        isDarkMode={isDarkMode}
        prefillRecipientId={composerPrefillRecipientId}
        replyTo={composerReplyTo}
        contacts={contacts}
      />

      <RelaySettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default Relay;
