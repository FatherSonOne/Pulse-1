import React, { useEffect } from 'react';
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
    <div className="sdp-meta-row">
      <span className="sdp-meta-label">{label}</span>
      <span className="sdp-meta-value">{value}</span>
    </div>
  );
}

export const SearchDetailPanel: React.FC<SearchDetailPanelProps> = ({ result, onClose, onClip }) => {
  // Escape-to-close while the panel is open. Hook runs unconditionally so the
  // hook order stays stable across renders; the listener only attaches when a
  // result is showing.
  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result, onClose]);

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
    <div className="sdp-panel" role="complementary" aria-label="Result details">
      <header className="sdp-header">
        <div className="sdp-header-info">
          <div className="sdp-icon-wrap">
            <Icon size={16} />
          </div>
          <div className="sdp-header-text">
            <span className="sdp-type-tag">{typeLabel(result.type)}</span>
            <h2 className="sdp-title">{result.title}</h2>
          </div>
        </div>
        <button type="button" onClick={onClose} title="Close" aria-label="Close detail panel" className="sdp-close-btn">
          <X size={16} />
        </button>
      </header>

      <div className="sdp-actions">
        <button type="button" onClick={() => onClip(result)} className="sdp-btn sdp-btn-primary">
          <Copy size={13} /> Clip to clipboard
        </button>
        <button type="button" onClick={handleCopyContent} className="sdp-btn sdp-btn-ghost">
          <Copy size={13} /> Copy text
        </button>
        <button type="button" onClick={handleGoToSource} className="sdp-btn sdp-btn-ghost"
          aria-label={`Go to ${typeLabel(result.type)}`}>
          <ArrowRight size={13} /> Go to {typeLabel(result.type)}
        </button>
        {meta.url && (
          <a href={meta.url} target="_blank" rel="noopener noreferrer" className="sdp-btn sdp-btn-ghost">
            <ExternalLink size={13} /> Open
          </a>
        )}
      </div>

      <div className="sdp-body">
        <section>
          <h3 className="sdp-section-label">Content</h3>
          <div className="sdp-content">
            {result.content || <span className="sdp-content-empty">No content</span>}
          </div>
        </section>

        <section>
          <h3 className="sdp-section-label">Details</h3>
          <div className="sdp-meta-list">
            <MetaRow label="Date" value={result.timestamp.toLocaleString()} />
            <MetaRow label="Source" value={result.source} />
            <MetaRow label="From" value={result.sender} />
            <MetaRow label="Email" value={result.senderEmail} />
            {result.relevance !== undefined && (
              <MetaRow label="Relevance" value={`${Math.round((result.relevance ?? 0) * 100)}%`} />
            )}

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

        {Array.isArray(meta.tags) && meta.tags.length > 0 && (
          <section>
            <h3 className="sdp-section-label">Tags</h3>
            <div className="sdp-tags">
              {(meta.tags as string[]).map((tag, i) => (
                <span key={i} className="sdp-tag">{tag}</span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default SearchDetailPanel;
