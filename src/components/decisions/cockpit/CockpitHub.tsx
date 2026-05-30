/**
 * CockpitHub — orchestrator for the Decisions & Tasks "Triage Cockpit"
 * redesign (flag: `decisionsTriageCockpit`, default OFF).
 *
 * Phase 0 scaffold: renders the masthead over an empty body. Subsequent
 * phases (see DECISIONS_TASKS_REDESIGN_HANDOFF_2026-05-29.md §6) port the
 * data layer + realtime from DecisionTaskHub, then layer in the triage
 * queue rail, focal detail panes, property filters, archive tab, and the
 * unified New overlay. The legacy DecisionTaskHub stays the default until
 * Phase 12 flips this flag.
 *
 * Props match DecisionTaskHub so App.tsx can swap the two on the flag.
 */
import { User } from '../../../types';
import { CockpitMasthead } from './CockpitMasthead';
import '../design-tokens.css';

interface CockpitHubProps {
  user: User | null;
}

export function CockpitHub({ user: _user }: CockpitHubProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--dt-bg-primary)',
        color: 'var(--dt-text-primary)',
      }}
    >
      <CockpitMasthead tab="triage" />
      {/* Phase 2+ : queue rail + focal pane body mounts here. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          color: 'var(--dt-text-muted)',
        }}
      >
        Triage cockpit — scaffold
      </div>
    </div>
  );
}

export default CockpitHub;
