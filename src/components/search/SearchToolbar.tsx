// SearchToolbar — top strip of the Workbench: full-width search input (with
// operator popover, operator-hint autocomplete, and suggestions dropdowns),
// the Table|Cards|Map view toggle (Map appears contextually with a geo
// filter), filter/clipboard panel toggles, Save, and Export.
//
// Presentation only — every behavior is driven by useUnifiedSearch. The
// heartbeat focus flourish is intentionally dropped (handoff §4.1).
//
// Spec: docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md §4.1, §4.2
import {
  Search, X, Loader2, Mic, Command, Bookmark, Download,
  Filter, StickyNote, Table, LayoutGrid, MapPin,
} from 'lucide-react';
import { OperatorReferencePopover } from '../OperatorReferencePopover';
import type { UseUnifiedSearch, ViewMode } from './useUnifiedSearch';

interface SearchToolbarProps {
  s: UseUnifiedSearch;
}

export default function SearchToolbar({ s }: SearchToolbarProps) {
  const viewModes: { id: ViewMode; Icon: React.ElementType; label: string }[] = [
    { id: 'table', Icon: Table,      label: 'Table' },
    { id: 'cards', Icon: LayoutGrid, label: 'Cards' },
  ];
  // Map appears contextually, exactly as legacy — only with an active geo filter.
  if (s.activeGeoFilter) viewModes.push({ id: 'map', Icon: MapPin, label: 'Map' });

  return (
    <div className="sw-toolbar">
      {/* ── Search field ──────────────────────────────────────────────────── */}
      <div className="sw-search-field">
        <Search size={16} className="sw-search-icon" aria-hidden="true" />
        <input
          ref={s.searchInputRef}
          className="sw-search-input"
          placeholder="Search everything — messages, tasks, contacts, decisions…"
          value={s.searchQuery}
          autoComplete="off"
          spellCheck={false}
          aria-label="Search across everything"
          aria-autocomplete="list"
          onChange={e => { s.setSearchQuery(e.target.value); s.setShowSuggestions(true); s.setShowOperatorPopover(false); }}
          onFocus={() => s.setShowSuggestions(true)}
          onBlur={() => setTimeout(() => s.setShowSuggestions(false), 150)}
          onKeyDown={e => {
            if (s.showOperatorHints && s.operatorHints.length > 0) {
              if (e.key === 'ArrowDown')        { e.preventDefault(); s.setOperatorHintsIndex(i => Math.min(i + 1, s.operatorHints.length - 1)); }
              else if (e.key === 'ArrowUp')     { e.preventDefault(); s.setOperatorHintsIndex(i => Math.max(i - 1, -1)); }
              else if (e.key === 'Enter' && s.operatorHintsIndex >= 0) { e.preventDefault(); s.setSearchQuery(s.operatorHints[s.operatorHintsIndex]); s.setShowOperatorHints(false); }
              else if (e.key === 'Escape')      s.setShowOperatorHints(false);
            }
          }}
        />

        <div className="sw-search-actions">
          {s.searchQuery && (
            <button type="button" className="sw-icon-btn"
              onClick={() => { s.setSearchQuery(''); s.searchInputRef.current?.focus(); }}
              title="Clear" aria-label="Clear search">
              <X size={14} />
            </button>
          )}
          {s.loading && <Loader2 size={16} className="sw-search-spinner" aria-label="Searching" />}
          <button type="button" className={`sw-icon-btn ${s.isListening ? 'is-listening' : ''}`}
            onClick={s.handleVoiceSearch} title="Voice search"
            aria-label={s.isListening ? 'Listening…' : 'Voice search'}>
            <Mic size={15} />
          </button>
          <button type="button" className={`sw-icon-btn ${s.showOperatorPopover ? 'is-active' : ''}`}
            onClick={() => s.setShowOperatorPopover(v => !v)}
            title="Search operators" aria-label="Show search operators">
            <Command size={14} />
          </button>
        </div>

        {/* Operator reference popover (reused verbatim) */}
        <OperatorReferencePopover
          isOpen={s.showOperatorPopover}
          onClose={() => s.setShowOperatorPopover(false)}
          onInsert={text => {
            const input = s.searchInputRef.current;
            if (!input) { s.setSearchQuery(q => q + text); return; }
            const start = input.selectionStart ?? s.searchQuery.length;
            const end   = input.selectionEnd   ?? s.searchQuery.length;
            s.setSearchQuery(s.searchQuery.slice(0, start) + text + s.searchQuery.slice(end));
            setTimeout(() => { input.focus(); input.setSelectionRange(start + text.length, start + text.length); }, 0);
          }}
        />

        {/* Operator autocomplete dropdown */}
        {s.showOperatorHints && s.operatorHints.length > 0 && (
          <ul className="sw-suggestions" role="listbox">
            {s.operatorHints.map((hint, i) => (
              <li key={hint} className={`sw-suggestion-row ${i === s.operatorHintsIndex ? 'is-active' : ''}`}
                role="option" aria-selected={i === s.operatorHintsIndex ? 'true' : 'false'}
                onMouseDown={e => { e.preventDefault(); s.setSearchQuery(hint); s.setShowOperatorHints(false); }}>
                <Command size={13} />
                <code className="sw-suggestion-code">{hint}</code>
              </li>
            ))}
          </ul>
        )}

        {/* Suggestions dropdown */}
        {s.showSuggestions && !s.showOperatorHints && s.suggestions.length > 0 && (
          <div className="sw-suggestions" role="listbox">
            {s.suggestions.map(sug => (
              <div key={sug.id} className="sw-suggestion-row" role="option"
                onClick={() => { s.setSearchQuery(sug.text); s.setShowSuggestions(false); s.performSearch(); }}>
                <Search size={13} className="sw-suggestion-icon" />
                <span>{sug.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── View toggle ───────────────────────────────────────────────────── */}
      <div className="sw-view-toggle" role="group" aria-label="View mode">
        {viewModes.map(({ id, Icon, label }) => (
          <button key={id} type="button"
            className={`sw-view-btn ${s.viewMode === id ? 'is-active' : ''}`}
            onClick={() => s.setViewMode(id)}
            title={`${label} view`}
            aria-pressed={s.viewMode === id ? 'true' : 'false'}>
            <Icon size={13} /><span>{label}</span>
          </button>
        ))}
      </div>

      <div className="sw-toolbar-divider" />

      {/* ── Panel toggles + actions ───────────────────────────────────────── */}
      <button type="button" className={`sw-icon-btn ${s.showFilters ? 'is-active' : ''}`}
        onClick={() => s.setShowFilters(v => !v)} title="Toggle filters" aria-label="Toggle facet panel">
        <Filter size={15} />
      </button>
      <button type="button" className={`sw-icon-btn ${s.showClipboard ? 'is-active' : ''}`}
        onClick={() => s.setShowClipboard(v => !v)} title="Toggle working set" aria-label="Toggle Working Set panel">
        <StickyNote size={15} />
      </button>

      <div className="sw-toolbar-divider" />

      <button type="button" className="sw-icon-btn" title="Save search"
        disabled={!s.searchQuery.trim()} onClick={() => s.setShowSaveModal(true)} aria-label="Save current search">
        <Bookmark size={15} />
      </button>
      <div className="sw-export-wrapper" ref={s.exportMenuRef}>
        <button type="button" className="sw-icon-btn" title="Export" aria-label="Export results"
          onClick={() => s.setShowExportMenu(v => !v)}>
          <Download size={15} />
        </button>
        {s.showExportMenu && (
          <div className="sw-export-menu">
            <button type="button" onClick={() => { s.handleExport('csv'); s.setShowExportMenu(false); }}>CSV</button>
            <button type="button" onClick={() => { s.handleExport('markdown'); s.setShowExportMenu(false); }}>Markdown</button>
            <button type="button" onClick={() => { s.handleExport('pdf'); s.setShowExportMenu(false); }}>PDF (Print)</button>
          </div>
        )}
      </div>
    </div>
  );
}
