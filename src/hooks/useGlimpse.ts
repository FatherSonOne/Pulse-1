// useGlimpse - React hooks for Video Vox functionality
// Provides state management, real-time updates, and easy integration

import { useState, useEffect, useCallback, useRef } from 'react';
import { glimpseService } from '../services/glimpse/glimpseService';
import { supabase } from '../services/supabase';
import type {
  GlimpseMessage,
  GlimpseConversation,
  GlimpseBookmark,
  GlimpseSearchResult,
} from '../services/glimpse/glimpseTypes';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// CONVERSATIONS HOOK
// ============================================

export interface UseGlimpseConversationsReturn {
  conversations: GlimpseConversation[];
  isLoading: boolean;
  error: string | null;
  totalUnread: number;
  refresh: () => Promise<void>;
  createConversation: (participantIds: string[]) => Promise<GlimpseConversation | null>;
  markAsRead: (conversationId: string) => Promise<void>;
  toggleMute: (conversationId: string, muted: boolean) => Promise<void>;
}

export function useGlimpseConversations(): UseGlimpseConversationsReturn {
  const [conversations, setConversations] = useState<GlimpseConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [convos, unread] = await Promise.all([
        glimpseService.getMyConversations(),
        glimpseService.getTotalUnreadCount()
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
      const conversation = await glimpseService.getOrCreateConversation(participantIds);
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
    await glimpseService.markConversationAsRead(conversationId);
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c } : c
    ));
    setTotalUnread(prev => Math.max(0, prev - 1));
  }, []);

  const toggleMute = useCallback(async (conversationId: string, muted: boolean) => {
    await glimpseService.toggleMuteConversation(conversationId, muted);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();

    // Subscribe to new conversations
    glimpseService.subscribeToNewConversations((conversation) => {
      setConversations(prev => [conversation, ...prev]);
    }).then(channel => {
      subscriptionRef.current = channel;
    });

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
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

export interface UseGlimpseMessagesOptions {
  conversationId: string;
  limit?: number;
  autoMarkAsRead?: boolean;
}

export interface UseGlimpseMessagesReturn {
  messages: GlimpseMessage[];
  bookmarkedIds: Set<string>;
  /** Map of glimpse message id → set of action-item texts already converted to Pulse tasks. */
  convertedActionItems: Map<string, Set<string>>;
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
  ) => Promise<GlimpseMessage | null>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  toggleReaction: (messageId: string, emoji: string, timestamp?: number) => Promise<boolean>;
  toggleBookmark: (messageId: string) => Promise<'added' | 'removed' | null>;
  /** Convert an extracted action item to a Pulse task; updates local state. */
  addActionItemAsTask: (
    message: GlimpseMessage,
    actionItem: string
  ) => Promise<'created' | 'already-exists' | 'failed'>;
  markAsViewed: (messageId: string, watchDuration?: number, completed?: boolean) => Promise<void>;
}

/**
 * useGlimpseMessages — must be called UNCONDITIONALLY by consumers (Rules of
 * Hooks). Pass an empty string for `conversationId` when no conversation is
 * active and the hook will no-op safely (empty messages, no fetch, no
 * subscription).
 */
export function useGlimpseMessages(options: UseGlimpseMessagesOptions): UseGlimpseMessagesReturn {
  const { conversationId, limit = 50, autoMarkAsRead = true } = options;
  const isActive = conversationId.length > 0;

  const [messages, setMessages] = useState<GlimpseMessage[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [convertedActionItems, setConvertedActionItems] = useState<Map<string, Set<string>>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(async () => {
    if (!isActive) {
      setMessages([]);
      setBookmarkedIds(new Set());
      setConvertedActionItems(new Map());
      setOffset(0);
      setHasMore(false);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const msgs = await glimpseService.getConversationMessages(conversationId, { limit });
      setMessages(msgs);
      setOffset(msgs.length);
      setHasMore(msgs.length >= limit);

      // Fetch bookmarks + converted action items in parallel — both are
      // best-effort UI hints, neither blocks the message render.
      const [bookmarks, converted] = await Promise.all([
        glimpseService.getMyBookmarks(),
        glimpseService.getConvertedActionItems(msgs.map((m) => m.id)),
      ]);

      const conversationMessageIds = new Set(msgs.map((m) => m.id));
      const bookmarkedHere = new Set(
        bookmarks
          .filter((b) => conversationMessageIds.has(b.messageId))
          .map((b) => b.messageId)
      );
      setBookmarkedIds(bookmarkedHere);
      setConvertedActionItems(converted);

      if (autoMarkAsRead) {
        await glimpseService.markConversationAsRead(conversationId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, limit, autoMarkAsRead, isActive]);

  const addActionItemAsTask = useCallback(
    async (message: GlimpseMessage, actionItem: string) => {
      const result = await glimpseService.createTaskFromActionItem(actionItem, message);
      if (result.status === 'created' || result.status === 'already-exists') {
        // Update local state so the row immediately renders as ✓ converted
        setConvertedActionItems((prev) => {
          const next = new Map(prev);
          const set = new Set(next.get(message.id) || []);
          set.add(actionItem.trim());
          next.set(message.id, set);
          return next;
        });
      }
      return result.status;
    },
    []
  );

  const loadMore = useCallback(async () => {
    if (!isActive || !hasMore || isLoading) return;

    try {
      const moreMsgs = await glimpseService.getConversationMessages(conversationId, {
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
    if (!isActive) return null;
    // Get recipient IDs from conversation
    const conversation = await glimpseService.getConversation(conversationId);
    if (!conversation) return null;

    const message = await glimpseService.uploadAndSendGlimpse(
      conversation.participantIds,
      videoBlob,
      thumbnailBlob,
      duration,
      sendOptions
    );

    // Message will be added via subscription
    return message;
  }, [conversationId, isActive]);

  const deleteMessage = useCallback(async (messageId: string) => {
    const success = await glimpseService.deleteMessage(messageId);
    if (success) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
    return success;
  }, []);

  const toggleBookmark = useCallback(async (messageId: string) => {
    // Optimistic flip — instant UI update; rollback on server failure.
    const wasBookmarked = bookmarkedIds.has(messageId);
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });

    const result = await glimpseService.toggleBookmark(messageId);

    if (result === null) {
      // Server failed — rollback
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (wasBookmarked) next.add(messageId);
        else next.delete(messageId);
        return next;
      });
    }
    return result;
  }, [bookmarkedIds]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string, timestamp?: number) => {
    const userId = await glimpseService.ensureUserId();
    if (!userId) return false;

    // Optimistically flip the reaction in local state so the bubble updates
    // instantly. We re-apply the same flip on rollback if the server rejects.
    const flip = () =>
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const reactions: Record<string, string[]> = { ...(m.reactions || {}) };
          const users = reactions[emoji] ? [...reactions[emoji]] : [];
          const idx = users.indexOf(userId);
          if (idx >= 0) {
            users.splice(idx, 1);
            if (users.length === 0) delete reactions[emoji];
            else reactions[emoji] = users;
          } else {
            users.push(userId);
            reactions[emoji] = users;
          }
          return { ...m, reactions };
        })
      );

    flip();
    const success = await glimpseService.toggleReaction(messageId, emoji, timestamp);
    if (!success) flip(); // rollback on failure
    return success;
  }, []);

  const markAsViewed = useCallback(async (messageId: string, watchDuration?: number, completed?: boolean) => {
    await glimpseService.markMessageAsViewed(messageId, watchDuration, completed);
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, status: 'viewed' as const } : m
    ));
  }, []);

  useEffect(() => {
    refresh();

    if (!isActive) return;

    let cancelled = false;
    glimpseService
      .subscribeToConversation(conversationId, (message) => {
        setMessages((prev) => [...prev, message]);
      })
      .then((channel) => {
        if (cancelled) {
          if (channel) {
            try {
              supabase.removeChannel(channel);
            } catch {
              /* ignore */
            }
          }
          return;
        }
        subscriptionRef.current = channel ?? null;
      });

    return () => {
      cancelled = true;
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [conversationId, refresh, isActive]);

  // Reactions realtime — subscribe once per conversation, refetch the affected
  // message's full reaction map on any insert/delete so local state always
  // matches the server (avoids double-counting the optimistic flip).
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || cancelled) return;

      channel = supabase
        .channel(`glimpse_reactions:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'video_vox_reactions',
          },
          async (payload) => {
            const messageId =
              (payload.new as { message_id?: string } | null)?.message_id ||
              (payload.old as { message_id?: string } | null)?.message_id;
            if (!messageId) return;
            // Filter to messages in this conversation
            if (!messagesRef.current.some((m) => m.id === messageId)) return;

            const reactions = await glimpseService.getReactionsForMessages([messageId]);
            const next = reactions[messageId] || {};
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? { ...m, reactions: next } : m))
            );
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [conversationId, isActive]);

  return {
    messages,
    bookmarkedIds,
    convertedActionItems,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    sendMessage,
    deleteMessage,
    toggleReaction,
    toggleBookmark,
    addActionItemAsTask,
    markAsViewed,
  };
}

// ============================================
// SINGLE MESSAGE HOOK
// ============================================

export interface UseGlimpseMessageReturn {
  message: GlimpseMessage | null;
  isLoading: boolean;
  error: string | null;
  replies: GlimpseMessage[];
  refresh: () => Promise<void>;
  toggleReaction: (emoji: string, timestamp?: number) => Promise<boolean>;
  toggleBookmark: (note?: string, timestamp?: number) => Promise<'added' | 'removed' | null>;
  reprocessAI: () => Promise<void>;
}

export function useGlimpseMessage(messageId: string): UseGlimpseMessageReturn {
  const [message, setMessage] = useState<GlimpseMessage | null>(null);
  const [replies, setReplies] = useState<GlimpseMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [msg, threadReplies] = await Promise.all([
        glimpseService.getMessage(messageId),
        glimpseService.getThreadReplies(messageId)
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
    const success = await glimpseService.toggleReaction(messageId, emoji, timestamp);
    if (success) {
      await refresh();
    }
    return success;
  }, [messageId, refresh]);

  const toggleBookmark = useCallback(async (note?: string, timestamp?: number) => {
    return await glimpseService.toggleBookmark(messageId, note, timestamp);
  }, [messageId]);

  const reprocessAI = useCallback(async () => {
    await glimpseService.reprocessWithAI(messageId);
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

export interface UseGlimpseSearchReturn {
  results: GlimpseSearchResult[];
  isSearching: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
  clearResults: () => void;
}

export function useGlimpseSearch(): UseGlimpseSearchReturn {
  const [results, setResults] = useState<GlimpseSearchResult[]>([]);
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
      const searchResults = await glimpseService.searchVideos(query);
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

export interface UseGlimpseBookmarksReturn {
  bookmarks: GlimpseBookmark[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggleBookmark: (messageId: string, note?: string, timestamp?: number) => Promise<'added' | 'removed' | null>;
}

export function useGlimpseBookmarks(): UseGlimpseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<GlimpseBookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const marks = await glimpseService.getMyBookmarks();
      setBookmarks(marks);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleBookmark = useCallback(async (messageId: string, note?: string, timestamp?: number) => {
    const result = await glimpseService.toggleBookmark(messageId, note, timestamp);
    if (result) {
      await refresh();
    }
    return result;
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

export interface UseGlimpseSendReturn {
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
      replyToTimestamp?: number;
      quotedText?: string;
      mentions?: string[];
      expiresAt?: Date;
    }
  ) => Promise<GlimpseMessage | null>;
  reset: () => void;
}

export function useGlimpseSend(): UseGlimpseSendReturn {
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
      replyToTimestamp?: number;
      quotedText?: string;
      mentions?: string[];
      expiresAt?: Date;
    }
  ) => {
    try {
      setIsSending(true);
      setError(null);
      setProgress(0);

      // Real progress tracking via XHR onprogress in the service layer.
      // The service's uploadAndSendGlimpse accepts an onProgress callback that
      // reports actual byte-level upload progress (video upload: 5-85%,
      // thumbnail: 85-90%, DB insert/finalize: 90-100%).
      const message = await glimpseService.uploadAndSendGlimpse(
        recipientIds,
        videoBlob,
        thumbnailBlob,
        duration,
        options,
        (percent) => {
          setProgress(percent);
        }
      );

      // The service returns null on failure (it logs internally and does not
      // throw), so a bare `return message` would leave the UI with no error and
      // a stuck progress bar. Surface it explicitly.
      if (!message) {
        setError("Couldn't send your Glimpse. Check your connection and try again.");
        return null;
      }

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
