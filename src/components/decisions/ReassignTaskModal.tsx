import React, { useState } from 'react';
import { X, User, Search } from 'lucide-react';
import { Task } from '../../services/taskService';
import { User as UserType } from '../../types';
import './ReassignTaskModal.css';

interface ReassignTaskModalProps {
  task: Task;
  currentAssignee?: string;
  workspaceMembers?: UserType[];
  onClose: () => void;
  onReassign: (taskId: string, newAssignee: string) => Promise<void>;
}

export const ReassignTaskModal: React.FC<ReassignTaskModalProps> = ({
  task,
  currentAssignee,
  workspaceMembers = [],
  onClose,
  onReassign
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState(currentAssignee || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredMembers = workspaceMembers.filter(member => {
    const name = member.name || member.email || '';
    const email = member.email || '';
    const query = searchQuery.toLowerCase();
    return name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
  });

  const handleReassign = async () => {
    if (!selectedAssignee) {
      setError('Please select an assignee');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onReassign(task.id, selectedAssignee);
      onClose();
    } catch (err) {
      console.error('Error reassigning task:', err);
      setError('Failed to reassign task. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div
      className="reassign-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reassign-modal-title"
    >
      <div
        className="reassign-modal"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="reassign-modal-header">
          <div className="reassign-modal-header-content">
            <h3 id="reassign-modal-title">Reassign Task</h3>
            <p className="reassign-modal-task-title">{task.title}</p>
          </div>
          <button
            type="button"
            className="reassign-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="reassign-modal-body">
          {currentAssignee && (
            <div className="reassign-current-assignee">
              <User size={16} />
              <span>
                Current assignee: <strong>{currentAssignee}</strong>
              </span>
            </div>
          )}

          <div className="reassign-search-container">
            <Search size={18} className="reassign-search-icon" />
            <input
              type="text"
              className="reassign-search-input"
              placeholder="Search contacts by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {error && (
            <div className="reassign-error">
              {error}
            </div>
          )}

          <div className="reassign-contacts-list">
            {filteredMembers.length === 0 ? (
              <div className="reassign-empty-state">
                <User size={48} color="#ccc" />
                <p>No workspace members found</p>
              </div>
            ) : (
              filteredMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className={`reassign-contact-item ${
                    selectedAssignee === member.id ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedAssignee(member.id)}
                >
                  <div
                    className="reassign-contact-avatar"
                    style={{ backgroundColor: (member as any).avatarColor || '#6b7280' }}
                  >
                    {getInitials(member.name || member.email || '?')}
                  </div>
                  <div className="reassign-contact-info">
                    <div className="reassign-contact-name">{member.name || member.email}</div>
                    <div className="reassign-contact-details">
                      {member.email}
                    </div>
                  </div>
                  {selectedAssignee === member.id && (
                    <div className="reassign-contact-selected-indicator">
                      ✓
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="reassign-modal-footer">
          <button
            type="button"
            className="reassign-modal-button reassign-modal-button-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="reassign-modal-button reassign-modal-button-primary"
            onClick={handleReassign}
            disabled={!selectedAssignee || isLoading}
          >
            {isLoading ? 'Reassigning...' : 'Reassign Task'}
          </button>
        </div>
      </div>
    </div>
  );
};
