import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';

// Types
interface SmartReminder {
  id: string;
  type: 'follow-up' | 'deadline' | 'check-in' | 'birthday' | 'anniversary' | 'custom' | 'ai-suggested';
  title: string;
  description?: string;
  contactId?: string;
  contactName?: string;
  conversationId?: string;
  messageId?: string;
  messagePreview?: string;
  dueDate: Date;
  createdAt: Date;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'pending' | 'snoozed' | 'completed' | 'dismissed';
  snoozedUntil?: Date;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  aiConfidence?: number;
  aiReason?: string;
  tags: string[];
}

interface AIReminderSuggestion {
  id: string;
  type: SmartReminder['type'];
  title: string;
  reason: string;
  suggestedDate: Date;
  confidence: number;
  sourceMessageId?: string;
  sourceMessagePreview?: string;
  contactName?: string;
}

interface SmartRemindersProps {
  reminders?: SmartReminder[];
  suggestions?: AIReminderSuggestion[];
  onCreateReminder?: (reminder: Omit<SmartReminder, 'id' | 'createdAt' | 'status'>) => void;
  onCompleteReminder?: (id: string) => void;
  onSnoozeReminder?: (id: string, until: Date) => void;
  onDismissReminder?: (id: string) => void;
  onAcceptSuggestion?: (suggestion: AIReminderSuggestion) => void;
  onDismissSuggestion?: (suggestionId: string) => void;
  onClose?: () => void;
}

// Mock data generators
const generateMockReminders = (): SmartReminder[] => {
  const now = new Date();
  return [
    {
      id: 'rem-1',
      type: 'follow-up',
      title: 'Follow up with Alice about proposal',
      description: 'She mentioned she\'d review by EOD',
      contactName: 'Alice Johnson',
      conversationId: 'conv-1',
      messagePreview: 'I\'ll review the proposal and get back to you by end of day',
      dueDate: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      priority: 'high',
      status: 'pending',
      tags: ['work', 'proposal'],
    },
    {
      id: 'rem-2',
      type: 'deadline',
      title: 'Submit quarterly report',
      description: 'Q4 report due to finance team',
      dueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      priority: 'urgent',
      status: 'pending',
      tags: ['work', 'report'],
    },
    {
      id: 'rem-3',
      type: 'check-in',
      title: 'Check in with Bob on project status',
      contactName: 'Bob Smith',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      priority: 'medium',
      status: 'pending',
      recurrence: 'weekly',
      tags: ['team'],
    },
    {
      id: 'rem-4',
      type: 'birthday',
      title: 'Diana\'s Birthday',
      contactName: 'Diana Prince',
      dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      priority: 'low',
      status: 'pending',
      recurrence: 'yearly',
      tags: ['personal'],
    },
  ];
};

const generateMockSuggestions = (): AIReminderSuggestion[] => {
  const now = new Date();
  return [
    {
      id: 'sug-1',
      type: 'follow-up',
      title: 'Follow up on meeting notes',
      reason: 'Charlie mentioned they\'d send meeting notes 2 days ago but hasn\'t yet',
      suggestedDate: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      confidence: 0.92,
      sourceMessagePreview: 'I\'ll send over the meeting notes tomorrow',
      contactName: 'Charlie Brown',
    },
    {
      id: 'sug-2',
      type: 'check-in',
      title: 'Check on Eve\'s progress',
      reason: 'Eve has been quiet for 5 days after starting a critical task',
      suggestedDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      confidence: 0.85,
      contactName: 'Eve Wilson',
    },
    {
      id: 'sug-3',
      type: 'deadline',
      title: 'Review contract before signing',
      reason: 'Contract discussion mentioned a 7-day review period that ends soon',
      suggestedDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      confidence: 0.78,
      sourceMessagePreview: 'Please review and sign within 7 days',
      contactName: 'Legal Team',
    },
  ];
};

export const SmartReminders: React.FC<SmartRemindersProps> = ({
  reminders: propReminders,
  suggestions: propSuggestions,
  onCreateReminder,
  onCompleteReminder,
  onSnoozeReminder,
  onDismissReminder,
  onAcceptSuggestion,
  onDismissSuggestion,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'suggestions' | 'completed' | 'create'>('upcoming');
  const [filterPriority, setFilterPriority] = useState<'all' | SmartReminder['priority']>('all');
  const [showSnoozeMenu, setShowSnoozeMenu] = useState<string | null>(null);
  const [newReminder, setNewReminder] = useState({
    title: '',
    type: 'follow-up' as SmartReminder['type'],
    priority: 'medium' as SmartReminder['priority'],
    dueDate: '',
    dueTime: '',
    description: '',
    recurrence: 'none' as SmartReminder['recurrence'],
  });
  const [showTabDropdown, setShowTabDropdown] = useState(false);
  const [useDropdownTabs, setUseDropdownTabs] = useState(false);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Check if tabs overflow and switch to dropdown mode
  useEffect(() => {
    const checkTabsOverflow = () => {
      if (tabsContainerRef.current) {
        const container = tabsContainerRef.current;
        setUseDropdownTabs(container.scrollWidth > container.clientWidth || container.clientWidth < 400);
      }
    };

    checkTabsOverflow();
    window.addEventListener('resize', checkTabsOverflow);
    return () => window.removeEventListener('resize', checkTabsOverflow);
  }, []);

  // Use provided or mock data
  const reminders = useMemo(() => propReminders || generateMockReminders(), [propReminders]);
  const suggestions = useMemo(() => propSuggestions || generateMockSuggestions(), [propSuggestions]);

  // Filter reminders
  const filteredReminders = useMemo(() => {
    let result = reminders.filter(r => {
      if (activeTab === 'upcoming') return r.status === 'pending' || r.status === 'snoozed';
      if (activeTab === 'completed') return r.status === 'completed';
      return true;
    });

    if (filterPriority !== 'all') {
      result = result.filter(r => r.priority === filterPriority);
    }

    return result.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [reminders, activeTab, filterPriority]);

  // Group reminders by date
  const groupedReminders = useMemo(() => {
    const groups: { [key: string]: SmartReminder[] } = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    filteredReminders.forEach(reminder => {
      const dueDate = new Date(reminder.dueDate);
      let key: string;

      if (dueDate < now && reminder.status === 'pending') {
        key = 'Overdue';
      } else if (dueDate < tomorrow) {
        key = 'Today';
      } else if (dueDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)) {
        key = 'Tomorrow';
      } else if (dueDate < weekEnd) {
        key = 'This Week';
      } else {
        key = 'Later';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(reminder);
    });

    return groups;
  }, [filteredReminders]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (diff < 0) {
      const absDays = Math.abs(days);
      if (absDays === 0) return 'Today';
      if (absDays === 1) return 'Yesterday';
      return `${absDays} days ago`;
    }

    if (hours < 1) return 'In less than an hour';
    if (hours < 24) return `In ${hours} hours`;
    if (days === 1) return 'Tomorrow';
    if (days < 7) return `In ${days} days`;
    return date.toLocaleDateString();
  };

  const getPriorityColor = (priority: SmartReminder['priority']) => {
    switch (priority) {
      case 'urgent': return '#EF4444';
      case 'high': return '#F97316';
      case 'medium': return '#EAB308';
      case 'low': return '#22C55E';
    }
  };

  const getTypeIcon = (type: SmartReminder['type']) => {
    switch (type) {
      case 'follow-up': return '↩️';
      case 'deadline': return '⏰';
      case 'check-in': return '👋';
      case 'birthday': return '🎂';
      case 'anniversary': return '🎉';
      case 'ai-suggested': return '🤖';
      default: return '📌';
    }
  };

  const handleCreateReminder = useCallback(() => {
    if (!newReminder.title || !newReminder.dueDate) return;

    const dueDate = new Date(`${newReminder.dueDate}T${newReminder.dueTime || '09:00'}`);

    onCreateReminder?.({
      type: newReminder.type,
      title: newReminder.title,
      description: newReminder.description || undefined,
      dueDate,
      priority: newReminder.priority,
      recurrence: newReminder.recurrence,
      tags: [],
    });

    setNewReminder({
      title: '',
      type: 'follow-up',
      priority: 'medium',
      dueDate: '',
      dueTime: '',
      description: '',
      recurrence: 'none',
    });
    setActiveTab('upcoming');
  }, [newReminder, onCreateReminder]);

  const snoozeOptions = [
    { label: '1 hour', hours: 1 },
    { label: '4 hours', hours: 4 },
    { label: 'Tomorrow', hours: 24 },
    { label: 'Next week', hours: 168 },
  ];

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(20, 20, 35, 0.98))',
      borderRadius: '16px',
      padding: '24px',
      color: 'white',
      maxWidth: '650px',
      width: '100%',
      maxHeight: '85vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🔔</span>
            Smart Reminders
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            {reminders.filter(r => r.status === 'pending').length} pending · {suggestions.length} suggestions
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Tab Navigation - Responsive with dropdown fallback */}
      {(() => {
        const tabs = [
          { id: 'upcoming', label: 'Upcoming', icon: '📅', count: reminders.filter(r => r.status === 'pending').length },
          { id: 'suggestions', label: 'AI Suggestions', icon: '✨', count: suggestions.length },
          { id: 'completed', label: 'Completed', icon: '✓', count: reminders.filter(r => r.status === 'completed').length },
          { id: 'create', label: 'Create', icon: '+', count: undefined },
        ];
        const activeTabData = tabs.find(t => t.id === activeTab);

        return useDropdownTabs ? (
          /* Dropdown mode for small screens */
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <button
              onClick={() => setShowTabDropdown(!showTabDropdown)}
              style={{
                width: '100%',
                background: 'rgba(245, 158, 11, 0.3)',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{activeTabData?.icon}</span>
                {activeTabData?.label}
                {activeTabData?.count !== undefined && (
                  <span style={{
                    fontSize: '0.7rem',
                    background: 'rgba(255,255,255,0.15)',
                    padding: '2px 6px',
                    borderRadius: '10px',
                  }}>
                    {activeTabData.count}
                  </span>
                )}
              </span>
              <span style={{ transform: showTabDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </button>
            {showTabDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: 'rgba(30, 30, 50, 0.98)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '4px',
                zIndex: 20,
              }}>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as typeof activeTab);
                      setShowTabDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      background: activeTab === tab.id ? 'rgba(245, 158, 11, 0.3)' : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      textAlign: 'left',
                    }}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                    {tab.count !== undefined && (
                      <span style={{
                        fontSize: '0.7rem',
                        background: 'rgba(255,255,255,0.15)',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        marginLeft: 'auto',
                      }}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Regular tabs for larger screens */
          <div
            ref={tabsContainerRef}
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '16px',
              overflow: 'hidden',
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                style={{
                  background: activeTab === tab.id ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.05)',
                  border: activeTab === tab.id ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid transparent',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {tab.count !== undefined && (
                  <span style={{
                    fontSize: '0.7rem',
                    background: 'rgba(255,255,255,0.15)',
                    padding: '2px 6px',
                    borderRadius: '10px',
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        );
      })()}

      {/* Filter Bar (for upcoming tab) */}
      {activeTab === 'upcoming' && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
        }}>
          {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((priority) => (
            <button
              key={priority}
              onClick={() => setFilterPriority(priority)}
              style={{
                background: filterPriority === priority ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                color: priority === 'all' ? 'white' : getPriorityColor(priority as SmartReminder['priority']),
                cursor: 'pointer',
                fontSize: '0.75rem',
                textTransform: 'capitalize',
              }}
            >
              {priority}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Upcoming Reminders */}
        {activeTab === 'upcoming' && (
          <div>
            {Object.keys(groupedReminders).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>🎉</span>
                <p>All caught up! No pending reminders.</p>
              </div>
            ) : (
              Object.entries(groupedReminders).map(([group, items]) => (
                <div key={group} style={{ marginBottom: '20px' }}>
                  <h3 style={{
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    opacity: 0.5,
                    marginBottom: '10px',
                    color: group === 'Overdue' ? '#EF4444' : 'inherit',
                  }}>
                    {group}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {items.map((reminder) => (
                      <div
                        key={reminder.id}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '12px',
                          padding: '14px',
                          borderLeft: `3px solid ${getPriorityColor(reminder.priority)}`,
                          position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <span style={{ fontSize: '1.3rem' }}>{getTypeIcon(reminder.type)}</span>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                              {reminder.title}
                            </div>

                            {reminder.description && (
                              <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: '0 0 8px' }}>
                                {reminder.description}
                              </p>
                            )}

                            {reminder.contactName && (
                              <div style={{
                                fontSize: '0.8rem',
                                opacity: 0.6,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}>
                                <span>👤</span> {reminder.contactName}
                              </div>
                            )}

                            {reminder.messagePreview && (
                              <div style={{
                                fontSize: '0.8rem',
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                marginTop: '8px',
                                fontStyle: 'italic',
                                opacity: 0.7,
                              }}>
                                "{reminder.messagePreview}"
                              </div>
                            )}

                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              marginTop: '10px',
                              fontSize: '0.75rem',
                            }}>
                              <span style={{ opacity: 0.6 }}>
                                🕐 {formatDate(reminder.dueDate)}
                              </span>
                              {reminder.recurrence !== 'none' && reminder.recurrence && (
                                <span style={{
                                  background: 'rgba(139, 92, 246, 0.2)',
                                  color: '#a78bfa',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                }}>
                                  🔄 {reminder.recurrence}
                                </span>
                              )}
                              {reminder.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {reminder.tags.map(tag => (
                                    <span key={tag} style={{
                                      background: 'rgba(255,255,255,0.1)',
                                      padding: '2px 6px',
                                      borderRadius: '8px',
                                    }}>
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={() => onCompleteReminder?.(reminder.id)}
                              style={{
                                background: 'rgba(34, 197, 94, 0.2)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                color: '#4ade80',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                              }}
                              title="Complete"
                            >
                              ✓
                            </button>
                            <div style={{ position: 'relative' }}>
                              <button
                                onClick={() => setShowSnoozeMenu(showSnoozeMenu === reminder.id ? null : reminder.id)}
                                style={{
                                  background: 'rgba(255,255,255,0.1)',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 10px',
                                  color: 'white',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                }}
                                title="Snooze"
                              >
                                💤
                              </button>
                              {showSnoozeMenu === reminder.id && (
                                <div style={{
                                  position: 'absolute',
                                  top: '100%',
                                  right: 0,
                                  marginTop: '4px',
                                  background: 'rgba(30, 30, 50, 0.98)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '8px',
                                  padding: '4px',
                                  zIndex: 10,
                                  minWidth: '120px',
                                }}>
                                  {snoozeOptions.map(option => (
                                    <button
                                      key={option.label}
                                      onClick={() => {
                                        const until = new Date(Date.now() + option.hours * 60 * 60 * 1000);
                                        onSnoozeReminder?.(reminder.id, until);
                                        setShowSnoozeMenu(null);
                                      }}
                                      style={{
                                        width: '100%',
                                        background: 'transparent',
                                        border: 'none',
                                        padding: '8px 12px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        borderRadius: '6px',
                                        fontSize: '0.85rem',
                                      }}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => onDismissReminder?.(reminder.id)}
                              style={{
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                              }}
                              title="Dismiss"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* AI Suggestions */}
        {activeTab === 'suggestions' && (
          <div>
            {suggestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>🤖</span>
                <p>No AI suggestions right now. Check back later!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    style={{
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '12px',
                      padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                        flexShrink: 0,
                      }}>
                        🤖
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 'bold' }}>{suggestion.title}</span>
                          <span style={{
                            fontSize: '0.7rem',
                            background: 'rgba(255,255,255,0.1)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                          }}>
                            {Math.round(suggestion.confidence * 100)}% confident
                          </span>
                        </div>

                        <p style={{ fontSize: '0.85rem', opacity: 0.8, margin: '0 0 10px' }}>
                          {suggestion.reason}
                        </p>

                        {suggestion.sourceMessagePreview && (
                          <div style={{
                            fontSize: '0.8rem',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            marginBottom: '10px',
                            fontStyle: 'italic',
                            opacity: 0.7,
                          }}>
                            "{suggestion.sourceMessagePreview}"
                          </div>
                        )}

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}>
                          <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                            {suggestion.contactName && <span>👤 {suggestion.contactName} · </span>}
                            <span>📅 {formatDate(suggestion.suggestedDate)}</span>
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => onDismissSuggestion?.(suggestion.id)}
                              style={{
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                color: 'rgba(255,255,255,0.6)',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                              }}
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => onAcceptSuggestion?.(suggestion)}
                              style={{
                                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                              }}
                            >
                              Add Reminder
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Completed */}
        {activeTab === 'completed' && (
          <div>
            {filteredReminders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                <p>No completed reminders yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '10px',
                      padding: '12px',
                      opacity: 0.7,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: '#4ade80' }}>✓</span>
                      <span style={{ textDecoration: 'line-through' }}>{reminder.title}</span>
                      {reminder.contactName && (
                        <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                          · {reminder.contactName}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Form */}
        {activeTab === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                Title *
              </label>
              <input
                type="text"
                value={newReminder.title}
                onChange={(e) => setNewReminder(prev => ({ ...prev, title: e.target.value }))}
                placeholder="What do you need to remember?"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                  Type
                </label>
                <select
                  value={newReminder.type}
                  onChange={(e) => setNewReminder(prev => ({ ...prev, type: e.target.value as SmartReminder['type'] }))}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  <option value="follow-up">Follow-up</option>
                  <option value="deadline">Deadline</option>
                  <option value="check-in">Check-in</option>
                  <option value="birthday">Birthday</option>
                  <option value="anniversary">Anniversary</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                  Priority
                </label>
                <select
                  value={newReminder.priority}
                  onChange={(e) => setNewReminder(prev => ({ ...prev, priority: e.target.value as SmartReminder['priority'] }))}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={newReminder.dueDate}
                  onChange={(e) => setNewReminder(prev => ({ ...prev, dueDate: e.target.value }))}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: 'white',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                  Time
                </label>
                <input
                  type="time"
                  value={newReminder.dueTime}
                  onChange={(e) => setNewReminder(prev => ({ ...prev, dueTime: e.target.value }))}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: 'white',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                Recurrence
              </label>
              <select
                value={newReminder.recurrence}
                onChange={(e) => setNewReminder(prev => ({ ...prev, recurrence: e.target.value as SmartReminder['recurrence'] }))}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                <option value="none">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                Notes
              </label>
              <textarea
                value={newReminder.description}
                onChange={(e) => setNewReminder(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Add any additional notes..."
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white',
                  resize: 'none',
                  outline: 'none',
                }}
              />
            </div>

            <button
              onClick={handleCreateReminder}
              disabled={!newReminder.title || !newReminder.dueDate}
              style={{
                background: newReminder.title && newReminder.dueDate
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '10px',
                padding: '14px',
                color: 'white',
                cursor: newReminder.title && newReminder.dueDate ? 'pointer' : 'not-allowed',
                fontWeight: 'bold',
                fontSize: '1rem',
              }}
            >
              Create Reminder
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Reminder notification badge
export const ReminderBadge: React.FC<{
  count: number;
  hasUrgent?: boolean;
  onClick?: () => void;
}> = ({ count, hasUrgent = false, onClick }) => {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      style={{
        background: hasUrgent ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
        border: `1px solid ${hasUrgent ? 'rgba(239, 68, 68, 0.5)' : 'rgba(245, 158, 11, 0.5)'}`,
        borderRadius: '20px',
        padding: '4px 12px',
        color: hasUrgent ? '#f87171' : '#fbbf24',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.85rem',
      }}
    >
      <span>🔔</span>
      <span>{count}</span>
      {hasUrgent && <span style={{ fontSize: '0.7rem' }}>!</span>}
    </button>
  );
};

export default SmartReminders;
