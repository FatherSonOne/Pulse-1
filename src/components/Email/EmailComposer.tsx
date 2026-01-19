// src/components/Email/EmailComposer.tsx
import React, { useState, useRef } from 'react';
import { Email, EmailAddress } from '../../types/email';
import toast from 'react-hot-toast';

interface EmailComposerProps {
  userEmail: string;
  userName: string;
  replyTo?: Email | null;
  onClose: () => void;
  onSend: (email: Partial<Email>) => Promise<void>;
}

export const EmailComposer: React.FC<EmailComposerProps> = ({
  userEmail,
  userName,
  replyTo,
  onClose,
  onSend,
}) => {
  const [to, setTo] = useState<string>(replyTo ? replyTo.from.email : '');
  const [cc, setCc] = useState<string>('');
  const [bcc, setBcc] = useState<string>('');
  const [subject, setSubject] = useState<string>(
    replyTo ? `Re: ${replyTo.subject}` : ''
  );
  const [body, setBody] = useState<string>(
    replyTo
      ? `\n\n---\nOn ${new Date(replyTo.date).toLocaleString()}, ${replyTo.from.name || replyTo.from.email} wrote:\n\n${replyTo.body}`
      : ''
  );
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseEmails = (emailString: string): EmailAddress[] => {
    return emailString
      .split(',')
      .map(e => e.trim())
      .filter(e => e)
      .map(e => ({ email: e }));
  };

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error('Please enter a recipient');
      return;
    }
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }

    setSending(true);
    try {
      await onSend({
        from: { name: userName, email: userEmail },
        to: parseEmails(to),
        cc: cc ? parseEmails(cc) : undefined,
        bcc: bcc ? parseEmails(bcc) : undefined,
        subject,
        body,
        snippet: body.substring(0, 100),
        labels: ['sent'],
        isRead: true,
        isStarred: false,
        isImportant: false,
        isDraft: false,
        isArchived: false,
        isTrashed: false,
        timestamp: Date.now(),
        date: new Date().toISOString(),
        replyTo: replyTo?.id,
      });
    } catch (error) {
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = () => {
    toast.success('Draft saved');
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl w-80 animate-slideInUp">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-sm font-medium text-white truncate">
            {subject || 'New Message'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(false)}
              className="w-6 h-6 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-400"
            >
              <i className="fa-solid fa-window-maximize text-xs"></i>
            </button>
            <button
              onClick={onClose}
              className="w-6 h-6 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-400"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div
        className={`bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col animate-scaleIn ${
          isMaximized ? 'w-full h-full m-4' : 'w-[700px] max-h-[85vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900 rounded-t-xl">
          <span className="text-sm font-semibold text-white">
            {replyTo ? 'Reply' : 'New Message'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="w-7 h-7 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
              title="Minimize"
            >
              <i className="fa-solid fa-window-minimize text-xs"></i>
            </button>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="w-7 h-7 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              <i className={`fa-solid ${isMaximized ? 'fa-window-restore' : 'fa-window-maximize'} text-xs`}></i>
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
              title="Close"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Recipients */}
          <div className="px-4 py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 w-12">To:</span>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Recipients"
                className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-zinc-600"
              />
              <div className="flex items-center gap-2 text-xs">
                {!showCc && (
                  <button
                    onClick={() => setShowCc(true)}
                    className="text-zinc-500 hover:text-white transition"
                  >
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button
                    onClick={() => setShowBcc(true)}
                    className="text-zinc-500 hover:text-white transition"
                  >
                    Bcc
                  </button>
                )}
              </div>
            </div>
          </div>

          {showCc && (
            <div className="px-4 py-2 border-b border-zinc-800/50">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500 w-12">Cc:</span>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="Carbon copy"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-zinc-600"
                />
              </div>
            </div>
          )}

          {showBcc && (
            <div className="px-4 py-2 border-b border-zinc-800/50">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500 w-12">Bcc:</span>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="Blind carbon copy"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-zinc-600"
                />
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="px-4 py-2 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 w-12">Subject:</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-zinc-600"
              />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Compose your email..."
              className="w-full h-full p-4 bg-transparent text-white text-sm focus:outline-none resize-none placeholder-zinc-600"
            />
          </div>

          {/* Toolbar */}
          <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={handleSend}
                disabled={sending}
                className="bg-red-500 hover:bg-red-600 disabled:bg-zinc-700 text-white px-6 py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-all btn-pulse flex items-center gap-2"
              >
                {sending ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i>
                    Send
                  </>
                )}
              </button>

              {/* Formatting toolbar */}
              <div className="flex items-center gap-1 ml-4 border-l border-zinc-800 pl-4">
                <button className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition" title="Bold">
                  <i className="fa-solid fa-bold text-xs"></i>
                </button>
                <button className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition" title="Italic">
                  <i className="fa-solid fa-italic text-xs"></i>
                </button>
                <button className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition" title="Underline">
                  <i className="fa-solid fa-underline text-xs"></i>
                </button>
                <button className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition" title="Link">
                  <i className="fa-solid fa-link text-xs"></i>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition"
                title="Attach file"
              >
                <i className="fa-solid fa-paperclip"></i>
              </button>
              <button
                onClick={handleSaveDraft}
                className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition"
                title="Save draft"
              >
                <i className="fa-solid fa-floppy-disk"></i>
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded hover:bg-red-500/20 flex items-center justify-center text-zinc-500 hover:text-red-500 transition"
                title="Discard"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailComposer;
