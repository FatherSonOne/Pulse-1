// useVideoVox - React hooks for Video Vox functionality
// Provides state management, real-time updates, and easy integration

import { useState, useEffect, useCallback, useRef } from 'react';
import { videoVoxService } from '../services/voxer/videoVoxService';
import type {
  VideoVoxMessage,
  VideoVoxConversation,
  VideoVoxBookmark,
  VideoVoxSearchResult,
} from '../services/voxer/voxModeTypes';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// CONVERSATIONS HOOK
// ============================================

export interface UseVideoVoxConversationsReturn {
  conversations: VideoVoxConversation[];
  isLoading: boolean;
  error: string | null;
  totalUnread: number;
  refresh: () => Promise<void>;
  createConversation: (participantIds: string[]) => Promise<VideoVoxConversation | null>;
  markAsRead: (conversationId: string) => Promise<void>;
  toggleMute: (conversationId: string, muted: boolean) => Promise<void>;
}

export function useVideoVoxConversations(): UseVideoVoxConversationsReturn {
  const [conversations, setConversations] = useState<VideoVoxConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [convos, unread] = await Promise.all([
        videoVoxService.getMyConversations(),
        videoVoxService.getTotalUnreadCount()
      ]);
      setConversations(convos);
      setTotalUnread(unread);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createConversation = useCallback(async (participantIds: string[]) => {
    try {
      const conversation = await videoVoxService.getOrCreateConversation(participantIds);
      if (conversation) {
        await refresh();
      }
      return conversation;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [refresh]);

  const markAsRead = useCallback(async (conversationId: string) => {
    await videoVoxService.markConversationAsRead(conversationId);
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c } : c
    ));
    setTotalUnread(prev => Math.max(0, prev - 1));
  }, []);

  const toggleMute = useCallback(async (conversationId: string, muted: boolean) => {
    await videoVoxService.toggleMuteConversation(conversationId, muted);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();

    // Subscribe to new conversations
    subscriptionRef.current = videoVoxService.subscribeToNewConversations((conversation) => {
      setConversations(prev => [conversation, ...prev]);
    });

    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, [refresh]);

  return {
    conversations,
    isLoading,
    error,
    totalUnread,
    refresh,
    createConversation,
    markAsRead,
    toggleMute,
  };
}

// ============================================
// MESSAGES HOOK
// ============================================

export interface UseVideoVoxMessagesOptions {
  conversationId: string;
  limit?: number;
  autoMarkAsRead?: boolean;
}

export interface UseVideoVoxMessagesReturn {
  messages: VideoVoxMessage[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  sendMessage: (
    videoBlob: Blob,
    thumbnailBlob: Blob,
    duration: number,
    options?: {
      caption?: string;
      replyToId?: string;
      replyToTimestamp?: number;
      quotedText?: string;
      mentions?: string[];
    }
  ) => Promise<VideoVoxMessage | null>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  toggleReaction: (messageId: string, emoji: string, timestamp?: number) => Promise<boolean>;
  markAsViewed: (messageId: string, watchDuration?: number, completed?: boolean) => Promise<void>;
}

export function useVideoVoxMessages(options: UseVideoVoxMessagesOptions): UseVideoVoxMessagesReturn {
  const { conversationId, limit = 50, autoMarkAsRead = true } = options;

  const [messages, setMessages] = useState<VideoVoxMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const msgs = await videoVoxService.getConversationMessages(conversationId, { limit });
      setMessages(msgs);
      setOffset(msgs.length);
      setHasMore(msgs.length >= limit);

      if (autoMarkAsRead) {
        await videoVoxService.markConversationAsRead(conversationId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, limit, autoMarkAsRead]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;

    try {
      const moreMsgs = await videoVoxService.getConversationMessages(conversationId, {
        limit,
        offset
      });
      setMessages(prev => [...moreMsgs, ...prev]);
      setOffset(prev => prev + moreMsgs.length);
      setHasMore(moreMsgs.length >= limit);
    } catch (err: any) {
      setError(err.message);
    }
  }, [conversationId, limit, offset, hasMore, isLoading]);

  const sendMessage = useCallback(async (
    videoBlob: Blob,
    thumbnailBlob: Blob,
    duration: number,
    sendOptions?: {
      caption?: string;
      replyToId?: string;
      replyToTimestamp?: number;
      quotedText?: string;
      mentions?: string[];
    }
  ) => {
    // Get recipient IDs from conversation
    const conversation = await videoVoxService.getConversation(conversationId);
    if (!conversation) return null;

    const message = await videoVoxService.uploadAndSendVideoVox(
      conversation.participantIds,
      videoBlob,
      thumbnailBlob,
      duration,
      sendOptions
    );

    // Message will be added via subscription
    return message;
  }, [conversationId]);

  const deleteMessage = useCallback(async (messageId: string) => {
    const success = await videoVoxService.deleteMessage(messageId);
    if (success) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
    return success;
  }, []);

  const toggleReaction = useCallback(async (messageId: string, emoji: string, timestamp?: number) => {
    const success = await videoVoxService.toggleReaction(messageId, emoji, timestamp);
    // Reactions will update via subscription
    return success;
  }, []);

  const markAsViewed = useCallback(async (messageId: string, watchDuration?: number, completed?: boolean) => {
    await videoVoxService.markMessageAsViewed(messageId, watchDuration, completed);
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, status: 'viewed' as const } : m
    ));
  }, []);

  useEffect(() => {
    refresh();

    // Subscribe to new messages
    subscriptionRef.current = videoVoxService.subscribeToConversation(conversationId, (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, [conversationId, refresh]);

  return {
    messages,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    sendMessage,
    deleteMessage,
    toggleReaction,
    markAsViewed,
  };
}

// ============================================
// SINGLE MESSAGE HOOK
// ============================================

export interface UseVideoVoxMessageReturn {
  message: VideoVoxMessage | null;
  isLoading: boolean;
  error: string | null;
  replies: VideoVoxMessage[];
  refresh: () => Promise<void>;
  toggleReaction: (emoji: string, timestamp?: number) => Promise<boolean>;
  toggleBookmark: (note?: string, timestamp?: number) => Promise<boolean>;
  reprocessAI: () => Promise<void>;
}

export function useVideoVoxMessage(messageId: string): UseVideoVoxMessageReturn {
  const [message, setMessage] = useState<VideoVoxMessage | null>(null);
  const [replies, setReplies] = useState<VideoVoxMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [msg, threadReplies] = await Promise.all([
        videoVoxService.getMessage(messageId),
        videoVoxService.getThreadReplies(messageId)
      ]);
      setMessage(msg);
      setReplies(threadReplies);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [messageId]);

  const toggleReaction = useCallback(async (emoji: string, timestamp?: number) => {
    const success = await videoVoxService.toggleReaction(messageId, emoji, timestamp);
    if (success) {
      await refresh();
    }
    return success;
  }, [messageId, refresh]);

  const toggleBookmark = useCallback(async (note?: string, timestamp?: number) => {
    return await videoVoxService.toggleBookmark(messageId, note, timestamp);
  }, [messageId]);

  const reprocessAI = useCallback(async () => {
    await videoVoxService.reprocessWithAI(messageId);
    await refresh();
  }, [messageId, refresh]);

  useEffect(() => {
    refresh();
  }, [messageId, refresh]);

  return {
    message,
    isLoading,
    error,
    replies,
    refresh,
    toggleReaction,
    toggleBookmark,
    reprocessAI,
  };
}

// ============================================
// SEARCH HOOK
// ============================================

export interface UseVideoVoxSearchReturn {
  results: VideoVoxSearchResult[];
  isSearching: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
  clearResults: () => void;
}

export function useVideoVoxSearch(): UseVideoVoxSearchReturn {
  const [results, setResults] = useState<VideoVoxSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      setIsSearching(true);
      setError(null);
      const searchResults = await videoVoxService.searchVideos(query);
      setResults(searchResults);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    isSearching,
    error,
    search,
    clearResults,
  };
}

// ============================================
// BOOKMARKS HOOK
// ============================================

export interface UseVideoVoxBookmarksReturn {
  bookmarks: VideoVoxBookmark[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggleBookmark: (messageId: string, note?: string, timestamp?: number) => Promise<boolean>;
}

export function useVideoVoxBookmarks(): UseVideoVoxBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<VideoVoxBookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const marks = await videoVoxService.getMyBookmarks();
      setBookmarks(marks);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleBookmark = useCallback(async (messageId: string, note?: string, timestamp?: number) => {
    const success = await videoVoxService.toggleBookmark(messageId, note, timestamp);
    if (success) {
      await refresh();
    }
    return success;
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    bookmarks,
    isLoading,
    error,
    refresh,
    toggleBookmark,
  };
}

// ============================================
// SEND VIDEO HOOK (Simplified for single sends)
// ============================================

export interface UseVideoVoxSendReturn {
  isSending: boolean;
  progress: number;
  error: string | null;
  sendToRecipients: (
    recipientIds: string[],
    videoBlob: Blob,
    thumbnailBlob: Blob,
    duration: number,
    options?: {
      caption?: string;
      replyToId?: string;
      mentions?: string[];
    }
  ) => Promise<VideoVoxMessage | null>;
  reset: () => void;
}

export function useVideoVoxSend(): UseVideoVoxSendReturn {
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sendToRecipients = useCallback(async (
    recipientIds: string[],
    videoBlob: Blob,
    thumbnailBlob: Blob,
    duration: number,
    options?: {
      caption?: string;
      replyToId?: string;
      mentions?: string[];
    }
  ) => {
    try {
      setIsSending(true);
      setError(null);
      setProgress(10);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const message = await videoVoxService.uploadAndSendVideoVox(
        recipientIds,
        videoBlob,
        thumbnailBlob,
        duration,
        options
      );

      clearInterval(progressInterval);
      setProgress(100);

      return message;
    } catch (err: any) {
      setError(err.message || 'Failed to send video');
      return null;
    } finally {
      setIsSending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsSending(false);
    setProgress(0);
    setError(null);
  }, []);

  return {
    isSending,
    progress,
    error,
    sendToRecipients,
    reset,
  };
}

// All hooks are exported inline with 'export function'
