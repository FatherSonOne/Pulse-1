// useEmailKeyboardShortcuts.ts - Gmail-like keyboard shortcuts for email client
import { useEffect, useCallback } from 'react';
import { CachedEmail } from '../services/emailSyncService';

interface KeyboardShortcutHandlers {
  // Navigation
  onNextEmail?: () => void;
  onPrevEmail?: () => void;
  onOpenEmail?: (email: CachedEmail) => void;
  onCloseEmail?: () => void;

  // Actions
  onCompose?: () => void;
  onReply?: () => void;
  onReplyAll?: () => void;
  onForward?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onToggleStar?: () => void;
  onMarkRead?: () => void;
  onMarkUnread?: () => void;
  onSnooze?: () => void;

  // Search & Navigation
  onSearch?: () => void;
  onGoToInbox?: () => void;
  onGoToSent?: () => void;
  onGoToStarred?: () => void;
  onGoToDrafts?: () => void;

  // Misc
  onRefresh?: () => void;
  onUndo?: () => void;
  onHelp?: () => void;

  // State
  selectedEmail: CachedEmail | null;
  emails: CachedEmail[];
  isComposerOpen: boolean;
}

export const useEmailKeyboardShortcuts = ({
  onNextEmail,
  onPrevEmail,
  onOpenEmail,
  onCloseEmail,
  onCompose,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onDelete,
  onToggleStar,
  onMarkRead,
  onMarkUnread,
  onSnooze,
  onSearch,
  onGoToInbox,
  onGoToSent,
  onGoToStarred,
  onGoToDrafts,
  onRefresh,
  onUndo,
  onHelp,
  selectedEmail,
  emails,
  isComposerOpen,
}: KeyboardShortcutHandlers) => {

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle shortcuts if user is typing in an input
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable;

    // Don't handle if composer is open (except Escape)
    if (isComposerOpen && e.key !== 'Escape') {
      return;
    }

    // Allow escape even in inputs
    if (e.key === 'Escape') {
      onCloseEmail?.();
      return;
    }

    // Don't process other shortcuts if in input
    if (isInput) {
      return;
    }

    // Check for modifier keys
    const hasCtrl = e.ctrlKey || e.metaKey;
    const hasShift = e.shiftKey;

    switch (e.key.toLowerCase()) {
      // === COMPOSE ===
      case 'c':
        if (!hasCtrl && !hasShift) {
          e.preventDefault();
          onCompose?.();
        }
        break;

      // === NAVIGATION ===
      case 'j':
      case 'arrowdown':
        if (!hasCtrl) {
          e.preventDefault();
          onNextEmail?.();
        }
        break;

      case 'k':
      case 'arrowup':
        if (!hasCtrl) {
          e.preventDefault();
          onPrevEmail?.();
        }
        break;

      case 'o':
      case 'enter':
        if (!hasCtrl && selectedEmail) {
          e.preventDefault();
          onOpenEmail?.(selectedEmail);
        }
        break;

      case 'u':
        if (hasShift) {
          e.preventDefault();
          onMarkUnread?.();
        } else if (!hasCtrl) {
          e.preventDefault();
          onCloseEmail?.();
        }
        break;

      // === REPLY/FORWARD ===
      case 'r':
        if (!hasCtrl && !hasShift) {
          e.preventDefault();
          onReply?.();
        } else if (!hasCtrl && hasShift) {
          e.preventDefault();
          onReplyAll?.();
        }
        break;

      case 'f':
        if (!hasCtrl && !hasShift) {
          e.preventDefault();
          onForward?.();
        }
        break;

      // === ACTIONS ===
      case 'e':
        if (!hasCtrl) {
          e.preventDefault();
          onArchive?.();
        }
        break;

      case '#':
      case 'delete':
      case 'backspace':
        if (!hasCtrl) {
          e.preventDefault();
          onDelete?.();
        }
        break;

      case 's':
        if (!hasCtrl) {
          e.preventDefault();
          onToggleStar?.();
        }
        break;

      case 'i':
        if (hasShift) {
          e.preventDefault();
          onMarkRead?.();
        }
        break;

      // Note: 'u' is handled above (Shift+U for unread, U for close)

      case 'b':
        if (!hasCtrl) {
          e.preventDefault();
          onSnooze?.();
        }
        break;

      // === SEARCH ===
      case '/':
        if (!hasCtrl) {
          e.preventDefault();
          onSearch?.();
        }
        break;

      // === GO TO ===
      case 'g':
        // Wait for second key press
        break;

      // === REFRESH ===
      case 'n':
        if (hasShift) {
          e.preventDefault();
          onRefresh?.();
        }
        break;

      // === UNDO ===
      case 'z':
        if (hasCtrl) {
          e.preventDefault();
          onUndo?.();
        }
        break;

      // === HELP ===
      case '?':
        e.preventDefault();
        onHelp?.();
        break;
    }
  }, [
    selectedEmail,
    emails,
    isComposerOpen,
    onNextEmail,
    onPrevEmail,
    onOpenEmail,
    onCloseEmail,
    onCompose,
    onReply,
    onReplyAll,
    onForward,
    onArchive,
    onDelete,
    onToggleStar,
    onMarkRead,
    onMarkUnread,
    onSnooze,
    onSearch,
    onGoToInbox,
    onGoToSent,
    onGoToStarred,
    onGoToDrafts,
    onRefresh,
    onUndo,
    onHelp,
  ]);

  // Handle "g" prefix shortcuts (g+i = inbox, g+s = starred, etc.)
  useEffect(() => {
    let gPressed = false;
    let gTimeout: ReturnType<typeof setTimeout>;

    const handleGShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' ||
                      target.tagName === 'TEXTAREA' ||
                      target.isContentEditable;

      if (isInput || isComposerOpen) return;

      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey) {
        gPressed = true;
        gTimeout = setTimeout(() => {
          gPressed = false;
        }, 1000); // 1 second window for second key
        return;
      }

      if (gPressed) {
        clearTimeout(gTimeout);
        gPressed = false;

        switch (e.key.toLowerCase()) {
          case 'i':
            e.preventDefault();
            onGoToInbox?.();
            break;
          case 's':
            e.preventDefault();
            onGoToStarred?.();
            break;
          case 't':
            e.preventDefault();
            onGoToSent?.();
            break;
          case 'd':
            e.preventDefault();
            onGoToDrafts?.();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleGShortcuts);
    return () => {
      window.removeEventListener('keydown', handleGShortcuts);
      clearTimeout(gTimeout);
    };
  }, [isComposerOpen, onGoToInbox, onGoToSent, onGoToStarred, onGoToDrafts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

// Keyboard shortcuts help modal content
export const keyboardShortcuts = [
  { category: 'Compose', shortcuts: [
    { keys: ['c'], description: 'Compose new email' },
    { keys: ['r'], description: 'Reply' },
    { keys: ['Shift', 'r'], description: 'Reply all' },
    { keys: ['f'], description: 'Forward' },
  ]},
  { category: 'Navigation', shortcuts: [
    { keys: ['j', '↓'], description: 'Move to next email' },
    { keys: ['k', '↑'], description: 'Move to previous email' },
    { keys: ['o', 'Enter'], description: 'Open email' },
    { keys: ['u'], description: 'Return to list' },
    { keys: ['Esc'], description: 'Close viewer/modal' },
  ]},
  { category: 'Actions', shortcuts: [
    { keys: ['e'], description: 'Archive' },
    { keys: ['#', 'Delete'], description: 'Delete' },
    { keys: ['s'], description: 'Star/Unstar' },
    { keys: ['Shift', 'i'], description: 'Mark as read' },
    { keys: ['Shift', 'u'], description: 'Mark as unread' },
    { keys: ['b'], description: 'Snooze' },
  ]},
  { category: 'Go to', shortcuts: [
    { keys: ['g', 'i'], description: 'Go to Inbox' },
    { keys: ['g', 's'], description: 'Go to Starred' },
    { keys: ['g', 't'], description: 'Go to Sent' },
    { keys: ['g', 'd'], description: 'Go to Drafts' },
  ]},
  { category: 'Other', shortcuts: [
    { keys: ['/'], description: 'Search' },
    { keys: ['Shift', 'n'], description: 'Refresh' },
    { keys: ['Ctrl', 'z'], description: 'Undo' },
    { keys: ['?'], description: 'Show shortcuts' },
  ]},
];

export default useEmailKeyboardShortcuts;
