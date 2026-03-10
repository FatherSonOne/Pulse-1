import React from 'react';
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
  'Ctrl+Enter': 'Send message',
  'Ctrl+K': 'Open command palette',
  'Ctrl+/': 'Show keyboard shortcuts',
  'Ctrl+F': 'Search messages',
  'Escape': 'Close modals / Cancel',
  'Alt+M': 'Mute conversation',
  'Alt+S': 'Star message',
  'Alt+R': 'Reply to message',
};

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
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
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
                    className="w-full pl-10 pr-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">
                          <History className="mr-1" /> Recent
                        </p>
                        <div className="space-y-1">
                          {props.recentPulseContacts.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => props.startPulseConversation(user)}
                              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition text-left"
                            >
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm">
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  (user.display_name || user.full_name || 'U').charAt(0)
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium dark:text-white truncate text-sm flex items-center gap-1">
                                  {user.display_name || user.full_name || 'Pulse User'}
                                  {user.is_verified && <CheckCircle2 className="text-blue-500 text-[10px]" />}
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
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">
                          <Users className="mr-1" /> Discover Pulse Users
                        </p>
                        <div className="space-y-1">
                          {props.suggestedPulseUsers.slice(0, 8).map((user) => (
                            <button
                              key={user.id}
                              onClick={() => props.startPulseConversation(user)}
                              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition text-left"
                            >
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm">
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  (user.display_name || user.full_name || 'U').charAt(0)
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium dark:text-white truncate text-sm flex items-center gap-1">
                                  {user.display_name || user.full_name || 'Pulse User'}
                                  {user.is_verified && <CheckCircle2 className="text-blue-500 text-[10px]" />}
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
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
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
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold">
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
                              <CheckCircle2 className="text-blue-500 text-xs" />
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
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 mt-4 pt-4 px-4 pb-4">
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
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl h-[80%] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950">
              <h3 className="font-bold dark:text-white flex items-center gap-2"><FileText /> Channel Artifact</h3>
              <button onClick={() => props.setShowArtifactModal(false)}><X className="text-zinc-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              {props.loadingArtifact ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <Loader2 className="text-2xl text-blue-500 animate-spin" />
                  <p className="text-sm text-zinc-500">Generating spec from conversation history...</p>
                </div>
              ) : props.artifact ? (
                <div className="prose dark:prose-invert max-w-none text-sm">
                  <h1 className="text-2xl font-bold mb-4">{props.artifact.title}</h1>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mb-6 text-blue-800 dark:text-blue-200 italic">
                    {props.artifact.overview}
                  </div>
                  <h3 className="font-bold uppercase text-xs tracking-wider text-zinc-500 mb-2">Decisions Log</h3>
                  <ul className="list-disc list-inside mb-6 space-y-1">
                    {props.artifact.decisions.map((d, i) => <li key={i} className="text-zinc-700 dark:text-zinc-300">{d}</li>)}
                  </ul>
                  <h3 className="font-bold uppercase text-xs tracking-wider text-zinc-500 mb-2">Specifications</h3>
                  <div className="whitespace-pre-wrap font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl mb-6">
                    {props.artifact.spec}
                  </div>
                  <h3 className="font-bold uppercase text-xs tracking-wider text-zinc-500 mb-2">Milestones</h3>
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
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={props.handleExportToDocs}
                disabled={props.loadingArtifact || !props.artifact || props.exportingToDocs}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-6 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition disabled:opacity-50 mr-3 flex items-center gap-2"
              >
                {props.exportingToDocs ? <Loader2 className="animate-spin" /> : <FileText />}
                Export to Docs
              </button>
              <button onClick={props.handleSaveArtifact} disabled={props.loadingArtifact || !props.artifact} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition disabled:opacity-50">
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

      {/* Forward Message Modal */}
      {props.showForwardModal && props.forwardingMessage && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold dark:text-white flex items-center gap-2">
                <Share className="text-blue-500" /> Forward Message
              </h3>
              <button onClick={() => props.setShowForwardModal(false)}><X className="text-zinc-500" /></button>
            </div>
            <div className="p-4">
              <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg text-sm text-zinc-600 dark:text-zinc-300 mb-4">
                {props.forwardingMessage.text}
              </div>
              <div className="text-xs text-zinc-500 mb-2">Select conversation:</div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {props.threads.filter(t => t.id !== props.activeThreadId).map(t => (
                  <button key={t.id} onClick={() => props.handleForwardMessage(t.id)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                    <div className={`w-8 h-8 rounded-full ${t.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>{t.contactName.charAt(0)}</div>
                    <span className="text-sm dark:text-white">{t.contactName}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {props.showShortcuts && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold dark:text-white flex items-center gap-2">
                <Keyboard className="text-blue-500" /> Keyboard Shortcuts
              </h3>
              <button onClick={() => props.setShowShortcuts(false)}><X className="text-zinc-500" /></button>
            </div>
            <div className="p-4 space-y-2">
              {Object.entries(KEYBOARD_SHORTCUTS).map(([key, action]) => (
                <div key={key} className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">{action}</span>
                  <kbd className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs font-mono">{key}</kbd>
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
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-2xl text-red-500" />
              </div>
              <h3 className="font-bold text-lg dark:text-white mb-2">Delete Conversation?</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                This will permanently delete this conversation and all its messages. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { props.setShowDeleteConfirm(false); props.setThreadToDelete(null); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={props.handleDeleteThread}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition"
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
          <div className="flex-1 overflow-y-auto flex flex-col bg-zinc-50 dark:bg-zinc-900/50">
            <div className="p-5 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="font-bold text-lg text-zinc-900 dark:text-white tracking-tight">Pulse Messages</h2>
              <button onClick={props.closeDrawer} className="w-12 h-12 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition" aria-label="Close drawer">
                <X className="text-lg" />
              </button>
            </div>

            <div className="px-4 py-3 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800">
              <button onClick={() => { props.setShowInviteModal(true); props.closeDrawer(); }} className="w-12 h-12 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 flex items-center justify-center transition" title="Invite team member">
                <UserPlus className="text-sm" />
              </button>
              <button onClick={() => { props.setShowCellularSMS(true); props.closeDrawer(); }} className="w-12 h-12 rounded-lg text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 flex items-center justify-center transition" title="Cellular SMS">
                <Smartphone className="text-sm" />
              </button>
              <button onClick={() => { props.setShowShortcuts(true); props.closeDrawer(); }} className="w-12 h-12 rounded-lg text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center transition" title="Keyboard shortcuts">
                <Keyboard className="text-sm" />
              </button>
              <button onClick={() => { props.setShowNewChatModal(true); props.closeDrawer(); }} className="w-12 h-12 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition" title="New message">
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
                            ${props.activePulseConversation === conv.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50'}`}
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
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
