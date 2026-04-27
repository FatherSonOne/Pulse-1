/**
 * Custom hook for managing split-view conversation list with keyboard
 * shortcuts and animations. Generalized in Phase 5c to operate on a
 * unified `Conversation[]` (channels + Pulse DMs) — the prior
 * channels-only API is preserved as deprecated aliases below.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Conversation, conversationId } from '../types/conversations';

interface UseSplitViewMessagesOptions {
  conversations: Conversation[];
  initialConversationId?: string | null;
  onConversationChange?: (conversationId: string | null) => void;
  enableKeyboardShortcuts?: boolean;
}

interface UseSplitViewMessagesReturn {
  activeConversationId: string | null;
  searchQuery: string;
  isMobile: boolean;
  showMobileView: 'threads' | 'conversation';
  searchInputRef: React.RefObject<HTMLInputElement>;
  selectConversation: (id: string) => void;
  setSearchQuery: (query: string) => void;
  navigateToNextThread: () => void;
  navigateToPreviousThread: () => void;
  toggleMobileView: () => void;
  jumpToSearch: () => void;
}

export const useSplitViewMessages = ({
  conversations,
  initialConversationId = null,
  onConversationChange,
  enableKeyboardShortcuts = true
}: UseSplitViewMessagesOptions): UseSplitViewMessagesReturn => {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileView, setShowMobileView] = useState<'threads' | 'conversation'>('threads');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Select conversation handler
  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    if (onConversationChange) {
      onConversationChange(id);
    }

    // On mobile, switch to conversation view
    if (isMobile) {
      setShowMobileView('conversation');
    }
  }, [isMobile, onConversationChange]);

  // Navigate to next thread
  const navigateToNextThread = useCallback(() => {
    if (conversations.length === 0) return;

    const currentIndex = conversations.findIndex((c) => conversationId(c) === activeConversationId);
    const nextIndex = (currentIndex + 1) % conversations.length;
    selectConversation(conversationId(conversations[nextIndex]));
  }, [conversations, activeConversationId, selectConversation]);

  // Navigate to previous thread
  const navigateToPreviousThread = useCallback(() => {
    if (conversations.length === 0) return;

    const currentIndex = conversations.findIndex((c) => conversationId(c) === activeConversationId);
    const prevIndex = currentIndex <= 0 ? conversations.length - 1 : currentIndex - 1;
    selectConversation(conversationId(conversations[prevIndex]));
  }, [conversations, activeConversationId, selectConversation]);

  // Toggle mobile view between threads and conversation
  const toggleMobileView = useCallback(() => {
    setShowMobileView((prev) => (prev === 'threads' ? 'conversation' : 'threads'));
  }, []);

  // Jump to search — uses an attached ref so we don't depend on a brittle
  // selector. Consumers must attach `searchInputRef` to their search input.
  const jumpToSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Allow Ctrl+J even in inputs to jump to search
        if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
          e.preventDefault();
          jumpToSearch();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        e.preventDefault();
        navigateToNextThread();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        navigateToPreviousThread();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        jumpToSearch();
      }

      if (e.key === 'Escape' && searchQuery) {
        e.preventDefault();
        setSearchQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    enableKeyboardShortcuts,
    navigateToNextThread,
    navigateToPreviousThread,
    jumpToSearch,
    searchQuery,
  ]);

  // Auto-select first conversation if none selected and any are available
  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversationId(conversations[0]));
    }
  }, [conversations, activeConversationId]);

  return {
    activeConversationId,
    searchQuery,
    isMobile,
    showMobileView,
    searchInputRef,
    selectConversation,
    setSearchQuery,
    navigateToNextThread,
    navigateToPreviousThread,
    toggleMobileView,
    jumpToSearch,
  };
};
