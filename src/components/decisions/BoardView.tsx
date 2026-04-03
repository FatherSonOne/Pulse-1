import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DecisionWithVotes } from '../../services/decisionService';
import { Task } from '../../services/taskService';
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
  type LucideIcon
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

type ColumnId = 'proposed' | 'voting' | 'decided' | 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done';

interface Column {
  id: ColumnId;
  label: string;
  icon: LucideIcon;
  statusColor: string;
  bgColor: string;
  acceptsDecisions: boolean;
  acceptsTasks: boolean;
  wipLimit?: number;
}

type Decision = DecisionWithVotes;

// Column configuration
const COLUMNS: Column[] = [
  {
    id: 'proposed',
    label: 'Proposed',
    icon: Lightbulb,
    statusColor: '#8b5cf6',
    bgColor: 'var(--dt-status-bg-proposed)',
    acceptsDecisions: true,
    acceptsTasks: false
  },
  {
    id: 'voting',
    label: 'Voting',
    icon: Vote,
    statusColor: '#f59e0b',
    bgColor: 'var(--dt-status-bg-voting)',
    acceptsDecisions: true,
    acceptsTasks: false
  },
  {
    id: 'decided',
    label: 'Decided',
    icon: CheckCircle,
    statusColor: '#10b981',
    bgColor: 'var(--dt-status-bg-decided)',
    acceptsDecisions: true,
    acceptsTasks: false
  },
  {
    id: 'todo',
    label: 'To Do',
    icon: Circle,
    statusColor: '#6b7280',
    bgColor: 'var(--dt-status-bg-todo)',
    acceptsDecisions: false,
    acceptsTasks: true
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    icon: PlayCircle,
    statusColor: '#3b82f6',
    bgColor: 'var(--dt-status-bg-in-progress)',
    acceptsDecisions: false,
    acceptsTasks: true,
    wipLimit: 5
  },
  {
    id: 'in_review',
    label: 'In Review',
    icon: Eye,
    statusColor: '#a855f7',
    bgColor: 'var(--dt-status-bg-in-review)',
    acceptsDecisions: false,
    acceptsTasks: true
  },
  {
    id: 'blocked',
    label: 'Blocked',
    icon: AlertCircle,
    statusColor: '#f97316',
    bgColor: 'var(--dt-status-bg-blocked)',
    acceptsDecisions: false,
    acceptsTasks: true
  },
  {
    id: 'done',
    label: 'Done',
    icon: CheckCircle2,
    statusColor: '#22c55e',
    bgColor: 'var(--dt-status-bg-done)',
    acceptsDecisions: true,
    acceptsTasks: true
  }
];

/**
 * BoardView - 8-column Kanban board for decisions and tasks
 * Phase 2: Full implementation with drag-and-drop, framer-motion animations
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
  onTaskEdit
}) => {
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'decision' | 'task' } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);

  // Filter and organize items into columns
  const columnItems = useMemo(() => {
    const columns: Record<ColumnId, { decisions: DecisionWithVotes[]; tasks: Task[] }> = {
      proposed: { decisions: [], tasks: [] },
      voting: { decisions: [], tasks: [] },
      decided: { decisions: [], tasks: [] },
      todo: { decisions: [], tasks: [] },
      in_progress: { decisions: [], tasks: [] },
      in_review: { decisions: [], tasks: [] },
      blocked: { decisions: [], tasks: [] },
      done: { decisions: [], tasks: [] }
    };

    // Place decisions in columns
    decisions.forEach((decision) => {
      if (decision.status === 'proposed') {
        columns.proposed.decisions.push(decision);
      } else if (decision.status === 'voting') {
        columns.voting.decisions.push(decision);
      } else if (decision.status === 'decided') {
        // Check if decision has linked tasks
        const hasLinkedTasks = tasks.some(t => t.metadata?.decision_id === decision.id);
        if (hasLinkedTasks) {
          columns.done.decisions.push(decision);
        } else {
          columns.decided.decisions.push(decision);
        }
      }
    });

    // Place tasks in columns
    tasks.forEach((task) => {
      if (task.status === 'todo' || task.status === 'pending') {
        columns.todo.tasks.push(task);
      } else if (task.status === 'in_progress') {
        columns.in_progress.tasks.push(task);
      } else if (task.status === 'in_review') {
        columns.in_review.tasks.push(task);
      } else if (task.status === 'blocked') {
        columns.blocked.tasks.push(task);
      } else if (task.status === 'done') {
        columns.done.tasks.push(task);
      }
    });

    return columns;
  }, [decisions, tasks]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, id: string, type: 'decision' | 'task') => {
    setDraggedItem({ id, type });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
  };

  const handleDragOver = (e: React.DragEvent, columnId: ColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, columnId: ColumnId) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedItem) return;

    const column = COLUMNS.find(c => c.id === columnId);
    if (!column) return;

    // Handle decision drop
    if (draggedItem.type === 'decision') {
      if (!column.acceptsDecisions) {
        alert('This column does not accept decisions');
        return;
      }

      const decision = decisions.find(d => d.id === draggedItem.id);
      if (!decision) return;

      // Map column to decision status
      let newStatus: Decision['status'];
      if (columnId === 'proposed') newStatus = 'proposed';
      else if (columnId === 'voting') newStatus = 'voting';
      else if (columnId === 'decided' || columnId === 'done') newStatus = 'decided';
      else return;

      // Special: If dropping to "Decided", trigger decompose
      if (columnId === 'decided' && onDecisionDecompose) {
        onDecisionDecompose(decision);
      }

      if (onDecisionStatusChange && decision.status !== newStatus) {
        onDecisionStatusChange(draggedItem.id, newStatus);
      }
    }
    // Handle task drop
    else if (draggedItem.type === 'task') {
      if (!column.acceptsTasks) {
        alert('This column does not accept tasks');
        return;
      }

      const task = tasks.find(t => t.id === draggedItem.id);
      if (!task) return;

      // Map column to task status
      let newStatus: Task['status'];
      if (columnId === 'todo') newStatus = 'todo';
      else if (columnId === 'in_progress') newStatus = 'in_progress';
      else if (columnId === 'in_review') newStatus = 'in_review';
      else if (columnId === 'blocked') newStatus = 'blocked';
      else if (columnId === 'done') newStatus = 'done';
      else return;

      if (onTaskStatusChange && task.status !== newStatus) {
        onTaskStatusChange(draggedItem.id, newStatus);
      }
    }

    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverColumn(null);
  };

  // Render a single column
  const renderColumn = (column: Column) => {
    const { decisions: colDecisions, tasks: colTasks } = columnItems[column.id];
    const totalCount = colDecisions.length + colTasks.length;
    const isOverWipLimit = column.wipLimit && totalCount > column.wipLimit;

    return (
      <div
        key={column.id}
        className={`board-column ${dragOverColumn === column.id ? 'drag-over' : ''}`}
        data-status={column.id}
        style={{ background: column.bgColor }}
        onDragOver={(e) => handleDragOver(e, column.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, column.id)}
      >
        {/* Column Header */}
        <div className="board-column-header">
          <column.icon size={18} style={{ color: column.statusColor }} />
          <h3 className="column-title">{column.label}</h3>
          <span
            className={`column-count-badge ${isOverWipLimit ? 'wip-limit-warning' : ''}`}
            style={!isOverWipLimit ? { background: column.statusColor } : {}}
          >
            {totalCount}
          </span>
          {isOverWipLimit && (
            <span className="wip-limit-text" title={`WIP limit: ${column.wipLimit}`}>
              !
            </span>
          )}
        </div>

        {/* Column Body - Cards */}
        <div className="board-column-body">
          <AnimatePresence mode="popLayout">
            {/* Render decisions */}
            {colDecisions.map((decision) => (
              <motion.div
                key={`decision-${decision.id}`}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className={`board-card ${draggedItem?.id === decision.id ? 'dragging' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e as any, decision.id, 'decision')}
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

            {/* Render tasks */}
            {colTasks.map((task) => (
              <motion.div
                key={`task-${task.id}`}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className={`board-card ${draggedItem?.id === task.id ? 'dragging' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e as any, task.id, 'task')}
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

          {/* Empty state */}
          {totalCount === 0 && (
            <div className="column-empty-state">
              <p>No items</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="board-view">
      {COLUMNS.map((column) => renderColumn(column))}
    </div>
  );
};
