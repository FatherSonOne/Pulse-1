import React from 'react';

interface SearchResultSkeletonProps {
  count?: number;
}

export const SearchResultSkeleton: React.FC<SearchResultSkeletonProps> = ({ count = 8 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="search-result-skeleton animate-pulse flex items-center gap-3 p-3 rounded-lg"
          style={{ height: '72px' }}
          aria-hidden="true"
        >
          <div className="skeleton-icon w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
          <div className="skeleton-lines flex-1 space-y-2">
            <div className="skeleton-line h-3 rounded bg-gray-200 dark:bg-gray-700 w-2/3" />
            <div className="skeleton-line h-3 rounded bg-gray-200 dark:bg-gray-700 w-1/2" />
          </div>
        </div>
      ))}
    </>
  );
};

export default SearchResultSkeleton;
