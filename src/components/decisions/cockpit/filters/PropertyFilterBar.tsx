/**
 * PropertyFilterBar — PostHog-style composable filter pills over the shared
 * FilterState plus two cockpit-local view dimensions (kind + assignee). Each
 * active filter is a removable pill; "+ Filter" adds one; SavedViews presets
 * apply known combinations. Drives the queue via CockpitHub's filtered sets.
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { FilterState } from '../../FilterBar';
import type { Place } from '../../../../types/placeTypes';
import { SavedViews, type SavedViewPreset } from './SavedViews';

export type ViewKind = 'all' | 'tasks' | 'decisions';
export type ViewAssignee = 'all' | 'me';

interface PropertyFilterBarProps {
  presets: SavedViewPreset[];
  savedView: string;
  onSelectPreset: (id: string) => void;
  filters: FilterState;
  setFilters: (next: FilterState) => void;
  viewKind: ViewKind;
  setViewKind: (k: ViewKind) => void;
  viewAssignee: ViewAssignee;
  setViewAssignee: (a: ViewAssignee) => void;
  availablePlaces: Place[];
  onClearAll: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review',
  blocked: 'Blocked', done: 'Done', cancelled: 'Cancelled',
};

export function PropertyFilterBar({
  presets, savedView, onSelectPreset,
  filters, setFilters, viewKind, setViewKind, viewAssignee, setViewAssignee,
  availablePlaces, onClearAll,
}: PropertyFilterBarProps) {
  const [addOpen, setAddOpen] = useState(false);

  const patch = (next: Partial<FilterState>) => setFilters({ ...filters, ...next });
  const placeName = filters.placeId
    ? availablePlaces.find((p) => p.id === filters.placeId)?.name ?? 'Place'
    : 'No place';

  const anyActive =
    viewAssignee !== 'all' || viewKind !== 'all' || filters.status !== 'all' ||
    !!filters.priority || filters.placeId !== undefined || !!filters.search;

  return (
    <div className="ck-filterbar">
      <SavedViews presets={presets} activeId={savedView} onSelect={onSelectPreset} />
      <span className="ck-filter-divider" />

      {viewAssignee === 'me' && (
        <Pill k="Assignee" v="You" onClear={() => setViewAssignee('all')} />
      )}
      {viewKind !== 'all' && (
        <Pill k="Kind" v={viewKind === 'tasks' ? 'Tasks' : 'Decisions'} onClear={() => setViewKind('all')} />
      )}
      {filters.status !== 'all' && (
        <Pill k="Status" v={STATUS_LABELS[filters.status] ?? filters.status} scope="tasks" onClear={() => patch({ status: 'all' })} />
      )}
      {filters.priority && (
        <Pill k="Priority" v={filters.priority} scope="tasks" onClear={() => patch({ priority: undefined })} />
      )}
      {filters.placeId !== undefined && (
        <Pill k="Place" v={placeName} scope="tasks" onClear={() => patch({ placeId: undefined })} />
      )}
      {filters.search && (
        <Pill k="Search" v={filters.search} onClear={() => patch({ search: '' })} />
      )}

      {/* + Filter */}
      <div className="ck-sv">
        <button type="button" className="ck-pill ck-pill-add" onClick={() => setAddOpen((o) => !o)} aria-haspopup="menu" aria-expanded={addOpen}>
          <Plus size={12} /> Filter
        </button>
        {addOpen && (
          <>
            <div className="ck-menu-backdrop" onClick={() => setAddOpen(false)} aria-hidden />
            <div className="ck-menu ck-menu-wide" role="menu">
              <div className="ck-menu-label">Status</div>
              {(['todo', 'in_progress', 'in_review', 'blocked', 'done'] as FilterState['status'][]).map((s) => (
                <button key={s} className="ck-menu-item" onClick={() => { patch({ status: s }); setAddOpen(false); }}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
              <div className="ck-menu-label">Priority</div>
              {(['high', 'medium', 'low'] as const).map((p) => (
                <button key={p} className="ck-menu-item" onClick={() => { patch({ priority: p }); setAddOpen(false); }}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
              <div className="ck-menu-label">View</div>
              <button className="ck-menu-item" onClick={() => { setViewAssignee('me'); setAddOpen(false); }}>Assigned to me</button>
              <button className="ck-menu-item" onClick={() => { setViewKind('tasks'); setAddOpen(false); }}>Tasks only</button>
              <button className="ck-menu-item" onClick={() => { setViewKind('decisions'); setAddOpen(false); }}>Decisions only</button>
            </div>
          </>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {anyActive && (
        <button type="button" className="ck-pill ck-pill-add" onClick={onClearAll}>Clear</button>
      )}
      {/* Sort pill hidden until real sorting is wired (launch-readiness 0.5). */}
    </div>
  );
}

function Pill({ k, v, onClear, scope }: { k: string; v: string; onClear: () => void; scope?: string }) {
  return (
    <span className="ck-pill">
      <span className="ck-pill-key">{k}</span>
      <strong>{v}</strong>
      {/* `scope` is an honesty marker: Status/Priority/Place are task-only
          attributes (decisions have no such fields), so the chip is labelled
          "· tasks" to make clear it doesn't narrow decisions (launch-readiness 1.1). */}
      {scope && <span className="ck-pill-scope" style={{ opacity: 0.6, marginLeft: 4 }}>· {scope}</span>}
      <button type="button" className="ck-pill-x" onClick={onClear} aria-label={`Clear ${k} filter`}>
        <X size={11} />
      </button>
    </span>
  );
}
