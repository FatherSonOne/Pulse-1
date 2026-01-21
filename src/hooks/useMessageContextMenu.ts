/**
 * useMessageContextMenu Hook
 * Manages context menu state and actions for messages
 */

import { useState, useCallback, useEffect, RefObject } from 'react';
import { Message } from '../types';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface UseMessageContextMenuReturn {
  // State
  contextMenuMsgId: string | null;
  contextMenuPosition: ContextMenuPosition | null;
  selectedMessage: Message | null;

  // Actions
  openContextMenu: (messageId: string, position: ContextMenuPosition, message: Message) => void;
  closeContextMenu: () => void;

  // Context menu actions (to be called when menu item is clicked)
  handleReply: () => Message | null;
  handleForward: () => Message | null;
  handleCopy: () => void;
  handleDelete: () => string | null;
  handlePin: () => Message | null;
  handleStar: () => string | null;
}

export function useMessageContextMenu(): UseMessageContextMenuReturn {
  const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuMsgId) {
        // Check if click is outside the context menu
        const target = e.target as HTMLElement;
        if (!target.closest('.context-menu')) {
          closeContextMenu();
        }
      }
    };

    // Close on escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && contextMenuMsgId) {
        closeContextMenu();
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenuMsgId]);

  const openContextMenu = useCallback((
    messageId: string,
    position: ContextMenuPosition,
    message: Message
  ) => {
    setContextMenuMsgId(messageId);
    setContextMenuPosition(position);
    setSelectedMessage(message);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuMsgId(null);
    setContextMenuPosition(null);
    setSelectedMessage(null);
  }, []);

  const handleReply = useCallback((): Message | null => {
    const msg = selectedMessage;
    closeContextMenu();
    return msg;
  }, [selectedMessage, closeContextMenu]);

  const handleForward = useCallback((): Message | null => {
    const msg = selectedMessage;
    closeContextMenu();
    return msg;
  }, [selectedMessage, closeContextMenu]);

  const handleCopy = useCallback(() => {
    if (selectedMessage?.text) {
      navigator.clipboard.writeText(selectedMessage.text);
    }
    closeContextMenu();
  }, [selectedMessage, closeContextMenu]);

  const handleDelete = useCallback((): string | null => {
    const id = contextMenuMsgId;
    closeContextMenu();
    return id;
  }, [contextMenuMsgId, closeContextMenu]);

  const handlePin = useCallback((): Message | null => {
    const msg = selectedMessage;
    closeContextMenu();
    return msg;
  }, [selectedMessage, closeContextMenu]);

  const handleStar = useCallback((): string | null => {
    const id = contextMenuMsgId;
    closeContextMenu();
    return id;
  }, [contextMenuMsgId, closeContextMenu]);

  return {
    // State
    contextMenuMsgId,
    contextMenuPosition,
    selectedMessage,

    // Actions
    openContextMenu,
    closeContextMenu,

    // Context menu actions
    handleReply,
    handleForward,
    handleCopy,
    handleDelete,
    handlePin,
    handleStar,
  };
}

export default useMessageContextMenu;
