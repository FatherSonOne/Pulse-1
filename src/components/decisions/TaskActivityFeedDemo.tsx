/**
 * TaskActivityFeed Demo Component
 * Example usage of the TaskActivityFeed component
 */

import React from 'react';
import TaskActivityFeed from './TaskActivityFeed';

/**
 * Demo component showing TaskActivityFeed usage
 */
const TaskActivityFeedDemo: React.FC = () => {
  // Example task ID - replace with actual task ID from your app
  const exampleTaskId = 'your-task-id-here';

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
      <h1>Task Activity Feed Demo</h1>

      <div style={{
        background: 'var(--dt-bg-card)',
        borderRadius: 'var(--dt-radius)',
        padding: 'var(--dt-spacing-lg)',
        boxShadow: 'var(--dt-shadow-card)'
      }}>
        <TaskActivityFeed
          taskId={exampleTaskId}
          limit={20}
        />
      </div>

      <div style={{ marginTop: '32px', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
        <h3>Usage Example:</h3>
        <pre style={{ fontSize: '14px', overflow: 'auto' }}>
{`import TaskActivityFeed from './TaskActivityFeed';

// Basic usage
<TaskActivityFeed taskId="task-123" />

// With custom limit
<TaskActivityFeed
  taskId="task-123"
  limit={50}
/>

// In a task detail modal
<div className="task-detail-sidebar">
  <TaskActivityFeed taskId={selectedTask.id} />
</div>`}
        </pre>
      </div>
    </div>
  );
};

export default TaskActivityFeedDemo;
