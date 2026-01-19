// src/store/messageStore.ts
// Zustand store for Messages component - Option B Architecture

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  MessageChannel,
  ChannelMessage,
  ChannelMember,
} from '../types/messages';
import {
  messageChannelService,
  TypingIndicator,
  SmartReplyOption,
  DraftAnalysisResult,
  SearchResult,
} from '../services/messageChannelService';

// ==================== Types ====================

interface MessagesState {
  // Core Data
  channels: MessageChannel[];
  selectedChannelId: string | null;
  messages: Record<string, ChannelMessage[]>; // channelId -> messages
  members: Record<string, ChannelMember[]>; // channelId -> members

  // UI State
  isLoading: boolean;
  isSending: boolean;
  isSearching: boolean;
  error: string | null;
  mobileView: 'channels' | 'chat';

  // Typing Indicators
  typingUsers: Record<string, TypingIndicator[]>; // channelId -> typing users

  // Search
  searchQuery: string;
  searchResults: SearchResult[];
  searchFilters: {
    channelId?: string;
    hasAttachments?: boolean;
    isPinned?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
  };

  // AI Features
  smartReplies: SmartReplyOption[];
  draftAnalysis: DraftAnalysisResult | null;
  isAnalyzingDraft: boolean;
  isGeneratingReplies: boolean;

  // Message Composer
  draft: string;
  replyingTo: ChannelMessage | null;
  attachments: File[];

  // Optimistic Updates
  pendingMessages: Record<string, ChannelMessage>; // tempId -> message
  failedMessages: Record<string, { message: ChannelMessage; error: string }>;

  // Channel Stats
  channelStats: Record<string, {
    totalMessages: number;
    messagesThisWeek: number;
    pinnedCount: number;
  }>;

  // Actions - Channels
  loadChannels: (workspaceId: string) => Promise<void>;
  selectChannel: (channelId: string) => void;
  createChannel: (
    workspaceId: string,
    name: string,
    description?: string,
    isGroup?: boolean
  ) => Promise<MessageChannel | null>;
  deleteChannel: (channelId: string) => Promise<boolean>;

  // Actions - Messages
  loadMessages: (channelId: string, limit?: number) => Promise<void>;
  sendMessage: (content: string, messageType?: 'text' | 'image' | 'file' | 'voice') => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  pinMessage: (messageId: string, isPinned: boolean) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;

  // Actions - Reply
  setReplyingTo: (message: ChannelMessage | null) => void;
  clearReply: () => void;

  // Actions - Draft
  setDraft: (text: string) => void;
  clearDraft: () => void;
  analyzeDraft: (apiKey: string) => Promise<void>;

  // Actions - AI
  generateSmartReplies: (apiKey: string) => Promise<void>;
  applySmartReply: (reply: SmartReplyOption) => void;

  // Actions - Search
  setSearchQuery: (query: string) => void;
  search: (workspaceId: string, query: string) => Promise<void>;
  clearSearch: () => void;
  setSearchFilters: (filters: Partial<MessagesState['searchFilters']>) => void;

  // Actions - Typing
  sendTypingIndicator: (userId: string, userName: string) => Promise<void>;
  addTypingUser: (channelId: string, indicator: TypingIndicator) => void;
  removeTypingUser: (channelId: string, userId: string) => void;

  // Actions - Subscriptions
  subscribeToChannel: (channelId: string) => void;
  unsubscribeFromChannel: (channelId: string) => void;

  // Actions - UI
  setMobileView: (view: 'channels' | 'chat') => void;
  clearError: () => void;

  // Actions - Retry Failed
  retryFailedMessage: (tempId: string) => Promise<void>;
  removeFailedMessage: (tempId: string) => void;
}

// ==================== Store ====================

export const useMessagesStore = create<MessagesState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial State
      channels: [],
      selectedChannelId: null,
      messages: {},
      members: {},
      isLoading: false,
      isSending: false,
      isSearching: false,
      error: null,
      mobileView: 'channels',
      typingUsers: {},
      searchQuery: '',
      searchResults: [],
      searchFilters: {},
      smartReplies: [],
      draftAnalysis: null,
      isAnalyzingDraft: false,
      isGeneratingReplies: false,
      draft: '',
      replyingTo: null,
      attachments: [],
      pendingMessages: {},
      failedMessages: {},
      channelStats: {},

      // ==================== Channel Actions ====================

      loadChannels: async (workspaceId: string) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const channels = await messageChannelService.getChannels(workspaceId);
          set((state) => {
            state.channels = channels;
            state.isLoading = false;
            // Auto-select first channel if none selected
            if (!state.selectedChannelId && channels.length > 0) {
              state.selectedChannelId = channels[0].id;
            }
          });
        } catch (error) {
          set((state) => {
            state.error = 'Failed to load channels';
            state.isLoading = false;
          });
        }
      },

      selectChannel: (channelId: string) => {
        set((state) => {
          state.selectedChannelId = channelId;
          state.mobileView = 'chat';
          state.smartReplies = [];
          state.draftAnalysis = null;
        });

        // Load messages for this channel
        get().loadMessages(channelId);
      },

      createChannel: async (workspaceId, name, description, isGroup = false) => {
        try {
          const channel = await messageChannelService.createChannel(
            workspaceId,
            name,
            description,
            isGroup
          );
          set((state) => {
            state.channels.push(channel);
            state.selectedChannelId = channel.id;
          });
          return channel;
        } catch (error) {
          set((state) => {
            state.error = 'Failed to create channel';
          });
          return null;
        }
      },

      deleteChannel: async (channelId: string) => {
        try {
          await messageChannelService.deleteChannel(channelId);
          set((state) => {
            state.channels = state.channels.filter((c) => c.id !== channelId);
            if (state.selectedChannelId === channelId) {
              state.selectedChannelId = state.channels[0]?.id || null;
            }
            delete state.messages[channelId];
            delete state.members[channelId];
          });
          return true;
        } catch (error) {
          return false;
        }
      },

      // ==================== Message Actions ====================

      loadMessages: async (channelId: string, limit = 50) => {
        set((state) => {
          state.isLoading = true;
        });

        try {
          const messages = await messageChannelService.getMessages(channelId, limit);
          set((state) => {
            state.messages[channelId] = messages;
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
          });
        }
      },

      sendMessage: async (content: string, messageType = 'text') => {
        const { selectedChannelId, draft, replyingTo } = get();
        if (!selectedChannelId || !content.trim()) return;

        set((state) => {
          state.isSending = true;
        });

        // Create optimistic message
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = messageChannelService.createOptimisticMessage(
          selectedChannelId,
          'current-user',
          'You',
          content,
          messageType
        );
        optimisticMessage.id = tempId;

        set((state) => {
          state.pendingMessages[tempId] = optimisticMessage;
          if (!state.messages[selectedChannelId]) {
            state.messages[selectedChannelId] = [];
          }
          state.messages[selectedChannelId].push(optimisticMessage);
          state.draft = '';
          state.replyingTo = null;
          state.smartReplies = [];
          state.draftAnalysis = null;
        });

        try {
          const message = await messageChannelService.sendMessage(
            selectedChannelId,
            'current-user',
            content,
            messageType
          );

          set((state) => {
            // Replace optimistic with real message
            const channelMessages = state.messages[selectedChannelId];
            const index = channelMessages.findIndex((m) => m.id === tempId);
            if (index !== -1) {
              channelMessages[index] = message;
            }
            delete state.pendingMessages[tempId];
            state.isSending = false;
          });
        } catch (error) {
          set((state) => {
            state.failedMessages[tempId] = {
              message: optimisticMessage,
              error: 'Failed to send message',
            };
            state.isSending = false;
          });
        }
      },

      editMessage: async (messageId: string, content: string) => {
        try {
          const { selectedChannelId } = get();
          if (!selectedChannelId) return;

          const message = await messageChannelService.editMessage(messageId, content);
          set((state) => {
            const channelMessages = state.messages[selectedChannelId];
            const index = channelMessages.findIndex((m) => m.id === messageId);
            if (index !== -1) {
              channelMessages[index] = message;
            }
          });
        } catch (error) {
          set((state) => {
            state.error = 'Failed to edit message';
          });
        }
      },

      deleteMessage: async (messageId: string) => {
        try {
          const { selectedChannelId } = get();
          if (!selectedChannelId) return;

          await messageChannelService.deleteMessage(messageId);
          set((state) => {
            state.messages[selectedChannelId] = state.messages[selectedChannelId].filter(
              (m) => m.id !== messageId
            );
          });
        } catch (error) {
          set((state) => {
            state.error = 'Failed to delete message';
          });
        }
      },

      pinMessage: async (messageId: string, isPinned: boolean) => {
        try {
          const { selectedChannelId } = get();
          if (!selectedChannelId) return;

          await messageChannelService.pinMessage(messageId, isPinned);
          set((state) => {
            const message = state.messages[selectedChannelId].find((m) => m.id === messageId);
            if (message) {
              message.is_pinned = isPinned;
            }
          });
        } catch (error) {
          set((state) => {
            state.error = 'Failed to pin message';
          });
        }
      },

      addReaction: async (messageId: string, emoji: string) => {
        try {
          const { selectedChannelId } = get();
          if (!selectedChannelId) return;

          await messageChannelService.addReaction(messageId, emoji, 'current-user');
          set((state) => {
            const message = state.messages[selectedChannelId].find((m) => m.id === messageId);
            if (message) {
              if (!message.reactions) message.reactions = {};
              if (!message.reactions[emoji]) message.reactions[emoji] = [];
              if (!message.reactions[emoji].includes('current-user')) {
                message.reactions[emoji].push('current-user');
              }
            }
          });
        } catch (error) {
          // Optimistic - already updated
        }
      },

      removeReaction: async (messageId: string, emoji: string) => {
        try {
          const { selectedChannelId } = get();
          if (!selectedChannelId) return;

          await messageChannelService.removeReaction(messageId, emoji, 'current-user');
          set((state) => {
            const message = state.messages[selectedChannelId].find((m) => m.id === messageId);
            if (message?.reactions?.[emoji]) {
              message.reactions[emoji] = message.reactions[emoji].filter(
                (id) => id !== 'current-user'
              );
              if (message.reactions[emoji].length === 0) {
                delete message.reactions[emoji];
              }
            }
          });
        } catch (error) {
          // Already updated optimistically
        }
      },

      // ==================== Reply Actions ====================

      setReplyingTo: (message: ChannelMessage | null) => {
        set((state) => {
          state.replyingTo = message;
        });
      },

      clearReply: () => {
        set((state) => {
          state.replyingTo = null;
        });
      },

      // ==================== Draft Actions ====================

      setDraft: (text: string) => {
        set((state) => {
          state.draft = text;
        });
      },

      clearDraft: () => {
        set((state) => {
          state.draft = '';
          state.draftAnalysis = null;
        });
      },

      analyzeDraft: async (apiKey: string) => {
        const { draft, selectedChannelId } = get();
        if (!draft || !selectedChannelId || draft.length < 10) return;

        set((state) => {
          state.isAnalyzingDraft = true;
        });

        try {
          const analysis = await messageChannelService.analyzeDraft(
            apiKey,
            draft,
            selectedChannelId
          );
          set((state) => {
            state.draftAnalysis = analysis;
            state.isAnalyzingDraft = false;
          });
        } catch (error) {
          set((state) => {
            state.isAnalyzingDraft = false;
          });
        }
      },

      // ==================== AI Actions ====================

      generateSmartReplies: async (apiKey: string) => {
        const { selectedChannelId } = get();
        if (!selectedChannelId) return;

        set((state) => {
          state.isGeneratingReplies = true;
        });

        try {
          const replies = await messageChannelService.getSmartReplies(
            apiKey,
            selectedChannelId
          );
          set((state) => {
            state.smartReplies = replies;
            state.isGeneratingReplies = false;
          });
        } catch (error) {
          set((state) => {
            state.isGeneratingReplies = false;
          });
        }
      },

      applySmartReply: (reply: SmartReplyOption) => {
        set((state) => {
          state.draft = reply.text;
          state.smartReplies = [];
        });
      },

      // ==================== Search Actions ====================

      setSearchQuery: (query: string) => {
        set((state) => {
          state.searchQuery = query;
        });
      },

      search: async (workspaceId: string, query: string) => {
        if (!query.trim()) {
          set((state) => {
            state.searchResults = [];
          });
          return;
        }

        set((state) => {
          state.isSearching = true;
        });

        try {
          const results = await messageChannelService.searchMessagesAdvanced(
            workspaceId,
            query,
            get().searchFilters
          );
          set((state) => {
            state.searchResults = results;
            state.isSearching = false;
          });
        } catch (error) {
          set((state) => {
            state.isSearching = false;
          });
        }
      },

      clearSearch: () => {
        set((state) => {
          state.searchQuery = '';
          state.searchResults = [];
          state.searchFilters = {};
        });
      },

      setSearchFilters: (filters) => {
        set((state) => {
          state.searchFilters = { ...state.searchFilters, ...filters };
        });
      },

      // ==================== Typing Actions ====================

      sendTypingIndicator: async (userId: string, userName: string) => {
        const { selectedChannelId } = get();
        if (!selectedChannelId) return;

        try {
          await messageChannelService.sendTypingIndicator(
            selectedChannelId,
            userId,
            userName
          );
        } catch (error) {
          // Ignore typing indicator errors
        }
      },

      addTypingUser: (channelId: string, indicator: TypingIndicator) => {
        set((state) => {
          if (!state.typingUsers[channelId]) {
            state.typingUsers[channelId] = [];
          }
          const existing = state.typingUsers[channelId].findIndex(
            (t) => t.userId === indicator.userId
          );
          if (existing >= 0) {
            state.typingUsers[channelId][existing] = indicator;
          } else {
            state.typingUsers[channelId].push(indicator);
          }
        });
      },

      removeTypingUser: (channelId: string, userId: string) => {
        set((state) => {
          if (state.typingUsers[channelId]) {
            state.typingUsers[channelId] = state.typingUsers[channelId].filter(
              (t) => t.userId !== userId
            );
          }
        });
      },

      // ==================== Subscription Actions ====================

      subscribeToChannel: (channelId: string) => {
        // Subscribe to messages
        messageChannelService.subscribeToChannelFull(channelId, {
          onInsert: (message) => {
            // Skip if it's our own optimistic message
            if (get().pendingMessages[message.id]) return;

            set((state) => {
              if (!state.messages[channelId]) {
                state.messages[channelId] = [];
              }
              // Avoid duplicates
              if (!state.messages[channelId].find((m) => m.id === message.id)) {
                state.messages[channelId].push(message);
              }
            });
          },
          onUpdate: (message) => {
            set((state) => {
              const index = state.messages[channelId]?.findIndex((m) => m.id === message.id);
              if (index !== undefined && index >= 0) {
                state.messages[channelId][index] = message;
              }
            });
          },
          onDelete: (messageId) => {
            set((state) => {
              state.messages[channelId] = state.messages[channelId]?.filter(
                (m) => m.id !== messageId
              ) || [];
            });
          },
        });

        // Subscribe to typing indicators
        messageChannelService.subscribeToTypingIndicators(
          channelId,
          (indicator) => get().addTypingUser(channelId, indicator),
          (userId) => get().removeTypingUser(channelId, userId)
        );
      },

      unsubscribeFromChannel: (channelId: string) => {
        messageChannelService.unsubscribeFromChannelFull(channelId);
        messageChannelService.unsubscribeFromTypingIndicators(channelId);
      },

      // ==================== UI Actions ====================

      setMobileView: (view) => {
        set((state) => {
          state.mobileView = view;
        });
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },

      // ==================== Failed Message Actions ====================

      retryFailedMessage: async (tempId: string) => {
        const { failedMessages, selectedChannelId } = get();
        const failed = failedMessages[tempId];
        if (!failed || !selectedChannelId) return;

        set((state) => {
          delete state.failedMessages[tempId];
        });

        await get().sendMessage(failed.message.content, failed.message.message_type);
      },

      removeFailedMessage: (tempId: string) => {
        set((state) => {
          delete state.failedMessages[tempId];
          // Remove from messages list
          Object.keys(state.messages).forEach((channelId) => {
            state.messages[channelId] = state.messages[channelId].filter(
              (m) => m.id !== tempId
            );
          });
        });
      },
    }))
  )
);

// ==================== Selectors ====================

export const selectCurrentChannel = (state: MessagesState) =>
  state.channels.find((c) => c.id === state.selectedChannelId);

export const selectCurrentMessages = (state: MessagesState) =>
  state.messages[state.selectedChannelId || ''] || [];

export const selectTypingUsers = (state: MessagesState) =>
  state.typingUsers[state.selectedChannelId || ''] || [];

export const selectHasUnreadMessages = (state: MessagesState) =>
  state.channels.some((c) => (c.unread_count ?? 0) > 0);

export const selectPinnedMessages = (state: MessagesState) =>
  selectCurrentMessages(state).filter((m) => m.is_pinned);

export default useMessagesStore;
