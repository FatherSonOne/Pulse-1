import React from 'react';
import { Rocket } from 'lucide-react';

export const ComingSoonIntegrations: React.FC = () => {
  return (
    <>
      <div className="section-header" style={{ marginTop: '48px' }}>
        <h3>
          <Rocket /> Coming Soon
        </h3>
        <p>
          More integrations are on the way to help you sync all your data in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="integration-card" style={{ opacity: 0.6, pointerEvents: 'none' }}>
          <div className="integration-header">
            <div className="integration-icon" style={{ background: '#000000' }}>
              <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
                <path fill="#fff" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
            </div>
            <div className="integration-info">
              <h4>Apple iCloud</h4>
              <p>Calendar, Contacts, Reminders</p>
            </div>
          </div>
          <div className="text-center py-4">
            <span className="text-xs bg-[var(--pulse-surface-raised)] text-zinc-600 dark:text-zinc-400 px-3 py-1 rounded-full">Coming Soon</span>
          </div>
        </div>

        <div className="integration-card" style={{ opacity: 0.6, pointerEvents: 'none' }}>
          <div className="integration-header">
            <div className="integration-icon" style={{ background: '#0A66C2' }}>
              <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
                <path fill="#fff" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </div>
            <div className="integration-info">
              <h4>LinkedIn</h4>
              <p>Messages, Connections</p>
            </div>
          </div>
          <div className="text-center py-4">
            <span className="text-xs bg-[var(--pulse-surface-raised)] text-zinc-600 dark:text-zinc-400 px-3 py-1 rounded-full">Coming Soon</span>
          </div>
        </div>
      </div>

      {/* Ecosystem Bridge moved to its own Settings section (Settings > Ecosystem Bridge) */}
      <div className="mt-8 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] px-5 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
          <i className="fa-solid fa-circle-nodes text-rose-500 text-sm" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Ecosystem Bridge</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Connect Pulse, Entomate &amp; Logos Vision, see the{' '}
            <span className="text-rose-500 dark:text-rose-400 font-medium">Ecosystem Bridge</span> section in the sidebar.
          </p>
        </div>
      </div>
    </>
  );
};
