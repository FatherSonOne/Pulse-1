// ─────────────────────────────────────────────────────────────────────────────
// AI strip — the rose-tinted band that sits below the lens row and surfaces
// whichever AI proposal (route / plan / insight) or accepted-route status is
// currently relevant. Six render branches, each gated by aiState + lens +
// markerCount; falls back to `return null` when none apply.
//
// Lifted out of PulseMapView so the DEV e2e harness can mount it standalone
// and PulseMapView itself can shrink. No behaviour change — the original
// AiStripProps shape and render output are preserved verbatim.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Navigation,
  Sparkles,
  X,
} from 'lucide-react';
import type { MapHorizon, MapLens } from './mapLens';
import type { AcceptedRoute, AiState } from './aiTypes';

export interface AiStripProps {
  lens: MapLens;
  markerCount: number;
  aiState: AiState;
  acceptedRoute: AcceptedRoute | null;
  acceptingRoute: boolean;
  isDarkMode: boolean;
  /** Available stops keyed by markerKey — used by the reorder list to render
   *  human-readable labels without coupling AiStrip to MarkerData. */
  stops: Array<{ id: string; label: string }>;
  onAccept: () => void;
  onDismissRoute: () => void;
  onOpenInSystemMaps: () => void;
  onReorderStart: () => void;
  onReorderChange: (orderedIds: string[]) => void;
  onReorderCancel: () => void;
  // Direction D (Horizon, P4) — optional. Present only when mapHorizon is ON.
  /** Precise scrubber detent; reframes the route strip as "NEXT STOP" at 'now'. */
  horizon?: MapHorizon;
  /** Focus a contact/circle (AtlasProposal.focusId) on the map. */
  onFocusEntity?: (id: string) => void;
  /** Jump the scrubber toward a week-plan's focus date (WeekProposal.focusDate). */
  onJumpToDate?: (isoDate: string) => void;
}

function formatArrivalTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Short, locale-aware label for a YYYY-MM-DD focus date ("Thu, Jun 18").
function formatFocusDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export const AiStrip: React.FC<AiStripProps> = ({
  lens,
  markerCount,
  aiState,
  acceptedRoute,
  acceptingRoute,
  isDarkMode,
  stops,
  onAccept,
  onDismissRoute,
  onOpenInSystemMaps,
  onReorderStart,
  onReorderChange,
  onReorderCancel,
  horizon,
  onFocusEntity,
  onJumpToDate,
}) => {
  // Local UI state — collapsed by default. Rationale expansion is per-mount
  // (reset whenever the proposal swaps) so a fresh proposal doesn't surprise
  // the user with someone else's reasoning still open.
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  // Cell over which the dragged item is currently hovering — drives the drop
  // indicator without depending on browser-specific DragEvent.dataTransfer
  // behaviour. Null when nothing is being hovered.
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  // Ref to the reorder <ul> — keyboard moves use it to re-focus the row at
  // the new index after React commits, so consecutive ArrowDown presses
  // keep moving the SAME stop instead of whoever ends up at that position.
  const reorderListRef = useRef<HTMLUListElement>(null);

  const stripCls = `flex items-center gap-3 px-3 py-2 ${
    isDarkMode
      ? 'bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent'
      : 'bg-gradient-to-r from-rose-50 via-rose-50/40 to-transparent'
  }`;
  const wrapperBorderCls = isDarkMode ? 'border-b border-rose-500/15' : 'border-b border-rose-500/20';
  const monoStyle = { fontFamily: "'JetBrains Mono', monospace" } as const;
  // Direction D (P4): at the 'now' detent the route strip is framed as a
  // next-stop nudge rather than a full route. (Only meaningful under Horizon —
  // `horizon` is undefined on the legacy path, so this stays 'ROUTE' there.)
  const routeLabel = horizon === 'now' ? 'PULSE AI · NEXT STOP' : 'PULSE AI · ROUTE';

  // Reset the Why? expansion when the underlying proposal changes (a new
  // route arrives or we leave reorder mode). Otherwise the toggle would
  // attach to whichever rationale happens to be in scope next.
  const proposalSignature =
    aiState.status === 'ready' && aiState.data.kind === 'route'
      ? aiState.data.proposal.summary
      : '';
  useEffect(() => { setWhyExpanded(false); }, [proposalSignature]);

  // 1. Underway — accepted route in flight, takes precedence over any pending
  //    AI fetch. Two buttons: Open in Maps + Dismiss.
  if (acceptedRoute) {
    const arriving = formatArrivalTime(acceptedRoute.arrivesAt);
    return (
      <div className={`${stripCls} ${wrapperBorderCls}`} role="status" aria-live="polite">
        <Navigation size={14} className="text-rose-500 flex-shrink-0" />
        <span
          className="text-[10px] tracking-[0.1em] uppercase text-rose-500 flex-shrink-0"
          style={monoStyle}
        >
          PULSE AI · UNDERWAY
        </span>
        <span className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          {acceptedRoute.orderedMarkerKeys.length} stops · {acceptedRoute.durationMin} min · arriving {arriving}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onOpenInSystemMaps}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
          >
            Open in Maps
            <ChevronRight size={11} />
          </button>
          <button
            type="button"
            onClick={onDismissRoute}
            aria-label="Dismiss route"
            className={`p-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
              isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-rose-500/10 text-gray-500'
            }`}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  // 2. Reorder mode — drag-to-reorder OR keyboard ArrowUp/Down via per-row
  //    buttons. Drop / keyboard / button paths all route through moveStop so
  //    behaviour stays one shape. Accept replays DirectionsService against
  //    the new sequence; Cancel reverts. ────────────────────────────────────
  if (aiState.status === 'reordering') {
    const moveStop = (fromIdx: number, toIdx: number) => {
      if (fromIdx === toIdx) return;
      if (toIdx < 0 || toIdx >= aiState.orderedIds.length) return;
      const next = aiState.orderedIds.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      onReorderChange(next);
    };
    const handleDrop = (toIdx: number) => {
      if (dragFromIdx == null) {
        setDragOverIdx(null);
        return;
      }
      moveStop(dragFromIdx, toIdx);
      setDragFromIdx(null);
      setDragOverIdx(null);
    };
    // Re-focus the same row after a keyboard move so consecutive ArrowDown
    // presses continue moving the SAME stop, not the one now at that index.
    const focusRowByIdx = (listEl: HTMLUListElement | null, idx: number) => {
      if (!listEl) return;
      const rows = listEl.querySelectorAll<HTMLLIElement>('li[data-reorder-row="1"]');
      rows[idx]?.focus();
    };
    const validCount = aiState.orderedIds.filter(id => stops.some(s => s.id === id)).length;
    return (
      <div className={wrapperBorderCls}>
        <div className={stripCls} role="status" aria-live="polite">
          <ArrowUpDown size={14} className="text-rose-500 flex-shrink-0" aria-hidden="true" />
          <span
            className="text-[10px] tracking-[0.1em] uppercase text-rose-500 flex-shrink-0"
            style={monoStyle}
          >
            PULSE AI · REORDER
          </span>
          <span className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Drag or use arrow keys, then Accept.
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={onReorderCancel}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
                isDarkMode ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-rose-500/10'
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={acceptingRoute || validCount < 2}
              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {acceptingRoute ? 'Routing…' : 'Accept'}
            </button>
          </div>
        </div>
        <p id="reorder-instructions" className="sr-only">
          Use the up and down buttons or press ArrowUp / ArrowDown while a row
          is focused to reorder. Home jumps to the first stop, End to the last.
          Then press Accept to apply.
        </p>
        <ul
          className={`px-3 pb-2 pt-1 space-y-1 ${
            isDarkMode ? 'bg-rose-500/[0.04]' : 'bg-rose-50/40'
          }`}
          aria-label="Reorder stops"
          aria-describedby="reorder-instructions"
          ref={reorderListRef}
        >
          {aiState.orderedIds.map((id, idx) => {
            const stop = stops.find(s => s.id === id);
            if (!stop) return null;
            const isDragging = dragFromIdx === idx;
            const isOver = dragOverIdx === idx && dragFromIdx !== idx;
            const total = aiState.orderedIds.length;
            const atTop = idx === 0;
            const atBottom = idx === total - 1;
            const handleKey = (e: React.KeyboardEvent<HTMLLIElement>) => {
              // Ignore key events bubbling from the Up/Down buttons — they
              // handle their own click via Enter/Space natively.
              if ((e.target as HTMLElement).tagName === 'BUTTON') return;
              let target: number | null = null;
              if (e.key === 'ArrowUp' && !atTop) target = idx - 1;
              else if (e.key === 'ArrowDown' && !atBottom) target = idx + 1;
              else if (e.key === 'Home' && !atTop) target = 0;
              else if (e.key === 'End' && !atBottom) target = total - 1;
              if (target == null) return;
              e.preventDefault();
              moveStop(idx, target);
              // Defer focus to after React commits the new order.
              requestAnimationFrame(() => focusRowByIdx(reorderListRef.current, target));
            };
            return (
              <li
                key={id}
                data-reorder-row="1"
                tabIndex={0}
                role="listitem"
                aria-label={`Stop ${idx + 1} of ${total}: ${stop.label}`}
                onKeyDown={handleKey}
                draggable
                onDragStart={(e) => {
                  setDragFromIdx(idx);
                  e.dataTransfer.effectAllowed = 'move';
                  // Some browsers need a payload to initiate the drag image.
                  try { e.dataTransfer.setData('text/plain', id); } catch { /* IE-era safety */ }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverIdx(idx);
                }}
                onDragLeave={() => {
                  setDragOverIdx(prev => (prev === idx ? null : prev));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(idx);
                }}
                onDragEnd={() => {
                  setDragFromIdx(null);
                  setDragOverIdx(null);
                }}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing select-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
                  isDarkMode
                    ? 'bg-zinc-900/60 border border-white/5 hover:border-rose-500/30'
                    : 'bg-white border border-rose-100 hover:border-rose-300'
                } ${isDragging ? 'opacity-40' : ''} ${isOver ? 'ring-2 ring-rose-500/60 ring-offset-0' : ''}`}
              >
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold text-rose-500 ${
                    isDarkMode ? 'bg-rose-500/15' : 'bg-rose-100'
                  }`}
                  style={monoStyle}
                  aria-hidden="true"
                >
                  {idx + 1}
                </span>
                <span
                  className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
                  aria-hidden="true"
                >
                  {stop.label}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    moveStop(idx, idx - 1);
                    requestAnimationFrame(() => focusRowByIdx(reorderListRef.current, idx - 1));
                  }}
                  disabled={atTop}
                  aria-label={`Move ${stop.label} up`}
                  className={`p-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 disabled:opacity-30 disabled:cursor-not-allowed ${
                    isDarkMode ? 'text-gray-400 hover:bg-white/10 hover:text-rose-300' : 'text-gray-500 hover:bg-rose-500/10 hover:text-rose-600'
                  }`}
                >
                  <ChevronUp size={12} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    moveStop(idx, idx + 1);
                    requestAnimationFrame(() => focusRowByIdx(reorderListRef.current, idx + 1));
                  }}
                  disabled={atBottom}
                  aria-label={`Move ${stop.label} down`}
                  className={`p-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 disabled:opacity-30 disabled:cursor-not-allowed ${
                    isDarkMode ? 'text-gray-400 hover:bg-white/10 hover:text-rose-300' : 'text-gray-500 hover:bg-rose-500/10 hover:text-rose-600'
                  }`}
                >
                  <ChevronDown size={12} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // 3. Ready proposal.
  if (aiState.status === 'ready') {
    const data = aiState.data;
    if (data.kind === 'route') {
      const summary = data.proposal.summary;
      const rationale = data.proposal.rationale;
      const count = data.proposal.orderedIds.length;
      return (
        <div className={wrapperBorderCls}>
          <div className={stripCls} role="status" aria-live="polite">
            <Sparkles size={14} className="text-rose-500 flex-shrink-0" />
            <span className="text-[10px] tracking-[0.1em] uppercase text-rose-500 flex-shrink-0" style={monoStyle}>
              {routeLabel}
            </span>
            <span
              className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
              title={rationale ?? summary}
            >
              {summary}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {rationale && (
                <button
                  type="button"
                  onClick={() => setWhyExpanded(v => !v)}
                  aria-expanded={whyExpanded}
                  aria-controls="pulse-ai-rationale"
                  className={`inline-flex items-center gap-0.5 px-2 py-1.5 rounded text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
                    isDarkMode ? 'text-gray-400 hover:text-rose-300 hover:bg-white/5' : 'text-gray-500 hover:text-rose-600 hover:bg-rose-500/5'
                  }`}
                >
                  Why?
                  <ChevronDown
                    size={11}
                    aria-hidden="true"
                    className={`transition-transform ${whyExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
              <button
                type="button"
                onClick={onReorderStart}
                disabled={acceptingRoute || count < 2}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-rose-500/10'
                }`}
              >
                <ArrowUpDown size={11} />
                Reorder
              </button>
              <button
                type="button"
                onClick={onAccept}
                disabled={acceptingRoute || count < 2}
                className="px-2.5 py-1 rounded text-[11px] font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {acceptingRoute ? 'Routing…' : 'Accept'}
              </button>
            </div>
          </div>
          {rationale && (
            <div
              id="pulse-ai-rationale"
              aria-hidden={!whyExpanded}
              className={isDarkMode ? 'bg-rose-500/[0.04]' : 'bg-rose-50/40'}
              style={{
                display: 'grid',
                gridTemplateRows: whyExpanded ? '1fr' : '0fr',
                transition: 'grid-template-rows 220ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div style={{ overflow: 'hidden' }}>
                <p
                  className={`px-3 py-2 text-xs leading-relaxed ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}
                  style={{ maxWidth: '70ch' }}
                >
                  {rationale}
                </p>
              </div>
            </div>
          )}
        </div>
      );
    }
    if (data.kind === 'plan' || data.kind === 'insight') {
      const label = data.kind === 'plan' ? 'PULSE AI · PLAN' : 'PULSE AI · INSIGHT';
      const focusDate = data.kind === 'plan' ? data.proposal.focusDate : undefined;
      const focusId = data.kind === 'insight' ? data.proposal.focusId : undefined;
      // Direction D (P4): focusDate / focusId were returned by the model but never
      // rendered. Surface them as affordances — only when the host wired a handler
      // (mapHorizon ON). Coral here is legit (AI band, CLAUDE.md §4).
      const affordanceCls =
        'inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium flex-shrink-0 transition-colors text-rose-500 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1';
      return (
        <div className={`${stripCls} ${wrapperBorderCls}`} role="status" aria-live="polite">
          <Sparkles size={14} className="text-rose-500 flex-shrink-0" />
          <span className="text-[10px] tracking-[0.1em] uppercase text-rose-500 flex-shrink-0" style={monoStyle}>
            {label}
          </span>
          <span className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
            {data.proposal.summary}
          </span>
          {focusDate && onJumpToDate && (
            <button
              type="button"
              onClick={() => onJumpToDate(focusDate)}
              title={`Focus the plan on ${formatFocusDate(focusDate)}`}
              className={affordanceCls}
            >
              <CalendarDays size={11} aria-hidden="true" />
              {formatFocusDate(focusDate)}
            </button>
          )}
          {focusId && onFocusEntity && (
            <button
              type="button"
              onClick={() => onFocusEntity(focusId)}
              title="Focus this on the map"
              className={affordanceCls}
            >
              <Crosshair size={11} aria-hidden="true" />
              Focus
            </button>
          )}
        </div>
      );
    }
  }

  // 4. Fetching placeholder — only for TODAY with >=2 stops, where a route
  //    proposal is genuinely imminent. Other lenses fail silent.
  if (aiState.status === 'fetching' && lens === 'today' && markerCount >= 2) {
    return (
      <div className={`${stripCls} ${wrapperBorderCls}`} role="status" aria-live="polite">
        <Sparkles size={14} className={`flex-shrink-0 ${isDarkMode ? 'text-rose-500/70' : 'text-rose-500/80'}`} />
        <span className="text-[10px] tracking-[0.1em] uppercase text-rose-500/70 flex-shrink-0" style={monoStyle}>
          PULSE AI · ROUTE
        </span>
        <span className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {markerCount} stops on the map.
        </span>
      </div>
    );
  }

  // 5. Paused — workspace hit the AI cap. Tell the truth, don't bark.
  if (aiState.status === 'paused' && lens === 'today' && markerCount >= 2) {
    return (
      <div className={`${stripCls} ${wrapperBorderCls}`} role="status" aria-live="polite">
        <Sparkles size={14} className="text-rose-500/60 flex-shrink-0" />
        <span className="text-[10px] tracking-[0.1em] uppercase text-rose-500/60 flex-shrink-0" style={monoStyle}>
          PULSE AI · PAUSED
        </span>
        <span className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Route proposals on a short break. Resuming after the workspace cap clears.
        </span>
      </div>
    );
  }

  // 6. Today + 1 stop — declare it honestly even when AI returned none.
  if (lens === 'today' && markerCount === 1) {
    return (
      <div className={`${stripCls} ${wrapperBorderCls}`} role="status" aria-live="polite">
        <Sparkles size={14} className="text-rose-500/70 flex-shrink-0" />
        <span className="text-[10px] tracking-[0.1em] uppercase text-rose-500/70 flex-shrink-0" style={monoStyle}>
          {routeLabel}
        </span>
        <span className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {horizon === 'now' ? 'Just one stop coming up.' : 'No route today, just one stop.'}
        </span>
      </div>
    );
  }

  // Everything else — hide.
  return null;
};
