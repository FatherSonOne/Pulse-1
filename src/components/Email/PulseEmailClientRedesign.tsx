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

import { AlertTriangle, ExternalLink, Keyboard, Loader2, MailCheck, MailOpen, Menu, Minus, Pen, Plus, Search, Send, Settings, X } from 'lucide-react';

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
    zoomIn, zoomOut, zoomReset, setZoomLevel,
    setSidebarOpen, setShowBriefing, setShowKeyboardShortcuts, setShowEmailSettings,
    setShowReauthModal, setNudgeFocused,
    setCurrentView, setEditingCampaign, incrementCampaignRefreshKey,
    dismissFollowUp,
  } = useEmailUIStore();

  const briefingRef = useRef<HTMLDivElement>(null);

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
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-zinc-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5"><MailCheck className="text-green-500 text-lg" /></div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-stone-900 dark:text-gray-100">Synced {result.synced} new emails</p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-200 dark:border-zinc-700">
              <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus:outline-none">Close</button>
            </div>
          </div>
        ), { duration: 4000 });
      } else {
        toast.success(`Synced ${result.synced} emails`);
      }
      await loadEmails();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sync emails');
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
        const msg = error instanceof Error ? error.message : 'Failed to send email';
        if (msg.includes('session') || msg.includes('sign') || msg.includes('expired')) {
          setAuthError(true);
          resetGmailService();
          toast.error('Google session expired. Click "Reconnect Google" to continue.');
        } else {
          toast.error(msg);
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

  // ── Accent color helpers ───────────────────────────────────────────
  const accentClasses = {
    rose: { bg: 'bg-rose-500', gradient: 'from-rose-500 to-red-500', text: 'text-rose-600 dark:text-rose-400' },
    blue: { bg: 'bg-blue-500', gradient: 'from-blue-500 to-indigo-500', text: 'text-blue-600 dark:text-blue-400' },
    purple: { bg: 'bg-purple-500', gradient: 'from-purple-500 to-pink-500', text: 'text-purple-600 dark:text-purple-400' },
    green: { bg: 'bg-green-500', gradient: 'from-green-500 to-emerald-500', text: 'text-green-600 dark:text-green-400' },
  }[accentColor];

  // ═══════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-1 h-full bg-stone-100 dark:bg-zinc-950 min-h-0">
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

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 my-3 mr-3 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        {/* Auth Error Banner */}
        {authError && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-amber-500" />
              <span className="text-amber-800 dark:text-amber-200 text-sm">Your Google session has expired. Reconnect to send emails.</span>
            </div>
            <button onClick={handleReAuthenticate} disabled={reAuthenticating} className="bg-amber-500 hover:bg-amber-600 text-black font-medium px-4 py-1.5 rounded-lg text-sm transition flex items-center gap-2 disabled:opacity-50">
              {reAuthenticating ? (<><Loader2 className="animate-spin" />Connecting...</>) : (<><ExternalLink />Reconnect Google</>)}
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden w-10 h-10 rounded-lg bg-stone-100 dark:bg-zinc-800 flex items-center justify-center text-stone-600 dark:text-zinc-400 hover:bg-stone-200 dark:hover:bg-zinc-700 transition" aria-label="Open menu"><Menu /></button>

          {/* Search */}
          <div className="flex-1 relative">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Search emails..." className="w-full bg-stone-100 dark:bg-zinc-800/50 border border-stone-200 dark:border-zinc-700/50 rounded-lg px-4 py-2 pl-10 text-sm text-stone-900 dark:text-white placeholder-stone-500 dark:placeholder-zinc-500 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30" />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-zinc-500 text-sm" />
            {searchQuery && (
              <button type="button" title="Clear search" onClick={() => { setSearchQuery(''); loadEmails(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white"><X className="text-sm" /></button>
            )}
          </div>

          {currentFolder === 'inbox' && <FollowUpRemindersDropdown onComposeFollowUp={(to, subject, email) => openFollowUp(to, subject, email)} onDismiss={dismissFollowUp} />}

          <GoogleAuthStatus onReconnect={() => setShowReauthModal(true)} />

          {/* Sync */}
          <button onClick={handleSync} disabled={syncing} className={`hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${accentClasses.gradient} hover:opacity-90 text-white rounded-lg text-sm transition disabled:opacity-50 shadow-sm`} title="Sync emails">
            <i className={`fa-solid fa-arrows-rotate ${syncing ? 'fa-spin' : ''}`}></i>
            <span className="hidden lg:inline">{syncing ? 'Syncing...' : 'Sync'}</span>
          </button>
          <button onClick={handleSync} disabled={syncing} className={`sm:hidden w-10 h-10 rounded-lg ${accentClasses.bg} flex items-center justify-center text-white disabled:opacity-50`} aria-label="Sync emails">
            <i className={`fa-solid fa-arrows-rotate ${syncing ? 'fa-spin' : ''}`}></i>
          </button>

          <OfflineIndicatorCompact isOffline={isOffline} pendingActionsCount={pendingActionsCount} />

          {/* Briefing toggle */}
          {currentFolder === 'inbox' && (
            <button onClick={() => setShowBriefing(!showBriefing)} className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${showBriefing ? `bg-gradient-to-r ${accentClasses.gradient} bg-opacity-20 ${accentClasses.text} border border-${accentColor}-500/30` : 'bg-stone-200 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white'}`} title={showBriefing ? 'Hide briefing' : 'Show briefing'}>
              <MailOpen /><span className="hidden lg:inline">Briefing</span><i className={`fa-solid fa-chevron-${showBriefing ? 'up' : 'down'} text-xs`}></i>
            </button>
          )}

          {/* Zoom */}
          <div className="hidden lg:flex items-center gap-1 bg-stone-200 dark:bg-zinc-800 rounded-lg px-2 py-1">
            <button onClick={zoomOut} disabled={zoomLevel <= 50} className="w-7 h-7 rounded flex items-center justify-center text-stone-600 dark:text-zinc-400 hover:bg-stone-300 dark:hover:bg-zinc-700 hover:text-stone-800 dark:hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed" title="Zoom out" aria-label="Zoom out"><Minus className="text-xs" /></button>
            <input type="range" min="50" max="100" value={zoomLevel} onChange={(e) => setZoomLevel(parseInt(e.target.value))} className={`w-16 h-1 bg-stone-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-${accentColor}-500`} title={`Zoom: ${zoomLevel}%`} aria-label="Zoom level slider" />
            <button onClick={zoomIn} disabled={zoomLevel >= 100} className="w-7 h-7 rounded flex items-center justify-center text-stone-600 dark:text-zinc-400 hover:bg-stone-300 dark:hover:bg-zinc-700 hover:text-stone-800 dark:hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed" title="Zoom in" aria-label="Zoom in"><Plus className="text-xs" /></button>
            <button onClick={zoomReset} className="ml-1 px-2 py-1 text-xs text-stone-600 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white font-medium transition" title="Reset to 100%">{zoomLevel}%</button>
          </div>

          {/* Settings */}
          <button onClick={() => setShowEmailSettings(true)} className="w-10 h-10 rounded-lg bg-stone-200 dark:bg-zinc-800 hover:bg-stone-300 dark:hover:bg-zinc-700 flex items-center justify-center text-stone-600 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white transition" title="Email Settings" aria-label="Open email settings"><Settings /></button>
        </div>

        {/* Daily Briefing */}
        {showBriefing && currentFolder === 'inbox' && !selectedEmail && (
          <div ref={briefingRef} className={`px-4 py-3 border-b border-stone-200 dark:border-zinc-800 transition-all duration-300 ${nudgeFocused ? 'ring-2 ring-rose-500/60 ring-inset bg-rose-500/5' : ''}`}>
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
            <>
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
            </>
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
      <button onClick={openCompose} className={`md:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full bg-gradient-to-r ${accentClasses.gradient} text-white shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-50`} aria-label="Compose email"><Pen className="text-lg" /></button>

      {/* Keyboard shortcuts hint */}
      <button onClick={() => setShowKeyboardShortcuts(true)} className="hidden md:flex fixed bottom-4 right-4 w-10 h-10 rounded-xl bg-stone-200 dark:bg-zinc-800 hover:bg-stone-300 dark:hover:bg-zinc-700 items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-stone-700 dark:hover:text-white transition shadow-lg z-50" title="Keyboard shortcuts (?)"><Keyboard /></button>

      {/* Reconnect Google Modal */}
      <ReconnectGoogleModal isOpen={showReauthModal} onClose={() => setShowReauthModal(false)} onSuccess={async () => { setShowReauthModal(false); setAuthError(false); toast.success('Google reconnected successfully!'); await loadEmails(); }} message="Your Google session has expired. Please reconnect to continue using Gmail features." />
    </div>
  );
};

export default PulseEmailClientRedesign;
