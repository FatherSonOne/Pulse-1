import React from 'react';
import { X, Copy, ExternalLink, ArrowRight, Mail, MessageSquare, Mic, StickyNote, CheckSquare, Calendar, Users, Phone, Folder, FileText } from 'lucide-react';
import { SearchResult, SearchResultType } from '../services/unifiedSearchService';
import { AppView } from '../types';

interface SearchDetailPanelProps {
  result: SearchResult | null;
  onClose: () => void;
  onClip: (result: SearchResult) => void;
}

const TYPE_ICONS: Record<SearchResultType, React.FC<any>> = {
  message: MessageSquare,
  email: Mail,
  vox: Mic,
  note: StickyNote,
  task: CheckSquare,
  event: Calendar,
  thread: MessageSquare,
  contact: Users,
  sms: Phone,
  unified_message: MessageSquare,
  archive: Folder,
};

function typeLabel(type: SearchResultType): string {
  return type === 'unified_message' ? 'Message' : type.charAt(0).toUpperCase() + type.slice(1);
}

function MetaRow({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm py-1 border-b border-gray-100 dark:border-gray-800">
      <span className="w-28 flex-shrink-0 text-gray-400 dark:text-gray-500 font-medium">{label}</span>
      <span className="text-gray-700 dark:text-gray-300 break-all">{value}</span>
    </div>
  );
}

export const SearchDetailPanel: React.FC<SearchDetailPanelProps> = ({ result, onClose, onClip }) => {
  if (!result) return null;

  const Icon = TYPE_ICONS[result.type] ?? FileText;
  const meta = result.metadata ?? {};

  const handleCopyContent = () => {
    navigator.clipboard.writeText(result.content).catch(console.error);
  };

  const TYPE_TO_VIEW: Partial<Record<SearchResultType, AppView>> = {
    email: AppView.EMAIL,
    message: AppView.MESSAGES,
    unified_message: AppView.MESSAGES,
    thread: AppView.MESSAGES,
    vox: AppView.RELAY,
    task: AppView.DECISIONS_TASKS,
    event: AppView.CALENDAR,
    contact: AppView.CONTACTS,
    sms: AppView.SMS,
    note: AppView.DASHBOARD,
    archive: AppView.ARCHIVES,
  };

  const handleGoToSource = () => {
    const targetView = TYPE_TO_VIEW[result.type];
    if (targetView) {
      window.dispatchEvent(new CustomEvent('pulse:navigate', { detail: { view: targetView } }));
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-700"
      role="complementary"
      aria-label="Result details"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-pink-50 dark:bg-pink-900/30 flex items-center justify-center text-pink-500">
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-pink-500 mb-0.5">{typeLabel(result.type)}</p>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">{result.title}</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label="Close detail panel"
          className="flex-shrink-0 ml-2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => onClip(result)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors"
        >
          <Copy size={13} /> Clip to clipboard
        </button>
        <button
          type="button"
          onClick={handleCopyContent}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Copy size={13} /> Copy text
        </button>
        <button
          type="button"
          onClick={handleGoToSource}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          aria-label={`Go to ${typeLabel(result.type)}`}
        >
          <ArrowRight size={13} /> Go to {typeLabel(result.type)}
        </button>
        {meta.url && (
          <a
            href={meta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ExternalLink size={13} /> Open
          </a>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Full content */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Content</h3>
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            {result.content || <span className="text-gray-400 italic">No content</span>}
          </div>
        </section>

        {/* Metadata */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Details</h3>
          <div className="rounded-lg overflow-hidden">
            <MetaRow label="Date" value={result.timestamp.toLocaleString()} />
            <MetaRow label="Source" value={result.source} />
            <MetaRow label="From" value={result.sender} />
            <MetaRow label="Email" value={result.senderEmail} />
            {result.relevance !== undefined && (
              <MetaRow label="Relevance" value={`${Math.round((result.relevance ?? 0) * 100)}%`} />
            )}

            {/* Type-specific metadata */}
            {result.type === 'email' && (
              <>
                <MetaRow label="Subject" value={meta.subject} />
                <MetaRow label="Thread" value={meta.threadId} />
              </>
            )}
            {(result.type === 'message' || result.type === 'unified_message') && (
              <>
                <MetaRow label="Channel" value={meta.channelName} />
                <MetaRow label="Thread" value={meta.threadId} />
              </>
            )}
            {result.type === 'task' && (
              <MetaRow label="Status" value={meta.completed ? 'Completed' : 'Pending'} />
            )}
            {result.type === 'event' && (
              <>
                <MetaRow label="Location" value={meta.location} />
                <MetaRow label="End time" value={meta.endTime} />
              </>
            )}
            {result.type === 'contact' && (
              <>
                <MetaRow label="Company" value={meta.company} />
                <MetaRow label="Phone" value={meta.phone} />
              </>
            )}
          </div>
        </section>

        {/* Tags */}
        {Array.isArray(meta.tags) && meta.tags.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1">
              {(meta.tags as string[]).map((tag, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400">
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default SearchDetailPanel;
