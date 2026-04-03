import React from 'react';
import { CheckSquare } from 'lucide-react';
import { SearchResult, SearchResultType } from '../services/unifiedSearchService';

// ── Icon map (shared with parent — keep in sync) ─────────────────────────────
import {
  Mail, MessageSquare, Mic, StickyNote, CheckSquare as CheckSquareIcon,
  Calendar, Users, Phone, Folder, FileText,
} from 'lucide-react';

const resultTypeIcons: Record<SearchResultType, React.ElementType> = {
  message:         MessageSquare,
  email:           Mail,
  vox:             Mic,
  note:            StickyNote,
  task:            CheckSquareIcon,
  event:           Calendar,
  thread:          MessageSquare,
  contact:         Users,
  sms:             Phone,
  unified_message: MessageSquare,
  archive:         Folder,
};

function getIcon(type: SearchResultType): React.ElementType {
  return resultTypeIcons[type] || FileText;
}

function formatTimestamp(date: Date): string {
  const now    = Date.now();
  const diff   = now - date.getTime();
  const minute = 60_000;
  const hour   = 60 * minute;
  const day    = 24 * hour;

  if (diff < minute)   return 'just now';
  if (diff < hour)     return `${Math.floor(diff / minute)}m ago`;
  if (diff < day)      return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day)  return `${Math.floor(diff / day)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface SearchResultCardProps {
  result: SearchResult;
  isSelected: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onDetail: (result: SearchResult) => void;
}

export const SearchResultCard = React.memo(function SearchResultCard({
  result,
  isSelected,
  onSelect,
  onDetail,
}: SearchResultCardProps) {
  const Icon = getIcon(result.type);

  return (
    <div
      className={`result-card-modern group ${isSelected ? 'selected' : ''}`}
      role="article"
      tabIndex={0}
      onClick={() => onDetail(result)}
      onKeyDown={e => { if (e.key === 'Enter') onDetail(result); }}
    >
      <button
        type="button"
        className={`result-select-btn ${isSelected ? 'selected' : ''}`}
        title={isSelected ? 'Deselect' : 'Select'}
        aria-label={isSelected ? 'Deselect result' : 'Select result'}
        onClick={e => onSelect(result.id, e)}
      >
        <CheckSquare size={13} />
      </button>

      <div className="result-header-row">
        <span className="result-source-badge">
          <Icon size={11} />
          <span>{result.type.replace('_', ' ')}</span>
        </span>
        <span className="result-timestamp">{formatTimestamp(result.timestamp)}</span>
      </div>

      <h4 className="result-title-modern">{result.title}</h4>
      <p className="result-snippet">{result.content}</p>
    </div>
  );
});
