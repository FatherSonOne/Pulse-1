// EmailSidebar.tsx - Folder navigation sidebar
import React from 'react';
import { EmailFolder } from '../../services/emailSyncService';

interface EmailSidebarProps {
  currentFolder: EmailFolder;
  folderCounts: Record<EmailFolder, number>;
  unreadCount: number;
  onFolderChange: (folder: EmailFolder) => void;
  onCompose: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const folders: { id: EmailFolder; label: string; icon: string }[] = [
  { id: 'inbox', label: 'Inbox', icon: 'fa-inbox' },
  { id: 'starred', label: 'Starred', icon: 'fa-star' },
  { id: 'snoozed', label: 'Snoozed', icon: 'fa-clock' },
  { id: 'sent', label: 'Sent', icon: 'fa-paper-plane' },
  { id: 'drafts', label: 'Drafts', icon: 'fa-file' },
  { id: 'important', label: 'Important', icon: 'fa-bookmark' },
  { id: 'all', label: 'All Mail', icon: 'fa-envelope' },
  { id: 'trash', label: 'Trash', icon: 'fa-trash' },
  { id: 'spam', label: 'Spam', icon: 'fa-circle-exclamation' },
];

export const EmailSidebar: React.FC<EmailSidebarProps> = ({
  currentFolder,
  folderCounts,
  unreadCount,
  onFolderChange,
  onCompose,
  isOpen = true,
  onClose,
}) => {
  const handleFolderClick = (folder: EmailFolder) => {
    onFolderChange(folder);
    // Close sidebar on mobile after selection
    onClose?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative z-50 md:z-auto
          h-full w-64 md:w-56
          bg-stone-50 dark:bg-zinc-900/50
          border-r border-stone-200 dark:border-zinc-800
          flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        aria-label="Email folders"
      >
      {/* Compose button */}
      <div className="p-4">
        <button
          onClick={onCompose}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white px-4 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40 hover:shadow-xl active:scale-95"
          aria-label="Compose new email"
        >
          <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i>
          <span>Compose</span>
        </button>
      </div>

      {/* Folder list */}
      <nav className="flex-1 overflow-y-auto px-2" aria-label="Email folders navigation">
        {folders.map((folder) => {
          const count = folder.id === 'inbox' ? unreadCount : folderCounts[folder.id];
          const isActive = currentFolder === folder.id;

          return (
            <button
              key={folder.id}
              onClick={() => handleFolderClick(folder.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all mb-0.5 ${
                isActive
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-500'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800/50 hover:text-stone-900 dark:hover:text-white'
              }`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`${folder.label}${count > 0 ? `, ${count} ${folder.id === 'inbox' ? 'unread' : 'emails'}` : ''}`}
            >
              <i className={`fa-solid ${folder.icon} w-5 text-center ${isActive ? 'text-rose-600 dark:text-rose-500' : ''}`} aria-hidden="true"></i>
              <span className="flex-1 text-sm font-medium">{folder.label}</span>
              {count > 0 && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-rose-500 text-white' : 'bg-stone-200 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400'
                  }`}
                  aria-hidden="true"
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Categories section */}
      <div className="px-2 py-4 border-t border-stone-200 dark:border-zinc-800" role="region" aria-labelledby="categories-heading">
        <div id="categories-heading" className="px-3 py-2 text-xs font-semibold text-stone-500 dark:text-zinc-500 uppercase tracking-wider">
          Categories
        </div>
        <div className="space-y-0.5" role="group">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800/50 hover:text-stone-900 dark:hover:text-white transition" aria-label="Filter by Updates category">
            <span className="w-2 h-2 rounded-full bg-pink-500" aria-hidden="true"></span>
            <span className="text-sm">Updates</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800/50 hover:text-stone-900 dark:hover:text-white transition" aria-label="Filter by Social category">
            <span className="w-2 h-2 rounded-full bg-coral-500" aria-hidden="true"></span>
            <span className="text-sm">Social</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800/50 hover:text-stone-900 dark:hover:text-white transition" aria-label="Filter by Promotions category">
            <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true"></span>
            <span className="text-sm">Promotions</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800/50 hover:text-stone-900 dark:hover:text-white transition" aria-label="Filter by Forums category">
            <span className="w-2 h-2 rounded-full bg-purple-500" aria-hidden="true"></span>
            <span className="text-sm">Forums</span>
          </button>
        </div>
      </div>

      {/* Storage indicator */}
      <div className="p-4 border-t border-stone-200 dark:border-zinc-800" role="region" aria-label="Storage usage">
        <div className="flex items-center justify-between text-xs text-stone-500 dark:text-zinc-500 mb-2">
          <span>Storage</span>
          <span>2.4 GB of 15 GB</span>
        </div>
        <div className="h-1.5 bg-stone-200 dark:bg-zinc-800 rounded-full overflow-hidden" role="progressbar" aria-valuenow={16} aria-valuemin={0} aria-valuemax={100} aria-label="Storage used: 16%">
          <div className="h-full w-[16%] bg-gradient-to-r from-rose-500 to-orange-500 rounded-full"></div>
        </div>
      </div>
    </aside>
    </>
  );
};

export default EmailSidebar;
