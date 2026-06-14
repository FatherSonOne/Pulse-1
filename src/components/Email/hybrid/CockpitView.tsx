// CockpitView — assembles the Cockpit (editorial briefing + signal + lanes + right rail + FAB).
// Phase 2: consumes live data via useCockpitData().
// Phase 3: receives triage orchestration props (onOpenTriage, onTriageOne,
// clearedIds, triageRemaining) so the briefing CTA and signal-row queue
// pips reflect the lifted triage state.
import React from 'react';
import { useEmailUIStore } from '../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../store/emailComposeStore';
import { BriefingHeader } from './cockpit/BriefingHeader';
import { SignalSection } from './cockpit/SignalSection';
import { LaneSection } from './cockpit/LaneSection';
import { DraftedForYouRail } from './cockpit/DraftedForYouRail';
import { AwaitingRepliesRail } from './cockpit/AwaitingRepliesRail';
import type { AwaitingReplyRow } from './data/useCockpitData';
import { CalendarPeekRail } from './cockpit/CalendarPeekRail';
import { LanesHelpTip } from './cockpit/LanesHelpTip';
import { CategoryOverflowHint } from './cockpit/CategoryOverflowHint';
import { ActiveFiltersStrip } from './chrome/ActiveFiltersStrip';
import { MOCK_LANES, TRIAGE_QUEUE_IDS } from './data/mockEmails';
import { useCockpitData } from './data/useCockpitData';

interface CockpitViewProps {
  density?: 'normal' | 'compact';
  /** Called by the briefing CTA or a per-row TRIAGE chip. */
  onOpenTriage?: () => void;
  onTriageOne?: (emailId: string) => void;
  /** IDs already dispatched in the current triage session (CLEARED pip). */
  clearedIds?: string[];
  /** Items left in the triage queue — shown next to the "Start triage" CTA. */
  triageRemaining?: number;
  /** Subset of queueIds yet to be triaged (for the signal-row queue pip). */
  upcomingQueueIds?: string[];
}

export const CockpitView: React.FC<CockpitViewProps> = ({
  density = 'normal',
  onOpenTriage,
  onTriageOne,
  clearedIds = [],
  triageRemaining,
  upcomingQueueIds = TRIAGE_QUEUE_IDS,
}) => {
  const compact = density === 'compact';
  const nudgeFocused = useEmailUIStore((s) => s.nudgeFocused);
  const openFollowUp = useEmailComposeStore((s) => s.openFollowUp);
  const { briefingMeta, signalEmails, laneBuckets, awaitingReplies, loading, isEmpty } = useCockpitData();

  // Follow-up compose for an awaiting-reply row (folded in from FollowUpNudge,
  // WI-8). The row carries its own sent email — resolving it from emailStore
  // would fail, that store only holds the current folder (inbox) on the
  // Cockpit, never the sent emails these rows are built from.
  const handleFollowUp = (row: AwaitingReplyRow) => {
    const email = row.email;
    if (!email) return;
    const recipient = email.to_emails?.[0];
    const to = typeof recipient === 'string' ? recipient : recipient?.email;
    if (!to) return;
    const subject = email.subject?.startsWith('Re:')
      ? email.subject
      : `Re: ${email.subject || '(no subject)'}`;
    openFollowUp(to, subject, email);
  };

  return (
    <div className="h-full w-full overflow-y-auto relative">
      <BriefingHeader
        compact={compact}
        meta={briefingMeta}
        triageQueueSize={triageRemaining ?? signalEmails.length}
        onStartTriage={onOpenTriage}
        nudgeFocused={nudgeFocused}
      />

      <ActiveFiltersStrip />

      <CategoryOverflowHint />

      {loading && (
        <div className="px-6 py-6 md:px-10 md:py-7 space-y-2" aria-busy="true" aria-label="Loading inbox">
          {/* Skeleton in the real signal-row geometry — the briefing header is
              already painted, so the layout is predictable. A skeleton reads
              "almost there" and avoids the centered-spinner → list jump. */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="border pulse-border-color rounded-[14px] fade-up"
              style={{ animationDelay: `${i * 45}ms`, animationFillMode: 'both' }}
            >
              <div className="flex items-start gap-4 px-4 py-3.5 animate-pulse">
                <div className="rounded-full pulse-surface-raised shrink-0" style={{ width: 36, height: 36 }} />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-1/3 rounded pulse-surface-raised" />
                  <div className="h-4 w-3/4 rounded pulse-surface-raised" />
                  <div className="h-3 w-2/3 rounded pulse-surface-raised" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && isEmpty && (
        <div className="px-10 py-20 text-center">
          <div className="cockpit-headline text-[20px] pulse-ink-color mb-2">Nothing to read.</div>
          <div className="text-[13px] pulse-ink-2-color max-w-md mx-auto">
            Your inbox is empty — either the cache hasn't synced yet, or you really are caught up.
            Trigger a sync from the top bar to refresh.
          </div>
        </div>
      )}

      {!loading && !isEmpty && (() => {
        // Signal + Lanes always span the full canvas width. The former right
        // rail (AwaitingReplies + CalendarPeek) is relocated below Lanes as a
        // two-column secondary strip so nothing is lost but the primary
        // editorial column gets the page it's designed for. DraftedForYou is
        // currently always empty (drafts={[]}) so it's omitted here; restore
        // it alongside the strip when the v1.1 AI-draft prop is wired.
        const showFooterStrip = !compact && awaitingReplies.length > 0;
        return (
          <div className="px-6 py-6 md:px-10 md:py-7 space-y-8">
            <SignalSection
              signals={signalEmails}
              queueIds={upcomingQueueIds}
              clearedIds={clearedIds}
              onTriageOne={onTriageOne}
            />

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold pulse-ink-color uppercase font-mono-pulse tracking-wide-mono">Lanes</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono-pulse pulse-ink-3-color">AUTO-SORTED</span>
                  <LanesHelpTip />
                </div>
              </div>
              <div className="space-y-3">
                {MOCK_LANES.map((lane, i) => (
                  <div
                    key={lane.id}
                    className="fade-up"
                    style={{ animationDelay: `${120 + i * 45}ms`, animationFillMode: 'both' }}
                  >
                    <LaneSection
                      lane={lane}
                      emails={laneBuckets[lane.id]}
                    />
                  </div>
                ))}
              </div>
            </section>

            {showFooterStrip && (
              <>
                <div className="editorial-rule" />
                <div className="grid gap-6 md:gap-8 md:grid-cols-2">
                  <DraftedForYouRail drafts={[]} />
                  <AwaitingRepliesRail rows={awaitingReplies} onFollowUp={handleFollowUp} />
                  <CalendarPeekRail />
                </div>
              </>
            )}
          </div>
        );
      })()}

    </div>
  );
};

export default CockpitView;
