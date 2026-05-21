// src/components/ToolsMenuV2/Insights/InsightsSkeleton.tsx
// PR 3b — Surface 3 · Insights skeleton (generating state).
//
// Four chip placeholders per spec "Empty/Loading/Error States" row for
// the Insights tile. Shimmer matches SummarySkeleton for visual rhythm.

import React from 'react';

interface InsightsSkeletonProps {
  isDarkMode: boolean;
}

const CHIP_WIDTHS = ['72px', '96px', '64px', '88px'] as const;

export const InsightsSkeleton: React.FC<InsightsSkeletonProps> = ({
  isDarkMode,
}) => {
  return (
    <div
      className="flex flex-wrap gap-2"
      aria-hidden="true"
    >
      {CHIP_WIDTHS.map((width, i) => (
        <div
          key={i}
          className={[
            'h-6 rounded-full animate-shimmer',
            isDarkMode ? 'bg-white/10' : 'bg-black/[0.07]',
          ].join(' ')}
          style={{ width }}
        />
      ))}
    </div>
  );
};

export default InsightsSkeleton;
