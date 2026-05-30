// SearchWorkbench — flag-ON entry for the Search "Workbench" redesign.
//
// Phase 0 scaffold: renders a placeholder only. The real orchestrator (3-col
// shell wiring useUnifiedSearch into FacetCockpit / ResultsTable /
// WorkingSetDock / WorkingMemory) lands in Phase 2+.
//
// Spec: docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md
import './search-workbench.css';

interface SearchWorkbenchProps {
  isDarkMode?: boolean;
}

export default function SearchWorkbench(_props: SearchWorkbenchProps = {}) {
  return (
    <div className="search-workbench-placeholder" role="status">
      Search Workbench — coming soon (scaffold).
    </div>
  );
}
