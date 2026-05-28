// EmailHybridClient — entry point when emailHybrid flag is on.
// Phase 5 adds the global keyboard hook (c / ? / Shift+N / Ctrl+Z / g+...),
// mounts the HybridKeyboardShortcutsModal, and refines the Esc priority
// order to defer to overlays (composer / settings / shortcuts / reauth)
// before doing mode-aware dismissal.
import React, { useCallback, useEffect, useRef } from 'react';
import { useEmailStore } from '../../../store/emailStore';
import { useEmailUIStore } from '../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../store/emailComposeStore';
import { CockpitView } from './CockpitView';
import { TriageView } from './TriageView';
import { CanvasTopBar } from './chrome/CanvasTopBar';
import { HybridKeyboardShortcutsModal } from './HybridKeyboardShortcutsModal';
import { computeFreshTriageQueue, useTriageQueue } from './data/useTriageQueue';
import { useEmailHybridShortcuts } from './data/useEmailHybridShortcuts';
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

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export const EmailHybridClient: React.FC<EmailHybridClientProps> = () => {
  const shellRef = useRef<HTMLDivElement>(null);

  const emails = useEmailStore((s) => s.emails);
  const loadEmails = useEmailStore((s) => s.loadEmails);
  const currentFolder = useEmailStore((s) => s.currentFolder);
  const activeCategory = useEmailStore((s) => s.activeCategory);

  const mode = useEmailUIStore((s) => s.emailHybridMode);
  const setMode = useEmailUIStore((s) => s.setEmailHybridMode);
  const setNudgeFocused = useEmailUIStore((s) => s.setNudgeFocused);
  const expandedSignalRowId = useEmailUIStore((s) => s.expandedSignalRowId);
  const setExpandedSignalRowId = useEmailUIStore((s) => s.setExpandedSignalRowId);
  const triageQueueIds = useEmailUIStore((s) => s.triageQueueIds);
  const setTriageQueueIds = useEmailUIStore((s) => s.setTriageQueueIds);

  const showKeyboardShortcuts = useEmailUIStore((s) => s.showKeyboardShortcuts);
  const setShowKeyboardShortcuts = useEmailUIStore((s) => s.setShowKeyboardShortcuts);
  const showEmailSettings = useEmailUIStore((s) => s.showEmailSettings);
  const showReauthModal = useEmailUIStore((s) => s.showReauthModal);

  const openCompose = useEmailComposeStore((s) => s.openCompose);
  const restoreComposer = useEmailComposeStore((s) => s.restoreComposer);
  const showComposer = useEmailComposeStore((s) => s.showComposer);

  const triageData = useTriageQueue();

  // ── Initial load + reload on folder/category change ───────────────────
  useEffect(() => {
    void loadEmails();
  }, [loadEmails, currentFolder, activeCategory]);

  // ── Freeze the Triage queue on session start ──────────────────────────
  useEffect(() => {
    if (triageQueueIds.length === 0 && emails.length > 0) {
      const fresh = computeFreshTriageQueue(emails);
      if (fresh.length > 0) setTriageQueueIds(fresh);
    }
  }, [emails, triageQueueIds.length, setTriageQueueIds]);

  // ── pulse_focus_nudge deep-link from Daily Overview ───────────────────
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

  // ── pulse:compose-email from the Pulse Assistant ──────────────────────
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

  // ── ⌘E / Ctrl+E — global mode toggle ──────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key?.toLowerCase() !== 'e') return;
      if (isTextInputTarget(e.target)) return;
      // Don't fight overlay-owned Esc handling.
      if (showComposer || showEmailSettings || showReauthModal) return;
      e.preventDefault();
      setMode(mode === 'cockpit' ? 'triage' : 'cockpit');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, setMode, showComposer, showEmailSettings, showReauthModal]);

  // ── Esc — priority: overlays own theirs; otherwise mode-aware ─────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isTextInputTarget(e.target)) return;
      // Composer / modals own their own Esc — yield silently.
      if (showComposer || showKeyboardShortcuts || showEmailSettings || showReauthModal) return;

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
    showComposer, showKeyboardShortcuts, showEmailSettings, showReauthModal,
  ]);

  // ── Hybrid keyboard hook (c / ? / / / Shift+N / Ctrl+Z / g+...) ──────
  useEmailHybridShortcuts({
    onCompose: openCompose,
    onHelp: () => setShowKeyboardShortcuts(true),
  });

  const goToTriage = useCallback(() => setMode('triage'), [setMode]);
  const goToCockpit = useCallback(() => setMode('cockpit'), [setMode]);

  const handleTriageOne = useCallback(
    (_emailId: string) => {
      setMode('triage');
    },
    [setMode],
  );

  return (
    <div ref={shellRef} className="email-hybrid-shell h-full w-full flex flex-col overflow-hidden">
      <CanvasTopBar triageRemaining={triageData.remaining} />

      <div className="flex-1 overflow-hidden relative">
        <div className={`view-shell ${mode === 'cockpit' ? 'view-active' : 'view-inactive'}`}>
          <CockpitView
            density="normal"
            onCompose={openCompose}
            onOpenTriage={triageData.remaining > 0 ? goToTriage : undefined}
            onTriageOne={handleTriageOne}
            triageRemaining={triageData.remaining}
            upcomingQueueIds={triageData.upcomingIds}
            clearedIds={triageData.clearedIds}
          />
        </div>

        <div className={`view-shell ${mode === 'triage' ? 'view-active' : 'view-inactive'}`}>
          <TriageView onDismiss={goToCockpit} />
        </div>
      </div>

      {showKeyboardShortcuts && (
        <HybridKeyboardShortcutsModal onClose={() => setShowKeyboardShortcuts(false)} />
      )}
    </div>
  );
};

export default EmailHybridClient;
