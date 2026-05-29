// EmailHybridClient — entry point when emailHybrid flag is on.
// Phase 8 adds:
//   - Search input wired through emailStore.searchQuery + handleSearch (port
//     of legacy semantic search → service fallback chain).
//   - SearchResultsView renders when a search has been executed; Clear or
//     Esc on the input restores the normal Cockpit/FolderListView.
//   - SnoozeModal mounted globally and triggered by:
//       * B keybind  → snoozes the "focused" email (Triage current row,
//         else expanded SignalRow, else nothing).
//       * Per-row Snooze buttons in FolderListView / SearchResultsView /
//         InlineReader.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Send, MailCheck, AlertTriangle } from 'lucide-react';
import { emailSyncService } from '../../../services/emailSyncService';
import { getGmailService, resetGmailService, type SendEmailParams } from '../../../services/gmailService';
import { supabase } from '../../../services/supabase';
import analyticsCollector from '../../../services/analyticsCollector';

import { useEmailStore } from '../../../store/emailStore';
import { useEmailUIStore } from '../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../store/emailComposeStore';

import { CockpitView } from './CockpitView';
import { FolderListView } from './FolderListView';
import { TriageView } from './TriageView';
import { SearchResultsView } from './SearchResultsView';
import { CanvasTopBar } from './chrome/CanvasTopBar';
import { ComposeFab } from './cockpit/ComposeFab';
import { HybridFirstRunScreen } from './chrome/HybridFirstRunScreen';
import { HybridAuthErrorBanner } from './chrome/HybridAuthErrorBanner';
import { HybridKeyboardShortcutsModal } from './HybridKeyboardShortcutsModal';
import { computeFreshTriageQueue, useTriageQueue } from './data/useTriageQueue';
import { useEmailHybridShortcuts } from './data/useEmailHybridShortcuts';
import EmailComposerModal from '../EmailComposerModal';
import EmailSettingsModal from '../EmailSettingsModal';
import { SnoozeModal } from '../SnoozeModal';
import { EmailReaderPanel } from './EmailReaderPanel';
import { ReconnectGoogleModal } from '../../Auth/ReconnectGoogleModal';
import './hybrid.css';

interface EmailHybridClientProps {
  userEmail: string;
  userName: string;
}

interface ComposeEventDetail {
  recipient?: string;
  subject?: string;
  body?: string;
}

type GmailConnectionState = 'checking' | 'connected' | 'never';

const UNDO_SEND_DELAY_MS = 30000;

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export const EmailHybridClient: React.FC<EmailHybridClientProps> = ({ userEmail, userName }) => {
  const shellRef = useRef<HTMLDivElement>(null);

  // ── Store selectors ───────────────────────────────────────────────────
  const emails = useEmailStore((s) => s.emails);
  const loadEmails = useEmailStore((s) => s.loadEmails);
  const currentFolder = useEmailStore((s) => s.currentFolder);
  const activeCategory = useEmailStore((s) => s.activeCategory);
  const syncState = useEmailStore((s) => s.syncState);
  const setSyncState = useEmailStore((s) => s.setSyncState);
  const setSyncing = useEmailStore((s) => s.setSyncing);
  const authError = useEmailStore((s) => s.authError);
  const setAuthError = useEmailStore((s) => s.setAuthError);
  const reAuthenticating = useEmailStore((s) => s.reAuthenticating);
  const setReAuthenticating = useEmailStore((s) => s.setReAuthenticating);
  const searchQuery = useEmailStore((s) => s.searchQuery);
  const setSearchQuery = useEmailStore((s) => s.setSearchQuery);
  const removeEmailFromList = useEmailStore((s) => s.removeEmailFromList);

  const mode = useEmailUIStore((s) => s.emailHybridMode);
  const setMode = useEmailUIStore((s) => s.setEmailHybridMode);
  const setNudgeFocused = useEmailUIStore((s) => s.setNudgeFocused);
  const expandedSignalRowId = useEmailUIStore((s) => s.expandedSignalRowId);
  const setExpandedSignalRowId = useEmailUIStore((s) => s.setExpandedSignalRowId);
  const focusedSignalRowId = useEmailUIStore((s) => s.focusedSignalRowId);
  const triageQueueIds = useEmailUIStore((s) => s.triageQueueIds);
  const setTriageQueueIds = useEmailUIStore((s) => s.setTriageQueueIds);
  const showKeyboardShortcuts = useEmailUIStore((s) => s.showKeyboardShortcuts);
  const setShowKeyboardShortcuts = useEmailUIStore((s) => s.setShowKeyboardShortcuts);
  const showEmailSettings = useEmailUIStore((s) => s.showEmailSettings);
  const setShowEmailSettings = useEmailUIStore((s) => s.setShowEmailSettings);
  const showReauthModal = useEmailUIStore((s) => s.showReauthModal);
  const setShowReauthModal = useEmailUIStore((s) => s.setShowReauthModal);
  const snoozeTargetEmailId = useEmailUIStore((s) => s.snoozeTargetEmailId);
  const setSnoozeTargetEmailId = useEmailUIStore((s) => s.setSnoozeTargetEmailId);
  const readerPanelEmailId = useEmailUIStore((s) => s.readerPanelEmailId);
  const setReaderPanelEmailId = useEmailUIStore((s) => s.setReaderPanelEmailId);

  const showComposer = useEmailComposeStore((s) => s.showComposer);
  const openCompose = useEmailComposeStore((s) => s.openCompose);
  const replyToEmail = useEmailComposeStore((s) => s.replyToEmail);
  const prefilledBody = useEmailComposeStore((s) => s.prefilledBody);
  const restoredComposer = useEmailComposeStore((s) => s.restoredComposer);
  const closeComposer = useEmailComposeStore((s) => s.closeComposer);
  const restoreComposer = useEmailComposeStore((s) => s.restoreComposer);
  const addPendingSend = useEmailComposeStore((s) => s.addPendingSend);
  const removePendingSend = useEmailComposeStore((s) => s.removePendingSend);

  const triageData = useTriageQueue();
  const isInbox = currentFolder === 'inbox';

  // Focus management on mode transitions (Phase 10 a11y):
  // Entering Triage    → focus first action button on the focal card.
  // Returning Cockpit  → focus the active seg-toggle pill.
  // Skip the initial mount to avoid stealing page-load focus.
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    const t = setTimeout(() => {
      if (mode === 'triage') {
        // Focus the scrollable BODY (a div) rather than the Archive button.
        // A focused div is inert under Space/Enter, so users reading the
        // email can't accidentally archive by pressing keys after a click;
        // Tab from here still moves naturally into the action bar.
        const body = document.querySelector<HTMLDivElement>('.triage-stage .triage-body');
        body?.focus();
      } else {
        const target = document.querySelector<HTMLButtonElement>(
          '.seg-toggle button[data-active="true"]',
        );
        target?.focus();
      }
    }, 320); // matches the view-shell cross-fade duration
    return () => clearTimeout(t);
  }, [mode]);

  // ── Search execution state (separate from the controlled input value) ─
  const [searchActive, setSearchActive] = useState(false);
  const [executedQuery, setExecutedQuery] = useState('');

  // ── Gmail connection state ────────────────────────────────────────────
  const [gmailConnectionState, setGmailConnectionState] =
    useState<GmailConnectionState>('checking');
  const [connectingGmail, setConnectingGmail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        const hasProviderToken = Boolean(session?.provider_token);
        const hasCached = (syncState?.total_emails_cached ?? 0) > 0 || emails.length > 0;
        setGmailConnectionState(hasProviderToken || hasCached ? 'connected' : 'never');
      } catch {
        if (!cancelled) setGmailConnectionState('connected');
      }
    })();
    return () => { cancelled = true; };
  }, [syncState?.total_emails_cached, emails.length]);

  // Auto-sync on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await emailSyncService.getSyncState();
        if (cancelled) return;
        setSyncState(fetched);
        const lastSync = fetched?.last_full_sync_at;
        const stale = !lastSync || (Date.now() - new Date(lastSync).getTime() > 5 * 60 * 1000);
        if (stale) void handleSync();
      } catch (err) {
        console.warn('[EmailHybridClient] initial sync probe failed:', err);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snap back to cockpit when leaving inbox
  useEffect(() => {
    if (!isInbox && mode === 'triage') setMode('cockpit');
  }, [isInbox, mode, setMode]);

  useEffect(() => {
    if (searchActive) return; // search results replace folder data — skip the reload
    void loadEmails();
  }, [loadEmails, currentFolder, activeCategory, searchActive]);

  // Triage queue freeze
  useEffect(() => {
    if (!isInbox) return;
    if (searchActive) return; // don't freeze a search-result queue
    if (triageQueueIds.length === 0 && emails.length > 0) {
      const fresh = computeFreshTriageQueue(emails);
      if (fresh.length > 0) setTriageQueueIds(fresh);
    }
  }, [emails, isInbox, searchActive, triageQueueIds.length, setTriageQueueIds]);

  // pulse_focus_nudge deep-link
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flag = sessionStorage.getItem('pulse_focus_nudge');
    if (flag !== 'email') return;

    sessionStorage.removeItem('pulse_focus_nudge');
    setMode('cockpit');
    setTimeout(() => {
      shellRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setNudgeFocused(true);
      setTimeout(() => setNudgeFocused(false), 2000);
    }, 150);
  }, [setMode, setNudgeFocused]);

  // pulse:compose-email
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (evt: Event) => {
      const detail = (evt as CustomEvent<ComposeEventDetail>).detail || {};
      restoreComposer({
        to: detail.recipient ? [detail.recipient] : [],
        subject: detail.subject || '',
        body: detail.body || '',
      });
    };
    window.addEventListener('pulse:compose-email', handler);
    return () => window.removeEventListener('pulse:compose-email', handler);
  }, [restoreComposer]);

  // ── handleSearch: ports legacy semantic+fallback chain ────────────────
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchActive(false);
      setExecutedQuery('');
      await loadEmails();
      return;
    }
    setSearchActive(true);
    setExecutedQuery(q);
    useEmailStore.setState({ loading: true, hasMore: false });
    try {
      const { emailSearchService } = await import('../../../services/emailSearchService');
      const results = await emailSearchService.search(q, { limit: 50 });
      useEmailStore.setState({ emails: results.map((r) => r.email) });
    } catch {
      try {
        const results = await emailSyncService.searchEmails(q);
        useEmailStore.setState({ emails: results });
      } catch {
        toast.error('Search failed');
      }
    } finally {
      useEmailStore.setState({ loading: false });
    }
  }, [searchQuery, loadEmails]);

  const clearSearch = useCallback(async () => {
    setSearchQuery('');
    setSearchActive(false);
    setExecutedQuery('');
    await loadEmails();
  }, [setSearchQuery, loadEmails]);

  // ── handleSync: ports legacy custom-toast pattern ─────────────────────
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await emailSyncService.fullSync(100);
      if (result.synced > 0) {
        toast.custom((t) => (
          <div
            className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full pointer-events-auto flex shadow-lg ring-1`}
            style={{
              background: 'var(--pulse-surface)',
              borderRadius: 8,
              color: 'var(--pulse-ink)',
            }}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start gap-3">
                <MailCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#10b981' }} />
                <p className="text-sm font-medium">Synced {result.synced} new emails</p>
              </div>
            </div>
            <div className="flex border-l pulse-border-color">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="px-4 text-sm font-medium pulse-ink-2-color hover:pulse-rose-color transition"
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        ), { duration: 4000 });
      } else {
        toast.success(`Synced ${result.synced} emails`);
      }
      await loadEmails();
    } catch (error) {
      console.error('[EmailHybridClient] Sync error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to sync emails';
      toast.custom((t) => (
        <div
          className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full pointer-events-auto flex shadow-lg ring-1`}
          style={{
            background: 'var(--pulse-surface)',
            borderRadius: 8,
            color: 'var(--pulse-ink)',
          }}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 pulse-rose-color" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Sync failed</p>
                <p className="text-xs pulse-ink-3-color mt-0.5 truncate">{msg}</p>
              </div>
            </div>
          </div>
          <div className="flex border-l pulse-border-color">
            <button
              onClick={() => { toast.dismiss(t.id); void handleSync(); }}
              className="px-4 text-sm font-medium pulse-rose-color hover:pulse-rose-bg-soft-color transition"
              type="button"
            >
              Retry
            </button>
          </div>
        </div>
      ), { duration: 6000 });
    } finally {
      setSyncing(false);
    }
  }, [loadEmails, setSyncing]);

  // ── handleReAuthenticate ──────────────────────────────────────────────
  const handleReAuthenticate = useCallback(async () => {
    setReAuthenticating(true);
    try {
      resetGmailService();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes:
            'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.modify',
          redirectTo: window.location.origin,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('[EmailHybridClient] Re-auth error:', error);
      toast.error('Failed to re-authenticate. Please try signing out and back in.');
      setReAuthenticating(false);
    }
  }, [setReAuthenticating]);

  // ── handleSendEmail: 30-sec undo flow ─────────────────────────────────
  const handleSendEmail = useCallback(async (params: SendEmailParams) => {
    const sendId = `send_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    closeComposer();

    const executeSend = async () => {
      try {
        const gmail = getGmailService();
        await gmail.sendEmail(params);
        removePendingSend(sendId);
        analyticsCollector
          .trackMessageEvent({
            id: `email-${Date.now()}`,
            channel: 'email',
            contactIdentifier: params.to[0],
            isSent: true,
            timestamp: new Date(),
            content: params.body,
            threadId: params.threadId,
            messageType: 'standard',
          })
          .catch((err) => console.error('Analytics tracking failed:', err));
        toast.success('Email sent successfully!', { duration: 3000 });
        setTimeout(async () => {
          try { await emailSyncService.fullSync(20); } catch { /* silent */ }
        }, 1000);
      } catch (error) {
        console.error('[EmailHybridClient] Send error:', error);
        removePendingSend(sendId);
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

    const timeoutId = setTimeout(executeSend, UNDO_SEND_DELAY_MS);
    addPendingSend(sendId, { params, timeoutId, startTime: Date.now() });

    const handleUndo = () => {
      clearTimeout(timeoutId);
      removePendingSend(sendId);
      restoreComposer(params);
      toast.success('Send cancelled — email restored to composer');
    };

    toast(
      (t) => (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 font-medium" style={{ color: '#fff' }}>
              <Send className="w-4 h-4" style={{ color: '#60a5fa' }} />
              <span>Sending to {params.to[0]}...</span>
            </div>
            <div className="text-xs mt-1" style={{ color: '#a1a1aa' }}>
              Email will send in 30 seconds
            </div>
          </div>
          <button
            onClick={() => { handleUndo(); toast.dismiss(t.id); }}
            className="font-bold px-4 py-2 rounded-lg text-sm transition"
            style={{ background: '#3f3f46', color: '#fff' }}
            type="button"
          >
            Undo
          </button>
        </div>
      ),
      {
        duration: UNDO_SEND_DELAY_MS,
        style: {
          background: '#18181b',
          border: '1px solid #3f3f46',
          padding: '12px 16px',
          minWidth: '320px',
        },
      },
    );
  }, [
    addPendingSend, removePendingSend, restoreComposer, closeComposer, setAuthError,
  ]);

  // ── Snooze (custom time via SnoozeModal) ──────────────────────────────
  const snoozeTargetEmail = snoozeTargetEmailId
    ? emails.find((e) => e.id === snoozeTargetEmailId) ?? null
    : null;
  const triageCurrentRow = triageData.currentRow;

  const handleSnoozeChosen = useCallback(
    (snoozeUntil: Date) => {
      const id = snoozeTargetEmailId;
      setSnoozeTargetEmailId(null);
      if (!id) return;
      emailSyncService
        .snoozeEmail(id, snoozeUntil)
        .then(() => {
          removeEmailFromList(id);
          toast.success(`Snoozed until ${snoozeUntil.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`);
        })
        .catch(() => toast.error('Snooze failed — try again from the email.'));
    },
    [snoozeTargetEmailId, setSnoozeTargetEmailId, removeEmailFromList],
  );

  const handleSnoozeFocused = useCallback(() => {
    // B keybind: snooze the most contextually-focused email.
    //   1. Triage mode → current triage card
    //   2. Cockpit mode + expanded signal row → that row
    //   3. Cockpit mode + keyboard-focused signal row → that row
    if (mode === 'triage' && triageCurrentRow) {
      setSnoozeTargetEmailId(triageCurrentRow.id);
      return;
    }
    if (mode === 'cockpit') {
      const id = expandedSignalRowId ?? focusedSignalRowId;
      if (id) setSnoozeTargetEmailId(id);
      else toast('Focus an email first (j/k) to snooze it.');
    }
  }, [mode, triageCurrentRow, expandedSignalRowId, focusedSignalRowId, setSnoozeTargetEmailId]);

  // ── ⌘E / Ctrl+E ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key?.toLowerCase() !== 'e') return;
      if (isTextInputTarget(e.target)) return;
      if (showComposer || showEmailSettings || showReauthModal) return;
      if (!isInbox) return;
      // Mobile: Triage is hidden by Phase 9 layout rules; keep the keybind
      // dormant so it can't trap the user in a hidden view.
      if (typeof window !== 'undefined' && window.innerWidth < 768) return;
      e.preventDefault();
      setMode(mode === 'cockpit' ? 'triage' : 'cockpit');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, setMode, isInbox, showComposer, showEmailSettings, showReauthModal]);

  // ── Esc ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isTextInputTarget(e.target)) return;
      if (showComposer || showKeyboardShortcuts || showEmailSettings || showReauthModal) return;
      if (snoozeTargetEmailId) {
        e.preventDefault();
        setSnoozeTargetEmailId(null);
        return;
      }
      if (readerPanelEmailId) {
        e.preventDefault();
        setReaderPanelEmailId(null);
        return;
      }
      if (mode === 'triage') {
        e.preventDefault();
        setMode('cockpit');
        return;
      }
      if (expandedSignalRowId) {
        e.preventDefault();
        setExpandedSignalRowId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    mode, expandedSignalRowId, setMode, setExpandedSignalRowId,
    snoozeTargetEmailId, setSnoozeTargetEmailId,
    readerPanelEmailId, setReaderPanelEmailId,
    showComposer, showKeyboardShortcuts, showEmailSettings, showReauthModal,
  ]);

  useEmailHybridShortcuts({
    onCompose: openCompose,
    onHelp: () => setShowKeyboardShortcuts(true),
    onSync: handleSync,
    onSnoozeFocused: handleSnoozeFocused,
  });

  const goToTriage = useCallback(() => setMode('triage'), [setMode]);
  const goToCockpit = useCallback(() => setMode('cockpit'), [setMode]);
  const handleTriageOne = useCallback(
    (_emailId: string) => setMode('triage'),
    [setMode],
  );

  if (gmailConnectionState === 'never') {
    return (
      <HybridFirstRunScreen
        connecting={connectingGmail}
        onConnect={async () => {
          setConnectingGmail(true);
          try {
            await handleReAuthenticate();
          } catch {
            setConnectingGmail(false);
          }
        }}
      />
    );
  }

  return (
    <div ref={shellRef} className="email-hybrid-shell h-full w-full flex flex-col overflow-hidden">
      {authError && (
        <HybridAuthErrorBanner
          reconnecting={reAuthenticating}
          onReconnect={handleReAuthenticate}
        />
      )}

      <CanvasTopBar
        triageRemaining={triageData.remaining}
        onSync={handleSync}
        onSearchSubmit={handleSearch}
        onSearchClear={clearSearch}
      />

      <div className="flex-1 overflow-hidden relative">
        <div className={`view-shell ${mode === 'cockpit' ? 'view-active' : 'view-inactive'}`}>
          {searchActive ? (
            <SearchResultsView query={executedQuery} onClear={clearSearch} />
          ) : isInbox ? (
            <CockpitView
              density="normal"
              onOpenTriage={triageData.remaining > 0 ? goToTriage : undefined}
              onTriageOne={handleTriageOne}
              triageRemaining={triageData.remaining}
              upcomingQueueIds={triageData.upcomingIds}
              clearedIds={triageData.clearedIds}
            />
          ) : (
            <FolderListView />
          )}
        </div>

        <div className={`view-shell ${mode === 'triage' ? 'view-active' : 'view-inactive'}`}>
          <TriageView onDismiss={goToCockpit} />
        </div>

        {/* Compose FAB lives at the view-shell container level (not inside
            CockpitView's scrollable region) so it stays anchored to the
            visible viewport bottom-right instead of scrolling with content.
            Hidden in Triage mode — no compose semantics there. */}
        {mode === 'cockpit' && <ComposeFab onClick={openCompose} />}

        {/* Slide-out reader panel (Phase 12.4) — overlays the active view
            when readerPanelEmailId is set. Backdrop + Esc both close it. */}
        <EmailReaderPanel />
      </div>

      {showKeyboardShortcuts && (
        <HybridKeyboardShortcutsModal onClose={() => setShowKeyboardShortcuts(false)} />
      )}

      {showEmailSettings && (
        <EmailSettingsModal
          isOpen={showEmailSettings}
          onClose={() => setShowEmailSettings(false)}
          userEmail={userEmail}
        />
      )}

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
          onClose={closeComposer}
          onSend={handleSendEmail}
        />
      )}

      {snoozeTargetEmail && (
        <SnoozeModal
          onSnooze={handleSnoozeChosen}
          onClose={() => setSnoozeTargetEmailId(null)}
        />
      )}

      <ReconnectGoogleModal
        isOpen={showReauthModal}
        onClose={() => setShowReauthModal(false)}
        onSuccess={async () => {
          setShowReauthModal(false);
          setAuthError(false);
          toast.success('Google reconnected successfully!');
          await loadEmails();
        }}
        message="Your Google session has expired. Please reconnect to continue using Gmail features."
      />
    </div>
  );
};

export default EmailHybridClient;
