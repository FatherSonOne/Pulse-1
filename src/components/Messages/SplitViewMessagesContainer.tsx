/**
 * SplitViewMessagesContainer - Enhanced Split-View Layout
 *
 * A comprehensive split-view container for the Pulse Messages system featuring:
 * - 30%/70% desktop split (1200px+)
 * - 25%/75% tablet split (768px-1199px)
 * - Full-width stacked mobile view (<768px)
 * - Drag-to-resize divider with visual feedback
 * - Framer Motion animations for smooth transitions
 *
 * @author UI Designer Agent
 * @version 2.0.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import ThreadListPanel from './ThreadListPanel';
import ConversationPanel from './ConversationPanel';
import { MessageChannel, ChannelMessage } from '../../types/messages';
import { useSplitViewMessages } from '../../hooks/useSplitViewMessages';

/* =========================================
   Design Token System
   ========================================= */

const DESIGN_TOKENS = {
  // Breakpoints (in pixels)
  breakpoints: {
    mobile: 768,
    tablet: 1200,
    desktop: 1200,
    largeDesktop: 1440,
  },

  // Panel Width Constraints (in pixels)
  panelConstraints: {
    threadList: {
      minWidth: 280,
      maxWidth: 480,
      defaultWidthDesktop: 30,    // percentage
      defaultWidthTablet: 25,     // percentage
    },
    conversation: {
      minWidth: 400,
    },
  },

  // Divider Settings
  divider: {
    width: 4,
    hitArea: 12,    // Extended hit area for easier grabbing
    hoverWidth: 6,
  },

  // Animation Durations (in seconds)
  animation: {
    fast: 0.15,
    normal: 0.3,
    slow: 0.5,
  },

  // Z-Index Layers
  zIndex: {
    divider: 10,
    mobileOverlay: 40,
    mobileBackButton: 50,
    keyboardHelper: 60,
  },
} as const;

/* =========================================
   Type Definitions
   ========================================= */

type ViewportSize = 'mobile' | 'tablet' | 'desktop' | 'largeDesktop';
type MobileView = 'threads' | 'conversation';

interface SplitViewMessagesContainerProps {
  /** Array of message channels/threads */
  channels: MessageChannel[];
  /** Messages organized by channel ID */
  messages: Record<string, ChannelMessage[]>;
  /** Current user's ID for message ownership */
  currentUserId: string;
  /** Callback when a message is sent */
  onSendMessage?: (channelId: string, content: string) => void;
  /** Callback when a reaction is added */
  onAddReaction?: (messageId: string, emoji: string) => void;
  /** Callback to load messages for a channel */
  onLoadMessages?: (channelId: string) => Promise<void>;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Custom message input renderer */
  renderMessageInput?: () => React.ReactNode;
  /** Custom message bubble renderer */
  renderMessageBubble?: (message: ChannelMessage) => React.ReactNode;
  /** Enable the drag-to-resize divider */
  enableResizing?: boolean;
  /** Persist panel width to localStorage */
  persistPanelWidth?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface ResizeDividerProps {
  isResizing: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPanStart: () => void;
  onPan: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
  onPanEnd: () => void;
}

/* =========================================
   Animation Variants
   ========================================= */

const threadListVariants = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: DESIGN_TOKENS.animation.normal,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: {
      duration: DESIGN_TOKENS.animation.fast,
      ease: [0.4, 0, 1, 1],
    },
  },
};

const conversationVariants = {
  hidden: {
    opacity: 0,
    x: 20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: DESIGN_TOKENS.animation.normal,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: DESIGN_TOKENS.animation.fast,
      ease: [0.4, 0, 1, 1],
    },
  },
};

const mobileSlideVariants = {
  threads: {
    hidden: { x: '-100%', opacity: 0 },
    visible: { x: 0, opacity: 1 },
    exit: { x: '-100%', opacity: 0 },
  },
  conversation: {
    hidden: { x: '100%', opacity: 0 },
    visible: { x: 0, opacity: 1 },
    exit: { x: '100%', opacity: 0 },
  },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/* =========================================
   Utility Functions
   ========================================= */

/**
 * Determines the current viewport size category
 */
const getViewportSize = (width: number): ViewportSize => {
  if (width < DESIGN_TOKENS.breakpoints.mobile) return 'mobile';
  if (width < DESIGN_TOKENS.breakpoints.tablet) return 'tablet';
  if (width < DESIGN_TOKENS.breakpoints.largeDesktop) return 'desktop';
  return 'largeDesktop';
};

/**
 * Gets the default panel width percentage based on viewport
 */
const getDefaultPanelWidth = (viewportSize: ViewportSize): number => {
  switch (viewportSize) {
    case 'mobile':
      return 100;
    case 'tablet':
      return DESIGN_TOKENS.panelConstraints.threadList.defaultWidthTablet;
    case 'desktop':
    case 'largeDesktop':
    default:
      return DESIGN_TOKENS.panelConstraints.threadList.defaultWidthDesktop;
  }
};

/**
 * Clamps a value between min and max
 */
const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/* =========================================
   Resize Divider Component
   ========================================= */

const ResizeDivider: React.FC<ResizeDividerProps> = ({
  isResizing,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onPanStart,
  onPan,
  onPanEnd,
}) => {
  const dividerWidth = isResizing || isHovered
    ? DESIGN_TOKENS.divider.hoverWidth
    : DESIGN_TOKENS.divider.width;

  return (
    <motion.div
      className="split-view-divider relative flex-shrink-0 cursor-col-resize select-none"
      style={{
        width: DESIGN_TOKENS.divider.hitArea,
        zIndex: DESIGN_TOKENS.zIndex.divider,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0}
      dragMomentum={false}
      onDragStart={onPanStart}
      onDrag={onPan}
      onDragEnd={onPanEnd}
    >
      {/* Visual divider line */}
      <motion.div
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 rounded-full"
        initial={{ width: DESIGN_TOKENS.divider.width }}
        animate={{
          width: dividerWidth,
          backgroundColor: isResizing
            ? 'rgb(59, 130, 246)'
            : isHovered
              ? 'rgb(147, 197, 253)'
              : 'rgb(228, 228, 231)',
        }}
        transition={{ duration: DESIGN_TOKENS.animation.fast }}
        style={{
          backgroundColor: 'rgb(228, 228, 231)',
        }}
      />

      {/* Drag handle indicator */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: isHovered || isResizing ? 1 : 0,
          scale: isHovered || isResizing ? 1 : 0.8,
        }}
        transition={{ duration: DESIGN_TOKENS.animation.fast }}
      >
        <div className="w-1 h-1 rounded-full bg-blue-500" />
        <div className="w-1 h-1 rounded-full bg-blue-500" />
        <div className="w-1 h-1 rounded-full bg-blue-500" />
      </motion.div>
    </motion.div>
  );
};

/* =========================================
   Mobile Back Button Component
   ========================================= */

interface MobileBackButtonProps {
  onClick: () => void;
}

const MobileBackButton: React.FC<MobileBackButtonProps> = ({ onClick }) => (
  <motion.button
    className="fixed top-4 left-4 flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700"
    style={{ zIndex: DESIGN_TOKENS.zIndex.mobileBackButton }}
    onClick={onClick}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: DESIGN_TOKENS.animation.fast }}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    aria-label="Back to threads"
  >
    <i className="fa-solid fa-arrow-left text-zinc-600 dark:text-zinc-400" />
    <span className="text-sm font-medium text-zinc-900 dark:text-white">Threads</span>
  </motion.button>
);

/* =========================================
   Keyboard Shortcuts Helper Component
   ========================================= */

const KeyboardShortcutsHelper: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsVisible(prev => !prev);
        }
      }

      if (e.key === 'Escape' && isVisible) {
        e.preventDefault();
        setIsVisible(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  if (!isVisible) return null;

  const shortcuts = [
    { keys: ['Ctrl', ']'], description: 'Next thread' },
    { keys: ['Ctrl', '['], description: 'Previous thread' },
    { keys: ['Ctrl', 'J'], description: 'Jump to search' },
    { keys: ['Esc'], description: 'Clear search' },
    { keys: ['?'], description: 'Toggle shortcuts help' },
  ];

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      style={{ zIndex: DESIGN_TOKENS.zIndex.keyboardHelper }}
      onClick={() => setIsVisible(false)}
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={overlayVariants}
      transition={{ duration: DESIGN_TOKENS.animation.fast }}
    >
      <motion.div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-zinc-200 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: DESIGN_TOKENS.animation.normal }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            Keyboard Shortcuts
          </h3>
          <button
            onClick={() => setIsVisible(false)}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <i className="fa-solid fa-times text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>

        <div className="space-y-3">
          {shortcuts.map(({ keys, description }) => (
            <div key={description} className="flex items-center justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">{description}</span>
              <div className="flex items-center gap-1">
                {keys.map((key, index) => (
                  <React.Fragment key={key}>
                    <kbd className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono text-xs border border-zinc-200 dark:border-zinc-700">
                      {key}
                    </kbd>
                    {index < keys.length - 1 && (
                      <span className="text-zinc-400">+</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
          Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">?</kbd> to toggle this help
        </div>
      </motion.div>
    </motion.div>
  );
};

/* =========================================
   Main Component
   ========================================= */

const SplitViewMessagesContainer: React.FC<SplitViewMessagesContainerProps> = ({
  channels,
  messages,
  currentUserId,
  onSendMessage,
  onAddReaction,
  onLoadMessages,
  isLoading = false,
  renderMessageInput,
  renderMessageBubble,
  enableResizing = true,
  persistPanelWidth = true,
  className = '',
}) => {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);

  // State
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop');
  const [containerWidth, setContainerWidth] = useState<number>(1200);
  const [threadListWidth, setThreadListWidth] = useState<number>(360);
  const [isResizing, setIsResizing] = useState(false);
  const [isDividerHovered, setIsDividerHovered] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Custom hook for split-view state management
  const {
    activeChannelId,
    searchQuery,
    isMobile,
    showMobileView,
    selectChannel,
    setSearchQuery,
    toggleMobileView,
  } = useSplitViewMessages({
    channels,
    enableKeyboardShortcuts: true,
  });

  // Derived state
  const activeChannel = useMemo(
    () => channels.find(ch => ch.id === activeChannelId) || null,
    [channels, activeChannelId]
  );

  const channelMessages = useMemo(
    () => activeChannelId ? (messages[activeChannelId] || []) : [],
    [messages, activeChannelId]
  );

  // Load persisted panel width
  useEffect(() => {
    if (persistPanelWidth && typeof window !== 'undefined') {
      const savedWidth = localStorage.getItem('pulse-messages-panel-width');
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= DESIGN_TOKENS.panelConstraints.threadList.minWidth) {
          setThreadListWidth(parsed);
        }
      }
    }
  }, [persistPanelWidth]);

  // Track container and viewport dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setContainerWidth(width);
        setViewportSize(getViewportSize(width));

        // Reset to default width on viewport change if not user-defined
        if (!isResizing) {
          const defaultPercentage = getDefaultPanelWidth(getViewportSize(width));
          const defaultWidth = Math.round((width * defaultPercentage) / 100);

          // Only reset if there's no persisted width
          if (!persistPanelWidth || !localStorage.getItem('pulse-messages-panel-width')) {
            setThreadListWidth(clamp(
              defaultWidth,
              DESIGN_TOKENS.panelConstraints.threadList.minWidth,
              DESIGN_TOKENS.panelConstraints.threadList.maxWidth
            ));
          }
        }
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateDimensions);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [isResizing, persistPanelWidth]);

  // Load messages when channel changes
  useEffect(() => {
    const loadChannelMessages = async () => {
      if (activeChannelId && onLoadMessages) {
        setLoadingMessages(true);
        try {
          await onLoadMessages(activeChannelId);
        } catch (error) {
          console.error('Failed to load messages:', error);
        } finally {
          setLoadingMessages(false);
        }
      }
    };

    loadChannelMessages();
  }, [activeChannelId, onLoadMessages]);

  // Resize handlers
  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
    resizeStartXRef.current = 0;
    resizeStartWidthRef.current = threadListWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [threadListWidth]);

  const handleResize = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!isResizing) return;

    const newWidth = resizeStartWidthRef.current + info.offset.x;
    const maxWidth = Math.min(
      DESIGN_TOKENS.panelConstraints.threadList.maxWidth,
      containerWidth - DESIGN_TOKENS.panelConstraints.conversation.minWidth - DESIGN_TOKENS.divider.hitArea
    );

    const clampedWidth = clamp(
      newWidth,
      DESIGN_TOKENS.panelConstraints.threadList.minWidth,
      maxWidth
    );

    setThreadListWidth(clampedWidth);
  }, [isResizing, containerWidth]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Persist the width
    if (persistPanelWidth && typeof window !== 'undefined') {
      localStorage.setItem('pulse-messages-panel-width', threadListWidth.toString());
    }
  }, [persistPanelWidth, threadListWidth]);

  // Calculate conversation panel width
  const conversationWidth = viewportSize === 'mobile'
    ? containerWidth
    : containerWidth - threadListWidth - (enableResizing ? DESIGN_TOKENS.divider.hitArea : 0);

  // Render mobile layout
  if (viewportSize === 'mobile') {
    return (
      <div
        ref={containerRef}
        className={`split-view-container relative h-full w-full overflow-hidden bg-white dark:bg-zinc-900 ${className}`}
      >
        <AnimatePresence mode="wait">
          {showMobileView === 'threads' ? (
            <motion.div
              key="mobile-threads"
              className="absolute inset-0"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={mobileSlideVariants.threads}
              transition={{ duration: DESIGN_TOKENS.animation.normal, ease: [0.4, 0, 0.2, 1] }}
            >
              <ThreadListPanel
                channels={channels}
                activeChannelId={activeChannelId}
                onSelectChannel={selectChannel}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                className="h-full"
              />
            </motion.div>
          ) : (
            <motion.div
              key="mobile-conversation"
              className="absolute inset-0"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={mobileSlideVariants.conversation}
              transition={{ duration: DESIGN_TOKENS.animation.normal, ease: [0.4, 0, 0.2, 1] }}
            >
              <ConversationPanel
                channel={activeChannel}
                messages={channelMessages}
                currentUserId={currentUserId}
                onSendMessage={
                  onSendMessage && activeChannelId
                    ? (content) => onSendMessage(activeChannelId, content)
                    : undefined
                }
                onAddReaction={onAddReaction}
                isLoading={loadingMessages || isLoading}
                renderMessageInput={renderMessageInput}
                renderMessageBubble={renderMessageBubble}
                className="h-full"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile back button */}
        <AnimatePresence>
          {showMobileView === 'conversation' && (
            <MobileBackButton onClick={toggleMobileView} />
          )}
        </AnimatePresence>

        {/* Keyboard shortcuts helper */}
        <AnimatePresence>
          <KeyboardShortcutsHelper />
        </AnimatePresence>
      </div>
    );
  }

  // Render desktop/tablet split layout
  return (
    <div
      ref={containerRef}
      className={`split-view-container relative flex h-full w-full overflow-hidden bg-white dark:bg-zinc-900 ${className}`}
      style={{
        // Prevent text selection during resize
        userSelect: isResizing ? 'none' : 'auto',
      }}
    >
      {/* Thread List Panel */}
      <motion.div
        className="thread-list-wrapper h-full flex-shrink-0 overflow-hidden"
        style={{ width: threadListWidth }}
        initial="hidden"
        animate="visible"
        variants={threadListVariants}
      >
        <ThreadListPanel
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={selectChannel}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          className="h-full"
        />
      </motion.div>

      {/* Resize Divider */}
      {enableResizing && (
        <ResizeDivider
          isResizing={isResizing}
          isHovered={isDividerHovered}
          onMouseEnter={() => setIsDividerHovered(true)}
          onMouseLeave={() => setIsDividerHovered(false)}
          onPanStart={handleResizeStart}
          onPan={handleResize}
          onPanEnd={handleResizeEnd}
        />
      )}

      {/* Conversation Panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeChannelId || 'no-channel'}
          className="conversation-wrapper h-full flex-1 overflow-hidden"
          style={{ width: conversationWidth }}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={conversationVariants}
        >
          <ConversationPanel
            channel={activeChannel}
            messages={channelMessages}
            currentUserId={currentUserId}
            onSendMessage={
              onSendMessage && activeChannelId
                ? (content) => onSendMessage(activeChannelId, content)
                : undefined
            }
            onAddReaction={onAddReaction}
            isLoading={loadingMessages || isLoading}
            renderMessageInput={renderMessageInput}
            renderMessageBubble={renderMessageBubble}
            className="h-full"
          />
        </motion.div>
      </AnimatePresence>

      {/* Keyboard shortcuts helper */}
      <AnimatePresence>
        <KeyboardShortcutsHelper />
      </AnimatePresence>

      {/* Resize cursor overlay (prevents cursor flicker during resize) */}
      {isResizing && (
        <div
          className="fixed inset-0 cursor-col-resize"
          style={{ zIndex: 9999 }}
        />
      )}
    </div>
  );
};

export default SplitViewMessagesContainer;
