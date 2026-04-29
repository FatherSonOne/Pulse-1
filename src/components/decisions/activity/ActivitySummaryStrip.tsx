// "This week" rollup that sits at the top of the Active view. Shows a
// single sentence summary with click-through to the workspace activity
// panel.
//
// Phase 2 of Decisions and Tasks overhaul.

import React, { useEffect, useState } from 'react';
import { decisionActivityService } from '../../../services/decisionActivityService';
import './ActivityDrawer.css';

interface ActivitySummaryStripProps {
  workspaceId: string;
  onOpenWorkspaceActivity: () => void;
}

export const ActivitySummaryStrip: React.FC<ActivitySummaryStripProps> = ({
  workspaceId,
  onOpenWorkspaceActivity,
}) => {
  const [rollup, setRollup] = useState<{
    tasksCompleted: number;
    decisionsMade: number;
    overdueCount: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    decisionActivityService.getThisWeekRollup(workspaceId).then((data) => {
      if (!cancelled) setRollup(data);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (!rollup) return null;

  const { tasksCompleted, decisionsMade, overdueCount } = rollup;
  const nothingHappened = tasksCompleted === 0 && decisionsMade === 0 && overdueCount === 0;
  if (nothingHappened) return null;

  // Build a single sentence.
  const parts: string[] = [];
  if (tasksCompleted > 0) {
    parts.push(`${tasksCompleted} task${tasksCompleted === 1 ? '' : 's'} completed`);
  }
  if (decisionsMade > 0) {
    parts.push(`${decisionsMade} decision${decisionsMade === 1 ? '' : 's'} made`);
  }
  if (overdueCount > 0) {
    parts.push(`${overdueCount} overdue`);
  }
  const sentence = parts.join(' · '); // separator

  return (
    <button
      type="button"
      className="da-summary-strip"
      onClick={onOpenWorkspaceActivity}
      aria-label="Open workspace activity"
    >
      <span className="dt-label da-summary-eyebrow">This week</span>
      <span className="da-summary-text">{sentence}</span>
      <span className="da-summary-cta dt-label">View activity</span>
    </button>
  );
};
