/**
 * SidebarTabs Component
 * Main container for the sidebar navigation with tabs for Messages, Tools, CRM, and Analytics
 * Implements keyboard shortcuts (Cmd+B), localStorage persistence, and smooth animations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SidebarTab } from './SidebarTab';
import { SidebarContent } from './SidebarContent';
import './sidebarTabs.css';

export type SidebarTabType = 'messages' | 'tools' | 'crm' | 'analytics';

interface SidebarTabsProps {
  defaultTab?: SidebarTabType;
  onTabChange?: (tab: SidebarTabType) => void;
  onToolSelect?: (toolId: string) => void;
  className?: string;
  isMobile?: boolean;
}

interface TabConfig {
  id: SidebarTabType;
  label: string;
  icon: string;
  color: string;
  badge?: number;
  description: string;
}

const TABS: TabConfig[] = [
  {
    id: 'messages',
    label: 'Messages',
    icon: 'fa-solid fa-messages',
    color: 'blue',
    description: 'View all conversations and threads'
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: 'fa-solid fa-wrench',
    color: 'purple',
    description: 'Access productivity and AI tools'
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: 'fa-solid fa-users',
    color: 'green',
    description: 'Manage contacts and relationships'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'fa-solid fa-chart-line',
    color: 'orange',
    description: 'View insights and performance metrics'
  }
];

const STORAGE_KEY = 'pulse-sidebar-last-tab';

export const SidebarTabs: React.FC<SidebarTabsProps> = ({
  defaultTab = 'messages',
  onTabChange,
  onToolSelect,
  className = '',
  isMobile = false
}) => {
  // State management
  const [activeTab, setActiveTab] = useState<SidebarTabType>(defaultTab);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Set<SidebarTabType>>(new Set([defaultTab]));

  // Load last active tab from localStorage on mount
  useEffect(() => {
    const savedTab = localStorage.getItem(STORAGE_KEY) as SidebarTabType | null;
    if (savedTab && TABS.some(t => t.id === savedTab)) {
      setActiveTab(savedTab);
      setLoadedTabs(prev => new Set([...prev, savedTab]));
    }
  }, []);

  // Handle tab switch with lazy loading
  const handleTabSwitch = useCallback((tab: SidebarTabType) => {
    // Update active tab
    setActiveTab(tab);

    // Mark tab as loaded for lazy content loading
    if (!loadedTabs.has(tab)) {
      setLoadedTabs(prev => new Set([...prev, tab]));
    }

    // Persist to localStorage
    localStorage.setItem(STORAGE_KEY, tab);

    // Notify parent component
    onTabChange?.(tab);

    // Analytics tracking (optional)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'sidebar_tab_switch', {
        event_category: 'navigation',
        event_label: tab
      });
    }
  }, [loadedTabs, onTabChange]);

  // Keyboard shortcuts - Cmd+B (Mac) or Ctrl+B (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+B / Ctrl+B - Toggle sidebar collapse
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setIsCollapsed(prev => !prev);
      }

      // Cmd+1/2/3/4 - Quick tab switching
      if ((e.metaKey || e.ctrlKey) && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        if (TABS[tabIndex]) {
          handleTabSwitch(TABS[tabIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTabSwitch]);

  // Mobile touch gestures (swipe to collapse)
  useEffect(() => {
    if (!isMobile) return;

    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;

      // Swipe left to collapse (horizontal swipe > vertical swipe)
      if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX < -50) {
        setIsCollapsed(true);
      }
      // Swipe right to expand
      if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 50 && isCollapsed) {
        setIsCollapsed(false);
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, isCollapsed]);

  // Render mobile bottom sheet on small screens
  if (isMobile) {
    return (
      <div className={`sidebar-mobile ${className}`}>
        {/* Mobile Tab Bar */}
        <div className="sidebar-mobile-tabs">
          {TABS.map(tab => (
            <SidebarTab
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={() => handleTabSwitch(tab.id)}
              isMobile
            />
          ))}
        </div>

        {/* Mobile Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="sidebar-mobile-content"
          >
            <SidebarContent
              activeTab={activeTab}
              isLoaded={loadedTabs.has(activeTab)}
              onToolSelect={onToolSelect}
              isMobile
            />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // Desktop sidebar layout
  return (
    <motion.aside
      initial={false}
      animate={{
        width: isCollapsed ? 60 : 320,
        transition: {
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1]
        }
      }}
      className={`sidebar-container ${isCollapsed ? 'sidebar-collapsed' : ''} ${className}`}
      role="complementary"
      aria-label="Sidebar navigation"
    >
      {/* Collapse Toggle Button */}
      <motion.button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="sidebar-collapse-btn"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={isCollapsed ? 'Expand (Cmd+B)' : 'Collapse (Cmd+B)'}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <i className={`fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`} />
      </motion.button>

      {/* Tab Navigation */}
      <div className="sidebar-tabs" role="tablist" aria-label="Sidebar tabs">
        {TABS.map((tab, index) => (
          <SidebarTab
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            isCollapsed={isCollapsed}
            onClick={() => handleTabSwitch(tab.id)}
            shortcut={`Cmd+${index + 1}`}
          />
        ))}
      </div>

      {/* Content Area with Slide Animation */}
      <div className="sidebar-content-wrapper">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{
                duration: 0.25,
                ease: [0.4, 0, 0.2, 1]
              }}
              className="sidebar-content"
            >
              <SidebarContent
                activeTab={activeTab}
                isLoaded={loadedTabs.has(activeTab)}
                onToolSelect={onToolSelect}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard Shortcuts Hint */}
      {!isCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="sidebar-keyboard-hint"
        >
          <div className="sidebar-keyboard-hint-item">
            <kbd>Cmd</kbd> + <kbd>B</kbd>
            <span>Toggle</span>
          </div>
          <div className="sidebar-keyboard-hint-item">
            <kbd>Cmd</kbd> + <kbd>1-4</kbd>
            <span>Switch tabs</span>
          </div>
        </motion.div>
      )}
    </motion.aside>
  );
};
