/**
 * MessagesLayout Component
 *
 * Main layout container that integrates the SidebarTabs with MessagesSplitView.
 * Implements the sidebar (320px expanded / 60px collapsed) + messages split-view pattern.
 *
 * Layout Structure:
 * +------------------+----------------------------------------+
 * |    Sidebar       |           Messages Split-View          |
 * |  (320px/60px)    |    Thread List (30%) | Conversation    |
 * |                  |                      |     (70%)        |
 * |  [Tabs]          |                      |                  |
 * |  - Messages      |                      |                  |
 * |  - Tools         |                      |                  |
 * |  - CRM           |                      |                  |
 * |  - Analytics     |                      |                  |
 * |                  |                      |                  |
 * |  [Content]       |                      |                  |
 * +------------------+----------------------------------------+
 *
 * @module MessagesLayout
 */

import React, { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SidebarTabs, SidebarTabType } from '../Sidebar/SidebarTabs';
import MessagesSplitView from '../Messages/MessagesSplitView';
import { MessageChannel, ChannelMessage } from '../../types/messages';
import './messagesLayout.css';

// =============================================================================
// Types & Interfaces
// =============================================================================

interface MessagesLayoutProps {
  /** Message channels/threads for the split-view */
  channels: MessageChannel[];
  /** Messages organized by channel ID */
  messages: Record<string, ChannelMessage[]>;
  /** Current user ID for message ownership */
  currentUserId: string;
  /** Callback when a message is sent */
  onSendMessage?: (channelId: string, content: string) => void;
  /** Callback when a reaction is added */
  onAddReaction?: (messageId: string, emoji: string) => void;
  /** Callback to load messages for a channel */
  onLoadMessages?: (channelId: string) => Promise<void>;
  /** Callback when a tool is selected from ToolsPanel */
  onToolSelect?: (toolId: string) => void;
  /** Loading state for messages */
  isLoading?: boolean;
  /** Initial sidebar tab to display */
  defaultTab?: SidebarTabType;
  /** Initial sidebar collapsed state */
  defaultCollapsed?: boolean;
  /** Additional CSS class names */
  className?: string;
}

interface LayoutState {
  sidebarCollapsed: boolean;
  activeTab: SidebarTabType;
  isMobile: boolean;
  mobileSheetOpen: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Sidebar width in expanded state */
const SIDEBAR_WIDTH_EXPANDED = 320;

/** Sidebar width in collapsed state */
const SIDEBAR_WIDTH_COLLAPSED = 60;

/** Mobile breakpoint */
const MOBILE_BREAKPOINT = 768;

/** Animation configuration */
const TRANSITION_CONFIG = {
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1] as const
};

// =============================================================================
// Main Component
// =============================================================================

export const MessagesLayout: React.FC<MessagesLayoutProps> = ({
  channels,
  messages,
  currentUserId,
  onSendMessage,
  onAddReaction,
  onLoadMessages,
  onToolSelect,
  isLoading = false,
  defaultTab = 'messages',
  defaultCollapsed = false,
  className = ''
}) => {
  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  const [state, setState] = useState<LayoutState>({
    sidebarCollapsed: defaultCollapsed,
    activeTab: defaultTab,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false,
    mobileSheetOpen: false
  });

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  const handleSidebarCollapse = useCallback((collapsed: boolean) => {
    setState(prev => ({ ...prev, sidebarCollapsed: collapsed }));
  }, []);

  const handleTabChange = useCallback((tab: SidebarTabType) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  const handleToolSelect = useCallback((toolId: string) => {
    // When a tool is selected, optionally switch back to messages tab
    // and trigger the parent's tool selection handler
    onToolSelect?.(toolId);

    // Optionally auto-switch to messages after tool selection
    // Uncomment if desired behavior:
    // setState(prev => ({ ...prev, activeTab: 'messages' }));
  }, [onToolSelect]);

  const handleMobileSheetToggle = useCallback((open: boolean) => {
    setState(prev => ({ ...prev, mobileSheetOpen: open }));
  }, []);

  // ---------------------------------------------------------------------------
  // Responsive Handling
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      setState(prev => ({
        ...prev,
        isMobile,
        // Auto-collapse sidebar on mobile
        sidebarCollapsed: isMobile ? true : prev.sidebarCollapsed
      }));
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  const sidebarWidth = state.sidebarCollapsed
    ? SIDEBAR_WIDTH_COLLAPSED
    : SIDEBAR_WIDTH_EXPANDED;

  // ---------------------------------------------------------------------------
  // Render - Mobile Layout
  // ---------------------------------------------------------------------------

  if (state.isMobile) {
    return (
      <div className={`messages-layout messages-layout--mobile ${className}`}>
        {/* Main Content Area */}
        <main className="messages-layout__main messages-layout__main--mobile">
          <MessagesSplitView
            channels={channels}
            messages={messages}
            currentUserId={currentUserId}
            onSendMessage={onSendMessage}
            onAddReaction={onAddReaction}
            onLoadMessages={onLoadMessages}
            isLoading={isLoading}
          />
        </main>

        {/* Mobile Bottom Tab Bar */}
        <MobileTabBar
          activeTab={state.activeTab}
          onTabChange={handleTabChange}
          onOpenSheet={() => handleMobileSheetToggle(true)}
        />

        {/* Mobile Bottom Sheet for non-messages tabs */}
        <AnimatePresence>
          {state.mobileSheetOpen && state.activeTab !== 'messages' && (
            <MobileBottomSheet
              activeTab={state.activeTab}
              onClose={() => handleMobileSheetToggle(false)}
              onToolSelect={handleToolSelect}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render - Desktop Layout
  // ---------------------------------------------------------------------------

  return (
    <div className={`messages-layout messages-layout--desktop ${className}`}>
      {/* Sidebar */}
      <motion.aside
        className="messages-layout__sidebar"
        initial={false}
        animate={{
          width: sidebarWidth,
          transition: TRANSITION_CONFIG
        }}
        data-collapsed={state.sidebarCollapsed}
      >
        <SidebarTabs
          defaultTab={state.activeTab}
          onTabChange={handleTabChange}
          onToolSelect={handleToolSelect}
        />
      </motion.aside>

      {/* Main Content Area */}
      <main
        className="messages-layout__main"
        style={{
          // CSS custom property for dynamic margin
          '--sidebar-width': `${sidebarWidth}px`
        } as React.CSSProperties}
      >
        {/* Show Messages Split-View when on Messages tab or when sidebar is showing other content */}
        <MessagesSplitView
          channels={channels}
          messages={messages}
          currentUserId={currentUserId}
          onSendMessage={onSendMessage}
          onAddReaction={onAddReaction}
          onLoadMessages={onLoadMessages}
          isLoading={isLoading}
        />
      </main>
    </div>
  );
};

// =============================================================================
// Mobile Tab Bar Component
// =============================================================================

interface MobileTabBarProps {
  activeTab: SidebarTabType;
  onTabChange: (tab: SidebarTabType) => void;
  onOpenSheet: () => void;
}

const MOBILE_TAB_CONFIG: Array<{
  id: SidebarTabType;
  icon: string;
  label: string;
  color: string;
}> = [
  { id: 'messages', icon: 'fa-solid fa-messages', label: 'Messages', color: 'blue' },
  { id: 'tools', icon: 'fa-solid fa-wrench', label: 'Tools', color: 'purple' },
  { id: 'crm', icon: 'fa-solid fa-users', label: 'CRM', color: 'green' },
  { id: 'analytics', icon: 'fa-solid fa-chart-line', label: 'Analytics', color: 'orange' }
];

const MobileTabBar: React.FC<MobileTabBarProps> = ({
  activeTab,
  onTabChange,
  onOpenSheet
}) => {
  const handleTabClick = (tab: SidebarTabType) => {
    onTabChange(tab);
    if (tab !== 'messages') {
      onOpenSheet();
    }
  };

  return (
    <nav className="mobile-tab-bar" role="tablist" aria-label="Main navigation">
      {MOBILE_TAB_CONFIG.map(tab => (
        <button
          key={tab.id}
          className={`mobile-tab-bar__tab ${activeTab === tab.id ? 'mobile-tab-bar__tab--active' : ''}`}
          onClick={() => handleTabClick(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          data-color={tab.color}
        >
          <i className={`mobile-tab-bar__icon ${tab.icon}`} />
          <span className="mobile-tab-bar__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

// =============================================================================
// Mobile Bottom Sheet Component
// =============================================================================

interface MobileBottomSheetProps {
  activeTab: SidebarTabType;
  onClose: () => void;
  onToolSelect: (toolId: string) => void;
}

const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  activeTab,
  onClose,
  onToolSelect
}) => {
  // Drag gesture state
  const [dragY, setDragY] = useState(0);
  const DRAG_THRESHOLD = 100;

  const handleDragEnd = () => {
    if (dragY > DRAG_THRESHOLD) {
      onClose();
    }
    setDragY(0);
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="mobile-bottom-sheet__backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="mobile-bottom-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={TRANSITION_CONFIG}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.1, bottom: 0.3 }}
        onDrag={(_, info) => setDragY(info.offset.y)}
        onDragEnd={handleDragEnd}
        role="dialog"
        aria-modal="true"
        aria-label={`${activeTab} panel`}
      >
        {/* Drag Handle */}
        <div className="mobile-bottom-sheet__handle">
          <div className="mobile-bottom-sheet__handle-bar" />
        </div>

        {/* Sheet Header */}
        <header className="mobile-bottom-sheet__header">
          <h2 className="mobile-bottom-sheet__title">
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
          </h2>
          <button
            className="mobile-bottom-sheet__close"
            onClick={onClose}
            aria-label="Close panel"
          >
            <i className="fa-solid fa-times" />
          </button>
        </header>

        {/* Sheet Content */}
        <div className="mobile-bottom-sheet__content">
          {/* Content rendered based on active tab */}
          {activeTab === 'tools' && (
            <div className="mobile-bottom-sheet__tools">
              {/* ToolsPanel will be rendered here via SidebarContent */}
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
                Tools panel content
              </p>
            </div>
          )}
          {activeTab === 'crm' && (
            <div className="mobile-bottom-sheet__crm">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
                CRM panel content
              </p>
            </div>
          )}
          {activeTab === 'analytics' && (
            <div className="mobile-bottom-sheet__analytics">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
                Analytics panel content
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

// =============================================================================
// Export
// =============================================================================

export default MessagesLayout;
