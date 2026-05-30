/**
 * SearchDevToggle — floating v1 ⇄ v2 switch for the Search surface, so the new
 * Workbench can be eyeballed against the legacy UnifiedSearchRedesign while
 * it's built out, without hand-editing `?ff_searchWorkbench`.
 *
 * Dev build only — App.tsx gates the render behind `import.meta.env.DEV`, so
 * real users never see it. Flipping persists to the `ff_` localStorage key the
 * dev override reads, then re-renders App in place (no reload, no lost view).
 *
 * Mirrors CockpitDevToggle (Decisions surface). Removed at Phase 11 cleanup
 * alongside the legacy search component and the flag.
 *
 * Styles live in search-workbench.css; imported here so the toggle is styled
 * even when the legacy search (v1) is mounted and SearchWorkbench hasn't pulled
 * the sheet in.
 */
import './search-workbench.css';

interface SearchDevToggleProps {
  enabled: boolean;
  onToggle: (next: boolean) => void;
}

export function SearchDevToggle({ enabled, onToggle }: SearchDevToggleProps) {
  return (
    <div className="sw-devtoggle" role="group" aria-label="Search surface version (dev)">
      <span className="sw-devtoggle-label">Search</span>
      <button
        type="button"
        className="sw-devtoggle-btn"
        data-on={!enabled}
        aria-pressed={!enabled}
        onClick={() => onToggle(false)}
      >
        v1
      </button>
      <button
        type="button"
        className="sw-devtoggle-btn"
        data-on={enabled}
        aria-pressed={enabled}
        onClick={() => onToggle(true)}
      >
        v2
      </button>
    </div>
  );
}

export default SearchDevToggle;
