import React from 'react';
import { AppView, User } from '../../types';
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
  color: 'rose' | 'cyan' | 'violet' | 'amber' | 'red';
  items: NavItemConfig[];
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
      color: 'cyan',
      items: [
        { icon: 'fa-comment-dots', label: 'Messages', view: AppView.MESSAGES },
        { icon: 'fa-envelope-open-text', label: 'Email', view: AppView.EMAIL },
        { icon: 'fa-walkie-talkie', label: 'Voxer', view: AppView.VOXER },
      ],
    },
    {
      label: 'Work & People',
      color: 'violet',
      items: [
        { icon: 'fa-calendar-days', label: 'Calendar', view: AppView.CALENDAR },
        { icon: 'fa-video', label: 'Meetings', view: AppView.MEETINGS },
        { icon: 'fa-user-group', label: 'Contacts', view: AppView.CONTACTS },
      ],
    },
    {
      label: 'Intelligence',
      color: 'amber',
      items: [
        { icon: 'fa-book-open', label: 'War Room', view: AppView.LIVE_AI },
        { icon: 'fa-comments', label: 'Pulse Chat', view: AppView.LIVE },
        { icon: 'fa-search', label: 'Search', view: AppView.MULTI_MODAL },
        { icon: 'fa-flask', label: 'AI Lab', view: AppView.TOOLS },
        { icon: 'fa-chart-line', label: 'Analytics', view: AppView.ANALYTICS },
        { icon: 'fa-box-archive', label: 'Archives', view: AppView.ARCHIVES },
      ],
    },
  ];

  if (isAdmin) {
    sections.push({
      label: 'Admin',
      color: 'red',
      items: [
        { icon: 'fa-shield-halved', label: 'Admin', view: AppView.MESSAGE_ADMIN },
        { icon: 'fa-clipboard-check', label: 'Test Matrix', view: AppView.TEST_MATRIX },
      ],
    });
  }

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
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  label,
  color,
  isCollapsed,
}) => {
  if (isCollapsed) return null;

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
}) => {
  const isAdmin = user?.role === 'admin' || user?.isAdmin || false;
  const navSections = getNavSections(isAdmin);

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

          <div className="sidebar-brand-controls">
            {!isCollapsed && renderNotificationCenter?.()}
            <button
              className="sidebar-collapse-btn hidden md:flex"
              onClick={isCollapsed ? onExpand : onCollapse}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <i className={`fa-solid ${isCollapsed ? 'fa-bars-staggered' : 'fa-chevron-left'} text-sm`} />
            </button>
          </div>
        </div>

        {/* Collapsed state notification center */}
        {isCollapsed && (
          <div className="hidden md:flex justify-center px-3 pb-2">
            {renderNotificationCenter?.()}
          </div>
        )}

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navSections.map((section, sectionIdx) => (
            <React.Fragment key={section.label}>
              <SectionHeader
                label={section.label}
                color={section.color}
                isCollapsed={isCollapsed}
              />
              {section.items.map((item, itemIdx) => (
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
          ))}
        </nav>

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
