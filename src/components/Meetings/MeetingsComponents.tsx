import React from 'react';
import { Contact, CalendarEvent, ArchiveItem } from '../../types';

// ============================================
// TYPES
// ============================================

export type Platform = 'pulse' | 'google_meet' | 'zoom' | 'skype' | 'teams';

export interface MeetingTemplate {
  id: string;
  name: string;
  description: string;
  duration: number; // minutes
  defaultAgenda: string[];
  icon: string;
}

export interface AgendaItem {
  id: string;
  title: string;
  duration: number; // minutes
  presenter?: string;
  notes?: string;
  completed?: boolean;
}

export interface ActionItem {
  id: string;
  title: string;
  assignee?: Contact;
  dueDate?: Date;
  status: 'pending' | 'in_progress' | 'completed';
  meetingId?: string;
  createdAt: Date;
}

export interface MeetingInsights {
  totalMeetings: number;
  totalHours: number;
  avgDuration: number;
  weeklyTrend: number[];
}

export interface RecordingItem {
  id: string;
  meetingTitle: string;
  date: Date;
  duration: number;
  size: string;
  thumbnail?: string;
}

// ============================================
// PLATFORM CONFIGURATION
// ============================================

export const PLATFORMS = [
  {
    id: 'pulse' as Platform,
    label: 'Pulse Video',
    icon: 'fa-bolt',
    color: 'pulse',
    description: 'Native AI Scribe',
    badge: 'Native'
  },
  {
    id: 'google_meet' as Platform,
    label: 'Google Meet',
    icon: 'fa-google',
    color: 'google',
    description: 'External Link'
  },
  {
    id: 'zoom' as Platform,
    label: 'Zoom',
    icon: 'fa-video',
    color: 'zoom',
    description: 'External Link'
  },
  {
    id: 'teams' as Platform,
    label: 'MS Teams',
    icon: 'fa-microsoft',
    color: 'teams',
    description: 'External Link'
  },
];

// ============================================
// MEETING TEMPLATES (NEW FEATURE)
// ============================================

export const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: 'standup',
    name: 'Daily Standup',
    description: '15-min team sync',
    duration: 15,
    defaultAgenda: ['What I did yesterday', 'What I\'m doing today', 'Any blockers'],
    icon: 'fa-users'
  },
  {
    id: 'one-on-one',
    name: '1:1 Meeting',
    description: 'Personal check-in',
    duration: 30,
    defaultAgenda: ['How are you?', 'Current projects', 'Goals & growth', 'Feedback'],
    icon: 'fa-user-group'
  },
  {
    id: 'sprint-planning',
    name: 'Sprint Planning',
    description: 'Plan upcoming work',
    duration: 60,
    defaultAgenda: ['Sprint review', 'Backlog grooming', 'Capacity planning', 'Sprint goals'],
    icon: 'fa-list-check'
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Creative session',
    duration: 45,
    defaultAgenda: ['Define problem', 'Ideation', 'Discussion', 'Next steps'],
    icon: 'fa-lightbulb'
  },
];

// ============================================
// FEATURE CARDS CONFIGURATION
// ============================================

export interface FeatureCardConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconClass: string;
  badge?: string;
  onClick?: () => void;
}

export const FEATURE_CARDS: FeatureCardConfig[] = [
  {
    id: 'templates',
    title: 'Meeting Templates',
    description: 'Start from pre-built templates for standups, 1:1s, planning sessions',
    icon: 'fa-copy',
    iconClass: 'templates',
    badge: '4 templates'
  },
  {
    id: 'agenda',
    title: 'Agenda Builder',
    description: 'Create structured agendas with time blocks and presenters',
    icon: 'fa-list-ol',
    iconClass: 'agenda',
  },
  {
    id: 'actions',
    title: 'Action Items',
    description: 'Track follow-ups with assignees and due dates',
    icon: 'fa-circle-check',
    iconClass: 'actions',
    badge: '3 pending'
  },
  {
    id: 'analytics',
    title: 'Meeting Analytics',
    description: 'Insights on meeting frequency, duration, and patterns',
    icon: 'fa-chart-pie',
    iconClass: 'analytics',
  },
  {
    id: 'recordings',
    title: 'Recordings',
    description: 'Access past meeting recordings and transcripts',
    icon: 'fa-circle-play',
    iconClass: 'recordings',
  },
  {
    id: 'breakout',
    title: 'Breakout Rooms',
    description: 'Split into smaller groups for focused discussions',
    icon: 'fa-arrows-split-up-and-left',
    iconClass: 'breakout',
    badge: 'Coming Soon'
  },
];

// ============================================
// HERO SECTION
// ============================================

interface HeroSectionProps {
  meetingLinkInput: string;
  onInputChange: (value: string) => void;
  onJoin: (e: React.FormEvent) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  meetingLinkInput,
  onInputChange,
  onJoin,
}) => (
  <div className="meetings-hero">
    <div className="meetings-hero-bg">
      <div className="meetings-hero-grid" />
      <div className="meetings-hero-orbit" />
      <div className="meetings-hero-orbit" />
      <div className="meetings-hero-orbit" />
    </div>
    <div className="meetings-hero-content">
      <div className="meetings-hero-icon">
        <i className="fa-solid fa-video" />
      </div>
      <h1 className="meetings-hero-title">Ready to connect?</h1>
      <p className="meetings-hero-subtitle">
        Join a meeting or start an instant video call
      </p>
      <form className="meetings-join-form" onSubmit={onJoin}>
        <input
          type="text"
          className="meetings-join-input"
          placeholder="Paste meeting link or enter code..."
          value={meetingLinkInput}
          onChange={(e) => onInputChange(e.target.value)}
        />
        <button type="submit" className="meetings-join-btn">
          Join
        </button>
      </form>
    </div>
  </div>
);

// ============================================
// PLATFORM CARDS
// ============================================

interface PlatformCardsProps {
  onStartMeeting: (platform: Platform) => void;
  onBulkInvite: (platform: Platform) => void;
}

export const PlatformCards: React.FC<PlatformCardsProps> = ({
  onStartMeeting,
  onBulkInvite,
}) => (
  <div className="meetings-platforms">
    {PLATFORMS.map((platform, index) => (
      <div
        key={platform.id}
        className={`meetings-platform-card ${platform.id === 'pulse' ? 'pulse' : ''}`}
        style={{ animationDelay: `${index * 0.1}s` }}
      >
        {platform.badge && (
          <span className="meetings-platform-badge">{platform.badge}</span>
        )}
        <div className={`meetings-platform-icon ${platform.color}`}>
          <i className={`${platform.icon === 'fa-google' || platform.icon === 'fa-microsoft' ? 'fa-brands' : 'fa-solid'} ${platform.icon}`} />
        </div>
        <div className="meetings-platform-name">{platform.label}</div>
        <div className="meetings-platform-desc">{platform.description}</div>
        <div className="meetings-platform-actions">
          <button
            className="meetings-platform-btn primary"
            onClick={() => onStartMeeting(platform.id)}
          >
            Start
          </button>
          <button
            className="meetings-platform-btn icon"
            onClick={() => onBulkInvite(platform.id)}
            title="Invite contacts"
          >
            <i className="fa-solid fa-user-plus" />
          </button>
        </div>
      </div>
    ))}
  </div>
);

// ============================================
// FEATURE CARDS
// ============================================

interface FeatureCardsProps {
  onFeatureClick: (featureId: string) => void;
  pendingActions?: number;
}

export const FeatureCards: React.FC<FeatureCardsProps> = ({
  onFeatureClick,
  pendingActions = 0,
}) => (
  <div className="meetings-features">
    {FEATURE_CARDS.map((feature, index) => (
      <div
        key={feature.id}
        className="meetings-feature-card"
        onClick={() => onFeatureClick(feature.id)}
        style={{ animationDelay: `${index * 0.05}s` }}
      >
        <div className="meetings-feature-header">
          <div className={`meetings-feature-icon ${feature.iconClass}`}>
            <i className={`fa-solid ${feature.icon}`} />
          </div>
          <div className="meetings-feature-title">{feature.title}</div>
        </div>
        <div className="meetings-feature-desc">{feature.description}</div>
        {feature.badge && (
          <div className="meetings-feature-badge">
            <i className="fa-solid fa-circle-info" />
            {feature.id === 'actions' && pendingActions > 0
              ? `${pendingActions} pending`
              : feature.badge
            }
          </div>
        )}
      </div>
    ))}
  </div>
);

// ============================================
// MEETING HISTORY
// ============================================

interface MeetingHistoryProps {
  notes: ArchiveItem[];
  onNoteClick: (note: ArchiveItem) => void;
}

export const MeetingHistory: React.FC<MeetingHistoryProps> = ({
  notes,
  onNoteClick,
}) => (
  <div className="meetings-history">
    {notes.slice(0, 5).map((note) => (
      <div
        key={note.id}
        className="meetings-history-item"
        onClick={() => onNoteClick(note)}
      >
        <div className="meetings-history-icon">
          <i className="fa-solid fa-file-lines" />
        </div>
        <div className="meetings-history-info">
          <div className="meetings-history-title">{note.title}</div>
          <div className="meetings-history-meta">
            {note.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="meetings-history-tag">#{tag}</span>
            ))}
          </div>
        </div>
        <div className="meetings-history-date">
          {note.date.toLocaleDateString()}
        </div>
      </div>
    ))}
    {notes.length === 0 && (
      <div className="meetings-empty">
        <i className="fa-solid fa-inbox" style={{ fontSize: 24, marginBottom: 12, opacity: 0.3 }} />
        <div>No meeting history found</div>
      </div>
    )}
  </div>
);

// ============================================
// UPCOMING MEETINGS CARD
// ============================================

interface UpcomingMeetingsProps {
  meetings: CalendarEvent[];
  onJoin: (meeting: CalendarEvent) => void;
  onSchedule: () => void;
}

export const UpcomingMeetings: React.FC<UpcomingMeetingsProps> = ({
  meetings,
  onJoin,
  onSchedule,
}) => (
  <div className="meetings-upcoming-card">
    <div className="meetings-section-header">
      <div className="meetings-section-title">
        <i className="fa-solid fa-calendar-day" />
        Upcoming
      </div>
      <button className="meetings-section-action">View All</button>
    </div>
    <div className="meetings-upcoming-list">
      {meetings.slice(0, 3).map((meeting) => {
        const time = meeting.start.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        const [hour, ampm] = time.split(' ');

        return (
          <div key={meeting.id} className="meetings-upcoming-item">
            <div className="meetings-upcoming-time">
              <span className="meetings-upcoming-hour">{hour}</span>
              <span className="meetings-upcoming-ampm">{ampm}</span>
            </div>
            <div className="meetings-upcoming-info">
              <div className="meetings-upcoming-title">{meeting.title}</div>
              <div className="meetings-upcoming-attendees">
                {['JD', 'SK', 'MR'].slice(0, 3).map((initials, i) => (
                  <div
                    key={i}
                    className="meetings-upcoming-avatar"
                    style={{ backgroundColor: ['#7c3aed', '#10b981', '#f59e0b'][i] }}
                  >
                    {initials}
                  </div>
                ))}
                <span className="meetings-upcoming-count">+2</span>
              </div>
            </div>
            <button
              className="meetings-upcoming-join"
              onClick={() => onJoin(meeting)}
            >
              Join
            </button>
          </div>
        );
      })}
      {meetings.length === 0 && (
        <div className="meetings-empty" style={{ padding: '32px 20px' }}>
          No upcoming meetings
        </div>
      )}
    </div>
    <button className="meetings-schedule-btn" onClick={onSchedule}>
      <i className="fa-solid fa-calendar-plus" />
      Schedule New Meeting
    </button>
  </div>
);

// ============================================
// QUICK ACTIONS
// ============================================

interface QuickActionsProps {
  onAction: (action: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAction }) => (
  <div className="meetings-quick-actions">
    <div className="meetings-section-header">
      <div className="meetings-section-title">
        <i className="fa-solid fa-bolt" />
        Quick Actions
      </div>
    </div>
    <div className="meetings-quick-grid">
      <button className="meetings-quick-btn" onClick={() => onAction('share-screen')}>
        <i className="fa-solid fa-display" />
        <span>Share Screen</span>
      </button>
      <button className="meetings-quick-btn" onClick={() => onAction('test-audio')}>
        <i className="fa-solid fa-microphone" />
        <span>Test Audio</span>
      </button>
      <button className="meetings-quick-btn" onClick={() => onAction('test-video')}>
        <i className="fa-solid fa-video" />
        <span>Test Video</span>
      </button>
      <button className="meetings-quick-btn" onClick={() => onAction('settings')}>
        <i className="fa-solid fa-gear" />
        <span>Settings</span>
      </button>
    </div>
  </div>
);

// ============================================
// MEETING INSIGHTS (NEW FEATURE)
// ============================================

interface MeetingInsightsCardProps {
  insights: MeetingInsights;
}

export const MeetingInsightsCard: React.FC<MeetingInsightsCardProps> = ({
  insights,
}) => (
  <div className="meetings-insights-card">
    <div className="meetings-section-header">
      <div className="meetings-section-title">
        <i className="fa-solid fa-chart-line" />
        This Week
      </div>
    </div>
    <div className="meetings-insights-stats">
      <div className="meetings-insight-stat">
        <div className="meetings-insight-value">{insights.totalMeetings}</div>
        <div className="meetings-insight-label">Meetings</div>
      </div>
      <div className="meetings-insight-stat">
        <div className="meetings-insight-value">{insights.totalHours}h</div>
        <div className="meetings-insight-label">Total Time</div>
      </div>
    </div>
    <div className="meetings-insights-chart">
      {insights.weeklyTrend.map((value, i) => (
        <div
          key={i}
          className="meetings-insights-bar"
          style={{ height: `${value}%` }}
        />
      ))}
    </div>
  </div>
);

// ============================================
// BULK INVITE MODAL
// ============================================

interface BulkInviteModalProps {
  isOpen: boolean;
  platform: Platform;
  contacts: Contact[];
  selectedContacts: Set<string>;
  onToggleContact: (contactId: string) => void;
  onSend: () => void;
  onClose: () => void;
}

export const BulkInviteModal: React.FC<BulkInviteModalProps> = ({
  isOpen,
  platform,
  contacts,
  selectedContacts,
  onToggleContact,
  onSend,
  onClose,
}) => {
  if (!isOpen) return null;

  const platformConfig = PLATFORMS.find(p => p.id === platform);

  return (
    <div className="meetings-modal-overlay" onClick={onClose}>
      <div className="meetings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="meetings-modal-header">
          <div className="meetings-modal-title">
            Invite to {platformConfig?.label || 'Meeting'}
          </div>
          <button className="meetings-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="meetings-modal-body">
          <div className="meetings-contacts-grid">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={`meetings-contact-item ${selectedContacts.has(contact.id) ? 'selected' : ''}`}
                onClick={() => onToggleContact(contact.id)}
              >
                <div
                  className="meetings-contact-avatar"
                  style={{ backgroundColor: contact.avatarColor || '#7c3aed' }}
                >
                  {selectedContacts.has(contact.id)
                    ? <i className="fa-solid fa-check" />
                    : contact.name.charAt(0)
                  }
                </div>
                <div>
                  <div className="meetings-contact-name">{contact.name}</div>
                  <div className="meetings-contact-role">{contact.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="meetings-modal-footer">
          <span style={{ fontSize: 13, color: 'var(--mtg-text-muted)' }}>
            {selectedContacts.size} selected
          </span>
          <button
            className="meetings-modal-btn primary"
            disabled={selectedContacts.size === 0}
            onClick={onSend}
          >
            Send Invitations
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MEETING TEMPLATES MODAL (NEW FEATURE)
// ============================================

interface TemplatesModalProps {
  isOpen: boolean;
  onSelect: (template: MeetingTemplate) => void;
  onClose: () => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onSelect,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="meetings-modal-overlay" onClick={onClose}>
      <div className="meetings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="meetings-modal-header">
          <div className="meetings-modal-title">Meeting Templates</div>
          <button className="meetings-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="meetings-modal-body">
          <div className="meetings-contacts-grid">
            {MEETING_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className="meetings-contact-item"
                onClick={() => onSelect(template)}
                style={{ cursor: 'pointer' }}
              >
                <div
                  className="meetings-contact-avatar"
                  style={{ backgroundColor: '#7c3aed' }}
                >
                  <i className={`fa-solid ${template.icon}`} style={{ fontSize: 16 }} />
                </div>
                <div>
                  <div className="meetings-contact-name">{template.name}</div>
                  <div className="meetings-contact-role">
                    {template.duration} min • {template.defaultAgenda.length} items
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// AGENDA BUILDER MODAL (NEW FEATURE)
// ============================================

interface AgendaBuilderModalProps {
  isOpen: boolean;
  items: AgendaItem[];
  onAddItem: (item: Omit<AgendaItem, 'id'>) => void;
  onRemoveItem: (id: string) => void;
  onClose: () => void;
}

export const AgendaBuilderModal: React.FC<AgendaBuilderModalProps> = ({
  isOpen,
  items,
  onAddItem,
  onRemoveItem,
  onClose,
}) => {
  const [newTitle, setNewTitle] = React.useState('');
  const [newDuration, setNewDuration] = React.useState(5);

  if (!isOpen) return null;

  const handleAdd = () => {
    if (newTitle.trim()) {
      onAddItem({ title: newTitle, duration: newDuration });
      setNewTitle('');
      setNewDuration(5);
    }
  };

  const totalDuration = items.reduce((sum, item) => sum + item.duration, 0);

  return (
    <div className="meetings-modal-overlay" onClick={onClose}>
      <div className="meetings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="meetings-modal-header">
          <div className="meetings-modal-title">Build Agenda</div>
          <button className="meetings-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="meetings-modal-body">
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <input
              type="text"
              className="meetings-form-input"
              placeholder="Agenda item..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              className="meetings-form-select"
              value={newDuration}
              onChange={(e) => setNewDuration(Number(e.target.value))}
              style={{ width: 100 }}
            >
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
            </select>
            <button
              className="meetings-modal-btn primary"
              onClick={handleAdd}
              style={{ padding: '12px 16px' }}
            >
              <i className="fa-solid fa-plus" />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item, index) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  background: 'var(--mtg-bg-tertiary)',
                  borderRadius: 12,
                  borderLeft: '3px solid var(--mtg-accent-primary)',
                }}
              >
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--mtg-text-muted)',
                  minWidth: 24
                }}>
                  {index + 1}.
                </span>
                <span style={{ flex: 1, color: 'var(--mtg-text-primary)', fontSize: 13 }}>
                  {item.title}
                </span>
                <span style={{
                  fontSize: 11,
                  color: 'var(--mtg-accent-primary)',
                  background: 'rgba(0, 212, 255, 0.1)',
                  padding: '4px 8px',
                  borderRadius: 6
                }}>
                  {item.duration} min
                </span>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--mtg-text-muted)',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  <i className="fa-solid fa-trash" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="meetings-modal-footer">
          <span style={{ fontSize: 13, color: 'var(--mtg-text-muted)' }}>
            Total: {totalDuration} min ({items.length} items)
          </span>
          <button className="meetings-modal-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// ACTION ITEMS MODAL (NEW FEATURE)
// ============================================

interface ActionItemsModalProps {
  isOpen: boolean;
  items: ActionItem[];
  contacts: Contact[];
  onAddItem: (item: Omit<ActionItem, 'id' | 'createdAt'>) => void;
  onToggleStatus: (id: string) => void;
  onClose: () => void;
}

export const ActionItemsModal: React.FC<ActionItemsModalProps> = ({
  isOpen,
  items,
  contacts,
  onAddItem,
  onToggleStatus,
  onClose,
}) => {
  const [newTitle, setNewTitle] = React.useState('');
  const [newAssignee, setNewAssignee] = React.useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (newTitle.trim()) {
      const assignee = contacts.find(c => c.id === newAssignee);
      onAddItem({
        title: newTitle,
        assignee,
        status: 'pending'
      });
      setNewTitle('');
      setNewAssignee('');
    }
  };

  const pendingCount = items.filter(i => i.status !== 'completed').length;

  return (
    <div className="meetings-modal-overlay" onClick={onClose}>
      <div className="meetings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="meetings-modal-header">
          <div className="meetings-modal-title">Action Items</div>
          <button className="meetings-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="meetings-modal-body">
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <input
              type="text"
              className="meetings-form-input"
              placeholder="New action item..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              className="meetings-form-select"
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              style={{ width: 150 }}
            >
              <option value="">Assignee</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              className="meetings-modal-btn primary"
              onClick={handleAdd}
              style={{ padding: '12px 16px' }}
            >
              <i className="fa-solid fa-plus" />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  background: 'var(--mtg-bg-tertiary)',
                  borderRadius: 12,
                  opacity: item.status === 'completed' ? 0.5 : 1,
                }}
              >
                <button
                  onClick={() => onToggleStatus(item.id)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    border: item.status === 'completed'
                      ? 'none'
                      : '2px solid var(--mtg-border)',
                    background: item.status === 'completed'
                      ? 'var(--mtg-accent-success)'
                      : 'transparent',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.status === 'completed' && (
                    <i className="fa-solid fa-check" style={{ fontSize: 12 }} />
                  )}
                </button>
                <span style={{
                  flex: 1,
                  color: 'var(--mtg-text-primary)',
                  fontSize: 13,
                  textDecoration: item.status === 'completed' ? 'line-through' : 'none'
                }}>
                  {item.title}
                </span>
                {item.assignee && (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: item.assignee.avatarColor || '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'white',
                    }}
                    title={item.assignee.name}
                  >
                    {item.assignee.name.charAt(0)}
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && (
              <div className="meetings-empty">No action items yet</div>
            )}
          </div>
        </div>
        <div className="meetings-modal-footer">
          <span style={{ fontSize: 13, color: 'var(--mtg-text-muted)' }}>
            {pendingCount} pending • {items.length - pendingCount} completed
          </span>
          <button className="meetings-modal-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// TOAST NOTIFICATION
// ============================================

interface ToastProps {
  message: string;
  isVisible: boolean;
}

export const Toast: React.FC<ToastProps> = ({ message, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="meetings-toast">
      <i className="fa-solid fa-check" />
      {message}
    </div>
  );
};
