// src/components/MessageContextMenu/menuConfig.ts
// Surface 2 · top-5 + overflow menu shape per message state.
//
// The menu only exposes actions that are REAL and wired on the Pulse
// surface. Stub/fake-success items from the original generic-messenger
// spec (pin-to-thread, translate-this-message, show-original, message
// info, multi-select, block, report) were removed 2026-05-31 — showing a
// "Message reported" toast with no backend is a trust bug, not a feature.
//
// Pulse-specific additions: Create task / Propose decision (linked to the
// message via origin_message_id / message_id, surfaced in the relationship
// rail) and Share. These are workspace-scoped (see `canCreateTask`).

import {
  Reply,
  Smile,
  Copy,
  Pencil,
  CornerUpRight,
  Star,
  AtSign,
  ListChecks,
  Scale,
  Share2,
  Trash2,
} from 'lucide-react';
import type {
  ContextMenuItemDescriptor,
  MessageViewpoint,
} from './types';

// ─── Atomic descriptors ─────────────────────────────────────────────
const ITEM_REPLY: ContextMenuItemDescriptor = {
  id: 'reply',
  label: 'Reply',
  icon: Reply,
  shortcut: 'R',
};
const ITEM_REACT: ContextMenuItemDescriptor = {
  id: 'react',
  label: 'React…',
  icon: Smile,
  shortcut: 'E',
};
const ITEM_COPY: ContextMenuItemDescriptor = {
  id: 'copy',
  label: 'Copy',
  icon: Copy,
  shortcut: '⌘C',
};
const ITEM_EDIT: ContextMenuItemDescriptor = {
  id: 'edit',
  label: 'Edit',
  icon: Pencil,
  shortcut: '⌘↵',
};
const ITEM_FORWARD: ContextMenuItemDescriptor = {
  id: 'forward',
  label: 'Forward',
  icon: CornerUpRight,
  shortcut: 'F',
};
const ITEM_MENTION: ContextMenuItemDescriptor = {
  id: 'mention',
  label: 'Mention this person',
  icon: AtSign,
};
const ITEM_SAVE: ContextMenuItemDescriptor = {
  id: 'save',
  label: 'Save',
  icon: Star,
};
const ITEM_SHARE: ContextMenuItemDescriptor = {
  id: 'share',
  label: 'Share',
  icon: Share2,
};
const ITEM_CREATE_TASK: ContextMenuItemDescriptor = {
  id: 'create-task',
  label: 'Create task',
  icon: ListChecks,
};
const ITEM_PROPOSE_DECISION: ContextMenuItemDescriptor = {
  id: 'propose-decision',
  label: 'Propose decision',
  icon: Scale,
};
const ITEM_DELETE: ContextMenuItemDescriptor = {
  id: 'delete',
  label: 'Delete',
  icon: Trash2,
  destructive: true,
};

/**
 * Build the Top-5 action list for the given message viewpoint.
 * Always returns at most 5 items, all wired to real handlers.
 */
export function buildTop5(viewpoint: MessageViewpoint): ContextMenuItemDescriptor[] {
  const items: ContextMenuItemDescriptor[] = [ITEM_REPLY, ITEM_REACT];
  if (viewpoint.hasText) items.push(ITEM_COPY);

  // Own + still in the edit window — Edit takes slot 4.
  if (viewpoint.isOwn && viewpoint.isEditable) {
    items.push(ITEM_EDIT, ITEM_FORWARD);
    return items.slice(0, 5);
  }

  // Received in a group — @Mention promoted (Pulse is 1:1 today; future-proofed).
  if (!viewpoint.isOwn && viewpoint.isGroup) {
    items.push(ITEM_MENTION, ITEM_FORWARD);
    return items.slice(0, 5);
  }

  // Default (own-expired / received 1:1) — Forward + Share fill the slots.
  items.push(ITEM_FORWARD, ITEM_SHARE);
  return items.slice(0, 5);
}

/**
 * Build the overflow ("More…") list. Items are appended only when
 * applicable to the viewpoint. The destructive item always sinks to the
 * end so the visual divider stays meaningful.
 */
export function buildOverflow(viewpoint: MessageViewpoint): ContextMenuItemDescriptor[] {
  const out: ContextMenuItemDescriptor[] = [];
  const inTop5: ReadonlyArray<string> = buildTop5(viewpoint).map((i) => i.id);

  out.push(ITEM_SAVE);

  if (!inTop5.includes('share')) out.push(ITEM_SHARE);

  // Pulse: create artifacts FROM this message — workspace-scoped, text only.
  if (viewpoint.hasText && viewpoint.canCreateTask !== false) {
    out.push(ITEM_CREATE_TASK, ITEM_PROPOSE_DECISION);
  }

  // Group-only: @mention in overflow when not already in top-5.
  if (
    !inTop5.includes('mention') &&
    !viewpoint.isOwn &&
    viewpoint.isGroup &&
    viewpoint.canMention !== false
  ) {
    out.push(ITEM_MENTION);
  }

  // Destructive cluster — own messages only.
  if (viewpoint.isOwn && viewpoint.canDelete !== false) out.push(ITEM_DELETE);

  return out;
}

/**
 * Convenience: compute `isEditable` from a `createdAt` ISO string.
 * Prefer a server-provided `edit_until` timestamp when present —
 * pass that into `MessageViewpoint.isEditable` directly. This helper
 * is the fallback used when only `createdAt` is available.
 */
export function computeIsEditable(
  createdAt: string | number | Date,
  now: number = Date.now(),
): boolean {
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t < 15 * 60 * 1000; // EDIT_WINDOW_MS — kept literal to avoid cycle
}
