// PulseEmailClient.tsx - AI-Powered Email Client
import React, { useState, useEffect, useCallback } from 'react';
import { emailSyncService, CachedEmail, EmailThread, EmailFolder } from '../../services/emailSyncService';
import { getGmailService, resetGmailService, SendEmailParams } from '../../services/gmailService';
import { offlineEmailStorage } from '../../services/offlineEmailStorage';
import { supabase } from '../../services/supabase';
import analyticsCollector from '../../services/analyticsCollector';
import toast from 'react-hot-toast';
import EmailSidebar from './EmailSidebar';
import EmailList from './EmailList';
import EmailViewerNew from './EmailViewerNew';
import EmailComposerModal from './EmailComposerModal';
import DailyBriefing from './DailyBriefing';
import FollowUpRemindersDropdown from './FollowUpRemindersDropdown';
import EmailSettingsModal from './EmailSettingsModal';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import { OfflineIndicatorCompact } from './OfflineIndicator';
import { useEmailKeyboardShortcuts } from '../../hooks/useEmailKeyboardShortcuts';

interface PulseEmailClientProps {
  userEmail: string;
  userName: string;
}

export const PulseEmailClient: React.FC<PulseEmailClientProps> = ({
  userEmail,
  userName
}) => {
  // State
  const [currentFolder, setCurrentFolder] = useState<EmailFolder>('inbox');
  const [emails, setEmails] = useState<CachedEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<CachedEmail | null>(null);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [folderCounts, setFolderCounts] = useState<Record<EmailFolder, number>>({
    inbox: 0, sent: 0, drafts: 0, starred: 0, important: 0, snoozed: 0, trash: 0, spam: 0, all: 0
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [replyToEmail, setReplyToEmail] = useState<CachedEmail | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'thread'>('list');
  const [authError, setAuthError] = useState(false);
  const [reAuthenticating, setReAuthenticating] = useState(false);
  const [showBriefing, setShowBriefing] = useState(true); // Show daily briefing by default
  const [showFollowUps, setShowFollowUps] = useState(true); // Show follow-up nudges
  const [dismissedFollowUps, setDismissedFollowUps] = useState<Set<string>>(new Set());
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [selectedEmailIndex, setSelectedEmailIndex] = useState<number>(-1);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar state
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingActionsCount, setPendingActionsCount] = useState(0);
  const [showEmailSettings, setShowEmailSettings] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100); // Zoom level percentage (50-100)

  // Zoom controls
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 100));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 50));
  const handleZoomChange = (value: number) => setZoomLevel(Math.max(50, Math.min(100, value)));

  // Load emails for current folder
  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const folderEmails = await emailSyncService.getEmailsByFolder(currentFolder);
      setEmails(folderEmails);

      // Update counts
      const counts = await emailSyncService.getFolderCounts();
      setFolderCounts(counts);

      const unread = await emailSyncService.getUnreadCount('inbox');
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading emails:', error);
      toast.error('Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [currentFolder]);

  // Initial load and sync
  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  // Offline/Online connectivity handling
  useEffect(() => {
    const unsubscribe = offlineEmailStorage.onConnectivityChange((online) => {
      setIsOffline(!online);

      if (online) {
        toast.success('Back online! Syncing changes...');
        // Sync pending actions and refresh emails
        syncPendingActions();
      } else {
        toast('You\'re offline. Changes will sync when connected.', {
          icon: '📡',
          duration: 3000
        });
      }
    });

    // Load initial pending actions count
    offlineEmailStorage.getPendingActions().then(actions => {
      setPendingActionsCount(actions.length);
    });

    return unsubscribe;
  }, []);

  // Sync pending offline actions
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
      // Refresh emails after sync
      await loadEmails();
    }

    if (errorCount > 0) {
      toast.error(`Failed to sync ${errorCount} change${errorCount > 1 ? 's' : ''}`);
    }
  }, [loadEmails]);

  // Re-authenticate with Google
  const handleReAuthenticate = async () => {
    setReAuthenticating(true);
    try {
      // Reset the Gmail service to clear cached token
      resetGmailService();

      // Re-authenticate with Google OAuth - request all Gmail scopes for full functionality
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.modify',
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent', // Force consent to get new refresh token
          }
        }
      });

      if (error) {
        throw error;
      }
      // Will redirect to Google OAuth
    } catch (error) {
      console.error('Re-auth error:', error);
      toast.error('Failed to re-authenticate. Please try signing out and back in.');
      setReAuthenticating(false);
    }
  };

  // Sync emails from Gmail
  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await emailSyncService.fullSync(100);
      toast.success(`Synced ${result.synced} emails`);
      await loadEmails();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sync emails');
    } finally {
      setSyncing(false);
    }
  };

  // Handle folder change
  const handleFolderChange = (folder: EmailFolder) => {
    setCurrentFolder(folder);
    setSelectedEmail(null);
    setSelectedThread(null);
  };

  // Handle email selection
  const handleEmailSelect = async (email: CachedEmail) => {
    setSelectedEmail(email);

    // Mark as read if unread
    if (!email.is_read) {
      await emailSyncService.markAsRead(email.id);
      setEmails(prev => prev.map(e =>
        e.id === email.id ? { ...e, is_read: true } : e
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    // Load full thread if in thread view
    if (viewMode === 'thread' && email.thread_id) {
      const thread = await emailSyncService.getThread(email.thread_id);
      setSelectedThread(thread);
    }
  };

  // Handle star toggle
  const handleToggleStar = async (email: CachedEmail) => {
    const newStarred = await emailSyncService.toggleStar(email.id);
    setEmails(prev => prev.map(e =>
      e.id === email.id ? { ...e, is_starred: newStarred } : e
    ));
    if (selectedEmail?.id === email.id) {
      setSelectedEmail({ ...selectedEmail, is_starred: newStarred });
    }
  };

  // Handle archive
  const handleArchive = async (email: CachedEmail) => {
    await emailSyncService.archiveEmail(email.id);
    setEmails(prev => prev.filter(e => e.id !== email.id));
    setSelectedEmail(null);
    toast.success('Email archived');
  };

  // Handle trash
  const handleTrash = async (email: CachedEmail) => {
    await emailSyncService.trashEmail(email.id);
    setEmails(prev => prev.filter(e => e.id !== email.id));
    setSelectedEmail(null);
    toast.success('Email moved to trash');
  };

  // Handle reply (with optional prefilled body from quick replies)
  const [prefilledBody, setPrefilledBody] = useState<string | undefined>(undefined);

  // For restoring cancelled sends
  const [restoredComposer, setRestoredComposer] = useState<{
    to?: string;
    subject?: string;
    cc?: string;
    bcc?: string;
  } | null>(null);

  const handleReply = (email: CachedEmail, prefilled?: string) => {
    setReplyToEmail(email);
    setPrefilledBody(prefilled);
    setRestoredComposer(null);
    setShowComposer(true);
  };

  // Handle composing a follow-up email
  const handleComposeFollowUp = (to: string, subject: string, originalEmail: CachedEmail) => {
    setReplyToEmail(originalEmail);
    setPrefilledBody(`\n\nJust following up on my previous email. Please let me know if you have any questions.\n\nBest regards`);
    setRestoredComposer({
      to,
      subject,
    });
    setShowComposer(true);
  };

  // Handle dismissing a follow-up reminder
  const handleDismissFollowUp = (emailId: string) => {
    setDismissedFollowUps(prev => new Set([...prev, emailId]));
  };

  // Pending sends for undo functionality
  const [pendingSends, setPendingSends] = useState<Map<string, {
    params: SendEmailParams;
    timeoutId: ReturnType<typeof setTimeout>;
    startTime: number;
  }>>(new Map());

  // Handle send email with undo capability
  const handleSendEmail = async (params: SendEmailParams) => {
    // Generate unique ID for this send
    const sendId = `send_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const UNDO_DELAY = 30000; // 30 seconds

    // Close composer immediately for better UX
    setShowComposer(false);
    setReplyToEmail(null);

    // Create the actual send function
    const executeSend = async () => {
      try {
        const gmail = getGmailService();
        await gmail.sendEmail(params);

        // Remove from pending
        setPendingSends(prev => {
          const next = new Map(prev);
          next.delete(sendId);
          return next;
        });

        // Track email for analytics
        analyticsCollector.trackMessageEvent({
          id: `email-${Date.now()}`,
          channel: 'email',
          contactIdentifier: params.to[0],
          isSent: true,
          timestamp: new Date(),
          content: params.body,
          threadId: params.threadId,
          messageType: 'standard'
        }).catch(err => console.error('Analytics tracking failed:', err));

        // Show final success
        toast.success('Email sent successfully!', { duration: 3000 });

        // Sync emails
        if (currentFolder === 'sent') {
          setSyncing(true);
          try {
            await emailSyncService.fullSync(20);
            await loadEmails();
          } catch (e) {
            console.log('Sync after send:', e);
          } finally {
            setSyncing(false);
          }
        } else {
          setTimeout(async () => {
            try {
              await emailSyncService.fullSync(20);
            } catch (e) {
              console.log('Background sync after send:', e);
            }
          }, 1000);
        }
      } catch (error) {
        console.error('Send error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to send email';

        // Remove from pending
        setPendingSends(prev => {
          const next = new Map(prev);
          next.delete(sendId);
          return next;
        });

        // Check if it's an auth error
        if (errorMessage.includes('session') || errorMessage.includes('sign') || errorMessage.includes('expired')) {
          setAuthError(true);
          resetGmailService();
          toast.error('Google session expired. Click "Reconnect Google" to continue.');
        } else {
          toast.error(errorMessage);
        }
      }
    };

    // Set timeout to send after delay
    const timeoutId = setTimeout(executeSend, UNDO_DELAY);

    // Store pending send
    setPendingSends(prev => {
      const next = new Map(prev);
      next.set(sendId, {
        params,
        timeoutId,
        startTime: Date.now()
      });
      return next;
    });

    // Handle undo
    const handleUndo = () => {
      // Cancel the timeout
      clearTimeout(timeoutId);

      // Remove from pending
      setPendingSends(prev => {
        const next = new Map(prev);
        next.delete(sendId);
        return next;
      });

      // Re-open composer with all the same data
      setReplyToEmail(null);
      setPrefilledBody(params.body);
      setRestoredComposer({
        to: params.to.join(', '),
        subject: params.subject,
        cc: params.cc?.join(', '),
        bcc: params.bcc?.join(', '),
      });
      setShowComposer(true);

      toast.success('Send cancelled - email restored to composer');
    };

    // Show undo toast with countdown
    const recipient = params.to[0];
    toast(
      (t) => (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-white font-medium">
              <i className="fa-solid fa-paper-plane text-blue-400"></i>
              <span>Sending to {recipient}...</span>
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              Email will send in 30 seconds
            </div>
          </div>
          <button
            onClick={() => {
              handleUndo();
              toast.dismiss(t.id);
            }}
            className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition"
          >
            Undo
          </button>
        </div>
      ),
      {
        duration: UNDO_DELAY,
        style: {
          background: '#18181b',
          border: '1px solid #3f3f46',
          padding: '12px 16px',
          minWidth: '320px',
        },
      }
    );
  };

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      await loadEmails();
      return;
    }

    setLoading(true);
    try {
      const results = await emailSyncService.searchEmails(searchQuery);
      setEmails(results);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle mark as unread
  const handleMarkUnread = async (email: CachedEmail) => {
    await emailSyncService.markAsUnread(email.id);
    setEmails(prev => prev.map(e =>
      e.id === email.id ? { ...e, is_read: false } : e
    ));
    setUnreadCount(prev => prev + 1);
  };

  // Keyboard navigation helpers
  const handleNextEmail = useCallback(() => {
    if (emails.length === 0) return;
    const currentIdx = selectedEmail
      ? emails.findIndex(e => e.id === selectedEmail.id)
      : selectedEmailIndex;
    const nextIdx = Math.min(currentIdx + 1, emails.length - 1);
    setSelectedEmailIndex(nextIdx);
    if (selectedEmail) {
      // If viewing an email, open the next one
      handleEmailSelect(emails[nextIdx]);
    }
  }, [emails, selectedEmail, selectedEmailIndex]);

  const handlePrevEmail = useCallback(() => {
    if (emails.length === 0) return;
    const currentIdx = selectedEmail
      ? emails.findIndex(e => e.id === selectedEmail.id)
      : selectedEmailIndex;
    const prevIdx = Math.max(currentIdx - 1, 0);
    setSelectedEmailIndex(prevIdx);
    if (selectedEmail) {
      // If viewing an email, open the previous one
      handleEmailSelect(emails[prevIdx]);
    }
  }, [emails, selectedEmail, selectedEmailIndex]);

  const focusSearch = useCallback(() => {
    const searchInput = document.querySelector('input[placeholder="Search emails..."]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  }, []);

  // Keyboard shortcuts hook
  useEmailKeyboardShortcuts({
    selectedEmail,
    emails,
    isComposerOpen: showComposer,
    onNextEmail: handleNextEmail,
    onPrevEmail: handlePrevEmail,
    onOpenEmail: (email) => handleEmailSelect(email),
    onCloseEmail: () => {
      setSelectedEmail(null);
      setSelectedThread(null);
    },
    onCompose: () => {
      setReplyToEmail(null);
      setShowComposer(true);
    },
    onReply: () => {
      if (selectedEmail) {
        handleReply(selectedEmail);
      }
    },
    onReplyAll: () => {
      if (selectedEmail) {
        handleReply(selectedEmail);
      }
    },
    onForward: () => {
      if (selectedEmail) {
        // Forward uses reply with different subject prefix
        handleReply(selectedEmail);
      }
    },
    onArchive: () => {
      if (selectedEmail) {
        handleArchive(selectedEmail);
      }
    },
    onDelete: () => {
      if (selectedEmail) {
        handleTrash(selectedEmail);
      }
    },
    onToggleStar: () => {
      if (selectedEmail) {
        handleToggleStar(selectedEmail);
      }
    },
    onMarkRead: () => {
      if (selectedEmail && !selectedEmail.is_read) {
        emailSyncService.markAsRead(selectedEmail.id);
        setEmails(prev => prev.map(e =>
          e.id === selectedEmail.id ? { ...e, is_read: true } : e
        ));
      }
    },
    onMarkUnread: () => {
      if (selectedEmail) {
        handleMarkUnread(selectedEmail);
      }
    },
    onSnooze: () => {
      // Snooze is handled in the email viewer
    },
    onSearch: focusSearch,
    onGoToInbox: () => handleFolderChange('inbox'),
    onGoToSent: () => handleFolderChange('sent'),
    onGoToStarred: () => handleFolderChange('starred'),
    onGoToDrafts: () => handleFolderChange('drafts'),
    onRefresh: handleSync,
    onUndo: () => {
      // Undo last action if available
    },
    onHelp: () => setShowKeyboardShortcuts(true),
  });

  return (
    <div className="flex flex-1 h-full bg-stone-100 dark:bg-zinc-950 min-h-0">
      {/* Sidebar */}
      <EmailSidebar
        currentFolder={currentFolder}
        folderCounts={folderCounts}
        unreadCount={unreadCount}
        onFolderChange={handleFolderChange}
        onCompose={() => {
          setReplyToEmail(null);
          setShowComposer(true);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 my-3 mr-3 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        {/* Auth Error Banner */}
        {authError && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-exclamation-triangle text-amber-500"></i>
              <span className="text-amber-800 dark:text-amber-200 text-sm">
                Your Google session has expired. Reconnect to send emails.
              </span>
            </div>
            <button
              onClick={handleReAuthenticate}
              disabled={reAuthenticating}
              className="bg-amber-500 hover:bg-amber-600 text-black font-medium px-4 py-1.5 rounded-lg text-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              {reAuthenticating ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  Connecting...
                </>
              ) : (
                <>
                  <i className="fa-brands fa-google"></i>
                  Reconnect Google
                </>
              )}
            </button>
          </div>
        )}

        {/* Header with search and sync */}
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3 border-b border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden w-10 h-10 rounded-lg bg-stone-100 dark:bg-zinc-800 flex items-center justify-center text-stone-600 dark:text-zinc-400 hover:bg-stone-200 dark:hover:bg-zinc-700 transition"
            aria-label="Open menu"
          >
            <i className="fa-solid fa-bars"></i>
          </button>

          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search emails..."
              className="w-full bg-stone-100 dark:bg-zinc-800/50 border border-stone-200 dark:border-zinc-700/50 rounded-lg px-4 py-2 pl-10 text-sm text-stone-900 dark:text-white placeholder-stone-500 dark:placeholder-zinc-500 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30"
            />
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-zinc-500 text-sm"></i>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  loadEmails();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            )}
          </div>

          {/* Follow-up Reminders Dropdown - only show in inbox */}
          {currentFolder === 'inbox' && (
            <FollowUpRemindersDropdown
              onComposeFollowUp={handleComposeFollowUp}
              onDismiss={handleDismissFollowUp}
            />
          )}

          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-stone-200 dark:bg-zinc-800 hover:bg-stone-300 dark:hover:bg-zinc-700 rounded-lg text-sm text-stone-700 dark:text-white transition disabled:opacity-50"
          >
            <i className={`fa-solid fa-arrows-rotate ${syncing ? 'fa-spin' : ''}`}></i>
            <span className="hidden lg:inline">{syncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Mobile sync icon */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="sm:hidden w-10 h-10 rounded-lg bg-stone-200 dark:bg-zinc-800 flex items-center justify-center text-stone-600 dark:text-zinc-400 disabled:opacity-50"
            aria-label="Sync emails"
          >
            <i className={`fa-solid fa-arrows-rotate ${syncing ? 'fa-spin' : ''}`}></i>
          </button>

          {/* View toggle - hide on very small screens */}
          <div className="hidden sm:flex items-center bg-stone-200 dark:bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded text-sm transition ${viewMode === 'list' ? 'bg-rose-500 text-white' : 'text-stone-500 dark:text-zinc-400 hover:text-stone-700 dark:hover:text-white'}`}
            >
              <i className="fa-solid fa-list"></i>
            </button>
            <button
              onClick={() => setViewMode('thread')}
              className={`px-3 py-1 rounded text-sm transition ${viewMode === 'thread' ? 'bg-rose-500 text-white' : 'text-stone-500 dark:text-zinc-400 hover:text-stone-700 dark:hover:text-white'}`}
            >
              <i className="fa-solid fa-comments"></i>
            </button>
          </div>

          {/* Offline indicator */}
          <OfflineIndicatorCompact
            isOffline={isOffline}
            pendingActionsCount={pendingActionsCount}
          />

          {/* Briefing toggle - only show in inbox */}
          {currentFolder === 'inbox' && (
            <button
              onClick={() => setShowBriefing(!showBriefing)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                showBriefing
                  ? 'bg-gradient-to-r from-rose-500/20 to-orange-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : 'bg-stone-200 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white'
              }`}
              title={showBriefing ? 'Hide briefing' : 'Show briefing'}
            >
              <i className="fa-solid fa-envelope-open-text"></i>
              <span className="hidden sm:inline">Briefing</span>
              <i className={`fa-solid fa-chevron-${showBriefing ? 'up' : 'down'} text-xs`}></i>
            </button>
          )}

          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center gap-1 bg-stone-200 dark:bg-zinc-800 rounded-lg px-2 py-1">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 50}
              className="w-7 h-7 rounded flex items-center justify-center text-stone-600 dark:text-zinc-400 hover:bg-stone-300 dark:hover:bg-zinc-700 hover:text-stone-800 dark:hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <i className="fa-solid fa-minus text-xs"></i>
            </button>
            <input
              type="range"
              min="50"
              max="100"
              value={zoomLevel}
              onChange={(e) => handleZoomChange(parseInt(e.target.value))}
              className="w-16 h-1 bg-stone-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
              title={`Zoom: ${zoomLevel}%`}
              aria-label="Zoom level slider"
            />
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 100}
              className="w-7 h-7 rounded flex items-center justify-center text-stone-600 dark:text-zinc-400 hover:bg-stone-300 dark:hover:bg-zinc-700 hover:text-stone-800 dark:hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <i className="fa-solid fa-plus text-xs"></i>
            </button>
            <span className="text-xs text-stone-500 dark:text-zinc-500 w-8 text-center">{zoomLevel}%</span>
          </div>

          {/* Email Settings Button */}
          <button
            onClick={() => setShowEmailSettings(true)}
            className="w-10 h-10 rounded-lg bg-stone-200 dark:bg-zinc-800 hover:bg-stone-300 dark:hover:bg-zinc-700 flex items-center justify-center text-stone-600 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white transition"
            title="Email Settings"
            aria-label="Open email settings"
          >
            <i className="fa-solid fa-gear"></i>
          </button>
        </div>

        {/* Daily Briefing - show at top of inbox view */}
        {showBriefing && currentFolder === 'inbox' && !selectedEmail && (
          <div className="px-4 py-3 border-b border-stone-200 dark:border-zinc-800">
            <DailyBriefing
              onEmailClick={(email) => {
                setSelectedEmail(email);
                setShowBriefing(false);
              }}
              onViewAll={() => setShowBriefing(false)}
            />
          </div>
        )}


        {/* Email list and viewer - wrapper for zoom */}
        <div className="flex-1 overflow-hidden min-h-0">
          <div
            className="flex h-full origin-top-left transition-transform duration-200"
            style={{
              transform: `scale(${zoomLevel / 100})`,
              width: `${10000 / zoomLevel}%`,
              height: `${10000 / zoomLevel}%`
            }}
          >
          {/* Email list - hidden on mobile when email is selected */}
          <div className={`
            ${selectedEmail ? 'hidden md:flex md:w-2/5 md:border-r md:border-stone-200 dark:md:border-zinc-800' : 'flex w-full'}
            flex-col min-h-0 flex-1
          `}>
            <EmailList
              emails={emails}
              selectedEmail={selectedEmail}
              loading={loading}
              onEmailSelect={handleEmailSelect}
              onToggleStar={handleToggleStar}
              onArchive={handleArchive}
              onTrash={handleTrash}
              currentFolder={currentFolder}
            />
          </div>

          {/* Email viewer - full width on mobile */}
          {selectedEmail && (
            <div className="w-full md:flex-1 overflow-hidden">
              <EmailViewerNew
                email={selectedEmail}
                thread={selectedThread}
                onClose={() => {
                  setSelectedEmail(null);
                  setSelectedThread(null);
                }}
                onReply={handleReply}
                onArchive={() => handleArchive(selectedEmail)}
                onTrash={() => handleTrash(selectedEmail)}
                onToggleStar={() => handleToggleStar(selectedEmail)}
                onMarkUnread={() => handleMarkUnread(selectedEmail)}
              />
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Email Settings Modal */}
      {showEmailSettings && (
        <EmailSettingsModal
          isOpen={showEmailSettings}
          onClose={() => setShowEmailSettings(false)}
          userEmail={userEmail}
        />
      )}

      {/* Composer modal */}
      {showComposer && (
        <EmailComposerModal
          userEmail={userEmail}
          userName={userName}
          replyTo={replyToEmail}
          prefilledBody={prefilledBody}
          initialTo={restoredComposer?.to}
          initialSubject={restoredComposer?.subject}
          initialCc={restoredComposer?.cc}
          initialBcc={restoredComposer?.bcc}
          onClose={() => {
            setShowComposer(false);
            setReplyToEmail(null);
            setPrefilledBody(undefined);
            setRestoredComposer(null);
          }}
          onSend={handleSendEmail}
        />
      )}

      {/* Keyboard shortcuts modal */}
      {showKeyboardShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowKeyboardShortcuts(false)} />
      )}

      {/* Keyboard shortcuts hint - floating button */}
      <button
        onClick={() => setShowKeyboardShortcuts(true)}
        className="fixed bottom-4 right-4 w-10 h-10 rounded-xl bg-stone-200 dark:bg-zinc-800 hover:bg-stone-300 dark:hover:bg-zinc-700 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-stone-700 dark:hover:text-white transition shadow-lg"
        title="Keyboard shortcuts (?)"
      >
        <i className="fa-solid fa-keyboard"></i>
      </button>
    </div>
  );
};

export default PulseEmailClient;
