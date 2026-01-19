// Thread Management Component - Pin, Mute, Archive, Star
import React from 'react';
import { Pin, BellOff, Archive, Star, MoreVertical } from 'lucide-react';

export interface ThreadActions {
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  isStarred: boolean;
}

interface ThreadActionsMenuProps {
  actions: ThreadActions;
  onTogglePin: () => void;
  onToggleMute: () => void;
  onToggleArchive: () => void;
  onToggleStar: () => void;
  onExport?: () => void;
}

export const ThreadActionsMenu: React.FC<ThreadActionsMenuProps> = ({
  actions,
  onTogglePin,
  onToggleMute,
  onToggleArchive,
  onToggleStar,
  onExport
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]">
            <button
              onClick={() => {
                onTogglePin();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Pin className={`w-4 h-4 ${actions.isPinned ? 'fill-current text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
              <span className="text-gray-700 dark:text-gray-300">
                {actions.isPinned ? 'Unpin' : 'Pin'} Thread
              </span>
            </button>
            
            <button
              onClick={() => {
                onToggleStar();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Star className={`w-4 h-4 ${actions.isStarred ? 'fill-current text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'}`} />
              <span className="text-gray-700 dark:text-gray-300">
                {actions.isStarred ? 'Unstar' : 'Star'} Thread
              </span>
            </button>
            
            <button
              onClick={() => {
                onToggleMute();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <BellOff className={`w-4 h-4 ${actions.isMuted ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`} />
              <span className="text-gray-700 dark:text-gray-300">
                {actions.isMuted ? 'Unmute' : 'Mute'} Thread
              </span>
            </button>
            
            <button
              onClick={() => {
                onToggleArchive();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Archive className={`w-4 h-4 ${actions.isArchived ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'}`} />
              <span className="text-gray-700 dark:text-gray-300">
                {actions.isArchived ? 'Unarchive' : 'Archive'} Thread
              </span>
            </button>
            
            {onExport && (
              <>
                <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                <button
                  onClick={() => {
                    onExport();
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Export Thread
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Compact thread status badges
interface ThreadBadgesProps {
  actions: ThreadActions;
}

export const ThreadBadges: React.FC<ThreadBadgesProps> = ({ actions }) => {
  return (
    <div className="flex items-center gap-1">
      {actions.isPinned && (
        <Pin className="w-3 h-3 fill-current text-blue-600 dark:text-blue-400" />
      )}
      {actions.isStarred && (
        <Star className="w-3 h-3 fill-current text-yellow-600 dark:text-yellow-400" />
      )}
      {actions.isMuted && (
        <BellOff className="w-3 h-3 text-gray-400 dark:text-gray-500" />
      )}
      {actions.isArchived && (
        <Archive className="w-3 h-3 text-gray-400 dark:text-gray-500" />
      )}
    </div>
  );
};
