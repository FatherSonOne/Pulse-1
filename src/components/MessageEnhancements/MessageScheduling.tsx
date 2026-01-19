// Message Scheduling & Reminders System
import React, { useState, useMemo } from 'react';

interface ScheduledMessage {
  id: string;
  content: string;
  threadId: string;
  threadName: string;
  scheduledFor: string;
  createdAt: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    endDate?: string;
  };
}

interface Reminder {
  id: string;
  messageId?: string;
  threadId: string;
  threadName: string;
  title: string;
  description?: string;
  remindAt: string;
  type: 'follow-up' | 'deadline' | 'check-in' | 'custom';
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  snoozedUntil?: string;
}

interface MessageSchedulingProps {
  scheduledMessages: ScheduledMessage[];
  reminders: Reminder[];
  onScheduleMessage?: (message: Omit<ScheduledMessage, 'id' | 'createdAt' | 'status'>) => void;
  onCancelScheduled?: (id: string) => void;
  onEditScheduled?: (id: string, updates: Partial<ScheduledMessage>) => void;
  onCreateReminder?: (reminder: Omit<Reminder, 'id' | 'completed'>) => void;
  onCompleteReminder?: (id: string) => void;
  onSnoozeReminder?: (id: string, until: string) => void;
  onDeleteReminder?: (id: string) => void;
  currentThreadId?: string;
  currentThreadName?: string;
  compact?: boolean;
}

const reminderTypes = {
  'follow-up': { icon: 'fa-reply', color: 'blue', label: 'Follow-up' },
  'deadline': { icon: 'fa-clock', color: 'red', label: 'Deadline' },
  'check-in': { icon: 'fa-user-check', color: 'green', label: 'Check-in' },
  'custom': { icon: 'fa-bell', color: 'purple', label: 'Custom' }
};

const priorityConfig = {
  high: { color: 'red', label: 'High' },
  medium: { color: 'amber', label: 'Medium' },
  low: { color: 'blue', label: 'Low' }
};

// Quick schedule options
const quickScheduleOptions = [
  { label: 'In 1 hour', getDate: () => new Date(Date.now() + 60 * 60 * 1000) },
  { label: 'Tomorrow morning', getDate: () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }},
  { label: 'Tomorrow afternoon', getDate: () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(14, 0, 0, 0);
    return d;
  }},
  { label: 'Next Monday', getDate: () => {
    const d = new Date();
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    d.setHours(9, 0, 0, 0);
    return d;
  }}
];

export const MessageScheduling: React.FC<MessageSchedulingProps> = ({
  scheduledMessages,
  reminders,
  onScheduleMessage,
  onCancelScheduled,
  onEditScheduled,
  onCreateReminder,
  onCompleteReminder,
  onSnoozeReminder,
  onDeleteReminder,
  currentThreadId,
  currentThreadName,
  compact = false
}) => {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'reminders'>('scheduled');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [editingScheduled, setEditingScheduled] = useState<ScheduledMessage | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  // Filter and sort
  const filteredScheduled = useMemo(() => {
    if (!scheduledMessages) return [];
    return scheduledMessages
      .filter(m => {
        if (filter === 'pending') return m.status === 'pending';
        if (filter === 'completed') return m.status !== 'pending';
        return true;
      })
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  }, [scheduledMessages, filter]);

  const filteredReminders = useMemo(() => {
    if (!reminders) return [];
    return reminders
      .filter(r => {
        if (filter === 'pending') return !r.completed;
        if (filter === 'completed') return r.completed;
        return true;
      })
      .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());
  }, [reminders, filter]);

  // Upcoming items count
  const upcomingCount = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcomingScheduled = (scheduledMessages || []).filter(m =>
      m.status === 'pending' && new Date(m.scheduledFor) < tomorrow
    ).length;

    const upcomingReminders = (reminders || []).filter(r =>
      !r.completed && new Date(r.remindAt) < tomorrow
    ).length;

    return upcomingScheduled + upcomingReminders;
  }, [scheduledMessages, reminders]);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 0) {
      return { relative: 'Overdue', absolute: date.toLocaleString(), isOverdue: true };
    }
    if (diffMins < 60) {
      return { relative: `In ${diffMins}m`, absolute: date.toLocaleString(), isOverdue: false };
    }
    if (diffHours < 24) {
      return { relative: `In ${diffHours}h`, absolute: date.toLocaleString(), isOverdue: false };
    }
    if (diffDays < 7) {
      return { relative: `In ${diffDays}d`, absolute: date.toLocaleString(), isOverdue: false };
    }
    return { relative: date.toLocaleDateString(), absolute: date.toLocaleString(), isOverdue: false };
  };

  const getStatusBadge = (status: ScheduledMessage['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400';
      case 'sent':
        return 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400';
      case 'cancelled':
        return 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {upcomingCount > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
            <i className="fa-solid fa-clock text-xs" />
            <span className="text-xs font-medium">{upcomingCount} upcoming</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <i className="fa-solid fa-clock text-amber-500 text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Schedule & Reminders</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {(scheduledMessages || []).filter(m => m.status === 'pending').length} scheduled,{' '}
                {(reminders || []).filter(r => !r.completed).length} reminders
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {onScheduleMessage && currentThreadId && (
              <button
                onClick={() => setShowScheduleModal(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition"
              >
                <i className="fa-solid fa-paper-plane" />
                Schedule
              </button>
            )}
            {onCreateReminder && (
              <button
                onClick={() => setShowReminderModal(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-purple-500 text-white hover:bg-purple-600 transition"
              >
                <i className="fa-solid fa-bell" />
                Remind
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === 'scheduled'
                ? 'bg-white dark:bg-zinc-600 text-zinc-800 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <i className="fa-solid fa-paper-plane" />
            Scheduled ({(scheduledMessages || []).filter(m => m.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === 'reminders'
                ? 'bg-white dark:bg-zinc-600 text-zinc-800 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <i className="fa-solid fa-bell" />
            Reminders ({(reminders || []).filter(r => !r.completed).length})
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-700 flex items-center gap-2">
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Show:</span>
        {['pending', 'completed', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as typeof filter)}
            className={`px-2 py-1 rounded-full text-[10px] font-medium capitalize transition ${
              filter === f
                ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-800'
                : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-700">
        {activeTab === 'scheduled' ? (
          filteredScheduled.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-paper-plane text-zinc-400 text-lg" />
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No scheduled messages</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Schedule messages to send later
              </p>
            </div>
          ) : (
            filteredScheduled.map(message => {
              const timeInfo = formatDateTime(message.scheduledFor);
              return (
                <div key={message.id} className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      message.status === 'pending'
                        ? 'bg-amber-100 dark:bg-amber-900/40'
                        : 'bg-zinc-100 dark:bg-zinc-700'
                    }`}>
                      <i className={`fa-solid fa-paper-plane text-sm ${
                        message.status === 'pending' ? 'text-amber-500' : 'text-zinc-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-800 dark:text-white truncate">
                          To: {message.threadName}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded capitalize ${getStatusBadge(message.status)}`}>
                          {message.status}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                        {message.content}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-[10px] font-medium ${timeInfo.isOverdue ? 'text-red-500' : 'text-zinc-500'}`} title={timeInfo.absolute}>
                          <i className="fa-solid fa-clock mr-1" />
                          {timeInfo.relative}
                        </span>
                        {message.recurring && (
                          <span className="text-[10px] text-purple-500">
                            <i className="fa-solid fa-repeat mr-1" />
                            {message.recurring.frequency}
                          </span>
                        )}
                      </div>
                    </div>
                    {message.status === 'pending' && (
                      <div className="flex items-center gap-1">
                        {onEditScheduled && (
                          <button
                            onClick={() => {
                              setEditingScheduled(message);
                              setShowScheduleModal(true);
                            }}
                            className="p-1 text-zinc-400 hover:text-indigo-500 transition"
                          >
                            <i className="fa-solid fa-pen text-xs" />
                          </button>
                        )}
                        {onCancelScheduled && (
                          <button
                            onClick={() => onCancelScheduled(message.id)}
                            className="p-1 text-zinc-400 hover:text-red-500 transition"
                          >
                            <i className="fa-solid fa-times text-xs" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : (
          filteredReminders.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-bell text-zinc-400 text-lg" />
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No reminders</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Create reminders to stay on top of things
              </p>
            </div>
          ) : (
            filteredReminders.map(reminder => {
              const typeConfig = reminderTypes[reminder.type];
              const priorityInfo = priorityConfig[reminder.priority];
              const timeInfo = formatDateTime(reminder.remindAt);

              return (
                <div
                  key={reminder.id}
                  className={`p-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition ${
                    reminder.completed ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => onCompleteReminder?.(reminder.id)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition ${
                        reminder.completed
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-500'
                          : `bg-${typeConfig.color}-100 dark:bg-${typeConfig.color}-900/40 text-${typeConfig.color}-500 hover:bg-green-100 dark:hover:bg-green-900/40 hover:text-green-500`
                      }`}
                    >
                      <i className={`fa-solid ${reminder.completed ? 'fa-check' : typeConfig.icon} text-sm`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${reminder.completed ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-white'}`}>
                          {reminder.title}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded bg-${priorityInfo.color}-100 dark:bg-${priorityInfo.color}-900/40 text-${priorityInfo.color}-600 dark:text-${priorityInfo.color}-400`}>
                          {priorityInfo.label}
                        </span>
                      </div>
                      {reminder.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          {reminder.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-zinc-500">
                          <i className="fa-solid fa-comment mr-1" />
                          {reminder.threadName}
                        </span>
                        <span className={`text-[10px] font-medium ${timeInfo.isOverdue && !reminder.completed ? 'text-red-500' : 'text-zinc-500'}`} title={timeInfo.absolute}>
                          <i className="fa-solid fa-clock mr-1" />
                          {timeInfo.relative}
                        </span>
                      </div>
                    </div>
                    {!reminder.completed && (
                      <div className="flex items-center gap-1">
                        {onSnoozeReminder && (
                          <button
                            onClick={() => {
                              const snoozeUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                              onSnoozeReminder(reminder.id, snoozeUntil);
                            }}
                            className="p-1 text-zinc-400 hover:text-amber-500 transition"
                            title="Snooze 1 hour"
                          >
                            <i className="fa-solid fa-snooze text-xs" />
                          </button>
                        )}
                        {onDeleteReminder && (
                          <button
                            onClick={() => onDeleteReminder(reminder.id)}
                            className="p-1 text-zinc-400 hover:text-red-500 transition"
                          >
                            <i className="fa-solid fa-trash text-xs" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && onScheduleMessage && currentThreadId && (
        <ScheduleMessageModal
          existingMessage={editingScheduled}
          threadId={currentThreadId}
          threadName={currentThreadName || 'This conversation'}
          onSchedule={(message) => {
            if (editingScheduled && onEditScheduled) {
              onEditScheduled(editingScheduled.id, message);
            } else {
              onScheduleMessage(message);
            }
            setShowScheduleModal(false);
            setEditingScheduled(null);
          }}
          onCancel={() => {
            setShowScheduleModal(false);
            setEditingScheduled(null);
          }}
        />
      )}

      {/* Reminder Modal */}
      {showReminderModal && onCreateReminder && (
        <CreateReminderModal
          threadId={currentThreadId}
          threadName={currentThreadName || 'This conversation'}
          onCreateReminder={(reminder) => {
            onCreateReminder(reminder);
            setShowReminderModal(false);
          }}
          onCancel={() => setShowReminderModal(false)}
        />
      )}
    </div>
  );
};

// Schedule message modal
const ScheduleMessageModal: React.FC<{
  existingMessage?: ScheduledMessage | null;
  threadId: string;
  threadName: string;
  onSchedule: (message: Omit<ScheduledMessage, 'id' | 'createdAt' | 'status'>) => void;
  onCancel: () => void;
}> = ({ existingMessage, threadId, threadName, onSchedule, onCancel }) => {
  const [content, setContent] = useState(existingMessage?.content || '');
  const [scheduledFor, setScheduledFor] = useState(
    existingMessage?.scheduledFor
      ? new Date(existingMessage.scheduledFor).toISOString().slice(0, 16)
      : ''
  );
  const [isRecurring, setIsRecurring] = useState(!!existingMessage?.recurring);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>(
    existingMessage?.recurring?.frequency || 'weekly'
  );

  const handleQuickSchedule = (getDate: () => Date) => {
    setScheduledFor(getDate().toISOString().slice(0, 16));
  };

  const handleSubmit = () => {
    if (!content.trim() || !scheduledFor) return;

    onSchedule({
      content: content.trim(),
      threadId,
      threadName,
      scheduledFor: new Date(scheduledFor).toISOString(),
      recurring: isRecurring ? { frequency } : undefined
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-4">
        <h4 className="text-sm font-bold text-zinc-800 dark:text-white mb-4">
          {existingMessage ? 'Edit Scheduled Message' : 'Schedule Message'}
        </h4>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Message
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white resize-none"
              rows={3}
              placeholder="Type your message..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
              Quick schedule
            </label>
            <div className="flex flex-wrap gap-2">
              {quickScheduleOptions.map(option => (
                <button
                  key={option.label}
                  onClick={() => handleQuickSchedule(option.getDate)}
                  className="px-2 py-1 text-xs rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:text-amber-600 dark:hover:text-amber-400 transition"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Send at
            </label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
              />
              Recurring
            </label>
            {isRecurring && (
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                className="px-2 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || !scheduledFor}
            className="px-4 py-1.5 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {existingMessage ? 'Update' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Create reminder modal
const CreateReminderModal: React.FC<{
  threadId?: string;
  threadName?: string;
  onCreateReminder: (reminder: Omit<Reminder, 'id' | 'completed'>) => void;
  onCancel: () => void;
}> = ({ threadId, threadName, onCreateReminder, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [type, setType] = useState<Reminder['type']>('follow-up');
  const [priority, setPriority] = useState<Reminder['priority']>('medium');

  const handleSubmit = () => {
    if (!title.trim() || !remindAt) return;

    onCreateReminder({
      title: title.trim(),
      description: description.trim() || undefined,
      threadId: threadId || '',
      threadName: threadName || 'General',
      remindAt: new Date(remindAt).toISOString(),
      type,
      priority
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-4">
        <h4 className="text-sm font-bold text-zinc-800 dark:text-white mb-4">
          Create Reminder
        </h4>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
              placeholder="What do you want to remember?"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white resize-none"
              rows={2}
              placeholder="Additional details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Reminder['type'])}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
              >
                {Object.entries(reminderTypes).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Reminder['priority'])}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
              >
                {Object.entries(priorityConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Remind at
            </label>
            <input
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !remindAt}
            className="px-4 py-1.5 text-sm font-medium bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

// Schedule button for message input
export const ScheduleButton: React.FC<{
  onClick: () => void;
  hasScheduled?: boolean;
}> = ({ onClick, hasScheduled = false }) => {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded transition ${
        hasScheduled
          ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
          : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
      }`}
      title="Schedule message"
    >
      <i className="fa-solid fa-clock text-sm" />
    </button>
  );
};

export default MessageScheduling;
