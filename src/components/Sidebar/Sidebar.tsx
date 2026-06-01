import React, { useState } from 'react';
import { AppView, User } from '../../types';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { PulseAssistantButton } from '../PulseAssistant/PulseAssistantButton';
import './Sidebar.css';

import {
  AlertTriangle,
  Archive,
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardCheck,
  HelpCircle,
  Layers,
  Mail,
  MailOpen,
  MapPin,
  MessageCircle,
  MessageSquare,
  Moon,
  Radio,
  Search,
  Settings,
  Sun,
  Users,
  Video,
} from 'lucide-react';
import { useEntitlements } from '../../hooks/useEntitlements';

// ============================================
// TYPES
// ============================================

type LucideIcon = React.ComponentType<{ size?: number; className?: string }>;

interface NavItemConfig {
  icon: LucideIcon;
  label: string;
  view: AppView;
}

interface NavSection {
  label: string;
  color: 'rose' | 'pink' | 'coral' | 'rose-light' | 'red' | 'amber';
  items: NavItemConfig[];
  collapsible?: boolean;
  /** Small muted caption under the section header (e.g. "likely to be cut"). */
  note?: string;
}

interface SidebarProps {
  user: User | null;
  currentView: AppView;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  isDarkMode: boolean;
  onViewChange: (view: AppView) => void;
  onCollapse: () => void;
  onExpand: () => void;
  onToggleTheme: () => void;
  onMobileClose: () => void;
  onLogoClick: () => void;
  renderNotificationCenter?: () => React.ReactNode;
  renderUserProfile?: () => React.ReactNode;
  renderVoiceLogo?: (collapsed: boolean) => React.ReactNode;
  onTogglePulseAI?: () => void;
  showPulseAI?: boolean;
  hasProactiveSuggestion?: boolean;
}

// ============================================
// NAVIGATION CONFIG
// ============================================

const getNavSections = (): NavSection[] => {
  const sections: NavSection[] = [
    {
      label: 'Overview',
      color: 'rose',
      items: [
        { icon: Layers, label: 'Dashboard', view: AppView.DASHBOARD },
      ],
    },
    {
      label: 'Communication',
      color: 'pink',
      items: [
        { icon: MessageCircle, label: 'Messages', view: AppView.MESSAGES },
        { icon: Mail, label: 'Email', view: AppView.EMAIL },
        { icon: Radio, label: 'Relay', view: AppView.RELAY },
        { icon: Video, label: 'Glimpse', view: AppView.GLIMPSE },
      ],
    },
    {
      label: 'Work & People',
      color: 'coral',
      items: [
        { icon: Calendar, label: 'Calendar', view: AppView.CALENDAR },
        { icon: Video, label: 'Meetings', view: AppView.MEETINGS },
        { icon: Users, label: 'Contacts', view: AppView.CONTACTS },
        { icon: ClipboardCheck, label: 'Decisions & Tasks', view: AppView.DECISIONS_TASKS },
      ],
    },
    {
      label: 'Intelligence',
      color: 'rose-light',
      items: [
        { icon: Search, label: 'Search', view: AppView.MULTI_MODAL },
        { icon: BarChart3, label: 'Analytics', view: AppView.ANALYTICS },
        { icon: MailOpen, label: 'Message Analytics', view: AppView.MESSAGE_ANALYTICS },
        { icon: Archive, label: 'Archives', view: AppView.ARCHIVES },
        { icon: HelpCircle, label: 'User Guide', view: AppView.USERS_GUIDE },
      ],
    },
    {
      label: 'Experimental',
      color: 'amber',
      collapsible: true,
      note: 'Not part of the core app — likely to be cut',
      items: [
        { icon: MessageSquare, label: 'Summit', view: AppView.LIVE },
        // Map stack still drives cross-section features (calendar travel
        // chips, today geo-clusters, war room team radar, decision/task
        // geofences) but the section itself is mid-refactor (cluster +
        // spiderfy layer, autopilot stubs) — sit it in Experimental
        // until the strangler refactor lands on main.
        { icon: MapPin, label: 'Map', view: AppView.MAP },
        // War Room (NotebookLM-style RAG workspace) moved here 2026-06-01:
        // functional engine but not a core lane; flagged for possible cut.
        { icon: BookOpen, label: 'War Room', view: AppView.LIVE_AI },
      ],
    },
  ];

  return sections;
};

// ============================================
// NAV ITEM COMPONENT
// ============================================

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({
  icon: Icon,
  label,
  isActive,
  isCollapsed,
  onClick,
}) => {
  return (
    <button
      className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
      title={isCollapsed ? label : undefined}
    >
      <div className="sidebar-nav-icon">
        <Icon size={16} />
      </div>
      {!isCollapsed && <span className="sidebar-nav-label">{label}</span>}
    </button>
  );
};

// ============================================
// SECTION HEADER COMPONENT
// ============================================

interface SectionHeaderProps {
  label: string;
  color: 'rose' | 'cyan' | 'violet' | 'amber' | 'red';
  isCollapsed: boolean;
  collapsible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  label,
  color,
  isCollapsed,
  collapsible = false,
  isExpanded = true,
  onToggle,
}) => {
  if (isCollapsed) return null;

  if (collapsible) {
    return (
      <button
        className="sidebar-section sidebar-section-collapsible"
        onClick={onToggle}
        type="button"
      >
        <div className={`sidebar-section-dot ${color}`} />
        <span className="sidebar-section-label">{label}</span>
        <i className={`fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} sidebar-section-chevron`} />
      </button>
    );
  }

  return (
    <div className="sidebar-section">
      <div className={`sidebar-section-dot ${color}`} />
      <span className="sidebar-section-label">{label}</span>
    </div>
  );
};

// ============================================
// MAIN SIDEBAR COMPONENT
// ============================================

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  currentView,
  isCollapsed,
  isMobileOpen,
  isDarkMode,
  onViewChange,
  onCollapse,
  onExpand,
  onToggleTheme,
  onMobileClose,
  onLogoClick,
  renderNotificationCenter,
  renderUserProfile,
  renderVoiceLogo,
  onTogglePulseAI,
  showPulseAI = false,
  hasProactiveSuggestion = false,
}) => {
  const navSections = getNavSections();
  const { isTrialing, trialDaysLeft, entitlements, isLoading: entLoading } = useEntitlements();

  // Determine if we need to show a billing alert
  const subStatus = entitlements?.is_trialing ? 'trialing' : null;
  const showBillingAlert = !entLoading && (
    (isTrialing && trialDaysLeft <= 7) ||
    (entitlements && entitlements.max_ai_messages_mo !== null &&
      (entitlements.usage?.ai_messages || 0) >= (entitlements.max_ai_messages_mo || 0) * 0.8)
  );

  // State for tracking which collapsible sections are expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Experimental': false, // Start collapsed
  });

  const toggleSection = (sectionLabel: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionLabel]: !prev[sectionLabel],
    }));
  };

  const handleNavClick = (view: AppView) => {
    onViewChange(view);
    onMobileClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="pulse-modal-scrim fixed inset-0 z-40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          pulse-sidebar
          fixed md:static inset-y-0 left-0 z-50
          ${isMobileOpen ? 'mobile-open translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'collapsed md:w-20' : 'md:w-72'}
          w-[280px] sm:w-[300px]
          safe-area-top
        `}
      >
        {/* Brand Header */}
        <div className="sidebar-brand">
          {renderVoiceLogo ? (
            renderVoiceLogo(isCollapsed)
          ) : (
            <div className="sidebar-brand-logo" onClick={onLogoClick}>
              <div className="sidebar-logo-icon">
                <svg viewBox="0 0 64 64" className="w-5 h-5" aria-hidden>
                  <path
                    d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32"
                    stroke="var(--pulse-rose)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
              {!isCollapsed && <span className="sidebar-brand-text">Pulse</span>}
            </div>
          )}

          {!isCollapsed && (
            <div className="sidebar-brand-controls">
              <button
                type="button"
                onClick={() => onViewChange(AppView.USERS_GUIDE)}
                title="User Guide"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <HelpCircle size={16} />
              </button>
              {renderNotificationCenter?.()}
            </div>
          )}
        </div>

        {/* Workspace Switcher */}
        <WorkspaceSwitcher isCollapsed={isCollapsed} />

        {/* Dedicated Collapse Button Section */}
        <div className="sidebar-collapse-section">
          <button
            className="sidebar-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (isCollapsed) {
                onExpand();
              } else {
                onCollapse();
              }
            }}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            <i className={`fa-solid ${isCollapsed ? 'fa-bars-staggered' : 'fa-chevron-left'}`} style={{ fontSize: 14 }} />
          </button>
        </div>

        {/* Collapsed state notification center + guide */}
        {isCollapsed && (
          <div className="sidebar-notification-collapsed">
            <button
              type="button"
              onClick={() => onViewChange(AppView.USERS_GUIDE)}
              title="User Guide"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <HelpCircle className="text-base" />
            </button>
            {renderNotificationCenter?.()}
          </div>
        )}

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navSections.map((section, sectionIdx) => {
            const isSectionExpanded = section.collapsible
              ? expandedSections[section.label] === true
              : true;

            return (
              <React.Fragment key={section.label}>
                <SectionHeader
                  label={section.label}
                  color={section.color}
                  isCollapsed={isCollapsed}
                  collapsible={section.collapsible}
                  isExpanded={isSectionExpanded}
                  onToggle={() => toggleSection(section.label)}
                />
                {section.note && !isCollapsed && isSectionExpanded && (
                  <div
                    style={{
                      padding: '0 16px 8px 28px',
                      marginTop: -2,
                      fontSize: 10,
                      lineHeight: 1.35,
                      fontStyle: 'italic',
                      color: 'var(--pulse-ink-3, #8a8a8a)',
                    }}
                  >
                    {section.note}
                  </div>
                )}
                {isSectionExpanded && section.items.map((item, itemIdx) => (
                  <NavItem
                    key={item.view}
                    icon={item.icon}
                    label={item.label}
                    isActive={currentView === item.view}
                    isCollapsed={isCollapsed}
                    onClick={() => handleNavClick(item.view)}
                  />
                ))}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Pulse AI Button — above footer */}
        {onTogglePulseAI && (
          <div className="sidebar-ai-section">
            <PulseAssistantButton
              onClick={onTogglePulseAI}
              isOpen={showPulseAI}
              hasProactiveSuggestion={hasProactiveSuggestion}
              collapsed={isCollapsed}
            />
          </div>
        )}

        {/* Billing Alert Banner */}
        {showBillingAlert && !isCollapsed && (
          <button
            onClick={() => {
              // Deep-link into Plan & Billing and scroll to the usage section
              // when the alert is about hitting a usage limit. Trial-ending
              // alerts open the plan page without focusing usage.
              const focus = !isTrialing ? 'usage' : 'plan';
              const params = new URLSearchParams(window.location.search);
              params.set('settings', 'billing');
              params.set('billing_focus', focus);
              window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
              handleNavClick(AppView.SETTINGS);
            }}
            className="mx-3 mb-2 p-2.5 rounded-lg text-left transition-opacity hover:opacity-90"
            style={{
              background: isTrialing ? 'var(--pulse-tone-warning-soft)' : 'var(--pulse-tone-overdue-soft)',
              border: `1px solid ${isTrialing ? 'var(--pulse-tone-warning-soft)' : 'var(--pulse-tone-overdue-soft)'}`,
            }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                size={14}
                style={{ color: isTrialing ? 'var(--pulse-tone-warning)' : 'var(--pulse-tone-overdue)', flexShrink: 0 }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: isTrialing ? 'var(--pulse-tone-warning)' : 'var(--pulse-tone-overdue)' }}
              >
                {isTrialing
                  ? `Trial ends in ${trialDaysLeft}d`
                  : 'Nearing usage limit'}
              </span>
            </div>
          </button>
        )}

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Theme Toggle */}
          <button
            className="sidebar-footer-item theme-toggle"
            onClick={onToggleTheme}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <div className="sidebar-footer-icon">
              {isDarkMode ? <Moon size={16} /> : <Sun size={16} />}
            </div>
            {!isCollapsed && (
              <span className="sidebar-footer-text">
                {isDarkMode ? 'Light mode' : 'Dark mode'}
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            className={`sidebar-footer-item settings ${currentView === AppView.SETTINGS ? 'active' : ''}`}
            onClick={() => handleNavClick(AppView.SETTINGS)}
            title="Settings"
          >
            <div className="sidebar-footer-icon">
              <Settings size={16} />
            </div>
            {!isCollapsed && (
              <span className="sidebar-footer-text">Settings</span>
            )}
          </button>

          {/* User Profile */}
          {renderUserProfile?.()}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
