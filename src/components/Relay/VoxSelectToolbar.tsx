// VoxSelectToolbar - Batch operation toolbar for selected Vox messages
// Appears when items are selected, provides download/archive/delete actions

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  Archive,
  Trash2,
  CheckSquare,
  Square,
  Clock,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { VoxSelectionItem } from '../../hooks/useVoxSelection';
import VoxDownloadModal from './VoxDownloadModal';
import {
  archiveRelayConversation,
  unarchiveRelayConversation,
} from '../../services/relay/relayArchiveService';

interface VoxSelectToolbarProps {
  selectedItems: VoxSelectionItem[];
  selectionCount: number;
  totalDuration: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExitSelection: () => void;
  onArchive?: (items: VoxSelectionItem[]) => Promise<void>; // Made optional - will use default if not provided
  onDelete?: (items: VoxSelectionItem[]) => Promise<void>;
  allSelected?: boolean;
  isDarkMode?: boolean;
  accentColor?: string;
  contactName?: string; // Added for archive labeling
  /** Passed through to VoxDownloadModal — 'audio' (default, VOX) or 'video'
   *  (Glimpse) drives format options, title, mime, and ZIP filename. */
  mode?: 'audio' | 'video';
}

const ACCENT_COLOR = '#f43f5e';

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
  contactName = 'Unknown Contact',
  mode = 'audio',
}) => {
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleArchive = async () => {
    if (selectedItems.length === 0) return;
    setIsArchiving(true);
    setArchiveError(null);

    try {
      const messagePart = `${selectedItems.length} message${selectedItems.length > 1 ? 's' : ''}`;

      if (onArchive) {
        // Caller-supplied archive handler — no archive ID to undo against, so
        // we surface a plain confirmation toast.
        await onArchive(selectedItems);
        toast.success(`Archived ${messagePart}`);
      } else {
        const { archiveId } = await archiveRelayConversation(selectedItems, contactName);
        // Undo toast: 5s window to delete the archive row, equivalent to
        // pretending the archive call never happened. The original messages
        // were never modified by the archive flow, so this is fully reversible.
        toast.custom(
          (t) => (
            <div
              className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full ${
                isDarkMode ? 'bg-zinc-900 ring-zinc-800' : 'bg-white ring-zinc-200'
              } shadow-lg rounded-xl pointer-events-auto flex ring-1`}
            >
              <div className="flex-1 w-0 p-4 flex items-center gap-3">
                <Archive className="w-5 h-5 text-rose-500 shrink-0" />
                <p className={`text-sm font-medium ${isDarkMode ? 'text-zinc-100' : 'text-zinc-900'}`}>
                  Archived {messagePart} to Pulse Archives
                </p>
              </div>
              <div className={`flex border-l ${isDarkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <button
                  type="button"
                  onClick={async () => {
                    toast.dismiss(t.id);
                    const ok = await unarchiveRelayConversation(archiveId);
                    if (ok) {
                      toast.success('Archive undone');
                    } else {
                      toast.error('Could not undo archive');
                    }
                  }}
                  className="w-full rounded-none rounded-r-xl px-4 flex items-center gap-1.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition focus:outline-none"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Undo
                </button>
              </div>
            </div>
          ),
          { duration: 5000 },
        );
      }

      onExitSelection();
    } catch (error) {
      console.error('Archive failed:', error);
      setArchiveError(error instanceof Error ? error.message : 'Failed to archive conversation');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || selectedItems.length === 0) return;

    // Inline confirm via react-hot-toast — same channel as our other
    // notifications, no native window.confirm blocking the main thread.
    toast.custom(
      (t) => (
        <div
          className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full ${
            isDarkMode ? 'bg-zinc-900 ring-zinc-800' : 'bg-white ring-zinc-200'
          } shadow-lg rounded-xl pointer-events-auto flex flex-col ring-1 p-4 gap-3`}
        >
          <div className="flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${isDarkMode ? 'text-zinc-100' : 'text-zinc-900'}`}>
                Delete {selectionCount} {selectionCount === 1 ? 'message' : 'messages'}?
              </p>
              <p className={`mt-1 text-xs ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                This cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                isDarkMode
                  ? 'text-zinc-300 hover:bg-zinc-800'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                toast.dismiss(t.id);
                setIsDeleting(true);
                try {
                  await onDelete(selectedItems);
                  toast.success(
                    `Deleted ${selectionCount} ${selectionCount === 1 ? 'message' : 'messages'}`,
                  );
                  onExitSelection();
                } catch (error) {
                  console.error('Delete failed:', error);
                  toast.error('Could not delete. Try again.');
                } finally {
                  setIsDeleting(false);
                }
              }}
              className="px-3 py-1.5 rounded-md text-sm font-semibold bg-rose-500 hover:bg-rose-600 text-white transition"
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: Infinity },
    );
  };

  const tc = {
    bg: isDarkMode
      ? 'bg-[#080808]/95'
      : 'bg-white/95',
    border: isDarkMode
      ? 'border-[rgba(255,255,255,0.06)]'
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

  const toolbarContent = (
    <>
      {/* Selection Toolbar */}
      <div
        className="fixed bottom-[var(--pulse-bottom-bar)] left-0 right-0 px-6 py-4"
        style={{
          zIndex: 999999,
          background: isDarkMode
            ? 'linear-gradient(to top, #1f2937 0%, #111827 100%)'
            : 'linear-gradient(to top, #fafafa 0%, #f9fafb 100%)',
          borderTop: `2px solid ${accentColor}`,
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div className="max-w-4xl mx-auto">
          {/* Error Message (if any) */}
          {archiveError && (
            <div className={`mb-2 px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'}`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{archiveError}</span>
              <button
                onClick={() => setArchiveError(null)}
                className={`ml-auto ${isDarkMode ? 'hover:text-red-300' : 'hover:text-red-700'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Main Toolbar */}
          <div className="flex items-center justify-between gap-4">
            {/* Left - Selection Info */}
            <div className="flex items-center gap-3">
              {/* Close Selection Button */}
              <button
                onClick={onExitSelection}
                className="p-2.5 rounded-xl transition duration-200 ease-pulse hover:scale-105 active:scale-95"
                style={{
                  background: isDarkMode ? '#374151' : '#e5e7eb',
                  color: isDarkMode ? '#f9fafb' : '#111827',
                }}
                title="Exit selection mode"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Select All/None Toggle */}
              <button
                onClick={allSelected ? onDeselectAll : onSelectAll}
                className="p-2.5 rounded-xl transition duration-200 ease-pulse hover:scale-105 active:scale-95"
                style={{
                  background: allSelected ? `${accentColor}20` : (isDarkMode ? '#374151' : '#e5e7eb'),
                  color: allSelected ? accentColor : (isDarkMode ? '#f9fafb' : '#111827'),
                  border: `2px solid ${allSelected ? accentColor : 'transparent'}`,
                }}
                title={allSelected ? 'Deselect all' : 'Select all'}
              >
                {allSelected ? (
                  <CheckSquare className="w-5 h-5" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
              </button>

              {/* Selection Stats */}
              <div className="flex flex-col">
                <span className="text-base font-bold" style={{ color: isDarkMode ? '#f9fafb' : '#111827' }}>
                  {selectionCount} selected
                </span>
                {totalDuration > 0 && (
                  <span className="text-xs font-medium flex items-center gap-1" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                    <Clock className="w-3.5 h-3.5" />
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
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition duration-200 ease-pulse disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-95`}
              style={{
                background: selectionCount > 0
                  ? `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%)`
                  : isDarkMode ? '#374151' : '#d1d5db',
                color: 'white',
                border: `2px solid ${selectionCount > 0 ? accentColor : 'transparent'}`,
              }}
            >
              <Download className="w-5 h-5" />
              <span>Download</span>
            </button>

            {/* Archive Button */}
            <button
              onClick={handleArchive}
              disabled={selectionCount === 0 || isArchiving}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition duration-200 ease-pulse disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-95`}
              style={{
                background: selectionCount > 0
                  ? isDarkMode ? '#374151' : '#e5e7eb'
                  : isDarkMode ? '#1f2937' : '#f3f4f6',
                color: isDarkMode ? '#f9fafb' : '#111827',
                border: `2px solid ${selectionCount > 0 ? (isDarkMode ? '#4b5563' : '#d1d5db') : 'transparent'}`,
              }}
            >
              <Archive className={`w-5 h-5 ${isArchiving ? 'animate-pulse' : ''}`} />
              <span>
                {isArchiving ? 'Archiving...' : 'Archive'}
              </span>
            </button>

            {/* Delete Button (optional) */}
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={selectionCount === 0 || isDeleting}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ease-pulse ${tc.buttonDanger} disabled:opacity-40 disabled:cursor-not-allowed`}
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
      </div>

      {/* Download Modal */}
      <VoxDownloadModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        items={selectedItems}
        isDarkMode={isDarkMode}
        accentColor={accentColor}
        onComplete={onExitSelection}
        mode={mode}
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

  // Use React Portal to render the toolbar at the document body level
  // This ensures it's not affected by parent container overflow/positioning
  return createPortal(toolbarContent, document.body);
};

export default VoxSelectToolbar;
