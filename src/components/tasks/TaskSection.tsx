import React, { useState, memo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Task } from '../../services/taskService';
import { EnhancedTaskCard } from './EnhancedTaskCard';
import './TaskSection.css';

interface TaskSectionProps {
  title: string;
  icon: React.ReactNode;
  tasks: Task[];
  accentColor: string;
  defaultExpanded?: boolean;
  onStatusChange: (taskId: string, status: Task['status']) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
  onEdit?: (task: Task) => void;
  emptyMessage?: string;
}

export const TaskSection: React.FC<TaskSectionProps> = memo(({
  title,
  icon,
  tasks,
  accentColor,
  defaultExpanded = true,
  onStatusChange,
  onDelete,
  onEdit,
  emptyMessage = 'No tasks'
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Don't render empty sections
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="task-section" data-accent={accentColor}>
      <button
        className="task-section-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="task-section-header-left">
          <span className="task-section-icon" style={{ color: accentColor }}>
            {icon}
          </span>
          <h3 className="task-section-title">{title}</h3>
          <span className="task-section-count" style={{ backgroundColor: accentColor }}>
            {tasks.length}
          </span>
        </div>
        <div className="task-section-header-right">
          {isExpanded ? (
            <ChevronUp size={18} />
          ) : (
            <ChevronDown size={18} />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="task-section-content">
          {tasks.map((task, index) => (
            <EnhancedTaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              onEdit={onEdit}
              style={{
                animationDelay: `${index * 0.05}s`
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for performance
  return (
    prevProps.title === nextProps.title &&
    prevProps.tasks.length === nextProps.tasks.length &&
    prevProps.defaultExpanded === nextProps.defaultExpanded &&
    prevProps.tasks.every((task, i) =>
      task.id === nextProps.tasks[i]?.id &&
      task.status === nextProps.tasks[i]?.status &&
      task.updated_at === nextProps.tasks[i]?.updated_at
    )
  );
});

TaskSection.displayName = 'TaskSection';
