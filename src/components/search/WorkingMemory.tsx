// WorkingMemory — the center surface when the query is empty. Opens to the
// user's actual recent activity, not a marketing hero: Resume (recent + saved,
// keyboard 1–5) · Recent threads · Pinned · Browse by type · first-run
// onboarding. Ported verbatim from the legacy empty state.
//
// The digit-key 1–5 shortcut lives in the controller (resumeRef + global
// keydown); this only renders the rows. Neutral throughout — no coral.
//
// Spec: docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md §4.7
import {
  History, MessageSquare, Pin, ChevronRight, Bookmark,
  Mail, CheckSquare, Users, Mic, StickyNote,
} from 'lucide-react';
import type { SearchResultType } from '../../services/unifiedSearchService';
import type { UseUnifiedSearch } from './useUnifiedSearch';
import { formatTimestamp, stripHtml } from './searchFormat';

interface WorkingMemoryProps {
  s: UseUnifiedSearch;
}

const BROWSE_TYPES: { type: SearchResultType; label: string; Icon: React.ElementType }[] = [
  { type: 'email',   label: 'Emails',   Icon: Mail },
  { type: 'message', label: 'Messages', Icon: MessageSquare },
  { type: 'task',    label: 'Tasks',    Icon: CheckSquare },
  { type: 'contact', label: 'People',   Icon: Users },
  { type: 'vox',     label: 'Vox',      Icon: Mic },
  { type: 'note',    label: 'Notes',    Icon: StickyNote },
];

const ONBOARD_EXAMPLES: { query: string; caption: string }[] = [
  { query: 'from:',           caption: 'by person' },
  { query: 'type:vox',        caption: 'voice notes' },
  { query: 'after:2026-04-01', caption: 'by date' },
  { query: 'decided',         caption: 'keyword' },
];

export default function WorkingMemory({ s }: WorkingMemoryProps) {
  const pinned = s.clipboardItems.filter(i => i.pinned);
  const firstRun =
    s.recentSearches.length === 0 &&
    s.savedSearches.length === 0 &&
    s.recentThreads.length === 0 &&
    pinned.length === 0;

  return (
    <div className="sw-wm">
      {/* Resume — recent searches + saved, one keyboard-numbered list */}
      {(s.recentSearches.length > 0 || s.savedSearches.length > 0) && (
        <section className="sw-wm-section">
          <header className="sw-wm-head"><History size={11} /><span>Resume</span></header>
          <ul className="sw-wm-resume">
            {s.recentSearches.slice(0, 5).map((q, i) => (
              <li key={`recent-${i}`}>
                <button type="button" className="sw-wm-resume-row"
                  onClick={() => { s.setSearchQuery(q); s.performSearch(); }}>
                  <span className="sw-wm-resume-key">{i + 1}</span>
                  <span className="sw-wm-resume-text">{q}</span>
                  <ChevronRight size={13} className="sw-wm-resume-arrow" />
                </button>
              </li>
            ))}
            {s.savedSearches.slice(0, 5 - Math.min(s.recentSearches.length, 5)).map(saved => (
              <li key={saved.id}>
                <button type="button" className="sw-wm-resume-row"
                  onClick={() => { s.setSearchQuery(saved.query); s.setFilters(saved.filters); }}>
                  <Bookmark size={12} className="sw-wm-resume-saved-icon" />
                  <span className="sw-wm-resume-text">{saved.name}</span>
                  <ChevronRight size={13} className="sw-wm-resume-arrow" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recent threads — cross-source counterpart roll-up → from:Counterpart */}
      {s.recentThreads.length > 0 && (
        <section className="sw-wm-section">
          <header className="sw-wm-head"><MessageSquare size={11} /><span>Recent threads</span></header>
          <ul className="sw-wm-threads">
            {s.recentThreads.map(t => (
              <li key={t.id}>
                <button type="button" className="sw-wm-thread-row"
                  onClick={() => { s.setSearchQuery(`from:${t.counterpart}`); s.searchInputRef.current?.focus(); }}>
                  <span className="sw-wm-thread-avatar"
                    style={t.avatarColor ? { background: t.avatarColor } : undefined} aria-hidden="true">
                    {t.counterpart.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="sw-wm-thread-name">{t.counterpart}</span>
                  {t.unread && <span className="sw-wm-thread-unread" aria-label="Unread" />}
                  <span className="sw-wm-thread-time">{formatTimestamp(t.lastActivityAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Pinned — curated working memory from the dock */}
      {pinned.length > 0 && (
        <section className="sw-wm-section">
          <header className="sw-wm-head"><Pin size={11} /><span>Pinned</span></header>
          <ul className="sw-wm-pinned">
            {pinned.slice(0, 6).map(item => (
              <li key={item.id}>
                <button type="button" className="sw-wm-pinned-row" onClick={() => s.setSearchQuery(item.title)}>
                  <span className="sw-wm-pinned-title">{item.title}</span>
                  <span className="sw-wm-pinned-preview">{stripHtml(item.content).slice(0, 80)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Browse by type */}
      <section className="sw-wm-section">
        <header className="sw-wm-head"><span>Browse by type</span></header>
        <div className="sw-wm-browse">
          {BROWSE_TYPES.map(({ type, label, Icon }) => (
            <button type="button" key={type} className="sw-wm-browse-chip"
              onClick={() => { s.setSelectedTypes(new Set([type])); s.setSearchQuery(`type:${type}`); }}>
              <Icon size={12} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* First-run onboarding — teach the operator vocabulary */}
      {firstRun && (
        <section className="sw-wm-section sw-wm-onboard">
          <p className="sw-wm-onboard-hint">
            Search across messages, transcripts, notes, tasks, decisions.
            Start typing, or try one of these.
          </p>
          <div className="sw-wm-onboard-row">
            {ONBOARD_EXAMPLES.map(ex => (
              <button type="button" key={ex.query} className="sw-wm-onboard-chip"
                onClick={() => {
                  s.setSearchQuery(ex.query);
                  s.searchInputRef.current?.focus();
                  if (ex.query === 'from:') s.setShowOperatorHints(true);
                }}>
                <code className="sw-wm-onboard-syntax">{ex.query}</code>
                <span className="sw-wm-onboard-caption">{ex.caption}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
