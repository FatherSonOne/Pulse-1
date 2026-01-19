/**
 * Annotation Reply Thread Component
 * Shows replies to an annotation with ability to add new replies
 */

import React, { useState } from 'react';
import { Annotation, AnnotationReply } from '../../../types/annotations';

interface AnnotationReplyThreadProps {
  annotation: Annotation;
  onReply: (content: string) => void;
  onDeleteReply?: (replyId: string) => void;
}

export const AnnotationReplyThread: React.FC<AnnotationReplyThreadProps> = ({
  annotation,
  onReply,
  onDeleteReply,
}) => {
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!replyText.trim()) return;

    setIsSubmitting(true);
    try {
      await onReply(replyText.trim());
      setReplyText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-3">
      {/* Existing replies */}
      {annotation.replies && annotation.replies.length > 0 && (
        <div className="space-y-2">
          {annotation.replies.map((reply: AnnotationReply) => (
            <div
              key={reply.id}
              className="pl-3 border-l-2 border-gray-200 dark:border-gray-700"
            >
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {reply.content}
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-400">
                  {formatDate(reply.created_at)}
                </span>
                {onDeleteReply && (
                  <button
                    onClick={() => onDeleteReply(reply.id)}
                    className="text-[10px] text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
          <i className="fa fa-reply text-xs text-rose-500"></i>
        </div>
        <div className="flex-1">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a reply..."
            className="w-full px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-rose-500 focus:outline-none resize-none text-gray-900 dark:text-white placeholder-gray-400"
            rows={2}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-gray-400">
              Press Enter to send
            </span>
            <button
              onClick={handleSubmit}
              disabled={!replyText.trim() || isSubmitting}
              className="px-2 py-1 text-xs bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
            >
              {isSubmitting ? (
                <i className="fa fa-spinner fa-spin"></i>
              ) : (
                'Reply'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotationReplyThread;
