// Relay — Path C "Voice Studio" shell.
//
// Path C lock-in (chosen 2026-05-23 off _design-playground/relay-redesign.html
// commit c59d4b8, refined at b64747c).
//
// Phase 1 cutover (this commit):
// - Top horizontal 6-tab strip → vertical <SourcesRail/> (200px ↔ 64px
//   collapsed, persists across sessions).
// - Persistent <StudioFooter/> at the bottom of the pane (idle by default;
//   playing state lights up when a mode body calls studio.play(); recording
//   state is wired but no Phase 1 caller invokes it — Phase 2 turf).
// - <FloatingMic/> in the bottom-right. Phase 1 keeps opening the existing
//   <RelayComposer/> modal (real audio capture lives there); the icon
//   stays in its idle "Mic" form via forceIdleIcon so it doesn't claim a
//   stop state the studio context isn't actually in.
// - Triage's user-facing label flips to "Inbox" in the rail. The route id
//   stays 'triage' so existing deep links, analytics, and the T/D/C/B/N/L
//   keyboard shortcut contract (useRelayKeyboardShortcuts.VIEW_MAP)
//   continue to work without churn.
//
// Phase 2 (later): rewrite each of the 6 mode bodies (RelayTriageStream,
// ClassicMode, TeamVoxMode, PulseRadio, VoxNotesMode, VoiceRooms) to the
// studio-card pattern using shared playback state from the context; swap
// FloatingMic + SPACE to inline recording via studio.toggleRecording and
// retire the RelayComposer modal in favor of the StudioFooter recording
// surface. None of that happens here.

import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Contact } from '../types';
import { useAuth } from '../hooks/useAuth';
import { settingsService } from '../services/settingsService';

// Deterministic avatar color from a user id. Matches the decorative palette
// used inside VoiceRooms' room-color picker — status hues (emerald/orange/
// red/yellow/blue-500) and the brand rose are deliberately excluded so the
// avatar never collides with state-bearing signals.
const RELAY_AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-sky-500',
  'bg-cyan-500',
  'bg-teal-500',
  'bg-slate-500',
] as const;

function avatarColorForId(id: string): string {
  if (!id) return RELAY_AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return RELAY_AVATAR_COLORS[hash % RELAY_AVATAR_COLORS.length];
}

// Keyboard shortcuts
import { useRelayKeyboardShortcuts } from '../hooks/useRelayKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from './Relay/VoxKeyboardShortcutsHelp';

// Audience renderers — Relay's six peer views each render one of these.
// Unchanged in Phase 1: they keep their existing internals and render inside
// the new studio shell as-is.
import {
  ClassicMode,
  VoxNotesMode,
  PulseRadio,
  TeamVoxMode,
  VoiceRooms,
} from './Relay/index';
import { RelayTriageStream } from './Relay/RelayTriageStream';
import { RelayComposer, type ComposerReplyTo } from './Relay/RelayComposer';
import { RelaySettings } from './Relay/RelaySettings';

// Path C — Voice Studio shell.
import {
  RelayStudioProvider,
  SourcesRail,
  StudioFooter,
  FloatingMic,
  useRelayStudio,
} from './Relay/studio';

// Stops async playback when entering a Live room — you're in a synchronous
// call, so a recorded voice shouldn't keep playing under it. Lives inside the
// provider so it can reach the studio transport (Relay itself renders the
// provider, so it can't call useRelayStudio directly).
const StudioLiveSync: React.FC<{ inLive: boolean }> = ({ inLive }) => {
  const { stop } = useRelayStudio();
  useEffect(() => {
    if (inLive) stop();
  }, [inLive, stop]);
  return null;
};

interface RelayProps {
  /** @deprecated no-op — AI routing is server-side via edge functions. */
  apiKey?: string;
  contacts: Contact[];
  /** Pulse user id to land on inside Direct (e.g. opening a contact's DM). */
  initialContactId?: string;
  isDarkMode?: boolean;
}

// Top-level views inside Relay. Triage is the default landing experience.
// The other five are the audience peers Messages used to bundle.
type RelayView = 'triage' | 'direct' | 'channel' | 'broadcast' | 'notes' | 'live';

const RELAY_VIEWS: readonly RelayView[] = [
  'triage',
  'direct',
  'channel',
  'broadcast',
  'notes',
  'live',
] as const;

const Relay: React.FC<RelayProps> = ({ apiKey = '', contacts, initialContactId, isDarkMode = false }) => {
  // user.id powers the Triage stream's voice-source queries.
  const { user } = useAuth();

  // Initial view priority: parent deep-link > saved Settings preference > triage.
  // ClassicMode owns the per-contact selection (an explicit prop hand-off would
  // couple this wrapper to its internal state), so the value is forwarded below.
  // The saved preference is loaded async; we land on the deep-link-or-triage
  // default first and switch once settingsService resolves.
  const [view, setView] = useState<RelayView>(initialContactId ? 'direct' : 'triage');
  useEffect(() => {
    // Skip the preference load when the parent forced a destination via
    // initialContactId — the deep-link wins by design.
    if (initialContactId) return;
    let cancelled = false;
    settingsService
      .get('relayDefaultView')
      .then((preferred) => {
        if (cancelled) return;
        if (preferred && RELAY_VIEWS.includes(preferred)) setView(preferred);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialContactId]);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerPrefillRecipientId, setComposerPrefillRecipientId] = useState<string | null>(null);
  const [composerReplyTo, setComposerReplyTo] = useState<ComposerReplyTo | null>(null);
  // Deep-link state — set when a triage row is clicked. Each body unmounts
  // when its view tab loses focus, so passing these as `initial*` props
  // gives one-shot scroll-to-and-select on next mount without coupling the
  // body's internal selection state to this wrapper.
  const [focusContactId, setFocusContactId] = useState<string | null>(initialContactId ?? null);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  const [focusBroadcastId, setFocusBroadcastId] = useState<string | null>(null);
  const [focusThreadId, setFocusThreadId] = useState<string | null>(null);

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

  // T/D/C/B/N/L switches the view directly. The active-tab style on the
  // rail already communicates the change, so no toast is fired — repeated
  // taps would otherwise stack toasts in a couple of seconds.
  //
  // Phase 1 contract: SPACE opens RelayComposer (existing behavior).
  // Phase 2 swaps to studio.toggleRecording for inline recording.
  useRelayKeyboardShortcuts({
    onSwitchView: (newView) => setView(newView),
    onShowHelp: () => setShowShortcutsHelp(true),
    onToggleRecording: () => openComposer(null),
  }, true);

  return (
    <div className="h-full bg-white dark:bg-[#080808] rounded-2xl overflow-hidden border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] animate-fade-in shadow-xl">
      <RelayStudioProvider>
        <StudioLiveSync inLive={view === 'live'} />
        <div className="h-full flex">
          {/* Vertical sources rail — replaces the horizontal tab strip. */}
          <SourcesRail
            view={view}
            onSelectView={(v) => setView(v)}
            // Unread + playlist counts will wire to real services in Phase 2.
            // For now omit them so the rail doesn't show fabricated numbers.
          />

          {/* Main pane: mode body + persistent footer + floating mic +
              top-right settings cog. */}
          <div className="flex-1 flex flex-col relative overflow-hidden">
            {/* Settings — moved from the old top-bar to top-right of the
                main pane. Single click, same modal as before. */}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="absolute top-2 right-3 z-10 p-1.5 rounded-md text-[#52525b] dark:text-[#b4b4b8] hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f43f5e]"
              aria-label="Open Relay settings"
              title="Relay settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>

            <div className="flex-1 overflow-hidden">
              {view === 'triage' && (
                <RelayTriageStream
                  user={user}
                  contacts={contacts}
                  onOpenView={(nextView, focus) => {
                    // Stash the focus target for the destination body. Each
                    // kind uses a different "initial*" prop because the
                    // bodies key off different identifiers (Pulse user id vs
                    // note id vs broadcast id vs thread id).
                    if (focus) {
                      if (focus.kind === 'note') {
                        setFocusNoteId(focus.id);
                      } else if (focus.kind === 'broadcast') {
                        setFocusBroadcastId(focus.id);
                      } else if (focus.kind === 'thread') {
                        setFocusThreadId(focus.id);
                      } else if (focus.senderId) {
                        // 'classic' / 'quick' both store the sender's pulse id;
                        // ClassicMode lands on that contact's thread.
                        setFocusContactId(focus.senderId);
                      }
                    }
                    setView(nextView);
                  }}
                  onCompose={() => openComposer(null)}
                  onReply={(recipientId) => openComposer(recipientId)}
                  onReplyToThread={(threadId, threadLabel) =>
                    openComposerReply({ kind: 'thread', threadId, threadLabel })
                  }
                />
              )}
              {view === 'direct' && (
                <ClassicMode
                  onBack={() => setView('triage')}
                  apiKey={apiKey}
                  isDarkMode={isDarkMode}
                  initialContactId={focusContactId ?? initialContactId}
                />
              )}
              {view === 'channel' && (
                <TeamVoxMode
                  onBack={() => setView('triage')}
                  apiKey={apiKey}
                  isDarkMode={isDarkMode}
                />
              )}
              {view === 'broadcast' && (
                <PulseRadio
                  onBack={() => setView('triage')}
                  apiKey={apiKey}
                  isDarkMode={isDarkMode}
                  initialBroadcastId={focusBroadcastId ?? undefined}
                />
              )}
              {view === 'notes' && (
                <VoxNotesMode
                  onBack={() => setView('triage')}
                  apiKey={apiKey}
                  isDarkMode={isDarkMode}
                  initialNoteId={focusNoteId ?? undefined}
                />
              )}
              {view === 'live' && user && (
                <VoiceRooms
                  isOpen
                  onClose={() => setView('triage')}
                  contacts={contacts}
                  currentUser={{
                    id: user.id,
                    name: user.name,
                    avatarColor: avatarColorForId(user.id),
                  }}
                />
              )}
            </div>

            {/* Persistent player + record affordance — hidden in Live, where
                you're in a synchronous WebRTC room (VoiceRooms owns its own
                controls) and the async playback / compose chrome would just
                be noise. Entering Live also stops any playing voice via
                <StudioLiveSync>. */}
            {view !== 'live' && (
              <>
                <StudioFooter />
                {/* Record affordance routes to the existing composer modal —
                    keeps real audio capture working without rewiring
                    useVoxRecording. forceIdleIcon keeps it on the Mic icon
                    since studio.isRecording isn't driven yet. */}
                <FloatingMic
                  onClick={() => openComposer(null)}
                  forceIdleIcon
                />
              </>
            )}
          </div>
        </div>

        {/* Modals + helpers — unchanged from the prior shell. */}
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
      </RelayStudioProvider>
    </div>
  );
};

export default Relay;
