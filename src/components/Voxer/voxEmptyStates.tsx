// voxEmptyStates - Configuration for empty states across all 8 Voxer modes
// Provides mode-specific icons, titles, and descriptions

import {
  Radio,
  Antenna,
  MessageCircle,
  Users,
  StickyNote,
  Zap,
  Package,
  Video,
  type LucideIcon,
} from 'lucide-react';

export interface VoxEmptyStateConfig {
  mode: string;
  color: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

export const VOX_EMPTY_STATES: Record<string, VoxEmptyStateConfig> = {
  classic: {
    mode: 'classic',
    color: '#F97316', // Orange
    icon: Radio,
    title: 'No conversations yet',
    description: 'Start talking! Send your first voice message to begin a conversation.',
  },

  pulse_radio: {
    mode: 'pulse_radio',
    color: '#8B5CF6', // Purple
    icon: Antenna,
    title: 'No broadcasts yet',
    description: 'Go live! Start broadcasting your voice to your audience in real-time.',
  },

  voice_threads: {
    mode: 'voice_threads',
    color: '#10B981', // Emerald
    icon: MessageCircle,
    title: 'No threads yet',
    description: 'Start a discussion! Create your first voice thread and reply to messages.',
  },

  team_vox: {
    mode: 'team_vox',
    color: '#F59E0B', // Amber
    icon: Users,
    title: 'No team conversations',
    description: 'Collaborate with your team! Start a group voice conversation to get things done.',
  },

  vox_notes: {
    mode: 'vox_notes',
    color: '#EC4899', // Pink
    icon: StickyNote,
    title: 'No voice notes yet',
    description: 'Capture your thoughts! Record quick voice notes for yourself anytime.',
  },

  quick_vox: {
    mode: 'quick_vox',
    color: '#3B82F6', // Blue
    icon: Zap,
    title: 'No quick messages',
    description: 'Send lightning-fast messages! Quick Vox is perfect for rapid-fire communication.',
  },

  vox_drop: {
    mode: 'vox_drop',
    color: '#EF4444', // Red
    icon: Package,
    title: 'No drops yet',
    description: 'Drop a voice note! Leave asynchronous voice messages for anyone to pick up.',
  },

  glimpse: {
    mode: 'glimpse',
    color: '#06B6D4', // Cyan
    icon: Video,
    title: 'No glimpses yet',
    description: 'Record a quick video message. Hold to record, release to send.',
  },
};

// Helper to get empty state config for a mode
export function getEmptyStateConfig(mode: string): VoxEmptyStateConfig {
  return VOX_EMPTY_STATES[mode] || VOX_EMPTY_STATES.classic;
}
