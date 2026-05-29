// GeminiSummaryCard — bundles every AI-derived signal about an email into
// one coral card at the top of the reader. Ports the legacy "Gemini Summary"
// block from EmailViewerNew: priority + category + sentiment chips at the
// top-right, summary paragraph, action-items bullet list, optional date
// footer, and quick-reply chips at the bottom.
//
// Phase 12.12. Only renders when at least one AI field is populated;
// extractors (MeetingExtractor, ActionItemExtractor) still mount separately
// below this card because they're interactive tools, not summary readouts.
import React from 'react';
import { Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import type { EmailRow } from '../data/emailRow';
import { useEmailComposeStore } from '../../../../store/emailComposeStore';
import { AiChip } from '../primitives';

interface GeminiSummaryCardProps {
  email: EmailRow;
}

function priorityChipText(score: number | null | undefined): string | null {
  if (score == null) return null;
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MED';
  return 'LOW';
}

function sentimentChipText(sentiment: string | null | undefined): string | null {
  if (!sentiment) return null;
  const s = sentiment.toLowerCase();
  if (['urgent', 'angry', 'negative'].includes(s)) return 'NEGATIVE';
  if (['positive', 'warm', 'good'].includes(s)) return 'POSITIVE';
  return s.toUpperCase();
}

function categoryChipText(category: string | null | undefined): string | null {
  if (!category) return null;
  return category.toUpperCase().replace(/_/g, ' ');
}

export const GeminiSummaryCard: React.FC<GeminiSummaryCardProps> = ({ email }) => {
  const openReply = useEmailComposeStore((s) => s.openReply);
  const raw = email._raw;
  const summary = email.aiSummary || raw?.ai_summary || null;
  const priority = priorityChipText(raw?.ai_priority_score);
  const sentiment = sentimentChipText(raw?.ai_sentiment);
  const category = categoryChipText(raw?.ai_category);
  const actionItems = (raw?.ai_action_items || []).filter((s) => s && s.length > 0);
  const suggestedReplies = (raw?.ai_suggested_replies || []).filter((s) => s && s.length > 0).slice(0, 3);
  const meetingDate = raw?.ai_entities?.meetingDate as string | undefined;

  // Skip rendering when there's nothing AI-derived to show.
  const hasContent =
    summary || priority || sentiment || category || actionItems.length > 0 || suggestedReplies.length > 0 || meetingDate;
  if (!hasContent) return null;

  const handleQuickReply = (text: string) => {
    if (!raw) {
      toast('Mock row — quick reply is a no-op here.');
      return;
    }
    openReply(raw, text);
  };

  return (
    <div
      className="rounded-xl border pulse-rose-border mb-4"
      style={{
        background: 'var(--pulse-rose-soft, rgba(244,63,94,0.10))',
        padding: '14px 16px',
      }}
    >
      {/* Eyebrow + status chips row */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-coral-fg-color flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full pulse-rose-bg-color" />
          GEMINI · SUMMARY
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {priority && <StatusChip>{priority}</StatusChip>}
          {category && <StatusChip>{category}</StatusChip>}
          {sentiment && <StatusChip tone={sentiment}>{sentiment}</StatusChip>}
        </div>
      </div>

      {/* Summary text */}
      {summary && (
        <p className="text-[13.5px] leading-relaxed pulse-ink-color mb-3">{summary}</p>
      )}

      {/* Action items */}
      {actionItems.length > 0 && (
        <>
          <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color mt-3 mb-2 pt-2 border-t pulse-border-color">
            ACTION ITEMS
          </div>
          <ul className="space-y-1.5 mb-2">
            {actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] pulse-ink-color leading-snug">
                <span
                  aria-hidden="true"
                  className="mt-1.5 shrink-0 w-2 h-2 rounded-full border pulse-rose-border"
                  style={{ background: 'transparent' }}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Meeting date footer */}
      {meetingDate && (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] pulse-ink-2-color mt-2"
             style={{ background: 'var(--pulse-surface-raised)' }}>
          <CalendarIcon className="w-3 h-3" />
          {meetingDate}
        </div>
      )}

      {/* Quick replies */}
      {suggestedReplies.length > 0 && (
        <>
          <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color mt-3 mb-2 pt-2 border-t pulse-border-color flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            QUICK REPLIES
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestedReplies.map((reply, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleQuickReply(reply)}
                className="px-2.5 py-1 rounded-full text-[12px] pulse-ink-color border pulse-border-color hover:pulse-rose-bg-soft-color hover:pulse-rose-border transition"
                style={{ background: 'var(--pulse-surface)' }}
              >
                {reply}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

interface StatusChipProps {
  children: React.ReactNode;
  tone?: string;
}

const StatusChip: React.FC<StatusChipProps> = ({ children, tone }) => {
  // POSITIVE → green, NEGATIVE → rose, NEUTRAL/others → rose-soft.
  const isPositive = tone === 'POSITIVE';
  return (
    <AiChip variant={isPositive ? 'positive' : undefined}>{children}</AiChip>
  );
};

export default GeminiSummaryCard;
