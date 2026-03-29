import React from 'react';
import { UserPlus, Smartphone, Keyboard, SquarePen, Check, Archive, Search, X, Plus, MessagesSquare, AtSign } from 'lucide-react';
import { OnlineIndicator } from '../UserContact/OnlineIndicator';
import { UserBadge } from './UserBadge';
import { ThreadBadges, ThreadActionsMenu } from '../MessageEnhancements/ThreadActions';
import { PulseConversation } from '../../services/pulseService';
import { Thread } from '../../types';

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
  showFilterDropdown: boolean;
  setShowFilterDropdown: (v: boolean) => void;
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
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  sidebarRef, mobileView,
  setShowInviteModal, setShowCellularSMS, setShowShortcuts, setShowNewChatModal,
  threadFilter, setThreadFilter, showFilterDropdown, setShowFilterDropdown,
  showArchived, setShowArchived,
  searchInputRef, searchQuery, handleSearch, isSearchOpen, setIsSearchOpen,
  searchResults, searchFilter, setSearchFilter,
  setActiveThreadId, setActivePulseConversation, setMobileView, setSearchQuery, setSearchResults,
  threadListRef, pulseConversations, conversationsTotalHeight, virtualConversations,
  activePulseConversation, setSelectedContactUserId, setShowContactPanel,
  handleSelectConversation, messageEnhancements, handleDeletePulseConversation, threads,
}) => {
  return (
    <div ref={sidebarRef} className={`w-full md:w-[30%] md:min-w-[280px] md:max-w-[400px] border-r border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 flex-shrink-0 flex flex-col ${mobileView === 'chat' ? 'max-md:hidden' : ''}`}>
      <div className="p-5 flex justify-between items-center">
        <h2 className="font-bold text-lg text-zinc-900 dark:text-white tracking-tight">Pulse Messages</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowInviteModal(true)} className="w-12 h-12 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 flex items-center justify-center transition" title="Invite team member">
            <UserPlus className="text-sm" />
          </button>
          {/* SMS toggle hidden — SMS is not in active development */}
          <button onClick={() => setShowShortcuts(true)} className="w-12 h-12 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition" title="Keyboard shortcuts">
            <Keyboard className="text-sm" />
          </button>
          <button onClick={() => setShowNewChatModal(true)} className="w-12 h-12 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center transition" title="New message">
            <SquarePen className="text-sm" />
          </button>
        </div>
      </div>

      {/* Thread Filter Dropdown */}
      <div className="px-4 pb-3 relative">
        <div className="flex items-center gap-2">
          {/* Filter Dropdown */}
          <div className="relative flex-1">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="w-full flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm hover:border-rose-500/30 transition"
            >
              <span className="flex items-center gap-2">
                <i className={`fa-solid ${
                  threadFilter === 'all' ? 'fa-inbox' :
                  threadFilter === 'unread' ? 'fa-circle' :
                  threadFilter === 'pinned' ? 'fa-thumbtack' :
                  threadFilter === 'with-tasks' ? 'fa-check-square' :
                  'fa-gavel'
                } text-xs text-zinc-500 dark:text-zinc-400`}></i>
                <span className="text-zinc-900 dark:text-zinc-100">
                  {threadFilter === 'all' ? 'All Messages' :
                   threadFilter === 'unread' ? 'Unread' :
                   threadFilter === 'pinned' ? 'Pinned' :
                   threadFilter === 'with-tasks' ? 'With Tasks' :
                   'With Votes'}
                </span>
              </span>
              <i className={`fa-solid fa-chevron-down text-xs text-zinc-500 dark:text-zinc-400 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`}></i>
            </button>
            {showFilterDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg shadow-black/10 dark:shadow-black/30 z-50 py-1 animate-fade-in">
                {([
                  { key: 'all', label: 'All Messages', icon: 'fa-inbox' },
                  { key: 'unread', label: 'Unread', icon: 'fa-circle' },
                  { key: 'pinned', label: 'Pinned', icon: 'fa-thumbtack' },
                  { key: 'with-tasks', label: 'With Tasks', icon: 'fa-check-square' },
                  { key: 'with-decisions', label: 'With Votes', icon: 'fa-gavel' },
                ] as const).map(filter => (
                  <button
                    key={filter.key}
                    onClick={() => { setThreadFilter(filter.key as any); setShowFilterDropdown(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10 transition ${threadFilter === filter.key ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'text-zinc-500 dark:text-zinc-400'}`}
                  >
                    <i className={`fa-solid ${filter.icon} text-xs w-4`}></i>
                    {filter.label}
                    {threadFilter === filter.key && <Check className="text-xs ml-auto text-emerald-500" />}
                  </button>
                ))}
                <div className="border-t border-zinc-200 dark:border-zinc-700 my-1"></div>
                <button
                  onClick={() => { setShowArchived(!showArchived); setShowFilterDropdown(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10 transition ${showArchived ? 'text-amber-500' : 'text-zinc-500 dark:text-zinc-400'}`}
                >
                  <Archive className="text-xs w-4" />
                  {showArchived ? 'Hide Archived' : 'Show Archived'}
                  {showArchived && <Check className="text-xs ml-auto text-amber-500" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 pb-3">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => setIsSearchOpen(true)}
            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm pl-9 outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/40 transition"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 text-xs" />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              <X className="text-xs" />
            </button>
          )}
        </div>
        {isSearchOpen && searchQuery && (
          <div className="mt-2 flex gap-2">
            {(['all', 'files', 'decisions', 'tasks'] as const).map(f => (
              <button key={f} onClick={() => { setSearchFilter(f); handleSearch(searchQuery); }} className={`px-2 py-1 rounded text-xs ${searchFilter === f ? 'bg-rose-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
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
                    className={`p-3 rounded-xl cursor-pointer transition relative group flex items-center gap-3
                      ${activePulseConversation === conv.id ? 'bg-rose-50 dark:bg-rose-500/10 shadow-sm ring-1 ring-rose-500/20' : 'hover:bg-rose-50 dark:hover:bg-rose-500/5'}`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedContactUserId(otherUser.id);
                        setShowContactPanel(true);
                      }}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 relative hover:ring-2 hover:ring-emerald-500/50 transition-all"
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
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950">
                          <Check className="text-[7px] text-white" />
                        </div>
                      )}
                    </button>
                    <div onClick={() => handleSelectConversation(conv.id)} className="flex-1 overflow-hidden min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <h3
                            className={`text-sm truncate ${hasUnread ? 'font-bold' : 'font-medium'} text-zinc-900 dark:text-zinc-100`}
                          >
                            {otherUser.display_name || otherUser.full_name || otherUser.handle || 'Unknown'}
                          </h3>
                          {/* Phase 4.2: Role badge in conversation list */}
                          {otherUser.is_verified && (
                            <UserBadge role="member" size="xs" showIcon={true} showLabel={false} />
                          )}
                        </div>
                        {conv.last_message_at && (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap ml-2">
                            {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <AtSign className="text-emerald-500 text-[10px]" />
                        {otherUser.handle && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">@{otherUser.handle}</span>}
                        {conv.last_message_preview && (
                          <p className="text-xs truncate text-zinc-500 dark:text-zinc-400 ml-1">{conv.last_message_preview}</p>
                        )}
                      </div>
                    </div>
                    {/* Thread Badges - Pin/Star indicators */}
                    <ThreadBadges actions={messageEnhancements.getThreadActions(conv.id)} />
                    {hasUnread && (
                      <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                        <span className="text-[10px] text-white font-bold">{conv.unread_count}</span>
                      </div>
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
          /* Empty state when no Pulse conversations */
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-20 h-20 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 flex items-center justify-center mb-4">
              <MessagesSquare className="text-3xl text-rose-500" />
            </div>
            <h3 className="text-zinc-900 dark:text-white font-semibold mb-2">No Pulse Messages Yet</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4 max-w-[200px]">
              Start a conversation with a Pulse user to get started.
            </p>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white text-sm font-medium rounded-lg hover:from-rose-600 hover:to-pink-700 transition shadow-lg shadow-rose-500/30"
            >
              <Plus className="mr-2" />
              New Conversation
            </button>
            {/* SMS button hidden — SMS is not in active development */}
          </div>
        )}
      </div>
    </div>
  );
};
