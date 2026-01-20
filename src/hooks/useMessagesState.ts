import { useState, useCallback, useRef } from 'react';
import { Message, Contact } from '../types';

// Pinned message interface
export interface PinnedMessage {
  id: string;
  messageId: string;
  text: string;
  sender: string;
  timestamp: string;
  pinnedBy: string;
  pinnedAt: string;
  category: 'important' | 'action' | 'reference' | 'decision' | 'custom';
  note?: string;
}

// Highlight interface
export interface MessageHighlight {
  id: string;
  messageId: string;
  startIndex: number;
  endIndex: number;
  text: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
  label?: string;
  createdBy: string;
  createdAt: string;
}

// Annotation interface
export interface MessageAnnotation {
  id: string;
  messageId: string;
  type: 'comment' | 'question' | 'suggestion' | 'flag' | 'approval';
  content: string;
  author: { id: string; name: string; avatar?: string };
  createdAt: string;
  resolved: boolean;
  replies: Array<{
    id: string;
    content: string;
    author: { id: string; name: string };
    createdAt: string;
    mentions: string[];
  }>;
  mentions: string[];
  reactions: Array<{ emoji: string; users: string[] }>;
}

// Bookmark interface
export interface MessageBookmark {
  id: string;
  messageId: string;
  conversationId: string;
  messagePreview: string;
  sender: string;
  timestamp: Date;
  createdAt: Date;
  note?: string;
  collection?: string;
  tags: string[];
}

// User template interface
export interface UserTemplate {
  id: string;
  name: string;
  category: 'greeting' | 'follow-up' | 'meeting' | 'feedback' | 'closing' | 'custom';
  content: string;
  variables: string[];
  usageCount: number;
  lastUsed?: string;
  createdBy: string;
  tags: string[];
}

// Scheduled message interface
export interface ScheduledMessage {
  id: string;
  content: string;
  threadId: string;
  threadName: string;
  scheduledFor: string;
  createdAt: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
}

// User reminder interface
export interface UserReminder {
  id: string;
  threadId: string;
  threadName: string;
  title: string;
  description?: string;
  remindAt: string;
  type: 'follow-up' | 'deadline' | 'check-in' | 'custom';
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
}

// Conversation tag assignment interface
export interface ConversationTagAssignment {
  conversationId: string;
  tagIds: string[];
  labelId?: string;
}

/**
 * Custom hook to manage additional Messages state
 * This hook encapsulates state that doesn't belong in contexts but is still needed
 * throughout the Messages component and its children.
 */
export const useMessagesState = () => {
  // Collaboration features
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [highlights, setHighlights] = useState<MessageHighlight[]>([]);
  const [annotations, setAnnotations] = useState<MessageAnnotation[]>([]);

  // Productivity features
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [userScheduledMessages, setUserScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [userReminders, setUserReminders] = useState<UserReminder[]>([]);

  // Organization features
  const [userBookmarks, setUserBookmarks] = useState<MessageBookmark[]>([]);
  const [conversationTagAssignments, setConversationTagAssignments] = useState<ConversationTagAssignment[]>([]);

  // UI state
  const [showTemplates, setShowTemplates] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<string | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);

  // Message editing
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Message forwarding
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Thread organization
  const [threadFilter, setThreadFilter] = useState<'all' | 'unread' | 'pinned' | 'with-tasks' | 'with-decisions'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [archivedThreads, setArchivedThreads] = useState<string[]>([]);
  const [mutedThreads, setMutedThreads] = useState<string[]>([]);

  // Read receipts
  const [showReadReceipts, setShowReadReceipts] = useState(true);

  // Search filters
  const [searchFilter, setSearchFilter] = useState<'all' | 'messages' | 'files' | 'decisions' | 'tasks'>('all');
  const [showSearchFilters, setShowSearchFilters] = useState(false);

  // Filter dropdown
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Schedule state
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Audio playback
  const [isPlayingId, setIsPlayingId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Actions for collaboration
  const addPinnedMessage = useCallback((message: PinnedMessage) => {
    setPinnedMessages(prev => [...prev, message]);
  }, []);

  const removePinnedMessage = useCallback((id: string) => {
    setPinnedMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  const addHighlight = useCallback((highlight: MessageHighlight) => {
    setHighlights(prev => [...prev, highlight]);
  }, []);

  const removeHighlight = useCallback((id: string) => {
    setHighlights(prev => prev.filter(h => h.id !== id));
  }, []);

  const addAnnotation = useCallback((annotation: MessageAnnotation) => {
    setAnnotations(prev => [...prev, annotation]);
  }, []);

  const updateAnnotation = useCallback((id: string, updates: Partial<MessageAnnotation>) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  }, []);

  // Actions for bookmarks
  const addBookmark = useCallback((bookmark: MessageBookmark) => {
    setUserBookmarks(prev => [...prev, bookmark]);
  }, []);

  const removeBookmark = useCallback((id: string) => {
    setUserBookmarks(prev => prev.filter(b => b.id !== id));
  }, []);

  // Actions for templates
  const addTemplate = useCallback((template: UserTemplate) => {
    setUserTemplates(prev => [...prev, template]);
  }, []);

  const updateTemplate = useCallback((id: string, updates: Partial<UserTemplate>) => {
    setUserTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const removeTemplate = useCallback((id: string) => {
    setUserTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  // Actions for scheduled messages
  const addScheduledMessage = useCallback((message: ScheduledMessage) => {
    setUserScheduledMessages(prev => [...prev, message]);
  }, []);

  const updateScheduledMessage = useCallback((id: string, updates: Partial<ScheduledMessage>) => {
    setUserScheduledMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, []);

  const removeScheduledMessage = useCallback((id: string) => {
    setUserScheduledMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  // Actions for reminders
  const addReminder = useCallback((reminder: UserReminder) => {
    setUserReminders(prev => [...prev, reminder]);
  }, []);

  const updateReminder = useCallback((id: string, updates: Partial<UserReminder>) => {
    setUserReminders(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const removeReminder = useCallback((id: string) => {
    setUserReminders(prev => prev.filter(r => r.id !== id));
  }, []);

  // Actions for thread management
  const toggleArchiveThread = useCallback((threadId: string) => {
    setArchivedThreads(prev =>
      prev.includes(threadId)
        ? prev.filter(id => id !== threadId)
        : [...prev, threadId]
    );
  }, []);

  const toggleMuteThread = useCallback((threadId: string) => {
    setMutedThreads(prev =>
      prev.includes(threadId)
        ? prev.filter(id => id !== threadId)
        : [...prev, threadId]
    );
  }, []);

  return {
    // Collaboration state
    pinnedMessages,
    setPinnedMessages,
    highlights,
    setHighlights,
    annotations,
    setAnnotations,

    // Productivity state
    userTemplates,
    setUserTemplates,
    userScheduledMessages,
    setUserScheduledMessages,
    userReminders,
    setUserReminders,

    // Organization state
    userBookmarks,
    setUserBookmarks,
    conversationTagAssignments,
    setConversationTagAssignments,

    // UI state
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

    // Message editing
    editingMessageId,
    setEditingMessageId,
    editText,
    setEditText,

    // Message forwarding
    forwardingMessage,
    setForwardingMessage,

    // Reply state
    replyingTo,
    setReplyingTo,

    // Thread organization
    threadFilter,
    setThreadFilter,
    showArchived,
    setShowArchived,
    archivedThreads,
    setArchivedThreads,
    mutedThreads,
    setMutedThreads,

    // Read receipts
    showReadReceipts,
    setShowReadReceipts,

    // Search filters
    searchFilter,
    setSearchFilter,
    showSearchFilters,
    setShowSearchFilters,

    // Filter dropdown
    showFilterDropdown,
    setShowFilterDropdown,

    // Schedule state
    scheduleDate,
    setScheduleDate,
    scheduleTime,
    setScheduleTime,

    // Voice recording
    isRecording,
    setIsRecording,
    recordingDuration,
    setRecordingDuration,
    mediaRecorderRef,
    recordingIntervalRef,
    audioChunksRef,

    // Audio playback
    isPlayingId,
    setIsPlayingId,
    audioContextRef,

    // Collaboration actions
    addPinnedMessage,
    removePinnedMessage,
    addHighlight,
    removeHighlight,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,

    // Bookmark actions
    addBookmark,
    removeBookmark,

    // Template actions
    addTemplate,
    updateTemplate,
    removeTemplate,

    // Scheduled message actions
    addScheduledMessage,
    updateScheduledMessage,
    removeScheduledMessage,

    // Reminder actions
    addReminder,
    updateReminder,
    removeReminder,

    // Thread management actions
    toggleArchiveThread,
    toggleMuteThread,
  };
};
