import React, { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { Task } from '../../services/taskService';
import './ExtendDeadlineDialog.css';

interface ExtendDeadlineDialogProps {
  task: Task;
  onClose: () => void;
  onExtend: (taskId: string, newDeadline: string) => Promise<void>;
}

type ExtensionOption = '1day' | '3days' | '1week' | '2weeks' | 'custom';

export const ExtendDeadlineDialog: React.FC<ExtendDeadlineDialogProps> = ({
  task,
  onClose,
  onExtend
}) => {
  const [selectedOption, setSelectedOption] = useState<ExtensionOption>('1day');
  const [customDate, setCustomDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentDeadline = task.due_date ? new Date(task.due_date) : new Date();

  const calculateNewDate = (option: ExtensionOption): Date => {
    const base = task.due_date ? new Date(task.due_date) : new Date();
    const newDate = new Date(base);

    switch (option) {
      case '1day':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case '3days':
        newDate.setDate(newDate.getDate() + 3);
        break;
      case '1week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case '2weeks':
        newDate.setDate(newDate.getDate() + 14);
        break;
      case 'custom':
        return customDate ? new Date(customDate) : newDate;
    }

    return newDate;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleExtend = async () => {
    if (selectedOption === 'custom' && !customDate) {
      setError('Please select a custom date');
      return;
    }

    const newDeadline = calculateNewDate(selectedOption);

    if (newDeadline <= currentDeadline) {
      setError('New deadline must be after the current deadline');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onExtend(task.id, newDeadline.toISOString());
      onClose();
    } catch (err) {
      console.error('Error extending deadline:', err);
      setError('Failed to extend deadline. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const extensionOptions: Array<{ value: ExtensionOption; label: string; icon: string }> = [
    { value: '1day', label: '+1 Day', icon: '📅' },
    { value: '3days', label: '+3 Days', icon: '📆' },
    { value: '1week', label: '+1 Week', icon: '🗓️' },
    { value: '2weeks', label: '+2 Weeks', icon: '📋' },
    { value: 'custom', label: 'Custom Date', icon: '✏️' },
  ];

  const previewNewDate = calculateNewDate(selectedOption);

  return (
    <div className="extend-deadline-overlay" onClick={onClose}>
      <div className="extend-deadline-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="extend-deadline-header">
          <div className="extend-deadline-header-content">
            <h3>Extend Deadline</h3>
            <p className="extend-deadline-task-title">{task.title}</p>
          </div>
          <button
            type="button"
            className="extend-deadline-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className="extend-deadline-body">
          {task.due_date && (
            <div className="extend-deadline-current">
              <Clock size={16} />
              <span>
                Current deadline: <strong>{formatDate(currentDeadline)}</strong>
              </span>
            </div>
          )}

          <div className="extend-deadline-options">
            {extensionOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`extend-deadline-option ${
                  selectedOption === option.value ? 'selected' : ''
                }`}
                onClick={() => setSelectedOption(option.value)}
              >
                <span className="extend-deadline-option-icon">{option.icon}</span>
                <span className="extend-deadline-option-label">{option.label}</span>
                {selectedOption === option.value && (
                  <span className="extend-deadline-option-check">✓</span>
                )}
              </button>
            ))}
          </div>

          {selectedOption === 'custom' && (
            <div className="extend-deadline-custom">
              <label htmlFor="custom-date" className="extend-deadline-custom-label">
                <Calendar size={16} />
                Select Custom Date
              </label>
              <input
                id="custom-date"
                type="date"
                className="extend-deadline-custom-input"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={new Date(currentDeadline.getTime() + 86400000).toISOString().split('T')[0]}
              />
            </div>
          )}

          {error && (
            <div className="extend-deadline-error">
              {error}
            </div>
          )}

          <div className="extend-deadline-preview">
            <div className="extend-deadline-preview-label">New Deadline</div>
            <div className="extend-deadline-preview-date">
              {formatDate(previewNewDate)}
            </div>
            <div className="extend-deadline-preview-time">
              {previewNewDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>

        <div className="extend-deadline-footer">
          <button
            type="button"
            className="extend-deadline-button extend-deadline-button-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="extend-deadline-button extend-deadline-button-primary"
            onClick={handleExtend}
            disabled={isLoading || (selectedOption === 'custom' && !customDate)}
          >
            {isLoading ? 'Extending...' : 'Extend Deadline'}
          </button>
        </div>
      </div>
    </div>
  );
};
