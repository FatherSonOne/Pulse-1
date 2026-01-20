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
import {
  messageAutoResponseService,
  AutoResponseRule,
} from '../services/messageAutoResponseService';
import {
  messageSummarizationService,
  ThreadSummary,
  DailyDigest,
  CatchUpSummary,
} from '../services/messageSummarizationService';
import {
  conversationIntelligenceService,
  ConversationIntelligence,
} from '../services/conversationIntelligenceService';
import {
  focusModeService,
  FocusSession,
  FocusSessionStats,
} from '../services/focusModeService';
import { getSessionUserSync } from '../services/authService';

// ==================== Auth Helper ====================

/**
 * Get the current user ID from auth service
 * Returns 'guest' if no user is authenticated (fallback for demo mode)
 */
const getCurrentUserId = (): string => {
  const user = getSessionUserSync();
  return user?.id || 'guest';
};

/**
 * Get the current user name from auth service
 * Returns 'Guest' if no user is authenticated
 */
const getCurrentUserName = (): string => {
  const user = getSessionUserSync();
  return user?.name || 'Guest';
};

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

  // Focus Mode
  isFocusModeActive: boolean;
  focusSession: FocusSession | null;
  focusStats: FocusSessionStats | null;

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

  // Auto-Response
  autoResponseRules: AutoResponseRule[];
  isCheckingAutoResponse: boolean;
  autoResponseEnabled: boolean;

  // Summarization
  threadSummaries: Record<string, ThreadSummary>; // threadId -> summary
  dailyDigest: DailyDigest | null;
  catchUpSummary: CatchUpSummary | null;
  isGeneratingSummary: boolean;

  // Conversation Intelligence
  conversationIntelligence: Record<string, ConversationIntelligence>; // channelId -> intelligence
  isAnalyzingConversation: boolean;

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

  // Actions - Auto-Response
  checkAutoResponse: (message: ChannelMessage) => Promise<void>;
  loadAutoResponseRules: (userId: string) => Promise<void>;
  toggleAutoResponse: (enabled: boolean) => void;

  // Actions - Summarization
  summarizeThread: (threadId: string, apiKey: string) => Promise<void>;
  generateDailyDigest: (workspaceId: string, date: Date, apiKey: string) => Promise<void>;
  generateCatchUpSummary: (sinceDate: Date, apiKey: string) => Promise<void>;

  // Actions - Conversation Intelligence
  analyzeConversation: (apiKey: string) => Promise<void>;
  refreshIntelligence: (apiKey: string) => Promise<void>;

  // Actions - Retry Failed
  retryFailedMessage: (tempId: string) => Promise<void>;
  removeFailedMessage: (tempId: string) => void;

  // Actions - Focus Mode
  toggleFocusMode: (active: boolean) => void;
  startFocusSession: (userId: string, threadId: string) => Promise<void>;
  endFocusSession: (sessionId: string, actualDuration: number, completed: boolean) => Promise<void>;
  loadFocusStats: (userId: string) => Promise<void>;
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

      // Auto-Response
      autoResponseRules: [],
      isCheckingAutoResponse: false,
      autoResponseEnabled: false,

      // Summarization
      threadSummaries: {},
      dailyDigest: null,
      catchUpSummary: null,
      isGeneratingSummary: false,

      // Conversation Intelligence
      conversationIntelligence: {},
      isAnalyzingConversation: false,

      // Focus Mode
      isFocusModeActive: false,
      focusSession: null,
      focusStats: null,

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

        // Get authenticated user
        const userId = getCurrentUserId();
        const userName = getCurrentUserName();

        set((state) => {
          state.isSending = true;
        });

        // Create optimistic message
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = messageChannelService.createOptimisticMessage(
          selectedChannelId,
          userId,
          userName,
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
            userId,
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

          const userId = getCurrentUserId();
          await messageChannelService.addReaction(messageId, emoji, userId);
          set((state) => {
            const message = state.messages[selectedChannelId].find((m) => m.id === messageId);
            if (message) {
              if (!message.reactions) message.reactions = {};
              if (!message.reactions[emoji]) message.reactions[emoji] = [];
              if (!message.reactions[emoji].includes(userId)) {
                message.reactions[emoji].push(userId);
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

          const userId = getCurrentUserId();
          await messageChannelService.removeReaction(messageId, emoji, userId);
          set((state) => {
            const message = state.messages[selectedChannelId].find((m) => m.id === messageId);
            if (message?.reactions?.[emoji]) {
              message.reactions[emoji] = message.reactions[emoji].filter(
                (id) => id !== userId
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
          const userId = getCurrentUserId();
          const replies = await messageChannelService.getSmartReplies(
            apiKey,
            selectedChannelId,
            userId
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

      // ==================== Auto-Response Actions ====================

      checkAutoResponse: async (message: ChannelMessage) => {
        const { selectedChannelId, autoResponseEnabled } = get();
        if (!autoResponseEnabled || !selectedChannelId) return;

        set((state) => {
          state.isCheckingAutoResponse = true;
        });

        try {
          // Get user ID (assuming from auth)
          const userId = getCurrentUserId();

          const response = await messageAutoResponseService.checkAutoResponse(
            message,
            selectedChannelId,
            userId
          );

          if (response) {
            // Auto-send the response
            await get().sendMessage(response);
          }
        } catch (error) {
          console.error('[Store] Error checking auto-response:', error);
        } finally {
          set((state) => {
            state.isCheckingAutoResponse = false;
          });
        }
      },

      loadAutoResponseRules: async (userId: string) => {
        try {
          const rules = await messageAutoResponseService.getRules(userId);
          set((state) => {
            state.autoResponseRules = rules;
          });
        } catch (error) {
          console.error('[Store] Error loading auto-response rules:', error);
        }
      },

      toggleAutoResponse: (enabled: boolean) => {
        set((state) => {
          state.autoResponseEnabled = enabled;
        });
      },

      // ==================== Summarization Actions ====================

      summarizeThread: async (threadId: string, apiKey: string) => {
        const { selectedChannelId } = get();
        if (!selectedChannelId) return;

        set((state) => {
          state.isGeneratingSummary = true;
        });

        try {
          const userId = getCurrentUserId();

          const summary = await messageSummarizationService.summarizeThread(
            selectedChannelId,
            threadId,
            userId,
            apiKey
          );

          set((state) => {
            state.threadSummaries[threadId] = summary;
            state.isGeneratingSummary = false;
          });
        } catch (error) {
          console.error('[Store] Error summarizing thread:', error);
          set((state) => {
            state.error = 'Failed to generate thread summary';
            state.isGeneratingSummary = false;
          });
        }
      },

      generateDailyDigest: async (workspaceId: string, date: Date, apiKey: string) => {
        set((state) => {
          state.isGeneratingSummary = true;
        });

        try {
          const userId = getCurrentUserId();

          const digest = await messageSummarizationService.generateDailyDigest(
            userId,
            workspaceId,
            date,
            apiKey
          );

          set((state) => {
            state.dailyDigest = digest;
            state.isGeneratingSummary = false;
          });
        } catch (error) {
          console.error('[Store] Error generating daily digest:', error);
          set((state) => {
            state.error = 'Failed to generate daily digest';
            state.isGeneratingSummary = false;
          });
        }
      },

      generateCatchUpSummary: async (sinceDate: Date, apiKey: string) => {
        const { selectedChannelId } = get();
        if (!selectedChannelId) return;

        set((state) => {
          state.isGeneratingSummary = true;
        });

        try {
          const userId = getCurrentUserId();

          const catchUp = await messageSummarizationService.generateCatchUpSummary(
            selectedChannelId,
            userId,
            sinceDate,
            apiKey
          );

          set((state) => {
            state.catchUpSummary = catchUp;
            state.isGeneratingSummary = false;
          });
        } catch (error) {
          console.error('[Store] Error generating catch-up summary:', error);
          set((state) => {
            state.error = 'Failed to generate catch-up summary';
            state.isGeneratingSummary = false;
          });
        }
      },

      // ==================== Conversation Intelligence Actions ====================

      analyzeConversation: async (apiKey: string) => {
        const { selectedChannelId, messages } = get();
        if (!selectedChannelId) return;

        const channelMessages = messages[selectedChannelId] || [];
        if (channelMessages.length === 0) return;

        set((state) => {
          state.isAnalyzingConversation = true;
        });

        try {
          const userId = getCurrentUserId();

          const intelligence = await conversationIntelligenceService.analyzeConversation(
            selectedChannelId,
            channelMessages,
            userId,
            apiKey
          );

          set((state) => {
            state.conversationIntelligence[selectedChannelId] = intelligence;
            state.isAnalyzingConversation = false;
          });
        } catch (error) {
          console.error('[Store] Error analyzing conversation:', error);
          set((state) => {
            state.isAnalyzingConversation = false;
          });
        }
      },

      refreshIntelligence: async (apiKey: string) => {
        const { selectedChannelId } = get();
        if (!selectedChannelId) {
          return;
        }

        // Clear cache to force fresh analysis
        conversationIntelligenceService.clearCache(selectedChannelId);
        await get().analyzeConversation(apiKey);
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

      // ==================== Focus Mode Actions ====================

      toggleFocusMode: (active: boolean) => {
        set((state) => {
          state.isFocusModeActive = active;
        });
      },

      startFocusSession: async (userId: string, threadId: string) => {
        try {
          const session = await focusModeService.startSession(userId, threadId);
          if (session) {
            set((state) => {
              state.focusSession = session;
            });
          }
        } catch (error) {
          console.error('[Store] Error starting focus session:', error);
        }
      },

      endFocusSession: async (
        sessionId: string,
        actualDuration: number,
        completed: boolean
      ) => {
        try {
          await focusModeService.endSession(sessionId, actualDuration, completed);
          set((state) => {
            state.focusSession = null;
          });
        } catch (error) {
          console.error('[Store] Error ending focus session:', error);
        }
      },

      loadFocusStats: async (userId: string) => {
        try {
          const stats = await focusModeService.getSessionStats(userId);
          set((state) => {
            state.focusStats = stats;
          });
        } catch (error) {
          console.error('[Store] Error loading focus stats:', error);
        }
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
