import React from 'react';
import { UserPlus, Smartphone, Keyboard, SquarePen, Check, Archive, Search, X, Plus, MessagesSquare, AtSign, Command } from 'lucide-react';
import { OnlineIndicator } from '../UserContact/OnlineIndicator';
import { UserBadge } from './UserBadge';
import { ThreadBadges, ThreadActionsMenu } from '../MessageEnhancements/ThreadActions';
import { PulseConversation } from '../../services/pulseService';
import { Thread } from '../../types';
import { TagPills } from './TagPills';
import type { TagDefinition } from '../../services/tagsService';
import { RemindersInbox } from './RemindersInbox';

interface VirtualConversationItem {
  item: PulseConversation;
  style: React.CSSProperties;
}

interface ConversationSidebarProps {
  sidebarRef: React.RefObject<HTMLDivElement>;
  mobileView: 'list' | 'chat';
  setShowInviteModal: (v: boolean) => void;
  setShowCellularSMS: (v: boolean) => void;
  setShowShortcuts: (v: boolean) => void;
  setShowNewChatModal: (v: boolean) => void;
  threadFilter: string;
  setThreadFilter: (v: string) => void;
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  searchQuery: string;
  handleSearch: (v: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (v: boolean) => void;
  searchResults: Array<{ message: any; thread: any }>;
  searchFilter: string;
  setSearchFilter: (v: string) => void;
  setActiveThreadId: (v: string) => void;
  setActivePulseConversation: (v: string | null) => void;
  setMobileView: (v: 'list' | 'chat') => void;
  setSearchQuery: (v: string) => void;
  setSearchResults: (v: any[]) => void;
  threadListRef: React.RefObject<HTMLDivElement>;
  pulseConversations: PulseConversation[];
  conversationsTotalHeight: number;
  virtualConversations: VirtualConversationItem[];
  activePulseConversation: string | null;
  setSelectedContactUserId: (v: string) => void;
  setShowContactPanel: (v: boolean) => void;
  handleSelectConversation: (id: string) => void;
  messageEnhancements: any;
  handleDeletePulseConversation: (id: string) => void;
  threads: Thread[];
  /** Phase 7b — tags applied to each Pulse conversation, keyed by
   *  conversation id. Optional; renders compact pills inline when
   *  provided. */
  conversationTags?: Record<string, TagDefinition[]>;
  /** Phase 7b — when a fired reminder is opened, jump the host to
   *  that conversation. Optional; if omitted, the reminder is just
   *  dismissed without navigation. */
  onJumpToConversation?: (conversationId: string, kind: 'dm' | 'channel') => void;
  /** Phase III — keyboard cursor (J/K nav). When set, the matching row
   *  renders a subtle ring distinct from the active row. Optional. */
  cursorConvId?: string | null;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  sidebarRef, mobileView,
  setShowInviteModal, setShowCellularSMS, setShowShortcuts, setShowNewChatModal,
  threadFilter, setThreadFilter,
  showArchived, setShowArchived,
  searchInputRef, searchQuery, handleSearch, isSearchOpen, setIsSearchOpen,
  searchResults, searchFilter, setSearchFilter,
  setActiveThreadId, setActivePulseConversation, setMobileView, setSearchQuery, setSearchResults,
  threadListRef, pulseConversations, conversationsTotalHeight, virtualConversations,
  activePulseConversation, setSelectedContactUserId, setShowContactPanel,
  handleSelectConversation, messageEnhancements, handleDeletePulseConversation, threads,
  cursorConvId,
  conversationTags = {},
  onJumpToConversation,
}) => {
  // Phase A — Coral Cockpit shell rework.
  // Mono `MESSAGES · <count>` section label; labeled `+ INVITE` ghost button
  // (always visible — early-org invite affordance); RemindersInbox kept but
  // self-hides when no reminders are due; mono `⌘` keyboard glyph; ghost-coral
  // compose with `⌘N` hint. Filter dropdown removed in favor of search-syntax
  // chips (`is:unread`, `pinned`, `tasks`, `votes`) revealed on focus.
  // Search syntax tokens map to threadFilter so existing list logic keeps working.

  const conversationCount = pulseConversations.length;

  // Map search-syntax tokens (e.g. "is:unread") to threadFilter keys.
  const onSearchInput = (raw: string) => {
    handleSearch(raw);
    const trimmed = raw.trim().toLowerCase();
    const tokenToFilter: Record<string, string> = {
      'is:unread': 'unread',
      'is:pinned': 'pinned',
      'is:tasks': 'with-tasks',
      'has:tasks': 'with-tasks',
      'is:votes': 'with-decisions',
      'has:decisions': 'with-decisions',
    };
    if (tokenToFilter[trimmed]) {
      setThreadFilter(tokenToFilter[trimmed]);
    } else if (trimmed === '' || trimmed === 'is:all') {
      setThreadFilter('all');
    }
  };

  const filterChips: Array<{ key: string; label: string; token: string }> = [
    { key: 'all', label: 'ALL', token: '' },
    { key: 'unread', label: 'UNREAD', token: 'is:unread' },
    { key: 'pinned', label: 'PINNED', token: 'is:pinned' },
    { key: 'with-tasks', label: 'TASKS', token: 'is:tasks' },
    { key: 'with-decisions', label: 'VOTES', token: 'is:votes' },
  ];

  return (
    <div ref={sidebarRef} className={`w-full md:w-[30%] md:min-w-[280px] md:max-w-[400px] border-r border-zinc-200 dark:border-white/[0.06] bg-[#f8f8f8] dark:bg-black flex-shrink-0 flex flex-col ${mobileView === 'chat' ? 'max-md:hidden' : ''}`}>
      {/* Header — mono section label + actions */}
      <div className="px-5 pt-5 pb-3 flex justify-between items-center">
        <h2 className="font-mono uppercase tracking-[0.1em] text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
          <span>MESSAGES</span>
          {conversationCount > 0 && (
            <>
              <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">·</span>
              <span className="text-zinc-900 dark:text-zinc-100 font-medium">{conversationCount}</span>
            </>
          )}
        </h2>
        <div className="flex items-center gap-1">
          {/* Invite Team — labeled, always visible per user direction (early-org invite affordance) */}
          <button
            onClick={() => setShowInviteModal(true)}
            className="h-8 px-2.5 rounded-md inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            title="Invite a teammate to your workspace"
            aria-label="Invite teammate"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="font-mono uppercase tracking-[0.1em] text-[10px] font-medium">INVITE</span>
          </button>
          {/* RemindersInbox — preserved but self-hides when zero reminders due */}
          {onJumpToConversation && (
            <RemindersInbox onJumpToConversation={onJumpToConversation} />
          )}
          {/* Keyboard shortcuts — mono ⌘ glyph, also bound to ? */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="h-8 w-8 rounded-md inline-flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-white/[0.055] hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            <Command className="w-3.5 h-3.5" />
          </button>
          {/* Compose — ghost coral with ⌘N hint (drops 1 of 3 filled-coral attractors) */}
          <button
            onClick={() => setShowNewChatModal(true)}
            className="h-8 px-2.5 rounded-md inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            title="New conversation (⌘N)"
            aria-label="New conversation"
          >
            <SquarePen className="w-3.5 h-3.5" />
            <span className="hidden md:inline font-mono uppercase tracking-[0.1em] text-[10px] text-zinc-400 dark:text-zinc-500">⌘N</span>
          </button>
        </div>
      </div>

      {/* Search — borderless inset, ⌘K hint, syntax chips on focus.
          Filter dropdown killed; chips below set threadFilter directly. */}
      <div className="px-4 pb-2">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 w-3.5 h-3.5" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search · is:unread · from:@frankie"
            value={searchQuery}
            onChange={e => onSearchInput(e.target.value)}
            onFocus={() => setIsSearchOpen(true)}
            className="w-full bg-transparent border-0 border-b border-zinc-200 dark:border-white/[0.06] rounded-none px-9 py-2 text-[13px] outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-rose-500/60 transition-colors"
          />
          {searchQuery ? (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); setThreadFilter('all'); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md inline-flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-white/[0.055] transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono uppercase tracking-[0.1em] text-[10px] text-zinc-500 dark:text-zinc-500 pointer-events-none">⌘K</span>
          )}
        </div>
        {/* Filter chips — replace the dropdown. One row, mono labels. */}
        <div className="mt-2 flex items-center gap-1 overflow-x-auto -mx-1 px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filterChips.map(chip => {
            const active = threadFilter === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => {
                  setThreadFilter(chip.key);
                  if (chip.token === '' && searchQuery.startsWith('is:')) setSearchQuery('');
                }}
                className={`flex-shrink-0 h-6 px-2 rounded font-mono uppercase tracking-[0.1em] text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                  active
                    ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
                    : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/40 dark:hover:bg-white/[0.04]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
          <div className="flex-shrink-0 w-px h-3 bg-zinc-200 dark:bg-white/[0.08] mx-1" aria-hidden="true" />
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex-shrink-0 h-6 px-2 rounded font-mono uppercase tracking-[0.1em] text-[10px] font-medium inline-flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
              showArchived
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/40 dark:hover:bg-white/[0.04]'
            }`}
            title={showArchived ? 'Hide archived' : 'Show archived'}
          >
            <Archive className="w-3 h-3" />
            ARCHIVED
          </button>
        </div>
        {/* Search-scope filter (preserved) */}
        {isSearchOpen && searchQuery && (
          <div className="mt-2 flex gap-1">
            {(['all', 'files', 'decisions', 'tasks'] as const).map(f => (
              <button
                key={f}
                onClick={() => { setSearchFilter(f); handleSearch(searchQuery); }}
                className={`h-6 px-2 rounded font-mono uppercase tracking-[0.1em] text-[10px] font-medium transition-colors ${
                  searchFilter === f
                    ? 'bg-rose-500 text-white'
                    : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/40 dark:hover:bg-white/[0.04]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search Results */}
      {searchQuery && searchResults.length > 0 && (
        <div className="px-2 pb-2 border-b border-zinc-200 dark:border-zinc-700">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 px-2 mb-2">{searchResults.length} results</div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {searchResults.slice(0, 5).map(result => (
              <button
                key={result.message.id}
                onClick={() => { setActiveThreadId(result.thread.id); setActivePulseConversation(null); setMobileView('chat'); setSearchQuery(''); setSearchResults([]); }}
                className="w-full text-left p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
              >
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{result.thread.contactName}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{result.message.text}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        ref={threadListRef}
        className="overflow-y-auto flex-1 px-2"
        style={{ position: 'relative' }}
      >
        {/* Pulse Conversations Only - SMS threads moved to Cellular SMS sub-page */}
        {pulseConversations.length > 0 ? (
          <div style={{ height: conversationsTotalHeight, position: 'relative' }}>
            {virtualConversations.map(({ item: conv, style }) => {
              const otherUser = conv.other_user;
              if (!otherUser) return null;
              const hasUnread = (conv.unread_count || 0) > 0;
              return (
                <div key={conv.id} style={style}>
                  <div
                    className={`p-3 rounded-xl cursor-pointer transition-colors relative group flex items-center gap-3
                      ${activePulseConversation === conv.id
                        ? 'bg-rose-50 dark:bg-rose-500/10 ring-1 ring-rose-500/20'
                        : cursorConvId === conv.id
                        ? 'bg-rose-500/[0.04] dark:bg-rose-500/[0.06] ring-1 ring-rose-500/40'
                        : 'hover:bg-zinc-100/60 dark:hover:bg-white/[0.04]'}`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedContactUserId(otherUser.id);
                        setShowContactPanel(true);
                      }}
                      className="w-10 h-10 rounded-full bg-rose-500/15 dark:bg-rose-500/15 flex items-center justify-center text-rose-700 dark:text-rose-300 text-sm font-medium flex-shrink-0 relative hover:bg-rose-500/20 dark:hover:bg-rose-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                      title="View contact details"
                    >
                      {otherUser.avatar_url ? (
                        <img src={otherUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        (otherUser.display_name || otherUser.handle || '?').charAt(0).toUpperCase()
                      )}
                      {/* Online indicator */}
                      <div className="absolute -bottom-0.5 -right-0.5">
                        <OnlineIndicator userId={otherUser.id} size="medium" />
                      </div>
                      {otherUser.is_verified && (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-zinc-400 dark:bg-zinc-500 rounded-full flex items-center justify-center border-2 border-white dark:border-black" title="Verified">
                          <Check className="text-[7px] text-white" />
                        </div>
                      )}
                    </button>
                    <div onClick={() => handleSelectConversation(conv.id)} className="flex-1 overflow-hidden min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <h3
                            className={`text-[13px] truncate ${hasUnread ? 'font-semibold text-zinc-900 dark:text-zinc-50' : 'font-medium text-zinc-700 dark:text-zinc-300'}`}
                          >
                            {otherUser.display_name || otherUser.full_name || otherUser.handle || 'Unknown'}
                          </h3>
                          {/* Phase 4.2: Role badge in conversation list */}
                          {otherUser.is_verified && (
                            <UserBadge role="member" size="xs" showIcon={true} showLabel={false} />
                          )}
                        </div>
                        {conv.last_message_at && (
                          <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-500 whitespace-nowrap ml-2 tabular-nums">
                            {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {otherUser.handle && (
                          <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-500 flex-shrink-0">@{otherUser.handle}</span>
                        )}
                        {conv.last_message_preview ? (
                          <p className={`text-[12px] truncate ${hasUnread ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-500 dark:text-zinc-500'}`}>
                            {conv.last_message_preview}
                          </p>
                        ) : (
                          <span className="font-mono uppercase tracking-[0.1em] text-[10px] text-zinc-500 dark:text-zinc-500">
                            NO MESSAGES YET · TAP TO START
                          </span>
                        )}
                        {/* Phase 7b — compact tag dots; full pills appear in the
                         *  conversation header when active. */}
                        {conversationTags[conv.id]?.length > 0 && (
                          <TagPills
                            tags={conversationTags[conv.id]}
                            compact
                            max={4}
                            className="ml-1"
                          />
                        )}
                      </div>
                    </div>
                    {/* Thread Badges - Pin/Star indicators */}
                    <ThreadBadges actions={messageEnhancements.getThreadActions(conv.id)} />
                    {hasUnread && (
                      <span
                        className="font-mono uppercase tracking-[0.1em] text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 tabular-nums"
                        aria-label={`${conv.unread_count} unread`}
                      >
                        {conv.unread_count}
                      </span>
                    )}
                    {/* Thread Actions Menu - Pin/Star/Mute/Archive/Delete */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ThreadActionsMenu
                        actions={messageEnhancements.getThreadActions(conv.id)}
                        onTogglePin={() => messageEnhancements.toggleThreadPin(conv.id)}
                        onToggleStar={() => messageEnhancements.toggleThreadStar(conv.id)}
                        onToggleMute={() => messageEnhancements.toggleThreadMute(conv.id)}
                        onToggleArchive={() => messageEnhancements.toggleThreadArchive(conv.id)}
                        onDelete={() => handleDeletePulseConversation(conv.id)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty state — quiet, mono, no SaaS-template card */
          <div className="flex flex-col items-start justify-start py-8 px-4 space-y-3">
            <p className="font-mono uppercase tracking-[0.1em] text-[10px] text-zinc-500 dark:text-zinc-500">
              NO CONVERSATIONS YET
            </p>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-500 leading-[1.5] max-w-[240px]">
              Start your first conversation with a Pulse user.
            </p>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 -ml-2 rounded-md text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[13px] font-medium">New conversation</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
