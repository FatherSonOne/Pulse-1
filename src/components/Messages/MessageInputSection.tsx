import React from 'react';
import { lazy, Suspense } from 'react';
import { Clock, File, Gavel, Image, Link, Lock, MessageCircle, MessageSquare, Plus, Rocket, Scale, Smile, Smartphone, Video, Wand2, X, Zap, ArrowUp } from 'lucide-react';
import MessageInputPortal from './MessageInputPortal';
import { SmartCompose } from '../MessageEnhancements/SmartCompose';
import { QuickActions } from '../MessageEnhancements/QuickActions';
import { MessageEnhancementErrorBoundary } from '../MessageEnhancements/MessageEnhancementErrorBoundary';
import { FeatureSkeleton } from '../MessageEnhancements/FeatureSkeleton';
import { VoiceTextButton } from '../shared/VoiceTextButton';
import { MeetingDeflector } from '../attention';
import { IntentComposer } from '../context';
import MessageInput from '../MessageInput';
import { MESSAGE_TEMPLATES, REACTION_CATEGORIES, generateSmartTemplateText } from './messageConstants';
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
  useTemplate: (template: typeof MESSAGE_TEMPLATES[0]) => void;
}

export const MessageInputSection: React.FC<MessageInputSectionProps> = ({
  activeThread, activePulseConversation, sidebarWidth,
  isViewOnlyMode, isNonPulseThread, canSendNativeSms,
  activeContact, contacts, setInviteTargetContact, setShowInviteToPulseModal,
  showTemplates, setShowTemplates,
  showEmojiPicker, emojiPickerMessageId, setShowEmojiPicker,
  inputText, setInputText,
  showAICoach, setShowAICoach,
  showSmartCompose, messageEnhancements,
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
  useTemplate,
}) => {
  if (!activeThread || activePulseConversation) return null;

  return (
    <MessageInputPortal
      sidebarWidth={sidebarWidth}
      isActive={true}
      usePortal={true}
    >
       {/* View-Only Mode Banner for Non-Pulse Users on PC */}
       {isViewOnlyMode && (
         <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
           <div className="flex items-start gap-3">
             <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center flex-shrink-0">
               <Smartphone className="text-amber-600 dark:text-amber-400" />
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
                 <Rocket /> Invite to Pulse for free messaging
               </button>
             </div>
           </div>
         </div>
       )}

       {/* SMS Mode Banner for Native Apps */}
       {isNonPulseThread && canSendNativeSms && (
         <div className="mb-3 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center gap-2 text-xs">
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

       {/* Message Templates Popup */}
       {showTemplates && (
         <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-3 animate-slide-up z-30">
           <div className="flex items-center justify-between mb-3">
             <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Quick Templates</span>
             <button onClick={() => setShowTemplates(false)} className="text-zinc-400 hover:text-zinc-600">
               <X className="text-xs" />
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
                     <Wand2 className="text-zinc-400 dark:text-zinc-500 text-[8px]" />
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
               />
             </Suspense>
           </MessageEnhancementErrorBoundary>
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
               />
             </Suspense>
           </MessageEnhancementErrorBoundary>
         </div>
       )}

       {/* Phase 2: Quick Phrases */}
       {showQuickPhrases && (
         <div className="mb-3">
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
         </div>
       )}

       {proposalModeEnabled && isProposalMode && (
           <div className="absolute bottom-full left-4 right-4 mb-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2 rounded-lg flex items-center justify-between text-xs text-amber-800 dark:text-amber-200 animate-slide-up">
               <span className="font-bold flex items-center gap-2"><Scale /> Proposal Mode Active</span>
               <button onClick={() => setIsProposalMode(false)}><X /></button>
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

       <div className={`flex gap-1 sm:gap-2 items-end relative bg-zinc-50 dark:bg-zinc-900 p-1.5 sm:p-2 rounded-xl border transition ${proposalModeEnabled && isProposalMode ? 'border-amber-400' : isRecording ? 'border-red-400' : 'border-zinc-200 dark:border-zinc-800'}`}>
         {/* Left Action Buttons - Collapsed on mobile */}
         <div className="flex gap-0.5 sm:gap-1 relative flex-shrink-0">
           {proposalModeEnabled && (
             <button
                onClick={() => setIsProposalMode(!isProposalMode)}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition flex items-center justify-center flex-shrink-0 ${isProposalMode ? 'bg-rose-500/[0.10] text-rose-600 dark:bg-rose-500/[0.15] dark:text-rose-400' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                title="Make Proposal (Ctrl+Shift+P)"
             >
                <Gavel className="text-xs sm:text-sm" />
             </button>
           )}
           <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={`hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition items-center justify-center flex-shrink-0 ${showTemplates ? 'bg-rose-500/[0.10] text-rose-600 dark:bg-rose-500/[0.15] dark:text-rose-400' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
              title="Message Templates (Ctrl+Shift+T)"
           >
              <Zap className="text-xs sm:text-sm" />
           </button>
           <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition flex items-center justify-center flex-shrink-0 ${showEmojiPicker ? 'bg-rose-500/[0.10] text-rose-600 dark:bg-rose-500/[0.15] dark:text-rose-400' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
              title="Add Emoji (Ctrl+Shift+E)"
           >
              <Smile className="text-xs sm:text-sm" />
           </button>

           {/* Phase 2: Quick Phrases Button - Hidden on mobile */}
           <button
              onClick={() => setShowQuickPhrases(!showQuickPhrases)}
              className={`hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition items-center justify-center flex-shrink-0 ${showQuickPhrases ? 'bg-rose-500/[0.10] text-rose-600 dark:bg-rose-500/[0.15] dark:text-rose-400' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
              title="Quick Phrases"
           >
              <MessageCircle className="text-xs sm:text-sm" />
           </button>

           {/* Attachment Menu Button */}
           <div className="relative" ref={attachmentMenuRef}>
             <button
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition flex items-center justify-center flex-shrink-0 ${showAttachmentMenu ? 'bg-rose-500/[0.10] text-rose-600 dark:bg-rose-500/[0.15] dark:text-rose-400' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                title="Attach File, Image, Video, or Link"
             >
                <Plus className="text-xs sm:text-sm" />
             </button>

             {/* Attachment Menu Dropdown */}
             {showAttachmentMenu && (
               <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50 min-w-[200px] animate-scale-in origin-bottom-left">
                 <div className="p-2">
                   <button
                     onClick={() => imageInputRef.current?.click()}
                     className="w-full px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition flex items-center gap-3 group"
                   >
                     <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-rose-500/[0.10] dark:group-hover:bg-rose-500/[0.15] transition">
                       <Image className="text-zinc-600 dark:text-zinc-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" />
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
                     <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-rose-500/[0.10] dark:group-hover:bg-rose-500/[0.15] transition">
                       <Video className="text-zinc-600 dark:text-zinc-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" />
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
                     <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-rose-500/[0.10] dark:group-hover:bg-rose-500/[0.15] transition">
                       <File className="text-zinc-600 dark:text-zinc-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" />
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
                     <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-rose-500/[0.10] dark:group-hover:bg-rose-500/[0.15] transition">
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
               setActiveToolOverlay={setActiveToolOverlay}
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
           {/* Voice buttons only shown when NOT using MessageInput component */}
           {!apiKey && (
             <>
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
             </>
           )}
           {/* Hidden on mobile */}
           <button
              onClick={() => setShowScheduleModal(true)}
              disabled={!inputText.trim()}
              className="hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition items-center justify-center flex-shrink-0 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40"
              title="Schedule Message"
           >
              <Clock className="text-xs sm:text-sm" />
           </button>
           {/* Phase 2: Voice Context Extractor Toggle - Hidden on mobile */}
           <button
              onClick={() => setShowVoiceExtractor(!showVoiceExtractor)}
              className={`hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-lg transition items-center justify-center flex-shrink-0 ${showVoiceExtractor ? 'bg-rose-500/[0.10] text-rose-600 dark:bg-rose-500/[0.15] dark:text-rose-400' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
              title="AI Voice Transcription"
           >
              <MessageCircle className="text-xs sm:text-sm" />
           </button>
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
               className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white flex items-center justify-center transition shadow-[0_4px_12px_rgba(244,63,94,0.30)] hover:shadow-[0_6px_20px_rgba(244,63,94,0.40)] disabled:opacity-50 disabled:shadow-none"
               title="Send SMS"
             >
               <MessageSquare className="text-xs sm:text-sm" />
             </button>
           ) : isViewOnlyMode ? (
             // Disabled button for view-only mode
             <button
               disabled
               className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center cursor-not-allowed"
               title="Send from your mobile device"
             >
               <Lock className="text-xs sm:text-sm" />
             </button>
           ) : (
             // Regular send button — brand coral CTA
             <button
               onClick={() => handleSend()}
               disabled={isRecording || (!inputText.trim())}
               className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white flex items-center justify-center transition shadow-[0_4px_12px_rgba(244,63,94,0.30)] hover:shadow-[0_6px_20px_rgba(244,63,94,0.40)] disabled:opacity-50 disabled:shadow-none"
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
