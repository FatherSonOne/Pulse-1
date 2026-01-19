/**
 * Recent Views Component
 * Shows recently viewed documents with view counts
 */

import React, { useState, useEffect } from 'react';
import { DocRecentView } from '../../../types/organization';
import {
  getRecentViews,
  recordDocumentView,
  clearRecentViews,
} from '../../../services/organizationService';

interface RecentViewsProps {
  userId: string;
  documents: Array<{ id: string; title: string; file_type: string }>;
  onDocumentClick?: (docId: string) => void;
  limit?: number;
}

export const RecentViews: React.FC<RecentViewsProps> = ({
  userId,
  documents,
  onDocumentClick,
  limit = 10,
}) => {
  const [recentViews, setRecentViews] = useState<DocRecentView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentViews();
  }, [userId]);

  const loadRecentViews = async () => {
    try {
      const views = await getRecentViews(userId, limit);
      setRecentViews(views);
    } catch (error) {
      console.error('Error loading recent views:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all recent views?')) return;
    try {
      await clearRecentViews(userId);
      setRecentViews([]);
    } catch (error) {
      console.error('Error clearing recent views:', error);
    }
  };

  const handleDocumentClick = async (docId: string) => {
    // Record the view
    await recordDocumentView(userId, docId);
    // Update local state
    setRecentViews(prev => {
      const existing = prev.find(v => v.doc_id === docId);
      if (existing) {
        return [
          { ...existing, viewed_at: new Date().toISOString(), view_count: existing.view_count + 1 },
          ...prev.filter(v => v.doc_id !== docId),
        ];
      }
      return [{ user_id: userId, doc_id: docId, viewed_at: new Date().toISOString(), view_count: 1 }, ...prev];
    });
    // Call parent handler
    onDocumentClick?.(docId);
  };

  // Get document details for each view
  const recentDocs = recentViews
    .map(view => {
      const doc = documents.find(d => d.id === view.doc_id);
      return doc ? { ...view, doc } : null;
    })
    .filter(Boolean) as Array<DocRecentView & { doc: { id: string; title: string; file_type: string } }>;

  const getFileIcon = (fileType: string): string => {
    switch (fileType?.toLowerCase()) {
      case 'pdf':
        return 'fa-file-pdf-o text-red-500';
      case 'docx':
      case 'doc':
        return 'fa-file-word-o text-blue-500';
      case 'xlsx':
      case 'xls':
        return 'fa-file-excel-o text-green-500';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return 'fa-file-image-o text-purple-500';
      case 'md':
        return 'fa-file-code-o text-gray-500';
      default:
        return 'fa-file-text-o text-gray-400';
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
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
          <div className="flex items-center gap-2">
            <i className="fa fa-clock-o text-blue-500"></i>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Recent
            </h3>
          </div>
          {recentDocs.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-h-48 overflow-y-auto">
        {recentDocs.length === 0 ? (
          <div className="p-4 text-center">
            <i className="fa fa-history text-2xl text-gray-300 dark:text-gray-600 mb-2"></i>
            <p className="text-sm text-gray-400">No recent documents</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {recentDocs.map(item => (
              <div
                key={item.doc_id}
                className="flex items-center gap-2 p-2 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                onClick={() => handleDocumentClick(item.doc_id)}
              >
                <i className={`fa ${getFileIcon(item.doc.file_type)}`}></i>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {item.doc.title}
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <span>{formatTimeAgo(item.viewed_at)}</span>
                    {item.view_count > 1 && (
                      <span className="flex items-center gap-0.5">
                        <i className="fa fa-eye text-[10px]"></i>
                        {item.view_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Hook to track document views
 */
export const useDocumentView = (userId: string | undefined, docId: string | undefined) => {
  useEffect(() => {
    if (userId && docId) {
      recordDocumentView(userId, docId).catch(console.error);
    }
  }, [userId, docId]);
};

export default RecentViews;
