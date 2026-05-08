// src/components/Archives/archiveHelpers.ts
// Shared helper utilities for Archive sub-components

import type { LucideIcon } from 'lucide-react';
import {
  Box,
  BookText,
  File,
  FileText,
  Film,
  Handshake,
  Image as ImageIcon,
  Mail,
  MessagesSquare,
  Mic,
  PhoneCall,
  Radio,
  Scale,
  Search,
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

const NEUTRAL: TypeConfig = {
  Icon: File,
  color: 'text-zinc-600 dark:text-zinc-400',
  bg: 'bg-zinc-500/10',
  border: 'border-zinc-500/20',
};

const ROSE_BRAND: TypeConfig = {
  Icon: Sparkles,
  color: 'text-rose-500',
  bg: 'bg-rose-500/10',
  border: 'border-rose-500/20',
};

// Type chips are neutral — coral is reserved for state (active, unread, AI provenance,
// send, focus). Type ≠ state. The only rose chip is the AI Summary, since that IS a
// provenance signal, not a type marker.
export const getTypeConfig = (type: ArchiveType): TypeConfig => {
  switch (type) {
    case 'message':         return { Icon: MessagesSquare, ...NEUTRAL };
    case 'email':           return { Icon: Mail, ...NEUTRAL };
    case 'relay_message':   return { Icon: Radio, ...NEUTRAL };
    case 'relay_note':      return { Icon: Mic, ...NEUTRAL };
    case 'relay_live':      return { Icon: PhoneCall, ...NEUTRAL };
    case 'glimpse':         return { Icon: Film, ...NEUTRAL };
    case 'transcript':      return { Icon: MessagesSquare, ...NEUTRAL };
    case 'meeting_note':    return { Icon: Handshake, ...NEUTRAL };
    case 'vox_transcript':  return { Icon: Radio, ...NEUTRAL };
    case 'journal':         return { Icon: BookText, ...NEUTRAL };
    case 'summary':         return ROSE_BRAND; // AI provenance signal, not a type
    case 'decision_log':    return { Icon: Scale, ...NEUTRAL };
    case 'artifact':        return { Icon: Box, ...NEUTRAL };
    case 'research':        return { Icon: Search, ...NEUTRAL };
    case 'image':           return { Icon: ImageIcon, ...NEUTRAL };
    case 'video':           return { Icon: Video, ...NEUTRAL };
    case 'document':        return { Icon: FileText, ...NEUTRAL };
    case 'war_room_session':return { Icon: ShieldCheck, ...NEUTRAL };
    default:                return NEUTRAL;
  }
};

export const getTypeLabel = (type: ArchiveType) => {
  switch (type) {
    case 'message': return 'Message';
    case 'email': return 'Email';
    case 'relay_message': return 'Relay Voice';
    case 'relay_note': return 'Relay Note';
    case 'relay_live': return 'Relay Live';
    case 'glimpse': return 'Glimpse';
    case 'meeting_note': return 'Meeting';
    case 'vox_transcript': return 'Vox';
    case 'decision_log': return 'Decision';
    case 'war_room_session': return 'War Room';
    default:
      return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
};
