// MessagesAudiencePicker — IA collapse for the Messages view.
//
// The locked Stage 2 design brief promised that Messages would consolidate
// DMs, team channels, and broadcasts behind a single audience switch.
// Visually demoted to an inline segmented pill in the corner — the top-level
// nav already says "Messages", so this only needs to disambiguate Direct vs
// Channel vs Broadcast quietly. No chrome row, no border-bottom.

import React from 'react';
import { User as UserIcon, Hash, Radio } from 'lucide-react';

export type MessagesAudience = 'direct' | 'channel' | 'broadcast';

interface AudienceOption {
  id: MessagesAudience;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const OPTIONS: AudienceOption[] = [
  { id: 'direct', label: 'Direct', icon: UserIcon, description: '1:1 voice messages' },
  { id: 'channel', label: 'Channel', icon: Hash, description: 'Team voice rooms' },
  { id: 'broadcast', label: 'Broadcast', icon: Radio, description: 'One-to-many publish' },
];

interface Props {
  audience: MessagesAudience;
  onChange: (next: MessagesAudience) => void;
  isDarkMode?: boolean;
  /** Layout: 'inline' renders a segmented pill (default); 'chrome' keeps the
   *  legacy chrome row with border-bottom for callers that still want it. */
  variant?: 'inline' | 'chrome';
}

export const MessagesAudiencePicker: React.FC<Props> = ({
  audience,
  onChange,
  isDarkMode = false,
  variant = 'inline',
}) => {
  if (variant === 'chrome') {
    return (
      <div
        className={`flex items-center gap-1 px-3 py-2 border-b ${
          isDarkMode ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-white'
        }`}
        role="tablist"
        aria-label="Messages audience"
      >
        {OPTIONS.map((opt) => renderTab(opt, audience === opt.id, onChange, isDarkMode, 'chrome'))}
      </div>
    );
  }

  // Inline pill — tighter, neutral background, ring around the group so it
  // reads as a single toggle rather than three chrome buttons.
  return (
    <div
      className={`inline-flex items-center rounded-md ring-1 p-0.5 ${
        isDarkMode ? 'ring-zinc-800 bg-zinc-950' : 'ring-zinc-200 bg-white'
      }`}
      role="tablist"
      aria-label="Messages audience"
    >
      {OPTIONS.map((opt) => renderTab(opt, audience === opt.id, onChange, isDarkMode, 'inline'))}
    </div>
  );
};

function renderTab(
  opt: AudienceOption,
  isActive: boolean,
  onChange: (next: MessagesAudience) => void,
  isDarkMode: boolean,
  variant: 'inline' | 'chrome',
) {
  const Icon = opt.icon;
  const sizing =
    variant === 'inline'
      ? 'gap-1 px-2 py-1 text-[10px]'
      : 'gap-1.5 px-3 py-1.5 text-[11px]';
  return (
    <button
      key={opt.id}
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onChange(opt.id)}
      title={opt.description}
      className={`inline-flex items-center ${sizing} rounded-[5px] font-mono uppercase tracking-[0.1em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
        isActive
          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          : isDarkMode
            ? 'text-zinc-500 hover:text-zinc-300'
            : 'text-zinc-500 hover:text-zinc-700'
      }`}
    >
      <Icon className={variant === 'inline' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {opt.label}
    </button>
  );
}

export default MessagesAudiencePicker;
