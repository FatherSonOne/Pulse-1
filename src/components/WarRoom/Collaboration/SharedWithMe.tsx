/**
 * Shared With Me Component
 * Shows documents and projects shared with the current user
 */

import React, { useState, useEffect } from 'react';
import { SharedWithMeItem } from '../../../types/collaboration';
import { getSharedWithMe } from '../../../services/collaborationService';

interface SharedWithMeProps {
  userId: string;
  onDocumentClick?: (docId: string) => void;
  onProjectClick?: (projectId: string) => void;
}

export const SharedWithMe: React.FC<SharedWithMeProps> = ({
  userId,
  onDocumentClick,
  onProjectClick,
}) => {
  const [items, setItems] = useState<SharedWithMeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'documents' | 'projects'>('all');

  useEffect(() => {
    loadSharedItems();
  }, [userId]);

  const loadSharedItems = async () => {
    try {
      const data = await getSharedWithMe(userId);
      setItems(data);
    } catch (error) {
      console.error('Error loading shared items:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'documents') return item.type === 'document';
    return item.type === 'project';
  });

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 86400) return 'Today';
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getFileIcon = (fileType?: string): string => {
    switch (fileType?.toLowerCase()) {
      case 'pdf': return 'fa-file-pdf text-red-500';
      case 'docx':
      case 'doc': return 'fa-file-word text-blue-500';
      case 'xlsx':
      case 'xls': return 'fa-file-excel text-green-500';
      case 'png':
      case 'jpg':
      case 'jpeg': return 'fa-file-image text-purple-500';
      default: return 'fa-file-alt text-gray-400';
    }
  };

  const getPermissionLabel = (item: SharedWithMeItem): string => {
    if (item.permissions.canEdit) return 'Can edit';
    if (item.permissions.canComment) return 'Can comment';
    return 'View only';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <i className="fa fa-spinner fa-spin text-gray-400"></i>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <i className="fa fa-share-alt text-blue-500"></i>
            Shared with Me
          </h3>
          <span className="text-xs text-gray-400 bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded">
            {items.length}
          </span>
        </div>

        {/* Filter tabs */}
        {items.length > 0 && (
          <div className="flex gap-1 mt-2">
            {[
              { value: 'all', label: 'All' },
              { value: 'documents', label: 'Documents' },
              { value: 'projects', label: 'Projects' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value as any)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  filter === tab.value
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="max-h-72 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="p-6 text-center">
            <i className="fa fa-folder-open text-3xl text-gray-300 dark:text-gray-600 mb-2"></i>
            <p className="text-sm text-gray-400">
              {items.length === 0 ? 'Nothing shared with you yet' : 'No matching items'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {filteredItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-3 p-3 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                onClick={() => {
                  if (item.type === 'document' && onDocumentClick) {
                    onDocumentClick(item.id);
                  } else if (item.type === 'project' && onProjectClick) {
                    onProjectClick(item.id);
                  }
                }}
              >
                {/* Icon */}
                {item.type === 'document' ? (
                  <i className={`fa ${getFileIcon(item.file_type)} text-lg`}></i>
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: item.color || '#3b82f6' }}
                  >
                    <i className={`fa ${item.icon || 'fa-folder'}`}></i>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {item.title}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      item.type === 'document'
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    }`}>
                      {item.type === 'document' ? 'Doc' : 'Project'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span className="truncate">
                      From: {item.sharer_name || item.sharer_email}
                    </span>
                    <span>•</span>
                    <span>{formatTimeAgo(item.shared_at)}</span>
                  </div>
                </div>

                {/* Permission badge */}
                <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
                  {getPermissionLabel(item)}
                </span>

                {/* Expiration warning */}
                {item.expires_at && new Date(item.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && (
                  <span className="text-[10px] text-amber-500 flex items-center gap-1 shrink-0">
                    <i className="fa fa-clock"></i>
                    Expires soon
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedWithMe;
