import React, { useEffect, useRef, useState } from 'react';
import { blobToBase64 } from '../../services/audioService';
import { generateMeetingNote } from '../../services/geminiService';
import { createGoogleCalendarEvent, fetchCalendarEvents } from '../../services/authService';
import { saveArchiveItem, getArchives } from '../../services/dbService';
import { Contact, CalendarEvent, ArchiveItem } from '../../types';
import AudioVisualizer from '../AudioVisualizer';
import './Meetings.css';

// Import new components
import {
  Platform,
  MeetingTemplate,
  AgendaItem,
  ActionItem,
  MeetingInsights,
  HeroSection,
  PlatformCards,
  FeatureCards,
  MeetingHistory,
  UpcomingMeetings,
  QuickActions,
  MeetingInsightsCard,
  BulkInviteModal,
  TemplatesModal,
  AgendaBuilderModal,
  ActionItemsModal,
  Toast,
  MEETING_TEMPLATES,
} from './MeetingsComponents';

interface MeetingsProps {
  apiKey: string;
  contacts: Contact[];
  initialContactId?: string;
  initialMeetingCode?: string;
}

type MeetingView = 'dashboard' | 'active' | 'schedule';

// Generate a unique meeting code (format: XXX-XXXX-XXX)
const generateMeetingCode = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const getSegment = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${getSegment(3)}-${getSegment(4)}-${getSegment(3)}`;
};

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

  // Feature Modals State (NEW)
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAgendaBuilder, setShowAgendaBuilder] = useState(false);
  const [showActionItems, setShowActionItems] = useState(false);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

  // Meeting Insights State (NEW)
  const [insights] = useState<MeetingInsights>({
    totalMeetings: 8,
    totalHours: 12,
    avgDuration: 45,
    weeklyTrend: [60, 40, 80, 50, 90, 70, 45]
  });

  // Active Meeting State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [activeMeetingTitle, setActiveMeetingTitle] = useState('Instant Meeting');
  const [activeParticipants, setActiveParticipants] = useState<Contact[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [meetingCode, setMeetingCode] = useState<string | null>(null);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  // AI Scribe State
  const [scribeActive, setScribeActive] = useState(false);
  const [scribeNotes, setScribeNotes] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Scheduling State
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleAttendees, setScheduleAttendees] = useState<Set<string>>(new Set());

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
        setActiveMeetingTitle(`Meeting with ${c.name}`);
        setView('active');
      }
    }
  }, [initialContactId, contacts]);

  useEffect(() => {
    if (initialMeetingCode) {
      setMeetingCode(initialMeetingCode);
      setActiveMeetingTitle('Pulse Meeting');
      setActiveParticipants([]);
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

  const startMeeting = (platform: Platform) => {
    if (platform === 'pulse') {
      const code = generateMeetingCode();
      setMeetingCode(code);
      setActiveMeetingTitle('Instant Pulse Meeting');
      setActiveParticipants([]);
      setView('active');
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

  const copyMeetingLink = async () => {
    if (!meetingCode) return;
    const link = `${getMeetingBaseUrl()}${meetingCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyMeetingCode = async () => {
    if (!meetingCode) return;
    try {
      await navigator.clipboard.writeText(meetingCode);
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
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

  const sendBulkInvites = () => {
    alert(`Invites sent to ${selectedForInvite.size} contacts for a ${invitePlatform} meeting.`);
    setShowRolodex(false);
    setSelectedForInvite(new Set());

    if (invitePlatform === 'pulse') {
      setActiveMeetingTitle('Group Meeting');
      setActiveParticipants(contacts.filter(c => selectedForInvite.has(c.id)));
      setView('active');
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
        // Could navigate to analytics view
        alert('Meeting Analytics - Feature ready for backend integration');
        break;
      case 'recordings':
        // Could navigate to recordings view
        alert('Recordings - Feature ready for backend integration');
        break;
      case 'breakout':
        alert('Breakout Rooms - Coming Soon!');
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
    setActionItems([...actionItems, { ...item, id: `action-${Date.now()}`, createdAt: new Date() }]);
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
        alert(`${action === 'test-audio' ? 'Audio' : 'Video'} test - Feature ready for implementation`);
        break;
      case 'settings':
        alert('Meeting settings - Feature ready for implementation');
        break;
    }
  };

  // ============================================
  // SCHEDULE LOGIC
  // ============================================

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTitle || !scheduleTime) return;

    await createGoogleCalendarEvent(scheduleTitle, Array.from(scheduleAttendees));
    await refreshDashboard();
    setView('dashboard');
    setScheduleTitle('');
    setScheduleTime('');
    setScheduleAttendees(new Set());
    setAgendaItems([]);
  };

  // ============================================
  // ACTIVE MEETING LOGIC
  // ============================================

  useEffect(() => {
    if (view === 'active') {
      startMedia();
    } else {
      cleanupMedia();
    }
    return () => cleanupMedia();
  }, [view]);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => t.enabled = micOn);
      streamRef.current.getVideoTracks().forEach(t => t.enabled = cameraOn);
    }
  }, [micOn, cameraOn]);

  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      stream.getAudioTracks().forEach(t => t.enabled = micOn);
      stream.getVideoTracks().forEach(t => t.enabled = cameraOn);
    } catch (e) {
      console.error("Media Error", e);
    }
  };

  const handleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        startMedia();
        setIsScreenSharing(false);
      } else {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = displayStream;
        }
        displayStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          startMedia();
        };
        setIsScreenSharing(true);
      }
    } catch (e) {
      console.error("Screen share error", e);
    }
  };

  const cleanupMedia = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
    stopScribe();
    setScribeActive(false);
    setScribeNotes([]);
    setIsScreenSharing(false);
    setHandRaised(false);
    setMeetingCode(null);
  };

  // ============================================
  // AI SCRIBE LOGIC
  // ============================================

  useEffect(() => {
    if (scribeActive && view === 'active') {
      startScribe();
    } else {
      stopScribe();
    }
  }, [scribeActive]);

  const startScribe = () => {
    if (!streamRef.current || !apiKey) return;
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    if (!mimeType) return;

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        const base64 = await blobToBase64(e.data);
        const note = await generateMeetingNote(apiKey, base64, mimeType);
        if (note && note.trim()) {
          setScribeNotes(prev => [...prev, note.trim()]);
        }
      }
    };
    recorder.start(8000);
  };

  const stopScribe = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleLeave = async () => {
    if (scribeNotes.length > 0) {
      await saveArchiveItem({
        type: 'meeting_note',
        title: `${activeMeetingTitle} Notes`,
        content: scribeNotes.join('\n'),
        tags: ['meeting', 'scribe', 'auto-save'],
        relatedContactId: activeParticipants[0]?.id
      });
    }
    setView('dashboard');
    refreshDashboard();
  };

  // ============================================
  // RENDER: DASHBOARD VIEW
  // ============================================

  if (view === 'dashboard') {
    return (
      <div className="meetings-container">
        {/* Modals */}
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

        {/* Hero Section */}
        <HeroSection
          meetingLinkInput={meetingLinkInput}
          onInputChange={setMeetingLinkInput}
          onJoin={handleLinkJoin}
        />

        {/* Dashboard Content */}
        <div className="meetings-dashboard">
          <div className="meetings-grid">
            {/* Left Column */}
            <div>
              {/* Platform Cards */}
              <div className="meetings-section-header">
                <div className="meetings-section-title">
                  <i className="fa-solid fa-circle-play" />
                  Start Instant Meeting
                </div>
              </div>
              <PlatformCards
                onStartMeeting={startMeeting}
                onBulkInvite={openBulkInvite}
              />

              {/* Feature Cards (NEW) */}
              <div className="meetings-section-header">
                <div className="meetings-section-title">
                  <i className="fa-solid fa-grid-2" />
                  Enhanced Features
                </div>
              </div>
              <FeatureCards
                onFeatureClick={handleFeatureClick}
                pendingActions={actionItems.filter(i => i.status !== 'completed').length}
              />

              {/* Meeting History */}
              <div className="meetings-section-header">
                <div className="meetings-section-title">
                  <i className="fa-solid fa-clock-rotate-left" />
                  History & Notes
                </div>
                <button className="meetings-section-action">View All</button>
              </div>
              <MeetingHistory
                notes={pastNotes}
                onNoteClick={(note) => console.log('View note:', note)}
              />
            </div>

            {/* Right Column - Sidebar */}
            <div className="meetings-sidebar">
              <UpcomingMeetings
                meetings={upcomingMeets}
                onJoin={(meeting) => {
                  setActiveMeetingTitle(meeting.title);
                  setView('active');
                }}
                onSchedule={() => setView('schedule')}
              />

              <QuickActions onAction={handleQuickAction} />

              <MeetingInsightsCard insights={insights} />
            </div>
          </div>
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
                <i className="fa-solid fa-xmark" />
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
                          <i className="fa-solid fa-xmark" />
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
  // RENDER: ACTIVE MEETING VIEW
  // ============================================

  return (
    <div className="meetings-container">
      <div className="meetings-active">
        <Toast message="Copied to clipboard!" isVisible={showCopiedToast} />

        {/* Settings Modal */}
        {showSettings && (
          <div className="meetings-modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="meetings-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
              <div className="meetings-modal-header">
                <div className="meetings-modal-title">Settings</div>
                <button className="meetings-modal-close" onClick={() => setShowSettings(false)}>
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              <div style={{ padding: 8 }}>
                {[
                  { icon: 'fa-tower-broadcast', label: 'Manage streaming' },
                  { icon: 'fa-record-vinyl', label: 'Manage recording' },
                  { icon: 'fa-table-cells', label: 'Adjust view' },
                  { icon: 'fa-expand', label: 'Full screen', action: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() },
                  { icon: 'fa-clone', label: 'Picture-in-picture', action: () => videoRef.current?.requestPictureInPicture() },
                  { icon: 'fa-wand-magic-sparkles', label: 'Backgrounds & effects' },
                  { icon: 'fa-gear', label: 'Settings' },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => { if (item.action) item.action(); setShowSettings(false); }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: '14px 16px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 10,
                      color: 'var(--mtg-text-secondary)',
                      cursor: 'pointer',
                      fontSize: 13,
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--mtg-bg-tertiary)';
                      e.currentTarget.style.color = 'var(--mtg-text-primary)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--mtg-text-secondary)';
                    }}
                  >
                    <i className={`fa-solid ${item.icon}`} style={{ width: 20, textAlign: 'center' }} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="meetings-active-header">
          <div className="meetings-active-info">
            <button className="meetings-active-back" onClick={() => setView('dashboard')}>
              <i className="fa-solid fa-arrow-left" />
            </button>
            <span className="meetings-active-title">{activeMeetingTitle}</span>
            <span className="meetings-active-badge">Live</span>
          </div>

          {meetingCode && (
            <div className="meetings-active-code">
              <span className="meetings-active-code-label">Code:</span>
              <span className="meetings-active-code-value">{meetingCode}</span>
              <button className="meetings-active-code-copy" onClick={copyMeetingCode}>
                <i className="fa-solid fa-copy" />
              </button>
            </div>
          )}

          <button className="meetings-active-end" onClick={handleLeave}>
            <i className="fa-solid fa-phone-slash" />
            <span>End</span>
          </button>
        </div>

        {/* Video Area */}
        <div className="meetings-video-area">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="meetings-video-main"
            style={{ opacity: cameraOn || isScreenSharing ? 1 : 0 }}
          />
          {!cameraOn && !isScreenSharing && (
            <div className="meetings-video-off">
              <div className="meetings-video-avatar">
                {activeParticipants.length > 0 ? activeParticipants[0].name.charAt(0) : 'ME'}
              </div>
            </div>
          )}

          {/* AI Scribe Panel */}
          {scribeActive && (
            <div className="meetings-scribe-panel">
              <div className="meetings-scribe-header">
                <div className="meetings-scribe-title">
                  <i className="fa-solid fa-wand-magic-sparkles" />
                  AI Scribe
                </div>
                <div className="meetings-scribe-live" />
              </div>
              <div className="meetings-scribe-content">
                {scribeNotes.length === 0 && (
                  <div className="meetings-scribe-empty">Listening for key points...</div>
                )}
                {scribeNotes.map((note, idx) => (
                  <div key={idx} className="meetings-scribe-note">{note}</div>
                ))}
              </div>
            </div>
          )}

          {/* Hand Raised */}
          {handRaised && (
            <div style={{
              position: 'absolute',
              top: 80,
              right: 24,
              padding: '10px 16px',
              background: 'var(--mtg-bg-glass)',
              backdropFilter: 'blur(10px)',
              borderRadius: 20,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              animation: 'mtg-fade-in 0.3s ease',
              zIndex: 20,
            }}>
              <i className="fa-solid fa-hand" style={{ color: '#fbbf24' }} />
              You raised your hand
            </div>
          )}

          {/* Self View */}
          <div className="meetings-self-view">
            <div className="meetings-self-label">You</div>
            {micOn && <div className="meetings-self-mic" />}
            <div style={{ width: '100%', height: '100%', opacity: 0.5 }}>
              <AudioVisualizer
                analyser={analyserRef.current}
                isActive={micOn}
                color="#10b981"
                backgroundColor="#09090b"
                apiKey={apiKey}
              />
            </div>
          </div>
        </div>

        {/* Control Bar */}
        <div className="meetings-controls">
          <div className="meetings-controls-left">
            <span className="meetings-control-info">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="meetings-controls-center">
            <button
              className="meetings-control-btn default"
              onClick={() => setShowSettings(true)}
            >
              <i className="fa-solid fa-ellipsis" />
            </button>

            <button
              className={`meetings-control-btn ${micOn ? 'default' : 'off'}`}
              onClick={() => setMicOn(!micOn)}
            >
              <i className={`fa-solid ${micOn ? 'fa-microphone' : 'fa-microphone-slash'}`} />
            </button>

            <button
              className={`meetings-control-btn ${cameraOn ? 'default' : 'off'}`}
              onClick={() => setCameraOn(!cameraOn)}
            >
              <i className={`fa-solid ${cameraOn ? 'fa-video' : 'fa-video-slash'}`} />
            </button>

            <button
              className={`meetings-control-btn ${isScreenSharing ? 'active' : 'default'}`}
              onClick={handleScreenShare}
            >
              <i className="fa-solid fa-arrow-up-from-bracket" />
            </button>

            <button
              className={`meetings-control-btn ${scribeActive ? 'active' : 'default'}`}
              onClick={() => setScribeActive(!scribeActive)}
            >
              <i className="fa-solid fa-wand-magic-sparkles" />
            </button>

            <button
              className={`meetings-control-btn ${handRaised ? 'active' : 'default'}`}
              onClick={() => setHandRaised(!handRaised)}
              style={{ color: handRaised ? '#fbbf24' : undefined }}
            >
              <i className="fa-solid fa-hand" />
            </button>

            <button className="meetings-control-btn danger" onClick={handleLeave}>
              <i className="fa-solid fa-phone-slash" />
            </button>
          </div>

          <div className="meetings-controls-right">
            <button className="meetings-control-icon">
              <i className="fa-solid fa-circle-info" />
            </button>
            <button className="meetings-control-icon">
              <i className="fa-solid fa-users" />
            </button>
            <button className="meetings-control-icon">
              <i className="fa-solid fa-message" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Meetings;
