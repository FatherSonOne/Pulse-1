// src/components/Archives/archiveHelpers.ts
// Shared helper utilities for Archive sub-components

import type { ArchiveType } from '../../types';

export const getTypeConfig = (type: ArchiveType) => {
  switch (type) {
    case 'transcript':
      return { icon: 'fa-comments', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    case 'meeting_note':
      return { icon: 'fa-handshake', color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
    case 'vox_transcript':
      return { icon: 'fa-walkie-talkie', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' };
    case 'journal':
      return { icon: 'fa-book', color: 'text-zinc-600 dark:text-zinc-500', bg: 'bg-zinc-400/10', border: 'border-zinc-400/20' };
    case 'summary':
      return { icon: 'fa-wand-magic-sparkles', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    case 'decision_log':
      return { icon: 'fa-gavel', color: 'text-zinc-700 dark:text-zinc-300', bg: 'bg-zinc-300/10', border: 'border-zinc-300/20' };
    case 'artifact':
      return { icon: 'fa-cube', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' };
    case 'image':
      return { icon: 'fa-image', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
    case 'video':
      return { icon: 'fa-video', color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
    case 'document':
      return { icon: 'fa-file-lines', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    case 'war_room_session':
      return { icon: 'fa-shield-halved', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
    default:
      return { icon: 'fa-file', color: 'text-zinc-600 dark:text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
  }
};

export const getTypeLabel = (type: ArchiveType) =>
  type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
