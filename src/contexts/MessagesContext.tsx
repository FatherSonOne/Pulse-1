import React, { createContext, useContext, useCallback, useState, useEffect, ReactNode } from 'react';
import { Thread, Message, Contact } from '../types';
import { dataService } from '../services/dataService';
import { pulseService, PulseConversation, PulseMessage, SearchUserResult } from '../services/pulseService';

// Message Reactions
export interface MessageReaction {
  emoji: string;
  count: number;
  me: boolean;
}

// Messages Context State Interface
export interface MessagesContextState {
  // SMS Threads (legacy)
  threads: Thread[];
  activeThreadId: string;
  setActiveThreadId: (id: string) => void;

  // Pulse Conversations
  pulseConversations: PulseConversation[];
  activePulseConversation: string | null;
  setActivePulseConversation: (id: string | null) => void;
  pulseMessages: PulseMessage[];

  // Message reactions
  pulseMessageReactions: Record<string, Array<MessageReaction>>;
  setPulseMessageReactions: React.Dispatch<React.SetStateAction<Record<string, Array<MessageReaction>>>>;

  // Starred messages
  starredPulseMessages: Set<string>;
  setStarredPulseMessages: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Reply state
  replyingToPulseMessage: PulseMessage | null;
  setReplyingToPulseMessage: React.Dispatch<React.SetStateAction<PulseMessage | null>>;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;

  // Pulse user search
  pulseUserSearch: string;
  setPulseUserSearch: (query: string) => void;
  pulseSearchResults: SearchUserResult[];
  setPulseSearchResults: React.Dispatch<React.SetStateAction<SearchUserResult[]>>;
  isSearchingPulseUsers: boolean;
  setIsSearchingPulseUsers: (searching: boolean) => void;
  suggestedPulseUsers: SearchUserResult[];
  recentPulseContacts: SearchUserResult[];

  // Context menu
  pulseContextMenuMsgId: string | null;
  setPulseContextMenuMsgId: (id: string | null) => void;
  pulseContextMenuPosition: { x: number; y: number } | null;
  setPulseContextMenuPosition: (pos: { x: number; y: number } | null) => void;

  // Contact panel
  selectedContactUserId: string | null;
  setSelectedContactUserId: (id: string | null) => void;
  showContactPanel: boolean;
  setShowContactPanel: (show: boolean) => void;

  // Typing indicators
  typingThreads: Record<string, boolean>;
  setTypingThreads: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  typingUsers: string[];
  setTypingUsers: React.Dispatch<React.SetStateAction<string[]>>;

  // Mobile view
  mobileView: 'list' | 'chat';
  setMobileView: (view: 'list' | 'chat') => void;

  // Loading states
  isLoading: boolean;

  // Actions
  loadThreads: () => Promise<void>;
  loadPulseConversations: () => Promise<void>;
  loadPulseMessages: (conversationId: string) => Promise<void>;
  sendPulseMessage: (conversationId: string, content: string, replyTo?: string) => Promise<void>;
  addReactionToPulseMessage: (messageId: string, emoji: string) => void;
  toggleStarPulseMessage: (messageId: string) => void;
}

const MessagesContext = createContext<MessagesContextState | undefined>(undefined);

export const useMessages = () => {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
};

interface MessagesProviderProps {
  children: ReactNode;
  currentUser?: {
    id: string;
    name: string;
    email: string;
  };
}

export const MessagesProvider: React.FC<MessagesProviderProps> = ({ children, currentUser }) => {
  // SMS Threads (legacy)
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Pulse Conversations
  const [pulseConversations, setPulseConversations] = useState<PulseConversation[]>([]);
  const [activePulseConversation, setActivePulseConversation] = useState<string | null>(null);
  const [pulseMessages, setPulseMessages] = useState<PulseMessage[]>([]);

  // Message reactions and features
  const [pulseMessageReactions, setPulseMessageReactions] = useState<Record<string, Array<MessageReaction>>>({});
  const [starredPulseMessages, setStarredPulseMessages] = useState<Set<string>>(new Set());
  const [replyingToPulseMessage, setReplyingToPulseMessage] = useState<PulseMessage | null>(null);

  // Context menu
  const [pulseContextMenuMsgId, setPulseContextMenuMsgId] = useState<string | null>(null);
  const [pulseContextMenuPosition, setPulseContextMenuPosition] = useState<{ x: number; y: number } | null>(null);

  // Contact panel
  const [selectedContactUserId, setSelectedContactUserId] = useState<string | null>(null);
  const [showContactPanel, setShowContactPanel] = useState(false);

  // Typing indicators
  const [typingThreads, setTypingThreads] = useState<Record<string, boolean>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Pulse user search
  const [pulseUserSearch, setPulseUserSearch] = useState('');
  const [pulseSearchResults, setPulseSearchResults] = useState<SearchUserResult[]>([]);
  const [isSearchingPulseUsers, setIsSearchingPulseUsers] = useState(false);
  const [suggestedPulseUsers, setSuggestedPulseUsers] = useState<SearchUserResult[]>([]);
  const [recentPulseContacts, setRecentPulseContacts] = useState<SearchUserResult[]>([]);

  // Mobile view
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Load SMS threads
  const loadThreads = useCallback(async () => {
    setIsLoading(true);
    try {
      const dbThreads = await dataService.getThreads();
      setThreads(dbThreads);
    } catch (error) {
      console.error('Failed to load threads:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load Pulse conversations
  const loadPulseConversations = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      const conversations = await pulseService.getConversations();
      setPulseConversations(conversations);
    } catch (error) {
      console.error('Failed to load pulse conversations:', error);
    }
  }, [currentUser?.id]);

  // Load messages for a conversation
  const loadPulseMessages = useCallback(async (conversationId: string) => {
    try {
      const messages = await pulseService.getMessages(conversationId);
      setPulseMessages(messages);
    } catch (error) {
      console.error('Failed to load pulse messages:', error);
    }
  }, []);

  // Send a pulse message
  const sendPulseMessage = useCallback(async (conversationId: string, content: string, replyTo?: string) => {
    if (!currentUser?.id) return;

    // Get the conversation to find the recipient
    const conversation = pulseConversations.find(c => c.id === conversationId);
    if (!conversation) {
      console.error('Conversation not found');
      return;
    }

    const recipientId = conversation.user1_id === currentUser.id
      ? conversation.user2_id
      : conversation.user1_id;

    try {
      await pulseService.sendMessage(recipientId, content);

      // Reload messages
      await loadPulseMessages(conversationId);
    } catch (error) {
      console.error('Failed to send pulse message:', error);
      throw error;
    }
  }, [currentUser?.id, pulseConversations, loadPulseMessages]);

  // Add reaction to pulse message
  const addReactionToPulseMessage = useCallback((messageId: string, emoji: string) => {
    setPulseMessageReactions(prev => {
      const reactions = prev[messageId] || [];
      const existingIndex = reactions.findIndex(r => r.emoji === emoji);

      if (existingIndex >= 0) {
        // Toggle reaction
        const updated = [...reactions];
        if (updated[existingIndex].me) {
          // Remove reaction
          updated[existingIndex] = {
            ...updated[existingIndex],
            count: updated[existingIndex].count - 1,
            me: false,
          };
          if (updated[existingIndex].count === 0) {
            updated.splice(existingIndex, 1);
          }
        } else {
          // Add reaction
          updated[existingIndex] = {
            ...updated[existingIndex],
            count: updated[existingIndex].count + 1,
            me: true,
          };
        }
        return { ...prev, [messageId]: updated };
      } else {
        // New reaction
        return {
          ...prev,
          [messageId]: [...reactions, { emoji, count: 1, me: true }],
        };
      }
    });
  }, []);

  // Toggle star on pulse message
  const toggleStarPulseMessage = useCallback((messageId: string) => {
    setStarredPulseMessages(prev => {
      const updated = new Set(prev);
      if (updated.has(messageId)) {
        updated.delete(messageId);
      } else {
        updated.add(messageId);
      }
      return updated;
    });
  }, []);

  // Load initial data
  useEffect(() => {
    loadThreads();
    loadPulseConversations();
  }, [loadThreads, loadPulseConversations]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (activePulseConversation) {
      loadPulseMessages(activePulseConversation);
    }
  }, [activePulseConversation, loadPulseMessages]);

  const value: MessagesContextState = {
    threads,
    activeThreadId,
    setActiveThreadId,
    pulseConversations,
    activePulseConversation,
    setActivePulseConversation,
    pulseMessages,
    pulseMessageReactions,
    setPulseMessageReactions,
    starredPulseMessages,
    setStarredPulseMessages,
    replyingToPulseMessage,
    setReplyingToPulseMessage,
    searchQuery,
    setSearchQuery,
    isSearchOpen,
    setIsSearchOpen,
    pulseUserSearch,
    setPulseUserSearch,
    pulseSearchResults,
    setPulseSearchResults,
    isSearchingPulseUsers,
    setIsSearchingPulseUsers,
    suggestedPulseUsers,
    recentPulseContacts,
    pulseContextMenuMsgId,
    setPulseContextMenuMsgId,
    pulseContextMenuPosition,
    setPulseContextMenuPosition,
    selectedContactUserId,
    setSelectedContactUserId,
    showContactPanel,
    setShowContactPanel,
    typingThreads,
    setTypingThreads,
    typingUsers,
    setTypingUsers,
    mobileView,
    setMobileView,
    isLoading,
    loadThreads,
    loadPulseConversations,
    loadPulseMessages,
    sendPulseMessage,
    addReactionToPulseMessage,
    toggleStarPulseMessage,
  };

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
};
