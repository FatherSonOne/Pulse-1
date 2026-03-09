import React from 'react';

import { ArrowDown, RefreshCw } from 'lucide-react';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  progress: number; // 0-1 value indicating pull progress
}

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  isRefreshing,
  progress,
}) => {
  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div
      className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-50 transition-all duration-200"
      style={{
        transform: `translateY(${Math.min(pullDistance - 50, 20)}px)`,
        opacity: Math.min(progress * 2, 1),
      }}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-full shadow-lg p-3 flex items-center justify-center">
        {isRefreshing ? (
          <RefreshCw className="animate-spin text-blue-500 text-lg" />
        ) : (
          <ArrowDown className="text-zinc-400 text-lg transition-transform duration-200" />
        )}
      </div>
    </div>
  );
};

export default React.memo(PullToRefreshIndicator);
