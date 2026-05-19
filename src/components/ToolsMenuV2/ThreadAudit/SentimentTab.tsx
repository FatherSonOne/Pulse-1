// src/components/ToolsMenuV2/ThreadAudit/SentimentTab.tsx
// PR 3a — Surface 3 · Thread Audit · Sentiment sub-tab.
//
// Placeholder per spec. Real sentiment scoring lands later — the tab
// structure must work today so PR 3b can drop content in without
// changing the surface.

import React from 'react';

export interface SentimentTabProps {
  isDarkMode?: boolean;
}

export const SentimentTab: React.FC<SentimentTabProps> = ({ isDarkMode = false }) => {
  return (
    <div
      className={[
        'rounded-xl border px-4 py-6 text-center',
        isDarkMode
          ? 'border-white/10 bg-white/[0.02] text-zinc-400'
          : 'border-black/10 bg-black/[0.02] text-zinc-500',
      ].join(' ')}
    >
      <p className="text-sm font-medium">Sentiment analysis coming soon</p>
      <p className="mt-1 text-xs">
        We&rsquo;ll surface mood trends across the conversation here.
      </p>
    </div>
  );
};

export default SentimentTab;
