// ============================================
// CopilotRail — Col 3 of the hybrid People view (handoff §4.7).
// A NEW PRESENTATION of EXISTING todayFeedService output — a global agenda
// (D2): Suggested items (which already fold in relationship alerts via
// generateTodayFeed) + their drafted openers + a neutral Route hint.
//
// INVARIANT 3 — NO new AI calls. We call generateTodayFeed (AI-free: it fetches
// Supabase items + relationshipAlertService alerts) + the same AI-free autopilot
// injection TodayView does, and use the TEMPLATE aiDraftMessage as the opener.
// We deliberately do NOT call enrichFeedItemsWithAIDrafts (that is the only
// askAI() model call) so the rail adds ZERO model invocations. AI-upgraded
// drafts remain a Today-tab behavior.
//
// Selecting a rail item syncs the focus pane (D2). Slack callout is Phase 8.
// See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md §4.7 + invariant 3.
// ============================================

import React, { useEffect, useState } from 'react';
import { Sparkles, ChevronRight, MapPin } from 'lucide-react';
import { Contact } from '../../../../types';
import { TodayFeedItem, TodayFeedSuggestedAction } from '../../../../types/todayFeedTypes';
import { generateTodayFeed, buildAutopilotFeedItems } from '../../../../services/todayFeedService';
import { getUpcomingActions } from '../../../../services/contactGoalService';

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
  selectedContactId: string | null;
  onSelectContact: (contactId: string) => void;
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
}

export const CopilotRail: React.FC<CopilotRailProps> = ({
  userId,
  contacts,
  selectedContactId,
  onSelectContact,
  onAction,
}) => {
  const [items, setItems] = useState<TodayFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

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
        if (!cancelled) setItems(allItems.filter((i) => i.status === 'active'));
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

  return (
    <div className="flex flex-col h-full">
      <div
        className="text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500 mb-3"
        style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
      >
        Pulse AI
      </div>

      <div className="flex-1 overflow-y-auto -mr-1 pr-1 space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-20 rounded-xl animate-pulse"
                style={{ background: 'var(--pulse-surface-raised)' }}
              />
            ))}
          </div>
        ) : top.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            You're all caught up — no suggestions right now.
          </p>
        ) : (
          <div>
            {/* Suggested — one of the two at-rest coral regions (invariant 2) */}
            <div
              className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-[0.1em]"
              style={{ color: 'var(--pulse-coral-fg)', fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
            >
              <Sparkles className="w-3 h-3" />
              Suggested · {top.length}
            </div>

            <div className="space-y-2">
              {top.map((item) => {
                const selected = selectedContactId === item.contactId;
                const actLabel = ACTION_LABEL[item.suggestedAction] ?? 'Open';
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      selected
                        ? 'border-[var(--pulse-rose-soft)]'
                        : 'border-[var(--pulse-border)] hover:bg-[var(--pulse-surface-raised)]'
                    }`}
                    style={{ background: selected ? 'var(--pulse-rose-soft)' : 'var(--pulse-surface)' }}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectContact(item.contactId)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
                          {item.title}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                        {item.contactName}
                        {item.subtitle ? ` · ${item.subtitle}` : ''}
                      </p>
                      {item.aiDraftMessage && (
                        <p
                          className="text-xs mt-2 line-clamp-2 italic"
                          style={{ color: 'var(--pulse-coral-fg)' }}
                        >
                          "{item.aiDraftMessage}"
                        </p>
                      )}
                    </button>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAction(mapToContactAction(item.suggestedAction), item.contactId)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-white"
                        style={{ background: 'var(--pulse-rose)' }}
                      >
                        {actLabel}
                      </button>
                    </div>
                  </div>
                );
              })}
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
