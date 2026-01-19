import React, { useState, useCallback, useMemo } from 'react';

// Types
interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: Date;
  uploadedBy: string;
  conversationId: string;
  messageId: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    pages?: number;
  };
}

interface AttachmentFilter {
  type: 'all' | Attachment['type'];
  dateRange: 'all' | 'today' | 'week' | 'month';
  sortBy: 'date' | 'name' | 'size' | 'type';
  sortOrder: 'asc' | 'desc';
}

interface StorageStats {
  used: number;
  total: number;
  byType: Record<string, number>;
}

interface AttachmentManagerProps {
  onAttachmentSelect?: (attachment: Attachment) => void;
  onAttachmentDownload?: (attachmentId: string) => void;
  onAttachmentDelete?: (attachmentId: string) => void;
  onAttachmentShare?: (attachmentId: string) => void;
}

// Mock data generators
const generateMockAttachments = (): Attachment[] => [
  {
    id: '1',
    name: 'Project_Screenshot.png',
    type: 'image',
    mimeType: 'image/png',
    size: 2456000,
    url: '/attachments/1.png',
    thumbnailUrl: '/thumbnails/1.jpg',
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    uploadedBy: 'Alice Chen',
    conversationId: 'conv1',
    messageId: 'msg1',
    metadata: { width: 1920, height: 1080 }
  },
  {
    id: '2',
    name: 'Meeting_Recording.mp4',
    type: 'video',
    mimeType: 'video/mp4',
    size: 45678000,
    url: '/attachments/2.mp4',
    thumbnailUrl: '/thumbnails/2.jpg',
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    uploadedBy: 'Bob Smith',
    conversationId: 'conv1',
    messageId: 'msg2',
    metadata: { duration: 1845, width: 1280, height: 720 }
  },
  {
    id: '3',
    name: 'Q4_Report.pdf',
    type: 'document',
    mimeType: 'application/pdf',
    size: 1234000,
    url: '/attachments/3.pdf',
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    uploadedBy: 'Carol Davis',
    conversationId: 'conv2',
    messageId: 'msg3',
    metadata: { pages: 24 }
  },
  {
    id: '4',
    name: 'Voice_Message.mp3',
    type: 'audio',
    mimeType: 'audio/mpeg',
    size: 567000,
    url: '/attachments/4.mp3',
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
    uploadedBy: 'David Wilson',
    conversationId: 'conv3',
    messageId: 'msg4',
    metadata: { duration: 45 }
  },
  {
    id: '5',
    name: 'Project_Files.zip',
    type: 'archive',
    mimeType: 'application/zip',
    size: 15678000,
    url: '/attachments/5.zip',
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 96),
    uploadedBy: 'Eve Thompson',
    conversationId: 'conv1',
    messageId: 'msg5'
  },
  {
    id: '6',
    name: 'Team_Photo.jpg',
    type: 'image',
    mimeType: 'image/jpeg',
    size: 3456000,
    url: '/attachments/6.jpg',
    thumbnailUrl: '/thumbnails/6.jpg',
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 120),
    uploadedBy: 'Alice Chen',
    conversationId: 'conv2',
    messageId: 'msg6',
    metadata: { width: 4032, height: 3024 }
  },
  {
    id: '7',
    name: 'Contract_Draft.docx',
    type: 'document',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 456000,
    url: '/attachments/7.docx',
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 144),
    uploadedBy: 'Bob Smith',
    conversationId: 'conv3',
    messageId: 'msg7',
    metadata: { pages: 8 }
  }
];

const STORAGE_STATS: StorageStats = {
  used: 68500000,
  total: 1073741824, // 1GB
  byType: {
    image: 25000000,
    video: 30000000,
    document: 8000000,
    audio: 2500000,
    archive: 3000000
  }
};

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({
  onAttachmentSelect,
  onAttachmentDownload,
  onAttachmentDelete,
  onAttachmentShare
}) => {
  const [attachments, setAttachments] = useState<Attachment[]>(generateMockAttachments);
  const [filter, setFilter] = useState<AttachmentFilter>({
    type: 'all',
    dateRange: 'all',
    sortBy: 'date',
    sortOrder: 'desc'
  });
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showPreview, setShowPreview] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAttachments = useMemo(() => {
    let filtered = [...attachments];

    // Type filter
    if (filter.type !== 'all') {
      filtered = filtered.filter(a => a.type === filter.type);
    }

    // Date filter
    if (filter.dateRange !== 'all') {
      const now = Date.now();
      const ranges: Record<string, number> = {
        today: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000
      };
      filtered = filtered.filter(a =>
        now - a.uploadedAt.getTime() <= ranges[filter.dateRange]
      );
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(query) ||
        a.uploadedBy.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (filter.sortBy) {
        case 'date':
          comparison = a.uploadedAt.getTime() - b.uploadedAt.getTime();
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return filter.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [attachments, filter, searchQuery]);

  const storagePercentage = useMemo(() =>
    Math.round((STORAGE_STATS.used / STORAGE_STATS.total) * 100),
    []
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getTypeIcon = (type: Attachment['type']): string => {
    const icons: Record<Attachment['type'], string> = {
      image: 'fa-image',
      video: 'fa-video',
      audio: 'fa-headphones',
      document: 'fa-file-lines',
      archive: 'fa-file-zipper',
      other: 'fa-file'
    };
    return icons[type];
  };

  const getTypeColor = (type: Attachment['type']): { bg: string; text: string } => {
    const colors: Record<Attachment['type'], { bg: string; text: string }> = {
      image: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
      video: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
      audio: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
      document: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
      archive: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' },
      other: { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400' }
    };
    return colors[type];
  };

  const handleSelect = useCallback((attachment: Attachment) => {
    setSelectedAttachment(attachment);
    onAttachmentSelect?.(attachment);
  }, [onAttachmentSelect]);

  const handleDelete = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
    if (selectedAttachment?.id === id) {
      setSelectedAttachment(null);
    }
    onAttachmentDelete?.(id);
  }, [selectedAttachment, onAttachmentDelete]);

  const typeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    attachments.forEach(a => {
      stats[a.type] = (stats[a.type] || 0) + 1;
    });
    return stats;
  }, [attachments]);

  return (
    <div className="space-y-4">
      {/* Storage Overview */}
      <div className="bg-gradient-to-r from-pink-500/10 to-rose-500/10 dark:from-pink-900/20 dark:to-rose-900/20 rounded-xl p-4 border border-pink-200 dark:border-pink-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm">
              <i className="fa-solid fa-hard-drive text-pink-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Storage</p>
              <p className="text-xs text-zinc-500">
                {formatFileSize(STORAGE_STATS.used)} of {formatFileSize(STORAGE_STATS.total)} used
              </p>
            </div>
          </div>
          <span className="text-lg font-bold text-pink-600 dark:text-pink-400">{storagePercentage}%</span>
        </div>
        <div className="h-2 bg-white/50 dark:bg-zinc-800/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              storagePercentage > 90 ? 'bg-red-500' : storagePercentage > 70 ? 'bg-yellow-500' : 'bg-pink-500'
            }`}
            style={{ width: `${storagePercentage}%` }}
          />
        </div>
        <div className="flex gap-3 mt-3">
          {Object.entries(STORAGE_STATS.byType).map(([type, size]) => {
            const colors = getTypeColor(type as Attachment['type']);
            return (
              <div key={type} className="flex items-center gap-1 text-xs">
                <span className={`w-2 h-2 rounded-full ${colors.bg.replace('100', '500').replace('900/30', '500')}`} />
                <span className="text-zinc-500 capitalize">{type}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search attachments..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
          />
        </div>
        <button
          onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition border border-zinc-200 dark:border-zinc-700"
        >
          <i className={`fa-solid ${viewMode === 'grid' ? 'fa-list' : 'fa-grip'} text-zinc-500`} />
        </button>
      </div>

      {/* Type Filters */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {(['all', 'image', 'video', 'audio', 'document', 'archive'] as const).map(type => {
          const isSelected = filter.type === type;
          const colors = type === 'all'
            ? { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400' }
            : getTypeColor(type);
          return (
            <button
              key={type}
              onClick={() => setFilter(prev => ({ ...prev, type }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                isSelected ? `${colors.bg} ${colors.text}` : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {type !== 'all' && <i className={`fa-solid ${getTypeIcon(type)}`} />}
              <span className="capitalize">{type}</span>
              {type !== 'all' && typeStats[type] && (
                <span className="opacity-60">({typeStats[type]})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sort Options */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-500">Sort by:</span>
        <select
          value={filter.sortBy}
          onChange={(e) => setFilter(prev => ({ ...prev, sortBy: e.target.value as AttachmentFilter['sortBy'] }))}
          className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
        >
          <option value="date">Date</option>
          <option value="name">Name</option>
          <option value="size">Size</option>
          <option value="type">Type</option>
        </select>
        <button
          onClick={() => setFilter(prev => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }))}
          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <i className={`fa-solid fa-arrow-${filter.sortOrder === 'asc' ? 'up' : 'down'} text-zinc-500`} />
        </button>
      </div>

      {/* Attachments */}
      {filteredAttachments.length === 0 ? (
        <div className="text-center py-8">
          <i className="fa-solid fa-folder-open text-zinc-300 text-3xl mb-3" />
          <p className="text-sm text-zinc-500">No attachments found</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-3 gap-2">
          {filteredAttachments.map(attachment => {
            const colors = getTypeColor(attachment.type);
            return (
              <button
                key={attachment.id}
                onClick={() => handleSelect(attachment)}
                className="group relative aspect-square rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:border-pink-300 dark:hover:border-pink-700 transition"
              >
                {attachment.thumbnailUrl ? (
                  <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <i className={`fa-solid ${getTypeIcon(attachment.type)} text-2xl ${colors.text}`} />
                  </div>
                ) : (
                  <div className={`absolute inset-0 ${colors.bg} flex items-center justify-center`}>
                    <i className={`fa-solid ${getTypeIcon(attachment.type)} text-2xl ${colors.text}`} />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="text-[10px] text-white truncate">{attachment.name}</p>
                  <p className="text-[9px] text-white/70">{formatFileSize(attachment.size)}</p>
                </div>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onAttachmentDownload?.(attachment.id); }}
                    className="p-1 bg-white/90 dark:bg-zinc-800/90 rounded text-zinc-600 dark:text-zinc-400 hover:bg-white"
                  >
                    <i className="fa-solid fa-download text-[10px]" />
                  </button>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAttachments.map(attachment => {
            const colors = getTypeColor(attachment.type);
            return (
              <button
                key={attachment.id}
                onClick={() => handleSelect(attachment)}
                className="w-full p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-pink-300 dark:hover:border-pink-700 transition text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                    <i className={`fa-solid ${getTypeIcon(attachment.type)} ${colors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{attachment.name}</p>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>{formatFileSize(attachment.size)}</span>
                      <span>•</span>
                      <span>{formatTimeAgo(attachment.uploadedAt)}</span>
                      <span>•</span>
                      <span>{attachment.uploadedBy}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => { e.stopPropagation(); onAttachmentDownload?.(attachment.id); }}
                      className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                    >
                      <i className="fa-solid fa-download text-zinc-500 text-sm" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onAttachmentShare?.(attachment.id); }}
                      className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                    >
                      <i className="fa-solid fa-share text-zinc-500 text-sm" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(attachment.id); }}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <i className="fa-solid fa-trash text-red-500 text-sm" />
                    </button>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {selectedAttachment && showPreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setShowPreview(false)}
              className="absolute -top-10 right-0 text-white hover:text-zinc-300"
            >
              <i className="fa-solid fa-xmark text-xl" />
            </button>
            <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden">
              <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                {selectedAttachment.type === 'image' ? (
                  <i className="fa-solid fa-image text-4xl text-zinc-400" />
                ) : selectedAttachment.type === 'video' ? (
                  <i className="fa-solid fa-play text-4xl text-zinc-400" />
                ) : (
                  <i className={`fa-solid ${getTypeIcon(selectedAttachment.type)} text-4xl text-zinc-400`} />
                )}
              </div>
              <div className="p-4">
                <p className="font-medium text-zinc-900 dark:text-white">{selectedAttachment.name}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500">
                  <span>{formatFileSize(selectedAttachment.size)}</span>
                  {selectedAttachment.metadata?.duration && (
                    <span>{formatDuration(selectedAttachment.metadata.duration)}</span>
                  )}
                  {selectedAttachment.metadata?.pages && (
                    <span>{selectedAttachment.metadata.pages} pages</span>
                  )}
                  {selectedAttachment.metadata?.width && (
                    <span>{selectedAttachment.metadata.width}x{selectedAttachment.metadata.height}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {selectedAttachment && !showPreview && (
        <div className="p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200 dark:border-pink-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{selectedAttachment.name}</p>
            <button
              onClick={() => setSelectedAttachment(null)}
              className="p-1 hover:bg-pink-100 dark:hover:bg-pink-900/30 rounded"
            >
              <i className="fa-solid fa-xmark text-zinc-500 text-xs" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(true)}
              className="flex-1 py-2 bg-white dark:bg-zinc-800 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
            >
              <i className="fa-solid fa-eye mr-1" />
              Preview
            </button>
            <button
              onClick={() => onAttachmentDownload?.(selectedAttachment.id)}
              className="flex-1 py-2 bg-pink-600 rounded-lg text-xs font-medium text-white hover:bg-pink-700"
            >
              <i className="fa-solid fa-download mr-1" />
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Compact Attachment Button
interface AttachmentButtonProps {
  count: number;
  onClick: () => void;
}

export const AttachmentButton: React.FC<AttachmentButtonProps> = ({ count, onClick }) => (
  <button
    onClick={onClick}
    className="relative p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
    title="View attachments"
  >
    <i className="fa-solid fa-paperclip text-zinc-500" />
    {count > 0 && (
      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center">
        {count > 9 ? '9+' : count}
      </span>
    )}
  </button>
);
