import React from 'react';
import { Copy, Pen, Plus, Trash2, Video } from 'lucide-react';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'day' | 'event';
  date?: Date;
}

interface CalendarContextMenuProps {
  contextMenu: ContextMenuState;
  handleQuickEvent: () => void;
  setNewEventDate: (v: string) => void;
  setNewEventTime: (v: string) => void;
  setShowEventModal: (v: boolean) => void;
  closeContextMenu: () => void;
  handleEditEvent: () => void;
  handleDuplicateEvent: () => void;
  handleDeleteEvent: () => void;
}

export const CalendarContextMenu: React.FC<CalendarContextMenuProps> = ({
  contextMenu,
  handleQuickEvent,
  setNewEventDate,
  setNewEventTime,
  setShowEventModal,
  closeContextMenu,
  handleEditEvent,
  handleDuplicateEvent,
  handleDeleteEvent,
}) => {
  if (!contextMenu.visible) return null;

  return (
    <div
      role="menu"
      aria-label="Calendar context menu"
      className="fixed z-[100] bg-[var(--pulse-surface)] dark:bg-[var(--pulse-surface)] rounded-xl shadow-2xl border border-[var(--pulse-border)] py-2 min-w-[180px] animate-fade-in"
      style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {contextMenu.type === 'day' ? (
        <>
          <button
            role="menuitem"
            onClick={handleQuickEvent}
            className="w-full px-4 py-2.5 text-left text-sm text-[var(--pulse-ink-2)] hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-[var(--pulse-surface-raised)] flex items-center gap-3 transition"
          >
            <Plus className="text-blue-500 w-4" />
            New Event
          </button>
          <button
            role="menuitem"
            onClick={() => {
              if (contextMenu.date) {
                setNewEventDate(contextMenu.date.toISOString().split('T')[0]);
                setNewEventTime('09:00');
                setShowEventModal(true);
              }
              closeContextMenu();
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-[var(--pulse-ink-2)] hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-[var(--pulse-surface-raised)] flex items-center gap-3 transition"
          >
            <Video className="text-green-500 w-4" />
            Schedule Meeting
          </button>
          <div role="separator" className="border-t border-[var(--pulse-border)] my-1"></div>
          <div role="none" className="px-4 py-2 text-xs text-zinc-400">
            {contextMenu.date?.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </>
      ) : (
        <>
          <button
            role="menuitem"
            onClick={handleEditEvent}
            className="w-full px-4 py-2.5 text-left text-sm text-[var(--pulse-ink-2)] hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-[var(--pulse-surface-raised)] flex items-center gap-3 transition"
          >
            <Pen className="text-blue-500 w-4" />
            Edit Event
          </button>
          <button
            role="menuitem"
            onClick={handleDuplicateEvent}
            className="w-full px-4 py-2.5 text-left text-sm text-[var(--pulse-ink-2)] hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-[var(--pulse-surface-raised)] flex items-center gap-3 transition"
          >
            <Copy className="text-zinc-400 w-4" />
            Duplicate
          </button>
          <div role="separator" className="border-t border-[var(--pulse-border)] my-1"></div>
          <button
            role="menuitem"
            onClick={handleDeleteEvent}
            className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition"
          >
            <Trash2 className="w-4" />
            Delete Event
          </button>
        </>
      )}
    </div>
  );
};
