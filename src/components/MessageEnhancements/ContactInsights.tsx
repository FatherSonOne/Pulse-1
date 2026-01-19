// Contact Insights Panel with Relationship Analytics
import React, { useState, useMemo } from 'react';

interface ContactData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  company?: string;
  role?: string;
  tags: string[];
  firstContact: string;
  lastContact: string;
  timezone?: string;
  preferredContactTime?: string;
}

interface ConversationMetrics {
  totalMessages: number;
  userMessages: number;
  contactMessages: number;
  avgResponseTime: number; // in minutes
  longestStreak: number; // days
  currentStreak: number;
  sentimentTrend: 'positive' | 'neutral' | 'negative';
  topTopics: Array<{ topic: string; count: number }>;
  activeHours: number[]; // 0-23 representing active hours
  activeDays: string[]; // mon-sun
}

interface RelationshipHealth {
  score: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  factors: Array<{
    name: string;
    score: number;
    impact: 'positive' | 'neutral' | 'negative';
  }>;
  suggestions: string[];
}

interface ContactInsightsProps {
  contactId?: string;
  contact?: ContactData;
  metrics?: ConversationMetrics;
  health?: RelationshipHealth;
  recentActivity?: Array<{
    type: 'message' | 'call' | 'meeting' | 'shared';
    description: string;
    timestamp: string;
  }>;
  onScheduleFollowUp?: () => void;
  onAddNote?: (note: string) => void;
  onUpdateTags?: (tags: string[]) => void;
  onContactSelect?: (contactId: string) => void;
  compact?: boolean;
}

// Default data for when no contact is loaded
const defaultContact: ContactData = {
  id: '',
  name: 'No Contact Selected',
  tags: [],
  firstContact: new Date().toISOString(),
  lastContact: new Date().toISOString(),
};

const defaultMetrics: ConversationMetrics = {
  totalMessages: 0,
  userMessages: 0,
  contactMessages: 0,
  avgResponseTime: 0,
  longestStreak: 0,
  currentStreak: 0,
  sentimentTrend: 'neutral',
  topTopics: [],
  activeHours: [],
  activeDays: [],
};

const defaultHealth: RelationshipHealth = {
  score: 0,
  trend: 'stable',
  factors: [],
  suggestions: ['Start a conversation to build your relationship'],
};

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const ContactInsights: React.FC<ContactInsightsProps> = ({
  contactId,
  contact = defaultContact,
  metrics = defaultMetrics,
  health = defaultHealth,
  recentActivity = [],
  onScheduleFollowUp,
  onAddNote,
  onUpdateTags,
  onContactSelect,
  compact = false
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'activity' | 'notes'>('overview');
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');

  // Calculate relationship duration
  const relationshipDuration = useMemo(() => {
    const start = new Date(contact.firstContact);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${Math.floor(days / 365)} years`;
  }, [contact.firstContact]);

  // Time since last contact
  const timeSinceLastContact = useMemo(() => {
    const last = new Date(contact.lastContact);
    const now = new Date();
    const diffMs = now.getTime() - last.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return last.toLocaleDateString();
  }, [contact.lastContact]);

  // Format response time
  const formatResponseTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  };

  // Get health color
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'amber';
    if (score >= 40) return 'orange';
    return 'red';
  };

  const healthColor = getHealthColor(health.score);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${healthColor}-100 dark:bg-${healthColor}-900/40`}>
          {contact.avatar ? (
            <img src={contact.avatar} alt={contact.name} className="w-full h-full rounded-full" />
          ) : (
            <span className={`text-sm font-bold text-${healthColor}-600 dark:text-${healthColor}-400`}>
              {getInitials(contact.name)}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-800 dark:text-white">{contact.name}</p>
          <p className="text-xs text-zinc-500">{timeSinceLastContact}</p>
        </div>
        <div className={`ml-auto px-2 py-1 rounded-full text-xs font-medium bg-${healthColor}-100 dark:bg-${healthColor}-900/40 text-${healthColor}-600 dark:text-${healthColor}-400`}>
          {health.score}%
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
        <div className="flex items-start gap-3">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-${healthColor}-100 dark:bg-${healthColor}-900/40 flex-shrink-0`}>
            {contact.avatar ? (
              <img src={contact.avatar} alt={contact.name} className="w-full h-full rounded-xl object-cover" />
            ) : (
              <span className={`text-xl font-bold text-${healthColor}-600 dark:text-${healthColor}-400`}>
                {getInitials(contact.name)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">{contact.name}</h3>
            {contact.role && contact.company && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {contact.role} at {contact.company}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {contact.email && (
                <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                  <i className="fa-solid fa-envelope" />
                  {contact.email}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-${healthColor}-100 dark:bg-${healthColor}-900/40`}>
              <span className={`text-lg font-bold text-${healthColor}-600 dark:text-${healthColor}-400`}>
                {health.score}
              </span>
              <span className={`text-[10px] text-${healthColor}-500`}>/ 100</span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1 flex items-center justify-end gap-1">
              {health.trend === 'improving' && <i className="fa-solid fa-arrow-up text-green-500" />}
              {health.trend === 'declining' && <i className="fa-solid fa-arrow-down text-red-500" />}
              {health.trend === 'stable' && <i className="fa-solid fa-minus text-zinc-400" />}
              {health.trend}
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="text-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
            <p className="text-lg font-bold text-zinc-800 dark:text-white">{metrics.totalMessages}</p>
            <p className="text-[10px] text-zinc-500">Messages</p>
          </div>
          <div className="text-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
            <p className="text-lg font-bold text-zinc-800 dark:text-white">{relationshipDuration}</p>
            <p className="text-[10px] text-zinc-500">Connected</p>
          </div>
          <div className="text-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
            <p className="text-lg font-bold text-zinc-800 dark:text-white">{formatResponseTime(metrics.avgResponseTime)}</p>
            <p className="text-[10px] text-zinc-500">Avg Reply</p>
          </div>
          <div className="text-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
            <p className="text-lg font-bold text-zinc-800 dark:text-white">{metrics.currentStreak}</p>
            <p className="text-[10px] text-zinc-500">Day Streak</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-2 border-b border-zinc-100 dark:border-zinc-700">
        {[
          { id: 'overview', label: 'Overview', icon: 'fa-eye' },
          { id: 'metrics', label: 'Metrics', icon: 'fa-chart-line' },
          { id: 'activity', label: 'Activity', icon: 'fa-clock' },
          { id: 'notes', label: 'Notes', icon: 'fa-sticky-note' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === tab.id
                ? 'bg-blue-500 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
            }`}
          >
            <i className={`fa-solid ${tab.icon}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-h-72 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Health factors */}
            <div>
              <h4 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Relationship Factors</h4>
              <div className="space-y-2">
                {health.factors.map((factor, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-zinc-700 dark:text-zinc-300">{factor.name}</span>
                        <span className={`text-xs font-medium ${
                          factor.impact === 'positive' ? 'text-green-500' :
                          factor.impact === 'negative' ? 'text-red-500' : 'text-zinc-400'
                        }`}>
                          {factor.score}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            factor.impact === 'positive' ? 'bg-green-500' :
                            factor.impact === 'negative' ? 'bg-red-500' : 'bg-zinc-400'
                          }`}
                          style={{ width: `${factor.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Suggestions */}
            {health.suggestions.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Suggestions</h4>
                <div className="space-y-2">
                  {health.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <i className="fa-solid fa-lightbulb text-amber-500 text-xs mt-0.5" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">{suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            <div>
              <h4 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Tags</h4>
              <div className="flex flex-wrap gap-1">
                {contact.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                  >
                    {tag}
                  </span>
                ))}
                {onUpdateTags && (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add tag..."
                      className="w-16 px-1.5 py-0.5 text-[10px] rounded border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTag.trim()) {
                          onUpdateTags([...contact.tags, newTag.trim()]);
                          setNewTag('');
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {onScheduleFollowUp && (
              <button
                onClick={onScheduleFollowUp}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition"
              >
                <i className="fa-solid fa-calendar-plus" />
                Schedule Follow-up
              </button>
            )}
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="space-y-4">
            {/* Message balance */}
            <div>
              <h4 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Message Balance</h4>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-3 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${(metrics.userMessages / metrics.totalMessages) * 100}%` }}
                  />
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${(metrics.contactMessages / metrics.totalMessages) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-blue-500">You: {metrics.userMessages}</span>
                <span className="text-[10px] text-green-500">{contact.name}: {metrics.contactMessages}</span>
              </div>
            </div>

            {/* Active hours heatmap */}
            <div>
              <h4 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Active Hours</h4>
              <div className="grid grid-cols-12 gap-1">
                {Array.from({ length: 24 }, (_, i) => {
                  const isActive = metrics.activeHours.includes(i);
                  return (
                    <div
                      key={i}
                      className={`h-6 rounded text-[8px] flex items-center justify-center ${
                        isActive
                          ? 'bg-blue-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400'
                      }`}
                      title={`${i}:00`}
                    >
                      {i % 6 === 0 ? i : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active days */}
            <div>
              <h4 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Active Days</h4>
              <div className="flex gap-1">
                {daysOfWeek.map((day, idx) => {
                  const isActive = metrics.activeDays.includes(day.toLowerCase());
                  return (
                    <div
                      key={day}
                      className={`flex-1 py-2 rounded text-center text-xs font-medium ${
                        isActive
                          ? 'bg-green-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400'
                      }`}
                    >
                      {day[0]}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top topics */}
            {metrics.topTopics.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Top Topics</h4>
                <div className="space-y-1">
                  {metrics.topTopics.slice(0, 5).map((topic, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-700 dark:text-zinc-300">{topic.topic}</span>
                      <span className="text-[10px] text-zinc-400">{topic.count} mentions</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-2">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-3">
                  <i className="fa-solid fa-clock text-zinc-400 text-lg" />
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No recent activity</p>
              </div>
            ) : (
              recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-lg transition">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    activity.type === 'message' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-500' :
                    activity.type === 'call' ? 'bg-green-100 dark:bg-green-900/40 text-green-500' :
                    activity.type === 'meeting' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-500' :
                    'bg-amber-100 dark:bg-amber-900/40 text-amber-500'
                  }`}>
                    <i className={`fa-solid ${
                      activity.type === 'message' ? 'fa-message' :
                      activity.type === 'call' ? 'fa-phone' :
                      activity.type === 'meeting' ? 'fa-video' :
                      'fa-share'
                    } text-sm`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-700 dark:text-zinc-300">{activity.description}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {new Date(activity.timestamp).toLocaleDateString()} at{' '}
                      {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-3">
            {onAddNote && (
              <div>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note about this contact..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white resize-none"
                  rows={3}
                />
                <button
                  onClick={() => {
                    if (newNote.trim()) {
                      onAddNote(newNote.trim());
                      setNewNote('');
                    }
                  }}
                  disabled={!newNote.trim()}
                  className="mt-2 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Note
                </button>
              </div>
            )}
            <div className="text-center py-4 text-zinc-400 text-xs">
              Notes will appear here
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Compact contact card
export const ContactCard: React.FC<{
  contact: ContactData;
  healthScore: number;
  lastMessage?: string;
  onClick?: () => void;
}> = ({ contact, healthScore, lastMessage, onClick }) => {
  const healthColor = healthScore >= 80 ? 'green' : healthScore >= 60 ? 'amber' : healthScore >= 40 ? 'orange' : 'red';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition text-left"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${healthColor}-100 dark:bg-${healthColor}-900/40`}>
        {contact.avatar ? (
          <img src={contact.avatar} alt={contact.name} className="w-full h-full rounded-full" />
        ) : (
          <span className={`text-sm font-bold text-${healthColor}-600`}>
            {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-800 dark:text-white truncate">{contact.name}</p>
        {lastMessage && (
          <p className="text-xs text-zinc-500 truncate">{lastMessage}</p>
        )}
      </div>
      <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium bg-${healthColor}-100 dark:bg-${healthColor}-900/40 text-${healthColor}-600`}>
        {healthScore}%
      </div>
    </button>
  );
};

export default ContactInsights;
