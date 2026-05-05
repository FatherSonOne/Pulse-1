// src/components/Archives/archiveHelpers.ts
// Shared helper utilities for Archive sub-components

import type { LucideIcon } from 'lucide-react';
import {
  Box,
  BookText,
  File,
  FileText,
  Handshake,
  Image as ImageIcon,
  MessagesSquare,
  Radio,
  Scale,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import type { ArchiveType } from '../../types';

interface TypeConfig {
  Icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
}

export const getTypeConfig = (type: ArchiveType): TypeConfig => {
  switch (type) {
    case 'transcript':
      return { Icon: MessagesSquare, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
    case 'meeting_note':
      return { Icon: Handshake, color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
    case 'vox_transcript':
      return { Icon: Radio, color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/20' };
    case 'journal':
      return { Icon: BookText, color: 'text-zinc-600 dark:text-zinc-500', bg: 'bg-zinc-400/10', border: 'border-zinc-400/20' };
    case 'summary':
      return { Icon: Sparkles, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
    case 'decision_log':
      return { Icon: Scale, color: 'text-zinc-700 dark:text-zinc-300', bg: 'bg-zinc-300/10', border: 'border-zinc-300/20' };
    case 'artifact':
      return { Icon: Box, color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/20' };
    case 'image':
      return { Icon: ImageIcon, color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
    case 'video':
      return { Icon: Video, color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
    case 'document':
      return { Icon: FileText, color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
    case 'war_room_session':
      return { Icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
    default:
      return { Icon: File, color: 'text-zinc-600 dark:text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
  }
};

export const getTypeLabel = (type: ArchiveType) =>
  type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
