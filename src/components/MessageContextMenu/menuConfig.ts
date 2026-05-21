// src/components/MessageContextMenu/menuConfig.ts
// PR 2 — Surface 2 · top-5 + overflow menu shape per message state.
//
// Spec § 2.x tables — Own / Received / 1:1 / Group / edit-window:
//   * Own, <15min:           Reply · React · Copy · Edit · Forward
//   * Own, edit expired:     Reply · React · Copy · Forward · Pin
//   * Received in 1:1:       Reply · React · Copy · Forward · Translate
//   * Received in group:     Reply · React · Copy · @Mention · Forward
//
// Overflow grows by viewpoint: Pin / Translate / Save / Select / Info /
// Delete / Block / Report — each entry rendered only when applicable.

import {
  Reply,
  Smile,
  Copy,
  Pencil,
  CornerUpRight,
  Pin,
  Languages,
  RotateCcw,
  Star,
  CheckSquare,
  AtSign,
  Info,
  Trash2,
  ShieldOff,
  Flag,
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
const ITEM_TRANSLATE: ContextMenuItemDescriptor = {
  id: 'translate',
  label: 'Translate this message',
  icon: Languages,
  shortcut: 'T',
};
const ITEM_SHOW_ORIGINAL: ContextMenuItemDescriptor = {
  id: 'show-original',
  label: 'Show original',
  icon: RotateCcw,
};
const ITEM_PIN: ContextMenuItemDescriptor = {
  id: 'pin',
  label: 'Pin',
  icon: Pin,
};
const ITEM_SAVE: ContextMenuItemDescriptor = {
  id: 'save',
  label: 'Save',
  icon: Star,
};
const ITEM_SELECT: ContextMenuItemDescriptor = {
  id: 'select',
  label: 'Select',
  icon: CheckSquare,
};
const ITEM_INFO: ContextMenuItemDescriptor = {
  id: 'info',
  label: 'Message info',
  icon: Info,
};
const ITEM_DELETE: ContextMenuItemDescriptor = {
  id: 'delete',
  label: 'Delete',
  icon: Trash2,
  destructive: true,
};
const ITEM_BLOCK: ContextMenuItemDescriptor = {
  id: 'block',
  label: 'Block sender',
  icon: ShieldOff,
  destructive: true,
};
const ITEM_REPORT: ContextMenuItemDescriptor = {
  id: 'report',
  label: 'Report',
  icon: Flag,
  destructive: true,
};

/**
 * Build the Top-5 action list for the given message viewpoint.
 *
 * The order here is **load-bearing** — the spec mocks rely on it.
 * Always returns exactly 5 items.
 */
export function buildTop5(viewpoint: MessageViewpoint): ContextMenuItemDescriptor[] {
  // Own, within edit window — Edit replaces Pin in slot 4.
  if (viewpoint.isOwn && viewpoint.isEditable) {
    const items: ContextMenuItemDescriptor[] = [ITEM_REPLY, ITEM_REACT];
    if (viewpoint.hasText) items.push(ITEM_COPY);
    items.push(ITEM_EDIT, ITEM_FORWARD);
    return items.slice(0, 5);
  }

  // Own, edit expired — Pin fills the slot. Edit is HIDDEN (not greyed).
  if (viewpoint.isOwn && !viewpoint.isEditable) {
    const items: ContextMenuItemDescriptor[] = [ITEM_REPLY, ITEM_REACT];
    if (viewpoint.hasText) items.push(ITEM_COPY);
    items.push(ITEM_FORWARD, ITEM_PIN);
    return items.slice(0, 5);
  }

  // Received in group — @Mention promoted to top-5.
  if (!viewpoint.isOwn && viewpoint.isGroup) {
    const items: ContextMenuItemDescriptor[] = [ITEM_REPLY, ITEM_REACT];
    if (viewpoint.hasText) items.push(ITEM_COPY);
    items.push(ITEM_MENTION, ITEM_FORWARD);
    return items.slice(0, 5);
  }

  // Received in 1:1 — Translate-this-message in slot 5.
  const items: ContextMenuItemDescriptor[] = [ITEM_REPLY, ITEM_REACT];
  if (viewpoint.hasText) items.push(ITEM_COPY);
  items.push(ITEM_FORWARD);
  if (viewpoint.isAutoTranslated) {
    items.push(ITEM_SHOW_ORIGINAL);
  } else if (viewpoint.isTranslatable) {
    items.push(ITEM_TRANSLATE);
  } else {
    items.push(ITEM_PIN);
  }
  return items.slice(0, 5);
}

/**
 * Build the overflow ("More…") list. Items are appended only when
 * applicable to the current viewpoint. Destructive items always sink
 * to the end so the visual divider stays meaningful.
 */
export function buildOverflow(viewpoint: MessageViewpoint): ContextMenuItemDescriptor[] {
  const out: ContextMenuItemDescriptor[] = [];

  // Pin (if not already in top-5).
  const inTop5: ReadonlyArray<string> = buildTop5(viewpoint).map((i) => i.id);
  if (!inTop5.includes('pin') && viewpoint.canPin !== false) out.push(ITEM_PIN);

  // Translate / Show original (if not already in top-5).
  if (
    !inTop5.includes('translate') &&
    !inTop5.includes('show-original') &&
    !viewpoint.isOwn
  ) {
    if (viewpoint.isAutoTranslated) out.push(ITEM_SHOW_ORIGINAL);
    else if (viewpoint.isTranslatable) out.push(ITEM_TRANSLATE);
  }

  out.push(ITEM_SAVE, ITEM_SELECT);

  // Group-only: @mention in overflow when not in top-5.
  if (
    !inTop5.includes('mention') &&
    !viewpoint.isOwn &&
    viewpoint.isGroup &&
    viewpoint.canMention !== false
  ) {
    out.push(ITEM_MENTION);
  }

  // Message info (own messages in group only, per spec).
  if (viewpoint.isOwn && viewpoint.isGroup && viewpoint.canViewInfo !== false) {
    out.push(ITEM_INFO);
  }

  // Destructive cluster.
  if (viewpoint.isOwn && viewpoint.canDelete !== false) out.push(ITEM_DELETE);
  if (
    !viewpoint.isOwn &&
    !viewpoint.isGroup &&
    viewpoint.canBlock !== false
  ) {
    out.push(ITEM_BLOCK);
  }
  if (!viewpoint.isOwn && viewpoint.canReport !== false) out.push(ITEM_REPORT);

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
