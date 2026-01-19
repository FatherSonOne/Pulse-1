// ============================================
// RELATIONSHIP ALERTS FEED COMPONENT
// Display and manage relationship alerts
// ============================================

import React, { useState } from 'react';
import {
  RelationshipAlert,
  AlertType,
  AlertSeverity,
  getSeverityColor,
} from '../../types/relationshipTypes';

interface RelationshipAlertsFeedProps {
  alerts: RelationshipAlert[];
  onDismiss: (alertId: string, reason?: string) => void;
  onSnooze: (alertId: string, until: Date) => void;
  onAction: (alertId: string, actionType: string) => void;
  isLoading?: boolean;
  maxDisplay?: number;
  compact?: boolean;
}

const alertTypeConfig: Record<AlertType, { icon: string; label: string }> = {
  relationship_decay: { icon: 'fa-solid fa-chart-line-down', label: 'Declining' },
  cold_contact: { icon: 'fa-solid fa-snowflake', label: 'Cold' },
  warm_lead: { icon: 'fa-solid fa-fire', label: 'Warm Lead' },
  birthday_reminder: { icon: 'fa-solid fa-cake-candles', label: 'Birthday' },
  anniversary_reminder: { icon: 'fa-solid fa-calendar-heart', label: 'Anniversary' },
  follow_up_due: { icon: 'fa-solid fa-clock', label: 'Follow-up' },
  no_response: { icon: 'fa-solid fa-inbox', label: 'No Response' },
  awaiting_response: { icon: 'fa-solid fa-hourglass-half', label: 'Awaiting' },
  milestone: { icon: 'fa-solid fa-trophy', label: 'Milestone' },
  meeting_prep: { icon: 'fa-solid fa-calendar-check', label: 'Meeting' },
  re_engagement: { icon: 'fa-solid fa-rotate', label: 'Re-engage' },
  vip_activity: { icon: 'fa-solid fa-star', label: 'VIP' },
};

export const RelationshipAlertsFeed: React.FC<RelationshipAlertsFeedProps> = ({
  alerts,
  onDismiss,
  onSnooze,
  onAction,
  isLoading = false,
  maxDisplay = 5,
  compact = false,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const displayAlerts = showAll ? alerts : alerts.slice(0, maxDisplay);
  const hasMore = alerts.length > maxDisplay;

  if (alerts.length === 0 && !isLoading) {
    return (
      <div className="text-center py-8 text-zinc-400">
        <i className="fa-solid fa-bell-slash text-2xl mb-2"></i>
        <p className="text-sm">No alerts at the moment</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayAlerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          isExpanded={expandedId === alert.id}
          onToggleExpand={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
          onDismiss={onDismiss}
          onSnooze={onSnooze}
          onAction={onAction}
          compact={compact}
        />
      ))}

      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
        >
          Show {alerts.length - maxDisplay} more alerts
        </button>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full"></div>
        </div>
      )}
    </div>
  );
};

// Individual alert card
interface AlertCardProps {
  alert: RelationshipAlert;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDismiss: (alertId: string, reason?: string) => void;
  onSnooze: (alertId: string, until: Date) => void;
  onAction: (alertId: string, actionType: string) => void;
  compact?: boolean;
}

const AlertCard: React.FC<AlertCardProps> = ({
  alert,
  isExpanded,
  onToggleExpand,
  onDismiss,
  onSnooze,
  onAction,
  compact = false,
}) => {
  const typeConfig = alertTypeConfig[alert.alertType];
  const severityColor = getSeverityColor(alert.severity);

  const handleSnooze = (hours: number) => {
    const until = new Date();
    until.setHours(until.getHours() + hours);
    onSnooze(alert.id, until);
  };

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition cursor-pointer"
        onClick={onToggleExpand}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${severityColor}15`, color: severityColor }}
        >
          <i className={typeConfig.icon}></i>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">
            {alert.title}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(alert.id);
          }}
          className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
        >
          <i className="fa-solid fa-xmark text-xs"></i>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-zinc-900 rounded-xl border transition overflow-hidden ${
        alert.severity === 'critical'
          ? 'border-red-200 dark:border-red-900/30'
          : alert.severity === 'warning'
          ? 'border-orange-200 dark:border-orange-900/30'
          : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
        onClick={onToggleExpand}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${severityColor}15`, color: severityColor }}
        >
          <i className={`${typeConfig.icon} text-lg`}></i>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                {alert.title}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {typeConfig.label}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  alert.severity === 'critical'
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                    : alert.severity === 'warning'
                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400'
                    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                }`}
              >
                {alert.severity}
              </span>
              <i
                className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-xs text-zinc-400`}
              ></i>
            </div>
          </div>

          {alert.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 line-clamp-2">
              {alert.description}
            </p>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          {/* Suggested action */}
          {alert.suggestedAction && (
            <div className="mb-4">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                Suggested Action
              </div>
              <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
                <i className="fa-solid fa-lightbulb text-purple-500"></i>
                <span className="text-sm text-purple-700 dark:text-purple-300">
                  {alert.suggestedAction}
                </span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {alert.actionType && (
              <button
                onClick={() => onAction(alert.id, alert.actionType!)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition"
              >
                <i className="fa-solid fa-bolt mr-2"></i>
                Take Action
              </button>
            )}

            <div className="relative group">
              <button className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition">
                <i className="fa-solid fa-clock mr-2"></i>
                Snooze
              </button>
              <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block">
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 p-2 space-y-1 min-w-[120px]">
                  {[1, 4, 24, 72].map((hours) => (
                    <button
                      key={hours}
                      onClick={() => handleSnooze(hours)}
                      className="w-full text-left px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition"
                    >
                      {hours < 24 ? `${hours} hour${hours > 1 ? 's' : ''}` : `${hours / 24} day${hours > 24 ? 's' : ''}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => onDismiss(alert.id)}
              className="px-3 py-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-sm font-medium transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Alert count badge
interface AlertCountBadgeProps {
  count: number;
  onClick?: () => void;
}

export const AlertCountBadge: React.FC<AlertCountBadgeProps> = ({
  count,
  onClick,
}) => {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="relative inline-flex items-center justify-center p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
    >
      <i className="fa-solid fa-bell text-zinc-500"></i>
      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
        {count > 9 ? '9+' : count}
      </span>
    </button>
  );
};

export default RelationshipAlertsFeed;
