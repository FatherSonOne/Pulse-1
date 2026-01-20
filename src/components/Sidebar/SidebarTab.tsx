/**
 * SidebarTab Component
 * Individual tab button for sidebar navigation
 * Supports active states, badges, tooltips, and keyboard shortcuts
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  color: string;
  badge?: number;
  description: string;
}

interface SidebarTabProps {
  tab: TabConfig;
  isActive: boolean;
  isCollapsed?: boolean;
  onClick: () => void;
  shortcut?: string;
  isMobile?: boolean;
}

const colorClasses: Record<string, { bg: string; text: string; border: string; hover: string }> = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500',
    hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30'
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500',
    hover: 'hover:bg-purple-100 dark:hover:bg-purple-900/30'
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-500',
    hover: 'hover:bg-green-100 dark:hover:bg-green-900/30'
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500',
    hover: 'hover:bg-orange-100 dark:hover:bg-orange-900/30'
  }
};

export const SidebarTab: React.FC<SidebarTabProps> = ({
  tab,
  isActive,
  isCollapsed = false,
  onClick,
  shortcut,
  isMobile = false
}) => {
  const colors = colorClasses[tab.color] || colorClasses.blue;

  // Mobile tab rendering
  if (isMobile) {
    return (
      <motion.button
        onClick={onClick}
        className={`
          sidebar-tab-mobile
          ${isActive ? 'sidebar-tab-mobile-active' : ''}
        `}
        whileTap={{ scale: 0.95 }}
        role="tab"
        aria-selected={isActive}
        aria-controls={`tabpanel-${tab.id}`}
        id={`tab-${tab.id}`}
      >
        <div className="sidebar-tab-mobile-content">
          <i className={`${tab.icon} ${isActive ? colors.text : 'text-zinc-500'}`} />
          {tab.badge && tab.badge > 0 && (
            <span className="sidebar-tab-badge">{tab.badge}</span>
          )}
        </div>
        <span className={`sidebar-tab-mobile-label ${isActive ? colors.text : 'text-zinc-600 dark:text-zinc-400'}`}>
          {tab.label}
        </span>
      </motion.button>
    );
  }

  // Desktop tab rendering
  return (
    <motion.button
      onClick={onClick}
      className={`
        sidebar-tab
        ${isActive ? 'sidebar-tab-active' : ''}
        ${isCollapsed ? 'sidebar-tab-collapsed' : ''}
      `}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.98 }}
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${tab.id}`}
      id={`tab-${tab.id}`}
      title={isCollapsed ? tab.label : undefined}
    >
      {/* Active Indicator */}
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className={`sidebar-tab-indicator ${colors.border}`}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30
          }}
        />
      )}

      {/* Icon */}
      <div className={`sidebar-tab-icon ${isActive ? colors.text : 'text-zinc-500 dark:text-zinc-400'}`}>
        <i className={tab.icon} />
        {tab.badge && tab.badge > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`sidebar-tab-badge ${colors.bg} ${colors.text}`}
          >
            {tab.badge > 99 ? '99+' : tab.badge}
          </motion.span>
        )}
      </div>

      {/* Label and Description (hidden when collapsed) */}
      {!isCollapsed && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="sidebar-tab-content"
        >
          <div className="sidebar-tab-label-wrapper">
            <span className={`sidebar-tab-label ${isActive ? 'text-zinc-900 dark:text-white font-semibold' : 'text-zinc-700 dark:text-zinc-300'}`}>
              {tab.label}
            </span>
            {shortcut && (
              <kbd className="sidebar-tab-shortcut">
                {shortcut.replace('Cmd', '⌘')}
              </kbd>
            )}
          </div>
          <p className="sidebar-tab-description">
            {tab.description}
          </p>
        </motion.div>
      )}

      {/* Hover Tooltip (only when collapsed) */}
      {isCollapsed && (
        <div className="sidebar-tab-tooltip">
          <div className="sidebar-tab-tooltip-content">
            <span className="sidebar-tab-tooltip-label">{tab.label}</span>
            {shortcut && (
              <kbd className="sidebar-tab-tooltip-shortcut">
                {shortcut.replace('Cmd', '⌘')}
              </kbd>
            )}
          </div>
          <p className="sidebar-tab-tooltip-description">{tab.description}</p>
        </div>
      )}
    </motion.button>
  );
};
