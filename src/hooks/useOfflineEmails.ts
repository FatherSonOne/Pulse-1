// useOfflineEmails.ts - Hook for offline-first email access
import { useState, useEffect, useCallback } from 'react';
import { CachedEmail, EmailFolder, emailSyncService } from '../services/emailSyncService';
import { offlineEmailStorage } from '../services/offlineEmailStorage';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

interface UseOfflineEmailsReturn {
  emails: CachedEmail[];
  loading: boolean;
  isOffline: boolean;
  hasPendingSync: boolean;
  pendingActionsCount: number;
  lastSyncTime: Date | null;
  fetchEmails: (folder: EmailFolder, forceOnline?: boolean) => Promise<void>;
  syncPendingActions: () => Promise<void>;
  refreshFromServer: () => Promise<void>;
  markAsRead: (emailId: string, gmailId: string) => Promise<void>;
  markAsUnread: (emailId: string, gmailId: string) => Promise<void>;
  toggleStar: (emailId: string, gmailId: string, currentStarred: boolean) => Promise<void>;
  archiveEmail: (emailId: string, gmailId: string) => Promise<void>;
  trashEmail: (emailId: string, gmailId: string) => Promise<void>;
  searchEmails: (query: string) => Promise<CachedEmail[]>;
}

export function useOfflineEmails(): UseOfflineEmailsReturn {
  const [emails, setEmails] = useState<CachedEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingActionsCount, setPendingActionsCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [currentFolder, setCurrentFolder] = useState<EmailFolder>('inbox');
  const [userId, setUserId] = useState<string | null>(null);

  // Initialize and listen for connectivity changes
  useEffect(() => {
    const unsubscribe = offlineEmailStorage.onConnectivityChange((online) => {
      setIsOffline(!online);

      if (online) {
        // When back online, show toast and offer to sync
        toast.success('Back online! Syncing changes...');
        syncPendingActions();
      } else {
        toast('You\'re offline. Changes will sync when connected.', {
          icon: '📡',
          duration: 3000
        });
      }
    });

    // Get initial pending actions count
    loadPendingActionsCount();

    // Get last sync time
    loadLastSyncTime();

    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      }
    });

    return unsubscribe;
  }, []);

  // Load pending actions count
  const loadPendingActionsCount = async () => {
    const actions = await offlineEmailStorage.getPendingActions();
    setPendingActionsCount(actions.length);
  };

  // Load last sync time
  const loadLastSyncTime = async () => {
    const time = await offlineEmailStorage.getLastSyncTime();
    setLastSyncTime(time);
  };

  /**
   * Fetch emails - offline first with online fallback
   */
  const fetchEmails = useCallback(async (folder: EmailFolder, forceOnline = false) => {
    if (!userId) return;

    setLoading(true);
    setCurrentFolder(folder);

    try {
      // Try to get from IndexedDB first (fast)
      const cachedEmails = await offlineEmailStorage.getEmailsByFolder(folder, userId);

      if (cachedEmails.length > 0) {
        setEmails(cachedEmails);
      }

      // If online, also fetch from server and update cache
      if (navigator.onLine && (forceOnline || cachedEmails.length === 0)) {
        const serverEmails = await emailSyncService.getEmailsByFolder(folder);

        if (serverEmails.length > 0) {
          // Update local cache
          await offlineEmailStorage.storeEmails(serverEmails);
          await offlineEmailStorage.setLastSyncTime(new Date());
          setLastSyncTime(new Date());

          // Update state with server data
          setEmails(serverEmails);
        }
      } else if (!navigator.onLine && cachedEmails.length === 0) {
        // Offline with no cache
        toast('No cached emails available offline.', { icon: '📡' });
      }
    } catch (error) {
      console.error('Error fetching emails:', error);

      // If online fetch failed, try cache
      if (!isOffline) {
        const cachedEmails = await offlineEmailStorage.getEmailsByFolder(folder, userId);
        if (cachedEmails.length > 0) {
          setEmails(cachedEmails);
          toast('Using cached emails due to connection error.', { icon: '📡' });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [userId, isOffline]);

  /**
   * Refresh emails from server
   */
  const refreshFromServer = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('Cannot refresh while offline');
      return;
    }

    await fetchEmails(currentFolder, true);
  }, [fetchEmails, currentFolder]);

  /**
   * Sync pending actions when back online
   */
  const syncPendingActions = useCallback(async () => {
    if (!navigator.onLine) return;

    const actions = await offlineEmailStorage.getPendingActions();
    if (actions.length === 0) return;

    let syncedCount = 0;
    let errorCount = 0;

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'markRead':
            await emailSyncService.markAsRead(action.emailId);
            break;
          case 'markUnread':
            await emailSyncService.markAsUnread(action.emailId);
            break;
          case 'star':
          case 'unstar':
            await emailSyncService.toggleStar(action.emailId);
            break;
          case 'archive':
            await emailSyncService.archiveEmail(action.emailId);
            break;
          case 'trash':
            await emailSyncService.trashEmail(action.emailId);
            break;
          case 'delete':
            await emailSyncService.deleteEmail(action.emailId);
            break;
        }

        await offlineEmailStorage.removePendingAction(action.id);
        syncedCount++;
      } catch (error) {
        console.error('Error syncing action:', error);
        errorCount++;
      }
    }

    setPendingActionsCount(errorCount);

    if (syncedCount > 0) {
      toast.success(`Synced ${syncedCount} offline change${syncedCount > 1 ? 's' : ''}`);
    }

    if (errorCount > 0) {
      toast.error(`Failed to sync ${errorCount} change${errorCount > 1 ? 's' : ''}`);
    }
  }, []);

  /**
   * Mark email as read (offline-capable)
   */
  const markAsRead = useCallback(async (emailId: string, gmailId: string) => {
    // Update local cache immediately
    await offlineEmailStorage.updateEmail(emailId, { is_read: true });

    // Update UI
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, is_read: true } : e));

    if (navigator.onLine) {
      // Sync with server
      try {
        await emailSyncService.markAsRead(emailId);
      } catch (error) {
        console.error('Error syncing markAsRead:', error);
        // Queue for later sync
        await offlineEmailStorage.queueAction({
          type: 'markRead',
          emailId,
          gmailId
        });
        setPendingActionsCount(prev => prev + 1);
      }
    } else {
      // Queue for later sync
      await offlineEmailStorage.queueAction({
        type: 'markRead',
        emailId,
        gmailId
      });
      setPendingActionsCount(prev => prev + 1);
    }
  }, []);

  /**
   * Mark email as unread (offline-capable)
   */
  const markAsUnread = useCallback(async (emailId: string, gmailId: string) => {
    await offlineEmailStorage.updateEmail(emailId, { is_read: false });
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, is_read: false } : e));

    if (navigator.onLine) {
      try {
        await emailSyncService.markAsUnread(emailId);
      } catch (error) {
        await offlineEmailStorage.queueAction({ type: 'markUnread', emailId, gmailId });
        setPendingActionsCount(prev => prev + 1);
      }
    } else {
      await offlineEmailStorage.queueAction({ type: 'markUnread', emailId, gmailId });
      setPendingActionsCount(prev => prev + 1);
    }
  }, []);

  /**
   * Toggle star (offline-capable)
   */
  const toggleStar = useCallback(async (emailId: string, gmailId: string, currentStarred: boolean) => {
    const newStarred = !currentStarred;
    await offlineEmailStorage.updateEmail(emailId, { is_starred: newStarred });
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, is_starred: newStarred } : e));

    if (navigator.onLine) {
      try {
        await emailSyncService.toggleStar(emailId);
      } catch (error) {
        await offlineEmailStorage.queueAction({
          type: newStarred ? 'star' : 'unstar',
          emailId,
          gmailId
        });
        setPendingActionsCount(prev => prev + 1);
      }
    } else {
      await offlineEmailStorage.queueAction({
        type: newStarred ? 'star' : 'unstar',
        emailId,
        gmailId
      });
      setPendingActionsCount(prev => prev + 1);
    }
  }, []);

  /**
   * Archive email (offline-capable)
   */
  const archiveEmail = useCallback(async (emailId: string, gmailId: string) => {
    await offlineEmailStorage.updateEmail(emailId, { is_archived: true });
    setEmails(prev => prev.filter(e => e.id !== emailId));

    if (navigator.onLine) {
      try {
        await emailSyncService.archiveEmail(emailId);
      } catch (error) {
        await offlineEmailStorage.queueAction({ type: 'archive', emailId, gmailId });
        setPendingActionsCount(prev => prev + 1);
      }
    } else {
      await offlineEmailStorage.queueAction({ type: 'archive', emailId, gmailId });
      setPendingActionsCount(prev => prev + 1);
    }

    toast.success('Email archived');
  }, []);

  /**
   * Trash email (offline-capable)
   */
  const trashEmail = useCallback(async (emailId: string, gmailId: string) => {
    await offlineEmailStorage.updateEmail(emailId, { is_trashed: true });
    setEmails(prev => prev.filter(e => e.id !== emailId));

    if (navigator.onLine) {
      try {
        await emailSyncService.trashEmail(emailId);
      } catch (error) {
        await offlineEmailStorage.queueAction({ type: 'trash', emailId, gmailId });
        setPendingActionsCount(prev => prev + 1);
      }
    } else {
      await offlineEmailStorage.queueAction({ type: 'trash', emailId, gmailId });
      setPendingActionsCount(prev => prev + 1);
    }

    toast.success('Email moved to trash');
  }, []);

  /**
   * Search emails (offline-capable)
   */
  const searchEmails = useCallback(async (query: string): Promise<CachedEmail[]> => {
    if (!userId) return [];

    // Search local cache first
    const localResults = await offlineEmailStorage.searchEmails(query, userId);

    if (navigator.onLine) {
      // Also search server for better results
      try {
        const serverResults = await emailSyncService.searchEmails(query);

        // Cache server results
        if (serverResults.length > 0) {
          await offlineEmailStorage.storeEmails(serverResults);
        }

        // Merge and dedupe results
        const allResults = [...localResults, ...serverResults];
        const uniqueResults = Array.from(
          new Map(allResults.map(e => [e.id, e])).values()
        );

        return uniqueResults;
      } catch (error) {
        console.error('Error searching server:', error);
        return localResults;
      }
    }

    return localResults;
  }, [userId]);

  return {
    emails,
    loading,
    isOffline,
    hasPendingSync: pendingActionsCount > 0,
    pendingActionsCount,
    lastSyncTime,
    fetchEmails,
    syncPendingActions,
    refreshFromServer,
    markAsRead,
    markAsUnread,
    toggleStar,
    archiveEmail,
    trashEmail,
    searchEmails
  };
}

export default useOfflineEmails;
