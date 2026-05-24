/**
 * MessagesEndModals.tsx
 *
 * End-of-return modal stack extracted from Messages.tsx (lines 5997–6267).
 */
import React, { lazy, Suspense } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { FileOutput, GitFork, Layers, ListChecks, TrendingUp, X } from 'lucide-react';
import { Contact, Thread } from '../../types';
import { PulseConversation } from '../../services/pulseService';
import {
  generateEarlyAccessInvite,
  generateShareableInviteText,
} from '../../services/inviteService';
import { InviteToPulseModal } from './modals';
import { UserContactCard } from '../UserContact/UserContactCard';
import { AchievementToast } from '../MessageEnhancements/AchievementToast';
import { MessageAnalyticsDashboard } from '../MessageEnhancements/MessageAnalyticsDashboard';
import { NetworkGraph } from '../MessageEnhancements/NetworkGraph';
import { ContextPanel } from '../context';
import { TaskExtractor } from '../tasks/TaskExtractor';
import { ChannelArtifactComponent } from '../artifacts';

const FeatureSettingsPanel = lazy(() =>
  import('./FeatureSettingsPanel').then(m => ({ default: m.FeatureSettingsPanel }))
);
const FocusMode = lazy(() =>
  import('./FocusMode').then(m => ({ default: m.FocusMode }))
);

export interface MessagesEndModalsProps {
  // Invite to Pulse Modal
  showInviteToPulseModal: boolean;
  setShowInviteToPulseModal: (open: boolean) => void;
  inviteTargetContact: Contact | null;
  setInviteTargetContact: (contact: Contact | null) => void;
  inviteToPulseSent: boolean;
  setInviteToPulseSent: (sent: boolean) => void;
  inviteToPulseCopied: boolean;
  setInviteToPulseCopied: (copied: boolean) => void;

  // Contact Details Slide-Out Panel
  showContactPanel: boolean;
  setShowContactPanel: (open: boolean) => void;
  selectedContactUserId: string | null;
  setSelectedContactUserId: (id: string | null) => void;

  // Achievement Toasts
  showAchievements: boolean;
  messageEnhancements: {
    newAchievements: Array<{ id: string; [key: string]: unknown }>;
    dismissAchievement: (id: string) => void;
  };

  // Message Analytics Dashboard Modal
  showAnalyticsDashboard: boolean;
  setShowAnalyticsDashboard: (open: boolean) => void;
  threads: Thread[];

  // Network Graph Modal
  showNetworkGraph: boolean;
  setShowNetworkGraph: (open: boolean) => void;
  setActiveThreadId: (id: string) => void;
  setMobileView: (view: 'list' | 'chat') => void;

  // Context Panel Sidebar
  showContextPanel: boolean;
  setShowContextPanel: (open: boolean) => void;
  activeThread: Thread | null;
  activePulseConv: PulseConversation | undefined;
  apiKey: string;
  currentUser: { id: string; name: string; email: string };

  // Task Extractor Panel
  showTaskExtractor: boolean;
  setShowTaskExtractor: (open: boolean) => void;
  contacts: Contact[];

  // Channel Artifact Panel
  showChannelArtifactPanel: boolean;
  setShowChannelArtifactPanel: (open: boolean) => void;

  // Feature Settings Panel
  showFeatureSettings: boolean;
  setShowFeatureSettings: (open: boolean) => void;

  // Focus Mode Overlay
  isFocusModeActive: boolean;
  setIsFocusModeActive: (active: boolean) => void;
  activeThreadId: string;
  focusThreadId: string | null;
  setFocusThreadId: (id: string | null) => void;
}

export const MessagesEndModals = React.memo<MessagesEndModalsProps>((props) => {
  // Focus traps for each inline modal (sub-component modals manage their own traps).
  const analyticsRef = useFocusTrap<HTMLDivElement>({
    active: props.showAnalyticsDashboard,
    onEscape: () => props.setShowAnalyticsDashboard(false),
  });
  const networkRef = useFocusTrap<HTMLDivElement>({
    active: props.showNetworkGraph,
    onEscape: () => props.setShowNetworkGraph(false),
  });
  const taskExtractorRef = useFocusTrap<HTMLDivElement>({
    active: props.showTaskExtractor && !!(props.activeThread || props.activePulseConv),
    onEscape: () => props.setShowTaskExtractor(false),
  });
  const artifactPanelRef = useFocusTrap<HTMLDivElement>({
    active: props.showChannelArtifactPanel && !!(props.activeThread || props.activePulseConv),
    onEscape: () => props.setShowChannelArtifactPanel(false),
  });

  const anyVisible =
    props.showInviteToPulseModal ||
    props.showContactPanel ||
    (props.showAchievements && props.messageEnhancements.newAchievements.length > 0) ||
    props.showAnalyticsDashboard ||
    props.showNetworkGraph ||
    (props.showContextPanel && !!(props.activeThread || props.activePulseConv)) ||
    (props.showTaskExtractor && !!(props.activeThread || props.activePulseConv)) ||
    (props.showChannelArtifactPanel && !!(props.activeThread || props.activePulseConv)) ||
    props.showFeatureSettings ||
    props.isFocusModeActive;

  if (!anyVisible) return null;

  return (
    <>
      {/* Invite to Pulse Modal */}
      <InviteToPulseModal
        isOpen={props.showInviteToPulseModal}
        onClose={() => {
          props.setShowInviteToPulseModal(false);
          props.setInviteToPulseSent(false);
          props.setInviteToPulseCopied(false);
          props.setInviteTargetContact(null);
        }}
        targetContact={props.inviteTargetContact}
        isSent={props.inviteToPulseSent}
        isCopied={props.inviteToPulseCopied}
        onSendEmail={() => {
          if (props.inviteTargetContact?.email) {
            const userName = localStorage.getItem('pulse_user_name') || 'Your friend';
            const mailtoLink = generateEarlyAccessInvite(
              props.inviteTargetContact.email,
              userName,
              props.inviteTargetContact.name.split(' ')[0]
            );
            window.open(mailtoLink, '_blank');
            props.setInviteToPulseSent(true);
          }
        }}
        onCopyLink={() => {
          const userName = localStorage.getItem('pulse_user_name') || 'A friend';
          const shareText = generateShareableInviteText(userName);
          navigator.clipboard.writeText(shareText);
          props.setInviteToPulseCopied(true);
          setTimeout(() => props.setInviteToPulseCopied(false), 3000);
        }}
        onSendSMS={() => {
          if (props.inviteTargetContact?.phone) {
            const userName = localStorage.getItem('pulse_user_name') || 'A friend';
            const shareText = generateShareableInviteText(userName);
            window.open(`sms:${props.inviteTargetContact.phone}?body=${encodeURIComponent(shareText)}`, '_blank');
          }
        }}
        onDone={() => {
          props.setShowInviteToPulseModal(false);
          props.setInviteToPulseSent(false);
          props.setInviteTargetContact(null);
        }}
      />

      {/* Contact Details Slide-Out Panel */}
      {props.showContactPanel && props.selectedContactUserId && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
            onClick={() => {
              props.setShowContactPanel(false);
              setTimeout(() => props.setSelectedContactUserId(null), 300);
            }}
          />
          <div
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-[rgba(255,255,255,0.03)] shadow-2xl z-50 transform transition-transform duration-300 ease-out overflow-hidden"
            style={{ animation: 'slideInRight 0.3s ease-out' }}
          >
            <UserContactCard
              userId={props.selectedContactUserId}
              onClose={() => {
                props.setShowContactPanel(false);
                setTimeout(() => props.setSelectedContactUserId(null), 300);
              }}
            />
          </div>
        </>
      )}

      {/* Achievement Toasts */}
      {props.showAchievements && props.messageEnhancements.newAchievements.map((achievement) => (
        <AchievementToast
          key={achievement.id}
          achievement={achievement}
          onDismiss={() => props.messageEnhancements.dismissAchievement(achievement.id)}
        />
      ))}

      {/* Message Analytics Dashboard Modal */}
      {props.showAnalyticsDashboard && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div ref={analyticsRef} role="dialog" aria-modal="true" aria-label="Message analytics dashboard" className="bg-white dark:bg-[rgba(255,255,255,0.03)] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl animate-scale-in border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
              <h2 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <TrendingUp className="text-[#f43f5e]" />
                Message Analytics Dashboard
              </h2>
              <button
                onClick={() => props.setShowAnalyticsDashboard(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--pulse-surface-raised)] text-zinc-500"
              >
                <X />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <MessageAnalyticsDashboard threads={props.threads} timeRange="week" />
            </div>
          </div>
        </div>
      )}

      {/* Network Graph Modal */}
      {props.showNetworkGraph && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div ref={networkRef} role="dialog" aria-modal="true" aria-label="Connection network" className="bg-white dark:bg-[rgba(255,255,255,0.03)] w-full max-w-3xl max-h-[80vh] rounded-2xl shadow-2xl animate-scale-in border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
              <h2 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <GitFork className="text-[#f43f5e]" />
                Connection Network
              </h2>
              <button
                onClick={() => props.setShowNetworkGraph(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--pulse-surface-raised)] text-zinc-500"
              >
                <X />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <NetworkGraph
                threads={props.threads}
                onNodeClick={(contactId) => {
                  const thread = props.threads.find(t => t.contactId === contactId);
                  if (thread) {
                    props.setActiveThreadId(thread.id);
                    props.setShowNetworkGraph(false);
                    props.setMobileView('chat');
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Context Panel Sidebar */}
      {props.showContextPanel && (props.activeThread || props.activePulseConv) && (
        <div
          className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-[rgba(255,255,255,0.03)] shadow-2xl z-40 overflow-hidden border-l border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]"
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
              <h2 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <Layers className="text-[#f43f5e]" />
                Context & Insights
              </h2>
              <button
                onClick={() => props.setShowContextPanel(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--pulse-surface-raised)] text-zinc-500"
              >
                <X />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ContextPanel
                threadId={props.activeThread?.id || props.activePulseConv?.id || ''}
                messages={props.activeThread?.messages || []}
                apiKey={props.apiKey}
                onDocClick={(doc) => { if (doc.url) window.open(doc.url, '_blank'); }}
                onDecisionClick={(decision) => { console.log('Decision clicked:', decision); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Task Extractor Panel */}
      {props.showTaskExtractor && (props.activeThread || props.activePulseConv) && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div ref={taskExtractorRef} role="dialog" aria-modal="true" aria-label="Extract tasks from conversation" className="bg-white dark:bg-[rgba(255,255,255,0.03)] w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl animate-scale-in border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
              <h2 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <ListChecks className="text-emerald-500" />
                Extract Tasks from Conversation
              </h2>
              <button
                onClick={() => props.setShowTaskExtractor(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--pulse-surface-raised)] text-zinc-500"
              >
                <X />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TaskExtractor
                workspaceId={props.activeThread?.id || props.activePulseConv?.id || ''}
                userId={props.currentUser?.id || ''}
                messages={props.activeThread?.messages || []}
                contacts={props.contacts}
                apiKey={props.apiKey}
                onTaskCreated={(task) => { console.log('Task created:', task); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Channel Artifact Panel */}
      {props.showChannelArtifactPanel && (props.activeThread || props.activePulseConv) && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div ref={artifactPanelRef} role="dialog" aria-modal="true" aria-label="Channel artifact" className="bg-white dark:bg-[rgba(255,255,255,0.03)] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl animate-scale-in border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
              <h2 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <FileOutput className="text-[#f43f5e]" />
                Export as Living Document
              </h2>
              <button
                onClick={() => props.setShowChannelArtifactPanel(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--pulse-surface-raised)] text-zinc-500"
              >
                <X />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ChannelArtifactComponent
                channelId={props.activeThread?.id || props.activePulseConv?.id || ''}
                channelName={props.activeThread?.contactName || 'Conversation'}
                messages={props.activeThread?.messages || []}
                apiKey={props.apiKey}
                onExport={(artifact, format) => { console.log('Exported:', artifact, format); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Feature Settings Panel */}
      {props.showFeatureSettings && (
        <Suspense fallback={null}>
          <FeatureSettingsPanel
            isOpen={props.showFeatureSettings}
            onClose={() => props.setShowFeatureSettings(false)}
          />
        </Suspense>
      )}

      {/* Focus Mode Overlay */}
      <Suspense fallback={null}>
        <FocusMode
          isActive={props.isFocusModeActive}
          threadId={props.activeThreadId || props.focusThreadId || 'main'}
          threadName={props.activeThread?.contactName || 'Conversation'}
          userId={props.currentUser.id}
          onClose={() => {
            props.setIsFocusModeActive(false);
            props.setFocusThreadId(null);
          }}
        />
      </Suspense>
    </>
  );
});

MessagesEndModals.displayName = 'MessagesEndModals';
