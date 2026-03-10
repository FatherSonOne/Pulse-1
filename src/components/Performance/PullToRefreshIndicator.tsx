import { motion } from 'framer-motion';

import { ArrowDown, Check } from 'lucide-react';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold: number;
  maxDistance: number;
}

/**
 * PullToRefreshIndicator Component
 * Visual feedback for pull-to-refresh gesture
 */
export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold,
  maxDistance
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const opacity = Math.min(pullDistance / 40, 1);
  const scale = 0.5 + (progress * 0.5);
  const rotation = progress * 360;

  if (pullDistance === 0 && !isRefreshing) {
    return null;
  }

  return (
    <motion.div
      className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-50"
      style={{
        height: pullDistance,
        opacity
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity }}
      exit={{ opacity: 0 }}
    >
      <div className="relative">
        {isRefreshing ? (
          // Spinning loader during refresh
          <motion.div
            className="w-10 h-10 rounded-full border-3 border-emerald-500 border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: 'linear'
            }}
          />
        ) : (
          // Pull indicator
          <motion.div
            className="relative w-10 h-10"
            style={{ scale }}
          >
            {/* Circular progress background */}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 40 40">
              {/* Background circle */}
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-zinc-200 dark:text-zinc-800"
              />
              {/* Progress circle */}
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${progress * 100.5} 100.5`}
                strokeLinecap="round"
                className={`
                  transition-colors duration-200
                  ${progress >= 1 ? 'text-emerald-500' : 'text-cyan-500'}
                `}
              />
            </svg>

            {/* Icon in center */}
            <motion.div
              className={`
                absolute inset-0 flex items-center justify-center
                text-lg transition-colors duration-200
                ${progress >= 1 ? 'text-emerald-500' : 'text-cyan-500'}
              `}
              style={{ rotate: rotation }}
            >
              {progress >= 1 ? (
                <Check />
              ) : (
                <ArrowDown />
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Text label */}
        <motion.div
          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-medium"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
        >
          {isRefreshing ? (
            <span className="text-emerald-600 dark:text-emerald-400">Refreshing...</span>
          ) : progress >= 1 ? (
            <span className="text-emerald-600 dark:text-emerald-400">Release to refresh</span>
          ) : (
            <span className="text-zinc-600 dark:text-zinc-400">Pull to refresh</span>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
