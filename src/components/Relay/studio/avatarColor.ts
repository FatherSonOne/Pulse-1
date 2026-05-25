// Deterministic avatar color from an id/name. Returns a Tailwind `bg-*` class.
//
// Status hues (emerald/orange/red/yellow/blue-500) and the brand rose are
// deliberately excluded so a decorative avatar never collides with the
// state-bearing signals (now-playing / record / online dot). This is the same
// palette VoiceRooms' room-color picker draws from; extracted here so the
// Voice Studio message card, the Relay shell, and every section share one
// source of truth.

const RELAY_AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-sky-500',
  'bg-cyan-500',
  'bg-teal-500',
  'bg-slate-500',
] as const;

export function avatarColorForId(id: string): string {
  if (!id) return RELAY_AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return RELAY_AVATAR_COLORS[hash % RELAY_AVATAR_COLORS.length];
}

/** First-letter (or first two initials) for an avatar glyph. */
export function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
