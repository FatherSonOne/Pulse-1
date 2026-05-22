// VoxModeToolbar - Unified toolbar component for all 8 Relay modes
// Provides consistent layout: [Back] [Icon+Title]  [AI buttons] [Selection] [Custom] [Menu]

import React from 'react';
import {
  ChevronLeft,
  AlignLeft,
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
  /** Hide the leading back-chevron when there's nothing meaningful to go
      back to — e.g. on a section's home view where the click would no-op.
      Defaults to true to preserve existing behavior across all Relay modes. */
  showBack?: boolean;
  modeIcon: React.ReactNode;
  modeTitle: string;
  modeSubtitle?: string;
  /**
   * Accent color for the mode-icon tile and active-state tints. Defaults to
   * brand rose (`#f43f5e`) — Coral-As-Signal Rule. The prop is retained for
   * downstream flexibility, but callers should generally omit it.
   */
  accentColor?: string;
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
  /** Override the third AI slot's icon. Defaults to <FileText />. Glimpse uses
      this slot for "Draft" (long-form reply draft) instead of meeting notes. */
  notesIcon?: React.ReactNode;
  /** Override the third AI slot's label and tooltip text. Defaults to "Notes". */
  notesLabel?: string;
  notesTitle?: string;

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
  showBack = true,
  modeIcon,
  modeTitle,
  modeSubtitle,
  accentColor = '#f43f5e',
  isDarkMode = false,

  showAI = false,
  onSummarize,
  onSmartReplies,
  onMeetingNotes,
  isSummarizing = false,
  isGeneratingReplies = false,
  isGeneratingNotes = false,
  hasContent = true,
  notesIcon,
  notesLabel = 'Notes',
  notesTitle = 'Generate Meeting Notes',

  isSelectionMode,
  onToggleSelection,

  customActions,
  children,
  onShowHelp,
}) => {
  const textColor = isDarkMode ? 'text-[#fafafa]' : 'text-[#0f0f0f]';
  const subtitleColor = isDarkMode ? 'text-[#b4b4b8]' : 'text-[#52525b]';
  const actionBtnBase = isDarkMode
    ? 'p-2 rounded-lg text-[#b4b4b8] hover:bg-[rgba(255,255,255,0.055)] hover:text-[#fafafa] transition-all duration-200'
    : 'p-2 rounded-lg text-[#52525b] hover:bg-[#f2f2f2] hover:text-[#0f0f0f] transition-all duration-200';

  return (
    <header
      className={`flex items-center gap-2 px-3 md:px-4 py-3 border-b shrink-0 ${
        isDarkMode
          ? 'border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]'
          : 'border-[rgba(0,0,0,0.08)] bg-white'
      }`}
    >
      {/* ← Back — hidden on section home views where the click would no-op */}
      {showBack && (
        <button
          type="button"
          onClick={onBack}
          className={actionBtnBase}
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

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
            isDarkMode ? 'border-[rgba(255,255,255,0.06)]' : 'border-[rgba(0,0,0,0.08)]'
          }`}
        >
          {onSummarize && (
            <button
              type="button"
              onClick={onSummarize}
              disabled={!hasContent || isSummarizing}
              className={`group inline-flex items-center gap-1.5 px-1.5 md:px-2 py-1.5 rounded-md font-mono text-[10px] tracking-[0.12em] uppercase font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-transparent ${
                isDarkMode
                  ? 'text-rose-300 hover:text-rose-200'
                  : 'text-rose-700 hover:text-rose-900'
              }`}
              title="AI Summarize (Ctrl+S)"
            >
              {isSummarizing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <AlignLeft className="w-3 h-3" />
              )}
              <span className="hidden sm:inline-block group-hover:[text-decoration:underline] [text-decoration-thickness:1px] [text-underline-offset:3px]">
                Summarize
              </span>
            </button>
          )}

          {onSmartReplies && (
            <button
              type="button"
              onClick={onSmartReplies}
              disabled={isGeneratingReplies}
              className={`group inline-flex items-center gap-1.5 px-1.5 md:px-2 py-1.5 rounded-md font-mono text-[10px] tracking-[0.12em] uppercase font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-transparent ${
                isDarkMode
                  ? 'text-rose-300 hover:text-rose-200'
                  : 'text-rose-700 hover:text-rose-900'
              }`}
              title="Generate Smart Replies"
            >
              {isGeneratingReplies ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Reply className="w-3 h-3" />
              )}
              <span className="hidden sm:inline-block group-hover:[text-decoration:underline] [text-decoration-thickness:1px] [text-underline-offset:3px]">
                Reply
              </span>
            </button>
          )}

          {onMeetingNotes && (
            <button
              type="button"
              onClick={onMeetingNotes}
              disabled={!hasContent || isGeneratingNotes}
              className={`group inline-flex items-center gap-1.5 px-1.5 md:px-2 py-1.5 rounded-md font-mono text-[10px] tracking-[0.12em] uppercase font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-transparent ${
                isDarkMode
                  ? 'text-rose-300 hover:text-rose-200'
                  : 'text-rose-700 hover:text-rose-900'
              }`}
              title={notesTitle}
            >
              {isGeneratingNotes ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : notesIcon ? (
                <span className="inline-flex [&>svg]:w-3 [&>svg]:h-3">{notesIcon}</span>
              ) : (
                <FileText className="w-3 h-3" />
              )}
              <span className="hidden sm:inline-block group-hover:[text-decoration:underline] [text-decoration-thickness:1px] [text-underline-offset:3px]">
                {notesLabel}
              </span>
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
                <span className="hidden sm:inline-block ml-1.5 text-xs font-medium">
                  {action.label}
                </span>
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

      {/* Selection toggle — always last. aria-label is essential here: the
          CheckCheck glyph is unlabelled visually, so screen-reader users
          would otherwise hear only "button" without context. */}
      <button
        type="button"
        onClick={onToggleSelection}
        title={isSelectionMode ? 'Exit selection mode' : 'Select messages'}
        aria-label={isSelectionMode ? 'Exit selection mode' : 'Select messages'}
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
