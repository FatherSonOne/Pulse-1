// searchFormat — shared presentation helpers for the Workbench surfaces
// (ResultRow, ResultsTable, ResultsCards, WorkingMemory, WorkingSetDock).
// Pure formatting only; lifted verbatim from the legacy module-level helpers.
import {
  Mail, MessageSquare, Mic, StickyNote, CheckSquare,
  Calendar, Users, Phone, Folder, FileText,
} from 'lucide-react';
import type { SearchResult, SearchResultType } from '../../services/unifiedSearchService';

export const resultTypeIcons: Record<SearchResultType, React.ElementType> = {
  message:         MessageSquare,
  email:           Mail,
  vox:             Mic,
  note:            StickyNote,
  task:            CheckSquare,
  event:           Calendar,
  thread:          MessageSquare,
  contact:         Users,
  sms:             Phone,
  unified_message: MessageSquare,
  archive:         Folder,
};

export function getResultIcon(type: SearchResultType): React.ElementType {
  return resultTypeIcons[type] || FileText;
}

export function formatTimestamp(date: Date): string {
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

// Strip HTML tags to plain text (safe preview).
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Date-lane grouper — Today / Yesterday / This Week / This Month / Older.
// Lifted from the legacy timeline grouping; the lanes the Workbench table uses.
export function groupResultsByDate(results: SearchResult[]): { label: string; items: SearchResult[] }[] {
  const now       = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const weekAgo   = new Date(today.getTime() - 7  * 86_400_000);
  const monthAgo  = new Date(today.getTime() - 30 * 86_400_000);

  const buckets: { label: string; items: SearchResult[] }[] = [
    { label: 'Today',      items: [] },
    { label: 'Yesterday',  items: [] },
    { label: 'This Week',  items: [] },
    { label: 'This Month', items: [] },
    { label: 'Older',      items: [] },
  ];

  for (const r of results) {
    const d = new Date(r.timestamp.getFullYear(), r.timestamp.getMonth(), r.timestamp.getDate());
    if      (d >= today)     buckets[0].items.push(r);
    else if (d >= yesterday) buckets[1].items.push(r);
    else if (d >= weekAgo)   buckets[2].items.push(r);
    else if (d >= monthAgo)  buckets[3].items.push(r);
    else                     buckets[4].items.push(r);
  }
  return buckets.filter(b => b.items.length > 0);
}
