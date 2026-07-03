// RelayComposer — the new-voice-message launcher.
//
// Stage 4 of the Voxer→Relay rework: replaces the fake "Hold space to talk"
// pill that did nothing on the triage screen. Reachable from:
//  - The triage pill (now a real CTA)
//  - The global Space shortcut (when not focused in an input)
//
// Composition deliberately reuses the legacy Voxer record visual the user
// asked us to preserve: round mic button (PTTButton size='lg'), mono uppercase
// "HOLD TO TALK" pill below, two-line helper string. The accent is rose
// throughout — no more orange/indigo per-mode tints.
//
// Sends via voxModeService.uploadAndSendQuickVox: this is the simplest 1:1
// voice-message path; full multi-recipient + thread targeting belongs in a
// later stage with the audience picker.

import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, ArrowLeft, Mail, Link as LinkIcon, MicOff } from 'lucide-react';
import RecordButton from './RecordButton';
import RecordingPreview from './RecordingPreview';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { useVoxCaptureSettings } from '../../hooks/useVoxCaptureSettings';
import { toastMicError } from '../../utils/micErrors';
import { voxModeService } from '../../services/relay/voxModeService';
import toast from 'react-hot-toast';
import type { Contact } from '../../types';

type PulseContact = {
  id: string;
  name: string;
  avatarColor: string;
  handle: string;
  isVerified: boolean;
};

/**
 * Synthesised entry for a non-Pulse contact in the recipient picker. Picking
 * one routes the send through the share-link fallback path instead of
 * uploadAndSendQuickVox — there's no Pulse user row to deliver to.
 */
type ShareContact = {
  kind: 'share';
  id: string;
  name: string;
  avatarColor: string;
  email?: string;
  phone?: string;
};

type ResolvedRecipient =
  | { kind: 'pulse'; contact: PulseContact }
  | { kind: 'share'; contact: ShareContact };

/**
 * Reply context handed to the composer when the user invokes Reply on a
 * triage row. `kind: 'quick'` (or absent replyTo) → 1:1 quick vox path;
 * `kind: 'thread'` → voice-thread path with threadId for the destination,
 * skipping the recipient picker entirely.
 */
export type ComposerReplyTo =
  | { kind: 'quick'; recipientId: string; recipientName?: string }
  | { kind: 'thread'; threadId: string; threadLabel?: string };

interface RelayComposerProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  /** Pulse user id to pre-select as recipient (skips the picker step). */
  prefillRecipientId?: string | null;
  /** Reply context: routes the send to the matching service path. */
  replyTo?: ComposerReplyTo | null;
  /**
   * The user's full contact list (Pulse + non-Pulse). Used as the first-time
   * fallback when getPulseUsersAsContacts() returns empty: the picker shows
   * non-Pulse contacts under "Other contacts" so the user always has a path
   * forward (record → upload → share link via clipboard).
   */
  contacts?: Contact[];
}

const ROSE = '#f43f5e';
const ROSE_PROGRESS = '#fb7185';

// 1:1 voice messages should stay short — 3 minutes is the hard ceiling.
// The soft cap kicks in at 60s and just adds a visual hint; the recorder
// runs unimpeded until MAX_DURATION_SEC, where useVoxRecording auto-stops.
const SOFT_CAP_SEC = 60;
const MAX_DURATION_SEC = 180;

export const RelayComposer: React.FC<RelayComposerProps> = ({
  isOpen,
  onClose,
  isDarkMode = false,
  prefillRecipientId = null,
  replyTo = null,
  contacts: localContacts = [],
}) => {
  const isThreadReply = replyTo?.kind === 'thread';

  const [contacts, setContacts] = useState<PulseContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [recipient, setRecipient] = useState<ResolvedRecipient | null>(null);

  // Derive the share-fallback contact list from the local Contacts the parent
  // passed in: anyone who isn't already a Pulse user but is reachable (has
  // email or phone). The picker renders these under a separate "Other"
  // section so the first-time empty state stops being a dead end.
  const shareContacts: ShareContact[] = useMemo(() => {
    return localContacts
      .filter((c) => !c.pulseUserId && (c.email || c.phone))
      .map((c) => ({
        kind: 'share' as const,
        id: c.id,
        name: c.name,
        avatarColor: c.avatarColor || ROSE,
        email: c.email,
        phone: c.phone,
      }));
  }, [localContacts]);

  // This modal is the primary record surface. It now honors the Audio I/O
  // settings panel (device, quality preset, EC/NS/AGC) instead of hard-coding
  // voice_hd — the same settings-aware capture as the canonical StudioRecorder,
  // so both surfaces record identically. Defaults resolve to voice_hd, so with
  // untouched settings behaviour is unchanged; the difference only shows once
  // the user actually changes a setting.
  const capture = useVoxCaptureSettings();
  const {
    state: recordingState,
    duration,
    recordingData,
    recordingMode,
    setRecordingMode,
    startRecording,
    stopRecording,
    cancelRecording,
    sendRecording,
    handlePointerDown,
    handlePointerUp,
    handleToggleRecording,
  } = useVoxRecording({
    qualityPreset: capture.qualityPreset,
    deviceId: capture.deviceId,
    customAudioConstraints: capture.customAudioConstraints,
    maxDuration: MAX_DURATION_SEC,
  });

  const isOverSoftCap = recordingState === 'recording' && duration >= SOFT_CAP_SEC;
  const recordingProgress = recordingState === 'recording'
    ? Math.min(1, duration / MAX_DURATION_SEC)
    : 0;

  // Probe mic permission whenever the composer opens. The Permissions API
  // is browser-only and not universally supported — we treat any failure
  // as "unknown" so the UI doesn't pre-block users on browsers that don't
  // expose the query (Safari historically); the actual record call still
  // surfaces a toast on failure as a backstop.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      setMicPermission('unknown');
      return;
    }
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        if (cancelled) return;
        setMicPermission(status.state === 'denied' ? 'denied' : 'ok');
        status.onchange = () => {
          if (cancelled) return;
          setMicPermission(status.state === 'denied' ? 'denied' : 'ok');
        };
      })
      .catch(() => {
        if (!cancelled) setMicPermission('unknown');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Thread replies skip the recipient picker — the destination is the
    // thread itself, not a Pulse user — so we don't fetch the contact list
    // for that path.
    if (isThreadReply) {
      setContacts([]);
      setContactsLoading(false);
      setContactsError(null);
      setRecipient(null);
      return;
    }
    let cancelled = false;
    setContactsLoading(true);
    setContactsError(null);
    voxModeService
      .getPulseUsersAsContacts()
      .then((list) => {
        if (cancelled) return;
        setContacts(list);
        // If a recipient was prefilled (e.g. from a triage Reply action),
        // pre-select it so the composer opens straight to the record area.
        if (prefillRecipientId) {
          const match = list.find((c) => c.id === prefillRecipientId);
          if (match) setRecipient({ kind: 'pulse', contact: match });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setContactsError(err?.message ?? 'Could not load Pulse contacts');
      })
      .finally(() => {
        if (cancelled) return;
        setContactsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, prefillRecipientId, isThreadReply]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setRecipient(null);
      if (recordingState === 'recording') stopRecording();
      if (recordingState === 'preview') cancelRecording();
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q),
    );
  }, [contacts, search]);

  const filteredShare = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shareContacts;
    return shareContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)),
    );
  }, [shareContacts, search]);

  const [isSending, setIsSending] = useState(false);
  // Pre-flight microphone permission probe. We only short-circuit on the
  // explicit 'denied' state — 'prompt' continues to the existing record
  // path so the OS prompt fires at the natural moment (user pressing record).
  const [micPermission, setMicPermission] = useState<'unknown' | 'denied' | 'ok'>('unknown');

  const handleSend = async () => {
    if (!recordingData || isSending) return;

    // Resolve destination + label up front so the toast copy and the service
    // call agree, and so we can early-return cleanly if state is incomplete.
    let send: () => Promise<unknown | null>;
    let successLabel: string;

    if (isThreadReply && replyTo) {
      send = () =>
        voxModeService.uploadAndSendVoiceThreadMessage(
          replyTo.threadId,
          recordingData.blob,
          recordingData.duration,
        );
      successLabel = replyTo.threadLabel
        ? `Reply sent to ${replyTo.threadLabel}`
        : 'Reply sent to thread';
    } else if (recipient?.kind === 'pulse') {
      const pulse = recipient.contact;
      send = () =>
        voxModeService.uploadAndSendQuickVox(
          pulse.id,
          recordingData.blob,
          recordingData.duration,
        );
      successLabel = `Sent to ${pulse.name}`;
    } else if (recipient?.kind === 'share') {
      // Non-Pulse fallback: upload, then hand the URL to the OS share sheet
      // (where available) or copy to the clipboard. This keeps the first-time
      // user from hitting a dead end when no contacts are on Pulse yet.
      const share = recipient.contact;
      send = async () => {
        const url = await voxModeService.uploadAudioForShare(
          recordingData.blob,
          recordingData.duration,
        );
        if (!url) return null;
        const subject = `Voice message from Pulse`;
        const body = `Listen here: ${url}`;
        let shared = false;
        if (typeof navigator !== 'undefined' && navigator.share) {
          try {
            await navigator.share({ title: subject, text: body, url });
            shared = true;
          } catch {
            // user dismissed share sheet — fall through to clipboard
          }
        }
        if (!shared) {
          try {
            await navigator.clipboard.writeText(url);
          } catch (clipErr) {
            console.warn('Clipboard write failed', clipErr);
          }
          if (share.email) {
            const mailto = `mailto:${encodeURIComponent(share.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.open(mailto, '_blank', 'noopener,noreferrer');
          }
        }
        return url;
      };
      successLabel = share.email
        ? `Link copied & email opened for ${share.name}`
        : `Link copied — paste it to ${share.name}`;
    } else {
      return;
    }

    setIsSending(true);
    try {
      const result = await send();
      if (!result) {
        // Service returned null — treat as recoverable. Recording stays in
        // preview state so the user can hit Send again without re-recording.
        toast.error('Could not send. Try again.');
        return;
      }
      toast.success(successLabel);
      sendRecording(); // clears the preview buffer on confirmed success only
      onClose();
    } catch (err) {
      console.error('RelayComposer.handleSend', err);
      toast.error('Could not send. Try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleRecordToggle = () => {
    handleToggleRecording();
  };

  const handleRetry = () => {
    cancelRecording();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Compose voice message"
    >
      {/* Backdrop — flat dim, no glassmorphism. */}
      <button
        type="button"
        aria-label="Close composer"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      {/* Sheet — hairline border instead of drop-shadow for the brand
          discipline of "edges, not surfaces". The backdrop scrim above
          provides the modal-vs-page separation. */}
      <div
        className={`relative w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl ring-1 ${
          isDarkMode
            ? 'bg-zinc-950 ring-zinc-800'
            : 'bg-white ring-zinc-200'
        } flex flex-col max-h-[88vh] sm:max-h-[600px] overflow-hidden`}
      >
        {/* Header */}
        <div
          className={`px-4 py-3 flex items-center gap-2 border-b ${
            isDarkMode ? 'border-zinc-800' : 'border-zinc-200'
          }`}
        >
          {recipient && recordingState === 'idle' && !isThreadReply && (
            <button
              type="button"
              onClick={() => setRecipient(null)}
              className={`p-1 rounded-md transition ${
                isDarkMode ? 'hover:bg-zinc-900' : 'hover:bg-zinc-100'
              }`}
              aria-label="Pick a different recipient"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h2
            className={`flex-1 font-mono text-[11px] uppercase tracking-[0.1em] ${
              isDarkMode ? 'text-zinc-300' : 'text-zinc-700'
            }`}
          >
            {isThreadReply
              ? `Reply · ${replyTo?.threadLabel ?? 'Thread'}`
              : recipient
                ? recipient.kind === 'share'
                  ? `Share via link · ${recipient.contact.name}`
                  : `New voice message · ${recipient.contact.name}`
                : 'New voice message'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded-md transition ${
              isDarkMode ? 'hover:bg-zinc-900' : 'hover:bg-zinc-100'
            }`}
            aria-label="Close composer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — recipient picker / record / preview.
            Thread replies bypass the picker entirely (the destination is the
            thread itself, captured in replyTo.threadId).
            Outer container is overflow-hidden — only the picker (which holds
            a long contact list) opts back into scrolling internally. The
            record + preview branches fit the available height with no
            scrollbar even when the cancel-hint and waveform render above
            the PTT button. */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {micPermission === 'denied' && (
            <div
              className={`mx-4 mt-3 mb-1 rounded-md px-3 py-2 flex items-center gap-2 ring-1 ${
                isDarkMode
                  ? 'ring-rose-500/30 bg-rose-500/5'
                  : 'ring-rose-200 bg-rose-50'
              }`}
              role="alert"
            >
              <MicOff
                className={`w-3.5 h-3.5 shrink-0 ${
                  isDarkMode ? 'text-rose-400' : 'text-rose-600'
                }`}
              />
              <p
                className={`flex-1 min-w-0 text-xs ${
                  isDarkMode ? 'text-rose-200' : 'text-rose-700'
                }`}
              >
                Microphone blocked — allow access in browser settings, then reload.
              </p>
            </div>
          )}

          {!recipient && !isThreadReply && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <RecipientPicker
                isDarkMode={isDarkMode}
                search={search}
                onSearchChange={setSearch}
                contacts={filtered}
                shareContacts={filteredShare}
                isLoading={contactsLoading}
                error={contactsError}
                onPick={(picked) => setRecipient(picked)}
              />
            </div>
          )}

          {(recipient || isThreadReply) && recordingState !== 'preview' && (
            <div className="flex-1 min-h-0 px-6 pt-10 pb-6 flex flex-col items-center justify-center">
              <RecordButton
                state={
                  recordingState === 'recording' ? 'recording' :
                  recordingState === 'analyzing' ? 'processing' :
                  'idle'
                }
                recordingMode={recordingMode}
                duration={duration}
                onPointerDown={() => {
                  if (recordingState === 'idle') {
                    startRecording().catch((err) => {
                      console.error('startRecording failed', err);
                      toastMicError(err);
                    });
                  } else {
                    handlePointerDown();
                  }
                }}
                onPointerUp={handlePointerUp}
                onToggleRecording={() => {
                  if (recordingState === 'idle') {
                    startRecording().catch((err) => {
                      console.error('startRecording failed', err);
                      toastMicError(err);
                    });
                  } else {
                    handleRecordToggle();
                  }
                }}
                onModeToggle={() =>
                  setRecordingMode(recordingMode === 'hold' ? 'tap' : 'hold')
                }
                accentColor={ROSE}
                isDarkMode={isDarkMode}
                size="lg"
              />

              {/* Elapsed-vs-cap progress + soft-cap hint. Pulled tight to
                  the timer above so the recording cluster reads as one
                  vertical stack: button → timer → progress → hint. The
                  recording auto-stops at MAX_DURATION_SEC inside
                  useVoxRecording; this gives advance warning. */}
              {recordingState === 'recording' && (
                <div className="w-full max-w-[200px] -mt-1 flex flex-col items-center gap-1.5">
                  <div
                    className={`h-[3px] w-full rounded-full overflow-hidden ${
                      isDarkMode ? 'bg-zinc-800' : 'bg-zinc-200'
                    }`}
                    aria-hidden="true"
                  >
                    <div
                      className="h-full transition-[width] duration-200 ease-linear"
                      style={{
                        width: `${recordingProgress * 100}%`,
                        backgroundColor: isOverSoftCap ? ROSE : ROSE_PROGRESS,
                      }}
                    />
                  </div>
                  {isOverSoftCap && (
                    <p
                      className={`font-mono text-[10px] uppercase tracking-[0.12em] text-center ${
                        isDarkMode ? 'text-rose-300' : 'text-rose-600'
                      }`}
                      role="status"
                    >
                      Approaching {Math.floor(MAX_DURATION_SEC / 60)}-minute limit
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {(recipient || isThreadReply) && recordingState === 'preview' && recordingData && (
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <RecordingPreview
                recordingData={recordingData}
                onSend={handleSend}
                onCancel={() => {
                  cancelRecording();
                  onClose();
                }}
                onRetry={handleRetry}
                color={ROSE}
                progressColor={ROSE_PROGRESS}
                showAnalysis={false}
                isDarkMode={isDarkMode}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface RecipientPickerProps {
  isDarkMode: boolean;
  search: string;
  onSearchChange: (s: string) => void;
  contacts: PulseContact[];
  shareContacts: ShareContact[];
  isLoading: boolean;
  error: string | null;
  onPick: (recipient: ResolvedRecipient) => void;
}

const RecipientPicker: React.FC<RecipientPickerProps> = ({
  isDarkMode,
  search,
  onSearchChange,
  contacts,
  shareContacts,
  isLoading,
  error,
  onPick,
}) => (
  <div className="flex flex-col">
    <div
      className={`px-4 py-3 border-b ${
        isDarkMode ? 'border-zinc-800' : 'border-zinc-200'
      }`}
    >
      <label
        className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
          isDarkMode
            ? 'bg-zinc-900 border border-zinc-800'
            : 'bg-zinc-50 border border-zinc-200'
        }`}
      >
        <Search
          className={`w-4 h-4 ${
            isDarkMode ? 'text-zinc-500' : 'text-zinc-400'
          }`}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search Pulse contacts"
          className={`flex-1 bg-transparent outline-none text-sm ${
            isDarkMode
              ? 'text-zinc-100 placeholder:text-zinc-500'
              : 'text-zinc-900 placeholder:text-zinc-400'
          }`}
          autoFocus
        />
      </label>
    </div>

    {error && (
      <p
        className={`px-4 py-3 text-xs ${
          isDarkMode ? 'text-rose-400' : 'text-rose-600'
        }`}
      >
        {error}
      </p>
    )}

    {isLoading && (
      <ul
        className={`divide-y ${
          isDarkMode ? 'divide-zinc-800' : 'divide-zinc-200'
        }`}
        aria-hidden="true"
      >
        {Array.from({ length: 4 }).map((_, idx) => (
          <li key={idx} className="px-4 py-3 flex items-center gap-3 animate-pulse">
            <div
              className={`w-9 h-9 rounded-full ${
                isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'
              }`}
            />
            <div className="flex-1 space-y-2">
              <div
                className={`h-3 w-1/3 rounded ${
                  isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'
                }`}
              />
              <div
                className={`h-3 w-1/2 rounded ${
                  isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'
                }`}
              />
            </div>
          </li>
        ))}
      </ul>
    )}

    {!isLoading && contacts.length === 0 && shareContacts.length === 0 && !error && (
      <div className="p-8 text-center">
        <p
          className={`text-sm ${
            isDarkMode ? 'text-zinc-400' : 'text-zinc-500'
          }`}
        >
          {search
            ? 'No matches.'
            : 'No contacts yet. Add someone to your contacts to send a voice message.'}
        </p>
      </div>
    )}

    {!isLoading && contacts.length > 0 && (
      <>
        <SectionHeader label="Pulse contacts" isDarkMode={isDarkMode} />
        <ul
          className={`divide-y ${
            isDarkMode ? 'divide-zinc-800' : 'divide-zinc-200'
          }`}
        >
          {contacts.map((contact) => (
            <li key={`pulse-${contact.id}`}>
              <button
                type="button"
                onClick={() => onPick({ kind: 'pulse', contact })}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                  isDarkMode ? 'hover:bg-zinc-900/40' : 'hover:bg-zinc-50'
                }`}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                  style={{ backgroundColor: contact.avatarColor || ROSE }}
                  aria-hidden="true"
                >
                  {(contact.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-semibold truncate ${
                      isDarkMode ? 'text-zinc-100' : 'text-zinc-900'
                    }`}
                  >
                    {contact.name}
                  </div>
                  <div
                    className={`font-mono text-[11px] uppercase tracking-[0.1em] truncate ${
                      isDarkMode ? 'text-zinc-500' : 'text-zinc-400'
                    }`}
                  >
                    @{contact.handle || contact.id.slice(0, 6)}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </>
    )}

    {!isLoading && shareContacts.length > 0 && (
      <>
        <SectionHeader
          label={contacts.length > 0 ? 'Share via link' : 'Other contacts'}
          isDarkMode={isDarkMode}
          hint={contacts.length === 0 ? 'Not on Pulse — share via link' : undefined}
        />
        <ul
          className={`divide-y ${
            isDarkMode ? 'divide-zinc-800' : 'divide-zinc-200'
          }`}
        >
          {shareContacts.map((contact) => (
            <li key={`share-${contact.id}`}>
              <button
                type="button"
                onClick={() => onPick({ kind: 'share', contact })}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                  isDarkMode ? 'hover:bg-zinc-900/40' : 'hover:bg-zinc-50'
                }`}
              >
                {/* Avatar with a small share-icon badge so off-Pulse status is
                    a glance-able signal without crowding the name line. */}
                <div className="relative shrink-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white opacity-80"
                    style={{ backgroundColor: contact.avatarColor || ROSE }}
                    aria-hidden="true"
                  >
                    {(contact.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ring-2 ${
                      isDarkMode
                        ? 'bg-zinc-900 ring-zinc-950 text-zinc-400'
                        : 'bg-white ring-white text-zinc-500'
                    }`}
                    aria-label="Off Pulse — share via link"
                  >
                    <LinkIcon className="w-2.5 h-2.5" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-semibold truncate ${
                      isDarkMode ? 'text-zinc-100' : 'text-zinc-900'
                    }`}
                  >
                    {contact.name}
                  </div>
                  <div
                    className={`text-[11px] truncate flex items-center gap-1.5 ${
                      isDarkMode ? 'text-zinc-500' : 'text-zinc-400'
                    }`}
                  >
                    {contact.email ? (
                      <>
                        <Mail className="w-3 h-3" aria-hidden="true" />
                        <span className="truncate">{contact.email}</span>
                      </>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
                        Share via link
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </>
    )}
  </div>
);

const SectionHeader: React.FC<{ label: string; isDarkMode: boolean; hint?: string }> = ({
  label,
  isDarkMode,
  hint,
}) => (
  <div
    className={`px-4 pt-4 pb-2 flex items-baseline gap-3 ${
      isDarkMode ? 'bg-zinc-950' : 'bg-white'
    }`}
  >
    <div
      className={`font-mono text-[10px] uppercase tracking-[0.12em] shrink-0 ${
        isDarkMode ? 'text-zinc-500' : 'text-zinc-400'
      }`}
    >
      {label}
    </div>
    {hint && (
      <p
        className={`text-[11px] leading-snug truncate ${
          isDarkMode ? 'text-zinc-600' : 'text-zinc-400'
        }`}
      >
        {hint}
      </p>
    )}
  </div>
);

export default RelayComposer;
