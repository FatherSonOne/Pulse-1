import React from 'react';

interface FeatureSkeletonProps {
  type?: 'panel' | 'inline' | 'modal' | 'list' | 'card';
  className?: string;
}

export const FeatureSkeleton: React.FC<FeatureSkeletonProps> = ({
  type = 'inline',
  className = ''
}) => {
  const baseClasses = "animate-pulse bg-zinc-800/50 rounded-lg";

  if (type === 'panel') {
    return (
      <div className={`space-y-3 p-4 ${className}`}>
        <div className={`${baseClasses} h-6 w-3/4`} />
        <div className={`${baseClasses} h-4 w-full`} />
        <div className={`${baseClasses} h-4 w-5/6`} />
        <div className={`${baseClasses} h-4 w-4/5`} />
      </div>
    );
  }

  if (type === 'modal') {
    return (
      <div className={`space-y-4 p-6 ${className}`}>
        <div className={`${baseClasses} h-8 w-1/2`} />
        <div className={`${baseClasses} h-32 w-full`} />
        <div className="flex space-x-3 mt-4">
          <div className={`${baseClasses} h-10 w-24`} />
          <div className={`${baseClasses} h-10 w-24`} />
        </div>
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className={`space-y-2 ${className}`}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${baseClasses} h-12 w-full`} />
        ))}
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className={`${baseClasses} h-48 w-full ${className}`} />
    );
  }

  // Default: inline
  return <div className={`${baseClasses} h-12 w-full ${className}`} />;
};

export default FeatureSkeleton;
