/**
 * MessagesSplitView — split-view layout with thread list (30%) and
 * conversation panel (70%). Phase 5c: now hosts both workspace channels
 * AND Pulse DMs in a single unified thread list.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import EnhancedLoadingScreen from '../EnhancedLoadingScreen';
import ThreadListPanel from './ThreadListPanel';
import ConversationPanel from './ConversationPanel';
import { MessageChannel, ChannelMessage } from '../../types/messages';
import { PulseConversation } from '../../services/pulseService';
import {
  Conversation,
  conversationId,
  findConversation,
  mergeConversations,
} from '../../types/conversations';
import { useSplitViewMessages } from '../../hooks/useSplitViewMessages';
import './messages.css';

import { ArrowLeft, X } from 'lucide-react';

interface MessagesSplitViewProps {
  channels: MessageChannel[];
  /** Pulse DM conversations rendered alongside channels in the thread
   *  list. Optional — channel-only consumers can omit this. */
  pulseConversations?: PulseConversation[];
  /** Messages keyed by conversation id (channel id OR Pulse conversation
   *  id). The host is responsible for adapting Pulse messages into
   *  ChannelMessage shape. */
  messages: Record<string, ChannelMessage[]>;
  currentUserId: string;
  /** Send a message to the conversation with the given id. The host
   *  branches by conversation kind to call the right service. */
  onSendMessage?: (conversationId: string, content: string) => void;
  onAddReaction?: (messageId: string, emoji: string) => void;
  onLoadMessages?: (conversationId: string) => Promise<void>;
  isLoading?: boolean;
  /** Custom message input renderer. The default `ConversationPanel`
   *  does not render an input — the host owns the composer.
   *
   *  Voice-message support: use `useMessagesVoiceComposer` from
   *  `MessagesVoiceComposerPlugin` (Phase 5d.4) to add a record
   *  button + recording banner to your custom input:
   *
   *      const voice = useMessagesVoiceComposer({
   *        onRecordingComplete: (blob, sec) => sendVox(blob, sec),
   *      });
   *      // ...
   *      {voice.isRecording && <voice.RecordingBanner />}
   *      <voice.RecordButton />
   */
  renderMessageInput?: () => React.ReactNode;
  renderMessageBubble?: (message: ChannelMessage) => React.ReactNode;
  className?: string;
  fullPage?: boolean;

  // ─── Phase 5b plugin slots ──────────────────────────────────
  // These are escape hatches that let the legacy Messages.tsx feature
  // surface migrate into the split view without bloating this
  // component. Each is optional; missing slots render nothing.

  /** Modal layer rendered above the panels. The host owns visibility
   *  state. Use for invite / forward / schedule / shortcuts modals.
   *
   *  Canonical implementation: `MessagesModalsPlugin` (Phase 5d.1).
   *  Wrap the tree in `<MessagesModalsProvider>`, then:
   *
   *      <MessagesSplitView
   *        renderModals={() => (
   *          <MessagesModalsPlugin
   *            pulseConversations={...}
   *            activePulseConversationId={...}
   *            onSchedule={...}
   *            ...
   *          />
   *        )}
   *      />
   *
   *  Children anywhere in the tree call `useMessagesModals().openForward(msg)`,
   *  `.openSchedule()`, etc. without prop-threading. */
  renderModals?: () => React.ReactNode;

  /** Global overlay rendered above the panels and above modals.
   *  Use for full-bleed UI like the focus-mode distraction blocker.
   *
   *  Canonical implementation: `MessagesFocusModePlugin` (Phase 5d.3) —
   *  bridges `useFocusMode()` context to the self-contained
   *  `<FocusMode>` overlay. Wrap the tree in `<FocusModeProvider>`
   *  (already provided by `MessagesWithProviders`), then:
   *
   *      <MessagesSplitView
   *        renderGlobalOverlay={() => (
   *          <MessagesFocusModePlugin userId={user.id} threadName={...} />
   *        )}
   *      />
   *
   *  Anywhere in the tree:
   *
   *      const { startFocusMode } = useFocusMode();
   *      <button onClick={() => startFocusMode(threadId, 25 * 60)}>Focus</button>
   */
  renderGlobalOverlay?: () => React.ReactNode;

  /** Right-side drawer rendered above the conversation panel. Used for
   *  the Phase 3-11 "enhancement" feature panels (analytics,
   *  collaboration, productivity, intelligence, proactive,
   *  communication, automation, security, multimedia).
   *
   *  Canonical implementation: `MessagesFeaturePanelHost` (Phase 5d.6) —
   *  drives an animated right drawer from `useMessagesFeaturePanels()`
   *  context. Wrap the tree in `<MessagesFeaturePanelsProvider>`, then:
   *
   *      <MessagesSplitView
   *        renderRightDrawer={() => (
   *          <MessagesFeaturePanelHost
   *            panels={{
   *              intelligence: ({ activeTab, setTab, close }) => (
   *                <BundleIntelligence.Panel tab={activeTab} onTabChange={setTab} onClose={close} />
   *              ),
   *              productivity: (...) => ...,
   *            }}
   *          />
   *        )}
   *      />
   *
   *  Anywhere in the tree:
   *      const { openPanel } = useMessagesFeaturePanels();
   *      <button onClick={() => openPanel('intelligence', 'bookmarks')}>Open</button>
   */
  renderRightDrawer?: () => React.ReactNode;

  /** Banner above both panels — e.g. workspace-wide notification,
   *  trial-expiring banner.
   *
   *  Canonical implementations:
   *    - `MessagesBannersPlugin` (5d.2) — view-only-mode + SMS-mode hints.
   *    - `MessagesCatchUpCard` (5d.5) — AI catch-up summary on thread
   *      open. Drive it via `useMessagesAIContext` and render
   *      conditionally:
   *
   *      const ai = useMessagesAIContext({
   *        conversationId, conversationHistory, shouldFetchCatchUp: hasUnread,
   *      });
   *      // ...
   *      renderTopBanner={() => (
   *        <>
   *          <MessagesBannersPlugin ... />
   *          {ai.catchUp && (
   *            <MessagesCatchUpCard catchUp={ai.catchUp} onDismiss={ai.refetch} />
   *          )}
   *          {ai.nudge && (
   *            <MessagesNudgeBar nudge={ai.nudge} onDismiss={...} />
   *          )}
   *        </>
   *      )}
   */
  renderTopBanner?: () => React.ReactNode;
}

const MessagesSplitView: React.FC<MessagesSplitViewProps> = ({
  channels,
  pulseConversations = [],
  messages,
  currentUserId,
  onSendMessage,
  onAddReaction,
  onLoadMessages,
  isLoading = false,
  renderMessageInput,
  renderMessageBubble,
  className = '',
  fullPage = false,
  renderModals,
  renderGlobalOverlay,
  renderTopBanner,
  renderRightDrawer
}) => {
  // Merge channels + Pulse DMs into a single sorted Conversation[]
  const conversations = useMemo(
    () => mergeConversations(channels, pulseConversations),
    [channels, pulseConversations]
  );

  const {
    activeConversationId,
    searchQuery,
    isMobile,
    showMobileView,
    selectConversation,
    setSearchQuery,
    toggleMobileView,
  } = useSplitViewMessages({
    conversations,
    enableKeyboardShortcuts: true,
  });

  const [loadingMessages, setLoadingMessages] = useState(false);

  // Load messages when conversation changes
  useEffect(() => {
    const loadConversationMessages = async () => {
      if (activeConversationId && onLoadMessages) {
        setLoadingMessages(true);
        try {
          await onLoadMessages(activeConversationId);
        } catch (error) {
          console.error('Failed to load messages:', error);
        } finally {
          setLoadingMessages(false);
        }
      }
    };

    loadConversationMessages();
  }, [activeConversationId, onLoadMessages]);

  // Resolve the active conversation and its message list
  const activeConversation = findConversation(conversations, activeConversationId);
  const conversationMessages = activeConversationId
    ? (messages[activeConversationId] || [])
    : [];

  // Mobile view classes
  const mobileViewClass = isMobile
    ? showMobileView === 'threads'
      ? 'show-threads'
      : 'show-conversation'
    : '';

  return (
    <div className={`messages-split-view full-height ${fullPage ? 'full-page' : ''} ${mobileViewClass} ${className}`}>
      {/* Optional banner rendered above both panels */}
      {renderTopBanner?.()}

      {/* Thread List Panel (30%) */}
      <ThreadListPanel
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Conversation Panel (70%) */}
      <AnimatePresence mode="wait">
        <ConversationPanel
          key={activeConversationId || 'no-conversation'}
          conversation={activeConversation}
          messages={conversationMessages}
          currentUserId={currentUserId}
          onSendMessage={
            onSendMessage && activeConversationId
              ? (content) => onSendMessage(activeConversationId, content)
              : undefined
          }
          onAddReaction={onAddReaction}
          isLoading={loadingMessages || isLoading}
          renderMessageInput={renderMessageInput}
          renderMessageBubble={renderMessageBubble}
        />
      </AnimatePresence>

      {/* Mobile back button overlay */}
      {isMobile && showMobileView === 'conversation' && (
        <button
          onClick={toggleMobileView}
          className="mobile-back-button fixed top-4 left-4 z-50 bg-white dark:bg-zinc-800 rounded-lg shadow-lg"
          aria-label="Back to threads"
        >
          <ArrowLeft className="text-zinc-600 dark:text-zinc-400" />
          <span className="text-sm text-zinc-900 dark:text-white">Threads</span>
        </button>
      )}

      {/* Keyboard shortcuts helper (can be toggled with ?) */}
      <KeyboardShortcutsHelper />

      {/* Right drawer (feature panels) */}
      {renderRightDrawer?.()}

      {/* Modal layer (host-controlled visibility) */}
      {renderModals?.()}

      {/* Global overlay layer — sits above modals; used for full-bleed
       *  UX like focus-mode distraction blocking. */}
      {renderGlobalOverlay?.()}
    </div>
  );
};

/**
 * Keyboard Shortcuts Helper Component
 * Shows available keyboard shortcuts
 */
const KeyboardShortcutsHelper: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts with ? key
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        // Don't trigger if user is typing in an input
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsVisible(prev => !prev);
        }
      }

      // Hide with Escape
      if (e.key === 'Escape' && isVisible) {
        e.preventDefault();
        setIsVisible(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => setIsVisible(false)}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
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
            <X className="text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>

        <div className="space-y-3">
          <ShortcutItem
            keys={['Ctrl', ']']}
            description="Next thread"
          />
          <ShortcutItem
            keys={['Ctrl', '[']}
            description="Previous thread"
          />
          <ShortcutItem
            keys={['Ctrl', 'J']}
            description="Jump to search"
          />
          <ShortcutItem
            keys={['Esc']}
            description="Clear search"
          />
          <ShortcutItem
            keys={['?']}
            description="Toggle shortcuts help"
          />
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
          Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">?</kbd> to toggle this help
        </div>
      </div>
    </div>
  );
};

interface ShortcutItemProps {
  keys: string[];
  description: string;
}

const ShortcutItem: React.FC<ShortcutItemProps> = ({ keys, description }) => {
  return (
    <div className="flex items-center justify-between text-sm">
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
  );
};

export default MessagesSplitView;
