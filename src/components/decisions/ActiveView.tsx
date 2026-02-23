import React, { useMemo } from 'react';
import { AlertCircle, Clock, Eye, Hammer, ListTodo, CheckCircle2, Ban, Vote } from 'lucide-react';
import { Task } from '../../services/taskService';
import { DecisionWithVotes } from '../../services/decisionService';
import { TaskSection } from '../tasks/TaskSection';
import { EnhancedDecisionCard } from './EnhancedDecisionCard';
import './ActiveView.css';

interface ActiveViewProps {
  tasks: Task[];
  decisions: DecisionWithVotes[];
  currentUserId?: string;
  onStatusChange: (taskId: string, status: Task['status']) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
  onEdit?: (task: Task) => void;
  onDecisionAction?: (decision: DecisionWithVotes, action: string) => void;
}

export const ActiveView: React.FC<ActiveViewProps> = ({
  tasks,
  decisions,
  currentUserId,
  onStatusChange,
  onDelete,
  onEdit,
  onDecisionAction
}) => {
  // Group tasks by status and decisions by attention needed
  const { taskSections, decisionSections } = useMemo(() => {
    const now = new Date();

    // === DECISIONS NEEDING ATTENTION ===

    // Decisions in voting state (needs your vote)
    const needsVote = decisions.filter(d => {
      if (d.status !== 'voting') return false;
      // Check if current user has already voted
      const hasVoted = d.votes?.some(v => v.user_id === currentUserId);
      return !hasVoted;
    });

    // === TASKS BY STATUS ===

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

    return {
      decisionSections: { needsVote },
      taskSections: { overdue, blocked, inReview, inProgress, todo, recentlyDone }
    };
  }, [tasks, decisions, currentUserId]);

  const hasAnyItems =
    Object.values(taskSections).some(section => section.length > 0) ||
    Object.values(decisionSections).some(section => section.length > 0);

  if (!hasAnyItems) {
    return (
      <div className="active-view-empty">
        <ListTodo size={64} color="#ccc" />
        <h3>No active items</h3>
        <p>No decisions or tasks needing attention right now</p>
      </div>
    );
  }

  return (
    <div className="active-view">
      {/* Decisions Needing Vote - Highest priority */}
      {decisionSections.needsVote.length > 0 && (
        <div className="active-section">
          <div className="active-section-header">
            <div className="active-section-header-left">
              <Vote size={20} style={{ color: 'var(--dt-status-voting)' }} />
              <h3 className="active-section-title">Needs Your Vote</h3>
              <span className="active-section-badge">{decisionSections.needsVote.length}</span>
            </div>
          </div>
          <div className="active-section-content">
            {decisionSections.needsVote.map(decision => (
              <EnhancedDecisionCard
                key={decision.id}
                decision={decision}
                onGenerateTasks={() => onDecisionAction?.(decision, 'generate-tasks')}
                onVote={(choice) => onDecisionAction?.(decision, `vote-${choice}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Overdue Section - Highest task priority, always visible if has items */}
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
