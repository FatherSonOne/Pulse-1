// EmailAiBlock — single composite AI surface that hosts up to three
// nested subsections (Summary, Meeting, Tasks) inside ONE rose-bordered
// shell. Replaces the round-6 layout where GeminiSummaryCard,
// MeetingExtractor, and ActionItemExtractor each shipped as a separate
// rose-bordered card stacked vertically inside InlineReader.
//
// Round-7 /impeccable critique flagged the prior stack as:
//   - Visual redundancy: three rose washes on one reader = decorative
//     coral, even though each is "signal" individually.
//   - Action-items duplication: GeminiSummaryCard's read-only
//     ai_action_items rendered above ActionItemExtractor's interactive
//     regex-extracted list — two AI surfaces fighting over the same job.
//   - Coral budget leak: ~14-18% of viewport on expanded SignalRow.
//
// Fix: one rose-bordered shell + hairline dividers between subsections.
// Each child mounts in `nested` mode (drops its own outer shell + body
// stripe). GeminiSummaryCard's ACTION ITEMS section auto-hides in
// nested mode so ownership belongs unambiguously to the Tasks
// subsection below it.
import React, { useEffect, useState } from 'react';
import type { CachedEmail } from '../../../../services/emailSyncService';
import type { EmailRow } from '../data/emailRow';
import { GeminiSummaryCard } from './GeminiSummaryCard';
import MeetingExtractor from '../../MeetingExtractor';
import ActionItemExtractor from '../../ActionItemExtractor';

interface ExtractedMeetingShape {
  title?: string;
  date?: Date;
  location?: string;
  attendees?: string[];
}

interface EmailAiBlockProps {
  email: EmailRow;
  /**
   * Fires when the user confirms a detected meeting via "Add to Calendar."
   * EmailAiBlock auto-dismisses the meeting subsection immediately after
   * the parent handler runs — preserves the pre-merge UX where the card
   * disappeared once the meeting was acted on.
   */
  onAddToCalendar: (meeting: ExtractedMeetingShape) => void;
  /**
   * Fires when the user confirms detected action items via "Create N tasks."
   * Should return the number of tasks actually persisted; EmailAiBlock
   * auto-dismisses the Tasks subsection only when the count is positive
   * (a failed insert keeps the section around so the user can retry).
   * Supports both sync (returns number) and async (returns Promise<number>)
   * parent handlers — the inline reader's handleCreateTasks is async.
   */
  onCreateTasks: (items: unknown[]) => Promise<number> | number;
}

const DIVIDER_STYLE: React.CSSProperties = {
  height: 1,
  background: 'color-mix(in oklab, var(--pulse-rose) 15%, transparent)',
  margin: '0 16px',
};

export const EmailAiBlock: React.FC<EmailAiBlockProps> = ({
  email,
  onAddToCalendar,
  onCreateTasks,
}) => {
  // Per-section visibility — lifted from InlineReader so each subsection
  // can still be individually dismissed without unmounting the entire
  // composite block. Reset on email change so a dismissal on one row
  // doesn't suppress the cards on the next row that lands here.
  const [showMeeting, setShowMeeting] = useState(true);
  const [showActions, setShowActions] = useState(true);
  useEffect(() => {
    setShowMeeting(true);
    setShowActions(true);
  }, [email.id]);

  const raw = email._raw;

  // If there's no AI-derived signal AND no _raw email (mock rows lack
  // it; extractors silently skip), there's nothing to show. Match
  // GeminiSummaryCard's own hasContent gate so we don't ship an empty
  // rose-bordered shell.
  const summary = email.aiSummary || raw?.ai_summary || null;
  const priority = raw?.ai_priority_score;
  const sentiment = raw?.ai_sentiment;
  const category = raw?.ai_category;
  const aiActionItems = (raw?.ai_action_items || []).filter((s) => s && s.length > 0);
  const aiSuggestedReplies = (raw?.ai_suggested_replies || []).filter((s) => s && s.length > 0);
  const hasAiContent =
    summary || priority || sentiment || category || aiActionItems.length > 0 || aiSuggestedReplies.length > 0;
  const hasRaw = Boolean(raw);
  if (!hasAiContent && !hasRaw) return null;

  return (
    <div
      className="mb-4"
      style={{
        background: 'var(--pulse-rose-soft, rgba(244,63,94,0.10))',
        border: '1px solid var(--pulse-rose-border, rgba(244,63,94,0.20))',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <GeminiSummaryCard email={email} nested />

      {showMeeting && raw && (
        <>
          <div style={DIVIDER_STYLE} aria-hidden />
          <MeetingExtractor
            email={raw as CachedEmail}
            onAddToCalendar={(meeting) => {
              onAddToCalendar(meeting);
              setShowMeeting(false);
            }}
            onDismiss={() => setShowMeeting(false)}
            nested
          />
        </>
      )}

      {showActions && raw && (
        <>
          <div style={DIVIDER_STYLE} aria-hidden />
          <ActionItemExtractor
            email={raw as CachedEmail}
            onCreateTasks={(items) => {
              const result = onCreateTasks(items);
              if (typeof result === 'number') {
                if (result > 0) setShowActions(false);
              } else {
                void result.then((created) => {
                  if (created > 0) setShowActions(false);
                });
              }
            }}
            onDismiss={() => setShowActions(false)}
            nested
          />
        </>
      )}
    </div>
  );
};

export default EmailAiBlock;
