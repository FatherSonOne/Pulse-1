import React, { useState } from 'react';
import { AppView, User } from '../../types';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { PulseAssistantButton } from '../PulseAssistant/PulseAssistantButton';
import './Sidebar.css';

// ============================================
// TYPES
// ============================================

interface NavItemConfig {
  icon: string;
  label: string;
  view: AppView;
}

interface NavSection {
  label: string;
  color: 'rose' | 'pink' | 'coral' | 'rose-light' | 'red' | 'amber';
  items: NavItemConfig[];
  collapsible?: boolean;
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

const getNavSections = (isAdmin: boolean): NavSection[] => {
  const sections: NavSection[] = [
    {
      label: 'Overview',
      color: 'rose',
      items: [
        { icon: 'fa-layer-group', label: 'Dashboard', view: AppView.DASHBOARD },
      ],
    },
    {
      label: 'Communication',
      color: 'pink',
      items: [
        { icon: 'fa-comment-dots', label: 'Messages', view: AppView.MESSAGES },
        { icon: 'fa-envelope-open-text', label: 'Email', view: AppView.EMAIL },
        { icon: 'fa-walkie-talkie', label: 'Voxer', view: AppView.VOXER },
      ],
    },
    {
      label: 'Work & People',
      color: 'coral',
      items: [
        { icon: 'fa-calendar-days', label: 'Calendar', view: AppView.CALENDAR },
        { icon: 'fa-video', label: 'Meetings', view: AppView.MEETINGS },
        { icon: 'fa-user-group', label: 'Contacts', view: AppView.CONTACTS },
        { icon: 'fa-list-check', label: 'Decisions & Tasks', view: AppView.DECISIONS_TASKS },
      ],
    },
    {
      label: 'Intelligence',
      color: 'rose-light',
      items: [
        { icon: 'fa-search', label: 'Search', view: AppView.MULTI_MODAL },
        { icon: 'fa-chart-line', label: 'Analytics', view: AppView.ANALYTICS },
        { icon: 'fa-box-archive', label: 'Archives', view: AppView.ARCHIVES },
        { icon: 'fa-book-open', label: 'User Guide', view: AppView.USERS_GUIDE },
      ],
    },
    {
      label: 'Experimental',
      color: 'amber',
      collapsible: true,
      items: [
        { icon: 'fa-book-open', label: 'War Room', view: AppView.LIVE_AI },
        { icon: 'fa-comments', label: 'Pulse Chat', view: AppView.LIVE },
        { icon: 'fa-flask', label: 'AI Lab', view: AppView.TOOLS },
      ],
    },
  ];

  sections.push({
    label: 'Admin',
    color: 'red',
    collapsible: true,
    items: [
      { icon: 'fa-shield-halved', label: 'Admin', view: AppView.MESSAGE_ADMIN },
      { icon: 'fa-clipboard-check', label: 'Test Matrix', view: AppView.TEST_MATRIX },
    ],
  });

  return sections;
};

// ============================================
// NAV ITEM COMPONENT
// ============================================

interface NavItemProps {
  icon: string;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({
  icon,
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
        <i className={`fa-solid ${icon}`} />
      </div>
      {!isCollapsed && (
        <>
          <span className="sidebar-nav-label">{label}</span>
          <div className="sidebar-nav-indicator" />
        </>
      )}
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
  const isAdmin = user?.role === 'admin' || user?.isAdmin || false;
  const navSections = getNavSections(isAdmin);

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
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onMobileClose}
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
                <svg viewBox="0 0 64 64" className="w-6 h-6">
                  <defs>
                    <linearGradient id="pulse-grad-sidebar" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f43f5e" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32"
                    stroke="url(#pulse-grad-sidebar)"
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
                <i className="fa-solid fa-circle-question text-base" />
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
            <i className={`fa-solid ${isCollapsed ? 'fa-bars-staggered' : 'fa-chevron-left'} text-sm`} />
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
              <i className="fa-solid fa-circle-question text-base" />
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

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Theme Toggle */}
          <button
            className="sidebar-footer-item theme-toggle"
            onClick={onToggleTheme}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <div className="sidebar-footer-icon">
              <i className={`fa-solid ${isDarkMode ? 'fa-moon' : 'fa-sun'}`}
                 style={{ color: isDarkMode ? '#a1a1aa' : '#f59e0b' }} />
            </div>
            {!isCollapsed && (
              <span className="sidebar-footer-text">
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
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
              <i className="fa-solid fa-gear" />
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
