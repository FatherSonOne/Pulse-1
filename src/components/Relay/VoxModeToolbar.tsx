// VoxModeToolbar - Unified toolbar component for all 8 Relay modes
// Provides consistent layout: [Back] [Icon+Title]  [AI buttons] [Selection] [Custom] [Menu]

import React from 'react';
import {
  ChevronLeft,
  Sparkles,
  Reply,
  FileText,
  CheckCheck,
  Loader2,
  HelpCircle,
} from 'lucide-react';

export interface VoxToolbarCustomAction {
  icon: React.ReactNode;
  label?: string;
  title?: string;
  onClick: () => void;
  /** Override active style (e.g. accent background when pressed) */
  isActive?: boolean;
  /** Disable the button */
  disabled?: boolean;
}

export interface VoxModeToolbarProps {
  // Header identity
  onBack: () => void;
  modeIcon: React.ReactNode;
  modeTitle: string;
  modeSubtitle?: string;
  accentColor: string;
  isDarkMode?: boolean;

  // AI features
  showAI?: boolean;
  onSummarize?: () => void;
  onSmartReplies?: () => void;
  onMeetingNotes?: () => void;
  isSummarizing?: boolean;
  isGeneratingReplies?: boolean;
  isGeneratingNotes?: boolean;
  /** Disable AI buttons when there is no content to process */
  hasContent?: boolean;

  // Selection mode
  isSelectionMode: boolean;
  onToggleSelection: () => void;
  selectionCount?: number;

  // Mode-specific extra actions placed BEFORE the selection button
  customActions?: VoxToolbarCustomAction[];

  // Optional extra content rendered inside the right action group
  children?: React.ReactNode;

  // Mobile: show help/shortcuts button (touch devices can't use ? key)
  onShowHelp?: () => void;
}

/**
 * VoxModeToolbar
 *
 * Standard header for all 8 Relay communication modes.
 *
 * Layout (left → right):
 *   [← Back]  [Icon  Title / Subtitle]  ···  [AI: Summarize] [AI: Reply] [AI: Notes]  [Custom…]  [☐ Select]
 *
 * All AI buttons are hidden when `showAI` is false or undefined.
 * Custom actions are placed between the AI group and the selection button.
 */
const VoxModeToolbar: React.FC<VoxModeToolbarProps> = ({
  onBack,
  modeIcon,
  modeTitle,
  modeSubtitle,
  accentColor,
  isDarkMode = false,

  showAI = false,
  onSummarize,
  onSmartReplies,
  onMeetingNotes,
  isSummarizing = false,
  isGeneratingReplies = false,
  isGeneratingNotes = false,
  hasContent = true,

  isSelectionMode,
  onToggleSelection,

  customActions,
  children,
  onShowHelp,
}) => {
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtitleColor = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const actionBtnBase = isDarkMode
    ? 'p-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-all duration-200'
    : 'p-2 rounded-lg text-gray-500 hover:bg-black/10 hover:text-gray-900 transition-all duration-200';

  return (
    <header
      className={`flex items-center gap-2 px-3 md:px-4 py-3 border-b shrink-0 ${
        isDarkMode ? 'border-white/10 bg-gray-900/80' : 'border-gray-200/80 bg-white/80'
      } backdrop-blur-sm`}
    >
      {/* ← Back */}
      <button
        type="button"
        onClick={onBack}
        className={actionBtnBase}
        aria-label="Go back"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Mode icon badge */}
      <div
        className="p-2 rounded-xl shadow-lg shrink-0"
        style={{
          background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
          boxShadow: `0 4px 12px ${accentColor}40`,
        }}
      >
        <span className="text-white [&>svg]:w-4 [&>svg]:h-4 [&>svg]:md:w-5 [&>svg]:md:h-5 flex items-center">
          {modeIcon}
        </span>
      </div>

      {/* Title + subtitle */}
      <div className="flex-1 min-w-0">
        <h1 className={`text-base md:text-lg font-bold leading-tight truncate ${textColor}`}>
          {modeTitle}
        </h1>
        {modeSubtitle && (
          <p className={`text-[11px] md:text-xs truncate hidden sm:block ${subtitleColor}`}>
            {modeSubtitle}
          </p>
        )}
      </div>

      {/* ── Right-side actions ── */}

      {/* AI Enhancement buttons */}
      {showAI && (
        <div
          className={`flex items-center gap-1 border-r pr-2 mr-1 ${
            isDarkMode ? 'border-white/10' : 'border-gray-200'
          }`}
        >
          {onSummarize && (
            <button
              type="button"
              onClick={onSummarize}
              disabled={!hasContent || isSummarizing}
              className="p-1.5 md:px-2.5 md:py-1.5 rounded-lg bg-purple-500 text-white text-xs font-medium hover:bg-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              title="AI Summarize (Ctrl+S)"
            >
              {isSummarizing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              <span className="hidden md:inline">Summarize</span>
            </button>
          )}

          {onSmartReplies && (
            <button
              type="button"
              onClick={onSmartReplies}
              disabled={isGeneratingReplies}
              className="p-1.5 md:px-2.5 md:py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              title="Generate Smart Replies"
            >
              {isGeneratingReplies ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Reply className="w-3 h-3" />
              )}
              <span className="hidden md:inline">Quick Reply</span>
            </button>
          )}

          {onMeetingNotes && (
            <button
              type="button"
              onClick={onMeetingNotes}
              disabled={!hasContent || isGeneratingNotes}
              className="p-1.5 md:px-2.5 md:py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              title="Generate Meeting Notes"
            >
              {isGeneratingNotes ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <FileText className="w-3 h-3" />
              )}
              <span className="hidden md:inline">Notes</span>
            </button>
          )}
        </div>
      )}

      {/* Custom mode-specific actions */}
      {customActions && customActions.length > 0 && (
        <div className="flex items-center gap-1">
          {customActions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.title ?? action.label}
              className={actionBtnBase + (action.disabled ? ' opacity-50 cursor-not-allowed' : '')}
              style={
                action.isActive
                  ? { background: `${accentColor}22`, color: accentColor }
                  : undefined
              }
            >
              {action.icon}
              {action.label && (
                <span className="ml-1 text-xs hidden lg:inline">{action.label}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Optional injected children */}
      {children}

      {/* Mobile help button — only shown on touch/small screens where ? key isn't available */}
      {onShowHelp && (
        <button
          type="button"
          onClick={onShowHelp}
          title="Keyboard shortcuts (?)"
          className={actionBtnBase + ' md:hidden'}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      )}

      {/* Selection toggle — always last */}
      <button
        type="button"
        onClick={onToggleSelection}
        title={isSelectionMode ? 'Exit selection mode' : 'Select messages'}
        className={actionBtnBase}
        style={
          isSelectionMode
            ? { background: `${accentColor}22`, color: accentColor }
            : undefined
        }
      >
        <CheckCheck className="w-4 h-4" />
      </button>
    </header>
  );
};

export default VoxModeToolbar;
