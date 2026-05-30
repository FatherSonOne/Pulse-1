/**
 * CockpitHub — orchestrator for the Decisions & Tasks "Triage Cockpit"
 * redesign (flag: `decisionsTriageCockpit`, default OFF).
 *
 * Phase 1: masthead (⌘K bar, bell/activity/AI, New ▾, scene-tabs) + ⌘K
 * command palette + tab state driving a placeholder body. Subsequent phases
 * (see DECISIONS_TASKS_REDESIGN_HANDOFF_2026-05-29.md §6) port the data layer
 * + realtime from DecisionTaskHub, then layer in the triage queue rail, focal
 * detail panes, property filters, archive tab, and the New overlay. The legacy
 * DecisionTaskHub stays the default until Phase 12 flips this flag.
 *
 * Props match DecisionTaskHub so App.tsx can swap the two on the flag.
 */
import { useCallback, useEffect, useState } from 'react';
import { User } from '../../../types';
import { CockpitMasthead, type CockpitTab } from './CockpitMasthead';
import { CommandBar } from './CommandBar';
import '../design-tokens.css';
import './cockpit.css';

interface CockpitHubProps {
  user: User | null;
}

export function CockpitHub({ user: _user }: CockpitHubProps) {
  const [tab, setTab] = useState<CockpitTab>('triage');
  const [commandOpen, setCommandOpen] = useState(false);

  const closeCommand = useCallback(() => setCommandOpen(false), []);

  // Global ⌘K / Ctrl+K toggles the command palette; Escape closes it.
  // The palette itself also handles Escape locally for when focus is inside it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCommandOpen((open) => !open);
        return;
      }
      if (e.key === 'Escape' && commandOpen) {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandOpen]);

  return (
    <div className="ck-root">
      <CockpitMasthead
        tab={tab}
        setTab={setTab}
        onOpenCommand={() => setCommandOpen(true)}
      />

      {/* Phase 2+ : Triage queue rail + focal pane / Archive timeline mount here. */}
      <div className="ck-body">
        {tab === 'triage' ? 'Triage cockpit — queue + focal (Phase 3+)' : 'Archive — timeline + retrospective (Phase 9)'}
      </div>

      <CommandBar open={commandOpen} onClose={closeCommand} />
    </div>
  );
}

export default CockpitHub;
