/**
 * TaskActivityFeed Component
 * Displays a vertical timeline of task activity history
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  RefreshCw,
  User,
  CheckSquare,
  Check,
  AlertCircle,
  X,
  Circle,
  MessageSquare,
  Edit3,
  Calendar,
  Flag,
  FileText,
  Shield,
  Type,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import {
  taskActivityService,
  TaskActivity,
  TaskActivityAction,
} from '../../services/taskActivityService';
import './TaskActivityFeed.css';

interface TaskActivityFeedProps {
  taskId: string;
  limit?: number;
}

interface ActivityGroup {
  label: string;
  activities: TaskActivity[];
}

const TaskActivityFeed: React.FC<TaskActivityFeedProps> = ({
  taskId,
  limit = 20,
}) => {
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActivity();
  }, [taskId, limit]);

  const loadActivity = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await taskActivityService.getActivity(taskId, limit);
      setActivities(data);
    } catch (err) {
      console.error('Error loading activity:', err);
      setError('Failed to load activity history');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get icon component for activity type
   */
  const getActivityIcon = (action: TaskActivityAction): React.ReactNode => {
    const iconProps = { size: 14 };

    const icons: Record<TaskActivityAction, React.ReactNode> = {
      created: <Plus {...iconProps} />,
      status_changed: <RefreshCw {...iconProps} />,
      assigned: <User {...iconProps} />,
      unassigned: <User {...iconProps} />,
      comment: <MessageSquare {...iconProps} />,
      subtask_added: <CheckSquare {...iconProps} />,
      subtask_completed: <Check {...iconProps} />,
      subtask_uncompleted: <Circle {...iconProps} />,
      subtask_deleted: <X {...iconProps} />,
      edited: <Edit3 {...iconProps} />,
      blocked: <AlertCircle {...iconProps} />,
      unblocked: <Shield {...iconProps} />,
      deadline_changed: <Calendar {...iconProps} />,
      priority_changed: <Flag {...iconProps} />,
      deleted: <X {...iconProps} />,
      title_changed: <Type {...iconProps} />,
      description_changed: <FileText {...iconProps} />,
    };

    return icons[action] || <Circle {...iconProps} />;
  };

  /**
   * Get CSS class for activity type
   */
  const getActivityIconClass = (action: TaskActivityAction): string => {
    const classes: Partial<Record<TaskActivityAction, string>> = {
      status_changed: 'status-changed',
      subtask_completed: 'subtask-completed',
      blocked: 'blocked',
      created: 'created',
      deleted: 'deleted',
    };

    return classes[action] || '';
  };

  /**
   * Format activity timestamp
   */
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);

    if (isToday(date)) {
      return formatDistanceToNow(date, { addSuffix: true });
    }

    if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    }

    return format(date, 'MMM d, yyyy \'at\' h:mm a');
  };

  /**
   * Get date group label
   */
  const getDateGroupLabel = (timestamp: string): string => {
    const date = new Date(timestamp);

    if (isToday(date)) {
      return 'Today';
    }

    if (isYesterday(date)) {
      return 'Yesterday';
    }

    return format(date, 'MMMM d, yyyy');
  };

  /**
   * Group activities by date
   */
  const groupActivitiesByDate = (): ActivityGroup[] => {
    const groups: Record<string, TaskActivity[]> = {};

    activities.forEach(activity => {
      const label = getDateGroupLabel(activity.created_at);
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(activity);
    });

    return Object.entries(groups).map(([label, activities]) => ({
      label,
      activities,
    }));
  };

  /**
   * Format activity description
   */
  const formatActivityDescription = (activity: TaskActivity): React.ReactNode => {
    const userId = activity.user_id || 'Unknown user';

    // For now, use user_id as name. In production, fetch from profiles table
    const userName = <span className="activity-user">{userId.slice(0, 8)}</span>;

    const actionDescriptions: Record<TaskActivityAction, React.ReactNode> = {
      created: <>{userName} created this task</>,
      status_changed: (
        <>
          {userName} changed status from{' '}
          <span className="activity-value">{activity.old_value}</span> to{' '}
          <span className="activity-value">{activity.new_value}</span>
        </>
      ),
      assigned: (
        <>
          {userName} assigned to{' '}
          <span className="activity-value">{activity.new_value}</span>
        </>
      ),
      unassigned: (
        <>
          {userName} unassigned from{' '}
          <span className="activity-value">{activity.old_value}</span>
        </>
      ),
      comment: <>{userName} added a comment</>,
      subtask_added: (
        <>
          {userName} added subtask{' '}
          <span className="activity-value">{activity.new_value}</span>
        </>
      ),
      subtask_completed: (
        <>
          {userName} completed subtask{' '}
          <span className="activity-value">{activity.new_value}</span>
        </>
      ),
      subtask_uncompleted: (
        <>
          {userName} uncompleted subtask{' '}
          <span className="activity-value">{activity.new_value}</span>
        </>
      ),
      subtask_deleted: (
        <>
          {userName} deleted subtask{' '}
          <span className="activity-value">{activity.old_value}</span>
        </>
      ),
      edited: <>{userName} edited this task</>,
      blocked: (
        <>
          {userName} blocked:{' '}
          <span className="activity-value">{activity.new_value}</span>
        </>
      ),
      unblocked: <>{userName} unblocked this task</>,
      deadline_changed: (
        <>
          {userName} changed deadline from{' '}
          <span className="activity-value">{activity.old_value || 'none'}</span> to{' '}
          <span className="activity-value">{activity.new_value}</span>
        </>
      ),
      priority_changed: (
        <>
          {userName} changed priority from{' '}
          <span className="activity-value">{activity.old_value}</span> to{' '}
          <span className="activity-value">{activity.new_value}</span>
        </>
      ),
      deleted: <>{userName} deleted this task</>,
      title_changed: (
        <>
          {userName} changed title to{' '}
          <span className="activity-value">{activity.new_value}</span>
        </>
      ),
      description_changed: <>{userName} updated description</>,
    };

    return actionDescriptions[activity.action] || activity.action;
  };

  if (loading) {
    return (
      <div className="activity-feed-loading">
        <Loader2 className="spinner" size={24} />
        <span>Loading activity...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="activity-feed-error">
        <AlertCircle size={20} />
        <span>{error}</span>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="activity-empty">
        <Circle size={32} />
        <p>No activity yet</p>
      </div>
    );
  }

  const groupedActivities = groupActivitiesByDate();

  return (
    <div className="activity-feed">
      <h3 className="activity-feed-title">Activity</h3>

      {groupedActivities.map((group, groupIndex) => (
        <div key={groupIndex} className="activity-date-group">
          <div className="activity-date-label">{group.label}</div>

          <ol className="activity-timeline" role="list">
            {group.activities.map((activity) => (
              <li key={activity.id} className="activity-item">
                <div
                  className={`activity-icon ${getActivityIconClass(activity.action)}`}
                  aria-hidden="true"
                >
                  {getActivityIcon(activity.action)}
                </div>

                <div className="activity-content">
                  {formatActivityDescription(activity)}
                </div>

                <time
                  className="activity-timestamp"
                  dateTime={activity.created_at}
                >
                  {formatTimestamp(activity.created_at)}
                </time>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
};

export default TaskActivityFeed;
