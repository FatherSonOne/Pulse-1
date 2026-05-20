// ============================================
// CONVERSATION CONTEXT
// Pre-message context card shown before navigating to messaging.
// Gives the user a quick brief on the relationship + conversation starters.
// Auto-dismisses after 6 seconds or on user interaction.
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import { Contact } from '../../types';
import { RelationshipProfile } from '../../types/relationshipTypes';

import { X } from 'lucide-react';

// ==================== TYPES ====================

interface ConversationContextProps {
  contact: Contact;
  profile?: RelationshipProfile | null;
  onProceed: () => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 6000;

// ==================== COMPONENT ====================

export const ConversationContext: React.FC<ConversationContextProps> = ({
  contact,
  profile,
  onProceed,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fade in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss countdown
  useEffect(() => {
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(remaining);
      if (remaining === 0) {
        clearInterval(timerRef.current!);
        handleProceed();
      }
    }, 50);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleProceed() {
    if (timerRef.current) clearInterval(timerRef.current);
    setVisible(false);
    setTimeout(onProceed, 200);
  }

  function handleDismiss() {
    if (timerRef.current) clearInterval(timerRef.current);
    setVisible(false);
    setTimeout(onDismiss, 200);
  }

  const talkingPoints = profile?.aiTalkingPoints?.slice(0, 3) ?? [];
  const summary = profile?.aiRelationshipSummary;

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-[60] w-80
        bg-white dark:bg-zinc-900
        border border-zinc-200 dark:border-zinc-700
        rounded-2xl shadow-2xl
        transition-all duration-200
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
    >
      {/* Progress bar (auto-dismiss countdown) */}
      <div className="h-1 bg-zinc-100 dark:bg-zinc-800 rounded-t-2xl overflow-hidden">
        <div
          className="h-full bg-rose-500 transition-none rounded-t-2xl"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: contact.avatarColor || '#6366f1' }}
            >
              {contact.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 leading-none">
                {contact.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Before you message…
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="w-6 h-6 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="text-xs" />
          </button>
        </div>

        {/* AI Summary snippet */}
        {summary && (
          <div className="mb-3 p-2.5 bg-rose-50 dark:bg-rose-900/15 rounded-lg border border-rose-100 dark:border-rose-900/30">
            <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed line-clamp-3">
              {summary}
            </p>
          </div>
        )}

        {/* Conversation starters */}
        {talkingPoints.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">
              Conversation starters
            </p>
            <ul className="space-y-1">
              {talkingPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                  <span className="text-rose-400 mt-0.5">•</span>
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* No profile data fallback */}
        {!summary && talkingPoints.length === 0 && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3 italic">
            No conversation history yet — this could be your first message!
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleProceed}
            className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Open Messages →
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConversationContext;
