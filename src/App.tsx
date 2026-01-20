
import { Capacitor } from '@capacitor/core';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import LiveSession from './components/LiveSession';
import PulseChat from './components/PulseChat';
import { PulseVoiceChat } from './components/VoiceChat';
import LiveDashboard from './components/LiveDashboard';
import Voxer from './components/Voxer';
import Messages from './components/Messages';
import SMS from './components/SMS';
import { Meetings } from './components/Meetings';
import Calendar from './components/Calendar';
import Contacts from './components/Contacts';
import Settings from './components/Settings';
import Login from './components/Login';
import EmailClient from './components/Email/EmailClientWrapper';
import Archives from './components/Archives';
import Dashboard from './components/Dashboard';
import Tools from './components/Tools';
import AILabHubRedesigned from './components/AILab/AILabHubRedesigned';
import MessageContainer from './components/MessageContainer';
import { DecisionTaskPanel } from './components/DecisionTaskPanel';
import AdminDashboard from './components/AdminDashboard';
import MessageAnalytics from './components/MessageAnalytics';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import LandingPage from './components/LandingPage';
import { ChatProvider } from './context/ChatContext';
import { ChatInterface } from './components/ChatInterface';
import { SocialHealthMonitor } from './components/health/SocialHealthMonitor';
import { ContextHandoff } from './components/health/ContextHandoff';
import { NotificationCenter } from './components/NotificationCenter';
import { loginWithGoogle, loginWithEmail, signUpWithEmail, loginWithMicrosoft, syncGoogleContacts } from './services/authService';
import { dataService } from './services/dataService';
import { useNotificationStore } from './store/notificationStore';
import { Contact, AppView } from './types';
import './App.css';
import { Analytics } from '@vercel/analytics/react';
import UnifiedSearch from './components/UnifiedSearch';
import UnifiedSearchRedesign from './components/UnifiedSearchRedesign';
import TestMatrix from './components/TestMatrix';
import LogoPreview, { LogoOption } from './components/LogoPreview';
import GoogleAccountSelector from './components/GoogleAccountSelector';
import { ExtensionLogin, ExtensionOAuthCallback, ExtensionCallback, ExtensionError } from './components/ExtensionAuth';
import { ApiDocumentation } from './components/ApiKeys';
import { AnalyticsDashboard } from './components/Analytics';
import { VoiceCommandButton } from './components/VoiceCommands';
import PulseVoiceLogo from './components/PulseVoiceLogo';
import { voiceCommandService } from './services/voiceCommandService';
import PermissionRequestModal from './components/PermissionRequestModal';
import { usePermissions } from './hooks/usePermissions';
import { settingsService } from './services/settingsService';
import { usePresence } from './hooks/usePresence';
import { Sidebar } from './components/Sidebar';
import { useAuth } from './hooks/useAuth';

const App: React.FC = () => {
  // Check for public routes that don't require authentication
  const path = window.location.pathname;

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

  // API Documentation (public)
  if (path === '/docs/api' || path === '/api/docs') {
    return <ApiDocumentation />;
  }

  // Check for meeting link (e.g., /meeting/abc-defg-hij)
  const meetingMatch = path.match(/^\/meeting\/([a-z0-9-]+)$/i);
  const initialMeetingCode = meetingMatch ? meetingMatch[1] : null;

  // Use authentication context
  const { user, isLoading: isAuthLoading, logout } = useAuth();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);

  const [view, setView] = useState<AppView>(initialMeetingCode ? AppView.MEETINGS : AppView.DASHBOARD);
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

  // Presence tracking - start heartbeat when user is logged in
  usePresence();

  const apiKey = import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || '';

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
  const [perplexityKey, setPerplexityKey] = useState(() => localStorage.getItem('perplexity_api_key') || import.meta.env.VITE_PERPLEXITY_API_KEY || '');
  const [mapboxKey, setMapboxKey] = useState(() => localStorage.getItem('mapbox_api_key') || '');

  // Refresh API keys when returning from settings
  useEffect(() => {
    const handleStorageChange = () => {
      setOpenaiKey(localStorage.getItem('openai_api_key') || '');
      setClaudeKey(localStorage.getItem('claude_api_key') || '');
      setAssemblyKey(localStorage.getItem('assemblyai_api_key') || '');
      setElevenLabsKey(localStorage.getItem('elevenlabs_api_key') || '');
      setPerplexityKey(localStorage.getItem('perplexity_api_key') || import.meta.env.VITE_PERPLEXITY_API_KEY || '');
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
    if (user) {
      settingsService.syncFromCloud().catch(console.error);
    }
  }, [user]);

  // Set CSS variable for sidebar width (used by modals/panels)
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width', 
      isSidebarCollapsed ? '5rem' : '18rem'
    );
  }, [isSidebarCollapsed]);

  // Load contacts from database and sync with Google Contacts
  const loadContacts = useCallback(async (syncGoogle = false) => {
    setIsLoadingContacts(true);
    try {
      // Load local contacts from Supabase
      const dbContacts = await dataService.getContacts();
      setContacts(dbContacts);

      // Auto-sync Google Contacts if user is connected with Google
      if (syncGoogle) {
        try {
          const googleContacts = await syncGoogleContacts();
          if (googleContacts.length > 0) {
            // Merge Google contacts, avoiding duplicates by email
            setContacts(prev => {
              const existingEmails = new Set(prev.map(c => c.email?.toLowerCase()).filter(Boolean));
              const newGoogleContacts = googleContacts.filter(
                gc => gc.email && !existingEmails.has(gc.email.toLowerCase())
              );
              if (newGoogleContacts.length > 0) {
                console.log(`Added ${newGoogleContacts.length} new contacts from Google`);
              }
              return [...prev, ...newGoogleContacts];
            });
          }
        } catch (error) {
          console.warn('Google Contacts sync failed (optional):', error);
          // Don't fail the whole load if Google sync fails
        }
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);

  // Update dataService when user changes
  useEffect(() => {
    if (user) {
      dataService.setUserId(user.id);
      // Auto-sync Google Contacts if user is logged in with Google
      const syncGoogle = user.googleConnected || user.connectedProviders?.google;
      loadContacts(syncGoogle);
    } else {
      dataService.setUserId('');
    }
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

    // Load contacts from Supabase
    loadContacts();
  }, [loadContacts]);

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

  const handleUpdateContact = useCallback(async (updatedContact: Contact) => {
    await dataService.updateContact(updatedContact.id, updatedContact);
    setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
  }, []);

  const handleAddContact = useCallback(async (contact: Omit<Contact, 'id'>) => {
    const newContact = await dataService.createContact(contact);
    if (newContact) {
      setContacts(prev => [...prev, newContact]);
    }
    return newContact;
  }, []);

  const handleContactAction = (action: 'message' | 'vox' | 'meet', contactId: string) => {
    setSelectedContactId(contactId);
    if (action === 'message') setView(AppView.MESSAGES);
    if (action === 'vox') setView(AppView.VOXER);
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
    switch (view) {
      case AppView.LIVE:
        return <PulseVoiceChat apiKey={apiKey} userId={user?.id} onClose={() => setView(AppView.DASHBOARD)} />;
      case AppView.VOXER:
        return <Voxer apiKey={apiKey} contacts={contacts} initialContactId={selectedContactId} isDarkMode={isDarkMode} />;
      case AppView.MESSAGES:
        return <Messages apiKey={apiKey} contacts={contacts} initialContactId={selectedContactId} onAddContact={handleAddContact} />;
      case AppView.SMS:
        return <SMS contacts={contacts} />;
      case AppView.MEETINGS:
        return <Meetings apiKey={apiKey} contacts={contacts} initialContactId={selectedContactId} initialMeetingCode={initialMeetingCode || undefined} />;
      case AppView.CALENDAR:
        return <Calendar contacts={contacts} openTaskPanel={openTaskPanel} onNavigateToIntegrations={() => { setSettingsSection('integrations'); setView(AppView.SETTINGS); }} />;
      case AppView.CONTACTS:
        return <Contacts contacts={contacts} onAction={handleContactAction} onSyncComplete={handleSyncContacts} onUpdateContact={handleUpdateContact} onAddContact={handleAddContact} openAddContact={openAddContact} />;
      case AppView.EMAIL:
        return user ? <EmailClient user={user} onUpdateUser={() => setUser({...user})} apiKey={apiKey} /> : null;
      case AppView.ARCHIVES:
        return <Archives />;
      case AppView.SETTINGS:
        return <Settings 
          user={user} 
          isDarkMode={isDarkMode} 
          toggleTheme={toggleTheme} 
          initialSection={settingsSection}
        />;
      case AppView.TOOLS:
        return <AILabHubRedesigned apiKey={apiKey} isDarkMode={isDarkMode} />;
      case AppView.MESSAGE_ADMIN:
        return <AdminDashboard userId={user?.id || ''} />;
      case AppView.MESSAGE_ANALYTICS:
        return <MessageAnalytics />;
      case AppView.MULTI_MODAL:
        // Using the Redesigned Search Page
        return <UnifiedSearchRedesign />;
      case AppView.TEST_MATRIX:
        return <TestMatrix />;
      case AppView.ANALYTICS:
        return <AnalyticsDashboard onClose={() => setView(AppView.DASHBOARD)} />;
      case AppView.LIVE_AI:
        return <LiveDashboard apiKey={apiKey} userId={user?.id || ''} />;
      case AppView.DECISIONS_TASKS:
        return <DecisionTaskPanel user={user} />;
      case AppView.DASHBOARD:
      default:
        return <Dashboard user={user} apiKey={apiKey} setView={(v, options) => { 
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
        }} />;
    }
  };

  // Show loading spinner while checking auth
  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-[#0f172a] rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/20 animate-pulse">
            <svg viewBox="0 0 64 64" className="w-12 h-12">
              <defs>
                <linearGradient id="pulse-grad-loading" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f43f5e"/>
                  <stop offset="100%" stopColor="#ec4899"/>
                </linearGradient>
              </defs>
              <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#pulse-grad-loading)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <p className="text-zinc-400 text-sm">Loading Pulse...</p>
        </div>
      </div>
    );
  }

  // Show landing page or login for non-authenticated users
  if (!user) {
    // Check if user explicitly wants to sign in (via URL param or state)
    const wantsToSignIn = window.location.search.includes('signin') || window.location.hash === '#signin';

    // On native apps (Capacitor), always show login directly - no landing page needed
    // Native users have already installed the app, so skip marketing content
    if (wantsToSignIn || Capacitor.isNativePlatform()) {
      return <Login onLogin={handleLogin} onEmailLogin={handleEmailLogin} onSignup={handleSignup} onMicrosoftLogin={handleMicrosoftLogin} />;
    }

    // Show public landing page by default (web only)
    return <LandingPage onGetStarted={() => window.location.href = '/?signin'} />;
  }

  return (
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
      <main className="flex-1 p-2 sm:p-3 md:p-4 lg:p-6 overflow-hidden relative transition-colors duration-500 w-full safe-area-bottom">
        <div className="h-full w-full max-w-[1600px] mx-auto animate-fade-in relative flex flex-col overflow-auto mobile-scroll">
           {renderContent()}
        </div>
      </main>

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

      <Analytics />
      </div>
    </MessageContainer>
  );
};

export default App;
