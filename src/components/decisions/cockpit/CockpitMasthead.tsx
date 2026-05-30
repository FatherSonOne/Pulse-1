/**
 * CockpitMasthead — top bar for the Decisions & Tasks Triage Cockpit.
 *
 * Phase 0 scaffold: title only. The ⌘K command bar, bell / activity / AI
 * actions, the `New ▾` overlay trigger, and the underline Triage|Archive
 * scene-tabs land in Phase 1 (see DECISIONS_TASKS_REDESIGN_HANDOFF_2026-05-29.md
 * §6 Phase 1).
 *
 * Coral budget (CLAUDE.md §4): this is chrome, so it uses rose / neutral
 * tokens only. `--pulse-coral*` is reserved for AI-output surfaces.
 */

interface CockpitMastheadProps {
  /** Active scene tab. Tab switching is wired in Phase 1. */
  tab?: 'triage' | 'archive';
}

export function CockpitMasthead({ tab = 'triage' }: CockpitMastheadProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 20px',
        borderBottom: '1px solid var(--dt-border)',
        background: 'var(--dt-bg-primary)',
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--dt-text-primary)',
        }}
      >
        Decisions &amp; Tasks
      </h1>
      {/* Phase 1: ⌘K bar · bell/activity/AI · New ▾ · scene-tabs */}
      <span
        aria-hidden
        style={{ fontSize: 11, color: 'var(--dt-text-muted)', textTransform: 'capitalize' }}
      >
        {tab}
      </span>
    </header>
  );
}
