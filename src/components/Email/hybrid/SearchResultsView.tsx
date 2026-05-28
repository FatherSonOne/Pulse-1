// SearchResultsView — renders the hybrid surface when a search query has been
// executed. Same list shape as FolderListView (without bulk-select for v1),
// headed with "Search results · N for 'query'" + a Clear button.
import React from 'react';
import { Loader2, Archive, Trash2, Star, MoonStar, X } from 'lucide-react';
import { useEmailStore } from '../../../store/emailStore';
import { useEmailUIStore } from '../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../store/emailComposeStore';
import { Avatar } from './primitives';
import { ComposeFab } from './cockpit/ComposeFab';
import { cachedEmailToRow } from './data/emailRow';

interface SearchResultsViewProps {
  query: string;
  onClear: () => void;
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({ query, onClear }) => {
  const emails = useEmailStore((s) => s.emails);
  const loading = useEmailStore((s) => s.loading);
  const handleArchive = useEmailStore((s) => s.handleArchive);
  const handleTrash = useEmailStore((s) => s.handleTrash);
  const handleToggleStar = useEmailStore((s) => s.handleToggleStar);
  const setSelectedEmail = useEmailStore((s) => s.setSelectedEmail);
  const setSnoozeTargetEmailId = useEmailUIStore((s) => s.setSnoozeTargetEmailId);
  const openCompose = useEmailComposeStore((s) => s.openCompose);

  return (
    <div className="h-full w-full overflow-y-auto relative">
      {/* Header */}
      <div className="px-10 pt-8 pb-5 border-b pulse-border-color">
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-rose-color">
            SEARCH · {emails.length} RESULT{emails.length === 1 ? '' : 'S'}
          </div>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono-pulse tracking-wide-mono pulse-ink-3-color hover:pulse-rose-color"
          >
            <X className="w-3 h-3" />
            CLEAR SEARCH
          </button>
        </div>
        <h1 className="cockpit-headline pulse-ink-color text-[24px] leading-tight tracking-tight">
          Results for <span className="italic pulse-ink-2-color">"{query}"</span>
        </h1>
      </div>

      {loading && (
        <div className="px-10 py-20 flex flex-col items-center gap-3 pulse-ink-3-color">
          <Loader2 className="w-5 h-5 animate-spin" />
          <div className="text-[12px] font-mono-pulse tracking-wide-mono uppercase">Searching…</div>
        </div>
      )}

      {!loading && emails.length === 0 && (
        <div className="px-10 py-20 text-center">
          <div className="cockpit-headline text-[20px] pulse-ink-color mb-2">No matches.</div>
          <div className="text-[13px] pulse-ink-2-color max-w-md mx-auto">
            Try a broader query, a different sender, or a phrase from the subject line.
          </div>
        </div>
      )}

      {!loading && emails.length > 0 && (
        <div className="px-10 py-4">
          <div className="border pulse-border-color rounded-xl overflow-hidden">
            {emails.map((email, idx) => {
              const row = cachedEmailToRow(email);
              return (
                <div
                  key={email.id}
                  className={`selectable-row group flex items-center gap-3 px-4 py-2.5 cursor-pointer ${
                    idx > 0 ? 'border-t pulse-border-color' : ''
                  }`}
                  onClick={() => setSelectedEmail(email)}
                >
                  <Avatar name={row.from} size={26} />
                  <span className="text-[12.5px] pulse-ink-color truncate min-w-[140px]">{row.from}</span>
                  <span className="text-[12.5px] pulse-ink-2-color truncate flex-1">
                    {row.subject}
                    {email.snippet && (
                      <span className="pulse-ink-3-color"> · {email.snippet.slice(0, 60)}</span>
                    )}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleToggleStar(email); }}
                      className={`p-1 rounded hover:pulse-rose-bg-soft-color ${email.is_starred ? 'pulse-rose-color' : 'pulse-ink-3-color'}`}
                      title="Star / unstar"
                      aria-label={email.is_starred ? `Unstar email from ${row.from}` : `Star email from ${row.from}`}
                    >
                      <Star className="w-3.5 h-3.5" fill={email.is_starred ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleArchive(email); }}
                      className="p-1 rounded hover:pulse-rose-bg-soft-color pulse-ink-3-color"
                      title="Archive"
                      aria-label={`Archive email from ${row.from}`}
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSnoozeTargetEmailId(email.id); }}
                      className="p-1 rounded hover:pulse-rose-bg-soft-color pulse-ink-3-color"
                      title="Snooze"
                      aria-label={`Snooze email from ${row.from}`}
                    >
                      <MoonStar className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleTrash(email); }}
                      className="p-1 rounded hover:pulse-rose-bg-soft-color pulse-ink-3-color"
                      title="Move to trash"
                      aria-label={`Move email from ${row.from} to trash`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[11px] font-mono-pulse pulse-ink-3-color tnum shrink-0 w-12 text-right">{row.when}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ComposeFab onClick={openCompose} />
    </div>
  );
};

export default SearchResultsView;
