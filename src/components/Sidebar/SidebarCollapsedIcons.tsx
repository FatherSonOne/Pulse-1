/**
 * SidebarCollapsedIcons Component
 *
 * Compact icon-only navigation for the collapsed sidebar state (60px wide).
 * Features:
 * - Icon-only buttons for each tab
 * - Tooltip on hover showing tab name
 * - Active tab indicator
 * - Badge support for notifications
 * - Keyboard accessible
 *
 * @module SidebarCollapsedIcons
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SidebarTabType } from './SidebarTabs';
import './sidebarCollapsedIcons.css';

// =============================================================================
// Types
// =============================================================================

interface TabIconConfig {
  id: SidebarTabType;
  icon: string;
  label: string;
  description: string;
  color: string;
  colorClass: {
    bg: string;
    text: string;
    hover: string;
    active: string;
  };
}

interface SidebarCollapsedIconsProps {
  activeTab: SidebarTabType;
  onTabChange: (tab: SidebarTabType) => void;
  badges?: Partial<Record<SidebarTabType, number>>;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const TAB_ICONS: TabIconConfig[] = [
  {
    id: 'messages',
    icon: 'fa-solid fa-messages',
    label: 'Messages',
    description: 'View conversations',
    color: 'blue',
    colorClass: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-600 dark:text-blue-400',
      hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
      active: 'bg-blue-100 dark:bg-blue-900/40'
    }
  },
  {
    id: 'tools',
    icon: 'fa-solid fa-wrench',
    label: 'Tools',
    description: 'AI & productivity tools',
    color: 'purple',
    colorClass: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      text: 'text-purple-600 dark:text-purple-400',
      hover: 'hover:bg-purple-100 dark:hover:bg-purple-900/30',
      active: 'bg-purple-100 dark:bg-purple-900/40'
    }
  },
  {
    id: 'crm',
    icon: 'fa-solid fa-users',
    label: 'CRM',
    description: 'Manage contacts',
    color: 'green',
    colorClass: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-600 dark:text-green-400',
      hover: 'hover:bg-green-100 dark:hover:bg-green-900/30',
      active: 'bg-green-100 dark:bg-green-900/40'
    }
  },
  {
    id: 'analytics',
    icon: 'fa-solid fa-chart-line',
    label: 'Analytics',
    description: 'View insights',
    color: 'orange',
    colorClass: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      text: 'text-orange-600 dark:text-orange-400',
      hover: 'hover:bg-orange-100 dark:hover:bg-orange-900/30',
      active: 'bg-orange-100 dark:bg-orange-900/40'
    }
  }
];

// Animation variants
const tooltipVariants = {
  hidden: {
    opacity: 0,
    x: -8,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.15,
      ease: 'easeOut'
    }
  },
  exit: {
    opacity: 0,
    x: -8,
    scale: 0.95,
    transition: {
      duration: 0.1
    }
  }
};

const badgeVariants = {
  initial: { scale: 0 },
  animate: {
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 25
    }
  }
};

// =============================================================================
// Component
// =============================================================================

export const SidebarCollapsedIcons: React.FC<SidebarCollapsedIconsProps> = ({
  activeTab,
  onTabChange,
  badges = {},
  className = ''
}) => {
  const [hoveredTab, setHoveredTab] = useState<SidebarTabType | null>(null);

  return (
    <nav
      className={`sidebar-collapsed-icons ${className}`}
      role="tablist"
      aria-label="Sidebar navigation"
    >
      {TAB_ICONS.map((tab, index) => {
        const isActive = activeTab === tab.id;
        const badge = badges[tab.id];
        const isHovered = hoveredTab === tab.id;

        return (
          <div
            key={tab.id}
            className="sidebar-collapsed-icon-wrapper"
            onMouseEnter={() => setHoveredTab(tab.id)}
            onMouseLeave={() => setHoveredTab(null)}
          >
            {/* Icon Button */}
            <motion.button
              onClick={() => onTabChange(tab.id)}
              className={`
                sidebar-collapsed-icon
                ${isActive ? 'sidebar-collapsed-icon--active' : ''}
                ${tab.colorClass.hover}
                ${isActive ? tab.colorClass.active : ''}
              `}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              aria-label={tab.label}
              tabIndex={0}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Active Indicator Line */}
              {isActive && (
                <motion.div
                  className="sidebar-collapsed-icon__indicator"
                  layoutId="collapsedActiveIndicator"
                  style={{ backgroundColor: `var(--color-${tab.color}-500, #3b82f6)` }}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30
                  }}
                />
              )}

              {/* Icon */}
              <i
                className={`
                  ${tab.icon}
                  sidebar-collapsed-icon__icon
                  ${isActive ? tab.colorClass.text : 'text-zinc-500 dark:text-zinc-400'}
                `}
              />

              {/* Badge */}
              {badge && badge > 0 && (
                <motion.span
                  className={`sidebar-collapsed-icon__badge ${tab.colorClass.bg} ${tab.colorClass.text}`}
                  variants={badgeVariants}
                  initial="initial"
                  animate="animate"
                >
                  {badge > 99 ? '99+' : badge}
                </motion.span>
              )}
            </motion.button>

            {/* Tooltip */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  className="sidebar-collapsed-tooltip"
                  variants={tooltipVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  role="tooltip"
                >
                  <div className="sidebar-collapsed-tooltip__content">
                    <span className="sidebar-collapsed-tooltip__label">
                      {tab.label}
                    </span>
                    <kbd className="sidebar-collapsed-tooltip__shortcut">
                      {'\u2318'}{index + 1}
                    </kbd>
                  </div>
                  <p className="sidebar-collapsed-tooltip__description">
                    {tab.description}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
};

export default SidebarCollapsedIcons;
