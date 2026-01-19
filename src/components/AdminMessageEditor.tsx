// =====================================================
// ADMIN MESSAGE EDITOR COMPONENT
// No-code interface for creating and managing in-app messages
// Includes analytics sub-tab for message performance tracking
// =====================================================

import React, { useState, useEffect } from 'react';
import { messageService } from '../services/messageService';
import type {
  InAppMessage,
  CreateMessagePayload,
  MessageEventTrigger,
  UserSegment,
  CustomSegmentQuery,
  MessageStyleType,
  MessageMetrics,
  RetentionByExposure,
} from '../types/inAppMessages';

// Helper labels for UI
const TRIGGER_EVENT_LABELS: Record<MessageEventTrigger, string> = {
  user_signup: 'User Signup',
  first_message_sent: 'First Message Sent',
  first_group_joined: 'First Group Joined',
  workspace_created: 'Workspace Created',
  team_invited: 'Team Invited',
  no_activity_24h: 'No Activity (24h)',
  no_activity_7d: 'No Activity (7 days)',
  profile_incomplete: 'Profile Incomplete',
  message_sent: 'Message Sent',
  group_created: 'Group Created',
  page_view: 'Page View',
};

const SEGMENT_LABELS: Record<UserSegment, string> = {
  all: 'All Users',
  new_users: 'New Users (< 7 days)',
  active_teams: 'Active Teams',
  dormant_users: 'Dormant Users (7+ days inactive)',
  custom: 'Custom Segment',
};

const AUTO_DISMISS_PRESETS = [5, 8, 10, 15, 20, 30];

// Recurring schedule options
const RECURRING_OPTIONS = [
  { value: 'none', label: 'One-time only' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

type MessageSubTab = 'manage' | 'analytics';

interface AdminMessageEditorProps {
  userId: string; // Current admin user ID
  editingMessage?: InAppMessage | null; // If editing existing message
  onSave?: (message: InAppMessage) => void;
  onCancel?: () => void;
}

/**
 * AdminMessageEditor Component
 * Allows admins to create and edit in-app messages without code
 */
const AdminMessageEditor: React.FC<AdminMessageEditorProps> = ({
  userId,
  editingMessage,
  onSave,
  onCancel,
}) => {
  // ==================== STATE ====================

  const [messages, setMessages] = useState<InAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // Track which message is being edited
  const [subTab, setSubTab] = useState<MessageSubTab>('manage');

  // Analytics state
  const [selectedAnalyticsMessage, setSelectedAnalyticsMessage] = useState<InAppMessage | null>(null);
  const [metrics, setMetrics] = useState<MessageMetrics | null>(null);
  const [retentionData, setRetentionData] = useState<RetentionByExposure[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [triggerEvent, setTriggerEvent] = useState<MessageEventTrigger>('user_signup');
  const [targetSegment, setTargetSegment] = useState<UserSegment>('all');
  const [segmentFilter, setSegmentFilter] = useState<string>(''); // JSON string
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [active, setActive] = useState(true);
  const [priority, setPriority] = useState(0);
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center'>('bottom-right');
  const [styleType, setStyleType] = useState<MessageStyleType>('info');
  const [autoDismiss, setAutoDismiss] = useState(8);
  const [recurringSchedule, setRecurringSchedule] = useState('none');

  // ==================== EFFECTS ====================

  useEffect(() => {
    loadMessages();
    loadRetentionData();
  }, []);

  useEffect(() => {
    if (editingMessage) {
      populateForm(editingMessage);
      setEditingId(editingMessage.id);
      setShowForm(true);
    }
  }, [editingMessage]);

  useEffect(() => {
    if (selectedAnalyticsMessage) {
      loadMessageMetrics(selectedAnalyticsMessage.id);
    }
  }, [selectedAnalyticsMessage]);

  // ==================== DATA LOADING ====================

  const loadMessages = async () => {
    setLoading(true);
    try {
      const allMessages = await messageService.getActiveMessages();
      setMessages(allMessages);
      // Auto-select first message for analytics if none selected
      if (allMessages.length > 0 && !selectedAnalyticsMessage) {
        setSelectedAnalyticsMessage(allMessages[0]);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      alert('Failed to load messages. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const loadMessageMetrics = async (messageId: string) => {
    setAnalyticsLoading(true);
    try {
      const metricsData = await messageService.getMessageMetrics(messageId);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadRetentionData = async () => {
    try {
      const retention = await messageService.getRetentionByExposure();
      setRetentionData(retention);
    } catch (error) {
      console.error('Failed to load retention data:', error);
    }
  };

  const populateForm = (message: InAppMessage) => {
    setTitle(message.title);
    setBody(message.body);
    setCtaText(message.ctaText || '');
    setCtaUrl(message.ctaUrl || '');
    setTriggerEvent(message.eventTrigger);
    setTargetSegment(message.segment);
    setSegmentFilter(message.customSegmentQuery ? JSON.stringify(message.customSegmentQuery, null, 2) : '');
    setStartDate(message.startsAt ? new Date(message.startsAt).toISOString().split('T')[0] : '');
    setEndDate(message.endsAt ? new Date(message.endsAt).toISOString().split('T')[0] : '');
    setActive(message.isActive);
    setPriority(message.priority);
    setPosition(message.position);
    setStyleType(message.styleType);
    setAutoDismiss(message.displayDurationSeconds);
    setRecurringSchedule((message as any).recurringSchedule || 'none');
    setEditingId(message.id);
  };

  const resetForm = () => {
    setTitle('');
    setBody('');
    setCtaText('');
    setCtaUrl('');
    setTriggerEvent('user_signup');
    setTargetSegment('all');
    setSegmentFilter('');
    setStartDate('');
    setEndDate('');
    setActive(true);
    setPriority(0);
    setPosition('bottom-right');
    setStyleType('info');
    setAutoDismiss(8);
    setRecurringSchedule('none');
    setEditingId(null);
  };

  const getMetricColor = (rate: number): string => {
    if (rate >= 20) return 'text-green-600 dark:text-green-400';
    if (rate >= 10) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // ==================== FORM HANDLERS ====================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Parse segment filter if provided
      let parsedFilter: CustomSegmentQuery | undefined = undefined;
      if (segmentFilter.trim()) {
        try {
          parsedFilter = JSON.parse(segmentFilter);
        } catch (err) {
          alert('Invalid JSON in segment filter');
          setLoading(false);
          return;
        }
      }

      const payload: CreateMessagePayload = {
        title,
        body,
        ctaText: ctaText || undefined,
        ctaUrl: ctaUrl || undefined,
        eventTrigger: triggerEvent,
        segment: targetSegment,
        customSegmentQuery: parsedFilter,
        startsAt: startDate || undefined,
        endsAt: endDate || undefined,
        priority,
        displayDurationSeconds: autoDismiss,
        position,
        styleType,
      };

      // Use editingId to determine if we're updating or creating
      if (editingId) {
        // Update existing message
        const updated = await messageService.updateMessage(editingId, payload);
        if (onSave) onSave(updated);
        alert('Message updated successfully!');
      } else {
        // Create new message
        const created = await messageService.createMessage(payload);
        if (onSave) onSave(created);
        alert('Message created successfully!');
      }

      resetForm();
      setShowForm(false);
      loadMessages();
    } catch (error) {
      console.error('Failed to save message:', error);
      alert('Failed to save message. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (message: InAppMessage) => {
    populateForm(message);
    setShowForm(true);
  };

  const handleResend = async (message: InAppMessage) => {
    // Resend by updating the message to be active again (and optionally update timestamps)
    try {
      setLoading(true);
      await messageService.updateMessage(message.id, {
        ...message,
        eventTrigger: message.eventTrigger,
        segment: message.segment,
      });
      await messageService.toggleMessageStatus(message.id, true);
      alert('Message reactivated and ready to be sent again!');
      loadMessages();
    } catch (error) {
      console.error('Failed to resend message:', error);
      alert('Failed to resend message.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    setLoading(true);
    try {
      await messageService.deleteMessage(messageId);
      alert('Message deleted successfully!');
      loadMessages();
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDER ====================

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
          In-App Messages
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm">
          Create, manage, and track event-based messages for your users
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="mb-6 flex gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl w-fit">
        <button
          onClick={() => setSubTab('manage')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            subTab === 'manage'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <i className="fa-solid fa-envelope mr-2"></i>
          Manage Messages
        </button>
        <button
          onClick={() => setSubTab('analytics')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            subTab === 'analytics'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <i className="fa-solid fa-chart-line mr-2"></i>
          Analytics
        </button>
      </div>

      {/* Manage Messages Tab */}
      {subTab === 'manage' && (
        <>
          {/* Action Buttons */}
          <div className="mb-6 flex gap-3">
            <button
              onClick={() => {
                resetForm();
                setShowForm(!showForm);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-md transition-colors"
            >
              <i className="fa-solid fa-plus mr-2"></i>
              New Message
            </button>
            <button
              onClick={loadMessages}
              disabled={loading}
              className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white rounded-md transition-colors disabled:opacity-50"
            >
              <i className="fa-solid fa-rotate-right mr-2"></i>
              Refresh
            </button>
          </div>

      {/* Message Form */}
      {showForm && (
        <div className="mb-8 p-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
            {editingId ? 'Edit Message' : 'Create New Message'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title & Body */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Welcome to Pulse!"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Body *
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Get started by sending your first message..."
                />
              </div>
            </div>

            {/* CTA */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  CTA Button Text
                </label>
                <input
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Get Started"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  CTA URL
                </label>
                <input
                  type="text"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., /messages"
                />
              </div>
            </div>

            {/* Trigger & Segment */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Trigger Event *
                </label>
                <select
                  value={triggerEvent}
                  onChange={(e) => setTriggerEvent(e.target.value as MessageEventTrigger)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(TRIGGER_EVENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Target Segment *
                </label>
                <select
                  value={targetSegment}
                  onChange={(e) => setTargetSegment(e.target.value as UserSegment)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(SEGMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Segment Filter (for custom segments) */}
            {targetSegment === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Segment Filter (JSON)
                </label>
                <textarea
                  value={segmentFilter}
                  onChange={(e) => setSegmentFilter(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder='{"days_since_signup": "< 7"}'
                />
              </div>
            )}

            {/* Scheduling */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Start Date (optional)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  End Date (optional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Recurring Schedule
                </label>
                <select
                  value={recurringSchedule}
                  onChange={(e) => setRecurringSchedule(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {RECURRING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Display Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Position
                </label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as any)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                  <option value="center">Center</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Style Type
                </label>
                <select
                  value={styleType}
                  onChange={(e) => setStyleType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="info">Info (Blue)</option>
                  <option value="success">Success (Green)</option>
                  <option value="warning">Warning (Orange)</option>
                  <option value="tip">Tip (Purple)</option>
                </select>
              </div>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Priority (higher = shows first)
                </label>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  min={0}
                  max={100}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Auto-Dismiss (seconds)
                </label>
                <select
                  value={autoDismiss}
                  onChange={(e) => setAutoDismiss(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {AUTO_DISMISS_PRESETS.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds}s
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="active" className="ml-2 text-sm text-zinc-700 dark:text-zinc-300">
                Active (message will be shown when triggered)
              </label>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingId ? 'Update Message' : 'Create Message'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                  if (onCancel) onCancel();
                }}
                className="px-6 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Messages List */}
      <div className="space-y-4">
        {loading && messages.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 dark:text-zinc-400">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 dark:text-zinc-400">
            No messages yet. Create your first one!
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className="p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {message.title}
                    {!message.isActive && (
                      <span className="ml-2 px-2 py-1 text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded">
                        Inactive
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    {message.body}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(message)}
                    className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded transition-colors"
                  >
                    <i className="fa-solid fa-pen-to-square mr-1"></i>
                    Edit
                  </button>
                  <button
                    onClick={() => handleResend(message)}
                    className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-300 rounded transition-colors"
                  >
                    <i className="fa-solid fa-paper-plane mr-1"></i>
                    Resend
                  </button>
                  <button
                    onClick={() => handleDelete(message.id)}
                    className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded transition-colors"
                  >
                    <i className="fa-solid fa-trash mr-1"></i>
                    Delete
                  </button>
                </div>
              </div>

              <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-500 mt-3">
                <span>
                  <i className="fa-solid fa-bolt mr-1"></i>
                  {TRIGGER_EVENT_LABELS[message.eventTrigger] || message.eventTrigger}
                </span>
                <span>
                  <i className="fa-solid fa-users mr-1"></i>
                  {SEGMENT_LABELS[message.segment] || message.segment}
                </span>
                <span>
                  <i className="fa-solid fa-star mr-1"></i>
                  Priority: {message.priority}
                </span>
                <span>
                  <i className="fa-solid fa-palette mr-1"></i>
                  {message.styleType}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
        </>
      )}

      {/* Analytics Tab */}
      {subTab === 'analytics' && (
        <div className="space-y-6">
          {/* Message Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Select Message to Analyze
            </label>
            <select
              value={selectedAnalyticsMessage?.id || ''}
              onChange={(e) => {
                const message = messages.find((m) => m.id === e.target.value);
                setSelectedAnalyticsMessage(message || null);
              }}
              className="w-full md:w-96 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              {messages.map((message) => (
                <option key={message.id} value={message.id}>
                  {message.title} {!message.isActive && '(Inactive)'}
                </option>
              ))}
            </select>
          </div>

          {/* Metrics Cards */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Total Shown */}
              <div className="p-5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Total Shown</span>
                  <i className="fa-solid fa-eye text-zinc-400 dark:text-zinc-600"></i>
                </div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {metrics.totalShown.toLocaleString()}
                </div>
              </div>

              {/* Open Rate */}
              <div className="p-5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Open Rate</span>
                  <i className="fa-solid fa-envelope-open text-zinc-400 dark:text-zinc-600"></i>
                </div>
                <div className={`text-2xl font-bold ${getMetricColor(metrics.openRate)}`}>
                  {metrics.openRate.toFixed(1)}%
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {metrics.totalOpened} opens
                </div>
              </div>

              {/* Click Rate */}
              <div className="p-5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Click Rate</span>
                  <i className="fa-solid fa-mouse-pointer text-zinc-400 dark:text-zinc-600"></i>
                </div>
                <div className={`text-2xl font-bold ${getMetricColor(metrics.clickRate)}`}>
                  {metrics.clickRate.toFixed(1)}%
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {metrics.totalClicked} clicks
                </div>
              </div>

              {/* Total Dismissed */}
              <div className="p-5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Dismissed</span>
                  <i className="fa-solid fa-times-circle text-zinc-400 dark:text-zinc-600"></i>
                </div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {metrics.totalDismissed.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Engagement Funnel */}
          {metrics && (
            <div className="p-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                Engagement Funnel
              </h2>

              <div className="space-y-4">
                {/* Shown */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Shown</span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {metrics.totalShown}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full"
                      style={{ width: '100%' }}
                    ></div>
                  </div>
                </div>

                {/* Opened */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Opened</span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {metrics.totalOpened} ({metrics.openRate.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5">
                    <div
                      className="bg-green-600 dark:bg-green-500 h-2.5 rounded-full"
                      style={{ width: `${Math.min(100, metrics.openRate)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Clicked */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Clicked</span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {metrics.totalClicked} ({metrics.clickRate.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5">
                    <div
                      className="bg-purple-600 dark:bg-purple-500 h-2.5 rounded-full"
                      style={{ width: `${Math.min(100, metrics.clickRate)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <div className="text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">Avg Time to Action:</span>
                  <span className="ml-2 font-medium text-zinc-900 dark:text-white">
                    {metrics.avgTimeToAction.toFixed(1)}s
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Retention Impact */}
          <div className="p-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Retention Impact by Message Exposure
            </h2>

            {retentionData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-zinc-700 dark:text-zinc-300 font-medium">
                        Exposed
                      </th>
                      <th className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300 font-medium">
                        Users
                      </th>
                      <th className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300 font-medium">
                        Day 1
                      </th>
                      <th className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300 font-medium">
                        Day 7
                      </th>
                      <th className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300 font-medium">
                        Day 30
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {retentionData.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                              row.exposedToMessages
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {row.exposedToMessages ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-900 dark:text-white font-medium">
                          {row.userCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={getMetricColor(row.day1Retention)}>
                            {row.day1Retention.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={getMetricColor(row.day7Retention)}>
                            {row.day7Retention.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={getMetricColor(row.day30Retention)}>
                            {row.day30Retention.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-600 dark:text-zinc-400">
                No retention data available yet. Data will appear as users engage with messages.
              </div>
            )}

            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="flex items-start gap-3">
                <i className="fa-solid fa-info-circle text-blue-600 dark:text-blue-400 mt-0.5"></i>
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Insight:</strong> Users with higher message engagement typically show better
                  retention rates. Use this data to optimize your messaging strategy.
                </div>
              </div>
            </div>
          </div>

          {analyticsLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminMessageEditor;
