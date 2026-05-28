// CockpitView — assembles the Cockpit (editorial briefing + signal + lanes + right rail + FAB).
// Phase 1: mock data via the MOCK_* exports in data/mockEmails.
// Phase 2: swap to useCockpitData() for live emails + briefing heuristics.
import React from 'react';
import { BriefingHeader } from './cockpit/BriefingHeader';
import { SignalSection } from './cockpit/SignalSection';
import { LaneSection } from './cockpit/LaneSection';
import { DraftedForYouRail } from './cockpit/DraftedForYouRail';
import { AwaitingRepliesRail } from './cockpit/AwaitingRepliesRail';
import { CalendarPeekRail } from './cockpit/CalendarPeekRail';
import { ComposeFab } from './cockpit/ComposeFab';
import { MOCK_LANES, TRIAGE_QUEUE_IDS } from './data/mockEmails';

interface CockpitViewProps {
  density?: 'normal' | 'compact';
  onOpenTriage?: () => void;
  onTriageOne?: (emailId: string) => void;
  onCompose?: () => void;
  triageQueueSize?: number;
  showCompose?: boolean;
  clearedIds?: string[];
}

export const CockpitView: React.FC<CockpitViewProps> = ({
  density = 'normal',
  onOpenTriage,
  onTriageOne,
  onCompose,
  triageQueueSize = TRIAGE_QUEUE_IDS.length,
  showCompose = true,
  clearedIds = [],
}) => {
  const compact = density === 'compact';

  return (
    <div className="h-full w-full overflow-y-auto relative">
      <BriefingHeader
        compact={compact}
        triageQueueSize={triageQueueSize}
        onStartTriage={onOpenTriage}
      />

      <div className={`grid ${compact ? 'grid-cols-1 gap-6 px-6 py-6' : 'grid-cols-[1fr_320px] gap-8 px-10 py-7'}`}>
        <div>
          <SignalSection
            queueIds={TRIAGE_QUEUE_IDS}
            clearedIds={clearedIds}
            onTriageOne={onTriageOne}
          />

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold pulse-ink-color uppercase font-mono-pulse tracking-wide-mono">Lanes</h2>
              <span className="text-[11px] font-mono-pulse pulse-ink-3-color">AUTO-SORTED</span>
            </div>
            <div className="space-y-3">
              {MOCK_LANES.map((lane) => <LaneSection key={lane.id} lane={lane} />)}
            </div>
          </section>
        </div>

        {!compact && (
          <aside className="space-y-5">
            <DraftedForYouRail />
            <div className="editorial-rule" />
            <AwaitingRepliesRail />
            <div className="editorial-rule" />
            <CalendarPeekRail />
          </aside>
        )}
      </div>

      {showCompose && <ComposeFab onClick={onCompose} />}
    </div>
  );
};

export default CockpitView;
