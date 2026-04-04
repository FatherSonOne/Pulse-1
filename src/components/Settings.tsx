
import React, { useState, useEffect } from 'react';
import type { User } from '../types';
import { ChevronRight, Menu, Search, X } from 'lucide-react';
import './Settings.css';

// Sub-components
import { AccountSettings } from './settings/AccountSettings';
import { AIIntelligenceSettings } from './settings/AIIntelligenceSettings';
import { IntegrationsSettings } from './settings/IntegrationsSettings';
import { NotificationsSettingsSection } from './settings/NotificationsSettingsSection';
import { TeamSettings } from './settings/TeamSettings';
import { AccessibilitySettings } from './settings/AccessibilitySettings';
import { PrivacyDataSettings } from './settings/PrivacyDataSettings';
import { FeaturesLabsSettings } from './settings/FeaturesLabsSettings';
import { StudioSettings } from './settings/StudioSettings';
import { ActivityMonitorSettings } from './settings/ActivityMonitorSettings';
import { DesktopAppSettings } from './settings/DesktopAppSettings';
import { AboutSettings } from './settings/AboutSettings';
import { BillingSettings } from './settings/BillingSettings';
import { DeveloperSettings } from './settings/DeveloperSettings';
import { AdminSettings } from './settings/AdminSettings';
import { EcosystemSettings } from './settings/EcosystemSettings';

interface SettingsProps {
  user?: User | null;
  isDarkMode: boolean;
  toggleTheme: () => void;
  initialSection?: string;
  onClose?: () => void;
}

const SECTIONS = [
  { id: 'account', icon: 'fa-user', label: 'My Account' },
  { id: 'ai_intelligence', icon: 'fa-brain', label: 'AI & Intelligence' },
  { id: 'integrations', icon: 'fa-plug', label: 'Integrations' },
  { id: 'ecosystem', icon: 'fa-circle-nodes', label: 'Ecosystem Bridge' },
  { id: 'notifications', icon: 'fa-bell', label: 'Notifications' },
  { id: 'features_labs', icon: 'fa-flask', label: 'Features & Labs' },
  { id: 'war_room', icon: 'fa-shield', label: 'Studio' },
  { id: 'activity_monitor', icon: 'fa-chart-line', label: 'Activity Monitor' },
  { id: 'team', icon: 'fa-users', label: 'Team Management' },
  { id: 'accessibility', icon: 'fa-universal-access', label: 'Accessibility' },
  { id: 'privacy_data', icon: 'fa-shield-halved', label: 'Privacy & Data' },
  { id: 'about', icon: 'fa-circle-info', label: 'About Pulse' },
  { id: 'billing', icon: 'fa-receipt', label: 'Plan & Billing' },
  { id: 'developer', icon: 'fa-code', label: 'Developer Tools' },
];

const ADMIN_SECTIONS = [
  { id: 'admin', icon: 'fa-shield-halved', label: 'Admin Dashboard' },
];

const SECTION_KEYWORDS: Record<string, string[]> = {
  account: ['profile', 'avatar', 'name', 'email', 'theme', 'dark', 'light', 'appearance', 'logout', 'sign out', 'password'],
  ai_intelligence: ['ai', 'intelligence', 'model', 'gpt', 'claude', 'gemini', 'voice agent', 'quota', 'voxer', 'brain'],
  integrations: ['slack', 'gmail', 'twilio', 'calendar', 'google', 'contacts', 'maps', 'connect', 'integration'],
  ecosystem: ['ecosystem', 'bridge', 'entomate', 'logos vision', 'qntmecos', 'bot', 'webhook', 'token', 'connection'],
  notifications: ['bell', 'alert', 'push', 'email notification', 'sound', 'vibration', 'quiet hours', 'vip'],
  features_labs: ['feature', 'lab', 'beta', 'experimental', 'toggle', 'enable', 'disable', 'advanced mode'],
  war_room: ['war room', 'mission', 'intel', 'focus', 'analyst', 'strategist', 'brainstorm', 'command', 'ai depth', 'reasoning'],
  activity_monitor: ['activity', 'presence', 'online', 'leaderboard', 'event feed', 'retention'],
  team: ['team', 'invite', 'member', 'colleague', 'share'],
  accessibility: ['font size', 'high contrast', 'reduced motion', 'visual', 'accessibility'],
  privacy_data: ['privacy', 'analytics', 'export', 'delete', 'data', 'cache', 'tracking', 'gdpr'],
  about: ['version', 'update', 'install', 'pwa', 'info', 'about'],
  billing: ['billing', 'plan', 'subscription', 'upgrade', 'payment', 'usage'],
  developer: ['api key', 'openai', 'developer', 'token', 'code', 'webhook'],
  desktop_app: ['desktop', 'electron', 'tray', 'startup', 'launch', 'window'],
};

const Settings: React.FC<SettingsProps> = ({ user, isDarkMode, toggleTheme, initialSection, onClose }) => {
  const [activeSection, setActiveSection] = useState(initialSection || 'account');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [searchQuery, setSearchQuery] = useState('');

  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Deep-link support: ?settings=<sectionId>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sectionParam = params.get('settings');
    const validIds = [...SECTIONS.map(s => s.id), 'desktop_app', 'ecosystem', 'admin'];
    if (sectionParam && validIds.includes(sectionParam)) {
      setActiveSection(sectionParam);
    }
  }, []);

  const filteredSections = searchQuery.trim() === '' ? null : [
    ...SECTIONS,
    ...(isElectron ? [{ id: 'desktop_app', icon: 'fa-desktop', label: 'Desktop App' }] : []),
  ].filter((s) => {
    const q = searchQuery.toLowerCase();
    return s.label.toLowerCase().includes(q) || (SECTION_KEYWORDS[s.id] || []).some((kw) => kw.includes(q));
  });

  const renderContent = () => {
    switch (activeSection) {
      case 'account':          return <AccountSettings user={user} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
      case 'ai_intelligence':  return <AIIntelligenceSettings />;
      case 'integrations':     return <IntegrationsSettings user={user} userId={user?.id || ''} />;
      case 'ecosystem':        return <EcosystemSettings userId={user?.id || ''} />;
      case 'notifications':    return <NotificationsSettingsSection />;
      case 'team':             return <TeamSettings userId={user?.id || ''} userName={user?.name || ''} />;
      case 'accessibility':    return <AccessibilitySettings />;
      case 'privacy_data':     return <PrivacyDataSettings />;
      case 'features_labs':    return <FeaturesLabsSettings />;
      case 'war_room':         return <StudioSettings />;
      case 'activity_monitor': return <ActivityMonitorSettings />;
      case 'desktop_app':      return <DesktopAppSettings />;
      case 'about':            return <AboutSettings />;
      case 'billing':          return <BillingSettings />;
      case 'developer':        return <DeveloperSettings />;
      case 'admin':            return <AdminSettings userId={user?.id || ''} />;
      default:                 return <div className="text-zinc-500">Section under construction.</div>;
    }
  };

  // Mobile Header
  const MobileHeader = () => (
    <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
      {!isMobileMenuOpen && (
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
          aria-label="Open settings menu"
        >
          <Menu className="text-lg" />
          <span className="font-semibold">
            {SECTIONS.find(s => s.id === activeSection)?.label || 'Settings'}
          </span>
        </button>
      )}
      <button
        onClick={onClose}
        className="ml-auto w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
        aria-label="Close settings"
      >
        <X className="text-lg" />
      </button>
    </div>
  );

  return (
    <div data-settings className="h-full bg-white dark:bg-zinc-950 flex flex-col">
      <MobileHeader />

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl">

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Settings Sidebar */}
        <div className={`
          fixed md:relative z-50 md:z-auto
          w-full md:w-64 h-full
          bg-zinc-50 dark:bg-zinc-900
          border-r border-zinc-200 dark:border-zinc-800
          p-4 flex flex-col
          transform transition-transform duration-300 ease-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          shadow-2xl md:shadow-none
        `}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold dark:text-white text-zinc-900 px-2 animate-fade-in">
              Settings
            </h2>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden w-8 h-8 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 transition"
              aria-label="Close menu"
            >
              <X />
            </button>
          </div>

          {/* Search bar */}
          <div className="mb-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings..."
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search settings"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                aria-label="Clear search"
              >
                <X className="text-xs" />
              </button>
            )}
          </div>

          <nav className="space-y-1 flex-1">
            {(filteredSections ?? [...SECTIONS, ...(isElectron ? [{ id: 'desktop_app', icon: 'fa-desktop', label: 'Desktop App' }] : [])]).map((section, idx) => (
              <button
                key={section.id}
                tabIndex={0}
                onClick={() => {
                  setActiveSection(section.id);
                  setSearchQuery('');
                  setIsMobileMenuOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); (e.currentTarget.nextElementSibling as HTMLElement)?.focus(); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); (e.currentTarget.previousElementSibling as HTMLElement)?.focus(); }
                  if (e.key === 'Escape') { onClose?.(); }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group animate-slide-in-right ${activeSection === section.id ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                style={{ animationDelay: `${Math.min(idx, 4) * 40}ms` }}
              >
                <i className={`fa-solid ${section.icon} w-5 text-center transition-transform group-hover:scale-110`}></i>
                <span className="text-sm">{section.label}</span>
                {activeSection === section.id && <ChevronRight className="ml-auto text-xs opacity-50" />}
              </button>
            ))}

            {filteredSections !== null && filteredSections.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-zinc-400">
                No settings matching <em>"{searchQuery}"</em>
              </div>
            )}

            {(user?.role === 'admin' || (user as any)?.isAdmin) && (
              <>
                <div className="border-t border-zinc-200 dark:border-zinc-800 my-4 pt-4">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-4">Admin</span>
                </div>
                {ADMIN_SECTIONS.map((section, idx) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSection(section.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group animate-slide-in-right ${activeSection === section.id ? 'bg-purple-600/10 text-purple-600 dark:text-purple-400 font-semibold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                    style={{ animationDelay: `${(SECTIONS.length + idx) * 50}ms` }}
                  >
                    <i className={`fa-solid ${section.icon} w-5 text-center transition-transform group-hover:scale-110`}></i>
                    <span className="text-sm">{section.label}</span>
                    {activeSection === section.id && <ChevronRight className="ml-auto text-xs opacity-50" />}
                  </button>
                ))}
              </>
            )}
          </nav>
        </div>

        {/* Main Settings Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative bg-white dark:bg-zinc-950">
          <div className="max-w-2xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
