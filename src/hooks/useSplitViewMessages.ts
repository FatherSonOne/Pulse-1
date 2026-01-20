/**
 * Custom hook for managing split-view messages with keyboard shortcuts and animations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageChannel } from '../types/messages';

interface UseSplitViewMessagesOptions {
  channels: MessageChannel[];
  initialChannelId?: string | null;
  onChannelChange?: (channelId: string | null) => void;
  enableKeyboardShortcuts?: boolean;
}

interface UseSplitViewMessagesReturn {
  activeChannelId: string | null;
  searchQuery: string;
  isMobile: boolean;
  showMobileView: 'threads' | 'conversation';
  selectChannel: (channelId: string) => void;
  setSearchQuery: (query: string) => void;
  navigateToNextThread: () => void;
  navigateToPreviousThread: () => void;
  toggleMobileView: () => void;
  jumpToSearch: () => void;
}

export const useSplitViewMessages = ({
  channels,
  initialChannelId = null,
  onChannelChange,
  enableKeyboardShortcuts = true
}: UseSplitViewMessagesOptions): UseSplitViewMessagesReturn => {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(initialChannelId);
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

  // Select channel handler
  const selectChannel = useCallback((channelId: string) => {
    setActiveChannelId(channelId);
    if (onChannelChange) {
      onChannelChange(channelId);
    }

    // On mobile, switch to conversation view
    if (isMobile) {
      setShowMobileView('conversation');
    }
  }, [isMobile, onChannelChange]);

  // Navigate to next thread
  const navigateToNextThread = useCallback(() => {
    if (channels.length === 0) return;

    const currentIndex = channels.findIndex(ch => ch.id === activeChannelId);
    const nextIndex = (currentIndex + 1) % channels.length;
    selectChannel(channels[nextIndex].id);
  }, [channels, activeChannelId, selectChannel]);

  // Navigate to previous thread
  const navigateToPreviousThread = useCallback(() => {
    if (channels.length === 0) return;

    const currentIndex = channels.findIndex(ch => ch.id === activeChannelId);
    const prevIndex = currentIndex <= 0 ? channels.length - 1 : currentIndex - 1;
    selectChannel(channels[prevIndex].id);
  }, [channels, activeChannelId, selectChannel]);

  // Toggle mobile view between threads and conversation
  const toggleMobileView = useCallback(() => {
    setShowMobileView(prev => prev === 'threads' ? 'conversation' : 'threads');
  }, []);

  // Jump to search
  const jumpToSearch = useCallback(() => {
    const searchInput = document.querySelector('input[aria-label="Search threads"]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
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

      // Ctrl/Cmd + ] - Next thread
      if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        e.preventDefault();
        navigateToNextThread();
      }

      // Ctrl/Cmd + [ - Previous thread
      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        navigateToPreviousThread();
      }

      // Ctrl/Cmd + J - Jump to search
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        jumpToSearch();
      }

      // Escape - Clear search
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
    searchQuery
  ]);

  // Auto-select first channel if none selected and channels available
  useEffect(() => {
    if (!activeChannelId && channels.length > 0) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  return {
    activeChannelId,
    searchQuery,
    isMobile,
    showMobileView,
    selectChannel,
    setSearchQuery,
    navigateToNextThread,
    navigateToPreviousThread,
    toggleMobileView,
    jumpToSearch
  };
};
