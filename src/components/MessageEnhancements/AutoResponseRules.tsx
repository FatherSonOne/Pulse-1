import React, { useState, useMemo, useCallback } from 'react';

// Types
interface RuleCondition {
  type: 'keyword' | 'sender' | 'time' | 'day' | 'contact_group' | 'message_type' | 'sentiment';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'between' | 'in' | 'not_in';
  value: string | string[] | { start: string; end: string };
}

interface RuleAction {
  type: 'reply' | 'forward' | 'label' | 'archive' | 'notify' | 'delay_response' | 'ai_generate';
  config: Record<string, any>;
}

interface AutoResponseRule {
  id: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  priority: number;
  conditions: RuleCondition[];
  conditionLogic: 'all' | 'any';
  actions: RuleAction[];
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
  schedule?: {
    enabled: boolean;
    startTime?: string;
    endTime?: string;
    days?: string[];
  };
}

interface AutoResponseRulesProps {
  onRuleCreate?: (rule: Omit<AutoResponseRule, 'id' | 'createdAt' | 'triggerCount'>) => void;
  onRuleUpdate?: (rule: AutoResponseRule) => void;
  onRuleDelete?: (ruleId: string) => void;
  onRuleToggle?: (ruleId: string, enabled: boolean) => void;
}

// Mock data
const generateMockRules = (): AutoResponseRule[] => [
  {
    id: 'r1',
    name: 'Out of Office Reply',
    description: 'Auto-reply when I am away',
    isEnabled: true,
    priority: 1,
    conditions: [
      { type: 'time', operator: 'between', value: { start: '18:00', end: '09:00' } }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'reply', config: { message: "Thanks for your message! I'm currently out of office and will respond tomorrow.", delay: 60 } }
    ],
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000),
    triggerCount: 45,
    schedule: { enabled: true, startTime: '18:00', endTime: '09:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }
  },
  {
    id: 'r2',
    name: 'Urgent Message Handler',
    description: 'Forward urgent messages to my phone',
    isEnabled: true,
    priority: 2,
    conditions: [
      { type: 'keyword', operator: 'contains', value: 'urgent' },
      { type: 'keyword', operator: 'contains', value: 'ASAP' }
    ],
    conditionLogic: 'any',
    actions: [
      { type: 'notify', config: { sound: 'urgent', vibrate: true } },
      { type: 'label', config: { label: 'Urgent' } }
    ],
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    lastTriggered: new Date(Date.now() - 5 * 60 * 60 * 1000),
    triggerCount: 23
  },
  {
    id: 'r3',
    name: 'Weekend Auto-Reply',
    description: 'Polite response on weekends',
    isEnabled: false,
    priority: 3,
    conditions: [
      { type: 'day', operator: 'in', value: ['Sat', 'Sun'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'reply', config: { message: "Hi! I'm taking the weekend off. I'll get back to you on Monday!", delay: 300 } }
    ],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    triggerCount: 12,
    schedule: { enabled: true, days: ['Sat', 'Sun'] }
  },
  {
    id: 'r4',
    name: 'VIP Contact Priority',
    description: 'Immediate notification for VIP contacts',
    isEnabled: true,
    priority: 1,
    conditions: [
      { type: 'contact_group', operator: 'in', value: ['VIP', 'Executives'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'notify', config: { sound: 'vip', priority: 'high' } },
      { type: 'label', config: { label: 'VIP' } }
    ],
    createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    lastTriggered: new Date(Date.now() - 30 * 60 * 1000),
    triggerCount: 67
  },
  {
    id: 'r5',
    name: 'AI Smart Response',
    description: 'Generate contextual AI responses for common questions',
    isEnabled: true,
    priority: 5,
    conditions: [
      { type: 'message_type', operator: 'equals', value: 'question' },
      { type: 'sentiment', operator: 'in', value: ['neutral', 'positive'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'ai_generate', config: { tone: 'professional', maxLength: 200 } }
    ],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    lastTriggered: new Date(Date.now() - 15 * 60 * 1000),
    triggerCount: 34
  }
];

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#0a0a0f',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  createButton: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#8B5CF6',
    color: 'white',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 20px'
  },
  ruleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    transition: 'all 0.2s ease'
  },
  ruleHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '12px'
  },
  ruleInfo: {
    flex: 1
  },
  ruleName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  ruleDescription: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '4px'
  },
  toggle: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    position: 'relative' as const,
    transition: 'background-color 0.2s ease'
  },
  toggleKnob: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'white',
    position: 'absolute' as const,
    top: '2px',
    transition: 'left 0.2s ease',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
  },
  conditionsSection: {
    marginBottom: '12px'
  },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '8px'
  },
  conditionPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '6px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#60a5fa',
    fontSize: '11px',
    marginRight: '6px',
    marginBottom: '6px'
  },
  actionPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '6px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    fontSize: '11px',
    marginRight: '6px',
    marginBottom: '6px'
  },
  logicBadge: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#a78bfa'
  },
  ruleFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
  },
  stats: {
    display: 'flex',
    gap: '16px',
    fontSize: '11px',
    color: '#64748b'
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  actions: {
    display: 'flex',
    gap: '6px'
  },
  actionButton: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s ease'
  },
  priorityBadge: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: 700,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#fbbf24'
  },
  scheduleBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '6px',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    fontSize: '10px',
    color: '#a78bfa'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#64748b'
  },
  modal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: '#1a1a24',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflow: 'auto',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  modalHeader: {
    padding: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modalBody: {
    padding: '20px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#94a3b8',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: '80px'
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer'
  },
  modalFooter: {
    padding: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  cancelButton: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500
  },
  saveButton: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#8B5CF6',
    color: 'white',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500
  }
};

// Condition type icons
const conditionIcons: Record<string, string> = {
  keyword: 'fa-font',
  sender: 'fa-user',
  time: 'fa-clock',
  day: 'fa-calendar-day',
  contact_group: 'fa-users',
  message_type: 'fa-message',
  sentiment: 'fa-face-smile'
};

// Action type icons
const actionIcons: Record<string, string> = {
  reply: 'fa-reply',
  forward: 'fa-share',
  label: 'fa-tag',
  archive: 'fa-box-archive',
  notify: 'fa-bell',
  delay_response: 'fa-clock',
  ai_generate: 'fa-robot'
};

// Format condition for display
const formatCondition = (condition: RuleCondition): string => {
  const value = typeof condition.value === 'object' && 'start' in condition.value
    ? `${condition.value.start} - ${condition.value.end}`
    : Array.isArray(condition.value)
    ? condition.value.join(', ')
    : condition.value;

  return `${condition.type.replace('_', ' ')} ${condition.operator.replace('_', ' ')} "${value}"`;
};

// Format action for display
const formatAction = (action: RuleAction): string => {
  switch (action.type) {
    case 'reply':
      return `Auto-reply after ${action.config.delay || 0}s`;
    case 'forward':
      return `Forward to ${action.config.to}`;
    case 'label':
      return `Add label "${action.config.label}"`;
    case 'notify':
      return `Send ${action.config.priority || 'normal'} notification`;
    case 'ai_generate':
      return `AI response (${action.config.tone})`;
    default:
      return action.type.replace('_', ' ');
  }
};

// Format date
const formatDate = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// Main Component
export const AutoResponseRules: React.FC<AutoResponseRulesProps> = ({
  onRuleCreate,
  onRuleUpdate,
  onRuleDelete,
  onRuleToggle
}) => {
  const [rules, setRules] = useState<AutoResponseRule[]>(() => generateMockRules());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoResponseRule | null>(null);

  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => a.priority - b.priority);
  }, [rules]);

  const handleToggle = useCallback((ruleId: string) => {
    setRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, isEnabled: !r.isEnabled } : r
    ));
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      onRuleToggle?.(ruleId, !rule.isEnabled);
    }
  }, [rules, onRuleToggle]);

  const handleDelete = useCallback((ruleId: string) => {
    setRules(prev => prev.filter(r => r.id !== ruleId));
    onRuleDelete?.(ruleId);
  }, [onRuleDelete]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <i className="fa-solid fa-robot" />
          Auto-Response Rules
        </div>
        <button
          style={styles.createButton}
          onClick={() => setShowCreateModal(true)}
        >
          <i className="fa-solid fa-plus" />
          Create Rule
        </button>
      </div>

      <div style={styles.list}>
        {sortedRules.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>No auto-response rules yet</div>
            <div style={{ fontSize: '12px' }}>Create rules to automate your responses</div>
          </div>
        ) : (
          sortedRules.map(rule => (
            <div
              key={rule.id}
              style={{
                ...styles.ruleCard,
                opacity: rule.isEnabled ? 1 : 0.6
              }}
            >
              <div style={styles.ruleHeader}>
                <div style={styles.ruleInfo}>
                  <div style={styles.ruleName}>
                    {rule.name}
                    <span style={styles.priorityBadge}>P{rule.priority}</span>
                    {!rule.isEnabled && (
                      <span style={{ fontSize: '10px', color: '#64748b' }}>Disabled</span>
                    )}
                  </div>
                  {rule.description && (
                    <div style={styles.ruleDescription}>{rule.description}</div>
                  )}
                </div>
                <button
                  style={{
                    ...styles.toggle,
                    backgroundColor: rule.isEnabled ? '#8B5CF6' : 'rgba(255, 255, 255, 0.1)'
                  }}
                  onClick={() => handleToggle(rule.id)}
                >
                  <div style={{
                    ...styles.toggleKnob,
                    left: rule.isEnabled ? '22px' : '2px'
                  }} />
                </button>
              </div>

              <div style={styles.conditionsSection}>
                <div style={styles.sectionLabel}>
                  Conditions <span style={styles.logicBadge}>{rule.conditionLogic}</span>
                </div>
                {rule.conditions.map((condition, i) => (
                  <span key={i} style={styles.conditionPill}>
                    <i className={`fa-solid ${conditionIcons[condition.type]}`} />
                    {formatCondition(condition)}
                  </span>
                ))}
              </div>

              <div>
                <div style={styles.sectionLabel}>Actions</div>
                {rule.actions.map((action, i) => (
                  <span key={i} style={styles.actionPill}>
                    <i className={`fa-solid ${actionIcons[action.type]}`} />
                    {formatAction(action)}
                  </span>
                ))}
              </div>

              {rule.schedule?.enabled && (
                <div style={{ marginTop: '12px' }}>
                  <div style={styles.scheduleBadge}>
                    <i className="fa-solid fa-calendar" />
                    {rule.schedule.startTime && rule.schedule.endTime
                      ? `${rule.schedule.startTime} - ${rule.schedule.endTime}`
                      : 'Scheduled'}
                    {rule.schedule.days && ` (${rule.schedule.days.join(', ')})`}
                  </div>
                </div>
              )}

              <div style={styles.ruleFooter}>
                <div style={styles.stats}>
                  <div style={styles.statItem}>
                    <i className="fa-solid fa-bolt" />
                    {rule.triggerCount} triggers
                  </div>
                  {rule.lastTriggered && (
                    <div style={styles.statItem}>
                      <i className="fa-solid fa-clock" />
                      Last: {formatDate(rule.lastTriggered)}
                    </div>
                  )}
                </div>
                <div style={styles.actions}>
                  <button
                    style={styles.actionButton}
                    onClick={() => setEditingRule(rule)}
                  >
                    <i className="fa-solid fa-pen" />
                    Edit
                  </button>
                  <button
                    style={styles.actionButton}
                    onClick={() => handleDelete(rule.id)}
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal would go here - simplified for brevity */}
      {(showCreateModal || editingRule) && (
        <div style={styles.modal} onClick={() => { setShowCreateModal(false); setEditingRule(null); }}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={{ fontSize: '16px', fontWeight: 600 }}>
                {editingRule ? 'Edit Rule' : 'Create New Rule'}
              </span>
              <button
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                onClick={() => { setShowCreateModal(false); setEditingRule(null); }}
              >
                <i className="fa-solid fa-times" />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Rule Name</label>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="e.g., Out of Office Reply"
                  defaultValue={editingRule?.name}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="Brief description of what this rule does"
                  defaultValue={editingRule?.description}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Condition Type</label>
                <select style={styles.select}>
                  <option value="keyword">Keyword Match</option>
                  <option value="sender">Sender</option>
                  <option value="time">Time Range</option>
                  <option value="day">Day of Week</option>
                  <option value="contact_group">Contact Group</option>
                  <option value="sentiment">Sentiment</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Action Type</label>
                <select style={styles.select}>
                  <option value="reply">Auto Reply</option>
                  <option value="forward">Forward Message</option>
                  <option value="label">Add Label</option>
                  <option value="notify">Send Notification</option>
                  <option value="ai_generate">AI Generate Response</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Response Message</label>
                <textarea
                  style={styles.textarea}
                  placeholder="Enter your auto-response message..."
                  defaultValue={editingRule?.actions[0]?.config?.message}
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button
                style={styles.cancelButton}
                onClick={() => { setShowCreateModal(false); setEditingRule(null); }}
              >
                Cancel
              </button>
              <button style={styles.saveButton}>
                {editingRule ? 'Save Changes' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Quick toggle for rule status
export const RuleStatusToggle: React.FC<{
  ruleId: string;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}> = ({ ruleId, isEnabled, onToggle }) => {
  return (
    <button
      onClick={() => onToggle(!isEnabled)}
      style={{
        padding: '4px 8px',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: isEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
        color: isEnabled ? '#34d399' : '#f87171',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 500
      }}
    >
      {isEnabled ? 'Active' : 'Inactive'}
    </button>
  );
};

export default AutoResponseRules;
