/**
 * MessagesSplitViewWithProviders
 *
 * Phase 5e — production entry for the new architecture.
 *
 * Composes everything Phases 5b-5d shipped:
 *   - `MessagesSplitView` rendering
 *   - Plugin slots wired to their canonical implementations
 *   - `messageStore` connected for channels + Pulse conversations
 *   - Branched send/load handlers (DM vs channel)
 *
 * Mounted only when the `pulse_messages_v2` feature flag is on. The
 * legacy `Messages.tsx` continues to be the default until the flag is
 * flipped.
 *
 * Wiring map:
 *
 *   <MessagesModalsProvider>
 *     <MessagesFeaturePanelsProvider>
 *       (FocusModeProvider already provided by MessagesWithProviders)
 *
 *       <MessagesSplitView
 *         channels={store.channels}
 *         pulseConversations={store.pulseConversations}
 *         messages={store.messages}
 *         onSendMessage={branchedSend}
 *         onLoadMessages={branchedLoad}
 *
 *         renderTopBanner   → MessagesBannersPlugin + (5d.5) AI cards
 *         renderModals      → MessagesModalsPlugin
 *         renderGlobalOverlay → MessagesFocusModePlugin
 *         renderRightDrawer → MessagesFeaturePanelHost
 *         renderMessageInput → minimal voice-enabled chat input
 *       />
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { useMessagesStore } from '../../store/messageStore';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { pulseService } from '../../services/pulseService';
import {
  messagePersonalService,
  type MessageBookmark,
  type MessageTemplate,
} from '../../services/messagePersonalService';
import MessagesSplitView from './MessagesSplitView';
import {
  MessagesModalsProvider,
  MessagesModalsPlugin,
  useMessagesModals,
} from './MessagesModalsPlugin';
import {
  MessagesFeaturePanelsProvider,
  MessagesFeaturePanelHost,
} from './MessagesFeaturePanelsPlugin';
import { MessagesFocusModePlugin } from './MessagesFocusModePlugin';
import { MessagesBannersPlugin } from './MessagesBannersPlugin';
import { useMessagesVoiceComposer } from './MessagesVoiceComposerPlugin';
import type { Contact } from '../../types';

// Direct imports of the specific sub-components we render in panels.
// We can't use the `Bundle*` records under React.lazy because they
// type as a single LazyExoticComponent, not a namespace — TS rightly
// rejects `<Bundle.SubName />` access. Importing the specific files
// is small (each subcomponent is its own file) and tree-shakes
// correctly. If a panel ever needs many sub-components, switch to
// per-bundle React.lazy of that specific component.
import { MessageBookmarks as MessageBookmarksPanel } from '../MessageEnhancements/MessageBookmarks';
import { SmartTemplates as SmartTemplatesPanel } from '../MessageEnhancements/SmartTemplates';

interface MessagesSplitViewWithProvidersProps {
  /** Authenticated user — used for sender attribution + send handlers. */
  currentUser?: { id: string; name: string; email: string };
  /** Optional contact list — only consulted by the banners plugin to
   *  surface the right "Invite to Pulse" target when viewing a
   *  non-Pulse contact. */
  contacts?: Contact[];
}

/**
 * Outer component — applies the providers, then mounts the inner
 * connected component. Keeps the consumer-facing API tiny.
 */
export const MessagesSplitViewWithProviders: React.FC<MessagesSplitViewWithProvidersProps> = (
  props,
) => {
  return (
    <MessagesModalsProvider>
      <MessagesFeaturePanelsProvider>
        <MessagesSplitViewConnected {...props} />
      </MessagesFeaturePanelsProvider>
    </MessagesModalsProvider>
  );
};

/**
 * Inner connected component — reads store, branches handlers, wires
 * plugin slots. Lives below the providers so it can call the
 * `useMessagesModals()` hook for opening modals from inside the
 * input/banners chain.
 */
const MessagesSplitViewConnected: React.FC<MessagesSplitViewWithProvidersProps> = ({
  currentUser,
  contacts = [],
}) => {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const userId = currentUser?.id ?? '';

  // ── Store reads ────────────────────────────────────────────
  const channels = useMessagesStore((s) => s.channels);
  const pulseConversations = useMessagesStore((s) => s.pulseConversations);
  const messages = useMessagesStore((s) => s.messages);
  const draft = useMessagesStore((s) => s.draft);
  const setDraft = useMessagesStore((s) => s.setDraft);

  const loadChannels = useMessagesStore((s) => s.loadChannels);
  const loadPulseConversations = useMessagesStore((s) => s.loadPulseConversations);
  const loadMessages = useMessagesStore((s) => s.loadMessages);
  const loadPulseMessages = useMessagesStore((s) => s.loadPulseMessages);

  // ── Initial loads ──────────────────────────────────────────
  useEffect(() => {
    if (workspaceId) void loadChannels(workspaceId);
    void loadPulseConversations();
  }, [workspaceId, loadChannels, loadPulseConversations]);

  // ── Branched send/load handlers ────────────────────────────

  /** Decide if a conversation id is a Pulse DM or a channel. The two
   *  ID spaces don't collide (different table primary keys), but we
   *  check Pulse first because the conversations array is typically
   *  smaller. */
  const isPulseConversation = useCallback(
    (id: string) => pulseConversations.some((c) => c.id === id),
    [pulseConversations],
  );

  const handleLoadMessages = useCallback(
    async (conversationId: string) => {
      if (isPulseConversation(conversationId)) {
        await loadPulseMessages(conversationId);
      } else {
        await loadMessages(conversationId);
      }
    },
    [isPulseConversation, loadPulseMessages, loadMessages],
  );

  const handleSendMessage = useCallback(
    async (conversationId: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !userId) return;

      if (isPulseConversation(conversationId)) {
        const conv = pulseConversations.find((c) => c.id === conversationId);
        const recipientId = conv?.other_user?.id;
        if (!recipientId) return;
        try {
          await pulseService.sendMessage(recipientId, trimmed);
          // Refresh the message list for this conversation.
          await loadPulseMessages(conversationId);
        } catch (err) {
          console.error('[MessagesSplitViewWithProviders] DM send failed:', err);
        }
      } else {
        // Channel path — go through the store action which handles
        // optimistic updates + retries internally.
        useMessagesStore.getState().selectChannel(conversationId);
        await useMessagesStore.getState().sendMessage(trimmed);
      }
      setDraft('');
    },
    [isPulseConversation, pulseConversations, loadPulseMessages, setDraft, userId],
  );

  // ── Active conversation tracking (for input/banners plugins) ──
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const activePulseConv = useMemo(
    () => (activeConversationId ? pulseConversations.find((c) => c.id === activeConversationId) : null),
    [activeConversationId, pulseConversations],
  );
  const activeContact = useMemo<Contact | null>(() => {
    if (!activePulseConv?.other_user) return null;
    const id = activePulseConv.other_user.id;
    return contacts.find((c) => c.id === id || c.pulseUserId === id) ?? null;
  }, [activePulseConv, contacts]);

  // ── Sub-views ──────────────────────────────────────────────
  return (
    <MessagesSplitView
      channels={channels}
      pulseConversations={pulseConversations}
      messages={messages}
      currentUserId={userId}
      onSendMessage={(conversationId, content) => {
        setActiveConversationId(conversationId);
        void handleSendMessage(conversationId, content);
      }}
      onLoadMessages={async (conversationId) => {
        setActiveConversationId(conversationId);
        await handleLoadMessages(conversationId);
      }}
      renderTopBanner={() => (
        <BannersHost activeContact={activeContact} />
      )}
      renderGlobalOverlay={() => (
        <MessagesFocusModePlugin userId={userId} />
      )}
      renderRightDrawer={() => <FeaturePanelsHost />}
      renderModals={() => (
        <ModalsHost
          activePulseConversationId={
            activePulseConv ? activePulseConv.id : null
          }
          activePulseRecipientId={activePulseConv?.other_user?.id ?? null}
        />
      )}
      renderMessageInput={() => (
        <ChatInput
          draft={draft}
          setDraft={setDraft}
          onSend={() => {
            if (activeConversationId) {
              void handleSendMessage(activeConversationId, draft);
            }
          }}
          onSendVoice={async (blob, durationSec) => {
            if (!activeConversationId || !activePulseConv?.other_user) return;
            // Voice messages: convert Blob → File and use the
            // existing pulseService voice path (upload to
            // pulse-attachments bucket, then send_pulse_message with
            // content_type='voice'). Channel voice messages aren't
            // wired here — workspace channels rarely use voice and
            // the Voxer surface owns that flow.
            try {
              const recipientId = activePulseConv.other_user.id;
              const file = new File([blob], `voice-${Date.now()}.webm`, {
                type: blob.type || 'audio/webm',
              });
              await pulseService.sendMessageWithAttachment(
                recipientId,
                file,
                `Voice message (${Math.max(1, Math.round(durationSec))}s)`,
              );
              // Refresh the message list so the new voice row appears.
              await loadPulseMessages(activeConversationId);
            } catch (err) {
              console.error('[MessagesSplitViewWithProviders] voice send failed:', err);
            }
          }}
        />
      )}
    />
  );
};

// ──────────────────────────────────────────────────────────────
// Banners host — needs the modal context to wire "Invite to Pulse"
// ──────────────────────────────────────────────────────────────

const BannersHost: React.FC<{ activeContact: Contact | null }> = ({ activeContact }) => {
  const { openInviteToPulse } = useMessagesModals();
  // Heuristic: a Pulse-DM conversation is fully Pulse-native, so banners
  // don't fire there. The legacy SMS-mode banners only matter when the
  // contact is non-Pulse, which the migration to MessagesSplitView (DM-
  // first) deprioritizes. Surface them only when there's a contact and
  // they have no Pulse user link.
  const isViewOnlyMode = !!activeContact && !activeContact.pulseUserId;
  const isNonPulseThread = false; // SMS path retired in v2 entry
  return (
    <MessagesBannersPlugin
      isViewOnlyMode={isViewOnlyMode}
      isNonPulseThread={isNonPulseThread}
      canSendNativeSms={false}
      activeContact={activeContact}
      onInviteContact={openInviteToPulse}
    />
  );
};

// ──────────────────────────────────────────────────────────────
// Modals host — owns the wiring of plugin → service callbacks.
// Reads the active Pulse conversation from props (passed by parent)
// rather than guessing, so forwarding correctly excludes the active
// conversation from the target list and scheduling targets the right
// recipient.
// ──────────────────────────────────────────────────────────────

interface ModalsHostProps {
  activePulseConversationId: string | null;
  activePulseRecipientId: string | null;
}

const ModalsHost: React.FC<ModalsHostProps> = ({
  activePulseConversationId,
  activePulseRecipientId,
}) => {
  const pulseConversations = useMessagesStore((s) => s.pulseConversations);
  const draft = useMessagesStore((s) => s.draft);

  // Real list of pending scheduled messages — pulled from pulse_scheduled_messages
  // via pulseService. Refreshed when a new schedule succeeds.
  const [scheduledMessages, setScheduledMessages] = useState<
    Array<{ id: string; text: string; scheduledFor: Date }>
  >([]);
  const refreshScheduled = useCallback(async () => {
    try {
      const rows = await pulseService.getScheduledMessages();
      setScheduledMessages(
        rows.map((r) => ({
          id: r.id,
          text: r.content,
          scheduledFor: new Date(r.scheduled_for),
        })),
      );
    } catch (err) {
      console.error('[MessagesSplitViewWithProviders] load scheduled messages failed:', err);
    }
  }, []);
  useEffect(() => {
    void refreshScheduled();
  }, [refreshScheduled]);

  return (
    <MessagesModalsPlugin
      pulseConversations={pulseConversations}
      activePulseConversationId={activePulseConversationId}
      inputText={draft}
      scheduledMessages={scheduledMessages}
      onSchedule={async (text, scheduledFor) => {
        // Schedule against the currently-active DM. If none, surface
        // the constraint as an error so the modal can react.
        if (!activePulseRecipientId) {
          throw new Error('Open a Pulse DM to schedule a message');
        }
        await pulseService.scheduleMessage(activePulseRecipientId, text, scheduledFor);
        await refreshScheduled();
      }}
      onForwardPulseMessage={async (messageId, targetRecipientId) => {
        await pulseService.forwardMessage(messageId, targetRecipientId);
      }}
      inviteToPulseState={{ isSent: false, isCopied: false }}
      onInviteSendEmail={() => {}}
      onInviteCopyLink={() => {}}
      onInviteSendSms={() => {}}
      onInviteDone={() => {}}
    />
  );
};

// ──────────────────────────────────────────────────────────────
// Minimal chat input — text + voice + send
// ──────────────────────────────────────────────────────────────

interface ChatInputProps {
  draft: string;
  setDraft: (value: string) => void;
  onSend: () => void;
  onSendVoice: (blob: Blob, durationSec: number) => Promise<void> | void;
}

const ChatInput: React.FC<ChatInputProps> = ({ draft, setDraft, onSend, onSendVoice }) => {
  const voice = useMessagesVoiceComposer({
    onRecordingComplete: async (blob, sec) => {
      await onSendVoice(blob, sec);
    },
  });

  return (
    <div className="flex flex-col gap-2 p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      {voice.isRecording && <voice.RecordingBanner />}
      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (draft.trim()) onSend();
            }
          }}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 resize-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
        />
        <voice.RecordButton size="md" />
        <button
          type="button"
          onClick={() => draft.trim() && onSend()}
          disabled={!draft.trim() || voice.isRecording}
          className="w-10 h-10 rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center flex-shrink-0"
          aria-label="Send message"
          title="Send (Enter)"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Feature panels host — wires the right-drawer slot to specific
// panel content from the lazy enhancement bundles.
//
// Currently wired (Phase 5e+2):
//   - intelligence/bookmarks → BundleIntelligence.MessageBookmarks
//     (backed by messagePersonalService — Session 4 schema)
//   - productivity/templates → BundleProductivity.SmartTemplates
//     (backed by messagePersonalService — Session 4 schema)
//
// Deferred (graceful empty-state in MessagesFeaturePanelHost):
//   - intelligence: insights, reactions, tags, delivery
//   - productivity: schedule, summary, export, shortcuts, notifications
//   - analytics, collaboration, proactive, communication, automation,
//     security, multimedia (entire panels)
//
// To wire a deferred panel: add a key to the `panels` map below with
// a render fn. Each panel's render fn receives `{ activeTab, setTab,
// close }` from the host and is responsible for picking the correct
// sub-component based on `activeTab`. See the two wired examples for
// the canonical pattern.
// ──────────────────────────────────────────────────────────────

const FeaturePanelsHost: React.FC = () => {
  // ── Bookmarks state (intelligence/bookmarks tab) ────────────
  const [bookmarks, setBookmarks] = useState<
    Array<{
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
    }>
  >([]);
  const refreshBookmarks = useCallback(async () => {
    try {
      const rows = await messagePersonalService.listBookmarks();
      setBookmarks(rows.map(adaptBookmarkRow));
    } catch (err) {
      console.error('[FeaturePanelsHost] load bookmarks failed:', err);
    }
  }, []);
  useEffect(() => {
    void refreshBookmarks();
  }, [refreshBookmarks]);

  // ── Templates state (productivity/templates tab) ────────────
  const [templates, setTemplates] = useState<
    Array<{
      id: string;
      name: string;
      category: 'greeting' | 'follow-up' | 'meeting' | 'feedback' | 'closing' | 'custom';
      content: string;
      variables: string[];
      usageCount: number;
      lastUsed?: string;
      createdBy: string;
      tags: string[];
    }>
  >([]);
  const refreshTemplates = useCallback(async () => {
    try {
      const rows = await messagePersonalService.listTemplates();
      setTemplates(rows.map(adaptTemplateRow));
    } catch (err) {
      console.error('[FeaturePanelsHost] load templates failed:', err);
    }
  }, []);
  useEffect(() => {
    void refreshTemplates();
  }, [refreshTemplates]);

  // Active conversation context for "insert template into draft" — pulled
  // from the store so the action targets the live composer.
  const setDraft = useMessagesStore((s) => s.setDraft);
  const draft = useMessagesStore((s) => s.draft);

  return (
    <MessagesFeaturePanelHost
      panels={{
        intelligence: ({ activeTab, setTab, close }) => (
          <IntelligencePanelContent
            activeTab={activeTab}
            setTab={setTab}
            close={close}
            bookmarks={bookmarks}
            onBookmarkDelete={async (id) => {
              const prev = bookmarks;
              setBookmarks((b) => b.filter((x) => x.id !== id));
              try {
                await messagePersonalService.removeBookmark(id);
              } catch (err) {
                console.error('[FeaturePanelsHost] delete bookmark failed:', err);
                setBookmarks(prev);
              }
            }}
            onBookmarkUpdate={async (b) => {
              const prev = bookmarks;
              setBookmarks((list) => list.map((x) => (x.id === b.id ? b : x)));
              try {
                await messagePersonalService.updateBookmark(b.id, {
                  collection: b.collection ?? null,
                  note: b.note ?? null,
                  tags: b.tags,
                });
              } catch (err) {
                console.error('[FeaturePanelsHost] update bookmark failed:', err);
                setBookmarks(prev);
              }
            }}
          />
        ),
        productivity: ({ activeTab, setTab, close }) => (
          <ProductivityPanelContent
            activeTab={activeTab}
            setTab={setTab}
            close={close}
            templates={templates}
            draft={draft}
            onInsertTemplate={(content) => {
              setDraft(`${draft}${draft ? ' ' : ''}${content}`);
              close();
            }}
            onSaveTemplate={async (t) => {
              try {
                const row = await messagePersonalService.addTemplate({
                  name: t.name,
                  body: t.content,
                  category: t.category,
                  variables: t.variables ?? [],
                  tags: t.tags ?? [],
                });
                setTemplates((list) => [...list, adaptTemplateRow(row)]);
              } catch (err) {
                console.error('[FeaturePanelsHost] save template failed:', err);
              }
            }}
            onDeleteTemplate={async (id) => {
              const prev = templates;
              setTemplates((list) => list.filter((x) => x.id !== id));
              try {
                await messagePersonalService.removeTemplate(id);
              } catch (err) {
                console.error('[FeaturePanelsHost] delete template failed:', err);
                setTemplates(prev);
              }
            }}
          />
        ),
      }}
    />
  );
};

// ── Panel sub-components — render the right Bundle component for each tab ──

interface IntelligencePanelProps {
  activeTab: string;
  setTab: (t: string) => void;
  close: () => void;
  bookmarks: Array<{
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
  }>;
  onBookmarkDelete: (id: string) => void | Promise<void>;
  onBookmarkUpdate: (b: IntelligencePanelProps['bookmarks'][number]) => void | Promise<void>;
}

const INTELLIGENCE_TABS: Array<{ key: string; label: string }> = [
  { key: 'bookmarks', label: 'Bookmarks' },
  { key: 'insights', label: 'Insights' },
  { key: 'reactions', label: 'Reactions' },
  { key: 'tags', label: 'Tags' },
  { key: 'delivery', label: 'Delivery' },
];

const IntelligencePanelContent: React.FC<IntelligencePanelProps> = ({
  activeTab,
  setTab,
  bookmarks,
  onBookmarkDelete,
  onBookmarkUpdate,
}) => (
  <div>
    <PanelTabs tabs={INTELLIGENCE_TABS} activeTab={activeTab} setTab={setTab} />
    <div className="p-3">
      {activeTab === 'bookmarks' && (
        <MessageBookmarksPanel
          bookmarks={bookmarks}
          onBookmarkDelete={onBookmarkDelete}
          onBookmarkUpdate={onBookmarkUpdate}
        />
      )}
      {activeTab !== 'bookmarks' && (
        <PanelDeferred tab={activeTab} hint="Wire this tab to the matching BundleIntelligence sub-component." />
      )}
    </div>
  </div>
);

interface ProductivityPanelProps {
  activeTab: string;
  setTab: (t: string) => void;
  close: () => void;
  templates: Array<{
    id: string;
    name: string;
    category: 'greeting' | 'follow-up' | 'meeting' | 'feedback' | 'closing' | 'custom';
    content: string;
    variables: string[];
    usageCount: number;
    lastUsed?: string;
    createdBy: string;
    tags: string[];
  }>;
  draft: string;
  onInsertTemplate: (content: string) => void;
  onSaveTemplate: (t: Omit<ProductivityPanelProps['templates'][number], 'id' | 'usageCount' | 'lastUsed'>) => void | Promise<void>;
  onDeleteTemplate: (id: string) => void | Promise<void>;
}

const PRODUCTIVITY_TABS: Array<{ key: string; label: string }> = [
  { key: 'templates', label: 'Templates' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'summary', label: 'Summary' },
  { key: 'export', label: 'Export' },
];

const ProductivityPanelContent: React.FC<ProductivityPanelProps> = ({
  activeTab,
  setTab,
  templates,
  onInsertTemplate,
  onSaveTemplate,
  onDeleteTemplate,
}) => (
  <div>
    <PanelTabs tabs={PRODUCTIVITY_TABS} activeTab={activeTab} setTab={setTab} />
    <div className="p-3">
      {activeTab === 'templates' && (
        <SmartTemplatesPanel
          templates={templates}
          onInsertTemplate={onInsertTemplate}
          onSaveTemplate={onSaveTemplate}
          onDeleteTemplate={onDeleteTemplate}
        />
      )}
      {activeTab !== 'templates' && (
        <PanelDeferred tab={activeTab} hint="Wire this tab to the matching BundleProductivity sub-component." />
      )}
    </div>
  </div>
);

// ── Shared panel UI atoms ──

const PanelTabs: React.FC<{
  tabs: Array<{ key: string; label: string }>;
  activeTab: string;
  setTab: (t: string) => void;
}> = ({ tabs, activeTab, setTab }) => (
  <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-2 overflow-x-auto">
    {tabs.map((t) => (
      <button
        key={t.key}
        type="button"
        onClick={() => setTab(t.key)}
        className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition ${
          activeTab === t.key
            ? 'border-rose-500 text-rose-600 dark:text-rose-400'
            : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
        }`}
      >
        {t.label}
      </button>
    ))}
  </div>
);

const PanelDeferred: React.FC<{ tab: string; hint: string }> = ({ tab, hint }) => (
  <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
    <p>The <strong>{tab}</strong> tab isn't wired yet.</p>
    <p className="text-xs mt-1 opacity-70">{hint}</p>
  </div>
);

// ── Adapters: DB row shape → Bundle component shape ──

function adaptBookmarkRow(r: MessageBookmark) {
  return {
    id: r.id,
    messageId: r.message_id,
    conversationId: '', // not stored in row; consumer fills via context if needed
    messagePreview: '',
    sender: '',
    timestamp: new Date(r.created_at),
    createdAt: new Date(r.created_at),
    note: r.note ?? undefined,
    collection: r.collection ?? undefined,
    tags: r.tags ?? [],
  };
}

function adaptTemplateRow(r: MessageTemplate) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    content: r.body,
    variables: r.variables ?? [],
    usageCount: r.usage_count,
    lastUsed: r.last_used_at ?? undefined,
    createdBy: r.user_id,
    tags: r.tags ?? [],
  };
}

export default MessagesSplitViewWithProviders;
