// EmailSidebarRedesign.tsx - Folder navigation sidebar
import React from 'react';
import { EmailFolder } from '../../services/emailSyncService';

import { AlertCircle, Bookmark, Clock, Database, FileText, Inbox, Mail, Megaphone, Send, SquarePen, Star, Trash2, X } from 'lucide-react';

interface EmailSidebarRedesignProps {
  currentFolder: EmailFolder;
  folderCounts: Record<EmailFolder, number>;
  unreadCount: number;
  onFolderChange: (folder: EmailFolder) => void;
  onCompose: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  accentColor?: 'rose' | 'blue' | 'purple' | 'green';
  onCampaignsClick?: () => void;
  isCampaignsActive?: boolean;
  /** v1: Campaigns is flagged OFF (#105). When false, the whole Tools section is hidden. */
  showCampaigns?: boolean;
  cachedEmailCount?: number;
}

const folders: { id: EmailFolder; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'inbox', label: 'Inbox', Icon: Inbox },
  { id: 'starred', label: 'Starred', Icon: Star },
  { id: 'snoozed', label: 'Snoozed', Icon: Clock },
  { id: 'sent', label: 'Sent', Icon: Send },
  { id: 'drafts', label: 'Drafts', Icon: FileText },
  { id: 'important', label: 'Important', Icon: Bookmark },
  { id: 'all', label: 'All Mail', Icon: Mail },
  { id: 'trash', label: 'Trash', Icon: Trash2 },
  { id: 'spam', label: 'Spam', Icon: AlertCircle },
];

export const EmailSidebarRedesign: React.FC<EmailSidebarRedesignProps> = ({
  currentFolder,
  folderCounts,
  unreadCount,
  onFolderChange,
  onCompose,
  isOpen = true,
  onClose,
  onCampaignsClick,
  isCampaignsActive = false,
  showCampaigns = false,
  cachedEmailCount = 0,
}) => {
  const handleFolderClick = (folder: EmailFolder) => {
    onFolderChange(folder);
    onClose?.();
  };

  const renderNavButton = (
    label: string,
    icon: React.ReactNode,
    isActive: boolean,
    onClick: () => void,
    count?: number,
    ariaLabel?: string,
    keyId?: string,
  ) => (
    <button
      key={keyId ?? label}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-label={ariaLabel ?? label}
      className={`relative w-full flex items-center gap-3 pl-4 pr-3 min-h-11 rounded-md text-left text-sm transition-colors group ${
        isActive
          ? 'text-rose-600 dark:text-rose-400 bg-rose-500/[0.06] dark:bg-rose-500/[0.08] font-medium'
          : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100/70 dark:hover:bg-white/[0.04] font-normal'
      }`}
    >
      {/* Active edge marker — 2px coral leading bar (state mark, not stripe) */}
      {isActive && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-rose-500" aria-hidden="true" />
      )}
      <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span className={`font-mono text-[11px] tabular-nums tracking-wider ${
          isActive ? 'text-rose-600 dark:text-rose-400' : 'text-stone-500 dark:text-zinc-500'
        }`}>
          {count > 999 ? '999+' : count}
        </span>
      )}
    </button>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative z-50 md:z-auto
          h-full w-72 md:w-60
          bg-stone-50 dark:bg-zinc-950
          border-r border-stone-200 dark:border-zinc-800
          flex flex-col
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          shadow-2xl md:shadow-none
        `}
        aria-label="Email folders"
      >
        {/* Brand row — tight, no gradient block */}
        <div className="flex items-center justify-between h-14 pl-5 pr-3 border-b border-stone-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-rose-500" />
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-stone-900 dark:text-white tracking-tight">Pulse Mail</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-stone-500 dark:text-zinc-500">AI Inbox</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden w-11 h-11 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.04] flex items-center justify-center text-stone-500 dark:text-zinc-400 transition"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compose — solid coral, weight 500, no scale, hairline halo */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={onCompose}
            className="w-full flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white min-h-11 rounded-lg font-medium text-sm transition-colors shadow-[0_1px_0_rgba(244,63,94,0.2),0_4px_12px_rgba(244,63,94,0.18)]"
            aria-label="Compose new email"
          >
            <SquarePen className="w-4 h-4" />
            <span>Compose</span>
          </button>
        </div>

        {/* Folder list — section label + tight rows */}
        <nav className="flex-1 overflow-y-auto pt-4 pb-2 scroll-smooth" aria-label="Email folders navigation">
          <div className="px-5 pb-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-stone-400 dark:text-zinc-600">
              Folders
            </span>
          </div>
          <div className="px-2 space-y-px">
            {folders.map((folder) => {
              const count = folder.id === 'inbox' ? unreadCount : folderCounts[folder.id];
              const isActive = currentFolder === folder.id;
              const Icon = folder.Icon;
              return renderNavButton(
                folder.label,
                <Icon className="w-4 h-4" />,
                isActive,
                () => handleFolderClick(folder.id),
                count,
                `${folder.label}${count > 0 ? `, ${count} ${folder.id === 'inbox' ? 'unread' : 'emails'}` : ''}`,
                folder.id,
              );
            })}
          </div>

          {/* Tools section — currently Campaigns only. Flagged OFF for v1 (#105):
              when showCampaigns is false, hide the ENTIRE block (header + button)
              so no empty "Tools" header is left dangling. */}
          {showCampaigns && (
            <>
              {/* Section break — generous separation between folder group and tools group */}
              <div className="px-5 pt-6 pb-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-stone-400 dark:text-zinc-600">
                  Tools
                </span>
              </div>
              <div className="px-2">
                {renderNavButton(
                  'Campaigns',
                  <Megaphone className="w-4 h-4" />,
                  isCampaignsActive,
                  () => onCampaignsClick?.(),
                )}
              </div>
            </>
          )}
        </nav>

        {/* Cached count footer — mono, restrained */}
        <div className="px-5 py-3 border-t border-stone-200 dark:border-zinc-800 flex items-center gap-2 text-stone-500 dark:text-zinc-500">
          <Database className="w-3 h-3" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]">Cached</span>
          <span className="font-mono text-[10px] tabular-nums ml-auto text-stone-700 dark:text-zinc-400">
            {cachedEmailCount.toLocaleString()}
          </span>
        </div>
      </aside>
    </>
  );
};

export default EmailSidebarRedesign;
