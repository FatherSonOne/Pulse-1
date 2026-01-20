/**
 * Messages Component - Refactored Example
 *
 * This file demonstrates how to refactor the monolithic Messages.tsx
 * using the new context providers and custom hooks.
 *
 * Integration Steps:
 * 1. Replace direct useState with context hooks
 * 2. Extract large component sections into separate files
 * 3. Add performance optimizations (memo, useMemo, useCallback)
 * 4. Maintain all existing functionality
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Contact } from '../../types';

// Context imports
import { useMessages, useTools, useFocusMode } from '../../contexts';
import { useMessagesState } from '../../hooks/useMessagesState';

// Component imports
import { MessageContainer } from './MessageContainer';
// Future imports (to be created):
// import { MessageListView } from './MessageListView';
// import { ConversationView } from './ConversationView';
// import { MessageComposer } from './MessageComposer';

// Service imports
import { dataService } from '../../services/dataService';
import { pulseService } from '../../services/pulseService';

// Enhancement imports (keep as-is)
import {
  MessageMoodBadge,
  RichMessageCardComponent,
  AnimatedReactions,
  LiveCollaborators,
  StandaloneThemePicker,
  COLOR_PAIR_THEMES,
  ColorPairTheme,
  ConversationHealthWidget,
  AchievementToast,
  AchievementProgress,
  MessageAnalyticsDashboard,
  NetworkGraph,
  SmartCompose,
  QuickActions,
  ThreadActionsMenu,
  ThreadBadges,
  MessageImpactVisualization,
  TranslationWidget,
  TypingIndicator
} from '../MessageEnhancements';

// Bundle imports (keep as-is)
import BundleAI from '../MessageEnhancements/BundleAI';
import BundleAnalytics from '../MessageEnhancements/BundleAnalytics';
import BundleCollaboration from '../MessageEnhancements/BundleCollaboration';
import BundleProductivity from '../MessageEnhancements/BundleProductivity';
import BundleIntelligence from '../MessageEnhancements/BundleIntelligence';
import BundleProactive from '../MessageEnhancements/BundleProactive';
import BundleCommunication from '../MessageEnhancements/BundleCommunication';
import BundleAutomation from '../MessageEnhancements/BundleAutomation';
import BundleSecurity from '../MessageEnhancements/BundleSecurity';
import BundleMultimedia from '../MessageEnhancements/BundleMultimedia';

interface MessagesProps {
  apiKey: string;
  contacts: Contact[];
  initialContactId?: string;
  onAddContact?: (contact: Omit<Contact, 'id'>) => Promise<Contact | null>;
  currentUser?: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Refactored Messages Component
 *
 * Key improvements:
 * - Uses context providers for state management
 * - Reduces component size through extraction
 * - Improves performance with optimizations
 * - Maintains all existing functionality
 */
const MessagesRefactored: React.FC<MessagesProps> = ({
  apiKey,
  contacts,
  initialContactId,
  onAddContact,
  currentUser
}) => {
  // ==================== CONTEXT HOOKS ====================

  // Messages context - replaces thread and conversation state
  const {
    threads,
    activeThreadId,
    setActiveThreadId,
    pulseConversations,
    activePulseConversation,
    setActivePulseConversation,
    pulseMessages,
    pulseMessageReactions,
    starredPulseMessages,
    replyingToPulseMessage,
    setReplyingToPulseMessage,
    searchQuery,
    setSearchQuery,
    isSearchOpen,
    setIsSearchOpen,
    pulseUserSearch,
    setPulseUserSearch,
    pulseSearchResults,
    isSearchingPulseUsers,
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
    typingUsers,
    mobileView,
    setMobileView,
    isLoading,
    loadPulseMessages,
    sendPulseMessage,
    addReactionToPulseMessage,
    toggleStarPulseMessage,
  } = useMessages();

  // Tools context - replaces tool panel state
  const {
    activeToolOverlay,
    showAnalyticsPanel,
    analyticsView,
    setAnalyticsView,
    showCollaborationPanel,
    collaborationTab,
    setCollaborationTab,
    showProductivityPanel,
    productivityTab,
    setProductivityTab,
    showIntelligencePanel,
    intelligenceTab,
    setIntelligenceTab,
    showProactivePanel,
    proactiveTab,
    setProactiveTab,
    showCommunicationPanel,
    communicationTab,
    setCommunicationTab,
    showPersonalizationPanel,
    personalizationTab,
    setPersonalizationTab,
    showSecurityPanel,
    securityTab,
    setSecurityTab,
    showMediaHubPanel,
    mediaHubTab,
    setMediaHubTab,
    showStatsPanel,
    showCommandPalette,
    setShowCommandPalette,
    showAICoach,
    showAIMediator,
    showVoiceExtractor,
    showQuickPhrases,
    showMeetingDeflector,
    showTaskExtractor,
    showChannelArtifactPanel,
    useIntentComposer,
    showContextPanel,
    setShowContextPanel,
    closeAllPanels,
    togglePanel,
    openPanel,
  } = useTools();

  // Focus mode context - replaces focus mode state
  const {
    isActive: isFocusModeActive,
    threadId: focusThreadId,
    remainingTime: focusRemainingTime,
    progress: focusProgress,
    startFocusMode,
    stopFocusMode,
    pauseFocusMode,
    resumeFocusMode,
  } = useFocusMode();

  // Additional messages state - replaces remaining state variables
  const {
    pinnedMessages,
    highlights,
    annotations,
    userTemplates,
    userScheduledMessages,
    userReminders,
    userBookmarks,
    conversationTagAssignments,
    showTemplates,
    setShowTemplates,
    showEmojiPicker,
    setShowEmojiPicker,
    emojiPickerMessageId,
    setEmojiPickerMessageId,
    showAttachmentMenu,
    setShowAttachmentMenu,
    showScheduleModal,
    setShowScheduleModal,
    showShortcuts,
    setShowShortcuts,
    showDeleteConfirm,
    setShowDeleteConfirm,
    threadToDelete,
    setThreadToDelete,
    showExportMenu,
    setShowExportMenu,
    showForwardModal,
    setShowForwardModal,
    editingMessageId,
    setEditingMessageId,
    editText,
    setEditText,
    forwardingMessage,
    setForwardingMessage,
    replyingTo,
    setReplyingTo,
    threadFilter,
    setThreadFilter,
    showArchived,
    setShowArchived,
    archivedThreads,
    mutedThreads,
    showReadReceipts,
    setShowReadReceipts,
    searchFilter,
    setSearchFilter,
    showSearchFilters,
    setShowSearchFilters,
    showFilterDropdown,
    setShowFilterDropdown,
    scheduleDate,
    setScheduleDate,
    scheduleTime,
    setScheduleTime,
    isRecording,
    setIsRecording,
    recordingDuration,
    setRecordingDuration,
    mediaRecorderRef,
    recordingIntervalRef,
    audioChunksRef,
    isPlayingId,
    setIsPlayingId,
    audioContextRef,
    addPinnedMessage,
    addHighlight,
    addAnnotation,
    addBookmark,
    addTemplate,
    addScheduledMessage,
    addReminder,
    toggleArchiveThread,
    toggleMuteThread,
  } = useMessagesState();

  // ==================== LOCAL STATE ====================
  // Keep only component-specific state that doesn't belong in contexts

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCellularSMS, setShowCellularSMS] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [selectedColorPair, setSelectedColorPair] = useState<ColorPairTheme>(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('pulse-color-pair');
      if (savedId) {
        const found = COLOR_PAIR_THEMES.find(p => p.id === savedId);
        if (found) return found;
      }
    }
    return COLOR_PAIR_THEMES[0];
  });

  // ==================== COMPUTED VALUES ====================
  // Use useMemo for expensive computed values

  const activeThread = useMemo(() => {
    return threads.find(t => t.id === activeThreadId);
  }, [threads, activeThreadId]);

  const activePulseConv = useMemo(() => {
    return pulseConversations.find(c => c.id === activePulseConversation);
  }, [pulseConversations, activePulseConversation]);

  const filteredThreads = useMemo(() => {
    return threads.filter(thread => {
      if (threadFilter === 'all') return true;
      if (threadFilter === 'unread') return thread.unread_count && thread.unread_count > 0;
      if (threadFilter === 'pinned') return thread.is_pinned;
      // Add more filters as needed
      return true;
    });
  }, [threads, threadFilter]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return pulseConversations;

    const query = searchQuery.toLowerCase();
    return pulseConversations.filter(conv => {
      const userName = conv.other_user?.name?.toLowerCase() || '';
      const handle = conv.other_user?.handle?.toLowerCase() || '';
      return userName.includes(query) || handle.includes(query);
    });
  }, [pulseConversations, searchQuery]);

  // ==================== EVENT HANDLERS ====================
  // Use useCallback for event handlers to prevent recreation

  const handleSendMessage = useCallback(async (content: string, replyTo?: string) => {
    if (!activePulseConversation) return;

    try {
      await sendPulseMessage(activePulseConversation, content, replyTo);
      setReplyingToPulseMessage(null);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Show error toast
    }
  }, [activePulseConversation, sendPulseMessage, setReplyingToPulseMessage]);

  const handleThreadSelect = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
    setMobileView('chat');
  }, [setActiveThreadId, setMobileView]);

  const handleConversationSelect = useCallback(async (conversationId: string) => {
    setActivePulseConversation(conversationId);
    setMobileView('chat');
    await loadPulseMessages(conversationId);
  }, [setActivePulseConversation, setMobileView, loadPulseMessages]);

  const handleReaction = useCallback((messageId: string, emoji: string) => {
    addReactionToPulseMessage(messageId, emoji);
  }, [addReactionToPulseMessage]);

  const handleStar = useCallback((messageId: string) => {
    toggleStarPulseMessage(messageId);
  }, [toggleStarPulseMessage]);

  const handleStartFocusMode = useCallback(() => {
    if (activeThreadId || activePulseConversation) {
      const threadId = activePulseConversation || activeThreadId;
      startFocusMode(threadId, 25 * 60); // 25 minutes
    }
  }, [activeThreadId, activePulseConversation, startFocusMode]);

  // ==================== EFFECTS ====================

  // Load initial conversation if provided
  useEffect(() => {
    if (initialContactId) {
      const thread = threads.find(t => t.contactId === initialContactId);
      if (thread) {
        setActiveThreadId(thread.id);
      }
    }
  }, [initialContactId, threads, setActiveThreadId]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K - Open command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }

      // Escape - Close all panels
      if (e.key === 'Escape') {
        closeAllPanels();
        setShowNewChatModal(false);
        setShowCommandPalette(false);
      }

      // Ctrl/Cmd + F - Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeAllPanels, setShowCommandPalette, setIsSearchOpen]);

  // ==================== RENDER ====================

  return (
    <MessageContainer>
      {/*
        FUTURE: Extract these sections into separate components

        1. MessageListView - Thread/conversation list
        2. ConversationView - Active conversation display
        3. MessageComposer - Message input area
        4. ToolPanels - All tool overlays
        5. Modals - All modals (new chat, invite, etc.)
      */}

      {/* Placeholder for extracted components */}
      <div className="flex-1 flex flex-col">
        <div className="p-4">
          <h2 className="text-xl font-bold dark:text-white">
            Messages - Refactored Structure
          </h2>
          <p className="text-sm text-zinc-500 mt-2">
            This is an example showing how to integrate the new context providers.
            The full Messages.tsx component should be progressively refactored using this pattern.
          </p>
        </div>

        {/* Example: Using context values */}
        <div className="p-4 space-y-4">
          <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
            <h3 className="font-semibold dark:text-white mb-2">Context Integration</h3>
            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
              <li>Threads loaded: {threads.length}</li>
              <li>Pulse conversations: {pulseConversations.length}</li>
              <li>Active thread: {activeThreadId || 'None'}</li>
              <li>Active conversation: {activePulseConversation || 'None'}</li>
              <li>Focus mode: {isFocusModeActive ? 'Active' : 'Inactive'}</li>
              <li>Active tool: {activeToolOverlay || 'None'}</li>
            </ul>
          </div>

          {/* Example: Using memoized values */}
          <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
            <h3 className="font-semibold dark:text-white mb-2">Computed Values</h3>
            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
              <li>Filtered threads: {filteredThreads.length}</li>
              <li>Filtered conversations: {filteredConversations.length}</li>
              <li>Pinned messages: {pinnedMessages.length}</li>
              <li>Bookmarks: {userBookmarks.length}</li>
              <li>Templates: {userTemplates.length}</li>
            </ul>
          </div>

          {/* Example: Using callbacks */}
          <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
            <h3 className="font-semibold dark:text-white mb-2">Actions</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={() => setShowNewChatModal(true)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
              >
                New Chat
              </button>
              <button
                onClick={handleStartFocusMode}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                disabled={!activeThreadId && !activePulseConversation}
              >
                Start Focus Mode
              </button>
              <button
                onClick={() => openPanel('analytics')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Open Analytics
              </button>
              <button
                onClick={closeAllPanels}
                className="px-4 py-2 bg-zinc-500 text-white rounded-lg hover:bg-zinc-600"
              >
                Close All Panels
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Keep existing modals and panels as-is during migration */}
      {/* They can be extracted into separate components later */}
    </MessageContainer>
  );
};

export default MessagesRefactored;
