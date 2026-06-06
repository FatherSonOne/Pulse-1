// ============================================
// CopilotRail — Col 3 of the hybrid People view (handoff §4.7).
// A NEW PRESENTATION of EXISTING todayFeedService output — a global agenda
// (D2): a focused "Suggested 1/N" card (cycle through the top items) with the
// contact's drafted opener (editable + copyable) and the adaptive ChannelRow,
// plus a neutral Route hint.
//
// INVARIANT 3 — NO new AI calls. We call generateTodayFeed (AI-free: Supabase
// items + relationshipAlertService alerts) + the same AI-free autopilot
// injection TodayView does, and use the TEMPLATE aiDraftMessage as the opener.
// We deliberately do NOT call enrichFeedItemsWithAIDrafts (the only askAI()
// model call) so the rail adds ZERO model invocations.
//
// Selecting an item syncs the focus pane (D2). Slack callout is Phase 8.
// See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md §4.7 + invariant 3.
// ============================================

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Sparkles, ChevronLeft, ChevronRight, MapPin, Copy } from 'lucide-react';
import { Contact } from '../../../../types';
import { TodayFeedItem, TodayFeedSuggestedAction } from '../../../../types/todayFeedTypes';
import { generateTodayFeed, buildAutopilotFeedItems } from '../../../../services/todayFeedService';
import { getUpcomingActions } from '../../../../services/contactGoalService';
import { ChannelRow } from '../channels/ChannelRow';

const RAIL_LIMIT = 5;

// Same mapping TodayView uses (message/call/email/review → messages).
function mapToContactAction(action: TodayFeedSuggestedAction): 'message' | 'vox' | 'meet' {
  if (action === 'vox') return 'vox';
  if (action === 'meeting') return 'meet';
  return 'message';
}

const ACTION_LABEL: Record<string, string> = {
  message: 'Message',
  vox: 'Vox',
  meeting: 'Meet',
  call: 'Call',
  email: 'Email',
  review: 'Review',
};

interface CopilotRailProps {
  userId?: string;
  contacts: Contact[];
  emailEnabled: boolean;
  onSelectContact: (contactId: string) => void;
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
}

export const CopilotRail: React.FC<CopilotRailProps> = ({
  userId,
  contacts,
  emailEnabled,
  onSelectContact,
  onAction,
}) => {
  const [items, setItems] = useState<TodayFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // AI-free: generateTodayFeed (Supabase items + relationship alerts).
        const feedItems = await generateTodayFeed(userId);
        let allItems = feedItems;
        // AI-free autopilot injection (mirrors TodayView.loadFeed).
        if (contacts.length > 0) {
          try {
            const dueGoals = await getUpcomingActions(userId);
            const existingSourceGoalIds = new Set(
              feedItems
                .map((i) => i.metadata?.sourceGoalId as string | undefined)
                .filter((x): x is string => !!x),
            );
            const autopilotItems = buildAutopilotFeedItems(dueGoals, contacts, existingSourceGoalIds);
            if (autopilotItems.length > 0) {
              allItems = [...autopilotItems, ...feedItems].sort((a, b) => a.priority - b.priority);
            }
          } catch {
            /* goals unavailable — proceed without autopilot items */
          }
        }
        // NOTE: deliberately NO enrichFeedItemsWithAIDrafts — zero added AI calls.
        if (!cancelled) {
          setItems(allItems.filter((i) => i.status === 'active'));
          setCursor(0);
        }
      } catch (err) {
        if (!cancelled) console.warn('[CopilotRail] feed load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, contacts]);

  const top = items.slice(0, RAIL_LIMIT);
  const safeCursor = Math.min(cursor, Math.max(0, top.length - 1));
  const current = top[safeCursor];

  // Reset the editable opener whenever the focused suggestion changes.
  useEffect(() => {
    setDraft(current?.aiDraftMessage ?? '');
  }, [current?.id]);

  const currentContact = current ? contacts.find((c) => c.id === current.contactId) : undefined;

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success('Opener copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <div
          className="text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500"
          style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
        >
          Pulse AI
        </div>
        <div className="text-xs text-zinc-400 dark:text-zinc-500">your relationship co-pilot</div>
      </div>

      <div className="flex-1 overflow-y-auto -mr-1 pr-1">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="h-28 rounded-xl animate-pulse"
                style={{ background: 'var(--pulse-surface-raised)' }}
              />
            ))}
          </div>
        ) : !current ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            You're all caught up — no suggestions right now.
          </p>
        ) : (
          /* Suggested — the single at-rest coral region in the rail (invariant 2) */
          <div
            className="rounded-2xl border p-3.5"
            style={{ background: 'var(--pulse-coral-bg-08)', borderColor: 'var(--pulse-rose-soft)' }}
          >
            {/* header: SUGGESTED · i of N + pager */}
            <div className="flex items-center justify-between mb-2">
              <span
                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em]"
                style={{ color: 'var(--pulse-coral-fg)', fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
              >
                <Sparkles className="w-3 h-3" />
                Suggested · {safeCursor + 1} of {top.length}
              </span>
              {top.length > 1 && (
                <span className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Previous suggestion"
                    disabled={safeCursor === 0}
                    onClick={() => setCursor((c) => Math.max(0, c - 1))}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next suggestion"
                    disabled={safeCursor >= top.length - 1}
                    onClick={() => setCursor((c) => Math.min(top.length - 1, c + 1))}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </span>
              )}
            </div>

            {/* suggestion line */}
            <button type="button" onClick={() => onSelectContact(current.contactId)} className="w-full text-left">
              <p className="text-sm font-medium leading-snug text-zinc-800 dark:text-zinc-100">
                {current.title}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {current.contactName}
                {current.subtitle ? ` · ${current.subtitle}` : ''}
              </p>
            </button>

            {/* drafted opener — editable + copyable */}
            {current.aiDraftMessage && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[9px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500"
                    style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
                  >
                    Drafted opener · editable
                  </span>
                  <button
                    type="button"
                    onClick={copyDraft}
                    className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-rose-500 transition-colors"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  className="w-full text-xs rounded-lg p-2 resize-none outline-none border bg-transparent text-zinc-600 dark:text-zinc-300 focus:ring-1 focus:ring-rose-400"
                  style={{ borderColor: 'var(--pulse-border)' }}
                />
              </div>
            )}

            {/* adaptive channel row (or a single action when the contact isn't loaded) */}
            <div className="mt-3">
              {currentContact ? (
                <ChannelRow
                  contact={currentContact}
                  emailEnabled={emailEnabled}
                  onAction={onAction}
                  onNote={() => onSelectContact(current.contactId)}
                  compact
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onAction(mapToContactAction(current.suggestedAction), current.contactId)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-white"
                  style={{ background: 'var(--pulse-rose)' }}
                >
                  {ACTION_LABEL[current.suggestedAction] ?? 'Open'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Route hint — neutral system hint, NOT coral (D7). Full Route empty-state in Phase 6. */}
      <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--pulse-border)' }}>
        <div className="flex items-start gap-2 text-xs text-zinc-400 dark:text-zinc-500">
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Set locations on contacts to group your day by area (Route view).</span>
        </div>
        {/* Slack callout (inbound Slack tied to a contact) arrives with Phase 8 identity. */}
      </div>
    </div>
  );
};

export default CopilotRail;
