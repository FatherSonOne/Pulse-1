import React, { useMemo } from 'react';
import { Task } from '../../services/taskService';
import './WorkloadHeatmap.css';

interface WorkloadHeatmapProps {
  tasks: Task[];
  members: Array<{ id: string; name: string }>;
}

interface DayWorkload {
  date: Date;
  dayName: string;
  taskCount: number;
}

interface MemberWorkload {
  memberId: string;
  memberName: string;
  days: DayWorkload[];
  totalTasks: number;
}

/**
 * Phase 6.6: Workload Heatmap
 *
 * Visual grid showing team member workload across the week.
 * Rows = team members, Columns = days of week
 * Cell color intensity = task count (redder = more overloaded)
 */
export const WorkloadHeatmap: React.FC<WorkloadHeatmapProps> = ({ tasks, members }) => {
  const workloadData = useMemo(() => {
    // Get next 7 days starting from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      days.push(day);
    }

    // Calculate workload for each member for each day
    const memberWorkloads: MemberWorkload[] = members.map(member => {
      const dayWorkloads: DayWorkload[] = days.map(day => {
        // Count tasks due on this day OR in_progress/todo without deadline
        const tasksForDay = tasks.filter(task => {
          if (task.status === 'done' || task.status === 'cancelled') return false;
          if (task.assignee_id !== member.id) return false;

          if (task.deadline) {
            const taskDate = new Date(task.deadline);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() === day.getTime();
          }

          // Tasks without deadlines count towards today only
          return day.getTime() === today.getTime() &&
                 (task.status === 'in_progress' || task.status === 'todo');
        });

        return {
          date: day,
          dayName: day.toLocaleDateString('en-US', { weekday: 'short' }),
          taskCount: tasksForDay.length
        };
      });

      const totalTasks = dayWorkloads.reduce((sum, day) => sum + day.taskCount, 0);

      return {
        memberId: member.id,
        memberName: member.name,
        days: dayWorkloads,
        totalTasks
      };
    });

    // Sort by total workload (most loaded first)
    memberWorkloads.sort((a, b) => b.totalTasks - a.totalTasks);

    return { memberWorkloads, days };
  }, [tasks, members]);

  // Get color intensity based on task count
  const getColorClass = (taskCount: number): string => {
    if (taskCount === 0) return 'workload-none';
    if (taskCount <= 2) return 'workload-low';
    if (taskCount <= 4) return 'workload-medium';
    if (taskCount <= 6) return 'workload-high';
    return 'workload-overload'; // 7+
  };

  // Get workload status text
  const getWorkloadStatus = (totalTasks: number): string => {
    if (totalTasks === 0) return 'No tasks';
    if (totalTasks <= 5) return 'Light';
    if (totalTasks <= 10) return 'Moderate';
    if (totalTasks <= 15) return 'Heavy';
    return 'Overloaded';
  };

  if (members.length === 0) {
    return (
      <div className="workload-heatmap-empty">
        <p>No team members to display</p>
      </div>
    );
  }

  return (
    <div className="workload-heatmap">
      <div className="workload-heatmap-header">
        <h3>Team Workload - Next 7 Days</h3>
        <div className="workload-legend">
          <span className="legend-item">
            <span className="legend-color workload-none"></span>
            <span className="legend-label">None</span>
          </span>
          <span className="legend-item">
            <span className="legend-color workload-low"></span>
            <span className="legend-label">1-2</span>
          </span>
          <span className="legend-item">
            <span className="legend-color workload-medium"></span>
            <span className="legend-label">3-4</span>
          </span>
          <span className="legend-item">
            <span className="legend-color workload-high"></span>
            <span className="legend-label">5-6</span>
          </span>
          <span className="legend-item">
            <span className="legend-color workload-overload"></span>
            <span className="legend-label">7+</span>
          </span>
        </div>
      </div>

      <div className="workload-heatmap-grid">
        {/* Header row with days */}
        <div className="workload-grid-row workload-grid-header">
          <div className="workload-cell workload-cell-member-name">Team Member</div>
          {workloadData.days.map((day, idx) => (
            <div key={idx} className="workload-cell workload-cell-day">
              <div className="day-name">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div className="day-date">{day.getDate()}</div>
            </div>
          ))}
          <div className="workload-cell workload-cell-total">Total</div>
        </div>

        {/* Member rows */}
        {workloadData.memberWorkloads.map(member => (
          <div key={member.memberId} className="workload-grid-row">
            <div className="workload-cell workload-cell-member-name">
              <span className="member-name">{member.memberName}</span>
              <span className={`member-status ${
                member.totalTasks > 15 ? 'status-overload' :
                member.totalTasks > 10 ? 'status-heavy' :
                member.totalTasks > 5 ? 'status-moderate' :
                'status-light'
              }`}>
                {getWorkloadStatus(member.totalTasks)}
              </span>
            </div>
            {member.days.map((day, idx) => (
              <div
                key={idx}
                className={`workload-cell workload-cell-data ${getColorClass(day.taskCount)}`}
                title={`${day.dayName}, ${day.date.toLocaleDateString()}: ${day.taskCount} task${day.taskCount !== 1 ? 's' : ''}`}
              >
                {day.taskCount > 0 ? day.taskCount : ''}
              </div>
            ))}
            <div className="workload-cell workload-cell-total">
              <strong>{member.totalTasks}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="workload-summary">
        <div className="summary-stat">
          <span className="stat-label">Total Tasks:</span>
          <span className="stat-value">
            {workloadData.memberWorkloads.reduce((sum, m) => sum + m.totalTasks, 0)}
          </span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Overloaded Members:</span>
          <span className="stat-value stat-warning">
            {workloadData.memberWorkloads.filter(m => m.totalTasks > 15).length}
          </span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Balanced Members:</span>
          <span className="stat-value stat-success">
            {workloadData.memberWorkloads.filter(m => m.totalTasks <= 10 && m.totalTasks > 0).length}
          </span>
        </div>
      </div>
    </div>
  );
};

export default WorkloadHeatmap;
