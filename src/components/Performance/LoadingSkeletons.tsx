/**
 * Loading Skeleton Components
 * Content-aware skeleton loaders for better perceived performance
 */

interface SkeletonProps {
  className?: string;
}

/**
 * Base Skeleton Component
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`
        animate-pulse bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200
        dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800
        bg-[length:200%_100%]
        ${className}
      `}
      style={{
        animation: 'shimmer 2s ease-in-out infinite'
      }}
    />
  );
}

/**
 * Message Skeleton
 */
export function MessageSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {/* Avatar and name */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="w-24 h-4 rounded" />
          <Skeleton className="w-16 h-3 rounded" />
        </div>
      </div>

      {/* Message content */}
      <div className="space-y-2">
        <Skeleton className="w-full h-4 rounded" />
        <Skeleton className="w-4/5 h-4 rounded" />
        <Skeleton className="w-3/5 h-4 rounded" />
      </div>
    </div>
  );
}

/**
 * Conversation List Skeleton
 */
export function ConversationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="w-32 h-4 rounded" />
              <Skeleton className="w-12 h-3 rounded" />
            </div>
            <Skeleton className="w-full h-3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Settings Panel Skeleton
 */
export function SettingsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Section header */}
      <div className="space-y-2">
        <Skeleton className="w-40 h-6 rounded" />
        <Skeleton className="w-64 h-4 rounded" />
      </div>

      {/* Settings items */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="w-32 h-5 rounded" />
              <Skeleton className="w-48 h-3 rounded" />
            </div>
            <Skeleton className="w-12 h-6 rounded-full" />
          </div>
          {i < 3 && <Skeleton className="w-full h-px" />}
        </div>
      ))}
    </div>
  );
}

/**
 * Dashboard Card Skeleton
 */
export function DashboardCardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="w-32 h-6 rounded" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
      <Skeleton className="w-full h-24 rounded-lg" />
      <div className="flex items-center justify-between">
        <Skeleton className="w-20 h-4 rounded" />
        <Skeleton className="w-16 h-4 rounded" />
      </div>
    </div>
  );
}

/**
 * Table Row Skeleton
 */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="w-full h-4 rounded" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Profile Card Skeleton
 */
export function ProfileCardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
      {/* Cover */}
      <Skeleton className="w-full h-32 rounded-lg mb-4" />

      {/* Avatar */}
      <div className="flex items-start gap-4">
        <Skeleton className="w-20 h-20 rounded-full -mt-10" />
        <div className="flex-1 space-y-2 mt-2">
          <Skeleton className="w-40 h-6 rounded" />
          <Skeleton className="w-32 h-4 rounded" />
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mt-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="w-16 h-6 rounded" />
            <Skeleton className="w-20 h-3 rounded" />
          </div>
        ))}
      </div>

      {/* Bio */}
      <div className="space-y-2 mt-6">
        <Skeleton className="w-full h-4 rounded" />
        <Skeleton className="w-4/5 h-4 rounded" />
      </div>
    </div>
  );
}

/**
 * Email List Skeleton
 */
export function EmailListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="w-40 h-4 rounded" />
                <Skeleton className="w-24 h-3 rounded" />
              </div>
            </div>
            <Skeleton className="w-16 h-3 rounded" />
          </div>
          <Skeleton className="w-full h-4 rounded" />
          <Skeleton className="w-3/4 h-3 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Calendar Skeleton
 */
export function CalendarSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="w-32 h-6 rounded" />
        <div className="flex gap-2">
          <Skeleton className="w-8 h-8 rounded" />
          <Skeleton className="w-8 h-8 rounded" />
        </div>
      </div>

      {/* Days header */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 rounded" />
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded" />
        ))}
      </div>
    </div>
  );
}

/**
 * Add shimmer animation to global CSS
 */
const shimmerStyles = `
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('skeleton-styles')) {
  const style = document.createElement('style');
  style.id = 'skeleton-styles';
  style.innerHTML = shimmerStyles;
  document.head.appendChild(style);
}
