// Email Hybrid — shared primitives.
// Pure / presentational only. No state, no data access.
import React from 'react';

const AVATAR_PALETTE = [
  '#6366f1', '#8b5cf6', '#d946ef', '#ec4899',
  '#0ea5e9', '#06b6d4', '#14b8a6', '#64748b',
];

export function colorForId(id = ''): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export function initials(name = ''): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join('')
      .toUpperCase() || '?'
  );
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

interface AvatarProps {
  name: string;
  size?: number;
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 36 }) => (
  <div
    className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
    style={{
      width: size,
      height: size,
      fontSize: size * 0.34,
      background: colorForId(name),
    }}
  >
    {initials(name)}
  </div>
);

type AiChipVariant = 'summary' | 'pending' | 'muted' | 'positive';
interface AiChipProps {
  variant?: AiChipVariant;
  /**
   * Optional leading icon. When provided, the chip's signature ::before
   * dot is suppressed (see hybrid.css `.ai-chip.has-icon::before`) and
   * the icon takes its place. Use for context-specific chips like
   * "Meeting" (CalendarPlus) or "Tasks" (ListChecks) where the icon
   * communicates more than the generic dot would.
   */
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const AiChip: React.FC<AiChipProps> = ({ variant = 'summary', icon, children }) => {
  const baseCls =
    variant === 'pending' ? 'ai-chip pending'
    : variant === 'muted' ? 'ai-chip muted'
    : variant === 'positive' ? 'ai-chip positive'
    : 'ai-chip';
  const cls = icon ? `${baseCls} has-icon` : baseCls;
  return (
    <span className={cls}>
      {icon}
      {children}
    </span>
  );
};

type Tone = 'warm' | 'cool' | 'cold' | 'hot';
const TONE_MAP: Record<Tone, { cls: string; label: string }> = {
  warm: { cls: 'tone-warm', label: 'Warm' },
  cool: { cls: 'tone-cool', label: 'Cool' },
  cold: { cls: 'tone-cold', label: 'Slow' },
  hot:  { cls: 'tone-hot',  label: 'Hot' },
};

export const ToneChip: React.FC<{ tone: Tone }> = ({ tone }) => {
  const t = TONE_MAP[tone] ?? TONE_MAP.cool;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono-pulse tracking-tight-mono ${t.cls}`}
    >
      {t.label.toUpperCase()}
    </span>
  );
};

export const Keycap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="keycap">{children}</kbd>
);
