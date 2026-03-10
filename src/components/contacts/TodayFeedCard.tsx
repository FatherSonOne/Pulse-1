// ============================================
// TODAY FEED CARD
// Individual action card for the Today relationship feed.
// ============================================

import React, { useState, useRef, useEffect } from 'react';
import { Bot, EllipsisVertical, Wand2, X } from 'lucide-react';
import {

  TodayFeedItem,
  TodayFeedSuggestedAction,
  FEED_ITEM_TYPE_CONFIG,
  SUGGESTED_ACTION_LABEL,
  SUGGESTED_ACTION_ICON,
  SNOOZE_DURATIONS,
} from '../../types/todayFeedTypes';

// ==================== HELPERS ====================

function getRelationshipRingColor(score?: number): string {
  if (score === undefined) return 'ring-zinc-300 dark:ring-zinc-600';
  if (score >= 70) return 'ring-emerald-400 dark:ring-emerald-500';
  if (score >= 40) return 'ring-amber-400 dark:ring-amber-500';
  return 'ring-rose-400 dark:ring-rose-500';
}

function getAvatarInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function timeSince(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ==================== TYPES ====================

interface TodayFeedCardProps {
  item: TodayFeedItem;
  onAction: (action: TodayFeedSuggestedAction, contactId: string) => void;
  onSnooze: (id: string, until: Date) => void;
  onDismiss: (id: string) => void;
  onComplete: (id: string) => void;
}

// ==================== COMPONENT ====================

export const TodayFeedCard: React.FC<TodayFeedCardProps> = ({
  item,
  onAction,
  onSnooze,
  onDismiss,
  onComplete,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const typeConfig = FEED_ITEM_TYPE_CONFIG[item.itemType];
  const ringColor = getRelationshipRingColor(item.relationshipScore);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Animated exit helper
  function exitWith(callback: () => void) {
    setIsExiting(true);
    setTimeout(callback, 300);
  }

  function handlePrimaryAction() {
    exitWith(() => {
      onComplete(item.id);
      onAction(item.suggestedAction, item.contactId);
    });
  }

  function handleSnooze(minutes: number) {
    setShowMenu(false);
    const until = new Date(Date.now() + minutes * 60 * 1000);
    exitWith(() => onSnooze(item.id, until));
  }

  function handleDismiss() {
    setShowMenu(false);
    exitWith(() => onDismiss(item.id));
  }

  return (
    <div
      className={`
        relative bg-white dark:bg-zinc-900 border rounded-xl overflow-hidden
        transition-all duration-300 ease-in-out
        ${isExiting ? 'opacity-0 scale-95 -translate-y-1 max-h-0' : 'opacity-100 scale-100 max-h-96'}
        ${typeConfig.colorClass} border-l-4
        shadow-sm hover:shadow-md
      `}
    >
      {/* Main content row */}
      <div className="flex items-start gap-3 p-4">

        {/* Avatar with relationship ring */}
        <div className="flex-shrink-0">
          <div
            className={`
              w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm
              ring-2 ${ringColor} ring-offset-1 ring-offset-white dark:ring-offset-zinc-900
            `}
            style={{ backgroundColor: item.contactAvatarColor ?? '#6366f1' }}
          >
            {getAvatarInitial(item.contactName)}
          </div>
        </div>

        {/* Center content */}
        <div className="flex-1 min-w-0">
          {/* Type badge + autopilot badge + time */}
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <span>{typeConfig.icon}</span>
              <span>{typeConfig.label}</span>
            </span>
            {item.metadata?.isAutopilot && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <Bot className="text-[9px]" />
                Autopilot
              </span>
            )}
            <span className="text-xs text-zinc-400 dark:text-zinc-600">·</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{timeSince(item.createdAt)}</span>
          </div>

          {/* Title */}
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 leading-tight">
            {item.title}
          </p>

          {/* Subtitle */}
          {item.subtitle && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
              {item.subtitle}
            </p>
          )}

          {/* AI Draft preview (collapsible) */}
          {item.aiDraftMessage && (
            <div className="mt-2">
              {showDraft ? (
                <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-2.5 border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 italic leading-relaxed">
                    "{item.aiDraftMessage}"
                  </p>
                  <button
                    onClick={() => setShowDraft(false)}
                    className="text-xs text-indigo-500 dark:text-indigo-400 mt-1.5 hover:underline"
                  >
                    Hide draft
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDraft(true)}
                  className="flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 mt-1 transition-colors"
                >
                  <Wand2 className="text-xs" />
                  <span>View AI draft</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {/* Primary action button */}
          <button
            onClick={handlePrimaryAction}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white text-xs font-medium transition-colors"
          >
            <i className={`${SUGGESTED_ACTION_ICON[item.suggestedAction]} text-xs`} />
            <span className="hidden sm:inline">{SUGGESTED_ACTION_LABEL[item.suggestedAction]}</span>
          </button>

          {/* Overflow menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(v => !v)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="More options"
            >
              <EllipsisVertical className="text-sm" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-8 z-50 w-44 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden">
                {/* Snooze options */}
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-700">
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                    Snooze
                  </p>
                  {SNOOZE_DURATIONS.map(dur => (
                    <button
                      key={dur.label}
                      onClick={() => handleSnooze(dur.minutes)}
                      className="w-full text-left text-xs py-1 px-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
                {/* Dismiss */}
                <button
                  onClick={handleDismiss}
                  className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-xs text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                >
                  <X />
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Relationship score bar (subtle, bottom) */}
      {item.relationshipScore !== undefined && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  item.relationshipScore >= 70
                    ? 'bg-emerald-400'
                    : item.relationshipScore >= 40
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
                style={{ width: `${item.relationshipScore}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 w-8 text-right">
              {item.relationshipScore}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TodayFeedCard;
