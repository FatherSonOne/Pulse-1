import React, { useEffect, useRef, useState } from 'react';
import { blobToBase64 } from '../../services/audioService';
import { generateMeetingNote, generateSummary } from '../../services/geminiService';
import { createGoogleCalendarEvent, fetchCalendarEvents } from '../../services/authService';
import { saveArchiveItem, getArchives } from '../../services/dbService';
import { Contact, CalendarEvent, ArchiveItem } from '../../types';
import AudioVisualizer from '../AudioVisualizer';
import './Meetings.css';
import PulseVideoRoom, { MeetingEndSummary } from './PulseVideoRoom';
import { createPulseRoom } from '../../services/pulseVideoService';
import { autoExportIfEnabled } from '../../services/meetingService';

// Import new components
import { ArrowLeft, ArrowRight, Copy, Ellipsis, Hand, History, LayoutGrid, MessageSquare, Mic, PhoneOff, PlayCircle, Send, Upload, Users, Wand2, X } from 'lucide-react';
import {

  Platform,
  MeetingTemplate,
  AgendaItem,
  ActionItem,
  MeetingInsights,
  BreakoutRoom,
  MeetingSummaryData,
  TimelineEntry,
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
  AnalyticsModal,
  RecordingsModal,
  DeviceTestModal,
  MeetingSettingsModal,
  BreakoutRoomsModal,
  MeetingSummaryView,
} from './MeetingsComponents';

interface MeetingsProps {
  apiKey: string;
  contacts: Contact[];
  initialContactId?: string;
  initialMeetingCode?: string;
}

type MeetingView = 'dashboard' | 'active' | 'schedule' | 'summary';

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
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showRecordings, setShowRecordings] = useState(false);
  const [showDeviceTest, setShowDeviceTest] = useState(false);
  const [showMeetingSettings, setShowMeetingSettings] = useState(false);
  const [showBreakoutRooms, setShowBreakoutRooms] = useState(false);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

  // Meeting Summary State
  const [summaryData, setSummaryData] = useState<MeetingSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Active Meeting Enhancements
  const [meetingStartTime, setMeetingStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [activeSidePanel, setActiveSidePanel] = useState<'none' | 'participants' | 'chat'>('none');
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; text: string; time: Date }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadChat, setUnreadChat] = useState(0);
  const [raisedHands, setRaisedHands] = useState<string[]>([]);
  const [currentAgendaIndex, setCurrentAgendaIndex] = useState(0);

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
      // Fallback: still enter active view with a local code
      const code = generateMeetingCode();
      setMeetingCode(code);
      setActiveMeetingTitle(title);
      setActiveParticipants([]);
      setActiveRoom(null);
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

      // Start elapsed timer
      const startT = new Date();
      setMeetingStartTime(startT);
      setElapsedSeconds(0);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSeconds(Math.round((Date.now() - startT.getTime()) / 1000));
      }, 1000);
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
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    stopScribe();
    setScribeActive(false);
    setScribeNotes([]);
    setIsScreenSharing(false);
    setHandRaised(false);
    setMeetingCode(null);
    setActiveSidePanel('none');
    setCurrentAgendaIndex(0);
    setElapsedSeconds(0);
    setMeetingStartTime(null);
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

    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];
    const mimeType = candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? '';

    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType })
        : new MediaRecorder(streamRef.current);
    } catch (err) {
      console.warn('MediaRecorder init failed:', err);
      return;
    }

    mediaRecorderRef.current = recorder;
    const effectiveMime = mimeType || recorder.mimeType;

    recorder.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        const base64 = await blobToBase64(e.data);
        const note = await generateMeetingNote(apiKey, base64, effectiveMime);
        if (note && note.trim()) {
          setScribeNotes(prev => [...prev, note.trim()]);
        }
      }
    };

    try {
      recorder.start(8000);
    } catch (err) {
      console.warn('MediaRecorder start failed:', err);
      mediaRecorderRef.current = null;
    }
  };

  const stopScribe = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleLeave = async () => {
    const endTime = new Date();
    const durationMins = meetingStartTime
      ? Math.round((endTime.getTime() - meetingStartTime.getTime()) / 60000)
      : 0;

    if (scribeNotes.length > 0 || actionItems.length > 0) {
      // Navigate to summary immediately
      setView('summary');
      setSummaryLoading(true);
      cleanupMedia();

      const rawNotes = scribeNotes.join('\n');
      let aiSummary = 'Summary not available.';
      let keyPoints = scribeNotes.slice(0, 5);

      try {
        if (rawNotes.trim()) {
          const result = await generateSummary(apiKey, rawNotes);
          if (result) aiSummary = result;
        }
        // Save to archive
        await saveArchiveItem({
          type: 'meeting_note',
          title: `${activeMeetingTitle} Notes`,
          content: rawNotes,
          tags: ['meeting', 'scribe', 'auto-save'],
          relatedContactId: activeParticipants[0]?.id,
        });

        // Auto-export to Entomate (fire-and-forget)
        autoExportIfEnabled({
          title: activeMeetingTitle,
          transcript: rawNotes,
          attendees: activeParticipants.map(p => p.name),
          durationMinutes: durationMins,
          source: 'ai_scribe',
        });
      } catch (e) {
        console.error('Summary generation error:', e);
      }

      const decisions = scribeNotes.filter(n => {
        const lower = n.toLowerCase();
        return lower.includes('decided') || lower.includes('agreed') || lower.includes('will ');
      });

      const timelineEvents: { timestamp: string; note: string }[] = scribeNotes.map((note, i) => ({
        timestamp: `${Math.floor(i * 8 / 60)}:${String((i * 8) % 60).padStart(2, '0')}`,
        note,
      }));

      setSummaryData({
        aiSummary,
        keyPoints,
        actionItems: [...actionItems],
        decisions,
        timelineEvents,
        participants: [...activeParticipants],
        duration: durationMins,
        meetingTitle: activeMeetingTitle,
      });
      setSummaryLoading(false);
    } else {
      cleanupMedia();
      setView('dashboard');
      refreshDashboard();
    }
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

        <AnalyticsModal
          isOpen={showAnalytics}
          onClose={() => setShowAnalytics(false)}
        />

        <RecordingsModal
          isOpen={showRecordings}
          onClose={() => setShowRecordings(false)}
        />

        <DeviceTestModal
          isOpen={showDeviceTest}
          onClose={() => setShowDeviceTest(false)}
        />

        <MeetingSettingsModal
          isOpen={showMeetingSettings}
          onClose={() => setShowMeetingSettings(false)}
        />

        <BreakoutRoomsModal
          isOpen={showBreakoutRooms}
          onClose={() => setShowBreakoutRooms(false)}
          activeParticipants={activeParticipants}
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
                  <PlayCircle />
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
                  <LayoutGrid />
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
                  <History />
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
                  text: a.text,
                  assignee: a.owner ?? '',
                  status: 'pending' as const,
                  priority: 'medium' as const,
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
                  <X />
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
              <ArrowLeft />
            </button>
            <span className="meetings-active-title">{activeMeetingTitle}</span>
            <span className="meetings-active-badge">Live</span>
          </div>

          {meetingCode && (
            <div className="meetings-active-code">
              <span className="meetings-active-code-label">Code:</span>
              <span className="meetings-active-code-value">{meetingCode}</span>
              <button className="meetings-active-code-copy" onClick={copyMeetingCode}>
                <Copy />
              </button>
            </div>
          )}

          <button className="meetings-active-end" onClick={handleLeave}>
            <PhoneOff />
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
                  <Wand2 />
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
              <Hand />
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

        {/* Agenda Progress Bar */}
        {agendaItems.length > 0 && (
          <div className="meetings-agenda-progress-bar">
            <div className="meetings-agenda-progress-track">
              <div
                className="meetings-agenda-progress-fill"
                style={{ width: `${Math.min(100, (currentAgendaIndex / agendaItems.length) * 100)}%` }}
              />
            </div>
            <div className="meetings-agenda-current-item">
              {currentAgendaIndex < agendaItems.length
                ? agendaItems[currentAgendaIndex].title
                : 'All items complete'}
            </div>
            {currentAgendaIndex < agendaItems.length && (
              <button
                type="button"
                className="meetings-agenda-next-btn"
                onClick={() => setCurrentAgendaIndex(i => Math.min(i + 1, agendaItems.length))}
              >
                Next <ArrowRight />
              </button>
            )}
          </div>
        )}

        {/* Side Panels */}
        {activeSidePanel === 'participants' && (
          <div className="meetings-side-panel">
            <div className="meetings-side-panel-header">
              Participants ({activeParticipants.length})
              <button
                type="button"
                className="meetings-side-panel-close"
                onClick={() => setActiveSidePanel('none')}
                title="Close panel"
              >
                <X />
              </button>
            </div>
            <div className="meetings-side-panel-body">
              {raisedHands.length > 0 && (
                <div className="meetings-raise-hand-queue">
                  <div className="meetings-raise-hand-queue-title">Speaking Queue</div>
                  {raisedHands.map((name, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--mtg-accent-warning)', marginBottom: 4 }}>
                      {i + 1}. {name}
                    </div>
                  ))}
                </div>
              )}
              {/* Self */}
              <div className="meetings-participant-row">
                <div className="meetings-participant-avatar" style={{ background: '#7c3aed' }}>
                  ME
                </div>
                <div className="meetings-participant-info">
                  <div className="meetings-participant-name">You (Host)</div>
                  <div className="meetings-participant-role">Presenter</div>
                </div>
                <div className="meetings-participant-indicators">
                  {micOn && (
                    <div className="meetings-participant-indicator speaking" title="Speaking">
                      <Mic />
                    </div>
                  )}
                  {handRaised && (
                    <div className="meetings-participant-indicator hand" title="Hand raised">
                      <Hand />
                    </div>
                  )}
                </div>
              </div>
              {activeParticipants.map(p => (
                <div key={p.id} className="meetings-participant-row">
                  <div
                    className="meetings-participant-avatar"
                    style={{ background: p.avatarColor || '#10b981' }}
                  >
                    {p.name.charAt(0)}
                  </div>
                  <div className="meetings-participant-info">
                    <div className="meetings-participant-name">{p.name}</div>
                    <div className="meetings-participant-role">{p.role}</div>
                  </div>
                </div>
              ))}
              {activeParticipants.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--mtg-text-muted)', textAlign: 'center', paddingTop: 20 }}>
                  No other participants yet
                </div>
              )}
            </div>
          </div>
        )}

        {activeSidePanel === 'chat' && (
          <div className="meetings-side-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="meetings-side-panel-header">
              In-Meeting Chat
              <button
                type="button"
                className="meetings-side-panel-close"
                onClick={() => setActiveSidePanel('none')}
                title="Close panel"
              >
                <X />
              </button>
            </div>
            <div className="meetings-chat-messages">
              {chatMessages.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--mtg-text-muted)', textAlign: 'center', paddingTop: 20 }}>
                  No messages yet. Say hello!
                </div>
              ) : chatMessages.map(msg => (
                <div key={msg.id} className="meetings-chat-message">
                  <div className="meetings-chat-message-sender">{msg.sender}</div>
                  <div className="meetings-chat-message-text">{msg.text}</div>
                  <div className="meetings-chat-message-time">
                    {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
            <div className="meetings-chat-input-row">
              <input
                className="meetings-chat-input"
                placeholder="Send a message..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && chatInput.trim()) {
                    const msg = { id: Date.now().toString(), sender: 'You', text: chatInput.trim(), time: new Date() };
                    setChatMessages(prev => [...prev, msg]);
                    setChatInput('');
                  }
                }}
              />
              <button
                type="button"
                className="meetings-chat-send-btn"
                title="Send message"
                onClick={() => {
                  if (!chatInput.trim()) return;
                  const msg = { id: Date.now().toString(), sender: 'You', text: chatInput.trim(), time: new Date() };
                  setChatMessages(prev => [...prev, msg]);
                  setChatInput('');
                }}
              >
                <Send />
              </button>
            </div>
          </div>
        )}

        {/* Control Bar */}
        <div className="meetings-controls">
          <div className="meetings-controls-left">
            {meetingStartTime ? (
              <span className={`meetings-elapsed-timer ${elapsedSeconds >= 3600 ? 'over' : elapsedSeconds >= 2700 ? 'warning' : ''}`}>
                {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
              </span>
            ) : (
              <span className="meetings-control-info">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="meetings-controls-center">
            <button
              className="meetings-control-btn default"
              onClick={() => setShowSettings(true)}
            >
              <Ellipsis />
            </button>

            <button
              className={`meetings-control-btn ${micOn ? 'default' : 'off'}`}
              onClick={() => setMicOn(!micOn)}
            >
              <i className={`fa-solid ${micOn ? 'fa-microphone' : 'fa-microphone-slash'}`} />
            </button>

            <button
              type="button"
              title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
              className={`meetings-control-btn ${cameraOn ? 'default' : 'off'}`}
              onClick={() => setCameraOn(!cameraOn)}
            >
              <i className={`fa-solid ${cameraOn ? 'fa-video' : 'fa-video-slash'}`} />
            </button>

            <button
              type="button"
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              className={`meetings-control-btn ${isScreenSharing ? 'active' : 'default'}`}
              onClick={handleScreenShare}
            >
              <Upload />
            </button>

            <button
              type="button"
              title={scribeActive ? 'Stop AI Scribe' : 'Start AI Scribe'}
              className={`meetings-control-btn ${scribeActive ? 'active' : 'default'}`}
              onClick={() => setScribeActive(!scribeActive)}
            >
              <Wand2 />
            </button>

            <button
              className={`meetings-control-btn ${handRaised ? 'active' : 'default'}`}
              onClick={() => setHandRaised(!handRaised)}
              style={{ color: handRaised ? '#fbbf24' : undefined }}
            >
              <Hand />
            </button>

            <button className="meetings-control-btn danger" onClick={handleLeave}>
              <PhoneOff />
            </button>
          </div>

          <div className="meetings-controls-right">
            <button
              className={`meetings-control-icon ${activeSidePanel === 'participants' ? 'active' : ''}`}
              onClick={() => setActiveSidePanel(activeSidePanel === 'participants' ? 'none' : 'participants')}
              title="Participants"
            >
              <Users />
            </button>
            <div className="meetings-control-icon-wrapper">
              <button
                type="button"
                className={`meetings-control-icon ${activeSidePanel === 'chat' ? 'active' : ''}`}
                onClick={() => {
                  setActiveSidePanel(activeSidePanel === 'chat' ? 'none' : 'chat');
                  setUnreadChat(0);
                }}
                title="Chat"
              >
                <MessageSquare />
              </button>
              {unreadChat > 0 && (
                <span className="meetings-chat-badge">{unreadChat}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Meetings;
