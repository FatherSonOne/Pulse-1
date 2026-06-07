import React from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  AtSign,
  CheckCircle2,
  FileText,
  History,
  Keyboard,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Plus,
  Search,
  Share,
  Smartphone,
  SquarePen,
  Trash2,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { SearchUserResult, PulseConversation } from '../../services/pulseService';
import { Message, Thread, ChannelArtifact } from '../../types';
import { messagesExportService } from '../../services/messagesExportService';
import { MobileDrawer } from './MobileDrawer';
import {
  ScheduleMessageModal,
  ConversationStatsModal,
  InviteTeamModal,
} from './modals';

const KEYBOARD_SHORTCUTS: Record<string, string> = {
  'J': 'Next conversation',
  'K': 'Previous conversation',
  'Enter': 'Open conversation under cursor',
  'R': 'Focus composer',
  '?': 'Toggle this overlay',
  '⌘N': 'New conversation',
  '⌘K': 'Open command palette',
  '⌘Enter': 'Send message',
  'Esc': 'Close modal / leave composer',
  '⇧F': 'Toggle Focus Mode',
};

// Slack-grounded Messages front-door: enter an email to start a 1:1 Slack DM as yourself.
// The parent resolves the email -> Slack user, mints the thread, and opens it (closing the
// modal on success); we own only the input + inline busy/error feedback. Plum, not coral/rose.
function SlackDmStarter({
  onStart,
}: {
  onStart: (email: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    const trimmed = email.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const res = await onStart(trimmed);
    setBusy(false);
    if (!res.ok) setError(res.error || 'Could not start the Slack chat');
    // On success the parent closes the modal — nothing more to do here.
  };

  return (
    <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
      <p className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-[0.1em] mb-2 px-1">
        <MessagesSquare className="mr-1 inline w-3 h-3 text-purple-500" /> Message on Slack (as you)
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="their@email.com"
          className="flex-1 min-w-0 px-3 py-2.5 bg-[var(--pulse-surface-raised)] border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.10)] rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <button
          onClick={submit}
          disabled={busy || !email.trim()}
          className="px-3.5 py-2.5 rounded-xl text-sm font-medium bg-purple-500/10 dark:bg-purple-500/15 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0 transition"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessagesSquare className="w-4 h-4" />}
          Slack
        </button>
      </div>
      {error && <p className="text-xs text-rose-500 mt-2 px-1">{error}</p>}
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2 px-1">
        Delivered as you via Slack; opens as a “via Slack” thread.
      </p>
    </div>
  );
}

export interface MessagesTopModalsProps {
  // ---- New Chat Modal ----
  showNewChatModal: boolean;
  setShowNewChatModal: (open: boolean) => void;
  pulseUserSearch: string;
  setPulseUserSearch: (value: string) => void;
  pulseSearchResults: SearchUserResult[];
  setPulseSearchResults: (results: SearchUserResult[]) => void;
  isSearchingPulseUsers: boolean;
  recentPulseContacts: SearchUserResult[];
  suggestedPulseUsers: SearchUserResult[];
  startPulseConversation: (user: SearchUserResult) => void;
  /** Slack-grounded Messages: show the "message someone on Slack (as you)" entry. */
  slackGroundingEnabled?: boolean;
  /** Start a Slack DM by email; resolves + opens the thread, returns inline feedback. */
  onStartSlackConversation?: (email: string) => Promise<{ ok: boolean; error?: string }>;

  // ---- Artifact Modal ----
  showArtifactModal: boolean;
  setShowArtifactModal: (open: boolean) => void;
  loadingArtifact: boolean;
  artifact: ChannelArtifact | null;
  exportingToDocs: boolean;
  handleExportToDocs: () => void;
  handleSaveArtifact: () => void;

  // ---- Schedule Message Modal ----
  showScheduleModal: boolean;
  setShowScheduleModal: (open: boolean) => void;
  inputText: string;
  scheduleDate: string;
  scheduleTime: string;
  setScheduleDate: (value: string) => void;
  setScheduleTime: (value: string) => void;
  scheduledMessages: Array<{ id: string; text: string; scheduledFor: Date; threadId: string }>;
  handleScheduleMessage: () => void;

  // ---- Forward Message Modal ----
  showForwardModal: boolean;
  setShowForwardModal: (open: boolean) => void;
  forwardingMessage: Message | null;
  threads: Thread[];
  activeThreadId: string;
  handleForwardMessage: (targetThreadId: string) => void;
  /** Forward a Pulse message to another Pulse conversation. Optional so
   *  the legacy SMS-thread forward path keeps working. */
  handleForwardPulseMessage?: (messageId: string, targetRecipientId: string) => Promise<void> | void;

  // ---- Keyboard Shortcuts Modal ----
  showShortcuts: boolean;
  setShowShortcuts: (open: boolean) => void;

  // ---- Thread Statistics Panel ----
  showStatsPanel: boolean;
  setShowStatsPanel: (open: boolean) => void;
  activeThread: Thread | null | undefined;

  // ---- Invite Team Modal ----
  showInviteModal: boolean;
  setShowInviteModal: (open: boolean) => void;
  inviteEmail: string;
  setInviteEmail: (value: string) => void;
  inviteStatus: 'idle' | 'sending' | 'success' | 'error';
  setInviteStatus: (status: 'idle' | 'sending' | 'success' | 'error') => void;
  inviteMessage: string;
  setInviteMessage: (value: string) => void;
  handleSendInvite: () => void;

  // ---- Delete Confirmation Modal ----
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (open: boolean) => void;
  threadToDelete: string | null;
  setThreadToDelete: (id: string | null) => void;
  handleDeleteThread: () => void;

  // ---- Mobile Drawer ----
  isDrawerOpen: boolean;
  closeDrawer: () => void;
  setShowCellularSMS: (open: boolean) => void;
  pulseConversations: PulseConversation[];
  drawerListRef: React.RefObject<HTMLDivElement>;
  drawerTotalHeight: number;
  virtualDrawerConversations: Array<{ item: PulseConversation; style: React.CSSProperties }>;
  activePulseConversation: string | null;
  handleSelectConversation: (convId: string) => void;
}

export const MessagesTopModals = React.memo<MessagesTopModalsProps>((props) => {
  // Focus traps for each inline modal (sub-component modals manage their own traps).
  const newChatRef = useFocusTrap<HTMLDivElement>({
    active: props.showNewChatModal,
    onEscape: () => { props.setShowNewChatModal(false); props.setPulseUserSearch(''); props.setPulseSearchResults([]); },
  });
  const artifactRef = useFocusTrap<HTMLDivElement>({
    active: props.showArtifactModal,
    onEscape: () => props.setShowArtifactModal(false),
  });
  const forwardRef = useFocusTrap<HTMLDivElement>({
    active: props.showForwardModal && !!props.forwardingMessage,
    onEscape: () => props.setShowForwardModal(false),
  });
  const shortcutsRef = useFocusTrap<HTMLDivElement>({
    active: props.showShortcuts,
    onEscape: () => props.setShowShortcuts(false),
  });
  const deleteRef = useFocusTrap<HTMLDivElement>({
    active: props.showDeleteConfirm && !!props.threadToDelete,
    onEscape: () => { props.setShowDeleteConfirm(false); props.setThreadToDelete(null); },
  });

  const anyVisible =
    props.showNewChatModal ||
    props.showArtifactModal ||
    props.showScheduleModal ||
    props.showForwardModal ||
    props.showShortcuts ||
    (props.showStatsPanel && !!props.activeThread) ||
    props.showInviteModal ||
    props.showDeleteConfirm ||
    props.isDrawerOpen;

  if (!anyVisible) return null;

  return (
    <>
      {/* New Chat Modal */}
      {props.showNewChatModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div ref={newChatRef} role="dialog" aria-modal="true" aria-label="New conversation" className="bg-white dark:bg-[rgba(255,255,255,0.03)] w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
            <div className="p-4 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] flex justify-between items-center">
              <h3 className="font-bold dark:text-white flex items-center gap-2">
                <Plus className="text-rose-500" /> New Conversation
              </h3>
              <button onClick={() => { props.setShowNewChatModal(false); props.setPulseUserSearch(''); props.setPulseSearchResults([]); }}>
                <X className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300" />
              </button>
            </div>

            <div className="p-4">
              {/* Pulse Users Only */}
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm" />
                  <input
                    type="text"
                    value={props.pulseUserSearch}
                    onChange={(e) => props.setPulseUserSearch(e.target.value)}
                    placeholder="Search by @handle or name..."
                    className="w-full pl-10 pr-4 py-3 bg-[var(--pulse-surface-raised)] border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.10)] rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    autoFocus
                  />
                  {props.isSearchingPulseUsers && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 animate-spin" />
                  )}
                </div>

                {props.pulseUserSearch.length < 1 ? (
                  <div className="space-y-4 max-h-80 overflow-y-auto">
                    {/* Recent Contacts */}
                    {props.recentPulseContacts.length > 0 && (
                      <div>
                        <p className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-[0.1em] mb-2 px-1">
                          <History className="mr-1" /> Recent
                        </p>
                        <div className="space-y-1">
                          {props.recentPulseContacts.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => props.startPulseConversation(user)}
                              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition text-left"
                            >
                              <div className="w-9 h-9 rounded-full bg-[var(--pulse-rose-soft)] flex items-center justify-center text-[var(--pulse-coral-fg)] font-medium text-sm">
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  (user.display_name || user.full_name || 'U').charAt(0)
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium dark:text-white truncate text-sm flex items-center gap-1">
                                  {user.display_name || user.full_name || 'Pulse User'}
                                  {user.is_verified && <CheckCircle2 className="text-[var(--pulse-rose)] text-[10px]" />}
                                </div>
                                {user.handle && <div className="text-[11px] text-emerald-500 truncate">@{user.handle}</div>}
                              </div>
                              <MessageSquare className="text-emerald-400 text-xs" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested Users */}
                    {props.suggestedPulseUsers.length > 0 && (
                      <div>
                        <p className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-[0.1em] mb-2 px-1">
                          <Users className="mr-1" /> Discover Pulse Users
                        </p>
                        <div className="space-y-1">
                          {props.suggestedPulseUsers.slice(0, 8).map((user) => (
                            <button
                              key={user.id}
                              onClick={() => props.startPulseConversation(user)}
                              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition text-left"
                            >
                              <div className="w-9 h-9 rounded-full bg-[var(--pulse-rose-soft)] flex items-center justify-center text-[var(--pulse-coral-fg)] font-medium text-sm">
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  (user.display_name || user.full_name || 'U').charAt(0)
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium dark:text-white truncate text-sm flex items-center gap-1">
                                  {user.display_name || user.full_name || 'Pulse User'}
                                  {user.is_verified && <CheckCircle2 className="text-[var(--pulse-rose)] text-[10px]" />}
                                </div>
                                {user.handle && <div className="text-[11px] text-emerald-500 truncate">@{user.handle}</div>}
                              </div>
                              <Plus className="text-zinc-400 text-xs" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No suggestions available */}
                    {props.recentPulseContacts.length === 0 && props.suggestedPulseUsers.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AtSign className="text-2xl text-emerald-500" />
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Search for Pulse users by their @handle or name
                        </p>
                      </div>
                    )}
                  </div>
                ) : props.pulseSearchResults.length === 0 && !props.isSearchingPulseUsers ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-[var(--pulse-surface-raised)] rounded-full flex items-center justify-center mx-auto mb-4">
                      <UserX className="text-2xl text-zinc-400" />
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      No users found for "{props.pulseUserSearch}"
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                      Try a different search term
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {props.pulseSearchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => props.startPulseConversation(user)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition text-left border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                      >
                        <div className="w-10 h-10 rounded-full bg-[var(--pulse-rose-soft)] flex items-center justify-center text-[var(--pulse-coral-fg)] font-medium">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            (user.display_name || user.full_name || 'U').charAt(0)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium dark:text-white truncate flex items-center gap-2">
                            {user.display_name || user.full_name || 'Pulse User'}
                            {user.is_verified && (
                              <CheckCircle2 className="text-[var(--pulse-rose)] text-xs" />
                            )}
                          </div>
                          {user.handle && (
                            <div className="text-xs text-emerald-500 truncate">@{user.handle}</div>
                          )}
                        </div>
                        <MessageSquare className="text-emerald-400 text-sm" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {props.slackGroundingEnabled && props.onStartSlackConversation && (
                <SlackDmStarter onStart={props.onStartSlackConversation} />
              )}
            </div>

            <div className="border-t border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] mt-4 pt-4 px-4 pb-4">
              <button
                onClick={() => { props.setShowNewChatModal(false); props.setPulseUserSearch(''); props.setPulseSearchResults([]); }}
                className="w-full text-center text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Artifact Modal */}
      {props.showArtifactModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div ref={artifactRef} role="dialog" aria-modal="true" aria-label="Channel artifact" className="bg-white dark:bg-[rgba(255,255,255,0.03)] w-full max-w-2xl h-[80%] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
            <div className="p-4 border-b border-[var(--pulse-border)] flex justify-between items-center bg-[var(--pulse-canvas)]">
              <h3 className="font-bold dark:text-white flex items-center gap-2"><FileText /> Channel Artifact</h3>
              <button onClick={() => props.setShowArtifactModal(false)}><X className="text-zinc-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              {props.loadingArtifact ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <Loader2 className="text-2xl text-[var(--pulse-rose)] animate-spin" />
                  <p className="text-sm text-zinc-500">Generating spec from conversation history...</p>
                </div>
              ) : props.artifact ? (
                <div className="prose dark:prose-invert max-w-none text-sm">
                  <h1 className="text-2xl font-bold mb-4">{props.artifact.title}</h1>
                  <div className="bg-[rgba(244,63,94,0.06)] dark:bg-[rgba(244,63,94,0.08)] p-4 rounded-xl mb-6 text-[var(--pulse-ink)] italic">
                    {props.artifact.overview}
                  </div>
                  <h3 className="font-mono font-medium uppercase text-xs tracking-[0.1em] text-zinc-500 mb-2">Decisions Log</h3>
                  <ul className="list-disc list-inside mb-6 space-y-1">
                    {props.artifact.decisions.map((d, i) => <li key={i} className="text-zinc-700 dark:text-zinc-300">{d}</li>)}
                  </ul>
                  <h3 className="font-mono font-medium uppercase text-xs tracking-[0.1em] text-zinc-500 mb-2">Specifications</h3>
                  <div className="whitespace-pre-wrap font-mono text-zinc-600 dark:text-zinc-400 bg-[#f8f8f8] dark:bg-[rgba(255,255,255,0.055)] p-4 rounded-xl mb-6">
                    {props.artifact.spec}
                  </div>
                  <h3 className="font-mono font-medium uppercase text-xs tracking-[0.1em] text-zinc-500 mb-2">Milestones</h3>
                  <div className="space-y-2">
                    {props.artifact.milestones.map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-zinc-700 dark:text-zinc-300">{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-zinc-500">Failed to generate artifact.</div>
              )}
            </div>
            <div className="p-4 border-t border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] flex justify-end">
              <button
                onClick={props.handleExportToDocs}
                disabled={props.loadingArtifact || !props.artifact || props.exportingToDocs}
                className="bg-[rgba(244,63,94,0.06)] hover:bg-[rgba(244,63,94,0.10)] text-[var(--pulse-rose-text)] border border-[rgba(244,63,94,0.20)] px-6 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 mr-3 flex items-center gap-2"
              >
                {props.exportingToDocs ? <Loader2 className="animate-spin" /> : <FileText />}
                Export to Docs
              </button>
              <button onClick={props.handleSaveArtifact} disabled={props.loadingArtifact || !props.artifact} className="btn-brand-primary px-6 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                Save to Wiki
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Message Modal */}
      <ScheduleMessageModal
        isOpen={props.showScheduleModal}
        onClose={() => props.setShowScheduleModal(false)}
        messageText={props.inputText}
        scheduleDate={props.scheduleDate}
        scheduleTime={props.scheduleTime}
        onDateChange={props.setScheduleDate}
        onTimeChange={props.setScheduleTime}
        scheduledMessages={props.scheduledMessages}
        onSchedule={props.handleScheduleMessage}
      />

      {/* Forward Message Modal — Pulse conversations only. */}
      {props.showForwardModal && props.forwardingMessage && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div ref={forwardRef} role="dialog" aria-modal="true" aria-label="Forward message" className="bg-white dark:bg-[rgba(255,255,255,0.03)] w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
            <div className="p-4 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] flex justify-between items-center">
              <h3 className="font-bold dark:text-white flex items-center gap-2">
                <Share className="text-[var(--pulse-rose)]" /> Forward Message
              </h3>
              <button onClick={() => props.setShowForwardModal(false)}><X className="text-zinc-500" /></button>
            </div>
            <div className="p-4">
              <div className="bg-[#f8f8f8] dark:bg-[rgba(255,255,255,0.055)] p-3 rounded-lg text-sm text-zinc-600 dark:text-zinc-300 mb-4 max-h-32 overflow-y-auto">
                {props.forwardingMessage.text}
              </div>
              <div className="text-xs text-zinc-500 mb-2">Forward to:</div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {props.pulseConversations.length > 0 ? (
                  props.pulseConversations
                    .filter(conv => conv.id !== props.activePulseConversation && conv.other_user)
                    .map(conv => {
                      const other = conv.other_user!;
                      const label = other.display_name || other.full_name || other.handle || 'Unknown';
                      return (
                        <button
                          key={conv.id}
                          onClick={() => {
                            if (props.handleForwardPulseMessage && props.forwardingMessage) {
                              void props.handleForwardPulseMessage(props.forwardingMessage.id, other.id);
                            }
                          }}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--pulse-surface-raised)] transition"
                        >
                          <div className="w-8 h-8 rounded-full bg-[var(--pulse-rose-soft)] flex items-center justify-center text-[var(--pulse-coral-fg)] text-xs font-medium flex-shrink-0">
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {props.showShortcuts && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4" onClick={() => props.setShowShortcuts(false)}>
          <div ref={shortcutsRef} className="bg-[var(--pulse-surface)] w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-[var(--pulse-border)]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
            <div className="p-4 border-b border-zinc-200 dark:border-white/[0.06] flex justify-between items-center">
              <h3 className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-zinc-400 dark:text-zinc-500" /> Keyboard Shortcuts
              </h3>
              <button
                onClick={() => props.setShowShortcuts(false)}
                className="w-7 h-7 rounded-md text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright hover:bg-zinc-100 dark:hover:bg-white/[0.04] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                aria-label="Close shortcuts"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-1">
              {Object.entries(KEYBOARD_SHORTCUTS).map(([key, action]) => (
                <div key={key} className="flex justify-between items-center py-1.5 border-b border-zinc-100/60 dark:border-white/[0.04] last:border-b-0">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{action}</span>
                  <kbd className="px-2 py-0.5 bg-zinc-100 dark:bg-white/[0.06] rounded text-[10px] font-mono uppercase tracking-[0.05em] text-zinc-600 dark:text-zinc-300 tabular-nums">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Thread Statistics Panel */}
      <ConversationStatsModal
        isOpen={props.showStatsPanel && !!props.activeThread}
        onClose={() => props.setShowStatsPanel(false)}
        stats={props.activeThread ? messagesExportService.getThreadStatistics(props.activeThread) : null}
      />

      {/* Invite Team Modal */}
      <InviteTeamModal
        isOpen={props.showInviteModal}
        onClose={() => { props.setShowInviteModal(false); props.setInviteEmail(''); props.setInviteStatus('idle'); props.setInviteMessage(''); }}
        inviteEmail={props.inviteEmail}
        onEmailChange={props.setInviteEmail}
        inviteStatus={props.inviteStatus}
        inviteMessage={props.inviteMessage}
        onSendInvite={props.handleSendInvite}
      />

      {/* Delete Confirmation Modal */}
      {props.showDeleteConfirm && props.threadToDelete && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div ref={deleteRef} role="alertdialog" aria-modal="true" aria-label="Delete conversation confirmation" className="bg-white dark:bg-[rgba(255,255,255,0.03)] w-full max-w-sm rounded-2xl shadow-2xl animate-scale-in border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/15 dark:bg-red-500/20 ring-1 ring-red-500/30 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-2xl text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-bold text-lg dark:text-white mb-2">Delete Conversation?</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                This will permanently delete this conversation and all its messages. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { props.setShowDeleteConfirm(false); props.setThreadToDelete(null); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-[rgba(255,255,255,0.10)] text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                >
                  Cancel
                </button>
                <button
                  onClick={props.handleDeleteThread}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-500 text-white font-medium hover:bg-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer - Shows sidebar on mobile via swipe or hamburger */}
      <div className="md:hidden">
        <MobileDrawer
          isOpen={props.isDrawerOpen}
          onClose={props.closeDrawer}
          side="left"
          width="85%"
        >
          <div className="flex-1 overflow-y-auto flex flex-col bg-[#f8f8f8] dark:bg-[rgba(255,255,255,0.03)]/50">
            <div className="p-5 flex justify-between items-center border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
              <h2 className="font-bold text-lg text-zinc-900 dark:text-white tracking-tight">Pulse Messages</h2>
              <button onClick={props.closeDrawer} className="w-12 h-12 flex items-center justify-center text-zinc-500 hover:bg-[var(--pulse-surface-raised)] rounded-lg transition" aria-label="Close drawer">
                <X className="text-lg" />
              </button>
            </div>

            <div className="px-4 py-3 flex items-center gap-2 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
              <button onClick={() => { props.setShowInviteModal(true); props.closeDrawer(); }} className="w-12 h-12 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 flex items-center justify-center transition" title="Invite team member">
                <UserPlus className="text-sm" />
              </button>
              <button onClick={() => { props.setShowCellularSMS(true); props.closeDrawer(); }} className="w-12 h-12 rounded-lg text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 flex items-center justify-center transition" title="Cellular SMS">
                <Smartphone className="text-sm" />
              </button>
              <button onClick={() => { props.setShowShortcuts(true); props.closeDrawer(); }} className="w-12 h-12 rounded-lg text-zinc-400 hover:bg-[var(--pulse-surface-raised)] flex items-center justify-center transition" title="Keyboard shortcuts">
                <Keyboard className="text-sm" />
              </button>
              <button onClick={() => { props.setShowNewChatModal(true); props.closeDrawer(); }} className="w-12 h-12 rounded-lg bg-[#e8e8e8] dark:bg-[rgba(255,255,255,0.055)] text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition" title="New message">
                <SquarePen className="text-sm" />
              </button>
            </div>

            <div
              ref={props.drawerListRef}
              className="px-2 py-2 flex-1 overflow-y-auto"
              style={{ position: 'relative' }}
            >
              {props.pulseConversations.length > 0 ? (
                <div style={{ height: props.drawerTotalHeight, position: 'relative' }}>
                  {props.virtualDrawerConversations.map(({ item: conv, style }) => {
                    const otherUser = conv.other_user;
                    if (!otherUser) return null;
                    const hasUnread = (conv.unread_count || 0) > 0;
                    return (
                      <div key={conv.id} style={style}>
                        <div
                          onClick={() => props.handleSelectConversation(conv.id)}
                          className={`p-3 rounded-xl cursor-pointer transition flex items-center gap-3
                            ${props.activePulseConversation === conv.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-[var(--pulse-surface-raised)]/50'}`}
                        >
                          <div className="w-10 h-10 rounded-full bg-[var(--pulse-rose-soft)] flex items-center justify-center text-[var(--pulse-coral-fg)] text-sm font-medium flex-shrink-0">
                            {otherUser.avatar_url ? (
                              <img src={otherUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              (otherUser.display_name || otherUser.handle || '?').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className={`text-sm truncate ${hasUnread ? 'font-bold dark:text-white' : 'font-medium text-zinc-700 dark:text-zinc-300'}`}>
                              {otherUser.display_name || otherUser.full_name || otherUser.handle || 'Unknown'}
                            </h3>
                            {otherUser.handle && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">@{otherUser.handle}</span>}
                          </div>
                          {hasUnread && (
                            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                              <span className="text-[10px] text-white font-bold">{conv.unread_count}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30 flex items-center justify-center mb-4">
                    <MessagesSquare className="text-2xl text-rose-500" />
                  </div>
                  <h3 className="text-zinc-900 dark:text-white font-semibold mb-2">No Messages Yet</h3>
                  <p className="text-zinc-500 text-sm mb-4">Start a conversation with a Pulse user.</p>
                  <button
                    onClick={() => { props.setShowNewChatModal(true); props.closeDrawer(); }}
                    className="px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white text-sm font-medium rounded-lg"
                  >
                    <Plus className="mr-2" />
                    New Conversation
                  </button>
                </div>
              )}
            </div>
          </div>
        </MobileDrawer>
      </div>
    </>
  );
});

MessagesTopModals.displayName = 'MessagesTopModals';
