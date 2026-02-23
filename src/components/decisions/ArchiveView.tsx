import React, { useState, useMemo } from 'react';
import { DecisionWithVotes } from '../../services/decisionService';
import { Task } from '../../services/taskService';
import { Archive, RotateCcw, Search, Calendar, TrendingUp } from 'lucide-react';
import {
  startOfWeek,
  startOfMonth,
  format,
  isWithinInterval,
  subDays,
  subMonths,
  startOfYear,
  differenceInDays
} from 'date-fns';
import './ArchiveView.css';

interface FilterState {
  statusFilter?: string;
  decisionStatusFilter?: string;
  showOverdueOnly?: boolean;
  sortBy?: 'created' | 'due_date' | 'priority' | 'ai_score';
}

interface ArchiveViewProps {
  decisions: DecisionWithVotes[];
  tasks: Task[];
  filters: FilterState;
  onTaskReopen?: (taskId: string) => void;
  onDecisionReopen?: (decisionId: string) => void;
}

type DateRangeValue = '7d' | '30d' | '90d' | 'year' | 'custom';
type GroupByValue = 'week' | 'month' | 'none';

const DATE_RANGES: Array<{ label: string; value: DateRangeValue }> = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'This year', value: 'year' },
  { label: 'Custom', value: 'custom' }
];

type ArchiveItem = (Task | DecisionWithVotes) & {
  type: 'task' | 'decision';
  completedDate: Date;
};

/**
 * ArchiveView - Complete archive system for completed/cancelled decisions & tasks
 * Phase 4: Full implementation with velocity metrics, filtering, search, and grouping
 */
export const ArchiveView: React.FC<ArchiveViewProps> = ({
  decisions,
  tasks,
  filters,
  onTaskReopen,
  onDecisionReopen
}) => {
  const [dateRange, setDateRange] = useState<DateRangeValue>('30d');
  const [groupBy, setGroupBy] = useState<GroupByValue>('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  // Filter archived items (explicitly archived only)
  const archivedItems = useMemo<ArchiveItem[]>(() => {
    const archivedTasks: ArchiveItem[] = tasks
      .filter(task => task.archived_at != null) // Only show explicitly archived tasks
      .map(task => ({
        ...task,
        type: 'task' as const,
        completedDate: new Date(task.archived_at || task.completed_at || task.updated_at)
      }));

    const archivedDecisions: ArchiveItem[] = decisions
      .filter(decision => decision.archived_at != null) // Only show explicitly archived decisions
      .map(decision => ({
        ...decision,
        type: 'decision' as const,
        completedDate: new Date(decision.archived_at || decision.decided_at || decision.updated_at)
      }));

    return [...archivedTasks, ...archivedDecisions];
  }, [tasks, decisions]);

  // Apply date range filter
  const filteredItems = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate = now;

    switch (dateRange) {
      case '7d':
        startDate = subDays(now, 7);
        break;
      case '30d':
        startDate = subDays(now, 30);
        break;
      case '90d':
        startDate = subDays(now, 90);
        break;
      case 'year':
        startDate = startOfYear(now);
        break;
      case 'custom':
        if (!customStartDate || !customEndDate) return archivedItems;
        startDate = customStartDate;
        endDate = customEndDate;
        break;
      default:
        startDate = subDays(now, 30);
    }

    return archivedItems.filter(item =>
      isWithinInterval(item.completedDate, { start: startDate, end: endDate })
    );
  }, [archivedItems, dateRange, customStartDate, customEndDate]);

  // Apply search filter
  const searchedItems = useMemo(() => {
    if (!searchQuery.trim()) return filteredItems;

    const query = searchQuery.toLowerCase();
    return filteredItems.filter(item => {
      const title = item.title.toLowerCase();
      const description = item.description?.toLowerCase() || '';
      return title.includes(query) || description.includes(query);
    });
  }, [filteredItems, searchQuery]);

  // Group items by time period
  const groupedItems = useMemo<Map<string, ArchiveItem[]>>(() => {
    if (groupBy === 'none') {
      return new Map([['All Items', searchedItems]]);
    }

    const groups = new Map<string, ArchiveItem[]>();

    searchedItems.forEach(item => {
      let key: string;

      if (groupBy === 'week') {
        const weekStart = startOfWeek(item.completedDate);
        key = format(weekStart, 'MMM dd, yyyy');
      } else {
        const monthStart = startOfMonth(item.completedDate);
        key = format(monthStart, 'MMMM yyyy');
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    });

    // Sort groups by date (newest first)
    return new Map([...groups.entries()].sort((a, b) => {
      const dateA = a[1][0].completedDate;
      const dateB = b[1][0].completedDate;
      return dateB.getTime() - dateA.getTime();
    }));
  }, [searchedItems, groupBy]);

  // Calculate velocity metrics
  const metrics = useMemo(() => {
    const archivedTasksList = filteredItems.filter(item => item.type === 'task') as Task[];
    const archivedDecisionsList = filteredItems.filter(item => item.type === 'decision') as DecisionWithVotes[];

    const completedTasks = archivedTasksList.filter(t => t.status === 'done');
    const resolvedDecisions = archivedDecisionsList.filter(d => d.status === 'decided');

    // Calculate average completion time for tasks
    let totalCompletionDays = 0;
    let tasksWithCompletionTime = 0;

    completedTasks.forEach(task => {
      if (task.completed_at && task.extracted_at) {
        const created = new Date(task.extracted_at);
        const completed = new Date(task.completed_at);
        const days = differenceInDays(completed, created);
        if (days >= 0) {
          totalCompletionDays += days;
          tasksWithCompletionTime++;
        }
      }
    });

    const avgCompletionDays = tasksWithCompletionTime > 0
      ? Math.round(totalCompletionDays / tasksWithCompletionTime)
      : 0;

    // Calculate success rate (completed vs cancelled)
    const totalItems = filteredItems.length;
    const successfulItems = completedTasks.length + resolvedDecisions.length;
    const successRate = totalItems > 0
      ? Math.round((successfulItems / totalItems) * 100)
      : 0;

    return {
      completedTasksCount: completedTasks.length,
      avgCompletionDays,
      resolvedDecisionsCount: resolvedDecisions.length,
      successRate
    };
  }, [filteredItems]);

  const handleReopen = (item: ArchiveItem) => {
    if (item.type === 'task' && onTaskReopen) {
      onTaskReopen(item.id);
    } else if (item.type === 'decision' && onDecisionReopen) {
      onDecisionReopen(item.id);
    }
  };

  return (
    <div className="archive-view">
      {/* Header with controls */}
      <div className="archive-header">
        <h2 className="archive-title">
          <Archive size={24} />
          Archive
        </h2>

        <div className="archive-controls">
          {/* Date range selector */}
          <div className="control-group">
            <Calendar size={16} />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeValue)}
              className="archive-select"
              aria-label="Select date range"
            >
              {DATE_RANGES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Custom date range inputs */}
          {dateRange === 'custom' && (
            <div className="custom-date-range">
              <input
                type="date"
                value={customStartDate ? format(customStartDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setCustomStartDate(e.target.value ? new Date(e.target.value) : null)}
                className="archive-date-input"
                aria-label="Start date"
              />
              <span>to</span>
              <input
                type="date"
                value={customEndDate ? format(customEndDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setCustomEndDate(e.target.value ? new Date(e.target.value) : null)}
                className="archive-date-input"
                aria-label="End date"
              />
            </div>
          )}

          {/* Group by selector */}
          <div className="control-group">
            <TrendingUp size={16} />
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupByValue)}
              className="archive-select"
              aria-label="Group by period"
            >
              <option value="week">Group by Week</option>
              <option value="month">Group by Month</option>
              <option value="none">No Grouping</option>
            </select>
          </div>

          {/* Search */}
          <div className="archive-search">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search archived items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="archive-search-input"
              aria-label="Search archive"
            />
          </div>
        </div>
      </div>

      {/* Velocity metrics dashboard */}
      <div className="archive-metrics" role="region" aria-label="Archive metrics">
        <div className="metric-card">
          <div className="metric-icon" style={{ backgroundColor: 'var(--dt-status-bg-done)' }}>
            <TrendingUp size={20} style={{ color: 'var(--dt-status-done)' }} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Tasks Completed</div>
            <div className="metric-value">{metrics.completedTasksCount}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ backgroundColor: 'var(--dt-status-bg-in-progress)' }}>
            <Calendar size={20} style={{ color: 'var(--dt-status-in-progress)' }} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Avg. Completion Time</div>
            <div className="metric-value">
              {metrics.avgCompletionDays} <span className="metric-unit">days</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ backgroundColor: 'var(--dt-status-bg-decided)' }}>
            <Archive size={20} style={{ color: 'var(--dt-status-decided)' }} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Decisions Resolved</div>
            <div className="metric-value">{metrics.resolvedDecisionsCount}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ backgroundColor: 'var(--dt-status-bg-proposed)' }}>
            <TrendingUp size={20} style={{ color: 'var(--dt-status-proposed)' }} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Success Rate</div>
            <div className="metric-value">
              {metrics.successRate}<span className="metric-unit">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Archived items grouped */}
      {searchedItems.length > 0 ? (
        <div className="archive-content" role="main">
          {Array.from(groupedItems.entries()).map(([groupLabel, items]) => (
            <div key={groupLabel} className="archive-group">
              <h3 className="archive-group-label">{groupLabel}</h3>
              <div className="archive-group-items">
                {items.map(item => (
                  <ArchiveItemCard
                    key={`${item.type}-${item.id}`}
                    item={item}
                    onReopen={handleReopen}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="archive-empty" role="status">
          <div className="empty-icon">
            <Archive size={64} strokeWidth={1.5} />
          </div>
          <h3 className="empty-title">No archived items</h3>
          <p className="empty-description">
            {searchQuery
              ? `No items match "${searchQuery}" in the selected date range`
              : 'Completed tasks and decisions will appear here'
            }
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * ArchiveItemCard - Individual archived item card
 */
interface ArchiveItemCardProps {
  item: ArchiveItem;
  onReopen: (item: ArchiveItem) => void;
}

const ArchiveItemCard: React.FC<ArchiveItemCardProps> = ({ item, onReopen }) => {
  const handleReopen = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReopen(item);
  };

  const getStatusColor = () => {
    if (item.type === 'task') {
      return item.status === 'done' ? 'var(--dt-status-done)' : 'var(--dt-status-cancelled)';
    } else {
      return item.status === 'decided' ? 'var(--dt-status-decided)' : 'var(--dt-status-cancelled)';
    }
  };

  const getStatusLabel = () => {
    if (item.type === 'task') {
      return item.status === 'done' ? 'Completed' : 'Cancelled';
    } else {
      return item.status === 'decided' ? 'Decided' : 'Cancelled';
    }
  };

  return (
    <div
      className="archive-item-card dt-card"
      data-type={item.type}
      data-status={item.status}
      role="article"
      aria-label={`${item.type}: ${item.title}`}
    >
      <div className="archive-item-header">
        <span
          className="archive-item-type"
          style={{ backgroundColor: getStatusColor() + '20', color: getStatusColor() }}
        >
          {item.type === 'task' ? 'Task' : 'Decision'}
        </span>
        <span className="archive-item-status" style={{ color: getStatusColor() }}>
          {getStatusLabel()}
        </span>
      </div>

      <h4 className="archive-item-title">{item.title}</h4>

      {item.description && (
        <p className="archive-item-description">
          {item.description.length > 100
            ? `${item.description.substring(0, 100)}...`
            : item.description
          }
        </p>
      )}

      <div className="archive-item-footer">
        <span className="archive-item-date">
          {format(item.completedDate, 'MMM dd, yyyy')}
        </span>

        <button
          onClick={handleReopen}
          className="reopen-btn"
          aria-label={`Reopen ${item.title}`}
        >
          <RotateCcw size={14} />
          Reopen
        </button>
      </div>
    </div>
  );
};
