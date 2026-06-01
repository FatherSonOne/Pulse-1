// src/store/pulseMessagesStore.ts
// Zustand store for Pulse-to-Pulse messaging
// Replaces 40+ useState hooks from Messages.tsx god component

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { pulseService, PulseConversation, PulseMessage, SearchUserResult } from '../services/pulseService';

// ==================== Types ====================

export interface MessageReaction {
  emoji: string;
  count: number;
  me: boolean;
}

interface PulseMessagesState {
  // ── Conversations ──
  conversations: PulseConversation[];
  activeConversationId: string | null;
  isLoadingConversations: boolean;

  // ── Messages ──
  messages: PulseMessage[];
  hasMoreMessages: boolean;
  isLoadingMore: boolean;

  // ── Reactions & Stars ──
  reactions: Record<string, MessageReaction[]>;
  starredIds: Set<string>;

  // ── Typing ──
  otherUserTyping: boolean;

  // ── Editing ──
  editingMessageId: string | null;
  editText: string;

  // ── Reply ──
  replyingTo: PulseMessage | null;

  // ── Search / Discovery ──
  userSearchQuery: string;
  userSearchResults: SearchUserResult[];
  isSearchingUsers: boolean;
  suggestedUsers: SearchUserResult[];
  recentContacts: SearchUserResult[];

  // ── Context menu ──
  contextMenuMsgId: string | null;
  contextMenuPosition: { x: number; y: number } | null;
}

interface PulseMessagesActions {
  // ── Conversations ──
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  startConversation: (user: SearchUserResult) => Promise<string | null>;
  deleteConversation: (id: string) => Promise<void>;
  archiveConversation: (id: string, archived: boolean) => Promise<void>;
  muteConversation: (id: string, muted: boolean) => Promise<void>;

  // ── Messages ──
  sendMessage: (content: string) => Promise<void>;
  sendMessageWithFile: (file: File, caption?: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  reloadMessages: () => Promise<void>;

  // ── Reactions ──
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  loadReactions: (messageIds: string[]) => Promise<void>;

  // ── Stars ──
  toggleStar: (messageId: string) => Promise<void>;
  loadStars: () => Promise<void>;

  // ── Editing ──
  startEditing: (msg: PulseMessage) => void;
  saveEdit: () => Promise<void>;
  cancelEdit: () => void;

  // ── Reply ──
  setReplyingTo: (msg: PulseMessage | null) => void;

  // ── Forwarding ──
  forwardMessage: (messageId: string, recipientId: string) => Promise<void>;

  // ── Typing ──
  setOtherUserTyping: (typing: boolean) => void;
  broadcastTyping: () => void;

  // ── Search / Discovery ──
  searchUsers: (query: string) => Promise<void>;
  clearUserSearch: () => void;
  loadSuggestedUsers: () => Promise<void>;
  loadRecentContacts: () => Promise<void>;

  // ── Context menu ──
  openContextMenu: (msgId: string, x: number, y: number) => void;
  closeContextMenu: () => void;

  // ── Realtime ──
  handleRealtimeMessage: (msg: PulseMessage, currentUserId: string) => void;

  // ── Reset ──
  reset: () => void;
}

type PulseMessagesStore = PulseMessagesState & PulseMessagesActions;

// ==================== Initial State ====================

const initialState: PulseMessagesState = {
  conversations: [],
  activeConversationId: null,
  isLoadingConversations: false,

  messages: [],
  hasMoreMessages: false,
  isLoadingMore: false,

  reactions: {},
  starredIds: new Set(),

  otherUserTyping: false,

  editingMessageId: null,
  editText: '',

  replyingTo: null,

  userSearchQuery: '',
  userSearchResults: [],
  isSearchingUsers: false,
  suggestedUsers: [],
  recentContacts: [],

  contextMenuMsgId: null,
  contextMenuPosition: null,
};

// ==================== Store ====================

export const usePulseMessagesStore = create<PulseMessagesStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ── Conversations ──────────────────────────────────────

    loadConversations: async () => {
      set({ isLoadingConversations: true });
      try {
        const conversations = await pulseService.getConversations();
        set({ conversations, isLoadingConversations: false });
      } catch (error) {
        console.error('Failed to load conversations:', error);
        set({ isLoadingConversations: false });
      }
    },

    selectConversation: async (id: string) => {
      set({
        activeConversationId: id,
        editingMessageId: null,
        editText: '',
        replyingTo: null,
        otherUserTyping: false,
      });

      try {
        const { messages, hasMore } = await pulseService.getMessagesPaginated(id, 50);
        set({ messages, hasMoreMessages: hasMore });

        // Load reactions and stars in parallel
        const messageIds = messages.filter(m => !m.id.startsWith('temp-')).map(m => m.id);
        if (messageIds.length > 0) {
          const [reactions, stars] = await Promise.all([
            pulseService.getReactionsForMessages(messageIds),
            pulseService.getStarredMessageIds()
          ]);
          set({ reactions, starredIds: stars });
        }

        // Mark as read
        await pulseService.markAsRead(id);

        // Refresh conversation list for unread counts
        const conversations = await pulseService.getConversations();
        set({ conversations });
      } catch (error) {
        console.error('Failed to load conversation:', error);
      }
    },

    startConversation: async (user: SearchUserResult) => {
      try {
        const conversationId = await pulseService.getOrCreateConversation(user.id);

        // Reload conversations to include the new/existing one
        const conversations = await pulseService.getConversations();
        set({ conversations });

        // Select it
        await get().selectConversation(conversationId);
        return conversationId;
      } catch (error) {
        console.error('Failed to start conversation:', error);
        return null;
      }
    },

    deleteConversation: async (id: string) => {
      // Optimistic removal
      set(state => ({
        conversations: state.conversations.filter(c => c.id !== id),
        activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
        messages: state.activeConversationId === id ? [] : state.messages,
      }));

      try {
        await pulseService.deleteConversation(id);
      } catch (error) {
        console.error('Failed to delete conversation:', error);
      }
    },

    archiveConversation: async (id: string, archived: boolean) => {
      try {
        await pulseService.setConversationArchived(id, archived);
        const conversations = await pulseService.getConversations();
        set({ conversations });
      } catch (error) {
        console.error('Failed to archive conversation:', error);
      }
    },

    muteConversation: async (id: string, muted: boolean) => {
      try {
        await pulseService.setConversationMuted(id, muted);
        const conversations = await pulseService.getConversations();
        set({ conversations });
      } catch (error) {
        console.error('Failed to mute conversation:', error);
      }
    },

    // ── Messages ──────────────────────────────────────────

    sendMessage: async (content: string) => {
      const { activeConversationId, conversations } = get();
      if (!activeConversationId || !content.trim()) return;

      const conversation = conversations.find(c => c.id === activeConversationId);
      if (!conversation?.other_user) return;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const optimistic: PulseMessage = {
        id: tempId,
        sender_id: '', // Will be set by the component using currentUser.id
        recipient_id: conversation.other_user.id,
        thread_id: activeConversationId,
        content: content.trim(),
        content_type: 'text',
        media_url: null,
        is_read: false,
        read_at: null,
        is_deleted: false,
        deleted_at: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      set(state => ({ messages: [...state.messages, optimistic] }));

      try {
        await pulseService.sendMessage(conversation.other_user.id, content.trim());

        // Small delay for DB sync, then reload
        await new Promise(r => setTimeout(r, 100));
        const messages = await pulseService.getMessages(activeConversationId);
        set({ messages });

        const convs = await pulseService.getConversations();
        set({ conversations: convs });
      } catch (error) {
        console.error('Failed to send message:', error);
        // Remove optimistic message
        set(state => ({ messages: state.messages.filter(m => m.id !== tempId) }));
      }
    },

    sendMessageWithFile: async (file: File, caption?: string) => {
      const { activeConversationId, conversations } = get();
      if (!activeConversationId) return;

      const conversation = conversations.find(c => c.id === activeConversationId);
      if (!conversation?.other_user) return;

      try {
        await pulseService.sendMessageWithAttachment(
          conversation.other_user.id,
          file,
          caption
        );
        const messages = await pulseService.getMessages(activeConversationId);
        set({ messages });

        const convs = await pulseService.getConversations();
        set({ conversations: convs });
      } catch (error) {
        console.error('Failed to send file:', error);
      }
    },

    loadMoreMessages: async () => {
      const { activeConversationId, isLoadingMore, hasMoreMessages, messages } = get();
      if (!activeConversationId || isLoadingMore || !hasMoreMessages) return;

      set({ isLoadingMore: true });

      try {
        const oldest = messages[0];
        const { messages: older, hasMore } = await pulseService.getMessagesPaginated(
          activeConversationId, 50, oldest?.created_at
        );

        if (older.length > 0) {
          // Load reactions for new messages
          const newIds = older.map(m => m.id);
          const newReactions = await pulseService.getReactionsForMessages(newIds);

          set(state => ({
            messages: [...older, ...state.messages],
            hasMoreMessages: hasMore,
            reactions: { ...state.reactions, ...newReactions },
            isLoadingMore: false,
          }));
        } else {
          set({ hasMoreMessages: false, isLoadingMore: false });
        }
      } catch (error) {
        console.error('Failed to load more messages:', error);
        set({ isLoadingMore: false });
      }
    },

    reloadMessages: async () => {
      const { activeConversationId } = get();
      if (!activeConversationId) return;

      try {
        const messages = await pulseService.getMessages(activeConversationId);
        set({ messages });
      } catch (error) {
        console.error('Failed to reload messages:', error);
      }
    },

    // ── Reactions ──────────────────────────────────────────

    toggleReaction: async (messageId: string, emoji: string) => {
      if (messageId.startsWith('temp-')) return;

      // Optimistic update
      set(state => {
        const reactions = { ...state.reactions };
        const msgReactions = [...(reactions[messageId] || [])];
        const idx = msgReactions.findIndex(r => r.emoji === emoji);

        if (idx >= 0) {
          if (msgReactions[idx].me) {
            msgReactions[idx] = { ...msgReactions[idx], count: msgReactions[idx].count - 1, me: false };
            if (msgReactions[idx].count === 0) msgReactions.splice(idx, 1);
          } else {
            msgReactions[idx] = { ...msgReactions[idx], count: msgReactions[idx].count + 1, me: true };
          }
        } else {
          msgReactions.push({ emoji, count: 1, me: true });
        }

        reactions[messageId] = msgReactions;
        return { reactions };
      });

      try {
        await pulseService.toggleReaction(messageId, emoji);
      } catch (error) {
        console.error('Failed to toggle reaction:', error);
        // Reload from server
        const { messages } = get();
        const ids = messages.filter(m => !m.id.startsWith('temp-')).map(m => m.id);
        if (ids.length > 0) {
          const reactions = await pulseService.getReactionsForMessages(ids);
          set({ reactions });
        }
      }
    },

    loadReactions: async (messageIds: string[]) => {
      if (messageIds.length === 0) return;
      const reactions = await pulseService.getReactionsForMessages(messageIds);
      set({ reactions });
    },

    // ── Stars ──────────────────────────────────────────────

    toggleStar: async (messageId: string) => {
      if (messageId.startsWith('temp-')) return;

      // Optimistic update
      set(state => {
        const newSet = new Set(state.starredIds);
        if (newSet.has(messageId)) newSet.delete(messageId);
        else newSet.add(messageId);
        return { starredIds: newSet };
      });

      try {
        await pulseService.toggleStar(messageId);
      } catch (error) {
        console.error('Failed to toggle star:', error);
        const stars = await pulseService.getStarredMessageIds();
        set({ starredIds: stars });
      }
    },

    loadStars: async () => {
      const stars = await pulseService.getStarredMessageIds();
      set({ starredIds: stars });
    },

    // ── Editing ──────────────────────────────────────────

    startEditing: (msg: PulseMessage) => {
      set({ editingMessageId: msg.id, editText: msg.content });
    },

    saveEdit: async () => {
      const { editingMessageId, editText, activeConversationId } = get();
      if (!editingMessageId || !editText.trim()) return;

      // Optimistic update
      set(state => ({
        messages: state.messages.map(m =>
          m.id === editingMessageId
            ? { ...m, content: editText, metadata: { ...m.metadata, edited: true, edited_at: new Date().toISOString() } }
            : m
        ),
        editingMessageId: null,
        editText: '',
      }));

      try {
        await pulseService.editMessage(editingMessageId, editText);
      } catch (error) {
        console.error('Failed to edit message:', error);
        if (activeConversationId) {
          const messages = await pulseService.getMessages(activeConversationId);
          set({ messages });
        }
      }
    },

    cancelEdit: () => {
      set({ editingMessageId: null, editText: '' });
    },

    // ── Reply ──────────────────────────────────────────────

    setReplyingTo: (msg: PulseMessage | null) => {
      set({ replyingTo: msg });
    },

    // ── Forwarding ──────────────────────────────────────────

    forwardMessage: async (messageId: string, recipientId: string) => {
      try {
        await pulseService.forwardMessage(messageId, recipientId);
        const conversations = await pulseService.getConversations();
        set({ conversations });
      } catch (error) {
        console.error('Failed to forward message:', error);
      }
    },

    // ── Typing ──────────────────────────────────────────────

    setOtherUserTyping: (typing: boolean) => {
      set({ otherUserTyping: typing });
    },

    broadcastTyping: () => {
      const { activeConversationId } = get();
      if (activeConversationId) {
        pulseService.broadcastTyping(activeConversationId, true);
      }
    },

    // ── Search / Discovery ──────────────────────────────────

    searchUsers: async (query: string) => {
      set({ userSearchQuery: query, isSearchingUsers: true });
      try {
        const results = await pulseService.searchUsers(query);
        set({ userSearchResults: results, isSearchingUsers: false });
      } catch (error) {
        console.error('User search failed:', error);
        set({ userSearchResults: [], isSearchingUsers: false });
      }
    },

    clearUserSearch: () => {
      set({ userSearchQuery: '', userSearchResults: [] });
    },

    loadSuggestedUsers: async () => {
      try {
        const suggestions = await pulseService.getAllUsers(20);
        set({ suggestedUsers: suggestions });
      } catch (error) {
        console.error('Failed to load suggested users:', error);
      }
    },

    loadRecentContacts: async () => {
      try {
        const contacts = await pulseService.getRecentContacts(5);
        set({ recentContacts: contacts });
      } catch (error) {
        console.error('Failed to load recent contacts:', error);
      }
    },

    // ── Context menu ──────────────────────────────────────

    openContextMenu: (msgId: string, x: number, y: number) => {
      set({ contextMenuMsgId: msgId, contextMenuPosition: { x, y } });
    },

    closeContextMenu: () => {
      set({ contextMenuMsgId: null, contextMenuPosition: null });
    },

    // ── Realtime ──────────────────────────────────────────

    handleRealtimeMessage: (msg: PulseMessage, currentUserId: string) => {
      const isRelevant = msg.sender_id === currentUserId || msg.recipient_id === currentUserId;
      if (!isRelevant) return;

      set(state => {
        // Check for duplicate
        if (state.messages.some(m => m.id === msg.id)) return state;
        // Reconcile ONLY the matching optimistic placeholder (sender +
        // content), not every pending temp- row — see the Messages.tsx
        // realtime handler for the "overwritten message" bug this avoids.
        let reconciled = false;
        const next = state.messages.filter(m => {
          if (reconciled || !m.id.startsWith('temp-')) return true;
          if (m.sender_id === msg.sender_id && m.content === msg.content) {
            reconciled = true;
            return false;
          }
          return true;
        });
        return { messages: [...next, msg] };
      });

      // Refresh conversations (async, fire and forget)
      pulseService.getConversations().then(conversations => {
        set({ conversations });
      }).catch(() => {});
    },

    // ── Reset ──────────────────────────────────────────────

    reset: () => {
      set(initialState);
    },
  }))
);

// ==================== Selectors ====================

export const useActiveConversation = () =>
  usePulseMessagesStore(state => {
    const conv = state.conversations.find(c => c.id === state.activeConversationId);
    return conv || null;
  });

export const useConversationMessages = () =>
  usePulseMessagesStore(state => state.messages);

export const useMessageReactions = (messageId: string) =>
  usePulseMessagesStore(state => state.reactions[messageId] || []);

export const useIsStarred = (messageId: string) =>
  usePulseMessagesStore(state => state.starredIds.has(messageId));
