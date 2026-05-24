// src/components/Messages/BotMessage.tsx
// Renders bot messages from Entomate and other ecosystem apps
// Bot messages bypass E2EE — they use bot_content (plaintext)

import React, { useState } from 'react';
import { ExternalLink, Star, Loader2 } from 'lucide-react';
import { SmartTimestamp } from './SmartTimestamp';
import { MeetingRecapCard } from './MeetingRecapCard';
import { MeetingBriefingCard } from './MeetingBriefingCard';
import { ActionItemsCard } from './ActionItemsCard';
import { AIProvenanceTag } from '../shared/AIProvenanceTag';
import { supabase } from '../../services/supabase';
import { getMeetingRecordingById, exportMeetingToEntomate } from '../../services/meetingService';
import type { BotChannelMessage, BotAction } from '../../types/messages';

interface BotMessageProps {
  message: BotChannelMessage;
}

const BOT_CONFIG: Record<string, { name: string; emoji: string; avatarBg: string; accentColor: string }> = {
  entomate: {
    name: 'Entomate',
    emoji: '🤖',
    avatarBg: 'bg-[rgba(244,63,94,0.10)] ring-1 ring-[rgba(244,63,94,0.20)]',
    accentColor: 'ring-1 ring-[rgba(244,63,94,0.20)] bg-[rgba(244,63,94,0.08)]',
  },
  logos_vision: {
    name: 'Logos Vision',
    emoji: '🔮',
    avatarBg: 'bg-[rgba(244,63,94,0.10)] ring-1 ring-[rgba(244,63,94,0.20)]',
    accentColor: 'ring-1 ring-[rgba(244,63,94,0.20)] bg-[rgba(244,63,94,0.08)]',
  },
};

export const BotMessage: React.FC<BotMessageProps> = ({ message }) => {
  const [ratingState, setRatingState] = useState<{ rating: number; submitted: boolean } | null>(null);
  const [exportAllState, setExportAllState] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle');

  const bot = BOT_CONFIG[message.bot_app] || {
    name: message.bot_app,
    emoji: '🤖',
    avatarBg: 'bg-zinc-500/15 ring-1 ring-zinc-500/30',
    accentColor: 'ring-1 ring-zinc-500/30 bg-zinc-500/[0.06]',
  };

  const handleAction = (action: BotAction) => {
    if (action.url) {
      window.open(action.url, '_blank', 'noopener,noreferrer');
      return;
    }
    // Rate meeting — show inline star rating
    if (action.action === 'rate_meeting' && action.meetingId) {
      setRatingState({ rating: 0, submitted: false });
      return;
    }
    // Export all recordings to Entomate
    if (action.action === 'export_all_recordings') {
      handleExportAll();
      return;
    }
    // View profile — open in Entomate
    if (action.action === 'view_profile' && action.profileSlug) {
      const entomate = message.bot_metadata?.sourceUrl;
      // Derive the Entomate base URL from the meeting URL, or use a sensible default
      const baseUrl = entomate
        ? new URL(entomate).origin
        : 'https://entomate.app';
      window.open(`${baseUrl}/profiles/${action.profileSlug}`, '_blank', 'noopener,noreferrer');
    }
  };

  const submitRating = async (rating: number, meetingId: string) => {
    setRatingState({ rating, submitted: true });
    // Send meeting.feedback event to Entomate via ecosystem-outbound edge function
    try {
      const { error } = await supabase.functions.invoke('ecosystem-outbound', {
        body: {
          eventType: 'meeting.feedback',
          targetApp: 'entomate',
          data: { meetingId, rating },
        },
      });
      if (error) console.warn('[BotMessage] Failed to submit meeting rating:', error.message);
    } catch {
      // Non-critical — rating is best-effort
    }
  };

  const handleExportAll = async () => {
    const recordings = message.bot_metadata?.recordings || [];
    if (!recordings.length || exportAllState === 'exporting') return;
    setExportAllState('exporting');
    try {
      let failed = 0;
      for (const rec of recordings) {
        const fullRecording = await getMeetingRecordingById(rec.id, rec.source);
        if (fullRecording) {
          const result = await exportMeetingToEntomate(fullRecording, rec.source);
          if (!result.success) failed++;
        } else {
          failed++;
        }
      }
      setExportAllState(failed === recordings.length ? 'error' : 'done');
    } catch {
      setExportAllState('error');
    }
  };

  return (
    <div className="group flex items-start gap-3 py-2 px-1 rounded-xl hover:bg-white/[0.02] transition-colors">
      {/* Bot Avatar */}
      <div className={`w-9 h-9 rounded-lg ${bot.avatarBg} flex items-center justify-center flex-shrink-0`}>
        <span className="text-base leading-none">{bot.emoji}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-semibold text-zinc-200">{bot.name}</span>
          {/* PR 4.4: bot messages ARE AI-generated content, so the
              badge is provenance, not a neutral identity tag.
              Migrated from a hand-rolled zinc chip to the shared
              coral AIProvenanceTag. */}
          <AIProvenanceTag source="pulse-ai" kind="bot" showDot={false} />
          <SmartTimestamp time={message.created_at} />
        </div>

        {/* Message body — rendered by type */}
        {message.bot_message_type === 'meeting_recap' ? (
          <MeetingRecapCard
            content={message.bot_content}
            metadata={message.bot_metadata}
            actions={message.bot_actions}
            onAction={handleAction}
          />
        ) : message.bot_message_type === 'meeting_briefing' ? (
          <MeetingBriefingCard
            content={message.bot_content}
            metadata={message.bot_metadata}
            actions={message.bot_actions}
            onAction={handleAction}
          />
        ) : message.bot_message_type === 'action_items' ? (
          <ActionItemsCard
            content={message.bot_content}
            metadata={message.bot_metadata}
            actions={message.bot_actions}
            onAction={handleAction}
          />
        ) : message.bot_message_type === 'alert' ? (
          <AlertCard
            content={message.bot_content}
            metadata={message.bot_metadata}
            actions={message.bot_actions}
            onAction={handleAction}
          />
        ) : (
          // Default: plain text with markdown
          <TextCard
            content={message.bot_content}
            actions={message.bot_actions}
            onAction={handleAction}
          />
        )}

        {/* Export all status */}
        {exportAllState === 'exporting' && (
          <div className="mt-2 flex items-center gap-2 text-xs text-[var(--pulse-rose-text)] bg-[rgba(244,63,94,0.08)] ring-1 ring-[rgba(244,63,94,0.20)] rounded-lg px-3 py-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Exporting recordings to Entomate...</span>
          </div>
        )}
        {exportAllState === 'done' && (
          <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/[0.08] ring-1 ring-emerald-500/30 rounded-lg px-3 py-2">
            <span>All recordings exported to Entomate!</span>
          </div>
        )}
        {exportAllState === 'error' && (
          <div className="mt-2 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-500/[0.08] ring-1 ring-rose-500/30 rounded-lg px-3 py-2">
            <span>Some recordings failed to export. Try again later.</span>
          </div>
        )}

        {/* Inline rating UI (triggered by "Rate This Summary" action) */}
        {ratingState && (
          <InlineRating
            rating={ratingState.rating}
            submitted={ratingState.submitted}
            meetingId={message.bot_metadata?.meetingId || ''}
            onRate={(r) => submitRating(r, message.bot_metadata?.meetingId || '')}
            onClose={() => setRatingState(null)}
          />
        )}
      </div>
    </div>
  );
};

// ── Inline rating (Phase 4: feedback loop) ─────────────────────────────────

function InlineRating({ rating, submitted, meetingId, onRate, onClose }: {
  rating: number;
  submitted: boolean;
  meetingId: string;
  onRate: (r: number) => void;
  onClose: () => void;
}) {
  const [hovered, setHovered] = useState(0);

  if (submitted) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/[0.08] ring-1 ring-emerald-500/30 rounded-lg px-3 py-2">
        <span>Thanks for your feedback!</span>
        <span className="text-rose-500/70 dark:text-rose-bright/70">
          {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
        </span>
        <button type="button" onClick={onClose} className="ml-auto text-zinc-500 hover:text-zinc-300">dismiss</button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-3 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2">
      <span className="text-xs text-zinc-400">Rate this summary:</span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <button
            key={i}
            type="button"
            title={`Rate ${i + 1} star${i > 0 ? 's' : ''}`}
            onMouseEnter={() => setHovered(i + 1)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onRate(i + 1)}
            className="p-0.5 transition-transform"
          >
            <Star className={`w-4 h-4 transition-colors ${
              (hovered || rating) > i
                ? 'text-rose-500 fill-rose-500 dark:text-rose-bright dark:fill-rose-bright'
                : 'text-zinc-600'
            }`} />
          </button>
        ))}
      </div>
      <button type="button" onClick={onClose} className="ml-auto text-xs text-zinc-500 hover:text-zinc-300">cancel</button>
    </div>
  );
}

// ── Inline card components ─────────────────────────────────────────────────

interface CardProps {
  content: string;
  metadata?: Record<string, any>;
  actions: BotAction[];
  onAction: (action: BotAction) => void;
}

function AlertCard({ content, actions, onAction }: CardProps) {
  const isError = content.includes('❌') || content.toLowerCase().includes('failed');
  const isSuccess = content.includes('✅') || content.toLowerCase().includes('success');

  const colors = isError
    ? 'ring-1 ring-rose-500/30 bg-rose-500/[0.06]'
    : isSuccess
    ? 'ring-1 ring-emerald-500/30 bg-emerald-500/[0.06]'
    : 'ring-1 ring-amber-500/30 bg-amber-500/[0.06]';

  return (
    <div className={`rounded-xl ${colors} overflow-hidden mt-1`}>
      <div className="px-4 py-3">
        <SimpleMarkdown text={content} />
      </div>
      {actions.length > 0 && (
        <div className="px-4 py-3 border-t border-white/[0.06] flex flex-wrap gap-2">
          {actions.map((action, i) => (
            <ActionButton key={i} action={action} onAction={onAction} />
          ))}
        </div>
      )}
    </div>
  );
}

function TextCard({ content, actions, onAction }: CardProps) {
  return (
    <div>
      <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
        <SimpleMarkdown text={content} />
      </div>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {actions.map((action, i) => (
            <ActionButton key={i} action={action} onAction={onAction} variant="ghost" />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  action,
  onAction,
  variant = 'default',
}: {
  action: BotAction;
  onAction: (a: BotAction) => void;
  variant?: 'default' | 'ghost';
}) {
  const base = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition';
  const styles = variant === 'ghost'
    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
    : 'bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 border border-white/[0.08]';

  return (
    <button
      type="button"
      onClick={() => onAction(action)}
      className={`${base} ${styles}`}
    >
      {action.url && <ExternalLink className="w-3 h-3" />}
      {action.label}
    </button>
  );
}

/** Minimal inline markdown renderer */
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <div key={i} className="text-sm font-bold text-white mb-1 mt-2 first:mt-0">
              {line.replace('## ', '')}
            </div>
          );
        }
        if (line.startsWith('### ')) {
          return (
            <div key={i} className="text-xs font-semibold text-zinc-300 mb-0.5 mt-1">
              {line.replace('### ', '')}
            </div>
          );
        }
        if (line.startsWith('---')) {
          return <hr key={i} className="border-[rgba(255,255,255,0.10)]/50 my-2" />;
        }
        if (!line.trim()) return <div key={i} className="h-1" />;

        // Bold spans
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <div key={i} className="text-sm text-zinc-300 leading-relaxed">
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j} className="text-white font-semibold">{part.slice(2, -2)}</strong>
                : part
            )}
          </div>
        );
      })}
    </>
  );
}

export default BotMessage;
