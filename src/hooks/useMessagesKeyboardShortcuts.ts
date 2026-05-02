import { useEffect, useState, useCallback, useRef } from 'react';

interface ConversationLike {
  id: string;
}

interface UseMessagesKeyboardShortcutsArgs<T extends ConversationLike> {
  conversations: T[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onFocusComposer?: () => void;
  onToggleShortcutsOverlay: () => void;
  /**
   * True when a modal/overlay owns focus (FeatureSettingsPanel, CommandPalette,
   * StatsPanel, OutcomeSetup, HandoffCard, etc.). When true the hook no-ops so
   * the modal's own keyboard layer wins.
   */
  disabled?: boolean;
}

interface UseMessagesKeyboardShortcutsReturn {
  /** Conversation id under the keyboard cursor (visual highlight target). */
  cursorConvId: string | null;
}

const isTypingTarget = (e: KeyboardEvent): boolean => {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (t.isContentEditable) return true;
  return false;
};

export function useMessagesKeyboardShortcuts<T extends ConversationLike>(
  args: UseMessagesKeyboardShortcutsArgs<T>,
): UseMessagesKeyboardShortcutsReturn {
  const {
    conversations,
    activeConversationId,
    onSelectConversation,
    onFocusComposer,
    onToggleShortcutsOverlay,
    disabled = false,
  } = args;

  const [cursorConvId, setCursorConvId] = useState<string | null>(null);

  const argsRef = useRef(args);
  argsRef.current = args;

  useEffect(() => {
    if (!cursorConvId) return;
    const stillExists = conversations.some((c) => c.id === cursorConvId);
    if (!stillExists) setCursorConvId(null);
  }, [conversations, cursorConvId]);

  const moveCursor = useCallback(
    (delta: 1 | -1) => {
      const list = argsRef.current.conversations;
      if (list.length === 0) return;

      const startId = cursorConvId ?? argsRef.current.activeConversationId;
      const startIdx = startId ? list.findIndex((c) => c.id === startId) : -1;

      if (startIdx === -1) {
        setCursorConvId(list[delta > 0 ? 0 : list.length - 1].id);
        return;
      }
      const nextIdx = Math.min(list.length - 1, Math.max(0, startIdx + delta));
      if (nextIdx === startIdx) return;
      setCursorConvId(list[nextIdx].id);
    },
    [cursorConvId],
  );

  useEffect(() => {
    if (disabled) return;

    const handler = (e: KeyboardEvent) => {
      if (disabled) return;
      if (isTypingTarget(e)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key;

      if (key === 'j' || key === 'J') {
        e.preventDefault();
        moveCursor(1);
        return;
      }
      if (key === 'k' || key === 'K') {
        e.preventDefault();
        moveCursor(-1);
        return;
      }
      if (key === 'Enter') {
        const target = cursorConvId;
        if (!target) return;
        e.preventDefault();
        argsRef.current.onSelectConversation(target);
        return;
      }
      if (key === 'r' || key === 'R') {
        const focus = argsRef.current.onFocusComposer;
        if (!focus || !argsRef.current.activeConversationId) return;
        e.preventDefault();
        focus();
        return;
      }
      if (key === '?') {
        e.preventDefault();
        argsRef.current.onToggleShortcutsOverlay();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [disabled, cursorConvId, moveCursor]);

  return { cursorConvId };
}
