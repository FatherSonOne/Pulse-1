// src/components/Email/EmailViewer.tsx
import React from 'react';
import { Email } from '../../types/email';

interface EmailViewerProps {
  email: Email;
  onClose: () => void;
  onReply: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
}

export const EmailViewer: React.FC<EmailViewerProps> = ({
  email,
  onClose,
  onReply,
  onDelete,
  onArchive,
  onToggleStar,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 animate-slideInRight">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition text-zinc-400 hover:text-white"
            title="Close"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h2 className="text-lg font-semibold text-white truncate max-w-md">
            {email.subject}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleStar}
            className="w-9 h-9 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition"
            title={email.isStarred ? 'Remove star' : 'Add star'}
          >
            <i className={`fa-${email.isStarred ? 'solid' : 'regular'} fa-star ${
              email.isStarred ? 'text-yellow-500' : 'text-zinc-400'
            }`}></i>
          </button>
          <button
            onClick={onArchive}
            className="w-9 h-9 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition text-zinc-400 hover:text-white"
            title="Archive"
          >
            <i className="fa-solid fa-box-archive"></i>
          </button>
          <button
            onClick={onDelete}
            className="w-9 h-9 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition text-zinc-400 hover:text-red-500"
            title="Delete"
          >
            <i className="fa-solid fa-trash"></i>
          </button>
          <button
            className="w-9 h-9 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition text-zinc-400 hover:text-white"
            title="More options"
          >
            <i className="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </div>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Subject & Labels */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-3">{email.subject}</h1>
          <div className="flex items-center gap-2">
            {email.isImportant && (
              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full flex items-center gap-1">
                <i className="fa-solid fa-bookmark text-[10px]"></i>
                Important
              </span>
            )}
            {email.labels.filter(l => !['inbox', 'sent', 'archive', 'trash'].includes(l)).map(label => (
              <span key={label} className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded-full">
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Sender Info */}
        <div className="flex items-start gap-4 mb-6 pb-6 border-b border-zinc-800">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-lg font-bold">
              {(email.from.name || email.from.email).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">
                  {email.from.name || email.from.email}
                </h3>
                <p className="text-sm text-zinc-500">{email.from.email}</p>
              </div>
              <span className="text-sm text-zinc-500">{formatDate(email.date)}</span>
            </div>
            <div className="mt-2 text-sm text-zinc-500">
              <span>To: </span>
              {email.to.map((addr, i) => (
                <span key={i}>
                  {addr.name || addr.email}
                  {i < email.to.length - 1 && ', '}
                </span>
              ))}
              {email.cc && email.cc.length > 0 && (
                <>
                  <span className="ml-2">CC: </span>
                  {email.cc.map((addr, i) => (
                    <span key={i}>
                      {addr.name || addr.email}
                      {i < (email.cc?.length || 0) - 1 && ', '}
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Email Body */}
        <div className="prose prose-invert prose-sm max-w-none">
          <div className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {email.body}
          </div>
        </div>

        {/* Attachments */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="mt-8 pt-6 border-t border-zinc-800">
            <h4 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-paperclip"></i>
              {email.attachments.length} Attachment{email.attachments.length > 1 ? 's' : ''}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {email.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-700 transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <i className={`fa-solid ${
                      attachment.mimeType.includes('pdf') ? 'fa-file-pdf text-red-400' :
                      attachment.mimeType.includes('image') ? 'fa-file-image text-blue-400' :
                      attachment.mimeType.includes('word') ? 'fa-file-word text-blue-500' :
                      attachment.mimeType.includes('sheet') || attachment.mimeType.includes('excel') ? 'fa-file-excel text-green-500' :
                      'fa-file text-zinc-400'
                    }`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{attachment.filename}</p>
                    <p className="text-xs text-zinc-500">{formatFileSize(attachment.size)}</p>
                  </div>
                  <button className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <i className="fa-solid fa-download text-sm text-zinc-400"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reply Bar */}
      <div className="px-6 py-4 border-t border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onReply}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all btn-pulse flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-reply"></i>
            Reply
          </button>
          <button
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-sm uppercase tracking-wider transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-reply-all"></i>
            Reply All
          </button>
          <button
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-sm uppercase tracking-wider transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-share"></i>
            Forward
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailViewer;
