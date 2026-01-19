import React, { useState, useMemo, useCallback } from 'react';

// Types
interface ArchivedConversation {
  id: string;
  contactName: string;
  contactAvatar?: string;
  lastMessage: string;
  messageCount: number;
  archivedAt: Date;
  originalDate: Date;
  tags: string[];
  reason?: 'manual' | 'auto-inactive' | 'auto-resolved' | 'auto-spam';
  isImportant: boolean;
  attachmentCount: number;
  canRestore: boolean;
  expiresAt?: Date;
}

interface ArchiveStats {
  totalArchived: number;
  thisMonth: number;
  autoArchived: number;
  storageUsed: string;
}

interface ConversationArchiveProps {
  onRestore?: (conversationId: string) => void;
  onDelete?: (conversationId: string) => void;
  onExport?: (conversationId: string) => void;
  onViewConversation?: (conversationId: string) => void;
}

// Mock data generator
const generateMockArchived = (): ArchivedConversation[] => [
  {
    id: 'arch1',
    contactName: 'Old Project Team',
    lastMessage: 'Great work everyone! Project successfully delivered.',
    messageCount: 245,
    archivedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    originalDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    tags: ['project', 'team', 'completed'],
    reason: 'auto-resolved',
    isImportant: true,
    attachmentCount: 23,
    canRestore: true
  },
  {
    id: 'arch2',
    contactName: 'Marketing Campaign',
    lastMessage: 'Campaign ended. Final metrics attached.',
    messageCount: 89,
    archivedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    originalDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
    tags: ['marketing', 'campaign'],
    reason: 'manual',
    isImportant: false,
    attachmentCount: 12,
    canRestore: true
  },
  {
    id: 'arch3',
    contactName: 'John Smith',
    lastMessage: 'Thanks for your help!',
    messageCount: 34,
    archivedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    originalDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
    tags: ['support'],
    reason: 'auto-inactive',
    isImportant: false,
    attachmentCount: 0,
    canRestore: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'arch4',
    contactName: 'Q3 Planning',
    lastMessage: 'Q3 objectives finalized and approved.',
    messageCount: 156,
    archivedAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000),
    originalDate: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000),
    tags: ['planning', 'quarterly'],
    reason: 'auto-resolved',
    isImportant: true,
    attachmentCount: 8,
    canRestore: true
  },
  {
    id: 'arch5',
    contactName: 'Vendor Inquiry',
    lastMessage: 'No longer needed. Thanks anyway.',
    messageCount: 12,
    archivedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    originalDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
    tags: ['vendor'],
    reason: 'manual',
    isImportant: false,
    attachmentCount: 2,
    canRestore: true,
    expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
  }
];

const generateMockStats = (): ArchiveStats => ({
  totalArchived: 47,
  thisMonth: 5,
  autoArchived: 32,
  storageUsed: '156 MB'
});

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
  statsBar: {
    display: 'flex',
    gap: '16px',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)'
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px'
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#f1f5f9'
  },
  statLabel: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },
  searchBar: {
    display: 'flex',
    gap: '8px',
    padding: '12px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
  },
  searchInput: {
    flex: 1,
    padding: '10px 14px',
    paddingLeft: '36px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none'
  },
  filterDropdown: {
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#94a3b8',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px 20px'
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    transition: 'all 0.2s ease'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '12px'
  },
  contactInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  avatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#a78bfa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 600
  },
  contactDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px'
  },
  contactName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  importantBadge: {
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#fbbf24',
    fontSize: '9px',
    fontWeight: 700
  },
  archiveInfo: {
    fontSize: '11px',
    color: '#64748b'
  },
  reasonBadge: {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '10px',
    fontWeight: 500
  },
  lastMessage: {
    fontSize: '13px',
    color: '#94a3b8',
    lineHeight: 1.4,
    marginBottom: '12px',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden'
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px'
  },
  metaInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '11px',
    color: '#64748b'
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  tags: {
    display: 'flex',
    gap: '4px'
  },
  tag: {
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    color: '#a78bfa',
    fontSize: '10px',
    fontWeight: 500
  },
  actions: {
    display: 'flex',
    gap: '6px'
  },
  actionButton: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s ease'
  },
  restoreButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#34d399'
  },
  viewButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa'
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171'
  },
  exportButton: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#a78bfa'
  },
  expiryWarning: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    marginTop: '12px',
    fontSize: '11px',
    color: '#fbbf24'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#64748b'
  },
  bulkActions: {
    display: 'flex',
    gap: '8px',
    padding: '12px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(139, 92, 246, 0.05)'
  },
  selectAll: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#94a3b8'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6'
  }
};

// Reason colors
const reasonColors: Record<string, { bg: string; color: string; label: string }> = {
  manual: { bg: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', label: 'Manual' },
  'auto-inactive': { bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', label: 'Inactive' },
  'auto-resolved': { bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399', label: 'Resolved' },
  'auto-spam': { bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171', label: 'Spam' }
};

// Format date
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDaysUntil = (date: Date): string => {
  const days = Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return days === 1 ? '1 day' : `${days} days`;
};

// Main Component
export const ConversationArchive: React.FC<ConversationArchiveProps> = ({
  onRestore,
  onDelete,
  onExport,
  onViewConversation
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterReason, setFilterReason] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const archivedConversations = useMemo(() => generateMockArchived(), []);
  const stats = useMemo(() => generateMockStats(), []);

  const filteredConversations = useMemo(() => {
    return archivedConversations.filter(conv => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!conv.contactName.toLowerCase().includes(query) &&
            !conv.lastMessage.toLowerCase().includes(query) &&
            !conv.tags.some(t => t.toLowerCase().includes(query))) {
          return false;
        }
      }
      if (filterReason && conv.reason !== filterReason) {
        return false;
      }
      return true;
    }).sort((a, b) => b.archivedAt.getTime() - a.archivedAt.getTime());
  }, [archivedConversations, searchQuery, filterReason]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === filteredConversations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredConversations.map(c => c.id)));
    }
  }, [filteredConversations, selectedIds.size]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <i className="fa-solid fa-box-archive" />
          Archive
        </div>
      </div>

      <div style={styles.statsBar}>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{stats.totalArchived}</span>
          <span style={styles.statLabel}>Total Archived</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{stats.thisMonth}</span>
          <span style={styles.statLabel}>This Month</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{stats.autoArchived}</span>
          <span style={styles.statLabel}>Auto-Archived</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{stats.storageUsed}</span>
          <span style={styles.statLabel}>Storage Used</span>
        </div>
      </div>

      <div style={styles.searchBar}>
        <div style={{ position: 'relative', flex: 1 }}>
          <i className="fa-solid fa-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '13px' }} />
          <input
            type="text"
            placeholder="Search archived conversations..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <select
          value={filterReason || ''}
          onChange={e => setFilterReason(e.target.value || null)}
          style={styles.filterDropdown}
        >
          <option value="">All reasons</option>
          <option value="manual">Manual</option>
          <option value="auto-inactive">Inactive</option>
          <option value="auto-resolved">Resolved</option>
          <option value="auto-spam">Spam</option>
        </select>
      </div>

      {selectedIds.size > 0 && (
        <div style={styles.bulkActions}>
          <div style={styles.selectAll}>
            <div
              style={{
                ...styles.checkbox,
                ...(selectedIds.size === filteredConversations.length ? styles.checkboxChecked : {})
              }}
              onClick={selectAll}
            >
              {selectedIds.size === filteredConversations.length && (
                <i className="fa-solid fa-check" style={{ color: 'white', fontSize: '10px' }} />
              )}
            </div>
            {selectedIds.size} selected
          </div>
          <button
            style={{ ...styles.actionButton, ...styles.restoreButton }}
            onClick={() => selectedIds.forEach(id => onRestore?.(id))}
          >
            <i className="fa-solid fa-rotate-left" />
            Restore All
          </button>
          <button
            style={{ ...styles.actionButton, ...styles.exportButton }}
            onClick={() => selectedIds.forEach(id => onExport?.(id))}
          >
            <i className="fa-solid fa-download" />
            Export All
          </button>
          <button
            style={{ ...styles.actionButton, ...styles.deleteButton }}
            onClick={() => selectedIds.forEach(id => onDelete?.(id))}
          >
            <i className="fa-solid fa-trash" />
            Delete All
          </button>
        </div>
      )}

      <div style={styles.list}>
        {filteredConversations.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
            <div style={{ fontSize: '14px' }}>No archived conversations found</div>
          </div>
        ) : (
          filteredConversations.map(conv => {
            const reasonStyle = conv.reason ? reasonColors[conv.reason] : reasonColors.manual;
            return (
              <div
                key={conv.id}
                style={{
                  ...styles.card,
                  borderColor: selectedIds.has(conv.id) ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255, 255, 255, 0.06)'
                }}
              >
                <div style={styles.cardHeader}>
                  <div style={styles.contactInfo}>
                    <div
                      style={{
                        ...styles.checkbox,
                        ...(selectedIds.has(conv.id) ? styles.checkboxChecked : {})
                      }}
                      onClick={() => toggleSelect(conv.id)}
                    >
                      {selectedIds.has(conv.id) && (
                        <i className="fa-solid fa-check" style={{ color: 'white', fontSize: '10px' }} />
                      )}
                    </div>
                    <div style={styles.avatar}>
                      {conv.contactName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div style={styles.contactDetails}>
                      <div style={styles.contactName}>
                        {conv.contactName}
                        {conv.isImportant && <span style={styles.importantBadge}>IMPORTANT</span>}
                      </div>
                      <div style={styles.archiveInfo}>
                        Archived {formatDate(conv.archivedAt)} • Originally from {formatDate(conv.originalDate)}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    ...styles.reasonBadge,
                    backgroundColor: reasonStyle.bg,
                    color: reasonStyle.color
                  }}>
                    {reasonStyle.label}
                  </span>
                </div>

                <div style={styles.lastMessage}>{conv.lastMessage}</div>

                <div style={styles.cardMeta}>
                  <div style={styles.metaInfo}>
                    <div style={styles.metaItem}>
                      <i className="fa-solid fa-message" />
                      {conv.messageCount} messages
                    </div>
                    {conv.attachmentCount > 0 && (
                      <div style={styles.metaItem}>
                        <i className="fa-solid fa-paperclip" />
                        {conv.attachmentCount} files
                      </div>
                    )}
                    <div style={styles.tags}>
                      {conv.tags.slice(0, 3).map(tag => (
                        <span key={tag} style={styles.tag}>#{tag}</span>
                      ))}
                    </div>
                  </div>

                  <div style={styles.actions}>
                    <button
                      style={{ ...styles.actionButton, ...styles.viewButton }}
                      onClick={() => onViewConversation?.(conv.id)}
                    >
                      <i className="fa-solid fa-eye" />
                      View
                    </button>
                    {conv.canRestore && (
                      <button
                        style={{ ...styles.actionButton, ...styles.restoreButton }}
                        onClick={() => onRestore?.(conv.id)}
                      >
                        <i className="fa-solid fa-rotate-left" />
                        Restore
                      </button>
                    )}
                    <button
                      style={{ ...styles.actionButton, ...styles.exportButton }}
                      onClick={() => onExport?.(conv.id)}
                    >
                      <i className="fa-solid fa-download" />
                    </button>
                    <button
                      style={{ ...styles.actionButton, ...styles.deleteButton }}
                      onClick={() => onDelete?.(conv.id)}
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                </div>

                {conv.expiresAt && (
                  <div style={styles.expiryWarning}>
                    <i className="fa-solid fa-clock" />
                    Auto-deletes in {formatDaysUntil(conv.expiresAt)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// Quick archive button for use in conversation lists
export const ArchiveButton: React.FC<{
  conversationId: string;
  onArchive?: (id: string) => void;
  size?: 'small' | 'medium';
}> = ({ conversationId, onArchive, size = 'small' }) => {
  const padding = size === 'small' ? '4px 8px' : '6px 12px';
  const fontSize = size === 'small' ? '11px' : '13px';

  return (
    <button
      onClick={() => onArchive?.(conversationId)}
      style={{
        padding,
        borderRadius: '6px',
        border: 'none',
        backgroundColor: 'rgba(100, 116, 139, 0.2)',
        color: '#94a3b8',
        cursor: 'pointer',
        fontSize,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'all 0.2s ease'
      }}
    >
      <i className="fa-solid fa-box-archive" />
      Archive
    </button>
  );
};

export default ConversationArchive;
