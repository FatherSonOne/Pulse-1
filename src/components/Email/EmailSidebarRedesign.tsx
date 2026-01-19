// EmailSidebarRedesign.tsx - Modern folder navigation sidebar
import React from 'react';
import { EmailFolder } from '../../services/emailSyncService';

interface EmailSidebarRedesignProps {
  currentFolder: EmailFolder;
  folderCounts: Record<EmailFolder, number>;
  unreadCount: number;
  onFolderChange: (folder: EmailFolder) => void;
  onCompose: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  accentColor?: 'rose' | 'blue' | 'purple' | 'green';
}

const folders: { id: EmailFolder; label: string; icon: string; color?: string }[] = [
  { id: 'inbox', label: 'Inbox', icon: 'fa-inbox' },
  { id: 'starred', label: 'Starred', icon: 'fa-star', color: 'text-yellow-500' },
  { id: 'snoozed', label: 'Snoozed', icon: 'fa-clock', color: 'text-blue-500' },
  { id: 'sent', label: 'Sent', icon: 'fa-paper-plane', color: 'text-green-500' },
  { id: 'drafts', label: 'Drafts', icon: 'fa-file', color: 'text-amber-500' },
  { id: 'important', label: 'Important', icon: 'fa-bookmark', color: 'text-red-500' },
  { id: 'all', label: 'All Mail', icon: 'fa-envelope' },
  { id: 'trash', label: 'Trash', icon: 'fa-trash', color: 'text-stone-400' },
  { id: 'spam', label: 'Spam', icon: 'fa-circle-exclamation', color: 'text-orange-500' },
];

export const EmailSidebarRedesign: React.FC<EmailSidebarRedesignProps> = ({
  currentFolder,
  folderCounts,
  unreadCount,
  onFolderChange,
  onCompose,
  isOpen = true,
  onClose,
  accentColor = 'rose',
}) => {
  const handleFolderClick = (folder: EmailFolder) => {
    onFolderChange(folder);
    onClose?.();
  };

  // Get accent color gradient
  const getAccentGradient = () => {
    const gradients = {
      rose: 'from-rose-500 to-red-500',
      blue: 'from-blue-500 to-indigo-500',
      purple: 'from-purple-500 to-pink-500',
      green: 'from-green-500 to-emerald-500',
    };
    return gradients[accentColor];
  };

  const getAccentText = () => {
    const colors = {
      rose: 'text-rose-600 dark:text-rose-500',
      blue: 'text-blue-600 dark:text-blue-500',
      purple: 'text-purple-600 dark:text-purple-500',
      green: 'text-green-600 dark:text-green-500',
    };
    return colors[accentColor];
  };

  const getAccentBg = () => {
    const colors = {
      rose: 'bg-rose-500/10 border-rose-500/20',
      blue: 'bg-blue-500/10 border-blue-500/20',
      purple: 'bg-purple-500/10 border-purple-500/20',
      green: 'bg-green-500/10 border-green-500/20',
    };
    return colors[accentColor];
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative z-50 md:z-auto
          h-full w-72 md:w-64
          bg-stone-50 dark:bg-zinc-900/50
          border-r border-stone-200 dark:border-zinc-800
          flex flex-col
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          shadow-2xl md:shadow-none
        `}
        aria-label="Email folders"
      >
        {/* Header */}
        <div className="p-4 border-b border-stone-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAccentGradient()} flex items-center justify-center shadow-lg`}>
                <i className="fa-solid fa-envelope text-white text-lg"></i>
              </div>
              <div>
                <h2 className="font-bold text-stone-900 dark:text-white text-lg">Pulse Mail</h2>
                <p className="text-xs text-stone-500 dark:text-zinc-500">AI-Powered Inbox</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="md:hidden w-8 h-8 rounded-lg hover:bg-stone-200 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 transition"
              aria-label="Close menu"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Compose button */}
          <button
            onClick={onCompose}
            className={`w-full flex items-center justify-center gap-2.5 bg-gradient-to-r ${getAccentGradient()} hover:shadow-xl text-white px-4 py-3.5 rounded-xl font-bold transition-all duration-200 shadow-lg hover:scale-[1.02] active:scale-[0.98]`}
            aria-label="Compose new email"
          >
            <i className="fa-solid fa-pen-to-square text-lg" aria-hidden="true"></i>
            <span>Compose</span>
          </button>
        </div>

        {/* Folder list */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 scroll-smooth" aria-label="Email folders navigation">
          <div className="space-y-1">
            {folders.map((folder) => {
              const count = folder.id === 'inbox' ? unreadCount : folderCounts[folder.id];
              const isActive = currentFolder === folder.id;

              return (
                <button
                  key={folder.id}
                  onClick={() => handleFolderClick(folder.id)}
                  className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                    isActive
                      ? `${getAccentBg()} ${getAccentText()} border shadow-sm font-semibold`
                      : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800/60 hover:text-stone-900 dark:hover:text-white font-medium'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={`${folder.label}${count > 0 ? `, ${count} ${folder.id === 'inbox' ? 'unread' : 'emails'}` : ''}`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                    isActive 
                      ? `bg-gradient-to-br ${getAccentGradient()} text-white shadow-md` 
                      : 'bg-stone-200 dark:bg-zinc-800 group-hover:bg-stone-300 dark:group-hover:bg-zinc-700'
                  }`}>
                    <i className={`fa-solid ${folder.icon} ${!isActive && folder.color ? folder.color : ''}`} aria-hidden="true"></i>
                  </div>
                  <span className="flex-1 text-sm">{folder.label}</span>
                  {count > 0 && (
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full transition-all ${
                        isActive 
                          ? `bg-gradient-to-r ${getAccentGradient()} text-white shadow-sm` 
                          : 'bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 group-hover:bg-stone-300 dark:group-hover:bg-zinc-700'
                      }`}
                      aria-hidden="true"
                    >
                      {count > 999 ? '999+' : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Categories section */}
        <div className="px-3 py-4 border-t border-stone-200 dark:border-zinc-800" role="region" aria-labelledby="categories-heading">
          <div id="categories-heading" className="px-3 py-2 text-xs font-bold text-stone-500 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-2">
            <i className="fa-solid fa-tags"></i>
            <span>Categories</span>
          </div>
          <div className="space-y-1" role="group">
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800/60 hover:text-stone-900 dark:hover:text-white transition font-medium" aria-label="Filter by Updates category">
              <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              </div>
              <span className="text-sm">Updates</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800/60 hover:text-stone-900 dark:hover:text-white transition font-medium" aria-label="Filter by Social category">
              <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <span className="text-sm">Social</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800/60 hover:text-stone-900 dark:hover:text-white transition font-medium" aria-label="Filter by Promotions category">
              <div className="w-9 h-9 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              </div>
              <span className="text-sm">Promotions</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800/60 hover:text-stone-900 dark:hover:text-white transition font-medium" aria-label="Filter by Forums category">
              <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              </div>
              <span className="text-sm">Forums</span>
            </button>
          </div>
        </div>

        {/* Storage indicator */}
        <div className="p-4 border-t border-stone-200 dark:border-zinc-800 bg-stone-100/50 dark:bg-zinc-900/50" role="region" aria-label="Storage usage">
          <div className="flex items-center gap-2 mb-2">
            <i className="fa-solid fa-hard-drive text-stone-500 dark:text-zinc-500"></i>
            <div className="flex-1 flex items-center justify-between text-xs font-medium text-stone-600 dark:text-zinc-400">
              <span>Storage</span>
              <span>2.4 GB of 15 GB</span>
            </div>
          </div>
          <div className="relative h-2 bg-stone-200 dark:bg-zinc-800 rounded-full overflow-hidden" role="progressbar" aria-valuenow={16} aria-valuemin={0} aria-valuemax={100} aria-label="Storage used: 16%">
            <div className={`absolute inset-y-0 left-0 w-[16%] bg-gradient-to-r ${getAccentGradient()} rounded-full transition-all duration-500`}>
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
          <p className="text-xs text-stone-500 dark:text-zinc-500 mt-2 text-center">
            84% remaining
          </p>
        </div>
      </aside>
    </>
  );
};

export default EmailSidebarRedesign;
