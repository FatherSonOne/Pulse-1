// src/components/ToolsMenuV2/ThreadAudit/FlowTab.tsx
// PR 3a — Surface 3 · Thread Audit · Flow sub-tab.
//
// Placeholder per spec. Topic-burst arc rendering is deferred; the tab
// shell + a11y wiring is real today so PR 3b can swap the body.

import React from 'react';

export interface FlowTabProps {
  isDarkMode?: boolean;
}

export const FlowTab: React.FC<FlowTabProps> = ({ isDarkMode = false }) => {
  return (
    <div
      className={[
        'rounded-xl border px-4 py-6 text-center',
        isDarkMode
          ? 'border-white/10 bg-white/[0.02] text-zinc-400'
          : 'border-black/10 bg-black/[0.02] text-zinc-500',
      ].join(' ')}
    >
      <p className="text-sm font-medium">Topic-burst arcs coming soon</p>
      <p className="mt-1 text-xs">
        Turn-taking and topic clustering will appear here once the audit
        backend ships.
      </p>
    </div>
  );
};

export default FlowTab;
