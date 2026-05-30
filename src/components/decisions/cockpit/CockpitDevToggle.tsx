/**
 * CockpitDevToggle — floating v1 ⇄ v2 switch for the Decisions & Tasks
 * surface, so the new Triage Cockpit can be eyeballed against the legacy hub
 * while it's built out, without hand-editing `?ff_decisionsTriageCockpit`.
 *
 * Dev build only — App.tsx gates the render behind `import.meta.env.DEV`, so
 * real users never see it. Flipping persists to the `ff_` localStorage key the
 * dev override reads, then re-renders App in place (no reload, no lost view).
 *
 * Styles live in cockpit.css; imported here so the toggle is styled even when
 * the legacy hub (v1) is mounted and CockpitHub hasn't pulled the sheet in.
 */
import './cockpit.css';

interface CockpitDevToggleProps {
  enabled: boolean;
  onToggle: (next: boolean) => void;
}

export function CockpitDevToggle({ enabled, onToggle }: CockpitDevToggleProps) {
  return (
    <div className="ck-devtoggle" role="group" aria-label="Decisions surface version (dev)">
      <span className="ck-devtoggle-label">Decisions</span>
      <button
        type="button"
        className="ck-devtoggle-btn"
        data-on={!enabled}
        aria-pressed={!enabled}
        onClick={() => onToggle(false)}
      >
        v1
      </button>
      <button
        type="button"
        className="ck-devtoggle-btn"
        data-on={enabled}
        aria-pressed={enabled}
        onClick={() => onToggle(true)}
      >
        v2
      </button>
    </div>
  );
}

export default CockpitDevToggle;
