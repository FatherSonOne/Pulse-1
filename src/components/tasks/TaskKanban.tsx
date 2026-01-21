import React, { useState, DragEvent } from 'react';
import { Task } from '../../services/taskService';
import { EnhancedTaskCard } from './EnhancedTaskCard';
import { CheckSquare, CircleDot, CheckCircle2, Plus } from 'lucide-react';
import './TaskKanban.css';

export interface TaskKanbanProps {
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: Task['status']) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
  onEdit?: (task: Task) => void;
  onCreate?: () => void;
}

type KanbanColumn = 'todo' | 'in_progress' | 'done';

interface ColumnConfig {
  id: KanbanColumn;
  title: string;
  icon: React.ReactNode;
  color: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'todo',
    title: 'To Do',
    icon: <CheckSquare size={20} />,
    color: '#6b7280'
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    icon: <CircleDot size={20} />,
    color: '#f59e0b'
  },
  {
    id: 'done',
    title: 'Done',
    icon: <CheckCircle2 size={20} />,
    color: '#10b981'
  }
];

export const TaskKanban: React.FC<TaskKanbanProps> = ({
  tasks,
  onStatusChange,
  onDelete,
  onEdit,
  onCreate
}) => {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColumn | null>(null);

  // Filter tasks by column (exclude cancelled)
  const getColumnTasks = (columnId: KanbanColumn): Task[] => {
    return tasks
      .filter(task => task.status === columnId)
      .sort((a, b) => {
        // Sort by AI score if available, then by created date
        const aScore = a.metadata?.ai_priority_score || 0;
        const bScore = b.metadata?.ai_priority_score || 0;

        if (aScore !== bScore) {
          return bScore - aScore; // Higher scores first
        }

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  };

  // Drag and drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';

    // Add drag styling
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, columnId: KanbanColumn) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    // Only clear if actually leaving the element
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, columnId: KanbanColumn) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedTask || draggedTask.status === columnId) {
      return;
    }

    try {
      await onStatusChange(draggedTask.id, columnId);
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  // Calculate column stats
  const getColumnStats = (columnId: KanbanColumn) => {
    const columnTasks = getColumnTasks(columnId);
    const count = columnTasks.length;
    const highPriority = columnTasks.filter(
      t => t.priority === 'urgent' || t.priority === 'high'
    ).length;
    const overdue = columnTasks.filter(
      t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
    ).length;

    return { count, highPriority, overdue };
  };

  return (
    <div className="task-kanban">
      {COLUMNS.map(column => {
        const columnTasks = getColumnTasks(column.id);
        const stats = getColumnStats(column.id);
        const isDragOver = dragOverColumn === column.id;

        return (
          <div
            key={column.id}
            className={`kanban-column ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column header */}
            <div className="kanban-column-header" style={{ borderTopColor: column.color }}>
              <div className="column-header-left">
                <div className="column-icon" style={{ color: column.color }}>
                  {column.icon}
                </div>
                <h3 className="column-title">{column.title}</h3>
                <span className="column-count">{stats.count}</span>
              </div>

              <div className="column-stats">
                {stats.highPriority > 0 && (
                  <span className="stat-badge high-priority" title="High priority tasks">
                    {stats.highPriority}
                  </span>
                )}
                {stats.overdue > 0 && (
                  <span className="stat-badge overdue" title="Overdue tasks">
                    {stats.overdue}
                  </span>
                )}
              </div>
            </div>

            {/* Column content */}
            <div className="kanban-column-content">
              {columnTasks.length === 0 ? (
                <div className="kanban-empty-state">
                  {column.id === 'todo' && onCreate ? (
                    <>
                      <p>No tasks yet</p>
                      <button className="create-task-button" onClick={onCreate}>
                        <Plus size={16} />
                        <span>Create Task</span>
                      </button>
                    </>
                  ) : (
                    <p>Drop tasks here</p>
                  )}
                </div>
              ) : (
                columnTasks.map(task => (
                  <div
                    key={task.id}
                    className="kanban-task-wrapper"
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                  >
                    <EnhancedTaskCard
                      task={task}
                      onStatusChange={onStatusChange}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      allTasks={tasks}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Drop indicator */}
            {isDragOver && draggedTask && draggedTask.status !== column.id && (
              <div className="drop-indicator">
                Drop to move to {column.title}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
