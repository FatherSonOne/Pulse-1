// PulseEmailClientRedesign.tsx - Redesigned AI-Powered Email Client
// Refactored: State managed by Zustand stores (emailStore, emailComposeStore, emailUIStore)
import React, { useEffect, useCallback, useRef } from 'react';
import { emailSyncService, CachedEmail, SyncState } from '../../services/emailSyncService';
import { getGmailService, resetGmailService, SendEmailParams } from '../../services/gmailService';
import { offlineEmailStorage } from '../../services/offlineEmailStorage';
import { supabase } from '../../services/supabase';
import analyticsCollector from '../../services/analyticsCollector';
import toast from 'react-hot-toast';

// Zustand stores
import { useEmailStore } from '../../store/emailStore';
import { useEmailComposeStore } from '../../store/emailComposeStore';
import { useEmailUIStore } from '../../store/emailUIStore';

// Components
import EmailSidebarRedesign from './EmailSidebarRedesign';
import EmailListRedesign from './EmailListRedesign';
import EmailViewerNew from './EmailViewerNew';
import { EmailCampaignsDashboard } from './Campaigns/EmailCampaignsDashboard';
import { EmailCampaignBuilder } from './Campaigns/EmailCampaignBuilder';
import EmailComposerModal from './EmailComposerModal';
import DailyBriefing from './DailyBriefing';
import FollowUpRemindersDropdown from './FollowUpRemindersDropdown';
import EmailSettingsModal from './EmailSettingsModal';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import { OfflineIndicatorCompact } from './OfflineIndicator';
import { useEmailKeyboardShortcuts } from '../../hooks/useEmailKeyboardShortcuts';
import { ReconnectGoogleModal } from '../Auth/ReconnectGoogleModal';
import { GoogleAuthStatus } from './GoogleAuthStatus';

import { AlertTriangle, ExternalLink, Keyboard, Loader2, MailCheck, MailOpen, Menu, Pen, RefreshCw, Search, Send, Settings, X } from 'lucide-react';

interface PulseEmailClientRedesignProps {
  userEmail: string;
  userName: string;
}

export const PulseEmailClientRedesign: React.FC<PulseEmailClientRedesignProps> = ({
  userEmail,
  userName,
}) => {
  // ── Store selectors ────────────────────────────────────────────────
  const {
    currentFolder, activeCategory, emails, selectedEmail, selectedThread,
    folderCounts, categoryCounts, unreadCount,
    loading, loadingMore, hasMore, syncing, searchQuery, syncState,
    isOffline, pendingActionsCount, authError, reAuthenticating, viewMode,
    setCurrentFolder, setActiveCategory, setSelectedEmail, setSelectedThread,
    setSearchQuery, setAuthError, setReAuthenticating, setIsOffline,
    setPendingActionsCount, setSyncing, setSyncState,
    loadEmails, loadMore,
    handleEmailSelect, handleToggleStar, handleArchive, handleTrash, handleMarkUnread,
  } = useEmailStore();

  const {
    showComposer, replyToEmail, prefilledBody, restoredComposer,
    openCompose, openReply, openReplyAll, openForward, openFollowUp,
    restoreComposer, closeComposer, addPendingSend, removePendingSend,
  } = useEmailComposeStore();

  const {
    zoomLevel, accentColor,
    sidebarOpen, showBriefing, showKeyboardShortcuts, showEmailSettings, showReauthModal, nudgeFocused,
    currentView, editingCampaign, campaignRefreshKey,
    setSidebarOpen, setShowBriefing, setShowKeyboardShortcuts, setShowEmailSettings,
    setShowReauthModal, setNudgeFocused,
    setCurrentView, setEditingCampaign, incrementCampaignRefreshKey,
    dismissFollowUp,
  } = useEmailUIStore();

  const briefingRef = useRef<HTMLDivElement>(null);
  const [syncPulseKey, setSyncPulseKey] = React.useState(0);

  // First-run check: is Gmail provider connected at all?
  // Heuristic: no provider_token AND no cached emails → never-connected first-run.
  const [gmailConnectionState, setGmailConnectionState] = React.useState<'checking' | 'connected' | 'never'>('checking');
  const [connectingGmail, setConnectingGmail] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        const hasProviderToken = Boolean(session?.provider_token);
        const hasCached = (syncState?.total_emails_cached ?? 0) > 0 || emails.length > 0;
        setGmailConnectionState(hasProviderToken || hasCached ? 'connected' : 'never');
      } catch {
        if (!cancelled) setGmailConnectionState('connected'); // fail open: don't block the inbox
      }
    })();
    return () => { cancelled = true; };
  }, [syncState?.total_emails_cached, emails.length]);

  // ── Focus nudge from Daily Overview ────────────────────────────────
  useEffect(() => {
    const flag = sessionStorage.getItem('pulse_focus_nudge');
    if (flag === 'email') {
      sessionStorage.removeItem('pulse_focus_nudge');
      setShowBriefing(true);
      setCurrentFolder('inbox');
      setSelectedEmail(null);
      setTimeout(() => {
        briefingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setNudgeFocused(true);
        setTimeout(() => setNudgeFocused(false), 2000);
      }, 150);
    }
  }, []);

  // ── Initial load and auto-sync ─────────────────────────────────────
  useEffect(() => {
    loadEmails();
  }, [currentFolder, activeCategory]);

  useEffect(() => {
    const initSync = async () => {
      const fetchedSyncState = await emailSyncService.getSyncState();
      setSyncState(fetchedSyncState);
      const lastSync = fetchedSyncState?.last_full_sync_at;

      if (!lastSync) {
        handleSync();
      } else {
        const fiveMinutes = 5 * 60 * 1000;
        if (Date.now() - new Date(lastSync).getTime() > fiveMinutes) {
          handleSync();
        }
      }
    };
    initSync();
  }, []);

  // ── Offline/Online connectivity ────────────────────────────────────
  useEffect(() => {
    const unsubscribe = offlineEmailStorage.onConnectivityChange((online) => {
      setIsOffline(!online);
      if (online) {
        toast.success('Back online! Syncing changes...');
        syncPendingActions();
      } else {
        toast("You're offline. Changes will sync when connected.", { icon: '📡', duration: 3000 });
      }
    });
    offlineEmailStorage.getPendingActions().then((actions) => setPendingActionsCount(actions.length));
    return unsubscribe;
  }, []);

  // ── Sync pending offline actions ───────────────────────────────────
  const syncPendingActions = useCallback(async () => {
    if (!navigator.onLine) return;
    const actions = await offlineEmailStorage.getPendingActions();
    if (actions.length === 0) return;
    let syncedCount = 0;
    let errorCount = 0;
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'markRead': await emailSyncService.markAsRead(action.emailId); break;
          case 'markUnread': await emailSyncService.markAsUnread(action.emailId); break;
          case 'star': case 'unstar': await emailSyncService.toggleStar(action.emailId); break;
          case 'archive': await emailSyncService.archiveEmail(action.emailId); break;
          case 'trash': await emailSyncService.trashEmail(action.emailId); break;
          case 'delete': await emailSyncService.deleteEmail(action.emailId); break;
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
      await loadEmails();
    }
    if (errorCount > 0) toast.error(`Failed to sync ${errorCount} change${errorCount > 1 ? 's' : ''}`);
  }, []);

  // ── Re-authenticate with Google ────────────────────────────────────
  const handleReAuthenticate = async () => {
    setReAuthenticating(true);
    try {
      resetGmailService();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.modify',
          redirectTo: window.location.origin,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Re-auth error:', error);
      toast.error('Failed to re-authenticate. Please try signing out and back in.');
      setReAuthenticating(false);
    }
  };

  // ── Sync emails from Gmail ─────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await emailSyncService.fullSync(100);
      if (result.synced > 0) {
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-zinc-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-stone-950/5 dark:ring-white/10`}>
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5"><MailCheck className="w-4 h-4 text-emerald-500" /></div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-stone-900 dark:text-zinc-100">Synced {result.synced} new emails</p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-stone-200 dark:border-zinc-700">
              <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-stone-700 dark:text-zinc-300 hover:text-rose-500 focus:outline-none transition-colors">Close</button>
            </div>
          </div>
        ), { duration: 4000 });
      } else {
        toast.success(`Synced ${result.synced} emails`);
      }
      await loadEmails();
      setSyncPulseKey((k) => k + 1); // brief rose ring confirming success
    } catch (error) {
      console.error('Sync error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to sync emails';
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-zinc-800 rounded-lg pointer-events-auto flex shadow-lg ring-1 ring-stone-950/5 dark:ring-white/10`}>
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-900 dark:text-zinc-100">Sync failed</p>
                <p className="text-xs text-stone-500 dark:text-zinc-500 mt-0.5 truncate">{msg}</p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-stone-200 dark:border-zinc-700">
            <button
              onClick={() => { toast.dismiss(t.id); handleSync(); }}
              className="px-4 flex items-center justify-center text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ), { duration: 6000 });
    } finally {
      setSyncing(false);
    }
  };

  // ── Folder / category change ───────────────────────────────────────
  const handleFolderChange = (folder: typeof currentFolder) => {
    setCurrentView('inbox');
    setCurrentFolder(folder);
  };

  const handleCategoryChange = (category: typeof activeCategory) => {
    setActiveCategory(category);
  };

  // ── Search (semantic + fallback) ───────────────────────────────────
  const handleSearch = async () => {
    if (!searchQuery.trim()) { await loadEmails(); return; }
    useEmailStore.setState({ loading: true, hasMore: false });
    try {
      const { emailSearchService } = await import('../../services/emailSearchService');
      const results = await emailSearchService.search(searchQuery, { limit: 50 });
      useEmailStore.setState({ emails: results.map((r) => r.email) });
    } catch {
      try {
        const results = await emailSyncService.searchEmails(searchQuery);
        useEmailStore.setState({ emails: results });
      } catch { toast.error('Search failed'); }
    } finally {
      useEmailStore.setState({ loading: false });
    }
  };

  // ── Send email with undo ───────────────────────────────────────────
  const handleSendEmail = async (params: SendEmailParams) => {
    const sendId = `send_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const UNDO_DELAY = 30000;
    closeComposer();

    const executeSend = async () => {
      try {
        const gmail = getGmailService();
        await gmail.sendEmail(params);
        removePendingSend(sendId);
        analyticsCollector.trackMessageEvent({
          id: `email-${Date.now()}`, channel: 'email', contactIdentifier: params.to[0],
          isSent: true, timestamp: new Date(), content: params.body,
          threadId: params.threadId, messageType: 'standard',
        }).catch((err) => console.error('Analytics tracking failed:', err));
        toast.success('Email sent successfully!', { duration: 3000 });
        setTimeout(async () => { try { await emailSyncService.fullSync(20); } catch {} }, 1000);
      } catch (error) {
        console.error('Send error:', error);
        removePendingSend(sendId);
        // Restore the composer with the user's typed content so they don't retype it.
        restoreComposer(params);
        const msg = error instanceof Error ? error.message : 'Failed to send email';
        if (msg.includes('session') || msg.includes('sign') || msg.includes('expired')) {
          setAuthError(true);
          resetGmailService();
          toast.error('Google session expired. Reconnect, then send again. (Draft restored.)');
        } else {
          toast.error(`${msg}. Draft restored.`);
        }
      }
    };

    const timeoutId = setTimeout(executeSend, UNDO_DELAY);
    addPendingSend(sendId, { params, timeoutId, startTime: Date.now() });

    const handleUndo = () => {
      clearTimeout(timeoutId);
      removePendingSend(sendId);
      restoreComposer(params);
      toast.success('Send cancelled - email restored to composer');
    };

    toast(
      (t) => (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-white font-medium">
              <Send className="text-blue-400" />
              <span>Sending to {params.to[0]}...</span>
            </div>
            <div className="text-xs text-zinc-400 mt-1">Email will send in 30 seconds</div>
          </div>
          <button onClick={() => { handleUndo(); toast.dismiss(t.id); }} className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition">Undo</button>
        </div>
      ),
      { duration: UNDO_DELAY, style: { background: '#18181b', border: '1px solid #3f3f46', padding: '12px 16px', minWidth: '320px' } },
    );
  };

  // ── Keyboard navigation ────────────────────────────────────────────
  const handleNextEmail = useCallback(() => {
    if (emails.length === 0) return;
    const currentIdx = selectedEmail ? emails.findIndex((e) => e.id === selectedEmail.id) : -1;
    const nextIdx = Math.min(currentIdx + 1, emails.length - 1);
    if (selectedEmail) handleEmailSelect(emails[nextIdx]);
  }, [emails, selectedEmail]);

  const handlePrevEmail = useCallback(() => {
    if (emails.length === 0) return;
    const currentIdx = selectedEmail ? emails.findIndex((e) => e.id === selectedEmail.id) : 0;
    const prevIdx = Math.max(currentIdx - 1, 0);
    if (selectedEmail) handleEmailSelect(emails[prevIdx]);
  }, [emails, selectedEmail]);

  const focusSearch = useCallback(() => {
    (document.querySelector('input[placeholder*="Search"]') as HTMLInputElement)?.focus();
  }, []);

  useEmailKeyboardShortcuts({
    selectedEmail, emails, isComposerOpen: showComposer,
    onNextEmail: handleNextEmail, onPrevEmail: handlePrevEmail,
    onOpenEmail: (email) => handleEmailSelect(email),
    onCloseEmail: () => { setSelectedEmail(null); setSelectedThread(null); },
    onCompose: openCompose,
    onReply: () => { if (selectedEmail) openReply(selectedEmail); },
    onReplyAll: () => { if (selectedEmail) openReplyAll(selectedEmail, userEmail); },
    onForward: () => { if (selectedEmail) openForward(selectedEmail); },
    onArchive: () => { if (selectedEmail) handleArchive(selectedEmail); },
    onDelete: () => { if (selectedEmail) handleTrash(selectedEmail); },
    onToggleStar: () => { if (selectedEmail) handleToggleStar(selectedEmail); },
    onMarkRead: () => { if (selectedEmail && !selectedEmail.is_read) { emailSyncService.markAsRead(selectedEmail.id); useEmailStore.getState().updateEmailInList(selectedEmail.id, { is_read: true }); } },
    onMarkUnread: () => { if (selectedEmail) handleMarkUnread(selectedEmail); },
    onSnooze: () => {},
    onSearch: focusSearch,
    onGoToInbox: () => handleFolderChange('inbox'),
    onGoToSent: () => handleFolderChange('sent'),
    onGoToStarred: () => handleFolderChange('starred'),
    onGoToDrafts: () => handleFolderChange('drafts'),
    onRefresh: handleSync,
    onUndo: () => {},
    onHelp: () => setShowKeyboardShortcuts(true),
  });

  // ═══════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════

  // First-run: Gmail never connected. Replace the inbox shell with an opinionated welcome.
  if (gmailConnectionState === 'never') {
    return (
      <div className="flex flex-1 h-full bg-stone-50 dark:bg-zinc-950 items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="relative w-20 h-20 mx-auto mb-7 flex items-center justify-center">
            <span className="pulse-email-zero-halo absolute inset-0 rounded-full bg-rose-500/15 dark:bg-rose-500/20" aria-hidden="true" />
            <span className="absolute inset-3 rounded-full bg-rose-500/10 dark:bg-rose-500/15" aria-hidden="true" />
            <MailCheck className="w-7 h-7 text-rose-500 relative" strokeWidth={1.75} />
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400 mb-3">
            Pulse Mail · Connect
          </div>
          <h2 className="text-2xl font-light text-stone-900 dark:text-white tracking-tight mb-2">
            One inbox, one surface.
          </h2>
          <p className="text-sm text-stone-500 dark:text-zinc-400 mb-7 max-w-[42ch] mx-auto leading-relaxed">
            Pulse pulls your Gmail in, summarizes what matters, and drafts replies in your voice. Sign in to your Google account to begin.
          </p>
          <button
            onClick={async () => {
              setConnectingGmail(true);
              try { await handleReAuthenticate(); } catch { setConnectingGmail(false); }
            }}
            disabled={connectingGmail}
            className="inline-flex items-center gap-2 h-11 px-6 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-500/60 text-white rounded-lg text-sm font-medium transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_1px_0_rgba(244,63,94,0.2),0_4px_12px_rgba(244,63,94,0.18)] hover:-translate-y-[1px] hover:shadow-[0_2px_0_rgba(244,63,94,0.25),0_10px_24px_rgba(244,63,94,0.30)]"
          >
            {connectingGmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            {connectingGmail ? 'Opening Google' : 'Connect Google'}
          </button>
          <div className="mt-7 font-mono text-[10px] uppercase tracking-[0.14em] text-stone-400 dark:text-zinc-600">
            Read · Send · Search · Modify · Compose
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 h-full bg-stone-50 dark:bg-zinc-950 min-h-0">
      {/* Sidebar */}
      <EmailSidebarRedesign
        currentFolder={currentFolder}
        folderCounts={folderCounts}
        unreadCount={unreadCount}
        onFolderChange={handleFolderChange}
        onCompose={() => { openCompose(); setSidebarOpen(false); }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        accentColor={accentColor}
        onCampaignsClick={() => { setCurrentView('campaigns'); setEditingCampaign(undefined); setSidebarOpen(false); }}
        isCampaignsActive={currentView === 'campaigns'}
        cachedEmailCount={syncState?.total_emails_cached ?? 0}
      />

      {/* Main content area: rests on canvas, no card, no margin asymmetry */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-zinc-900">
        {/* Auth Error Banner */}
        {authError && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-amber-500" />
              <span className="text-amber-800 dark:text-amber-200 text-sm">Your Google session has expired. Reconnect to send emails.</span>
            </div>
            <button onClick={handleReAuthenticate} disabled={reAuthenticating} className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-medium px-4 py-1.5 rounded-lg text-sm transition flex items-center gap-2 disabled:opacity-50">
              {reAuthenticating ? (<><Loader2 className="animate-spin" />Connecting...</>) : (<><ExternalLink />Reconnect Google</>)}
            </button>
          </div>
        )}

        {/* Header — search dominates, secondary controls quiet */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-stone-200 dark:border-zinc-800">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden w-11 h-11 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-600 dark:text-zinc-400 transition" aria-label="Open menu"><Menu className="w-5 h-5" /></button>

          {/* Search — primary surface */}
          <div className="flex-1 relative max-w-2xl">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search emails"
              aria-label="Search emails"
              enterKeyHint="search"
              className="w-full h-11 bg-stone-100/70 dark:bg-white/[0.03] border border-transparent hover:border-stone-200 dark:hover:border-white/10 rounded-lg pl-10 pr-11 text-sm text-stone-900 dark:text-white placeholder-stone-500 dark:placeholder-zinc-500 focus:outline-none focus:border-rose-500/60 focus:bg-white dark:focus:bg-zinc-900 transition-colors"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-zinc-500" />
            {searchQuery && (
              <button
                type="button"
                title="Clear search"
                aria-label="Clear search"
                onClick={() => { setSearchQuery(''); loadEmails(); }}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-md flex items-center justify-center text-stone-400 dark:text-zinc-500 hover:bg-stone-200/70 dark:hover:bg-white/[0.06] hover:text-stone-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Secondary cluster — tight grouping, ghost styling */}
          <div className="flex items-center gap-1">
            {currentFolder === 'inbox' && <FollowUpRemindersDropdown onComposeFollowUp={(to, subject, email) => openFollowUp(to, subject, email)} onDismiss={dismissFollowUp} />}

            <GoogleAuthStatus onReconnect={() => setShowReauthModal(true)} />

            <OfflineIndicatorCompact isOffline={isOffline} pendingActionsCount={pendingActionsCount} />

            {currentFolder === 'inbox' && (
              <button
                onClick={() => setShowBriefing(!showBriefing)}
                aria-pressed={showBriefing}
                className={`hidden sm:flex items-center gap-2 px-3 h-10 rounded-lg text-sm transition ${
                  showBriefing
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-white/[0.04] hover:text-stone-900 dark:hover:text-white'
                }`}
                title={showBriefing ? 'Hide briefing' : 'Show briefing'}
              >
                <MailOpen className="w-4 h-4" /><span className="hidden lg:inline">Briefing</span>
              </button>
            )}

            <button
              onClick={handleSync}
              disabled={syncing}
              className="relative w-10 h-10 rounded-lg text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-white/[0.04] hover:text-stone-900 dark:hover:text-white flex items-center justify-center transition disabled:opacity-40"
              title="Sync emails"
              aria-label={syncing ? 'Syncing emails' : 'Sync emails'}
              aria-busy={syncing}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncPulseKey > 0 && (
                <span key={syncPulseKey} className="pulse-email-sync-success" aria-hidden="true" />
              )}
            </button>

            <button
              onClick={() => setShowEmailSettings(true)}
              className="w-10 h-10 rounded-lg text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-white/[0.04] hover:text-stone-900 dark:hover:text-white flex items-center justify-center transition"
              title="Email settings"
              aria-label="Open email settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Daily Briefing — generous breathing room above content */}
        {showBriefing && currentFolder === 'inbox' && !selectedEmail && (
          <div ref={briefingRef} className={`px-6 py-5 border-b border-stone-200 dark:border-zinc-800 transition-colors duration-300 ${nudgeFocused ? 'bg-rose-500/[0.04]' : ''}`}>
            <DailyBriefing onEmailClick={(email) => { handleEmailSelect(email); setShowBriefing(false); }} onViewAll={() => setShowBriefing(false)} />
          </div>
        )}

        {/* Content: Campaigns or Email list/viewer */}
        <div className="flex-1 overflow-hidden min-h-0">
          {currentView === 'campaigns' ? (
            editingCampaign !== undefined ? (
              <EmailCampaignBuilder campaign={editingCampaign} onSave={() => { incrementCampaignRefreshKey(); setEditingCampaign(undefined); }} onCancel={() => setEditingCampaign(undefined)} />
            ) : (
              <EmailCampaignsDashboard key={campaignRefreshKey} onNewCampaign={() => setEditingCampaign(null)} onEditCampaign={(c) => setEditingCampaign(c)} />
            )
          ) : (
            <div className="flex h-full origin-top-left transition-transform duration-200" style={{ transform: `scale(${zoomLevel / 100})`, width: `${10000 / zoomLevel}%`, height: `${10000 / zoomLevel}%` }}>
              <div className={`${selectedEmail ? 'hidden md:flex md:w-2/5 md:border-r md:border-stone-200 dark:md:border-zinc-800' : 'flex w-full'} flex-col min-h-0 flex-1`}>
                <EmailListRedesign emails={emails} selectedEmail={selectedEmail} loading={loading} onEmailSelect={handleEmailSelect} onToggleStar={handleToggleStar} onArchive={handleArchive} onTrash={handleTrash} currentFolder={currentFolder} accentColor={accentColor} activeCategory={activeCategory} onCategoryChange={handleCategoryChange} categoryCounts={categoryCounts} hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />
              </div>
              {selectedEmail && (
                <div className="w-full md:flex-1 overflow-hidden">
                  <EmailViewerNew email={selectedEmail} thread={selectedThread} onClose={() => { setSelectedEmail(null); setSelectedThread(null); }} onReply={(email, prefilled) => openReply(email, prefilled)} onReplyAll={(email) => openReplyAll(email, userEmail)} onForward={(email) => openForward(email)} onArchive={() => handleArchive(selectedEmail)} onTrash={() => handleTrash(selectedEmail)} onToggleStar={() => handleToggleStar(selectedEmail)} onMarkUnread={() => handleMarkUnread(selectedEmail)} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEmailSettings && <EmailSettingsModal isOpen={showEmailSettings} onClose={() => setShowEmailSettings(false)} userEmail={userEmail} />}

      {showComposer && (
        <EmailComposerModal userEmail={userEmail} userName={userName} replyTo={replyToEmail} prefilledBody={prefilledBody} initialTo={restoredComposer?.to} initialSubject={restoredComposer?.subject} initialCc={restoredComposer?.cc} initialBcc={restoredComposer?.bcc} onClose={closeComposer} onSend={handleSendEmail} />
      )}

      {showKeyboardShortcuts && <KeyboardShortcutsModal onClose={() => setShowKeyboardShortcuts(false)} />}

      {/* FAB for mobile compose */}
      <button
        onClick={openCompose}
        className="md:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-[0_8px_24px_rgba(244,63,94,0.35)] flex items-center justify-center transition-colors z-50"
        aria-label="Compose email"
      >
        <Pen className="w-5 h-5" />
      </button>

      {/* Keyboard shortcuts hint */}
      <button
        onClick={() => setShowKeyboardShortcuts(true)}
        className="hidden md:flex fixed bottom-4 right-4 w-9 h-9 rounded-lg bg-white/80 dark:bg-white/[0.04] backdrop-blur border border-stone-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/[0.08] items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-stone-700 dark:hover:text-white transition z-50"
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
      >
        <Keyboard className="w-4 h-4" />
      </button>

      {/* Reconnect Google Modal */}
      <ReconnectGoogleModal isOpen={showReauthModal} onClose={() => setShowReauthModal(false)} onSuccess={async () => { setShowReauthModal(false); setAuthError(false); toast.success('Google reconnected successfully!'); await loadEmails(); }} message="Your Google session has expired. Please reconnect to continue using Gmail features." />
    </div>
  );
};

export default PulseEmailClientRedesign;
