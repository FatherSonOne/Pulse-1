/**
 * MessagesFeaturePanels.tsx
 *
 * Phase 3-11 analytics/collaboration/productivity feature panels
 * extracted from Messages.tsx (original lines 4469-5541).
 *
 * These are inline panels that render inside the chat column
 * (not fixed-position modals) — they slide in below the header.
 */
import React from 'react';
import { X } from 'lucide-react';
import { Thread } from '../../types';
import { FeatureSkeleton } from '../MessageEnhancements/FeatureSkeleton';
import { MessageEnhancementErrorBoundary } from '../MessageEnhancements/MessageEnhancementErrorBoundary';
import { TranslationHub } from '../MessageEnhancements/TranslationHub';
import { AnalyticsExport } from '../MessageEnhancements/AnalyticsExport';
import { TemplatesLibrary } from '../MessageEnhancements/TemplatesLibrary';
import { AttachmentManager } from '../MessageEnhancements/AttachmentManager';
import { BackupSync } from '../MessageEnhancements/BackupSync';
import { SmartSuggestions } from '../MessageEnhancements/SmartSuggestions';
// (Tool-registry imports were removed when the QuickActionsCommandPalette
// modal moved to the global ⌘K palette; tools are registered in Messages.tsx.)
import { messagePersonalService } from '../../services/messagePersonalService';

const BundleAnalytics = React.lazy(() => import('../MessageEnhancements/BundleAnalytics'));
const BundleCollaboration = React.lazy(() => import('../MessageEnhancements/BundleCollaboration'));
const BundleProductivity = React.lazy(() => import('../MessageEnhancements/BundleProductivity'));
const BundleIntelligence = React.lazy(() => import('../MessageEnhancements/BundleIntelligence'));
const BundleProactive = React.lazy(() => import('../MessageEnhancements/BundleProactive'));
const BundleCommunication = React.lazy(() => import('../MessageEnhancements/BundleCommunication'));
const BundleAutomation = React.lazy(() => import('../MessageEnhancements/BundleAutomation'));
const BundleSecurity = React.lazy(() => import('../MessageEnhancements/BundleSecurity'));

// ── Types inlined to avoid circular imports ───────────────────────────────
type PinnedMessage = {
  id: string; messageId: string; text: string; sender: string;
  timestamp: string; pinnedBy: string; pinnedAt: string;
  category: 'important' | 'action' | 'reference' | 'decision' | 'custom';
  note?: string;
};
type Highlight = {
  id: string; messageId: string; startIndex: number; endIndex: number;
  text: string; color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
  label?: string; createdBy: string; createdAt: string;
};
type Annotation = {
  id: string; messageId: string;
  type: 'comment' | 'question' | 'suggestion' | 'flag' | 'approval';
  content: string; author: { id: string; name: string; avatar?: string };
  createdAt: string; resolved: boolean;
  replies: Array<{ id: string; content: string; author: { id: string; name: string }; createdAt: string; mentions: string[] }>;
  mentions: string[]; reactions: Array<{ emoji: string; users: string[] }>;
};
type UserTemplate = {
  id: string; name: string;
  category: 'greeting' | 'follow-up' | 'meeting' | 'feedback' | 'closing' | 'custom';
  content: string; variables: string[]; usageCount: number;
  lastUsed?: string; createdBy: string; tags: string[];
};
type UserScheduledMessage = {
  id: string; content: string; threadId: string; threadName: string;
  scheduledFor: string; createdAt: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
};
type UserReminder = {
  id: string; threadId: string; threadName: string; title: string;
  description?: string; remindAt: string;
  type: 'follow-up' | 'deadline' | 'check-in' | 'custom';
  priority: 'high' | 'medium' | 'low'; completed: boolean;
};
type UserBookmark = {
  id: string; messageId: string; conversationId: string;
  messagePreview: string; sender: string;
  timestamp: Date; createdAt: Date; note?: string;
  collection?: string; tags: string[];
};
type ConversationTagAssignment = {
  conversationId: string; tagIds: string[]; labelId?: string;
};

// ── Props interface ────────────────────────────────────────────────────────
export interface MessagesFeaturePanelsProps {
  activeThread: Thread | null;
  threads: Thread[];
  newMessage: string;
  setNewMessage: (value: string) => void;
  inputText: string;
  setInputText: (value: string) => void;
  apiKey?: string;

  // Phase 3 — Analytics
  showAnalyticsPanel: boolean;
  setShowAnalyticsPanel: (open: boolean) => void;
  analyticsView: 'response' | 'engagement' | 'flow' | 'insights';
  setAnalyticsView: (view: 'response' | 'engagement' | 'flow' | 'insights') => void;

  // Phase 4 — Collaboration
  showCollaborationPanel: boolean;
  collaborationTab: 'collab' | 'links' | 'kb' | 'search' | 'pins' | 'annotations';
  setCollaborationTab: (tab: 'collab' | 'links' | 'kb' | 'search' | 'pins' | 'annotations') => void;
  pinnedMessages: PinnedMessage[];
  setPinnedMessages: (msgs: PinnedMessage[] | ((prev: PinnedMessage[]) => PinnedMessage[])) => void;
  highlights: Highlight[];
  setHighlights: (h: Highlight[] | ((prev: Highlight[]) => Highlight[])) => void;
  annotations: Annotation[];
  setAnnotations: (a: Annotation[] | ((prev: Annotation[]) => Annotation[])) => void;
  setActiveThreadId: (id: string) => void;

  // Phase 5 — Productivity
  showProductivityPanel: boolean;
  productivityTab: 'templates' | 'schedule' | 'summary' | 'export' | 'shortcuts' | 'notifications';
  setProductivityTab: (tab: 'templates' | 'schedule' | 'summary' | 'export' | 'shortcuts' | 'notifications') => void;
  userTemplates: UserTemplate[];
  setUserTemplates: (t: UserTemplate[] | ((prev: UserTemplate[]) => UserTemplate[])) => void;
  userScheduledMessages: UserScheduledMessage[];
  setUserScheduledMessages: (m: UserScheduledMessage[] | ((prev: UserScheduledMessage[]) => UserScheduledMessage[])) => void;
  userReminders: UserReminder[];
  setUserReminders: (r: UserReminder[] | ((prev: UserReminder[]) => UserReminder[])) => void;

  // Phase 6 — Intelligence
  showIntelligencePanel: boolean;
  intelligenceTab: 'insights' | 'reactions' | 'bookmarks' | 'tags' | 'delivery';
  setIntelligenceTab: (tab: 'insights' | 'reactions' | 'bookmarks' | 'tags' | 'delivery') => void;
  userBookmarks: UserBookmark[];
  setUserBookmarks: (b: UserBookmark[] | ((prev: UserBookmark[]) => UserBookmark[])) => void;
  conversationTagAssignments: ConversationTagAssignment[];
  setConversationTagAssignments: (a: ConversationTagAssignment[] | ((prev: ConversationTagAssignment[]) => ConversationTagAssignment[])) => void;
  activeToolOverlay: string | null;
  setActiveToolOverlay: (type: string | null) => void;

  // Phase 7 — Proactive
  showProactivePanel: boolean;
  proactiveTab: 'reminders' | 'threading' | 'sentiment' | 'groups' | 'search' | 'highlights';
  setProactiveTab: (tab: 'reminders' | 'threading' | 'sentiment' | 'groups' | 'search' | 'highlights') => void;

  // Phase 8 — Communication
  showCommunicationPanel: boolean;
  communicationTab: 'voice' | 'reactions' | 'inbox' | 'archive' | 'replies' | 'status';
  setCommunicationTab: (tab: 'voice' | 'reactions' | 'inbox' | 'archive' | 'replies' | 'status') => void;

  // Phase 9 — Personalization
  showPersonalizationPanel: boolean;
  personalizationTab: 'rules' | 'formatting' | 'notes' | 'modes' | 'sounds' | 'drafts';
  setPersonalizationTab: (tab: 'rules' | 'formatting' | 'notes' | 'modes' | 'sounds' | 'drafts') => void;

  // Phase 10 — Security
  showSecurityPanel: boolean;
  securityTab: 'encryption' | 'readtime' | 'versions' | 'folders' | 'insights' | 'focus';
  setSecurityTab: (tab: 'encryption' | 'readtime' | 'versions' | 'folders' | 'insights' | 'focus') => void;

  // Phase 11 — Media Hub
  showMediaHubPanel: boolean;
  mediaHubTab: 'translation' | 'export' | 'templates' | 'attachments' | 'backup' | 'suggestions';
  setMediaHubTab: (tab: 'translation' | 'export' | 'templates' | 'attachments' | 'backup' | 'suggestions') => void;
}

// ── Guard ─────────────────────────────────────────────────────────────────
function anyPanelVisible(p: MessagesFeaturePanelsProps): boolean {
  return (
    (p.showAnalyticsPanel && !!p.activeThread) ||
    (p.showCollaborationPanel && !!p.activeThread) ||
    (p.showProductivityPanel && !!p.activeThread) ||
    (p.showIntelligencePanel && !!p.activeThread) ||
    (p.showProactivePanel && !!p.activeThread) ||
    (p.showCommunicationPanel && !!p.activeThread) ||
    (p.showPersonalizationPanel && !!p.activeThread) ||
    (p.showSecurityPanel && !!p.activeThread) ||
    (p.showMediaHubPanel && !!p.activeThread)
  );
}

// ── Component ─────────────────────────────────────────────────────────────
export const MessagesFeaturePanels = React.memo<MessagesFeaturePanelsProps>(
  function MessagesFeaturePanels(p) {
    if (!anyPanelVisible(p)) return null;

    const {
      activeThread, threads, newMessage, setNewMessage, inputText, setInputText,
      showAnalyticsPanel, setShowAnalyticsPanel, analyticsView, setAnalyticsView,
      showCollaborationPanel, collaborationTab, setCollaborationTab,
      pinnedMessages, setPinnedMessages, highlights, setHighlights,
      annotations, setAnnotations, setActiveThreadId,
      showProductivityPanel, productivityTab, setProductivityTab,
      userTemplates, setUserTemplates,
      userScheduledMessages, setUserScheduledMessages,
      userReminders, setUserReminders,
      showIntelligencePanel, intelligenceTab, setIntelligenceTab,
      userBookmarks, setUserBookmarks,
      conversationTagAssignments, setConversationTagAssignments,
      activeToolOverlay, setActiveToolOverlay,
      showProactivePanel, proactiveTab, setProactiveTab,
      showCommunicationPanel, communicationTab, setCommunicationTab,
      showPersonalizationPanel, personalizationTab, setPersonalizationTab,
      showSecurityPanel, securityTab, setSecurityTab,
      showMediaHubPanel, mediaHubTab, setMediaHubTab,
    } = p;

    return (
      <>
        {/* Phase 3: Analytics Panel */}
        {showAnalyticsPanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] p-4 animate-slide-down">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-[0.1em] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                    analyticsView === tab.id
                      ? 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-bright'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright'
                  }`}
                  aria-pressed={analyticsView === tab.id}
                >
                  <i className={`fa-solid ${tab.icon} text-[10px] opacity-70`} />
                  {tab.label}
                </button>
              ))}
              <button
                onClick={() => setShowAnalyticsPanel(false)}
                className="ml-auto w-7 h-7 rounded-md text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright hover:bg-zinc-100 dark:hover:bg-white/[0.04] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                aria-label="Close analytics panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Content */}
            <div className="max-h-80 overflow-y-auto">
              {analyticsView === 'response' && (
                <MessageEnhancementErrorBoundary featureName="Analytics">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleAnalytics.ResponseTimeTracker
                      messages={activeThread.messages.map(m => ({
                        id: m.id,
                        sender: m.sender,
                        timestamp: m.timestamp
                      }))}
                      contactName={activeThread.contactName}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {analyticsView === 'engagement' && (
                <MessageEnhancementErrorBoundary featureName="Analytics">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {analyticsView === 'flow' && (
                <MessageEnhancementErrorBoundary featureName="Analytics">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {analyticsView === 'insights' && (
                <MessageEnhancementErrorBoundary featureName="Analytics">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
            </div>
          </div>
        )}

        {/* Phase 4: Collaboration Panel */}
        {showCollaborationPanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] p-4 animate-slide-down">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-[0.1em] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                    collaborationTab === tab.id
                      ? 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-bright'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright'
                  }`}
                  aria-pressed={collaborationTab === tab.id}
                >
                  <i className={`fa-solid ${tab.icon} text-[10px] opacity-70`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-80 overflow-y-auto">
              {collaborationTab === 'collab' && (
                <MessageEnhancementErrorBoundary featureName="Collaboration">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {collaborationTab === 'links' && (
                <MessageEnhancementErrorBoundary featureName="Collaboration">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                        if (thread) setActiveThreadId(thread.id);
                      }}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {collaborationTab === 'kb' && (
                <MessageEnhancementErrorBoundary featureName="Collaboration">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleCollaboration.KnowledgeBase
                      articles={[
                        { id: '1', title: 'Getting Started Guide', category: 'Onboarding', content: 'Welcome to our platform...', tags: ['guide', 'basics'], lastUpdated: new Date().toISOString(), relevanceScore: 0.95 },
                        { id: '2', title: 'FAQ - Common Questions', category: 'Support', content: 'Frequently asked questions...', tags: ['faq', 'help'], lastUpdated: new Date().toISOString(), relevanceScore: 0.85 }
                      ]}
                      contextSuggestions={[]}
                      onArticleClick={(id) => console.log('Open article:', id)}
                      onInsertSnippet={(snippet) => setInputText(prev => prev + snippet)}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {collaborationTab === 'search' && (
                <MessageEnhancementErrorBoundary featureName="Collaboration">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {collaborationTab === 'pins' && (
                <MessageEnhancementErrorBoundary featureName="Collaboration">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {collaborationTab === 'annotations' && (
                <MessageEnhancementErrorBoundary featureName="Collaboration">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>

              )}
            </div>
          </div>
        )}

        {/* Phase 5: Productivity Panel */}
        {showProductivityPanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] p-4 animate-slide-down">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-[0.1em] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                    productivityTab === tab.id
                      ? 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-bright'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright'
                  }`}
                  aria-pressed={productivityTab === tab.id}
                >
                  <i className={`fa-solid ${tab.icon} text-[10px] opacity-70`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-80 overflow-y-auto">
              {productivityTab === 'templates' && (
                <MessageEnhancementErrorBoundary featureName="Productivity">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleProductivity.SmartTemplates
                      templates={userTemplates}
                      contactName={activeThread.contactName}
                      onInsertTemplate={(content) => {
                        setInputText(prev => prev + content);
                        // Best-effort usage tracking — find the matching
                        // template by content and bump its usage count.
                        const matched = userTemplates.find(t => t.content === content);
                        if (matched) {
                          void messagePersonalService.recordTemplateUsage(matched.id);
                          setUserTemplates(prev => prev.map(t =>
                            t.id === matched.id
                              ? { ...t, usageCount: (t.usageCount ?? 0) + 1, lastUsed: new Date().toISOString() }
                              : t
                          ));
                        }
                      }}
                      onSaveTemplate={async (template) => {
                        try {
                          const row = await messagePersonalService.addTemplate({
                            name: template.name,
                            body: template.content,
                            category: template.category,
                            variables: template.variables ?? [],
                            tags: template.tags ?? [],
                          });
                          setUserTemplates(prev => [...prev, {
                            id: row.id,
                            name: row.name,
                            category: row.category,
                            content: row.body,
                            variables: row.variables ?? [],
                            usageCount: row.usage_count,
                            lastUsed: row.last_used_at ?? undefined,
                            createdBy: row.user_id,
                            tags: row.tags ?? [],
                          }]);
                        } catch (err) {
                          console.error('[Messages] save template failed:', err);
                        }
                      }}
                      onDeleteTemplate={async (id) => {
                        const prevList = userTemplates;
                        setUserTemplates(prev => prev.filter(t => t.id !== id));
                        try {
                          await messagePersonalService.removeTemplate(id);
                        } catch (err) {
                          console.error('[Messages] delete template failed:', err);
                          setUserTemplates(prevList);
                        }
                      }}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {productivityTab === 'schedule' && (
                <MessageEnhancementErrorBoundary featureName="Productivity">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {productivityTab === 'summary' && (
                <MessageEnhancementErrorBoundary featureName="Productivity">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {productivityTab === 'export' && (
                <MessageEnhancementErrorBoundary featureName="Productivity">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {productivityTab === 'shortcuts' && (
                <MessageEnhancementErrorBoundary featureName="Productivity">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleProductivity.KeyboardShortcuts
                      shortcuts={[]}
                      onShortcutTriggered={(action) => console.log('Shortcut triggered:', action)}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {productivityTab === 'notifications' && (
                <MessageEnhancementErrorBoundary featureName="Productivity">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleProductivity.NotificationPreferences
                      channels={[]}
                      rules={[]}
                      quietHours={{ enabled: false, startTime: '22:00', endTime: '07:00', allowUrgent: true, days: ['mon', 'tue', 'wed', 'thu', 'fri'] }}
                      onUpdateQuietHours={(updates) => console.log('Update quiet hours:', updates)}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
            </div>
          </div>
        )}

        {/* Phase 6: Intelligence & Organization Panel */}
        {showIntelligencePanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] p-4 animate-slide-down">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-[0.1em] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                    intelligenceTab === tab.id
                      ? 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-bright'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright'
                  }`}
                  aria-pressed={intelligenceTab === tab.id}
                >
                  <i className={`fa-solid ${tab.icon} text-[10px] opacity-70`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {intelligenceTab === 'insights' && (
                <MessageEnhancementErrorBoundary featureName="Intelligence">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleIntelligence.ContactInsights
                      contactId={activeThread.contactId}
                      onClose={() => setIntelligenceTab('insights')}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {intelligenceTab === 'reactions' && (
                <MessageEnhancementErrorBoundary featureName="Intelligence">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleIntelligence.ReactionsAnalytics
                      conversationId={activeThread.id}
                      onClose={() => setIntelligenceTab('reactions')}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {intelligenceTab === 'bookmarks' && (
                <MessageEnhancementErrorBoundary featureName="Intelligence">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleIntelligence.MessageBookmarks
                      bookmarks={userBookmarks.filter(b => b.conversationId === activeThread.id)}
                      onBookmarkClick={(bookmark) => {
                        // Scroll to bookmarked message
                        const element = document.getElementById(`message-${bookmark.messageId}`);
                        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      onBookmarkDelete={async (id) => {
                        const prevList = userBookmarks;
                        setUserBookmarks(prev => prev.filter(b => b.id !== id));
                        try {
                          await messagePersonalService.removeBookmark(id);
                        } catch (err) {
                          console.error('[Messages] delete bookmark failed:', err);
                          setUserBookmarks(prevList);
                        }
                      }}
                      onBookmarkUpdate={async (bookmark) => {
                        const prevList = userBookmarks;
                        setUserBookmarks(prev => prev.map(b => b.id === bookmark.id ? bookmark : b));
                        try {
                          await messagePersonalService.updateBookmark(bookmark.id, {
                            collection: bookmark.collection ?? null,
                            note: bookmark.note ?? null,
                            tags: bookmark.tags,
                          });
                        } catch (err) {
                          console.error('[Messages] update bookmark failed:', err);
                          setUserBookmarks(prevList);
                        }
                      }}
                      onClose={() => setIntelligenceTab('bookmarks')}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {intelligenceTab === 'tags' && (
                <MessageEnhancementErrorBoundary featureName="Intelligence">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {intelligenceTab === 'delivery' && (
                <MessageEnhancementErrorBoundary featureName="Intelligence">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleIntelligence.ReadReceipts
                      messageId={activeThread.messages[activeThread.messages.length - 1]?.id || ''}
                      onClose={() => setIntelligenceTab('delivery')}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
            </div>
          </div>
        )}

        {/* Phase 7: Proactive Intelligence & Advanced Organization Panel */}
        {showProactivePanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] p-4 animate-slide-down">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-[0.1em] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                    proactiveTab === tab.id
                      ? 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-bright'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright'
                  }`}
                  aria-pressed={proactiveTab === tab.id}
                >
                  <i className={`fa-solid ${tab.icon} text-[10px] opacity-70`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {proactiveTab === 'reminders' && (
                <MessageEnhancementErrorBoundary featureName="Proactive Assistance">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleProactive.SmartReminders
                      conversationId={activeThread.id}
                      onReminderClick={(reminder) => console.log('Reminder clicked:', reminder)}
                      onCreateReminder={(reminder) => console.log('Create reminder:', reminder)}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {proactiveTab === 'threading' && (
                <MessageEnhancementErrorBoundary featureName="Proactive Assistance">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {proactiveTab === 'sentiment' && (
                <MessageEnhancementErrorBoundary featureName="Proactive Assistance">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleProactive.SentimentTimeline
                      conversationId={activeThread.id}
                      onPeriodClick={(period) => console.log('Period clicked:', period)}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {proactiveTab === 'groups' && (
                <MessageEnhancementErrorBoundary featureName="Proactive Assistance">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleProactive.ContactGroups
                      onGroupSelect={(group) => console.log('Group selected:', group)}
                      onChannelSelect={(channel) => console.log('Channel selected:', channel)}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {proactiveTab === 'search' && (
                <MessageEnhancementErrorBoundary featureName="Proactive Assistance">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {proactiveTab === 'highlights' && (
                <MessageEnhancementErrorBoundary featureName="Proactive Assistance">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleProactive.ConversationHighlights
                      conversationId={activeThread.id}
                      onMomentClick={(moment) => console.log('Moment clicked:', moment)}
                      onNavigateToMessage={(messageId) => {
                        const element = document.getElementById(`message-${messageId}`);
                        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
            </div>
          </div>
        )}

        {/* Phase 8: Communication Enhancement & Inbox Intelligence Panel */}
        {showCommunicationPanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] p-4 animate-slide-down">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-[0.1em] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                    communicationTab === tab.id
                      ? 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-bright'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright'
                  }`}
                  aria-pressed={communicationTab === tab.id}
                >
                  <i className={`fa-solid ${tab.icon} text-[10px] opacity-70`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {communicationTab === 'voice' && (
                <MessageEnhancementErrorBoundary featureName="Communication">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleCommunication.VoiceRecorder
                      onSendVoice={(blob, duration) => console.log('Voice sent:', duration, 'seconds')}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {communicationTab === 'reactions' && (
                <MessageEnhancementErrorBoundary featureName="Communication">
                  <React.Suspense fallback={<FeatureSkeleton />}>
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
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {communicationTab === 'inbox' && (
                <MessageEnhancementErrorBoundary featureName="Communication">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleCommunication.PriorityInbox
                      onMessageClick={(msg) => console.log('Message clicked:', msg)}
                      onMessageStar={(id) => console.log('Starred:', id)}
                      onMessageArchive={(id) => console.log('Archived:', id)}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {communicationTab === 'archive' && (
                <MessageEnhancementErrorBoundary featureName="Communication">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleCommunication.ConversationArchive
                      onRestore={(id) => console.log('Restore:', id)}
                      onDelete={(id) => console.log('Delete:', id)}
                      onExport={(id) => console.log('Export:', id)}
                      onViewConversation={(id) => console.log('View:', id)}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {communicationTab === 'replies' && (
                <MessageEnhancementErrorBoundary featureName="Communication">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleCommunication.QuickReplies
                      lastReceivedMessage={activeThread.messages.filter(m => m.sender !== 'You').pop()?.text}
                      onSelectReply={(text) => setNewMessage(text)}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {communicationTab === 'status' && (
                <MessageEnhancementErrorBoundary featureName="Communication">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleCommunication.MessageStatusTimeline
                      messageId={activeThread.messages[activeThread.messages.length - 1]?.id || ''}
                      onRetry={() => console.log('Retry send')}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
            </div>
          </div>
        )}

        {/* Phase 9: Advanced Personalization & Automation Panel */}
        {showPersonalizationPanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] p-4 animate-slide-down">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-[0.1em] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                    personalizationTab === tab.id
                      ? 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-bright'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright'
                  }`}
                  aria-pressed={personalizationTab === tab.id}
                >
                  <i className={`fa-solid ${tab.icon} text-[10px] opacity-70`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">

                {personalizationTab === 'rules' && (
                  <MessageEnhancementErrorBoundary featureName="Automation">
                    <React.Suspense fallback={<FeatureSkeleton />}>
                      <BundleAutomation.AutoResponseRules
                        onRuleTriggered={(rule, message) => console.log('Rule triggered:', rule.name, message)}
                      />
                    </React.Suspense>
                  </MessageEnhancementErrorBoundary>
                )}
                {personalizationTab === 'formatting' && (
                  <MessageEnhancementErrorBoundary featureName="Automation">
                    <React.Suspense fallback={<FeatureSkeleton />}>
                      <BundleAutomation.FormattingToolbar
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
                    </React.Suspense>
                  </MessageEnhancementErrorBoundary>
                )}
                {personalizationTab === 'notes' && (
                  <MessageEnhancementErrorBoundary featureName="Automation">
                    <React.Suspense fallback={<FeatureSkeleton />}>
                      <BundleAutomation.ContactNotes
                        contactId={activeThread.contactId}
                        contactName={activeThread.contactName || 'Unknown'}
                        onNoteAdded={(note) => console.log('Note added:', note)}
                        onNoteDeleted={(noteId) => console.log('Note deleted:', noteId)}
                      />
                    </React.Suspense>
                  </MessageEnhancementErrorBoundary>
                )}
                {personalizationTab === 'modes' && (
                  <MessageEnhancementErrorBoundary featureName="Automation">
                    <React.Suspense fallback={<FeatureSkeleton />}>
                      <BundleAutomation.ConversationModes
                        onModeChange={(mode) => console.log('Mode changed:', mode)}
                      />
                    </React.Suspense>
                  </MessageEnhancementErrorBoundary>
                )}
                {personalizationTab === 'sounds' && (
                  <MessageEnhancementErrorBoundary featureName="Automation">
                    <React.Suspense fallback={<FeatureSkeleton />}>
                      <BundleAutomation.NotificationSounds
                        onSoundChange={(event, sound) => console.log('Sound changed:', event, sound)}
                        onVolumeChange={(volume) => console.log('Volume changed:', volume)}
                      />
                    </React.Suspense>
                  </MessageEnhancementErrorBoundary>
                )}
                {personalizationTab === 'drafts' && (
                  <MessageEnhancementErrorBoundary featureName="Automation">
                    <React.Suspense fallback={<FeatureSkeleton />}>
                      <BundleAutomation.DraftManager
                        onLoadDraft={(draft) => {
                          setNewMessage(draft.content);
                          console.log('Draft loaded:', draft);
                        }}
                        onDeleteDraft={(draftId) => console.log('Draft deleted:', draftId)}
                      />
                    </React.Suspense>
                  </MessageEnhancementErrorBoundary>
                )}

            </div>
          </div>
        )}

        {/* Phase 10: Security, Insights & Productivity Panel */}
        {showSecurityPanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] p-4 animate-slide-down">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-[0.1em] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                    securityTab === tab.id
                      ? 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-bright'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright'
                  }`}
                  aria-pressed={securityTab === tab.id}
                >
                  <i className={`fa-solid ${tab.icon} text-[10px] opacity-70`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {securityTab === 'encryption' && (
                <MessageEnhancementErrorBoundary featureName="Security">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleSecurity.MessageEncryption
                      onSettingsChange={(settings) => console.log('Encryption settings:', settings)}
                      onGenerateKey={() => console.log('Generate new key')}
                      onExportKey={() => console.log('Export public key')}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {securityTab === 'readtime' && (
                <MessageEnhancementErrorBoundary featureName="Security">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleSecurity.ReadTimeEstimation
                      onMarkAsRead={(messageId) => console.log('Mark as read:', messageId)}
                      onPreferencesChange={(prefs) => console.log('Preferences:', prefs)}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {securityTab === 'versions' && (
                <MessageEnhancementErrorBoundary featureName="Security">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleSecurity.MessageVersioning
                      onRestoreVersion={(msgId, versionId) => console.log('Restore:', msgId, versionId)}
                      onCompareVersions={(a, b) => console.log('Compare:', a, b)}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {securityTab === 'folders' && (
                <MessageEnhancementErrorBoundary featureName="Security">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleSecurity.SmartFolders
                      onFolderSelect={(folderId) => console.log('Folder selected:', folderId)}
                      onCreateFolder={(folder) => console.log('Create folder:', folder)}
                      onDeleteFolder={(folderId) => console.log('Delete folder:', folderId)}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {securityTab === 'insights' && (
                <MessageEnhancementErrorBoundary featureName="Security">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleSecurity.ConversationInsights
                      onContactSelect={(contactId) => console.log('Contact selected:', contactId)}
                      onInsightAction={(insightId) => console.log('Insight action:', insightId)}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>
              )}
              {securityTab === 'focus' && (
                <MessageEnhancementErrorBoundary featureName="Security">
                  <React.Suspense fallback={<FeatureSkeleton />}>
                    <BundleSecurity.FocusTimer
                      onTimerStart={(type) => console.log('Timer started:', type)}
                      onTimerComplete={(session) => console.log('Session complete:', session)}
                      onTimerPause={() => console.log('Timer paused')}
                      onSettingsChange={(settings) => console.log('Timer settings:', settings)}
                    />
                  </React.Suspense>
                </MessageEnhancementErrorBoundary>

              )}
            </div>
          </div>
        )}

        {/* Phase 11: Multi-Media & Export Hub Panel */}
        {showMediaHubPanel && activeThread && (
          <div className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] p-4 animate-slide-down">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-[0.1em] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                    mediaHubTab === tab.id
                      ? 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-bright'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright'
                  }`}
                  aria-pressed={mediaHubTab === tab.id}
                >
                  <i className={`fa-solid ${tab.icon} text-[10px] opacity-70`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {mediaHubTab === 'translation' && (
                
                  <TranslationHub
                    conversationId={activeThread.id}
                    onTranslate={(text, from, to) => console.log('Translate:', text, from, to)}
                    onLanguageChange={(lang) => console.log('Language changed:', lang)}
                  />
                
              )}
              {mediaHubTab === 'export' && (
                
                  <AnalyticsExport
                    conversationId={activeThread.id}
                    onExportStart={(job) => console.log('Export started:', job)}
                    onExportComplete={(job) => console.log('Export complete:', job)}
                  />
                
              )}
              {mediaHubTab === 'templates' && (
                
                  <TemplatesLibrary
                    onTemplateSelect={(template) => {
                      setNewMessage(template.content);
                      console.log('Template selected:', template);
                    }}
                    onTemplateCreate={(template) => console.log('Template created:', template)}
                  />
                
              )}
              {mediaHubTab === 'attachments' && (
                
                  <AttachmentManager
                    conversationId={activeThread.id}
                    onAttachmentSelect={(attachment) => console.log('Attachment selected:', attachment)}
                    onAttachmentDelete={(attachmentId) => console.log('Attachment deleted:', attachmentId)}
                  />
                
              )}
              {mediaHubTab === 'backup' && (
                
                  <BackupSync
                    onBackupCreate={(backup) => console.log('Backup created:', backup)}
                    onBackupRestore={(backupId) => console.log('Backup restored:', backupId)}
                    onSyncToggle={(enabled) => console.log('Sync toggled:', enabled)}
                  />
                
              )}
              {mediaHubTab === 'suggestions' && (
                
                  <SmartSuggestions
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

        {/* The QuickActionsCommandPalette modal that lived here was retired
            in favor of the global ⌘K palette (CommandPaletteContext). Tool
            actions register via Messages.tsx → useRegisterCommands. */}


      </>
    );
  }
);

MessagesFeaturePanels.displayName = 'MessagesFeaturePanels';
