/**
 * Activity Feed Component
 * Shows recent activity for the user
 */

import React, { useState, useEffect } from 'react';
import {
  ActivityFeedItem,
  ACTIVITY_ACTIONS,
} from '../../../types/collaboration';
import {
  getActivityFeed,
  getUnreadActivityCount,
  markActivitiesAsRead,
  clearActivityFeed,
} from '../../../services/collaborationService';

interface ActivityFeedProps {
  userId: string;
  projectId?: string;
  onDocumentClick?: (docId: string) => void;
  onProjectClick?: (projectId: string) => void;
  compact?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  userId,
  projectId,
  onDocumentClick,
  onProjectClick,
  compact = false,
}) => {
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    loadActivities();
  }, [userId, projectId, showUnreadOnly]);

  const loadActivities = async () => {
    try {
      const data = await getActivityFeed(userId, {
        projectId,
        unreadOnly: showUnreadOnly,
        limit: compact ? 5 : 50,
      });
      setActivities(data);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markActivitiesAsRead(userId);
      setActivities(activities.map(a => ({ ...a, is_read: true })));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all activity? This cannot be undone.')) return;
    try {
      await clearActivityFeed(userId);
      setActivities([]);
    } catch (error) {
      console.error('Error clearing activity:', error);
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getActivityMessage = (activity: ActivityFeedItem): string => {
    const config = ACTIVITY_ACTIONS[activity.action];
    const actor = activity.details?.actor_name || 'Someone';
    const target = activity.details?.target_name || activity.document?.title || activity.project?.name || '';

    switch (activity.action) {
      case 'doc_uploaded':
        return `${actor} uploaded "${target}"`;
      case 'doc_shared':
        return `${actor} shared "${target}" with you`;
      case 'doc_commented':
        return `${actor} commented on "${target}"`;
      case 'project_shared':
        return `${actor} shared project "${target}" with you`;
      case 'annotation_added':
        return `${actor} added an annotation to "${target}"`;
      case 'highlight_added':
        return `${actor} highlighted text in "${target}"`;
      case 'audio_generated':
        return `Audio overview generated for "${target}"`;
      case 'study_guide_created':
        return `Study guide created for "${target}"`;
      default:
        return `${config?.pastTense || activity.action} ${target}`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <i className="fa fa-spinner fa-spin text-gray-400"></i>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {activities.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">No recent activity</p>
        ) : (
          activities.map((activity) => {
            const config = ACTIVITY_ACTIONS[activity.action];
            return (
              <div
                key={activity.id}
                className={`flex items-start gap-2 p-2 rounded-lg transition-colors cursor-pointer ${
                  activity.is_read
                    ? 'bg-gray-50/50 dark:bg-gray-800/50'
                    : 'bg-rose-50/50 dark:bg-rose-900/10 border-l-2 border-rose-500'
                }`}
                onClick={() => {
                  if (activity.doc_id && onDocumentClick) {
                    onDocumentClick(activity.doc_id);
                  } else if (activity.project_id && onProjectClick) {
                    onProjectClick(activity.project_id);
                  }
                }}
              >
                <i className={`fa ${config?.icon || 'fa-bell'} ${config?.color || 'text-gray-400'} text-xs mt-0.5`}></i>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                    {getActivityMessage(activity)}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {formatTimeAgo(activity.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <i className="fa fa-bell text-rose-500"></i>
            Activity
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                showUnreadOnly
                  ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              }`}
            >
              {showUnreadOnly ? 'Unread only' : 'All'}
            </button>
            {activities.some(a => !a.is_read) && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Mark all as read"
              >
                <i className="fa fa-check-double"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="max-h-96 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="p-6 text-center">
            <i className="fa fa-inbox text-3xl text-gray-300 dark:text-gray-600 mb-2"></i>
            <p className="text-sm text-gray-400">
              {showUnreadOnly ? 'No unread activity' : 'No activity yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {activities.map((activity) => {
              const config = ACTIVITY_ACTIONS[activity.action];

              return (
                <div
                  key={activity.id}
                  className={`flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer ${
                    !activity.is_read ? 'bg-rose-50/30 dark:bg-rose-900/5' : ''
                  }`}
                  onClick={() => {
                    if (activity.doc_id && onDocumentClick) {
                      onDocumentClick(activity.doc_id);
                    } else if (activity.project_id && onProjectClick) {
                      onProjectClick(activity.project_id);
                    }
                    // Mark as read
                    if (!activity.is_read) {
                      markActivitiesAsRead(userId, [activity.id]).catch(console.error);
                      setActivities(activities.map(a =>
                        a.id === activity.id ? { ...a, is_read: true } : a
                      ));
                    }
                  }}
                >
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config?.color || 'text-gray-400'} bg-gray-100 dark:bg-gray-700`}>
                    <i className={`fa ${config?.icon || 'fa-bell'} text-sm`}></i>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {getActivityMessage(activity)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">
                        {formatTimeAgo(activity.created_at)}
                      </span>
                      {!activity.is_read && (
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {activities.length > 0 && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={handleClearAll}
            className="w-full text-xs text-gray-400 hover:text-red-500 py-1"
          >
            Clear all activity
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Activity Badge Component
 * Shows unread count as a badge
 */
interface ActivityBadgeProps {
  userId: string;
  onClick?: () => void;
}

export const ActivityBadge: React.FC<ActivityBadgeProps> = ({ userId, onClick }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    loadCount();
    // Refresh count every 30 seconds
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const loadCount = async () => {
    const unreadCount = await getUnreadActivityCount(userId);
    setCount(unreadCount);
  };

  return (
    <button
      onClick={onClick}
      className="relative p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
    >
      <i className="fa fa-bell"></i>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
};

export default ActivityFeed;
