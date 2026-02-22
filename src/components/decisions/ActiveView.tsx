import React, { useMemo } from 'react';
import { AlertCircle, Clock, Eye, Hammer, ListTodo, CheckCircle2, Ban } from 'lucide-react';
import { Task } from '../../services/taskService';
import { TaskSection } from '../tasks/TaskSection';
import './ActiveView.css';

interface ActiveViewProps {
  tasks: Task[];
  onStatusChange: (taskId: string, status: Task['status']) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
  onEdit?: (task: Task) => void;
}

export const ActiveView: React.FC<ActiveViewProps> = ({
  tasks,
  onStatusChange,
  onDelete,
  onEdit
}) => {
  // Group tasks by status for Active mode
  const taskSections = useMemo(() => {
    const now = new Date();

    // Overdue tasks (not done/cancelled and past deadline)
    const overdue = tasks.filter(t =>
      t.deadline &&
      new Date(t.deadline) < now &&
      !['done', 'cancelled'].includes(t.status)
    );

    // Blocked tasks
    const blocked = tasks.filter(t => t.status === 'blocked');

    // In Review tasks
    const inReview = tasks.filter(t => t.status === 'in_review');

    // In Progress tasks
    const inProgress = tasks.filter(t => t.status === 'in_progress');

    // To Do tasks
    const todo = tasks.filter(t => t.status === 'todo' || t.status === 'pending');

    // Recently completed (done within last 48 hours, not archived)
    const recentlyDone = tasks.filter(t => {
      if (t.status !== 'done' || t.archived_at) return false;
      const completedAt = new Date(t.completed_at || t.updated_at);
      const hoursSince = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
      return hoursSince < 48;
    });

    return { overdue, blocked, inReview, inProgress, todo, recentlyDone };
  }, [tasks]);

  const hasAnyTasks = Object.values(taskSections).some(section => section.length > 0);

  if (!hasAnyTasks) {
    return (
      <div className="active-view-empty">
        <ListTodo size={64} color="#ccc" />
        <h3>No active tasks</h3>
        <p>Create tasks from the Decision Mission or add them manually</p>
      </div>
    );
  }

  return (
    <div className="active-view">
      {/* Overdue Section - Highest priority, always visible if has items */}
      <TaskSection
        title="Overdue"
        icon={<AlertCircle />}
        tasks={taskSections.overdue}
        accentColor="#ef4444"
        defaultExpanded={true}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
        onEdit={onEdit}
      />

      {/* Blocked Section - Critical attention needed */}
      <TaskSection
        title="Blocked"
        icon={<Ban />}
        tasks={taskSections.blocked}
        accentColor="#dc2626"
        defaultExpanded={true}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
        onEdit={onEdit}
      />

      {/* In Review Section */}
      <TaskSection
        title="In Review"
        icon={<Eye />}
        tasks={taskSections.inReview}
        accentColor="#8b5cf6"
        defaultExpanded={true}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
        onEdit={onEdit}
      />

      {/* In Progress Section */}
      <TaskSection
        title="In Progress"
        icon={<Hammer />}
        tasks={taskSections.inProgress}
        accentColor="#f59e0b"
        defaultExpanded={true}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
        onEdit={onEdit}
      />

      {/* To Do Section */}
      <TaskSection
        title="To Do"
        icon={<ListTodo />}
        tasks={taskSections.todo}
        accentColor="#6b7280"
        defaultExpanded={true}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
        onEdit={onEdit}
      />

      {/* Recently Completed Section - Faded, collapsed by default */}
      <TaskSection
        title="Recently Completed"
        icon={<CheckCircle2 />}
        tasks={taskSections.recentlyDone}
        accentColor="#10b981"
        defaultExpanded={false}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
        onEdit={onEdit}
      />
    </div>
  );
};
