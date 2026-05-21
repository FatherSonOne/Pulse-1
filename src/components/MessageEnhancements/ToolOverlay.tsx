// ToolOverlay - Fullscreen tool panel that slides down over chat
import React from 'react';

// Import all tool components
import { ResponseTimeTracker } from './ResponseTimeTracker';
import { EngagementScoring } from './EngagementScoring';
import { ConversationFlowViz } from './ConversationFlowViz';
import { ProactiveInsightsEnhanced } from './ProactiveInsightsEnhanced';
import { ThreadCollaboration } from './ThreadCollaboration';
import { ThreadLinking } from './ThreadLinking';
import { KnowledgeBase } from './KnowledgeBase';
import { AdvancedSearch } from './AdvancedSearch';
import { MessagePinning } from './MessagePinning';
import { CollaborativeAnnotations } from './CollaborativeAnnotations';
import { SmartTemplates } from './SmartTemplates';
import { MessageScheduling } from './MessageScheduling';
import { ConversationSummary } from './ConversationSummary';
import { ExportSharing } from './ExportSharing';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { NotificationPreferences } from './NotificationPreferences';
import { ContactInsights } from './ContactInsights';
import { ReactionsAnalytics } from './ReactionsAnalytics';
import { QuickActionsCommandPalette } from './QuickActionsCommandPalette';
import { MessageBookmarks } from './MessageBookmarks';
import { ConversationTags } from './ConversationTags';
import { ReadReceipts } from './ReadReceipts';
import { SmartReminders } from './SmartReminders';
import { MessageThreading } from './MessageThreading';
import { SentimentTimeline } from './SentimentTimeline';
import { ContactGroups } from './ContactGroups';
import { NaturalLanguageSearch } from './NaturalLanguageSearch';
import { ConversationHighlights } from './ConversationHighlights';
import { VoiceRecorder } from './VoiceMessages';
import { EmojiReactions } from './EmojiReactions';
import { PriorityInbox } from './PriorityInbox';
import { ConversationArchive } from './ConversationArchive';
import { QuickReplies } from './QuickReplies';
import { MessageStatusTimeline } from './MessageStatusTimeline';
import { FormattingToolbar } from './FormattingToolbar';
import { MessageEncryption } from './MessageEncryption';
import { ReadTimeEstimation } from './ReadTimeEstimation';
import { MessageVersioning } from './MessageVersioning';
import { SmartFolders } from './SmartFolders';
import { ConversationInsights } from './ConversationInsights';
import { FocusTimer } from './FocusTimer';
import { TranslationHub } from './TranslationHub';
import { AnalyticsExport } from './AnalyticsExport';
import { AttachmentManager } from './AttachmentManager';
import { BackupSync } from './BackupSync';
import { SmartSuggestions } from './SmartSuggestions';

import { Check, X } from 'lucide-react';

export type ToolType = 'analytics' | 'collaboration' | 'productivity' | 'intelligence' | 'proactive' | 'communication' | 'personalization' | 'security' | 'mediaHub' | null;

interface ToolOverlayProps {
  activeTool: ToolType;
  onClose: () => void;
  conversationId?: string;
  otherUserId?: string;
  // Tab states
  analyticsView: 'pace' | 'flow' | 'insights';
  setAnalyticsView: (v: 'pace' | 'flow' | 'insights') => void;
  collaborationTab: string;
  setCollaborationTab: (v: any) => void;
  productivityTab: string;
  setProductivityTab: (v: any) => void;
  intelligenceTab: string;
  setIntelligenceTab: (v: any) => void;
  proactiveTab: string;
  setProactiveTab: (v: any) => void;
  communicationTab: string;
  setCommunicationTab: (v: any) => void;
  personalizationTab: string;
  setPersonalizationTab: (v: any) => void;
  securityTab: string;
  setSecurityTab: (v: any) => void;
  mediaHubTab: string;
  setMediaHubTab: (v: any) => void;
}

// Coral-As-Signal: every overlay uses the same rose tint for its icon
// tile, active-tab pill, and primary CTA. Differentiation comes from
// the title + mono section label, not a coloured swatch.
const toolConfig: Record<string, { title: string; icon: string }> = {
  analytics: { title: 'Analytics', icon: 'fa-chart-pie' },
  collaboration: { title: 'Collaboration', icon: 'fa-users-gear' },
  productivity: { title: 'Productivity', icon: 'fa-rocket' },
  intelligence: { title: 'Intelligence', icon: 'fa-brain' },
  proactive: { title: 'Proactive', icon: 'fa-bell' },
  communication: { title: 'Communication', icon: 'fa-comments' },
  personalization: { title: 'Personalization', icon: 'fa-sliders' },
  security: { title: 'Security', icon: 'fa-shield-halved' },
  mediaHub: { title: 'Media Hub', icon: 'fa-photo-film' },
};

const ToolOverlay: React.FC<ToolOverlayProps> = ({
  activeTool,
  onClose,
  conversationId,
  otherUserId,
  analyticsView,
  setAnalyticsView,
  collaborationTab,
  setCollaborationTab,
  productivityTab,
  setProductivityTab,
  intelligenceTab,
  setIntelligenceTab,
  proactiveTab,
  setProactiveTab,
  communicationTab,
  setCommunicationTab,
  personalizationTab,
  setPersonalizationTab,
  securityTab,
  setSecurityTab,
  mediaHubTab,
  setMediaHubTab,
}) => {
  if (!activeTool) return null;

  const config = toolConfig[activeTool];

  const TabButton: React.FC<{ id: string; label: string; icon: string; isActive: boolean; onClick: () => void; color?: string }> =
    ({ label, icon, isActive, onClick }) => (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isActive}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-[0.1em] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
          isActive
            ? 'bg-rose-500/[0.10] dark:bg-rose-500/[0.15] text-rose-600 dark:text-rose-bright'
            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-rose-500 dark:hover:text-rose-bright'
        }`}
      >
        <i className={`fa-solid ${icon} text-[10px] opacity-70`} />
        {label}
      </button>
    );

  return (
    <div className="absolute inset-0 z-40 bg-[#f8f8f8] dark:bg-black flex flex-col" style={{ animation: 'slideDown 0.3s ease-out' }}>
      {/* Tool Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] bg-white dark:bg-[rgba(255,255,255,0.03)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-500/[0.10] dark:bg-rose-500/[0.15] flex items-center justify-center">
            <i className={`fa-solid ${config.icon} text-rose-600 dark:text-rose-bright text-base`}></i>
          </div>
          <div>
            <div className="font-mono uppercase tracking-[0.1em] text-[10px] font-medium text-rose-600 dark:text-rose-bright">
              MESSAGE TOOL
            </div>
            <h3 className="text-base font-medium text-zinc-900 dark:text-white leading-tight">{config.title}</h3>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright hover:bg-rose-500/[0.08] dark:hover:bg-rose-500/[0.10] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
          title="Close and return to chat (Esc)"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tool Content - Full height scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Analytics Tool */}
        {activeTool === 'analytics' && (
          <div className="p-4">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <TabButton id="pace" label="Pace" icon="fa-stopwatch" isActive={analyticsView === 'pace'} onClick={() => setAnalyticsView('pace')} color="rose" />
              <TabButton id="flow" label="Flow" icon="fa-diagram-project" isActive={analyticsView === 'flow'} onClick={() => setAnalyticsView('flow')} color="rose" />
              <TabButton id="insights" label="AI Insights" icon="fa-lightbulb" isActive={analyticsView === 'insights'} onClick={() => setAnalyticsView('insights')} color="rose" />
            </div>
            <div className="min-h-[60vh] space-y-4">
              {analyticsView === 'pace' && (
                <>
                  <EngagementScoring />
                  <ResponseTimeTracker />
                </>
              )}
              {analyticsView === 'flow' && <ConversationFlowViz />}
              {analyticsView === 'insights' && <ProactiveInsightsEnhanced />}
            </div>
          </div>
        )}

        {/* Collaboration Tool */}
        {activeTool === 'collaboration' && (
          <div className="p-4">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <TabButton id="collab" label="Team" icon="fa-users" isActive={collaborationTab === 'collab'} onClick={() => setCollaborationTab('collab')} color="rose" />
              <TabButton id="links" label="Links" icon="fa-link" isActive={collaborationTab === 'links'} onClick={() => setCollaborationTab('links')} color="rose" />
              <TabButton id="kb" label="Knowledge" icon="fa-book" isActive={collaborationTab === 'kb'} onClick={() => setCollaborationTab('kb')} color="rose" />
              <TabButton id="search" label="Search" icon="fa-magnifying-glass" isActive={collaborationTab === 'search'} onClick={() => setCollaborationTab('search')} color="rose" />
              <TabButton id="pins" label="Pins" icon="fa-thumbtack" isActive={collaborationTab === 'pins'} onClick={() => setCollaborationTab('pins')} color="rose" />
              <TabButton id="annotations" label="Notes" icon="fa-sticky-note" isActive={collaborationTab === 'annotations'} onClick={() => setCollaborationTab('annotations')} color="rose" />
            </div>
            <div className="min-h-[60vh]">
              {collaborationTab === 'collab' && <ThreadCollaboration threadId={conversationId || ''} />}
              {collaborationTab === 'links' && <ThreadLinking currentThreadId={conversationId || ''} />}
              {collaborationTab === 'kb' && <KnowledgeBase />}
              {collaborationTab === 'search' && <AdvancedSearch onResultSelect={(r) => console.log(r)} />}
              {collaborationTab === 'pins' && <MessagePinning onPinToggle={(id) => console.log(id)} />}
              {collaborationTab === 'annotations' && <CollaborativeAnnotations onAnnotationCreate={(a) => console.log(a)} />}
            </div>
          </div>
        )}

        {/* Productivity Tool */}
        {activeTool === 'productivity' && (
          <div className="p-4">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <TabButton id="templates" label="Templates" icon="fa-file-lines" isActive={productivityTab === 'templates'} onClick={() => setProductivityTab('templates')} color="rose" />
              <TabButton id="schedule" label="Schedule" icon="fa-clock" isActive={productivityTab === 'schedule'} onClick={() => setProductivityTab('schedule')} color="rose" />
              <TabButton id="summary" label="Summary" icon="fa-list-check" isActive={productivityTab === 'summary'} onClick={() => setProductivityTab('summary')} color="rose" />
              <TabButton id="export" label="Export" icon="fa-file-export" isActive={productivityTab === 'export'} onClick={() => setProductivityTab('export')} color="rose" />
              <TabButton id="shortcuts" label="Shortcuts" icon="fa-keyboard" isActive={productivityTab === 'shortcuts'} onClick={() => setProductivityTab('shortcuts')} color="rose" />
              <TabButton id="notifications" label="Notifications" icon="fa-bell" isActive={productivityTab === 'notifications'} onClick={() => setProductivityTab('notifications')} color="rose" />
            </div>
            <div className="min-h-[60vh]">
              {productivityTab === 'templates' && <SmartTemplates onTemplateSelect={(t) => console.log(t)} />}
              {productivityTab === 'schedule' && <MessageScheduling onSchedule={(m, t) => console.log(m, t)} />}
              {productivityTab === 'summary' && <ConversationSummary />}
              {productivityTab === 'export' && <ExportSharing />}
              {productivityTab === 'shortcuts' && <KeyboardShortcuts />}
              {productivityTab === 'notifications' && <NotificationPreferences />}
            </div>
          </div>
        )}

        {/* Intelligence Tool */}
        {activeTool === 'intelligence' && (
          <div className="p-4">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <TabButton id="contacts" label="Insights" icon="fa-address-card" isActive={intelligenceTab === 'contacts'} onClick={() => setIntelligenceTab('contacts')} color="rose" />
              <TabButton id="reactions" label="Reactions" icon="fa-face-smile" isActive={intelligenceTab === 'reactions'} onClick={() => setIntelligenceTab('reactions')} color="rose" />
              <TabButton id="commands" label="Commands" icon="fa-terminal" isActive={intelligenceTab === 'commands'} onClick={() => setIntelligenceTab('commands')} color="rose" />
              <TabButton id="bookmarks" label="Bookmarks" icon="fa-bookmark" isActive={intelligenceTab === 'bookmarks'} onClick={() => setIntelligenceTab('bookmarks')} color="rose" />
              <TabButton id="tags" label="Tags" icon="fa-tags" isActive={intelligenceTab === 'tags'} onClick={() => setIntelligenceTab('tags')} color="rose" />
              <TabButton id="receipts" label="Read Status" icon="fa-check-double" isActive={intelligenceTab === 'receipts'} onClick={() => setIntelligenceTab('receipts')} color="rose" />
            </div>
            <div className="min-h-[60vh]">
              {intelligenceTab === 'contacts' && <ContactInsights contactId={otherUserId} />}
              {intelligenceTab === 'reactions' && <ReactionsAnalytics />}
              {intelligenceTab === 'commands' && <QuickActionsCommandPalette isOpen={true} onClose={() => {}} onAction={(id) => console.log(id)} embedded={true} />}
              {intelligenceTab === 'bookmarks' && <MessageBookmarks onBookmarkSelect={(m) => console.log(m)} />}
              {intelligenceTab === 'tags' && <ConversationTags onTagSelect={(t) => console.log(t)} />}
              {intelligenceTab === 'receipts' && <ReadReceipts />}
            </div>
          </div>
        )}

        {/* Proactive Intelligence Tool */}
        {activeTool === 'proactive' && (
          <div className="p-4">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <TabButton id="reminders" label="Reminders" icon="fa-bell" isActive={proactiveTab === 'reminders'} onClick={() => setProactiveTab('reminders')} color="rose" />
              <TabButton id="threading" label="Threading" icon="fa-code-branch" isActive={proactiveTab === 'threading'} onClick={() => setProactiveTab('threading')} color="rose" />
              <TabButton id="sentiment" label="Sentiment" icon="fa-heart-pulse" isActive={proactiveTab === 'sentiment'} onClick={() => setProactiveTab('sentiment')} color="rose" />
              <TabButton id="groups" label="Groups" icon="fa-users-rectangle" isActive={proactiveTab === 'groups'} onClick={() => setProactiveTab('groups')} color="rose" />
              <TabButton id="nlsearch" label="Smart Search" icon="fa-wand-magic-sparkles" isActive={proactiveTab === 'nlsearch'} onClick={() => setProactiveTab('nlsearch')} color="rose" />
              <TabButton id="highlights" label="Highlights" icon="fa-highlighter" isActive={proactiveTab === 'highlights'} onClick={() => setProactiveTab('highlights')} color="rose" />
            </div>
            <div className="min-h-[60vh]">
              {proactiveTab === 'reminders' && <SmartReminders onReminderCreate={(r) => console.log(r)} />}
              {proactiveTab === 'threading' && <MessageThreading onThreadSelect={(t) => console.log(t)} />}
              {proactiveTab === 'sentiment' && <SentimentTimeline />}
              {proactiveTab === 'groups' && <ContactGroups onGroupSelect={(g) => console.log(g)} />}
              {proactiveTab === 'nlsearch' && <NaturalLanguageSearch onSearch={(q) => console.log(q)} onResultSelect={(r) => console.log(r)} />}
              {proactiveTab === 'highlights' && <ConversationHighlights onHighlightSelect={(h) => console.log(h)} />}
            </div>
          </div>
        )}

        {/* Communication Tool */}
        {activeTool === 'communication' && (
          <div className="p-4">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <TabButton id="voice" label="Voice" icon="fa-microphone" isActive={communicationTab === 'voice'} onClick={() => setCommunicationTab('voice')} color="rose" />
              <TabButton id="emoji" label="Emoji" icon="fa-face-smile" isActive={communicationTab === 'emoji'} onClick={() => setCommunicationTab('emoji')} color="rose" />
              <TabButton id="priority" label="Priority" icon="fa-arrow-up-wide-short" isActive={communicationTab === 'priority'} onClick={() => setCommunicationTab('priority')} color="rose" />
              <TabButton id="archive" label="Archive" icon="fa-box-archive" isActive={communicationTab === 'archive'} onClick={() => setCommunicationTab('archive')} color="rose" />
              <TabButton id="quickreply" label="Quick Reply" icon="fa-reply" isActive={communicationTab === 'quickreply'} onClick={() => setCommunicationTab('quickreply')} color="rose" />
              <TabButton id="status" label="Status" icon="fa-circle-check" isActive={communicationTab === 'status'} onClick={() => setCommunicationTab('status')} color="rose" />
            </div>
            <div className="min-h-[60vh]">
              {communicationTab === 'voice' && <VoiceRecorder onSendVoice={(b, d) => console.log('Voice recorded:', b, d)} />}
              {communicationTab === 'emoji' && <EmojiReactions messageId="pulse-msg" onReactionSelect={(e) => console.log(e)} />}
              {communicationTab === 'priority' && <PriorityInbox onConversationSelect={(c) => console.log(c)} />}
              {communicationTab === 'archive' && <ConversationArchive onRestore={(id) => console.log(id)} />}
              {communicationTab === 'quickreply' && <QuickReplies onSelect={(r) => console.log(r)} />}
              {communicationTab === 'status' && <MessageStatusTimeline messageId="pulse-msg" />}
            </div>
          </div>
        )}

        {/* Personalization Tool — only Formatting remains; the
            remaining tabs (Auto Rules, Notes, Modes, Sounds, Drafts)
            were deleted as stubs. The shell stays so existing call
            sites that open the personalization overlay don't break. */}
        {activeTool === 'personalization' && (
          <div className="p-4">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <TabButton id="formatting" label="Formatting" icon="fa-text-height" isActive={personalizationTab === 'formatting'} onClick={() => setPersonalizationTab('formatting')} color="rose" />
            </div>
            <div className="min-h-[60vh]">
              <FormattingToolbar onFormat={(t) => console.log(t)} />
            </div>
          </div>
        )}

        {/* Security Tool */}
        {activeTool === 'security' && (
          <div className="p-4">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <TabButton id="encryption" label="Encryption" icon="fa-lock" isActive={securityTab === 'encryption'} onClick={() => setSecurityTab('encryption')} color="rose" />
              <TabButton id="readtime" label="Read Time" icon="fa-hourglass-half" isActive={securityTab === 'readtime'} onClick={() => setSecurityTab('readtime')} color="rose" />
              <TabButton id="versions" label="Versions" icon="fa-clock-rotate-left" isActive={securityTab === 'versions'} onClick={() => setSecurityTab('versions')} color="rose" />
              <TabButton id="folders" label="Folders" icon="fa-folder-tree" isActive={securityTab === 'folders'} onClick={() => setSecurityTab('folders')} color="rose" />
              <TabButton id="insights" label="Insights" icon="fa-chart-pie" isActive={securityTab === 'insights'} onClick={() => setSecurityTab('insights')} color="rose" />
              <TabButton id="focus" label="Focus Timer" icon="fa-hourglass-start" isActive={securityTab === 'focus'} onClick={() => setSecurityTab('focus')} color="rose" />
            </div>
            <div className="min-h-[60vh]">
              {securityTab === 'encryption' && <MessageEncryption onSettingsChange={(s) => console.log(s)} />}
              {securityTab === 'readtime' && <ReadTimeEstimation onMarkAsRead={(id) => console.log(id)} />}
              {securityTab === 'versions' && <MessageVersioning onRestoreVersion={(m, v) => console.log(m, v)} />}
              {securityTab === 'folders' && <SmartFolders onFolderSelect={(id) => console.log(id)} />}
              {securityTab === 'insights' && <ConversationInsights onContactSelect={(id) => console.log(id)} />}
              {securityTab === 'focus' && <FocusTimer onTimerStart={(t) => console.log(t)} onTimerComplete={(s) => console.log(s)} />}
            </div>
          </div>
        )}

        {/* Media Hub Tool */}
        {activeTool === 'mediaHub' && (
          <div className="p-4">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <TabButton id="translation" label="Translation" icon="fa-language" isActive={mediaHubTab === 'translation'} onClick={() => setMediaHubTab('translation')} color="rose" />
              <TabButton id="export" label="Export" icon="fa-file-export" isActive={mediaHubTab === 'export'} onClick={() => setMediaHubTab('export')} color="rose" />
              <TabButton id="attachments" label="Attachments" icon="fa-paperclip" isActive={mediaHubTab === 'attachments'} onClick={() => setMediaHubTab('attachments')} color="rose" />
              <TabButton id="backup" label="Backup" icon="fa-cloud-arrow-up" isActive={mediaHubTab === 'backup'} onClick={() => setMediaHubTab('backup')} color="rose" />
              <TabButton id="suggestions" label="Suggestions" icon="fa-wand-magic-sparkles" isActive={mediaHubTab === 'suggestions'} onClick={() => setMediaHubTab('suggestions')} color="rose" />
            </div>
            <div className="min-h-[60vh]">
              {mediaHubTab === 'translation' && <TranslationHub onTranslate={(t, f, to) => console.log(t, f, to)} />}
              {mediaHubTab === 'export' && <AnalyticsExport onExportStart={(j) => console.log(j)} />}
              {mediaHubTab === 'attachments' && <AttachmentManager onAttachmentSelect={(a) => console.log(a)} />}
              {mediaHubTab === 'backup' && <BackupSync onBackupCreate={(b) => console.log(b)} />}
              {mediaHubTab === 'suggestions' && <SmartSuggestions onSuggestionSelect={(s) => console.log(s)} />}
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] px-4 py-3 bg-white dark:bg-[rgba(255,255,255,0.03)]">
        <button
          onClick={onClose}
          className="btn-brand-primary w-full"
        >
          <Check className="w-4 h-4" />
          Done, return to chat
        </button>
      </div>
    </div>
  );
};

export default ToolOverlay;
