import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// Types
interface MessageDraft {
  id: string;
  conversationId: string;
  contactName: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  attachments?: { name: string; type: string; size: number }[];
  mentions?: string[];
  replyToId?: string;
  isScheduled?: boolean;
  scheduledFor?: Date;
}

interface DraftManagerProps {
  conversationId?: string;
  onDraftLoad?: (draft: MessageDraft) => void;
  onDraftDelete?: (draftId: string) => void;
}

interface AutoSaveHookProps {
  conversationId: string;
  content: string;
  saveInterval?: number;
  onSave?: (draft: MessageDraft) => void;
}

// Mock data
const generateMockDrafts = (): MessageDraft[] => [
  {
    id: 'd1',
    conversationId: 'conv1',
    contactName: 'Alice Chen',
    content: 'Hey Alice, I wanted to follow up on our discussion about the API integration. I think we should...',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000),
    mentions: ['@bob']
  },
  {
    id: 'd2',
    conversationId: 'conv2',
    contactName: 'Bob Wilson',
    content: 'The quarterly report is almost ready. Here are the key findings:',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    attachments: [{ name: 'Q4_Report_Draft.pdf', type: 'application/pdf', size: 2456789 }]
  },
  {
    id: 'd3',
    conversationId: 'conv3',
    contactName: 'Carol Martinez',
    content: 'Thanks for sending over the designs! I have a few suggestions:',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    replyToId: 'msg123'
  },
  {
    id: 'd4',
    conversationId: 'conv4',
    contactName: 'Team Channel',
    content: 'Reminder: Tomorrow is the deadline for sprint planning submissions. Please make sure to...',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    isScheduled: true,
    scheduledFor: new Date(Date.now() + 12 * 60 * 60 * 1000)
  }
];

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#0a0a0f',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  draftCount: {
    padding: '2px 8px',
    borderRadius: '10px',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#a78bfa',
    fontSize: '12px',
    fontWeight: 600
  },
  clearAllButton: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#f87171',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  searchBar: {
    padding: '12px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
  },
  searchInput: {
    width: '100%',
    padding: '10px 14px',
    paddingLeft: '36px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none'
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px 20px'
  },
  draftCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  draftHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '10px'
  },
  contactInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#a78bfa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600
  },
  contactName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f1f5f9'
  },
  draftTime: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '2px'
  },
  draftActions: {
    display: 'flex',
    gap: '4px'
  },
  actionButton: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    transition: 'all 0.2s ease'
  },
  draftContent: {
    fontSize: '13px',
    color: '#94a3b8',
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden'
  },
  draftMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '12px'
  },
  metaBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    fontSize: '10px',
    color: '#64748b'
  },
  scheduledBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: '#fbbf24'
  },
  replyBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#60a5fa'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#64748b'
  },
  autoSaveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '6px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    fontSize: '11px',
    color: '#34d399'
  },
  savingIndicator: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    color: '#fbbf24'
  },
  characterCount: {
    fontSize: '11px',
    color: '#64748b'
  }
};

// Format relative time
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Main Draft Manager Component
export const DraftManager: React.FC<DraftManagerProps> = ({
  conversationId,
  onDraftLoad,
  onDraftDelete
}) => {
  const [drafts, setDrafts] = useState<MessageDraft[]>(() => generateMockDrafts());
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDrafts = useMemo(() => {
    if (!searchQuery) return drafts;
    const query = searchQuery.toLowerCase();
    return drafts.filter(d =>
      d.contactName.toLowerCase().includes(query) ||
      d.content.toLowerCase().includes(query)
    );
  }, [drafts, searchQuery]);

  const handleDelete = useCallback((draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDrafts(prev => prev.filter(d => d.id !== draftId));
    onDraftDelete?.(draftId);
  }, [onDraftDelete]);

  const handleClearAll = useCallback(() => {
    setDrafts([]);
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <i className="fa-solid fa-file-pen" />
          Drafts
          <span style={styles.draftCount}>{drafts.length}</span>
        </div>
        {drafts.length > 0 && (
          <button style={styles.clearAllButton} onClick={handleClearAll}>
            <i className="fa-solid fa-trash" />
            Clear All
          </button>
        )}
      </div>

      <div style={styles.searchBar}>
        <div style={{ position: 'relative' }}>
          <i className="fa-solid fa-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '13px' }} />
          <input
            type="text"
            placeholder="Search drafts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>

      <div style={styles.list}>
        {filteredDrafts.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>
              {searchQuery ? 'No drafts match your search' : 'No drafts saved'}
            </div>
            <div style={{ fontSize: '12px' }}>
              Your message drafts will appear here
            </div>
          </div>
        ) : (
          filteredDrafts.map(draft => (
            <div
              key={draft.id}
              style={styles.draftCard}
              onClick={() => onDraftLoad?.(draft)}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139, 92, 246, 0.3)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255, 255, 255, 0.06)';
              }}
            >
              <div style={styles.draftHeader}>
                <div style={styles.contactInfo}>
                  <div style={styles.avatar}>
                    {draft.contactName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div style={styles.contactName}>{draft.contactName}</div>
                    <div style={styles.draftTime}>
                      Last edited {formatRelativeTime(draft.updatedAt)}
                    </div>
                  </div>
                </div>
                <div style={styles.draftActions}>
                  <button
                    style={styles.actionButton}
                    onClick={e => handleDelete(draft.id, e)}
                    title="Delete draft"
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>

              <div style={styles.draftContent}>{draft.content}</div>

              <div style={styles.draftMeta}>
                {draft.attachments && draft.attachments.length > 0 && (
                  <div style={styles.metaBadge}>
                    <i className="fa-solid fa-paperclip" />
                    {draft.attachments.length} file{draft.attachments.length > 1 ? 's' : ''}
                  </div>
                )}
                {draft.mentions && draft.mentions.length > 0 && (
                  <div style={styles.metaBadge}>
                    <i className="fa-solid fa-at" />
                    {draft.mentions.length} mention{draft.mentions.length > 1 ? 's' : ''}
                  </div>
                )}
                {draft.replyToId && (
                  <div style={{ ...styles.metaBadge, ...styles.replyBadge }}>
                    <i className="fa-solid fa-reply" />
                    Reply
                  </div>
                )}
                {draft.isScheduled && draft.scheduledFor && (
                  <div style={{ ...styles.metaBadge, ...styles.scheduledBadge }}>
                    <i className="fa-solid fa-clock" />
                    Scheduled
                  </div>
                )}
                <div style={{ ...styles.characterCount, marginLeft: 'auto' }}>
                  {draft.content.length} chars
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Auto-save hook for message input
export const useAutoSaveDraft = ({
  conversationId,
  content,
  saveInterval = 3000,
  onSave
}: AutoSaveHookProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const previousContentRef = useRef(content);

  const saveDraft = useCallback(() => {
    if (!content.trim() || content === previousContentRef.current) return;

    setIsSaving(true);
    previousContentRef.current = content;

    // Simulate save
    setTimeout(() => {
      const draft: MessageDraft = {
        id: `draft_${conversationId}`,
        conversationId,
        contactName: 'Current Contact',
        content,
        createdAt: lastSaved || new Date(),
        updatedAt: new Date()
      };
      onSave?.(draft);
      setIsSaving(false);
      setLastSaved(new Date());
    }, 500);
  }, [conversationId, content, lastSaved, onSave]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (content.trim() && content !== previousContentRef.current) {
      timeoutRef.current = window.setTimeout(saveDraft, saveInterval);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, saveInterval, saveDraft]);

  return { isSaving, lastSaved, saveDraft };
};

// Auto-save indicator component
export const AutoSaveIndicator: React.FC<{
  isSaving: boolean;
  lastSaved: Date | null;
}> = ({ isSaving, lastSaved }) => {
  if (isSaving) {
    return (
      <div style={{ ...styles.autoSaveIndicator, ...styles.savingIndicator }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '10px' }} />
        Saving...
      </div>
    );
  }

  if (lastSaved) {
    return (
      <div style={styles.autoSaveIndicator}>
        <i className="fa-solid fa-check" style={{ fontSize: '10px' }} />
        Saved {formatRelativeTime(lastSaved)}
      </div>
    );
  }

  return null;
};

// Draft recovery prompt
export const DraftRecoveryPrompt: React.FC<{
  draft: MessageDraft;
  onRestore: () => void;
  onDiscard: () => void;
}> = ({ draft, onRestore, onDiscard }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderRadius: '10px',
      border: '1px solid rgba(245, 158, 11, 0.2)'
    }}>
      <i className="fa-solid fa-rotate-left" style={{ color: '#fbbf24', fontSize: '16px' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', color: '#fbbf24', fontWeight: 500 }}>
          Unsaved draft found
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
          Last edited {formatRelativeTime(draft.updatedAt)}
        </div>
      </div>
      <button
        onClick={onRestore}
        style={{
          padding: '6px 12px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: '#F59E0B',
          color: 'white',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500
        }}
      >
        Restore
      </button>
      <button
        onClick={onDiscard}
        style={{
          padding: '6px 12px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'transparent',
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: '12px'
        }}
      >
        Discard
      </button>
    </div>
  );
};

export default DraftManager;
