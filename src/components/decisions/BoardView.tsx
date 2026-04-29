import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { DecisionWithVotes } from '../../services/decisionService';
import { Task } from '../../services/taskService';
import { settingsService } from '../../services/settingsService';
import { EnhancedDecisionCard } from './EnhancedDecisionCard';
import { EnhancedTaskCard } from '../tasks/EnhancedTaskCard';
import {
  Lightbulb,
  Vote,
  CheckCircle,
  Circle,
  PlayCircle,
  Eye,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import './BoardView.css';

interface FilterState {
  statusFilter?: string;
  decisionStatusFilter?: string;
  showOverdueOnly?: boolean;
  sortBy?: 'created' | 'due_date' | 'priority' | 'ai_score';
}

interface BoardViewProps {
  decisions: DecisionWithVotes[];
  tasks: Task[];
  filters: FilterState;
  currentUserId: string;
  workspaceId: string;
  linkedTaskCounts?: Record<string, number>;
  onTaskStatusChange?: (taskId: string, newStatus: Task['status']) => void;
  onDecisionStatusChange?: (decisionId: string, newStatus: Decision['status']) => void;
  onDecisionDecompose?: (decision: DecisionWithVotes) => void;
  onVote?: () => void;
  onTaskDelete?: (taskId: string) => Promise<void>;
  onTaskEdit?: (task: Task) => void;
}

type SectionId = 'proposed' | 'voting' | 'decided' | 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done';

interface Section {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  statusColor: string;
  acceptsDecisions: boolean;
  acceptsTasks: boolean;
  wipLimit?: number;
}

type Decision = DecisionWithVotes;

// Section configuration. Order top-to-bottom is the operator's reading order:
// decisions first (Proposed → Voting → Decided), then task statuses left-to-right
// in the original kanban (To Do → In Progress → In Review → Blocked → Done).
const SECTIONS: Section[] = [
  { id: 'proposed',    label: 'Proposed',    icon: Lightbulb,    statusColor: 'var(--dt-status-proposed)',    acceptsDecisions: true,  acceptsTasks: false },
  { id: 'voting',      label: 'Voting',      icon: Vote,         statusColor: 'var(--dt-status-voting)',      acceptsDecisions: true,  acceptsTasks: false },
  { id: 'decided',     label: 'Decided',     icon: CheckCircle,  statusColor: 'var(--dt-status-decided)',     acceptsDecisions: true,  acceptsTasks: false },
  { id: 'todo',        label: 'To Do',       icon: Circle,       statusColor: 'var(--dt-status-todo)',        acceptsDecisions: false, acceptsTasks: true },
  { id: 'in_progress', label: 'In Progress', icon: PlayCircle,   statusColor: 'var(--dt-status-in-progress)', acceptsDecisions: false, acceptsTasks: true,  wipLimit: 5 },
  { id: 'in_review',   label: 'In Review',   icon: Eye,          statusColor: 'var(--dt-status-in-review)',   acceptsDecisions: false, acceptsTasks: true },
  { id: 'blocked',     label: 'Blocked',     icon: AlertCircle,  statusColor: 'var(--dt-status-blocked)',     acceptsDecisions: false, acceptsTasks: true },
  { id: 'done',        label: 'Done',        icon: CheckCircle2, statusColor: 'var(--dt-status-done)',        acceptsDecisions: true,  acceptsTasks: true },
];

// 600ms drag-hover before a collapsed section auto-expands. Matches macOS
// Finder spring-loaded folder timing — long enough to avoid accidental
// expansion when crossing a header on the way to another section.
const DRAG_AUTOEXPAND_MS = 600;

/**
 * BoardView renders the full status set as a stack of collapsible vertical
 * sections. Cards flex-wrap inside each expanded section so a single section
 * with 12 tasks shows 3-4 per row instead of being squeezed into a 280px lane.
 *
 * Persistence: expanded/collapsed state is read from
 * settingsService.get('decisionsHubAccordionBoard') on mount and written back
 * on every toggle. The settingsService syncs to user_settings JSONB so the
 * layout follows the operator across devices.
 *
 * Drag-and-drop: dropping onto an expanded section's body changes status as
 * before. Hovering over a collapsed section header for 600ms auto-expands
 * it so the operator can place the card precisely.
 */
export const BoardView: React.FC<BoardViewProps> = ({
  decisions,
  tasks,
  filters,
  currentUserId,
  workspaceId,
  linkedTaskCounts = {},
  onTaskStatusChange,
  onDecisionStatusChange,
  onDecisionDecompose,
  onVote,
  onTaskDelete,
  onTaskEdit,
}) => {
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'decision' | 'task' } | null>(null);
  const [dragOverSection, setDragOverSection] = useState<SectionId | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const autoExpandTimer = useRef<number | null>(null);

  // Hydrate accordion state from settingsService once on mount. The service
  // wraps localStorage + Capacitor Preferences + Supabase user_settings, so
  // this is the single source of truth.
  useEffect(() => {
    let cancelled = false;
    settingsService.get('decisionsHubAccordionBoard').then((stored) => {
      if (!cancelled && stored && typeof stored === 'object') {
        setExpanded(stored as Record<string, boolean>);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Toggle a section and persist the new map. We write the full map (not just
  // the changed key) because settingsService.set wants the typed value.
  const toggleSection = useCallback((id: SectionId) => {
    setExpanded((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      settingsService.set('decisionsHubAccordionBoard', next).catch((err) => {
        console.error('Failed to persist accordion state:', err);
      });
      return next;
    });
  }, []);

  // Force-expand without toggling. Used by the drag auto-expand timer.
  const forceExpand = useCallback((id: SectionId) => {
    setExpanded((prev) => {
      if (prev[id]) return prev;
      const next = { ...prev, [id]: true };
      settingsService.set('decisionsHubAccordionBoard', next).catch(() => undefined);
      return next;
    });
  }, []);

  const isExpanded = (id: SectionId): boolean => expanded[id] ?? false;

  // Group items into their target sections. Decisions land in Proposed/Voting/
  // Decided; tasks in To Do / In Progress / In Review / Blocked / Done.
  const sectionItems = useMemo(() => {
    const buckets: Record<SectionId, { decisions: DecisionWithVotes[]; tasks: Task[] }> = {
      proposed: { decisions: [], tasks: [] },
      voting: { decisions: [], tasks: [] },
      decided: { decisions: [], tasks: [] },
      todo: { decisions: [], tasks: [] },
      in_progress: { decisions: [], tasks: [] },
      in_review: { decisions: [], tasks: [] },
      blocked: { decisions: [], tasks: [] },
      done: { decisions: [], tasks: [] },
    };

    decisions.forEach((decision) => {
      if (decision.status === 'proposed') {
        buckets.proposed.decisions.push(decision);
      } else if (decision.status === 'voting') {
        buckets.voting.decisions.push(decision);
      } else if (decision.status === 'decided') {
        const hasLinkedTasks = tasks.some((t) => t.metadata?.decision_id === decision.id);
        if (hasLinkedTasks) {
          buckets.done.decisions.push(decision);
        } else {
          buckets.decided.decisions.push(decision);
        }
      }
    });

    tasks.forEach((task) => {
      if (task.status === 'todo' || task.status === 'pending') {
        buckets.todo.tasks.push(task);
      } else if (task.status === 'in_progress') {
        buckets.in_progress.tasks.push(task);
      } else if (task.status === 'in_review') {
        buckets.in_review.tasks.push(task);
      } else if (task.status === 'blocked') {
        buckets.blocked.tasks.push(task);
      } else if (task.status === 'done') {
        buckets.done.tasks.push(task);
      }
    });

    return buckets;
  }, [decisions, tasks]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, id: string, type: 'decision' | 'task') => {
    setDraggedItem({ id, type });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
  };

  const handleDragOver = (e: React.DragEvent, sectionId: SectionId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (dragOverSection !== sectionId) {
      // Clear any pending auto-expand on the previous section.
      if (autoExpandTimer.current) {
        window.clearTimeout(autoExpandTimer.current);
        autoExpandTimer.current = null;
      }
      setDragOverSection(sectionId);

      // Schedule auto-expand if collapsed.
      if (!isExpanded(sectionId)) {
        autoExpandTimer.current = window.setTimeout(() => {
          forceExpand(sectionId);
          autoExpandTimer.current = null;
        }, DRAG_AUTOEXPAND_MS);
      }
    }
  };

  const handleDragLeave = () => {
    if (autoExpandTimer.current) {
      window.clearTimeout(autoExpandTimer.current);
      autoExpandTimer.current = null;
    }
    setDragOverSection(null);
  };

  const handleDrop = async (e: React.DragEvent, sectionId: SectionId) => {
    e.preventDefault();
    setDragOverSection(null);
    if (autoExpandTimer.current) {
      window.clearTimeout(autoExpandTimer.current);
      autoExpandTimer.current = null;
    }

    if (!draggedItem) return;

    const section = SECTIONS.find((s) => s.id === sectionId);
    if (!section) return;

    if (draggedItem.type === 'decision') {
      if (!section.acceptsDecisions) {
        toast.error(`Decisions can't enter ${section.label}. Try Decided.`, {
          id: 'invalid-drop',
          duration: 3000,
        });
        return;
      }

      const decision = decisions.find((d) => d.id === draggedItem.id);
      if (!decision) return;

      let newStatus: Decision['status'];
      if (sectionId === 'proposed') newStatus = 'proposed';
      else if (sectionId === 'voting') newStatus = 'voting';
      else if (sectionId === 'decided' || sectionId === 'done') newStatus = 'decided';
      else return;

      if (sectionId === 'decided' && onDecisionDecompose) {
        onDecisionDecompose(decision);
      }

      if (onDecisionStatusChange && decision.status !== newStatus) {
        onDecisionStatusChange(draggedItem.id, newStatus);
      }
    } else if (draggedItem.type === 'task') {
      if (!section.acceptsTasks) {
        toast.error(`Tasks can't enter ${section.label}. Try To Do.`, {
          id: 'invalid-drop',
          duration: 3000,
        });
        return;
      }

      const task = tasks.find((t) => t.id === draggedItem.id);
      if (!task) return;

      let newStatus: Task['status'];
      if (sectionId === 'todo') newStatus = 'todo';
      else if (sectionId === 'in_progress') newStatus = 'in_progress';
      else if (sectionId === 'in_review') newStatus = 'in_review';
      else if (sectionId === 'blocked') newStatus = 'blocked';
      else if (sectionId === 'done') newStatus = 'done';
      else return;

      if (onTaskStatusChange && task.status !== newStatus) {
        onTaskStatusChange(draggedItem.id, newStatus);
      }
    }

    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverSection(null);
    if (autoExpandTimer.current) {
      window.clearTimeout(autoExpandTimer.current);
      autoExpandTimer.current = null;
    }
  };

  const renderSection = (section: Section) => {
    const { decisions: secDecisions, tasks: secTasks } = sectionItems[section.id];
    const totalCount = secDecisions.length + secTasks.length;
    const isOverWipLimit = section.wipLimit !== undefined && totalCount > section.wipLimit;
    const open = isExpanded(section.id);
    const isDragOver = dragOverSection === section.id;

    return (
      <section
        key={section.id}
        className={`board-section${open ? ' expanded' : ''}${isDragOver ? ' drag-over' : ''}`}
        data-status={section.id}
        onDragOver={(e) => handleDragOver(e, section.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, section.id)}
      >
        <button
          type="button"
          className="board-section-header"
          onClick={() => toggleSection(section.id)}
          aria-expanded={open}
          aria-controls={`section-body-${section.id}`}
        >
          <ChevronDown
            size={14}
            className="board-section-chevron"
            aria-hidden="true"
          />
          <span
            className="board-section-dot"
            style={{ background: section.statusColor }}
            aria-hidden="true"
          />
          <section.icon
            size={14}
            className="board-section-icon"
            style={{ color: section.statusColor }}
            aria-hidden="true"
          />
          <span className="board-section-title dt-label">{section.label}</span>
          <span className="board-section-count">{totalCount}</span>
          {isOverWipLimit && (
            <span
              className="board-section-wip dt-label"
              title={`WIP limit: ${section.wipLimit}`}
            >
              WIP {totalCount}/{section.wipLimit}
            </span>
          )}
        </button>

        <div
          id={`section-body-${section.id}`}
          className="board-section-body"
          role="region"
          aria-label={`${section.label} items`}
        >
          <div className="board-section-cards">
            {totalCount === 0 ? (
              <div className="board-section-drop-hint" aria-hidden={!isDragOver}>
                <span className="dt-label">
                  {isDragOver ? `Drop to set ${section.label}` : 'Nothing here yet.'}
                </span>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {secDecisions.map((decision) => (
                  <motion.div
                    key={`decision-${decision.id}`}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className={`board-card${draggedItem?.id === decision.id ? ' dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, decision.id, 'decision')}
                    onDragEnd={handleDragEnd}
                  >
                    <EnhancedDecisionCard
                      decision={decision}
                      currentUserId={currentUserId}
                      workspaceId={workspaceId}
                      linkedTaskCount={linkedTaskCounts[decision.id] || 0}
                      onVote={onVote}
                      onGenerateTasks={onDecisionDecompose ? () => onDecisionDecompose(decision) : undefined}
                    />
                  </motion.div>
                ))}

                {secTasks.map((task) => (
                  <motion.div
                    key={`task-${task.id}`}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className={`board-card${draggedItem?.id === task.id ? ' dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, task.id, 'task')}
                    onDragEnd={handleDragEnd}
                  >
                    <EnhancedTaskCard
                      task={task}
                      onStatusChange={async (taskId, newStatus) => {
                        if (onTaskStatusChange) {
                          onTaskStatusChange(taskId, newStatus);
                        }
                      }}
                      onDelete={onTaskDelete}
                      onEdit={onTaskEdit}
                      allTasks={tasks}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="board-view">
      {SECTIONS.map((section) => renderSection(section))}
    </div>
  );
};
