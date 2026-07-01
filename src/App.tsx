
import { Capacitor } from '@capacitor/core';
import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import LiveSession from './components/LiveSession';
import { Summit } from './components/Summit';
import MessageContainer from './components/MessageContainer';
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import About from './components/About';
import LandingPage from './components/LandingPage';
import { WorkspaceInviteAccept } from './components/WorkspaceInviteAccept';
import BookingPage from './components/BookingPage';
import RSVPResponsePage from './components/RSVPResponsePage';
import PulseVideoRoom from './components/Meetings/PulseVideoRoom';
import { resolveRoomForJoin } from './services/pulseVideoService';

// Lazy-load route components for better code splitting
const Messages = lazy(() => import('./components/Messages'));
const LiveDashboard = lazy(() => import('./components/LiveDashboard'));
const CockpitHub = lazy(() => import('./components/decisions/cockpit/CockpitHub').then(module => ({ default: module.CockpitHub })));
const EmailClient = lazy(() => import('./components/Email/EmailClientWrapper'));
const Calendar = lazy(() => import('./components/Calendar'));
const Settings = lazy(() => import('./components/Settings'));
const Relay = lazy(() => import('./components/Relay'));
const Glimpse = lazy(() => import('./components/Glimpse'));
const SlackChannels = lazy(() => import('./components/SlackChannels/SlackChannels'));
const SMS = lazy(() => import('./components/SMS'));
const Meetings = lazy(() => import('./components/Meetings').then(module => ({ default: module.Meetings })));
const Contacts = lazy(() => import('./components/Contacts'));
// Top-level Map section (Phase 3 IA promotion). Same component the Contacts
// 'Map' tab used to mount; now also addressable from the Sidebar directly.
const PulseMapView = lazy(() => import('./components/map/PulseMapView'));
const Archives = lazy(() => import('./components/Archives'));
const Dashboard = lazy(() => import('./components/Dashboard'));
// Search "Workbench" — the only Search surface (legacy UnifiedSearchRedesign
// removed in Phase 11). See docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md
const SearchWorkbench = lazy(() => import('./components/search/SearchWorkbench'));
// Analytics + Message Analytics now live under one Intelligence > Analytics
// surface (tabbed). MESSAGE_ANALYTICS still routes here (deep-selects the
// Message Analytics tab) so voice/assistant nav keeps working.
const AnalyticsHome = lazy(() => import('./components/Analytics/AnalyticsHome'));
const UsersGuide = lazy(() => import('./components/UsersGuide/UsersGuide'));

import { SocialHealthMonitor } from './components/health/SocialHealthMonitor';
import { ContextHandoff } from './components/health/ContextHandoff';
import { NotificationCenter } from './components/NotificationCenter';
import { LoadingProvider, useLoading } from './contexts/LoadingContext';
import EnhancedLoadingScreen from './components/EnhancedLoadingScreen';
import { loginWithGoogle, loginWithEmail, signUpWithEmail, loginWithMicrosoft, sendPasswordReset, updatePassword, onPasswordRecovery, logoutUser } from './services/authService';
import { loginWithPasskey } from './services/passkeyService';
import { dataService } from './services/dataService';
import { useNotificationStore } from './store/notificationStore';
import { Contact, AppView } from './types';
import { useFeatureFlag } from './lib/featureFlags';
import { Analytics } from '@vercel/analytics/react';
import LogoPreview, { LogoOption } from './components/LogoPreview';
import GoogleAccountSelector from './components/GoogleAccountSelector';
import { ExtensionLogin, ExtensionOAuthCallback, ExtensionCallback, ExtensionError } from './components/ExtensionAuth';
import { MicrosoftCalendarCallback } from './components/MicrosoftCalendarCallback';
import { ApiDocumentation } from './components/ApiKeys';
import EtaSharePage from './components/EtaSharePage';
import PulseVoiceLogo from './components/PulseVoiceLogo';
import { PulseMark } from './components/brand/PulseMark';
import { voiceCommandService } from './services/voiceCommandService';
import { subscribeRealtimeIngest } from './services/memoryIngestService';
import PermissionRequestModal from './components/PermissionRequestModal';
import { usePermissions } from './hooks/usePermissions';
import { settingsService } from './services/settingsService';
import { archiveService } from './services/archiveService';
import { usePresence } from './hooks/usePresence';
import { useAndroidBackButton } from './hooks/useAndroidBackButton';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileNavSheet } from './components/MobileChrome/MobileNavSheet';
import { MobileQuickActionsSheet } from './components/MobileChrome/MobileQuickActionsSheet';
import { isOverlayOpen } from './lib/overlayStack';
import { useAuth } from './hooks/useAuth';
import PulseAssistant from './components/PulseAssistant/PulseAssistant';
import { PulseAssistantButton } from './components/PulseAssistant/PulseAssistantButton';
import { PulseAIProactiveChecker } from './components/PulseAssistant/PulseAIProactiveChecker';
import { InstallPrompt } from './components/PWA/InstallPrompt';
import { OnlineStatus } from './components/PWA/OnlineStatus';
import { FeatureProvider, useFeatures } from './contexts/FeatureContext';
import { PulseAIProvider } from './contexts/PulseAIContext';
import { CommandPaletteProvider, useRegisterCommands, Command } from './contexts/CommandPaletteContext';
import type { RelayShortcutView } from './hooks/useRelayKeyboardShortcuts';
import { CommandBarHeader } from './components/GlobalCommandPalette';
import { getRecentCommandIds } from './utils/recentCommands';
import KeyboardChordsLayer from './components/KeyboardChordsLayer';
import CaptureModal from './components/Capture/CaptureModal';
import { WorkspaceProvider, useWorkspaceData, useWorkspaceActions } from './contexts/WorkspaceContext';
import { TrialGate } from './components/billing/TrialGate';
import { DeletedWorkspaceInterstitial } from './components/settings/DeletedWorkspaceInterstitial';
import { OrgOnboardingModal } from './components/settings/OrgOnboardingModal';
import { Toaster } from 'react-hot-toast';

import { HelpCircle, Command as CommandIcon } from 'lucide-react';

// Loading fallback component for lazy-loaded routes
// Uses inline=true so it fills the content area via flex layout rather than fixed/absolute positioning
const PageLoader = () => <EnhancedLoadingScreen inline />;

/**
 * Gate that shows the deleted-workspace interstitial when the user
 * has no active workspaces but owns soft-deleted ones.
 */
const WorkspaceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentWorkspace, workspaces, isLoading } = useWorkspaceData();
  const { deletedWorkspaces, createWorkspace } = useWorkspaceActions();

  if (isLoading) return <EnhancedLoadingScreen />;

  if (!currentWorkspace && workspaces.length === 0 && deletedWorkspaces.length > 0) {
    return (
      <DeletedWorkspaceInterstitial
        deletedWorkspaces={deletedWorkspaces}
        onCreateNew={async () => {
          await createWorkspace('My Workspace');
          window.location.reload();
        }}
      />
    );
  }

  return <>{children}</>;
};

// Standalone page for direct /meet/:roomName links — no sidebar needed
const PulseRoomPage: React.FC<{ roomName: string }> = ({ roomName }) => {
  const [roomUrl, setRoomUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    resolveRoomForJoin(roomName).then(room => {
      if (room) {
        setRoomUrl(room.room_url);
      } else {
        setError('Meeting not found or has expired.');
      }
    });
  }, [roomName]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white flex-col gap-3">
        <p className="text-white/60">{error}</p>
        <button type="button" onClick={() => window.location.href = '/'} className="text-rose-400 text-sm hover:underline">
          Go to Pulse
        </button>
      </div>
    );
  }

  if (!roomUrl) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen">
      <PulseVideoRoom
        roomUrl={roomUrl}
        roomName={roomName}
        meetingTitle="Pulse Meeting"
        isHost={false}
        onLeave={() => { window.location.href = '/'; }}
      />
    </div>
  );
};

// ─── AppCommandRegistrar ──────────────────────────────────────────────────────
// Registers the global navigation + help commands that should appear in the
// palette regardless of which view is active. Sits inside the
// CommandPaletteProvider so it can use the hook. Also listens for the
// pulse:command-palette-open event dispatched by App's Cmd+K handler — App
// itself renders outside the provider, so it can't call open() directly.

interface AppCommandRegistrarProps {
  view: AppView;
  setView: React.Dispatch<React.SetStateAction<AppView>>;
  setSettingsSection: React.Dispatch<React.SetStateAction<string | undefined>>;
  // Global create actions. Defined in App (they close over the openTaskPanel /
  // openAddContact intent state) and passed in stably so the palette can create
  // from any view, not just the Dashboard. Reuses the same intent bridge the
  // Dashboard quick-actions and the AI action handler already use.
  onNewTask: () => void;
  onNewContact: () => void;
  // People entity-jump. `contacts` (App state) feeds a dynamic provider so
  // typing a name surfaces matching people from any view; the two handlers open
  // the person's card (Contacts) or their conversation (Messages).
  contacts: Contact[];
  onOpenContact: (id: string) => void;
  onMessageContact: (id: string) => void;
  onMeetContact: (id: string) => void;
  onVoxContact: (id: string) => void;
  // Relay deep-links. onRelayNavigate jumps to a specific Relay source
  // (Inbox/Direct/Channels/Broadcast/Notes/Live) from any view; onNewVox lands
  // in Relay and opens the record composer. Both ride App's intent bridge.
  onRelayNavigate: (view: RelayShortcutView) => void;
  onNewVox: () => void;
  // Compose-email intent. Gated on emailEnabled inside the registrar (see
  // emailCommands) so it never surfaces when the Email surface is off.
  onComposeEmail: () => void;
  // Start-instant-meeting intent. Always available — distinct from the
  // Dashboard-scoped navigate-only "Schedule Meet"; this one instant-creates a
  // Pulse room.
  onStartMeeting: () => void;
  // Global app controls — reuse App's existing handlers (theme/auth/assistant/
  // sidebar). isDarkMode feeds the toggle label so it reads the right direction.
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onSignOut: () => void;
  onTogglePulseAI: () => void;
  onToggleSidebar: () => void;
  // Global section actions — deep-link to a section AND fire one of its actions
  // (Create event / New decision / Prioritize) via the pending-intent bridge,
  // so section actions are reachable from any view, not only when that section
  // is already mounted.
  onSectionAction: (target: 'calendar' | 'decisions', action: string) => void;
}

const AppCommandRegistrar: React.FC<AppCommandRegistrarProps> = ({
  view,
  setView,
  setSettingsSection,
  onNewTask,
  onNewContact,
  contacts,
  onOpenContact,
  onMessageContact,
  onMeetContact,
  onVoxContact,
  onRelayNavigate,
  onNewVox,
  onComposeEmail,
  onStartMeeting,
  isDarkMode,
  onToggleTheme,
  onSignOut,
  onTogglePulseAI,
  onToggleSidebar,
  onSectionAction,
}) => {
  // In-app SMS is a mock shell, hidden for v1 (issue #100). Despite the
  // `use` prefix, useFeatureFlag is a plain synchronous read (env + URL/
  // localStorage), so it is safe to call here and inside useMemo.
  const smsEnabled = useFeatureFlag('inAppSms', undefined, false);

  // Email compose command is gated on the emailEnabled feature switch (Settings
  // → Features & Labs, default off). When off, EmailClientWrapper renders a
  // placeholder and EmailHybridClient never mounts, so the compose intent would
  // be silently dropped — we don't surface the command at all in that case.
  // useFeatures is valid here: the registrar sits inside FeatureProvider.
  const { features } = useFeatures();

  // Note: ⌘K is dispatched as pulse:command-palette-open by App's keydown
  // handler and consumed directly by the command surface (the persistent
  // CommandBarHeader, which focuses its input on the event — Phase 6). The
  // registrar no longer bridges it — the centered modal was retired in Phase 5.

  const navCommands = useMemo<Command[]>(() => {
    const navDestinations: Array<{
      id: string; label: string; desc: string; view: AppView; icon: string; keywords?: string[];
    }> = [
      { id: 'nav-dashboard', label: 'Dashboard', desc: 'Daily briefing and quick actions', view: AppView.DASHBOARD, icon: 'fa-house', keywords: ['home', 'briefing', 'today'] },
      { id: 'nav-messages', label: 'Messages', desc: 'Unified inbox', view: AppView.MESSAGES, icon: 'fa-message', keywords: ['inbox', 'chat', 'dm'] },
      { id: 'nav-email', label: 'Email', desc: 'Pulse email client', view: AppView.EMAIL, icon: 'fa-envelope', keywords: ['mail', 'gmail'] },
      { id: 'nav-calendar', label: 'Calendar', desc: 'Schedule and tasks', view: AppView.CALENDAR, icon: 'fa-calendar', keywords: ['schedule', 'events', 'tasks', 'meeting'] },
      { id: 'nav-relay', label: 'Relay', desc: 'Voice messages and notes', view: AppView.RELAY, icon: 'fa-microphone', keywords: ['vox', 'voice', 'audio'] },
      { id: 'nav-glimpse', label: 'Glimpse', desc: 'Video glimpses and peer reels', view: AppView.GLIMPSE, icon: 'fa-clapperboard', keywords: ['video', 'reels', 'peer', 'glimpse'] },
      { id: 'nav-contacts', label: 'Contacts', desc: 'People and teams', view: AppView.CONTACTS, icon: 'fa-users', keywords: ['people', 'crm'] },
      { id: 'nav-map', label: 'Map', desc: 'Spatial layer — contacts, places, geofences', view: AppView.MAP, icon: 'fa-location-dot', keywords: ['location', 'geo', 'team radar', 'places', 'broadcast'] },
      { id: 'nav-archives', label: 'Memory', desc: 'Every word, every voice — find any conversation', view: AppView.ARCHIVES, icon: 'fa-box-archive', keywords: ['archives', 'history'] },
      { id: 'nav-search', label: 'Search', desc: 'Search across Pulse', view: AppView.MULTI_MODAL, icon: 'fa-magnifying-glass', keywords: ['find', 'global'] },
      { id: 'nav-analytics', label: 'Analytics', desc: 'Metrics, trends, and reports', view: AppView.ANALYTICS, icon: 'fa-chart-line', keywords: ['analytics', 'metrics', 'stats', 'reports', 'insights'] },
      { id: 'nav-decisions', label: 'Decisions & Tasks', desc: 'Decision hub and task board', view: AppView.DECISIONS_TASKS, icon: 'fa-list-check', keywords: ['todo', 'task'] },
      { id: 'nav-meetings', label: 'Meetings', desc: 'Video meetings', view: AppView.MEETINGS, icon: 'fa-video', keywords: ['video', 'call'] },
      { id: 'nav-summit', label: 'Summit', desc: 'Live voice sessions', view: AppView.LIVE, icon: 'fa-comments', keywords: ['summit', 'live', 'session', 'voice', 'realtime'] },
      { id: 'nav-warroom', label: 'War Room', desc: 'Sources, chat, and studio', view: AppView.LIVE_AI, icon: 'fa-book-open', keywords: ['war room', 'notebook', 'research', 'studio', 'ai', 'sources'] },
      { id: 'nav-sms', label: 'SMS', desc: 'Text messages', view: AppView.SMS, icon: 'fa-comment-sms', keywords: ['text'] },
      { id: 'nav-settings', label: 'Settings', desc: 'Preferences and account', view: AppView.SETTINGS, icon: 'fa-gear', keywords: ['preferences', 'account'] },
      { id: 'nav-users-guide', label: "User's Guide", desc: 'How to use Pulse', view: AppView.USERS_GUIDE, icon: 'fa-circle-question', keywords: ['help', 'docs', 'guide'] },
    ];
    return navDestinations
      // Hide the "Go to <current view>" row — it would no-op and just adds noise.
      // Also hide SMS while the mock surface is flagged off for v1 (#100).
      .filter(n => n.view !== view && (smsEnabled || n.view !== AppView.SMS))
      .map(n => ({
        id: n.id,
        label: n.label,
        desc: n.desc,
        icon: n.icon,
        kind: 'navigate' as const,
        keywords: n.keywords,
        run: () => setView(n.view),
      }));
  }, [setView, view, smsEnabled]);

  const helpCommands = useMemo<Command[]>(() => [
    {
      id: 'help-shortcuts',
      label: 'View keyboard shortcuts',
      desc: 'See every binding in one list',
      icon: 'fa-keyboard',
      kind: 'help',
      keywords: ['hotkeys', 'bindings'],
      run: () => window.dispatchEvent(new CustomEvent('pulse:show-shortcuts')),
    },
    {
      id: 'help-billing',
      label: 'Billing settings',
      desc: 'Plan, usage, invoices',
      icon: 'fa-credit-card',
      kind: 'navigate',
      keywords: ['plan', 'subscription', 'invoice'],
      run: () => { setSettingsSection('billing'); setView(AppView.SETTINGS); },
    },
    // Settings deep-links — mirror help-billing so the palette can jump to any
    // major Settings section, not just Billing. Section ids match the real
    // SECTION_GROUPS in Settings.tsx; setSettingsSection seeds Settings'
    // initialSection on mount (same mechanism help-billing already relies on).
    {
      id: 'settings-notifications',
      label: 'Notification settings',
      desc: 'Alerts, push, quiet hours',
      icon: 'fa-bell',
      kind: 'navigate',
      keywords: ['alerts', 'push', 'quiet hours', 'vip', 'sound'],
      run: () => { setSettingsSection('notifications'); setView(AppView.SETTINGS); },
    },
    {
      id: 'settings-integrations',
      label: 'Integrations',
      desc: 'Slack, Gmail, calendar, Twilio',
      icon: 'fa-plug',
      kind: 'navigate',
      keywords: ['slack', 'gmail', 'connect', 'twilio', 'google', 'integration'],
      run: () => { setSettingsSection('integrations'); setView(AppView.SETTINGS); },
    },
    {
      id: 'settings-security',
      label: 'Security settings',
      desc: '2FA, sessions, access',
      icon: 'fa-lock',
      kind: 'navigate',
      keywords: ['2fa', 'mfa', 'two factor', 'password', 'session', 'login'],
      run: () => { setSettingsSection('security'); setView(AppView.SETTINGS); },
    },
    {
      id: 'settings-privacy',
      label: 'Privacy & data',
      desc: 'Analytics, export, delete data',
      icon: 'fa-shield-halved',
      kind: 'navigate',
      keywords: ['privacy', 'gdpr', 'export', 'delete', 'analytics', 'data'],
      run: () => { setSettingsSection('privacy_data'); setView(AppView.SETTINGS); },
    },
    {
      id: 'settings-ai',
      label: 'AI & Intelligence settings',
      desc: 'Models, voice agent, quotas',
      icon: 'fa-brain',
      kind: 'navigate',
      keywords: ['ai', 'model', 'gemini', 'claude', 'gpt', 'quota', 'voice agent'],
      run: () => { setSettingsSection('ai_intelligence'); setView(AppView.SETTINGS); },
    },
    {
      id: 'settings-features',
      label: 'Features & Labs',
      desc: 'Beta toggles, experimental flags',
      icon: 'fa-flask',
      kind: 'navigate',
      keywords: ['beta', 'experimental', 'flag', 'toggle', 'lab', 'advanced'],
      run: () => { setSettingsSection('features_labs'); setView(AppView.SETTINGS); },
    },
  ], [setSettingsSection, setView]);

  // Global create actions — available from every view (the Dashboard-scoped
  // quick actions only existed while the Dashboard was mounted). run() handlers
  // are passed in stably from App so this useMemo and its registration don't
  // re-fire each render.
  const createCommands = useMemo<Command[]>(() => [
    {
      id: 'create-task',
      label: 'New task',
      desc: 'Open the task composer',
      icon: 'fa-check',
      kind: 'action',
      keywords: ['add', 'todo', 'create task', 'new task'],
      run: onNewTask,
    },
    {
      id: 'create-contact',
      label: 'New contact',
      desc: 'Add a new contact',
      icon: 'fa-user-plus',
      kind: 'action',
      keywords: ['add person', 'create contact', 'new person'],
      run: onNewContact,
    },
  ], [onNewTask, onNewContact]);

  // Compose email — gated on emailEnabled (default off). Empty composer; the
  // run() handler (App.handleComposeEmail) writes a pending intent to
  // sessionStorage and dispatches the live event, so it works whether or not
  // the Email surface is already mounted. Registered under its own app:email
  // scope so the gate is obvious and the empty array cleanly removes the row
  // when email is off.
  const emailCommands = useMemo<Command[]>(() => (
    features.emailEnabled
      ? [{
          id: 'compose-email',
          label: 'Compose email',
          desc: 'Start a new email',
          icon: 'fa-envelope',
          kind: 'action' as const,
          keywords: ['email', 'new email', 'write', 'send mail', 'compose'],
          run: onComposeEmail,
        }]
      : []
  ), [features.emailEnabled, onComposeEmail]);

  // Start a meeting — global instant-room command. Distinct from the
  // Dashboard-scoped "Schedule Meet" (action-meeting), which only navigates to
  // the Meetings landing; this one creates and joins a blank Pulse room via the
  // same createAndJoinPulseRoom path the in-pane "Start Pulse meeting" button
  // uses. Lives in its own app:meetings scope so it's reachable from any view.
  const meetingCommands = useMemo<Command[]>(() => [
    {
      id: 'start-pulse-meeting',
      label: 'Start a meeting',
      desc: 'Start an instant Pulse video room',
      icon: 'fa-video',
      kind: 'action' as const,
      keywords: ['meeting', 'video', 'call', 'instant', 'pulse room', 'start meeting'],
      run: onStartMeeting,
    },
  ], [onStartMeeting]);

  // Global app controls — the staples users reflexively reach for in a palette
  // (theme, sign out, assistant, sidebar). Each reuses an existing App handler;
  // no new state. The theme label reflects the current mode so it reads as the
  // action it performs. Registered under app:controls so it's available on every
  // view. (Switch-workspace deferred until a clean WorkspaceContext setter is
  // confirmed — see the globalization handoff doc, §8.)
  const controlsCommands = useMemo<Command[]>(() => [
    {
      id: 'control-theme',
      label: isDarkMode ? 'Switch to light mode' : 'Switch to dark mode',
      desc: 'Toggle the app theme',
      icon: isDarkMode ? 'fa-sun' : 'fa-moon',
      kind: 'action',
      keywords: ['theme', 'dark', 'light', 'mode', 'appearance', 'night'],
      run: onToggleTheme,
    },
    {
      id: 'control-pulse-ai',
      label: 'Open Pulse AI',
      desc: 'Toggle the AI assistant',
      icon: 'fa-wand-magic-sparkles',
      kind: 'action',
      keywords: ['assistant', 'ai', 'copilot', 'chat', 'help'],
      shortcut: '⌘/',
      run: onTogglePulseAI,
    },
    {
      id: 'control-sidebar',
      label: 'Collapse / expand sidebar',
      desc: 'Toggle the navigation rail',
      icon: 'fa-table-columns',
      kind: 'action',
      keywords: ['sidebar', 'nav', 'rail', 'collapse', 'expand', 'hide'],
      run: onToggleSidebar,
    },
    {
      id: 'control-signout',
      label: 'Sign out',
      desc: 'Log out of Pulse',
      icon: 'fa-arrow-right-from-bracket',
      kind: 'action',
      keywords: ['logout', 'log out', 'sign off', 'exit', 'leave'],
      run: onSignOut,
    },
  ], [isDarkMode, onToggleTheme, onTogglePulseAI, onToggleSidebar, onSignOut]);

  // Global section actions — the high-value "do something in a section" commands
  // that previously only existed while that section was mounted (Calendar's
  // Create Event, the cockpit's New decision / Prioritize). onSectionAction
  // deep-links to the section AND fires the action via the pending-intent
  // bridge, so they work from any view. "New task" already ships globally via
  // app:create, so it's intentionally not duplicated here.
  const actionsCommands = useMemo<Command[]>(() => [
    {
      id: 'action-create-event',
      label: 'Create event',
      desc: 'Open the calendar event form',
      icon: 'fa-calendar-plus',
      kind: 'action',
      keywords: ['event', 'calendar', 'schedule', 'new event', 'add event'],
      run: () => onSectionAction('calendar', 'create-event'),
    },
    {
      id: 'action-new-decision',
      label: 'New decision',
      desc: 'Open the decision wizard',
      icon: 'fa-scale-balanced',
      kind: 'action',
      keywords: ['decision', 'decide', 'new decision', 'propose'],
      run: () => onSectionAction('decisions', 'decision'),
    },
    {
      id: 'action-prioritize-tasks',
      label: 'Prioritize tasks with AI',
      desc: 'Rank your open tasks',
      icon: 'fa-bolt',
      kind: 'action',
      keywords: ['prioritize', 'ai', 'rank', 'triage', 'tasks'],
      run: () => onSectionAction('decisions', 'prioritize'),
    },
  ], [onSectionAction]);

  // People entity-jump — typing a name (2+ chars) surfaces matching contacts,
  // each as Open/Message/Meet/Vox commands. On an EMPTY query the provider
  // replays the person commands the user actually ran (palette MRU): activate()
  // has recorded person-* ids all along, but the pinned "Recent" group could
  // never resolve them because this provider returned nothing on browse —
  // recently-acted-on people silently vanished. Reconstructing the exact
  // command per MRU entry (capped at 3) lets the existing Recent pinning do
  // the rest; no fake "recent contacts" ordering is invented. 1-character
  // queries still return nothing (noise gate for the browse list).
  const peopleProvider = useCallback((rawQuery: string): Command[] => {
    const q = rawQuery.trim().toLowerCase();

    const commandsFor = (c: Contact): Record<'open' | 'msg' | 'meet' | 'vox', Command> => {
      const display = c.name || c.email || 'Unknown contact';
      return {
        open: {
          id: `person-open-${c.id}`,
          label: display,
          desc: c.company ? `Open contact · ${c.company}` : 'Open contact',
          icon: 'fa-user',
          kind: 'navigate',
          group: 'People',
          keywords: c.email ? [c.email] : undefined,
          run: () => onOpenContact(c.id),
        },
        msg: {
          id: `person-msg-${c.id}`,
          label: `Message ${display}`,
          desc: 'Open conversation',
          icon: 'fa-message',
          kind: 'action',
          group: 'People',
          run: () => onMessageContact(c.id),
        },
        meet: {
          id: `person-meet-${c.id}`,
          label: `Meet ${display}`,
          desc: 'Start a video meeting',
          icon: 'fa-video',
          kind: 'action',
          group: 'People',
          run: () => onMeetContact(c.id),
        },
        vox: {
          id: `person-vox-${c.id}`,
          label: `Vox ${display}`,
          desc: 'Send a voice message',
          icon: 'fa-microphone',
          kind: 'action',
          group: 'People',
          run: () => onVoxContact(c.id),
        },
      };
    };

    if (q.length === 0) {
      const byId = new Map(contacts.map(c => [c.id, c]));
      const cmds: Command[] = [];
      for (const rid of getRecentCommandIds()) {
        const m = rid.match(/^person-(open|msg|meet|vox)-(.+)$/);
        if (!m) continue;
        const contact = byId.get(m[2]);
        if (!contact) continue; // deleted contacts age out of the MRU naturally
        cmds.push(commandsFor(contact)[m[1] as 'open' | 'msg' | 'meet' | 'vox']);
        if (cmds.length >= 3) break;
      }
      return cmds;
    }

    if (q.length < 2) return [];

    const matches = contacts
      .filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q)
      )
      .slice(0, 5);
    const cmds: Command[] = [];
    for (const c of matches) {
      const all = commandsFor(c);
      cmds.push(all.open, all.msg, all.meet, all.vox);
    }
    return cmds;
  }, [contacts, onOpenContact, onMessageContact, onMeetContact, onVoxContact]);

  // Relay sub-source deep-links + record action. The plain `nav-relay` entry
  // only opens the section; these jump straight to a specific voice source from
  // anywhere, and "New voice message" opens the record composer on landing.
  const relayCommands = useMemo<Command[]>(() => [
    { id: 'relay-inbox',     label: 'Relay: Inbox',     desc: 'Voice that needs you',  icon: 'fa-inbox',            kind: 'navigate', keywords: ['relay', 'voice', 'triage', 'playlist'], run: () => onRelayNavigate('triage') },
    { id: 'relay-direct',    label: 'Relay: Direct',    desc: '1:1 voice',             icon: 'fa-user',             kind: 'navigate', keywords: ['relay', 'voice', 'dm', '1:1', 'direct'], run: () => onRelayNavigate('direct') },
    { id: 'relay-channels',  label: 'Relay: Channels',  desc: 'Team voice',            icon: 'fa-hashtag',          kind: 'navigate', keywords: ['relay', 'voice', 'team', 'channel'],     run: () => onRelayNavigate('channel') },
    { id: 'relay-broadcast', label: 'Relay: Broadcast', desc: 'One to many',           icon: 'fa-tower-broadcast',  kind: 'navigate', keywords: ['relay', 'voice', 'broadcast', 'radio'], run: () => onRelayNavigate('broadcast') },
    { id: 'relay-notes',     label: 'Relay: Notes',     desc: 'Personal voice notes',  icon: 'fa-file-lines',       kind: 'navigate', keywords: ['relay', 'voice', 'notes', 'memo'],      run: () => onRelayNavigate('notes') },
    { id: 'relay-live',      label: 'Relay: Live',      desc: 'Voice rooms',           icon: 'fa-headphones',       kind: 'navigate', keywords: ['relay', 'voice', 'live', 'rooms'],      run: () => onRelayNavigate('live') },
    { id: 'relay-new-vox',   label: 'New voice message', desc: 'Record and send',      icon: 'fa-microphone',       kind: 'action',   keywords: ['relay', 'record', 'vox', 'voice', 'new'], run: onNewVox },
  ], [onRelayNavigate, onNewVox]);

  // Register navigation as a separate scope from help so registries are
  // organized by intent and easy to debug.
  useRegisterCommands('app:navigation', { commands: navCommands });
  useRegisterCommands('app:relay',       { commands: relayCommands });
  useRegisterCommands('app:help',       { commands: helpCommands });
  useRegisterCommands('app:create',     { commands: createCommands });
  useRegisterCommands('app:email',       { commands: emailCommands });
  useRegisterCommands('app:meetings',    { commands: meetingCommands });
  useRegisterCommands('app:controls',    { commands: controlsCommands });
  useRegisterCommands('app:actions',      { commands: actionsCommands });
  useRegisterCommands('contacts:people', { provider: peopleProvider });

  return null;
};

const App: React.FC = () => {
  // Check for public routes that don't require authentication
  const path = window.location.pathname;

  // Public booking page — no auth required
  if (path.startsWith('/book/')) {
    return <BookingPage />;
  }

  // Public RSVP response page (Accept/Maybe/Decline email links) — no auth required
  if (path === '/rsvp') {
    return <RSVPResponsePage />;
  }

  // Workspace invite acceptance (handles auth check internally)
  if (path === '/invite') {
    return <WorkspaceInviteAccept />;
  }

  // Public pages - Privacy Policy and Terms of Service
  if (path === '/privacy') {
    return <PrivacyPolicy onBack={() => window.location.href = '/'} />;
  }

  if (path === '/terms') {
    return <TermsOfService onBack={() => window.location.href = '/'} />;
  }

  // Public marketing — minimal "About Pulse" page
  if (path === '/about') {
    return <About onBack={() => window.location.href = '/'} />;
  }

  // Public marketing — Features overview (quiet home lives at /, deep showcases here)
  if (path === '/features') {
    return <LandingPage variant="features" onGetStarted={() => window.location.href = '/?signin&mode=signup'} onSignIn={() => window.location.href = '/?signin'} />;
  }

  // Public marketing — /demo. The interactive product tour isn't built yet, so
  // rather than serve a "coming soon" placeholder behind a nav link (a broken
  // promise that reads as an unfinished product), /demo resolves to the live
  // feature showcase. We rewrite the URL to the canonical /features via the
  // History API (no second full document load — a `location.replace` here would
  // re-download the whole SPA) and render the features variant in place; the
  // hash is preserved for deep links. The nav "Demo" item is removed (see
  // LandingPage.tsx); restore both when a real tour ships. Runs before any
  // hook, so the early return is safe.
  if (path === '/demo') {
    window.history.replaceState(null, '', '/features' + window.location.hash);
    return <LandingPage variant="features" onGetStarted={() => window.location.href = '/?signin&mode=signup'} onSignIn={() => window.location.href = '/?signin'} />;
  }

  // Browser Extension Auth Routes
  if (path === '/auth/extension-login') {
    return <ExtensionLogin />;
  }

  if (path === '/auth/extension-oauth-callback') {
    return <ExtensionOAuthCallback />;
  }

  if (path === '/auth/extension-callback') {
    return <ExtensionCallback />;
  }

  if (path === '/auth/extension-error') {
    return <ExtensionError />;
  }

  // Microsoft Calendar OAuth callback
  if (path === '/auth/microsoft/callback') {
    return <MicrosoftCalendarCallback />;
  }

  // API Documentation (public)
  if (path === '/docs/api' || path === '/api/docs') {
    return <ApiDocumentation />;
  }

  // Pulse Video room direct link (e.g., /meet/pulse-abc123def456789)
  const pulseRoomMatch = path.match(/^\/meet\/([a-z0-9-]+)$/i);
  if (pulseRoomMatch) {
    const roomName = pulseRoomMatch[1];
    return <PulseRoomPage roomName={roomName} />;
  }

  // Live ETA share — public viewer. Token is the 32-char hex from
  // createEtaShare (UUID with hyphens stripped). No auth required.
  const etaShareMatch = path.match(/^\/eta\/([a-f0-9]{32})$/i);
  if (etaShareMatch) {
    return <EtaSharePage token={etaShareMatch[1]} />;
  }

  // Check for meeting link (e.g., /meeting/abc-defg-hij)
  const meetingMatch = path.match(/^\/meeting\/([a-z0-9-]+)$/i);
  const initialMeetingCode = meetingMatch ? meetingMatch[1] : null;

  // Use authentication context
  const { user, isLoading: isAuthLoading, logout, refreshSession } = useAuth();

  // Password-recovery mode: a reset link lands the user here with a recovery
  // token. Supabase parses it and fires PASSWORD_RECOVERY; we divert to the
  // "set a new password" screen instead of the authenticated app. Also seed
  // from the URL hash in case the event fired before this listener attached.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    try { return window.location.hash.includes('type=recovery'); }
    catch { return false; }
  });
  useEffect(() => onPasswordRecovery(() => setIsPasswordRecovery(true)), []);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);

  const [view, setView] = useState<AppView>(
    initialMeetingCode
      ? AppView.MEETINGS
      : (typeof window !== 'undefined' && window.location.hash.startsWith('#guide/'))
        ? AppView.USERS_GUIDE
        : AppView.DASHBOARD
  );

  // Mobile slim-bar sheets (bottom ☰ navigation / "+" quick actions). Declared
  // up here so the Android back handler can close an open sheet before it
  // falls through to view navigation. The ref keeps the intercept callback
  // stable across renders.
  const [mobileSheet, setMobileSheet] = useState<'nav' | 'actions' | null>(null);
  const mobileSheetRef = useRef(mobileSheet);
  mobileSheetRef.current = mobileSheet;
  const interceptMobileSheetBack = useCallback(() => {
    if (!mobileSheetRef.current) return false;
    setMobileSheet(null);
    return true;
  }, []);
  useAndroidBackButton({ view, setView, interceptBack: interceptMobileSheetBack });

  // Crossing into the desktop (md+) layout retires any open mobile sheet. The
  // sheet panel is `md:hidden`, but the portal stays mounted otherwise — its
  // focus trap and body scroll-lock would keep running off-screen.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => { if (mq.matches) setMobileSheet(null); };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // In-app SMS is a mock shell, hidden for v1 (issue #100). useFeatureFlag
  // is a synchronous read despite the `use` prefix, so it is safe to call
  // here in the component body.
  const smsEnabled = useFeatureFlag('inAppSms', user?.id, false);

  // Belt-and-suspenders: if a stale `view` state or deep-link lands on the
  // hidden SMS surface, bounce back to the Dashboard so the mock can't render.
  useEffect(() => {
    if (view === AppView.SMS && !smsEnabled) {
      setView(AppView.DASHBOARD);
    }
  }, [view, smsEnabled]);
  const [showPulseAI, setShowPulseAI] = useState(false);
  const [hasPulseAISuggestion, setHasPulseAISuggestion] = useState(false);
  const [proactiveFindings, setProactiveFindings] = useState<string | undefined>(undefined);
  const [isDarkMode, setIsDarkMode] = useState(false); // Default to light mode
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openTaskPanel, setOpenTaskPanel] = useState(false);
  const [openAddContact, setOpenAddContact] = useState(false);
  const [showLogoPreview, setShowLogoPreview] = useState(false);
  const [settingsSection, setSettingsSection] = useState<string | undefined>(undefined);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Slack OAuth return bridge: the user-token callback bounces back to
  // `/?slack=connected` (or `?slack_error=<reason>`). Land the user on Settings →
  // Integrations so the Slack card (its Connected badge / failure toast) is what
  // they see, instead of the Dashboard with an unconsumed param. SlackIntegration
  // reads the same param to toast the result and strip it from the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('slack') || params.has('slack_error')) {
      setSettingsSection('integrations');
      setView(AppView.SETTINGS);
    }
  }, []);

  // Stable handlers backing the global "New task" / "New contact" palette
  // commands (registered in AppCommandRegistrar). They reuse the exact
  // openTaskPanel / openAddContact intent bridge the Dashboard quick-actions and
  // the AI action handler already use: set the intent, switch view, then clear
  // it after the destination consumes it (Calendar/Contacts seed from it on
  // mount and via their false→true effect on the warm path). useCallback keeps
  // their identity stable so the command registration doesn't re-fire per render.
  const handleNewTask = useCallback(() => {
    setOpenTaskPanel(true);
    setView(AppView.CALENDAR);
    setTimeout(() => setOpenTaskPanel(false), 100);
  }, []);
  const handleNewContact = useCallback(() => {
    setOpenAddContact(true);
    setView(AppView.CONTACTS);
    setTimeout(() => setOpenAddContact(false), 100);
  }, []);

  // Palette people-jump handlers. "Open" routes to the Contacts card via a
  // two-path bridge: a live event (when Contacts is already mounted) plus a
  // sessionStorage handoff drained on ContactsShell mount (cold navigation in
  // from another section) — mirrors the pulse_focus_note pattern, so neither
  // path leaves a stale key. "Message" reuses the proven selectedContactId →
  // initialContactId path into Messages.
  const handleOpenContact = useCallback((id: string) => {
    sessionStorage.setItem('pulse_focus_contact', id);
    window.dispatchEvent(new CustomEvent('pulse:contacts:open-contact', { detail: { id } }));
    setView(AppView.CONTACTS);
  }, []);
  const handleMessageContact = useCallback((id: string) => {
    setSelectedContactId(id);
    setView(AppView.MESSAGES);
  }, []);
  // "Meet <name>" palette command. Sets selectedContactId + routes to Meetings,
  // which auto-starts an instant Pulse room via its initialContactId effect —
  // the same path Contacts' handleContactAction('meet') already uses.
  const handleMeetContact = useCallback((id: string) => {
    setSelectedContactId(id);
    setView(AppView.MEETINGS);
  }, []);
  // Relay deep-link intent (palette "Relay: <source>" + "New voice message" +
  // "Vox <name>"). The `key` bump re-fires Relay's intent effect even when it's
  // already mounted, so a repeat selection still switches source / re-opens the
  // composer / re-targets the contact. New voice message reuses the existing
  // RelayComposer (real audio capture), not the unverified inline recorder.
  const [relayIntent, setRelayIntent] = useState<{ view?: RelayShortcutView; compose?: boolean; contactId?: string; key: number } | null>(null);
  // "Vox <name>" palette command (Tier D / D2). Sets selectedContactId + routes
  // to Relay, which lands on Direct with the contact selected. Direct's recorder
  // arms itself once a contact is the send target (enabled: !!activeContactId),
  // so the FloatingMic is ready and the user clicks to record. No auto-mic — the
  // click is the consenting gesture. The keyed intent re-targets even when Relay
  // is already mounted, where the mount-only initialContactId would drop the pick.
  const handleVoxContact = useCallback((id: string) => {
    setSelectedContactId(id);
    setRelayIntent({ view: 'direct', contactId: id, key: Date.now() });
    setView(AppView.RELAY);
  }, []);
  const handleRelayNavigate = useCallback((view: RelayShortcutView) => {
    setRelayIntent({ view, key: Date.now() });
    setView(AppView.RELAY);
  }, []);
  const handleNewVox = useCallback(() => {
    setRelayIntent({ view: 'triage', compose: true, key: Date.now() });
    setView(AppView.RELAY);
  }, []);
  // "Compose email" palette command (Tier D / D1). Two-path bridge mirroring the
  // contacts open-card pattern: stash a pending intent in sessionStorage (drained
  // on EmailHybridClient mount — covers cold navigation in from another view) AND
  // dispatch the live event (caught by the already-mounted client's listener —
  // the warm path when you're already on Email). CustomEvents aren't buffered, so
  // the sessionStorage path is what survives the mount-after-event race. The
  // command is only registered when emailEnabled is on (AppCommandRegistrar), and
  // EmailClientWrapper drops the pending key when Gmail is disconnected so it can
  // never pop a stale composer later. Empty composer by product decision.
  const handleComposeEmail = useCallback(() => {
    const payload = { recipient: '', subject: '', body: '' };
    try {
      sessionStorage.setItem('pulse_pending_compose', JSON.stringify(payload));
    } catch {}
    window.dispatchEvent(new CustomEvent('pulse:compose-email', { detail: payload }));
    setView(AppView.EMAIL);
  }, []);
  // "Start a meeting" palette command (Tier D / D3). Routes to Meetings and arms
  // the instant-room intent, which Meetings consumes once on mount/transition.
  // Clears selectedContactId first: a blank instant meeting has no contact
  // context, and leaving a stale contact set would make Meetings' initialContactId
  // effect ALSO fire createAndJoinPulseRoom('Meeting with <name>') on a cold
  // navigation in — two rooms, two edge calls. Clearing it sidesteps that.
  const handleStartMeeting = useCallback(() => {
    setSelectedContactId(undefined);
    setMeetingIntent('startPulse');
    setView(AppView.MEETINGS);
  }, []);
  // Global section-action bridge (Phase 3). Lets a palette command both navigate
  // to a section AND fire one of its in-section actions (Create event / New
  // decision / Prioritize) from any view. Dual-path, mirroring pulse_pending_compose:
  // the sessionStorage key is drained by the destination on mount (cold nav,
  // covers the lazy-loaded CockpitHub chunk that isn't listening yet), and the
  // CustomEvent is caught by the destination's live listener (warm path, already
  // mounted). The destination removes the key when it consumes the intent.
  const handleSectionAction = useCallback((target: 'calendar' | 'decisions', action: string) => {
    try {
      sessionStorage.setItem('pulse_pending_section_action', JSON.stringify({ target, action }));
    } catch {}
    setView(target === 'calendar' ? AppView.CALENDAR : AppView.DECISIONS_TASKS);
    window.dispatchEvent(new CustomEvent('pulse:section-action', { detail: { target, action } }));
  }, []);
  const navRef = useRef<HTMLElement>(null);
  const preservedScrollTop = useRef<number | null>(null);
  // Guards the setup modal to auto-open at most once per app session. Without it
  // the trigger effect below re-fires on every Supabase token refresh (each
  // yields a new `user` object reference) and re-pops the modal every ~hour / on
  // re-auth.
  const permissionPromptShownRef = useRef(false);

  // Permissions hook
  const {
    shouldShowPermissionModal,
    markSetupComplete,
    isInitialized: permissionsInitialized,
    isNativePlatform: isNative
  } = usePermissions();

  // Presence tracking - only start heartbeat when user is authenticated
  // This prevents AbortError when app loads before authentication completes
  usePresence(!!user && !isAuthLoading);

  // Memory auto-ingest: archive new conversations (email, Pulse messages,
  // meetings, decisions, voice notes/messages, glimpses) into the Memory
  // store as they happen, once authenticated. Mirrors the presence gating
  // above. The subscription is best-effort and idempotent (DB unique index
  // on user_id+source_table+source_id), and tears down on logout/unmount.
  useEffect(() => {
    if (!user || isAuthLoading) return;
    const unsubscribe = subscribeRealtimeIngest();
    return () => unsubscribe();
  }, [user, isAuthLoading]);

  // Toggle theme function - defined early so it can be used in useEffect hooks
  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => {
      const newMode = !prev;
      if (newMode) {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
      }
      return newMode;
    });
  }, []);
  
  // AI Lab API Keys - read from localStorage (set in Settings > AI Lab)
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [claudeKey, setClaudeKey] = useState(() => localStorage.getItem('claude_api_key') || '');
  const [assemblyKey, setAssemblyKey] = useState(() => localStorage.getItem('assemblyai_api_key') || '');
  const [elevenLabsKey, setElevenLabsKey] = useState(() => localStorage.getItem('elevenlabs_api_key') || '');
  const [mapboxKey, setMapboxKey] = useState(() => localStorage.getItem('mapbox_api_key') || '');

  // Refresh API keys when returning from settings
  useEffect(() => {
    const handleStorageChange = () => {
      setOpenaiKey(localStorage.getItem('openai_api_key') || '');
      setClaudeKey(localStorage.getItem('claude_api_key') || '');
      setAssemblyKey(localStorage.getItem('assemblyai_api_key') || '');
      setElevenLabsKey(localStorage.getItem('elevenlabs_api_key') || '');
      setMapboxKey(localStorage.getItem('mapbox_api_key') || '');
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Also refresh when view changes (returning from settings)
    handleStorageChange();
    
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [view]);

  const [selectedContactId, setSelectedContactId] = useState<string | undefined>(undefined);
  // Instant-meeting intent (Tier D / D3). Set by the global "Start a meeting"
  // palette command and consumed by Meetings on mount/transition to create a
  // blank Pulse room. Cleared via onIntentConsumed so it fires exactly once.
  const [meetingIntent, setMeetingIntent] = useState<'startPulse' | null>(null);

  // Initialize notification system
  const initializeNotifications = useNotificationStore((state) => state.initialize);
  const showNotificationCenter = useNotificationStore((state) => state.showNotificationCenter);

  useEffect(() => {
    initializeNotifications();
  }, [initializeNotifications]);

  // Global voice-command UI actions (lets voice commands interact with the whole app)
  useEffect(() => {
    const unsubscribe = voiceCommandService.onCommand('*', (result) => {
      if (!result.success) return;

      // 1) If command returned a view, navigate there
      if (result.data?.view) {
        const viewName = result.data.view as keyof typeof AppView;
        const appView = AppView[viewName];
        if (appView) {
          setView(appView);
          setIsMobileMenuOpen(false);
        }

        // If it's a search, forward the query to the search page
        if (result.data?.query) {
          window.dispatchEvent(new CustomEvent('pulse:set-search-query', { detail: { query: result.data.query } }));
        }
      }

      // 2) Handle UI actions
      const action = result.data?.action;
      if (!action) return;

      switch (action.type) {
        case 'open_notifications': {
          // Open notification center
          useNotificationStore.getState().setShowNotificationCenter(true);
          break;
        }
        case 'toggle_theme': {
          // If an explicit mode was requested, set theme accordingly
          if (action.mode === 'dark') {
            if (!document.documentElement.classList.contains('dark')) toggleTheme();
          } else if (action.mode === 'light') {
            if (document.documentElement.classList.contains('dark')) toggleTheme();
          } else {
            toggleTheme();
          }
          break;
        }
        case 'open_tasks': {
          setOpenTaskPanel(true);
          setView(AppView.CALENDAR);
          setTimeout(() => setOpenTaskPanel(false), 100);
          break;
        }
        case 'open_add_contact': {
          setOpenAddContact(true);
          setView(AppView.CONTACTS);
          setTimeout(() => setOpenAddContact(false), 100);
          break;
        }
        case 'toggle_sidebar': {
          const act = action.action as 'collapse' | 'expand' | 'toggle';
          if (act === 'collapse') setIsSidebarCollapsed(true);
          else if (act === 'expand') setIsSidebarCollapsed(false);
          else setIsSidebarCollapsed((prev) => !prev);
          break;
        }
        case 'open_conversation': {
          const name = String(action.name || '').toLowerCase();
          const match = contacts.find(c => c.name?.toLowerCase() === name)
            || contacts.find(c => c.name?.toLowerCase().includes(name));
          if (match) {
            setSelectedContactId(match.id);
            setView(AppView.MESSAGES);
            setIsMobileMenuOpen(false);
          } else {
            // Fallback: open messages view
            setView(AppView.MESSAGES);
            setIsMobileMenuOpen(false);
          }
          break;
        }
        case 'open_contact': {
          // We can only open Contacts; selecting a specific contact UI is handled within Contacts.
          setView(AppView.CONTACTS);
          setIsMobileMenuOpen(false);
          break;
        }
        case 'send_email': {
          // Dispatch pre-fill data for email composer
          window.dispatchEvent(new CustomEvent('pulse:compose-email', {
            detail: { recipient: action.recipient, subject: action.subject, body: action.body },
          }));
          break;
        }
        case 'send_sms': {
          window.dispatchEvent(new CustomEvent('pulse:compose-sms', {
            detail: { recipient: action.recipient, message: action.message },
          }));
          break;
        }
        case 'create_task': {
          window.dispatchEvent(new CustomEvent('pulse:create-task', {
            detail: { title: action.title, dueDate: action.dueDate, priority: action.priority },
          }));
          break;
        }
        case 'schedule_meeting': {
          window.dispatchEvent(new CustomEvent('pulse:create-event', {
            detail: { title: action.title, participants: action.participants, time: action.time },
          }));
          break;
        }
      }
    });

    return () => unsubscribe();
  }, [contacts, toggleTheme]);

  // Show permission request modal on first login or when new permissions are needed.
  // Auto-shows at most ONCE per app session (permissionPromptShownRef) — otherwise
  // this effect re-fires on every Supabase token refresh (each yields a new `user`
  // reference) and re-pops the modal every ~hour / on re-auth.
  useEffect(() => {
    if (permissionPromptShownRef.current || showPermissionModal) return;
    if (user && permissionsInitialized && !isAuthLoading && shouldShowPermissionModal()) {
      // Delay slightly to let the app fully render first
      const timer = setTimeout(() => {
        permissionPromptShownRef.current = true;
        // Persist that the one-time setup prompt has been shown BEFORE the user
        // interacts — so dismissing it (backdrop, browser refresh, denying a
        // required perm and closing) doesn't leave it re-popping on every auth
        // refresh / reload. localStorage-backed, so it survives the authed-tree
        // remount that token refresh triggers (which defeats the in-memory ref).
        markSetupComplete();
        setShowPermissionModal(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, permissionsInitialized, isAuthLoading, shouldShowPermissionModal, showPermissionModal, markSetupComplete]);

  // Sync settings from cloud on login
  useEffect(() => {
    let isSubscribed = true;

    if (user) {
      settingsService.syncFromCloud().catch(error => {
        if (isSubscribed) {
          console.error(error);
        }
      });
    }

    return () => {
      isSubscribed = false;
    };
  }, [user]);

  // Set CSS variable for sidebar width (used by modals/panels)
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width', 
      isSidebarCollapsed ? '5rem' : '18rem'
    );
  }, [isSidebarCollapsed]);

  const loadContacts = useCallback(async () => {
    setIsLoadingContacts(true);
    try {
      const dbContacts = await dataService.getContacts();
      setContacts(dbContacts);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);

  // Update dataService when user changes
  useEffect(() => {
    let isSubscribed = true;

    if (user) {
      dataService.setUserId(user.id);
      if (isSubscribed) {
        loadContacts();
      }
    } else {
      dataService.setUserId('');
    }

    return () => {
      isSubscribed = false;
    };
  }, [user, loadContacts]);

  // Initialize theme and accent color on mount
  useEffect(() => {
    // Theme Check - default to light mode if no preference saved
    if (localStorage.theme === 'dark') {
        setIsDarkMode(true);
        document.documentElement.classList.add('dark');
    } else {
        setIsDarkMode(false);
        document.documentElement.classList.remove('dark');
    }

    // Load saved accent color on app startup
    const loadAccentColor = () => {
      const colorPresets: Record<string, string> = {
        rose: '#f43f5e',
        pink: '#ec4899',
        coral: '#fb7185',
        purple: '#8B5CF6',
        teal: '#14B8A6',
        blue: '#3B82F6',
        amber: '#F59E0B',
      };

      const savedAccent = localStorage.getItem('accentColor');
      const savedCustom = localStorage.getItem('customColor');

      let hexColor = '#f43f5e'; // Default to Pulse Rose

      if (savedAccent === 'custom' && savedCustom) {
        hexColor = savedCustom;
      } else if (savedAccent && colorPresets[savedAccent]) {
        hexColor = colorPresets[savedAccent];
      }

      // Convert hex to RGB and apply to CSS variables
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);

      document.documentElement.style.setProperty('--accent-primary', hexColor);
      document.documentElement.style.setProperty('--accent-primary-rgb', `${r}, ${g}, ${b}`);
    };

    loadAccentColor();

    // NOTE: Don't load contacts here - they're loaded in the useEffect above (lines 360-369)
    // when user is authenticated. Loading here causes AbortError before auth completes.
  }, []);

  // Handle Resize to reset sidebar state
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      } else {
        setIsSidebarCollapsed(false); // Reset collapse on mobile as we use overlay
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcut: Ctrl+/ or Cmd+/ toggles Pulse AI
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        if (isOverlayOpen()) return; // don't toggle the AI panel behind an open overlay
        e.preventDefault();
        setShowPulseAI(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cmd+K / Ctrl+K opens the global command palette from anywhere. The palette
  // is mounted once at App level via CommandPaletteProvider; sections register
  // their commands via useRegisterCommands so the palette aggregates everything.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('pulse:command-palette-open'));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Cmd+J / Ctrl+J opens the global Capture modal from anywhere. CaptureModal
  // is mounted once at App level (sibling of GlobalCommandPalette) and listens
  // for `pulse:capture-open`. Notes land in `pulse_notes` tagged with the
  // current AppView so dashboard / war-room / summit / archives surfaces can
  // filter their views.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        // Skip when typing into an input/textarea/contentEditable — let the
        // user's text-input shortcuts work normally there.
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
          return;
        }
        if (isOverlayOpen()) return; // don't stack Capture over an already-open overlay
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('pulse:capture-open'));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Global navigation event — allows PulseAssistant suggested actions + the
  // AI-error handler's "Upgrade" CTA to navigate. `section` is honoured when
  // navigating into AppView.SETTINGS (e.g. `section: 'billing'`).
  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const { view: targetView, section } =
        (e as CustomEvent<{
          view: AppView;
          section?: string;
        }>).detail ?? {};
      if (!targetView) return;
      if (targetView === AppView.SETTINGS && section) {
        setSettingsSection(section);
      }
      setView(targetView);
    };
    window.addEventListener('pulse:navigate', handleNavigate);
    return () => window.removeEventListener('pulse:navigate', handleNavigate);
  }, []);

  // Restore scroll position after view changes
  useEffect(() => {
    if (preservedScrollTop.current !== null && navRef.current) {
      navRef.current.scrollTop = preservedScrollTop.current;
      preservedScrollTop.current = null;
    }
  }, [view]);

  // Function to preserve scroll position
  const preserveScrollPosition = useCallback(() => {
    if (navRef.current) {
      preservedScrollTop.current = navRef.current.scrollTop;
    }
  }, []);

  const handleLogin = async () => {
    try {
      // OAuth will redirect, user will be set via onAuthStateChange
      await loginWithGoogle();
    } catch (e) {
      console.error("Login failed:", e);
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      await loginWithMicrosoft();
    } catch (e) {
      console.error("Microsoft login failed:", e);
    }
  };

  const handlePasskeyLogin = async () => {
    // Unlike the OAuth handlers, do NOT swallow: passkey completes in-page, so
    // errors must reach Login.tsx to show a message and reset the spinner. On
    // success loginWithPasskey() calls setSession → SIGNED_IN swaps the screen.
    await loginWithPasskey();
  };

  const handleEmailLogin = async (email: string, password: string) => {
    try {
      // AuthContext will handle setting user state
      await loginWithEmail(email, password);
    } catch (e) {
      console.error("Email login failed:", e);
      throw e; // Re-throw so Login component can show error
    }
  };

  const handleSignup = async (email: string, password: string, name: string) => {
    try {
      // AuthContext will handle setting user state on a real session. If
      // confirmation is pending, signUpWithEmail throws EmailConfirmationRequiredError
      // which the Login component detects to show a "check your email" notice.
      await signUpWithEmail(email, password, name);
    } catch (e) {
      console.error("Signup failed:", e);
      throw e; // Re-throw so Login component can show error / notice
    }
  };

  const handlePasswordReset = async (email: string) => {
    // Throws on failure so the Login reset form can surface the error.
    await sendPasswordReset(email);
  };

  const handleSyncContacts = useCallback(async (newContacts: Contact[]) => {
    // Add new contacts to database
    const emailSet = new Set(contacts.map(c => c.email));
    const uniqueNew = newContacts.filter(c => !emailSet.has(c.email));

    for (const contact of uniqueNew) {
      const { id, ...contactData } = contact;
      await dataService.createContact(contactData);
    }

    // Reload contacts from database
    await loadContacts();
  }, [contacts, loadContacts]);

  // `previousId` is supplied when the save promoted a virtual contact (e.g.
  // `google_…` → UUID via Map's saveContactLocation). Match by previousId so
  // the App-level contact cache finds the row to replace instead of stale
  // duplicates piling up. Also re-pin selectedContactId if the user had the
  // promoted contact open in another section.
  const handleUpdateContact = useCallback(async (updatedContact: Contact, previousId?: string) => {
    await dataService.updateContact(updatedContact.id, updatedContact);
    const matchId = previousId ?? updatedContact.id;
    setContacts(prev => prev.map(c => c.id === matchId ? updatedContact : c));
    if (previousId && previousId !== updatedContact.id) {
      setSelectedContactId(prev => (prev === previousId ? updatedContact.id : prev));
    }
  }, []);

  const handleAddContact = useCallback(async (contact: Omit<Contact, 'id'>) => {
    const newContact = await dataService.createContact(contact);
    if (newContact) {
      setContacts(prev => [...prev, newContact]);
    }
    return newContact;
  }, []);

  const handleDeleteContact = useCallback(async (contactId: string): Promise<boolean> => {
    const ok = await dataService.deleteContact(contactId);
    if (ok) {
      setContacts(prev => prev.filter(c => c.id !== contactId));
    }
    return ok;
  }, []);

  const handleContactAction = (action: 'message' | 'vox' | 'meet', contactId: string) => {
    setSelectedContactId(contactId);
    if (action === 'message') setView(AppView.MESSAGES);
    if (action === 'vox') setView(AppView.RELAY);
    if (action === 'meet') setView(AppView.MEETINGS);
    setIsMobileMenuOpen(false); // Close menu on action
  };

  const handleLogoSelect = (logo: LogoOption) => {
    // Save the selected favicon to public folder would require backend
    // For now, download the files and show instructions
    console.log('Selected logo:', logo.name);

    // Create download links for both logo and favicon
    const downloadSvg = (svg: string, filename: string) => {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    downloadSvg(logo.faviconSvg, 'favicon.svg');

    alert(`Logo "${logo.name}" selected!\n\nThe favicon.svg has been downloaded.\n\nTo apply it:\n1. Replace f:\\pulse\\public\\favicon.svg with the downloaded file\n2. Refresh the browser`);
    setShowLogoPreview(false);
  };

  const renderContent = () => {
    return (
      <Suspense fallback={<PageLoader />}>
        {(() => {
          switch (view) {
            case AppView.LIVE:
              return <Summit
                userId={user?.id}
                onClose={() => setView(AppView.DASHBOARD)}
                onSendToArchive={async (notes) => {
                  const content = notes.map(n => `[${n.type.toUpperCase()}] ${n.content}`).join('\n\n');
                  await archiveService.createArchive({
                    type: 'note',
                    title: `Voice Chat Notes - ${new Date().toLocaleDateString()}`,
                    content,
                    date: new Date(),
                    tags: ['voice-chat', 'notes'],
                    visibility: 'private',
                    starred: false,
                  });
                }}
              />;
            case AppView.RELAY:
              return <Relay contacts={contacts} initialContactId={selectedContactId} isDarkMode={isDarkMode} intent={relayIntent} onIntentConsumed={() => setRelayIntent(null)} />;
            case AppView.GLIMPSE:
              return <Glimpse isDarkMode={isDarkMode} />;
            case AppView.SLACK_CHANNELS:
              // Self-gates on slackChannelsGrounding internally (App is mounted
              // OUTSIDE FeatureProvider, so it can't read `features` here).
              return <SlackChannels />;
            case AppView.MESSAGES:
              return <Messages contacts={contacts} initialContactId={selectedContactId} onAddContact={handleAddContact} fullPage={true} />;
            case AppView.SMS:
              // Surface hidden for v1 (#100) — the redirect effect above
              // bounces `view` to Dashboard; render nothing in the interim
              // so the mock SMS shell is never reachable by a normal user.
              if (!smsEnabled) return null;
              return <SMS contacts={contacts} />;
            case AppView.MEETINGS:
              return <Meetings contacts={contacts} initialContactId={selectedContactId} initialMeetingCode={initialMeetingCode || undefined} startIntent={meetingIntent} onIntentConsumed={() => setMeetingIntent(null)} />;
            case AppView.CALENDAR:
              return <Calendar contacts={contacts} openTaskPanel={openTaskPanel} onNavigateToIntegrations={() => { setSettingsSection('integrations'); setView(AppView.SETTINGS); }} />;
            case AppView.CONTACTS:
              return <Contacts contacts={contacts} onAction={handleContactAction} onSyncComplete={handleSyncContacts} onUpdateContact={handleUpdateContact} onAddContact={handleAddContact} onDeleteContact={handleDeleteContact} openAddContact={openAddContact} isDarkMode={isDarkMode} userId={user?.id} />;
            case AppView.MAP:
              // Map is a top-level section. The TODAY / WEEK / ATLAS lens
              // hybrid replaced the old entity-type identity row; deep-link
              // `intent` plumbing was retired alongside that change.
              return (
                <div className="w-full h-full p-3 bg-zinc-50 dark:bg-zinc-950">
                  <PulseMapView
                    contacts={contacts}
                    circles={[]}
                    isDarkMode={isDarkMode}
                    userId={user?.id ?? ''}
                    onContactAction={handleContactAction}
                    onContactUpdated={handleUpdateContact}
                  />
                </div>
              );
            case AppView.CONTACT_MAP:
              // Legacy deep-link compatibility. Map now lives at AppView.MAP.
              setView(AppView.MAP);
              return null;
            case AppView.EMAIL:
              return user ? <EmailClient user={user} onUpdateUser={() => { refreshSession(); }} /> : null;
            case AppView.ARCHIVES:
              return <Archives />;
            case AppView.SETTINGS:
              return <Settings
                user={user}
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
                initialSection={settingsSection}
                onClose={() => setView(AppView.DASHBOARD)}
              />;
            case AppView.MESSAGE_ANALYTICS:
              return <AnalyticsHome
                initialTab="messages"
                onClose={() => setView(AppView.DASHBOARD)}
                onOpenContact={() => setView(AppView.CONTACTS)}
                onOpenMessages={() => setView(AppView.MESSAGES)}
                onOpenCalendar={() => setView(AppView.CALENDAR)}
              />;
            case AppView.MULTI_MODAL:
              return <SearchWorkbench isDarkMode={isDarkMode} />;
            case AppView.ANALYTICS:
              return <AnalyticsHome
                initialTab="briefing"
                onClose={() => setView(AppView.DASHBOARD)}
                onOpenContact={() => setView(AppView.CONTACTS)}
                onOpenMessages={() => setView(AppView.MESSAGES)}
                onOpenCalendar={() => setView(AppView.CALENDAR)}
              />;
            case AppView.LIVE_AI:
              return <LiveDashboard userId={user?.id || ''} />;
            case AppView.DECISIONS_TASKS:
              return <CockpitHub user={user} />;
            case AppView.USERS_GUIDE:
              return <UsersGuide isDarkMode={isDarkMode} />;
            case AppView.DASHBOARD:
            default:
              return <Dashboard user={user} setView={(v, options) => {
                setView(v);
                setIsMobileMenuOpen(false);
                if (options?.openTaskPanel) {
                  setOpenTaskPanel(true);
                  // Reset after a brief delay to allow Calendar to read it
                  setTimeout(() => setOpenTaskPanel(false), 100);
                }
                if (options?.openAddContact) {
                  setOpenAddContact(true);
                  // Reset after a brief delay to allow Contacts to read it
                  setTimeout(() => setOpenAddContact(false), 100);
                }
              }} openSettings={(section) => {
                setSettingsSection(section);
                setView(AppView.SETTINGS);
                setIsMobileMenuOpen(false);
              }} />;
          }
        })()}
      </Suspense>
    );
  };

  // Password recovery takes precedence over every other state: a valid recovery
  // link creates a session, so without this gate the app would drop the user
  // straight into the workspace instead of letting them set a new password.
  if (isPasswordRecovery) {
    return (
      <ResetPassword
        onUpdatePassword={updatePassword}
        onComplete={() => {
          // Session is now valid → clear recovery, strip the token from the URL,
          // and fall through to the authenticated app on the next render.
          try { window.history.replaceState({}, '', window.location.pathname); } catch { /* noop */ }
          setIsPasswordRecovery(false);
        }}
        onCancel={async () => {
          await logoutUser().catch(() => {});
          try { window.history.replaceState({}, '', '/?signin'); } catch { /* noop */ }
          setIsPasswordRecovery(false);
        }}
      />
    );
  }

  // Show enhanced loading screen while checking auth
  if (isAuthLoading) {
    return <EnhancedLoadingScreen />;
  }

  // Show landing page or login for non-authenticated users
  if (!user) {
    // Check if user explicitly wants to sign in (via URL param, hash, or path)
    const wantsToSignIn = 
      window.location.search.includes('signin') || 
      window.location.hash === '#signin' ||
      window.location.pathname === '/login';

    // On native apps (Capacitor), always show login directly - no landing page needed
    // Native users have already installed the app, so skip marketing content
    if (wantsToSignIn || Capacitor.isNativePlatform()) {
      // Preserve signin state in URL to prevent redirect loops
      if (!window.location.search.includes('signin') && window.location.pathname !== '/login') {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('signin', 'true');
        // Use replaceState to avoid adding to history
        window.history.replaceState({}, '', currentUrl.toString());
      }
      return <Login onLogin={handleLogin} onEmailLogin={handleEmailLogin} onSignup={handleSignup} onMicrosoftLogin={handleMicrosoftLogin} onPasswordReset={handlePasswordReset} onPasskeyLogin={handlePasskeyLogin} />;
    }

    // Show public landing page by default (web only)
    return <LandingPage onGetStarted={() => window.location.href = '/?signin&mode=signup'} onSignIn={() => window.location.href = '/?signin'} />;
  }

  return (
    <WorkspaceProvider>
    <WorkspaceGate>
    <TrialGate>
    <FeatureProvider defaultMode="simple">
    <PulseAIProvider user={user} activeView={view}>
    <CommandPaletteProvider>
      {/* Global toast host — required by useAIErrorHandler + other toast-using
          components (emailStore, archiveStore, etc). Mounted once here so a
          single Toaster serves the whole app. */}
      <Toaster position="top-right" gutter={8} />

      <AppCommandRegistrar view={view} setView={setView} setSettingsSection={setSettingsSection} onNewTask={handleNewTask} onNewContact={handleNewContact} contacts={contacts} onOpenContact={handleOpenContact} onMessageContact={handleMessageContact} onMeetContact={handleMeetContact} onVoxContact={handleVoxContact} onRelayNavigate={handleRelayNavigate} onNewVox={handleNewVox} onComposeEmail={handleComposeEmail} onStartMeeting={handleStartMeeting} isDarkMode={isDarkMode} onToggleTheme={toggleTheme} onSignOut={logout} onTogglePulseAI={() => setShowPulseAI(prev => !prev)} onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)} onSectionAction={handleSectionAction} />

      {/* Global g-chord keyboard layer. Vim-style 2-key navigation chords
          (g m → Map, g c → Contacts, …) plus a `?` overlay listing them
          all. Mounted at App root so chords work from any section. */}
      <KeyboardChordsLayer />

      {/* Single global Capture modal — opened by Cmd+J from anywhere. Mirrors
          the GlobalCommandPalette pattern. Tags captures with the current view. */}
      <CaptureModal currentView={view} />

      {/* Blocking org-onboarding modal: appears when the active workspace has
          onboarding_step='pending' and the user is the owner. Self-dismisses. */}
      <OrgOnboardingModal />
      <MessageContainer userId={user?.id || 'anonymous'}>
        <div className="h-screen w-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col md:flex-row overflow-hidden font-sans transition-colors duration-500">

        {/* Mobile Header - Larger touch targets and better spacing */}
        <div className="md:hidden h-14 sm:h-16 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-3 sm:px-4 z-30 shrink-0 safe-area-top">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer min-h-[44px]" onClick={() => setView(AppView.DASHBOARD)}>
             <PulseMark size={38} className="w-9 h-9 sm:w-10 sm:h-10 drop-shadow-[0_3px_10px_rgba(244,63,94,0.3)]" />
             <span className="text-xl sm:text-2xl text-zinc-900 dark:text-white" style={{ fontFamily: "'Syne','Inter',system-ui,sans-serif", fontWeight: 800, letterSpacing: '0.06em' }}>PULSE</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Command palette — mobile entry point. Dispatches the same
                'pulse:command-palette-open' event the global Cmd+K listener
                uses, so it opens the modal palette identically. */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('pulse:command-palette-open'))}
              className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center text-zinc-500 dark:text-zinc-400 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition active:scale-95"
              aria-label="Open command palette"
              title="Run a command"
            >
              <CommandIcon className="text-lg" size={20} />
            </button>
            {/* User Guide */}
            <button
              type="button"
              onClick={() => { setView(AppView.USERS_GUIDE); setIsMobileMenuOpen(false); }}
              className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center text-zinc-500 dark:text-zinc-400 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition active:scale-95"
              aria-label="User Guide"
            >
              <HelpCircle className="text-lg" />
            </button>
            {/* Notification Bell */}
            <NotificationCenter onOpenSettings={() => { setSettingsSection('notifications'); setView(AppView.SETTINGS); setIsMobileMenuOpen(false); }} />
            <button
               onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
               className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition active:scale-95"
               aria-label={isMobileMenuOpen ? 'Close account menu' : 'Open account menu'}
            >
               {/* Account/workspace drawer trigger — an account icon, not a
                   hamburger, so it reads distinctly from the bottom-bar nav menu
                   (the drawer is account/workspace/settings only on mobile). */}
               <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-circle-user'} text-xl`}></i>
            </button>
          </div>
      </div>

      {/* Premium Sidebar */}
      <Sidebar
        user={user}
        currentView={view}
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        isDarkMode={isDarkMode}
        onViewChange={(newView) => {
          setView(newView);
          setIsMobileMenuOpen(false);
        }}
        onCollapse={() => setIsSidebarCollapsed(true)}
        onExpand={() => setIsSidebarCollapsed(false)}
        onToggleTheme={toggleTheme}
        onMobileClose={() => setIsMobileMenuOpen(false)}
        onLogoClick={() => setView(AppView.DASHBOARD)}
        onTogglePulseAI={() => setShowPulseAI(prev => !prev)}
        showPulseAI={showPulseAI}
        hasProactiveSuggestion={hasPulseAISuggestion}
        renderNotificationCenter={() => (
          <NotificationCenter onOpenSettings={() => { setSettingsSection('notifications'); setView(AppView.SETTINGS); }} />
        )}
        renderUserProfile={() => (
          <GoogleAccountSelector
            user={user}
            onUserChange={async (newUser) => {
              setIsMobileMenuOpen(false);
              if (!newUser) {
                // User logged out - use logout from AuthContext
                await logout();
              }
              // User state will be updated by AuthContext
            }}
            isSidebarCollapsed={isSidebarCollapsed}
            isDarkMode={isDarkMode}
            onToggleTheme={toggleTheme}
            onOpenFullSettings={(section) => {
              if (section) setSettingsSection(section);
              setView(AppView.SETTINGS);
            }}
          />
        )}
        renderVoiceLogo={(collapsed) => (
          <PulseVoiceLogo
            collapsed={collapsed}
            variant="panel"
            onNavigate={(viewName) => {
              const appView = AppView[viewName as keyof typeof AppView];
              if (appView) {
                setView(appView);
              }
            }}
            userId={user?.id}
            onLogoClick={() => setView(AppView.DASHBOARD)}
          />
        )}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative flex flex-col transition-colors duration-500 w-full pb-[var(--pulse-bottom-bar)]">
        {/* Persistent global command bar (Phase 6) — pinned above the per-view
            scroll area on every view, so it's outside the overflow-hidden
            Messages/Calendar panes and its dropdown is never clipped. */}
        <CommandBarHeader />
        <div className={`flex-1 min-h-0 w-full flex flex-col ${view === AppView.MESSAGES || view === AppView.CALENDAR || view === AppView.LIVE_AI ? 'overflow-hidden' : 'overflow-auto mobile-scroll p-2 sm:p-3 md:p-4 lg:p-6'}`}>
          <div className={`w-full ${view === AppView.MESSAGES || view === AppView.CALENDAR || view === AppView.LIVE_AI ? 'h-full min-h-0 flex flex-col' : 'min-h-full max-w-[1600px] mx-auto flex flex-col'} animate-fade-in`}>
            {renderContent()}
          </div>
        </div>
      </main>

      {/* Mobile slim bar: ☰ + current-section label open the nav sheet, "+"
          opens the quick-actions sheet. The top hamburger keeps the Sidebar
          drawer (workspace switcher, billing, theme, account); this bar owns
          section navigation and creation. */}
      <MobileBottomNav
        view={view}
        onOpenNav={() => setMobileSheet('nav')}
        onOpenActions={() => setMobileSheet('actions')}
        isDarkMode={isDarkMode}
      />
      {mobileSheet === 'nav' && (
        <MobileNavSheet
          view={view}
          onNavigate={(next) => {
            setView(next);
            setMobileSheet(null);
            setIsMobileMenuOpen(false);
          }}
          onClose={() => setMobileSheet(null)}
        />
      )}
      {mobileSheet === 'actions' && (
        <MobileQuickActionsSheet
          contacts={contacts}
          setView={setView}
          onNewTask={handleNewTask}
          onNewContact={handleNewContact}
          onComposeEmail={handleComposeEmail}
          onStartMeeting={handleStartMeeting}
          onVoxContact={handleVoxContact}
          onClose={() => setMobileSheet(null)}
        />
      )}

      {/* Logo Preview Modal */}
      {showLogoPreview && (
        <LogoPreview
          onClose={() => setShowLogoPreview(false)}
          onSelect={handleLogoSelect}
        />
      )}

      {/* Permission Request Modal - Shows on first login */}
      {showPermissionModal && (
        <PermissionRequestModal
          onComplete={() => setShowPermissionModal(false)}
          onSkip={() => setShowPermissionModal(false)}
        />
      )}

      {/* Voice commands moved to PulseVoiceLogo in sidebar */}

      {/* Proactive badge checker — headless, always mounted when user is logged in */}
      {user && (
        <PulseAIProactiveChecker
          user={user}
          isPanelOpen={showPulseAI}
          onProactiveChange={(hasProactive, findings) => {
            setHasPulseAISuggestion(hasProactive);
            if (findings) setProactiveFindings(findings);
            if (!hasProactive) setProactiveFindings(undefined);
          }}
        />
      )}

      {/* Global Pulse AI Assistant — single instance, portal-rendered */}
      {showPulseAI && user && (
        <PulseAssistant
          isOpen={showPulseAI}
          onClose={() => setShowPulseAI(false)}
          activeView={view}
          user={user}
          proactiveMessage={proactiveFindings}
        />
      )}

      <Analytics />

      {/* PWA Components */}
      <InstallPrompt />
      <OnlineStatus />
        </div>
      </MessageContainer>
    </CommandPaletteProvider>
    </PulseAIProvider>
    </FeatureProvider>
    </TrialGate>
    </WorkspaceGate>
    </WorkspaceProvider>
  );
};

export default App;
