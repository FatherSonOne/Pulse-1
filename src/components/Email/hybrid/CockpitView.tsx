// CockpitView — assembles the Cockpit (editorial briefing + signal + lanes + right rail + FAB).
// Phase 2: consumes live data via useCockpitData(). Empty + loading states
// added; mock data only used as briefing fallback when meta hasn't loaded.
import React from 'react';
import { Loader2 } from 'lucide-react';
import { useEmailUIStore } from '../../../store/emailUIStore';
import { BriefingHeader } from './cockpit/BriefingHeader';
import { SignalSection } from './cockpit/SignalSection';
import { LaneSection } from './cockpit/LaneSection';
import { DraftedForYouRail } from './cockpit/DraftedForYouRail';
import { AwaitingRepliesRail } from './cockpit/AwaitingRepliesRail';
import { CalendarPeekRail } from './cockpit/CalendarPeekRail';
import { ComposeFab } from './cockpit/ComposeFab';
import { MOCK_LANES } from './data/mockEmails';
import { useCockpitData } from './data/useCockpitData';

interface CockpitViewProps {
  density?: 'normal' | 'compact';
  onOpenTriage?: () => void;
  onTriageOne?: (emailId: string) => void;
  onCompose?: () => void;
  showCompose?: boolean;
  clearedIds?: string[];
}

export const CockpitView: React.FC<CockpitViewProps> = ({
  density = 'normal',
  onOpenTriage,
  onTriageOne,
  onCompose,
  showCompose = true,
  clearedIds = [],
}) => {
  const compact = density === 'compact';
  const nudgeFocused = useEmailUIStore((s) => s.nudgeFocused);
  const { briefingMeta, signalEmails, laneBuckets, awaitingReplies, loading, isEmpty } = useCockpitData();

  return (
    <div className="h-full w-full overflow-y-auto relative">
      <BriefingHeader
        compact={compact}
        meta={briefingMeta}
        triageQueueSize={signalEmails.length}
        onStartTriage={onOpenTriage}
        nudgeFocused={nudgeFocused}
      />

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

      {!loading && !isEmpty && (
        <div className={`grid ${compact ? 'grid-cols-1 gap-6 px-6 py-6' : 'grid-cols-[1fr_320px] gap-8 px-10 py-7'}`}>
          <div>
            <SignalSection
              signals={signalEmails}
              clearedIds={clearedIds}
              onTriageOne={onTriageOne}
            />

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold pulse-ink-color uppercase font-mono-pulse tracking-wide-mono">Lanes</h2>
                <span className="text-[11px] font-mono-pulse pulse-ink-3-color">AUTO-SORTED</span>
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

          {!compact && (
            <aside className="space-y-5">
              {/* Drafted-for-you wires to AI in v1.1; renders nothing today. */}
              <DraftedForYouRail drafts={[]} />
              <AwaitingRepliesRail rows={awaitingReplies} />
              {awaitingReplies.length > 0 && <div className="editorial-rule" />}
              <CalendarPeekRail />
            </aside>
          )}
        </div>
      )}

      {showCompose && <ComposeFab onClick={onCompose} />}
    </div>
  );
};

export default CockpitView;
