// src/store/emailStore.ts
// Zustand store for Email section — folder, emails, sync, offline state

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { emailSyncService, CachedEmail, EmailThread, EmailFolder, EmailCategory, SyncState } from '../services/emailSyncService';
import { offlineEmailStorage } from '../services/offlineEmailStorage';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

interface EmailState {
  // Folder & emails
  currentFolder: EmailFolder;
  activeCategory: EmailCategory;
  emails: CachedEmail[];
  selectedEmail: CachedEmail | null;
  selectedThread: EmailThread | null;
  folderCounts: Record<EmailFolder, number>;
  categoryCounts: Record<string, number>;
  unreadCount: number;

  // Loading states
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  syncing: boolean;
  searchQuery: string;

  // Sync state
  syncState: SyncState | null;

  // Offline
  isOffline: boolean;
  pendingActionsCount: number;

  // Auth
  authError: boolean;
  reAuthenticating: boolean;

  // View
  viewMode: 'list' | 'thread';
  selectedEmailIndex: number;

  // Actions
  setCurrentFolder: (folder: EmailFolder) => void;
  setActiveCategory: (category: EmailCategory) => void;
  setSelectedEmail: (email: CachedEmail | null) => void;
  setSelectedThread: (thread: EmailThread | null) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: 'list' | 'thread') => void;
  setAuthError: (error: boolean) => void;
  setReAuthenticating: (reAuth: boolean) => void;
  setIsOffline: (offline: boolean) => void;
  setPendingActionsCount: (count: number) => void;
  setSyncing: (syncing: boolean) => void;
  setSyncState: (state: SyncState | null) => void;

  // Complex actions
  loadEmails: () => Promise<void>;
  loadMore: () => Promise<void>;
  handleEmailSelect: (email: CachedEmail) => Promise<void>;
  handleToggleStar: (email: CachedEmail) => Promise<void>;
  handleArchive: (email: CachedEmail) => Promise<void>;
  handleTrash: (email: CachedEmail) => Promise<void>;
  handleMarkUnread: (email: CachedEmail) => Promise<void>;
  updateEmailInList: (id: string, updates: Partial<CachedEmail>) => void;
  removeEmailFromList: (id: string) => void;
}

export const useEmailStore = create<EmailState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    currentFolder: 'inbox',
    activeCategory: 'primary',
    emails: [],
    selectedEmail: null,
    selectedThread: null,
    folderCounts: { inbox: 0, sent: 0, drafts: 0, starred: 0, important: 0, snoozed: 0, trash: 0, spam: 0, all: 0 },
    categoryCounts: {},
    unreadCount: 0,
    loading: true,
    loadingMore: false,
    hasMore: false,
    syncing: false,
    searchQuery: '',
    syncState: null,
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    pendingActionsCount: 0,
    authError: false,
    reAuthenticating: false,
    viewMode: 'list',
    selectedEmailIndex: -1,

    // Simple setters
    setCurrentFolder: (folder) => set({ currentFolder: folder, selectedEmail: null, selectedThread: null, activeCategory: 'primary' }),
    setActiveCategory: (category) => set({ activeCategory: category, selectedEmail: null }),
    setSelectedEmail: (email) => set({ selectedEmail: email }),
    setSelectedThread: (thread) => set({ selectedThread: thread }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setViewMode: (mode) => set({ viewMode: mode }),
    setAuthError: (error) => set({ authError: error }),
    setReAuthenticating: (reAuth) => set({ reAuthenticating: reAuth }),
    setIsOffline: (offline) => set({ isOffline: offline }),
    setPendingActionsCount: (count) => set({ pendingActionsCount: count }),
    setSyncing: (syncing) => set({ syncing }),
    setSyncState: (state) => set({ syncState: state }),

    // Load emails for current folder
    loadEmails: async () => {
      set({ loading: true });
      try {
        const { currentFolder, activeCategory } = get();
        const folderEmails = await emailSyncService.getEmailsByFolder(
          currentFolder, PAGE_SIZE, 0,
          currentFolder === 'inbox' ? activeCategory : undefined
        );
        const counts = await emailSyncService.getFolderCounts();
        const unread = await emailSyncService.getUnreadCount('inbox');

        let categoryCounts = {};
        if (currentFolder === 'inbox') {
          categoryCounts = await emailSyncService.getCategoryUnreadCounts();
        }

        set({
          emails: folderEmails,
          hasMore: folderEmails.length >= PAGE_SIZE,
          folderCounts: counts,
          unreadCount: unread,
          categoryCounts,
        });
      } catch (error) {
        console.error('Error loading emails:', error);
        toast.error('Failed to load emails');
      } finally {
        set({ loading: false });
      }
    },

    // Pagination
    loadMore: async () => {
      const { loadingMore, hasMore, emails, currentFolder, activeCategory } = get();
      if (loadingMore || !hasMore) return;

      set({ loadingMore: true });
      try {
        const moreEmails = await emailSyncService.getEmailsByFolder(
          currentFolder, PAGE_SIZE, emails.length,
          currentFolder === 'inbox' ? activeCategory : undefined
        );
        set({
          emails: [...emails, ...moreEmails],
          hasMore: moreEmails.length >= PAGE_SIZE,
        });
      } catch (error) {
        console.error('Error loading more emails:', error);
      } finally {
        set({ loadingMore: false });
      }
    },

    // Select email (mark as read)
    handleEmailSelect: async (email) => {
      set({ selectedEmail: email });
      try {
        if (!email.is_read) {
          await emailSyncService.markAsRead(email.id);
          get().updateEmailInList(email.id, { is_read: true });
          set((s) => ({ unreadCount: Math.max(0, s.unreadCount - 1) }));
        }
        if (get().viewMode === 'thread' && email.thread_id) {
          const thread = await emailSyncService.getThread(email.thread_id);
          set({ selectedThread: thread });
        }
      } catch (error) {
        console.error('Error selecting email:', error);
      }
    },

    handleToggleStar: async (email) => {
      try {
        const newStarred = await emailSyncService.toggleStar(email.id);
        get().updateEmailInList(email.id, { is_starred: newStarred });
        const { selectedEmail } = get();
        if (selectedEmail?.id === email.id) {
          set({ selectedEmail: { ...selectedEmail, is_starred: newStarred } });
        }
      } catch (error) {
        console.error('Error toggling star:', error);
      }
    },

    handleArchive: async (email) => {
      try {
        await emailSyncService.archiveEmail(email.id);
        get().removeEmailFromList(email.id);
        set({ selectedEmail: null });
        toast.success('Email archived');
      } catch (error) {
        console.error('Error archiving:', error);
      }
    },

    handleTrash: async (email) => {
      try {
        await emailSyncService.trashEmail(email.id);
        get().removeEmailFromList(email.id);
        set({ selectedEmail: null });
        toast.success('Email moved to trash');
      } catch (error) {
        console.error('Error trashing:', error);
      }
    },

    handleMarkUnread: async (email) => {
      await emailSyncService.markAsUnread(email.id);
      get().updateEmailInList(email.id, { is_read: false });
      set((s) => ({ unreadCount: s.unreadCount + 1 }));
    },

    // Helpers
    updateEmailInList: (id, updates) => {
      set((s) => ({
        emails: s.emails.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      }));
    },

    removeEmailFromList: (id) => {
      set((s) => ({
        emails: s.emails.filter((e) => e.id !== id),
      }));
    },
  }))
);
