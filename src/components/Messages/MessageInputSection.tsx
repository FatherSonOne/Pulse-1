import React, { useCallback, useRef } from 'react';
import { lazy, Suspense } from 'react';
import { Clock, File, Image, Link, Lock, MessageSquare, Mic, Plus, Rocket, Scale, Smile, Smartphone, Video, X, ArrowUp } from 'lucide-react';
import MessageInputPortal from './MessageInputPortal';
import { SmartCompose } from '../MessageEnhancements/SmartCompose';
import { QuickActions } from '../MessageEnhancements/QuickActions';
import { MessageEnhancementErrorBoundary } from '../MessageEnhancements/MessageEnhancementErrorBoundary';
import { FeatureSkeleton } from '../MessageEnhancements/FeatureSkeleton';
import { PanelShell } from '../MessageEnhancements/PanelShell';
import { VoiceTextButton } from '../shared/VoiceTextButton';
import { MeetingDeflector } from '../attention';
import { IntentComposer } from '../context';
import MessageInput from '../MessageInput';
import SlashCommandDropdown from '../MessageInput/SlashCommandDropdown';
import { useSlashCommands } from '../../hooks/useSlashCommands';
import { getToolOverlayType, isInlinePanelTool } from '../../services/toolRegistry';
import { REACTION_CATEGORIES } from './messageConstants';
import { Thread, Contact } from '../../types';

const BundleAI = lazy(() => import('../MessageEnhancements/BundleAI'));

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface MessageInputSectionProps {
  activeThread: Thread | null;
  activePulseConversation: string | null;
  sidebarWidth: number;
  isViewOnlyMode: boolean;
  isNonPulseThread: boolean;
  canSendNativeSms: boolean;
  activeContact: Contact | null;
  contacts: Contact[];
  setInviteTargetContact: (c: Contact) => void;
  setShowInviteToPulseModal: (v: boolean) => void;
  showTemplates: boolean;
  setShowTemplates: (v: boolean) => void;
  showEmojiPicker: boolean;
  emojiPickerMessageId: string | null;
  setShowEmojiPicker: (v: boolean) => void;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  showAICoach: boolean;
  setShowAICoach: (v: boolean) => void;
  showSmartCompose: boolean;
  setShowSmartCompose: (v: boolean) => void;
  messageEnhancements: any;
  showQuickActionsBar: boolean;
  isRecording: boolean;
  startRecording: () => void;
  handleSmartReply: () => void;
  showAIMediator: boolean;
  setShowAIMediator: (v: boolean) => void;
  showQuickPhrases: boolean;
  setShowQuickPhrases: (v: boolean) => void;
  isProposalMode: boolean;
  setIsProposalMode: (v: boolean) => void;
  proposalModeEnabled?: boolean;
  recordingDuration: number;
  stopRecording: () => void;
  showVoiceExtractor: boolean;
  setShowVoiceExtractor: (v: boolean) => void;
  apiKey: string | null;
  useIntentComposer: boolean;
  sendPulseMessage: (text: string) => void;
  handleSendSms: (text: string) => void;
  handleSend: (text?: string) => void;
  setActiveToolOverlay: (v: any) => void;
  showAttachmentMenu: boolean;
  setShowAttachmentMenu: (v: boolean) => void;
  attachmentMenuRef: React.RefObject<HTMLDivElement>;
  imageInputRef: React.RefObject<HTMLInputElement>;
  videoInputRef: React.RefObject<HTMLInputElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAddLink: () => void;
  loadingAI: boolean;
  isBotChat: boolean;
  setShowScheduleModal: (v: boolean) => void;
  scheduledMessages: any[];
  activeThreadId: string | null;
  showMeetingDeflector: boolean;
  setShowMeetingDeflector: (v: boolean) => void;
  /**
   * Legacy: the Templates panel was removed in PR 3.1 (the audit's
   * #1 cognitive-load offender). The prop stays for now so the
   * Messages.tsx call site keeps compiling; future cleanup can prune
   * `showTemplates`, `setShowTemplates`, and `useTemplate` together.
   */
  useTemplate: (template: any) => void;
}

export const MessageInputSection: React.FC<MessageInputSectionProps> = ({
  activeThread, activePulseConversation, sidebarWidth,
  isViewOnlyMode, isNonPulseThread, canSendNativeSms,
  activeContact, contacts, setInviteTargetContact, setShowInviteToPulseModal,
  showTemplates, setShowTemplates,
  showEmojiPicker, emojiPickerMessageId, setShowEmojiPicker,
  inputText, setInputText,
  showAICoach, setShowAICoach,
  showSmartCompose, setShowSmartCompose, messageEnhancements,
  showQuickActionsBar, isRecording, startRecording, handleSmartReply,
  showAIMediator, setShowAIMediator,
  showQuickPhrases, setShowQuickPhrases,
  isProposalMode, setIsProposalMode,
  proposalModeEnabled = false,
  recordingDuration, stopRecording,
  showVoiceExtractor, setShowVoiceExtractor,
  apiKey, useIntentComposer,
  sendPulseMessage, handleSendSms, handleSend,
  setActiveToolOverlay,
  showAttachmentMenu, setShowAttachmentMenu, attachmentMenuRef,
  imageInputRef, videoInputRef, fileInputRef,
  handleFileUpload, handleImageUpload, handleVideoUpload, handleAddLink,
  loadingAI, isBotChat,
  setShowScheduleModal, scheduledMessages, activeThreadId,
  showMeetingDeflector, setShowMeetingDeflector,
  useTemplate: _useTemplate,
}) => {
  if (!activeThread || activePulseConversation) return null;

  // Slash-command palette — replaces the old chrome of one-button-per-
  // feature with a typed `/<cmd>` palette inside the textarea. Only
  // active on the basic textarea path; the AI-augmented MessageInput
  // owns its own slash via the same hook.
  const slashEditorRef = useRef<HTMLDivElement>(null);
  const { state: slashState, handlers: slashHandlers } = useSlashCommands(
    inputText,
    slashEditorRef,
    (toolId) => handleSlashLaunch(toolId),
  );

  const stripSlashPrefix = useCallback(() => {
    setInputText(prev => {
      const trimmed = (typeof prev === 'string' ? prev : '').trimStart();
      if (!trimmed.startsWith('/')) return prev;
      const firstSpace = trimmed.indexOf(' ');
      return firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1);
    });
  }, [setInputText]);

  const handleSlashLaunch = useCallback((toolId: string) => {
    stripSlashPrefix();
    if (isInlinePanelTool(toolId)) {
      switch (toolId) {
        case 'smart-compose':
          setShowSmartCompose(true);
          setShowQuickPhrases(false);
          break;
        case 'ai-coach':
          setShowAICoach(true);
          break;
        case 'ai-mediator':
          setShowAIMediator(true);
          break;
        case 'voice-extractor':
          setShowVoiceExtractor(true);
          break;
        case 'schedule-message':
          setShowScheduleModal(true);
          break;
        case 'smart-reply':
          handleSmartReply();
          break;
        case 'proposal-mode':
          if (proposalModeEnabled) setIsProposalMode(!isProposalMode);
          break;
      }
      return;
    }
    const overlay = getToolOverlayType(toolId);
    if (overlay) setActiveToolOverlay(overlay);
  }, [
    stripSlashPrefix, setShowSmartCompose, setShowQuickPhrases,
    setShowAICoach, setShowAIMediator, setShowVoiceExtractor,
    setShowScheduleModal, handleSmartReply, proposalModeEnabled,
    isProposalMode, setIsProposalMode, setActiveToolOverlay,
  ]);

  return (
    <MessageInputPortal
      sidebarWidth={sidebarWidth}
      isActive={true}
      usePortal={true}
    >
       {/* View-Only Mode Banner for Non-Pulse Users on PC */}
       {isViewOnlyMode && (
         <div className="mb-4 p-4 bg-amber-500/[0.06] dark:bg-amber-500/[0.08] ring-1 ring-amber-500/30 rounded-xl">
           <div className="flex items-start gap-3">
             <div className="w-10 h-10 bg-amber-500/15 ring-1 ring-amber-500/30 rounded-full flex items-center justify-center flex-shrink-0">
               <Smartphone className="text-amber-700 dark:text-amber-400" />
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
                 className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 rounded"
               >
                 <Rocket /> Invite to Pulse for free messaging
               </button>
             </div>
           </div>
         </div>
       )}

       {/* SMS Mode Banner for Native Apps */}
       {isNonPulseThread && canSendNativeSms && (
         <div className="mb-3 px-3 py-2 bg-[#f8f8f8] dark:bg-[rgba(255,255,255,0.03)]/40 border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] rounded-lg flex items-center gap-2 text-xs">
           <MessageSquare className="text-zinc-500 dark:text-zinc-400" />
           <span className="text-zinc-700 dark:text-zinc-300">
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
             className="ml-auto text-rose-600 dark:text-rose-400 hover:underline font-medium"
           >
             Invite to Pulse
           </button>
         </div>
       )}

       {/* Slash-command palette — `/<cmd>` typed in the textarea
           reveals the tool launcher (Smart Compose, AI Coach, Mediator,
           Voice Note, Schedule, Smart Reply, Proposal Mode, plus
           analyze tools). Replaces the prior chrome of one-button-per-
           feature that the audit flagged as the #1 cognitive-load
           incident in this surface. The dropdown owns its own absolute
           positioning (`bottom: calc(100% + 8px)`) anchored against
           this 0-height relative wrapper. */}
       {slashState.isActive && (
         <div className="relative">
           <SlashCommandDropdown
             matches={slashState.matches}
             selectedIndex={slashState.selectedIndex}
             query={slashState.query}
             onSelect={slashHandlers.handleSelect}
             onClose={slashHandlers.handleDismiss}
           />
         </div>
       )}

       {/* Extended Emoji Picker */}
       {showEmojiPicker && !emojiPickerMessageId && (
         <div className="absolute bottom-full left-4 mb-2 bg-white dark:bg-[rgba(255,255,255,0.03)] border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] rounded-xl shadow-xl p-3 animate-slide-up z-30 w-80">
           <div className="flex items-center justify-between mb-3">
             <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-500 dark:text-zinc-400">Add Emoji</span>
             <button onClick={() => setShowEmojiPicker(false)} className="text-zinc-400 hover:text-zinc-600">
               <X className="text-xs" />
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
                       className="w-8 h-8 flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] rounded text-lg"
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

       {/* Phase 2: AI Coach — real-time draft analysis, wrapped in
           the shared PanelShell so coach + mediator + insights all
           wear the same translucent chrome. */}
       {showAICoach && inputText.length > 10 && activeThread && (
         <div className="mb-3">
           <PanelShell
             source="COACH"
             title="Coaching this draft"
             subtitle={`Tone and clarity check for ${activeThread.contactName}`}
             onDismiss={() => setShowAICoach(false)}
           >
             <MessageEnhancementErrorBoundary featureName="AI Features">
               <Suspense fallback={<FeatureSkeleton />}>
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
                   hideHeader
                 />
               </Suspense>
             </MessageEnhancementErrorBoundary>
           </PanelShell>
         </div>
       )}

       {/* Smart Compose — AI suggestions and quick phrases (one panel,
           two modes). Phase 2 fold: the dedicated Quick Phrases panel
           below was retired; phrases now appear as a tab inside this
           panel. */}
       {(showSmartCompose || showQuickPhrases) && (
         <div className="mb-3">
           <section className="bg-white dark:bg-[rgba(255,255,255,0.03)] ring-1 ring-[rgba(0,0,0,0.08)] dark:ring-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
             <header className="flex items-center justify-between gap-3 px-3 pt-2 pb-2 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
               <div className="flex items-center gap-3 min-w-0">
                 <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-rose-600 dark:text-rose-bright flex-shrink-0">
                   PULSE AI · COMPOSE
                 </span>
                 <nav role="tablist" aria-label="Compose mode" className="flex gap-0.5 ml-1">
                   <button
                     type="button"
                     role="tab"
                     aria-selected={!showQuickPhrases}
                     onClick={() => { setShowSmartCompose(true); setShowQuickPhrases(false); }}
                     className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-[0.1em] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                       !showQuickPhrases
                         ? 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-bright'
                         : 'text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-bright'
                     }`}
                   >
                     Suggest
                   </button>
                   <button
                     type="button"
                     role="tab"
                     aria-selected={showQuickPhrases}
                     onClick={() => { setShowSmartCompose(false); setShowQuickPhrases(true); }}
                     className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-[0.1em] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                       showQuickPhrases
                         ? 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-bright'
                         : 'text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-bright'
                     }`}
                   >
                     Phrases
                   </button>
                 </nav>
               </div>
               <button
                 type="button"
                 onClick={() => { setShowSmartCompose(false); setShowQuickPhrases(false); }}
                 aria-label="Dismiss Smart Compose"
                 className="w-6 h-6 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright hover:bg-rose-500/[0.08] dark:hover:bg-rose-500/[0.10] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 flex-shrink-0"
               >
                 <X className="w-3.5 h-3.5" />
               </button>
             </header>
             <div className="p-3">
               {!showQuickPhrases && (
                 messageEnhancements.smartSuggestions.length > 0 ? (
                   <SmartCompose
                     text={inputText}
                     suggestions={messageEnhancements.smartSuggestions}
                     onSelectSuggestion={(text) => setInputText(text)}
                     loading={messageEnhancements.loadingSuggestions}
                   />
                 ) : (
                   <p className="text-xs text-zinc-500 dark:text-zinc-400 py-2">
                     {messageEnhancements.loadingSuggestions
                       ? 'Generating draft suggestions…'
                       : 'Start typing for AI draft suggestions, or switch to Phrases for saved openers.'}
                   </p>
                 )
               )}
               {showQuickPhrases && (
                 <MessageEnhancementErrorBoundary featureName="AI Features">
                   <Suspense fallback={<FeatureSkeleton />}>
                     <BundleAI.QuickPhrases
                       onSelect={(phrase) => {
                         setInputText(phrase);
                         setShowQuickPhrases(false);
                       }}
                       context="general"
                     />
                   </Suspense>
                 </MessageEnhancementErrorBoundary>
               )}
             </div>
           </section>
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

       {/* Phase 2: AI Mediator — wrapped in the shared PanelShell so
           coach + mediator share identical chrome (coral provenance
           chip, dismiss button, translucent surface). */}
       {showAIMediator && activeThread && activeThread.messages.length > 5 && (
         <div className="mb-3">
           <PanelShell
             source="MEDIATOR"
             title="Mediating this thread"
             subtitle={`Conflict and de-escalation cues for ${activeThread.contactName}`}
             onDismiss={() => setShowAIMediator(false)}
           >
             <MessageEnhancementErrorBoundary featureName="AI Features">
               <Suspense fallback={<FeatureSkeleton />}>
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
                   hideHeader
                 />
               </Suspense>
             </MessageEnhancementErrorBoundary>
           </PanelShell>
         </div>
       )}

       {proposalModeEnabled && isProposalMode && (
           <div className="absolute bottom-full left-4 right-4 mb-2 bg-amber-500/[0.06] dark:bg-amber-500/[0.08] ring-1 ring-amber-500/30 p-2 rounded-lg flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 animate-slide-up">
               <span className="font-mono uppercase tracking-[0.1em] text-[10px] font-medium flex items-center gap-2"><Scale /> PROPOSAL MODE ACTIVE</span>
               <button onClick={() => setIsProposalMode(false)} className="hover:text-amber-900 dark:hover:text-amber-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 rounded"><X /></button>
           </div>
       )}

       {/* Recording Indicator */}
       {isRecording && (
         <div className="absolute bottom-full left-4 right-4 mb-2 bg-red-500/[0.06] dark:bg-red-500/[0.08] ring-1 ring-red-500/30 p-3 rounded-lg flex items-center justify-between animate-slide-up">
           <div className="flex items-center gap-3">
             <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
             <span className="text-sm text-red-700 dark:text-red-300 font-medium">Recording... {formatDuration(recordingDuration)}</span>
           </div>
           <button onClick={stopRecording} className="px-3 py-1 bg-red-500 text-white rounded-lg text-[10px] font-mono uppercase tracking-[0.1em] font-medium hover:bg-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40">
             Stop & Send
           </button>
         </div>
       )}

       {/* Phase 2: Voice Context Extractor Panel */}
       {showVoiceExtractor && (
         <div className="mb-3">
           <MessageEnhancementErrorBoundary featureName="AI Features">
             <Suspense fallback={<FeatureSkeleton />}>
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
           </MessageEnhancementErrorBoundary>
         </div>
       )}

       {/* Meeting Deflector — auto-fires when "let's meet" intent is
           detected. Renders inline (above the input row, in normal
           flow) instead of absolute-stacking, so it occupies the same
           slot that AI panels use and never pushes the composer past
           the thread. */}
       {showMeetingDeflector && inputText.length > 20 && (
         <div className="mb-3">
           <MeetingDeflector
             messageText={inputText}
             apiKey={apiKey}
             onAcceptSuggestion={(_type, template) => {
               setInputText(template);
               setShowMeetingDeflector(false);
             }}
             onDismiss={() => setShowMeetingDeflector(false)}
           />
         </div>
       )}

       <div className={`flex gap-1 sm:gap-2 items-end relative bg-[#f8f8f8] dark:bg-[rgba(255,255,255,0.03)] p-1.5 sm:p-2 rounded-xl border transition-colors ${proposalModeEnabled && isProposalMode ? 'border-amber-500/50' : isRecording ? 'border-red-500/50' : 'border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]'}`}>
         {/* Left Action Buttons — 4-button target: Attach + Emoji on
             this side; Voice-to-Text + Send on the right. Templates /
             Proposal / Schedule / Voice Note / Smart Reply / Smart
             Compose / AI Coach / AI Mediator all moved behind the
             `/<cmd>` slash palette typed in the textarea. */}
         <div className="flex gap-0.5 sm:gap-1 relative flex-shrink-0">
           <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition flex items-center justify-center flex-shrink-0 ${showEmojiPicker ? 'bg-rose-500/[0.10] text-rose-600 dark:bg-rose-500/[0.15] dark:text-rose-400' : 'text-zinc-400 hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)]'}`}
              title="Add Emoji (Ctrl+Shift+E)"
           >
              <Smile className="text-xs sm:text-sm" />
           </button>

           {/* Attachment Menu Button */}
           <div className="relative" ref={attachmentMenuRef}>
             <button
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition flex items-center justify-center flex-shrink-0 ${showAttachmentMenu ? 'bg-rose-500/[0.10] text-rose-600 dark:bg-rose-500/[0.15] dark:text-rose-400' : 'text-zinc-400 hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)]'}`}
                title="Attach File, Image, Video, or Link"
             >
                <Plus className="text-xs sm:text-sm" />
             </button>

             {/* Attachment Menu Dropdown */}
             {showAttachmentMenu && (
               <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-[rgba(255,255,255,0.03)] rounded-xl shadow-2xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] overflow-hidden z-50 min-w-[200px] animate-scale-in origin-bottom-left">
                 <div className="p-2">
                   <button
                     onClick={() => imageInputRef.current?.click()}
                     className="w-full px-4 py-3 text-left hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] rounded-lg transition flex items-center gap-3 group"
                   >
                     <div className="w-10 h-10 rounded-lg bg-[#f2f2f2] dark:bg-[rgba(255,255,255,0.055)] flex items-center justify-center group-hover:bg-rose-500/[0.10] dark:group-hover:bg-rose-500/[0.15] transition">
                       <Image className="text-zinc-600 dark:text-zinc-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" />
                     </div>
                     <div>
                       <div className="text-sm font-medium dark:text-white">Photo</div>
                       <div className="text-xs text-zinc-500">Upload an image</div>
                     </div>
                   </button>

                   <button
                     onClick={() => videoInputRef.current?.click()}
                     className="w-full px-4 py-3 text-left hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] rounded-lg transition flex items-center gap-3 group"
                   >
                     <div className="w-10 h-10 rounded-lg bg-[#f2f2f2] dark:bg-[rgba(255,255,255,0.055)] flex items-center justify-center group-hover:bg-rose-500/[0.10] dark:group-hover:bg-rose-500/[0.15] transition">
                       <Video className="text-zinc-600 dark:text-zinc-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" />
                     </div>
                     <div>
                       <div className="text-sm font-medium dark:text-white">Video</div>
                       <div className="text-xs text-zinc-500">Upload a video</div>
                     </div>
                   </button>

                   <button
                     onClick={() => fileInputRef.current?.click()}
                     className="w-full px-4 py-3 text-left hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] rounded-lg transition flex items-center gap-3 group"
                   >
                     <div className="w-10 h-10 rounded-lg bg-[#f2f2f2] dark:bg-[rgba(255,255,255,0.055)] flex items-center justify-center group-hover:bg-rose-500/[0.10] dark:group-hover:bg-rose-500/[0.15] transition">
                       <File className="text-zinc-600 dark:text-zinc-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" />
                     </div>
                     <div>
                       <div className="text-sm font-medium dark:text-white">File</div>
                       <div className="text-xs text-zinc-500">Upload a document</div>
                     </div>
                   </button>

                   <div className="border-t border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] my-1"></div>

                   {/* Voice Message — moved from a dedicated chrome
                       button to the Attach dropdown so the composer
                       lands on 4 base buttons total. Starting a
                       recording reveals the inline Recording banner
                       (above the input row), which owns the Stop &
                       Send affordance. */}
                   {!apiKey && (
                     <button
                       onClick={() => { setShowAttachmentMenu(false); if (!isRecording) startRecording(); }}
                       disabled={isRecording}
                       className="w-full px-4 py-3 text-left hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] rounded-lg transition flex items-center gap-3 group disabled:opacity-40 disabled:cursor-not-allowed"
                     >
                       <div className="w-10 h-10 rounded-lg bg-[#f2f2f2] dark:bg-[rgba(255,255,255,0.055)] flex items-center justify-center group-hover:bg-rose-500/[0.10] dark:group-hover:bg-rose-500/[0.15] transition">
                         <Mic className="text-zinc-600 dark:text-zinc-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" />
                       </div>
                       <div>
                         <div className="text-sm font-medium dark:text-white">Voice Message</div>
                         <div className="text-xs text-zinc-500">Record an audio reply</div>
                       </div>
                     </button>
                   )}

                   <button
                     onClick={handleAddLink}
                     className="w-full px-4 py-3 text-left hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] rounded-lg transition flex items-center gap-3 group"
                   >
                     <div className="w-10 h-10 rounded-lg bg-[#f2f2f2] dark:bg-[rgba(255,255,255,0.055)] flex items-center justify-center group-hover:bg-rose-500/[0.10] dark:group-hover:bg-rose-500/[0.15] transition">
                       <Link className="text-zinc-600 dark:text-zinc-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" />
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
                 if (activePulseConversation) {
                   sendPulseMessage(inputText);
                 } else if (isNonPulseThread && canSendNativeSms) {
                   handleSendSms(inputText);
                 } else if (!isViewOnlyMode) {
                   handleSend(inputText);
                 }
               }}
               apiKey={apiKey}
               showAnalysis={true}
               placeholder={isProposalMode ? "State your proposal clearly..." : isRecording ? "Recording voice message..." : "Type a message..."}
               disabled={isRecording}
               setActiveToolOverlay={setActiveToolOverlay}
             />
           </div>
         ) : apiKey ? (
           <div className="flex-1">
             <MessageInput
               onSend={(text) => {
                 if (activePulseConversation) {
                   sendPulseMessage(text);
                 } else if (isNonPulseThread && canSendNativeSms) {
                   handleSendSms(text);
                 } else if (!isViewOnlyMode) {
                   handleSend(text);
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
               apiKey={apiKey}
               setActiveToolOverlay={setActiveToolOverlay}
               onInlinePanelLaunch={handleSlashLaunch}
             />
           </div>
         ) : (
           <textarea
             aria-label="Type a message"
             className="flex-1 bg-transparent dark:text-white text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none resize-none py-2.5 max-h-32 scrollbar-hide font-light"
             placeholder={isProposalMode ? "State your proposal clearly..." : isRecording ? "Recording voice message..." : "Type a message — `/` for tools…"}
             rows={1}
             value={inputText}
             onChange={(e) => setInputText(e.target.value)}
             onKeyDown={(e) => {
               // Slash palette keyboard nav (↑↓/Enter/Tab/Esc). When the
               // palette is active, slashHandlers swallows the event and
               // we skip the normal send path.
               if (slashHandlers.handleKeyDown(e as unknown as React.KeyboardEvent)) return;
               if (e.key === 'Enter' && !e.shiftKey) {
                 e.preventDefault();
                 if (isNonPulseThread && canSendNativeSms) handleSendSms(inputText);
                 else if (!isViewOnlyMode) handleSend();
               }
             }}
             disabled={isRecording}
           />
         )}

         {/* Right Action Buttons — Voice-to-Text dictation + Send. The
             former Schedule (Clock), Voice Extractor (MessageCircle),
             Smart Reply (Wand2), and standalone voice-message (Mic)
             buttons all moved behind `/schedule`, `/voicenote`,
             `/reply`, and the Attach menu's Voice Message entry. */}
         <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
           {!apiKey && (
             <VoiceTextButton
               onTranscript={(text) => setInputText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text)}
               size="sm"
               disabled={isRecording}
               className="text-zinc-400 hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] w-8 h-8 sm:w-10 sm:h-10"
             />
           )}
           {isNonPulseThread && canSendNativeSms ? (
             // SMS Send Button for non-Pulse users on mobile
             <button
               onClick={() => handleSendSms(inputText)}
               disabled={!inputText.trim()}
               className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-[0_2px_8px_rgba(244,63,94,0.20)] hover:shadow-[0_4px_12px_rgba(244,63,94,0.30)] disabled:opacity-50 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
               title="Send SMS"
             >
               <MessageSquare className="text-xs sm:text-sm" />
             </button>
           ) : isViewOnlyMode ? (
             // Disabled button for view-only mode
             <button
               disabled
               className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#e8e8e8] dark:bg-[rgba(255,255,255,0.055)] text-zinc-500 flex items-center justify-center cursor-not-allowed"
               title="Send from your mobile device"
             >
               <Lock className="text-xs sm:text-sm" />
             </button>
           ) : (
             // Regular send button — brand coral CTA
             <button
               onClick={() => handleSend()}
               disabled={isRecording || (!inputText.trim())}
               className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-[0_2px_8px_rgba(244,63,94,0.20)] hover:shadow-[0_4px_12px_rgba(244,63,94,0.30)] disabled:opacity-50 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
               title="Send (Enter)"
             >
               <ArrowUp className="text-xs sm:text-sm" />
             </button>
           )}
         </div>
       </div>

       {/* Scheduled Messages Indicator */}
       {scheduledMessages.filter(m => m.threadId === activeThreadId).length > 0 && (
         <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
           <Clock />
           <span>{scheduledMessages.filter(m => m.threadId === activeThreadId).length} message(s) scheduled for this conversation</span>
           <button onClick={() => setShowScheduleModal(true)} className="text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline">View</button>
         </div>
       )}
    </MessageInputPortal>
  );
};
