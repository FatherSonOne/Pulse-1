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
import { Settings as SettingsIcon, Headphones } from 'lucide-react';
import { Contact } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useOutboxBadge } from '../hooks/useOutboxBadge';
import { useFeatures } from '../contexts/FeatureContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { settingsService } from '../services/settingsService';
import { taskService } from '../services/taskService';
import type { VoxNote } from '../services/relay/voxModeTypes';
import toast from 'react-hot-toast';

// Deterministic avatar color from a user id — shared with the Voice Studio
// message card + every Relay section. Status hues and the brand rose are
// excluded so a decorative avatar never collides with state-bearing signals.
import { avatarColorForId } from './Relay/studio/avatarColor';

// Keyboard shortcuts
import { useRelayKeyboardShortcuts, type RelayShortcutView } from '../hooks/useRelayKeyboardShortcuts';
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
  useElementWidth,
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

// SPACE / view / help shortcuts, centralized INSIDE the provider so SPACE can
// reach the studio transport. This is the single owner of the record gesture:
//   • A focused mode with a registered inline recorder (a Direct thread with a
//     contact selected, a channel, etc.) sets studio.hasRecorder → SPACE drives
//     studio.toggleRecording() and records inline to that target.
//   • Otherwise (Inbox/triage, or no target yet) → SPACE opens the composer's
//     recipient picker.
// Replaces the old container-level handler that ALWAYS opened the composer and
// fought each mode's own SPACE handler — two listeners fired at once, so the
// picker popped open AND the mode kicked off a hidden "ghost" recording that
// fought for the mic. Modes no longer register their own onToggleRecording.
const RelayShortcutBridge: React.FC<{
  onSwitchView: (view: RelayShortcutView) => void;
  onShowHelp: () => void;
  onCompose: () => void;
}> = ({ onSwitchView, onShowHelp, onCompose }) => {
  const { hasRecorder, toggleRecording } = useRelayStudio();
  useRelayKeyboardShortcuts(
    {
      onSwitchView,
      onShowHelp,
      onToggleRecording: () => {
        if (hasRecorder) toggleRecording();
        else onCompose();
      },
    },
    true,
  );
  return null;
};

// Live (Voice Rooms) is flag-gated OFF for GA — VoiceRooms is a LOCAL mic
// preview with no WebRTC peer transport yet (see VoiceRooms.tsx header), so
// rather than let users "join" a silent room we render this honest placeholder
// (launch blocker S0-2, relay-launch-readiness 2026-06-14). Flip the
// `relayLiveRooms` flag on — or land WebRTC transport (Sprint 4 S4-1) — to
// restore the real surface.
const RelayLiveComingSoon: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="h-full flex flex-col items-center justify-center text-center px-6">
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-[#f2f2f2] dark:bg-[rgba(255,255,255,0.055)]">
      <Headphones className="w-7 h-7 text-[#52525b] dark:text-[#b4b4b8]" />
    </div>
    <h2 className="text-lg font-semibold text-[#0f0f0f] dark:text-[#fafafa]">
      Live rooms are coming soon
    </h2>
    <p className="mt-1.5 max-w-sm text-sm text-[#52525b] dark:text-[#b4b4b8]">
      Real-time voice rooms aren't ready yet. In the meantime, use Channels for
      team voice, Broadcast to reach everyone, or Direct for 1:1.
    </p>
    <button
      type="button"
      onClick={onBack}
      className="mt-5 px-4 py-2 rounded-lg text-sm font-medium text-[#0f0f0f] dark:text-[#fafafa] bg-[#f2f2f2] hover:bg-[#e8e8e8] dark:bg-[rgba(255,255,255,0.055)] dark:hover:bg-[rgba(255,255,255,0.09)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f43f5e]"
    >
      Back to Inbox
    </button>
  </div>
);

interface RelayProps {
  /** @deprecated no-op — AI routing is server-side via edge functions. */
  apiKey?: string;
  contacts: Contact[];
  /** Pulse user id to land on inside Direct (e.g. opening a contact's DM). */
  initialContactId?: string;
  isDarkMode?: boolean;
  /** Command-palette deep-link: jump to a source and/or open the record
   *  composer. The `key` bump re-applies even when Relay is already mounted. */
  intent?: { view?: RelayView; compose?: boolean; contactId?: string; key: number } | null;
  /** Called once the intent has been applied so the parent can clear it —
   *  otherwise plain re-entry to Relay replays the stale deep-link. */
  onIntentConsumed?: () => void;
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

const Relay: React.FC<RelayProps> = ({ apiKey = '', contacts, initialContactId, isDarkMode = false, intent, onIntentConsumed }) => {
  // user.id powers the Triage stream's voice-source queries.
  const { user } = useAuth();
  // Live send-outbox counts → badges the Direct rail entry so a voice queued or
  // parked-failed for a contact you're not viewing stays visible from any view.
  const outboxBadge = useOutboxBadge(user?.id);
  // currentWorkspace scopes vox→task creation (deep-link P3) to extracted_tasks.
  const { currentWorkspace } = useWorkspace();

  // Live (Voice Rooms) is gated OFF for GA — no WebRTC peer transport yet, so
  // the rail entry is hidden and the Live view shows a "coming soon" placeholder
  // instead of letting users join a silent room (launch blocker S0-2).
  const { isFeatureEnabled } = useFeatures();
  const liveEnabled = isFeatureEnabled('relayLiveRooms');

  // Measure the Relay pane so the studio shell can lay out off the pane's real
  // width (the global nav + sources rail sit in front of it, so the viewport is
  // the wrong signal). Feeds RelayStudioProvider's responsive derivation.
  const [paneRef, paneWidth] = useElementWidth<HTMLDivElement>();

  // Initial view priority: parent deep-link > saved Settings preference > triage.
  // ClassicMode owns the per-contact selection (an explicit prop hand-off would
  // couple this wrapper to its internal state), so the value is forwarded below.
  // The saved preference is loaded async; we land on the deep-link-or-triage
  // default first and switch once settingsService resolves.
  const [view, setView] = useState<RelayView>(initialContactId ? 'direct' : 'triage');
  useEffect(() => {
    // Skip the preference load when the parent forced a destination via
    // initialContactId, OR when a cross-surface deep-link is pending
    // (pulse_focus_relay) — the deep-link wins by design. The pulse_focus_relay
    // reader below runs after this effect and drains the sentinel.
    if (initialContactId) return;
    if (sessionStorage.getItem('pulse_focus_relay')) return;
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
  // Bumped on every contact-bearing intent so ClassicMode remounts even when the
  // SAME contact is re-picked (its target is read only in mount-time initializers).
  const [retargetNonce, setRetargetNonce] = useState(0);
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

  // Apply a command-palette deep-link intent ("Relay: <source>" / "New voice
  // message"). Keyed on intent.key so a repeat selection re-fires even when the
  // value is unchanged and Relay is already mounted.
  useEffect(() => {
    if (!intent) return;
    // A "Vox <name>" deep-link carries the target contact: focus it and land on
    // Direct. The retarget nonce bumps so ClassicMode remounts and re-reads its
    // mount-only initializers even when the SAME contact is re-picked (e.g. after
    // stepping back to the contact list inside Direct).
    if (intent.contactId) {
      setFocusContactId(intent.contactId);
      setRetargetNonce((n) => n + 1);
    }
    if (intent.view) setView(intent.view);
    if (intent.compose) openComposer(null);
    // One-shot: let the parent clear the intent so plain re-entry to Relay (via
    // nav, not a palette command) doesn't replay a stale view / contact target.
    onIntentConsumed?.();
    // openComposer / onIntentConsumed are stable for this purpose; depend only
    // on the intent key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.key]);

  // Promote a voice note into a cockpit task (deep-link P3). Writes the canonical
  // extracted_tasks table with Relay provenance so the task appears in the
  // Decisions cockpit and "Open source" deep-links BACK to the exact note (the
  // pulse_focus_relay reader below reuses VoxNotesMode's initialNoteId).
  const handleCreateTaskFromNote = async (note: VoxNote) => {
    if (!currentWorkspace) {
      toast.error('No active workspace');
      return;
    }
    const title = (note.title?.trim() || note.transcript?.trim() || 'Voice note')
      .replace(/\s+/g, ' ')
      .slice(0, 120);
    const created = await taskService.createTask({
      workspace_id: currentWorkspace.id,
      title,
      status: 'todo',
      priority: 'medium',
      created_by: user?.id,
      metadata: { source: 'relay', relay_store: 'vox_notes', relay_vox_id: note.id },
    });
    toast[created ? 'success' : 'error'](created ? 'Added to Tasks' : 'Could not add to Tasks');
  };

  // Exact-item deep-link reader (cross-surface, P3) — the Decisions cockpit's
  // "Open source" affordance sets sessionStorage.pulse_focus_relay =
  // JSON{ store, id, channelId? } before dispatching pulse:navigate → App mounts
  // <Relay> fresh → this drains the sentinel and routes to the right section with
  // the item focused, reusing the existing initial*Id open-by-id hooks.
  //   vox_notes → Notes (initialNoteId), broadcasts → Broadcast (initialBroadcastId).
  //   quick_vox/team_vox → section-level only (Direct opens by contact, not message;
  //   Channel open-by-message is deferred — see the deep-link handoff doc).
  useEffect(() => {
    const raw = sessionStorage.getItem('pulse_focus_relay');
    if (!raw) return;
    sessionStorage.removeItem('pulse_focus_relay');
    let payload: { store?: string; id?: string; channelId?: string } | null = null;
    try { payload = JSON.parse(raw); } catch { return; }
    if (!payload?.store) return;

    switch (payload.store) {
      case 'vox_notes':
        if (payload.id) setFocusNoteId(payload.id);
        setView('notes');
        break;
      case 'broadcasts':
      case 'broadcast':
        if (payload.id) setFocusBroadcastId(payload.id);
        setView('broadcast');
        break;
      case 'quick_vox':
        setView('direct');
        break;
      case 'team_vox_messages':
        if (payload.channelId) setFocusThreadId(payload.channelId);
        setView('channel');
        break;
      default:
        break;
    }
  }, []);

  // Keyboard shortcuts (SPACE / view switch / help) are registered by
  // <RelayShortcutBridge> INSIDE the provider (below) so SPACE can reach
  // studio.toggleRecording for inline recording — the Phase 2 swap. Keeping it
  // here (outside the provider) forced the old always-open-composer behavior.

  return (
    <div className="h-full bg-white dark:bg-[#080808] rounded-2xl overflow-hidden border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] animate-fade-in shadow-xl">
      <RelayStudioProvider paneWidth={paneWidth}>
        <StudioLiveSync inLive={view === 'live'} />
        <RelayShortcutBridge
          onSwitchView={(newView) => setView(newView)}
          onShowHelp={() => setShowShortcutsHelp(true)}
          onCompose={() => openComposer(null)}
        />
        <div ref={paneRef} className="h-full flex">
          {/* Vertical sources rail — replaces the horizontal tab strip. */}
          <SourcesRail
            view={view}
            onSelectView={(v) => setView(v)}
            // Hide the Live rail entry while Voice Rooms is flag-gated off (S0-2).
            hiddenViews={liveEnabled ? undefined : ['live']}
            // Unread + playlist counts will wire to real services in Phase 2.
            // For now omit them so the rail doesn't show fabricated numbers.
            outbox={outboxBadge}
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
                  // Key on the resolved contact + retarget nonce so an external
                  // re-target (triage click / "Vox <name>" deep-link) remounts the
                  // thread — even to the SAME contact — since ClassicMode reads its
                  // target only in mount-time initializers.
                  key={`${focusContactId ?? initialContactId ?? 'relay-direct'}:${retargetNonce}`}
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
                  onCreateTask={handleCreateTaskFromNote}
                />
              )}
              {view === 'live' && liveEnabled && user && (
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
              {/* Gated off: honest placeholder instead of a silent room (S0-2).
                  Covers any path that lands on 'live' (saved pref, 'L'
                  shortcut, deep link) while the rail entry is hidden. */}
              {view === 'live' && !liveEnabled && (
                <RelayLiveComingSoon onBack={() => setView('triage')} />
              )}
            </div>

            {/* Persistent transport — hidden in Live, where you're in a
                synchronous WebRTC room (VoiceRooms owns its own controls) and
                async playback chrome would just be noise. Entering Live also
                stops any playing voice via <StudioLiveSync>.

                Tier 2 dedupe (fallback): the five source views own an in-pane
                record block (VoxRecordArea), so outside Inbox the footer runs
                as a PURE TRANSPORT (suppressIdle) — it appears only while a
                voice plays/records and never shows a "hit space to record"
                hint redundant with the in-pane recorder. */}
            {view !== 'live' && <StudioFooter suppressIdle={view !== 'triage'} />}

            {/* Record affordance.
                - Inbox: opens the composer (quick-capture needs recipient
                  picking the rail can't supply). forceIdleIcon keeps the Mic
                  glyph since this path doesn't drive studio.isRecording.
                - Source views: the UNIFIED record trigger — drives
                  studio.toggleRecording, which delegates to the focused mode's
                  registered recorder (its own capture + preview pipeline), and
                  the footer lights up its RECORDING surface. requireRecorder
                  hides it in modes not yet wired to the studio recorder (those
                  keep their in-pane block), so the rewire rolls out per mode. */}
            {view === 'triage' && (
              <FloatingMic
                onClick={() => openComposer(null)}
                forceIdleIcon
              />
            )}
            {(view === 'direct' || view === 'channel' || view === 'broadcast' || view === 'notes') && (
              <FloatingMic requireRecorder />
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
