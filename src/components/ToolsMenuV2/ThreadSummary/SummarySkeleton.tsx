// src/components/ToolsMenuV2/ThreadSummary/SummarySkeleton.tsx
// PR 3b — Surface 3 · Thread Summary skeleton (generating state).
//
// Three stacked shimmer lines at 60% / 90% / 40% widths per spec mock
// 3.4. When the thread is large enough (msg count > determinate
// threshold) the parent renders a determinate progress bar BELOW this
// skeleton; this component renders only the lines.

import React from 'react';

interface SummarySkeletonProps {
  isDarkMode: boolean;
}

export const SummarySkeleton: React.FC<SummarySkeletonProps> = ({
  isDarkMode,
}) => {
  const lineCls = [
    'h-3 rounded-md animate-shimmer',
    isDarkMode ? 'bg-white/10' : 'bg-black/[0.07]',
  ].join(' ');
  return (
    <div className="space-y-2" aria-hidden="true">
      <div className={lineCls} style={{ width: '60%' }} />
      <div className={lineCls} style={{ width: '90%' }} />
      <div className={lineCls} style={{ width: '40%' }} />
    </div>
  );
};

export default SummarySkeleton;
