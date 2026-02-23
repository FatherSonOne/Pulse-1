/**
 * SubtaskList Integration Example
 * Shows how to use the SubtaskList component in a task detail view
 */

import React from 'react';
import { SubtaskList } from './SubtaskList';

/**
 * Example 1: Basic usage in a task detail view
 */
export const TaskDetailExample = () => {
  const taskId = 'task-123';
  const workspaceId = 'workspace-456';

  return (
    <div className="task-detail">
      <h1>Task: Implement user authentication</h1>

      <div className="task-description">
        Build a secure authentication system with email/password login.
      </div>

      {/* Subtask list */}
      <SubtaskList
        taskId={taskId}
        workspaceId={workspaceId}
      />

      <div className="task-actions">
        <button>Save Task</button>
        <button>Mark Complete</button>
      </div>
    </div>
  );
};

/**
 * Example 2: Read-only mode for archived or completed tasks
 */
export const ArchivedTaskExample = () => {
  const taskId = 'archived-task-789';
  const workspaceId = 'workspace-456';

  return (
    <div className="task-detail archived">
      <h1>Task: Design landing page (Archived)</h1>

      {/* Read-only subtask list */}
      <SubtaskList
        taskId={taskId}
        workspaceId={workspaceId}
        readonly={true}
      />
    </div>
  );
};

/**
 * Example 3: In a modal or side panel
 */
export const TaskModalExample = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const taskId = 'task-abc';
  const workspaceId = 'workspace-456';

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        View Task Details
      </button>

      {isOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>Task Details</h2>

            {/* Subtasks in modal */}
            <SubtaskList
              taskId={taskId}
              workspaceId={workspaceId}
            />

            <button onClick={() => setIsOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Example 4: Conditional rendering based on permissions
 */
export const ConditionalSubtasksExample = () => {
  const taskId = 'task-xyz';
  const workspaceId = 'workspace-456';
  const userRole = 'viewer'; // Could be 'owner', 'editor', 'viewer'

  const canEdit = userRole === 'owner' || userRole === 'editor';

  return (
    <div className="task-detail">
      <h1>Shared Task</h1>

      <SubtaskList
        taskId={taskId}
        workspaceId={workspaceId}
        readonly={!canEdit}
      />

      {!canEdit && (
        <p className="permission-notice">
          You have view-only access to this task
        </p>
      )}
    </div>
  );
};
