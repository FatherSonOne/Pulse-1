import React from 'react';
import './SkeletonDecisionCard.css';

interface SkeletonDecisionCardProps {
  className?: string;
}

export const SkeletonDecisionCard: React.FC<SkeletonDecisionCardProps> = ({ className = '' }) => {
  return (
    <div className={`skeleton-decision-card ${className}`}>
      <div className="skeleton-header">
        <div className="skeleton-title-row">
          <div className="skeleton-title shimmer"></div>
          <div className="skeleton-badges">
            <div className="skeleton-badge shimmer"></div>
            <div className="skeleton-badge shimmer"></div>
          </div>
        </div>
        <div className="skeleton-description shimmer"></div>
        <div className="skeleton-description-short shimmer"></div>
        <div className="skeleton-meta">
          <div className="skeleton-meta-item shimmer"></div>
          <div className="skeleton-meta-item shimmer"></div>
        </div>
      </div>

      <div className="skeleton-votes">
        <div className="skeleton-vote-bar">
          <div className="skeleton-vote-label shimmer"></div>
          <div className="skeleton-vote-progress shimmer"></div>
        </div>
        <div className="skeleton-vote-bar">
          <div className="skeleton-vote-label shimmer"></div>
          <div className="skeleton-vote-progress shimmer"></div>
        </div>
      </div>

      <div className="skeleton-actions">
        <div className="skeleton-action-button shimmer"></div>
        <div className="skeleton-action-button shimmer"></div>
      </div>
    </div>
  );
};

export default React.memo(SkeletonDecisionCard);
