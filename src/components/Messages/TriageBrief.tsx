import React, { useMemo } from 'react';
import { Plus, Clock, AtSign, Pin } from 'lucide-react';
import { AIProvenanceTag } from '../shared/AIProvenanceTag';
import type { PulseConversation } from '../../services/pulseService';

/**
 * TriageBrief — Phase B replacement for the dashed-border "Send a New Message"
 * empty-state card. When no conversation is selected, the right pane becomes
 * a triage surface: unread count in display weight, top urgent threads,
 * caught-up affordance, and a quiet `New conversation` ghost link.
 *
 * AI provenance tag (`PULSE AI · BRIEF`) is shown when the AI summary slot
 * is populated by the host. Empty until a host hooks it up — keeps the
 * component cheap and side-effect-free.
 *
 * Coral-as-signal: zero filled-coral attractors here. The "New conversation"
 * affordance is a ghost link; unread counts use the rose accent at 10% bg.
 */

export interface TriageBriefProps {
  pulseConversations: PulseConversation[];
  onOpenConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  /** Optional AI-generated summary line. When set, renders with provenance. */
  aiSummary?: string | null;
  /** Last activity timestamp across all conversations. */
  lastActivityAt?: string | null;
}

const formatRelative = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const delta = Date.now() - ts;
  const m = Math.floor(delta / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
};

export const TriageBrief: React.FC<TriageBriefProps> = ({
  pulseConversations,
  onOpenConversation,
  onNewConversation,
  aiSummary,
  lastActivityAt,
}) => {
  const { unread, urgent, total } = useMemo(() => {
    const withUnread = pulseConversations.filter(c => (c.unread_count ?? 0) > 0);
    const urgentSorted = [...withUnread]
      .sort((a, b) => {
        const av = (a.unread_count ?? 0);
        const bv = (b.unread_count ?? 0);
        if (av !== bv) return bv - av;
        const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bt - at;
      })
      .slice(0, 3);
    return {
      unread: withUnread.length,
      urgent: urgentSorted,
      total: pulseConversations.length,
    };
  }, [pulseConversations]);

  const caughtUp = unread === 0;
  const lastSeen = lastActivityAt
    ?? (pulseConversations.length > 0 ? pulseConversations[0].last_message_at : null);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-[var(--pulse-canvas)] overflow-y-auto">
      <div className="w-full max-w-md space-y-8">
        {/* Headline — display weight per DESIGN.md "Light-Display Rule" */}
        <div className="space-y-2">
          {caughtUp ? (
            <h1 className="text-[30px] leading-[1.25] tracking-[-0.025em] font-light text-zinc-900 dark:text-zinc-100">
              You're caught up.
            </h1>
          ) : (
            <h1 className="text-[30px] leading-[1.25] tracking-[-0.025em] font-light text-zinc-900 dark:text-zinc-100">
              <span className="font-medium text-[var(--pulse-rose)]">{unread}</span>
              {' '}
              {unread === 1 ? 'conversation needs you' : 'conversations need you'}.
            </h1>
          )}
          {lastSeen && (
            <p className="font-mono uppercase tracking-[0.1em] text-[10px] text-zinc-600 dark:text-zinc-400 inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3" aria-hidden="true" />
              LAST ACTIVITY · {formatRelative(lastSeen)}
            </p>
          )}
        </div>

        {/* AI Brief — provenance tag + summary. Renders only when host populates aiSummary. */}
        {aiSummary && (
          <div className="space-y-2">
            <AIProvenanceTag source="pulse-ai" kind="briefing" />

            <p className="text-[15px] leading-[1.5] text-zinc-700 dark:text-zinc-300 max-w-[65ch]">
              {aiSummary}
            </p>
          </div>
        )}

        {/* Top urgent threads — quiet rows, click to open */}
        {urgent.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-mono uppercase tracking-[0.1em] text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
              NEEDS YOU · {urgent.length}
            </h2>
            <ul className="space-y-px">
              {urgent.map(conv => {
                const name = conv.other_user?.display_name
                  || conv.other_user?.full_name
                  || conv.other_user?.handle
                  || 'Unknown';
                const preview = conv.last_message_preview || '';
                const ago = formatRelative(conv.last_message_at);
                const count = conv.unread_count ?? 0;
                return (
                  <li key={conv.id}>
                    <button
                      onClick={() => onOpenConversation(conv.id)}
                      className="w-full text-left px-3 py-2.5 rounded-md hover:bg-white dark:hover:bg-white/[0.03] transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {name}
                        </span>
                        <span className="flex-shrink-0 inline-flex items-center gap-2">
                          {count > 0 && (
                            <span className="font-mono uppercase tracking-[0.1em] text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300">
                              {count}
                            </span>
                          )}
                          {ago && (
                            <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                              {ago}
                            </span>
                          )}
                        </span>
                      </div>
                      {preview && (
                        <p className="mt-0.5 text-[12px] leading-[1.4] text-zinc-600 dark:text-zinc-400 line-clamp-1">
                          {preview}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Ghost New Conversation link */}
        <div className="pt-2">
          <button
            onClick={onNewConversation}
            className="inline-flex items-center gap-2 px-3 py-2 -ml-3 rounded-md text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="text-[13px] font-medium">New conversation</span>
            <span className="font-mono uppercase tracking-[0.1em] text-[10px] text-zinc-600 dark:text-zinc-400">⌘N</span>
          </button>
          {total > 0 && caughtUp && (
            <p className="mt-2 font-mono uppercase tracking-[0.1em] text-[10px] text-zinc-600 dark:text-zinc-400">
              {total} {total === 1 ? 'CONVERSATION' : 'CONVERSATIONS'} · ALL READ
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
