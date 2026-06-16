import React, { useEffect, useRef, useState } from 'react';
import { Contact, CalendarEvent, ArchiveItem } from '../../types';
import { Activity, ArrowLeft, BarChart, Calendar, CalendarPlus, Check, CheckCircle2, ChevronDown, Copy, Download, FileText, Film, Gavel, Inbox, Info, Loader2, Megaphone, Mic, Monitor, PieChart, Play, PlayCircle, Plus, Search, Settings, Sliders, SplitSquareVertical, Square, Trash2, TrendingUp, Upload, UserPlus, Users, Video, VideoOff, Volume2, Wand2, X, Zap } from 'lucide-react';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';
import {

  fetchMeetingAnalytics,
  getMeetingRecordings,
  getMeetingSettings,
  saveMeetingSettings,
  exportMeetingToEntomate,
  isEntomateConnected,
  autoExportIfEnabled,
  MeetingAnalyticsData,
  MeetingRecording,
  MeetingSettings,
  DEFAULT_MEETING_SETTINGS,
  ExportStatus,
} from '../../services/meetingService';
import { syncPendingRecordings } from '../../services/pulseVideoService';
import { dataService } from '../../services/dataService';
import toast from 'react-hot-toast';

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
            <X />
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
                  style={{ backgroundColor: contact.avatarColor || '#f43f5e' }}
                >
                  {selectedContacts.has(contact.id)
                    ? <Check />
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
            <X />
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
                  style={{ backgroundColor: '#f43f5e' }}
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
            <X />
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
              <Plus />
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
                  border: '1px solid var(--mtg-border)',
                  borderRadius: 12,
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
                  background: 'rgba(244, 63, 94, 0.10)',
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
                  <Trash2 />
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
            <X />
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
              <Plus />
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
                    <Check />
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
                      background: item.assignee.avatarColor || '#f43f5e',
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
      <Check />
      {message}
    </div>
  );
};

// ============================================
// BREAKOUT ROOM TYPE
// ============================================

export interface BreakoutRoom {
  id: string;
  name: string;
  participants: Contact[];
  color: string;
}

// Breakout room differentiation — coral family + warm complements (not the 11-color status vocabulary).
const BREAKOUT_COLORS = ['#f43f5e', '#fb7185', '#ec4899', '#f97316', '#eab308', '#a855f7'];

// ============================================
// MEETING SUMMARY TYPES
// ============================================

export interface TimelineEntry {
  timestamp: string;
  note: string;
}

export interface MeetingSummaryData {
  aiSummary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  decisions: string[];
  timelineEvents: TimelineEntry[];
  participants: Contact[];
  duration: number;
  meetingTitle: string;
}

// ============================================
// ANALYTICS MODAL
// ============================================

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h}h`;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<MeetingAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'topics' | 'people'>('overview');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    // #121: analytics are now native (sourced from pulse_video_rooms), so there
    // is no Entomate gate — render for any user once there's at least one meeting.
    fetchMeetingAnalytics().then(d => {
      setData(d);
      setLoading(false);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const maxCount = data ? Math.max(...data.weeklyTrend.map(w => w.count), 1) : 1;

  return (
    <div className="meetings-modal-overlay" onClick={onClose}>
      <div className="meetings-modal meetings-modal--wide" onClick={e => e.stopPropagation()}>
        <div className="meetings-modal-header">
          <div className="meetings-modal-title">
            <PieChart />
            Meeting Analytics
          </div>
          <button className="meetings-modal-close" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="meetings-modal-body">
          {/* Tabs */}
          <div className="meetings-analytics-tabs">
            {(['overview', 'topics', 'people'] as const).map(tab => (
              <button
                key={tab}
                className={`meetings-analytics-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="meetings-analytics-empty">
              <Loader2 className="animate-spin" />
              <div>Loading analytics...</div>
            </div>
          ) : !data || data.totalMeetings === 0 ? (
            <div className="meetings-analytics-empty">
              <BarChart />
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No meeting analytics yet</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Host a Pulse meeting with recording and transcription enabled. Analytics populate from your meeting summaries.</div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <>
                  {/* Stat line — single body-type sentence replacing the prior
                      3-equal-card "hero-metric" grid. The .meetings-analytics-stat*
                      CSS is left in place (now orphaned) so this is reversible. No
                      time qualifier: these totals are all-time, only the chart below
                      is the 8-week window. */}
                  <div style={{ fontSize: 14, color: 'var(--mtg-text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--mtg-text-primary)', fontWeight: 600 }}>{data.totalMeetings}</strong> {data.totalMeetings === 1 ? 'meeting' : 'meetings'}
                    <span style={{ color: 'var(--mtg-text-muted)' }}> · </span>
                    <strong style={{ color: 'var(--mtg-text-primary)', fontWeight: 600 }}>{formatHours(data.totalHours)}</strong> total
                    <span style={{ color: 'var(--mtg-text-muted)' }}> · </span>
                    <strong style={{ color: 'var(--mtg-text-primary)', fontWeight: 600 }}>{data.avgDuration}m</strong> average
                  </div>

                  {/* 8-week trend chart */}
                  <div className="meetings-analytics-chart">
                    <div className="meetings-analytics-chart-title">8-Week Trend</div>
                    <svg viewBox="0 0 560 80" style={{ width: '100%', height: 80, display: 'block' }}>
                      <defs>
                        <linearGradient id="mtg-chart-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--mtg-accent-primary)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="var(--mtg-accent-primary)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {(() => {
                        const pts = data.weeklyTrend.map((w, i) => {
                          const x = (i / (data.weeklyTrend.length - 1)) * 540 + 10;
                          const y = 70 - (w.count / maxCount) * 60 + 5;
                          return `${x},${y}`;
                        }).join(' ');
                        const polyPts = `10,75 ${pts} 550,75`;
                        return (
                          <>
                            <polygon points={polyPts} fill="url(#mtg-chart-grad)" />
                            <polyline points={pts} fill="none" stroke="var(--mtg-accent-primary)" strokeWidth="2" strokeLinejoin="round" />
                            {data.weeklyTrend.map((w, i) => {
                              const x = (i / (data.weeklyTrend.length - 1)) * 540 + 10;
                              const y = 70 - (w.count / maxCount) * 60 + 5;
                              return (
                                <g key={i}>
                                  <circle cx={x} cy={y} r="4" fill="var(--mtg-accent-primary)" />
                                  <text x={x} y="78" textAnchor="middle" fontSize="9" fill="var(--mtg-text-muted)">{w.label}</text>
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>

                  {/* Sentiment */}
                  <div className="meetings-sentiment-row">
                    <div className="meetings-sentiment-item">
                      <div className="meetings-sentiment-count" style={{ color: 'var(--mtg-accent-success)' }}>
                        {data.sentimentBreakdown.positive}
                      </div>
                      <div className="meetings-sentiment-label">Positive</div>
                    </div>
                    <div className="meetings-sentiment-item">
                      <div className="meetings-sentiment-count" style={{ color: 'var(--mtg-text-muted)' }}>
                        {data.sentimentBreakdown.neutral}
                      </div>
                      <div className="meetings-sentiment-label">Neutral</div>
                    </div>
                    <div className="meetings-sentiment-item">
                      <div className="meetings-sentiment-count" style={{ color: 'var(--mtg-accent-danger)' }}>
                        {data.sentimentBreakdown.negative}
                      </div>
                      <div className="meetings-sentiment-label">Negative</div>
                    </div>
                  </div>

                  {/* Recent Decisions */}
                  {data.topDecisions.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--mtg-text-muted)', marginBottom: 10 }}>
                        Recent Decisions
                      </div>
                      <div className="meetings-decisions-list">
                        {data.topDecisions.slice(0, 4).map((d, i) => (
                          <div key={i} className="meetings-decision-item">
                            <CheckCircle2 />
                            <div>
                              <div className="meetings-decision-text">{d.decision}</div>
                              <div className="meetings-decision-meta">{d.meetingTitle} · {d.date.toLocaleDateString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {activeTab === 'topics' && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--mtg-text-muted)', marginBottom: 12 }}>
                    Most Discussed Topics
                  </div>
                  {data.topTopics.length === 0 ? (
                    <div className="meetings-analytics-empty">No topic data available yet.</div>
                  ) : (
                    <div className="meetings-topic-pills">
                      {data.topTopics.map((t, i) => (
                        <div key={i} className="meetings-topic-pill">
                          {t.topic}
                          <span className="meetings-topic-pill-count">{t.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'people' && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--mtg-text-muted)', marginBottom: 12 }}>
                    Top Attendees
                  </div>
                  {data.topAttendees.length === 0 ? (
                    <div className="meetings-analytics-empty">
                      <Users />
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Attendee analytics aren't available yet</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Pulse meetings don't currently capture per-attendee data, so this view stays empty. Overview and Topics are sourced from your meeting summaries.</div>
                    </div>
                  ) : (
                    <div>
                      {data.topAttendees.map((a, i) => (
                        <div key={i} className="meetings-attendee-row">
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: `hsl(${i * 47}, 60%, 45%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
                          }}>
                            {a.name.charAt(0)}
                          </div>
                          <div className="meetings-attendee-row-name">{a.name}</div>
                          <div className="meetings-attendee-row-count">{a.meetingCount} meetings</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="meetings-modal-footer">
          <button className="meetings-modal-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// RECORDINGS MODAL
// ============================================

interface RecordingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const RecordingsModal: React.FC<RecordingsModalProps> = ({ isOpen, onClose }) => {
  const [recordings, setRecordings] = useState<MeetingRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MeetingRecording | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [entomateConnected, setEntomateConnected] = useState(false);
  const [exportStatuses, setExportStatuses] = useState<Record<string, ExportStatus>>({});

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSelected(null);
    setSearch('');
    setExportStatuses({});
    // 0.1 Path B catch-up: kick off background polling for any recently-ended
    // recorded room whose recording_url hasn't landed yet (e.g. the host closed
    // the tab before the in-call poll resolved). Fire-and-forget — results
    // surface on the next modal open.
    syncPendingRecordings().catch(() => {});
    getMeetingRecordings().then(r => {
      setRecordings(r);
      setLoading(false);
    });
    isEntomateConnected().then(setEntomateConnected);
  }, [isOpen]);

  useEffect(() => {
    if (!selected) {
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [selected]);

  if (!isOpen) return null;

  const filtered = recordings.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    (r.transcript || '').toLowerCase().includes(search.toLowerCase())
  );

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  };

  const handleExportToEntomate = async (rec: MeetingRecording) => {
    setExportStatuses(prev => ({ ...prev, [rec.id]: 'exporting' }));
    const result = await exportMeetingToEntomate(rec);
    setExportStatuses(prev => ({ ...prev, [rec.id]: result.success ? 'exported' : 'error' }));
  };

  const renderTranscript = () => {
    if (!selected?.transcript) return <div style={{ color: 'var(--mtg-text-muted)', fontSize: 12 }}>No transcript available.</div>;
    const parts = selected.transcript.split(/(\[\d{2}:\d{2}\])/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[(\d{2}):(\d{2})\]$/);
      if (match) {
        const secs = Number(match[1]) * 60 + Number(match[2]);
        return (
          <span
            key={i}
            className="ts-link"
            onClick={() => { if (audioRef.current) audioRef.current.currentTime = secs; }}
          >
            {part}
          </span>
        );
      }
      if (search && part.toLowerCase().includes(search.toLowerCase())) {
        const idx = part.toLowerCase().indexOf(search.toLowerCase());
        return (
          <span key={i}>
            {part.slice(0, idx)}
            <mark>{part.slice(idx, idx + search.length)}</mark>
            {part.slice(idx + search.length)}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="meetings-modal-overlay" onClick={onClose}>
      <div className="meetings-modal meetings-modal--wide" onClick={e => e.stopPropagation()}>
        <div className="meetings-modal-header">
          {selected ? (
            <>
              <button className="meetings-back-btn" onClick={() => setSelected(null)}>
                <ArrowLeft /> Back
              </button>
              <div className="meetings-modal-title">{selected.title}</div>
            </>
          ) : (
            <div className="meetings-modal-title">
              <PlayCircle />
              Recordings
            </div>
          )}
          <button className="meetings-modal-close" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="meetings-modal-body">
          {!selected ? (
            <>
              {/* Search */}
              <div className="meetings-recordings-search">
                <Search className="meetings-recordings-search-icon" />
                <input
                  type="text"
                  placeholder="Search recordings or transcripts..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="meetings-analytics-empty">
                  <Loader2 className="animate-spin" />
                  <div>Loading recordings...</div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="meetings-analytics-empty">
                  <Film />
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>No recordings found</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {recordings.length === 0
                      ? 'Recordings appear here a few minutes after a recorded meeting ends. Start a meeting and turn on recording to capture one.'
                      : 'No results match your search.'}
                  </div>
                </div>
              ) : (
                filtered.map(r => (
                  <div key={r.id} className="meetings-recording-card" onClick={() => setSelected(r)}>
                    <div className="meetings-recording-thumb">
                      <PlayCircle />
                    </div>
                    <div className="meetings-recording-info">
                      <div className="meetings-recording-title">{r.title}</div>
                      <div className="meetings-recording-meta">
                        {r.startTime ? r.startTime.toLocaleDateString() : 'Unknown date'}
                        {r.durationMinutes ? ` · ${r.durationMinutes} min` : ''}
                        {r.attendees.length > 0 ? ` · ${r.attendees.length} attendees` : ''}
                      </div>
                    </div>
                    {entomateConnected && (() => {
                      const status = exportStatuses[r.id] || 'idle';
                      return (
                        <button
                          type="button"
                          className="meetings-recording-play-btn"
                          title={status === 'exported' ? 'Exported to Entomate' : status === 'exporting' ? 'Exporting...' : 'Export to Entomate'}
                          onClick={(e) => { e.stopPropagation(); handleExportToEntomate(r); }}
                          disabled={status === 'exporting' || status === 'exported'}
                          style={{
                            color: status === 'exported' ? '#10b981' : status === 'error' ? '#f43f5e' : undefined,
                          }}
                        >
                          {status === 'exporting' ? <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> :
                           status === 'exported' ? <Check style={{ width: 14, height: 14 }} /> :
                           <Upload style={{ width: 14, height: 14 }} />}
                        </button>
                      );
                    })()}
                    <div className="meetings-recording-play-btn">
                      <Play />
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              {/* Audio player */}
              <div className="meetings-player">
                <audio
                  ref={audioRef}
                  src={selected.audioFileUrl}
                  onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                  onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                  onEnded={() => setPlaying(false)}
                />
                <div className="meetings-player-progress-track" onClick={seekTo}>
                  <div
                    className="meetings-player-progress-fill"
                    style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                  />
                </div>
                <div className="meetings-player-controls">
                  <button className="meetings-player-play-btn" onClick={togglePlay}>
                    <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'}`} style={{ fontSize: 13 }} />
                  </button>
                  <span className="meetings-player-time">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  <a href={selected.audioFileUrl} download className="meetings-download-btn">
                    <Download /> Download
                  </a>
                  {entomateConnected && (() => {
                    const status = exportStatuses[selected.id] || 'idle';
                    return (
                      <button
                        type="button"
                        className="meetings-download-btn"
                        disabled={status === 'exporting' || status === 'exported'}
                        onClick={() => handleExportToEntomate(selected)}
                        title={status === 'exported' ? 'Already exported to Entomate' : 'Export to Entomate for AI analysis'}
                        style={{
                          background: status === 'exported' ? 'rgba(16,185,129,0.15)' : status === 'error' ? 'rgba(244,63,94,0.15)' : undefined,
                          color: status === 'exported' ? '#10b981' : status === 'error' ? '#f43f5e' : undefined,
                        }}
                      >
                        {status === 'exporting' ? (
                          <><Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> Exporting...</>
                        ) : status === 'exported' ? (
                          <><Check style={{ width: 14, height: 14 }} /> Exported</>
                        ) : status === 'error' ? (
                          <><Upload style={{ width: 14, height: 14 }} /> Retry</>
                        ) : (
                          <><Upload style={{ width: 14, height: 14 }} /> Export to Entomate</>
                        )}
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* AI Summary — renders structured JSON or plain text */}
              {selected.summary && (() => {
                let parsed: { aiSummary?: string; keyPoints?: string[]; actionItems?: { text: string; owner?: string; priority?: string }[]; decisions?: string[]; topics?: string[]; sentiment?: string } | null = null;
                try { parsed = JSON.parse(selected.summary!); } catch { /* plain text */ }

                if (parsed) {
                  return (
                    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {parsed.aiSummary && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--mtg-text-muted)', marginBottom: 6 }}>AI Summary</div>
                          <div style={{ fontSize: 13, color: 'var(--mtg-text-secondary)', lineHeight: 1.7 }}>{parsed.aiSummary}</div>
                        </div>
                      )}
                      {parsed.keyPoints && parsed.keyPoints.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--mtg-text-muted)', marginBottom: 6 }}>Key Points</div>
                          <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {parsed.keyPoints.map((p, i) => <li key={i} style={{ fontSize: 13, color: 'var(--mtg-text-secondary)' }}>{p}</li>)}
                          </ul>
                        </div>
                      )}
                      {parsed.actionItems && parsed.actionItems.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--mtg-text-muted)', marginBottom: 6 }}>Action Items</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {parsed.actionItems.map((a, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                                <span style={{ width: 16, height: 16, borderRadius: 4, border: '2px solid var(--mtg-border)', display: 'inline-block', flexShrink: 0, marginTop: 1 }} />
                                <span style={{ color: 'var(--mtg-text-secondary)', flex: 1 }}>
                                  {a.text}
                                  {a.owner && <span style={{ color: 'var(--mtg-text-muted)', fontSize: 11 }}> · {a.owner}</span>}
                                </span>
                                {a.priority === 'high' && <span style={{ fontSize: 10, background: 'rgba(244,63,94,0.15)', color: '#f43f5e', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>HIGH</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {parsed.decisions && parsed.decisions.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--mtg-text-muted)', marginBottom: 6 }}>Decisions</div>
                          <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {parsed.decisions.map((d, i) => <li key={i} style={{ fontSize: 13, color: 'var(--mtg-text-secondary)' }}>{d}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                }

                // Plain text summary fallback
                return (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--mtg-text-muted)', marginBottom: 8 }}>Summary</div>
                    <div style={{ fontSize: 13, color: 'var(--mtg-text-secondary)', lineHeight: 1.6 }}>{selected.summary}</div>
                  </div>
                );
              })()}

              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--mtg-text-muted)', marginBottom: 8 }}>
                Transcript
              </div>
              <div className="meetings-transcript-view">{renderTranscript()}</div>
            </>
          )}
        </div>

        <div className="meetings-modal-footer">
          <button className="meetings-modal-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// DEVICE TEST MODAL
// ============================================

interface DeviceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Permission = 'pending' | 'granted' | 'denied';

export const DeviceTestModal: React.FC<DeviceTestModalProps> = ({ isOpen, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  const [micLevel, setMicLevel] = useState(0);
  const [micPermission, setMicPermission] = useState<Permission>('pending');
  const [cameraPermission, setCameraPermission] = useState<Permission>('pending');
  const [speakerTesting, setSpeakerTesting] = useState(false);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedCamera, setSelectedCamera] = useState('');

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  };

  const updateMicLevel = () => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    setMicLevel(Math.min(20, Math.round((avg / 128) * 20)));
    animFrameRef.current = requestAnimationFrame(updateMicLevel);
  };

  const startDevices = async (micId?: string, camId?: string) => {
    // Release previous stream before acquiring new one
    stopStream();

    try {
      const constraints: MediaStreamConstraints = {
        audio: micId ? { deviceId: { exact: micId } } : true,
        video: camId ? { deviceId: { exact: camId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setMicPermission('granted');
      setCameraPermission('granted');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      animFrameRef.current = requestAnimationFrame(updateMicLevel);

      const devices = await navigator.mediaDevices.enumerateDevices();
      setMicrophones(devices.filter(d => d.kind === 'audioinput'));
      setCameras(devices.filter(d => d.kind === 'videoinput'));
    } catch {
      setMicPermission('denied');
      setCameraPermission('denied');
    }
  };

  useEffect(() => {
    if (isOpen) {
      startDevices();
    } else {
      stopStream();
      setMicLevel(0);
      setMicPermission('pending');
      setCameraPermission('pending');
      setSelectedMic('');
      setSelectedCamera('');
    }
    return () => stopStream();
  }, [isOpen]);

  // Re-acquire stream when user selects a different mic or camera
  useEffect(() => {
    if (!isOpen || micPermission !== 'granted') return;
    if (!selectedMic && !selectedCamera) return;
    startDevices(selectedMic || undefined, selectedCamera || undefined);
  }, [selectedMic, selectedCamera]);

  const testSpeaker = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      osc.start();
      osc.stop(ctx.currentTime + 1.0);
      setSpeakerTesting(true);
      setTimeout(() => setSpeakerTesting(false), 1200);
    } catch {
      // ignore
    }
  };

  const PermissionBadge: React.FC<{ perm: Permission }> = ({ perm }) => (
    <span className={`meetings-permission-badge ${perm}`}>
      <i className={`fa-solid ${perm === 'granted' ? 'fa-circle-check' : perm === 'denied' ? 'fa-circle-xmark' : 'fa-circle-question'}`} />
      {perm === 'granted' ? 'Allowed' : perm === 'denied' ? 'Denied' : 'Checking...'}
    </span>
  );

  if (!isOpen) return null;

  return (
    <div className="meetings-modal-overlay" onClick={onClose}>
      <div className="meetings-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="meetings-modal-header">
          <div className="meetings-modal-title">
            <Sliders />
            Device Test
          </div>
          <button className="meetings-modal-close" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="meetings-modal-body">
          {/* Microphone */}
          <div className="meetings-device-section">
            <div className="meetings-device-section-header">
              <div className="meetings-device-section-title">
                <Mic />
                Microphone
              </div>
              <PermissionBadge perm={micPermission} />
            </div>
            {microphones.length > 0 && (
              <select
                className="meetings-device-select"
                value={selectedMic}
                onChange={e => setSelectedMic(e.target.value)}
              >
                {microphones.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
                ))}
              </select>
            )}
            <div className="meetings-mic-meter">
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className={`meetings-mic-bar ${i < micLevel ? 'active' : ''}`} />
              ))}
            </div>
          </div>

          {/* Camera */}
          <div className="meetings-device-section">
            <div className="meetings-device-section-header">
              <div className="meetings-device-section-title">
                <Video />
                Camera
              </div>
              <PermissionBadge perm={cameraPermission} />
            </div>
            {cameras.length > 0 && (
              <select
                className="meetings-device-select"
                value={selectedCamera}
                onChange={e => setSelectedCamera(e.target.value)}
              >
                {cameras.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
                ))}
              </select>
            )}
            {cameraPermission === 'granted' ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="meetings-camera-preview"
              />
            ) : (
              <div className="meetings-camera-off">
                <VideoOff />
                Camera not available
              </div>
            )}
          </div>

          {/* Speaker */}
          <div className="meetings-device-section">
            <div className="meetings-device-section-header">
              <div className="meetings-device-section-title">
                <Volume2 />
                Speaker
              </div>
            </div>
            <button
              className={`meetings-speaker-test-btn ${speakerTesting ? 'testing' : ''}`}
              onClick={testSpeaker}
            >
              <i className={`fa-solid ${speakerTesting ? 'fa-volume-high fa-beat' : 'fa-play'}`} />
              {speakerTesting ? 'Playing tone...' : 'Test Speaker'}
            </button>
          </div>
        </div>

        <div className="meetings-modal-footer">
          <span style={{ fontSize: 12, color: 'var(--mtg-text-muted)' }}>
            Audio and video access required for meetings
          </span>
          <button className="meetings-modal-btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MEETING SETTINGS MODAL
// ============================================

interface MeetingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection = 'general' | 'av' | 'integrations';

export const MeetingSettingsModal: React.FC<MeetingSettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<MeetingSettings>(DEFAULT_MEETING_SETTINGS);
  const [section, setSection] = useState<SettingsSection>('general');
  const [saved, setSaved] = useState(false);
  const [entomateAvailable, setEntomateAvailable] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getMeetingSettings());
      setSaved(false);
      setSection('general');
      isEntomateConnected().then(setEntomateAvailable);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const update = <K extends keyof MeetingSettings>(key: K, value: MeetingSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    saveMeetingSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const DURATIONS = [15, 30, 45, 60, 90];

  const navItems: { id: SettingsSection; label: string; icon: string }[] = [
    { id: 'general', label: 'General', icon: 'fa-gear' },
    { id: 'av', label: 'Audio & Video', icon: 'fa-video' },
    { id: 'integrations', label: 'Integrations', icon: 'fa-plug' },
  ];

  return (
    <div className="meetings-modal-overlay" onClick={onClose}>
      <div className="meetings-modal meetings-modal--wide" onClick={e => e.stopPropagation()}>
        <div className="meetings-modal-header">
          <div className="meetings-modal-title">
            <Settings />
            Meeting Settings
          </div>
          <button className="meetings-modal-close" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="meetings-modal-body" style={{ padding: 0 }}>
          <div className="meetings-modal-with-sidebar" style={{ borderRadius: 0 }}>
            {/* Sidebar nav */}
            <div className="meetings-settings-sidebar">
              {navItems.map(item => (
                <button
                  key={item.id}
                  className={`meetings-settings-nav-item ${section === item.id ? 'active' : ''}`}
                  onClick={() => setSection(item.id)}
                >
                  <i className={`fa-solid ${item.icon}`} />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="meetings-settings-content">
              {section === 'general' && (
                <>
                  <div className="meetings-settings-section-title">General</div>

                  <div className="meetings-settings-row">
                    <div className="meetings-settings-row-text">
                      <div className="meetings-settings-row-label">Default Duration</div>
                      <div className="meetings-settings-row-desc">Pre-fill meeting duration when scheduling</div>
                    </div>
                  </div>
                  <div className="meetings-pill-btns" style={{ marginBottom: 16 }}>
                    {DURATIONS.map(d => (
                      <button
                        key={d}
                        className={`meetings-pill-btn ${settings.defaultDuration === d ? 'active' : ''}`}
                        onClick={() => update('defaultDuration', d)}
                      >
                        {d}m
                      </button>
                    ))}
                  </div>

                  <div className="meetings-settings-row">
                    <div className="meetings-settings-row-text">
                      <div className="meetings-settings-row-label">Auto-mute on Join</div>
                      <div className="meetings-settings-row-desc">Start each meeting muted by default</div>
                    </div>
                    <button
                      className={`meetings-toggle ${settings.autoMuteOnJoin ? 'on' : ''}`}
                      onClick={() => update('autoMuteOnJoin', !settings.autoMuteOnJoin)}
                      role="switch"
                      aria-checked={settings.autoMuteOnJoin}
                    />
                  </div>

                  <div className="meetings-settings-row">
                    <div className="meetings-settings-row-text">
                      <div className="meetings-settings-row-label">AI Scribe by Default</div>
                      <div className="meetings-settings-row-desc">Enable AI note-taking for all meetings</div>
                    </div>
                    <button
                      className={`meetings-toggle ${settings.aiScribeDefault ? 'on' : ''}`}
                      onClick={() => update('aiScribeDefault', !settings.aiScribeDefault)}
                      role="switch"
                      aria-checked={settings.aiScribeDefault}
                    />
                  </div>

                  <div className="meetings-settings-row">
                    <div className="meetings-settings-row-text">
                      <div className="meetings-settings-row-label">Join Sound</div>
                      <div className="meetings-settings-row-desc">Play a sound when participants join or leave</div>
                    </div>
                    <button
                      className={`meetings-toggle ${settings.joinSoundEnabled ? 'on' : ''}`}
                      onClick={() => update('joinSoundEnabled', !settings.joinSoundEnabled)}
                      role="switch"
                      aria-checked={settings.joinSoundEnabled}
                    />
                  </div>

                  <div className="meetings-settings-row" style={{ opacity: 0.5 }}>
                    <div className="meetings-settings-row-text">
                      <div className="meetings-settings-row-label">
                        Breakout Rooms
                        <span style={{
                          marginLeft: 8, fontSize: 10, padding: '2px 7px',
                          background: 'rgba(244, 63, 94, 0.10)', borderRadius: 10,
                          color: 'var(--mtg-accent-primary)', fontWeight: 600,
                        }}>Coming Soon</span>
                      </div>
                      <div className="meetings-settings-row-desc">Split meetings into breakout sessions</div>
                    </div>
                    <button className="meetings-toggle" disabled />
                  </div>
                </>
              )}

              {section === 'av' && (
                <>
                  <div className="meetings-settings-section-title">Audio & Video</div>

                  <div className="meetings-settings-row">
                    <div className="meetings-settings-row-text">
                      <div className="meetings-settings-row-label">Camera On by Default</div>
                      <div className="meetings-settings-row-desc">Start with your camera on when hosting</div>
                    </div>
                    <button
                      className={`meetings-toggle ${settings.hostVideoDefault ? 'on' : ''}`}
                      onClick={() => update('hostVideoDefault', !settings.hostVideoDefault)}
                      role="switch"
                      aria-checked={settings.hostVideoDefault}
                    />
                  </div>

                  <div className="meetings-settings-row">
                    <div className="meetings-settings-row-text">
                      <div className="meetings-settings-row-label">Auto-Record Meetings</div>
                      <div className="meetings-settings-row-desc">Automatically start recording when meeting begins</div>
                    </div>
                    <button
                      className={`meetings-toggle ${settings.autoRecording ? 'on' : ''}`}
                      onClick={() => update('autoRecording', !settings.autoRecording)}
                      role="switch"
                      aria-checked={settings.autoRecording}
                    />
                  </div>
                </>
              )}

              {section === 'integrations' && (
                <>
                  <div className="meetings-settings-section-title">Calendar Sync</div>
                  <div className="meetings-calendar-cards">
                    {[
                      { id: 'none', label: 'None', note: 'No calendar integration', icon: 'fa-calendar-xmark', color: 'var(--mtg-text-muted)' },
                      { id: 'google', label: 'Google Calendar', note: 'Uses your connected Google account', icon: 'fa-google', color: '#ea4335' },
                      { id: 'microsoft', label: 'Microsoft Calendar', note: 'Uses your Microsoft/Outlook account', icon: 'fa-microsoft', color: '#00a1f1' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        className={`meetings-calendar-card ${settings.calendarSync === opt.id ? 'selected' : ''}`}
                        onClick={() => update('calendarSync', opt.id as MeetingSettings['calendarSync'])}
                      >
                        <div className="meetings-calendar-card-icon" style={{ background: `${opt.color}20` }}>
                          <i className={`${opt.id === 'none' ? 'fa-solid' : 'fa-brands'} ${opt.icon}`} style={{ color: opt.color }} />
                        </div>
                        <div className="meetings-calendar-card-text">
                          <div className="meetings-calendar-card-name">{opt.label}</div>
                          <div className="meetings-calendar-card-note">{opt.note}</div>
                        </div>
                        {settings.calendarSync === opt.id && (
                          <CheckCircle2 />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Entomate Integration */}
                  <div className="meetings-settings-section-title" style={{ marginTop: 24 }}>Entomate</div>

                  <div className="meetings-settings-row">
                    <div className="meetings-settings-row-text">
                      <div className="meetings-settings-row-label">
                        Auto-Export to Entomate
                        {!entomateAvailable && (
                          <span style={{
                            marginLeft: 8, fontSize: 10, padding: '2px 7px',
                            background: 'rgba(244,63,94,0.1)', borderRadius: 10,
                            color: '#f43f5e', fontWeight: 600,
                          }}>Not Connected</span>
                        )}
                      </div>
                      <div className="meetings-settings-row-desc">
                        Automatically send recordings to Entomate for AI transcription, sentiment analysis, and action item extraction when meetings end
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`meetings-toggle ${settings.autoExportToEntomate ? 'on' : ''}`}
                      onClick={() => update('autoExportToEntomate', !settings.autoExportToEntomate)}
                      role="switch"
                      aria-checked={settings.autoExportToEntomate ? 'true' : 'false'}
                      aria-label="Auto-Export to Entomate"
                      disabled={!entomateAvailable}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="meetings-modal-footer">
          <button className="meetings-modal-btn" onClick={onClose}>Cancel</button>
          <button
            className={`meetings-modal-btn primary ${saved ? 'meetings-settings-saved-btn' : ''}`}
            onClick={handleSave}
          >
            {saved ? (
              <><Check />Saved!</>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// BREAKOUT ROOMS MODAL
// ============================================

interface BreakoutRoomsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeParticipants: Contact[];
}

export const BreakoutRoomsModal: React.FC<BreakoutRoomsModalProps> = ({
  isOpen,
  onClose,
  activeParticipants,
}) => {
  const [rooms, setRooms] = useState<BreakoutRoom[]>([
    { id: 'room-1', name: 'Room 1', participants: [], color: BREAKOUT_COLORS[0] },
    { id: 'room-2', name: 'Room 2', participants: [], color: BREAKOUT_COLORS[1] },
  ]);
  const [selectedParticipant, setSelectedParticipant] = useState<Contact | null>(null);
  const [timerMinutes, setTimerMinutes] = useState(15);
  const [timeLeft, setTimeLeft] = useState(0);
  const [active, setActive] = useState(false);
  const [broadcastMode, setBroadcastMode] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const assignedIds = new Set(rooms.flatMap(r => r.participants.map(p => p.id)));
  const unassigned = activeParticipants.filter(p => !assignedIds.has(p.id));

  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      setActive(false);
      setTimeLeft(0);
      setRooms([
        { id: 'room-1', name: 'Room 1', participants: [], color: BREAKOUT_COLORS[0] },
        { id: 'room-2', name: 'Room 2', participants: [], color: BREAKOUT_COLORS[1] },
      ]);
      setSelectedParticipant(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (active) {
      setTimeLeft(timerMinutes * 60);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [active]);

  if (!isOpen) return null;

  const assignToRoom = (roomId: string) => {
    if (!selectedParticipant) return;
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) return { ...r, participants: [...r.participants, selectedParticipant] };
      return r;
    }));
    setSelectedParticipant(null);
  };

  const unassignFromRoom = (roomId: string, participantId: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) return { ...r, participants: r.participants.filter(p => p.id !== participantId) };
      return r;
    }));
  };

  const addRoom = () => {
    const idx = rooms.length;
    setRooms(prev => [...prev, {
      id: `room-${Date.now()}`,
      name: `Room ${idx + 1}`,
      participants: [],
      color: BREAKOUT_COLORS[idx % BREAKOUT_COLORS.length],
    }]);
  };

  const renameRoom = (roomId: string, name: string) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, name } : r));
  };

  const totalAssigned = rooms.reduce((s, r) => s + r.participants.length, 0);
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timerClass = timeLeft > 0 && timeLeft <= 120 ? 'over' : timeLeft <= 300 ? 'warning' : '';

  return (
    <div className="meetings-modal-overlay" onClick={onClose}>
      <div className="meetings-modal meetings-modal--wide" onClick={e => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <div className="meetings-modal-header">
          <div className="meetings-modal-title">
            <SplitSquareVertical />
            Breakout Rooms
          </div>
          <button className="meetings-modal-close" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="meetings-modal-body" style={{ padding: 0 }}>
          <div className="meetings-breakout-layout">
            {/* Panel 1: Unassigned */}
            <div className="meetings-breakout-panel">
              <div className="meetings-breakout-panel-title">
                Unassigned ({unassigned.length})
              </div>
              {unassigned.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--mtg-text-muted)', textAlign: 'center', paddingTop: 20 }}>
                  All participants assigned
                </div>
              ) : unassigned.map(p => (
                <div
                  key={p.id}
                  className={`meetings-breakout-participant-chip ${selectedParticipant?.id === p.id ? 'selected' : ''}`}
                  onClick={() => setSelectedParticipant(selectedParticipant?.id === p.id ? null : p)}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: p.avatarColor || '#f43f5e',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0,
                  }}>
                    {p.name.charAt(0)}
                  </div>
                  {p.name}
                </div>
              ))}
            </div>

            {/* Panel 2: Rooms */}
            <div className="meetings-breakout-panel">
              <div className="meetings-breakout-panel-title">
                Rooms ({rooms.length}) {selectedParticipant && <span style={{ color: 'var(--mtg-accent-primary)' }}>· click room to assign</span>}
              </div>
              {rooms.map(room => (
                <div
                  key={room.id}
                  className={`meetings-breakout-room-card ${selectedParticipant ? 'drop-target' : ''}`}
                  onClick={() => selectedParticipant && assignToRoom(room.id)}
                >
                  <div className="meetings-breakout-room-header">
                    <div className="meetings-breakout-room-dot" style={{ background: room.color }} />
                    <input
                      className="meetings-breakout-room-name"
                      value={room.name}
                      onClick={e => e.stopPropagation()}
                      onChange={e => renameRoom(room.id, e.target.value)}
                    />
                    <span style={{ fontSize: 11, color: 'var(--mtg-text-muted)' }}>
                      {room.participants.length} people
                    </span>
                  </div>
                  <div className="meetings-breakout-participants">
                    {room.participants.length === 0 ? (
                      <span style={{ fontSize: 11, color: 'var(--mtg-text-muted)', fontStyle: 'italic' }}>
                        Empty · assign participants
                      </span>
                    ) : room.participants.map(p => (
                      <div key={p.id} className="meetings-breakout-assigned-chip">
                        {p.name}
                        <button
                          className="meetings-breakout-assigned-remove"
                          onClick={e => { e.stopPropagation(); unassignFromRoom(room.id, p.id); }}
                        >
                          <X />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button className="meetings-breakout-add-room" onClick={addRoom}>
                <Plus /> Add Room
              </button>
            </div>

            {/* Panel 3: Controls */}
            <div className="meetings-breakout-panel">
              <div className="meetings-breakout-panel-title">Controls</div>
              <div className="meetings-breakout-controls">
                {/* Timer picker */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--mtg-text-muted)', marginBottom: 8 }}>
                    Duration
                  </div>
                  <div className="meetings-pill-btns" style={{ flexWrap: 'wrap' }}>
                    {[5, 10, 15, 20, 30].map(m => (
                      <button
                        key={m}
                        className={`meetings-pill-btn ${timerMinutes === m ? 'active' : ''}`}
                        onClick={() => !active && setTimerMinutes(m)}
                        disabled={active}
                        style={{ fontSize: 11 }}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timer display */}
                {(active || timeLeft > 0) && (
                  <div className={`meetings-breakout-timer ${timerClass}`}>
                    {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                  </div>
                )}

                {/* Start/Stop */}
                <button
                  className="meetings-breakout-start-btn"
                  disabled={!active && totalAssigned === 0}
                  onClick={() => setActive(!active)}
                >
                  {active ? (
                    <><Square />End Breakout</>
                  ) : (
                    <><Play />Start Breakout</>
                  )}
                </button>

                {/* Broadcast */}
                {broadcastMode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      className="meetings-chat-input"
                      placeholder="Message to all rooms..."
                      value={broadcastMsg}
                      onChange={e => setBroadcastMsg(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="meetings-breakout-broadcast-btn"
                        style={{ flex: 1 }}
                        onClick={() => { setBroadcastMode(false); setBroadcastMsg(''); }}
                      >
                        Cancel
                      </button>
                      <button
                        className="meetings-breakout-start-btn"
                        style={{ flex: 1, marginTop: 0 }}
                        disabled={!broadcastMsg.trim()}
                        onClick={() => { setBroadcastMode(false); setBroadcastMsg(''); }}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="meetings-breakout-broadcast-btn" onClick={() => setBroadcastMode(true)}>
                    <Megaphone /> Broadcast to All
                  </button>
                )}

                {/* Recall */}
                <button className="meetings-breakout-recall-btn" onClick={onClose}>
                  <Users /> Call Everyone Back
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="meetings-modal-footer">
          <span style={{ fontSize: 12, color: 'var(--mtg-text-muted)' }}>
            {totalAssigned} of {activeParticipants.length} participants assigned
          </span>
          <button className="meetings-modal-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MEETING SUMMARY VIEW
// ============================================

// Gemini-extracted action items can be promoted into the real tasks table via
// dataService.createTask. Two things persist to localStorage, keyed by a stable
// `${meetingTitle}::${title}` signature (action-item ids are regenerated per
// render, so they can't be the key): which items are already in Tasks (so we
// never double-add and the "In Tasks" state survives back-navigation), and the
// completion-toggle state (previously lost the moment you navigated back).
const SUMMARY_ADDED_KEY = 'pulse_meeting_summary_added_v1';
const SUMMARY_TOGGLE_KEY = 'pulse_meeting_summary_toggles_v1';
const readSummaryMap = (key: string): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
};
const writeSummaryMap = (key: string, map: Record<string, string>) => {
  try { localStorage.setItem(key, JSON.stringify(map)); } catch { /* ignore quota */ }
};

interface MeetingSummaryViewProps {
  data: MeetingSummaryData | null;
  loading: boolean;
  onBack: () => void;
}

export const MeetingSummaryView: React.FC<MeetingSummaryViewProps> = ({ data, loading, onBack }) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItem[]>(data?.actionItems || []);
  const [copiedToast, setCopiedToast] = useState(false);
  const [entomateConnected, setEntomateConnected] = useState(false);
  const [entomateExporting, setEntomateExporting] = useState(false);
  const [addedTaskSigs, setAddedTaskSigs] = useState<Set<string>>(new Set());
  const [addingAllTasks, setAddingAllTasks] = useState(false);

  const sigFor = (title: string) => `${data?.meetingTitle ?? 'Meeting'}::${title}`;

  useEffect(() => {
    if (!data) return;
    // Hydrate completion toggles + which items are already in Tasks from the
    // persisted maps, keyed by the stable meeting::title signature.
    const toggles = readSummaryMap(SUMMARY_TOGGLE_KEY);
    const meeting = data.meetingTitle ?? 'Meeting';
    setActionItems((data.actionItems || []).map(a => {
      const persisted = toggles[`${meeting}::${a.title}`];
      return persisted === 'completed' || persisted === 'pending'
        ? { ...a, status: persisted }
        : a;
    }));
    setAddedTaskSigs(new Set(Object.keys(readSummaryMap(SUMMARY_ADDED_KEY))));
  }, [data]);

  useEffect(() => {
    isEntomateConnected().then(setEntomateConnected);
  }, []);

  const toggleActionItem = (id: string) => {
    setActionItems(prev => prev.map(a => {
      if (a.id !== id) return a;
      const nextStatus: ActionItem['status'] = a.status === 'completed' ? 'pending' : 'completed';
      const map = readSummaryMap(SUMMARY_TOGGLE_KEY);
      map[sigFor(a.title)] = nextStatus;
      writeSummaryMap(SUMMARY_TOGGLE_KEY, map);
      return { ...a, status: nextStatus };
    }));
  };

  // Promote a single Gemini-extracted action item into the real tasks table via
  // the canonical dataService.createTask path (handles the text user_id + RLS).
  const handleCreateTask = async (item: ActionItem) => {
    const signature = sigFor(item.title);
    if (addedTaskSigs.has(signature)) return;
    const created = await dataService.createTask({
      title: item.title,
      completed: item.status === 'completed',
      listId: 'work',
      assigneeId: item.assignee?.id,
    });
    if (!created) {
      toast.error('Could not add to Tasks', { duration: 3000, position: 'bottom-right' });
      return;
    }
    setAddedTaskSigs(prev => {
      const next = new Set(prev).add(signature);
      const map = readSummaryMap(SUMMARY_ADDED_KEY);
      map[signature] = '1';
      writeSummaryMap(SUMMARY_ADDED_KEY, map);
      return next;
    });
    toast.success('Added to Tasks', { duration: 2500, position: 'bottom-right' });
  };

  const handleAddAllTasks = async () => {
    const pending = actionItems.filter(a => !addedTaskSigs.has(sigFor(a.title)));
    if (pending.length === 0) return;
    setAddingAllTasks(true);
    const added: string[] = [];
    for (const item of pending) {
      const created = await dataService.createTask({
        title: item.title,
        completed: item.status === 'completed',
        listId: 'work',
        assigneeId: item.assignee?.id,
      });
      if (created) added.push(sigFor(item.title));
    }
    if (added.length > 0) {
      setAddedTaskSigs(prev => {
        const next = new Set(prev);
        const map = readSummaryMap(SUMMARY_ADDED_KEY);
        added.forEach(s => { next.add(s); map[s] = '1'; });
        writeSummaryMap(SUMMARY_ADDED_KEY, map);
        return next;
      });
    }
    setAddingAllTasks(false);
    if (added.length > 0) {
      toast.success(`Added ${added.length} task${added.length === 1 ? '' : 's'} to Tasks`, { duration: 2500, position: 'bottom-right' });
    } else {
      toast.error('Could not add tasks', { duration: 3000, position: 'bottom-right' });
    }
  };

  const handleExportToEntomate = async () => {
    if (!data) return;
    setEntomateExporting(true);
    try {
      const recording: MeetingRecording = {
        id: crypto.randomUUID(),
        title: data.meetingTitle,
        startTime: new Date(),
        durationMinutes: data.duration || null,
        audioFileUrl: '',
        transcript: data.aiSummary || null,
        summary: data.aiSummary || null,
        attendees: data.participants.map(p => p.name),
      };
      const result = await exportMeetingToEntomate(recording, 'pulse_video');
      if (result.success) {
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2000);
      }
    } catch (err) {
      console.error('Entomate export failed:', err);
    }
    setEntomateExporting(false);
    setShowExportMenu(false);
  };

  const copyToClipboard = () => {
    if (!data) return;
    const text = [
      `# ${data.meetingTitle}`,
      `Date: ${new Date().toLocaleDateString()}  Duration: ${data.duration} min`,
      `Participants: ${data.participants.map(p => p.name).join(', ')}`,
      '',
      '## Summary',
      data.aiSummary,
      '',
      '## Key Points',
      ...data.keyPoints.map(p => `- ${p}`),
      '',
      '## Action Items',
      ...actionItems.map(a => `- [${a.status === 'completed' ? 'x' : ' '}] ${a.title}${a.assignee ? ` (@${a.assignee.name})` : ''}`),
      '',
      '## Key Decisions',
      ...data.decisions.map(d => `- ${d}`),
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    });
    setShowExportMenu(false);
  };

  return (
    <div className="meetings-summary-view">
      {copiedToast && <Toast message="Copied to clipboard!" isVisible />}

      {/* Header */}
      <div className="meetings-summary-header">
        <button className="meetings-summary-back" onClick={onBack}>
          <ArrowLeft /> Back
        </button>

        <div className="meetings-summary-title-block">
          <div className="meetings-summary-title">{data?.meetingTitle || 'Meeting Summary'}</div>
          <div className="meetings-summary-meta">
            <span>{new Date().toLocaleDateString()}</span>
            {data && <span>·</span>}
            {data && <span>{data.duration} min</span>}
          </div>
        </div>

        {data && data.participants.length > 0 && (
          <div className="meetings-summary-participants-row">
            {data.participants.slice(0, 5).map((p, i) => (
              <div
                key={p.id}
                className="meetings-summary-participant-avatar"
                style={{ background: p.avatarColor || '#f43f5e', zIndex: 5 - i }}
                title={p.name}
              >
                {p.name.charAt(0)}
              </div>
            ))}
            {data.participants.length > 5 && (
              <div className="meetings-summary-participant-avatar" style={{ background: 'var(--mtg-bg-elevated)' }}>
                +{data.participants.length - 5}
              </div>
            )}
          </div>
        )}

        <div className="meetings-summary-export-btn">
          <button
            className="meetings-summary-export-trigger"
            onClick={() => setShowExportMenu(!showExportMenu)}
          >
            <Upload />
            Export
            <ChevronDown />
          </button>
          {showExportMenu && (
            <div className="meetings-summary-export-menu">
              <button onClick={copyToClipboard}>
                <Copy />
                Copy as Markdown
              </button>
              <button onClick={() => { window.print(); setShowExportMenu(false); }}>
                <FileText />
                Save as PDF
              </button>
              {entomateConnected && (
                <button onClick={handleExportToEntomate} disabled={entomateExporting}>
                  <Upload />
                  {entomateExporting ? 'Exporting...' : 'Export to Entomate'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="meetings-summary-body">
        {/* AI Summary */}
        <div className="meetings-summary-card">
          <div className="meetings-summary-card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AIProvenanceChip vendor="GEMINI" type="SUMMARY" />
            {data && data.keyPoints.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--mtg-text-muted)' }}>
                · {data.keyPoints.length} key point{data.keyPoints.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {loading ? (
            <>
              <div className="meetings-summary-shimmer" />
              <div className="meetings-summary-shimmer" />
              <div className="meetings-summary-shimmer" />
            </>
          ) : (
            <>
              <div className="meetings-summary-ai-text">{data?.aiSummary || 'No summary available.'}</div>
              {data && data.keyPoints.length > 0 && (
                <div className="meetings-summary-key-points">
                  {data.keyPoints.map((p, i) => (
                    <div key={i} className="meetings-summary-key-point">{p}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Items + Decisions */}
        {!loading && data && (
          <div className="meetings-summary-two-col">
            {/* Action Items */}
            <div className="meetings-summary-card">
              <div className="meetings-summary-card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AIProvenanceChip vendor="GEMINI" type="ACTIONS" />
                <span style={{ fontSize: 11, color: 'var(--mtg-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  · {actionItems.length}
                </span>
                {actionItems.some(a => !addedTaskSigs.has(sigFor(a.title))) && (
                  <button
                    type="button"
                    onClick={handleAddAllTasks}
                    disabled={addingAllTasks}
                    title="Create a task for every action item"
                    style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'var(--font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--mtg-accent-primary)', background: 'transparent', border: 'none', cursor: addingAllTasks ? 'default' : 'pointer', flexShrink: 0, opacity: addingAllTasks ? 0.6 : 1 }}
                  >
                    {addingAllTasks ? 'Adding…' : <><Plus size={12} /> Add all</>}
                  </button>
                )}
              </div>
              {actionItems.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--mtg-text-muted)' }}>No action items captured.</div>
              ) : actionItems.map(item => (
                <div key={item.id} className="meetings-summary-action-item">
                  <button
                    className={`meetings-summary-action-toggle ${item.status === 'completed' ? 'done' : ''}`}
                    onClick={() => toggleActionItem(item.id)}
                  >
                    {item.status === 'completed' && <Check />}
                  </button>
                  <div className="meetings-summary-action-text">
                    <div className={item.status === 'completed' ? 'done' : ''}>{item.title}</div>
                    {item.assignee && (
                      <div style={{ fontSize: 10, color: 'var(--mtg-text-muted)', marginTop: 2 }}>
                        @{item.assignee.name}
                      </div>
                    )}
                  </div>
                  {addedTaskSigs.has(sigFor(item.title)) ? (
                    <span
                      title="Already added to Tasks"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, marginTop: 1, fontSize: 10, fontFamily: 'var(--font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--mtg-accent-success)' }}
                    >
                      <Check size={12} /> In Tasks
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCreateTask(item)}
                      title="Create a task from this action item"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, marginTop: 1, fontSize: 11, color: 'var(--mtg-text-secondary)', background: 'var(--mtg-bg-elevated)', border: '1px solid var(--mtg-border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                    >
                      <Plus size={12} /> Task
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Decisions */}
            <div className="meetings-summary-card">
              <div className="meetings-summary-card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AIProvenanceChip vendor="GEMINI" type="DECISIONS" />
                <span style={{ fontSize: 11, color: 'var(--mtg-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  · {data.decisions.length}
                </span>
              </div>
              {data.decisions.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--mtg-text-muted)' }}>No key decisions identified.</div>
              ) : data.decisions.map((d, i) => (
                <div key={i} className="meetings-summary-decision">
                  <CheckCircle2 />
                  <div className="meetings-summary-decision-text">{d}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        {!loading && data && data.timelineEvents.length > 0 && (
          <div className="meetings-summary-card">
            <div className="meetings-summary-card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AIProvenanceChip vendor="GEMINI" type="TIMELINE" />
            </div>
            <div className="meetings-summary-timeline">
              {data.timelineEvents.slice(0, 10).map((entry, i) => (
                <div key={i} className="meetings-summary-timeline-item">
                  <div className="meetings-summary-timeline-ts">{entry.timestamp}</div>
                  <div className="meetings-summary-timeline-dot" />
                  <div className="meetings-summary-timeline-note">{entry.note}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
