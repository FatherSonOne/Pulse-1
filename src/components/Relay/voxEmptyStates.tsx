// voxEmptyStates — copy + icon config for the Relay empty states driven by
// getEmptyStateConfig: Direct's in-thread empty, Notes, Broadcast, and the
// Glimpse peer section. Sources that build their empty state inline (Inbox,
// Channels, Live, Direct's no-selection pane) pass their own props.
//
// Voice (PRODUCT.md): terse, no exclamation, no marketing-speak, recommend the
// next move. Each string is the user's literal first words from the section.

import {
  Radio,
  Antenna,
  StickyNote,
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
  // Also the fallback for any unknown key (see getEmptyStateConfig). Used by
  // Direct's in-thread empty, where a conversation IS open and simply has no
  // messages yet, so the title is "No messages", never "No conversations".
  classic: {
    mode: 'classic',
    icon: Radio,
    title: 'No messages yet',
    description: 'Hold space to send the first voice message.',
  },

  pulse_radio: {
    mode: 'pulse_radio',
    icon: Antenna,
    title: 'No broadcasts yet',
    description: 'Record one to reach everyone at once.',
  },

  vox_notes: {
    mode: 'vox_notes',
    icon: StickyNote,
    title: 'No voice notes yet',
    description: 'Capture a thought, just for you.',
  },

  glimpse: {
    mode: 'glimpse',
    icon: Video,
    title: 'No glimpses in this thread',
    description:
      'Send a glimpse when text isn\'t enough. Pulse transcribes and extracts action items so the recipient doesn\'t have to watch.',
  },
};

// Unknown keys (including the retired quick_vox / vox_drop / team_vox /
// voice_threads modes) fall back to the neutral 'classic' config.
export function getEmptyStateConfig(mode: string): VoxEmptyStateConfig {
  return VOX_EMPTY_STATES[mode] || VOX_EMPTY_STATES.classic;
}
