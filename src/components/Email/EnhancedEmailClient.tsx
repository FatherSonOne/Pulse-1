// src/components/Email/EnhancedEmailClient.tsx
import React, { useState, useEffect } from 'react';
import { Email, EmailFolder, DEFAULT_EMAIL_FOLDERS, EmailLabel } from '../../types/email';
import { enhancedEmailService } from '../../services/enhancedEmailService';
import toast from 'react-hot-toast';
import { EmailComposer } from './EmailComposer';
import { EmailViewer } from './EmailViewer';

interface EnhancedEmailClientProps {
  userEmail?: string;
  userName?: string;
}

export const EnhancedEmailClient: React.FC<EnhancedEmailClientProps> = ({
  userEmail = 'you@pulse.app',
  userName = 'You',
}) => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [folders, setFolders] = useState<EmailFolder[]>(DEFAULT_EMAIL_FOLDERS);
  const [labels, setLabels] = useState<EmailLabel[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadEmails();
    loadLabels();
  }, [activeFolder]);

  const loadEmails = async () => {
    setLoading(true);
    try {
      const data = await enhancedEmailService.getEmails(activeFolder);
      setEmails(data);
      updateFolderCounts(data);
    } catch (error) {
      // Return empty array on error - no mock data fallback
      console.error('Failed to load emails:', error);
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLabels = async () => {
    const data = await enhancedEmailService.getLabels();
    setLabels(data);
  };

  const updateFolderCounts = (emailList: Email[]) => {
    setFolders(folders.map(folder => ({
      ...folder,
      count: emailList.filter(e => e.labels.includes(folder.id)).length,
      unreadCount: emailList.filter(e => e.labels.includes(folder.id) && !e.isRead).length,
    })));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadEmails();
      return;
    }
    setLoading(true);
    const results = await enhancedEmailService.searchEmails(searchQuery);
    setEmails(results);
    setLoading(false);
  };

  const handleToggleStar = async (email: Email, e: React.MouseEvent) => {
    e.stopPropagation();
    await enhancedEmailService.toggleStar(email.id, !email.isStarred);
    setEmails(emails.map(em =>
      em.id === email.id ? { ...em, isStarred: !em.isStarred } : em
    ));
    toast.success(email.isStarred ? 'Removed from starred' : 'Added to starred');
  };

  const handleMarkAsRead = async (email: Email) => {
    if (!email.isRead) {
      await enhancedEmailService.markAsRead(email.id);
      setEmails(emails.map(em =>
        em.id === email.id ? { ...em, isRead: true } : em
      ));
    }
  };

  const handleDelete = async (email: Email, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await enhancedEmailService.moveToTrash(email.id);
    setEmails(emails.filter(em => em.id !== email.id));
    if (selectedEmail?.id === email.id) {
      setSelectedEmail(null);
    }
    toast.success('Moved to trash');
  };

  const handleArchive = async (email: Email) => {
    await enhancedEmailService.archiveEmail(email.id);
    setEmails(emails.filter(em => em.id !== email.id));
    if (selectedEmail?.id === email.id) {
      setSelectedEmail(null);
    }
    toast.success('Archived');
  };

  const handleReply = (email: Email) => {
    setReplyTo(email);
    setShowComposer(true);
  };

  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
    handleMarkAsRead(email);
  };

  const handleBulkAction = async (action: 'read' | 'unread' | 'delete' | 'archive') => {
    const selectedIds = Array.from(selectedEmails);
    if (selectedIds.length === 0) return;

    for (const id of selectedIds) {
      switch (action) {
        case 'read':
          await enhancedEmailService.markAsRead(id);
          break;
        case 'unread':
          await enhancedEmailService.markAsUnread(id);
          break;
        case 'delete':
          await enhancedEmailService.moveToTrash(id);
          break;
        case 'archive':
          await enhancedEmailService.archiveEmail(id);
          break;
      }
    }

    if (action === 'delete' || action === 'archive') {
      setEmails(emails.filter(em => !selectedEmails.has(em.id)));
    } else {
      setEmails(emails.map(em => {
        if (selectedEmails.has(em.id)) {
          return { ...em, isRead: action === 'read' };
        }
        return em;
      }));
    }

    setSelectedEmails(new Set());
    toast.success(`${selectedIds.length} emails updated`);
  };

  const toggleEmailSelection = (emailId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const unreadCount = emails.filter(e => !e.isRead).length;

  return (
    <div className="h-full flex bg-zinc-950 animate-fadeIn">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-zinc-800 flex flex-col">
        {/* Compose Button */}
        <div className="p-4">
          <button
            onClick={() => { setReplyTo(null); setShowComposer(true); }}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all btn-pulse flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-pen-to-square"></i>
            Compose
          </button>
        </div>

        {/* Folders */}
        <div className="flex-1 overflow-y-auto px-2">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 py-2">
            Folders
          </div>
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => { setActiveFolder(folder.id); setSelectedEmail(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left mb-1 ${
                activeFolder === folder.id
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
              }`}
            >
              <i className={`fa-solid ${folder.icon} w-4 text-center ${folder.color || ''}`}></i>
              <span className="flex-1 text-sm">{folder.name}</span>
              {folder.unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {folder.unreadCount}
                </span>
              )}
            </button>
          ))}

          {/* Labels */}
          {labels.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 py-2 mt-4">
                Labels
              </div>
              {labels.map(label => (
                <button
                  key={label.id}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all text-left mb-1"
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: label.color }}
                  ></span>
                  <span className="flex-1 text-sm">{label.name}</span>
                  <span className="text-xs text-zinc-600">{label.messageCount}</span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Storage */}
        <div className="p-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-500 mb-2">Storage used</div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 rounded-full" style={{ width: '35%' }}></div>
          </div>
          <div className="text-[10px] text-zinc-600 mt-1">5.2 GB of 15 GB</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm"></i>
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition"
            />
          </div>

          {/* Bulk Actions */}
          {selectedEmails.size > 0 && (
            <div className="flex items-center gap-2 animate-fadeIn">
              <span className="text-xs text-zinc-400">{selectedEmails.size} selected</span>
              <button
                onClick={() => handleBulkAction('read')}
                className="p-2 hover:bg-zinc-800 rounded-lg transition text-zinc-400 hover:text-white"
                title="Mark as read"
              >
                <i className="fa-solid fa-envelope-open text-sm"></i>
              </button>
              <button
                onClick={() => handleBulkAction('archive')}
                className="p-2 hover:bg-zinc-800 rounded-lg transition text-zinc-400 hover:text-white"
                title="Archive"
              >
                <i className="fa-solid fa-box-archive text-sm"></i>
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="p-2 hover:bg-red-500/20 rounded-lg transition text-zinc-400 hover:text-red-500"
                title="Delete"
              >
                <i className="fa-solid fa-trash text-sm"></i>
              </button>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={loadEmails}
            className="p-2 hover:bg-zinc-800 rounded-lg transition text-zinc-400 hover:text-white"
            title="Refresh"
          >
            <i className="fa-solid fa-arrows-rotate text-sm"></i>
          </button>
        </div>

        {/* Email List / Reader Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Email List */}
          <div className={`${selectedEmail ? 'w-2/5 border-r border-zinc-800' : 'flex-1'} overflow-y-auto`}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin mx-auto mb-3"></div>
                  <span className="text-zinc-500 text-sm">Loading emails...</span>
                </div>
              </div>
            ) : emails.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-zinc-500">
                  <i className="fa-solid fa-inbox text-4xl mb-3 block text-zinc-700"></i>
                  <p className="text-lg font-medium mb-1">No emails</p>
                  <p className="text-sm">Your {activeFolder} is empty</p>
                </div>
              </div>
            ) : (
              emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => handleSelectEmail(email)}
                  className={`px-4 py-3 border-b border-zinc-800/50 cursor-pointer transition-all group ${
                    selectedEmail?.id === email.id
                      ? 'bg-zinc-800'
                      : !email.isRead
                        ? 'bg-zinc-900/50 hover:bg-zinc-900'
                        : 'hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div
                      onClick={(e) => toggleEmailSelection(email.id, e)}
                      className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center cursor-pointer transition ${
                        selectedEmails.has(email.id)
                          ? 'bg-red-500 border-red-500'
                          : 'border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {selectedEmails.has(email.id) && (
                        <i className="fa-solid fa-check text-[10px] text-white"></i>
                      )}
                    </div>

                    {/* Star */}
                    <button
                      onClick={(e) => handleToggleStar(email, e)}
                      className="flex-shrink-0 mt-0.5"
                    >
                      <i className={`fa-${email.isStarred ? 'solid' : 'regular'} fa-star ${
                        email.isStarred ? 'text-yellow-500' : 'text-zinc-600 hover:text-yellow-500'
                      } transition`}></i>
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm truncate ${!email.isRead ? 'font-semibold text-white' : 'text-zinc-400'}`}>
                          {email.from.name || email.from.email}
                        </span>
                        {email.isImportant && (
                          <i className="fa-solid fa-bookmark text-[10px] text-red-500"></i>
                        )}
                        {email.attachments && email.attachments.length > 0 && (
                          <i className="fa-solid fa-paperclip text-[10px] text-zinc-500"></i>
                        )}
                      </div>
                      <p className={`text-sm truncate ${!email.isRead ? 'text-zinc-200' : 'text-zinc-500'}`}>
                        {email.subject}
                      </p>
                      <p className="text-xs text-zinc-600 truncate mt-0.5">
                        {email.snippet}
                      </p>
                    </div>

                    {/* Time & Actions */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-xs ${!email.isRead ? 'text-red-400 font-medium' : 'text-zinc-600'}`}>
                        {formatDate(email.timestamp)}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleArchive(email); }}
                          className="p-1 hover:bg-zinc-700 rounded"
                          title="Archive"
                        >
                          <i className="fa-solid fa-box-archive text-[10px] text-zinc-500 hover:text-white"></i>
                        </button>
                        <button
                          onClick={(e) => handleDelete(email, e)}
                          className="p-1 hover:bg-red-500/20 rounded"
                          title="Delete"
                        >
                          <i className="fa-solid fa-trash text-[10px] text-zinc-500 hover:text-red-500"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Email Viewer */}
          {selectedEmail && (
            <div className="flex-1 overflow-hidden">
              <EmailViewer
                email={selectedEmail}
                onClose={() => setSelectedEmail(null)}
                onReply={() => handleReply(selectedEmail)}
                onDelete={() => handleDelete(selectedEmail)}
                onArchive={() => handleArchive(selectedEmail)}
                onToggleStar={(e) => handleToggleStar(selectedEmail, e)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Composer Modal */}
      {showComposer && (
        <EmailComposer
          userEmail={userEmail}
          userName={userName}
          replyTo={replyTo}
          onClose={() => { setShowComposer(false); setReplyTo(null); }}
          onSend={async (email) => {
            await enhancedEmailService.sendEmail(email);
            toast.success('Email sent!');
            setShowComposer(false);
            setReplyTo(null);
          }}
        />
      )}
    </div>
  );
};

export default EnhancedEmailClient;
