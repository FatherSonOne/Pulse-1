// FacetCockpit — left rail of the Workbench.
//
// Content-type checkboxes (live counts) · Date facet (NEW) · AI ranking (the
// ONLY coral surface in the whole redesign — CLAUDE.md §4) · from:/after:/
// before: operators · Saved searches (alert bell + delete-Undo toast).
//
// Behavior is ported verbatim from the legacy sidebar; the content-type
// affordance changes from buttons to checkboxes and the Date facet is new.
// Per legacy parity, facet changes take effect on the next search (the
// auto-search effect keys on the query) — not instantly.
//
// Spec: docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md §4.5
import {
  Bell, X, Sparkles, Command,
  Mail, MessageSquare, CheckSquare, Users, Mic, StickyNote, Calendar, Phone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { savedSearchesService } from '../../services/savedSearches';
import type { SearchResultType, SearchFilters } from '../../services/unifiedSearchService';
import type { UseUnifiedSearch } from './useUnifiedSearch';

interface FacetCockpitProps {
  s: UseUnifiedSearch;
}

// Content-type facets (folds duplicate/unused types — handoff §4.5).
const FACET_TYPES: { type: SearchResultType; label: string; Icon: React.ElementType }[] = [
  { type: 'message', label: 'Messages', Icon: MessageSquare },
  { type: 'email',   label: 'Email',    Icon: Mail },
  { type: 'vox',     label: 'Vox',      Icon: Mic },
  { type: 'note',    label: 'Notes',    Icon: StickyNote },
  { type: 'task',    label: 'Tasks',    Icon: CheckSquare },
  { type: 'event',   label: 'Events',   Icon: Calendar },
  { type: 'contact', label: 'People',   Icon: Users },
  { type: 'sms',     label: 'SMS',      Icon: Phone },
];

// ── Date facet helpers ──────────────────────────────────────────────────────
type DatePreset = 'today' | 'week' | 'month' | 'custom' | null;

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function presetRange(preset: Exclude<DatePreset, 'custom' | null>): { from: Date; to: Date } {
  const today = startOfToday();
  const to = new Date();
  if (preset === 'today') return { from: today, to };
  if (preset === 'week')  return { from: new Date(today.getTime() - 7 * 86_400_000), to };
  return { from: new Date(today.getTime() - 30 * 86_400_000), to }; // month
}
// Derive the active preset purely from filters so the facet always reflects the
// real range (incl. ranges set by a loaded saved search). R7: stay in sync.
function activePreset(filters: SearchFilters): DatePreset {
  if (!filters.dateFrom) return null;
  const fromDay = new Date(filters.dateFrom);
  const fromMs = new Date(fromDay.getFullYear(), fromDay.getMonth(), fromDay.getDate()).getTime();
  const today = startOfToday().getTime();
  if (fromMs === today) return 'today';
  if (fromMs === today - 7 * 86_400_000) return 'week';
  if (fromMs === today - 30 * 86_400_000) return 'month';
  return 'custom';
}
function toInputValue(d?: Date): string {
  if (!d) return '';
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return z.toISOString().slice(0, 10);
}

export default function FacetCockpit({ s }: FacetCockpitProps) {
  const hasResults = s.searchResults.length > 0;
  const datePreset = activePreset(s.filters);

  const setDatePreset = (preset: Exclude<DatePreset, 'custom' | null>) => {
    if (datePreset === preset) {
      // toggle off
      s.setFilters(f => { const { dateFrom, dateTo, ...rest } = f; return rest; });
      return;
    }
    const { from, to } = presetRange(preset);
    s.setFilters(f => ({ ...f, dateFrom: from, dateTo: to }));
  };

  return (
    <div className="sw-facet-cockpit">

      {/* ── Content type ─────────────────────────────────────────────────── */}
      <section className="sw-facet-group">
        <header className="sw-facet-head">
          <h3>Content type</h3>
          {s.selectedTypes.size > 0 && (
            <button type="button" className="sw-facet-clear" onClick={() => s.setSelectedTypes(new Set())}>
              Clear
            </button>
          )}
        </header>
        <ul className="sw-facet-checklist">
          {FACET_TYPES.map(({ type, label, Icon }) => {
            const count = s.facetCounts.get(type) || 0;
            const checked = s.selectedTypes.has(type);
            // Hide zero-count facets only when a query is active (keep all
            // discoverable in the empty state) — legacy rule, preserved.
            if (hasResults && count === 0 && !checked) return null;
            return (
              <li key={type}>
                <label className={`sw-facet-check ${checked ? 'is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => s.toggleTypeFilter(type)}
                  />
                  <Icon size={13} className="sw-facet-check-icon" aria-hidden="true" />
                  <span className="sw-facet-check-label">{label}</span>
                  {hasResults && count > 0 && <span className="sw-facet-count">{count}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Date ─────────────────────────────────────────────────────────── */}
      <section className="sw-facet-group">
        <header className="sw-facet-head"><h3>Date</h3></header>
        <div className="sw-facet-chips">
          {([['today', 'Today'], ['week', 'This week'], ['month', 'This month']] as const).map(([key, label]) => (
            <button key={key} type="button"
              className={`sw-facet-chip ${datePreset === key ? 'is-on' : ''}`}
              onClick={() => setDatePreset(key)}
              aria-pressed={datePreset === key ? 'true' : 'false'}>
              {label}
            </button>
          ))}
        </div>
        <div className="sw-facet-daterange">
          <input
            type="date" className="sw-facet-date-input" aria-label="From date"
            value={toInputValue(s.filters.dateFrom)}
            onChange={e => {
              const v = e.target.value ? new Date(e.target.value) : undefined;
              s.setFilters(f => ({ ...f, dateFrom: v }));
            }}
          />
          <span className="sw-facet-date-sep">→</span>
          <input
            type="date" className="sw-facet-date-input" aria-label="To date"
            value={toInputValue(s.filters.dateTo)}
            onChange={e => {
              const v = e.target.value ? new Date(e.target.value) : undefined;
              s.setFilters(f => ({ ...f, dateTo: v }));
            }}
          />
          {(s.filters.dateFrom || s.filters.dateTo) && (
            <button type="button" className="sw-facet-clear"
              onClick={() => s.setFilters(f => { const { dateFrom, dateTo, ...rest } = f; return rest; })}>
              Clear
            </button>
          )}
        </div>
      </section>

      {/* ── Intelligence — the ONLY coral surface (AI output) ─────────────── */}
      <section className="sw-facet-group">
        <header className="sw-facet-head"><h3>Intelligence</h3></header>
        <button type="button"
          className={`sw-facet-ai ${s.useAISearch ? 'is-on' : ''}`}
          onClick={s.toggleAISearch}
          aria-pressed={s.useAISearch ? 'true' : 'false'}>
          <Sparkles size={13} />
          <span>AI ranking</span>
          {s.useAISearch && <span className="sw-facet-ai-badge">ON</span>}
        </button>
      </section>

      {/* ── Operators ────────────────────────────────────────────────────── */}
      <section className="sw-facet-group">
        <header className="sw-facet-head"><h3>Operators</h3></header>
        <div className="sw-facet-ops">
          {/* from: — opens the contact autocomplete (the /^from:/i hook effect) */}
          <button type="button" className="sw-facet-op" title="Messages from a person"
            onClick={() => {
              s.setSearchQuery('from:');
              s.searchInputRef.current?.focus();
              s.setShowOperatorHints(true);
              s.setShowOperatorPopover(false);
            }}>
            <Command size={13} />
            <code>from:</code>
          </button>

          {(['after', 'before'] as const).map(op => (
            <div key={op} className="sw-facet-op-row">
              <button type="button" className="sw-facet-op"
                title={op === 'after' ? 'After a specific date' : 'Before a specific date'}
                onClick={() => { s.setOpenOperator(prev => prev === op ? null : op); s.setShowOperatorPopover(false); }}>
                <Command size={13} />
                <code>{op}:</code>
              </button>
              {s.openOperator === op && (
                <div className="sw-facet-op-popover" ref={s.operatorPopoverRef}>
                  <input
                    type="date" autoFocus className="sw-facet-date-input"
                    onChange={e => {
                      const d = e.target.value;
                      if (!d) return;
                      const insert = `${op}:${d} `;
                      s.setSearchQuery(q => q + (q && !q.endsWith(' ') ? ' ' : '') + insert);
                      s.setOpenOperator(null);
                      s.searchInputRef.current?.focus();
                    }}
                    aria-label={`${op} date`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Saved searches ───────────────────────────────────────────────── */}
      <section className="sw-facet-group">
        <header className="sw-facet-head"><h3>Saved searches</h3></header>
        <ul className="sw-facet-saved">
          {s.savedSearches.slice(0, 6).map(saved => (
            <li key={saved.id} className="sw-facet-saved-row">
              <button type="button" className="sw-facet-saved-btn"
                onClick={() => { s.setSearchQuery(saved.query); s.setFilters(saved.filters); }}>
                <span className="sw-facet-saved-name">{saved.name}</span>
                {saved.alertEnabled && (
                  <Bell size={11} className="sw-facet-saved-bell" aria-label={`Alerts on: ${saved.alertFrequency}`} />
                )}
              </button>
              <button type="button" className="sw-facet-saved-del"
                title="Delete saved search" aria-label={`Delete saved search "${saved.name}"`}
                onClick={async (e) => {
                  e.stopPropagation();
                  const snapshot = saved; // capture for Undo
                  await savedSearchesService.deleteSavedSearch(s.userId, saved.id);
                  s.reloadSavedSearches();
                  toast.success(
                    (t) => (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        Deleted "{snapshot.name}"
                        <button
                          type="button"
                          onClick={async () => {
                            toast.dismiss(t.id);
                            await savedSearchesService.createSavedSearch(s.userId, {
                              name: snapshot.name,
                              query: snapshot.query,
                              filters: snapshot.filters,
                              alertEnabled: snapshot.alertEnabled,
                              alertFrequency: snapshot.alertFrequency,
                            });
                            s.reloadSavedSearches();
                            toast.success('Restored');
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid currentColor',
                            color: 'inherit',
                            padding: '2px 10px',
                            borderRadius: 6,
                            fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                          }}
                        >
                          Undo
                        </button>
                      </span>
                    ),
                    { duration: 6000 }
                  );
                }}>
                <X size={11} />
              </button>
            </li>
          ))}
          {s.savedSearches.length === 0 && (
            <li className="sw-facet-saved-empty">No saved searches yet</li>
          )}
        </ul>
      </section>
    </div>
  );
}
