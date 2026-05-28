// SignalSection — SIGNAL · TODAY curated rows.
// Renders the top-priority emails as expandable rows. The expanded reader
// lives in InlineReader, consumed by SignalRow.
import React, { useState } from 'react';
import { Flame } from 'lucide-react';
import { AiChip } from '../primitives';
import { MOCK_EMAILS, TRIAGE_QUEUE_IDS } from '../data/mockEmails';
import { SignalRow } from './SignalRow';

interface SignalSectionProps {
  queueIds?: string[];
  clearedIds?: string[];
  onTriageOne?: (emailId: string) => void;
}

export const SignalSection: React.FC<SignalSectionProps> = ({
  queueIds = TRIAGE_QUEUE_IDS,
  clearedIds = [],
  onTriageOne,
}) => {
  const signals = MOCK_EMAILS.filter((e) => e.priority === 'high');
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="mb-9">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 pulse-rose-color" />
          <h2 className="text-sm font-semibold pulse-ink-color uppercase font-mono-pulse tracking-wide-mono">
            Signal · today
          </h2>
          <AiChip variant="muted">Claude curated</AiChip>
        </div>
        <span className="text-[11px] font-mono-pulse pulse-ink-3-color">{signals.length} ITEMS</span>
      </div>

      <div className="space-y-2">
        {signals.map((s) => {
          const idxInQueue = queueIds.indexOf(s.id);
          const cleared = clearedIds.includes(s.id);
          return (
            <SignalRow
              key={s.id}
              email={s}
              expanded={openId === s.id}
              onToggle={() => setOpenId((o) => (o === s.id ? null : s.id))}
              onTriage={onTriageOne ? () => onTriageOne(s.id) : undefined}
              queuePos={idxInQueue >= 0 && !cleared ? idxInQueue + 1 : null}
              queueTotal={queueIds.length}
              queueCleared={cleared}
            />
          );
        })}
      </div>
    </section>
  );
};

export default SignalSection;
