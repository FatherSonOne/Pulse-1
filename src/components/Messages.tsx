// src/components/Messages.tsx
//
// @deprecated  Legacy Messages monolith — 4800+ lines.
//
// SLATED FOR REPLACEMENT by `MessagesSplitView` once Phase 5c-5d
// migrate the features that only live here (focus mode, voice
// recording, relay integration, the Phase 3-11 enhancement panels,
// and the Pulse-DM sidebar). See:
//   docs/deep-dives/messages_PHASED_PLAN_2026-04-26.md  (Phase 5b/c/d)
//
// Until that migration finishes, this file remains the production
// entry point (mounted by `MessagesWithProviders`). Once each feature
// has a `MessagesSplitView`-hosted equivalent, the corresponding
// section of this file will be deleted.
//
// **Do NOT add new features here.** Add them to a `MessagesSplitView`
// plugin and pass via the `renderModals` / `renderGlobalOverlay` /
// `renderTopBanner` slots, or via `renderMessageInput` /
// `renderMessageBubble`.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { lazy, Suspense } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import MessageInputPortal from './Messages/MessageInputPortal';
import './Messages/messages.css';
import { DateDivider } from './Messages/DateDivider';
import { SmartTimestamp } from './Messages/SmartTimestamp';
import { LazyAvatar } from './common/LazyImage';
import { shouldShowDateDivider, formatDateDivider } from '../utils/dateUtils';
import {
  generateSmartReply,
  chatWithBot,
  generateSpeech,
  analyzeDraftIntent,
  generateCatchUpSummary,
  generateThreadContext,
  detectMeetingIntent,
  extractTaskFromMessage,
  analyzeOutcomeProgress,
  analyzeTeamHealth,
  generateNudge,
  generateHandoffSummary,
  generateChannelArtifact,
  analyzeVoiceMemo
} from '../services/geminiService';
import { messagesExportService } from '../services/messagesExportService';
import { decodeAudioData } from '../services/audioService';
import { createGoogleDoc } from '../services/authService';
import { Contact, Message, Thread, Attachment, DraftAnalysis, ThreadContext, CatchUpSummary, AsyncSuggestion, DecisionData, Task, TeamHealth, Nudge, ChannelArtifact, HandoffSummary } from '../types';
import { dataService } from '../services/dataService';
import { saveArchiveItem } from '../services/dbService';
import { useMessageTrigger } from '../hooks/useMessageTrigger';
import { useVirtualList } from '../hooks/useVirtualList';
import { createInvitation, sendInvitationViaGmail, generateMailtoLink, generateEarlyAccessInvite, generateShareableInviteText } from '../services/inviteService';
import { pulseService, SearchUserResult, PulseConversation, PulseMessage } from '../services/pulseService';
import { messagePersonalService } from '../services/messagePersonalService';
import { nativeSmsService } from '../services/nativeSmsService';
import { canSendSms, openSmsApp, isNativePlatform } from '../services/permissionService';
import { UserContactCard } from './UserContact/UserContactCard';
import { OnlineIndicator } from './UserContact/OnlineIndicator';
import { useUserPresence } from '../hooks/usePresence';
import { useAuth } from '../hooks/useAuth';
import { CellularSMS } from './CellularSMS';
import { useFeatureFlag } from '../lib/featureFlags';

// Phase 1 Message Enhancements - Core features (loaded immediately - critical path)
// Import directly from files to avoid loading entire 875KB index bundle
import { MessageMoodBadge } from './MessageEnhancements/MessageMoodBadge';
import { RichMessageCardComponent } from './MessageEnhancements/RichMessageCard';
import { AnimatedReactions } from './MessageEnhancements/AnimatedReactions';
import { LiveCollaborators } from './MessageEnhancements/LiveCollaborators';
import { StandaloneThemePicker, COLOR_PAIR_THEMES, ColorPairTheme } from './MessageEnhancements/MessageThemeProvider';
import { ConversationHealthWidget } from './MessageEnhancements/ConversationHealthWidget';
import { AchievementToast, AchievementProgress } from './MessageEnhancements/AchievementToast';
import { MessageAnalyticsDashboard } from './MessageEnhancements/MessageAnalyticsDashboard';
import { NetworkGraph } from './MessageEnhancements/NetworkGraph';
import { SmartCompose } from './MessageEnhancements/SmartCompose';
import { QuickActions } from './MessageEnhancements/QuickActions';
import { ThreadActionsMenu, ThreadBadges } from './MessageEnhancements/ThreadActions';
import { TranslationWidget } from './MessageEnhancements/TranslationWidget';
// TypingIndicator moved to Phase 4 component (Messages/TypingIndicator.tsx)
// Hover-triggered reactions - shows reaction bar on 300ms hover (desktop) or long-press (mobile)
import { HoverReactionTrigger } from './MessageEnhancements/HoverReactionTrigger';
import { EmojiPicker as FullEmojiPicker } from './MessageEnhancements/EmojiReactions';
import { useMessageEnhancements } from '../hooks/useMessageEnhancements';
import { FeatureSkeleton } from './MessageEnhancements/FeatureSkeleton';

// Lazy load MessageEnhancements bundles for optimal bundle size
// These are loaded on-demand when features are accessed, reducing initial bundle by ~875KB
const BundleAI = React.lazy(() => import('./MessageEnhancements/BundleAI'));
const BundleAnalytics = React.lazy(() => import('./MessageEnhancements/BundleAnalytics'));
const BundleCollaboration = React.lazy(() => import('./MessageEnhancements/BundleCollaboration'));
const BundleProductivity = React.lazy(() => import('./MessageEnhancements/BundleProductivity'));
const BundleIntelligence = React.lazy(() => import('./MessageEnhancements/BundleIntelligence'));
const BundleProactive = React.lazy(() => import('./MessageEnhancements/BundleProactive'));
const BundleCommunication = React.lazy(() => import('./MessageEnhancements/BundleCommunication'));
const BundleAutomation = React.lazy(() => import('./MessageEnhancements/BundleAutomation'));
const BundleSecurity = React.lazy(() => import('./MessageEnhancements/BundleSecurity'));
const BundleMultimedia = React.lazy(() => import('./MessageEnhancements/BundleMultimedia'));

// Error Boundary for protecting lazy-loaded Bundle components
import { MessageEnhancementErrorBoundary } from './MessageEnhancements/MessageEnhancementErrorBoundary';

// For immediate access to hooks and small components, import directly from individual files
import ToolOverlay from './MessageEnhancements/ToolOverlay';
import { TranslationHub } from './MessageEnhancements/TranslationHub';
import { AnalyticsExport } from './MessageEnhancements/AnalyticsExport';
import { AttachmentManager } from './MessageEnhancements/AttachmentManager';
import { BackupSync } from './MessageEnhancements/BackupSync';
import { SmartSuggestions } from './MessageEnhancements/SmartSuggestions';
import { useRegisterCommands, useCommandPalette, Command as PaletteCommand } from '../contexts/CommandPaletteContext';
import { getAllToolActions, fuzzySearchTools, saveRecentTool, suggestToolsFromContext, getRecentTools, getToolOverlayType } from '../services/toolRegistry';
import type { ToolAction } from '../services/toolRegistry';
import { messageEnhancementsService } from '../services/messageEnhancementsService';
import type { LiveCollaborator } from '../types/messageEnhancements';
import { VoiceTextButton } from './shared/VoiceTextButton';
import { TriageBrief } from './Messages/TriageBrief';
import MessageInput from './MessageInput';
// PR 1 — Messages Tools Redesign · Surface 1 (compose bar).
// Gated on the `pulseComposerV2` feature flag; falls back to the legacy
// `MessageInput` when off. See docs/messages-tools-redesign.md.
import PulseComposer from './PulseComposer';
import { ToolsMenuV2 } from './ToolsMenuV2';
// Messages Tools Redesign · Surface 2 (message context-menu) — GA, the
// only message menu. See docs/messages-tools-redesign.md.
import {
  MessageContextMenu,
  EditedBadge,
  useLongPress,
  useMessageContextMenu,
  computeIsEditable,
  type ContextMenuActionId,
  type MessageViewpoint,
} from './MessageContextMenu';
// Advanced Features - Context, Attention, Tasks, Artifacts
import { IntentComposer, ContextPanel } from './context';
import { MeetingDeflector } from './attention';
import { TaskExtractor } from './tasks/TaskExtractor';
import { ChannelArtifactComponent } from './artifacts';

// REDESIGN COMPONENTS - Phase 1
import { UserBadge, UserRole } from './Messages/UserBadge';
import { GestureHandler } from './Messages/GestureHandler';
import { TypingIndicator } from './Messages/TypingIndicator';

// REDESIGN COMPONENTS - Phase 3
// RadialMenu / ContextMenu (the Phase-3 menus) are no longer used here —
// removed 2026-05-31 in favour of the single MessageContextMenu. The
// component files remain for src/examples + their unit tests.
// Lazy-loaded for better performance
const FeatureSettingsPanel = lazy(() => import('./Messages/FeatureSettingsPanel').then(m => ({ default: m.FeatureSettingsPanel })));
import { useFeatures } from '../contexts/FeatureContext';

// REDESIGN COMPONENTS - Phase 2 (Mobile)
import { MobileDrawer, useSwipeFromEdge, MobileDrawerHeader } from './Messages/MobileDrawer';

// Focus Mode (Phase 5)
const FocusMode = lazy(() => import('./Messages/FocusMode').then(m => ({ default: m.FocusMode })));

import { MessagesFeaturePanels } from './Messages/MessagesFeaturePanels';
import { MessageLinkPreviews } from './Messages/LinkPreviewCard';
import { useMessagesKeyboardShortcuts } from '../hooks/useMessagesKeyboardShortcuts';
import { SnoozeMenu } from './Messages/SnoozeMenu';
import { TagPicker, TagPills } from './Messages/TagPills';
import { tagsService, type TagDefinition } from '../services/tagsService';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { trackOnboarding, OnboardingEvent } from '../lib/monitoring/onboardingEvents';

import { Archive, ArrowLeft, ArrowRight, ArrowUp, AtSign, BarChart, Bold, Bot, Check, CheckCheck, CheckCircle, CheckCircle2, Clock, Copy, Crosshair, Download, Ellipsis, Eye, File, FileOutput, FileText, Flag, Gavel, GitFork, GraduationCap, Handshake, Hash, HeartPulse, History, Image, Keyboard, Languages, Layers, LayoutGrid, Lightbulb, Link, ListChecks, Loader2, Lock, LogOut, Mail, Menu, MessageCircle, MessageSquare, MessagesSquare, PanelRightOpen, Pen, PenTool, Play, Plus, Reply, Rocket, Scale, Search, Send, Share, SlidersHorizontal, Smartphone, Smile, Sparkles, Square, SquarePen, Star, Target, Terminal, ThumbsDown, ThumbsUp, Timer, Trash2, TrendingUp, Trophy, UserPlus, UserX, Users, Video, Wand2, Wrench, X, Zap } from 'lucide-react';

// Extracted Modals
import {
  ScheduleMessageModal,
  ConversationStatsModal,
  InviteTeamModal,
  InviteToPulseModal,
} from './Messages/modals';
import { MessagesTopModals } from './Messages/MessagesTopModals';
import { MessagesEndModals } from './Messages/MessagesEndModals';
import { ConversationSidebar } from './Messages/ConversationSidebar';
import { RelationshipRail } from './Messages/RelationshipRail';
import { deriveRelationship, type RailMessage, type RelationshipData } from './Messages/useRelationshipData';
// `Task` is already taken by the legacy ../types Task; alias the service's
// (extracted_tasks) shape to avoid the duplicate-identifier collision.
import { taskService, type Task as ExtractedTask } from '../services/taskService';
import { decisionService, type Decision } from '../services/decisionService';
import { SpineNode } from './Messages/ConversationSpine';
import { useConversationMoments } from './Messages/useConversationMoments';
import { MessageInputSection } from './Messages/MessageInputSection';
import { MESSAGE_TEMPLATES as MSG_TEMPLATES_CONST, REACTION_CATEGORIES as REACTION_CATS_CONST, generateSmartTemplateText as genSmartTemplate } from './Messages/messageConstants';
import { usePulseMessagesStore } from '../store/pulseMessagesStore';

const COMMON_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// Quick Add Contact Component for empty state
interface QuickAddContactProps {
  onAddContact?: (contact: Omit<Contact, 'id'>) => Promise<Contact | null>;
  onContactAdded: (contact: Contact) => void;
}

const QuickAddContact: React.FC<QuickAddContactProps> = ({ onAddContact, onContactAdded }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !onAddContact) return;

    setIsAdding(true);
    try {
      const newContact = await onAddContact({
        name: name.trim(),
        email: email.trim(),
        role: 'Contact',
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        status: 'offline',
        groups: [],
        source: 'local'
      });

      if (newContact) {
        onContactAdded(newContact);
      }
    } catch (error) {
      console.error('Failed to add contact:', error);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-[#f2f2f2] dark:bg-[rgba(255,255,255,0.055)] rounded-full flex items-center justify-center mx-auto mb-3">
          <UserPlus className="text-2xl text-zinc-400" />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No contacts yet. Add your first contact to start messaging.</p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-500 dark:text-zinc-500 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] dark:text-white focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/40 outline-none transition-colors"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-500 dark:text-zinc-500 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] dark:text-white focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/40 outline-none transition-colors"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !email.trim() || isAdding || !onAddContact}
          className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
        >
          {isAdding ? (
            <>
              <Loader2 className="animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Plus />
              Add Contact & Start Chat
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Extended reaction emoji picker
const REACTION_CATEGORIES = REACTION_CATS_CONST;
// Smart message templates - these are base templates that get personalized
const MESSAGE_TEMPLATES = MSG_TEMPLATES_CONST;

// Helper function to convert URLs in text to clickable links
const renderTextWithLinks = (text: string): React.ReactNode => {
  // Regex to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|org|net|io|co|app|dev|ai)[^\s]*)/gi;
  const parts = text.split(urlRegex);
  const matches = text.match(urlRegex) || [];

  if (matches.length === 0) return text;

  const result: React.ReactNode[] = [];
  let matchIndex = 0;
  let lastIndex = 0;

  text.replace(urlRegex, (match, ...args) => {
    const index = args[args.length - 2] as number;
    // Add text before the match
    if (index > lastIndex) {
      result.push(text.slice(lastIndex, index));
    }
    // Add the link
    const href = match.startsWith('http') ? match : `https://${match}`;
    result.push(
      <a
        key={`link-${matchIndex}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#e11d48] dark:text-[#fb7185] hover:text-[#f43f5e] underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {match}
      </a>
    );
    lastIndex = index + match.length;
    matchIndex++;
    return match;
  });

  // Add remaining text after last match
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length > 0 ? result : text;
};

// Generate smart/contextual template text based on conversation context
const generateSmartTemplateText = genSmartTemplate;

// Keyboard shortcuts configuration
const KEYBOARD_SHORTCUTS = {
  'Ctrl+Enter': 'Send message',
  'Ctrl+Shift+E': 'Toggle emoji picker',
  'Ctrl+Shift+F': 'Focus search',
  'Ctrl+Shift+P': 'Toggle proposal mode',
  'Ctrl+Shift+T': 'Toggle templates',
  'Escape': 'Close modals/panels',
};

const AVATAR_COLORS = [
  'bg-rose-500', 'bg-rose-600', 'bg-rose-400', 'bg-rose-700',
  'bg-pink-500', 'bg-pink-600', 'bg-pink-400', 'bg-pink-700'
];

interface MessagesProps {
  /** @deprecated no-op — AI routing is server-side via edge functions. */
  apiKey?: string;
  contacts: Contact[];
  initialContactId?: string;
  onAddContact?: (contact: Omit<Contact, 'id'>) => Promise<Contact | null>;
  currentUser?: {
    id: string;
    name: string;
    email: string;
  };
  fullPage?: boolean;
}

const Messages: React.FC<MessagesProps> = ({ apiKey, contacts, initialContactId, onAddContact, currentUser: propCurrentUser, fullPage = false }) => {
  // Get user from auth context as fallback
  const { user: authUser } = useAuth();

  // Use prop if provided, otherwise use auth user, fallback to guest
  const currentUser = propCurrentUser || (authUser ? {
    id: authUser.id,
    name: authUser.name || 'Guest',
    email: authUser.email || '',
  } : {
    id: 'guest',
    name: 'Guest',
    email: '',
  });

  const { triggerMessage } = useMessageTrigger();
  const [messageCount, setMessageCount] = useState(0);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Load threads from Supabase (SMS threads - kept for Cellular SMS sub-page)
  const loadThreads = useCallback(async () => {
    setIsLoading(true);
    try {
      const dbThreads = await dataService.getThreads();
      setThreads(dbThreads);
      // Don't auto-select SMS threads - SMS is now on a separate sub-page
      // The Pulse Messages page should show empty state or Pulse conversations only
    } catch (error) {
      console.error('Failed to load threads:', error);
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies - only runs on mount

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const [inputText, setInputText] = useState('');
  // Secondary draft string consumed by the legacy-branch feature panels
  // (smart-compose suggestions write here; ConversationSummary/AICoach read it).
  // Declared at component scope to back the props passed to <MessagesFeaturePanels>
  // — previously referenced there but never declared, a latent ReferenceError when
  // the legacy thread branch mounts. (Repair plan W1 / triage S1.)
  const [newMessage, setNewMessage] = useState('');
  // Programmatic opener for the global command palette, wired to the header
  // Command Palette button (its old local `setShowCommandPalette` setter was
  // removed when the local Cmd+K palette was retired). (Repair plan W1 / triage S1.)
  const { open: openCommandPalette } = useCommandPalette();
  const [loadingAI, setLoadingAI] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // Team Invite State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [inviteMessage, setInviteMessage] = useState('');

  // SMS Sub-page State
  const [showCellularSMS, setShowCellularSMS] = useState(false);
  const [activeSmsThreadId, setActiveSmsThreadId] = useState<string | null>(null);

  const [typingThreads, setTypingThreads] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Mobile View State
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Mobile Drawer State (Phase 2.4)
  const { isDrawerOpen, setIsDrawerOpen, closeDrawer, openDrawer } = useSwipeFromEdge({
    side: 'left',
    edgeThreshold: 20,
    swipeThreshold: 100,
    enabled: true,
  });

  // Reply State
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Audio Playback
  const [isPlayingId, setIsPlayingId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Context Aware State
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [draftAnalysis, setDraftAnalysis] = useState<DraftAnalysis | null>(null);
  const [threadContext, setThreadContext] = useState<ThreadContext | null>(null);
  const [catchUpSummary, setCatchUpSummary] = useState<CatchUpSummary | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  
  // Social Health State
  const [teamHealth, setTeamHealth] = useState<TeamHealth | null>(null);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [showHandoffCard, setShowHandoffCard] = useState(false);
  const [handoffContent, setHandoffContent] = useState<HandoffSummary | null>(null);
  const [loadingHandoff, setLoadingHandoff] = useState(false);

  // Attention State
  const [focusThreadId, setFocusThreadId] = useState<string | null>(null);
  const [focusDigest, setFocusDigest] = useState<string | null>(null);
  const [asyncSuggestion, setAsyncSuggestion] = useState<AsyncSuggestion | null>(null);

  // Focus Mode State (Phase 5)
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);

  // --- NEW: Decision & Outcome State ---
  const [isProposalMode, setIsProposalMode] = useState(false);

  // Proposal-mode is gated until real multi-user voting is wired up
  // (votes are currently simulated client-side). See deep-dive issue #3.
  const proposalModeEnabled = useFeatureFlag('proposalMode', currentUser?.id);
  // Ref so the static-deps keyboard handler reads the current value.
  const proposalModeEnabledRef = useRef(proposalModeEnabled);
  useEffect(() => {
    proposalModeEnabledRef.current = proposalModeEnabled;
  }, [proposalModeEnabled]);
  // Force-clear if the flag is off (e.g., user toggled it via shortcut earlier).
  useEffect(() => {
    if (!proposalModeEnabled && isProposalMode) {
      setIsProposalMode(false);
    }
  }, [proposalModeEnabled, isProposalMode]);
  const [showOutcomeSetup, setShowOutcomeSetup] = useState(false);
  const [outcomeGoal, setOutcomeGoal] = useState('');
  const [creatingTaskForMsgId, setCreatingTaskForMsgId] = useState<string | null>(null);

  // --- NEW: Artifact Export State ---
  const [showArtifactModal, setShowArtifactModal] = useState(false);
  const [artifact, setArtifact] = useState<ChannelArtifact | null>(null);
  const [loadingArtifact, setLoadingArtifact] = useState(false);
  const [exportingToDocs, setExportingToDocs] = useState(false);

  // --- NEW: Deep Voice State ---
  const [analyzingAudioId, setAnalyzingAudioId] = useState<string | null>(null);

  // --- Export State ---
  const [showExportMenu, setShowExportMenu] = useState(false);

  // --- Advanced Features State ---
  const [showMeetingDeflector, setShowMeetingDeflector] = useState(true);
  const [showTaskExtractor, setShowTaskExtractor] = useState(false);
  const [showChannelArtifactPanel, setShowChannelArtifactPanel] = useState(false);
  const [useIntentComposer, setUseIntentComposer] = useState(true);

  // --- NEW ENHANCED FEATURES STATE ---
  // Message scheduling — backed by pulse_scheduled_messages + pg_cron.
  // The legacy in-memory polling implementation was lost on refresh and
  // never delivered when the app was closed; the cron job handles delivery
  // server-side every minute.
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState<Array<{
    id: string;
    text: string;
    scheduledFor: Date;
    threadId: string;
    recipientId: string;
  }>>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Phase 1: Live Collaboration State
  const [typingCollaborators, setTypingCollaborators] = useState<LiveCollaborator[]>([]);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const themeButtonRef = useRef<HTMLButtonElement>(null);

  // Message Theme Color Pair - persisted in localStorage
  const [selectedColorPair, setSelectedColorPair] = useState<ColorPairTheme>(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('pulse-color-pair');
      if (savedId) {
        const found = COLOR_PAIR_THEMES.find(p => p.id === savedId);
        if (found) return found;
      }
    }
    return COLOR_PAIR_THEMES[0]; // Default to Pulse Classic
  });

  // Listen for theme changes from the picker
  useEffect(() => {
    const handleThemeChange = (e: CustomEvent<ColorPairTheme>) => {
      setSelectedColorPair(e.detail);
    };
    window.addEventListener('pulse-theme-change', handleThemeChange as EventListener);
    return () => {
      window.removeEventListener('pulse-theme-change', handleThemeChange as EventListener);
    };
  }, []);

  // Phase 2: AI-Powered Features State
  const [showAICoach, setShowAICoach] = useState(true);
  const [showAIMediator, setShowAIMediator] = useState(true);
  const [showVoiceExtractor, setShowVoiceExtractor] = useState(false);
  const [showQuickPhrases, setShowQuickPhrases] = useState(false);

  // Phase 3: Analytics & Engagement State
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false);
  const [analyticsView, setAnalyticsView] = useState<'pace' | 'flow' | 'insights'>('pace');

  // Phase 4: Collaboration & Advanced Features State
  const [showCollaborationPanel, setShowCollaborationPanel] = useState(false);
  const [collaborationTab, setCollaborationTab] = useState<'collab' | 'links' | 'kb' | 'search' | 'pins' | 'annotations'>('collab');
  const [pinnedMessages, setPinnedMessages] = useState<Array<{
    id: string;
    messageId: string;
    text: string;
    sender: string;
    timestamp: string;
    pinnedBy: string;
    pinnedAt: string;
    category: 'important' | 'action' | 'reference' | 'decision' | 'custom';
    note?: string;
  }>>([]);
  const [highlights, setHighlights] = useState<Array<{
    id: string;
    messageId: string;
    startIndex: number;
    endIndex: number;
    text: string;
    color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
    label?: string;
    createdBy: string;
    createdAt: string;
  }>>([]);
  const [annotations, setAnnotations] = useState<Array<{
    id: string;
    messageId: string;
    type: 'comment' | 'question' | 'suggestion' | 'flag' | 'approval';
    content: string;
    author: { id: string; name: string; avatar?: string };
    createdAt: string;
    resolved: boolean;
    replies: Array<{ id: string; content: string; author: { id: string; name: string }; createdAt: string; mentions: string[] }>;
    mentions: string[];
    reactions: Array<{ emoji: string; users: string[] }>;
  }>>([]);

  // Phase 5: Productivity & Utilities State
  const [showProductivityPanel, setShowProductivityPanel] = useState(false);
  const [productivityTab, setProductivityTab] = useState<'templates' | 'schedule' | 'summary' | 'export' | 'shortcuts' | 'notifications'>('templates');
  const [userTemplates, setUserTemplates] = useState<Array<{
    id: string;
    name: string;
    category: 'greeting' | 'follow-up' | 'meeting' | 'feedback' | 'closing' | 'custom';
    content: string;
    variables: string[];
    usageCount: number;
    lastUsed?: string;
    createdBy: string;
    tags: string[];
  }>>([]);
  const [userScheduledMessages, setUserScheduledMessages] = useState<Array<{
    id: string;
    content: string;
    threadId: string;
    threadName: string;
    scheduledFor: string;
    createdAt: string;
    status: 'pending' | 'sent' | 'failed' | 'cancelled';
  }>>([]);
  const [userReminders, setUserReminders] = useState<Array<{
    id: string;
    threadId: string;
    threadName: string;
    title: string;
    description?: string;
    remindAt: string;
    type: 'follow-up' | 'deadline' | 'check-in' | 'custom';
    priority: 'high' | 'medium' | 'low';
    completed: boolean;
  }>>([]);

  // Phase 6: Intelligence & Organization State
  const [showIntelligencePanel, setShowIntelligencePanel] = useState(false);
  const [intelligenceTab, setIntelligenceTab] = useState<'insights' | 'reactions' | 'bookmarks' | 'tags' | 'delivery'>('insights');
  // Messages contributes its tool actions to the global command palette via
  // useRegisterCommands below. The local Cmd+K + modal palette are gone —
  // App.tsx owns Cmd+K and the global palette renders at root. The modal
  // QuickActionsCommandPalette is still used in *embedded* mode inside
  // ToolOverlay's Commands tab; that's a separate surface and stays.
  const [userBookmarks, setUserBookmarks] = useState<Array<{
    id: string;
    messageId: string;
    conversationId: string;
    messagePreview: string;
    sender: string;
    timestamp: Date;
    createdAt: Date;
    note?: string;
    collection?: string;
    tags: string[];
  }>>([]);
  const [conversationTagAssignments, setConversationTagAssignments] = useState<Array<{
    conversationId: string;
    tagIds: string[];
    labelId?: string;
  }>>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Enhanced search with filters
  const [searchFilter, setSearchFilter] = useState<'all' | 'messages' | 'files' | 'decisions' | 'tasks'>('all');
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{thread: Thread; message: Message}>>([]);

  // Message templates
  const [showTemplates, setShowTemplates] = useState(false);

  // Extended emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<string | null>(null);
  // PR 2: full emoji picker opened from the context-menu quick-reactions
  // "+" button (or the React… overflow item). Distinct from the legacy
  // `showEmojiPicker` state above which is owned by the legacy compose path.
  const [fullEmojiPicker, setFullEmojiPicker] = useState<{
    open: boolean;
    messageId: string | null;
    x: number;
    y: number;
  }>({ open: false, messageId: null, x: 0, y: 0 });
  const [recentReactionEmojis, setRecentReactionEmojis] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('pulse_recent_reaction_emojis');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((e: unknown): e is string => typeof e === 'string') : [];
    } catch { return []; }
  });
  
  // Attachment menu
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Cleanup recorder + audio context on unmount so we don't leak the
  // mic stream or an open AudioContext when the user navigates away.
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current !== null) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        try {
          if (recorder.state !== 'inactive') recorder.stop();
        } catch {
          // already stopped
        }
        recorder.stream?.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
      }
      audioChunksRef.current = [];
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== 'closed') {
        ctx.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  // Thread organization
  const [threadFilter, setThreadFilter] = useState<'all' | 'unread' | 'pinned' | 'with-tasks' | 'with-decisions'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [archivedThreads, setArchivedThreads] = useState<string[]>([]);

  // Tool suggestion state for contextual AI tool recommendations
  const [suggestedTool, setSuggestedTool] = useState<ToolAction | null>(null);

  // Thread statistics panel
  const [showStatsPanel, setShowStatsPanel] = useState(false);

  // Keyboard shortcuts panel
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Message editing
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Message forwarding
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);

  // Thread muting
  const [mutedThreads, setMutedThreads] = useState<string[]>([]);

  // Read receipts toggle
  const [showReadReceipts, setShowReadReceipts] = useState(true);

  // Phase 7: Proactive Intelligence & Advanced Organization State
  const [showProactivePanel, setShowProactivePanel] = useState(false);
  const [proactiveTab, setProactiveTab] = useState<'reminders' | 'threading' | 'sentiment' | 'groups' | 'search' | 'highlights'>('reminders');

  // Phase 8: Communication Enhancement & Inbox Intelligence State
  const [showCommunicationPanel, setShowCommunicationPanel] = useState(false);
  const [communicationTab, setCommunicationTab] = useState<'voice' | 'reactions' | 'inbox' | 'archive' | 'replies' | 'status'>('voice');

  // Phase 9: Advanced Personalization & Automation State
  const [showPersonalizationPanel, setShowPersonalizationPanel] = useState(false);
  const [personalizationTab, setPersonalizationTab] = useState<'rules' | 'formatting' | 'notes' | 'modes' | 'sounds' | 'drafts'>('rules');

  // Phase 10: Security, Insights & Productivity State
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);
  const [securityTab, setSecurityTab] = useState<'encryption' | 'readtime' | 'versions' | 'folders' | 'insights' | 'focus'>('encryption');

  // Phase 11: Multi-Media & Export Hub State
  const [showMediaHubPanel, setShowMediaHubPanel] = useState(false);
  const [mediaHubTab, setMediaHubTab] = useState<'translation' | 'export' | 'templates' | 'attachments' | 'backup' | 'suggestions'>('translation');

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);

  // AI Coach tip visibility with fade
  const [showCoachTip, setShowCoachTip] = useState(true);
  const [coachTipFading, setCoachTipFading] = useState(false);
  const [nudgeFocused, setNudgeFocused] = useState(false);

  // Pulse User Search State
  const [pulseUserSearch, setPulseUserSearch] = useState('');
  const [pulseSearchResults, setPulseSearchResults] = useState<SearchUserResult[]>([]);
  const [isSearchingPulseUsers, setIsSearchingPulseUsers] = useState(false);
  const [pulseConversations, setPulseConversations] = useState<PulseConversation[]>([]);
  const [activePulseConversation, setActivePulseConversation] = useState<string | null>(null);
  const [pulseMessages, setPulseMessages] = useState<PulseMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Removed newChatTab - New Conversation modal now only shows Pulse users
  const [suggestedPulseUsers, setSuggestedPulseUsers] = useState<SearchUserResult[]>([]);
  const [recentPulseContacts, setRecentPulseContacts] = useState<SearchUserResult[]>([]);

  // Invite to Pulse state
  const [showInviteToPulseModal, setShowInviteToPulseModal] = useState(false);
  const [inviteToPulseSent, setInviteToPulseSent] = useState(false);
  const [inviteToPulseCopied, setInviteToPulseCopied] = useState(false);
  const [inviteTargetContact, setInviteTargetContact] = useState<Contact | null>(null);

  // Pulse pagination state
  const [hasMorePulseMessages, setHasMorePulseMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);

  // Pulse editing state
  const [editingPulseMessageId, setEditingPulseMessageId] = useState<string | null>(null);
  const [editPulseText, setEditPulseText] = useState('');

  // Pulse typing indicator state
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingBroadcastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pulse message reactions and features state
  const [pulseMessageReactions, setPulseMessageReactions] = useState<Record<string, Array<{ emoji: string; count: number; me: boolean }>>>({});
  const [starredPulseMessages, setStarredPulseMessages] = useState<Set<string>>(new Set());
  const [replyingToPulseMessage, setReplyingToPulseMessage] = useState<PulseMessage | null>(null);

  // Surface 2 (message context-menu) — the single message menu.
  const pulseCtxMenu = useMessageContextMenu();
  // Single shared long-press handler set — the callback extracts the
  // message id from the originating `data-message-id` attribute. Lets
  // us spread one handler bundle on every bubble.
  const pulseV2LongPress = useLongPress<HTMLDivElement>((x, y, target) => {
    const id = target?.getAttribute?.('data-message-id') ?? null;
    if (!id) return;
    pulseCtxMenu.openFromLongPress(x, y, target, id);
  });
  /** Snapshot of original text per edited message, keyed by id. Used by
   *  the EditedBadge tooltip. Server `original_content` should override
   *  when persisted; today this lives only client-side. */
  const [pulseEditedOriginals, setPulseEditedOriginals] = useState<Record<string, string>>({});
  /** Transient toast surfaced after edit-after-reaction clearing. */
  const [pulseEditToast, setPulseEditToast] = useState<string | null>(null);
  useEffect(() => {
    if (!pulseEditToast) return;
    const handle = window.setTimeout(() => setPulseEditToast(null), 2400);
    return () => window.clearTimeout(handle);
  }, [pulseEditToast]);

  const features = useFeatures();
  const [showFeatureSettings, setShowFeatureSettings] = useState(false);

  // Phase 7b — tags (Pulse DM scope for now). Pulled from
  // useWorkspace() so picker knows which workspace's tag taxonomy to
  // show; gracefully no-ops if no active workspace.
  const { currentWorkspace } = useWorkspace();
  const [conversationTags, setConversationTags] = useState<Record<string, TagDefinition[]>>({});
  const refreshTagsFor = useCallback(async (conversationId: string) => {
    try {
      const tags = await tagsService.listTagsForConversation(conversationId);
      setConversationTags((prev) => ({ ...prev, [conversationId]: tags }));
    } catch (err) {
      console.error('[Messages] refresh tags failed:', err);
    }
  }, []);
  // Bulk-load tags for the visible Pulse conversations whenever the list changes.
  useEffect(() => {
    if (pulseConversations.length === 0) return;
    let cancelled = false;
    void tagsService
      .listTagsForConversations(pulseConversations.map((c) => c.id))
      .then((grouped) => { if (!cancelled) setConversationTags(grouped); })
      .catch((err) => console.error('[Messages] bulk tag load failed:', err));
    return () => { cancelled = true; };
  }, [pulseConversations]);
  // Subscribe to realtime tag changes so other devices/users see updates live.
  useEffect(() => {
    const unsubscribe = tagsService.subscribeToTagChanges(({ conversationId }) => {
      void refreshTagsFor(conversationId);
    });
    return unsubscribe;
  }, [refreshTagsFor]);

  // Contact details panel state
  const [selectedContactUserId, setSelectedContactUserId] = useState<string | null>(null);
  const [showContactPanel, setShowContactPanel] = useState(false);

  // Active tool overlay state - only one tool can be open at a time
  type ToolType = 'analytics' | 'collaboration' | 'productivity' | 'intelligence' | 'proactive' | 'communication' | 'personalization' | 'security' | 'mediaHub' | null;
  const [activeToolOverlay, setActiveToolOverlay] = useState<ToolType>(null);

  // Helper to close all tool panels - ensures only one panel is open at a time
  const closeAllPanels = useCallback(() => {
    setActiveToolOverlay(null);
    setShowAnalyticsPanel(false);
    setShowCollaborationPanel(false);
    setShowProductivityPanel(false);
    setShowIntelligencePanel(false);
    setShowProactivePanel(false);
    setShowCommunicationPanel(false);
    setShowPersonalizationPanel(false);
    setShowSecurityPanel(false);
    setShowMediaHubPanel(false);
    setShowStatsPanel(false);
  }, []);

  // Toggle a tool overlay - opens fullscreen tool panel that slides down
  const togglePanel = useCallback((panel: string, currentValue: boolean) => {
    if (currentValue || activeToolOverlay === panel) {
      // Close the tool
      setActiveToolOverlay(null);
      closeAllPanels();
    } else {
      // Open the tool as fullscreen overlay
      closeAllPanels();
      setActiveToolOverlay(panel as ToolType);
      // Also set the legacy state for compatibility
      switch (panel) {
        case 'analytics': setShowAnalyticsPanel(true); break;
        case 'collaboration': setShowCollaborationPanel(true); break;
        case 'productivity': setShowProductivityPanel(true); break;
        case 'intelligence': setShowIntelligencePanel(true); break;
        case 'proactive': setShowProactivePanel(true); break;
        case 'communication': setShowCommunicationPanel(true); break;
        case 'personalization': setShowPersonalizationPanel(true); break;
        case 'security': setShowSecurityPanel(true); break;
        case 'mediaHub': setShowMediaHubPanel(true); break;
      }
    }
  }, [activeToolOverlay, closeAllPanels]);

  // Tool overlay configuration
  const toolConfig: Record<string, { title: string; icon: string; color: string }> = {
    analytics: { title: 'Conversation Analytics', icon: 'fa-chart-pie', color: 'indigo' },
    collaboration: { title: 'Collaboration Tools', icon: 'fa-users-gear', color: 'purple' },
    productivity: { title: 'Productivity Tools', icon: 'fa-rocket', color: 'cyan' },
    intelligence: { title: 'Intelligence & Organization', icon: 'fa-brain', color: 'violet' },
    proactive: { title: 'Smart Reminders & More', icon: 'fa-sparkles', color: 'rose' },
    communication: { title: 'Communication Tools', icon: 'fa-comments', color: 'amber' },
    personalization: { title: 'Personalization & Automation', icon: 'fa-sliders', color: 'fuchsia' },
    security: { title: 'Security & Insights', icon: 'fa-shield-halved', color: 'emerald' },
    mediaHub: { title: 'Media Hub & Export', icon: 'fa-photo-film', color: 'cyan' },
  };

  // ===== MESSAGE ENHANCEMENTS HOOK =====
  // Centralized hook for all 30 message enhancement features
  const messageEnhancements = useMessageEnhancements({
    apiKey: apiKey,
    threads: threads,
    currentUserId: currentUser?.id || ''
  });

  // State for new enhancement features
  const [showAnalyticsDashboard, setShowAnalyticsDashboard] = useState(false);
  const [showNetworkGraph, setShowNetworkGraph] = useState(false);
  const [showSmartCompose, setShowSmartCompose] = useState(true);
  const [showQuickActionsBar, setShowQuickActionsBar] = useState(true);
  const [showAchievements, setShowAchievements] = useState(true);
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  // Messages Tools Redesign — when `toolsMenuV2` flag is on, the header
  // tools button opens this dialog instead of the legacy drawer above.
  const [showToolsMenuV2, setShowToolsMenuV2] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false); // Phase 1: Simple/Advanced toggle

  // Focus AI nudge when navigated from Daily Overview
  useEffect(() => {
    const flag = sessionStorage.getItem('pulse_focus_nudge');
    if (flag === 'message') {
      sessionStorage.removeItem('pulse_focus_nudge');
      setShowCoachTip(true);
      // Flash the nudge bar after a short delay to let the component render
      setTimeout(() => {
        setNudgeFocused(true);
        setTimeout(() => setNudgeFocused(false), 2000);
      }, 300);
    }
  }, []);

  // ===== ZUSTAND STORE BRIDGE =====
  // The store is the source of truth for Pulse state.
  // We bridge store -> local state so existing JSX keeps working.
  // New code should use the store directly via usePulseMessagesStore.
  const pulseStore = usePulseMessagesStore();

  // Initialize store on mount
  useEffect(() => {
    pulseStore.loadConversations();
    pulseStore.loadRecentContacts();
    pulseStore.loadSuggestedUsers();
  }, []);

  // Bridge: store conversations -> local state
  useEffect(() => {
    setPulseConversations(pulseStore.conversations);
  }, [pulseStore.conversations]);

  useEffect(() => {
    setSuggestedPulseUsers(pulseStore.suggestedUsers);
  }, [pulseStore.suggestedUsers]);

  useEffect(() => {
    setRecentPulseContacts(pulseStore.recentContacts);
  }, [pulseStore.recentContacts]);

  // NOTE: there is deliberately NO `pulseStore.messages -> local` bridge.
  // The DM thread is owned entirely by local `pulseMessages`: loaded by
  // `selectPulseConversation`, appended optimistically by `sendPulseMessage`,
  // and reconciled by the realtime subscription below. The store's message
  // paths (`sendMessage` / `handleRealtimeMessage` / `selectConversation`)
  // are not wired on this surface, so bridging `store.messages` in could only
  // clobber freshly-sent local state with a stale snapshot. Single source of
  // truth = local state.

  // Bridge: store reactions/stars -> local state
  useEffect(() => {
    setPulseMessageReactions(pulseStore.reactions);
  }, [pulseStore.reactions]);

  useEffect(() => {
    setStarredPulseMessages(pulseStore.starredIds);
  }, [pulseStore.starredIds]);

  // Bridge: store active conversation -> local state
  useEffect(() => {
    setActivePulseConversation(pulseStore.activeConversationId);
  }, [pulseStore.activeConversationId]);

  // Bridge: store editing -> local state
  useEffect(() => {
    setEditingPulseMessageId(pulseStore.editingMessageId);
    setEditPulseText(pulseStore.editText);
  }, [pulseStore.editingMessageId, pulseStore.editText]);

  // Bridge: store typing -> local state
  useEffect(() => {
    setOtherUserTyping(pulseStore.otherUserTyping);
  }, [pulseStore.otherUserTyping]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pulseMessages]);

  // Real-time subscription for Pulse messages
  useEffect(() => {
    if (!currentUser?.id) return;

    const unsubscribe = pulseService.subscribeToMessages(async (newMessage) => {
      // Only process messages where current user is sender or recipient
      const isRelevant = newMessage.sender_id === currentUser.id ||
                         newMessage.recipient_id === currentUser.id;

      if (!isRelevant) return;

      // Don't add duplicate messages (e.g., from our own send)
      setPulseMessages(prev => {
        // Already present — our own send was id-swapped (see sendPulseMessage),
        // or the realtime echo arrived twice.
        if (prev.some(m => m.id === newMessage.id)) {
          return prev;
        }
        // Reconcile the optimistic placeholder this row corresponds to — and
        // ONLY that one. Match on sender + content and remove a single pending
        // temp- row, so concurrent sends (or a slower sibling whose id-swap
        // hasn't landed yet) are never swept away. Previously this stripped
        // EVERY temp- message, which dropped a just-sent message whenever a
        // different send's realtime echo arrived first — the reported
        // "last message overwritten / new message not appearing" bug.
        let reconciled = false;
        const next = prev.filter(m => {
          if (reconciled || !m.id.startsWith('temp-')) return true;
          if (m.sender_id === newMessage.sender_id && m.content === newMessage.content) {
            reconciled = true;
            return false; // drop exactly this optimistic placeholder
          }
          return true;
        });
        return [...next, newMessage];
      });

      // Refresh conversations to update preview and unread counts
      try {
        const conversations = await pulseService.getConversations();
        setPulseConversations(conversations);
      } catch (error) {
        console.error('Failed to refresh conversations:', error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id]);

  // Real-time subscription for reaction changes
  useEffect(() => {
    if (!currentUser?.id) return;

    const unsubscribe = pulseService.subscribeToReactions(async () => {
      // Reload reactions for currently visible messages
      const messageIds = pulseMessages.filter(m => !m.id.startsWith('temp-')).map(m => m.id);
      if (messageIds.length > 0) {
        const reactions = await pulseService.getReactionsForMessages(messageIds);
        setPulseMessageReactions(reactions);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id, pulseMessages]);

  // Subscribe to typing indicators for the active Pulse conversation
  useEffect(() => {
    if (!activePulseConversation) {
      setOtherUserTyping(false);
      return;
    }

    const unsubscribe = pulseService.subscribeToTyping(
      activePulseConversation,
      (isTyping) => setOtherUserTyping(isTyping)
    );

    return () => {
      unsubscribe();
      setOtherUserTyping(false);
    };
  }, [activePulseConversation]);

  // Broadcast typing status when user types in Pulse conversation
  const broadcastPulseTyping = useCallback(() => {
    if (!activePulseConversation) return;
    pulseService.broadcastTyping(activePulseConversation, true);

    // Clear previous timeout
    if (typingBroadcastTimeoutRef.current) {
      clearTimeout(typingBroadcastTimeoutRef.current);
    }
    // Stop typing after 3s of no input
    typingBroadcastTimeoutRef.current = setTimeout(() => {
      if (activePulseConversation) {
        pulseService.broadcastTyping(activePulseConversation, false);
      }
    }, 3000);
  }, [activePulseConversation]);

  // Debounced Pulse user search - trigger at 1 character for faster discovery
  useEffect(() => {
    if (!pulseUserSearch || pulseUserSearch.length < 1) {
      setPulseSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearchingPulseUsers(true);
      try {
        const results = await pulseService.searchUsers(pulseUserSearch);
        setPulseSearchResults(results);
      } catch (error) {
        console.error('Pulse user search failed:', error);
        setPulseSearchResults([]);
      } finally {
        setIsSearchingPulseUsers(false);
      }
    }, 200); // Faster response time

    return () => clearTimeout(timeout);
  }, [pulseUserSearch]);

  // Tool suggestion based on input text content (Phase 2A)
  useEffect(() => {
    if (inputText.length > 10) {
      const tools = getAllToolActions((toolId) => {
        saveRecentTool(toolId);
        // TODO: Implement actual tool launch logic via ToolOverlay
      });

      const suggestions = suggestToolsFromContext(
        {
          messageContent: inputText,
        },
        tools
      );

      if (suggestions.length > 0) {
        setSuggestedTool(suggestions[0]);
      } else {
        setSuggestedTool(null);
      }
    } else {
      setSuggestedTool(null);
    }
  }, [inputText]);

  // ─── Command palette: register Messages' tools ────────────────────────────
  // Each tool action becomes a row in the global ⌘K palette while the user is
  // in Messages. Launching a tool triggers its overlay via the same path the
  // old QuickActionsCommandPalette used.
  const messagesToolCommands = useMemo<PaletteCommand[]>(() => {
    return getAllToolActions((toolId: string) => {
      saveRecentTool(toolId);
      const overlayType = getToolOverlayType(toolId);
      if (overlayType) {
        setActiveToolOverlay(overlayType);
      } else {
        console.warn(`No overlay mapping for tool: ${toolId}`);
      }
    }).map(tool => ({
      id: `messages-tool-${tool.id}`,
      label: tool.name,
      desc: tool.description,
      kind: 'action' as const,
      // toolRegistry icons are already FA-prefixed (e.g. 'fa-robot') — don't
      // double it. Fall back to 'fa-tools' for tools without an icon.
      icon: tool.icon || 'fa-tools',
      keywords: tool.keywords,
      shortcut: tool.shortcut,
      group: 'Messages tools',
      run: tool.onLaunch,
    }));
  }, [setActiveToolOverlay]);

  useRegisterCommands('messages:tools', { commands: messagesToolCommands });

  // Tool shortcuts (Ctrl+Shift+R/V/C/I/S/M/A) are now fired by the global
  // CommandPaletteContext runner — each tool command registers its `shortcut`
  // and the runner matches the keypress against the registry. The previous
  // local handler that lived here is gone to avoid double-fires.

  // Start Pulse conversation with a user
  const startPulseConversation = useCallback(async (user: SearchUserResult) => {
    try {
      const conversationId = await pulseService.getOrCreateConversation(user.id);

      // Clear regular thread selection and switch to Pulse conversation
      setActiveThreadId('');
      setActivePulseConversation(conversationId);
      setMobileView('chat');
      setShowNewChatModal(false);
      setPulseUserSearch('');
      setPulseSearchResults([]);

      // Reload conversations to include the new one
      const conversations = await pulseService.getConversations();
      setPulseConversations(conversations);

      // Load messages for this conversation
      const messages = await pulseService.getMessages(conversationId);
      setPulseMessages(messages);
    } catch (error) {
      console.error('Failed to start Pulse conversation:', error);
    }
  }, []);

  // Select an existing Pulse conversation
  const selectPulseConversation = useCallback(async (conversationId: string) => {
    setActiveThreadId('');
    setActivePulseConversation(conversationId);
    setMobileView('chat');
    setEditingPulseMessageId(null);
    setEditPulseText('');

    try {
      // Use paginated fetch to know if there are older messages
      const { messages, hasMore } = await pulseService.getMessagesPaginated(conversationId, 50);
      setPulseMessages(messages);
      setHasMorePulseMessages(hasMore);

      // Load reactions and stars for these messages
      const messageIds = messages.map(m => m.id);
      if (messageIds.length > 0) {
        const [reactions, stars] = await Promise.all([
          pulseService.getReactionsForMessages(messageIds),
          pulseService.getStarredMessageIds()
        ]);
        setPulseMessageReactions(reactions);
        setStarredPulseMessages(stars);
      }

      // Mark messages as read
      await pulseService.markAsRead(conversationId);

      // Refresh conversations to update unread count
      const conversations = await pulseService.getConversations();
      setPulseConversations(conversations);
    } catch (error) {
      console.error('Failed to load Pulse messages:', error);
    }
  }, []);

  // Load more (older) messages for pagination
  const loadMorePulseMessages = useCallback(async () => {
    if (!activePulseConversation || isLoadingMoreMessages || !hasMorePulseMessages) return;
    setIsLoadingMoreMessages(true);

    try {
      const oldestMessage = pulseMessages[0];
      const beforeDate = oldestMessage?.created_at;
      const { messages: olderMessages, hasMore } = await pulseService.getMessagesPaginated(
        activePulseConversation, 50, beforeDate
      );

      if (olderMessages.length > 0) {
        setPulseMessages(prev => [...olderMessages, ...prev]);
        setHasMorePulseMessages(hasMore);

        // Load reactions for newly loaded messages
        const newIds = olderMessages.map(m => m.id);
        const reactions = await pulseService.getReactionsForMessages(newIds);
        setPulseMessageReactions(prev => ({ ...prev, ...reactions }));
      } else {
        setHasMorePulseMessages(false);
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMoreMessages(false);
    }
  }, [activePulseConversation, isLoadingMoreMessages, hasMorePulseMessages, pulseMessages]);

  // Send a Pulse message
  const sendPulseMessage = useCallback(async (content: string) => {
    if (!activePulseConversation || !content.trim()) {
      return;
    }

    const conversation = pulseConversations.find(c => c.id === activePulseConversation);
    if (!conversation?.other_user) {
      console.error('No conversation or other_user found for:', activePulseConversation);
      return;
    }

    // Clear input immediately for responsive UX
    const messageContent = content.trim();
    setInputText('');

    // Create a unique ID that won't conflict
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Optimistically add message to UI
    const optimisticMessage: PulseMessage = {
      id: tempId,
      sender_id: currentUser.id,
      recipient_id: conversation.other_user.id,
      thread_id: activePulseConversation,
      content: messageContent,
      content_type: 'text',
      media_url: null,
      is_read: false,
      read_at: null,
      is_deleted: false,
      deleted_at: null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add optimistic message
    setPulseMessages(prev => [...prev, optimisticMessage]);

    try {
      const messageId = await pulseService.sendMessage(conversation.other_user.id, messageContent);

      // Swap the optimistic id for the real one so the realtime
      // subscription's dedup (see line ~1031) recognises this row when
      // it arrives and skips re-appending it. Avoids the previous
      // bug where we'd refetch the full message list after every send —
      // that refetch:
      //   (a) raced with realtime and made messages appear/disappear,
      //   (b) overwrote local state with the most-recent 50, losing any
      //       older messages the user had loaded via "Load older",
      //   (c) sometimes returned BEFORE the new row was visible and
      //       briefly dropped the just-sent message from the thread.
      setPulseMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, id: messageId } : m
      ));

      // Refresh the conversation list so the preview / unread counts
      // update; the thread itself is owned by the realtime subscription.
      const conversations = await pulseService.getConversations();
      setPulseConversations(conversations);
    } catch (error) {
      console.error('Failed to send Pulse message:', error);
      // Remove optimistic message on failure
      setPulseMessages(prev => prev.filter(m => m.id !== tempId));
      // Restore the input text so user can retry
      setInputText(messageContent);
    }
  }, [activePulseConversation, pulseConversations, currentUser?.id]);

  // Get active Pulse conversation details
  const activePulseConv = pulseConversations.find(c => c.id === activePulseConversation);

  // Load reactions for currently visible messages
  const loadReactionsForMessages = useCallback(async (messages: PulseMessage[]) => {
    if (messages.length === 0) return;
    const messageIds = messages.filter(m => !m.id.startsWith('temp-')).map(m => m.id);
    if (messageIds.length === 0) return;
    const reactions = await pulseService.getReactionsForMessages(messageIds);
    setPulseMessageReactions(reactions);
  }, []);

  // Handle Pulse message reactions - persisted to Supabase
  const handlePulseReaction = useCallback(async (messageId: string, emoji: string) => {
    // Skip optimistic messages
    if (messageId.startsWith('temp-')) return;

    // Optimistic update
    setPulseMessageReactions(prev => {
      const reactions = prev[messageId] || [];
      const existingIdx = reactions.findIndex(r => r.emoji === emoji);
      if (existingIdx >= 0) {
        const updated = [...reactions];
        if (updated[existingIdx].me) {
          updated[existingIdx] = { ...updated[existingIdx], count: updated[existingIdx].count - 1, me: false };
          if (updated[existingIdx].count === 0) {
            updated.splice(existingIdx, 1);
          }
        } else {
          updated[existingIdx] = { ...updated[existingIdx], count: updated[existingIdx].count + 1, me: true };
        }
        return { ...prev, [messageId]: updated };
      }
      return { ...prev, [messageId]: [...reactions, { emoji, count: 1, me: true }] };
    });

    // Persist to Supabase
    try {
      await pulseService.toggleReaction(messageId, emoji);
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
      // Reload from server to fix optimistic mismatch
      const messageIds = pulseMessages.filter(m => !m.id.startsWith('temp-')).map(m => m.id);
      if (messageIds.length > 0) {
        const reactions = await pulseService.getReactionsForMessages(messageIds);
        setPulseMessageReactions(reactions);
      }
    }
  }, [pulseMessages]);

  // (createReactionItems removed 2026-05-31 — the RadialMenu it fed is gone;
  // reactions now run through QuickReactionsBar + FullEmojiPicker.)

  // Toggle starred Pulse messages - persisted to Supabase
  const toggleStarPulseMessage = useCallback(async (messageId: string) => {
    if (messageId.startsWith('temp-')) return;

    // Optimistic update
    setStarredPulseMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });

    // Persist to Supabase
    try {
      await pulseService.toggleStar(messageId);
    } catch (error) {
      console.error('Failed to toggle star:', error);
      // Reload from server
      const stars = await pulseService.getStarredMessageIds();
      setStarredPulseMessages(stars);
    }
  }, []);

  // Toggle bookmark for a Pulse message — persists to message_bookmarks.
  // Optimistic update on the userBookmarks state mirror.
  const toggleBookmarkPulseMessage = useCallback(async (messageId: string) => {
    if (messageId.startsWith('temp-')) return;

    const existing = userBookmarks.find(b => b.messageId === messageId);
    if (existing) {
      // Remove
      setUserBookmarks(prev => prev.filter(b => b.id !== existing.id));
      try {
        await messagePersonalService.removeBookmark(existing.id);
      } catch (err) {
        console.error('[Messages] removeBookmark failed:', err);
        // Re-add on failure
        setUserBookmarks(prev => [...prev, existing]);
      }
      return;
    }

    // Add
    const msg = pulseMessages.find(m => m.id === messageId);
    if (!msg) return;
    try {
      const row = await messagePersonalService.addBookmark({ messageId });
      setUserBookmarks(prev => [...prev, {
        id: row.id,
        messageId,
        conversationId: activePulseConversation || '',
        messagePreview: msg.content.slice(0, 200),
        sender: msg.sender_id,
        timestamp: new Date(msg.created_at),
        createdAt: new Date(row.created_at),
        note: row.note ?? undefined,
        collection: row.collection ?? undefined,
        tags: row.tags ?? [],
      }]);
    } catch (err) {
      console.error('[Messages] addBookmark failed:', err);
    }
  }, [userBookmarks, pulseMessages, activePulseConversation]);

  // Load user templates from DB on mount and whenever the user changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await messagePersonalService.listTemplates();
        if (cancelled) return;
        setUserTemplates(rows.map(r => ({
          id: r.id,
          name: r.name,
          category: r.category,
          content: r.body,
          variables: r.variables ?? [],
          usageCount: r.usage_count,
          lastUsed: r.last_used_at ?? undefined,
          createdBy: r.user_id,
          tags: r.tags ?? [],
        })));
      } catch (err) {
        console.error('[Messages] load templates failed:', err);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Load bookmarks from DB on mount and whenever the user changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await messagePersonalService.listBookmarks();
        if (cancelled) return;
        // Hydrate to legacy shape using whatever pulse messages are
        // currently in memory; rows for messages not yet loaded keep
        // a minimal preview that gets enriched on next list-load.
        setUserBookmarks(rows.map(r => {
          const msg = pulseMessages.find(m => m.id === r.message_id);
          return {
            id: r.id,
            messageId: r.message_id,
            conversationId: '',
            messagePreview: msg?.content?.slice(0, 200) ?? '',
            sender: msg?.sender_id ?? '',
            timestamp: msg ? new Date(msg.created_at) : new Date(r.created_at),
            createdAt: new Date(r.created_at),
            note: r.note ?? undefined,
            collection: r.collection ?? undefined,
            tags: r.tags ?? [],
          };
        }));
      } catch (err) {
        console.error('[Messages] load bookmarks failed:', err);
      }
    })();
    return () => { cancelled = true; };
    // pulseMessages intentionally excluded — re-running the load every
    // time the messages array changes would thrash. The hydration above
    // is best-effort; bookmark rows in the DB are the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Copy Pulse message to clipboard
  const copyPulseMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  // Share Pulse message
  const sharePulseMessage = useCallback((msg: PulseMessage) => {
    if (navigator.share) {
      navigator.share({
        title: 'Shared from Pulse',
        text: msg.content,
      }).catch(() => {
        // Fallback to copy
        navigator.clipboard.writeText(msg.content);
      });
    } else {
      navigator.clipboard.writeText(msg.content);
    }
  }, []);

  // Open the (single) MessageContextMenu for a message id, anchored beside
  // its bubble. Used by the swipe/long-press gestures below.
  const openCtxMenuForMessage = useCallback((msgId: string) => {
    const el = document.querySelector(`[data-message-id="${msgId}"]`) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const POPOVER_W = 240;
    const center = rect.left + rect.width / 2;
    const anchorX = typeof window !== 'undefined' && center > window.innerWidth / 2
      ? Math.max(0, rect.right - POPOVER_W)
      : rect.left;
    pulseCtxMenu.openFromLongPress(anchorX, rect.top, el, msgId);
  }, [pulseCtxMenu]);

  // Gesture handlers (GestureHandler wraps each bubble). Swipe-left and
  // long-press open the single MessageContextMenu; swipe-right quick-replies.
  const handleSwipeLeftDelete = useCallback((msgId: string) => {
    openCtxMenuForMessage(msgId);
  }, [openCtxMenuForMessage]);

  const handleSwipeRightReply = useCallback((msgId: string) => {
    // Use functional setState to avoid dependency on pulseMessages array
    setPulseMessages((messages) => {
      const message = messages.find(m => m.id === msgId);
      if (message) {
        setReplyingToPulseMessage(message);
      }
      return messages; // No state change, just reading
    });
  }, []);

  const handleGestureLongPress = useCallback((msgId: string) => {
    openCtxMenuForMessage(msgId);
  }, [openCtxMenuForMessage]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const draftTimeoutRef = useRef<number | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null); // For measuring sidebar width for portal positioning

  useEffect(() => {
    if (initialContactId) {
      const existingThread = threads.find(t => t.contactId === initialContactId);
      if (existingThread) {
        setActiveThreadId(existingThread.id);
        setActivePulseConversation(null);
        setMobileView('chat');
      } else {
        const contact = contacts.find(c => c.id === initialContactId);
        if (contact) createNewThread(contact);
      }
    }
  }, [initialContactId, contacts]);

  // ─── External draft prefill (e.g. Map's "I'm at…" FAB) ─────────────────────
  // Listens for `pulse:messages:draft` with { contactId, body, source }. Opens
  // the matching thread (or creates one) and prefills the compose input with
  // body. Dispatches `pulse:messages:draft:accepted` back so the sender can
  // swap its "copied to clipboard" toast for an "opened in Messages" toast.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        contactId?: string;
        body?: string;
        source?: string;
      }>).detail;
      if (!detail?.contactId || !detail.body) return;

      const existingThread = threads.find(t => t.contactId === detail.contactId);
      if (existingThread) {
        setActiveThreadId(existingThread.id);
        setActivePulseConversation(null);
        setMobileView('chat');
      } else {
        const contact = contacts.find(c => c.id === detail.contactId);
        if (contact) createNewThread(contact);
      }
      setInputText(detail.body);

      window.dispatchEvent(new CustomEvent('pulse:messages:draft:accepted', {
        detail: {
          contactId: detail.contactId,
          source: detail.source ?? 'unknown',
        },
      }));
    };
    window.addEventListener('pulse:messages:draft', handler);
    return () => window.removeEventListener('pulse:messages:draft', handler);
    // createNewThread is captured by closure — same forward-reference pattern
    // the initialContactId effect above uses. Re-binding on threads + contacts
    // is enough; createNewThread's own deps already pick up threads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, contacts]);

  const createNewThread = useCallback(async (contact: Contact) => {
      // Check if thread already exists for this contact
      const existingThread = threads.find(t => t.contactId === contact.id);
      if (existingThread) {
          setActiveThreadId(existingThread.id);
          setActivePulseConversation(null);
          setMobileView('chat');
          setShowNewChatModal(false);
          return;
      }

      const newThreadId = uuidv4();
      const newThread: Thread = {
          id: newThreadId,
          contactId: contact.id,
          contactName: contact.name,
          avatarColor: contact.avatarColor,
          messages: [],
          unread: false,
          pinned: false
      };

      // Update UI state first for responsiveness
      setShowNewChatModal(false);
      setThreads(prev => [newThread, ...prev]);
      setActiveThreadId(newThreadId);
      setActivePulseConversation(null);
      setMobileView('chat');

      // Save to database in background
      try {
          await dataService.createThread({
            contactId: newThread.contactId,
            contactName: newThread.contactName,
            avatarColor: newThread.avatarColor,
            unread: newThread.unread,
            pinned: newThread.pinned,
          });
      } catch (error) {
          console.error('Failed to save new thread:', error);
      }
  }, [threads]);

  // Handle team invitation
  const handleSendInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      setInviteStatus('error');
      setInviteMessage('Please enter a valid email address');
      return;
    }

    setInviteStatus('sending');
    setInviteMessage('');

    try {
      const inviterName = currentUser?.name || 'A team member';
      const inviterId = currentUser?.id || 'unknown';

      // Create invitation record
      const createResult = await createInvitation(
        inviteEmail.trim(),
        inviterId,
        inviterName,
        'Pulse Team'
      );

      if (!createResult.success) {
        throw new Error(createResult.message);
      }

      // Send email via user's connected Gmail account
      const emailResult = await sendInvitationViaGmail(
        inviteEmail.trim(),
        inviterName,
        createResult.inviteId || '',
        'Pulse Team'
      );

      if (emailResult.success) {
        setInviteStatus('success');
        setInviteMessage(`Invitation sent to ${inviteEmail.trim()} via your Gmail!`);

        // Clear email after short delay
        setTimeout(() => {
          setInviteEmail('');
          setInviteStatus('idle');
          setInviteMessage('');
          setShowInviteModal(false);
        }, 2000);
      } else {
        throw new Error(emailResult.message);
      }

    } catch (error: any) {
      console.error('Send invite error:', error);
      setInviteStatus('error');
      setInviteMessage(error.message || 'Failed to send invitation');
    }
  }, [inviteEmail, currentUser]);

  // Never fallback to SMS threads - SMS is now on a separate sub-page
  // Only show an active thread if explicitly selected via activeThreadId
  const activeThread = activeThreadId ? threads.find(t => t.id === activeThreadId) : null;
  const isBotChat = activeThread?.contactId === 'pulse-bot';

  // ── Path D relationship rail (Tranche 3b) ──────────────────────────
  // Normalize whichever conversation is active into RailMessage[] so the
  // host-agnostic rail derives open items / last decision / pace. The
  // legacy-thread path carries task + decision data; the Pulse-DM path
  // (PulseMessage) carries neither, so it yields pace + the "all clear"
  // empty state until the Decisions & Tasks surface is wired per-contact.
  const [railCollapsed, setRailCollapsed] = useState(false);
  // Mobile/tablet: the docked rail is hidden below xl; this opens it as a sheet.
  const [railSheetOpen, setRailSheetOpen] = useState(false);
  const railMessages: RailMessage[] = useMemo(() => {
    if (activeThread) {
      return activeThread.messages.map(m => ({
        id: m.id,
        isOutbound: m.sender === 'me',
        timestamp: new Date(m.timestamp).getTime(),
        text: m.text,
        taskTitle: m.relatedTaskId || undefined,
        decision: m.decisionData
          ? { text: m.text, status: m.decisionData.status, type: m.decisionData.type }
          : undefined,
      }));
    }
    if (activePulseConv) {
      return pulseMessages.map(m => ({
        id: m.id,
        isOutbound: m.sender_id === currentUser?.id,
        timestamp: new Date(m.created_at).getTime(),
        text: m.content,
      }));
    }
    return [];
  }, [activeThread, activePulseConv, pulseMessages, currentUser?.id]);
  const relationshipData = useMemo(() => deriveRelationship(railMessages), [railMessages]);
  // Path D intelligence spine — heuristics paint immediately, then the
  // ai-router-backed detector (server-side; no client key) upgrades them in
  // place (Phase 2). Gated off bot chats; falls back to heuristics on failure.
  const conversationMoments = useConversationMoments(railMessages, {
    conversationId: activePulseConversation || activeThreadId || null,
    enabled: !!(activePulseConv || activeThread) && !isBotChat,
  });
  const railContactName =
    activePulseConv?.other_user?.display_name ||
    activePulseConv?.other_user?.full_name ||
    activeThread?.contactName ||
    undefined;

  // Path D step 5 — per-conversation open-items + last-decision for Pulse DMs.
  // The rail's message-derived data (relationshipData) only covers legacy
  // threads; for real DMs we query extracted_tasks / decisions linked to this
  // conversation's message ids (origin_message_id / message_id), workspace-
  // scoped. Empty until the write-path links rows to messages.
  const [dmTasks, setDmTasks] = useState<ExtractedTask[]>([]);
  const [dmDecisions, setDmDecisions] = useState<Decision[]>([]);

  useEffect(() => {
    if (!activePulseConv || !currentWorkspace || pulseMessages.length === 0) {
      setDmTasks([]);
      setDmDecisions([]);
      return;
    }
    // Skip optimistic placeholders — `temp-…` ids would 22P02 the UUID `.in()` filter.
    const ids = pulseMessages.map(m => m.id).filter(id => !id.startsWith('temp-'));
    let cancelled = false;
    void Promise.all([
      taskService.getOpenTasksByMessageIds(currentWorkspace.id, ids),
      decisionService.getDecisionsByMessageIds(currentWorkspace.id, ids),
    ]).then(([tasks, decisions]) => {
      if (cancelled) return;
      setDmTasks(tasks);
      setDmDecisions(decisions);
    });
    return () => {
      cancelled = true;
    };
    // pulseMessages.length is the cheap change signal; conv/workspace id refetch.
  }, [activePulseConv?.id, currentWorkspace?.id, pulseMessages.length]);

  // Rail data: DMs use the queried tasks/decisions (pace still derives from
  // messages); legacy threads keep their message-derived data unchanged.
  const railData: RelationshipData = useMemo(() => {
    if (!activePulseConv) return relationshipData;
    const latest = dmDecisions[0];
    return {
      ...relationshipData,
      openItems: dmTasks.map(t => ({ id: t.id, title: t.title })),
      lastDecision: latest
        ? {
            id: latest.id,
            text: latest.title || (latest as { proposal_text?: string }).proposal_text || '',
            status:
              latest.status === 'decided'
                ? 'approved'
                : latest.status === 'cancelled'
                ? 'rejected'
                : 'open',
          }
        : null,
    };
  }, [activePulseConv, relationshipData, dmTasks, dmDecisions]);

  // Open-item completion. DMs: the id is a real extracted_tasks id — mark it
  // done and optimistically drop it. Legacy threads: the inline-task flow is
  // local-only (handleExtractTask just stamps relatedTaskId), so clear that link.
  const handleToggleOpenItem = useCallback(
    (id: string) => {
      if (activePulseConv) {
        setDmTasks(prev => prev.filter(t => t.id !== id));
        void taskService.updateTaskStatus(id, 'done');
        return;
      }
      if (activeThreadId) {
        setThreads(prev =>
          prev.map(t =>
            t.id === activeThreadId
              ? {
                  ...t,
                  messages: t.messages.map(m =>
                    m.id === id ? { ...m, relatedTaskId: undefined } : m,
                  ),
                }
              : t,
          ),
        );
      }
    },
    [activePulseConv, activeThreadId],
  );

  // Path D step 5b (write-path) — create a task / propose a decision FROM a
  // Pulse-DM message, persisting the message link (origin_message_id /
  // message_id) so the relationship rail surfaces it. Title is the message
  // snippet (no AI). Workspace + auth-user scoped; the decisions INSERT RLS
  // requires created_by = auth.uid(), which currentUser.id (authUser.id) is.
  const handleCreateTaskFromMessage = useCallback(
    async (msg: PulseMessage) => {
      if (!currentWorkspace || !currentUser?.id || !msg.content?.trim()) return;
      const title = msg.content.trim().replace(/\s+/g, ' ').slice(0, 120);
      const created = await taskService.createTask({
        workspace_id: currentWorkspace.id,
        origin_message_id: msg.id,
        title,
        created_by: currentUser.id,
        priority: 'medium',
        status: 'todo',
      });
      if (created) setDmTasks(prev => [created, ...prev]); // optimistic — rail updates
    },
    [currentWorkspace, currentUser?.id],
  );

  const handleProposeDecisionFromMessage = useCallback(
    async (msg: PulseMessage) => {
      if (!currentWorkspace || !currentUser?.id || !msg.content?.trim()) return;
      const title = msg.content.trim().replace(/\s+/g, ' ').slice(0, 120);
      const created = await decisionService.createDecision({
        workspace_id: currentWorkspace.id,
        message_id: msg.id,
        title,
        proposed_by: currentUser.id,
      });
      if (created) setDmDecisions(prev => [created, ...prev]); // optimistic — rail updates
    },
    [currentWorkspace, currentUser?.id],
  );

  // Generate smart compose suggestions with debounce
  useEffect(() => {
    if (!showSmartCompose || !activeThread || inputText.length < 10) return;

    const debounceTimer = setTimeout(() => {
      messageEnhancements.generateSmartSuggestions(inputText, {
        contactName: activeThread.contactName,
        recentMessages: activeThread.messages.slice(-5).map(m => m.text || '')
      });
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [inputText, activeThread, showSmartCompose, messageEnhancements]);

  // Calculate conversation health when active thread changes
  useEffect(() => {
    if (activeThread) {
      messageEnhancements.calculateConversationHealth(activeThread);
    }
  }, [activeThread?.id, messageEnhancements]);

  // Check if current thread is with a non-Pulse user (has phone number, not Pulse handle)
  const activeContact = activeThread ? contacts.find(c => c.id === activeThread.contactId) : null;
  const isNonPulseThread = activeContact && activeContact.phone && !activeContact.pulseUserId;
  const canSendNativeSms = canSendSms();
  const isViewOnlyMode = isNonPulseThread && !canSendNativeSms;

  // Handle sending SMS for non-Pulse users
  const handleSendSms = useCallback((message: string) => {
    if (!activeContact?.phone || !message.trim()) return;
    openSmsApp(activeContact.phone, message);
    setInputText('');
  }, [activeContact?.phone]);

  const filteredMessages = activeThread?.messages.filter(msg => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    return (
      msg.text.toLowerCase().includes(lowerQuery) ||
      (msg.attachment && msg.attachment.name.toLowerCase().includes(lowerQuery))
    );
  }) || [];

  const sortedThreads = [...threads].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const scrollToBottom = () => {
    if (!searchQuery) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // --- Effect: Load Context, Health, & Outcome ---
  useEffect(() => {
    const fetchContext = async () => {
        if (isBotChat || !activeThread) return;
        setLoadingContext(true);
        setCatchUpSummary(null);
        setThreadContext(null);
        setTeamHealth(null);
        setNudge(null);

        const history = activeThread.messages.map(m => `${m.sender}: ${m.text}`).join('\n');

        const [catchUp, ctx, health, nudgeRec] = await Promise.all([
            (activeThread.unread || activeThread.messages.length > 5) ? generateCatchUpSummary(history) : Promise.resolve(null),
            generateThreadContext(history),
            analyzeTeamHealth(history),
            generateNudge(history)
        ]);

        if (catchUp) setCatchUpSummary(catchUp);
        if (ctx) setThreadContext(ctx);
        if (health) setTeamHealth(health);
        if (nudgeRec) setNudge(nudgeRec);

        // Update Outcome Progress if exists
        if (activeThread.outcome) {
            const outcomeData = await analyzeOutcomeProgress(history, activeThread.outcome.goal);
            setThreads(prev => prev.map(t =>
                t.id === activeThreadId ? {
                    ...t,
                    outcome: { ...t.outcome!, ...outcomeData } as any
                } : t
            ));
        }

        setLoadingContext(false);
    };

    fetchContext();
    setSearchQuery('');
    setSummary(null);
    setReplyingTo(null);
    setDraftAnalysis(null);
    setAsyncSuggestion(null);
    setIsProposalMode(false);
    setShowHandoffCard(false);

    if (activeThread?.unread) {
       setThreads(prev => prev.map(t => t.id === activeThreadId ? { ...t, unread: false } : t));
    }
  }, [activeThreadId, activeThread]);

  // --- Effect: Draft Analysis & Meeting Detection ---
  useEffect(() => {
    if (draftTimeoutRef.current) window.clearTimeout(draftTimeoutRef.current);
    setDraftAnalysis(null);
    setAsyncSuggestion(null);

    if (inputText.length > 5 && !isBotChat) {
        draftTimeoutRef.current = window.setTimeout(async () => {
            const analysis = await analyzeDraftIntent(inputText);
            if (analysis && analysis.confidence > 0.7 && analysis.intent !== 'social') {
                setDraftAnalysis(analysis);
            }
            const deflection = await detectMeetingIntent(inputText);
            if (deflection && deflection.detected) {
                setAsyncSuggestion(deflection);
            }
        }, 800);
    }
    return () => { if (draftTimeoutRef.current) window.clearTimeout(draftTimeoutRef.current); }
  }, [inputText]);

  const toggleFocusMode = () => {
      if (focusThreadId) {
          setFocusThreadId(null);
          setFocusDigest("While you were focused:\n- Sarah sent 2 messages in 'Product'\n- New task assigned in Jira");
          setTimeout(() => setFocusDigest(null), 8000);
      } else {
          // Use Pulse conversation ID if active, otherwise use thread ID
          const focusId = activePulseConv?.id || activeThreadId;
          if (focusId) {
              setFocusThreadId(focusId);
          }
      }
  };

  const handleGenerateHandoff = async () => {
      if (isBotChat || activeThread.messages.length === 0) return;

      setLoadingHandoff(true);
      setShowHandoffCard(true);
      setHandoffContent(null);

      try {
          // Try AI-powered summary first (server-side routing).
          {
              const history = activeThread.messages.map(m => `${m.sender}: ${m.text}`).join('\n');
              const data = await generateHandoffSummary(history);
              if (data && data.context) {
                  setHandoffContent(data);
                  setLoadingHandoff(false);
                  return;
              }
          }

          // Fallback to local summary generation
          const localSummary = messagesExportService.generateLocalHandoffSummary(
              activeThread,
              activeThread.messages
          );
          setHandoffContent(localSummary);
      } catch (error) {
          console.error('Handoff generation failed:', error);
          // Fallback to local summary on error
          const localSummary = messagesExportService.generateLocalHandoffSummary(
              activeThread,
              activeThread.messages
          );
          setHandoffContent(localSummary);
      } finally {
          setLoadingHandoff(false);
      }
  };

  const handleGenerateArtifact = async () => {
      setLoadingArtifact(true);
      setShowArtifactModal(true);
      const history = activeThread.messages.map(m => `${m.sender}: ${m.text}`).join('\n');
      const data = await generateChannelArtifact(history, activeThread.contactName);
      setArtifact(data);
      setLoadingArtifact(false);
  };

  const handleSaveArtifact = async () => {
      if (artifact) {
          await saveArchiveItem({
              type: 'artifact',
              title: `Spec: ${artifact.title}`,
              content: `# ${artifact.title}\n\n## Overview\n${artifact.overview}\n\n## Spec\n${artifact.spec}\n\n## Decisions\n${artifact.decisions.map(d=>'- '+d).join('\n')}`,
              tags: ['spec', 'wiki', 'artifact', activeThread.contactName]
          });
          setShowArtifactModal(false);
          alert('Artifact saved to Archives');
      }
  };

  const handleExportToDocs = async () => {
      if (!artifact) return;
      setExportingToDocs(true);
      const content = `# ${artifact.title}\n\n${artifact.overview}\n\n${artifact.spec}\n\nDecisions:\n${artifact.decisions.join('\n')}`;
      const url = await createGoogleDoc(artifact.title, content);
      setExportingToDocs(false);
      window.open(url, '_blank');
      setShowArtifactModal(false);
  };

  const handleAnalyzeVoice = async (msgId: string, url: string) => {
      setAnalyzingAudioId(msgId);
      // Fetch audio data
      try {
          const response = await fetch(url);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(blob);
          });
          
          const analysis = await analyzeVoiceMemo(base64);
          if (analysis) {
              setThreads(prev => prev.map(t => {
                  if (t.id !== activeThreadId) return t;
                  return {
                      ...t,
                      messages: t.messages.map(m => m.id === msgId ? { ...m, voiceAnalysis: analysis } : m)
                  };
              }));
          }
      } catch (e) {
          console.error(e);
      }
      setAnalyzingAudioId(null);
  };

  useEffect(() => { scrollToBottom(); }, [activeThreadId, activeThread?.messages?.length, searchQuery, typingThreads, mobileView, catchUpSummary, showHandoffCard]);

  // Typing indicator for the active thread.
  //
  // There is intentionally NO simulated/random typing here. The real
  // per-conversation typing signal for Pulse DMs flows through the Supabase
  // broadcast channel (see `subscribeToTyping` / `otherUserTyping`). Showing a
  // fake "typing…" state the other user never triggered is dishonest and was a
  // direct cause of the "not really real-time messaging" critique. Until the
  // broadcast SEND path is wired into this surface, `typingCollaborators`
  // stays empty rather than inventing activity.
  useEffect(() => {
    if (!activeThread) {
      setTypingCollaborators([]);
    }
  }, [activeThread?.id]);

  // --- Export Messages ---
  const handleExportMessages = async (format: 'markdown' | 'json') => {
      await messagesExportService.exportMessages(activeThread, activeThread.messages, format);
      setShowExportMenu(false);
  };

  // --- Get Thread Statistics ---
  const threadStats = activeThread ? messagesExportService.getThreadStatistics(activeThread) : null;

  // --- Send Message / Proposal ---
  const handleSend = async (text: string = inputText, attachment?: Attachment) => {
    if ((!text.trim() && !attachment)) return;
    
    const newMessageId = uuidv4();
    const decisionData: DecisionData | undefined = isProposalMode ? {
        type: 'proposal',
        status: 'open',
        votes: [],
        threshold: 2
    } : undefined;

    const newMessage: Message = {
      id: newMessageId,
      sender: 'me',
      source: 'pulse',
      text: text,
      timestamp: new Date(),
      attachment,
      status: 'sent',
      replyToId: replyingTo?.id,
      decisionData
    };
    
    setThreads(prev => prev.map(t => {
      if (t.id === activeThreadId) {
        return { ...t, messages: [...t.messages, newMessage] };
      }
      return t;
    }));
    setInputText('');
    setReplyingTo(null);
    setDraftAnalysis(null);
    setAsyncSuggestion(null);
    setIsProposalMode(false); // Reset mode

    // Save message to database for persistence
    if (activeThreadId) {
      dataService.addMessage(activeThreadId, {
        sender: newMessage.sender,
        text: newMessage.text,
        timestamp: newMessage.timestamp,
        source: newMessage.source,
        attachment: newMessage.attachment,
        replyToId: newMessage.replyToId,
        status: newMessage.status,
        decisionData: newMessage.decisionData,
      }).catch(err => console.error('Failed to save message:', err));
    }

    // Track message count and trigger first message event
    const newCount = messageCount + 1;
    setMessageCount(newCount);
    if (newCount === 1) {
      triggerMessage({
        type: 'first_message_sent',
        userId: currentUser.id,
        metadata: {
          thread_id: activeThreadId,
        },
        timestamp: new Date(),
      });
      // Separately: emit the typed analytics activation event so PostHog can
      // chart the post-Stripe `surface_shown -> first_message_sent` funnel.
      // `triggerMessage` above is the in-app rule engine (different system);
      // this one is the product-analytics funnel. Both must fire — keep them
      // side by side. PostHog dedupes by workspace_id per onboardingEvents.ts.
      trackOnboarding(OnboardingEvent.FirstMessageSent, {
        workspace_id: currentWorkspace?.id,
      });
    }

    // Track achievement for message sent
    messageEnhancements.trackMessageSent();

    // Check for fast response achievement (if replying within 1 hour)
    if (activeThread?.messages.length > 0) {
      const lastOtherMsg = [...activeThread.messages].reverse().find(m => m.sender === 'other');
      if (lastOtherMsg) {
        const timeSinceLastMsg = Date.now() - new Date(lastOtherMsg.timestamp).getTime();
        if (timeSinceLastMsg < 60 * 60 * 1000) { // Within 1 hour
          messageEnhancements.trackFastResponse();
        }
      }
    }

    // Bot & Auto-Reply Simulation
    if (isBotChat) {
        setTypingThreads(prev => ({ ...prev, [activeThreadId]: true }));
        const history = activeThread.messages.map(m => ({ role: m.sender, text: m.text }));
        const response = await chatWithBot(history, text);
        setTypingThreads(prev => ({ ...prev, [activeThreadId]: false }));

        const botMsg: Message = { id: uuidv4(), sender: 'other', source:'pulse', text: response || "Error.", timestamp: new Date(), status: 'read' };
        setThreads(prev => prev.map(t => t.id === activeThreadId ? { ...t, messages: [...t.messages, botMsg] } : t));

        // Save bot reply to database
        if (activeThreadId) {
          dataService.addMessage(activeThreadId, {
            sender: botMsg.sender,
            text: botMsg.text,
            timestamp: botMsg.timestamp,
            source: botMsg.source,
            status: botMsg.status,
          }).catch(err => console.error('Failed to save bot message:', err));
        }
    } else {
        setTimeout(() => {
          setThreads(prev => prev.map(t => t.id === activeThreadId ? { ...t, messages: t.messages.map(m => m.id === newMessageId ? { ...m, status: 'delivered' } : m) } : t));
        }, 1000);
        // Simulate other user vote if it was a proposal
        if (decisionData) {
            setTimeout(() => {
                handleVote(newMessageId, 'other', 'approve');
            }, 3000);
        }
    }
  };

  // --- Decision & Voting Logic ---
  const handleVote = async (messageId: string, voterId: string, choice: 'approve' | 'reject') => {
      setThreads(prev => prev.map(t => {
          if (t.id !== activeThreadId) return t;
          const updatedMessages = t.messages.map(msg => {
              if (msg.id !== messageId || !msg.decisionData) return msg;
              
              // Remove existing vote by this user
              const otherVotes = msg.decisionData.votes.filter(v => v.userId !== voterId);
              const newVotes = [...otherVotes, { userId: voterId, choice, timestamp: new Date() }];
              
              // Check threshold
              const approvals = newVotes.filter(v => v.choice === 'approve').length;
              const newStatus: 'open' | 'approved' | 'rejected' = approvals >= msg.decisionData.threshold ? 'approved' : 'open';

              // If newly approved, save to archive
              if (msg.decisionData.status !== 'approved' && newStatus === 'approved') {
                  saveArchiveItem({
                      type: 'decision_log',
                      title: `Decision Approved in ${t.contactName}`,
                      content: msg.text,
                      tags: ['decision', 'approved', t.contactName],
                      decisionStatus: 'approved'
                  }).catch(err => console.error('Failed to save decision to archive:', err));
              }

              return { ...msg, decisionData: { ...msg.decisionData, votes: newVotes, status: newStatus } };
          });
          return { ...t, messages: updatedMessages };
      }));
  };

  // --- Outcome Logic ---
  const handleSetOutcome = () => {
      if (!outcomeGoal.trim()) return;
      setThreads(prev => prev.map(t => t.id === activeThreadId ? { 
          ...t, 
          outcome: { goal: outcomeGoal, status: 'on_track', progress: 0, blockers: [] } 
      } : t));
      setShowOutcomeSetup(false);
  };

  // --- Inline Task Logic ---
  const handleExtractTask = async (msg: Message) => {
      setCreatingTaskForMsgId(msg.id);
      const contactNames = contacts.map(c => c.name);
      const taskData = await extractTaskFromMessage(msg.text, contactNames);
      
      if (taskData) {
          // Find contact ID for assignee
          const assignee = contacts.find(c => c.name === taskData.assigneeName);
          const newTask: Task = {
              id: `task-${Date.now()}`,
              title: taskData.title || 'New Task',
              dueDate: taskData.dueDate,
              assigneeId: assignee?.id,
              originMessageId: msg.id,
              completed: false,
              listId: 'work'
          };
          
          // Link task to message (in a real app, you'd add to Tasks list too)
          setThreads(prev => prev.map(t => {
              if (t.id !== activeThreadId) return t;
              return {
                  ...t,
                  messages: t.messages.map(m => m.id === msg.id ? { ...m, relatedTaskId: newTask.title } : m)
              };
          }));
      }
      setCreatingTaskForMsgId(null);
  };

  // --- Reactions Handler ---
  const handleReaction = useCallback((messageId: string, emoji: string) => {
    setThreads(prev => prev.map(t => {
      if (t.id !== activeThreadId) return t;
      return {
        ...t,
        messages: t.messages.map(msg => {
          if (msg.id !== messageId) return msg;
          const reactions = msg.reactions || [];
          const existingIdx = reactions.findIndex(r => r.emoji === emoji);
          if (existingIdx >= 0) {
            const updated = [...reactions];
            if (updated[existingIdx].me) {
              updated[existingIdx] = { ...updated[existingIdx], count: updated[existingIdx].count - 1, me: false };
              if (updated[existingIdx].count === 0) updated.splice(existingIdx, 1);
            } else {
              updated[existingIdx] = { ...updated[existingIdx], count: updated[existingIdx].count + 1, me: true };
            }
            return { ...msg, reactions: updated };
          }
          return { ...msg, reactions: [...reactions, { emoji, count: 1, me: true }] };
        })
      };
    }));
    setShowEmojiPicker(false);
    setEmojiPickerMessageId(null);
  }, [activeThreadId]);

  // --- Smart Reply Handler ---
  const handleSmartReply = useCallback(async () => {
    if (isBotChat || !activeThread) return;
    setLoadingAI(true);
    const history = activeThread.messages.map(m => ({ role: m.sender, text: m.text }));
    const reply = await generateSmartReply(history);
    if (reply) setInputText(reply);
    setLoadingAI(false);
  }, [isBotChat, activeThread]);

  // --- TTS Handler ---
  const handleTTS = useCallback(async (text: string, id: string) => {
    if (isPlayingId) return;
    setIsPlayingId(id);
    try {
      const audioData = await generateSpeech(text);
      if (audioData) {
        if (!audioContextRef.current) audioContextRef.current = new AudioContext();
        const buffer = await decodeAudioData(audioData, audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsPlayingId(null);
        source.start();
      }
    } catch (e) {
      console.error('TTS error:', e);
    }
    setIsPlayingId(null);
  }, [isPlayingId]);

  // --- File Upload Handler ---
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // If in a Pulse conversation, upload to Supabase storage
    if (activePulseConversation && activePulseConv?.other_user) {
      try {
        await pulseService.sendMessageWithAttachment(
          activePulseConv.other_user.id,
          file,
          file.name
        );
        // Reload messages
        const messages = await pulseService.getMessages(activePulseConversation);
        setPulseMessages(messages);
        const conversations = await pulseService.getConversations();
        setPulseConversations(conversations);
      } catch (error) {
        console.error('Failed to upload file:', error);
      }
    } else {
      // Legacy thread fallback
      const isImage = file.type.startsWith('image/');
      const attachment: Attachment = {
        type: isImage ? 'image' : 'file',
        name: file.name,
        url: URL.createObjectURL(file),
        size: `${(file.size / 1024).toFixed(1)} KB`
      };
      handleSend('', attachment);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowAttachmentMenu(false);
  }, [activePulseConversation, activePulseConv]);

  // --- Image Upload Handler ---
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // If in a Pulse conversation, upload to Supabase storage
    if (activePulseConversation && activePulseConv?.other_user) {
      try {
        await pulseService.sendMessageWithAttachment(
          activePulseConv.other_user.id,
          file
        );
        const messages = await pulseService.getMessages(activePulseConversation);
        setPulseMessages(messages);
        const conversations = await pulseService.getConversations();
        setPulseConversations(conversations);
      } catch (error) {
        console.error('Failed to upload image:', error);
      }
    } else {
      const attachment: Attachment = {
        type: 'image',
        name: file.name,
        url: URL.createObjectURL(file),
        size: `${(file.size / 1024).toFixed(1)} KB`
      };
      handleSend('', attachment);
    }
    if (imageInputRef.current) imageInputRef.current.value = '';
    setShowAttachmentMenu(false);
  }, []);

  // --- Video Upload Handler ---
  const handleVideoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const attachment: Attachment = {
      type: 'video',
      name: file.name,
      url: URL.createObjectURL(file),
      size: `${(file.size / 1024).toFixed(1)} KB`
    };
    handleSend('', attachment);
    if (videoInputRef.current) videoInputRef.current.value = '';
    setShowAttachmentMenu(false);
  }, []);

  // --- Link Handler ---
  const handleAddLink = useCallback(() => {
    const url = window.prompt('Enter a URL:');
    if (url && url.trim()) {
      setInputText(prev => prev + (prev ? ' ' : '') + url.trim());
      setShowAttachmentMenu(false);
    }
  }, []);

  // Close attachment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setShowAttachmentMenu(false);
      }
    };

    if (showAttachmentMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAttachmentMenu]);

  const getMessageById = (id: string) => activeThread?.messages?.find(m => m.id === id);

  // --- NEW ENHANCED HANDLERS ---

  // Thread filtering with useMemo
  const filteredThreads = useMemo(() => {
    let filtered = [...threads];

    // Filter out archived unless viewing archived
    if (!showArchived) {
      filtered = filtered.filter(t => !archivedThreads.includes(t.id));
    } else {
      filtered = filtered.filter(t => archivedThreads.includes(t.id));
    }

    // Apply thread filter
    switch (threadFilter) {
      case 'unread':
        filtered = filtered.filter(t => t.unread);
        break;
      case 'pinned':
        filtered = filtered.filter(t => t.pinned);
        break;
      case 'with-tasks':
        filtered = filtered.filter(t => t.messages.some(m => m.relatedTaskId));
        break;
      case 'with-decisions':
        filtered = filtered.filter(t => t.messages.some(m => m.decisionData));
        break;
    }

    // Sort: pinned first, then by last message time
    return filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const aTime = a.messages[a.messages.length - 1]?.timestamp.getTime() || 0;
      const bTime = b.messages[b.messages.length - 1]?.timestamp.getTime() || 0;
      return bTime - aTime;
    });
  }, [threads, threadFilter, showArchived, archivedThreads]);

  // Virtual list for pulse conversation sidebar
  const THREAD_ITEM_HEIGHT = 72; // p-3 (12px top + 12px bottom) + h-10 avatar (40px) + ~8px line-heights
  const [threadListHeight, setThreadListHeight] = useState(600);

  // Filter out conversations with missing other_user to avoid blank gaps in virtual list
  const validPulseConversations = useMemo(
    () => pulseConversations.filter(c => c.other_user),
    [pulseConversations]
  );

  const {
    virtualItems: virtualConversations,
    totalHeight: conversationsTotalHeight,
    containerRef: threadListRef,
  } = useVirtualList({
    items: validPulseConversations,
    itemHeight: THREAD_ITEM_HEIGHT,
    containerHeight: threadListHeight,
    overscan: 5,
  });

  // Measure the thread list container height dynamically (flex-1 container has no fixed px height)
  useEffect(() => {
    const el = threadListRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const height = entries[0]?.contentRect.height;
      if (height && height > 0) setThreadListHeight(height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [threadListRef]);

  // Virtual list for mobile drawer (same items, separate scroll container)
  const [drawerListHeight, setDrawerListHeight] = useState(600);
  const {
    virtualItems: virtualDrawerConversations,
    totalHeight: drawerTotalHeight,
    containerRef: drawerListRef,
  } = useVirtualList({
    items: validPulseConversations,
    itemHeight: THREAD_ITEM_HEIGHT,
    containerHeight: drawerListHeight,
    overscan: 3,
  });

  useEffect(() => {
    const el = drawerListRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const height = entries[0]?.contentRect.height;
      if (height && height > 0) setDrawerListHeight(height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [drawerListRef]);

  // Enhanced search handler
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    let results = messagesExportService.searchMessages(threads, query);

    // Apply search filter
    switch (searchFilter) {
      case 'files':
        results = results.filter(r => r.message.attachment);
        break;
      case 'decisions':
        results = results.filter(r => r.message.decisionData);
        break;
      case 'tasks':
        results = results.filter(r => r.message.relatedTaskId);
        break;
    }

    setSearchResults(results.slice(0, 20));
  }, [threads, searchFilter]);

  // Message scheduling — wired to pulse_scheduled_messages + pg_cron.
  const loadScheduledMessages = useCallback(async () => {
    try {
      const rows = await pulseService.getScheduledMessages();
      setScheduledMessages(rows.map(r => ({
        id: r.id,
        text: r.content,
        scheduledFor: new Date(r.scheduled_for),
        threadId: '',
        recipientId: r.recipient_id,
      })));
    } catch (err) {
      console.error('[Messages] failed to load scheduled messages:', err);
    }
  }, []);

  useEffect(() => {
    void loadScheduledMessages();
  }, [loadScheduledMessages]);

  const handleScheduleMessage = useCallback(async () => {
    if (!inputText.trim() || !scheduleDate || !scheduleTime) return;

    const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledFor <= new Date()) {
      alert('Please select a future date/time');
      return;
    }

    // Scheduling is Pulse-only — needs a recipient_id. The legacy
    // SMS-thread path requires a separate persistence path (deferred).
    const recipientId = activePulseConv?.other_user?.id;
    if (!recipientId) {
      alert('Open a Pulse conversation to schedule a message.');
      return;
    }

    try {
      await pulseService.scheduleMessage(recipientId, inputText, scheduledFor);
      await loadScheduledMessages();
      setInputText('');
      setShowScheduleModal(false);
      setScheduleDate('');
      setScheduleTime('');
    } catch (err) {
      console.error('[Messages] schedule failed:', err);
      alert('Failed to schedule message. Please try again.');
    }
  }, [inputText, scheduleDate, scheduleTime, activePulseConv, loadScheduledMessages]);

  const handleCancelScheduledMessage = useCallback(async (id: string) => {
    try {
      await pulseService.cancelScheduledMessage(id);
      await loadScheduledMessages();
    } catch (err) {
      console.error('[Messages] cancel scheduled failed:', err);
    }
  }, [loadScheduledMessages]);

  // Voice recording handlers - use ref for duration to avoid stale closure
  const recordingDurationRef = useRef(0);
  useEffect(() => {
    recordingDurationRef.current = recordingDuration;
  }, [recordingDuration]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const attachment: Attachment = {
          type: 'audio',
          name: `Voice message ${new Date().toLocaleTimeString()}`,
          url: audioUrl,
          duration: recordingDurationRef.current
        };
        handleSend('🎤 Voice message', attachment);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  }, [handleSend]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  }, [isRecording]);

  // Thread actions
  const togglePinThread = useCallback((threadId: string) => {
    setThreads(prev => prev.map(t =>
      t.id === threadId ? { ...t, pinned: !t.pinned } : t
    ));
  }, []);

  const archiveThread = useCallback((threadId: string) => {
    setArchivedThreads(prev =>
      prev.includes(threadId)
        ? prev.filter(id => id !== threadId)
        : [...prev, threadId]
    );
  }, []);

  const handleDeletePulseConversation = useCallback(async (conversationId: string) => {
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;

    // Remove from local state immediately
    setPulseConversations(prev => prev.filter(c => c.id !== conversationId));

    // Clear active if this was selected
    if (activePulseConversation === conversationId) {
      setActivePulseConversation(null);
      setMobileView('list');
    }

    // Persist to DB (soft delete per-user)
    try {
      await pulseService.deleteConversation(conversationId);
    } catch (error) {
      console.error('Failed to persist conversation delete:', error);
      // Already removed from UI; no rollback needed
    }
  }, [activePulseConversation]);

  const toggleMuteThread = useCallback((threadId: string) => {
    setMutedThreads(prev =>
      prev.includes(threadId)
        ? prev.filter(id => id !== threadId)
        : [...prev, threadId]
    );
  }, []);

  // Delete thread with confirmation
  const confirmDeleteThread = useCallback((threadId: string) => {
    setThreadToDelete(threadId);
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteThread = useCallback(async () => {
    if (!threadToDelete) return;

    // Remove from local state
    setThreads(prev => prev.filter(t => t.id !== threadToDelete));

    // If deleting the active thread, clear selection
    if (activeThreadId === threadToDelete) {
      setActiveThreadId('');
      setMobileView('list');
    }

    // Try to delete from database
    try {
      await dataService.deleteThread(threadToDelete);
    } catch (error) {
      console.error('Failed to delete thread from database:', error);
    }

    setShowDeleteConfirm(false);
    setThreadToDelete(null);
  }, [threadToDelete, activeThreadId]);

  // Dismiss AI Coach tip with fade animation
  const dismissCoachTip = useCallback(() => {
    setCoachTipFading(true);
    setTimeout(() => {
      setShowCoachTip(false);
      setNudge(null);
      setCoachTipFading(false);
    }, 300);
  }, []);

  // Message editing (legacy threads)
  const startEditMessage = useCallback((msg: Message) => {
    if (msg.sender !== 'me') return;
    setEditingMessageId(msg.id);
    setEditText(msg.text);
  }, []);

  const saveEditMessage = useCallback(() => {
    if (!editingMessageId || !editText.trim()) return;
    setThreads(prev => prev.map(t => {
      if (t.id !== activeThreadId) return t;
      return {
        ...t,
        messages: t.messages.map(m =>
          m.id === editingMessageId
            ? { ...m, text: editText, status: 'sent' as const }
            : m
        )
      };
    }));
    setEditingMessageId(null);
    setEditText('');
  }, [editingMessageId, editText, activeThreadId]);

  // Pulse message editing
  const startEditPulseMessage = useCallback((msg: PulseMessage) => {
    if (msg.sender_id !== currentUser.id) return;
    setEditingPulseMessageId(msg.id);
    setEditPulseText(msg.content);
  }, [currentUser.id]);

  const saveEditPulseMessage = useCallback(async () => {
    if (!editingPulseMessageId || !editPulseText.trim()) return;

    // Optimistic update
    setPulseMessages(prev => prev.map(m =>
      m.id === editingPulseMessageId
        ? { ...m, content: editPulseText, metadata: { ...m.metadata, edited: true, edited_at: new Date().toISOString() } }
        : m
    ));
    const savedId = editingPulseMessageId;
    const savedText = editPulseText;
    setEditingPulseMessageId(null);
    setEditPulseText('');

    try {
      await pulseService.editMessage(savedId, savedText);
    } catch (error) {
      console.error('Failed to edit message:', error);
      // Reload from server on failure
      if (activePulseConversation) {
        const messages = await pulseService.getMessages(activePulseConversation);
        setPulseMessages(messages);
      }
    }
  }, [editingPulseMessageId, editPulseText, activePulseConversation]);

  const cancelEditPulseMessage = useCallback(() => {
    setEditingPulseMessageId(null);
    setEditPulseText('');
  }, []);

  // PR 2 (Surface 2) — central dispatcher for the new context-menu's
  // actions. The menu component owns its own focus / keyboard wiring;
  // this function just maps action ids back to the existing pulse
  // handlers so we avoid duplicating server calls. Edit applies the
  // locked policy in #4 (clear reactions optimistically, capture
  // original, emit toast).
  const handlePulseV2Action = useCallback((id: ContextMenuActionId, msg: PulseMessage) => {
    switch (id) {
      case 'reply':
        setReplyingToPulseMessage(msg);
        return;
      case 'react': {
        // Open the full emoji picker anchored beside the bubble (same
        // placement as the quick-bar "+"). Replaces the legacy radial menu.
        try {
          const el = document.querySelector(`[data-message-id="${msg.id}"]`) as HTMLElement | null;
          const rect = el?.getBoundingClientRect();
          const PICKER_W = 360;
          const GAP = 8;
          if (rect) {
            const center = rect.left + rect.width / 2;
            const isRightHalf = center > window.innerWidth / 2;
            setFullEmojiPicker({
              open: true,
              messageId: msg.id,
              x: isRightHalf ? rect.left - PICKER_W - GAP : rect.right + GAP,
              y: rect.top,
            });
          } else {
            setFullEmojiPicker({
              open: true,
              messageId: msg.id,
              x: window.innerWidth / 2 - PICKER_W / 2,
              y: window.innerHeight / 2 - 220,
            });
          }
        } catch {/* no-op */}
        return;
      }
      case 'copy':
        copyPulseMessage(msg.content);
        return;
      case 'edit': {
        // Locked decision #4: clear reactions optimistically + emit a
        // transient toast. The original content is captured so the
        // EditedBadge can surface it in its tooltip after save.
        setPulseEditedOriginals((prev) => ({ ...prev, [msg.id]: msg.content }));
        const hadReactions = (pulseMessageReactions[msg.id] || []).length > 0;
        if (hadReactions) {
          setPulseMessageReactions((prev) => {
            const next = { ...prev };
            delete next[msg.id];
            return next;
          });
          setPulseEditToast('(reactions cleared on edit)');
        }
        startEditPulseMessage(msg);
        return;
      }
      case 'forward':
        setForwardingMessage({
          id: msg.id,
          sender: msg.sender_id === currentUser.id ? 'me' : 'other',
          source: 'pulse',
          text: msg.content,
          timestamp: new Date(msg.created_at),
          status: 'read',
        });
        setShowForwardModal(true);
        return;
      case 'save':
        // Star plumbing (real). The "Save" label maps to star.
        toggleStarPulseMessage(msg.id);
        return;
      case 'mention': {
        // Insert a leading mention token into the composer. Pulse is
        // 1:1 today; in groups this becomes the receiver handle.
        const handle = msg.sender?.handle || msg.sender?.display_name || 'user';
        setInputText((prev) => (prev ? `@${handle} ${prev}` : `@${handle} `));
        return;
      }
      case 'create-task':
        // Path D 5b — create a task linked to this message (workspace-scoped;
        // the handler no-ops if there's no workspace). Surfaces in the rail.
        void handleCreateTaskFromMessage(msg);
        return;
      case 'propose-decision':
        void handleProposeDecisionFromMessage(msg);
        return;
      case 'share':
        sharePulseMessage(msg);
        return;
      case 'delete':
        if (typeof window !== 'undefined' && window.confirm('Delete this message?')) {
          // Optimistic remove from the local list, then persist as a
          // soft-delete on the server (is_deleted=true). If the server
          // rejects, roll back so the message reappears. Also refresh
          // the conversation list so its `last_message` preview no
          // longer shows the deleted body.
          const snapshot = msg;
          setPulseMessages((prev) => prev.filter((m) => m.id !== msg.id));
          pulseService.deleteMessage(msg.id).then(() => {
            pulseService.getConversations()
              .then(setPulseConversations)
              .catch((err) => console.error('Failed to refresh conversations after delete', err));
          }).catch((err) => {
            console.error('Failed to delete Pulse message', err);
            setPulseMessages((prev) => {
              if (prev.some((m) => m.id === snapshot.id)) return prev;
              return [...prev, snapshot].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
              );
            });
            setPulseEditToast('Could not delete message — restored');
          });
        }
        return;
    }
  }, [
    copyPulseMessage,
    currentUser.id,
    pulseMessageReactions,
    startEditPulseMessage,
    toggleStarPulseMessage,
    handleCreateTaskFromMessage,
    handleProposeDecisionFromMessage,
    sharePulseMessage,
  ]);

  // Message forwarding (legacy threads)
  const handleForwardMessage = useCallback((targetThreadId: string) => {
    if (!forwardingMessage) return;
    const forwardedMsg: Message = {
      ...forwardingMessage,
      id: `fwd-${Date.now()}`,
      sender: 'me',
      timestamp: new Date(),
      text: `↪ Forwarded:\n${forwardingMessage.text}`,
      status: 'sent'
    };
    setThreads(prev => prev.map(t =>
      t.id === targetThreadId
        ? { ...t, messages: [...t.messages, forwardedMsg] }
        : t
    ));
    setForwardingMessage(null);
    setShowForwardModal(false);
  }, [forwardingMessage]);

  // Pulse message forwarding
  const handleForwardPulseMessage = useCallback(async (messageId: string, targetRecipientId: string) => {
    try {
      await pulseService.forwardMessage(messageId, targetRecipientId);
      // Refresh conversations
      const conversations = await pulseService.getConversations();
      setPulseConversations(conversations);
    } catch (error) {
      console.error('Failed to forward message:', error);
    }
    setForwardingMessage(null);
    setShowForwardModal(false);
  }, []);

  // Use template
  // Use smart template with context-aware text generation
  const useTemplate = useCallback((template: typeof MESSAGE_TEMPLATES[0]) => {
    if (!activeThread) {
      setInputText(template.baseText);
    } else {
      const lastMsg = activeThread.messages[activeThread.messages.length - 1];
      const smartText = generateSmartTemplateText(
        template.id,
        template.baseText,
        activeThread.contactName,
        lastMsg?.sender === 'other' ? lastMsg.text : undefined
      );
      setInputText(smartText);
    }
    setShowTemplates(false);
  }, [activeThread]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter to send
      if (e.ctrlKey && e.key === 'Enter') {
        handleSend();
        return;
      }
      // Ctrl+Shift+E for emoji
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        setShowEmojiPicker(prev => !prev);
        return;
      }
      // Ctrl+Shift+F for search
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
        return;
      }
      // Ctrl+Shift+P for proposal mode (gated)
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        if (proposalModeEnabledRef.current) {
          setIsProposalMode(prev => !prev);
        }
        return;
      }
      // Ctrl+Shift+T for templates
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setShowTemplates(prev => !prev);
        return;
      }
      // Shift+F to toggle focus mode
      if (e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setIsFocusModeActive(prev => !prev);
        return;
      }
      // Escape to close modals
      if (e.key === 'Escape') {
        setShowScheduleModal(false);
        setShowTemplates(false);
        setShowEmojiPicker(false);
        setShowForwardModal(false);
        setShowShortcuts(false);
        setEditingMessageId(null);
        // Phase III.B: also blur the composer if it's focused, so J/K/E/R
        // shortcuts become reachable from the chat view (Slack pattern).
        // Skip if focus is already on body — nothing to blur.
        const active = document.activeElement as HTMLElement | null;
        if (active && active !== document.body && 'blur' in active) {
          active.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Format recording duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSourceIcon = (source?: string) => {
      switch(source) {
          case 'slack': return <Hash className="text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-white/[0.04] ring-1 ring-zinc-200 dark:ring-white/[0.06] rounded p-0.5 text-[8px]" />;
          case 'email': return <Mail className="text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-white/[0.04] ring-1 ring-zinc-200 dark:ring-white/[0.06] rounded p-0.5 text-[8px]" />;
          case 'sms': return <MessageSquare className="text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-white/[0.04] ring-1 ring-zinc-200 dark:ring-white/[0.06] rounded p-0.5 text-[8px]" />;
          default: return null;
      }
  };

  // Handler to go back to message list (must be before any early returns)
  const handleBackToList = useCallback(() => {
    setActiveThreadId('');
    setActivePulseConversation(null);
    setMobileView('list');
  }, []);

  // Phase III: J/K/Enter cursor navigation, R focus composer, ? shortcuts
  // MUST be before any early returns (Rules of Hooks).
  const keyboardDisabled =
    showFeatureSettings || showOutcomeSetup ||
    showStatsPanel || showHandoffCard || showThemeSelector ||
    showInviteModal || showNewChatModal || showAnalyticsDashboard ||
    showShortcuts || showToolsDrawer || showArtifactModal;

  const { cursorConvId } = useMessagesKeyboardShortcuts({
    conversations: pulseConversations,
    activeConversationId: activePulseConversation,
    onSelectConversation: (id: string) => {
      selectPulseConversation(id);
      closeDrawer();
    },
    onFocusComposer: () => {
      const el = document.querySelector('[data-composer="pulse"]');
      if (el && 'focus' in el) (el as HTMLElement).focus();
    },
    onArchiveConversation: (id: string) => {
      messageEnhancements.toggleThreadArchive(id);
    },
    onToggleShortcutsOverlay: () => setShowShortcuts(prev => !prev),
    disabled: keyboardDisabled,
  });

  // Loading state
  if (isLoading) {
    // Lazy import EnhancedLoadingScreen to avoid circular dependencies
    const EnhancedLoadingScreen = lazy(() => import('./EnhancedLoadingScreen'));
    return (
      <Suspense fallback={
        <div className="h-full flex items-center justify-center bg-[#f8f8f8] dark:bg-black">
          <div className="text-center">
            <Loader2 className="text-3xl text-rose-500 dark:text-rose-bright mb-4 animate-spin" />
            <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
          </div>
        </div>
      }>
        <EnhancedLoadingScreen currentStageLabel="Loading conversations..." contained />
      </Suspense>
    );
  }

  // Cellular SMS Sub-page
  if (showCellularSMS) {
    return (
      <div className="h-full bg-[#f8f8f8] dark:bg-black rounded-2xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] overflow-hidden">
        <CellularSMS
          onBack={() => {
            setShowCellularSMS(false);
            setActiveSmsThreadId(null);
          }}
          threads={threads}
          contacts={contacts}
          onSelectThread={(threadId) => setActiveSmsThreadId(threadId)}
          onSendMessage={(threadId, text) => {
            // Send SMS message
            const newMsg: Message = {
              id: `msg-${Date.now()}`,
              text,
              timestamp: new Date(),
              isOutgoing: true,
              source: 'sms',
            };
            setThreads(prev => prev.map(t =>
              t.id === threadId
                ? { ...t, messages: [...t.messages, newMsg] }
                : t
            ));
          }}
          onDeleteThread={confirmDeleteThread}
          onPinThread={togglePinThread}
          onCreateThread={async (contact) => {
            // Check if thread already exists for this contact
            let thread = threads.find(t => t.contactId === contact.id);
            if (thread) {
              setActiveSmsThreadId(thread.id);
              return;
            }
            
            // Create new thread directly (similar to createNewThread but for SMS context)
            const newThreadId = uuidv4();
            const newThread: Thread = {
              id: newThreadId,
              contactId: contact.id,
              contactName: contact.name,
              avatarColor: contact.avatarColor,
              messages: [],
              unread: false,
              pinned: false
            };
            
            // Update threads state
            setThreads(prev => [newThread, ...prev]);
            setActiveSmsThreadId(newThreadId);
            
            // Save to database in background
            try {
              await dataService.createThread({
                contactId: newThread.contactId,
                contactName: newThread.contactName,
                avatarColor: newThread.avatarColor,
                unread: newThread.unread,
                pinned: newThread.pinned,
              });
            } catch (error) {
              console.error('Failed to save new thread:', error);
            }
          }}
          activeThreadId={activeSmsThreadId}
        />
      </div>
    );
  }

  // Phase B — Triage Brief replaces the dashed-border SaaS empty state.
  // Right pane at rest answers "what needs me now?" instead of pitching CTA.
  // Mobile: hidden when the user is on the list view.
  const renderEmptyChatArea = () => (
    <div className={`flex-1 flex ${mobileView === 'list' ? 'max-md:hidden' : ''}`}>
      <TriageBrief
        pulseConversations={pulseConversations}
        onOpenConversation={(convId) => {
          setActivePulseConversation(convId);
          setActiveThreadId('');
          setMobileView('chat');
        }}
        onNewConversation={() => setShowNewChatModal(true)}
      />
    </div>
  );

  // Handler to close drawer when selecting a conversation on mobile
  const handleSelectConversation = (convId: string) => {
    selectPulseConversation(convId);
    closeDrawer(); // Close drawer after selection on mobile
  };

  return (
    <div className={`${fullPage ? 'h-screen' : 'h-full'} flex bg-[#f8f8f8] dark:bg-black ${fullPage ? '' : 'rounded-2xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] shadow-xl'} overflow-hidden relative animate-fade-in`}>
      
      <MessagesTopModals
        showNewChatModal={showNewChatModal}
        setShowNewChatModal={setShowNewChatModal}
        pulseUserSearch={pulseUserSearch}
        setPulseUserSearch={setPulseUserSearch}
        pulseSearchResults={pulseSearchResults}
        setPulseSearchResults={setPulseSearchResults}
        isSearchingPulseUsers={isSearchingPulseUsers}
        recentPulseContacts={recentPulseContacts}
        suggestedPulseUsers={suggestedPulseUsers}
        startPulseConversation={startPulseConversation}
        showArtifactModal={showArtifactModal}
        setShowArtifactModal={setShowArtifactModal}
        loadingArtifact={loadingArtifact}
        artifact={artifact}
        exportingToDocs={exportingToDocs}
        handleExportToDocs={handleExportToDocs}
        handleSaveArtifact={handleSaveArtifact}
        showScheduleModal={showScheduleModal}
        setShowScheduleModal={setShowScheduleModal}
        inputText={inputText}
        scheduleDate={scheduleDate}
        scheduleTime={scheduleTime}
        setScheduleDate={setScheduleDate}
        setScheduleTime={setScheduleTime}
        scheduledMessages={scheduledMessages}
        handleScheduleMessage={handleScheduleMessage}
        showForwardModal={showForwardModal}
        setShowForwardModal={setShowForwardModal}
        forwardingMessage={forwardingMessage}
        threads={threads}
        activeThreadId={activeThreadId}
        handleForwardMessage={handleForwardMessage}
        handleForwardPulseMessage={handleForwardPulseMessage}
        showShortcuts={showShortcuts}
        setShowShortcuts={setShowShortcuts}
        showStatsPanel={showStatsPanel}
        setShowStatsPanel={setShowStatsPanel}
        activeThread={activeThread}
        showInviteModal={showInviteModal}
        setShowInviteModal={setShowInviteModal}
        inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail}
        inviteStatus={inviteStatus}
        setInviteStatus={setInviteStatus}
        inviteMessage={inviteMessage}
        setInviteMessage={setInviteMessage}
        handleSendInvite={handleSendInvite}
        showDeleteConfirm={showDeleteConfirm}
        setShowDeleteConfirm={setShowDeleteConfirm}
        threadToDelete={threadToDelete}
        setThreadToDelete={setThreadToDelete}
        handleDeleteThread={handleDeleteThread}
        isDrawerOpen={isDrawerOpen}
        closeDrawer={closeDrawer}
        setShowCellularSMS={setShowCellularSMS}
        pulseConversations={pulseConversations}
        drawerListRef={drawerListRef}
        drawerTotalHeight={drawerTotalHeight}
        virtualDrawerConversations={virtualDrawerConversations}
        activePulseConversation={activePulseConversation}
        handleSelectConversation={handleSelectConversation}
      />

      <ConversationSidebar
        sidebarRef={sidebarRef}
        mobileView={mobileView}
        setShowInviteModal={setShowInviteModal}
        setShowCellularSMS={setShowCellularSMS}
        setShowShortcuts={setShowShortcuts}
        setShowNewChatModal={setShowNewChatModal}
        threadFilter={threadFilter}
        setThreadFilter={setThreadFilter}
        showArchived={showArchived}
        setShowArchived={setShowArchived}
        searchInputRef={searchInputRef}
        searchQuery={searchQuery}
        handleSearch={handleSearch}
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
        searchResults={searchResults}
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
        setActiveThreadId={setActiveThreadId}
        setActivePulseConversation={setActivePulseConversation}
        setMobileView={setMobileView}
        setSearchQuery={setSearchQuery}
        setSearchResults={setSearchResults}
        threadListRef={threadListRef}
        pulseConversations={pulseConversations}
        conversationsTotalHeight={conversationsTotalHeight}
        virtualConversations={virtualConversations}
        activePulseConversation={activePulseConversation}
        setSelectedContactUserId={setSelectedContactUserId}
        setShowContactPanel={setShowContactPanel}
        handleSelectConversation={handleSelectConversation}
        messageEnhancements={messageEnhancements}
        handleDeletePulseConversation={handleDeletePulseConversation}
        threads={threads}
        conversationTags={conversationTags}
        cursorConvId={cursorConvId}
        onJumpToConversation={(conversationId, kind) => {
          // Phase 7b — fired-reminder click navigation. Currently DM
          // only; a fired reminder for a workspace channel would route
          // through different state.
          if (kind === 'dm') {
            setActivePulseConversation(conversationId);
            setActiveThreadId('');
            setMobileView('chat');
          }
        }}
      />

      {/* Main Chat Area - 70% width on desktop for split-view */}
      {/* Pulse Conversation View */}
      {activePulseConv && !activeThread && (
        <div className={`flex-1 flex flex-col min-w-0 bg-[#f8f8f8] dark:bg-black ${mobileView === 'list' ? 'max-md:hidden' : ''}`}>
          {/* Pulse Chat Header - Fixed at top */}
          <div className="min-h-16 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between px-4 py-2 z-10 bg-[#f8f8f8]/95 dark:bg-black/95 flex-shrink-0 mobile-header-safe">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Button (visible only on mobile) */}
              <button onClick={openDrawer} className="md:hidden text-zinc-500 w-12 h-12 flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] rounded-lg transition" title="Open menu">
                <Menu />
              </button>
              {/* Desktop Back Button (visible only on mobile when chat is active) */}
              <button onClick={handleBackToList} className="max-md:hidden text-zinc-500 w-12 h-12 flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] rounded-lg transition" title="Back to messages">
                <ArrowLeft />
              </button>
              <button
                onClick={() => {
                  if (activePulseConv.other_user?.id) {
                    setSelectedContactUserId(activePulseConv.other_user.id);
                    setShowContactPanel(true);
                  }
                }}
                className="w-10 h-10 rounded-full bg-rose-500/15 dark:bg-rose-500/15 flex items-center justify-center text-rose-700 dark:text-rose-300 text-sm font-medium flex-shrink-0 relative hover:bg-rose-500/20 dark:hover:bg-rose-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                title="View contact details"
              >
                {activePulseConv.other_user?.avatar_url ? (
                  <img src={activePulseConv.other_user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  (activePulseConv.other_user?.display_name || activePulseConv.other_user?.handle || '?').charAt(0).toUpperCase()
                )}
                {/* Online indicator */}
                {activePulseConv.other_user?.id && (
                  <div className="absolute -bottom-0.5 -right-0.5">
                    <OnlineIndicator userId={activePulseConv.other_user.id} size="medium" />
                  </div>
                )}
              </button>
              <div className="flex flex-col min-w-0">
                <span
                  className="font-medium leading-tight flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100 truncate"
                >
                  {activePulseConv.other_user?.display_name || activePulseConv.other_user?.full_name || 'Unknown'}
                  {activePulseConv.other_user?.is_verified && (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                      <UserBadge role="member" size="sm" showIcon={false} showLabel={true} />
                    </>
                  )}
                </span>
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500">
                  {activePulseConv.other_user?.handle && (
                    <span>@{activePulseConv.other_user.handle}</span>
                  )}
                  {activePulseConv.other_user?.id && (
                    <OnlineIndicator userId={activePulseConv.other_user.id} showText={true} />
                  )}
                </div>
              </div>
            </div>

            {/* Inline Search Bar */}
            <div className="flex-1 max-w-md mx-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                  className="w-full bg-zinc-50 dark:bg-white/[0.03] border border-transparent rounded-lg px-3 py-2 text-sm pl-9 outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/40 dark:text-white transition"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 text-xs" />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                    <X className="text-xs" />
                  </button>
                )}
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Path D: relationship rail trigger — mobile/tablet only (the
                  docked rail is hidden below xl). Opens the rail as a sheet. */}
              <button
                type="button"
                onClick={() => setRailSheetOpen(true)}
                className="xl:hidden relative w-12 h-12 flex items-center justify-center rounded-lg hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                title="Relationship"
                aria-label="Show relationship panel"
              >
                <PanelRightOpen className="text-zinc-600 dark:text-zinc-400 w-5 h-5" />
                {railData.openItems.length > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-0.5 rounded-full inline-flex items-center justify-center text-[9px] font-mono font-semibold tabular-nums"
                    style={{ color: 'var(--pulse-tone-warning)', background: 'var(--pulse-tone-warning-soft)' }}
                  >
                    {railData.openItems.length}
                  </span>
                )}
              </button>
              {/* Phase 7b: Tag picker — only when there's an active
               *  workspace (tag definitions are workspace-scoped). */}
              {activePulseConversation && currentWorkspace && (
                <TagPicker
                  workspaceId={currentWorkspace.id}
                  conversationKind="dm"
                  conversationId={activePulseConversation}
                  currentTags={conversationTags[activePulseConversation] ?? []}
                  onChanged={() => void refreshTagsFor(activePulseConversation)}
                />
              )}
              {/* Phase 7b: Snooze / "remind me about this thread" */}
              {activePulseConversation && (
                <SnoozeMenu
                  conversationKind="dm"
                  conversationId={activePulseConversation}
                  defaultNote={
                    activePulseConv?.last_message_preview ?? undefined
                  }
                />
              )}
              {/* Feature Settings Button */}
              <button
                onClick={() => setShowFeatureSettings(true)}
                className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] transition-colors"
                title="Feature Settings"
                aria-label="Open feature settings"
              >
                <SlidersHorizontal className="fa text-zinc-600 dark:text-zinc-400" />
              </button>
            </div>

          </div>

          {/* Pulse Message Search Panel */}
          {isSearchOpen && (
            <div className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] p-3 animate-slide-down">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search messages in this conversation..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm pl-9 outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/40"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 text-xs" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                      <X className="text-xs" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
                  className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
              {searchQuery && (
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {pulseMessages
                    .filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
                    .slice(0, 10)
                    .map(msg => (
                      <div
                        key={msg.id}
                        className="p-2 rounded-lg bg-white dark:bg-[rgba(255,255,255,0.055)] border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.10)] cursor-pointer hover:border-rose-500/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400 mb-1">
                          <span className="font-medium">
                            {msg.sender_id === activePulseConv?.other_user?.id
                              ? activePulseConv?.other_user?.display_name || 'User'
                              : 'You'}
                          </span>
                          <span>•</span>
                          <span>{new Date(msg.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-2">
                          {msg.content.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                            part.toLowerCase() === searchQuery.toLowerCase()
                              ? <mark key={i} className="bg-rose-500/20 dark:bg-rose-500/25 text-rose-700 dark:text-rose-200 px-0.5 rounded">{part}</mark>
                              : part
                          )}
                        </div>
                      </div>
                    ))}
                  {searchQuery && pulseMessages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="text-center py-4 text-sm text-zinc-500">
                      No messages found matching "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tools Panel Drawer — WRITE / ANALYZE / COACH taxonomy.
              Each row: Lucide icon · name · one-line description.
              Inline tools (Smart Compose, AI Coach, AI Mediator) flip a
              boolean and reveal a panel above the input; overlay tools
              open a tabbed surface and dock to a panel slot. */}
          <AnimatePresence>
            {showToolsDrawer && (() => {
              type DrawerRow = {
                id: string;
                Icon: React.ComponentType<{ className?: string }>;
                name: string;
                description: string;
                onActivate: () => void;
              };

              const closeAndRun = (fn: () => void) => () => {
                fn();
                setShowToolsDrawer(false);
              };

              const writeRows: DrawerRow[] = [
                {
                  id: 'smart-compose',
                  Icon: Wand2,
                  name: 'Smart Compose',
                  description: 'Draft suggestions and quick phrases',
                  onActivate: closeAndRun(() => {
                    setShowSmartCompose(true);
                    setShowQuickPhrases(false);
                  }),
                },
                {
                  id: 'templates',
                  Icon: FileText,
                  name: 'Templates',
                  description: 'Saved phrases with variables',
                  onActivate: closeAndRun(() => setActiveToolOverlay('productivity' as any)),
                },
                {
                  id: 'message-formatting',
                  Icon: Bold,
                  name: 'Format',
                  description: 'Bold, italic, code, list, quote, link',
                  onActivate: closeAndRun(() => setActiveToolOverlay('personalization' as any)),
                },
                {
                  id: 'translation',
                  Icon: Languages,
                  name: 'Translate',
                  description: 'Live translation, received and draft',
                  onActivate: closeAndRun(() => setActiveToolOverlay('mediaHub' as any)),
                },
              ];

              const analyzeRows: DrawerRow[] = [
                {
                  id: 'conversation-summary',
                  Icon: ListChecks,
                  name: 'Conversation Summary',
                  description: 'LLM recap on demand',
                  onActivate: closeAndRun(() => setActiveToolOverlay('productivity' as any)),
                },
                {
                  id: 'pace',
                  Icon: Timer,
                  name: 'Pace',
                  description: 'Engagement and response-time charts',
                  onActivate: closeAndRun(() => setActiveToolOverlay('analytics' as any)),
                },
                {
                  id: 'sentiment',
                  Icon: Smile,
                  name: 'Sentiment',
                  description: 'Tone of the message and thread trend',
                  onActivate: closeAndRun(() => setActiveToolOverlay('proactive' as any)),
                },
                {
                  id: 'conversation-flow',
                  Icon: GitFork,
                  name: 'Conversation Flow',
                  description: 'Message rhythm and turn-taking',
                  onActivate: closeAndRun(() => setActiveToolOverlay('analytics' as any)),
                },
              ];

              const coachRows: DrawerRow[] = [
                {
                  id: 'ai-coach',
                  Icon: GraduationCap,
                  name: 'AI Coach',
                  description: 'Real-time draft critique and rewrites',
                  onActivate: closeAndRun(() => setShowAICoach(true)),
                },
                {
                  id: 'ai-mediator',
                  Icon: Handshake,
                  name: 'AI Mediator',
                  description: 'De-escalation when conflict signals appear',
                  onActivate: closeAndRun(() => setShowAIMediator(true)),
                },
                {
                  id: 'insights',
                  Icon: Lightbulb,
                  name: 'Insights',
                  description: 'Patterns and themes across the thread',
                  onActivate: closeAndRun(() => setActiveToolOverlay('security' as any)),
                },
              ];

              const sectionLabel = "px-2 pt-4 pb-1.5 text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500";
              const rowClass = "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.04] text-zinc-700 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-bright transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40";
              const iconClass = "w-4 h-4 mt-0.5 text-zinc-400 dark:text-zinc-500 group-hover:text-rose-500 dark:group-hover:text-rose-bright flex-shrink-0";

              const renderRow = (row: DrawerRow) => (
                <button key={row.id} type="button" onClick={row.onActivate} className={rowClass}>
                  <row.Icon className={iconClass} />
                  <span className="flex-1 text-left min-w-0">
                    <span className="block text-sm leading-tight">{row.name}</span>
                    <span className="block text-[11px] text-zinc-500 dark:text-zinc-500 mt-0.5 leading-snug">{row.description}</span>
                  </span>
                </button>
              );

              const totalTools = writeRows.length + analyzeRows.length + coachRows.length;

              return (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]"
                  onClick={() => setShowToolsDrawer(false)}
                />
                {/* Drawer Panel */}
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="fixed right-0 top-0 bottom-0 w-80 bg-white dark:bg-black border-l border-zinc-200/60 dark:border-white/[0.06] shadow-2xl z-[91] flex flex-col"
                  role="dialog"
                  aria-label="Tools menu"
                >
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200/60 dark:border-white/[0.06]">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-700 dark:text-zinc-200">MESSAGE TOOLS</span>
                      <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500 tabular-nums">· {totalTools}</span>
                    </div>
                    <button
                      onClick={() => setShowToolsDrawer(false)}
                      className="w-7 h-7 rounded-lg text-zinc-500 hover:text-rose-500 dark:hover:text-rose-bright hover:bg-zinc-100 dark:hover:bg-white/[0.04] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                      aria-label="Close tools"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Tools List */}
                  <div className="flex-1 overflow-y-auto px-2 py-1">
                    <div className={`${sectionLabel} pt-2`}>WRITE · {writeRows.length}</div>
                    <div className="space-y-0.5">{writeRows.map(renderRow)}</div>

                    <div className={sectionLabel}>ANALYZE · {analyzeRows.length}</div>
                    <div className="space-y-0.5">{analyzeRows.map(renderRow)}</div>

                    <div className={sectionLabel}>COACH · {coachRows.length}</div>
                    <div className="space-y-0.5 pb-2">{coachRows.map(renderRow)}</div>
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2.5 border-t border-zinc-200/60 dark:border-white/[0.06]">
                    <p className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500 text-center">
                      <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-white/[0.06] rounded text-[9px] font-mono">Esc</kbd>{' '}to close
                    </p>
                  </div>
                </motion.div>
              </>
              );
            })()}
          </AnimatePresence>

          {/* Tools Menu V2 — new slim 4-tile menu. Renders when
              `toolsMenuV2` flag is on AND the header tools button was
              clicked. Replaces the legacy showToolsDrawer flow at the
              same trigger. threadId / messageCount drive the tile
              visibility state machine (Summary / Insights / Audit). */}
          <ToolsMenuV2
            open={showToolsMenuV2}
            threadId={activePulseConv?.id ?? activeThread?.id ?? 'unknown-thread'}
            messageCount={
              activePulseConv
                ? pulseMessages.length
                : activeThread?.messages?.length ?? 0
            }
            isDarkMode={typeof document !== 'undefined' && document.documentElement.classList.contains('dark')}
            onClose={() => setShowToolsMenuV2(false)}
          />

          {/* Theme Picker Popup */}
          {showThemeSelector && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-[100]"
                onClick={() => setShowThemeSelector(false)}
              />
              {/* Picker positioned in top-right area */}
              <div className="fixed top-20 right-4 z-[101]">
                <StandaloneThemePicker
                  onClose={() => setShowThemeSelector(false)}
                  onColorPairChange={(pair) => setSelectedColorPair(pair)}
                  initialColorPairId={selectedColorPair.id}
                />
              </div>
            </>
          )}

          {/* Fullscreen Tool Overlay - slides down from top, covers chat area */}
          <React.Suspense fallback={<FeatureSkeleton />}>
            <ToolOverlay
              activeTool={activeToolOverlay}
              onClose={closeAllPanels}
              conversationId={activePulseConv?.id}
              otherUserId={activePulseConv?.other_user?.id}
              analyticsView={analyticsView}
              setAnalyticsView={setAnalyticsView}
              collaborationTab={collaborationTab}
              setCollaborationTab={setCollaborationTab}
              productivityTab={productivityTab}
              setProductivityTab={setProductivityTab}
              intelligenceTab={intelligenceTab}
              setIntelligenceTab={setIntelligenceTab}
              proactiveTab={proactiveTab}
              setProactiveTab={setProactiveTab}
              communicationTab={communicationTab}
              setCommunicationTab={setCommunicationTab}
              personalizationTab={personalizationTab}
              setPersonalizationTab={setPersonalizationTab}
              securityTab={securityTab}
              setSecurityTab={setSecurityTab}
              mediaHubTab={mediaHubTab}
              setMediaHubTab={setMediaHubTab}
            />
          </React.Suspense>

          {/* Pulse Messages - Scrollable area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {/* Load More button for pagination */}
            {hasMorePulseMessages && (
              <div className="flex justify-center mb-4">
                <button
                  type="button"
                  onClick={loadMorePulseMessages}
                  disabled={isLoadingMoreMessages}
                  className="px-4 py-2 text-xs font-medium rounded-full bg-[#f2f2f2] dark:bg-[rgba(255,255,255,0.055)] text-zinc-600 dark:text-zinc-400 hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.10)] transition disabled:opacity-50"
                >
                  {isLoadingMoreMessages ? 'Loading...' : 'Load older messages'}
                </button>
              </div>
            )}
            {pulseMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-20 h-20 bg-rose-500/10 dark:bg-rose-500/15 ring-1 ring-rose-500/20 dark:ring-rose-500/30 rounded-full flex items-center justify-center mb-4">
                  <MessagesSquare className="text-3xl text-rose-500 dark:text-rose-bright" />
                </div>
                <h3 className="text-lg font-bold dark:text-white mb-2">Start a Conversation</h3>
                <p className="text-sm text-zinc-500 max-w-sm">
                  Send a message to {activePulseConv.other_user?.display_name || activePulseConv.other_user?.handle || 'this user'} to start chatting!
                </p>
              </div>
            ) : (
              pulseMessages.map((msg, idx) => {
                const isMe = msg.sender_id !== activePulseConv.other_user?.id;
                // The latest own-message in the thread carries the
                // DELIVERED / READ receipt. Older own-messages stay quiet.
                const isLatestOwn = isMe && pulseMessages
                  .slice(idx + 1)
                  .every((m) => m.sender_id === activePulseConv.other_user?.id);

                const prevMsg = idx > 0 ? pulseMessages[idx - 1] : null;
                const nextMsg = idx < pulseMessages.length - 1 ? pulseMessages[idx + 1] : null;

                // Date divider state — computed first so grouping can reference it.
                const showDate = shouldShowDateDivider(prevMsg ? new Date(prevMsg.created_at) : null, new Date(msg.created_at));

                // Message grouping: consecutive messages from the same sender on the same date.
                // A date divider always breaks the group; otherwise same-sender stacks tight
                // regardless of time gap. Mirrors iMessage's visual rhythm for spread-out chats.
                const isSameSender = prevMsg?.sender_id === msg.sender_id;
                const isGrouped = isSameSender && !showDate;

                const showAvatar = !isGrouped;
                const senderLabel = isMe
                  ? 'YOU'
                  : (activePulseConv.other_user?.display_name || activePulseConv.other_user?.handle || 'UNKNOWN').toUpperCase();
                const messageTime = new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

                const reactions = pulseMessageReactions[msg.id] || [];
                const isStarred = starredPulseMessages.has(msg.id);
                const isReplyTarget = replyingToPulseMessage?.id === msg.id;

                return (
                  <React.Fragment key={msg.id}>
                    {/* Modern Date Divider */}
                    {showDate && (
                      <DateDivider 
                        date={new Date(msg.created_at)} 
                        label={formatDateDivider(new Date(msg.created_at))} 
                      />
                    )}
                    <div className="flex">
                    {/* Path D intelligence spine — fixed-left timeline gutter (1b) */}
                    <SpineNode
                      moment={conversationMoments.get(msg.id)}
                      index={idx}
                      isFirst={idx === 0}
                      isLast={idx === pulseMessages.length - 1}
                    />
                    <div
                      data-grouped={isGrouped ? 'true' : 'false'}
                      data-pulse-msg-row="true"
                      className={`flex-1 min-w-0 flex ${isMe ? 'justify-end' : 'justify-start'} group relative ${isGrouped ? 'mb-0.5' : 'mb-3'}`}
                    >
                      {!isMe && showAvatar && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs mr-2 mt-auto flex-shrink-0 bg-rose-500/15 ring-1 ring-rose-500/30 text-rose-700 dark:text-rose-300 font-medium"
                        >
                          {activePulseConv.other_user?.avatar_url ? (
                            <img src={activePulseConv.other_user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            (activePulseConv.other_user?.display_name || '?').charAt(0).toUpperCase()
                          )}
                        </div>
                      )}
                      {!isMe && !showAvatar && <div className="w-8 mr-2"></div>}

                      <div className={`max-w-[70%] sm:max-w-[75%] md:max-w-[70%] relative flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {/* Mono sender · time header — first message of a received block.
                            Sits ABOVE the GestureHandler so flex alignment on the column applies. */}
                        {!isGrouped && !isMe && (
                          <div className="msg-sender-header">
                            <span className="msg-sender-name">{senderLabel}</span>
                            <span className="msg-sep" aria-hidden="true">·</span>
                            <span className="msg-timestamp">{messageTime}</span>
                          </div>
                        )}

                        {/* Star indicator */}
                        {isStarred && (
                          <div className={`absolute -top-2 ${isMe ? '-left-2' : '-right-2'} z-10`}>
                            <Star className="text-rose-500/70 dark:text-rose-bright/70 text-xs" />
                          </div>
                        )}

                        {/* Reply indicator */}
                        {isReplyTarget && (
                          <div className="absolute -top-6 left-0 right-0 flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-bright">
                            <Reply />
                            <span>Replying to this message</span>
                          </div>
                        )}

                        {/* Message bubble with gestures and hover-triggered reactions */}
                        <GestureHandler
                          onSwipeLeft={() => handleSwipeLeftDelete(msg.id)}
                          onSwipeRight={() => handleSwipeRightReply(msg.id)}
                          onLongPress={() => handleGestureLongPress(msg.id)}
                          swipeThreshold={80}
                          longPressDelay={500}
                          ariaLabel={`Message from ${isMe ? 'you' : activePulseConv.other_user?.display_name || 'user'}`}
                          enableKeyboard={false}
                        >
                          <HoverReactionTrigger
                            messageId={msg.id}
                            isMe={isMe}
                            onReact={(messageId, emoji) => handlePulseReaction(messageId, emoji)}
                            hoverDelay={300}
                            enableMobileLongPress={false}
                            // Suppress the hover-bar whenever the
                            // MessageContextMenu is open. Prevents the dual-
                            // menu state where both the quick-reactions bar
                            // and the right-click menu render at once.
                            disabled={pulseCtxMenu.isOpen}
                          renderReactionBar={({ onReact, position, isExiting }) => (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: 8 }}
                              animate={{
                                opacity: isExiting ? 0 : 1,
                                scale: isExiting ? 0.9 : 1,
                                y: isExiting ? 8 : 0
                              }}
                              transition={{
                                duration: 0.2,
                                ease: [0.4, 0, 0.2, 1]
                              }}
                              className="flex items-center gap-1 p-1.5 bg-white dark:bg-[rgba(255,255,255,0.055)] rounded-full shadow-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.10)]"
                              style={{ ...position }}
                            >
                              {COMMON_REACTIONS.map((emoji, index) => (
                                <motion.button
                                  key={emoji}
                                  initial={{ opacity: 0, scale: 0.5 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{
                                    duration: 0.15,
                                    delay: index * 0.03,
                                    ease: [0.4, 0, 0.2, 1]
                                  }}
                                  onClick={() => onReact(emoji)}
                                  className="w-8 h-8 flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.10)] rounded-full transition-colors text-base"
                                  whileHover={{ scale: 1.25 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  {emoji}
                                </motion.button>
                              ))}
                              {/* "+" → full emoji picker (same picker the
                                  context-menu "+" opens). Lets desktop
                                  users reach the full catalogue without
                                  right-clicking. Mobile path is the
                                  native keyboard. */}
                              <motion.button
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.15, delay: COMMON_REACTIONS.length * 0.03 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const bubble = document.querySelector<HTMLElement>(
                                    `[data-message-id="${msg.id}"]`,
                                  );
                                  const rect = bubble?.getBoundingClientRect();
                                  // Anchor BESIDE the bubble like the "..."
                                  // context-menu: right-half bubbles get the
                                  // picker to their LEFT; left-half bubbles
                                  // get it to their RIGHT. Mirrors the
                                  // MessageContextMenu placement so both
                                  // popovers feel like the same system.
                                  const PICKER_W = 360;
                                  const GAP = 8;
                                  if (rect) {
                                    const center = rect.left + rect.width / 2;
                                    const isRightHalf = center > window.innerWidth / 2;
                                    setFullEmojiPicker({
                                      open: true,
                                      messageId: msg.id,
                                      x: isRightHalf
                                        ? rect.left - PICKER_W - GAP
                                        : rect.right + GAP,
                                      y: rect.top,
                                    });
                                  } else {
                                    setFullEmojiPicker({
                                      open: true,
                                      messageId: msg.id,
                                      x: window.innerWidth / 2 - PICKER_W / 2,
                                      y: window.innerHeight / 2 - 220,
                                    });
                                  }
                                }}
                                className="w-8 h-8 flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.10)] rounded-full transition-colors text-zinc-500 text-base"
                                title="More reactions"
                                aria-label="More reactions"
                                whileHover={{ scale: 1.15 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                +
                              </motion.button>
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.15 }}
                                className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1"
                              />
                              <motion.button
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.15, delay: 0.2 }}
                                onClick={(e) => {
                                  // Route the hover-bar "..." through the
                                  // MessageContextMenu. Anchor at the message
                                  // bubble (not the floating "..." button)
                                  // so the menu opens uniformly per bubble
                                  // — matches the right-click anchor.
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const bubble = document.querySelector<HTMLElement>(
                                    `[data-message-id="${msg.id}"]`,
                                  );
                                  const rect = (bubble ?? (e.currentTarget as HTMLElement))
                                    .getBoundingClientRect();
                                  // Right-half bubbles (sent) anchor at
                                  // rect.right - POPOVER_WIDTH; left-half
                                  // (received) at rect.left. Matches the
                                  // right-click logic in useMessageContextMenu.
                                  const POPOVER_W = 240;
                                  const bubbleCenter = rect.left + rect.width / 2;
                                  const anchorX = typeof window !== 'undefined'
                                    && bubbleCenter > window.innerWidth / 2
                                    ? Math.max(0, rect.right - POPOVER_W)
                                    : rect.left;
                                  pulseCtxMenu.openFromLongPress(
                                    anchorX,
                                    rect.top,
                                    bubble,
                                    msg.id,
                                  );
                                }}
                                className="w-8 h-8 flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.10)] rounded-full transition-colors text-zinc-500"
                                title="More options"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <Ellipsis className="text-sm" />
                              </motion.button>
                            </motion.div>
                          )}
                        >
                          <div
                            data-message-id={msg.id}
                            tabIndex={-1}
                            className={`message-bubble ${isMe ? 'message-bubble-sent' : 'message-bubble-received'} cursor-pointer select-none transition-all`}
                            // Right-click and long-press open the
                            // MessageContextMenu (the only message menu).
                            onContextMenu={(e) => {
                              pulseV2LongPress.onContextMenu(e);
                              pulseCtxMenu.openFromContextMenu(e, msg.id);
                            }}
                            onPointerDown={pulseV2LongPress.onPointerDown}
                            onPointerMove={pulseV2LongPress.onPointerMove}
                            onPointerUp={pulseV2LongPress.onPointerUp}
                            onPointerCancel={pulseV2LongPress.onPointerCancel}
                            onPointerLeave={pulseV2LongPress.onPointerLeave}
                            onKeyDown={(e) => {
                              // Shift+F10 + ContextMenu key open the
                              // menu from the keyboard (per a11y spec).
                              if (
                                (e.shiftKey && e.key === 'F10') ||
                                e.key === 'ContextMenu'
                              ) {
                                e.preventDefault();
                                pulseCtxMenu.openFromKeyboard(e.currentTarget, msg.id);
                              }
                            }}
                          >
                            {/* Media content (images, audio, files) */}
                            {msg.media_url && msg.content_type === 'image' && (
                              <img
                                src={msg.media_url}
                                alt="Shared image"
                                className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition"
                                loading="lazy"
                                onClick={() => window.open(msg.media_url!, '_blank')}
                              />
                            )}
                            {msg.media_url && msg.content_type === 'voice' && (
                              <audio
                                src={msg.media_url}
                                controls
                                className="max-w-full mb-2"
                                preload="metadata"
                              />
                            )}
                            {msg.media_url && msg.content_type === 'file' && (
                              <a
                                href={msg.media_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-white/10 dark:bg-black/10 hover:bg-white/20 dark:hover:bg-black/20 transition text-sm"
                              >
                                <i className="fa-solid fa-file text-zinc-400"></i>
                                <span className="truncate">{msg.content || 'Attachment'}</span>
                              </a>
                            )}

                            {/* Inline edit mode */}
                            {editingPulseMessageId === msg.id ? (
                              <div className="flex flex-col gap-2">
                                <input
                                  type="text"
                                  value={editPulseText}
                                  onChange={(e) => setEditPulseText(e.target.value)}
                                  aria-label="Edit message"
                                  placeholder="Edit message..."
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEditPulseMessage();
                                    if (e.key === 'Escape') cancelEditPulseMessage();
                                  }}
                                  className="w-full px-2 py-1 rounded bg-white/20 dark:bg-black/20 border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.10)] text-sm focus:outline-none focus:ring-1 focus:ring-[#f43f5e]"
                                  autoFocus
                                />
                                <div className="flex gap-2 text-[10px]">
                                  <button type="button" onClick={saveEditPulseMessage} className="text-emerald-400 hover:underline">Save</button>
                                  <button type="button" onClick={cancelEditPulseMessage} className="text-zinc-400 hover:underline">Cancel</button>
                                </div>
                              </div>
                            ) : (
                            <p
                              className="whitespace-pre-wrap break-words"
                              style={{
                                fontSize: 'var(--font-size-message)',
                                fontWeight: 'var(--font-weight-message)',
                                lineHeight: 'var(--line-height-message)'
                              }}
                            >
                              {renderTextWithLinks(msg.content)}
                            </p>
                            )}
                            {/* Phase 7b: OG link preview cards. Renders nothing if no
                             *  URLs in the text — graceful enhancement. Cached server-side. */}
                            <MessageLinkPreviews text={msg.content} max={2} />
                            {/* "edited" affordance — tooltip-on-hover badge
                                surfacing the pre-edit text (locked decision #4). */}
                            {msg.metadata?.edited && (
                              <EditedBadge
                                edited
                                originalText={pulseEditedOriginals[msg.id] || (msg.metadata?.original_content as string | undefined) || null}
                              />
                            )}
                          </div>
                        </HoverReactionTrigger>
                        </GestureHandler>

                        {/* Receipt — only the latest own-message carries it.
                            Coral mono "READ" when read, muted "DELIVERED" otherwise. */}
                        {isLatestOwn && (
                          <div className="msg-receipt" data-state={msg.is_read ? 'read' : 'delivered'}>
                            <span className="msg-receipt-dot" aria-hidden="true" />
                            <span>{msg.is_read ? 'READ' : 'DELIVERED'}</span>
                          </div>
                        )}

                        {/* Legacy inline context menu removed 2026-05-31 —
                            the MessageContextMenu singleton (rendered below the
                            message list) is now the only message menu. */}

                        {/* Reactions display */}
                        {reactions.length > 0 && (
                          <div className={`flex gap-1 mt-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {reactions.map((r, ridx) => (
                              <button
                                key={ridx}
                                onClick={() => handlePulseReaction(msg.id, r.emoji)}
                                className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition ${r.me ? 'bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30' : 'bg-[#f2f2f2] dark:bg-[rgba(255,255,255,0.055)] border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.10)]'}`}
                              >
                                <span>{r.emoji}</span>
                                <span className="text-zinc-500">{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}

            {/* Typing Indicator - wired to Supabase Realtime broadcast */}
            {otherUserTyping && activePulseConv?.other_user && (
              <div className="flex justify-start mb-4 px-4">
                <TypingIndicator
                  userName={activePulseConv.other_user.display_name || activePulseConv.other_user.handle || 'User'}
                  size="sm"
                />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Pulse Conversation Stats Modal */}
          {showStatsPanel && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
              <div className="bg-white dark:bg-black w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-white/[0.06]">
                <div className="p-4 border-b border-zinc-200 dark:border-white/[0.06] flex justify-between items-center">
                  <h3 className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                    <BarChart className="w-4 h-4 text-zinc-400 dark:text-zinc-500" /> Pulse Conversation Stats
                  </h3>
                  <button onClick={() => setShowStatsPanel(false)} className="text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded" aria-label="Close stats"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] p-3 rounded-lg flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500">Total Messages</span>
                      <span className="text-xl font-medium tabular-nums text-zinc-900 dark:text-white">{pulseMessages.length}</span>
                    </div>
                    <div className="bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] p-3 rounded-lg flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500">Last Activity</span>
                      <span className="text-sm font-medium tabular-nums text-zinc-900 dark:text-white">
                        {pulseMessages.length > 0 ? new Date(pulseMessages[pulseMessages.length - 1].created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500">Sent</span>
                      <span className="font-medium tabular-nums text-zinc-900 dark:text-white">
                        {pulseMessages.filter(m => m.sender_id !== activePulseConv?.other_user?.id).length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500">Received</span>
                      <span className="font-medium tabular-nums text-zinc-900 dark:text-white">
                        {pulseMessages.filter(m => m.sender_id === activePulseConv?.other_user?.id).length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500">Days Active</span>
                      <span className="font-medium tabular-nums text-zinc-900 dark:text-white">
                        {pulseMessages.length > 0 ? Math.round((new Date().getTime() - new Date(pulseMessages[0].created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-zinc-200/60 dark:border-white/[0.06] pt-3 flex flex-col gap-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500">Conversation Started</span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {pulseMessages.length > 0 ? new Date(pulseMessages[0].created_at).toLocaleString() : 'No messages yet'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pulse Outcome Setup Modal */}
          {showOutcomeSetup && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
              <div className="bg-white dark:bg-black w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-white/[0.06]">
                <div className="p-4 border-b border-zinc-200 dark:border-white/[0.06] flex justify-between items-center">
                  <h3 className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                    <Target className="w-4 h-4 text-rose-500" /> Set Conversation Goal
                  </h3>
                  <button onClick={() => setShowOutcomeSetup(false)} className="text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded" aria-label="Close goal setup"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Define a goal for this conversation to track progress and stay focused.
                  </p>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500 mb-2">Goal Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Close Deal', 'Schedule Meeting', 'Get Approval', 'Resolve Issue'].map(goal => (
                        <button
                          key={goal}
                          onClick={() => {
                            // Store goal in localStorage for now
                            localStorage.setItem(`pulse-goal-${activePulseConv?.id}`, goal);
                            setShowOutcomeSetup(false);
                          }}
                          className="p-3 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-transparent hover:border-rose-500/40 hover:bg-rose-500/5 dark:hover:bg-rose-500/[0.06] text-sm text-zinc-700 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-bright transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                        >
                          {goal}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500 mb-2">Custom Goal</label>
                    <input
                      type="text"
                      placeholder="Enter your custom goal..."
                      className="w-full bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/40 outline-none transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                          localStorage.setItem(`pulse-goal-${activePulseConv?.id}`, (e.target as HTMLInputElement).value);
                          setShowOutcomeSetup(false);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pulse Handoff Card */}
          {showHandoffCard && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
              <div className="bg-white dark:bg-black w-full max-w-lg rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-white/[0.06]">
                <div className="p-4 border-b border-zinc-200 dark:border-white/[0.06] flex justify-between items-center">
                  <h3 className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                    <LogOut className="w-4 h-4 text-zinc-400 dark:text-zinc-500" /> Conversation Handoff
                  </h3>
                  <button onClick={() => setShowHandoffCard(false)} className="text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded" aria-label="Close handoff"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] rounded-lg p-4">
                    <div className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
                      <Handshake className="w-3 h-3" />Context Summary
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-3">
                      Conversation with <strong className="font-medium text-zinc-900 dark:text-white">{activePulseConv?.other_user?.display_name || activePulseConv?.other_user?.handle || 'User'}</strong>
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500">Total Messages</span>
                        <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{pulseMessages.length}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500">Started</span>
                        <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                          {pulseMessages.length > 0 ? new Date(pulseMessages[0].created_at).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500 mb-2">Recent Topics</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {pulseMessages.slice(-5).map((m, i) => (
                        <div key={i} className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                          {m.content.slice(0, 60)}{m.content.length > 60 ? '…' : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const handoffText = `Conversation Handoff\n\nContact: ${activePulseConv?.other_user?.display_name || activePulseConv?.other_user?.handle || 'User'}\nMessages: ${pulseMessages.length}\nStarted: ${pulseMessages.length > 0 ? new Date(pulseMessages[0].created_at).toLocaleDateString() : 'N/A'}\n\nRecent Topics:\n${pulseMessages.slice(-5).map(m => m.content.slice(0, 50)).join('\n')}`;
                        navigator.clipboard.writeText(handoffText);
                        setShowHandoffCard(false);
                      }}
                      className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-medium py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy to Clipboard
                    </button>
                    <button
                      onClick={() => setShowHandoffCard(false)}
                      className="px-4 py-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Surface 2 · MessageContextMenu (singleton). Reads the
              per-message viewpoint from `pulseCtxMenu.openMessageId` and
              dispatches actions through `handlePulseV2Action`. This is the
              only message context menu. */}
          {pulseCtxMenu.openMessageId ? (() => {
            const targetMsg = pulseMessages.find((m) => m.id === pulseCtxMenu.openMessageId) || null;
            if (!targetMsg) return null;
            const viewpoint: MessageViewpoint = {
              messageId: targetMsg.id,
              isOwn: targetMsg.sender_id === currentUser.id,
              // Pulse is 1:1 today — wire to a future group flag here.
              isGroup: false,
              // Prefer server `edit_until` when present (metadata bag);
              // fall back to client-computed 15-min window.
              isEditable: (() => {
                const editUntil = targetMsg.metadata?.edit_until as string | number | Date | undefined;
                if (editUntil) return new Date(editUntil).getTime() > Date.now();
                return targetMsg.sender_id === currentUser.id && computeIsEditable(targetMsg.created_at);
              })(),
              hasText: !!targetMsg.content && targetMsg.content.trim().length > 0,
              isAutoTranslated: !!targetMsg.metadata?.auto_translated,
              isTranslatable: !!targetMsg.metadata?.translatable,
              // Pulse task/decision creation is workspace-scoped.
              canCreateTask: !!currentWorkspace,
            };
            const my = (pulseMessageReactions[targetMsg.id] || [])
              .filter((r) => r.me)
              .map((r) => r.emoji);
            return (
              <MessageContextMenu
                open
                anchor={pulseCtxMenu.anchor}
                viewpoint={viewpoint}
                myReactions={my}
                onAction={(id) => handlePulseV2Action(id, targetMsg)}
                onQuickReact={(emoji) => {
                  handlePulseReaction(targetMsg.id, emoji);
                }}
                onOpenMorePicker={() => {
                  // Quick-reactions "+" button → open the full emoji
                  // picker. Anchor BESIDE the bubble (matches "..."
                  // context-menu placement); the picker's clamp then
                  // pulls it into the viewport for edge cases.
                  try {
                    const el = document.querySelector(
                      `[data-message-id="${targetMsg.id}"]`,
                    ) as HTMLElement | null;
                    const rect = el?.getBoundingClientRect();
                    const PICKER_W = 360;
                    const GAP = 8;
                    if (rect) {
                      const center = rect.left + rect.width / 2;
                      const isRightHalf = center > window.innerWidth / 2;
                      setFullEmojiPicker({
                        open: true,
                        messageId: targetMsg.id,
                        x: isRightHalf
                          ? rect.left - PICKER_W - GAP
                          : rect.right + GAP,
                        y: rect.top,
                      });
                    } else {
                      setFullEmojiPicker({
                        open: true,
                        messageId: targetMsg.id,
                        x: window.innerWidth / 2 - PICKER_W / 2,
                        y: window.innerHeight / 2 - 220,
                      });
                    }
                  } catch { /* no-op */ }
                  pulseCtxMenu.close();
                }}
                onClose={pulseCtxMenu.close}
                isDarkMode={typeof document !== 'undefined' && document.documentElement.classList.contains('dark')}
              />
            );
          })() : null}

          {/* PR 2 — transient toast for edit-after-reaction clearing
              and other stubbed actions. Plain auto-dismiss banner. */}
          {pulseEditToast ? (
            <div
              role="status"
              aria-live="polite"
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-3 py-2 rounded-full text-xs font-mono uppercase tracking-[0.1em] bg-zinc-900/90 dark:bg-white/10 text-white dark:text-zinc-100 shadow-lg backdrop-blur"
            >
              {pulseEditToast}
            </div>
          ) : null}

          {/* PR 2 — full emoji picker for the context-menu "+" / React…
              actions. Replaces the radial fallback. Persists recent emoji
              choices to localStorage so the Recent tab is useful. */}
          <FullEmojiPicker
            isOpen={fullEmojiPicker.open}
            onClose={() => setFullEmojiPicker(prev => ({ ...prev, open: false }))}
            onSelect={(emoji) => {
              if (fullEmojiPicker.messageId) {
                handlePulseReaction(fullEmojiPicker.messageId, emoji);
              }
              setRecentReactionEmojis(prev => {
                const next = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 16);
                try {
                  localStorage.setItem('pulse_recent_reaction_emojis', JSON.stringify(next));
                } catch { /* localStorage full / blocked — ignore */ }
                return next;
              });
            }}
            position={{ x: fullEmojiPicker.x, y: fullEmojiPicker.y }}
            recentEmojis={recentReactionEmojis}
          />

          {/* Phase-3 ContextMenu + RadialMenu removed 2026-05-31 — they were
              a redundant second/third menu system. MessageContextMenu (above)
              is the single message menu. */}

          {/* Message Input - Rendered in normal flex flow for Pulse conversations.
              PR 1 (Messages Tools Redesign · Surface 1): when the
              `pulseComposerV2` flag is on we render <PulseComposer>;
              otherwise the legacy <MessageInput> stays wired. */}
          {activePulseConversation && (
            <MessageInputPortal
              sidebarWidth={0}
              isActive={true}
              usePortal={false}
            >
              {features.isFeatureEnabled('pulseComposerV2') ? (
                <PulseComposer
                  onSend={({ text }) => {
                    sendPulseMessage(text);
                  }}
                  placeholder={`Message ${activePulseConv?.other_user?.display_name || 'user'}...`}
                  maxLength={2000}
                  disabled={false}
                  threadId={activePulseConv?.id}
                  messageCount={pulseMessages.length}
                />
              ) : (
                <MessageInput
                  onSend={(text) => {
                    sendPulseMessage(text);
                  }}
                  onTyping={(isTyping) => {
                    // Broadcast typing to the other Pulse user (the legacy
                    // composer is the default when pulseComposerV2 is off, so
                    // without this the default path never emitted typing).
                    // Mirrors the V2 composer path; broadcastPulseTyping
                    // self-clears after 3s.
                    if (isTyping && activePulseConversation) broadcastPulseTyping();
                  }}
                  placeholder={`Message ${activePulseConv?.other_user?.display_name || 'user'}...`}
                  aiEnabled={true}
                  voiceEnabled={true}
                  maxLength={2000}
                  channelId={activePulseConv?.id}
                  apiKey={apiKey}
                  disabled={false}
                  setActiveToolOverlay={setActiveToolOverlay}
                />
              )}
            </MessageInputPortal>
          )}
        </div>

      )}

      {/* Regular Thread Chat View - Empty state or active thread */}
      {!activeThread && !activePulseConv && renderEmptyChatArea()}
      {activeThread && (
      <div className={`flex-1 flex flex-col relative min-w-0 bg-[#f8f8f8] dark:bg-black ${mobileView === 'list' ? 'max-md:hidden' : ''}`}>

        {/* Header - Mobile Optimized - Fixed at top */}
        <div className="min-h-[56px] md:h-16 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between px-2 sm:px-4 z-10 bg-[#f8f8f8]/95 dark:bg-black/95 flex-shrink-0 gap-2 mobile-header-safe">
          <div className="flex items-center gap-2 min-w-0 flex-shrink">
             {/* Mobile Menu Button (visible only on mobile) */}
             <button onClick={openDrawer} className="md:hidden text-zinc-500 w-12 h-12 flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] rounded-lg transition flex-shrink-0" title="Open menu">
               <Menu />
             </button>
             {/* Desktop Back Button (visible only on mobile when chat is active) */}
             <button onClick={handleBackToList} className="max-md:hidden text-zinc-500 w-12 h-12 flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] rounded-lg transition flex-shrink-0" title="Back to messages"><ArrowLeft /></button>
             <div className="flex flex-col min-w-0">
                 <span className="font-medium text-zinc-900 dark:text-white leading-tight flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base truncate">
                     <span className="truncate max-w-[120px] sm:max-w-none">{activeThread.contactName}</span>
                     {activeThread.outcome && <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 text-[10px] uppercase font-mono font-medium tracking-[0.1em] flex-shrink-0">Goal Active</span>}
                 </span>
                 {activeThread.outcome ? (
                     <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500">
                         <span className="hidden sm:inline">Progress</span>
                         <div className="w-12 sm:w-16 h-1 bg-zinc-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                             <div className={`h-full rounded-full ${activeThread.outcome.status === 'blocked' ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{width: `${activeThread.outcome.progress}%`}}></div>
                         </div>
                         <span className="tabular-nums">{activeThread.outcome.progress}%</span>
                     </div>
                 ) : (
                     <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500">
                         <span className="flex items-center gap-1">
                             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                             Online
                         </span>
                         {teamHealth && (
                             <span className="hidden sm:flex items-center gap-1 cursor-help tabular-nums" title={`Reliability: ${teamHealth.reliability}\nIssues: ${teamHealth.issues.join(', ')}`}>
                                 <HeartPulse className="w-2.5 h-2.5" /> {teamHealth.score}%
                             </span>
                         )}
                     </div>
                 )}
             </div>
          </div>

          {/* AI Coach Tip - Hidden on mobile, visible on md+ */}
          {nudge && showCoachTip && (
            <div className={`hidden md:flex flex-1 max-w-md mx-4 transition-opacity duration-300 ${coachTipFading ? 'opacity-0' : 'opacity-100'}`}>
              <div className={`flex items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] rounded-lg group transition-colors ${nudgeFocused ? 'ring-1 ring-rose-500/30 bg-rose-500/5 dark:bg-rose-500/[0.06]' : ''}`}>
                <Wand2 className="w-3 h-3 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500 flex-shrink-0">Pulse AI</span>
                <div className="flex-1 overflow-hidden relative">
                  <div className="ticker-container whitespace-nowrap motion-reduce:overflow-visible">
                    <span className="text-xs text-zinc-600 dark:text-zinc-300 inline-block ticker-text motion-reduce:animate-none">
                      {nudge.message}
                    </span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-300 inline-block ticker-text motion-reduce:animate-none motion-reduce:hidden" aria-hidden="true">
                      {nudge.message}
                    </span>
                  </div>
                </div>
                <button onClick={dismissCoachTip} className="text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright transition p-0.5 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded">
                  <X className="text-[10px]" />
                </button>
              </div>
            </div>
          )}

          {/* Header Actions - Clean with Tools Drawer */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Path D: relationship rail trigger — mobile/tablet only (the docked
                rail is hidden below xl). Opens the rail as a sheet; badges open
                items. */}
            <button
              type="button"
              onClick={() => setRailSheetOpen(true)}
              className="xl:hidden relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors border border-zinc-200 dark:border-white/[0.06] bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              title="Relationship"
              aria-label="Show relationship panel"
            >
              <PanelRightOpen className="w-4 h-4" />
              {railData.openItems.length > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full inline-flex items-center justify-center text-[9px] font-mono font-semibold tabular-nums"
                  style={{ color: 'var(--pulse-tone-warning)', background: 'var(--pulse-tone-warning-soft)' }}
                >
                  {railData.openItems.length}
                </span>
              )}
            </button>
            {/* Tools Drawer Button - Always visible.
                Routes to new ToolsMenuV2 dialog when toolsMenuV2 flag is on,
                else opens the legacy 11-tile drawer. */}
            <button
              onClick={() => {
                if (features.isFeatureEnabled('toolsMenuV2')) {
                  setShowToolsMenuV2(true);
                } else {
                  setShowToolsDrawer(true);
                }
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors border border-zinc-200 dark:border-white/[0.06] bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              title="Open Tools Menu"
              aria-label="Open Tools menu"
            >
              <LayoutGrid className="text-xs sm:text-sm" />
            </button>

            {/* Command Palette - Always visible */}
            <button
              onClick={() => openCommandPalette()}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors border border-zinc-200 dark:border-white/[0.06] bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              title="Quick Actions (Ctrl+K)"
              aria-label="Open command palette"
            >
              <Terminal className="text-xs sm:text-sm" />
            </button>

            {/* Focus Mode - Always visible */}
            <button
              onClick={toggleFocusMode}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors border flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${focusThreadId ? 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-bright' : 'border-zinc-200 dark:border-white/[0.06] bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright'}`}
              title="Focus Mode"
              aria-pressed={!!focusThreadId}
            >
              <Eye className="text-xs sm:text-sm" />
            </button>

            {/* Achievements - Always visible if available */}
            {showAchievements && messageEnhancements.getAllAchievements().length > 0 && (
              <button
                onClick={() => setShowAnalyticsDashboard(true)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors border border-zinc-200 dark:border-white/[0.06] bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                title="View Achievements"
                aria-label="View achievements"
              >
                <Trophy className="text-xs sm:text-sm" />
              </button>
            )}
          </div>
        </div>

        {/* Outcome Setup Modal */}
        {showOutcomeSetup && (
            <div className="absolute top-16 left-0 right-0 z-30 bg-white dark:bg-black border-b border-zinc-200/60 dark:border-white/[0.06] p-4 shadow-lg animate-slide-up">
                <h4 className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500 mb-2">Define Desired Outcome</h4>
                <div className="flex gap-2">
                    <input type="text" value={outcomeGoal} onChange={e => setOutcomeGoal(e.target.value)} placeholder="e.g., Ship v2.0 by Friday" className="flex-1 border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm bg-zinc-50 dark:bg-white/[0.03] dark:text-white outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/40 transition-colors" />
                    <button onClick={handleSetOutcome} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40">Set</button>
                    <button onClick={() => setShowOutcomeSetup(false)} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded">Cancel</button>
                </div>
            </div>
        )}

        <MessagesFeaturePanels
          activeThread={activeThread}
          threads={threads}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          inputText={inputText}
          setInputText={setInputText}
          showAnalyticsPanel={showAnalyticsPanel}
          setShowAnalyticsPanel={setShowAnalyticsPanel}
          analyticsView={analyticsView}
          setAnalyticsView={setAnalyticsView}
          showCollaborationPanel={showCollaborationPanel}
          collaborationTab={collaborationTab}
          setCollaborationTab={setCollaborationTab}
          pinnedMessages={pinnedMessages}
          setPinnedMessages={setPinnedMessages}
          highlights={highlights}
          setHighlights={setHighlights}
          annotations={annotations}
          setAnnotations={setAnnotations}
          setActiveThreadId={setActiveThreadId}
          showProductivityPanel={showProductivityPanel}
          productivityTab={productivityTab}
          setProductivityTab={setProductivityTab}
          userTemplates={userTemplates}
          setUserTemplates={setUserTemplates}
          userScheduledMessages={userScheduledMessages}
          setUserScheduledMessages={setUserScheduledMessages}
          userReminders={userReminders}
          setUserReminders={setUserReminders}
          showIntelligencePanel={showIntelligencePanel}
          intelligenceTab={intelligenceTab}
          setIntelligenceTab={setIntelligenceTab}
          userBookmarks={userBookmarks}
          setUserBookmarks={setUserBookmarks}
          conversationTagAssignments={conversationTagAssignments}
          setConversationTagAssignments={setConversationTagAssignments}
          activeToolOverlay={activeToolOverlay}
          setActiveToolOverlay={setActiveToolOverlay}
          showProactivePanel={showProactivePanel}
          proactiveTab={proactiveTab}
          setProactiveTab={setProactiveTab}
          showCommunicationPanel={showCommunicationPanel}
          communicationTab={communicationTab}
          setCommunicationTab={setCommunicationTab}
          showPersonalizationPanel={showPersonalizationPanel}
          personalizationTab={personalizationTab}
          setPersonalizationTab={setPersonalizationTab}
          showSecurityPanel={showSecurityPanel}
          securityTab={securityTab}
          setSecurityTab={setSecurityTab}
          showMediaHubPanel={showMediaHubPanel}
          mediaHubTab={mediaHubTab}
          setMediaHubTab={setMediaHubTab}
        />

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <TypingIndicator userName={typingUsers.join(', ')} />
        )}

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {activeThread.outcome && (
              <div className="flex justify-center mb-4">
                  <div className="bg-zinc-100 dark:bg-white/[0.04] text-rose-600 dark:text-rose-bright text-xs px-3 py-1 rounded-full border border-zinc-200 dark:border-white/[0.06] flex items-center gap-2">
                      <Flag className="w-3 h-3" />
                      <span className="font-mono uppercase tracking-[0.1em] text-[10px] font-medium text-zinc-400 dark:text-zinc-500">PULSE AI · OUTCOME GOAL</span>
                      <span className="text-zinc-300 dark:text-zinc-600">·</span>
                      <span className="text-rose-600 dark:text-rose-bright">{activeThread.outcome.goal}</span>
                  </div>
              </div>
          )}

          {/* Handoff Card */}
          {showHandoffCard && (
              <div className="mx-auto max-w-lg bg-zinc-50 dark:bg-white/[0.03] ring-1 ring-zinc-200 dark:ring-white/[0.06] rounded-xl p-6 mb-6 animate-scale-in relative">
                  <button onClick={() => setShowHandoffCard(false)} className="absolute top-2 right-2 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"><X /></button>
                  <div className="flex items-center gap-2 mb-4 text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-[0.1em] text-[10px] font-medium">
                      <i className={`fa-solid ${loadingHandoff ? 'fa-circle-notch fa-spin' : 'fa-handshake'}`}></i>
                      {loadingHandoff ? 'PULSE AI · GENERATING HANDOFF…' : 'PULSE AI · CONTEXT HANDOFF'}
                  </div>

                  {loadingHandoff ? (
                      <div className="py-8 flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-white/[0.04] flex items-center justify-center">
                              <Wand2 className="text-zinc-500 dark:text-zinc-400 animate-pulse" />
                          </div>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">Analyzing conversation history...</p>
                      </div>
                  ) : handoffContent ? (
                      <>
                          <p className="text-sm text-zinc-800 dark:text-zinc-200 mb-4">{handoffContent.context}</p>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <div className="font-mono uppercase tracking-[0.1em] text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-2">Key Decisions</div>
                                  {handoffContent.keyDecisions.length > 0 ? (
                                      <ul className="list-disc list-inside text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
                                          {handoffContent.keyDecisions.map((d: string, i: number) => <li key={i}>{d}</li>)}
                                      </ul>
                                  ) : (
                                      <p className="text-xs text-zinc-400 italic">No major decisions yet</p>
                                  )}
                              </div>
                              <div>
                                  <div className="font-mono uppercase tracking-[0.1em] text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-2">Pending Actions</div>
                                  {handoffContent.pendingActions.length > 0 ? (
                                      <ul className="list-disc list-inside text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
                                          {handoffContent.pendingActions.map((a: string, i: number) => <li key={i}>{a}</li>)}
                                      </ul>
                                  ) : (
                                      <p className="text-xs text-zinc-400 italic">No pending actions</p>
                                  )}
                              </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                              <button
                                  onClick={() => handleSend(`Here is a context summary for new team members:\n\n${handoffContent.context}\n\nKey Decisions:\n${handoffContent.keyDecisions.map((d: string) => '• ' + d).join('\n') || 'None yet'}\n\nPending Actions:\n${handoffContent.pendingActions.map((a: string) => '• ' + a).join('\n') || 'None'}`)}
                                  className="flex-1 bg-transparent border border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-300 hover:bg-rose-500/10 dark:hover:bg-rose-500/[0.12] hover:text-rose-600 dark:hover:text-rose-bright hover:border-rose-500/30 font-mono uppercase tracking-[0.1em] font-medium py-2 rounded-lg text-[10px] transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                              >
                                  <Send className="w-3 h-3" /> Share to Thread
                              </button>
                              <button
                                  onClick={() => {
                                      navigator.clipboard.writeText(`Context Handoff Summary\n\n${handoffContent.context}\n\nKey Decisions:\n${handoffContent.keyDecisions.map((d: string) => '• ' + d).join('\n') || 'None'}\n\nPending Actions:\n${handoffContent.pendingActions.map((a: string) => '• ' + a).join('\n') || 'None'}`);
                                      alert('Copied to clipboard!');
                                  }}
                                  className="px-4 py-2 bg-transparent border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                                  title="Copy to clipboard"
                              >
                                  <Copy />
                              </button>
                          </div>
                      </>
                  ) : (
                      <div className="py-4 text-center text-sm text-zinc-500">
                          Failed to generate summary. Please try again.
                      </div>
                  )}
              </div>
          )}

          {filteredMessages.map((msg, index) => {
             const isMe = msg.sender === 'me';
             const prevMsg = index > 0 ? filteredMessages[index - 1] : null;

             // Enhanced grouping: show avatar if sender changed OR 5+ min gap
             const showAvatar = !prevMsg || prevMsg.sender !== msg.sender ||
                               !msg.timestamp || !prevMsg.timestamp ||
                               (msg.timestamp.getTime() - prevMsg.timestamp.getTime()) > 5 * 60 * 1000;

             // Date divider: show if different day
             const showDateDivider = !prevMsg ||
                                    (msg.timestamp && prevMsg.timestamp &&
                                     shouldShowDateDivider(prevMsg.timestamp, msg.timestamp));

             const isProposal = msg.decisionData?.type === 'proposal';
             const isApproved = msg.decisionData?.status === 'approved';
             const isDeepAudio = msg.attachment?.type === 'audio' || msg.voiceAnalysis;

             return (
                <React.Fragment key={msg.id}>
                  {/* TASK 4: Date Divider */}
                  {showDateDivider && msg.timestamp && (
                    <DateDivider
                      date={msg.timestamp}
                      label={formatDateDivider(msg.timestamp)}
                    />
                  )}

                  {/* Message - Compact spacing for grouped messages */}
                  <div className="flex">
                  {/* Path D intelligence spine — fixed-left timeline gutter. Unlike
                      the Pulse-DM path, this legacy-thread path carries decisionData,
                      so DECISION (tone-positive) moments surface here alongside
                      question / needs-reply. Moments are keyed by msg.id, so the
                      search-filtered subset still resolves correctly. */}
                  <SpineNode
                    moment={conversationMoments.get(msg.id)}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === filteredMessages.length - 1}
                  />
                  <div className={`flex-1 min-w-0 flex ${isMe ? 'justify-end' : 'justify-start'} group relative ${showAvatar ? 'mb-6' : 'mb-1'} animate-slide-up`}>
                    {!isMe && showAvatar && (
                        <div className={`w-8 h-8 rounded-full ${activeThread.avatarColor} flex items-center justify-center text-xs text-white mr-2 mt-auto flex-shrink-0 shadow-sm`}>
                            {activeThread.contactName.charAt(0)}
                        </div>
                    )}
                    {!isMe && !showAvatar && <div className="w-10"></div>}

                    <div className="max-w-[85%] md:max-w-[70%] relative">
                        {/* Source Indicator for Unified Inbox */}
                        {msg.source && msg.source !== 'pulse' && (
                            <div className="absolute -top-3 right-0 bg-white dark:bg-[rgba(255,255,255,0.055)] px-1.5 py-0.5 rounded-full border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.10)] shadow-sm z-10">
                                {getSourceIcon(msg.source)}
                            </div>
                        )}

                        <div className={`rounded-2xl px-4 py-3 md:px-5 md:py-4 text-sm transition-colors relative ${
                            isProposal && !isApproved
                              ? `bg-amber-500/5 dark:bg-amber-500/[0.08] ring-1 ring-amber-500/30 text-zinc-800 dark:text-zinc-200 ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`
                              : isApproved
                              ? `bg-emerald-500/5 dark:bg-emerald-500/[0.08] ring-1 ring-emerald-500/30 text-zinc-800 dark:text-zinc-200 ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`
                              : isMe
                              ? 'bg-[#0f0f0f] dark:bg-white text-white dark:text-[#0f0f0f] rounded-br-sm'
                              : 'bg-white dark:bg-[rgba(255,255,255,0.055)] border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.10)] text-zinc-800 dark:text-zinc-200 rounded-bl-sm'
                        }`}>

                            {/* Proposal Header */}
                            {isProposal && (
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-200/60 dark:border-white/[0.06]">
                                    <i className={`fa-solid ${isApproved ? 'fa-gavel text-emerald-500 dark:text-emerald-400' : 'fa-scale-balanced text-amber-500 dark:text-amber-400'} text-[10px] opacity-80`}></i>
                                    <span className={`font-mono uppercase tracking-[0.1em] text-[10px] font-medium ${isApproved ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>{isApproved ? 'PULSE AI · DECISION APPROVED' : 'PULSE AI · FORMAL PROPOSAL'}</span>
                                </div>
                            )}

                            {/* Phase 1: Message Mood Indicator */}
                            {msg.text && !isMe && (() => {
                                const mood = messageEnhancementsService.detectMessageMood(msg.text);
                                // Only show mood badge for non-neutral messages
                                if (mood.sentiment !== 'neutral') {
                                    return (
                                        <div className="mb-2">
                                            <MessageMoodBadge mood={mood} size="small" />
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {msg.text && <p className="leading-relaxed whitespace-pre-wrap font-normal">{renderTextWithLinks(msg.text)}</p>}

                            {/* Phase 7b: OG link preview cards. Renders nothing if no
                             *  URLs in the text — graceful enhancement. Cached server-side. */}
                            <MessageLinkPreviews text={msg.text} max={2} />

                            {/* Phase 1: Rich Message Cards (link previews, code blocks, etc.) */}
                            {msg.text && (() => {
                                const richCards = messageEnhancementsService.detectRichContent(msg.text);
                                if (richCards.length > 0) {
                                    return (
                                        <div className="mt-2 space-y-2">
                                            {richCards.map((card, idx) => (
                                                <RichMessageCardComponent
                                                    key={idx}
                                                    card={card}
                                                    onAction={(action, data) => {
                                                        if (action === 'create-task' && msg.text) {
                                                            handleExtractTask(msg);
                                                        } else if (action === 'add-to-calendar') {
                                                            // TODO: Implement calendar integration
                                                        }
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Attachment Rendering */}
                            {msg.attachment && (
                                <div className="mt-3">
                                    {msg.attachment.type === 'image' && (
                                        <div className="rounded-lg overflow-hidden max-w-xs">
                                            <img
                                                src={msg.attachment.url}
                                                alt={msg.attachment.name}
                                                className="w-full h-auto cursor-pointer hover:opacity-90 transition"
                                                onClick={() => window.open(msg.attachment?.url, '_blank')}
                                            />
                                            <div className="flex items-center justify-between p-2 bg-black/5 dark:bg-white/5">
                                                <span className="text-[10px] text-zinc-500 truncate">{msg.attachment.name}</span>
                                                <span className="text-[10px] text-zinc-400">{msg.attachment.size}</span>
                                            </div>
                                        </div>
                                    )}
                                    {msg.attachment.type === 'audio' && (
                                        <div className="flex items-center gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-lg">
                                            <button
                                                onClick={() => {
                                                    const audio = new Audio(msg.attachment?.url);
                                                    audio.play();
                                                }}
                                                className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                                            >
                                                <Play className="text-sm" />
                                            </button>
                                            <div className="flex-1">
                                                <div className="text-xs font-medium dark:text-white">{msg.attachment.name}</div>
                                                <div className="text-[10px] text-zinc-500">{msg.attachment.duration ? `${Math.floor(msg.attachment.duration / 60)}:${(msg.attachment.duration % 60).toString().padStart(2, '0')}` : 'Voice message'}</div>
                                            </div>
                                        </div>
                                    )}
                                    {msg.attachment.type === 'file' && (
                                        <a
                                            href={msg.attachment.url}
                                            download={msg.attachment.name}
                                            className="flex items-center gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                                                <File className="text-zinc-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-medium dark:text-white truncate">{msg.attachment.name}</div>
                                                <div className="text-[10px] text-zinc-500">{msg.attachment.size}</div>
                                            </div>
                                            <Download className="text-zinc-400 text-xs" />
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Voice Analysis Bubble */}
                            {isDeepAudio && (
                                <div className="mt-3">
                                    {msg.voiceAnalysis ? (
                                        <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 text-xs">
                                            <div className="flex items-center gap-2 mb-2 text-rose-500 dark:text-rose-bright font-mono font-medium uppercase tracking-[0.1em] text-[10px]">
                                                <Wand2 className="w-3 h-3" /> PULSE AI · DEEP AUDIO
                                            </div>
                                            <p className="mb-2 italic">"{msg.voiceAnalysis.transcription}"</p>
                                            <div className="mb-2"><strong>Summary:</strong> {msg.voiceAnalysis.summary}</div>
                                            {msg.voiceAnalysis.actionItems.length > 0 && (
                                                <div className="space-y-1">
                                                    <strong>Tasks Identified:</strong>
                                                    {msg.voiceAnalysis.actionItems.map((task, i) => (
                                                        <div key={i} className="flex items-center gap-1.5"><Square className="text-[9px]" /> {task}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => msg.attachment?.url && handleAnalyzeVoice(msg.id, msg.attachment.url)}
                                            className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
                                        >
                                            {analyzingAudioId === msg.id ? <><Loader2 className="animate-spin" /> Analyzing...</> : <><Wand2 /> Deep Analyze Voice</>}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Voting Interface */}
                            {isProposal && msg.decisionData && (
                                <div className="mt-3 pt-2 border-t border-zinc-200/60 dark:border-white/[0.06]">
                                    <div className="flex gap-2 mb-2">
                                        <button
                                            onClick={() => handleVote(msg.id, 'me', 'approve')}
                                            className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-mono uppercase tracking-[0.1em] font-medium transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${msg.decisionData.votes.some(v => v.userId === 'me' && v.choice === 'approve') ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' : 'bg-transparent border border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-300 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/[0.12] hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-500/30'}`}
                                        >
                                            <ThumbsUp className="w-3.5 h-3.5" /> Approve <span className="tabular-nums opacity-70">({msg.decisionData.votes.filter(v => v.choice === 'approve').length})</span>
                                        </button>
                                        <button
                                            onClick={() => handleVote(msg.id, 'me', 'reject')}
                                            className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-mono uppercase tracking-[0.1em] font-medium transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${msg.decisionData.votes.some(v => v.userId === 'me' && v.choice === 'reject') ? 'bg-red-500/15 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30' : 'bg-transparent border border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-300 hover:bg-red-500/10 dark:hover:bg-red-500/[0.12] hover:text-red-700 dark:hover:text-red-400 hover:border-red-500/30'}`}
                                        >
                                            <ThumbsDown className="w-3.5 h-3.5" /> Reject <span className="tabular-nums opacity-70">({msg.decisionData.votes.filter(v => v.choice === 'reject').length})</span>
                                        </button>
                                    </div>
                                    <div className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-500 dark:text-zinc-400 text-center tabular-nums">Threshold: {msg.decisionData.threshold} approvals required</div>
                                </div>
                            )}

                            {/* Linked Task Indicator */}
                            {msg.relatedTaskId && (
                                <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10 flex items-center gap-2 text-xs opacity-80">
                                    <CheckCircle className="text-emerald-500" />
                                    <span>Task Created: <strong>{msg.relatedTaskId}</strong></span>
                                </div>
                            )}
                        </div>

                        {/* Message Actions */}
                        <div className={`absolute -top-8 ${isMe ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 z-20`}>
                            <div className="flex items-center bg-white dark:bg-[rgba(255,255,255,0.055)] rounded-full shadow-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.10)] p-1">
                                {/* Quick Reactions */}
                                {COMMON_REACTIONS.slice(0, 4).map(emoji => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleReaction(msg.id, emoji)}
                                    className="w-7 h-7 flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.10)] rounded-full transition text-sm"
                                    title={`React with ${emoji}`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                                <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
                                <button
                                    onClick={() => handleExtractTask(msg)}
                                    className={`w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright rounded-full transition ${creatingTaskForMsgId === msg.id ? 'animate-spin text-rose-500 dark:text-rose-bright' : ''}`}
                                    title="Create Task"
                                >
                                    <Check className="text-xs" />
                                </button>
                                <button
                                    onClick={() => setReplyingTo(msg)}
                                    className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright rounded-full transition"
                                    title="Reply"
                                >
                                    <Reply className="text-xs" />
                                </button>
                                <button
                                    onClick={() => { setForwardingMessage(msg); setShowForwardModal(true); }}
                                    className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-[#f43f5e] rounded-full transition"
                                    title="Forward"
                                >
                                    <Share className="text-xs" />
                                </button>
                                {isMe && (
                                  <button
                                      onClick={() => startEditMessage(msg)}
                                      className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-[#f43f5e] rounded-full transition"
                                      title="Edit"
                                  >
                                      <Pen className="text-xs" />
                                  </button>
                                )}
                                <button
                                    onClick={() => handleTTS(msg.text, msg.id)}
                                    className={`w-7 h-7 flex items-center justify-center rounded-full transition ${isPlayingId === msg.id ? 'text-rose-500 dark:text-rose-bright animate-pulse' : 'text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright'}`}
                                    title="Read Aloud"
                                >
                                    <i className={`fa-solid ${isPlayingId === msg.id ? 'fa-volume-high' : 'fa-volume-up'} text-xs`}></i>
                                </button>
                                <button
                                    onClick={() => navigator.clipboard.writeText(msg.text)}
                                    className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-600 rounded-full transition"
                                    title="Copy Text"
                                >
                                    <Copy className="text-xs" />
                                </button>
                            </div>
                        </div>

                        {/* Phase 1: Animated Reactions Display */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="mt-2">
                            <AnimatedReactions
                              reactions={msg.reactions}
                              onReact={(emoji) => handleReaction(msg.id, emoji)}
                              isMe={isMe}
                            />
                          </div>
                        )}

                        {/* Read Receipt */}
                        {isMe && showReadReceipts && msg.status && (
                          <div className="flex justify-end mt-1">
                            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                              {msg.status === 'sent' && <><Check /> Sent</>}
                              {msg.status === 'delivered' && <><CheckCheck /> Delivered</>}
                              {msg.status === 'read' && <><CheckCheck className="text-[#3b82f6]" /> Read</>}
                            </span>
                          </div>
                        )}
                        {/* TASK 4: Smart Timestamp */}
                        {msg.timestamp && (
                          <div className="flex justify-end mt-1">
                            <SmartTimestamp date={msg.timestamp} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  </React.Fragment>
             );
          })}
          <div ref={messagesEndRef} />

          {/* Phase 1: Live Collaboration - Typing Indicator */}
          {activeThread && typingCollaborators.length > 0 && (
            <div className="px-4 py-2">
              <LiveCollaborators
                collaborators={typingCollaborators}
                compact={false}
              />
            </div>
          )}
        </div>
      </div>
      )}

      {/* Path D relationship rail — docked rightmost column, only when a
          conversation is open (Tranche 3b). Collapsible; open-items are
          interactive on legacy threads (step 4). Hidden below xl, where the
          conversation takes priority — the rail-as-sheet below covers mobile. */}
      {(activePulseConv || activeThread) && (
        <RelationshipRail
          data={railData}
          contactName={railContactName}
          collapsed={railCollapsed}
          onToggleCollapse={() => setRailCollapsed(c => !c)}
          onToggleOpenItem={handleToggleOpenItem}
          className="max-xl:hidden"
        />
      )}

      {/* Path D relationship rail-as-sheet — mobile/tablet (below xl). Slides in
          over the conversation; the backdrop or the panel's close button
          dismisses it. Mirrors the docked rail's content + interactivity. */}
      {(activePulseConv || activeThread) && railSheetOpen && (
        <div
          className="xl:hidden fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Relationship"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setRailSheetOpen(false)}
            aria-hidden="true"
          />
          <div className="relative h-full animate-slide-in-right">
            <RelationshipRail
              data={railData}
              contactName={railContactName}
              collapsed={false}
              onToggleCollapse={() => setRailSheetOpen(false)}
              onToggleOpenItem={handleToggleOpenItem}
              className="h-full shadow-2xl"
            />
          </div>
        </div>
      )}

      <MessagesEndModals
        showInviteToPulseModal={showInviteToPulseModal}
        setShowInviteToPulseModal={setShowInviteToPulseModal}
        inviteTargetContact={inviteTargetContact}
        setInviteTargetContact={setInviteTargetContact}
        inviteToPulseSent={inviteToPulseSent}
        setInviteToPulseSent={setInviteToPulseSent}
        inviteToPulseCopied={inviteToPulseCopied}
        setInviteToPulseCopied={setInviteToPulseCopied}
        showContactPanel={showContactPanel}
        setShowContactPanel={setShowContactPanel}
        selectedContactUserId={selectedContactUserId}
        setSelectedContactUserId={setSelectedContactUserId}
        showAchievements={showAchievements}
        messageEnhancements={messageEnhancements}
        showAnalyticsDashboard={showAnalyticsDashboard}
        setShowAnalyticsDashboard={setShowAnalyticsDashboard}
        threads={threads}
        showNetworkGraph={showNetworkGraph}
        setShowNetworkGraph={setShowNetworkGraph}
        setActiveThreadId={setActiveThreadId}
        setMobileView={setMobileView}
        showContextPanel={showContextPanel}
        setShowContextPanel={setShowContextPanel}
        activeThread={activeThread}
        activePulseConv={activePulseConv}
        apiKey={apiKey}
        currentUser={currentUser}
        showTaskExtractor={showTaskExtractor}
        setShowTaskExtractor={setShowTaskExtractor}
        contacts={contacts}
        showChannelArtifactPanel={showChannelArtifactPanel}
        setShowChannelArtifactPanel={setShowChannelArtifactPanel}
        showFeatureSettings={showFeatureSettings}
        setShowFeatureSettings={setShowFeatureSettings}
        isFocusModeActive={isFocusModeActive}
        setIsFocusModeActive={setIsFocusModeActive}
        activeThreadId={activeThreadId}
        focusThreadId={focusThreadId}
        setFocusThreadId={setFocusThreadId}
      />
      <MessageInputSection
        activeThread={activeThread}
        activePulseConversation={activePulseConversation}
        sidebarWidth={sidebarRef.current?.offsetWidth || 0}
        isViewOnlyMode={isViewOnlyMode}
        isNonPulseThread={isNonPulseThread}
        canSendNativeSms={canSendNativeSms}
        activeContact={activeContact}
        contacts={contacts}
        setInviteTargetContact={setInviteTargetContact}
        setShowInviteToPulseModal={setShowInviteToPulseModal}
        showTemplates={showTemplates}
        setShowTemplates={setShowTemplates}
        showEmojiPicker={showEmojiPicker}
        emojiPickerMessageId={emojiPickerMessageId}
        setShowEmojiPicker={setShowEmojiPicker}
        inputText={inputText}
        setInputText={(val: React.SetStateAction<string>) => {
          setInputText(val);
          if (activePulseConversation) broadcastPulseTyping();
        }}
        showAICoach={showAICoach}
        setShowAICoach={setShowAICoach}
        showSmartCompose={showSmartCompose}
        setShowSmartCompose={setShowSmartCompose}
        messageEnhancements={messageEnhancements}
        showQuickActionsBar={showQuickActionsBar}
        isRecording={isRecording}
        startRecording={startRecording}
        handleSmartReply={handleSmartReply}
        showAIMediator={showAIMediator}
        setShowAIMediator={setShowAIMediator}
        showQuickPhrases={showQuickPhrases}
        setShowQuickPhrases={setShowQuickPhrases}
        isProposalMode={isProposalMode}
        setIsProposalMode={setIsProposalMode}
        proposalModeEnabled={proposalModeEnabled}
        recordingDuration={recordingDuration}
        stopRecording={stopRecording}
        showVoiceExtractor={showVoiceExtractor}
        setShowVoiceExtractor={setShowVoiceExtractor}
        apiKey={apiKey}
        useIntentComposer={useIntentComposer}
        sendPulseMessage={sendPulseMessage}
        handleSendSms={handleSendSms}
        handleSend={handleSend}
        setActiveToolOverlay={setActiveToolOverlay}
        showAttachmentMenu={showAttachmentMenu}
        setShowAttachmentMenu={setShowAttachmentMenu}
        attachmentMenuRef={attachmentMenuRef}
        imageInputRef={imageInputRef}
        videoInputRef={videoInputRef}
        fileInputRef={fileInputRef}
        handleFileUpload={handleFileUpload}
        handleImageUpload={handleImageUpload}
        handleVideoUpload={handleVideoUpload}
        handleAddLink={handleAddLink}
        loadingAI={loadingAI}
        isBotChat={isBotChat}
        setShowScheduleModal={setShowScheduleModal}
        scheduledMessages={scheduledMessages}
        activeThreadId={activeThreadId}
        showMeetingDeflector={showMeetingDeflector}
        setShowMeetingDeflector={setShowMeetingDeflector}
        useTemplate={useTemplate}
      />

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
};

export default Messages;
