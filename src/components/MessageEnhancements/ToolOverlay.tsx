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
import { AutoResponseRules } from './AutoResponseRules';
import { FormattingToolbar } from './FormattingToolbar';
import { ContactNotes } from './ContactNotes';
import { ConversationModes } from './ConversationModes';
import { NotificationSounds } from './NotificationSounds';
import { DraftManager } from './DraftManager';
import { MessageEncryption } from './MessageEncryption';
import { ReadTimeEstimation } from './ReadTimeEstimation';
import { MessageVersioning } from './MessageVersioning';
import { SmartFolders } from './SmartFolders';
import { ConversationInsights } from './ConversationInsights';
import { FocusTimer } from './FocusTimer';
import { TranslationHub } from './TranslationHub';
import { AnalyticsExport } from './AnalyticsExport';
import { TemplatesLibrary } from './TemplatesLibrary';
import { AttachmentManager } from './AttachmentManager';
import { BackupSync } from './BackupSync';
import { SmartSuggestions } from './SmartSuggestions';

export type ToolType = 'analytics' | 'collaboration' | 'productivity' | 'intelligence' | 'proactive' | 'communication' | 'personalization' | 'security' | 'mediaHub' | null;

interface ToolOverlayProps {
  activeTool: ToolType;
  onClose: () => void;
  conversationId?: string;
  otherUserId?: string;
  // Tab states
  analyticsView: 'response' | 'engagement' | 'flow' | 'insights';
  setAnalyticsView: (v: 'response' | 'engagement' | 'flow' | 'insights') => void;
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

const toolConfig: Record<string, { title: string; icon: string; bgColor: string; textColor: string }> = {
  analytics: { title: 'Conversation Analytics', icon: 'fa-chart-pie', bgColor: 'bg-indigo-500', textColor: 'text-indigo-500' },
  collaboration: { title: 'Collaboration Tools', icon: 'fa-users-gear', bgColor: 'bg-purple-500', textColor: 'text-purple-500' },
  productivity: { title: 'Productivity Tools', icon: 'fa-rocket', bgColor: 'bg-cyan-500', textColor: 'text-cyan-500' },
  intelligence: { title: 'Intelligence & Organization', icon: 'fa-brain', bgColor: 'bg-violet-500', textColor: 'text-violet-500' },
  proactive: { title: 'Smart Reminders & More', icon: 'fa-bell', bgColor: 'bg-rose-500', textColor: 'text-rose-500' },
  communication: { title: 'Communication Tools', icon: 'fa-comments', bgColor: 'bg-amber-500', textColor: 'text-amber-500' },
  personalization: { title: 'Personalization & Automation', icon: 'fa-sliders', bgColor: 'bg-fuchsia-500', textColor: 'text-fuchsia-500' },
  security: { title: 'Security & Insights', icon: 'fa-shield-halved', bgColor: 'bg-emerald-500', textColor: 'text-emerald-500' },
  mediaHub: { title: 'Media Hub & Export', icon: 'fa-photo-film', bgColor: 'bg-cyan-500', textColor: 'text-cyan-500' },
};

export const ToolOverlay: React.FC<ToolOverlayProps> = ({
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

  const TabButton: React.FC<{ id: string; label: string; icon: string; isActive: boolean; onClick: () => void; color: string }> =
    ({ id, label, icon, isActive, onClick, color }) => (
      <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${
          isActive
            ? `${color} text-white shadow-lg`
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
        }`}
      >
        <i className={`fa-solid ${icon}`} />
        {label}
      </button>
    );

  return (
    <div className="absolute inset-0 z-40 bg-white dark:bg-zinc-950 flex flex-col" style={{ animation: 'slideDown 0.3s ease-out' }}>
      {/* Tool Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center shadow-lg`}>
            <i className={`fa-solid ${config.icon} text-white text-lg`}></i>
          </div>
          <div>
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{config.title}</h3>
            <p className="text-sm text-zinc-500">Select a feature below</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 flex items-center justify-center transition group"
          title="Close and return to chat"
        >
          <i className="fa-solid fa-xmark text-zinc-400 group-hover:text-red-500 text-lg"></i>
        </button>
      </div>

      {/* Tool Content - Full height scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Analytics Tool */}
        {activeTool === 'analytics' && (
          <div className="p-4">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <TabButton id="response" label="Response Time" icon="fa-stopwatch" isActive={analyticsView === 'response'} onClick={() => setAnalyticsView('response')} color="bg-indigo-500" />
              <TabButton id="engagement" label="Engagement" icon="fa-fire" isActive={analyticsView === 'engagement'} onClick={() => setAnalyticsView('engagement')} color="bg-indigo-500" />
              <TabButton id="flow" label="Flow" icon="fa-diagram-project" isActive={analyticsView === 'flow'} onClick={() => setAnalyticsView('flow')} color="bg-indigo-500" />
              <TabButton id="insights" label="AI Insights" icon="fa-lightbulb" isActive={analyticsView === 'insights'} onClick={() => setAnalyticsView('insights')} color="bg-indigo-500" />
            </div>
            <div className="min-h-[60vh]">
              {analyticsView === 'response' && <ResponseTimeTracker />}
              {analyticsView === 'engagement' && <EngagementScoring />}
              {analyticsView === 'flow' && <ConversationFlowViz />}
              {analyticsView === 'insights' && <ProactiveInsightsEnhanced />}
            </div>
          </div>
        )}

        {/* Collaboration Tool */}
        {activeTool === 'collaboration' && (
          <div className="p-4">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <TabButton id="collab" label="Team" icon="fa-users" isActive={collaborationTab === 'collab'} onClick={() => setCollaborationTab('collab')} color="bg-purple-500" />
              <TabButton id="links" label="Links" icon="fa-link" isActive={collaborationTab === 'links'} onClick={() => setCollaborationTab('links')} color="bg-purple-500" />
              <TabButton id="kb" label="Knowledge" icon="fa-book" isActive={collaborationTab === 'kb'} onClick={() => setCollaborationTab('kb')} color="bg-purple-500" />
              <TabButton id="search" label="Search" icon="fa-magnifying-glass" isActive={collaborationTab === 'search'} onClick={() => setCollaborationTab('search')} color="bg-purple-500" />
              <TabButton id="pins" label="Pins" icon="fa-thumbtack" isActive={collaborationTab === 'pins'} onClick={() => setCollaborationTab('pins')} color="bg-purple-500" />
              <TabButton id="annotations" label="Notes" icon="fa-sticky-note" isActive={collaborationTab === 'annotations'} onClick={() => setCollaborationTab('annotations')} color="bg-purple-500" />
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
              <TabButton id="templates" label="Templates" icon="fa-file-lines" isActive={productivityTab === 'templates'} onClick={() => setProductivityTab('templates')} color="bg-cyan-500" />
              <TabButton id="schedule" label="Schedule" icon="fa-clock" isActive={productivityTab === 'schedule'} onClick={() => setProductivityTab('schedule')} color="bg-cyan-500" />
              <TabButton id="summary" label="Summary" icon="fa-list-check" isActive={productivityTab === 'summary'} onClick={() => setProductivityTab('summary')} color="bg-cyan-500" />
              <TabButton id="export" label="Export" icon="fa-file-export" isActive={productivityTab === 'export'} onClick={() => setProductivityTab('export')} color="bg-cyan-500" />
              <TabButton id="shortcuts" label="Shortcuts" icon="fa-keyboard" isActive={productivityTab === 'shortcuts'} onClick={() => setProductivityTab('shortcuts')} color="bg-cyan-500" />
              <TabButton id="notifications" label="Notifications" icon="fa-bell" isActive={productivityTab === 'notifications'} onClick={() => setProductivityTab('notifications')} color="bg-cyan-500" />
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
              <TabButton id="contacts" label="Insights" icon="fa-address-card" isActive={intelligenceTab === 'contacts'} onClick={() => setIntelligenceTab('contacts')} color="bg-violet-500" />
              <TabButton id="reactions" label="Reactions" icon="fa-face-smile" isActive={intelligenceTab === 'reactions'} onClick={() => setIntelligenceTab('reactions')} color="bg-violet-500" />
              <TabButton id="commands" label="Commands" icon="fa-terminal" isActive={intelligenceTab === 'commands'} onClick={() => setIntelligenceTab('commands')} color="bg-violet-500" />
              <TabButton id="bookmarks" label="Bookmarks" icon="fa-bookmark" isActive={intelligenceTab === 'bookmarks'} onClick={() => setIntelligenceTab('bookmarks')} color="bg-violet-500" />
              <TabButton id="tags" label="Tags" icon="fa-tags" isActive={intelligenceTab === 'tags'} onClick={() => setIntelligenceTab('tags')} color="bg-violet-500" />
              <TabButton id="receipts" label="Read Status" icon="fa-check-double" isActive={intelligenceTab === 'receipts'} onClick={() => setIntelligenceTab('receipts')} color="bg-violet-500" />
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
              <TabButton id="reminders" label="Reminders" icon="fa-bell" isActive={proactiveTab === 'reminders'} onClick={() => setProactiveTab('reminders')} color="bg-rose-500" />
              <TabButton id="threading" label="Threading" icon="fa-code-branch" isActive={proactiveTab === 'threading'} onClick={() => setProactiveTab('threading')} color="bg-rose-500" />
              <TabButton id="sentiment" label="Sentiment" icon="fa-heart-pulse" isActive={proactiveTab === 'sentiment'} onClick={() => setProactiveTab('sentiment')} color="bg-rose-500" />
              <TabButton id="groups" label="Groups" icon="fa-users-rectangle" isActive={proactiveTab === 'groups'} onClick={() => setProactiveTab('groups')} color="bg-rose-500" />
              <TabButton id="nlsearch" label="Smart Search" icon="fa-wand-magic-sparkles" isActive={proactiveTab === 'nlsearch'} onClick={() => setProactiveTab('nlsearch')} color="bg-rose-500" />
              <TabButton id="highlights" label="Highlights" icon="fa-highlighter" isActive={proactiveTab === 'highlights'} onClick={() => setProactiveTab('highlights')} color="bg-rose-500" />
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
              <TabButton id="voice" label="Voice" icon="fa-microphone" isActive={communicationTab === 'voice'} onClick={() => setCommunicationTab('voice')} color="bg-amber-500" />
              <TabButton id="emoji" label="Emoji" icon="fa-face-smile" isActive={communicationTab === 'emoji'} onClick={() => setCommunicationTab('emoji')} color="bg-amber-500" />
              <TabButton id="priority" label="Priority" icon="fa-arrow-up-wide-short" isActive={communicationTab === 'priority'} onClick={() => setCommunicationTab('priority')} color="bg-amber-500" />
              <TabButton id="archive" label="Archive" icon="fa-box-archive" isActive={communicationTab === 'archive'} onClick={() => setCommunicationTab('archive')} color="bg-amber-500" />
              <TabButton id="quickreply" label="Quick Reply" icon="fa-reply" isActive={communicationTab === 'quickreply'} onClick={() => setCommunicationTab('quickreply')} color="bg-amber-500" />
              <TabButton id="status" label="Status" icon="fa-circle-check" isActive={communicationTab === 'status'} onClick={() => setCommunicationTab('status')} color="bg-amber-500" />
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

        {/* Personalization Tool */}
        {activeTool === 'personalization' && (
          <div className="p-4">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <TabButton id="rules" label="Auto Rules" icon="fa-robot" isActive={personalizationTab === 'rules'} onClick={() => setPersonalizationTab('rules')} color="bg-fuchsia-500" />
              <TabButton id="formatting" label="Formatting" icon="fa-text-height" isActive={personalizationTab === 'formatting'} onClick={() => setPersonalizationTab('formatting')} color="bg-fuchsia-500" />
              <TabButton id="notes" label="Contact Notes" icon="fa-note-sticky" isActive={personalizationTab === 'notes'} onClick={() => setPersonalizationTab('notes')} color="bg-fuchsia-500" />
              <TabButton id="modes" label="Modes" icon="fa-toggle-on" isActive={personalizationTab === 'modes'} onClick={() => setPersonalizationTab('modes')} color="bg-fuchsia-500" />
              <TabButton id="sounds" label="Sounds" icon="fa-volume-high" isActive={personalizationTab === 'sounds'} onClick={() => setPersonalizationTab('sounds')} color="bg-fuchsia-500" />
              <TabButton id="drafts" label="Drafts" icon="fa-floppy-disk" isActive={personalizationTab === 'drafts'} onClick={() => setPersonalizationTab('drafts')} color="bg-fuchsia-500" />
            </div>
            <div className="min-h-[60vh]">
              {personalizationTab === 'rules' && <AutoResponseRules onRuleCreate={(r) => console.log(r)} />}
              {personalizationTab === 'formatting' && <FormattingToolbar onFormat={(t) => console.log(t)} />}
              {personalizationTab === 'notes' && <ContactNotes contactId={otherUserId} />}
              {personalizationTab === 'modes' && <ConversationModes onModeChange={(m) => console.log(m)} />}
              {personalizationTab === 'sounds' && <NotificationSounds onSoundChange={(s) => console.log(s)} />}
              {personalizationTab === 'drafts' && <DraftManager onLoadDraft={(d) => console.log(d)} onDeleteDraft={(id) => console.log(id)} />}
            </div>
          </div>
        )}

        {/* Security Tool */}
        {activeTool === 'security' && (
          <div className="p-4">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <TabButton id="encryption" label="Encryption" icon="fa-lock" isActive={securityTab === 'encryption'} onClick={() => setSecurityTab('encryption')} color="bg-emerald-500" />
              <TabButton id="readtime" label="Read Time" icon="fa-hourglass-half" isActive={securityTab === 'readtime'} onClick={() => setSecurityTab('readtime')} color="bg-emerald-500" />
              <TabButton id="versions" label="Versions" icon="fa-clock-rotate-left" isActive={securityTab === 'versions'} onClick={() => setSecurityTab('versions')} color="bg-emerald-500" />
              <TabButton id="folders" label="Folders" icon="fa-folder-tree" isActive={securityTab === 'folders'} onClick={() => setSecurityTab('folders')} color="bg-emerald-500" />
              <TabButton id="insights" label="Insights" icon="fa-chart-pie" isActive={securityTab === 'insights'} onClick={() => setSecurityTab('insights')} color="bg-emerald-500" />
              <TabButton id="focus" label="Focus Timer" icon="fa-hourglass-start" isActive={securityTab === 'focus'} onClick={() => setSecurityTab('focus')} color="bg-emerald-500" />
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
              <TabButton id="translation" label="Translation" icon="fa-language" isActive={mediaHubTab === 'translation'} onClick={() => setMediaHubTab('translation')} color="bg-cyan-500" />
              <TabButton id="export" label="Export" icon="fa-file-export" isActive={mediaHubTab === 'export'} onClick={() => setMediaHubTab('export')} color="bg-cyan-500" />
              <TabButton id="templates" label="Templates" icon="fa-file-lines" isActive={mediaHubTab === 'templates'} onClick={() => setMediaHubTab('templates')} color="bg-cyan-500" />
              <TabButton id="attachments" label="Attachments" icon="fa-paperclip" isActive={mediaHubTab === 'attachments'} onClick={() => setMediaHubTab('attachments')} color="bg-cyan-500" />
              <TabButton id="backup" label="Backup" icon="fa-cloud-arrow-up" isActive={mediaHubTab === 'backup'} onClick={() => setMediaHubTab('backup')} color="bg-cyan-500" />
              <TabButton id="suggestions" label="Suggestions" icon="fa-wand-magic-sparkles" isActive={mediaHubTab === 'suggestions'} onClick={() => setMediaHubTab('suggestions')} color="bg-cyan-500" />
            </div>
            <div className="min-h-[60vh]">
              {mediaHubTab === 'translation' && <TranslationHub onTranslate={(t, f, to) => console.log(t, f, to)} />}
              {mediaHubTab === 'export' && <AnalyticsExport onExportStart={(j) => console.log(j)} />}
              {mediaHubTab === 'templates' && <TemplatesLibrary onTemplateSelect={(t) => console.log(t)} />}
              {mediaHubTab === 'attachments' && <AttachmentManager onAttachmentSelect={(a) => console.log(a)} />}
              {mediaHubTab === 'backup' && <BackupSync onBackupCreate={(b) => console.log(b)} />}
              {mediaHubTab === 'suggestions' && <SmartSuggestions onSuggestionSelect={(s) => console.log(s)} />}
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 bg-zinc-50 dark:bg-zinc-900">
        <button
          onClick={onClose}
          className={`w-full py-3 rounded-xl ${config.bgColor} text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition shadow-lg`}
        >
          <i className="fa-solid fa-check"></i>
          Done - Return to Chat
        </button>
      </div>
    </div>
  );
};

export default ToolOverlay;
