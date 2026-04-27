/**
 * MessagesModalsPlugin
 *
 * Phase 5d.1 — the canonical modal layer for `MessagesSplitView`.
 *
 * This file is the migration target for the modals currently mounted
 * inside the legacy `Messages.tsx` (via `MessagesTopModals` and
 * `MessagesEndModals`). The legacy code path keeps working unchanged;
 * this plugin is what `MessagesSplitView` will mount in `renderModals`
 * once Phase 5e flips production.
 *
 * Architecture:
 *
 *   ┌────────────────────────────────────────────────────────┐
 *   │  <MessagesModalsProvider>                              │
 *   │    ↑ children call useMessagesModals() to open/close   │
 *   │                                                         │
 *   │    <MessagesSplitView                                   │
 *   │      renderModals={() => <MessagesModalsPlugin ... />} │
 *   │    />                                                   │
 *   └────────────────────────────────────────────────────────┘
 *
 * - The `Provider` owns visibility and transient form state for each
 *   modal. State is exposed via the `useMessagesModals` hook.
 * - The `Plugin` is the rendering surface. It reads from the context
 *   and renders the right modal(s) based on visibility flags. Data
 *   dependencies (threads, conversations, etc.) come via props.
 * - Children anywhere in the tree (input section, message bubble,
 *   conversation header) call `useMessagesModals().openSchedule()`
 *   etc. — they don't need to thread props.
 *
 * Modals covered: schedule, forward, invite-to-pulse, conversation
 * stats, keyboard shortcuts, delete-thread-confirm, and the feature
 * settings panel (Phase 5d.7 — toggle UI for the 30+ Phase 3-11
 * enhancements; lazy-loaded so the modal-layer chunk stays lean).
 *
 * Out of scope (deferred to follow-up sessions):
 *   - new-chat user search (data-heavy, needs pulseService wiring)
 *   - artifact viewer
 *   - invite-team modal (workspace-scoped concerns)
 *   - mobile drawer (different UX surface)
 */

import React, {
  createContext,
  Suspense,
  lazy,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  ScheduleMessageModal,
  ForwardMessageModal,
  ConversationStatsModal,
  InviteToPulseModal,
} from './modals';
import type { Contact, Message, Thread } from '../../types';
import type { PulseConversation } from '../../services/pulseService';

// Lazy-loaded — the feature settings panel is heavy (~580 LOC + the
// FeatureContext-driven toggle UI for 30+ enhancements) and rarely
// opened. Loading on demand keeps the modal-layer chunk lean.
const FeatureSettingsPanel = lazy(() =>
  import('./FeatureSettingsPanel').then((m) => ({ default: m.FeatureSettingsPanel })),
);

// ──────────────────────────────────────────────────────────────
// Context shape — what children can call to open/close modals
// ──────────────────────────────────────────────────────────────

interface MessagesModalsApi {
  // Schedule
  showSchedule: boolean;
  scheduleDate: string;
  scheduleTime: string;
  openSchedule: () => void;
  closeSchedule: () => void;
  setScheduleDate: (date: string) => void;
  setScheduleTime: (time: string) => void;

  // Forward
  showForward: boolean;
  forwardingMessage: Message | null;
  openForward: (msg: Message) => void;
  closeForward: () => void;

  // Invite to Pulse
  showInviteToPulse: boolean;
  inviteTargetContact: Contact | null;
  openInviteToPulse: (contact: Contact) => void;
  closeInviteToPulse: () => void;

  // Conversation stats
  showStats: boolean;
  openStats: () => void;
  closeStats: () => void;

  // Keyboard shortcuts
  showShortcuts: boolean;
  openShortcuts: () => void;
  closeShortcuts: () => void;

  // Delete confirmation
  showDeleteConfirm: boolean;
  threadToDelete: string | null;
  openDeleteConfirm: (threadId: string) => void;
  closeDeleteConfirm: () => void;

  // Feature settings panel (Phase 5d.7)
  showFeatureSettings: boolean;
  openFeatureSettings: () => void;
  closeFeatureSettings: () => void;
}

const MessagesModalsContext = createContext<MessagesModalsApi | null>(null);

/** Hook for descendants to trigger modals from anywhere in the tree. */
export function useMessagesModals(): MessagesModalsApi {
  const ctx = useContext(MessagesModalsContext);
  if (!ctx) {
    throw new Error(
      'useMessagesModals must be used inside <MessagesModalsProvider>',
    );
  }
  return ctx;
}

// ──────────────────────────────────────────────────────────────
// Provider — owns all modal visibility + transient form state
// ──────────────────────────────────────────────────────────────

export const MessagesModalsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Schedule
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Forward
  const [showForward, setShowForward] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

  // Invite to Pulse
  const [showInviteToPulse, setShowInviteToPulse] = useState(false);
  const [inviteTargetContact, setInviteTargetContact] = useState<Contact | null>(null);

  // Conversation stats
  const [showStats, setShowStats] = useState(false);

  // Keyboard shortcuts
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);

  // Feature settings panel
  const [showFeatureSettings, setShowFeatureSettings] = useState(false);

  // ── Actions ────────────────────────────────────────────────

  const openSchedule = useCallback(() => setShowSchedule(true), []);
  const closeSchedule = useCallback(() => {
    setShowSchedule(false);
    setScheduleDate('');
    setScheduleTime('');
  }, []);

  const openForward = useCallback((msg: Message) => {
    setForwardingMessage(msg);
    setShowForward(true);
  }, []);
  const closeForward = useCallback(() => {
    setShowForward(false);
    setForwardingMessage(null);
  }, []);

  const openInviteToPulse = useCallback((contact: Contact) => {
    setInviteTargetContact(contact);
    setShowInviteToPulse(true);
  }, []);
  const closeInviteToPulse = useCallback(() => {
    setShowInviteToPulse(false);
    setInviteTargetContact(null);
  }, []);

  const openStats = useCallback(() => setShowStats(true), []);
  const closeStats = useCallback(() => setShowStats(false), []);

  const openShortcuts = useCallback(() => setShowShortcuts(true), []);
  const closeShortcuts = useCallback(() => setShowShortcuts(false), []);

  const openDeleteConfirm = useCallback((threadId: string) => {
    setThreadToDelete(threadId);
    setShowDeleteConfirm(true);
  }, []);
  const closeDeleteConfirm = useCallback(() => {
    setShowDeleteConfirm(false);
    setThreadToDelete(null);
  }, []);

  const openFeatureSettings = useCallback(() => setShowFeatureSettings(true), []);
  const closeFeatureSettings = useCallback(() => setShowFeatureSettings(false), []);

  const value = useMemo<MessagesModalsApi>(() => ({
    showSchedule, scheduleDate, scheduleTime,
    openSchedule, closeSchedule, setScheduleDate, setScheduleTime,
    showForward, forwardingMessage,
    openForward, closeForward,
    showInviteToPulse, inviteTargetContact,
    openInviteToPulse, closeInviteToPulse,
    showStats, openStats, closeStats,
    showShortcuts, openShortcuts, closeShortcuts,
    showDeleteConfirm, threadToDelete,
    openDeleteConfirm, closeDeleteConfirm,
    showFeatureSettings, openFeatureSettings, closeFeatureSettings,
  }), [
    showSchedule, scheduleDate, scheduleTime,
    openSchedule, closeSchedule,
    showForward, forwardingMessage,
    openForward, closeForward,
    showInviteToPulse, inviteTargetContact,
    openInviteToPulse, closeInviteToPulse,
    showStats, openStats, closeStats,
    showShortcuts, openShortcuts, closeShortcuts,
    showDeleteConfirm, threadToDelete,
    openDeleteConfirm, closeDeleteConfirm,
    showFeatureSettings, openFeatureSettings, closeFeatureSettings,
  ]);

  return (
    <MessagesModalsContext.Provider value={value}>
      {children}
    </MessagesModalsContext.Provider>
  );
};

// ──────────────────────────────────────────────────────────────
// Plugin — rendering surface; mount via MessagesSplitView.renderModals
// ──────────────────────────────────────────────────────────────

interface ConversationStatsData {
  totalMessages: number;
  averageResponseTime: number;
  sentByMe: number;
  sentByThem: number;
  attachments: number;
  decisions: { approved: number; pending: number };
  tasksCreated: number;
}

interface MessagesModalsPluginProps {
  /** Conversations available as forward targets. */
  pulseConversations: PulseConversation[];
  /** The currently active Pulse conversation id (excluded from forward
   *  targets). */
  activePulseConversationId: string | null;
  /** Persists a scheduled message via pulseService.scheduleMessage. */
  inputText: string;
  scheduledMessages: Array<{ id: string; text: string; scheduledFor: Date }>;
  onSchedule: (text: string, scheduledFor: Date) => Promise<void> | void;

  /** Forwards a Pulse message to another Pulse conversation. */
  onForwardPulseMessage: (messageId: string, targetRecipientId: string) => Promise<void> | void;

  /** Invite-to-Pulse: host owns the email/SMS/copy actions and tracks
   *  isSent / isCopied so the modal can show success states. */
  inviteToPulseState: { isSent: boolean; isCopied: boolean };
  onInviteSendEmail: () => void;
  onInviteCopyLink: () => void;
  onInviteSendSms: () => void;
  onInviteDone: () => void;

  /** Stats payload for the conversation stats modal. */
  statsData?: ConversationStatsData;

  /** Confirms thread deletion. Host actually performs the delete. */
  onConfirmDeleteThread?: (threadId: string) => Promise<void> | void;

  /** Optional: legacy threads list for the deprecated SMS forward path. */
  threads?: Thread[];
  onForwardLegacyThread?: (targetThreadId: string) => void;
}

export const MessagesModalsPlugin: React.FC<MessagesModalsPluginProps> = ({
  pulseConversations,
  activePulseConversationId,
  inputText,
  scheduledMessages,
  onSchedule,
  onForwardPulseMessage,
  inviteToPulseState,
  onInviteSendEmail,
  onInviteCopyLink,
  onInviteSendSms,
  onInviteDone,
  statsData,
  onConfirmDeleteThread,
  threads,
  onForwardLegacyThread,
}) => {
  const m = useMessagesModals();

  // ── Schedule submit handler ────────────────────────────────
  const handleSchedule = useCallback(async () => {
    if (!inputText.trim() || !m.scheduleDate || !m.scheduleTime) return;
    const scheduledFor = new Date(`${m.scheduleDate}T${m.scheduleTime}`);
    if (scheduledFor <= new Date()) return;
    try {
      await onSchedule(inputText, scheduledFor);
      m.closeSchedule();
    } catch (err) {
      console.error('[MessagesModalsPlugin] schedule failed:', err);
    }
  }, [inputText, m.scheduleDate, m.scheduleTime, m, onSchedule]);

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      {/* Schedule Message */}
      <ScheduleMessageModal
        isOpen={m.showSchedule}
        onClose={m.closeSchedule}
        messageText={inputText}
        scheduleDate={m.scheduleDate}
        scheduleTime={m.scheduleTime}
        onDateChange={m.setScheduleDate}
        onTimeChange={m.setScheduleTime}
        scheduledMessages={scheduledMessages.map((s) => ({
          id: s.id,
          text: s.text,
          scheduledFor: s.scheduledFor,
        }))}
        onSchedule={handleSchedule}
      />

      {/* Forward Message — Pulse conversations preferred; legacy
       *  threads fall back if the host opts in. */}
      {m.showForward && m.forwardingMessage && (
        <PulseForwardModal
          isOpen={m.showForward}
          onClose={m.closeForward}
          message={m.forwardingMessage}
          pulseConversations={pulseConversations}
          activePulseConversationId={activePulseConversationId}
          onForwardPulse={onForwardPulseMessage}
          legacyThreads={threads}
          onForwardLegacy={onForwardLegacyThread}
        />
      )}

      {/* Invite to Pulse */}
      {m.showInviteToPulse && m.inviteTargetContact && (
        <InviteToPulseModal
          isOpen={m.showInviteToPulse}
          onClose={m.closeInviteToPulse}
          targetContact={{
            name: m.inviteTargetContact.name,
            email: m.inviteTargetContact.email ?? undefined,
            phone: m.inviteTargetContact.phone ?? undefined,
          }}
          isSent={inviteToPulseState.isSent}
          isCopied={inviteToPulseState.isCopied}
          onSendEmail={onInviteSendEmail}
          onCopyLink={onInviteCopyLink}
          onSendSMS={onInviteSendSms}
          onDone={() => {
            onInviteDone();
            m.closeInviteToPulse();
          }}
        />
      )}

      {/* Conversation Stats */}
      <ConversationStatsModal
        isOpen={m.showStats}
        onClose={m.closeStats}
        stats={statsData ?? null}
      />


      {/* Keyboard Shortcuts */}
      {m.showShortcuts && (
        <KeyboardShortcutsModal onClose={m.closeShortcuts} />
      )}

      {/* Delete confirmation */}
      {m.showDeleteConfirm && m.threadToDelete && (
        <DeleteThreadConfirmModal
          threadId={m.threadToDelete}
          onCancel={m.closeDeleteConfirm}
          onConfirm={async () => {
            const id = m.threadToDelete;
            if (!id) return;
            try {
              await onConfirmDeleteThread?.(id);
            } finally {
              m.closeDeleteConfirm();
            }
          }}
        />
      )}

      {/* Feature settings panel — Phase 5d.7 */}
      {m.showFeatureSettings && (
        <Suspense fallback={null}>
          <FeatureSettingsPanel
            isOpen={m.showFeatureSettings}
            onClose={m.closeFeatureSettings}
          />
        </Suspense>
      )}
    </>
  );
};

// ──────────────────────────────────────────────────────────────
// Internal: small modals not yet extracted into Messages/modals/
// Kept inline for now; can be promoted to dedicated files later.
// ──────────────────────────────────────────────────────────────

interface PulseForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message;
  pulseConversations: PulseConversation[];
  activePulseConversationId: string | null;
  onForwardPulse: (messageId: string, targetRecipientId: string) => Promise<void> | void;
  legacyThreads?: Thread[];
  onForwardLegacy?: (threadId: string) => void;
}

const PulseForwardModal: React.FC<PulseForwardModalProps> = ({
  isOpen,
  onClose,
  message,
  pulseConversations,
  activePulseConversationId,
  onForwardPulse,
  legacyThreads,
  onForwardLegacy,
}) => {
  if (!isOpen) return null;
  const targets = pulseConversations.filter(
    (c) => c.id !== activePulseConversationId && c.other_user,
  );
  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
          <h3 className="font-bold dark:text-white">Forward Message</h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4">
          <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg text-sm text-zinc-600 dark:text-zinc-300 mb-4 max-h-32 overflow-y-auto">
            {message.text}
          </div>
          <div className="text-xs text-zinc-500 mb-2">Forward to:</div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {targets.length > 0 ? (
              targets.map((conv) => {
                const other = conv.other_user!;
                const label = other.display_name || other.full_name || other.handle || 'Unknown';
                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      void onForwardPulse(message.id, other.id);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {other.avatar_url
                        ? <img src={other.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        : label.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm dark:text-white text-left">{label}</span>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-6 text-zinc-400 dark:text-zinc-500 text-sm">
                No other Pulse conversations to forward to
              </div>
            )}
            {/* Legacy SMS-thread fallback (opt-in) */}
            {legacyThreads && legacyThreads.length > 0 && onForwardLegacy && (
              <>
                <div className="text-xs text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-200 dark:border-zinc-700 mt-2 mb-1">
                  Legacy threads
                </div>
                {legacyThreads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onForwardLegacy(t.id);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <div className={`w-8 h-8 rounded-full ${t.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                      {t.contactName.charAt(0)}
                    </div>
                    <span className="text-sm dark:text-white">{t.contactName}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const KeyboardShortcutsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div
      className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
        <h3 className="font-bold dark:text-white">Keyboard Shortcuts</h3>
        <button onClick={onClose} aria-label="Close" className="text-zinc-500">×</button>
      </div>
      <dl className="p-4 grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-zinc-600 dark:text-zinc-400">Next thread</dt>
        <dd className="text-zinc-900 dark:text-white font-mono text-xs">Ctrl + ]</dd>
        <dt className="text-zinc-600 dark:text-zinc-400">Previous thread</dt>
        <dd className="text-zinc-900 dark:text-white font-mono text-xs">Ctrl + [</dd>
        <dt className="text-zinc-600 dark:text-zinc-400">Jump to search</dt>
        <dd className="text-zinc-900 dark:text-white font-mono text-xs">Ctrl + J</dd>
        <dt className="text-zinc-600 dark:text-zinc-400">Toggle this help</dt>
        <dd className="text-zinc-900 dark:text-white font-mono text-xs">?</dd>
        <dt className="text-zinc-600 dark:text-zinc-400">Close modals / clear search</dt>
        <dd className="text-zinc-900 dark:text-white font-mono text-xs">Esc</dd>
      </dl>
    </div>
  </div>
);

const DeleteThreadConfirmModal: React.FC<{
  threadId: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ threadId, onCancel, onConfirm }) => (
  <div
    className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onCancel}
  >
    <div
      className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-5"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="font-bold text-lg dark:text-white mb-2">Delete this thread?</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-5">
        This action cannot be undone. The thread and all its messages will be permanently removed.
      </p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 rounded-lg text-sm bg-rose-500 text-white hover:bg-rose-600 transition"
          data-thread-id={threadId}
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

export default MessagesModalsPlugin;
