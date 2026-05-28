// EmailHybridClient — Phase 0 stub.
// Replaces PulseEmailClientRedesign when the `emailHybrid` flag is on.
// Real Cockpit + Triage wiring lands in Phases 1–7.
import React from 'react';

interface EmailHybridClientProps {
  userEmail: string;
  userName: string;
}

export const EmailHybridClient: React.FC<EmailHybridClientProps> = ({ userEmail, userName }) => {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--pulse-bg-canvas)] p-12">
      <div className="max-w-md space-y-3 text-center">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--pulse-text-tertiary)]">
          Email Hybrid · scaffolding
        </div>
        <div className="text-2xl text-[var(--pulse-text-primary)]" style={{ fontFamily: 'var(--pulse-font-serif, Georgia, serif)' }}>
          Cockpit + Triage shell coming online.
        </div>
        <div className="text-sm text-[var(--pulse-text-secondary)]">
          Phase 0 placeholder. Flip with <code>?ff_emailHybrid=off</code> to fall back to the legacy email surface.
        </div>
        <div className="pt-2 text-xs text-[var(--pulse-text-tertiary)]">
          {userName} · {userEmail}
        </div>
      </div>
    </div>
  );
};

export default EmailHybridClient;
