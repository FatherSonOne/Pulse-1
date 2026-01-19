// EmailList.tsx - Email list view with actions
import React from 'react';
import { CachedEmail, EmailFolder } from '../../services/emailSyncService';

interface EmailListProps {
  emails: CachedEmail[];
  selectedEmail: CachedEmail | null;
  loading: boolean;
  onEmailSelect: (email: CachedEmail) => void;
  onToggleStar: (email: CachedEmail) => void;
  onArchive: (email: CachedEmail) => void;
  onTrash: (email: CachedEmail) => void;
  currentFolder: EmailFolder;
}

export const EmailList: React.FC<EmailListProps> = ({
  emails,
  selectedEmail,
  loading,
  onEmailSelect,
  onToggleStar,
  onArchive,
  onTrash,
  currentFolder,
}) => {
  // Format relative time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    // Same year: show month day
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Different year
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get initials for avatar
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  // Get avatar color based on email
  const getAvatarColor = (email: string) => {
    const colors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
      'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
      'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
      'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500'
    ];
    const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Get category badge
  const getCategoryBadge = (email: CachedEmail) => {
    if (email.ai_category) {
      const categoryColors: Record<string, string> = {
        priority: 'bg-red-500/20 text-red-500 dark:text-red-400',
        updates: 'bg-blue-500/20 text-blue-500 dark:text-blue-400',
        social: 'bg-green-500/20 text-green-500 dark:text-green-400',
        promotions: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
        newsletters: 'bg-purple-500/20 text-purple-500 dark:text-purple-400',
      };
      return (
        <span className={`text-xs px-2 py-0.5 rounded ${categoryColors[email.ai_category] || 'bg-stone-200 dark:bg-zinc-700 text-stone-600 dark:text-zinc-400'}`}>
          {email.ai_category}
        </span>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-transparent">
        <div className="text-center">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-rose-500 mb-3"></i>
          <p className="text-stone-500 dark:text-zinc-500">Loading emails...</p>
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-transparent">
        <div className="text-center">
          <i className="fa-solid fa-inbox text-5xl text-stone-300 dark:text-zinc-700 mb-4"></i>
          <p className="text-stone-600 dark:text-zinc-400 font-medium">No emails in {currentFolder}</p>
          <p className="text-sm text-stone-500 dark:text-zinc-600 mt-1">
            {currentFolder === 'inbox' ? 'Your inbox is empty' : `Nothing in ${currentFolder}`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto bg-white dark:bg-transparent min-h-0 h-0"
      role="listbox"
      aria-label={`Email list - ${currentFolder}`}
    >
      {/* Bulk actions bar */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-stone-50/95 dark:bg-zinc-900/95 backdrop-blur border-b border-stone-200 dark:border-zinc-800">
        <input
          type="checkbox"
          aria-label="Select all emails"
          className="w-4 h-4 rounded border-stone-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-rose-500 focus:ring-rose-500/30"
        />
        <button
          className="p-1.5 rounded hover:bg-stone-200 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
          title="Refresh"
          aria-label="Refresh emails"
        >
          <i className="fa-solid fa-arrows-rotate text-sm" aria-hidden="true"></i>
        </button>
        <button
          className="p-1.5 rounded hover:bg-stone-200 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
          title="Archive"
          aria-label="Archive selected emails"
        >
          <i className="fa-solid fa-box-archive text-sm" aria-hidden="true"></i>
        </button>
        <button
          className="p-1.5 rounded hover:bg-stone-200 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
          title="Delete"
          aria-label="Delete selected emails"
        >
          <i className="fa-solid fa-trash text-sm" aria-hidden="true"></i>
        </button>
        <button
          className="p-1.5 rounded hover:bg-stone-200 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
          title="Mark as read"
          aria-label="Mark selected emails as read"
        >
          <i className="fa-solid fa-envelope-open text-sm" aria-hidden="true"></i>
        </button>
        <div className="flex-1"></div>
        <span className="text-xs text-stone-500 dark:text-zinc-500" aria-live="polite">{emails.length} emails</span>
      </div>

      {/* Email items */}
      <div className="divide-y divide-stone-100 dark:divide-zinc-800/50" role="list">
        {emails.map((email, index) => (
          <div
            key={email.id}
            onClick={() => onEmailSelect(email)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onEmailSelect(email);
              }
            }}
            role="option"
            aria-selected={selectedEmail?.id === email.id}
            tabIndex={0}
            aria-label={`${email.is_read ? '' : 'Unread email. '}From ${email.from_name || email.from_email}. Subject: ${email.subject || 'No subject'}. ${email.is_starred ? 'Starred.' : ''}`}
            className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-inset focus:ring-rose-500 ${
              selectedEmail?.id === email.id
                ? 'bg-rose-500/10 border-l-2 border-rose-500'
                : email.is_read
                  ? 'hover:bg-stone-50 dark:hover:bg-zinc-800/30'
                  : 'bg-stone-50 dark:bg-zinc-800/20 hover:bg-stone-100 dark:hover:bg-zinc-800/40'
            }`}
          >
            {/* Checkbox */}
            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-stone-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-rose-500 focus:ring-rose-500/30"
              />
            </div>

            {/* Star */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(email);
              }}
              className={`pt-1 transition ${
                email.is_starred
                  ? 'text-yellow-500'
                  : 'text-stone-400 dark:text-zinc-600 hover:text-yellow-500'
              }`}
            >
              <i className={`fa-${email.is_starred ? 'solid' : 'regular'} fa-star text-sm`}></i>
            </button>

            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${getAvatarColor(email.from_email)}`}>
              {getInitials(email.from_name, email.from_email)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-sm truncate ${!email.is_read ? 'font-semibold text-stone-900 dark:text-white' : 'text-stone-700 dark:text-zinc-300'}`}>
                  {email.from_name || email.from_email}
                </span>
                {email.is_important && (
                  <i className="fa-solid fa-bookmark text-yellow-500 text-xs"></i>
                )}
                {email.has_attachments && (
                  <i className="fa-solid fa-paperclip text-stone-400 dark:text-zinc-500 text-xs"></i>
                )}
                {getCategoryBadge(email)}
              </div>

              <div className={`text-sm truncate ${!email.is_read ? 'font-medium text-stone-900 dark:text-white' : 'text-stone-600 dark:text-zinc-400'}`}>
                {email.subject || '(no subject)'}
              </div>

              <div className="text-sm text-stone-500 dark:text-zinc-500 truncate mt-0.5">
                {email.snippet || email.body_text?.substring(0, 100)}
              </div>

              {/* AI Summary preview */}
              {email.ai_summary && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-purple-500 dark:text-purple-400">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <span className="truncate">{email.ai_summary}</span>
                </div>
              )}
            </div>

            {/* Time and actions */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={`text-xs ${!email.is_read ? 'font-medium text-stone-900 dark:text-white' : 'text-stone-500 dark:text-zinc-500'}`}>
                {formatTime(email.received_at)}
              </span>

              {/* Hover actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(email);
                  }}
                  className="w-7 h-7 rounded hover:bg-stone-200 dark:hover:bg-zinc-700 flex items-center justify-center text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
                  title="Archive"
                >
                  <i className="fa-solid fa-box-archive text-xs"></i>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrash(email);
                  }}
                  className="w-7 h-7 rounded hover:bg-stone-200 dark:hover:bg-zinc-700 flex items-center justify-center text-stone-500 dark:text-zinc-500 hover:text-red-500 transition"
                  title="Delete"
                >
                  <i className="fa-solid fa-trash text-xs"></i>
                </button>
                <button
                  className="w-7 h-7 rounded hover:bg-stone-200 dark:hover:bg-zinc-700 flex items-center justify-center text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
                  title="Snooze"
                >
                  <i className="fa-solid fa-clock text-xs"></i>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmailList;
