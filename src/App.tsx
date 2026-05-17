
import { Capacitor } from '@capacitor/core';
import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import LiveSession from './components/LiveSession';
import { Summit } from './components/Summit';
import MessageContainer from './components/MessageContainer';
import Login from './components/Login';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import LandingPage from './components/LandingPage';
import { WorkspaceInviteAccept } from './components/WorkspaceInviteAccept';
import BookingPage from './components/BookingPage';
import PulseVideoRoom from './components/Meetings/PulseVideoRoom';
import { getRoomByName } from './services/pulseVideoService';

// Lazy-load route components for better code splitting
const Messages = lazy(() => import('./components/Messages'));
const LiveDashboard = lazy(() => import('./components/LiveDashboard'));
const DecisionTaskHub = lazy(() => import('./components/decisions/DecisionTaskHub').then(module => ({ default: module.DecisionTaskHub })));
const EmailClient = lazy(() => import('./components/Email/EmailClientWrapper'));
const Calendar = lazy(() => import('./components/Calendar'));
const Settings = lazy(() => import('./components/Settings'));
const Relay = lazy(() => import('./components/Relay'));
const Glimpse = lazy(() => import('./components/Glimpse'));
const SMS = lazy(() => import('./components/SMS'));
const Meetings = lazy(() => import('./components/Meetings').then(module => ({ default: module.Meetings })));
const Contacts = lazy(() => import('./components/Contacts'));
// Top-level Map section (Phase 3 IA promotion). Same component the Contacts
// 'Map' tab used to mount; now also addressable from the Sidebar directly.
const PulseMapView = lazy(() => import('./components/map/PulseMapView'));
const Archives = lazy(() => import('./components/Archives'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const MessageAnalytics = lazy(() => import('./components/MessageAnalytics'));
const UnifiedSearchRedesign = lazy(() => import('./components/UnifiedSearchRedesign'));
const AnalyticsDashboard = lazy(() => import('./components/Analytics').then(module => ({ default: module.AnalyticsDashboard })));
const UsersGuide = lazy(() => import('./components/UsersGuide/UsersGuide'));

import { SocialHealthMonitor } from './components/health/SocialHealthMonitor';
import { ContextHandoff } from './components/health/ContextHandoff';
import { NotificationCenter } from './components/NotificationCenter';
import { LoadingProvider, useLoading } from './contexts/LoadingContext';
import EnhancedLoadingScreen from './components/EnhancedLoadingScreen';
import { loginWithGoogle, loginWithEmail, signUpWithEmail, loginWithMicrosoft, syncGoogleContacts } from './services/authService';
import { dataService } from './services/dataService';
import { useNotificationStore } from './store/notificationStore';
import { Contact, AppView } from './types';
import { Analytics } from '@vercel/analytics/react';
import LogoPreview, { LogoOption } from './components/LogoPreview';
import GoogleAccountSelector from './components/GoogleAccountSelector';
import { ExtensionLogin, ExtensionOAuthCallback, ExtensionCallback, ExtensionError } from './components/ExtensionAuth';
import { MicrosoftCalendarCallback } from './components/MicrosoftCalendarCallback';
import { ApiDocumentation } from './components/ApiKeys';
import EtaSharePage from './components/EtaSharePage';
import PulseVoiceLogo from './components/PulseVoiceLogo';
import { voiceCommandService } from './services/voiceCommandService';
import PermissionRequestModal from './components/PermissionRequestModal';
import { usePermissions } from './hooks/usePermissions';
import { settingsService } from './services/settingsService';
import { archiveService } from './services/archiveService';
import { usePresence } from './hooks/usePresence';
import { useAndroidBackButton } from './hooks/useAndroidBackButton';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { useAuth } from './hooks/useAuth';
import PulseAssistant from './components/PulseAssistant/PulseAssistant';
import { PulseAssistantButton } from './components/PulseAssistant/PulseAssistantButton';
import { PulseAIProactiveChecker } from './components/PulseAssistant/PulseAIProactiveChecker';
import { InstallPrompt } from './components/PWA/InstallPrompt';
import { OnlineStatus } from './components/PWA/OnlineStatus';
import { FeatureProvider } from './contexts/FeatureContext';
import { PulseAIProvider } from './contexts/PulseAIContext';
import { CommandPaletteProvider, useCommandPalette, useRegisterCommands, Command } from './contexts/CommandPaletteContext';
import { GlobalCommandPalette } from './components/GlobalCommandPalette';
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
    getRoomByName(roomName).then(room => {
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
}

const AppCommandRegistrar: React.FC<AppCommandRegistrarProps> = ({
  view,
  setView,
  setSettingsSection,
}) => {
  const { open } = useCommandPalette();

  // Bridge the global Cmd+K event into the provider scope.
  useEffect(() => {
    const handler = () => open();
    window.addEventListener('pulse:command-palette-open', handler);
    return () => window.removeEventListener('pulse:command-palette-open', handler);
  }, [open]);

  const navCommands = useMemo<Command[]>(() => {
    const navDestinations: Array<{
      id: string; label: string; desc: string; view: AppView; icon: string; keywords?: string[];
    }> = [
      { id: 'nav-dashboard', label: 'Dashboard', desc: 'Daily briefing and quick actions', view: AppView.DASHBOARD, icon: 'fa-house', keywords: ['home', 'briefing', 'today'] },
      { id: 'nav-messages', label: 'Messages', desc: 'Unified inbox', view: AppView.MESSAGES, icon: 'fa-message', keywords: ['inbox', 'chat', 'dm'] },
      { id: 'nav-email', label: 'Email', desc: 'Pulse email client', view: AppView.EMAIL, icon: 'fa-envelope', keywords: ['mail', 'gmail'] },
      { id: 'nav-calendar', label: 'Calendar', desc: 'Schedule and tasks', view: AppView.CALENDAR, icon: 'fa-calendar', keywords: ['schedule', 'events', 'tasks', 'meeting'] },
      { id: 'nav-relay', label: 'Relay', desc: 'Voice messages and notes', view: AppView.RELAY, icon: 'fa-microphone', keywords: ['vox', 'voice', 'audio'] },
      { id: 'nav-contacts', label: 'Contacts', desc: 'People and teams', view: AppView.CONTACTS, icon: 'fa-users', keywords: ['people', 'crm'] },
      { id: 'nav-map', label: 'Map', desc: 'Spatial layer — contacts, places, geofences', view: AppView.MAP, icon: 'fa-location-dot', keywords: ['location', 'geo', 'team radar', 'places', 'broadcast'] },
      { id: 'nav-archives', label: 'Memory', desc: 'Every word, every voice — find any conversation', view: AppView.ARCHIVES, icon: 'fa-box-archive', keywords: ['archives', 'history'] },
      { id: 'nav-search', label: 'Search', desc: 'Search across Pulse', view: AppView.MULTI_MODAL, icon: 'fa-magnifying-glass', keywords: ['find', 'global'] },
      { id: 'nav-decisions', label: 'Decisions & Tasks', desc: 'Decision hub and task board', view: AppView.DECISIONS_TASKS, icon: 'fa-list-check', keywords: ['todo', 'task'] },
      { id: 'nav-meetings', label: 'Meetings', desc: 'Video meetings', view: AppView.MEETINGS, icon: 'fa-video', keywords: ['video', 'call'] },
      { id: 'nav-sms', label: 'SMS', desc: 'Text messages', view: AppView.SMS, icon: 'fa-comment-sms', keywords: ['text'] },
      { id: 'nav-settings', label: 'Settings', desc: 'Preferences and account', view: AppView.SETTINGS, icon: 'fa-gear', keywords: ['preferences', 'account'] },
      { id: 'nav-users-guide', label: "User's Guide", desc: 'How to use Pulse', view: AppView.USERS_GUIDE, icon: 'fa-circle-question', keywords: ['help', 'docs', 'guide'] },
    ];
    return navDestinations
      // Hide the "Go to <current view>" row — it would no-op and just adds noise.
      .filter(n => n.view !== view)
      .map(n => ({
        id: n.id,
        label: n.label,
        desc: n.desc,
        icon: n.icon,
        kind: 'navigate' as const,
        keywords: n.keywords,
        run: () => setView(n.view),
      }));
  }, [setView, view]);

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
  ], [setSettingsSection, setView]);

  // Register navigation as a separate scope from help so registries are
  // organized by intent and easy to debug.
  useRegisterCommands('app:navigation', { commands: navCommands });
  useRegisterCommands('app:help',       { commands: helpCommands });

  return null;
};

const App: React.FC = () => {
  // Check for public routes that don't require authentication
  const path = window.location.pathname;

  // Public booking page — no auth required
  if (path.startsWith('/book/')) {
    return <BookingPage />;
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
  const { user, isLoading: isAuthLoading, logout } = useAuth();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);

  const [view, setView] = useState<AppView>(initialMeetingCode ? AppView.MEETINGS : AppView.DASHBOARD);
  useAndroidBackButton({ view, setView });
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
  const navRef = useRef<HTMLElement>(null);
  const preservedScrollTop = useRef<number | null>(null);

  // Permissions hook
  const {
    shouldShowPermissionModal,
    isInitialized: permissionsInitialized,
    isNativePlatform: isNative
  } = usePermissions();

  // Presence tracking - only start heartbeat when user is authenticated
  // This prevents AbortError when app loads before authentication completes
  usePresence(!!user && !isAuthLoading);

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

  // Show permission request modal on first login or when new permissions are needed
  // Only show once per session and only for permissions that haven't been handled
  useEffect(() => {
    if (user && permissionsInitialized && !isAuthLoading && shouldShowPermissionModal()) {
      // Delay slightly to let the app fully render first
      const timer = setTimeout(() => {
        setShowPermissionModal(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, permissionsInitialized, isAuthLoading, shouldShowPermissionModal]);

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

  // Load contacts from database and sync with Google Contacts (optimized, non-blocking)
  const loadContacts = useCallback(async (syncGoogle = false) => {
    setIsLoadingContacts(true);

    try {
      // STEP 1: Load local contacts from Supabase (FAST - unblocks UI immediately)
      const dbContacts = await dataService.getContacts();
      setContacts(dbContacts);
      setIsLoadingContacts(false); // ✅ Unblock UI now - don't wait for Google sync

      // STEP 2: Sync Google Contacts in background (SLOW - non-blocking)
      if (syncGoogle) {
        // Don't await - run in background
        syncGoogleContacts()
          .then(googleContacts => {
            if (googleContacts && googleContacts.length > 0) {
              // Merge Google contacts, avoiding duplicates by email
              setContacts(prev => {
                const existingEmails = new Set(prev.map(c => c.email?.toLowerCase()).filter(Boolean));
                const newGoogleContacts = googleContacts.filter(
                  gc => gc.email && !existingEmails.has(gc.email.toLowerCase())
                );
                if (newGoogleContacts.length > 0) {
                  console.log(`✅ Added ${newGoogleContacts.length} new contacts from Google (background sync)`);
                }
                return [...prev, ...newGoogleContacts];
              });
            }
          })
          .catch(error => {
            console.warn('⚠️ Google Contacts sync failed (optional, non-blocking):', error);
            // Silent failure - Google sync is optional and shouldn't block the app
          });
      }
    } catch (error) {
      console.error('❌ Failed to load contacts:', error);
      setIsLoadingContacts(false);
    }
  }, []);

  // Update dataService when user changes
  useEffect(() => {
    let isSubscribed = true;

    if (user) {
      dataService.setUserId(user.id);
      // Auto-sync Google Contacts if user is logged in with Google
      const syncGoogle = user.googleConnected || user.connectedProviders?.google;

      // Only load contacts if the component is still mounted
      if (isSubscribed) {
        loadContacts(syncGoogle);
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
      // AuthContext will handle setting user state
      await signUpWithEmail(email, password, name);
    } catch (e) {
      console.error("Signup failed:", e);
      throw e; // Re-throw so Login component can show error
    }
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
              return <Relay contacts={contacts} initialContactId={selectedContactId} isDarkMode={isDarkMode} />;
            case AppView.GLIMPSE:
              return <Glimpse isDarkMode={isDarkMode} />;
            case AppView.MESSAGES:
              return <Messages contacts={contacts} initialContactId={selectedContactId} onAddContact={handleAddContact} fullPage={true} />;
            case AppView.SMS:
              return <SMS contacts={contacts} />;
            case AppView.MEETINGS:
              return <Meetings contacts={contacts} initialContactId={selectedContactId} initialMeetingCode={initialMeetingCode || undefined} />;
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
              return user ? <EmailClient user={user} onUpdateUser={() => setUser({...user})} /> : null;
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
              return <MessageAnalytics />;
            case AppView.MULTI_MODAL:
              // Using the Redesigned Search Page
              return <UnifiedSearchRedesign isDarkMode={isDarkMode} />;
            case AppView.ANALYTICS:
              return <AnalyticsDashboard
                onClose={() => setView(AppView.DASHBOARD)}
                onOpenContact={() => setView(AppView.CONTACTS)}
                onOpenMessages={() => setView(AppView.MESSAGES)}
                onOpenCalendar={() => setView(AppView.CALENDAR)}
              />;
            case AppView.LIVE_AI:
              return <LiveDashboard userId={user?.id || ''} />;
            case AppView.DECISIONS_TASKS:
              return <DecisionTaskHub user={user} />;
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
      return <Login onLogin={handleLogin} onEmailLogin={handleEmailLogin} onSignup={handleSignup} onMicrosoftLogin={handleMicrosoftLogin} />;
    }

    // Show public landing page by default (web only)
    return <LandingPage onGetStarted={() => window.location.href = '/?signin'} />;
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

      {/* Single global command palette — opened by Cmd+K from anywhere.
          Sections register their commands via useRegisterCommands so the
          palette aggregates Pulse-wide actions and section-specific ones. */}
      <GlobalCommandPalette />
      <AppCommandRegistrar view={view} setView={setView} setSettingsSection={setSettingsSection} />

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
             <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0f172a] flex items-center justify-center shadow-lg">
                <svg viewBox="0 0 64 64" className="w-6 h-6 sm:w-7 sm:h-7">
                  <defs>
                    <linearGradient id="pulse-grad-mobile" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f43f5e"/>
                      <stop offset="100%" stopColor="#ec4899"/>
                    </linearGradient>
                  </defs>
                  <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#pulse-grad-mobile)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
             </div>
             <span className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">Pulse</span>
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
               aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
               <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'} text-xl`}></i>
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
      <main className="flex-1 overflow-hidden relative transition-colors duration-500 w-full safe-area-bottom pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
        <div className={`h-full w-full flex flex-col ${view === AppView.MESSAGES || view === AppView.CALENDAR ? 'overflow-hidden' : 'overflow-auto mobile-scroll p-2 sm:p-3 md:p-4 lg:p-6'}`}>
          <div className={`w-full ${view === AppView.MESSAGES || view === AppView.CALENDAR ? 'h-full min-h-0 flex flex-col' : 'min-h-full max-w-[1600px] mx-auto flex flex-col'} animate-fade-in`}>
            {renderContent()}
          </div>
        </div>
      </main>

      <MobileBottomNav
        view={view}
        onNavigate={(next) => {
          setView(next);
          setIsMobileMenuOpen(false);
        }}
        onOpenMore={() => setIsMobileMenuOpen(true)}
        isDarkMode={isDarkMode}
      />

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
