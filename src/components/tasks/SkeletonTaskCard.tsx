import React from 'react';
import './SkeletonTaskCard.css';

interface SkeletonTaskCardProps {
  className?: string;
}

export const SkeletonTaskCard: React.FC<SkeletonTaskCardProps> = ({ className = '' }) => {
  return (
    <div className={`skeleton-task-card ${className}`}>
      <div className="skeleton-task-checkbox shimmer"></div>

      <div className="skeleton-task-content">
        <div className="skeleton-task-header">
          <div className="skeleton-task-title shimmer"></div>
          <div className="skeleton-task-badges">
            <div className="skeleton-task-badge shimmer"></div>
            <div className="skeleton-task-badge shimmer"></div>
          </div>
        </div>

        <div className="skeleton-task-description shimmer"></div>
        <div className="skeleton-task-description-short shimmer"></div>

        <div className="skeleton-task-meta">
          <div className="skeleton-task-meta-item shimmer"></div>
          <div className="skeleton-task-meta-item shimmer"></div>
        </div>
      </div>

      <div className="skeleton-task-actions">
        <div className="skeleton-task-action-button shimmer"></div>
        <div className="skeleton-task-action-button shimmer"></div>
      </div>
    </div>
  );
};

export default React.memo(SkeletonTaskCard);
