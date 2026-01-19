/**
 * Favorites Panel Component
 * Shows favorite documents with quick access
 */

import React, { useState, useEffect } from 'react';
import {
  getUserFavorites,
  isDocumentFavorited,
  toggleFavorite,
} from '../../../services/organizationService';

interface FavoritesPanelProps {
  userId: string;
  documents: Array<{ id: string; title: string; file_type: string }>;
  onDocumentClick?: (docId: string) => void;
  onFavoriteChange?: (docId: string, isFavorite: boolean) => void;
}

export const FavoritesPanel: React.FC<FavoritesPanelProps> = ({
  userId,
  documents,
  onDocumentClick,
  onFavoriteChange,
}) => {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, [userId]);

  const loadFavorites = async () => {
    try {
      const ids = await getUserFavorites(userId);
      setFavoriteIds(ids);
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const favoriteDocuments = documents.filter(doc => favoriteIds.includes(doc.id));

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
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20">
        <div className="flex items-center gap-2">
          <i className="fa fa-star text-amber-500"></i>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Favorites
          </h3>
          <span className="text-xs text-gray-400 bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded">
            {favoriteDocuments.length}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-48 overflow-y-auto">
        {favoriteDocuments.length === 0 ? (
          <div className="p-4 text-center">
            <i className="fa fa-star-o text-2xl text-gray-300 dark:text-gray-600 mb-2"></i>
            <p className="text-sm text-gray-400">No favorites yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Star documents to access them quickly
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {favoriteDocuments.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-2 p-2 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 cursor-pointer transition-colors"
                onClick={() => onDocumentClick?.(doc.id)}
              >
                <i className={`fa ${getFileIcon(doc.file_type)}`}></i>
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                  {doc.title}
                </span>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const newFavorites = favoriteIds.filter(id => id !== doc.id);
                    setFavoriteIds(newFavorites);
                    await toggleFavorite(userId, doc.id);
                    onFavoriteChange?.(doc.id, false);
                  }}
                  className="p-1 text-amber-500 hover:text-amber-600 opacity-50 hover:opacity-100 transition-all"
                  title="Remove from favorites"
                >
                  <i className="fa fa-star"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Favorite Button Component
 * Toggleable star button for individual documents
 */
interface FavoriteButtonProps {
  userId: string;
  docId: string;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (isFavorite: boolean) => void;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  userId,
  docId,
  size = 'md',
  onChange,
}) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkFavorite();
  }, [userId, docId]);

  const checkFavorite = async () => {
    try {
      const result = await isDocumentFavorited(userId, docId);
      setIsFavorite(result);
    } catch (error) {
      console.error('Error checking favorite:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newState = await toggleFavorite(userId, docId);
      setIsFavorite(newState);
      onChange?.(newState);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const sizeClasses = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-8 h-8 text-base',
    lg: 'w-10 h-10 text-lg',
  };

  if (loading) {
    return (
      <button
        className={`${sizeClasses[size]} flex items-center justify-center text-gray-300`}
        disabled
      >
        <i className="fa fa-spinner fa-spin"></i>
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className={`${sizeClasses[size]} flex items-center justify-center rounded-lg transition-all ${
        isFavorite
          ? 'text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-900/20'
          : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
      }`}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <i className={`fa ${isFavorite ? 'fa-star' : 'fa-star-o'}`}></i>
    </button>
  );
};

export default FavoritesPanel;
