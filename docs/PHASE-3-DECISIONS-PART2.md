# 🎯 PHASE 3 PART 2: Decision & Task UI Components

## Component 1: Decision Card

File: `src/components/DecisionCard.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { decisionService, DecisionStatus } from '../services/decisionService';
import { CheckCircle, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import './DecisionCard.css';

interface DecisionCardProps {
  decision: any;
  currentUserId: string;
  onVote?: () => void;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({
  decision,
  currentUserId,
  onVote
}) => {
  const [results, setResults] = useState<any>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [decision.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resultsData, voted, vote] = await Promise.all([
        decisionService.getResults(decision.id),
        decisionService.hasVoted(decision.id, currentUserId),
        decisionService.getUserVote(decision.id, currentUserId)
      ]);
      
      setResults(resultsData);
      setHasVoted(voted);
      setUserVote(vote);
    } catch (error) {
      console.error('Failed to load decision data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (choice: string) => {
    try {
      await decisionService.vote(decision.id, currentUserId, choice);
      setHasVoted(true);
      await loadData();
      onVote?.();
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const getStatusIcon = () => {
    switch (decision.status) {
      case 'voting':
        return <Clock size={16} />;
      case 'decided':
        return <CheckCircle size={16} />;
      case 'implemented':
        return <TrendingUp size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const getStatusColor = () => {
    switch (decision.status) {
      case 'voting': return '#f59e0b';
      case 'decided': return '#10b981';
      case 'implemented': return '#667eea';
      default: return '#6b7280';
    }
  };

  const isExpired = decision.deadline && new Date(decision.deadline) < new Date();

  return (
    <div className={`decision-card status-${decision.status}`}>
      <div className="decision-header">
        <div className="decision-title">
          <h3>{decision.title}</h3>
          <div 
            className="decision-status"
            style={{ 
              backgroundColor: `${getStatusColor()}15`,
              color: getStatusColor()
            }}
          >
            {getStatusIcon()}
            <span>{decision.status}</span>
          </div>
        </div>
        
        {decision.description && (
          <p className="decision-description">{decision.description}</p>
        )}

        {decision.deadline && (
          <div className={`decision-deadline ${isExpired ? 'expired' : ''}`}>
            <Clock size={14} />
            <span>
              {isExpired ? 'Expired: ' : 'Deadline: '}
              {new Date(decision.deadline).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {decision.status === 'voting' && !isExpired && (
        <div className="decision-voting">
          {!hasVoted ? (
            <div className="voting-options">
              <p>Cast your vote:</p>
              {decision.options.map((option: string) => (
                <button
                  key={option}
                  className="vote-button"
                  onClick={() => handleVote(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div className="voted-indicator">
              <CheckCircle size={16} />
              <span>You voted: <strong>{userVote?.choice}</strong></span>
            </div>
          )}
        </div>
      )}

      {results && results.total_votes > 0 && (
        <div className="decision-results">
          <div className="results-header">
            <span>Results ({results.total_votes} votes)</span>
            {results.average_confidence && (
              <span className="confidence">
                Avg confidence: {results.average_confidence}/5
              </span>
            )}
          </div>
          
          {Object.entries(results.choices).map(([choice, data]: [string, any]) => (
            <div key={choice} className="result-bar">
              <div className="result-label">
                <span>{choice}</span>
                <span>{data.count} ({data.percentage}%)</span>
              </div>
              <div className="result-progress">
                <div
                  className="result-fill"
                  style={{ width: `${data.percentage}%` }}
                ></div>
              </div>
              {data.voters.length > 0 && (
                <div className="result-voters">
                  {data.voters.slice(0, 3).join(', ')}
                  {data.voters.length > 3 && ` +${data.voters.length - 3} more`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {decision.status === 'decided' && decision.final_choice && (
        <div className="final-decision">
          <CheckCircle size={18} />
          <div>
            <strong>Decision: {decision.final_choice}</strong>
            {decision.rationale && <p>{decision.rationale}</p>}
          </div>
        </div>
      )}
    </div>
  );
};
```

File: `src/components/DecisionCard.css`

```css
.decision-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  border: 1px solid #e0e0e0;
  transition: all 0.2s;
}

.decision-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.decision-header {
  margin-bottom: 16px;
}

.decision-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.decision-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  flex: 1;
}

.decision-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.decision-description {
  margin: 8px 0 0 0;
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

.decision-deadline {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
  margin-top: 8px;
}

.decision-deadline.expired {
  color: #ef4444;
  font-weight: 600;
}

.decision-voting {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 16px;
}

.voting-options p {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.vote-button {
  display: block;
  width: 100%;
  padding: 12px;
  margin-bottom: 8px;
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.vote-button:hover {
  border-color: #667eea;
  background: #667eea05;
  transform: translateX(4px);
}

.vote-button:active {
  transform: scale(0.98);
}

.voted-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #10b981;
  font-size: 14px;
}

.decision-results {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.confidence {
  font-size: 12px;
  color: #667eea;
}

.result-bar {
  margin-bottom: 12px;
}

.result-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #555;
}

.result-progress {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.result-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.5s ease;
}

.result-voters {
  margin-top: 4px;
  font-size: 11px;
  color: #999;
}

.final-decision {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #10b98115;
  border-radius: 8px;
  border: 1px solid #10b98130;
}

.final-decision svg {
  color: #10b981;
  flex-shrink: 0;
  margin-top: 2px;
}

.final-decision strong {
  display: block;
  margin-bottom: 4px;
  color: #333;
}

.final-decision p {
  margin: 0;
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}
```

---

## Component 2: Task List

File: `src/components/TaskList.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { taskService, TaskStatus } from '../services/taskService';
import { CheckSquare, Square, Clock, AlertCircle, User } from 'lucide-react';
import './TaskList.css';

interface TaskListProps {
  userId: string;
  statusFilter?: TaskStatus;
  showOverdueOnly?: boolean;
}

export const TaskList: React.FC<TaskListProps> = ({
  userId,
  statusFilter,
  showOverdueOnly = false
}) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, [userId, statusFilter, showOverdueOnly]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      let taskData;
      if (showOverdueOnly) {
        taskData = await taskService.getOverdueTasks(userId);
      } else {
        taskData = await taskService.getTasksForUser(userId, statusFilter);
      }
      setTasks(taskData);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await taskService.updateStatus(taskId, newStatus);
      await loadTasks();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#10b981';
      default: return '#6b7280';
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="task-list loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="task-list empty">
        <CheckSquare size={48} color="#ccc" />
        <p>No tasks found</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      {tasks.map(task => (
        <div
          key={task.id}
          className={`task-item status-${task.status} ${
            isOverdue(task.due_date) ? 'overdue' : ''
          }`}
        >
          <button
            className="task-checkbox"
            onClick={() => 
              handleStatusChange(
                task.id,
                task.status === 'done' ? 'todo' : 'done'
              )
            }
          >
            {task.status === 'done' ? (
              <CheckSquare size={20} />
            ) : (
              <Square size={20} />
            )}
          </button>

          <div className="task-content">
            <div className="task-header">
              <h4>{task.title}</h4>
              <div
                className="task-priority"
                style={{
                  backgroundColor: `${getPriorityColor(task.priority)}15`,
                  color: getPriorityColor(task.priority)
                }}
              >
                {task.priority}
              </div>
            </div>

            {task.description && (
              <p className="task-description">{task.description}</p>
            )}

            <div className="task-meta">
              {task.assignee && (
                <div className="task-assignee">
                  <User size={14} />
                  <span>{task.assignee.full_name}</span>
                </div>
              )}
              
              {task.due_date && (
                <div className={`task-due ${isOverdue(task.due_date) ? 'overdue' : ''}`}>
                  {isOverdue(task.due_date) ? (
                    <AlertCircle size={14} />
                  ) : (
                    <Clock size={14} />
                  )}
                  <span>
                    {isOverdue(task.due_date) ? 'Overdue: ' : 'Due: '}
                    {new Date(task.due_date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {task.status !== 'done' && task.status !== 'todo' && (
            <select
              className="task-status-select"
              value={task.status}
              onChange={(e) => 
                handleStatusChange(task.id, e.target.value as TaskStatus)
              }
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          )}
        </div>
      ))}
    </div>
  );
};
```

File: `src/components/TaskList.css`

```css
.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-list.loading {
  padding: 40px;
  display: flex;
  justify-content: center;
}

.task-list.empty {
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #999;
}

.task-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  transition: all 0.2s;
}

.task-item:hover {
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.task-item.status-done {
  opacity: 0.6;
}

.task-item.status-done .task-content {
  text-decoration: line-through;
}

.task-item.overdue {
  border-color: #ef4444;
  background: #ef444405;
}

.task-checkbox {
  flex-shrink: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #667eea;
  padding: 0;
  transition: transform 0.2s;
}

.task-checkbox:hover {
  transform: scale(1.1);
}

.task-checkbox:active {
  transform: scale(0.95);
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.task-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.task-priority {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
}

.task-description {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #999;
}

.task-assignee,
.task-due {
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-due.overdue {
  color: #ef4444;
  font-weight: 600;
}

.task-status-select {
  flex-shrink: 0;
  padding: 4px 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: white;
  color: #666;
}

.task-status-select:focus {
  outline: none;
  border-color: #667eea;
}
```

---

**Continuing in next file with Create Decision dialog and integration...**
