// CockpitView — assembles the Cockpit (editorial briefing + signal + lanes + right rail + FAB).
// Phase 2: consumes live data via useCockpitData().
// Phase 3: receives triage orchestration props (onOpenTriage, onTriageOne,
// clearedIds, triageRemaining) so the briefing CTA and signal-row queue
// pips reflect the lifted triage state.
import React from 'react';
import { Loader2 } from 'lucide-react';
import { useEmailUIStore } from '../../../store/emailUIStore';
import { BriefingHeader } from './cockpit/BriefingHeader';
import { SignalSection } from './cockpit/SignalSection';
import { LaneSection } from './cockpit/LaneSection';
import { DraftedForYouRail } from './cockpit/DraftedForYouRail';
import { AwaitingRepliesRail } from './cockpit/AwaitingRepliesRail';
import { CalendarPeekRail } from './cockpit/CalendarPeekRail';
import { LanesHelpTip } from './cockpit/LanesHelpTip';
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
  const { briefingMeta, signalEmails, laneBuckets, awaitingReplies, loading, isEmpty } = useCockpitData();

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

      {loading && (
        <div className="px-10 py-20 flex flex-col items-center gap-3 pulse-ink-3-color">
          <Loader2 className="w-5 h-5 animate-spin" />
          <div className="text-[12px] font-mono-pulse tracking-wide-mono uppercase">Loading inbox…</div>
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
        // Phase 12.15 — the right rail only earns its 320px column when it
        // has real content. DraftedForYou is permanently empty (drafts={[]}),
        // CalendarPeek is mock-only, and AwaitingReplies often has 0 rows;
        // reserving the column anyway compressed Signal · Today against the
        // left edge while leaving a vast empty gutter. Render the rail only
        // when AwaitingReplies has at least one row.
        const showRail = !compact && awaitingReplies.length > 0;
        return (
          <div className={`grid gap-6 px-6 py-6 md:gap-8 md:px-10 md:py-7 ${
            showRail ? 'grid-cols-1 md:grid-cols-[1fr_320px]' : 'grid-cols-1'
          }`}>
            <div>
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
                  {MOCK_LANES.map((lane) => (
                    <LaneSection
                      key={lane.id}
                      lane={lane}
                      emails={laneBuckets[lane.id]}
                    />
                  ))}
                </div>
              </section>
            </div>

            {showRail && (
              <aside className="space-y-5 hidden md:block">
                <DraftedForYouRail drafts={[]} />
                <AwaitingRepliesRail rows={awaitingReplies} />
                <div className="editorial-rule" />
                <CalendarPeekRail />
              </aside>
            )}
          </div>
        );
      })()}

    </div>
  );
};

export default CockpitView;
