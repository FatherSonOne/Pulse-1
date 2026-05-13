import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  guideSections,
  guideVersion,
  guideUpdated,
  CATEGORIES,
  type GuideSection,
  type SubSection,
  type UseCase,
  type AdvancedBlock,
  type GuideTable,
  type Shortcut,
} from './guideData';
import './UsersGuide.css';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface UsersGuideProps {
  isDarkMode?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns JSX with query matches wrapped in <mark> */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="ug-highlight">{part}</mark>
          : part
      )}
    </>
  );
}

/** Search across all fields of a section and return true if match found */
function sectionMatches(section: GuideSection, q: string): boolean {
  const lower = q.toLowerCase();
  const hay = [
    section.title,
    section.summary,
    ...(section.steps ?? []),
    ...(section.tips ?? []),
    ...(section.subsections?.flatMap(s => [s.title, s.description ?? '', ...s.steps, s.note ?? '']) ?? []),
    ...(section.useCases?.flatMap(uc => [uc.title, uc.scenario, ...uc.steps]) ?? []),
    ...(section.advanced?.flatMap(a => [a.title, ...a.items]) ?? []),
    ...(section.shortcuts?.flatMap(s => [s.key, s.action]) ?? []),
    ...(section.tables?.flatMap(t => [t.title ?? '', ...t.columns, ...t.rows.flat()]) ?? []),
  ].join(' ').toLowerCase();
  return hay.includes(lower);
}

/** Collects all text snippets in a section that contain the query */
function getMatchSnippets(section: GuideSection, q: string): string[] {
  const lower = q.toLowerCase();
  const snippets: string[] = [];
  const check = (text: string) => {
    if (text.toLowerCase().includes(lower)) snippets.push(text);
  };
  (section.steps ?? []).forEach(check);
  (section.tips ?? []).forEach(check);
  section.subsections?.forEach(s => { s.steps.forEach(check); if (s.title.toLowerCase().includes(lower)) check(s.title); });
  section.useCases?.forEach(uc => { uc.steps.forEach(check); check(uc.title); check(uc.scenario); });
  section.advanced?.forEach(a => a.items.forEach(check));
  return snippets.slice(0, 3);
}

// ─── Badge ────────────────────────────────────────────────────────────────────

const Badge: React.FC<{ badge?: 'New' | 'Updated'; size?: 'sm' | 'lg' }> = ({ badge, size = 'sm' }) => {
  if (!badge) return null;
  return (
    <span className={`ug-badge ug-badge--${badge === 'New' ? 'new' : 'updated'} ug-badge--${size}`}>
      {badge}
    </span>
  );
};

// ─── Table Block ──────────────────────────────────────────────────────────────

const TableBlock: React.FC<{ table: GuideTable; query: string }> = ({ table, query }) => (
  <div className="ug-table-wrap">
    {table.title && <p className="ug-table-title">{table.title}</p>}
    <table className="ug-table">
      <thead>
        <tr>
          {table.columns.map((col, i) => (
            <th key={i}>{highlightText(col, query)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, ri) => (
          <tr key={ri} className={ri % 2 === 1 ? 'ug-table-row-alt' : ''}>
            {row.map((cell, ci) => (
              <td key={ci}>{highlightText(cell, query)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Shortcut Table ───────────────────────────────────────────────────────────

const ShortcutTable: React.FC<{ shortcuts: Shortcut[]; query: string; title?: string }> = ({
  shortcuts, query, title
}) => (
  <div className="ug-shortcuts-wrap">
    {title && <p className="ug-section-label">{title}</p>}
    <div className="ug-shortcuts-grid">
      {shortcuts.map((s, i) => (
        <div key={i} className="ug-shortcut-row">
          <kbd className="ug-kbd">{highlightText(s.key, query)}</kbd>
          <span className="ug-shortcut-action">{highlightText(s.action, query)}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─── Collapsible Block ────────────────────────────────────────────────────────

const CollapsibleBlock: React.FC<{
  id: string;
  icon: string;
  label: string;
  tag?: string;
  tagColor?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  variant?: 'usecase' | 'advanced' | 'subsection';
}> = ({ icon, label, tag, tagColor, isOpen, onToggle, children, variant = 'usecase' }) => (
  <div className={`ug-collapsible ug-collapsible--${variant}${isOpen ? ' is-open' : ''}`}>
    <button
      className="ug-collapsible-header"
      onClick={onToggle}
      aria-expanded={isOpen}
    >
      <span className="ug-collapsible-icon">{icon}</span>
      <span className="ug-collapsible-label">{label}</span>
      {tag && (
        <span className="ug-collapsible-tag" style={{ background: tagColor }}>
          {tag}
        </span>
      )}
      <span className={`ug-collapsible-chevron${isOpen ? ' is-open' : ''}`}>›</span>
    </button>
    {isOpen && (
      <div className="ug-collapsible-body">
        {children}
      </div>
    )}
  </div>
);

// ─── Sub-Section Block ────────────────────────────────────────────────────────

const SubSectionBlock: React.FC<{
  sub: SubSection;
  query: string;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ sub, query, isOpen, onToggle }) => (
  <CollapsibleBlock
    id={sub.id}
    icon="▸"
    label={highlightText(sub.title, query) as string}
    isOpen={isOpen}
    onToggle={onToggle}
    variant="subsection"
  >
    {sub.description && (
      <p className="ug-sub-desc">{highlightText(sub.description, query)}</p>
    )}
    <ol className="ug-steps ug-steps--sub">
      {sub.steps.map((step, i) => (
        <li key={i} className="ug-step ug-step--sm">
          <span className="ug-step-num">{i + 1}</span>
          <span>{highlightText(step, query)}</span>
        </li>
      ))}
    </ol>
    {sub.note && (
      <div className="ug-note">
        <span className="ug-note-icon">💡</span>
        <span>{highlightText(sub.note, query)}</span>
      </div>
    )}
  </CollapsibleBlock>
);

// ─── Use Case Block ───────────────────────────────────────────────────────────

const UseCaseBlock: React.FC<{
  uc: UseCase;
  query: string;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ uc, query, isOpen, onToggle }) => (
  <CollapsibleBlock
    id={uc.id}
    icon="🎯"
    label={highlightText(uc.title, query) as string}
    tag="Use Case"
    tagColor="#7c3aed"
    isOpen={isOpen}
    onToggle={onToggle}
    variant="usecase"
  >
    <p className="ug-uc-scenario">
      <strong>Scenario:</strong> {highlightText(uc.scenario, query)}
    </p>
    <ol className="ug-steps ug-steps--sub">
      {uc.steps.map((step, i) => (
        <li key={i} className="ug-step ug-step--sm">
          <span className="ug-step-num">{i + 1}</span>
          <span>{highlightText(step, query)}</span>
        </li>
      ))}
    </ol>
  </CollapsibleBlock>
);

// ─── Advanced Block ───────────────────────────────────────────────────────────

const AdvancedBlockComp: React.FC<{
  block: AdvancedBlock;
  query: string;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ block, query, isOpen, onToggle }) => (
  <CollapsibleBlock
    id={block.id}
    icon="⚡"
    label={highlightText(block.title, query) as string}
    tag="Advanced"
    tagColor="#0891b2"
    isOpen={isOpen}
    onToggle={onToggle}
    variant="advanced"
  >
    <ul className="ug-adv-list">
      {block.items.map((item, i) => (
        <li key={i} className="ug-adv-item">
          <span className="ug-adv-bullet">▸</span>
          <span>{highlightText(item, query)}</span>
        </li>
      ))}
    </ul>
  </CollapsibleBlock>
);

// ─── Section Detail Panel ─────────────────────────────────────────────────────

const SectionDetail: React.FC<{
  section: GuideSection;
  query: string;
}> = ({ section, query }) => {
  // Track which collapsible items are open
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set());
  const [openUCs, setOpenUCs] = useState<Set<string>>(new Set());
  const [openAdvs, setOpenAdvs] = useState<Set<string>>(new Set());
  const detailRef = useRef<HTMLDivElement>(null);

  // Auto-expand items that match the search query
  useEffect(() => {
    if (!query.trim()) {
      setOpenSubs(new Set());
      setOpenUCs(new Set());
      setOpenAdvs(new Set());
      return;
    }
    const lower = query.toLowerCase();
    const newSubs = new Set<string>();
    const newUCs = new Set<string>();
    const newAdvs = new Set<string>();
    section.subsections?.forEach(s => {
      const hay = [s.title, s.description ?? '', ...s.steps, s.note ?? ''].join(' ').toLowerCase();
      if (hay.includes(lower)) newSubs.add(s.id);
    });
    section.useCases?.forEach(uc => {
      const hay = [uc.title, uc.scenario, ...uc.steps].join(' ').toLowerCase();
      if (hay.includes(lower)) newUCs.add(uc.id);
    });
    section.advanced?.forEach(a => {
      const hay = [a.title, ...a.items].join(' ').toLowerCase();
      if (hay.includes(lower)) newAdvs.add(a.id);
    });
    setOpenSubs(newSubs);
    setOpenUCs(newUCs);
    setOpenAdvs(newAdvs);
  }, [query, section]);

  // Scroll to top when section changes
  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [section.id]);

  const toggleSub  = (id: string) => setOpenSubs(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleUC   = (id: string) => setOpenUCs(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAdv  = (id: string) => setOpenAdvs(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const expandAll  = () => {
    setOpenSubs(new Set(section.subsections?.map(s => s.id) ?? []));
    setOpenUCs(new Set(section.useCases?.map(u => u.id) ?? []));
    setOpenAdvs(new Set(section.advanced?.map(a => a.id) ?? []));
  };
  const collapseAll = () => { setOpenSubs(new Set()); setOpenUCs(new Set()); setOpenAdvs(new Set()); };

  const hasExpandables =
    (section.subsections?.length ?? 0) > 0 ||
    (section.useCases?.length ?? 0) > 0 ||
    (section.advanced?.length ?? 0) > 0;

  return (
    <div className="ug-detail" ref={detailRef}>
      {/* ── Header ── */}
      <div className="ug-detail-header">
        <div className="ug-detail-icon">{section.icon}</div>
        <div className="ug-detail-header-text">
          <h2 className="ug-detail-title">
            {highlightText(section.title, query)}
            <Badge badge={section.badge} size="lg" />
          </h2>
          <p className="ug-detail-summary">{highlightText(section.summary, query)}</p>
        </div>
      </div>

      {/* ── In-page TOC ── */}
      {hasExpandables && (
        <div className="ug-inpage-toc">
          <div className="ug-inpage-toc-items">
            {section.subsections?.map(s => (
              <button
                key={s.id}
                className="ug-toc-pill"
                onClick={() => {
                  setOpenSubs(prev => { const n = new Set(prev); n.add(s.id); return n; });
                  requestAnimationFrame(() => {
                    document.getElementById(`sub-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  });
                }}
              >
                {s.title}
              </button>
            ))}
            {(section.useCases?.length ?? 0) > 0 && (
              <button className="ug-toc-pill" onClick={() => document.getElementById(`ucs-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Use Cases
              </button>
            )}
            {(section.advanced?.length ?? 0) > 0 && (
              <button className="ug-toc-pill" onClick={() => document.getElementById(`adv-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Advanced
              </button>
            )}
          </div>
          <div className="ug-expand-controls">
            <button className="ug-ctrl-btn" onClick={expandAll}>Expand all</button>
            <button className="ug-ctrl-btn" onClick={collapseAll}>Collapse all</button>
          </div>
        </div>
      )}

      <div className="ug-divider" />

      {/* ── How to use — main steps ── */}
      <p className="ug-section-label">How to use it</p>
      <ol className="ug-steps">
        {(section.steps ?? []).map((step, i) => (
          <li key={i} className="ug-step">
            <span className="ug-step-num">{i + 1}</span>
            <span>{highlightText(step, query)}</span>
          </li>
        ))}
      </ol>

      {/* ── Subsections ── */}
      {section.subsections && section.subsections.length > 0 && (
        <div className="ug-block-group">
          <p className="ug-section-label">Features & Details</p>
          {section.subsections.map(sub => (
            <div key={sub.id} id={`sub-${sub.id}`}>
              <SubSectionBlock
                sub={sub}
                query={query}
                isOpen={openSubs.has(sub.id)}
                onToggle={() => toggleSub(sub.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Shortcut tables ── */}
      {section.shortcuts && section.shortcuts.length > 0 && (
        <div className="ug-block-group">
          <p className="ug-section-label">Keyboard Shortcuts</p>
          <ShortcutTable shortcuts={section.shortcuts} query={query} />
        </div>
      )}

      {/* ── Reference tables ── */}
      {section.tables && section.tables.length > 0 && (
        <div className="ug-block-group">
          {section.tables.map((tbl, i) => (
            <TableBlock key={i} table={tbl} query={query} />
          ))}
        </div>
      )}

      {/* ── Pro Tips ── */}
      {(section.tips?.length ?? 0) > 0 && (
        <div className="ug-tips">
          <p className="ug-tips-heading">Pro Tips</p>
          {(section.tips ?? []).map((tip, i) => (
            <div key={i} className="ug-tip-item">
              <span className="ug-tip-bullet">▸</span>
              <span>{highlightText(tip, query)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Use Cases ── */}
      {section.useCases && section.useCases.length > 0 && (
        <div className="ug-block-group" id={`ucs-${section.id}`}>
          <p className="ug-section-label ug-section-label--uc">Use Case Scenarios</p>
          {section.useCases.map(uc => (
            <UseCaseBlock
              key={uc.id}
              uc={uc}
              query={query}
              isOpen={openUCs.has(uc.id)}
              onToggle={() => toggleUC(uc.id)}
            />
          ))}
        </div>
      )}

      {/* ── Advanced ── */}
      {section.advanced && section.advanced.length > 0 && (
        <div className="ug-block-group" id={`adv-${section.id}`}>
          <p className="ug-section-label ug-section-label--adv">Advanced Features</p>
          {section.advanced.map(block => (
            <AdvancedBlockComp
              key={block.id}
              block={block}
              query={query}
              isOpen={openAdvs.has(block.id)}
              onToggle={() => toggleAdv(block.id)}
            />
          ))}
        </div>
      )}

      <div className="ug-detail-footer">
        Pulse User Guide · v{guideVersion} · {guideUpdated}
      </div>
    </div>
  );
};

// ─── Search Results Panel ─────────────────────────────────────────────────────

const SearchResults: React.FC<{
  query: string;
  results: GuideSection[];
  onSelect: (id: string) => void;
}> = ({ query, results, onSelect }) => {
  if (results.length === 0) {
    return (
      <div className="ug-search-results">
        <div className="ug-empty">
          <div className="ug-empty-icon">🔍</div>
          <p className="ug-empty-title">No results for "{query}"</p>
          <p className="ug-empty-hint">Try a shorter keyword, or browse the sections in the sidebar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ug-search-results">
      <p className="ug-results-heading" aria-live="polite" aria-atomic="true">
        {results.length} section{results.length !== 1 ? 's' : ''} matching <strong>"{query}"</strong>
      </p>
      {results.map(section => {
        const snippets = getMatchSnippets(section, query);
        return (
          <div
            key={section.id}
            className="ug-result-card"
            onClick={() => onSelect(section.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onSelect(section.id)}
          >
            <div className="ug-result-title">
              <span className="ug-result-icon">{section.icon}</span>
              <span>{highlightText(section.title, query)}</span>
              <Badge badge={section.badge} />
            </div>
            <p className="ug-result-summary">{highlightText(section.summary, query)}</p>
            {snippets.length > 0 && (
              <div className="ug-result-snippets">
                {snippets.map((snip, i) => (
                  <div key={i} className="ug-result-snippet">
                    {highlightText(snip, query)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const Sidebar: React.FC<{
  activeId: string;
  onSelect: (id: string) => void;
}> = ({ activeId, onSelect }) => {
  const sectionMap = useMemo(
    () => Object.fromEntries(guideSections.map(s => [s.id, s])),
    []
  );

  return (
    <nav className="ug-sidebar" aria-label="Guide sections">
      <div className="ug-sidebar-inner">
        {CATEGORIES.map(cat => {
          const sections = cat.ids.map(id => sectionMap[id]).filter(Boolean);
          if (sections.length === 0) return null;
          return (
            <div key={cat.label} className="ug-cat-group">
              <div className="ug-cat-label">{cat.label}</div>
              {sections.map(s => (
                <div
                  key={s.id}
                  className={`ug-sidebar-item${activeId === s.id ? ' is-active' : ''}`}
                  onClick={() => onSelect(s.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && onSelect(s.id)}
                  aria-current={activeId === s.id ? 'page' : undefined}
                >
                  <span className="ug-sidebar-icon">{s.icon}</span>
                  <span className="ug-sidebar-label">{s.title}</span>
                  {s.badge && <Badge badge={s.badge} />}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </nav>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const UsersGuide: React.FC<UsersGuideProps> = (_props) => {
  const [activeId, setActiveId] = useState<string>(guideSections[0].id);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const activeSection = useMemo(
    () => guideSections.find(s => s.id === activeId) ?? guideSections[0],
    [activeId]
  );

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return guideSections.filter(s => sectionMatches(s, query));
  }, [query]);

  const isSearching = query.trim().length > 0;

  const handleSelectResult = useCallback((id: string) => {
    setActiveId(id);
    setQuery('');
    searchRef.current?.blur();
  }, []);

  // Ctrl+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="users-guide">

      {/* ── Header ── */}
      <div className="ug-header">
        <div className="ug-header-top">
          <div className="ug-title-block">
            <h1 className="ug-title">Pulse User Guide</h1>
            <p className="ug-subtitle">
              {guideSections.length} sections · v{guideVersion} · {guideUpdated}
            </p>
          </div>
          <span className="ug-version-badge">v{guideVersion}</span>
        </div>

        <div className="ug-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef}
            className="ug-search"
            type="text"
            placeholder="Search the guide… (Ctrl+K)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search guide"
          />
          {query && (
            <button
              className="ug-search-clear"
              onClick={() => { setQuery(''); searchRef.current?.focus(); }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="ug-body">
        {isSearching ? (
          <SearchResults query={query} results={searchResults} onSelect={handleSelectResult} />
        ) : (
          <>
            <Sidebar activeId={activeId} onSelect={setActiveId} />
            <SectionDetail section={activeSection} query={query} />
          </>
        )}
      </div>
    </div>
  );
};

export default UsersGuide;
