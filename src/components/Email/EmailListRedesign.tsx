// EmailListRedesign.tsx - Modern email list with enhanced UI
import React from 'react';
import { CachedEmail, EmailFolder } from '../../services/emailSyncService';

interface EmailListRedesignProps {
  emails: CachedEmail[];
  selectedEmail: CachedEmail | null;
  loading: boolean;
  onEmailSelect: (email: CachedEmail) => void;
  onToggleStar: (email: CachedEmail) => void;
  onArchive: (email: CachedEmail) => void;
  onTrash: (email: CachedEmail) => void;
  currentFolder: EmailFolder;
  accentColor?: 'rose' | 'blue' | 'purple' | 'green';
}

export const EmailListRedesign: React.FC<EmailListRedesignProps> = ({
  emails,
  selectedEmail,
  loading,
  onEmailSelect,
  onToggleStar,
  onArchive,
  onTrash,
  currentFolder,
  accentColor = 'rose',
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

    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  // Get initials for avatar
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      const parts = name.trim().split(' ');
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
      'bg-gradient-to-br from-red-500 to-pink-500',
      'bg-gradient-to-br from-orange-500 to-red-500',
      'bg-gradient-to-br from-amber-500 to-orange-500',
      'bg-gradient-to-br from-yellow-500 to-amber-500',
      'bg-gradient-to-br from-lime-500 to-green-500',
      'bg-gradient-to-br from-green-500 to-emerald-500',
      'bg-gradient-to-br from-emerald-500 to-teal-500',
      'bg-gradient-to-br from-teal-500 to-cyan-500',
      'bg-gradient-to-br from-cyan-500 to-sky-500',
      'bg-gradient-to-br from-sky-500 to-blue-500',
      'bg-gradient-to-br from-blue-500 to-indigo-500',
      'bg-gradient-to-br from-indigo-500 to-violet-500',
      'bg-gradient-to-br from-violet-500 to-purple-500',
      'bg-gradient-to-br from-purple-500 to-fuchsia-500',
      'bg-gradient-to-br from-fuchsia-500 to-pink-500',
      'bg-gradient-to-br from-pink-500 to-rose-500'
    ];
    const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Get category badge
  const getCategoryBadge = (email: CachedEmail) => {
    if (email.ai_category) {
      const categoryColors: Record<string, string> = {
        priority: 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30',
        updates: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30',
        social: 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30',
        promotions: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30',
        newsletters: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30',
      };
      return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[email.ai_category] || 'bg-stone-200 dark:bg-zinc-700 text-stone-600 dark:text-zinc-400'}`}>
          {email.ai_category}
        </span>
      );
    }
    return null;
  };

  // Get priority indicator
  const getPriorityIndicator = (email: CachedEmail) => {
    if (email.ai_priority_score && email.ai_priority_score >= 70) {
      return (
        <div className="w-1 h-10 rounded-full bg-gradient-to-b from-red-500 to-orange-500 flex-shrink-0" title={`Priority: ${email.ai_priority_score}`}></div>
      );
    }
    return null;
  };

  // Get accent color classes
  const getAccentColor = () => {
    const colors = {
      rose: 'bg-rose-500/10 border-rose-500',
      blue: 'bg-blue-500/10 border-blue-500',
      purple: 'bg-purple-500/10 border-purple-500',
      green: 'bg-green-500/10 border-green-500',
    };
    return colors[accentColor];
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-transparent">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className={`absolute inset-0 rounded-full border-4 border-${accentColor}-500/20`}></div>
            <div className={`absolute inset-0 rounded-full border-4 border-transparent border-t-${accentColor}-500 animate-spin`}></div>
          </div>
          <p className="text-stone-600 dark:text-zinc-400 font-medium">Loading emails...</p>
          <p className="text-sm text-stone-500 dark:text-zinc-500 mt-1">Please wait</p>
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-transparent p-8">
        <div className="text-center max-w-sm">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-stone-200 to-stone-300 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center">
            <i className="fa-solid fa-inbox text-4xl text-stone-400 dark:text-zinc-600"></i>
          </div>
          <h3 className="text-xl font-semibold text-stone-800 dark:text-white mb-2">
            {currentFolder === 'inbox' ? 'Inbox Zero! 🎉' : `No emails in ${currentFolder}`}
          </h3>
          <p className="text-stone-600 dark:text-zinc-400">
            {currentFolder === 'inbox' 
              ? 'You\'re all caught up. Time to focus on what matters!' 
              : `This folder is empty. Check back later.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto bg-white dark:bg-transparent min-h-0 h-0 scroll-smooth"
      role="listbox"
      aria-label={`Email list - ${currentFolder}`}
    >
      {/* Bulk actions bar */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 bg-stone-50/98 dark:bg-zinc-900/98 backdrop-blur-xl border-b border-stone-200 dark:border-zinc-800 shadow-sm">
        <input
          type="checkbox"
          aria-label="Select all emails"
          className={`w-4 h-4 rounded border-stone-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-${accentColor}-500 focus:ring-${accentColor}-500/30`}
        />
        <div className="h-4 w-px bg-stone-300 dark:bg-zinc-700"></div>
        <button
          className="p-2 rounded-lg hover:bg-stone-200 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
          title="Refresh"
          aria-label="Refresh emails"
        >
          <i className="fa-solid fa-arrows-rotate text-sm" aria-hidden="true"></i>
        </button>
        <button
          className="p-2 rounded-lg hover:bg-stone-200 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
          title="Archive selected"
          aria-label="Archive selected emails"
        >
          <i className="fa-solid fa-box-archive text-sm" aria-hidden="true"></i>
        </button>
        <button
          className="p-2 rounded-lg hover:bg-stone-200 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-500 hover:text-red-500 transition"
          title="Delete selected"
          aria-label="Delete selected emails"
        >
          <i className="fa-solid fa-trash text-sm" aria-hidden="true"></i>
        </button>
        <button
          className="p-2 rounded-lg hover:bg-stone-200 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
          title="Mark as read"
          aria-label="Mark selected emails as read"
        >
          <i className="fa-solid fa-envelope-open text-sm" aria-hidden="true"></i>
        </button>
        <button
          className="p-2 rounded-lg hover:bg-stone-200 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
          title="Snooze"
          aria-label="Snooze selected emails"
        >
          <i className="fa-solid fa-clock text-sm" aria-hidden="true"></i>
        </button>
        <div className="flex-1"></div>
        <span className="text-xs font-medium text-stone-500 dark:text-zinc-500" aria-live="polite">
          {emails.length} {emails.length === 1 ? 'email' : 'emails'}
        </span>
      </div>

      {/* Email items */}
      <div className="divide-y divide-stone-100 dark:divide-zinc-800/50" role="list">
        {emails.map((email) => {
          const isSelected = selectedEmail?.id === email.id;
          const priorityBar = getPriorityIndicator(email);
          
          return (
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
              aria-selected={isSelected}
              tabIndex={0}
              aria-label={`${email.is_read ? '' : 'Unread email. '}From ${email.from_name || email.from_email}. Subject: ${email.subject || 'No subject'}. ${email.is_starred ? 'Starred.' : ''}`}
              className={`group flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-${accentColor}-500 ${
                isSelected
                  ? `${getAccentColor()} border-l-2`
                  : email.is_read
                    ? 'hover:bg-stone-50/80 dark:hover:bg-zinc-800/30'
                    : 'bg-stone-50/50 dark:bg-zinc-800/10 hover:bg-stone-100 dark:hover:bg-zinc-800/30'
              }`}
            >
              {/* Priority indicator */}
              {priorityBar}

              {/* Checkbox */}
              <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className={`w-4 h-4 rounded border-stone-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-${accentColor}-500 focus:ring-${accentColor}-500/30 transition`}
                />
              </div>

              {/* Star */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(email);
                }}
                className={`pt-1 transition-all duration-200 ${
                  email.is_starred
                    ? 'text-yellow-500 scale-110'
                    : 'text-stone-400 dark:text-zinc-600 hover:text-yellow-500 hover:scale-110'
                }`}
                title={email.is_starred ? 'Unstar' : 'Star'}
              >
                <i className={`fa-${email.is_starred ? 'solid' : 'regular'} fa-star text-sm`}></i>
              </button>

              {/* Avatar */}
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm ${getAvatarColor(email.from_email)}`}>
                {getInitials(email.from_name, email.from_email)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm truncate flex-1 ${!email.is_read ? 'font-bold text-stone-900 dark:text-white' : 'font-semibold text-stone-700 dark:text-zinc-300'}`}>
                    {email.from_name || email.from_email}
                  </span>
                  {email.is_important && (
                    <i className="fa-solid fa-bookmark text-yellow-500 text-xs" title="Important"></i>
                  )}
                  {email.has_attachments && (
                    <i className="fa-solid fa-paperclip text-stone-400 dark:text-zinc-500 text-xs" title="Has attachments"></i>
                  )}
                  {getCategoryBadge(email)}
                </div>

                <div className={`text-sm truncate mb-1 ${!email.is_read ? 'font-semibold text-stone-900 dark:text-white' : 'text-stone-600 dark:text-zinc-400'}`}>
                  {email.subject || '(no subject)'}
                </div>

                <div className="text-xs text-stone-500 dark:text-zinc-500 truncate">
                  {email.snippet || email.body_text?.substring(0, 100)}
                </div>

                {/* AI Summary preview */}
                {email.ai_summary && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-lg border border-purple-500/20">
                    <i className="fa-solid fa-wand-magic-sparkles flex-shrink-0"></i>
                    <span className="truncate font-medium">{email.ai_summary}</span>
                  </div>
                )}
              </div>

              {/* Time and actions */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0 self-start pt-1">
                <span className={`text-xs font-medium ${!email.is_read ? 'text-stone-900 dark:text-white' : 'text-stone-500 dark:text-zinc-500'}`}>
                  {formatTime(email.received_at)}
                </span>

                {/* Hover actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive(email);
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-stone-200 dark:hover:bg-zinc-700 flex items-center justify-center text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
                    title="Archive"
                  >
                    <i className="fa-solid fa-box-archive text-xs"></i>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrash(email);
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 flex items-center justify-center text-stone-500 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition"
                    title="Delete"
                  >
                    <i className="fa-solid fa-trash text-xs"></i>
                  </button>
                  <button
                    className="w-8 h-8 rounded-lg hover:bg-stone-200 dark:hover:bg-zinc-700 flex items-center justify-center text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
                    title="Snooze"
                  >
                    <i className="fa-solid fa-clock text-xs"></i>
                  </button>
                </div>
              </div>

              {/* Unread indicator dot */}
              {!email.is_read && (
                <div className={`absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-${accentColor}-500 shadow-lg shadow-${accentColor}-500/50`}></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmailListRedesign;
