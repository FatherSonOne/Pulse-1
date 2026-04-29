// voxEmptyStates - Configuration for empty states across all 8 Relay modes
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
  icon: LucideIcon;
  title: string;
  description: string;
}

export const VOX_EMPTY_STATES: Record<string, VoxEmptyStateConfig> = {
  classic: {
    mode: 'classic',
    icon: Radio,
    title: 'No conversations yet',
    description: 'Start talking! Send your first voice message to begin a conversation.',
  },

  pulse_radio: {
    mode: 'pulse_radio',
    icon: Antenna,
    title: 'No broadcasts yet',
    description: 'Go live! Start broadcasting your voice to your audience in real-time.',
  },

  voice_threads: {
    mode: 'voice_threads',
    icon: MessageCircle,
    title: 'No threads yet',
    description: 'Start a discussion! Create your first voice thread and reply to messages.',
  },

  team_vox: {
    mode: 'team_vox',
    icon: Users,
    title: 'No team conversations',
    description: 'Collaborate with your team! Start a group voice conversation to get things done.',
  },

  vox_notes: {
    mode: 'vox_notes',
    icon: StickyNote,
    title: 'No voice notes yet',
    description: 'Capture your thoughts! Record quick voice notes for yourself anytime.',
  },

  quick_vox: {
    mode: 'quick_vox',
    icon: Zap,
    title: 'No quick messages',
    description: 'Send lightning-fast messages! Quick Vox is perfect for rapid-fire communication.',
  },

  vox_drop: {
    mode: 'vox_drop',
    icon: Package,
    title: 'No drops yet',
    description: 'Drop a voice note! Leave asynchronous voice messages for anyone to pick up.',
  },

  glimpse: {
    mode: 'glimpse',
    icon: Video,
    title: 'No glimpses yet',
    description: 'Record a quick video message. Hold to record, release to send.',
  },
};

// Helper to get empty state config for a mode
export function getEmptyStateConfig(mode: string): VoxEmptyStateConfig {
  return VOX_EMPTY_STATES[mode] || VOX_EMPTY_STATES.classic;
}
