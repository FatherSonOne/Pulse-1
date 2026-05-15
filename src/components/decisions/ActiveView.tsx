import React, { useMemo } from 'react';
import { AlertCircle, Clock, Eye, Hammer, ListTodo, CheckCircle2, Ban, Vote, Users, Rocket, Wallet, Sparkles } from 'lucide-react';
import { Task } from '../../services/taskService';
import { DecisionWithVotes } from '../../services/decisionService';
import { TaskSection } from '../tasks/TaskSection';
import { EnhancedDecisionCard } from './EnhancedDecisionCard';
import './ActiveView.css';

interface ActiveViewProps {
  tasks: Task[];
  decisions: DecisionWithVotes[];
  currentUserId?: string;
  workspaceId?: string;
  linkedTaskCounts?: Record<string, number>;
  selectedTaskIds?: Set<string>;
  onToggleTaskSelect?: (taskId: string) => void;
  onStatusChange: (taskId: string, status: Task['status']) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
  onEdit?: (task: Task) => void;
  onDecisionAction?: (decision: DecisionWithVotes, action: string) => void;
  /** Opens the DecisionTemplates browser. Wired from DecisionTaskHub. */
  onOpenTemplates?: () => void;
  /** Opens the Decision Mission AI flow with no preloaded decision. */
  onOpenAIMission?: () => void;
}

// Three first-run quick-launches for the "You're caught up" panel.
// These mirror the canonical decision_templates Supabase rows (System category)
// but render inline as low-commitment starters, not as full template cards.
const QUICK_LAUNCH_TEMPLATES: Array<{
  icon: typeof Users;
  label: string;
  hint: string;
}> = [
  { icon: Users, label: 'Hire someone', hint: 'Recruitment workflow' },
  { icon: Rocket, label: 'Build a feature', hint: 'Product feature decision' },
  { icon: Wallet, label: 'Allocate budget', hint: 'Resource planning' },
];

export const ActiveView: React.FC<ActiveViewProps> = ({
  tasks,
  decisions,
  currentUserId,
  workspaceId = '',
  linkedTaskCounts = {},
  selectedTaskIds,
  onToggleTaskSelect,
  onStatusChange,
  onDelete,
  onEdit,
  onDecisionAction,
  onOpenTemplates,
  onOpenAIMission,
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

    // Bucket priority is strict so every task lands in exactly one section:
    //   BLOCKED > OVERDUE > IN_REVIEW > IN_PROGRESS > TODO > DONE
    // Cards in higher-priority buckets still surface their secondary state
    // (e.g. an OVERDUE deadline stamp inside a BLOCKED card) — only the
    // *section placement* is exclusive.
    const blocked = tasks.filter(t => t.status === 'blocked');

    const overdue = tasks.filter(t =>
      t.deadline &&
      new Date(t.deadline) < now &&
      !['done', 'cancelled', 'blocked'].includes(t.status)
    );
    const overdueIds = new Set(overdue.map(t => t.id));

    // The remaining status buckets exclude anything already promoted to
    // OVERDUE so a single task never renders twice.
    const inReview = tasks.filter(t => t.status === 'in_review' && !overdueIds.has(t.id));
    const inProgress = tasks.filter(t => t.status === 'in_progress' && !overdueIds.has(t.id));
    const todo = tasks.filter(t =>
      (t.status === 'todo' || t.status === 'pending') && !overdueIds.has(t.id)
    );

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
      <div className="active-view-empty" role="status" aria-live="polite">
        <span className="active-empty-eyebrow dt-label">YOU'RE CAUGHT UP</span>
        <h3 className="active-empty-headline">Nothing needs you right now.</h3>
        <p className="active-empty-sub">
          Plan ahead with a template, or start something with AI.
        </p>

        {onOpenTemplates && (
          <div className="active-empty-templates" role="group" aria-label="Quick start templates">
            {QUICK_LAUNCH_TEMPLATES.map(({ icon: Icon, label, hint }) => (
              <button
                key={label}
                type="button"
                className="active-empty-template"
                onClick={onOpenTemplates}
                title={hint}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="active-empty-template-label">{label}</span>
                <span className="active-empty-template-hint">{hint}</span>
              </button>
            ))}
          </div>
        )}

        {onOpenAIMission && (
          <>
            <div className="active-empty-divider" aria-hidden="true">
              <span className="dt-label">OR</span>
            </div>

            <button
              type="button"
              className="active-empty-ai-cta"
              onClick={onOpenAIMission}
            >
              <Sparkles size={16} aria-hidden="true" />
              <span>Open with AI</span>
            </button>
          </>
        )}
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
                currentUserId={currentUserId || ''}
                workspaceId={workspaceId}
                linkedTaskCount={linkedTaskCounts[decision.id] || 0}
                onGenerateTasks={() => onDecisionAction?.(decision, 'generate-tasks')}
                onVote={() => onDecisionAction?.(decision, 'vote')}
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
        selectedTaskIds={selectedTaskIds}
        onToggleTaskSelect={onToggleTaskSelect}
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
        selectedTaskIds={selectedTaskIds}
        onToggleTaskSelect={onToggleTaskSelect}
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
        selectedTaskIds={selectedTaskIds}
        onToggleTaskSelect={onToggleTaskSelect}
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
        selectedTaskIds={selectedTaskIds}
        onToggleTaskSelect={onToggleTaskSelect}
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
        selectedTaskIds={selectedTaskIds}
        onToggleTaskSelect={onToggleTaskSelect}
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
        selectedTaskIds={selectedTaskIds}
        onToggleTaskSelect={onToggleTaskSelect}
      />
    </div>
  );
};
