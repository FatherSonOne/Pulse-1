
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
import { ActivityMonitorSettings } from './settings/ActivityMonitorSettings';
import { DesktopAppSettings } from './settings/DesktopAppSettings';
import { AboutSettings } from './settings/AboutSettings';
import { BillingSettings } from './settings/BillingSettings';
import { DeveloperSettings } from './settings/DeveloperSettings';
import { EcosystemSettings } from './settings/EcosystemSettings';
import { WorkspaceSettings } from './settings/WorkspaceSettings';
import { SecuritySettings } from './settings/SecuritySettings';
import { ComplianceSettings } from './settings/ComplianceSettings';

interface SettingsProps {
  user?: User | null;
  isDarkMode: boolean;
  toggleTheme: () => void;
  initialSection?: string;
  onClose?: () => void;
}

type SectionItem = { id: string; icon: string; label: string };
type SectionGroup = { label: string; items: SectionItem[] };

const SECTION_GROUPS: SectionGroup[] = [
  {
    label: 'Personal',
    items: [
      { id: 'account', icon: 'fa-user', label: 'My Account' },
      { id: 'notifications', icon: 'fa-bell', label: 'Notifications' },
      { id: 'accessibility', icon: 'fa-universal-access', label: 'Accessibility' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { id: 'workspace', icon: 'fa-building', label: 'Organization' },
      { id: 'team', icon: 'fa-users', label: 'Team Management' },
      { id: 'integrations', icon: 'fa-plug', label: 'Integrations' },
      { id: 'ecosystem', icon: 'fa-circle-nodes', label: 'Ecosystem Bridge' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'ai_intelligence', icon: 'fa-brain', label: 'AI & Intelligence' },
      { id: 'features_labs', icon: 'fa-flask', label: 'Features & Labs' },
    ],
  },
  {
    label: 'Trust',
    items: [
      { id: 'security', icon: 'fa-lock', label: 'Security' },
      { id: 'compliance', icon: 'fa-scale-balanced', label: 'Compliance' },
      { id: 'privacy_data', icon: 'fa-shield-halved', label: 'Privacy & Data' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { id: 'activity_monitor', icon: 'fa-chart-line', label: 'Activity Monitor' },
      { id: 'billing', icon: 'fa-receipt', label: 'Plan & Billing' },
      { id: 'developer', icon: 'fa-code', label: 'Developer Tools' },
      { id: 'about', icon: 'fa-circle-info', label: 'About Pulse' },
    ],
  },
];

const SECTIONS: SectionItem[] = SECTION_GROUPS.flatMap((g) => g.items);

const SECTION_KEYWORDS: Record<string, string[]> = {
  account: ['profile', 'avatar', 'name', 'email', 'theme', 'dark', 'light', 'appearance', 'logout', 'sign out', 'password'],
  ai_intelligence: ['ai', 'intelligence', 'model', 'gpt', 'claude', 'gemini', 'voice agent', 'quota', 'relay', 'brain'],
  integrations: ['slack', 'gmail', 'twilio', 'calendar', 'google', 'contacts', 'maps', 'connect', 'integration'],
  ecosystem: ['ecosystem', 'bridge', 'entomate', 'logos vision', 'qntmecos', 'bot', 'webhook', 'token', 'connection'],
  notifications: ['bell', 'alert', 'push', 'email notification', 'sound', 'vibration', 'quiet hours', 'vip'],
  features_labs: ['feature', 'lab', 'beta', 'experimental', 'toggle', 'enable', 'disable', 'advanced mode'],
  activity_monitor: ['activity', 'presence', 'online', 'leaderboard', 'event feed', 'retention'],
  workspace: ['organization', 'org', 'workspace', 'legal name', 'logo', 'industry', 'size', 'domain', 'auto-join', 'archive', 'delete', 'danger zone', 'restore', 'transfer', 'audit'],
  team: ['team', 'invite', 'member', 'colleague', 'share'],
  security: ['security', '2fa', 'two factor', 'mfa', 'session', 'timeout', 'ip allowlist', 'cidr', 'sign in', 'login', 'access'],
  compliance: ['compliance', 'dpa', 'gdpr', 'data processing', 'audit log', 'csv', 'export', 'residency', 'region', 'legal hold', 'subprocessor'],
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

  // Cross-section navigation via custom event.  Components inside any
  // settings section can dispatch
  //   window.dispatchEvent(new CustomEvent('pulse:settings-navigate', {
  //     detail: { section: 'workspace', focus: 'transfer' }
  //   }))
  // to switch sections AND drop a `?focus=<key>` param the destination
  // section can read on mount (mirrors the ?focus=invite pattern in
  // TeamSettings.tsx).  Decouples team-settings owner-row "Transfer
  // ownership →" link from workspace-settings without URL routing.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ section?: string; focus?: string }>;
      const section = ce.detail?.section;
      const focus   = ce.detail?.focus;
      if (!section) return;
      setActiveSection(section);
      if (focus) {
        const params = new URLSearchParams(window.location.search);
        params.set('focus', focus);
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}?${params.toString()}`,
        );
      }
    };
    window.addEventListener('pulse:settings-navigate', handler);
    return () => window.removeEventListener('pulse:settings-navigate', handler);
  }, []);

  // Deep-link support: ?settings=<sectionId>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sectionParam = params.get('settings');
    const validIds = [...SECTIONS.map(s => s.id), 'desktop_app', 'ecosystem'];
    if (sectionParam && validIds.includes(sectionParam)) {
      setActiveSection(sectionParam);
    }
  }, []);

  const desktopAppItem: SectionItem = { id: 'desktop_app', icon: 'fa-desktop', label: 'Desktop App' };

  const allSections: SectionItem[] = [
    ...SECTIONS,
    ...(isElectron ? [desktopAppItem] : []),
  ];

  const groupedSections: SectionGroup[] = isElectron
    ? SECTION_GROUPS.map((g) =>
        g.label === 'Admin' ? { ...g, items: [...g.items, desktopAppItem] } : g
      )
    : SECTION_GROUPS;

  const filteredSections = searchQuery.trim() === '' ? null : allSections.filter((s) => {
    const q = searchQuery.toLowerCase();
    return s.label.toLowerCase().includes(q) || (SECTION_KEYWORDS[s.id] || []).some((kw) => kw.includes(q));
  });

  const renderNavButton = (section: SectionItem) => (
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
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 ${
        activeSection === section.id
          ? 'bg-[var(--pulse-rose-soft)] text-[var(--pulse-rose-text)] font-semibold'
          : 'text-[var(--pulse-ink-2)] hover:text-[var(--pulse-ink)] hover:bg-[var(--pulse-surface-raised)]'
      }`}
    >
      <i className={`fa-solid ${section.icon} w-5 text-center text-xs`}></i>
      <span className="text-sm">{section.label}</span>
      {activeSection === section.id && <ChevronRight className="ml-auto text-xs opacity-50" />}
    </button>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'account':          return <AccountSettings user={user} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
      case 'ai_intelligence':  return <AIIntelligenceSettings />;
      case 'integrations':     return <IntegrationsSettings user={user} userId={user?.id || ''} />;
      case 'ecosystem':        return <EcosystemSettings userId={user?.id || ''} />;
      case 'notifications':    return <NotificationsSettingsSection />;
      case 'workspace':        return <WorkspaceSettings />;
      case 'team':             return <TeamSettings userId={user?.id || ''} userName={user?.name || ''} />;
      case 'security':         return <SecuritySettings />;
      case 'compliance':       return <ComplianceSettings />;
      case 'accessibility':    return <AccessibilitySettings />;
      case 'privacy_data':     return <PrivacyDataSettings />;
      case 'features_labs':    return <FeaturesLabsSettings />;
      case 'activity_monitor': return <ActivityMonitorSettings />;
      case 'desktop_app':      return <DesktopAppSettings />;
      case 'about':            return <AboutSettings />;
      case 'billing':          return <BillingSettings />;
      case 'developer':        return <DeveloperSettings />;
      default:                 return <div className="text-[var(--pulse-ink-3)]">Section under construction.</div>;
    }
  };

  // Mobile Header
  const MobileHeader = () => (
    <div className="md:hidden flex items-center justify-between p-4 bg-[var(--pulse-canvas)] border-b border-[var(--pulse-border)]">
      {!isMobileMenuOpen && (
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex items-center gap-2 text-[var(--pulse-ink-2)] hover:text-[var(--pulse-ink)] transition"
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
        className="ml-auto w-10 h-10 rounded-lg bg-[var(--pulse-surface)] flex items-center justify-center text-[var(--pulse-ink-2)] hover:bg-[var(--pulse-surface-raised)] transition"
        aria-label="Close settings"
      >
        <X className="text-lg" />
      </button>
    </div>
  );

  return (
    <div data-settings className="h-full bg-[var(--pulse-canvas)] flex flex-col">
      <MobileHeader />

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-zinc-950/70 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Settings Sidebar */}
        <div className={`
          fixed md:relative z-50 md:z-auto
          w-full md:w-64 h-full
          bg-[var(--pulse-canvas)]
          border-r border-[var(--pulse-border)]
          p-4 flex flex-col
          transform transition-transform duration-300 ease-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          shadow-2xl md:shadow-none
        `}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--pulse-ink)] px-2">
              Settings
            </h2>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden w-8 h-8 rounded-lg hover:bg-[var(--pulse-surface-raised)] flex items-center justify-center text-[var(--pulse-ink-3)] transition"
              aria-label="Close menu"
            >
              <X />
            </button>
          </div>

          {/* Search bar */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--pulse-ink-3)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings"
              className="w-full pl-8 pr-12 py-2 rounded-lg border border-[var(--pulse-border)] bg-[var(--pulse-surface)] text-sm text-[var(--pulse-ink)] placeholder-[var(--pulse-ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--pulse-rose)]"
              aria-label="Search settings"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--pulse-ink-3)] hover:text-[var(--pulse-ink)]"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd
                aria-hidden="true"
                className="hidden md:inline-flex items-center absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-[var(--pulse-border)] text-[10px] text-[var(--pulse-ink-3)] bg-[var(--pulse-surface)]"
                style={{ fontFamily: 'var(--pulse-font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)' }}
              >
                /
              </kbd>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto -mx-1 px-1">
            {filteredSections === null ? (
              <div className="space-y-6">
                {groupedSections.map((group) => (
                  <div key={group.label}>
                    <div
                      className="px-3 mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--pulse-ink-3)]"
                      style={{ fontFamily: 'var(--pulse-font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)' }}
                    >
                      {group.label}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map(renderNavButton)}
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredSections.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-[var(--pulse-ink-3)]">
                No settings matching <em>"{searchQuery}"</em>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredSections.map(renderNavButton)}
              </div>
            )}
          </nav>
        </div>

        {/* Main Settings Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative bg-[var(--pulse-canvas)]">
          <div className="max-w-2xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
