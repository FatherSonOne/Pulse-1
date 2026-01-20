/**
 * SidebarContent Component
 * Content area for each sidebar tab with lazy loading support
 * Renders different content based on active tab: Messages, Tools, CRM, or Analytics
 */

import React, { Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { ToolsPanel } from '../ToolsPanel';

// Lazy load tab content components for better performance
const CRMPanel = lazy(() => import('../crm/CRMSidepanel'));
const AnalyticsPanel = lazy(() => import('../Analytics/AnalyticsDashboard'));

export type SidebarTabType = 'messages' | 'tools' | 'crm' | 'analytics';

interface SidebarContentProps {
  activeTab: SidebarTabType;
  isLoaded: boolean;
  onToolSelect?: (toolId: string) => void;
  isMobile?: boolean;
}

// Loading skeleton for lazy-loaded content
const LoadingSkeleton: React.FC = () => (
  <div className="sidebar-content-loading">
    <div className="sidebar-loading-header">
      <div className="sidebar-loading-skeleton sidebar-loading-title" />
      <div className="sidebar-loading-skeleton sidebar-loading-subtitle" />
    </div>
    <div className="sidebar-loading-body">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="sidebar-loading-card">
          <div className="sidebar-loading-skeleton sidebar-loading-card-icon" />
          <div className="sidebar-loading-card-content">
            <div className="sidebar-loading-skeleton sidebar-loading-card-title" />
            <div className="sidebar-loading-skeleton sidebar-loading-card-text" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Messages tab content (placeholder - will be actual thread list)
const MessagesContent: React.FC = () => (
  <div className="sidebar-messages-content">
    <div className="sidebar-section-header">
      <h3 className="sidebar-section-title">
        <i className="fa-solid fa-messages text-blue-500" />
        Conversations
      </h3>
      <button
        className="sidebar-icon-button"
        aria-label="New conversation"
        title="New conversation"
      >
        <i className="fa-solid fa-plus" />
      </button>
    </div>

    <div className="sidebar-search">
      <i className="fa-solid fa-search sidebar-search-icon" />
      <input
        type="text"
        placeholder="Search conversations..."
        className="sidebar-search-input"
      />
    </div>

    <div className="sidebar-messages-list">
      {/* Placeholder for thread list - will be replaced with actual thread list component */}
      <div className="sidebar-empty-state">
        <i className="fa-solid fa-inbox text-4xl text-zinc-300 dark:text-zinc-700 mb-3" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
          Thread list will be displayed here
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-2">
          This integrates with the existing Messages component
        </p>
      </div>
    </div>
  </div>
);

// CRM tab content wrapper
const CRMContent: React.FC = () => (
  <Suspense fallback={<LoadingSkeleton />}>
    <div className="sidebar-crm-content">
      <div className="sidebar-section-header">
        <h3 className="sidebar-section-title">
          <i className="fa-solid fa-users text-green-500" />
          CRM
        </h3>
        <button
          className="sidebar-icon-button"
          aria-label="CRM settings"
          title="CRM settings"
        >
          <i className="fa-solid fa-cog" />
        </button>
      </div>
      <CRMPanel />
    </div>
  </Suspense>
);

// Analytics tab content wrapper
const AnalyticsContent: React.FC = () => (
  <Suspense fallback={<LoadingSkeleton />}>
    <div className="sidebar-analytics-content">
      <div className="sidebar-section-header">
        <h3 className="sidebar-section-title">
          <i className="fa-solid fa-chart-line text-orange-500" />
          Analytics
        </h3>
        <button
          className="sidebar-icon-button"
          aria-label="Analytics settings"
          title="Analytics settings"
        >
          <i className="fa-solid fa-download" />
        </button>
      </div>
      <AnalyticsPanel />
    </div>
  </Suspense>
);

// Tools tab content wrapper
const ToolsContent: React.FC<{ onToolSelect?: (toolId: string) => void; isMobile?: boolean }> = ({
  onToolSelect,
  isMobile
}) => {
  const handleToolSelect = (toolId: string) => {
    console.log('Tool selected:', toolId);
    onToolSelect?.(toolId);

    // TODO: Implement actual tool activation logic
    // This should trigger the appropriate tool panel/modal in Messages.tsx
  };

  return (
    <ToolsPanel
      onToolSelect={handleToolSelect}
      isMobile={isMobile}
      className="sidebar-tools-panel"
    />
  );
};

export const SidebarContent: React.FC<SidebarContentProps> = ({
  activeTab,
  isLoaded,
  onToolSelect,
  isMobile = false
}) => {
  // Don't render content until tab is loaded (lazy loading optimization)
  if (!isLoaded) {
    return <LoadingSkeleton />;
  }

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'messages':
        return <MessagesContent />;

      case 'tools':
        return <ToolsContent onToolSelect={onToolSelect} isMobile={isMobile} />;

      case 'crm':
        return <CRMContent />;

      case 'analytics':
        return <AnalyticsContent />;

      default:
        return (
          <div className="sidebar-error-state">
            <i className="fa-solid fa-exclamation-triangle text-4xl text-red-400 mb-3" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Unknown tab: {activeTab}
            </p>
          </div>
        );
    }
  };

  return (
    <motion.div
      key={activeTab}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="sidebar-content-inner"
      role="tabpanel"
      id={`tabpanel-${activeTab}`}
      aria-labelledby={`tab-${activeTab}`}
    >
      {renderContent()}
    </motion.div>
  );
};
