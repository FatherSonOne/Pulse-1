// ============================================
// RELATIONSHIP HEALTH CARD COMPONENT
// Visual display of relationship score and trend
// ============================================

import React from 'react';
import {
  RelationshipProfile,
  RelationshipTrend,
  getRelationshipHealthColor,
  getTrendIcon,
  getTrendColor,
  formatLastInteraction,
} from '../../types/relationshipTypes';

interface RelationshipHealthCardProps {
  profile: RelationshipProfile;
  compact?: boolean;
  showTrend?: boolean;
  showLastInteraction?: boolean;
  onClick?: () => void;
}

export const RelationshipHealthCard: React.FC<RelationshipHealthCardProps> = ({
  profile,
  compact = false,
  showTrend = true,
  showLastInteraction = true,
  onClick,
}) => {
  const score = profile.relationshipScore;
  const trend = profile.relationshipTrend;
  const healthColor = getRelationshipHealthColor(score);
  const trendColor = getTrendColor(trend);
  const trendIcon = getTrendIcon(trend);

  // Get health label
  const healthLabel = score >= 80 ? 'Excellent' :
                      score >= 60 ? 'Good' :
                      score >= 40 ? 'Fair' :
                      score >= 20 ? 'Needs Attention' : 'At Risk';

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
        onClick={onClick}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: healthColor }}
        >
          {score}
        </div>
        {showTrend && (
          <i
            className={`${trendIcon} text-xs`}
            style={{ color: trendColor }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800/50 rounded-xl p-4 ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
      onClick={onClick}
    >
      {/* Score Display */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-lg"
            style={{ backgroundColor: healthColor }}
          >
            {score}
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-white">
              {healthLabel}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Relationship Health
            </div>
          </div>
        </div>

        {showTrend && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${trendColor}15`,
              color: trendColor,
            }}
          >
            <i className={trendIcon}></i>
            <span className="capitalize">{trend}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${score}%`,
              backgroundColor: healthColor,
            }}
          />
        </div>
      </div>

      {/* Last Interaction */}
      {showLastInteraction && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">
            Last interaction
          </span>
          <span className="text-zinc-700 dark:text-zinc-300 font-medium">
            {formatLastInteraction(profile.lastInteractionAt)}
          </span>
        </div>
      )}

      {/* Communication Frequency */}
      {profile.communicationFrequency && profile.communicationFrequency !== 'unknown' && (
        <div className="flex items-center justify-between text-xs mt-2">
          <span className="text-zinc-500 dark:text-zinc-400">
            Communication
          </span>
          <span className="text-zinc-700 dark:text-zinc-300 font-medium capitalize">
            {profile.communicationFrequency}
          </span>
        </div>
      )}
    </div>
  );
};

// Mini version for list items
interface RelationshipScoreBadgeProps {
  score: number;
  trend?: RelationshipTrend;
  size?: 'sm' | 'md' | 'lg';
}

export const RelationshipScoreBadge: React.FC<RelationshipScoreBadgeProps> = ({
  score,
  trend,
  size = 'sm',
}) => {
  const healthColor = getRelationshipHealthColor(score);
  const trendColor = trend ? getTrendColor(trend) : undefined;

  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  return (
    <div className="relative inline-flex">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white shadow-sm`}
        style={{ backgroundColor: healthColor }}
        title={`Relationship score: ${score}%`}
      >
        {score}
      </div>
      {trend && trend !== 'stable' && (
        <div
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center bg-white dark:bg-zinc-900 shadow-sm"
        >
          <i
            className={`${getTrendIcon(trend)} text-[8px]`}
            style={{ color: trendColor }}
          />
        </div>
      )}
    </div>
  );
};

export default RelationshipHealthCard;
