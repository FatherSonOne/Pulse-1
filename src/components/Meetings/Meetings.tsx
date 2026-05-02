import React, { useEffect, useMemo, useState } from 'react';
import { fetchCalendarEvents } from '../../services/authService';
import { getArchives } from '../../services/dbService';
import { Contact, CalendarEvent, ArchiveItem } from '../../types';
import './Meetings.css';
import PulseVideoRoom, { MeetingEndSummary } from './PulseVideoRoom';
import { createPulseRoom } from '../../services/pulseVideoService';
import { autoExportIfEnabled, getMeetingSettings, fetchMeetingAnalytics } from '../../services/meetingService';
import { notificationService } from '../../services/notificationService';
import { pulseService } from '../../services/pulseService';
import { googleCalendarService } from '../../services/googleCalendarService';

// Import new components
import { Loader2, X } from 'lucide-react';
import {

  Platform,
  MeetingTemplate,
  AgendaItem,
  ActionItem,
  MeetingInsights,
  MeetingSummaryData,
  BulkInviteModal,
  TemplatesModal,
  AgendaBuilderModal,
  ActionItemsModal,
  AnalyticsModal,
  RecordingsModal,
  DeviceTestModal,
  MeetingSettingsModal,
  BreakoutRoomsModal,
  MeetingSummaryView,
} from './MeetingsComponents';
import {
  TimeRail,
  MeetingsHeaderStrip,
  MeetingsActionRow,
  MeetingsToolsMenu,
  MeetingsInsightLine,
  MeetingsQuickActions,
} from './TimeRail';

interface MeetingsProps {
  apiKey: string;
  contacts: Contact[];
  initialContactId?: string;
  initialMeetingCode?: string;
}

type MeetingView = 'dashboard' | 'active' | 'schedule' | 'summary';

// Get the base URL for meeting links
const getMeetingBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/meeting/`;
  }
  return 'https://pulse.logosvision.org/meeting/';
};

const Meetings: React.FC<MeetingsProps> = ({ apiKey, contacts, initialContactId, initialMeetingCode }) => {
  // ============================================
  // STATE
  // ============================================

  const [view, setView] = useState<MeetingView>(initialContactId || initialMeetingCode ? 'active' : 'dashboard');
  const [upcomingMeets, setUpcomingMeets] = useState<CalendarEvent[]>([]);
  const [pastNotes, setPastNotes] = useState<ArchiveItem[]>([]);

  // Dashboard State
  const [meetingLinkInput, setMeetingLinkInput] = useState('');
  const [showRolodex, setShowRolodex] = useState(false);
  const [selectedForInvite, setSelectedForInvite] = useState<Set<string>>(new Set());
  const [invitePlatform, setInvitePlatform] = useState<Platform>('pulse');

  // Feature Modals State
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAgendaBuilder, setShowAgendaBuilder] = useState(false);
  const [showActionItems, setShowActionItems] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showRecordings, setShowRecordings] = useState(false);
  const [showDeviceTest, setShowDeviceTest] = useState(false);
  const [showMeetingSettings, setShowMeetingSettings] = useState(false);
  const [showBreakoutRooms, setShowBreakoutRooms] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>(() => {
    try {
      const stored = localStorage.getItem('pulse_meeting_action_items');
      if (stored) {
        return JSON.parse(stored).map((a: any) => ({
          ...a,
          createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
          dueDate: a.dueDate ? new Date(a.dueDate) : undefined,
        }));
      }
    } catch { /* ignore */ }
    return [];
  });

  // Persist action items to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('pulse_meeting_action_items', JSON.stringify(actionItems));
  }, [actionItems]);

  // Meeting Summary State
  const [summaryData, setSummaryData] = useState<MeetingSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Meeting Insights State
  const [insights, setInsights] = useState<MeetingInsights>({
    totalMeetings: 0,
    totalHours: 0,
    avgDuration: 0,
    weeklyTrend: []
  });

  // Active Meeting State
  const [activeMeetingTitle, setActiveMeetingTitle] = useState('Instant Meeting');
  const [activeParticipants, setActiveParticipants] = useState<Contact[]>([]);
  const [meetingCode, setMeetingCode] = useState<string | null>(null);
  const [roomCreationError, setRoomCreationError] = useState<string | null>(null);

  // Scheduling State
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleAttendees, setScheduleAttendees] = useState<Set<string>>(new Set());

  // Pulse Video (Daily.co) room state
  const [activeRoom, setActiveRoom] = useState<{ url: string; name: string } | null>(null);

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    refreshDashboard();
  }, []);

  useEffect(() => {
    if (initialContactId) {
      const c = contacts.find(c => c.id === initialContactId);
      if (c) {
        setActiveParticipants([c]);
        createAndJoinPulseRoom(`Meeting with ${c.name}`);
      }
    }
  }, [initialContactId, contacts]);

  useEffect(() => {
    if (initialMeetingCode) {
      // Join an existing room by code
      setMeetingCode(initialMeetingCode);
      setActiveMeetingTitle('Pulse Meeting');
      setActiveParticipants([]);
      setActiveRoom({ url: `https://pulse.daily.co/${initialMeetingCode}`, name: initialMeetingCode });
      setView('active');
      window.history.replaceState({}, '', '/');
    }
  }, [initialMeetingCode]);

  // ============================================
  // DASHBOARD LOGIC
  // ============================================

  const refreshDashboard = async () => {
    const events = await fetchCalendarEvents();
    const meets = events
      .filter(e => e.type === 'meet' && e.start > new Date())
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    setUpcomingMeets(meets);

    const archives = await getArchives();
    const notes = archives
      .filter((a: ArchiveItem) => a.type === 'meeting_note')
      .sort((a: ArchiveItem, b: ArchiveItem) => b.date.getTime() - a.date.getTime());
    setPastNotes(notes);

    // Fetch real analytics for sidebar insights
    const analytics = await fetchMeetingAnalytics();
    setInsights({
      totalMeetings: analytics.totalMeetings,
      totalHours: analytics.totalHours,
      avgDuration: analytics.avgDuration,
      weeklyTrend: analytics.weeklyTrend.map(w => w.count),
    });
  };

  const handleLinkJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingLinkInput.trim()) return;

    const input = meetingLinkInput.trim().toLowerCase();

    if (input.includes('zoom.us') || input.includes('meet.google.com') || input.includes('teams.microsoft.com') || input.includes('skype.com')) {
      window.open(meetingLinkInput, '_blank');
    } else {
      let code = input;
      if (input.includes('/meeting/')) {
        code = input.split('/meeting/').pop() || input;
      }
      code = code.replace(/[/?#].*/g, '').trim();
      const isValidCode = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(code) || /^[a-z0-9-]+$/.test(code);

      if (isValidCode && code.length >= 3) {
        setMeetingCode(code);
        setActiveMeetingTitle(`Pulse Meeting`);
        setActiveParticipants([]);
        setView('active');
      } else {
        alert('Invalid meeting code. Please enter a valid Pulse meeting code (e.g., abc-defg-hij) or a meeting link.');
        return;
      }
    }
    setMeetingLinkInput('');
  };

  // Creates a real Daily.co room then enters the active view
  const createAndJoinPulseRoom = async (title: string, eventId?: string) => {
    try {
      const room = await createPulseRoom(eventId, title);
      const code = room.roomName;
      setMeetingCode(code);
      setActiveMeetingTitle(title);
      setActiveParticipants([]);
      setActiveRoom(room);
      setView('active');
    } catch (err) {
      console.error('[Meetings] Failed to create Pulse room:', err);
      setRoomCreationError('Failed to create meeting room. Please check your connection and try again.');
      setActiveMeetingTitle(title);
      setView('active');
    }
  };

  const startMeeting = (platform: Platform) => {
    if (platform === 'pulse') {
      createAndJoinPulseRoom('Instant Pulse Meeting');
      return;
    } else {
      let url = '';
      switch(platform) {
        case 'google_meet': url = 'https://meet.google.com/new'; break;
        case 'zoom': url = 'https://zoom.us/start'; break;
        case 'skype': url = 'https://web.skype.com/'; break;
        case 'teams': url = 'https://teams.microsoft.com/_#/calendarv2'; break;
      }
      if (url) window.open(url, '_blank');
    }
  };

  const openBulkInvite = (platform: Platform) => {
    setInvitePlatform(platform);
    setSelectedForInvite(new Set());
    setShowRolodex(true);
  };

  const toggleContactSelection = (contactId: string) => {
    const newSet = new Set(selectedForInvite);
    if (newSet.has(contactId)) newSet.delete(contactId);
    else newSet.add(contactId);
    setSelectedForInvite(newSet);
  };

  const sendBulkInvites = async () => {
    if (selectedForInvite.size === 0) return;

    const selectedContacts = contacts.filter(c => selectedForInvite.has(c.id));

    try {
      // Create a Pulse room so we have a real meeting link
      const room = await createPulseRoom(undefined, 'Group Meeting');
      const meetingLink = `${getMeetingBaseUrl()}${room.roomName}`;

      setMeetingCode(room.roomName);
      setActiveMeetingTitle('Group Meeting');
      setActiveRoom(room);

      if (invitePlatform === 'pulse') {
        // Send in-app notification + Pulse message to each selected contact
        for (const contact of selectedContacts) {
          notificationService.notifyCalendarEvent({
            type: 'invite',
            eventTitle: 'Group Meeting',
            startTime: new Date(),
            location: meetingLink,
            organizerName: 'You',
            actionUrl: meetingLink,
          }).catch(err => console.error('Notification failed for', contact.name, err));

          if (contact.pulseUserId) {
            pulseService.sendMessage(
              contact.pulseUserId,
              `You're invited to a Pulse meeting! Join here: ${meetingLink}`
            ).catch(err => console.error('Message failed for', contact.name, err));
          }
        }
      } else {
        // External platforms: create Google Calendar event with attendee emails
        const attendeeEmails = selectedContacts
          .map(c => c.email)
          .filter((e): e is string => !!e);

        if (attendeeEmails.length > 0) {
          const startTime = new Date();
          const endTime = new Date(startTime.getTime() + 30 * 60000);
          googleCalendarService.createEvent(
            {
              id: '',
              title: 'Group Meeting',
              start: startTime,
              end: endTime,
              color: '#f43f5e',
              calendarId: 'primary',
              allDay: false,
              type: 'meet',
              description: `Join the meeting: ${meetingLink}`,
              location: meetingLink,
              attendees: attendeeEmails,
            },
            'primary',
            { sendUpdates: 'all' }
          ).catch(err => console.error('Calendar event creation failed:', err));
        }
      }

      setActiveParticipants(selectedContacts);
      setShowRolodex(false);
      setSelectedForInvite(new Set());
      setView('active');
    } catch (err) {
      console.error('[Meetings] Failed to create room for bulk invite:', err);
      setRoomCreationError('Failed to create meeting room for invite. Please try again.');
    }
  };

  // ============================================
  // FEATURE HANDLERS (NEW)
  // ============================================

  const handleFeatureClick = (featureId: string) => {
    switch (featureId) {
      case 'templates':
        setShowTemplates(true);
        break;
      case 'agenda':
        setShowAgendaBuilder(true);
        break;
      case 'actions':
        setShowActionItems(true);
        break;
      case 'analytics':
        setShowAnalytics(true);
        break;
      case 'recordings':
        setShowRecordings(true);
        break;
      case 'breakout':
        setShowBreakoutRooms(true);
        break;
    }
  };

  const handleTemplateSelect = (template: MeetingTemplate) => {
    setShowTemplates(false);
    setScheduleTitle(template.name);
    setAgendaItems(template.defaultAgenda.map((item, i) => ({
      id: `agenda-${Date.now()}-${i}`,
      title: item,
      duration: Math.floor(template.duration / template.defaultAgenda.length)
    })));
    setView('schedule');
  };

  const handleAddAgendaItem = (item: Omit<AgendaItem, 'id'>) => {
    setAgendaItems([...agendaItems, { ...item, id: `agenda-${Date.now()}` }]);
  };

  const handleRemoveAgendaItem = (id: string) => {
    setAgendaItems(agendaItems.filter(item => item.id !== id));
  };

  const handleAddActionItem = (item: Omit<ActionItem, 'id' | 'createdAt'>) => {
    setActionItems([...actionItems, { ...item, id: crypto.randomUUID(), createdAt: new Date() }]);
  };

  const handleToggleActionStatus = (id: string) => {
    setActionItems(actionItems.map(item =>
      item.id === id
        ? { ...item, status: item.status === 'completed' ? 'pending' : 'completed' }
        : item
    ));
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'share-screen':
        startMeeting('pulse');
        break;
      case 'test-audio':
      case 'test-video':
        setShowDeviceTest(true);
        break;
      case 'settings':
        setShowMeetingSettings(true);
        break;
    }
  };

  // ============================================
  // SCHEDULE LOGIC
  // ============================================

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTitle || !scheduleTime) return;

    const startTime = new Date(scheduleTime);
    const settings = getMeetingSettings();
    const endTime = new Date(startTime.getTime() + settings.defaultDuration * 60000);

    const attendeeEmails = Array.from(scheduleAttendees)
      .map(id => contacts.find(c => c.id === id)?.email)
      .filter((e): e is string => !!e);

    await googleCalendarService.createEvent(
      {
        id: '',
        title: scheduleTitle,
        start: startTime,
        end: endTime,
        color: '#f43f5e',
        calendarId: 'primary',
        allDay: false,
        type: 'meet',
        description: agendaItems.length > 0
          ? 'Agenda:\n' + agendaItems.map((item, i) => `${i + 1}. ${item.title} (${item.duration} min)`).join('\n')
          : '',
        attendees: attendeeEmails,
      },
      'primary',
      { sendUpdates: 'all' }
    );

    await refreshDashboard();
    setView('dashboard');
    setScheduleTitle('');
    setScheduleTime('');
    setScheduleAttendees(new Set());
    setAgendaItems([]);
  };

  // ============================================
  // MEETING SETTINGS (memoized for PulseVideoRoom)
  // ============================================

  const meetingSettings = useMemo(() => getMeetingSettings(), [activeRoom]);

  // ============================================
  // RENDER: DASHBOARD VIEW
  // ============================================

  if (view === 'dashboard') {
    const pendingCount = actionItems.filter(i => i.status !== 'completed').length;
    const totalScheduled = upcomingMeets.length + pastNotes.length;
    // Compare last week's avg duration to overall avg for the trend signal.
    const trendDelta = insights.weeklyTrend.length >= 2
      ? Math.round((insights.weeklyTrend[insights.weeklyTrend.length - 1] || 0)
                 - (insights.weeklyTrend[insights.weeklyTrend.length - 2] || 0))
      : undefined;

    return (
      <div className="meetings-container">
        {/* Modals — all advanced features preserved */}
        <BulkInviteModal
          isOpen={showRolodex}
          platform={invitePlatform}
          contacts={contacts}
          selectedContacts={selectedForInvite}
          onToggleContact={toggleContactSelection}
          onSend={sendBulkInvites}
          onClose={() => setShowRolodex(false)}
        />
        <TemplatesModal
          isOpen={showTemplates}
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplates(false)}
        />
        <AgendaBuilderModal
          isOpen={showAgendaBuilder}
          items={agendaItems}
          onAddItem={handleAddAgendaItem}
          onRemoveItem={handleRemoveAgendaItem}
          onClose={() => setShowAgendaBuilder(false)}
        />
        <ActionItemsModal
          isOpen={showActionItems}
          items={actionItems}
          contacts={contacts}
          onAddItem={handleAddActionItem}
          onToggleStatus={handleToggleActionStatus}
          onClose={() => setShowActionItems(false)}
        />
        <AnalyticsModal isOpen={showAnalytics} onClose={() => setShowAnalytics(false)} />
        <RecordingsModal isOpen={showRecordings} onClose={() => setShowRecordings(false)} />
        <DeviceTestModal isOpen={showDeviceTest} onClose={() => setShowDeviceTest(false)} />
        <MeetingSettingsModal isOpen={showMeetingSettings} onClose={() => setShowMeetingSettings(false)} />
        <BreakoutRoomsModal
          isOpen={showBreakoutRooms}
          onClose={() => setShowBreakoutRooms(false)}
          activeParticipants={activeParticipants}
        />

        {/* Header strip */}
        <MeetingsHeaderStrip
          meetingCount={totalScheduled}
          pendingActionCount={pendingCount}
          onOpenTools={() => setShowToolsMenu(v => !v)}
          onOpenActions={() => setShowActionItems(true)}
          onOpenSettings={() => setShowMeetingSettings(true)}
        />

        {/* Tools popover — Templates / Agenda / Recordings / Analytics / Bulk Invite / Breakout / Device Test */}
        <MeetingsToolsMenu
          open={showToolsMenu}
          onClose={() => setShowToolsMenu(false)}
          onTemplates={() => setShowTemplates(true)}
          onAgenda={() => setShowAgendaBuilder(true)}
          onRecordings={() => setShowRecordings(true)}
          onAnalytics={() => setShowAnalytics(true)}
          onBulkInvite={() => openBulkInvite('pulse')}
          onBreakout={() => setShowBreakoutRooms(true)}
          onDeviceTest={() => setShowDeviceTest(true)}
        />

        {/* Action row — Join + Start (with platform overflow) + Schedule */}
        <MeetingsActionRow
          joinValue={meetingLinkInput}
          onJoinChange={setMeetingLinkInput}
          onJoinSubmit={handleLinkJoin}
          onStartPulse={() => startMeeting('pulse')}
          onStartExternal={(p) => startMeeting(p)}
          onSchedule={() => setView('schedule')}
        />

        {/* Time-rail dashboard */}
        <div className="mtg-dashboard">
          <main className="mtg-dashboard-main">
            <TimeRail
              meetings={upcomingMeets}
              recentNotes={pastNotes}
              onJoinMeeting={(m) => createAndJoinPulseRoom(m.title, m.id)}
              onOpenMeeting={(m) => createAndJoinPulseRoom(m.title, m.id)}
              onOpenRecap={(note) => {
                setSummaryData({
                  aiSummary: note.content || '',
                  keyPoints: [],
                  actionItems: [],
                  decisions: [],
                  timelineEvents: [],
                  participants: [],
                  duration: 0,
                  meetingTitle: note.title,
                });
                setView('summary');
              }}
            />
          </main>
          <aside className="mtg-dashboard-aside">
            <MeetingsInsightLine
              avgDurationMinutes={insights.avgDuration}
              weeklyTrendDelta={trendDelta}
            />
            <MeetingsQuickActions onAction={handleQuickAction} />
          </aside>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: SCHEDULE VIEW
  // ============================================

  if (view === 'schedule') {
    return (
      <div className="meetings-container">
        <div className="meetings-schedule">
          <div className="meetings-schedule-form">
            <div className="meetings-schedule-header">
              <h2 className="meetings-schedule-title">Schedule Meeting</h2>
              <button
                className="meetings-schedule-close"
                onClick={() => setView('dashboard')}
              >
                <X />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit}>
              <div className="meetings-form-group">
                <label className="meetings-form-label">Title</label>
                <input
                  type="text"
                  required
                  className="meetings-form-input"
                  placeholder="Project Sync, Design Review..."
                  value={scheduleTitle}
                  onChange={(e) => setScheduleTitle(e.target.value)}
                />
              </div>

              <div className="meetings-form-group">
                <label className="meetings-form-label">Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  className="meetings-form-input"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>

              <div className="meetings-form-group">
                <label className="meetings-form-label">Participants</label>
                <div className="meetings-attendee-chips">
                  {Array.from(scheduleAttendees).map(id => {
                    const c = contacts.find(co => co.id === id);
                    return (
                      <span key={id} className="meetings-attendee-chip">
                        {c?.name}
                        <button
                          type="button"
                          onClick={() => {
                            const s = new Set(scheduleAttendees);
                            s.delete(id);
                            setScheduleAttendees(s);
                          }}
                        >
                          <X />
                        </button>
                      </span>
                    );
                  })}
                </div>
                <select
                  className="meetings-form-select"
                  onChange={(e) => {
                    if (e.target.value) {
                      setScheduleAttendees(new Set(scheduleAttendees).add(e.target.value));
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">Add participant...</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Agenda Preview (NEW) */}
              {agendaItems.length > 0 && (
                <div className="meetings-form-group">
                  <label className="meetings-form-label">
                    Agenda ({agendaItems.length} items)
                  </label>
                  <div style={{
                    background: 'var(--mtg-bg-primary)',
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 12,
                    color: 'var(--mtg-text-secondary)',
                    maxHeight: 120,
                    overflow: 'auto'
                  }}>
                    {agendaItems.map((item, i) => (
                      <div key={item.id} style={{ marginBottom: 6 }}>
                        {i + 1}. {item.title} ({item.duration} min)
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button type="submit" className="meetings-submit-btn">
                Create Event
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: SUMMARY VIEW
  // ============================================

  if (view === 'summary') {
    return (
      <div className="meetings-container">
        <MeetingSummaryView
          data={summaryData}
          loading={summaryLoading}
          onBack={() => {
            setSummaryData(null);
            setView('dashboard');
            refreshDashboard();
          }}
        />
      </div>
    );
  }

  // ============================================
  // RENDER: ACTIVE MEETING VIEW
  // ============================================

  // If we have a real Daily room, render PulseVideoRoom (full-screen)
  if (activeRoom) {
    return (
      <div className="meetings-container">
        <PulseVideoRoom
          roomUrl={activeRoom.url}
          roomName={activeRoom.name}
          meetingTitle={activeMeetingTitle}
          isHost
          initialMicOff={meetingSettings.autoMuteOnJoin}
          initialCameraOff={!meetingSettings.hostVideoDefault}
          autoRecord={meetingSettings.autoRecording}
          autoTranscribe={meetingSettings.aiScribeDefault}
          onLeave={(summary?: MeetingEndSummary) => {
            setActiveRoom(null);
            if (summary && (summary.transcript || summary.summary)) {
              // Parse structured Gemini JSON if available, else treat as plain text
              let structured: { keyPoints?: string[]; actionItems?: { text: string; owner?: string }[]; decisions?: string[] } = {};
              try { structured = JSON.parse(summary.summary); } catch { /* plain text summary */ }
              setSummaryData({
                aiSummary: summary.summary,
                keyPoints: structured.keyPoints ?? [],
                actionItems: (structured.actionItems ?? []).map(a => ({
                  id: crypto.randomUUID(),
                  title: a.text,
                  assignee: undefined,
                  status: 'pending' as const,
                  createdAt: new Date(),
                })),
                decisions: structured.decisions ?? [],
                timelineEvents: [],
                participants: activeParticipants,
                duration: Math.round(summary.durationSeconds / 60),
                meetingTitle: activeMeetingTitle,
              });
              setView('summary');

              // Auto-export to Entomate (fire-and-forget)
              autoExportIfEnabled({
                title: activeMeetingTitle,
                transcript: summary.transcript || null,
                attendees: activeParticipants.map(p => p.name),
                durationMinutes: Math.round(summary.durationSeconds / 60),
                source: 'pulse_video',
              });
            } else {
              setView('dashboard');
            }
          }}
        />
      </div>
    );
  }

  // No active room — show error/retry or loading state
  return (
    <div className="meetings-container">
      <div className="meetings-active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        {roomCreationError ? (
          <div className="meetings-room-error">
            <div className="meetings-room-error-icon">
              <X />
            </div>
            <div className="meetings-room-error-text">{roomCreationError}</div>
            <div className="meetings-room-error-actions">
              <button
                type="button"
                className="meetings-submit-btn"
                onClick={() => {
                  setRoomCreationError(null);
                  createAndJoinPulseRoom(activeMeetingTitle);
                }}
              >
                Retry
              </button>
              <button
                type="button"
                className="meetings-schedule-close"
                onClick={() => { setRoomCreationError(null); setView('dashboard'); }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="meetings-room-loading">
            <Loader2 className="meetings-room-loading-spinner" />
            <div>Creating meeting room...</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Meetings;
