// VoxSelectToolbar - Batch operation toolbar for selected Vox messages
// Appears when items are selected, provides download/archive/delete actions

import React, { useState } from 'react';
import {
  X,
  Download,
  Archive,
  Trash2,
  CheckSquare,
  Square,
  Clock,
} from 'lucide-react';
import { VoxSelectionItem } from '../../hooks/useVoxSelection';
import VoxDownloadModal from './VoxDownloadModal';

interface VoxSelectToolbarProps {
  selectedItems: VoxSelectionItem[];
  selectionCount: number;
  totalDuration: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExitSelection: () => void;
  onArchive: (items: VoxSelectionItem[]) => Promise<void>;
  onDelete?: (items: VoxSelectionItem[]) => Promise<void>;
  allSelected?: boolean;
  isDarkMode?: boolean;
  accentColor?: string;
}

const ACCENT_COLOR = '#8B5CF6';

export const VoxSelectToolbar: React.FC<VoxSelectToolbarProps> = ({
  selectedItems,
  selectionCount,
  totalDuration,
  onSelectAll,
  onDeselectAll,
  onExitSelection,
  onArchive,
  onDelete,
  allSelected = false,
  isDarkMode = false,
  accentColor = ACCENT_COLOR,
}) => {
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleArchive = async () => {
    if (selectedItems.length === 0) return;
    setIsArchiving(true);
    try {
      await onArchive(selectedItems);
      onExitSelection();
    } catch (error) {
      console.error('Archive failed:', error);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || selectedItems.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectionCount} ${selectionCount === 1 ? 'message' : 'messages'}? This cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await onDelete(selectedItems);
      onExitSelection();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const tc = {
    bg: isDarkMode
      ? 'bg-gray-900/95'
      : 'bg-white/95',
    border: isDarkMode
      ? 'border-gray-700/50'
      : 'border-gray-200/60',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    buttonBg: isDarkMode
      ? 'bg-gray-800 hover:bg-gray-700'
      : 'bg-gray-100 hover:bg-gray-200',
    buttonDanger: isDarkMode
      ? 'bg-red-900/50 hover:bg-red-800/60 text-red-400'
      : 'bg-red-50 hover:bg-red-100 text-red-600',
  };

  return (
    <>
      {/* Selection Toolbar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 ${tc.bg} backdrop-blur-xl border-t ${tc.border} px-4 py-3 animate-slide-up`}
        style={{
          boxShadow: isDarkMode
            ? '0 -4px 20px rgba(0,0,0,0.3)'
            : '0 -4px 20px rgba(0,0,0,0.1)',
        }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Left - Selection Info */}
          <div className="flex items-center gap-3">
            {/* Close Selection Button */}
            <button
              onClick={onExitSelection}
              className={`p-2 rounded-lg transition-colors ${tc.buttonBg}`}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Select All/None Toggle */}
            <button
              onClick={allSelected ? onDeselectAll : onSelectAll}
              className={`p-2 rounded-lg transition-colors ${tc.buttonBg}`}
              title={allSelected ? 'Deselect all' : 'Select all'}
            >
              {allSelected ? (
                <CheckSquare className="w-5 h-5" style={{ color: accentColor }} />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>

            {/* Selection Stats */}
            <div className="flex flex-col">
              <span className={`text-sm font-medium ${tc.text}`}>
                {selectionCount} selected
              </span>
              {totalDuration > 0 && (
                <span className={`text-xs ${tc.textSecondary} flex items-center gap-1`}>
                  <Clock className="w-3 h-3" />
                  {formatDuration(totalDuration)} total
                </span>
              )}
            </div>
          </div>

          {/* Right - Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Download Button */}
            <button
              onClick={() => setShowDownloadModal(true)}
              disabled={selectionCount === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed`}
              style={{
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                color: 'white',
                boxShadow: selectionCount > 0 ? `0 4px 14px ${accentColor}30` : 'none',
              }}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>

            {/* Archive Button */}
            <button
              onClick={handleArchive}
              disabled={selectionCount === 0 || isArchiving}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${tc.buttonBg} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Archive className={`w-4 h-4 ${isArchiving ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">
                {isArchiving ? 'Archiving...' : 'Archive'}
              </span>
            </button>

            {/* Delete Button (optional) */}
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={selectionCount === 0 || isDeleting}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${tc.buttonDanger} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Download Modal */}
      <VoxDownloadModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        items={selectedItems}
        isDarkMode={isDarkMode}
        accentColor={accentColor}
        onComplete={onExitSelection}
      />

      {/* Styles */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default VoxSelectToolbar;
