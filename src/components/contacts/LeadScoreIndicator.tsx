// ============================================
// LEAD SCORE INDICATOR COMPONENT
// Visual indicator for lead grades and scores
// ============================================

import React from 'react';
import { LeadGrade, LeadStatus, getLeadGradeColor } from '../../types/relationshipTypes';

interface LeadScoreIndicatorProps {
  score: number;
  grade: LeadGrade;
  status?: LeadStatus;
  showScore?: boolean;
  showStatus?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LeadScoreIndicator: React.FC<LeadScoreIndicatorProps> = ({
  score,
  grade,
  status,
  showScore = true,
  showStatus = false,
  size = 'md',
  className = '',
}) => {
  const gradeColor = getLeadGradeColor(grade);

  const sizeConfig = {
    sm: {
      badge: 'w-5 h-5 text-[10px]',
      score: 'text-[9px]',
      container: 'gap-1',
    },
    md: {
      badge: 'w-7 h-7 text-xs',
      score: 'text-[10px]',
      container: 'gap-1.5',
    },
    lg: {
      badge: 'w-9 h-9 text-sm',
      score: 'text-xs',
      container: 'gap-2',
    },
  };

  const config = sizeConfig[size];

  return (
    <div className={`flex items-center ${config.container} ${className}`}>
      {/* Grade Badge */}
      <div
        className={`${config.badge} rounded-md flex items-center justify-center font-bold text-white shadow-sm`}
        style={{ backgroundColor: gradeColor }}
        title={`Lead Grade: ${grade}`}
      >
        {grade}
      </div>

      {/* Score */}
      {showScore && (
        <span
          className={`${config.score} font-medium text-zinc-500 dark:text-zinc-400`}
        >
          {score}
        </span>
      )}

      {/* Status */}
      {showStatus && status && (
        <LeadStatusBadge status={status} size={size} />
      )}
    </div>
  );
};

// Status badge component
interface LeadStatusBadgeProps {
  status: LeadStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const LeadStatusBadge: React.FC<LeadStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const statusConfig: Record<LeadStatus, { color: string; bg: string; icon: string; label: string }> = {
    hot: {
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
      icon: 'fa-solid fa-fire',
      label: 'Hot',
    },
    warm: {
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      icon: 'fa-solid fa-temperature-half',
      label: 'Warm',
    },
    warming: {
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      icon: 'fa-solid fa-arrow-trend-up',
      label: 'Warming',
    },
    cold: {
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      icon: 'fa-solid fa-snowflake',
      label: 'Cold',
    },
    customer: {
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      icon: 'fa-solid fa-check-circle',
      label: 'Customer',
    },
    churned: {
      color: 'text-zinc-600 dark:text-zinc-400',
      bg: 'bg-zinc-100 dark:bg-zinc-800',
      icon: 'fa-solid fa-user-slash',
      label: 'Churned',
    },
    unknown: {
      color: 'text-zinc-500 dark:text-zinc-500',
      bg: 'bg-zinc-100 dark:bg-zinc-800',
      icon: 'fa-solid fa-question',
      label: 'Unknown',
    },
  };

  const config = statusConfig[status];

  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5 gap-1',
    md: 'text-[10px] px-2 py-0.5 gap-1',
    lg: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${config.bg} ${config.color}`}
    >
      <i className={`${config.icon} text-[8px]`}></i>
      <span>{config.label}</span>
    </span>
  );
};

// Buying signal indicator
interface BuyingSignalBadgeProps {
  count: number;
  size?: 'sm' | 'md';
}

export const BuyingSignalBadge: React.FC<BuyingSignalBadgeProps> = ({
  count,
  size = 'sm',
}) => {
  if (count === 0) return null;

  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5',
    md: 'text-[10px] px-2 py-0.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]} bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400`}
      title={`${count} buying signal${count > 1 ? 's' : ''} detected`}
    >
      <i className="fa-solid fa-bolt text-[8px]"></i>
      <span>{count}</span>
    </span>
  );
};

// Simple grade badge (just the letter grade)
interface LeadGradeBadgeProps {
  grade: LeadGrade;
  size?: 'sm' | 'md' | 'lg';
}

export const LeadGradeBadge: React.FC<LeadGradeBadgeProps> = ({
  grade,
  size = 'md',
}) => {
  const gradeColor = getLeadGradeColor(grade);

  const sizeConfig = {
    sm: 'w-5 h-5 text-[10px]',
    md: 'w-7 h-7 text-xs',
    lg: 'w-9 h-9 text-sm',
  };

  return (
    <div
      className={`${sizeConfig[size]} rounded-md flex items-center justify-center font-bold text-white shadow-sm`}
      style={{ backgroundColor: gradeColor }}
      title={`Lead Grade: ${grade}`}
    >
      {grade}
    </div>
  );
};

// Full lead score card
interface LeadScoreCardProps {
  score: number;
  grade: LeadGrade;
  status: LeadStatus;
  buyingSignals?: number;
  conversionProbability?: number;
  churnRisk?: number;
}

export const LeadScoreCard: React.FC<LeadScoreCardProps> = ({
  score,
  grade,
  status,
  buyingSignals = 0,
  conversionProbability,
  churnRisk,
}) => {
  const gradeColor = getLeadGradeColor(grade);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-lg"
            style={{ backgroundColor: gradeColor }}
          >
            {grade}
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">
              {score}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Lead Score
            </div>
          </div>
        </div>
        <LeadStatusBadge status={status} size="lg" />
      </div>

      {/* Score bar */}
      <div className="mb-4">
        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${score}%`,
              backgroundColor: gradeColor,
            }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {buyingSignals > 0 && (
          <div className="bg-purple-50 dark:bg-purple-900/10 rounded-lg p-2">
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {buyingSignals}
            </div>
            <div className="text-[10px] text-purple-500 dark:text-purple-500">
              Signals
            </div>
          </div>
        )}
        {conversionProbability !== undefined && (
          <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-2">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {Math.round(conversionProbability * 100)}%
            </div>
            <div className="text-[10px] text-green-500 dark:text-green-500">
              Conversion
            </div>
          </div>
        )}
        {churnRisk !== undefined && (
          <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-2">
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              {Math.round(churnRisk * 100)}%
            </div>
            <div className="text-[10px] text-red-500 dark:text-red-500">
              Churn Risk
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadScoreIndicator;
