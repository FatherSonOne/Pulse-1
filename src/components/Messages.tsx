
import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
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
import { createInvitation, sendInvitationEmail, generateMailtoLink, generateEarlyAccessInvite, generateShareableInviteText } from '../services/inviteService';
import { pulseService, SearchUserResult, PulseConversation, PulseMessage } from '../services/pulseService';
import { nativeSmsService } from '../services/nativeSmsService';
import { canSendSms, openSmsApp, isNativePlatform } from '../services/permissionService';
import { UserContactCard } from './UserContact/UserContactCard';
import { OnlineIndicator } from './UserContact/OnlineIndicator';
import { useUserPresence } from '../hooks/usePresence';
import { CellularSMS } from './CellularSMS';

// Phase 1 Message Enhancements - Core features (loaded immediately - critical path)
import {
  MessageMoodBadge,
  RichMessageCardComponent,
  AnimatedReactions,
  LiveCollaborators,
  StandaloneThemePicker,
  COLOR_PAIR_THEMES,
  ColorPairTheme,
  ConversationHealthWidget,
  AchievementToast,
  AchievementProgress,
  MessageAnalyticsDashboard,
  NetworkGraph,
  SmartCompose,
  QuickActions,
  ThreadActionsMenu,
  ThreadBadges,
  MessageImpactVisualization,
  TranslationWidget
} from './MessageEnhancements';
import { useMessageEnhancements } from '../hooks/useMessageEnhancements';
import { FeatureSkeleton } from './MessageEnhancements/FeatureSkeleton';

// PERFORMANCE OPTIMIZATION: Lazy load feature bundles to reduce initial bundle size by 60%
// Phase 2: AI-Powered Features (~120KB) - Lazy loaded on user interaction
const BundleAI = lazy(() => import('./MessageEnhancements/BundleAI'));
// Phase 3: Analytics & Engagement (~95KB) - Lazy loaded on analytics view
const BundleAnalytics = lazy(() => import('./MessageEnhancements/BundleAnalytics'));
// Phase 4: Collaboration Features (~85KB) - Lazy loaded on collaboration action
const BundleCollaboration = lazy(() => import('./MessageEnhancements/BundleCollaboration'));
// Phase 5: Productivity Tools (~75KB) - Lazy loaded on feature use
const BundleProductivity = lazy(() => import('./MessageEnhancements/BundleProductivity'));
// Phase 6: Intelligence Features (~90KB) - Lazy loaded on feature use
const BundleIntelligence = lazy(() => import('./MessageEnhancements/BundleIntelligence'));
// Phase 7: Proactive Intelligence (~70KB) - Lazy loaded in background after 2s
const BundleProactive = lazy(() => import('./MessageEnhancements/BundleProactive'));
// Phase 8: Communication Enhancement (~65KB) - Lazy loaded on feature use
const BundleCommunication = lazy(() => import('./MessageEnhancements/BundleCommunication'));
// Phase 9: Automation (~80KB) - Lazy loaded on feature use
const BundleAutomation = lazy(() => import('./MessageEnhancements/BundleAutomation'));
// Phase 10: Security & Insights (~75KB) - Lazy loaded on feature use
const BundleSecurity = lazy(() => import('./MessageEnhancements/BundleSecurity'));
// Phase 11: Multi-Media & Export (~85KB) - Lazy loaded on feature use
const BundleMultimedia = lazy(() => import('./MessageEnhancements/BundleMultimedia'));

// For immediate access to hooks and small components, import directly
import { useCommandPalette } from './MessageEnhancements/QuickActionsCommandPalette';
import { useAutoSaveDraft } from './MessageEnhancements/DraftManager';
import { messageEnhancementsService } from '../services/messageEnhancementsService';
import type { LiveCollaborator } from '../types/messageEnhancements';
import { VoiceTextButton } from './shared/VoiceTextButton';
import { MessageInput } from './MessageInput';
// Advanced Features - Context, Attention, Tasks, Artifacts
import { IntentComposer, ContextPanel } from './context';
import { MeetingDeflector } from './attention';
import { TaskExtractor } from './tasks/TaskExtractor';
import { ChannelArtifactComponent } from './artifacts';

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
        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
          <i className="fa-solid fa-user-plus text-2xl text-zinc-400"></i>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No contacts yet. Add your first contact to start messaging.</p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !email.trim() || isAdding || !onAddContact}
          className="w-full px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {isAdding ? (
            <>
              <i className="fa-solid fa-circle-notch fa-spin"></i>
              Adding...
            </>
          ) : (
            <>
              <i className="fa-solid fa-plus"></i>
              Add Contact & Start Chat
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Extended reaction emoji picker
const REACTION_CATEGORIES = {
  'Frequently Used': ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '🙏'],
  'Smileys': ['😀', '😊', '😄', '🤔', '😎', '🥳', '😍', '🤩'],
  'Gestures': ['👏', '🙌', '✌️', '🤝', '💪', '👊', '🫡', '✅'],
  'Objects': ['💡', '📌', '⚡', '🚀', '💯', '🎯', '⭐', '💎'],
};

// Smart message templates - these are base templates that get personalized
const MESSAGE_TEMPLATES = [
  { id: 'ack', label: 'Acknowledge', baseText: 'Got it, thanks!', contextKey: 'acknowledge' },
  { id: 'looking', label: 'Looking into it', baseText: "I'll look into this and get back to you shortly.", contextKey: 'investigate' },
  { id: 'meeting', label: 'Schedule meeting', baseText: "Let's schedule a quick call to discuss. What times work for you?", contextKey: 'meeting' },
  { id: 'followup', label: 'Follow up', baseText: "Just following up on this. Any updates?", contextKey: 'followup' },
  { id: 'thanks', label: 'Thank you', baseText: 'Thanks for the update!', contextKey: 'thanks' },
  { id: 'approve', label: 'Approve', baseText: 'Looks good to me. Approved! ✅', contextKey: 'approve' },
  { id: 'delay', label: 'Need more time', baseText: "I'll need a bit more time on this. Can we extend the deadline?", contextKey: 'delay' },
  { id: 'delegate', label: 'Delegate', baseText: "I'm looping in the right person who can help with this.", contextKey: 'delegate' },
];

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
        className="text-blue-500 hover:text-blue-600 underline break-all"
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
const generateSmartTemplateText = (
  templateId: string,
  baseText: string,
  contactName: string,
  lastMessage?: string
): string => {
  const firstName = contactName.split(' ')[0];
  const timeOfDay = new Date().getHours();
  const greeting = timeOfDay < 12 ? 'morning' : timeOfDay < 17 ? 'afternoon' : 'evening';

  switch (templateId) {
    case 'ack':
      return lastMessage?.includes('?')
        ? `Got it, ${firstName}! I'll look into that.`
        : `Thanks for letting me know, ${firstName}!`;
    case 'looking':
      return `Hey ${firstName}, I'm looking into this now and will get back to you shortly.`;
    case 'meeting':
      return `Hi ${firstName}! Let's schedule a quick call to discuss. What times work for you this week?`;
    case 'followup':
      return `Hi ${firstName}, just following up on our previous conversation. Any updates on your end?`;
    case 'thanks':
      return lastMessage?.toLowerCase().includes('done') || lastMessage?.toLowerCase().includes('complete')
        ? `Amazing work, ${firstName}! Really appreciate you getting this done.`
        : `Thanks for the update, ${firstName}!`;
    case 'approve':
      return `Looks great, ${firstName}! Approved ✅`;
    case 'delay':
      return `Hey ${firstName}, I'll need a bit more time on this. Would it be possible to extend the deadline?`;
    case 'delegate':
      return `Hi ${firstName}, I'm going to loop in the right person who can better help with this.`;
    default:
      return baseText;
  }
};

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
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'
];

interface MessagesProps {
  apiKey: string;
  contacts: Contact[];
  initialContactId?: string;
  onAddContact?: (contact: Omit<Contact, 'id'>) => Promise<Contact | null>;
  currentUser?: {
    id: string;
    name: string;
    email: string;
  };
}

const Messages: React.FC<MessagesProps> = ({ apiKey, contacts, initialContactId, onAddContact, currentUser }) => {
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

  // Filter Dropdown State
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const [typingThreads, setTypingThreads] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Mobile View State
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

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

  // --- NEW: Decision & Outcome State ---
  const [isProposalMode, setIsProposalMode] = useState(false);
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
  // Message scheduling
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState<Array<{id: string; text: string; scheduledFor: Date; threadId: string}>>([]);
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
  const [analyticsView, setAnalyticsView] = useState<'response' | 'engagement' | 'flow' | 'insights'>('response');

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
  const [showCommandPalette, setShowCommandPalette] = useState(false);
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
  
  // Attachment menu
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Thread organization
  const [threadFilter, setThreadFilter] = useState<'all' | 'unread' | 'pinned' | 'with-tasks' | 'with-decisions'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [archivedThreads, setArchivedThreads] = useState<string[]>([]);

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

  // Pulse User Search State
  const [pulseUserSearch, setPulseUserSearch] = useState('');
  const [pulseSearchResults, setPulseSearchResults] = useState<SearchUserResult[]>([]);
  const [isSearchingPulseUsers, setIsSearchingPulseUsers] = useState(false);
  const [pulseConversations, setPulseConversations] = useState<PulseConversation[]>([]);
  const [activePulseConversation, setActivePulseConversation] = useState<string | null>(null);
  const [pulseMessages, setPulseMessages] = useState<PulseMessage[]>([]);
  // Removed newChatTab - New Conversation modal now only shows Pulse users
  const [suggestedPulseUsers, setSuggestedPulseUsers] = useState<SearchUserResult[]>([]);
  const [recentPulseContacts, setRecentPulseContacts] = useState<SearchUserResult[]>([]);

  // Invite to Pulse state
  const [showInviteToPulseModal, setShowInviteToPulseModal] = useState(false);
  const [inviteToPulseSent, setInviteToPulseSent] = useState(false);
  const [inviteToPulseCopied, setInviteToPulseCopied] = useState(false);
  const [inviteTargetContact, setInviteTargetContact] = useState<Contact | null>(null);

  // Pulse message reactions and features state
  const [pulseMessageReactions, setPulseMessageReactions] = useState<Record<string, Array<{ emoji: string; count: number; me: boolean }>>>({});
  const [starredPulseMessages, setStarredPulseMessages] = useState<Set<string>>(new Set());
  const [replyingToPulseMessage, setReplyingToPulseMessage] = useState<PulseMessage | null>(null);
  const [pulseContextMenuMsgId, setPulseContextMenuMsgId] = useState<string | null>(null);
  const [pulseContextMenuPosition, setPulseContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

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

  // Load Pulse conversations, suggestions, and recent contacts on mount
  useEffect(() => {
    const loadPulseData = async () => {
      try {
        // Load conversations
        const conversations = await pulseService.getConversations();
        setPulseConversations(conversations);

        // Load recent contacts for quick access
        const recentContacts = await pulseService.getRecentContacts(5);
        setRecentPulseContacts(recentContacts);

        // Load suggested users for discovery
        const suggestions = await pulseService.getAllUsers(20);
        setSuggestedPulseUsers(suggestions);
      } catch (error) {
        console.error('Failed to load Pulse data:', error);
      }
    };
    loadPulseData();
  }, []);

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
        // Check if message already exists
        if (prev.some(m => m.id === newMessage.id)) {
          return prev;
        }
        // Check if this is replacing an optimistic message
        const withoutOptimistic = prev.filter(m => !m.id.startsWith('temp-'));
        return [...withoutOptimistic, newMessage];
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

    try {
      const messages = await pulseService.getMessages(conversationId);
      setPulseMessages(messages);

      // Mark messages as read
      await pulseService.markAsRead(conversationId);

      // Refresh conversations to update unread count
      const conversations = await pulseService.getConversations();
      setPulseConversations(conversations);
    } catch (error) {
      console.error('Failed to load Pulse messages:', error);
    }
  }, []);

  // Send a Pulse message
  const sendPulseMessage = useCallback(async (content: string) => {
    if (!activePulseConversation || !content.trim()) {
      console.log('sendPulseMessage: early return - no conversation or empty content');
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

    // Optimistically add message to UI - use a sender_id that's definitively not the other user's
    const optimisticMessage: PulseMessage = {
      id: tempId,
      sender_id: 'optimistic-self', // Use a marker that clearly isn't the other_user.id
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
      console.log('Sending message to:', conversation.other_user.id, 'content:', messageContent);
      const messageId = await pulseService.sendMessage(conversation.other_user.id, messageContent);
      console.log('Message sent, ID:', messageId);

      // Small delay to let the database sync
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reload messages to get the real message from server
      const messages = await pulseService.getMessages(activePulseConversation);
      console.log('Reloaded messages:', messages.length);
      setPulseMessages(messages);

      // Reload conversations to update preview
      const conversations = await pulseService.getConversations();
      setPulseConversations(conversations);
    } catch (error) {
      console.error('Failed to send Pulse message:', error);
      // Remove optimistic message on failure
      setPulseMessages(prev => prev.filter(m => m.id !== tempId));
      // Restore the input text so user can retry
      setInputText(messageContent);
    }
  }, [activePulseConversation, pulseConversations]);

  // Get active Pulse conversation details
  const activePulseConv = pulseConversations.find(c => c.id === activePulseConversation);

  // Handle Pulse message reactions
  const handlePulseReaction = useCallback((messageId: string, emoji: string) => {
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
  }, []);

  // Toggle starred Pulse messages
  const toggleStarPulseMessage = useCallback((messageId: string) => {
    setStarredPulseMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

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

  // Open context menu for Pulse message (right-click or long-press)
  const openPulseContextMenu = useCallback((msgId: string, x: number, y: number) => {
    setPulseContextMenuMsgId(msgId);
    setPulseContextMenuPosition({ x, y });
  }, []);

  // Close context menu
  const closePulseContextMenu = useCallback(() => {
    setPulseContextMenuMsgId(null);
    setPulseContextMenuPosition(null);
  }, []);

  // Handle right-click on Pulse message
  const handlePulseMessageContextMenu = useCallback((e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    openPulseContextMenu(msgId, e.clientX, e.clientY);
  }, [openPulseContextMenu]);

  // Handle long-press start on Pulse message (for mobile)
  const handlePulseLongPressStart = useCallback((e: React.TouchEvent, msgId: string) => {
    const touch = e.touches[0];
    longPressTimerRef.current = window.setTimeout(() => {
      openPulseContextMenu(msgId, touch.clientX, touch.clientY);
    }, 500); // 500ms long-press
  }, [openPulseContextMenu]);

  // Handle long-press end (cancel if released early)
  const handlePulseLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (pulseContextMenuMsgId) {
        closePulseContextMenu();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [pulseContextMenuMsgId, closePulseContextMenu]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const draftTimeoutRef = useRef<number | null>(null);

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

      // Try to send email via Resend
      const emailResult = await sendInvitationEmail(
        inviteEmail.trim(),
        inviterName,
        createResult.inviteId || '',
        'Pulse Team'
      );

      if (emailResult.message === 'fallback_mailto') {
        // Resend not configured, open mailto link
        const mailtoUrl = generateMailtoLink(inviteEmail.trim(), inviterName);
        window.open(mailtoUrl, '_blank');
        setInviteStatus('success');
        setInviteMessage('Email client opened! Send the email to complete the invitation.');
      } else if (emailResult.success) {
        setInviteStatus('success');
        setInviteMessage(`Invitation sent to ${inviteEmail.trim()}!`);
      } else {
        throw new Error(emailResult.message);
      }

      // Clear email after short delay
      setTimeout(() => {
        setInviteEmail('');
        setInviteStatus('idle');
        setInviteMessage('');
      }, 3000);

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
        if (!apiKey || isBotChat || !activeThread) return;
        setLoadingContext(true);
        setCatchUpSummary(null);
        setThreadContext(null);
        setTeamHealth(null);
        setNudge(null);

        const history = activeThread.messages.map(m => `${m.sender}: ${m.text}`).join('\n');

        const [catchUp, ctx, health, nudgeRec] = await Promise.all([
            (activeThread.unread || activeThread.messages.length > 5) ? generateCatchUpSummary(apiKey, history) : Promise.resolve(null),
            generateThreadContext(apiKey, history),
            analyzeTeamHealth(apiKey, history),
            generateNudge(apiKey, history)
        ]);

        if (catchUp) setCatchUpSummary(catchUp);
        if (ctx) setThreadContext(ctx);
        if (health) setTeamHealth(health);
        if (nudgeRec) setNudge(nudgeRec);

        // Update Outcome Progress if exists
        if (activeThread.outcome) {
            const outcomeData = await analyzeOutcomeProgress(apiKey, history, activeThread.outcome.goal);
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
  }, [activeThreadId, apiKey, activeThread]);

  // --- Effect: Draft Analysis & Meeting Detection ---
  useEffect(() => {
    if (draftTimeoutRef.current) window.clearTimeout(draftTimeoutRef.current);
    setDraftAnalysis(null);
    setAsyncSuggestion(null);

    if (inputText.length > 5 && apiKey && !isBotChat) {
        draftTimeoutRef.current = window.setTimeout(async () => {
            const analysis = await analyzeDraftIntent(apiKey, inputText);
            if (analysis && analysis.confidence > 0.7 && analysis.intent !== 'social') {
                setDraftAnalysis(analysis);
            }
            const deflection = await detectMeetingIntent(apiKey, inputText);
            if (deflection && deflection.detected) {
                setAsyncSuggestion(deflection);
            }
        }, 800);
    }
    return () => { if (draftTimeoutRef.current) window.clearTimeout(draftTimeoutRef.current); }
  }, [inputText, apiKey]);

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
          // Try AI-powered summary first if API key available
          if (apiKey) {
              const history = activeThread.messages.map(m => `${m.sender}: ${m.text}`).join('\n');
              const data = await generateHandoffSummary(apiKey, history);
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
      if (!apiKey) return;
      setLoadingArtifact(true);
      setShowArtifactModal(true);
      const history = activeThread.messages.map(m => `${m.sender}: ${m.text}`).join('\n');
      const data = await generateChannelArtifact(apiKey, history, activeThread.contactName);
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
          
          const analysis = await analyzeVoiceMemo(apiKey, base64);
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

  // Phase 1: Simulate typing indicator for active thread contact
  useEffect(() => {
    if (!activeThread) {
      setTypingCollaborators([]);
      return;
    }

    // Randomly show typing indicator for demo purposes
    // In production, this would connect to real-time presence service
    const simulateTyping = () => {
      const shouldShowTyping = Math.random() > 0.7; // 30% chance to show typing

      if (shouldShowTyping) {
        setTypingCollaborators([{
          userId: activeThread.contactId,
          userName: activeThread.contactName,
          avatarColor: activeThread.avatarColor,
          activity: 'typing',
          timestamp: new Date()
        }]);

        // Stop typing after 2-4 seconds
        const stopTypingTimeout = setTimeout(() => {
          setTypingCollaborators([]);
        }, 2000 + Math.random() * 2000);

        return () => clearTimeout(stopTypingTimeout);
      }
    };

    // Start typing simulation after 8-15 seconds
    const startDelay = 8000 + Math.random() * 7000;
    const startTimeout = setTimeout(simulateTyping, startDelay);

    return () => clearTimeout(startTimeout);
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
        userId: 'current-user',
        metadata: {
          thread_id: activeThreadId,
        },
        timestamp: new Date(),
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
        const response = await chatWithBot(apiKey, history, text);
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
      const taskData = await extractTaskFromMessage(apiKey, msg.text, contactNames);
      
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
    if (!apiKey || isBotChat || !activeThread) return;
    setLoadingAI(true);
    const history = activeThread.messages.map(m => ({ role: m.sender, text: m.text }));
    const reply = await generateSmartReply(apiKey, history);
    if (reply) setInputText(reply);
    setLoadingAI(false);
  }, [apiKey, isBotChat, activeThread]);

  // --- TTS Handler ---
  const handleTTS = useCallback(async (text: string, id: string) => {
    if (isPlayingId) return;
    setIsPlayingId(id);
    try {
      const audioData = await generateSpeech(apiKey, text);
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
  }, [apiKey, isPlayingId]);

  // --- File Upload Handler ---
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const attachment: Attachment = {
      type: isImage ? 'image' : 'file',
      name: file.name,
      url: URL.createObjectURL(file),
      size: `${(file.size / 1024).toFixed(1)} KB`
    };
    handleSend('', attachment);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowAttachmentMenu(false);
  }, []);

  // --- Image Upload Handler ---
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const attachment: Attachment = {
      type: 'image',
      name: file.name,
      url: URL.createObjectURL(file),
      size: `${(file.size / 1024).toFixed(1)} KB`
    };
    handleSend('', attachment);
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

  // Message scheduling
  const handleScheduleMessage = useCallback(() => {
    if (!inputText.trim() || !scheduleDate || !scheduleTime) return;

    const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledFor <= new Date()) {
      alert('Please select a future date/time');
      return;
    }

    const scheduled = {
      id: `sched-${Date.now()}`,
      text: inputText,
      scheduledFor,
      threadId: activeThreadId
    };

    setScheduledMessages(prev => [...prev, scheduled]);
    setInputText('');
    setShowScheduleModal(false);
    setScheduleDate('');
    setScheduleTime('');
  }, [inputText, scheduleDate, scheduleTime, activeThreadId]);

  // Check and send scheduled messages
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      scheduledMessages.forEach(msg => {
        if (msg.scheduledFor <= now) {
          // Send the message
          const wasActiveThread = activeThreadId;
          setActiveThreadId(msg.threadId);
          handleSend(msg.text);
          setActiveThreadId(wasActiveThread);
          // Remove from scheduled
          setScheduledMessages(prev => prev.filter(m => m.id !== msg.id));
        }
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [scheduledMessages, activeThreadId]);

  // Voice recording handlers
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
          duration: recordingDuration
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
  }, [recordingDuration]);

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

  // Message editing
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

  // Message forwarding
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
      // Ctrl+Shift+P for proposal mode
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsProposalMode(prev => !prev);
        return;
      }
      // Ctrl+Shift+T for templates
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setShowTemplates(prev => !prev);
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
          case 'slack': return <i className="fa-brands fa-slack text-white bg-purple-600 rounded p-0.5 text-[8px]" title="From Slack"></i>;
          case 'email': return <i className="fa-solid fa-envelope text-white bg-blue-500 rounded p-0.5 text-[8px]" title="From Email"></i>;
          case 'sms': return <i className="fa-solid fa-comment-sms text-white bg-green-500 rounded p-0.5 text-[8px]" title="From SMS"></i>;
          default: return null;
      }
  };

  // Handler to go back to message list (must be before any early returns)
  const handleBackToList = useCallback(() => {
    setActiveThreadId('');
    setActivePulseConversation(null);
    setMobileView('list');
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="text-center">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-blue-500 mb-4"></i>
          <p className="text-zinc-500 dark:text-zinc-400">Loading conversations...</p>
        </div>
      </div>
    );
  }

  // Cellular SMS Sub-page
  if (showCellularSMS) {
    return (
      <div className="h-full bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
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

  // Helper to render empty chat area when no thread selected
  const renderEmptyChatArea = () => (
    <div className={`flex-1 flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-950 ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
      {/* New Message Card - Clickable */}
      <div
        onClick={() => setShowNewChatModal(true)}
        className="w-full max-w-md cursor-pointer group"
      >
        <div className="bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 rounded-2xl p-8 border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:from-emerald-50 hover:to-cyan-50 dark:hover:from-emerald-950/30 dark:hover:to-cyan-950/30 transition-all duration-300 shadow-sm hover:shadow-lg">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-cyan-100 dark:from-emerald-900/50 dark:to-cyan-900/50 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-paper-plane text-3xl text-emerald-500 group-hover:text-emerald-600 transition-colors"></i>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
              Send a New Message
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-center mb-6 max-w-sm mx-auto">
              {pulseConversations.length > 0
                ? 'Start a new conversation with a Pulse user.'
                : 'Start your first Pulse conversation to begin messaging.'}
            </p>
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold group-hover:bg-emerald-500 transition">
              <i className="fa-solid fa-plus"></i>
              New Conversation
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {pulseConversations.length > 0 && (
        <div className="mt-8 text-center">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">Or select from your conversations</p>
          <div className="flex justify-center gap-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{pulseConversations.length}</span> Pulse chats
            </div>
            {threads.length > 0 && (
              <button
                onClick={() => setShowCellularSMS(true)}
                className="text-xs text-green-600 dark:text-green-400 hover:underline"
              >
                <i className="fa-solid fa-mobile-screen-button mr-1"></i>
                {threads.length} SMS
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative animate-fade-in shadow-xl">
      
      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-plus text-emerald-500"></i> New Conversation
              </h3>
              <button onClick={() => { setShowNewChatModal(false); setPulseUserSearch(''); setPulseSearchResults([]); }}>
                <i className="fa-solid fa-xmark text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"></i>
              </button>
            </div>

            <div className="p-4">
              {/* Pulse Users Only */}
              <div className="space-y-4">
                  <div className="relative">
                    <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm"></i>
                    <input
                      type="text"
                      value={pulseUserSearch}
                      onChange={(e) => setPulseUserSearch(e.target.value)}
                      placeholder="Search by @handle or name..."
                      className="w-full pl-10 pr-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      autoFocus
                    />
                    {isSearchingPulseUsers && (
                      <i className="fa-solid fa-circle-notch fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"></i>
                    )}
                  </div>

                  {pulseUserSearch.length < 1 ? (
                    // Show recent contacts and suggestions when no search
                    <div className="space-y-4 max-h-80 overflow-y-auto">
                      {/* Recent Contacts */}
                      {recentPulseContacts.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">
                            <i className="fa-solid fa-clock-rotate-left mr-1"></i> Recent
                          </p>
                          <div className="space-y-1">
                            {recentPulseContacts.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => startPulseConversation(user)}
                                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition text-left"
                              >
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                                  {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    (user.display_name || user.full_name || 'U').charAt(0)
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium dark:text-white truncate text-sm flex items-center gap-1">
                                    {user.display_name || user.full_name || 'Pulse User'}
                                    {user.is_verified && <i className="fa-solid fa-circle-check text-blue-500 text-[10px]"></i>}
                                  </div>
                                  {user.handle && <div className="text-[11px] text-emerald-500 truncate">@{user.handle}</div>}
                                </div>
                                <i className="fa-solid fa-message text-emerald-400 text-xs"></i>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested Users */}
                      {suggestedPulseUsers.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">
                            <i className="fa-solid fa-users mr-1"></i> Discover Pulse Users
                          </p>
                          <div className="space-y-1">
                            {suggestedPulseUsers.slice(0, 8).map((user) => (
                              <button
                                key={user.id}
                                onClick={() => startPulseConversation(user)}
                                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition text-left"
                              >
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                                  {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    (user.display_name || user.full_name || 'U').charAt(0)
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium dark:text-white truncate text-sm flex items-center gap-1">
                                    {user.display_name || user.full_name || 'Pulse User'}
                                    {user.is_verified && <i className="fa-solid fa-circle-check text-blue-500 text-[10px]"></i>}
                                  </div>
                                  {user.handle && <div className="text-[11px] text-emerald-500 truncate">@{user.handle}</div>}
                                </div>
                                <i className="fa-solid fa-plus text-zinc-400 text-xs"></i>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No suggestions available */}
                      {recentPulseContacts.length === 0 && suggestedPulseUsers.length === 0 && (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="fa-solid fa-at text-2xl text-emerald-500"></i>
                          </div>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Search for Pulse users by their @handle or name
                          </p>
                        </div>
                      )}
                    </div>
                  ) : pulseSearchResults.length === 0 && !isSearchingPulseUsers ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fa-solid fa-user-slash text-2xl text-zinc-400"></i>
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        No users found for "{pulseUserSearch}"
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                        Try a different search term
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {pulseSearchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => startPulseConversation(user)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition text-left border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              (user.display_name || user.full_name || 'U').charAt(0)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium dark:text-white truncate flex items-center gap-2">
                              {user.display_name || user.full_name || 'Pulse User'}
                              {user.is_verified && (
                                <i className="fa-solid fa-circle-check text-blue-500 text-xs"></i>
                              )}
                            </div>
                            {user.handle && (
                              <div className="text-xs text-emerald-500 truncate">@{user.handle}</div>
                            )}
                          </div>
                          <i className="fa-solid fa-message text-emerald-400 text-sm"></i>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 mt-4 pt-4 px-4 pb-4">
              <button
                onClick={() => { setShowNewChatModal(false); setPulseUserSearch(''); setPulseSearchResults([]); }}
                className="w-full text-center text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Artifact Modal */}
      {showArtifactModal && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl h-[80%] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in border border-zinc-200 dark:border-zinc-800">
                  <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950">
                      <h3 className="font-bold dark:text-white flex items-center gap-2"><i className="fa-solid fa-file-invoice"></i> Channel Artifact</h3>
                      <button onClick={() => setShowArtifactModal(false)}><i className="fa-solid fa-xmark text-zinc-500"></i></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8">
                      {loadingArtifact ? (
                          <div className="flex flex-col items-center justify-center h-full gap-4">
                              <i className="fa-solid fa-circle-notch fa-spin text-2xl text-blue-500"></i>
                              <p className="text-sm text-zinc-500">Generating spec from conversation history...</p>
                          </div>
                      ) : artifact ? (
                          <div className="prose dark:prose-invert max-w-none text-sm">
                              <h1 className="text-2xl font-bold mb-4">{artifact.title}</h1>
                              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mb-6 text-blue-800 dark:text-blue-200 italic">
                                  {artifact.overview}
                              </div>
                              <h3 className="font-bold uppercase text-xs tracking-wider text-zinc-500 mb-2">Decisions Log</h3>
                              <ul className="list-disc list-inside mb-6 space-y-1">
                                  {artifact.decisions.map((d, i) => <li key={i} className="text-zinc-700 dark:text-zinc-300">{d}</li>)}
                              </ul>
                              <h3 className="font-bold uppercase text-xs tracking-wider text-zinc-500 mb-2">Specifications</h3>
                              <div className="whitespace-pre-wrap font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl mb-6">
                                  {artifact.spec}
                              </div>
                              <h3 className="font-bold uppercase text-xs tracking-wider text-zinc-500 mb-2">Milestones</h3>
                              <div className="space-y-2">
                                  {artifact.milestones.map((m, i) => (
                                      <div key={i} className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                          <span className="text-zinc-700 dark:text-zinc-300">{m}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ) : (
                          <div className="text-center text-zinc-500">Failed to generate artifact.</div>
                      )}
                  </div>
                  <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                      <button 
                          onClick={handleExportToDocs} 
                          disabled={loadingArtifact || !artifact || exportingToDocs}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-6 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition disabled:opacity-50 mr-3 flex items-center gap-2"
                      >
                          {exportingToDocs ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-file-word"></i>}
                          Export to Docs
                      </button>
                      <button onClick={handleSaveArtifact} disabled={loadingArtifact || !artifact} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition disabled:opacity-50">
                          Save to Wiki
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Schedule Message Modal */}
      {showScheduleModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-clock text-blue-500"></i> Schedule Message
              </h3>
              <button onClick={() => setShowScheduleModal(false)}><i className="fa-solid fa-xmark text-zinc-500"></i></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg text-sm text-zinc-600 dark:text-zinc-300">
                {inputText || 'No message to schedule'}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Date</label>
                  <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Time</label>
                  <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" />
                </div>
              </div>
              {scheduledMessages.length > 0 && (
                <div className="border-t pt-3">
                  <div className="text-xs text-zinc-500 mb-2">Scheduled Messages ({scheduledMessages.length})</div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {scheduledMessages.map(msg => (
                      <div key={msg.id} className="flex justify-between items-center text-xs bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
                        <span className="truncate flex-1">{msg.text}</span>
                        <span className="text-zinc-400 ml-2">{msg.scheduledFor.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setShowScheduleModal(false)} className="px-4 py-2 text-zinc-500 hover:text-zinc-700">Cancel</button>
              <button onClick={handleScheduleMessage} disabled={!inputText.trim() || !scheduleDate || !scheduleTime} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50">Schedule</button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Message Modal */}
      {showForwardModal && forwardingMessage && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-share text-blue-500"></i> Forward Message
              </h3>
              <button onClick={() => setShowForwardModal(false)}><i className="fa-solid fa-xmark text-zinc-500"></i></button>
            </div>
            <div className="p-4">
              <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg text-sm text-zinc-600 dark:text-zinc-300 mb-4">
                {forwardingMessage.text}
              </div>
              <div className="text-xs text-zinc-500 mb-2">Select conversation:</div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {threads.filter(t => t.id !== activeThreadId).map(t => (
                  <button key={t.id} onClick={() => handleForwardMessage(t.id)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                    <div className={`w-8 h-8 rounded-full ${t.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>{t.contactName.charAt(0)}</div>
                    <span className="text-sm dark:text-white">{t.contactName}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-keyboard text-blue-500"></i> Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowShortcuts(false)}><i className="fa-solid fa-xmark text-zinc-500"></i></button>
            </div>
            <div className="p-4 space-y-2">
              {Object.entries(KEYBOARD_SHORTCUTS).map(([key, action]) => (
                <div key={key} className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">{action}</span>
                  <kbd className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs font-mono">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Thread Statistics Panel */}
      {showStatsPanel && activeThread && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-chart-bar text-blue-500"></i> Conversation Statistics
              </h3>
              <button onClick={() => setShowStatsPanel(false)}><i className="fa-solid fa-xmark text-zinc-500"></i></button>
            </div>
            <div className="p-4 space-y-4">
              {(() => {
                const stats = messagesExportService.getThreadStatistics(activeThread);
                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-500">{stats.totalMessages}</div>
                        <div className="text-xs text-zinc-500">Total Messages</div>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-500">{stats.averageResponseTime}m</div>
                        <div className="text-xs text-zinc-500">Avg Response</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className="text-lg font-bold dark:text-white">{stats.sentByMe}</div>
                        <div className="text-xs text-zinc-500">Sent</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold dark:text-white">{stats.sentByThem}</div>
                        <div className="text-xs text-zinc-500">Received</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold dark:text-white">{stats.attachments}</div>
                        <div className="text-xs text-zinc-500">Attachments</div>
                      </div>
                    </div>
                    <div className="border-t pt-3">
                      <div className="text-xs text-zinc-500 mb-2">Decisions</div>
                      <div className="flex gap-3">
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">{stats.decisions.approved} Approved</span>
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">{stats.decisions.pending} Pending</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">{stats.tasksCreated} Tasks</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Invite Team Modal */}
      {showInviteModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-user-plus text-rose-500"></i> Invite Team Member
              </h3>
              <button onClick={() => { setShowInviteModal(false); setInviteEmail(''); setInviteStatus('idle'); setInviteMessage(''); }}>
                <i className="fa-solid fa-xmark text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Invite a team member to join Pulse. They'll receive an email with instructions to sign in with Google.
              </p>

              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                  placeholder="teammate@example.com"
                  disabled={inviteStatus === 'sending'}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition disabled:opacity-50"
                  autoFocus
                />
              </div>

              {inviteMessage && (
                <div className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
                  inviteStatus === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                  inviteStatus === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                  'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}>
                  <i className={`fa-solid ${inviteStatus === 'success' ? 'fa-check-circle' : inviteStatus === 'error' ? 'fa-exclamation-circle' : 'fa-circle-info'}`}></i>
                  {inviteMessage}
                </div>
              )}

              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">What they'll get</div>
                <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-rose-500 text-xs"></i>
                    Access to team messaging & channels
                  </li>
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-rose-500 text-xs"></i>
                    AI-powered meeting notes & transcription
                  </li>
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-rose-500 text-xs"></i>
                    Shared contacts & calendar integration
                  </li>
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-rose-500 text-xs"></i>
                    Install Pulse as a desktop app (PWA)
                  </li>
                </ul>
              </div>
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
              <button
                onClick={() => { setShowInviteModal(false); setInviteEmail(''); setInviteStatus('idle'); setInviteMessage(''); }}
                className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvite}
                disabled={!inviteEmail.trim() || inviteStatus === 'sending'}
                className="px-6 py-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {inviteStatus === 'sending' ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i>
                    Send Invite
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && threadToDelete && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-trash text-2xl text-red-500"></i>
              </div>
              <h3 className="font-bold text-lg dark:text-white mb-2">Delete Conversation?</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                This will permanently delete this conversation and all its messages. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setThreadToDelete(null); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteThread}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar (Threads) */}
      <div className={`w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 flex-col bg-zinc-50 dark:bg-zinc-900/50 flex-shrink-0 ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-5 flex justify-between items-center">
          <h2 className="font-bold text-lg text-zinc-900 dark:text-white tracking-tight">Pulse Messages</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInviteModal(true)} className="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 flex items-center justify-center transition" title="Invite team member">
              <i className="fa-solid fa-user-plus text-xs"></i>
            </button>
            <button onClick={() => setShowCellularSMS(true)} className="w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 flex items-center justify-center transition" title="Cellular SMS">
              <i className="fa-solid fa-mobile-screen-button text-xs"></i>
            </button>
            <button onClick={() => setShowShortcuts(true)} className="w-8 h-8 rounded-lg text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center transition" title="Keyboard shortcuts">
              <i className="fa-solid fa-keyboard text-xs"></i>
            </button>
            <button onClick={() => setShowNewChatModal(true)} className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition" title="New message">
              <i className="fa-solid fa-pen-to-square text-xs"></i>
            </button>
          </div>
        </div>

        {/* Thread Filter Dropdown */}
        <div className="px-4 pb-3 relative">
          <div className="flex items-center gap-2">
            {/* Filter Dropdown */}
            <div className="relative flex-1">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm hover:border-zinc-300 dark:hover:border-zinc-600 transition"
              >
                <span className="flex items-center gap-2">
                  <i className={`fa-solid ${
                    threadFilter === 'all' ? 'fa-inbox' :
                    threadFilter === 'unread' ? 'fa-circle' :
                    threadFilter === 'pinned' ? 'fa-thumbtack' :
                    threadFilter === 'with-tasks' ? 'fa-check-square' :
                    'fa-gavel'
                  } text-xs text-zinc-500`}></i>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {threadFilter === 'all' ? 'All Messages' :
                     threadFilter === 'unread' ? 'Unread' :
                     threadFilter === 'pinned' ? 'Pinned' :
                     threadFilter === 'with-tasks' ? 'With Tasks' :
                     'With Votes'}
                  </span>
                </span>
                <i className={`fa-solid fa-chevron-down text-xs text-zinc-400 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`}></i>
              </button>
              {showFilterDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 py-1 animate-fade-in">
                  {([
                    { key: 'all', label: 'All Messages', icon: 'fa-inbox' },
                    { key: 'unread', label: 'Unread', icon: 'fa-circle' },
                    { key: 'pinned', label: 'Pinned', icon: 'fa-thumbtack' },
                    { key: 'with-tasks', label: 'With Tasks', icon: 'fa-check-square' },
                    { key: 'with-decisions', label: 'With Votes', icon: 'fa-gavel' },
                  ] as const).map(filter => (
                    <button
                      key={filter.key}
                      onClick={() => { setThreadFilter(filter.key as any); setShowFilterDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition ${threadFilter === filter.key ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}
                    >
                      <i className={`fa-solid ${filter.icon} text-xs w-4`}></i>
                      {filter.label}
                      {threadFilter === filter.key && <i className="fa-solid fa-check text-xs ml-auto text-emerald-500"></i>}
                    </button>
                  ))}
                  <div className="border-t border-zinc-200 dark:border-zinc-700 my-1"></div>
                  <button
                    onClick={() => { setShowArchived(!showArchived); setShowFilterDropdown(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition ${showArchived ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-600 dark:text-zinc-400'}`}
                  >
                    <i className="fa-solid fa-archive text-xs w-4"></i>
                    {showArchived ? 'Hide Archived' : 'Show Archived'}
                    {showArchived && <i className="fa-solid fa-check text-xs ml-auto text-amber-500"></i>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm pl-9 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs"></i>
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            )}
          </div>
          {isSearchOpen && searchQuery && (
            <div className="mt-2 flex gap-2">
              {(['all', 'files', 'decisions', 'tasks'] as const).map(f => (
                <button key={f} onClick={() => { setSearchFilter(f); handleSearch(searchQuery); }} className={`px-2 py-1 rounded text-xs ${searchFilter === f ? 'bg-blue-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'}`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchQuery && searchResults.length > 0 && (
          <div className="px-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <div className="text-xs text-zinc-500 px-2 mb-2">{searchResults.length} results</div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {searchResults.slice(0, 5).map(result => (
                <button
                  key={result.message.id}
                  onClick={() => { setActiveThreadId(result.thread.id); setActivePulseConversation(null); setMobileView('chat'); setSearchQuery(''); setSearchResults([]); }}
                  className="w-full text-left p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  <div className="text-xs font-medium dark:text-white truncate">{result.thread.contactName}</div>
                  <div className="text-xs text-zinc-500 truncate">{result.message.text}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-2 space-y-1">
          {/* Pulse Conversations Only - SMS threads moved to Cellular SMS sub-page */}
          {pulseConversations.length > 0 ? (
            <>
              {pulseConversations.map((conv) => {
                const otherUser = conv.other_user;
                if (!otherUser) return null;
                const hasUnread = (conv.unread_count || 0) > 0;
                return (
                  <div
                    key={conv.id}
                    className={`p-3 rounded-xl cursor-pointer transition relative group flex items-center gap-3
                      ${activePulseConversation === conv.id ? 'bg-emerald-50 dark:bg-emerald-900/20 shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50'}`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedContactUserId(otherUser.id);
                        setShowContactPanel(true);
                      }}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 relative hover:ring-2 hover:ring-emerald-500/50 transition-all"
                      title="View contact details"
                    >
                      {otherUser.avatar_url ? (
                        <img src={otherUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        (otherUser.display_name || otherUser.handle || '?').charAt(0).toUpperCase()
                      )}
                      {/* Online indicator */}
                      <div className="absolute -bottom-0.5 -right-0.5">
                        <OnlineIndicator userId={otherUser.id} size="medium" />
                      </div>
                      {otherUser.is_verified && (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900">
                          <i className="fa-solid fa-check text-[7px] text-white"></i>
                        </div>
                      )}
                    </button>
                    <div onClick={() => selectPulseConversation(conv.id)} className="flex-1 overflow-hidden min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h3 className={`text-sm truncate ${hasUnread ? 'font-bold dark:text-white' : 'font-medium text-zinc-700 dark:text-zinc-300'}`}>
                          {otherUser.display_name || otherUser.full_name || otherUser.handle || 'Unknown'}
                        </h3>
                        {conv.last_message_at && (
                          <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-2">
                            {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <i className="fa-solid fa-at text-emerald-500 text-[10px]"></i>
                        {otherUser.handle && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">@{otherUser.handle}</span>}
                        {conv.last_message_preview && (
                          <p className="text-xs truncate text-zinc-500 ml-1">{conv.last_message_preview}</p>
                        )}
                      </div>
                    </div>
                    {/* Thread Badges - Pin/Star indicators */}
                    <ThreadBadges actions={messageEnhancements.getThreadActions(conv.id)} />
                    {hasUnread && (
                      <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                        <span className="text-[10px] text-white font-bold">{conv.unread_count}</span>
                      </div>
                    )}
                    {/* Thread Actions Menu - Pin/Star/Mute/Archive */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ThreadActionsMenu
                        actions={messageEnhancements.getThreadActions(conv.id)}
                        onTogglePin={() => messageEnhancements.toggleThreadPin(conv.id)}
                        onToggleStar={() => messageEnhancements.toggleThreadStar(conv.id)}
                        onToggleMute={() => messageEnhancements.toggleThreadMute(conv.id)}
                        onToggleArchive={() => messageEnhancements.toggleThreadArchive(conv.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            /* Empty state when no Pulse conversations */
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-cyan-100 dark:from-emerald-900/30 dark:to-cyan-900/30 flex items-center justify-center mb-4">
                <i className="fa-solid fa-comments text-3xl text-emerald-500"></i>
              </div>
              <h3 className="text-zinc-900 dark:text-white font-semibold mb-2">No Pulse Messages Yet</h3>
              <p className="text-zinc-500 text-sm mb-4 max-w-[200px]">
                Start a conversation with a Pulse user to get started.
              </p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition"
              >
                <i className="fa-solid fa-plus mr-2"></i>
                New Conversation
              </button>
              {threads.length > 0 && (
                <button
                  onClick={() => setShowCellularSMS(true)}
                  className="mt-3 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                >
                  <i className="fa-solid fa-mobile-screen-button mr-2 text-green-500"></i>
                  View SMS ({threads.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      {/* Pulse Conversation View */}
      {activePulseConv && !activeThread && (
        <div className={`flex-1 flex flex-col relative min-w-0 bg-white dark:bg-zinc-950 ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
          {/* Pulse Chat Header */}
          <div className="min-h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 py-2 z-10 bg-white dark:bg-zinc-950/80 backdrop-blur-md sticky top-0">
            <div className="flex items-center gap-3">
              <button onClick={handleBackToList} className="text-zinc-500 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition" title="Back to messages">
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <button
                onClick={() => {
                  if (activePulseConv.other_user?.id) {
                    setSelectedContactUserId(activePulseConv.other_user.id);
                    setShowContactPanel(true);
                  }
                }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 relative hover:ring-2 hover:ring-emerald-500/50 transition-all"
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
              <div className="flex flex-col">
                <span className="font-bold text-zinc-900 dark:text-white leading-tight flex items-center gap-2">
                  {activePulseConv.other_user?.display_name || activePulseConv.other_user?.full_name || 'Unknown'}
                  {activePulseConv.other_user?.is_verified && (
                    <i className="fa-solid fa-circle-check text-blue-500 text-xs"></i>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {activePulseConv.other_user?.handle && (
                    <span className="text-xs text-emerald-500 font-medium">@{activePulseConv.other_user.handle}</span>
                  )}
                  {activePulseConv.other_user?.id && (
                    <OnlineIndicator userId={activePulseConv.other_user.id} showText={true} />
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons for Pulse Conversations - Brand Colors (Emerald/Cyan) */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Tools Drawer Button - Emerald */}
              <button
                onClick={() => setShowToolsDrawer(true)}
                className="group w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 border-2 border-emerald-300 dark:border-emerald-600 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/40 text-emerald-600 dark:text-emerald-400 hover:scale-110 hover:shadow-lg hover:shadow-emerald-500/30 hover:border-emerald-400 dark:hover:border-emerald-500 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/60 dark:hover:to-teal-900/60"
                title="Open Tools Menu"
              >
                <i className="fa-solid fa-toolbox text-sm group-hover:animate-pulse"></i>
              </button>

              {/* Search - Cyan */}
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className={`group w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 border-2 ${isSearchOpen
                  ? 'bg-gradient-to-br from-cyan-500 to-teal-500 text-white border-cyan-400 shadow-lg shadow-cyan-500/40'
                  : 'border-cyan-200 dark:border-cyan-700 bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-900/40 dark:to-sky-900/40 text-cyan-600 dark:text-cyan-400 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/30 hover:border-cyan-400 dark:hover:border-cyan-500 hover:from-cyan-100 hover:to-sky-100 dark:hover:from-cyan-900/60 dark:hover:to-sky-900/60'}`}
                title="Search Messages"
              >
                <i className={`fa-solid fa-magnifying-glass text-sm ${!isSearchOpen ? 'group-hover:animate-pulse' : ''}`}></i>
              </button>

              {/* Focus Mode - Teal/Emerald when active */}
              <button
                onClick={toggleFocusMode}
                className={`group w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 border-2 ${focusThreadId
                  ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/40'
                  : 'border-teal-200 dark:border-teal-700 bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/40 dark:to-emerald-900/40 text-teal-600 dark:text-teal-400 hover:scale-110 hover:shadow-lg hover:shadow-teal-500/30 hover:border-teal-400 dark:hover:border-teal-500 hover:from-teal-100 hover:to-emerald-100 dark:hover:from-teal-900/60 dark:hover:to-emerald-900/60'}`}
                title={focusThreadId ? "Exit Focus Mode" : "Enter Focus Mode"}
              >
                <i className={`fa-solid fa-crosshairs text-sm ${focusThreadId ? 'animate-pulse' : 'group-hover:animate-pulse'}`}></i>
              </button>
            </div>

          </div>

          {/* Pulse Message Search Panel */}
          {isSearchOpen && (
            <div className="border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-3 animate-slide-down">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search messages in this conversation..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 text-sm pl-9 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 text-xs"></i>
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                      <i className="fa-solid fa-xmark text-xs"></i>
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
                        className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:border-blue-400 transition"
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
                              ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">{part}</mark>
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

          {/* Tools Drawer for Pulse Conversations - Rendered outside header for proper z-index */}
          <AnimatePresence>
            {showToolsDrawer && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 bg-black/50 z-[100]"
                  onClick={() => setShowToolsDrawer(false)}
                />
                {/* Drawer */}
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-zinc-900 z-[101] shadow-2xl overflow-y-auto"
                >
                  <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between">
                    <h3 className="font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                      <motion.i 
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className="fa-solid fa-toolbox text-indigo-500"
                      />
                      Tools
                    </h3>
                    <button onClick={() => setShowToolsDrawer(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>

                  <div className="p-4 space-y-6">
                    {/* Quick Actions */}
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">Quick Actions</h4>
                      <div className="space-y-1">
                        <button
                          onClick={() => {
                            if (pulseMessages.length === 0) return;
                            const summary = `## Conversation Summary with ${activePulseConv.other_user?.display_name || activePulseConv.other_user?.handle || 'Pulse User'}\n\n**Total Messages:** ${pulseMessages.length}\n**Started:** ${pulseMessages[0] ? new Date(pulseMessages[0].created_at).toLocaleDateString() : 'N/A'}\n**Last Activity:** ${pulseMessages[pulseMessages.length - 1] ? new Date(pulseMessages[pulseMessages.length - 1].created_at).toLocaleDateString() : 'N/A'}\n\n### Recent Topics\n${pulseMessages.slice(-10).map(m => `- ${m.content.slice(0, 50)}${m.content.length > 50 ? '...' : ''}`).join('\n')}`;
                            setSummary(summary);
                            setShowHandoffCard(true);
                            setShowToolsDrawer(false);
                          }}
                          disabled={pulseMessages.length === 0}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 disabled:opacity-50 group"
                        >
                          <motion.i 
                            whileHover={{ x: 5 }}
                            className="fa-solid fa-person-walking-arrow-right text-yellow-500 w-5"
                          />
                          Generate Handoff
                        </button>
                        <button
                          onClick={() => {
                            const messagesText = pulseMessages.map(m =>
                              `[${new Date(m.created_at).toLocaleString()}] ${m.sender_id === activePulseConv.other_user?.id ? activePulseConv.other_user?.display_name || 'User' : 'You'}: ${m.content}`
                            ).join('\n');
                            const blob = new Blob([messagesText], { type: 'text/markdown' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `pulse-chat-${activePulseConv.other_user?.handle || 'user'}-${new Date().toISOString().split('T')[0]}.md`;
                            a.click();
                            URL.revokeObjectURL(url);
                            setShowToolsDrawer(false);
                          }}
                          disabled={pulseMessages.length === 0}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 disabled:opacity-50 group"
                        >
                          <motion.i 
                            whileHover={{ y: 2 }}
                            className="fa-solid fa-download text-green-500 w-5"
                          />
                          Export Messages
                        </button>
                        <button onClick={() => { setShowStatsPanel(true); setShowToolsDrawer(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 group">
                          <motion.i 
                            whileHover={{ scaleY: [1, 1.2, 0.8, 1], transition: { repeat: Infinity, duration: 1 } }}
                            className="fa-solid fa-chart-bar text-indigo-500 w-5"
                          />
                          Conversation Stats
                        </button>
                        <button onClick={() => { setShowOutcomeSetup(true); setShowToolsDrawer(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 group">
                          <motion.i 
                            whileHover={{ scale: 1.2 }}
                            className="fa-solid fa-bullseye text-red-500 w-5"
                          />
                          Set Outcome Goal
                        </button>
                        <button onClick={() => { setShowTaskExtractor(true); setShowToolsDrawer(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 group">
                          <motion.i 
                            whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0], transition: { duration: 0.5 } }}
                            className="fa-solid fa-tasks text-orange-500 w-5"
                          />
                          Extract Tasks
                        </button>
                        <button onClick={() => { setShowChannelArtifactPanel(true); setShowToolsDrawer(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 group">
                          <motion.i 
                            whileHover={{ x: 5 }}
                            className="fa-solid fa-file-export text-blue-500 w-5"
                          />
                          Export as Document
                        </button>
                      </div>
                    </div>

                    {/* Tool Panels */}
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">Tool Panels</h4>
                      <div className="space-y-1">
                        <button onClick={() => { togglePanel('analytics', showAnalyticsPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showAnalyticsPanel ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ rotate: [0, 90, 180, 270, 360], transition: { duration: 2, repeat: Infinity, ease: "linear" } }}
                            className="fa-solid fa-chart-pie text-indigo-500 w-5"
                          />
                          Conversation Analytics
                        </button>
                        <button onClick={() => { togglePanel('collaboration', showCollaborationPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showCollaborationPanel ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ rotate: 180, transition: { duration: 1 } }}
                            className="fa-solid fa-users-gear text-purple-500 w-5"
                          />
                          Collaboration Tools
                        </button>
                        <button onClick={() => { togglePanel('productivity', showProductivityPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showProductivityPanel ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ y: [0, -3, -5, -3, 0], x: [0, -1, 1, -1, 0], transition: { duration: 0.5, repeat: Infinity } }}
                            className="fa-solid fa-rocket text-cyan-500 w-5"
                          />
                          Productivity Tools
                        </button>
                        <button onClick={() => { togglePanel('intelligence', showIntelligencePanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showIntelligencePanel ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ scale: [1, 1.2, 1], transition: { duration: 1, repeat: Infinity } }}
                            className="fa-solid fa-brain text-violet-500 w-5"
                          />
                          Intelligence & Organization
                        </button>
                        <button onClick={() => { togglePanel('proactive', showProactivePanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showProactivePanel ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ opacity: [1, 0.5, 1], scale: [1, 1.1, 1], transition: { duration: 0.8, repeat: Infinity } }}
                            className="fa-solid fa-lightbulb text-rose-500 w-5"
                          />
                          Smart Reminders
                        </button>
                        <button onClick={() => { togglePanel('communication', showCommunicationPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showCommunicationPanel ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ scale: [1, 1.1, 1], rotate: [0, -10, 10, 0], transition: { duration: 0.5, repeat: Infinity } }}
                            className="fa-solid fa-comments text-amber-500 w-5"
                          />
                          Communication Tools
                        </button>
                        <button onClick={() => { togglePanel('personalization', showPersonalizationPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showPersonalizationPanel ? 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ x: [0, 3, -3, 0], transition: { duration: 0.5 } }}
                            className="fa-solid fa-sliders text-fuchsia-500 w-5"
                          />
                          Personalization
                        </button>
                        <button onClick={() => { togglePanel('security', showSecurityPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showSecurityPanel ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ scale: 1.2 }}
                            className="fa-solid fa-shield-halved text-emerald-500 w-5"
                          />
                          Security & Insights
                        </button>
                        <button onClick={() => { togglePanel('mediaHub', showMediaHubPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showMediaHubPanel ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ rotate: [0, 10, -10, 0], scale: 1.1 }}
                            className="fa-solid fa-photo-film text-cyan-500 w-5"
                          />
                          Media Hub & Export
                        </button>
                      </div>
                    </div>

                    {/* Appearance */}
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">Appearance</h4>
                      <div className="space-y-1">
                        <button onClick={() => { setShowThemeSelector(!showThemeSelector); setShowToolsDrawer(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 group">
                          <motion.i 
                            whileHover={{ rotate: 180 }}
                            className="fa-solid fa-palette text-purple-500 w-5"
                          />
                          Message Theme
                        </button>
                        <button onClick={() => { setShowContextPanel(!showContextPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showContextPanel ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ scale: 1.1, y: -2 }}
                            className="fa-solid fa-layer-group text-purple-500 w-5"
                          />
                          Context Panel
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

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

          {/* Pulse Messages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {pulseMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-cyan-100 dark:from-emerald-900/30 dark:to-cyan-900/30 rounded-full flex items-center justify-center mb-4">
                  <i className="fa-solid fa-comments text-3xl text-emerald-500"></i>
                </div>
                <h3 className="text-lg font-bold dark:text-white mb-2">Start a Conversation</h3>
                <p className="text-sm text-zinc-500 max-w-sm">
                  Send a message to {activePulseConv.other_user?.display_name || activePulseConv.other_user?.handle || 'this user'} to start chatting!
                </p>
              </div>
            ) : (
              pulseMessages.map((msg, idx) => {
                const isMe = msg.sender_id !== activePulseConv.other_user?.id;
                const showAvatar = idx === 0 || pulseMessages[idx - 1]?.sender_id !== msg.sender_id;
                const showDate = idx === 0 || new Date(msg.created_at).toDateString() !== new Date(pulseMessages[idx - 1]?.created_at).toDateString();
                const reactions = pulseMessageReactions[msg.id] || [];
                const isStarred = starredPulseMessages.has(msg.id);
                const isReplyTarget = replyingToPulseMessage?.id === msg.id;

                return (
                  <React.Fragment key={msg.id}>
                    {/* Date separator */}
                    {showDate && (
                      <div className="flex items-center justify-center my-4">
                        <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                          {new Date(msg.created_at).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative mb-4`}>
                      {!isMe && showAvatar && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-xs text-white mr-2 mt-auto flex-shrink-0">
                          {activePulseConv.other_user?.avatar_url ? (
                            <img src={activePulseConv.other_user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            (activePulseConv.other_user?.display_name || '?').charAt(0).toUpperCase()
                          )}
                        </div>
                      )}
                      {!isMe && !showAvatar && <div className="w-8 mr-2"></div>}

                      <div className="max-w-[70%] relative">
                        {/* Star indicator */}
                        {isStarred && (
                          <div className={`absolute -top-2 ${isMe ? '-left-2' : '-right-2'} z-10`}>
                            <i className="fa-solid fa-star text-amber-400 text-xs"></i>
                          </div>
                        )}

                        {/* Reply indicator */}
                        {isReplyTarget && (
                          <div className="absolute -top-6 left-0 right-0 flex items-center gap-1 text-[10px] text-emerald-500">
                            <i className="fa-solid fa-reply"></i>
                            <span>Replying to this message</span>
                          </div>
                        )}

                        {/* Message bubble - right-click or long-press for actions */}
                        <div
                          className={`px-4 py-2.5 shadow-sm cursor-pointer select-none transition-transform active:scale-[0.98]`}
                          style={{
                            background: isMe
                              ? (selectedColorPair.userGradient || selectedColorPair.userColor)
                              : (selectedColorPair.otherGradient || selectedColorPair.otherColor),
                            color: isMe ? selectedColorPair.userTextColor : selectedColorPair.otherTextColor,
                            borderRadius: selectedColorPair.borderRadius,
                            borderBottomRightRadius: isMe ? '0.375rem' : selectedColorPair.borderRadius,
                            borderBottomLeftRadius: !isMe ? '0.375rem' : selectedColorPair.borderRadius
                          }}
                          onContextMenu={(e) => handlePulseMessageContextMenu(e, msg.id)}
                          onTouchStart={(e) => handlePulseLongPressStart(e, msg.id)}
                          onTouchEnd={handlePulseLongPressEnd}
                          onTouchCancel={handlePulseLongPressEnd}
                          onTouchMove={handlePulseLongPressEnd}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{renderTextWithLinks(msg.content)}</p>
                          <div
                            className="text-[10px] mt-1.5 flex items-center gap-2"
                            style={{
                              color: isMe ? `${selectedColorPair.userTextColor}B3` : `${selectedColorPair.otherTextColor}99`,
                              justifyContent: isMe ? 'flex-end' : 'flex-start'
                            }}
                          >
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && msg.is_read && (
                              <span className="flex items-center gap-0.5" style={{ opacity: 0.9 }}>
                                <i className="fa-solid fa-check-double"></i>
                                <span className="text-[9px]">Read</span>
                              </span>
                            )}
                            {isMe && !msg.is_read && (
                              <i className="fa-solid fa-check" style={{ opacity: 0.7 }}></i>
                            )}
                          </div>
                        </div>

                        {/* Context Menu - appears on right-click or long-press */}
                        {pulseContextMenuMsgId === msg.id && pulseContextMenuPosition && (
                          <div
                            className="fixed z-50 animate-fade-in"
                            style={{
                              top: Math.min(pulseContextMenuPosition.y, window.innerHeight - 320),
                              left: Math.min(pulseContextMenuPosition.x, window.innerWidth - 200)
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden min-w-[180px]">
                              {/* Quick Reactions Row */}
                              <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center justify-around">
                                  {COMMON_REACTIONS.map(emoji => (
                                    <button
                                      key={emoji}
                                      onClick={() => {
                                        handlePulseReaction(msg.id, emoji);
                                        closePulseContextMenu();
                                      }}
                                      className="w-9 h-9 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition text-lg hover:scale-125"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {/* Action Items */}
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setReplyingToPulseMessage(msg);
                                    closePulseContextMenu();
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3 transition"
                                >
                                  <i className="fa-solid fa-reply text-blue-500 w-4"></i>
                                  Reply
                                </button>
                                <button
                                  onClick={() => {
                                    copyPulseMessage(msg.content);
                                    closePulseContextMenu();
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3 transition"
                                >
                                  <i className="fa-solid fa-copy text-zinc-500 w-4"></i>
                                  Copy Text
                                </button>
                                <button
                                  onClick={() => {
                                    toggleStarPulseMessage(msg.id);
                                    closePulseContextMenu();
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3 transition"
                                >
                                  <i className={`fa-${isStarred ? 'solid' : 'regular'} fa-star ${isStarred ? 'text-amber-400' : 'text-zinc-500'} w-4`}></i>
                                  {isStarred ? 'Unstar' : 'Star'}
                                </button>
                                <button
                                  onClick={() => {
                                    sharePulseMessage(msg);
                                    closePulseContextMenu();
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3 transition"
                                >
                                  <i className="fa-solid fa-share text-purple-500 w-4"></i>
                                  Share
                                </button>
                                <button
                                  onClick={() => {
                                    // Forward to another conversation
                                    setForwardingMessage({
                                      id: msg.id,
                                      sender: isMe ? 'me' : 'other',
                                      source: 'pulse',
                                      text: msg.content,
                                      timestamp: new Date(msg.created_at),
                                      status: 'read'
                                    });
                                    setShowForwardModal(true);
                                    closePulseContextMenu();
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3 transition"
                                >
                                  <i className="fa-solid fa-arrow-right text-emerald-500 w-4"></i>
                                  Forward
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Reactions display */}
                        {reactions.length > 0 && (
                          <div className={`flex gap-1 mt-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {reactions.map((r, ridx) => (
                              <button
                                key={ridx}
                                onClick={() => handlePulseReaction(msg.id, r.emoji)}
                                className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition ${r.me ? 'bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700' : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'}`}
                              >
                                <span>{r.emoji}</span>
                                <span className="text-zinc-500">{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pulse Conversation Stats Modal */}
          {showStatsPanel && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                  <h3 className="font-bold dark:text-white flex items-center gap-2">
                    <i className="fa-solid fa-chart-bar text-indigo-500"></i> Pulse Conversation Stats
                  </h3>
                  <button onClick={() => setShowStatsPanel(false)}><i className="fa-solid fa-xmark text-zinc-500"></i></button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-emerald-500">{pulseMessages.length}</div>
                      <div className="text-xs text-zinc-500">Total Messages</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-cyan-500">
                        {pulseMessages.length > 0 ? new Date(pulseMessages[pulseMessages.length - 1].created_at).toLocaleDateString() : 'N/A'}
                      </div>
                      <div className="text-xs text-zinc-500">Last Activity</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {pulseMessages.filter(m => m.sender_id !== activePulseConv?.other_user?.id).length}
                      </div>
                      <div className="text-xs text-zinc-500">Sent by You</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                        {pulseMessages.filter(m => m.sender_id === activePulseConv?.other_user?.id).length}
                      </div>
                      <div className="text-xs text-zinc-500">Received</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-violet-600 dark:text-violet-400">
                        {pulseMessages.length > 0 ? Math.round((new Date().getTime() - new Date(pulseMessages[0].created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0}
                      </div>
                      <div className="text-xs text-zinc-500">Days Active</div>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="text-xs text-zinc-500 mb-2">Conversation Started</div>
                    <div className="text-sm text-zinc-700 dark:text-zinc-300">
                      {pulseMessages.length > 0 ? new Date(pulseMessages[0].created_at).toLocaleString() : 'No messages yet'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pulse Outcome Setup Modal */}
          {showOutcomeSetup && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                  <h3 className="font-bold dark:text-white flex items-center gap-2">
                    <i className="fa-solid fa-bullseye text-red-500"></i> Set Conversation Goal
                  </h3>
                  <button onClick={() => setShowOutcomeSetup(false)}><i className="fa-solid fa-xmark text-zinc-500"></i></button>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Define a goal for this conversation to track progress and stay focused.
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">Goal Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Close Deal', 'Schedule Meeting', 'Get Approval', 'Resolve Issue'].map(goal => (
                        <button
                          key={goal}
                          onClick={() => {
                            // Store goal in localStorage for now
                            localStorage.setItem(`pulse-goal-${activePulseConv?.id}`, goal);
                            setShowOutcomeSetup(false);
                          }}
                          className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-sm text-zinc-700 dark:text-zinc-300 transition"
                        >
                          {goal}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">Custom Goal</label>
                    <input
                      type="text"
                      placeholder="Enter your custom goal..."
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
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
              <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                  <h3 className="font-bold dark:text-white flex items-center gap-2">
                    <i className="fa-solid fa-person-walking-arrow-right text-yellow-500"></i> Conversation Handoff
                  </h3>
                  <button onClick={() => setShowHandoffCard(false)}><i className="fa-solid fa-xmark text-zinc-500"></i></button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-lg p-4">
                    <div className="text-xs font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider mb-2">
                      <i className="fa-solid fa-handshake mr-2"></i>Context Summary
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-3">
                      Conversation with <strong>{activePulseConv?.other_user?.display_name || activePulseConv?.other_user?.handle || 'User'}</strong>
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-zinc-500">Total Messages:</span>
                        <span className="ml-2 font-bold text-zinc-800 dark:text-zinc-200">{pulseMessages.length}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Started:</span>
                        <span className="ml-2 font-bold text-zinc-800 dark:text-zinc-200">
                          {pulseMessages.length > 0 ? new Date(pulseMessages[0].created_at).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-500 uppercase mb-2">Recent Topics</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {pulseMessages.slice(-5).map((m, i) => (
                        <div key={i} className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                          • {m.content.slice(0, 60)}{m.content.length > 60 ? '...' : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const handoffText = `📋 Conversation Handoff\n\nContact: ${activePulseConv?.other_user?.display_name || activePulseConv?.other_user?.handle || 'User'}\nMessages: ${pulseMessages.length}\nStarted: ${pulseMessages.length > 0 ? new Date(pulseMessages[0].created_at).toLocaleDateString() : 'N/A'}\n\nRecent Topics:\n${pulseMessages.slice(-5).map(m => '• ' + m.content.slice(0, 50)).join('\n')}`;
                        navigator.clipboard.writeText(handoffText);
                        setShowHandoffCard(false);
                      }}
                      className="flex-1 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800/30 dark:hover:bg-yellow-800/50 text-yellow-800 dark:text-yellow-200 font-bold py-2 rounded-lg text-xs transition flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-copy"></i> Copy to Clipboard
                    </button>
                    <button
                      onClick={() => setShowHandoffCard(false)}
                      className="px-4 py-2 text-zinc-500 hover:text-zinc-700 text-xs"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pulse Message Input */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            {/* Reply indicator */}
            {replyingToPulseMessage && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <div className="w-1 h-8 bg-emerald-500 rounded-full"></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                    Replying to {replyingToPulseMessage.sender_id === activePulseConv.other_user?.id ? activePulseConv.other_user?.display_name || 'them' : 'yourself'}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">{replyingToPulseMessage.content}</div>
                </div>
                <button
                  onClick={() => setReplyingToPulseMessage(null)}
                  className="text-zinc-400 hover:text-zinc-600 p-1"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendPulseMessage(replyingToPulseMessage ? `> ${replyingToPulseMessage.content.slice(0, 50)}${replyingToPulseMessage.content.length > 50 ? '...' : ''}\n\n${inputText}` : inputText);
                    setReplyingToPulseMessage(null);
                  }
                  if (e.key === 'Escape' && replyingToPulseMessage) {
                    setReplyingToPulseMessage(null);
                  }
                }}
                placeholder={replyingToPulseMessage ? 'Type your reply...' : `Message ${activePulseConv.other_user?.display_name || activePulseConv.other_user?.handle || 'user'}...`}
                className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition"
              />
              <button
                onClick={() => {
                  sendPulseMessage(replyingToPulseMessage ? `> ${replyingToPulseMessage.content.slice(0, 50)}${replyingToPulseMessage.content.length > 50 ? '...' : ''}\n\n${inputText}` : inputText);
                  setReplyingToPulseMessage(null);
                }}
                disabled={!inputText.trim()}
                className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-xl flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fa-solid fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regular Thread Chat View */}
      {!activeThread && !activePulseConv && renderEmptyChatArea()}
      {activeThread && (
      <div className={`flex-1 flex flex-col relative min-w-0 bg-white dark:bg-zinc-950 ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>

        {/* Header - Mobile Optimized */}
        <div className="min-h-[56px] md:h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-2 sm:px-4 z-10 bg-white dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-shrink">
             <button onClick={handleBackToList} className="text-zinc-500 p-1.5 sm:p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition flex-shrink-0" title="Back to messages"><i className="fa-solid fa-arrow-left text-sm"></i></button>
             <div className="flex flex-col min-w-0">
                 <span className="font-bold text-zinc-900 dark:text-white leading-tight flex items-center gap-1 sm:gap-2 text-sm sm:text-base truncate">
                     <span className="truncate max-w-[120px] sm:max-w-none">{activeThread.contactName}</span>
                     {activeThread.outcome && <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-[10px] uppercase font-bold tracking-wider flex-shrink-0">Goal Active</span>}
                 </span>
                 {activeThread.outcome ? (
                     <div className="flex items-center gap-2 text-[10px]">
                         <span className="text-zinc-500 hidden sm:inline">Progress:</span>
                         <div className="w-12 sm:w-16 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                             <div className={`h-full rounded-full ${activeThread.outcome.status === 'blocked' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width: `${activeThread.outcome.progress}%`}}></div>
                         </div>
                     </div>
                 ) : (
                     <div className="flex items-center gap-1 sm:gap-2">
                         <span className="text-[10px] text-emerald-500 font-medium tracking-wide">ONLINE</span>
                         {teamHealth && (
                             <span className={`hidden sm:flex text-[10px] px-1.5 rounded items-center gap-1 cursor-help ${teamHealth.status === 'healthy' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`} title={`Reliability: ${teamHealth.reliability}\nIssues: ${teamHealth.issues.join(', ')}`}>
                                 <i className="fa-solid fa-heart-pulse"></i> {teamHealth.score}%
                             </span>
                         )}
                     </div>
                 )}
             </div>
          </div>

          {/* AI Coach Tip - Hidden on mobile, visible on md+ */}
          {nudge && showCoachTip && (
            <div className={`hidden md:flex flex-1 max-w-md mx-4 transition-all duration-300 ${coachTipFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/50 rounded-lg group">
                <i className="fa-solid fa-wand-magic-sparkles text-purple-500 text-xs flex-shrink-0 animate-pulse"></i>
                <div className="flex-1 overflow-hidden relative">
                  <div className="ticker-container whitespace-nowrap">
                    <span className="text-xs text-purple-700 dark:text-purple-300 inline-block ticker-text">
                      {nudge.message}
                    </span>
                    <span className="text-xs text-purple-700 dark:text-purple-300 inline-block ticker-text" aria-hidden="true">
                      {nudge.message}
                    </span>
                  </div>
                </div>
                <button onClick={dismissCoachTip} className="text-purple-400 hover:text-purple-600 transition p-0.5 flex-shrink-0">
                  <i className="fa-solid fa-xmark text-[10px]"></i>
                </button>
              </div>
            </div>
          )}

          {/* Header Actions - Clean with Tools Drawer */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Tools Drawer Button - Always visible */}
            <button
              onClick={() => setShowToolsDrawer(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex-shrink-0"
              title="Open Tools Menu"
            >
              <i className="fa-solid fa-grid-2 text-xs sm:text-sm"></i>
            </button>

            {/* Command Palette - Always visible */}
            <button
              onClick={() => setShowCommandPalette(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition border text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-shrink-0"
              title="Quick Actions (Ctrl+K)"
            >
              <i className="fa-solid fa-terminal text-xs sm:text-sm"></i>
            </button>

            {/* Focus Mode - Always visible */}
            <button
              onClick={toggleFocusMode}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition border flex-shrink-0 ${focusThreadId ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
              title="Focus Mode"
            >
              <i className="fa-solid fa-eye text-xs sm:text-sm"></i>
            </button>
          </div>

          {/* Tools Drawer - Slide-out panel with all tools */}
          <AnimatePresence>
            {showToolsDrawer && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 bg-black/50 z-40"
                  onClick={() => setShowToolsDrawer(false)}
                />
                {/* Drawer */}
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-zinc-900 z-50 shadow-2xl overflow-y-auto"
                >
                  <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between">
                    <h3 className="font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                      <motion.i 
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className="fa-solid fa-toolbox text-indigo-500"
                      />
                      Tools
                    </h3>
                    <button onClick={() => setShowToolsDrawer(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>

                  <div className="p-4 space-y-6">
                    {/* Quick Actions Section */}
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">Quick Actions</h4>
                      <div className="space-y-1">
                        <button onClick={() => { handleGenerateHandoff(); setShowToolsDrawer(false); }} disabled={loadingHandoff || activeThread.messages.length === 0} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 disabled:opacity-50 group">
                          <motion.i 
                            whileHover={{ x: 5 }}
                            className={`fa-solid ${loadingHandoff ? 'fa-circle-notch fa-spin' : 'fa-person-walking-arrow-right'} text-yellow-500 w-5`}
                          />
                          Generate Handoff
                        </button>
                        <button onClick={() => { handleGenerateArtifact(); setShowToolsDrawer(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 group">
                          <motion.i 
                            whileHover={{ y: -2 }}
                            className="fa-solid fa-file-export text-blue-500 w-5"
                          />
                          Export Artifact
                        </button>
                        <button onClick={() => { setShowExportMenu(true); setShowToolsDrawer(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 group">
                          <motion.i 
                            whileHover={{ y: 2 }}
                            className="fa-solid fa-download text-green-500 w-5"
                          />
                          Export Messages
                        </button>
                        <button onClick={() => { setShowOutcomeSetup(true); setShowToolsDrawer(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 group">
                          <motion.i 
                            whileHover={{ scale: 1.2 }}
                            className="fa-solid fa-bullseye text-red-500 w-5"
                          />
                          Set Outcome Goal
                        </button>
                      </div>
                    </div>

                    {/* Analytics Section */}
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">Analytics & Insights</h4>
                      <div className="space-y-1">
                        <button onClick={() => { setShowStatsPanel(true); setShowToolsDrawer(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 group">
                          <motion.i 
                            whileHover={{ scaleY: [1, 1.2, 0.8, 1], transition: { repeat: Infinity, duration: 1 } }}
                            className="fa-solid fa-chart-bar text-indigo-500 w-5"
                          />
                          Conversation Stats
                        </button>
                        <button onClick={() => { setShowAnalyticsDashboard(true); setShowToolsDrawer(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 group">
                          <motion.i 
                            whileHover={{ x: [0, 2, 4], y: [0, -2, -4], transition: { repeat: Infinity, repeatType: "reverse", duration: 1 } }}
                            className="fa-solid fa-chart-line text-indigo-500 w-5"
                          />
                          Analytics Dashboard
                        </button>
                        <button onClick={() => { setShowNetworkGraph(true); setShowToolsDrawer(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 group">
                          <motion.i 
                            whileHover={{ rotate: 90 }}
                            className="fa-solid fa-diagram-project text-purple-500 w-5"
                          />
                          Network Graph
                        </button>
                      </div>
                    </div>

                    {/* Tool Panels Section */}
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">Tool Panels</h4>
                      <div className="space-y-1">
                        <button onClick={() => { togglePanel('analytics', showAnalyticsPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showAnalyticsPanel ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ rotate: [0, 90, 180, 270, 360], transition: { duration: 2, repeat: Infinity, ease: "linear" } }}
                            className="fa-solid fa-chart-pie text-indigo-500 w-5"
                          />
                          Conversation Analytics
                        </button>
                        <button onClick={() => { togglePanel('collaboration', showCollaborationPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showCollaborationPanel ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ rotate: 180, transition: { duration: 1 } }}
                            className="fa-solid fa-users-gear text-purple-500 w-5"
                          />
                          Collaboration Tools
                        </button>
                        <button onClick={() => { togglePanel('productivity', showProductivityPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showProductivityPanel ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ y: [0, -3, -5, -3, 0], x: [0, -1, 1, -1, 0], transition: { duration: 0.5, repeat: Infinity } }}
                            className="fa-solid fa-rocket text-cyan-500 w-5"
                          />
                          Productivity Tools
                        </button>
                        <button onClick={() => { togglePanel('intelligence', showIntelligencePanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showIntelligencePanel ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ scale: [1, 1.2, 1], transition: { duration: 1, repeat: Infinity } }}
                            className="fa-solid fa-brain text-violet-500 w-5"
                          />
                          Intelligence & Organization
                        </button>
                        <button onClick={() => { togglePanel('proactive', showProactivePanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showProactivePanel ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ opacity: [1, 0.5, 1], scale: [1, 1.1, 1], transition: { duration: 0.8, repeat: Infinity } }}
                            className="fa-solid fa-lightbulb text-rose-500 w-5"
                          />
                          Smart Reminders
                        </button>
                        <button onClick={() => { togglePanel('communication', showCommunicationPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showCommunicationPanel ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ scale: [1, 1.1, 1], rotate: [0, -10, 10, 0], transition: { duration: 0.5, repeat: Infinity } }}
                            className="fa-solid fa-comments text-amber-500 w-5"
                          />
                          Communication Tools
                        </button>
                        <button onClick={() => { togglePanel('personalization', showPersonalizationPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showPersonalizationPanel ? 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ x: [0, 3, -3, 0], transition: { duration: 0.5 } }}
                            className="fa-solid fa-sliders text-fuchsia-500 w-5"
                          />
                          Personalization
                        </button>
                        <button onClick={() => { togglePanel('security', showSecurityPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showSecurityPanel ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ scale: 1.2 }}
                            className="fa-solid fa-shield-halved text-emerald-500 w-5"
                          />
                          Security & Insights
                        </button>
                        <button onClick={() => { togglePanel('mediaHub', showMediaHubPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showMediaHubPanel ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ rotate: [0, 10, -10, 0], scale: 1.1 }}
                            className="fa-solid fa-photo-film text-cyan-500 w-5"
                          />
                          Media Hub & Export
                        </button>
                      </div>
                    </div>

                    {/* Appearance Section */}
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">Appearance</h4>
                      <div className="space-y-1">
                        <button onClick={() => { setShowThemeSelector(!showThemeSelector); setShowToolsDrawer(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm text-zinc-700 dark:text-zinc-300 group">
                          <motion.i 
                            whileHover={{ rotate: 180 }}
                            className="fa-solid fa-palette text-purple-500 w-5"
                          />
                          Message Theme
                        </button>
                        <button onClick={() => { setShowContextPanel(!showContextPanel); setShowToolsDrawer(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm group ${showContextPanel ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                          <motion.i 
                            whileHover={{ scale: 1.1, y: -2 }}
                            className="fa-solid fa-layer-group text-purple-500 w-5"
                          />
                          Context Panel
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Outcome Setup Modal */}
        {showOutcomeSetup && (
            <div className="absolute top-16 left-0 right-0 z-30 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 shadow-lg animate-slide-up">
                <h4 className="text-sm font-bold mb-2 dark:text-white">Define Desired Outcome</h4>
                <div className="flex gap-2">
                    <input type="text" value={outcomeGoal} onChange={e => setOutcomeGoal(e.target.value)} placeholder="e.g., Ship v2.0 by Friday" className="flex-1 border rounded-lg px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700 outline-none" />
                    <button onClick={handleSetOutcome} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Set</button>
                    <button onClick={() => setShowOutcomeSetup(false)} className="text-zinc-500 px-3">Cancel</button>
                </div>
            </div>
        )}

        {/* Phase 3: Analytics Panel */}
        {showAnalyticsPanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 animate-slide-down">
            {/* Tab Navigation */}
            <div className="flex gap-1 mb-4">
              {[
                { id: 'response' as const, label: 'Response Time', icon: 'fa-stopwatch' },
                { id: 'engagement' as const, label: 'Engagement', icon: 'fa-fire' },
                { id: 'flow' as const, label: 'Flow', icon: 'fa-diagram-project' },
                { id: 'insights' as const, label: 'AI Insights', icon: 'fa-lightbulb' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setAnalyticsView(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    analyticsView === tab.id
                      ? 'bg-indigo-500 text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon}`} />
                  {tab.label}
                </button>
              ))}
              <button
                onClick={() => setShowAnalyticsPanel(false)}
                className="ml-auto text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <i className="fa-solid fa-times" />
              </button>
            </div>

            {/* Tab Content */}
            <div className="max-h-80 overflow-y-auto">
              {analyticsView === 'response' && (
                <Suspense fallback={<FeatureSkeleton type="card" />}>
                  <BundleAnalytics.ResponseTimeTracker
                    messages={activeThread.messages.map(m => ({
                      id: m.id,
                      sender: m.sender,
                      timestamp: m.timestamp
                    }))}
                    contactName={activeThread.contactName}
                  />
                </Suspense>
              )}
              {analyticsView === 'engagement' && (
                <Suspense fallback={<FeatureSkeleton type="card" />}>
                  <BundleAnalytics.EngagementScoring
                    messages={activeThread.messages.map(m => ({
                      id: m.id,
                      text: m.text,
                      sender: m.sender,
                      timestamp: m.timestamp,
                      reactions: m.reactions
                    }))}
                    contactName={activeThread.contactName}
                  />
                </Suspense>
              )}
              {analyticsView === 'flow' && (
                <Suspense fallback={<FeatureSkeleton type="modal" />}>
                  <BundleAnalytics.ConversationFlowViz
                    messages={activeThread.messages.map(m => ({
                      id: m.id,
                      text: m.text,
                      sender: m.sender,
                      timestamp: m.timestamp,
                      type: 'message' as const,
                      reactions: m.reactions
                    }))}
                    contactName={activeThread.contactName}
                    onMessageClick={(msgId) => {
                      const msgEl = document.getElementById(`message-${msgId}`);
                      msgEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  />
                </Suspense>
              )}
              {analyticsView === 'insights' && (
                <Suspense fallback={<FeatureSkeleton type="panel" />}>
                  <BundleAnalytics.ProactiveInsightsEnhanced
                    messages={activeThread.messages.map(m => ({
                      id: m.id,
                      text: m.text,
                      sender: m.sender,
                      timestamp: m.timestamp
                    }))}
                    contactName={activeThread.contactName}
                    onActionClick={(action) => {
                      if (action.startsWith('Hey ')) {
                        setInputText(action);
                      }
                    }}
                  />
                </Suspense>
              )}
            </div>
          </div>
        )}

        {/* Phase 4: Collaboration Panel */}
        {showCollaborationPanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 animate-slide-down">
            {/* Tab Navigation */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
              {[
                { id: 'collab' as const, label: 'Team', icon: 'fa-users' },
                { id: 'links' as const, label: 'Links', icon: 'fa-link' },
                { id: 'kb' as const, label: 'Knowledge', icon: 'fa-book' },
                { id: 'search' as const, label: 'Search', icon: 'fa-search' },
                { id: 'pins' as const, label: 'Pins', icon: 'fa-thumbtack' },
                { id: 'annotations' as const, label: 'Notes', icon: 'fa-comment-dots' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setCollaborationTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                    collaborationTab === tab.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon}`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-80 overflow-y-auto">
              {collaborationTab === 'collab' && (
                <Suspense fallback={<FeatureSkeleton type="list" />}>
                  <BundleCollaboration.ThreadCollaboration
                    threadId={activeThread.id}
                    participants={[
                      { id: 'user', name: 'You', role: 'owner', status: 'active', joinedAt: new Date().toISOString() },
                      { id: activeThread.contactId, name: activeThread.contactName, role: 'member', status: 'active', joinedAt: activeThread.createdAt || new Date().toISOString() }
                    ]}
                    currentUserId="user"
                    onInvite={(email, role) => console.log('Invite:', email, role)}
                    onRemoveParticipant={(id) => console.log('Remove:', id)}
                    onChangeRole={(id, role) => console.log('Change role:', id, role)}
                  />
                </Suspense>
              )}
              {collaborationTab === 'links' && (
                <Suspense fallback={<FeatureSkeleton type="list" />}>
                  <BundleCollaboration.ThreadLinking
                    currentThreadId={activeThread.id}
                    linkedThreads={[]}
                    crossReferences={[]}
                    availableThreads={threads.filter(t => t.id !== activeThread.id).map(t => ({
                      id: t.id,
                      title: t.contactName,
                      preview: t.messages[t.messages.length - 1]?.text || 'No messages'
                    }))}
                    onLinkThread={(threadId, type) => console.log('Link thread:', threadId, type)}
                    onUnlinkThread={(threadId) => console.log('Unlink thread:', threadId)}
                    onNavigateToThread={(threadId) => {
                      const thread = threads.find(t => t.id === threadId);
                      if (thread) setActiveThread(thread);
                    }}
                  />
                </Suspense>
              )}
              {collaborationTab === 'kb' && (
                <Suspense fallback={<FeatureSkeleton type="panel" />}>
                  <BundleCollaboration.KnowledgeBase
                    articles={[
                      { id: '1', title: 'Getting Started Guide', category: 'Onboarding', content: 'Welcome to our platform...', tags: ['guide', 'basics'], lastUpdated: new Date().toISOString(), relevanceScore: 0.95 },
                      { id: '2', title: 'FAQ - Common Questions', category: 'Support', content: 'Frequently asked questions...', tags: ['faq', 'help'], lastUpdated: new Date().toISOString(), relevanceScore: 0.85 }
                    ]}
                    contextSuggestions={[]}
                    onArticleClick={(id) => console.log('Open article:', id)}
                    onInsertSnippet={(snippet) => setInputText(prev => prev + snippet)}
                  />
                </Suspense>
              )}
              {collaborationTab === 'search' && (
                <Suspense fallback={<FeatureSkeleton type="modal" />}>
                  <BundleCollaboration.AdvancedSearch
                    messages={activeThread.messages.map(m => ({
                      id: m.id,
                      text: m.text,
                      sender: m.sender === 'user' ? 'You' : activeThread.contactName,
                      timestamp: m.timestamp,
                      hasAttachment: m.attachments && m.attachments.length > 0,
                      isDecision: m.text.toLowerCase().includes('decided') || m.text.toLowerCase().includes('decision'),
                      isTask: m.text.toLowerCase().includes('todo') || m.text.toLowerCase().includes('task')
                    }))}
                    onResultClick={(messageId) => {
                      const msgEl = document.getElementById(`message-${messageId}`);
                      msgEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    savedSearches={[]}
                    onSaveSearch={(search) => console.log('Save search:', search)}
                  />
                </Suspense>
              )}
              {collaborationTab === 'pins' && (
                <Suspense fallback={<FeatureSkeleton type="list" />}>
                  <BundleCollaboration.MessagePinning
                    pinnedMessages={pinnedMessages}
                    highlights={highlights}
                    onUnpin={(id) => setPinnedMessages(prev => prev.filter(p => p.id !== id))}
                    onJumpToMessage={(messageId) => {
                      const msgEl = document.getElementById(`message-${messageId}`);
                      msgEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    onEditPin={(id, updates) => setPinnedMessages(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))}
                    onRemoveHighlight={(id) => setHighlights(prev => prev.filter(h => h.id !== id))}
                    onCategoryChange={(id, category) => setPinnedMessages(prev => prev.map(p => p.id === id ? { ...p, category } : p))}
                  />
                </Suspense>
              )}
              {collaborationTab === 'annotations' && (
                <Suspense fallback={<FeatureSkeleton type="panel" />}>
                  <BundleCollaboration.CollaborativeAnnotations
                    annotations={annotations}
                    currentUserId="user"
                    onReply={(annotationId, reply) => {
                      setAnnotations(prev => prev.map(a => a.id === annotationId ? {
                        ...a,
                        replies: [...a.replies, { id: uuidv4(), content: reply, author: { id: 'user', name: 'You' }, createdAt: new Date().toISOString(), mentions: [] }]
                      } : a));
                    }}
                    onResolve={(id) => setAnnotations(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a))}
                    onReopen={(id) => setAnnotations(prev => prev.map(a => a.id === id ? { ...a, resolved: false } : a))}
                    onDelete={(id) => setAnnotations(prev => prev.filter(a => a.id !== id))}
                    onReact={(annotationId, emoji) => {
                    setAnnotations(prev => prev.map(a => {
                      if (a.id !== annotationId) return a;
                      const existingReaction = a.reactions.find(r => r.emoji === emoji);
                      if (existingReaction) {
                        if (existingReaction.users.includes('user')) {
                          return { ...a, reactions: a.reactions.map(r => r.emoji === emoji ? { ...r, users: r.users.filter(u => u !== 'user') } : r).filter(r => r.users.length > 0) };
                        }
                        return { ...a, reactions: a.reactions.map(r => r.emoji === emoji ? { ...r, users: [...r.users, 'user'] } : r) };
                      }
                      return { ...a, reactions: [...a.reactions, { emoji, users: ['user'] }] };
                    }));
                  }}
                  onJumpToMessage={(messageId) => {
                    const msgEl = document.getElementById(`message-${messageId}`);
                    msgEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                />
                </Suspense>
              )}
            </div>
          </div>
        )}

        {/* Phase 5: Productivity Panel */}
        {showProductivityPanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 animate-slide-down">
            {/* Tab Navigation */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
              {[
                { id: 'templates' as const, label: 'Templates', icon: 'fa-file-lines' },
                { id: 'schedule' as const, label: 'Schedule', icon: 'fa-clock' },
                { id: 'summary' as const, label: 'Summary', icon: 'fa-list-check' },
                { id: 'export' as const, label: 'Export', icon: 'fa-download' },
                { id: 'shortcuts' as const, label: 'Shortcuts', icon: 'fa-keyboard' },
                { id: 'notifications' as const, label: 'Alerts', icon: 'fa-bell' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setProductivityTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                    productivityTab === tab.id
                      ? 'bg-cyan-600 text-white'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon}`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-80 overflow-y-auto">
              {productivityTab === 'templates' && (
                <Suspense fallback={<FeatureSkeleton type="list" />}>
                  <BundleProductivity.SmartTemplates
                    templates={userTemplates}
                    contactName={activeThread.contactName}
                    onInsertTemplate={(content) => setInputText(prev => prev + content)}
                    onSaveTemplate={(template) => {
                      setUserTemplates(prev => [...prev, {
                        ...template,
                        id: uuidv4(),
                        usageCount: 0
                      }]);
                    }}
                    onDeleteTemplate={(id) => setUserTemplates(prev => prev.filter(t => t.id !== id))}
                  />
                </Suspense>
              )}
              {productivityTab === 'schedule' && (
                <Suspense fallback={<FeatureSkeleton type="modal" />}>
                  <BundleProductivity.MessageScheduling
                    scheduledMessages={userScheduledMessages}
                    reminders={userReminders}
                    currentThreadId={activeThread.id}
                    currentThreadName={activeThread.contactName}
                    onScheduleMessage={(message) => {
                      setUserScheduledMessages(prev => [...prev, {
                        ...message,
                        id: uuidv4(),
                        createdAt: new Date().toISOString(),
                        status: 'pending'
                      }]);
                    }}
                    onCancelScheduled={(id) => setUserScheduledMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'cancelled' } : m))}
                    onCreateReminder={(reminder) => {
                      setUserReminders(prev => [...prev, {
                        ...reminder,
                        id: uuidv4(),
                        completed: false
                      }]);
                    }}
                    onCompleteReminder={(id) => setUserReminders(prev => prev.map(r => r.id === id ? { ...r, completed: true } : r))}
                    onDeleteReminder={(id) => setUserReminders(prev => prev.filter(r => r.id !== id))}
                  />
                </Suspense>
              )}
              {productivityTab === 'summary' && (
                <Suspense fallback={<FeatureSkeleton type="card" />}>
                  <BundleProductivity.ConversationSummary
                    messages={activeThread.messages.map(m => ({
                      id: m.id,
                      text: m.text,
                      sender: m.sender,
                      senderName: m.sender === 'user' ? 'You' : activeThread.contactName,
                      timestamp: m.timestamp
                    }))}
                    contactName={activeThread.contactName}
                    onExportSummary={(format) => console.log('Export summary:', format)}
                    onShareSummary={(method) => console.log('Share summary:', method)}
                  />
                </Suspense>
              )}
              {productivityTab === 'export' && (
                <Suspense fallback={<FeatureSkeleton type="modal" />}>
                  <BundleProductivity.ExportSharing
                    threadId={activeThread.id}
                    threadTitle={activeThread.contactName}
                    messageCount={activeThread.messages.length}
                    onExport={async (options) => {
                      console.log('Export with options:', options);
                      return { url: '#' };
                    }}
                    onShare={async (options) => {
                      console.log('Share with options:', options);
                      return { shareUrl: 'https://pulse.app/share/abc123', success: true };
                    }}
                  />
                </Suspense>
              )}
              {productivityTab === 'shortcuts' && (
                <Suspense fallback={<FeatureSkeleton type="modal" />}>
                  <BundleProductivity.KeyboardShortcuts
                    shortcuts={[]}
                    onShortcutTriggered={(action) => console.log('Shortcut triggered:', action)}
                  />
                </Suspense>
              )}
              {productivityTab === 'notifications' && (
                <Suspense fallback={<FeatureSkeleton type="panel" />}>
                  <BundleProductivity.NotificationPreferences
                    channels={[]}
                    rules={[]}
                    quietHours={{ enabled: false, startTime: '22:00', endTime: '07:00', allowUrgent: true, days: ['mon', 'tue', 'wed', 'thu', 'fri'] }}
                    onUpdateQuietHours={(updates) => console.log('Update quiet hours:', updates)}
                  />
                </Suspense>
              )}
            </div>
          </div>
        )}

        {/* Phase 6: Intelligence & Organization Panel */}
        {showIntelligencePanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 animate-slide-down">
            {/* Tab Navigation */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
              {[
                { id: 'insights' as const, label: 'Contact Insights', icon: 'fa-user-chart' },
                { id: 'reactions' as const, label: 'Reactions', icon: 'fa-face-smile' },
                { id: 'bookmarks' as const, label: 'Bookmarks', icon: 'fa-bookmark' },
                { id: 'tags' as const, label: 'Tags', icon: 'fa-tags' },
                { id: 'delivery' as const, label: 'Delivery', icon: 'fa-check-double' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setIntelligenceTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                    intelligenceTab === tab.id
                      ? 'bg-violet-600 text-white'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-violet-50 dark:hover:bg-violet-900/20'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon}`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {intelligenceTab === 'insights' && (
                <Suspense fallback={<FeatureSkeleton type="card" />}>
                  <BundleIntelligence.ContactInsights
                    contactId={activeThread.contactId}
                    onClose={() => setIntelligenceTab('insights')}
                  />
                </Suspense>
              )}
              {intelligenceTab === 'reactions' && (
                <Suspense fallback={<FeatureSkeleton type="card" />}>
                  <BundleIntelligence.ReactionsAnalytics
                    conversationId={activeThread.id}
                    onClose={() => setIntelligenceTab('reactions')}
                  />
                </Suspense>
              )}
              {intelligenceTab === 'bookmarks' && (
                <Suspense fallback={<FeatureSkeleton type="list" />}>
                  <BundleIntelligence.MessageBookmarks
                    bookmarks={userBookmarks.filter(b => b.conversationId === activeThread.id)}
                    onBookmarkClick={(bookmark) => {
                      // Scroll to bookmarked message
                      const element = document.getElementById(`message-${bookmark.messageId}`);
                      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    onBookmarkDelete={(id) => setUserBookmarks(prev => prev.filter(b => b.id !== id))}
                    onBookmarkUpdate={(bookmark) => setUserBookmarks(prev => prev.map(b => b.id === bookmark.id ? bookmark : b))}
                    onClose={() => setIntelligenceTab('bookmarks')}
                  />
                </Suspense>
              )}
              {intelligenceTab === 'tags' && (
                <Suspense fallback={<FeatureSkeleton type="inline" />}>
                  <BundleIntelligence.ConversationTags
                    conversationId={activeThread.id}
                    conversationTags={conversationTagAssignments}
                    onTagAssign={(convId, tagId) => {
                      setConversationTagAssignments(prev => {
                        const existing = prev.find(ct => ct.conversationId === convId);
                        if (existing) {
                          return prev.map(ct =>
                            ct.conversationId === convId
                              ? { ...ct, tagIds: [...ct.tagIds, tagId] }
                              : ct
                          );
                        }
                        return [...prev, { conversationId: convId, tagIds: [tagId] }];
                      });
                    }}
                    onTagRemove={(convId, tagId) => {
                      setConversationTagAssignments(prev =>
                        prev.map(ct =>
                          ct.conversationId === convId
                            ? { ...ct, tagIds: ct.tagIds.filter(id => id !== tagId) }
                            : ct
                        )
                      );
                    }}
                    onLabelAssign={(convId, labelId) => {
                      setConversationTagAssignments(prev => {
                        const existing = prev.find(ct => ct.conversationId === convId);
                        if (existing) {
                          return prev.map(ct =>
                            ct.conversationId === convId
                              ? { ...ct, labelId }
                              : ct
                          );
                        }
                        return [...prev, { conversationId: convId, tagIds: [], labelId }];
                      });
                    }}
                    onClose={() => setIntelligenceTab('tags')}
                  />
                </Suspense>
              )}
              {intelligenceTab === 'delivery' && (
                <Suspense fallback={<FeatureSkeleton type="panel" />}>
                  <BundleIntelligence.ReadReceipts
                    messageId={activeThread.messages[activeThread.messages.length - 1]?.id || ''}
                    onClose={() => setIntelligenceTab('delivery')}
                  />
                </Suspense>
              )}
            </div>
          </div>
        )}

        {/* Phase 7: Proactive Intelligence & Advanced Organization Panel */}
        {showProactivePanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 animate-slide-down">
            {/* Tab Navigation */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
              {[
                { id: 'reminders' as const, label: 'Smart Reminders', icon: 'fa-bell' },
                { id: 'threading' as const, label: 'Threading', icon: 'fa-code-branch' },
                { id: 'sentiment' as const, label: 'Sentiment', icon: 'fa-face-smile' },
                { id: 'groups' as const, label: 'Groups', icon: 'fa-users' },
                { id: 'search' as const, label: 'NL Search', icon: 'fa-magnifying-glass' },
                { id: 'highlights' as const, label: 'Highlights', icon: 'fa-star' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setProactiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                    proactiveTab === tab.id
                      ? 'bg-rose-600 text-white'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon}`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {proactiveTab === 'reminders' && (
                <Suspense fallback={<FeatureSkeleton type="list" />}>
                  <BundleProactive.SmartReminders
                    conversationId={activeThread.id}
                    onReminderClick={(reminder) => console.log('Reminder clicked:', reminder)}
                    onCreateReminder={(reminder) => console.log('Create reminder:', reminder)}
                  />
                </Suspense>
              )}
              {proactiveTab === 'threading' && (
                <Suspense fallback={<FeatureSkeleton type="panel" />}>
                  <BundleProactive.MessageThreading
                    messages={activeThread.messages.map(m => ({
                      id: m.id,
                      content: m.text,
                      sender: m.sender,
                      timestamp: m.timestamp,
                      isMe: m.sender === 'You'
                    }))}
                    onReply={(parentId, content) => console.log('Reply to:', parentId, content)}
                    onBranchCreate={(messageId, branchName) => console.log('Branch:', messageId, branchName)}
                  />
                </Suspense>
              )}
              {proactiveTab === 'sentiment' && (
                <Suspense fallback={<FeatureSkeleton type="card" />}>
                  <BundleProactive.SentimentTimeline
                    conversationId={activeThread.id}
                    onPeriodClick={(period) => console.log('Period clicked:', period)}
                  />
                </Suspense>
              )}
              {proactiveTab === 'groups' && (
                <Suspense fallback={<FeatureSkeleton type="list" />}>
                  <BundleProactive.ContactGroups
                    onGroupSelect={(group) => console.log('Group selected:', group)}
                    onChannelSelect={(channel) => console.log('Channel selected:', channel)}
                  />
                </Suspense>
              )}
              {proactiveTab === 'search' && (
                <Suspense fallback={<FeatureSkeleton type="modal" />}>
                  <BundleProactive.NaturalLanguageSearch
                    messages={activeThread.messages.map(m => ({
                      id: m.id,
                      content: m.text,
                      sender: m.sender,
                      timestamp: m.timestamp,
                      hasAttachment: !!m.attachments?.length,
                      attachmentType: m.attachments?.[0]?.type
                    }))}
                    onResultClick={(result) => {
                      const element = document.getElementById(`message-${result.id}`);
                      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  />
                </Suspense>
              )}
              {proactiveTab === 'highlights' && (
                <Suspense fallback={<FeatureSkeleton type="panel" />}>
                  <BundleProactive.ConversationHighlights
                    conversationId={activeThread.id}
                    onMomentClick={(moment) => console.log('Moment clicked:', moment)}
                    onNavigateToMessage={(messageId) => {
                      const element = document.getElementById(`message-${messageId}`);
                      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                />
                </Suspense>
              )}
            </div>
          </div>
        )}

        {/* Phase 8: Communication Enhancement & Inbox Intelligence Panel */}
        {showCommunicationPanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 animate-slide-down">
            {/* Tab Navigation */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
              {[
                { id: 'voice' as const, label: 'Voice Messages', icon: 'fa-microphone' },
                { id: 'reactions' as const, label: 'Reactions', icon: 'fa-face-smile' },
                { id: 'inbox' as const, label: 'Priority Inbox', icon: 'fa-inbox' },
                { id: 'archive' as const, label: 'Archive', icon: 'fa-box-archive' },
                { id: 'replies' as const, label: 'Quick Replies', icon: 'fa-bolt' },
                { id: 'status' as const, label: 'Status', icon: 'fa-clock-rotate-left' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setCommunicationTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                    communicationTab === tab.id
                      ? 'bg-amber-600 text-white'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon}`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {communicationTab === 'voice' && (
                <Suspense fallback={<FeatureSkeleton type="panel" />}>
                  <BundleCommunication.VoiceRecorder
                    onSendVoice={(blob, duration) => console.log('Voice sent:', duration, 'seconds')}
                  />
                </Suspense>
              )}
              {communicationTab === 'reactions' && (
                <Suspense fallback={<FeatureSkeleton type="inline" />}>
                  <BundleCommunication.EmojiReactions
                    messageId={activeThread.messages[activeThread.messages.length - 1]?.id || ''}
                    reactions={[
                      { emoji: '👍', count: 3, users: ['Alice', 'Bob', 'Carol'], hasReacted: true },
                      { emoji: '❤️', count: 2, users: ['Alice', 'Dave'], hasReacted: false },
                      { emoji: '😂', count: 1, users: ['Bob'], hasReacted: false }
                    ]}
                    onReact={(emoji) => console.log('Reacted with:', emoji)}
                    onRemoveReaction={(emoji) => console.log('Removed reaction:', emoji)}
                  />
                </Suspense>
              )}
              {communicationTab === 'inbox' && (
                <Suspense fallback={<FeatureSkeleton type="list" />}>
                  <BundleCommunication.PriorityInbox
                    onMessageClick={(msg) => console.log('Message clicked:', msg)}
                    onMessageStar={(id) => console.log('Starred:', id)}
                    onMessageArchive={(id) => console.log('Archived:', id)}
                  />
                </Suspense>
              )}
              {communicationTab === 'archive' && (
                <Suspense fallback={<FeatureSkeleton type="list" />}>
                  <BundleCommunication.ConversationArchive
                    onRestore={(id) => console.log('Restore:', id)}
                    onDelete={(id) => console.log('Delete:', id)}
                    onExport={(id) => console.log('Export:', id)}
                    onViewConversation={(id) => console.log('View:', id)}
                  />
                </Suspense>
              )}
              {communicationTab === 'replies' && (
                <Suspense fallback={<FeatureSkeleton type="inline" />}>
                  <BundleCommunication.QuickReplies
                    lastReceivedMessage={activeThread.messages.filter(m => m.sender !== 'You').pop()?.text}
                    onSelectReply={(text) => setNewMessage(text)}
                  />
                </Suspense>
              )}
              {communicationTab === 'status' && (
                <Suspense fallback={<FeatureSkeleton type="panel" />}>
                  <BundleCommunication.MessageStatusTimeline
                    messageId={activeThread.messages[activeThread.messages.length - 1]?.id || ''}
                    onRetry={() => console.log('Retry send')}
                  />
                </Suspense>
              )}
            </div>
          </div>
        )}

        {/* Phase 9: Advanced Personalization & Automation Panel */}
        {showPersonalizationPanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 animate-slide-down">
            {/* Tab Navigation */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
              {[
                { id: 'rules' as const, label: 'Auto-Response', icon: 'fa-robot' },
                { id: 'formatting' as const, label: 'Formatting', icon: 'fa-text-height' },
                { id: 'notes' as const, label: 'Contact Notes', icon: 'fa-sticky-note' },
                { id: 'modes' as const, label: 'Modes', icon: 'fa-toggle-on' },
                { id: 'sounds' as const, label: 'Sounds', icon: 'fa-volume-high' },
                { id: 'drafts' as const, label: 'Drafts', icon: 'fa-file-pen' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setPersonalizationTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                    personalizationTab === tab.id
                      ? 'bg-fuchsia-600 text-white'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon}`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {personalizationTab === 'rules' && (
                <AutoResponseRules
                  onRuleTriggered={(rule, message) => console.log('Rule triggered:', rule.name, message)}
                />
              )}
              {personalizationTab === 'formatting' && (
                <FormattingToolbar
                  onFormat={(format) => {
                    const formatMap: Record<string, { prefix: string; suffix: string }> = {
                      bold: { prefix: '**', suffix: '**' },
                      italic: { prefix: '_', suffix: '_' },
                      code: { prefix: '`', suffix: '`' },
                      strike: { prefix: '~~', suffix: '~~' },
                      bullet: { prefix: '• ', suffix: '' },
                      number: { prefix: '1. ', suffix: '' },
                      quote: { prefix: '> ', suffix: '' },
                      heading: { prefix: '# ', suffix: '' },
                      link: { prefix: '[', suffix: '](url)' },
                      mention: { prefix: '@', suffix: ' ' }
                    };
                    const fmt = formatMap[format];
                    if (fmt) {
                      setNewMessage(prev => `${prev}${fmt.prefix}${fmt.suffix}`);
                    }
                  }}
                  onInsertEmoji={(emoji) => setNewMessage(prev => prev + emoji)}
                  onInsertLink={(text, url) => setNewMessage(prev => `${prev}[${text}](${url})`)}
                  onChangeColor={(color) => console.log('Color changed:', color)}
                />
              )}
              {personalizationTab === 'notes' && (
                <ContactNotes
                  contactId={activeThread.contactId}
                  contactName={contacts.find(c => c.id === activeThread.contactId)?.name || 'Unknown'}
                  onNoteAdded={(note) => console.log('Note added:', note)}
                  onNoteDeleted={(noteId) => console.log('Note deleted:', noteId)}
                />
              )}
              {personalizationTab === 'modes' && (
                <ConversationModes
                  onModeChange={(mode) => console.log('Mode changed:', mode)}
                />
              )}
              {personalizationTab === 'sounds' && (
                <NotificationSounds
                  onSoundChange={(event, sound) => console.log('Sound changed:', event, sound)}
                  onVolumeChange={(volume) => console.log('Volume changed:', volume)}
                />
              )}
              {personalizationTab === 'drafts' && (
                <DraftManager
                  onLoadDraft={(draft) => {
                    setNewMessage(draft.content);
                    console.log('Draft loaded:', draft);
                  }}
                  onDeleteDraft={(draftId) => console.log('Draft deleted:', draftId)}
                />
              )}
            </div>
          </div>
        )}

        {/* Phase 10: Security, Insights & Productivity Panel */}
        {showSecurityPanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 animate-slide-down">
            {/* Tab Navigation */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
              {[
                { id: 'encryption' as const, label: 'Encryption', icon: 'fa-lock' },
                { id: 'readtime' as const, label: 'Read Time', icon: 'fa-hourglass-half' },
                { id: 'versions' as const, label: 'Versions', icon: 'fa-clock-rotate-left' },
                { id: 'folders' as const, label: 'Folders', icon: 'fa-folder-tree' },
                { id: 'insights' as const, label: 'Insights', icon: 'fa-chart-pie' },
                { id: 'focus' as const, label: 'Focus Timer', icon: 'fa-hourglass-start' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSecurityTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                    securityTab === tab.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon}`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {securityTab === 'encryption' && (
                <Suspense fallback={<FeatureSkeleton type="panel" />}>
                  <BundleSecurity.MessageEncryption
                    onSettingsChange={(settings) => console.log('Encryption settings:', settings)}
                    onGenerateKey={() => console.log('Generate new key')}
                    onExportKey={() => console.log('Export public key')}
                  />
                </Suspense>
              )}
              {securityTab === 'readtime' && (
                <Suspense fallback={<FeatureSkeleton type="inline" />}>
                  <BundleSecurity.ReadTimeEstimation
                    onMarkAsRead={(messageId) => console.log('Mark as read:', messageId)}
                    onPreferencesChange={(prefs) => console.log('Preferences:', prefs)}
                  />
                </Suspense>
              )}
              {securityTab === 'versions' && (
                <Suspense fallback={<FeatureSkeleton type="panel" />}>
                  <BundleSecurity.MessageVersioning
                    onRestoreVersion={(msgId, versionId) => console.log('Restore:', msgId, versionId)}
                    onCompareVersions={(a, b) => console.log('Compare:', a, b)}
                  />
                </Suspense>
              )}
              {securityTab === 'folders' && (
                <Suspense fallback={<FeatureSkeleton type="list" />}>
                  <BundleSecurity.SmartFolders
                    onFolderSelect={(folderId) => console.log('Folder selected:', folderId)}
                    onCreateFolder={(folder) => console.log('Create folder:', folder)}
                    onDeleteFolder={(folderId) => console.log('Delete folder:', folderId)}
                  />
                </Suspense>
              )}
              {securityTab === 'insights' && (
                <Suspense fallback={<FeatureSkeleton type="card" />}>
                  <BundleSecurity.ConversationInsights
                    onContactSelect={(contactId) => console.log('Contact selected:', contactId)}
                    onInsightAction={(insightId) => console.log('Insight action:', insightId)}
                  />
                </Suspense>
              )}
              {securityTab === 'focus' && (
                <Suspense fallback={<FeatureSkeleton type="panel" />}>
                  <BundleSecurity.FocusTimer
                    onTimerStart={(type) => console.log('Timer started:', type)}
                    onTimerComplete={(session) => console.log('Session complete:', session)}
                    onTimerPause={() => console.log('Timer paused')}
                    onSettingsChange={(settings) => console.log('Timer settings:', settings)}
                  />
                </Suspense>
              )}
            </div>
          </div>
        )}

        {/* Phase 11: Multi-Media & Export Hub Panel */}
        {showMediaHubPanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 animate-slide-down">
            {/* Tab Navigation */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
              {[
                { id: 'translation' as const, label: 'Translation', icon: 'fa-language' },
                { id: 'export' as const, label: 'Export', icon: 'fa-file-export' },
                { id: 'templates' as const, label: 'Templates', icon: 'fa-file-lines' },
                { id: 'attachments' as const, label: 'Attachments', icon: 'fa-paperclip' },
                { id: 'backup' as const, label: 'Backup', icon: 'fa-cloud-arrow-up' },
                { id: 'suggestions' as const, label: 'Suggestions', icon: 'fa-wand-magic-sparkles' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMediaHubTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                    mediaHubTab === tab.id
                      ? 'bg-cyan-600 text-white'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon}`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {mediaHubTab === 'translation' && (
                <Suspense fallback={<FeatureSkeleton type="modal" />}>
                  <BundleMultimedia.TranslationHub
                    conversationId={activeThread.id}
                    onTranslate={(text, from, to) => console.log('Translate:', text, from, to)}
                    onLanguageChange={(lang) => console.log('Language changed:', lang)}
                  />
                </Suspense>
              )}
              {mediaHubTab === 'export' && (
                <Suspense fallback={<FeatureSkeleton type="modal" />}>
                  <BundleMultimedia.AnalyticsExport
                    conversationId={activeThread.id}
                    onExportStart={(job) => console.log('Export started:', job)}
                    onExportComplete={(job) => console.log('Export complete:', job)}
                  />
                </Suspense>
              )}
              {mediaHubTab === 'templates' && (
                <Suspense fallback={<FeatureSkeleton type="modal" />}>
                  <BundleMultimedia.TemplatesLibrary
                    onTemplateSelect={(template) => {
                      setNewMessage(template.content);
                      console.log('Template selected:', template);
                    }}
                    onTemplateCreate={(template) => console.log('Template created:', template)}
                  />
                </Suspense>
              )}
              {mediaHubTab === 'attachments' && (
                <Suspense fallback={<FeatureSkeleton type="panel" />}>
                  <BundleMultimedia.AttachmentManager
                    conversationId={activeThread.id}
                    onAttachmentSelect={(attachment) => console.log('Attachment selected:', attachment)}
                    onAttachmentDelete={(attachmentId) => console.log('Attachment deleted:', attachmentId)}
                  />
                </Suspense>
              )}
              {mediaHubTab === 'backup' && (
                <Suspense fallback={<FeatureSkeleton type="panel" />}>
                  <BundleMultimedia.BackupSync
                    onBackupCreate={(backup) => console.log('Backup created:', backup)}
                    onBackupRestore={(backupId) => console.log('Backup restored:', backupId)}
                    onSyncToggle={(enabled) => console.log('Sync toggled:', enabled)}
                  />
                </Suspense>
              )}
              {mediaHubTab === 'suggestions' && (
                <Suspense fallback={<FeatureSkeleton type="inline" />}>
                  <BundleMultimedia.SmartSuggestions
                    conversationId={activeThread.id}
                    currentMessage={newMessage}
                    onSuggestionSelect={(suggestion) => {
                      if (suggestion.type === 'reply') {
                        setNewMessage(suggestion.content);
                    }
                    console.log('Suggestion selected:', suggestion);
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Command Palette */}
        <QuickActionsCommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onAction={(actionId) => console.log('Command action:', actionId)}
        />

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <TypingIndicator users={typingUsers} />
        )}

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {activeThread.outcome && (
              <div className="flex justify-center mb-4">
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 flex items-center gap-2">
                      <i className="fa-solid fa-flag-checkered"></i> Outcome Goal: <span className="font-bold">{activeThread.outcome.goal}</span>
                  </div>
              </div>
          )}

          {/* Handoff Card */}
          {showHandoffCard && (
              <div className="mx-auto max-w-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-700/50 rounded-xl p-6 shadow-lg mb-6 animate-scale-in relative">
                  <button onClick={() => setShowHandoffCard(false)} className="absolute top-2 right-2 text-yellow-600 hover:text-yellow-800"><i className="fa-solid fa-xmark"></i></button>
                  <div className="flex items-center gap-2 mb-4 text-yellow-700 dark:text-yellow-500 font-bold uppercase text-xs tracking-widest">
                      <i className={`fa-solid ${loadingHandoff ? 'fa-circle-notch fa-spin' : 'fa-handshake'}`}></i>
                      {loadingHandoff ? 'Generating Handoff Summary...' : 'Context Handoff'}
                  </div>

                  {loadingHandoff ? (
                      <div className="py-8 flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-800/30 flex items-center justify-center">
                              <i className="fa-solid fa-wand-magic-sparkles text-yellow-600 dark:text-yellow-400 animate-pulse"></i>
                          </div>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">Analyzing conversation history...</p>
                      </div>
                  ) : handoffContent ? (
                      <>
                          <p className="text-sm text-zinc-800 dark:text-zinc-200 mb-4">{handoffContent.context}</p>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <div className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Key Decisions</div>
                                  {handoffContent.keyDecisions.length > 0 ? (
                                      <ul className="list-disc list-inside text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
                                          {handoffContent.keyDecisions.map((d: string, i: number) => <li key={i}>{d}</li>)}
                                      </ul>
                                  ) : (
                                      <p className="text-xs text-zinc-400 italic">No major decisions yet</p>
                                  )}
                              </div>
                              <div>
                                  <div className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Pending Actions</div>
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
                                  className="flex-1 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800/30 dark:hover:bg-yellow-800/50 text-yellow-800 dark:text-yellow-200 font-bold py-2 rounded-lg text-xs transition flex items-center justify-center gap-2"
                              >
                                  <i className="fa-solid fa-paper-plane"></i> Share to Thread
                              </button>
                              <button
                                  onClick={() => {
                                      navigator.clipboard.writeText(`Context Handoff Summary\n\n${handoffContent.context}\n\nKey Decisions:\n${handoffContent.keyDecisions.map((d: string) => '• ' + d).join('\n') || 'None'}\n\nPending Actions:\n${handoffContent.pendingActions.map((a: string) => '• ' + a).join('\n') || 'None'}`);
                                      alert('Copied to clipboard!');
                                  }}
                                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg text-xs transition"
                                  title="Copy to clipboard"
                              >
                                  <i className="fa-solid fa-copy"></i>
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
             const showAvatar = index === 0 || filteredMessages[index - 1].sender !== msg.sender;
             const isProposal = msg.decisionData?.type === 'proposal';
             const isApproved = msg.decisionData?.status === 'approved';
             const isDeepAudio = msg.attachment?.type === 'audio' || msg.voiceAnalysis;

             return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative mb-6 animate-slide-up`}>
                    {!isMe && showAvatar && (
                        <div className={`w-8 h-8 rounded-full ${activeThread.avatarColor} flex items-center justify-center text-xs text-white mr-2 mt-auto flex-shrink-0 shadow-sm`}>
                            {activeThread.contactName.charAt(0)}
                        </div>
                    )}
                    {!isMe && !showAvatar && <div className="w-10"></div>}

                    <div className="max-w-[85%] md:max-w-[70%] relative">
                        {/* Source Indicator for Unified Inbox */}
                        {msg.source && msg.source !== 'pulse' && (
                            <div className="absolute -top-3 right-0 bg-white dark:bg-zinc-800 px-1.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm z-10">
                                {getSourceIcon(msg.source)}
                            </div>
                        )}

                        <div className={`rounded-2xl px-4 py-3 md:px-5 md:py-4 text-sm transition-all relative shadow-sm ${
                            isMe ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-br-sm'
                            : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-bl-sm'
                        } ${isProposal && !isApproved ? '!bg-amber-100 dark:!bg-amber-900/40 !text-amber-900 dark:!text-amber-100 ring-2 ring-amber-400 dark:ring-amber-500 border-amber-300 dark:border-amber-600' : ''} ${isApproved ? '!bg-emerald-100 dark:!bg-emerald-900/40 !text-emerald-900 dark:!text-emerald-100 ring-2 ring-emerald-400 dark:ring-emerald-500 border-emerald-300 dark:border-emerald-600' : ''}`}>

                            {/* Proposal Header */}
                            {isProposal && (
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-300 dark:border-amber-700">
                                    <i className={`fa-solid ${isApproved ? 'fa-gavel text-emerald-600 dark:text-emerald-400' : 'fa-scale-balanced text-amber-600 dark:text-amber-400'}`}></i>
                                    <span className="font-bold text-xs uppercase tracking-wide text-amber-800 dark:text-amber-200">{isApproved ? 'Decision Approved' : 'Formal Proposal'}</span>
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
                                                            console.log('Add to calendar:', data);
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
                                                className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition"
                                            >
                                                <i className="fa-solid fa-play text-sm"></i>
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
                                                <i className="fa-solid fa-file text-zinc-500"></i>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-medium dark:text-white truncate">{msg.attachment.name}</div>
                                                <div className="text-[10px] text-zinc-500">{msg.attachment.size}</div>
                                            </div>
                                            <i className="fa-solid fa-download text-zinc-400 text-xs"></i>
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Voice Analysis Bubble */}
                            {isDeepAudio && (
                                <div className="mt-3">
                                    {msg.voiceAnalysis ? (
                                        <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 text-xs">
                                            <div className="flex items-center gap-2 mb-2 text-purple-500 font-bold uppercase tracking-wider text-[10px]">
                                                <i className="fa-solid fa-wand-magic-sparkles"></i> Deep Audio Analysis
                                            </div>
                                            <p className="mb-2 italic">"{msg.voiceAnalysis.transcription}"</p>
                                            <div className="mb-2"><strong>Summary:</strong> {msg.voiceAnalysis.summary}</div>
                                            {msg.voiceAnalysis.actionItems.length > 0 && (
                                                <div className="space-y-1">
                                                    <strong>Tasks Identified:</strong>
                                                    {msg.voiceAnalysis.actionItems.map((task, i) => (
                                                        <div key={i} className="flex items-center gap-1.5"><i className="fa-regular fa-square text-[9px]"></i> {task}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => msg.attachment?.url && handleAnalyzeVoice(msg.id, msg.attachment.url)}
                                            className="text-xs flex items-center gap-2 text-purple-500 hover:text-purple-600 font-bold uppercase tracking-wider"
                                        >
                                            {analyzingAudioId === msg.id ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Analyzing...</> : <><i className="fa-solid fa-wand-sparkles"></i> Deep Analyze Voice</>}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Voting Interface */}
                            {isProposal && msg.decisionData && (
                                <div className="mt-3 pt-2 border-t border-amber-300 dark:border-amber-700">
                                    <div className="flex gap-2 mb-2">
                                        <button
                                            onClick={() => handleVote(msg.id, 'me', 'approve')}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${msg.decisionData.votes.some(v => v.userId === 'me' && v.choice === 'approve') ? 'bg-emerald-600 text-white' : 'bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700/60'}`}
                                        >
                                            <i className="fa-solid fa-thumbs-up"></i> Approve ({msg.decisionData.votes.filter(v => v.choice === 'approve').length})
                                        </button>
                                        <button
                                            onClick={() => handleVote(msg.id, 'me', 'reject')}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${msg.decisionData.votes.some(v => v.userId === 'me' && v.choice === 'reject') ? 'bg-red-600 text-white' : 'bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700/60'}`}
                                        >
                                            <i className="fa-solid fa-thumbs-down"></i> Reject ({msg.decisionData.votes.filter(v => v.choice === 'reject').length})
                                        </button>
                                    </div>
                                    <div className="text-[10px] text-amber-700 dark:text-amber-300 text-center">Threshold: {msg.decisionData.threshold} approvals required</div>
                                </div>
                            )}

                            {/* Linked Task Indicator */}
                            {msg.relatedTaskId && (
                                <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10 flex items-center gap-2 text-xs opacity-80">
                                    <i className="fa-solid fa-check-circle text-emerald-500"></i>
                                    <span>Task Created: <strong>{msg.relatedTaskId}</strong></span>
                                </div>
                            )}
                        </div>

                        {/* Message Actions */}
                        <div className={`absolute -top-8 ${isMe ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 z-20`}>
                            <div className="flex items-center bg-white dark:bg-zinc-800 rounded-full shadow-xl border border-zinc-200 dark:border-zinc-700 p-1">
                                {/* Quick Reactions */}
                                {COMMON_REACTIONS.slice(0, 4).map(emoji => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleReaction(msg.id, emoji)}
                                    className="w-7 h-7 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-full transition text-sm"
                                    title={`React with ${emoji}`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                                <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
                                <button
                                    onClick={() => handleExtractTask(msg)}
                                    className={`w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-emerald-500 rounded-full transition ${creatingTaskForMsgId === msg.id ? 'animate-spin text-emerald-500' : ''}`}
                                    title="Create Task"
                                >
                                    <i className="fa-solid fa-check text-xs"></i>
                                </button>
                                <button
                                    onClick={() => setReplyingTo(msg)}
                                    className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-blue-500 rounded-full transition"
                                    title="Reply"
                                >
                                    <i className="fa-solid fa-reply text-xs"></i>
                                </button>
                                <button
                                    onClick={() => { setForwardingMessage(msg); setShowForwardModal(true); }}
                                    className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-purple-500 rounded-full transition"
                                    title="Forward"
                                >
                                    <i className="fa-solid fa-share text-xs"></i>
                                </button>
                                {isMe && (
                                  <button
                                      onClick={() => startEditMessage(msg)}
                                      className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-amber-500 rounded-full transition"
                                      title="Edit"
                                  >
                                      <i className="fa-solid fa-pen text-xs"></i>
                                  </button>
                                )}
                                <button
                                    onClick={() => handleTTS(msg.text, msg.id)}
                                    className={`w-7 h-7 flex items-center justify-center rounded-full transition ${isPlayingId === msg.id ? 'text-blue-500 animate-pulse' : 'text-zinc-400 hover:text-blue-500'}`}
                                    title="Read Aloud"
                                >
                                    <i className={`fa-solid ${isPlayingId === msg.id ? 'fa-volume-high' : 'fa-volume-up'} text-xs`}></i>
                                </button>
                                <button
                                    onClick={() => navigator.clipboard.writeText(msg.text)}
                                    className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-600 rounded-full transition"
                                    title="Copy Text"
                                >
                                    <i className="fa-solid fa-copy text-xs"></i>
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

                        {/* Message Impact Visualization - Show on hover for important messages */}
                        {!isMe && msg.text && msg.text.length > 50 && (
                          <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MessageImpactVisualization
                              impact={messageEnhancements.calculateMessageImpact(msg, activeThread)}
                              compact={true}
                            />
                          </div>
                        )}

                        {/* Read Receipt */}
                        {isMe && showReadReceipts && msg.status && (
                          <div className="flex justify-end mt-1">
                            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                              {msg.status === 'sent' && <><i className="fa-solid fa-check"></i> Sent</>}
                              {msg.status === 'delivered' && <><i className="fa-solid fa-check-double"></i> Delivered</>}
                              {msg.status === 'read' && <><i className="fa-solid fa-check-double text-blue-500"></i> Read</>}
                            </span>
                          </div>
                        )}
                    </div>
                </div>
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

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-zinc-950 z-20 border-t border-zinc-100 dark:border-zinc-900 relative">

           {/* View-Only Mode Banner for Non-Pulse Users on PC */}
           {isViewOnlyMode && (
             <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
               <div className="flex items-start gap-3">
                 <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                   <i className="fa-solid fa-mobile-screen text-amber-600 dark:text-amber-400"></i>
                 </div>
                 <div className="flex-1">
                   <h4 className="font-semibold text-amber-800 dark:text-amber-200 text-sm mb-1">Send from your phone</h4>
                   <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                     {activeContact?.name || 'This contact'} isn't on Pulse yet. Open the app on your mobile device to send SMS messages.
                   </p>
                   <button
                     onClick={() => {
                       const contact = contacts.find(c => c.id === activeThread?.contactId);
                       if (contact) {
                         setInviteTargetContact(contact);
                         setShowInviteToPulseModal(true);
                       }
                     }}
                     className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
                   >
                     <i className="fa-solid fa-rocket"></i> Invite to Pulse for free messaging
                   </button>
                 </div>
               </div>
             </div>
           )}

           {/* SMS Mode Banner for Native Apps */}
           {isNonPulseThread && canSendNativeSms && (
             <div className="mb-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2 text-xs">
               <i className="fa-solid fa-comment-sms text-blue-500"></i>
               <span className="text-blue-700 dark:text-blue-300">
                 Messages to {activeContact?.name || 'this contact'} will be sent as SMS via your carrier
               </span>
               <button
                 onClick={() => {
                   const contact = contacts.find(c => c.id === activeThread?.contactId);
                   if (contact) {
                     setInviteTargetContact(contact);
                     setShowInviteToPulseModal(true);
                   }
                 }}
                 className="ml-auto text-blue-600 dark:text-blue-400 hover:underline font-medium"
               >
                 Invite to Pulse
               </button>
             </div>
           )}

           {/* Message Templates Popup */}
           {showTemplates && (
             <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-3 animate-slide-up z-30">
               <div className="flex items-center justify-between mb-3">
                 <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Quick Templates</span>
                 <button onClick={() => setShowTemplates(false)} className="text-zinc-400 hover:text-zinc-600">
                   <i className="fa-solid fa-xmark text-xs"></i>
                 </button>
               </div>
               <div className="grid grid-cols-2 gap-2">
                 {MESSAGE_TEMPLATES.map(template => {
                   // Generate smart preview text
                   const previewText = activeThread
                     ? generateSmartTemplateText(
                         template.id,
                         template.baseText,
                         activeThread.contactName,
                         activeThread.messages[activeThread.messages.length - 1]?.sender === 'other'
                           ? activeThread.messages[activeThread.messages.length - 1]?.text
                           : undefined
                       )
                     : template.baseText;
                   return (
                     <button
                       key={template.id}
                       onClick={() => useTemplate(template)}
                       className="text-left p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
                     >
                       <div className="text-xs font-medium dark:text-white flex items-center gap-1.5">
                         <i className="fa-solid fa-wand-magic-sparkles text-purple-400 text-[8px]"></i>
                         {template.label}
                       </div>
                       <div className="text-[10px] text-zinc-500 truncate">{previewText}</div>
                     </button>
                   );
                 })}
               </div>
             </div>
           )}

           {/* Extended Emoji Picker */}
           {showEmojiPicker && !emojiPickerMessageId && (
             <div className="absolute bottom-full left-4 mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-3 animate-slide-up z-30 w-80">
               <div className="flex items-center justify-between mb-3">
                 <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Add Emoji</span>
                 <button onClick={() => setShowEmojiPicker(false)} className="text-zinc-400 hover:text-zinc-600">
                   <i className="fa-solid fa-xmark text-xs"></i>
                 </button>
               </div>
               <div className="space-y-3 max-h-48 overflow-y-auto">
                 {Object.entries(REACTION_CATEGORIES).map(([category, emojis]) => (
                   <div key={category}>
                     <div className="text-[10px] text-zinc-400 mb-1">{category}</div>
                     <div className="flex flex-wrap gap-1">
                       {emojis.map(emoji => (
                         <button
                           key={emoji}
                           onClick={() => { setInputText(prev => prev + emoji); setShowEmojiPicker(false); }}
                           className="w-8 h-8 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-lg"
                         >
                           {emoji}
                         </button>
                       ))}
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* Phase 2: AI Coach - Real-time draft analysis */}
           {showAICoach && inputText.length > 10 && activeThread && (
             <div className="mb-3">
               <Suspense fallback={<FeatureSkeleton type="panel" />}>
                 <BundleAI.AICoachEnhanced
                   draftText={inputText}
                   recentMessages={activeThread.messages.slice(-10).map(m => ({
                     text: m.text,
                     sender: m.sender,
                     timestamp: m.timestamp
                   }))}
                   contactName={activeThread.contactName}
                   onApplySuggestion={(newText) => setInputText(newText)}
                   onDismiss={() => setShowAICoach(false)}
                 />
               </Suspense>
             </div>
           )}

           {/* Smart Compose - AI-powered message suggestions */}
           {showSmartCompose && messageEnhancements.smartSuggestions.length > 0 && (
             <div className="mb-3">
               <SmartCompose
                 text={inputText}
                 suggestions={messageEnhancements.smartSuggestions}
                 onSelectSuggestion={(text) => setInputText(text)}
                 loading={messageEnhancements.loadingSuggestions}
               />
             </div>
           )}

           {/* Quick Actions Bar - One-click actions */}
           {showQuickActionsBar && activeThread && (
             <div className="mb-3">
               <QuickActions
                 onEmojiReaction={(emoji) => {
                   // Add emoji to input
                   setInputText(prev => prev + emoji);
                 }}
                 onVoiceMessage={() => {
                   // Start voice recording
                   if (!isRecording) {
                     startRecording();
                   }
                 }}
                 onSmartReply={handleSmartReply}
               />
             </div>
           )}

           {/* Phase 2: AI Mediator - Conflict detection */}
           {showAIMediator && activeThread && activeThread.messages.length > 5 && (
             <div className="mb-3">
               <Suspense fallback={<FeatureSkeleton type="panel" />}>
                 <BundleAI.AIMediatorPanel
                   messages={activeThread.messages.slice(-15).map(m => ({
                     id: m.id,
                     text: m.text,
                     sender: m.sender,
                     timestamp: m.timestamp
                   }))}
                   contactName={activeThread.contactName}
                   onApplySuggestion={(suggestion) => {
                     if (suggestion.suggestedText) {
                       setInputText(suggestion.suggestedText);
                     }
                   }}
                   onDismiss={() => setShowAIMediator(false)}
                 />
               </Suspense>
             </div>
           )}

           {/* Phase 2: Quick Phrases */}
           {showQuickPhrases && (
             <div className="mb-3">
               <Suspense fallback={<FeatureSkeleton type="inline" />}>
                 <BundleAI.QuickPhrases
                   onSelect={(phrase) => {
                     setInputText(phrase);
                     setShowQuickPhrases(false);
                   }}
                   context="general"
                 />
               </Suspense>
             </div>
           )}

           {isProposalMode && (
               <div className="absolute bottom-full left-4 right-4 mb-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2 rounded-lg flex items-center justify-between text-xs text-amber-800 dark:text-amber-200 animate-slide-up">
                   <span className="font-bold flex items-center gap-2"><i className="fa-solid fa-scale-balanced"></i> Proposal Mode Active</span>
                   <button onClick={() => setIsProposalMode(false)}><i className="fa-solid fa-xmark"></i></button>
               </div>
           )}

           {/* Recording Indicator */}
           {isRecording && (
             <div className="absolute bottom-full left-4 right-4 mb-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg flex items-center justify-between animate-slide-up">
               <div className="flex items-center gap-3">
                 <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                 <span className="text-sm text-red-700 dark:text-red-300 font-medium">Recording... {formatDuration(recordingDuration)}</span>
               </div>
               <button onClick={stopRecording} className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition">
                 Stop & Send
               </button>
             </div>
           )}

           {/* Phase 2: Voice Context Extractor Panel */}
           {showVoiceExtractor && (
             <div className="mb-3">
               <Suspense fallback={<FeatureSkeleton type="panel" />}>
                 <BundleAI.VoiceContextExtractor
                   onTranscriptionComplete={(context) => {
                     // Add the transcription to the input with extracted action items
                     let enhancedText = context.transcription;
                     if (context.actionItems.length > 0) {
                       enhancedText += '\n\nAction items:\n' + context.actionItems.map(item => `- ${item}`).join('\n');
                     }
                     setInputText(enhancedText);
                     setShowVoiceExtractor(false);
                   }}
                   onError={(error) => console.error('Voice extraction error:', error)}
                 />
               </Suspense>
             </div>
           )}

           {/* Meeting Deflector - Suggests async alternatives when meeting intent is detected */}
           {showMeetingDeflector && inputText.length > 20 && (
             <MeetingDeflector
               messageText={inputText}
               apiKey={apiKey}
               onAcceptSuggestion={(type, template) => {
                 setInputText(template);
                 setShowMeetingDeflector(false);
               }}
               onDismiss={() => setShowMeetingDeflector(false)}
             />
           )}

           <div className={`flex gap-1 sm:gap-2 items-end relative bg-zinc-50 dark:bg-zinc-900 p-1.5 sm:p-2 rounded-xl border transition ${isProposalMode ? 'border-amber-400' : isRecording ? 'border-red-400' : 'border-zinc-200 dark:border-zinc-800'}`}>
             {/* Left Action Buttons - Collapsed on mobile */}
             <div className="flex gap-0.5 sm:gap-1 relative flex-shrink-0">
               <button
                  onClick={() => setIsProposalMode(!isProposalMode)}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition flex items-center justify-center flex-shrink-0 ${isProposalMode ? 'bg-amber-500 text-white' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                  title="Make Proposal (Ctrl+Shift+P)"
               >
                  <i className="fa-solid fa-gavel text-xs sm:text-sm"></i>
               </button>
               <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className={`hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition items-center justify-center flex-shrink-0 ${showTemplates ? 'bg-blue-500 text-white' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                  title="Message Templates (Ctrl+Shift+T)"
               >
                  <i className="fa-solid fa-bolt text-xs sm:text-sm"></i>
               </button>
               <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition flex items-center justify-center flex-shrink-0 ${showEmojiPicker ? 'bg-yellow-500 text-white' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                  title="Add Emoji (Ctrl+Shift+E)"
               >
                  <i className="fa-solid fa-face-smile text-xs sm:text-sm"></i>
               </button>

               {/* Phase 2: Quick Phrases Button - Hidden on mobile */}
               <button
                  onClick={() => setShowQuickPhrases(!showQuickPhrases)}
                  className={`hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition items-center justify-center flex-shrink-0 ${showQuickPhrases ? 'bg-purple-500 text-white' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                  title="Quick Phrases"
               >
                  <i className="fa-solid fa-comment-dots text-xs sm:text-sm"></i>
               </button>

               {/* Attachment Menu Button */}
               <div className="relative" ref={attachmentMenuRef}>
                 <button
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition flex items-center justify-center flex-shrink-0 ${showAttachmentMenu ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                    title="Attach File, Image, Video, or Link"
                 >
                    <i className="fa-solid fa-plus text-xs sm:text-sm"></i>
                 </button>

                 {/* Attachment Menu Dropdown */}
                 {showAttachmentMenu && (
                   <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50 min-w-[200px] animate-scale-in origin-bottom-left">
                     <div className="p-2">
                       <button
                         onClick={() => imageInputRef.current?.click()}
                         className="w-full px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition flex items-center gap-3 group"
                       >
                         <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition">
                           <i className="fa-solid fa-image text-blue-600 dark:text-blue-400"></i>
                         </div>
                         <div>
                           <div className="text-sm font-medium dark:text-white">Photo</div>
                           <div className="text-xs text-zinc-500">Upload an image</div>
                         </div>
                       </button>
                       
                       <button
                         onClick={() => videoInputRef.current?.click()}
                         className="w-full px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition flex items-center gap-3 group"
                       >
                         <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition">
                           <i className="fa-solid fa-video text-purple-600 dark:text-purple-400"></i>
                         </div>
                         <div>
                           <div className="text-sm font-medium dark:text-white">Video</div>
                           <div className="text-xs text-zinc-500">Upload a video</div>
                         </div>
                       </button>
                       
                       <button
                         onClick={() => fileInputRef.current?.click()}
                         className="w-full px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition flex items-center gap-3 group"
                       >
                         <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition">
                           <i className="fa-solid fa-file text-emerald-600 dark:text-emerald-400"></i>
                         </div>
                         <div>
                           <div className="text-sm font-medium dark:text-white">File</div>
                           <div className="text-xs text-zinc-500">Upload a document</div>
                         </div>
                       </button>
                       
                       <div className="border-t border-zinc-200 dark:border-zinc-800 my-1"></div>
                       
                       <button
                         onClick={handleAddLink}
                         className="w-full px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition flex items-center gap-3 group"
                       >
                         <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition">
                           <i className="fa-solid fa-link text-orange-600 dark:text-orange-400"></i>
                         </div>
                         <div>
                           <div className="text-sm font-medium dark:text-white">Link</div>
                           <div className="text-xs text-zinc-500">Add a URL</div>
                         </div>
                       </button>
                     </div>
                   </div>
                 )}
               </div>

               {/* Hidden File Inputs */}
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 onChange={handleFileUpload} 
                 accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar" 
               />
               <input 
                 type="file" 
                 ref={imageInputRef} 
                 className="hidden" 
                 onChange={handleImageUpload} 
                 accept="image/*" 
               />
               <input 
                 type="file" 
                 ref={videoInputRef} 
                 className="hidden" 
                 onChange={handleVideoUpload} 
                 accept="video/*" 
               />
             </div>

             {/* Message Input - IntentComposer, MessageInput (AI-augmented), or standard textarea */}
             {useIntentComposer ? (
               <div className="flex-1">
                 <IntentComposer
                   value={inputText}
                   onChange={setInputText}
                   onSend={() => {
                     if (isNonPulseThread && canSendNativeSms) {
                       handleSendSms(inputText);
                     } else if (!isViewOnlyMode) {
                       handleSend();
                     }
                   }}
                   apiKey={apiKey}
                   showAnalysis={true}
                   placeholder={isProposalMode ? "State your proposal clearly..." : isRecording ? "Recording voice message..." : "Type a message..."}
                   disabled={isRecording}
                 />
               </div>
             ) : apiKey ? (
               <div className="flex-1">
                 <MessageInput
                   onSend={(text) => {
                     setInputText(text);
                     if (isNonPulseThread && canSendNativeSms) {
                       handleSendSms(text);
                     } else if (!isViewOnlyMode) {
                       handleSend();
                     }
                   }}
                   onTyping={(isTyping) => {
                     // Send typing indicator if connected to a Pulse thread
                     if (isTyping && activeThread && !isNonPulseThread) {
                       // Typing indicator logic can be implemented here
                     }
                   }}
                   placeholder={isProposalMode ? "State your proposal clearly..." : isRecording ? "Recording voice message..." : "Type a message..."}
                   aiEnabled={true}
                   voiceEnabled={false}
                   maxLength={2000}
                   channelId={activeThread?.id}
                 />
               </div>
             ) : (
               <textarea
                 className="flex-1 bg-transparent dark:text-white text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none resize-none py-2.5 max-h-32 scrollbar-hide font-light"
                 placeholder={isProposalMode ? "State your proposal clearly..." : isRecording ? "Recording voice message..." : "Type a message..."}
                 rows={1}
                 value={inputText}
                 onChange={(e) => setInputText(e.target.value)}
                 onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); isNonPulseThread && canSendNativeSms ? handleSendSms(inputText) : !isViewOnlyMode && handleSend(); }}}
                 disabled={isRecording}
               />
             )}

             {/* Right Action Buttons - Collapsed on mobile */}
             <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
               {/* Voice-to-Text Dictation Button */}
               <VoiceTextButton
                  onTranscript={(text) => setInputText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text)}
                  size="sm"
                  disabled={isRecording}
                  className="text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 w-8 h-8 sm:w-10 sm:h-10"
               />
               <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition flex items-center justify-center flex-shrink-0 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                  title={isRecording ? "Stop Recording" : "Voice Message"}
               >
                  <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'} text-xs sm:text-sm`}></i>
               </button>
               {/* Hidden on mobile */}
               <button
                  onClick={() => setShowScheduleModal(true)}
                  disabled={!inputText.trim()}
                  className="hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition items-center justify-center flex-shrink-0 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40"
                  title="Schedule Message"
               >
                  <i className="fa-solid fa-clock text-xs sm:text-sm"></i>
               </button>
               {/* Phase 2: Voice Context Extractor Toggle - Hidden on mobile */}
               <button
                  onClick={() => setShowVoiceExtractor(!showVoiceExtractor)}
                  className={`hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition items-center justify-center flex-shrink-0 ${showVoiceExtractor ? 'bg-blue-500 text-white' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                  title="AI Voice Transcription"
               >
                  <i className="fa-solid fa-comment-medical text-xs sm:text-sm"></i>
               </button>
               {/* Phase 2: Translation Widget - Hidden on mobile */}
               <div className="hidden sm:block">
                 <Suspense fallback={<FeatureSkeleton type="inline" />}>
                   <BundleAI.TranslationWidgetEnhanced
                     originalText={inputText}
                     onTranslate={(translation) => setInputText(translation.translatedText)}
                     compact={true}
                   />
                 </Suspense>
               </div>
               <button
                  onClick={handleSmartReply}
                  disabled={loadingAI || isBotChat}
                  className="hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition items-center justify-center flex-shrink-0 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40"
                  title="AI Smart Reply"
               >
                  <i className={`fa-solid ${loadingAI ? 'fa-circle-notch fa-spin' : 'fa-wand-magic-sparkles'} text-xs sm:text-sm`}></i>
               </button>
               {isNonPulseThread && canSendNativeSms ? (
                 // SMS Send Button for non-Pulse users on mobile
                 <button
                   onClick={() => handleSendSms(inputText)}
                   disabled={!inputText.trim()}
                   className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                   title="Send SMS"
                 >
                   <i className="fa-solid fa-comment-sms text-xs sm:text-sm"></i>
                 </button>
               ) : isViewOnlyMode ? (
                 // Disabled button for view-only mode
                 <button
                   disabled
                   className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-zinc-300 dark:bg-zinc-700 text-zinc-500 flex items-center justify-center cursor-not-allowed"
                   title="Send from your mobile device"
                 >
                   <i className="fa-solid fa-lock text-xs sm:text-sm"></i>
                 </button>
               ) : (
                 // Regular send button
                 <button onClick={() => handleSend()} disabled={isRecording || (!inputText.trim())} className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100">
                   <i className="fa-solid fa-arrow-up text-xs sm:text-sm"></i>
                 </button>
               )}
             </div>
           </div>

           {/* Scheduled Messages Indicator */}
           {scheduledMessages.filter(m => m.threadId === activeThreadId).length > 0 && (
             <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
               <i className="fa-solid fa-clock"></i>
               <span>{scheduledMessages.filter(m => m.threadId === activeThreadId).length} message(s) scheduled for this conversation</span>
               <button onClick={() => setShowScheduleModal(true)} className="text-blue-500 hover:underline">View</button>
             </div>
           )}
        </div>
      </div>
      )}

      {/* Invite to Pulse Modal */}
      {showInviteToPulseModal && inviteTargetContact && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Header with gradient */}
            <div className="relative p-6 text-center bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500">
              <div className="absolute inset-0 bg-black/10"></div>
              <button
                onClick={() => { setShowInviteToPulseModal(false); setInviteToPulseSent(false); setInviteToPulseCopied(false); setInviteTargetContact(null); }}
                className="absolute top-4 right-4 text-white/80 hover:text-white z-10"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
              <div className="relative z-10">
                <div className="w-16 h-16 mx-auto mb-4 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                  <i className="fa-solid fa-rocket text-3xl text-white"></i>
                </div>
                <h3 className="text-xl font-bold text-white mb-1">Invite to Pulse</h3>
                <p className="text-white/80 text-sm">Share the future of communication</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              {inviteToPulseSent ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                    <i className="fa-solid fa-check text-3xl text-emerald-500"></i>
                  </div>
                  <h4 className="text-lg font-bold dark:text-white mb-2">Email Ready!</h4>
                  <p className="text-zinc-500 text-sm mb-4">
                    Your email app should open with a pre-written invitation for {inviteTargetContact.name}.
                  </p>
                  <button
                    onClick={() => { setShowInviteToPulseModal(false); setInviteToPulseSent(false); setInviteTargetContact(null); }}
                    className="px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-bold"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                      Invite <span className="font-bold text-zinc-900 dark:text-white">{inviteTargetContact.name}</span> to join you on Pulse, the AI-native communication platform that's changing how teams connect.
                    </p>
                  </div>

                  {/* Invite Options */}
                  <div className="space-y-3">
                    {/* Email Invite */}
                    {inviteTargetContact.email && (
                      <button
                        onClick={() => {
                          const userName = localStorage.getItem('pulse_user_name') || 'Your friend';
                          const mailtoLink = generateEarlyAccessInvite(
                            inviteTargetContact.email!,
                            userName,
                            inviteTargetContact.name.split(' ')[0]
                          );
                          window.open(mailtoLink, '_blank');
                          setInviteToPulseSent(true);
                        }}
                        className="w-full p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600 transition flex items-center gap-4 group"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-white flex items-center justify-center group-hover:scale-110 transition shadow-lg">
                          <i className="fa-solid fa-envelope text-lg"></i>
                        </div>
                        <div className="text-left flex-1">
                          <div className="font-bold text-zinc-900 dark:text-white">Send Email Invite</div>
                          <div className="text-xs text-zinc-500">{inviteTargetContact.email}</div>
                        </div>
                        <i className="fa-solid fa-chevron-right text-zinc-400"></i>
                      </button>
                    )}

                    {/* Copy Shareable Link */}
                    <button
                      onClick={() => {
                        const userName = localStorage.getItem('pulse_user_name') || 'A friend';
                        const shareText = generateShareableInviteText(userName);
                        navigator.clipboard.writeText(shareText);
                        setInviteToPulseCopied(true);
                        setTimeout(() => setInviteToPulseCopied(false), 3000);
                      }}
                      className="w-full p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 transition flex items-center gap-4 group"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center group-hover:scale-110 transition shadow-lg">
                        <i className={`fa-solid ${inviteToPulseCopied ? 'fa-check' : 'fa-copy'} text-lg`}></i>
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-bold text-zinc-900 dark:text-white">
                          {inviteToPulseCopied ? 'Copied!' : 'Copy Invite Message'}
                        </div>
                        <div className="text-xs text-zinc-500">Share on social or messaging apps</div>
                      </div>
                      <i className="fa-solid fa-chevron-right text-zinc-400"></i>
                    </button>

                    {/* SMS Invite (if phone available) */}
                    {inviteTargetContact.phone && (
                      <button
                        onClick={() => {
                          const userName = localStorage.getItem('pulse_user_name') || 'A friend';
                          const shareText = generateShareableInviteText(userName);
                          window.open(`sms:${inviteTargetContact.phone}?body=${encodeURIComponent(shareText)}`, '_blank');
                        }}
                        className="w-full p-4 rounded-xl bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border border-pink-200 dark:border-pink-800 hover:border-pink-400 dark:hover:border-pink-600 transition flex items-center gap-4 group"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-white flex items-center justify-center group-hover:scale-110 transition shadow-lg">
                          <i className="fa-solid fa-comment-sms text-lg"></i>
                        </div>
                        <div className="text-left flex-1">
                          <div className="font-bold text-zinc-900 dark:text-white">Send Text Invite</div>
                          <div className="text-xs text-zinc-500">{inviteTargetContact.phone}</div>
                        </div>
                        <i className="fa-solid fa-chevron-right text-zinc-400"></i>
                      </button>
                    )}
                  </div>

                  {/* Features Preview */}
                  <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs text-zinc-400 uppercase tracking-wider font-bold mb-3">What they'll get</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                        <i className="fa-solid fa-wand-magic-sparkles text-rose-500"></i>
                        <span>AI-powered messaging</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                        <i className="fa-solid fa-calendar text-blue-500"></i>
                        <span>Smart calendar</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                        <i className="fa-solid fa-microphone text-purple-500"></i>
                        <span>Meeting transcription</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                        <i className="fa-solid fa-users text-emerald-500"></i>
                        <span>Team collaboration</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact Details Slide-Out Panel */}
      {showContactPanel && selectedContactUserId && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
            onClick={() => {
              setShowContactPanel(false);
              setTimeout(() => setSelectedContactUserId(null), 300);
            }}
          />
          {/* Slide-out panel */}
          <div 
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl z-50 transform transition-transform duration-300 ease-out overflow-hidden"
            style={{
              animation: showContactPanel ? 'slideInRight 0.3s ease-out' : 'slideOutRight 0.3s ease-in'
            }}
          >
            <UserContactCard
              userId={selectedContactUserId}
              onClose={() => {
                setShowContactPanel(false);
                setTimeout(() => setSelectedContactUserId(null), 300);
              }}
            />
          </div>
        </>
      )}

      {/* ===== ACHIEVEMENT TOASTS ===== */}
      {showAchievements && messageEnhancements.newAchievements.map(achievement => (
        <AchievementToast
          key={achievement.id}
          achievement={achievement}
          onDismiss={() => messageEnhancements.dismissAchievement(achievement.id)}
        />
      ))}

      {/* ===== MESSAGE ANALYTICS DASHBOARD MODAL ===== */}
      {showAnalyticsDashboard && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-chart-line text-indigo-500"></i>
                Message Analytics Dashboard
              </h2>
              <button
                onClick={() => setShowAnalyticsDashboard(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <MessageAnalyticsDashboard
                threads={threads}
                timeRange="week"
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== NETWORK GRAPH MODAL ===== */}
      {showNetworkGraph && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl max-h-[80vh] rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-diagram-project text-purple-500"></i>
                Connection Network
              </h2>
              <button
                onClick={() => setShowNetworkGraph(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <NetworkGraph
                threads={threads}
                onNodeClick={(contactId) => {
                  const thread = threads.find(t => t.contactId === contactId);
                  if (thread) {
                    setActiveThreadId(thread.id);
                    setShowNetworkGraph(false);
                    setMobileView('chat');
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== ACHIEVEMENT PROGRESS MODAL ===== */}
      {showAchievements && messageEnhancements.getAllAchievements().length > 0 && (
        <div className="fixed bottom-4 left-4 z-50">
          <button
            onClick={() => setShowAnalyticsDashboard(true)}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center"
            title="View Achievements"
          >
            <i className="fa-solid fa-trophy"></i>
          </button>
        </div>
      )}

      {/* ===== CONTEXT PANEL SIDEBAR ===== */}
      {showContextPanel && (activeThread || activePulseConv) && (
        <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl z-40 transform transition-transform duration-300 ease-out overflow-hidden border-l border-zinc-200 dark:border-zinc-800" style={{ animation: 'slideInRight 0.3s ease-out' }}>
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-layer-group text-purple-500"></i>
                Context & Insights
              </h2>
              <button
                onClick={() => setShowContextPanel(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ContextPanel
                threadId={activeThread?.id || activePulseConv?.id || ''}
                messages={activeThread?.messages || activePulseConv?.messages?.map(m => ({
                  id: m.id,
                  sender: m.sender_id === currentUser?.id ? 'me' : m.sender?.name || 'Unknown',
                  text: m.content,
                  timestamp: new Date(m.created_at),
                  source: 'pulse' as const
                })) || []}
                apiKey={apiKey}
                onDocClick={(doc) => {
                  // Handle document click - could open in new tab or navigate
                  if (doc.url) window.open(doc.url, '_blank');
                }}
                onDecisionClick={(decision) => {
                  // Handle decision click - scroll to message or show details
                  console.log('Decision clicked:', decision);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== TASK EXTRACTOR PANEL ===== */}
      {showTaskExtractor && (activeThread || activePulseConv) && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-tasks text-emerald-500"></i>
                Extract Tasks from Conversation
              </h2>
              <button
                onClick={() => setShowTaskExtractor(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TaskExtractor
                workspaceId={activeThread?.id || activePulseConv?.id || ''}
                userId={currentUser?.id || ''}
                messages={activeThread?.messages || activePulseConv?.messages?.map(m => ({
                  id: m.id,
                  sender: m.sender_id === currentUser?.id ? 'me' : m.sender?.name || 'Unknown',
                  text: m.content,
                  timestamp: new Date(m.created_at),
                  source: 'pulse' as const
                })) || []}
                contacts={contacts}
                apiKey={apiKey}
                onTaskCreated={(task) => {
                  console.log('Task created:', task);
                  // Could show a toast or update UI
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== CHANNEL ARTIFACT PANEL ===== */}
      {showChannelArtifactPanel && (activeThread || activePulseConv) && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl animate-scale-in border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-file-export text-blue-500"></i>
                Export as Living Document
              </h2>
              <button
                onClick={() => setShowChannelArtifactPanel(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ChannelArtifactComponent
                channelId={activeThread?.id || activePulseConv?.id || ''}
                channelName={activeThread?.contactName || activePulseConv?.other_user?.name || 'Conversation'}
                messages={activeThread?.messages || activePulseConv?.messages?.map(m => ({
                  id: m.id,
                  sender: m.sender_id === currentUser?.id ? 'me' : m.sender?.name || 'Unknown',
                  text: m.content,
                  timestamp: new Date(m.created_at),
                  source: 'pulse' as const
                })) || []}
                apiKey={apiKey}
                onExport={(artifact, format) => {
                  console.log('Exported artifact:', artifact, 'format:', format);
                  // Handle export - could download file or open in new tab
                }}
              />
            </div>
          </div>
        </div>
      )}

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
