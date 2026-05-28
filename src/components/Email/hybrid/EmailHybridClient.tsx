// EmailHybridClient — entry point when emailHybrid flag is on.
// Phase 2 wires:
//   - emailStore.loadEmails() on mount (and on folder change)
//   - pulse_focus_nudge sessionStorage trigger from Daily Overview
//   - pulse:compose-email custom event from Pulse Assistant
//   - openCompose() for the Cockpit's FAB
// Phase 3 wraps this in the Cockpit↔Triage view-shell cross-fade.
import React, { useEffect, useRef } from 'react';
import { useEmailStore } from '../../../store/emailStore';
import { useEmailUIStore } from '../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../store/emailComposeStore';
import { CockpitView } from './CockpitView';
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

export const EmailHybridClient: React.FC<EmailHybridClientProps> = () => {
  const shellRef = useRef<HTMLDivElement>(null);

  const loadEmails = useEmailStore((s) => s.loadEmails);
  const currentFolder = useEmailStore((s) => s.currentFolder);
  const activeCategory = useEmailStore((s) => s.activeCategory);

  const setNudgeFocused = useEmailUIStore((s) => s.setNudgeFocused);

  const openCompose = useEmailComposeStore((s) => s.openCompose);
  const restoreComposer = useEmailComposeStore((s) => s.restoreComposer);

  // Initial load + reload on folder/category change (mirrors legacy orchestrator).
  useEffect(() => {
    void loadEmails();
  }, [loadEmails, currentFolder, activeCategory]);

  // pulse_focus_nudge: Daily Overview deep-links into the briefing.
  // Scroll to top of the Cockpit + brief rose tint on the headline.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flag = sessionStorage.getItem('pulse_focus_nudge');
    if (flag !== 'email') return;

    sessionStorage.removeItem('pulse_focus_nudge');
    setTimeout(() => {
      shellRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setNudgeFocused(true);
      setTimeout(() => setNudgeFocused(false), 2000);
    }, 150);
  }, [setNudgeFocused]);

  // pulse:compose-email: Pulse Assistant `send_email` action dispatches a
  // CustomEvent with { recipient, subject, body }. Open the composer prefilled.
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

  return (
    <div ref={shellRef} className="email-hybrid-shell h-full w-full relative">
      <CockpitView density="normal" onCompose={openCompose} />
    </div>
  );
};

export default EmailHybridClient;
