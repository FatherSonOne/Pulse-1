/**
 * usePulseMessaging Hook
 * Extracts Pulse-specific messaging state and logic from Messages.tsx
 */

import { useState, useEffect, useCallback } from 'react';
import { pulseService, SearchUserResult, PulseConversation, PulseMessage } from '../services/pulseService';

export interface UsePulseMessagingReturn {
  // User Search State
  pulseUserSearch: string;
  setPulseUserSearch: (search: string) => void;
  pulseSearchResults: SearchUserResult[];
  isSearchingPulseUsers: boolean;

  // Conversations State
  pulseConversations: PulseConversation[];
  activePulseConversation: string | null;
  setActivePulseConversation: (id: string | null) => void;
  pulseMessages: PulseMessage[];

  // Suggested/Recent Users
  suggestedPulseUsers: SearchUserResult[];
  recentPulseContacts: SearchUserResult[];

  // Message Features
  pulseMessageReactions: Record<string, Array<{ emoji: string; count: number; me: boolean }>>;
  starredPulseMessages: Set<string>;
  replyingToPulseMessage: PulseMessage | null;
  setReplyingToPulseMessage: (message: PulseMessage | null) => void;

  // Context Menu
  pulseContextMenuMsgId: string | null;
  setPulseContextMenuMsgId: (id: string | null) => void;
  pulseContextMenuPosition: { x: number; y: number } | null;
  setPulseContextMenuPosition: (position: { x: number; y: number } | null) => void;

  // Actions
  loadConversationMessages: (conversationId: string) => Promise<void>;
  sendPulseMessage: (conversationId: string, content: string, replyToId?: string) => Promise<boolean>;
  toggleStarPulseMessage: (messageId: string) => void;
  addPulseReaction: (messageId: string, emoji: string) => void;
  removePulseReaction: (messageId: string, emoji: string) => void;
  startConversationWithUser: (user: SearchUserResult) => Promise<string | null>;
  refreshConversations: () => Promise<void>;
}

export function usePulseMessaging(): UsePulseMessagingReturn {
  // User Search State
  const [pulseUserSearch, setPulseUserSearch] = useState('');
  const [pulseSearchResults, setPulseSearchResults] = useState<SearchUserResult[]>([]);
  const [isSearchingPulseUsers, setIsSearchingPulseUsers] = useState(false);

  // Conversations State
  const [pulseConversations, setPulseConversations] = useState<PulseConversation[]>([]);
  const [activePulseConversation, setActivePulseConversation] = useState<string | null>(null);
  const [pulseMessages, setPulseMessages] = useState<PulseMessage[]>([]);

  // Suggested/Recent Users
  const [suggestedPulseUsers, setSuggestedPulseUsers] = useState<SearchUserResult[]>([]);
  const [recentPulseContacts, setRecentPulseContacts] = useState<SearchUserResult[]>([]);

  // Message Features
  const [pulseMessageReactions, setPulseMessageReactions] = useState<Record<string, Array<{ emoji: string; count: number; me: boolean }>>>({});
  const [starredPulseMessages, setStarredPulseMessages] = useState<Set<string>>(new Set());
  const [replyingToPulseMessage, setReplyingToPulseMessage] = useState<PulseMessage | null>(null);

  // Context Menu
  const [pulseContextMenuMsgId, setPulseContextMenuMsgId] = useState<string | null>(null);
  const [pulseContextMenuPosition, setPulseContextMenuPosition] = useState<{ x: number; y: number } | null>(null);

  // Load Pulse conversations, suggestions, and recent contacts on mount
  useEffect(() => {
    const loadPulseData = async () => {
      try {
        // Load existing conversations
        const conversations = await pulseService.getConversations();
        setPulseConversations(conversations);

        // Load recent contacts for quick access
        const recentContacts = await pulseService.getRecentContacts(5);
        setRecentPulseContacts(recentContacts);

        // Load suggested users
        const suggestions = await pulseService.getAllUsers(20);
        setSuggestedPulseUsers(suggestions);
      } catch (error) {
        console.error('Failed to load Pulse data:', error);
      }
    };
    loadPulseData();
  }, []);

  // Real-time subscription for Pulse messages
  useEffect(() => {
    if (!activePulseConversation) return;

    const unsubscribe = pulseService.subscribeToMessages(async (newMessage) => {
      // Only process messages for the active conversation
      if (newMessage.conversationId !== activePulseConversation) {
        return;
      }

      // Add the new message to our list
      setPulseMessages(prev => {
        // Check if message already exists
        if (prev.some(m => m.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });

      // Refresh conversation list to update last message preview
      try {
        const conversations = await pulseService.getConversations();
        setPulseConversations(conversations);
      } catch (error) {
        console.error('Failed to refresh conversations:', error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activePulseConversation]);

  // Debounced Pulse user search - trigger at 1 character for faster discovery
  useEffect(() => {
    if (!pulseUserSearch || pulseUserSearch.length < 1) {
      setPulseSearchResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearchingPulseUsers(true);
      try {
        const results = await pulseService.searchUsers(pulseUserSearch);
        setPulseSearchResults(results);
      } catch (error) {
        console.error('Pulse user search failed:', error);
        setPulseSearchResults([]);
      } finally {
        setIsSearchingPulseUsers(false);
      }
    }, 200);

    return () => clearTimeout(searchTimeout);
  }, [pulseUserSearch]);

  // Load messages for a conversation
  const loadConversationMessages = useCallback(async (conversationId: string) => {
    try {
      const messages = await pulseService.getMessages(conversationId);
      setPulseMessages(messages);
    } catch (error) {
      console.error('Failed to load conversation messages:', error);
    }
  }, []);

  // Send a message
  const sendPulseMessage = useCallback(async (
    conversationId: string,
    content: string,
    replyToId?: string
  ): Promise<boolean> => {
    try {
      await pulseService.sendMessage(conversationId, content, replyToId);
      return true;
    } catch (error) {
      console.error('Failed to send Pulse message:', error);
      return false;
    }
  }, []);

  // Toggle star on a message
  const toggleStarPulseMessage = useCallback((messageId: string) => {
    setStarredPulseMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  // Add reaction to a message
  const addPulseReaction = useCallback((messageId: string, emoji: string) => {
    setPulseMessageReactions(prev => {
      const reactions = prev[messageId] || [];
      const existingReaction = reactions.find(r => r.emoji === emoji);

      if (existingReaction) {
        if (existingReaction.me) return prev; // Already reacted
        return {
          ...prev,
          [messageId]: reactions.map(r =>
            r.emoji === emoji ? { ...r, count: r.count + 1, me: true } : r
          ),
        };
      }

      return {
        ...prev,
        [messageId]: [...reactions, { emoji, count: 1, me: true }],
      };
    });
  }, []);

  // Remove reaction from a message
  const removePulseReaction = useCallback((messageId: string, emoji: string) => {
    setPulseMessageReactions(prev => {
      const reactions = prev[messageId] || [];
      const existingReaction = reactions.find(r => r.emoji === emoji);

      if (!existingReaction || !existingReaction.me) return prev;

      if (existingReaction.count === 1) {
        return {
          ...prev,
          [messageId]: reactions.filter(r => r.emoji !== emoji),
        };
      }

      return {
        ...prev,
        [messageId]: reactions.map(r =>
          r.emoji === emoji ? { ...r, count: r.count - 1, me: false } : r
        ),
      };
    });
  }, []);

  // Start a conversation with a user
  const startConversationWithUser = useCallback(async (user: SearchUserResult): Promise<string | null> => {
    try {
      const conversationId = await pulseService.createOrGetConversation(user.id);
      setActivePulseConversation(conversationId);

      // Refresh conversations list
      const conversations = await pulseService.getConversations();
      setPulseConversations(conversations);

      return conversationId;
    } catch (error) {
      console.error('Failed to start conversation:', error);
      return null;
    }
  }, []);

  // Refresh conversations
  const refreshConversations = useCallback(async () => {
    try {
      const conversations = await pulseService.getConversations();
      setPulseConversations(conversations);
    } catch (error) {
      console.error('Failed to refresh conversations:', error);
    }
  }, []);

  return {
    // User Search State
    pulseUserSearch,
    setPulseUserSearch,
    pulseSearchResults,
    isSearchingPulseUsers,

    // Conversations State
    pulseConversations,
    activePulseConversation,
    setActivePulseConversation,
    pulseMessages,

    // Suggested/Recent Users
    suggestedPulseUsers,
    recentPulseContacts,

    // Message Features
    pulseMessageReactions,
    starredPulseMessages,
    replyingToPulseMessage,
    setReplyingToPulseMessage,

    // Context Menu
    pulseContextMenuMsgId,
    setPulseContextMenuMsgId,
    pulseContextMenuPosition,
    setPulseContextMenuPosition,

    // Actions
    loadConversationMessages,
    sendPulseMessage,
    toggleStarPulseMessage,
    addPulseReaction,
    removePulseReaction,
    startConversationWithUser,
    refreshConversations,
  };
}

export default usePulseMessaging;
