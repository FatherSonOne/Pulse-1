// EmailHybridClient — entry point when emailHybrid flag is on.
// Phase 3 adds:
//   - CanvasTopBar with the segmented mode toggle
//   - Cross-faded view shells hosting Cockpit and Triage simultaneously
//   - ⌘E / Ctrl+E global keydown to toggle the mode (skips text inputs)
//   - Mode-aware Esc: dismiss Triage; in Cockpit, collapse the expanded row
//   - Triage queue source still mock (Phase 4 wires live data + per-card keys)
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useEmailStore } from '../../../store/emailStore';
import { useEmailUIStore } from '../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../store/emailComposeStore';
import { CockpitView } from './CockpitView';
import { TriageView } from './TriageView';
import { CanvasTopBar } from './chrome/CanvasTopBar';
import { TRIAGE_QUEUE_IDS } from './data/mockEmails';
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

  const loadEmails = useEmailStore((s) => s.loadEmails);
  const currentFolder = useEmailStore((s) => s.currentFolder);
  const activeCategory = useEmailStore((s) => s.activeCategory);

  const mode = useEmailUIStore((s) => s.emailHybridMode);
  const setMode = useEmailUIStore((s) => s.setEmailHybridMode);
  const triageState = useEmailUIStore((s) => s.triageState);
  const setNudgeFocused = useEmailUIStore((s) => s.setNudgeFocused);
  const expandedSignalRowId = useEmailUIStore((s) => s.expandedSignalRowId);
  const setExpandedSignalRowId = useEmailUIStore((s) => s.setExpandedSignalRowId);

  const openCompose = useEmailComposeStore((s) => s.openCompose);
  const restoreComposer = useEmailComposeStore((s) => s.restoreComposer);

  // Triage queue source for Phase 3 is the mock queue; Phase 4 derives it
  // from the live emailStore. Computing here lets the Cockpit's pips and
  // briefing CTA stay coherent with TriageView's progress.
  const queueIds = TRIAGE_QUEUE_IDS;
  const clearedIds = useMemo(
    () => queueIds.slice(0, triageState.idx),
    [queueIds, triageState.idx],
  );
  const upcomingIds = useMemo(
    () => queueIds.slice(triageState.idx),
    [queueIds, triageState.idx],
  );
  const triageRemaining = Math.max(0, queueIds.length - triageState.idx);

  // ── Initial load + reload on folder/category change ───────────────────
  useEffect(() => {
    void loadEmails();
  }, [loadEmails, currentFolder, activeCategory]);

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
      e.preventDefault();
      setMode(mode === 'cockpit' ? 'triage' : 'cockpit');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, setMode]);

  // ── Esc — mode-aware: Triage → dismiss; Cockpit-with-expanded-row → collapse
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isTextInputTarget(e.target)) return;
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
  }, [mode, expandedSignalRowId, setMode, setExpandedSignalRowId]);

  const goToTriage = useCallback(() => setMode('triage'), [setMode]);
  const goToCockpit = useCallback(() => setMode('cockpit'), [setMode]);

  const handleTriageOne = useCallback(
    (_emailId: string) => {
      // Phase 3: queue stays mock-driven; clicking the per-row TRIAGE chip
      // simply switches into Triage mode at the current queue position.
      // Phase 4 will jump the queue to the requested email.
      setMode('triage');
    },
    [setMode],
  );

  return (
    <div ref={shellRef} className="email-hybrid-shell h-full w-full flex flex-col overflow-hidden">
      <CanvasTopBar triageRemaining={triageRemaining} />

      <div className="flex-1 overflow-hidden relative">
        <div className={`view-shell ${mode === 'cockpit' ? 'view-active' : 'view-inactive'}`}>
          <CockpitView
            density="normal"
            onCompose={openCompose}
            onOpenTriage={triageRemaining > 0 ? goToTriage : undefined}
            onTriageOne={handleTriageOne}
            triageRemaining={triageRemaining}
            upcomingQueueIds={upcomingIds}
            clearedIds={clearedIds}
          />
        </div>

        <div className={`view-shell ${mode === 'triage' ? 'view-active' : 'view-inactive'}`}>
          <TriageView onDismiss={goToCockpit} />
        </div>
      </div>
    </div>
  );
};

export default EmailHybridClient;
