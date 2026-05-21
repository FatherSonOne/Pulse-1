import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { Plus } from 'lucide-react';
// Full Unicode emoji catalog grouped by CLDR. ~1914 base emojis across
// 9 official groups. Replaces the hand-curated lists below.
import unicodeEmojis from 'unicode-emoji-json';

// Types
interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

interface EmojiReactionsProps {
  messageId: string;
  reactions: Reaction[];
  onReact?: (emoji: string) => void;
  onRemoveReaction?: (emoji: string) => void;
  compact?: boolean;
}

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  position?: { x: number; y: number };
  recentEmojis?: string[];
}

// Per-group representative icon for the category tab bar. Picked to be
// the canonical "first thought" emoji for each CLDR group.
const GROUP_ICONS: Record<string, string> = {
  'Smileys & Emotion': '😀',
  'People & Body': '👋',
  'Animals & Nature': '🐶',
  'Food & Drink': '🍕',
  'Travel & Places': '✈️',
  'Activities': '⚽',
  'Objects': '💡',
  'Symbols': '🔣',
  'Flags': '🏳️',
};

// CLDR group order (matches Apple / iOS picker convention).
const CLDR_GROUP_ORDER = [
  'Smileys & Emotion',
  'People & Body',
  'Animals & Nature',
  'Food & Drink',
  'Travel & Places',
  'Activities',
  'Objects',
  'Symbols',
  'Flags',
];

interface UnicodeEmojiEntry {
  name: string;
  slug?: string;
  group: string;
  emoji_version?: string;
  unicode_version?: string;
  skin_tone_support?: boolean;
}

// Flatten the unicode-emoji-json object into an array we can search by name.
// Built once at module load.
const ALL_EMOJI_ENTRIES: Array<{ emoji: string; name: string; group: string }> =
  Object.entries(unicodeEmojis as Record<string, UnicodeEmojiEntry>).map(
    ([emoji, meta]) => ({ emoji, name: meta.name, group: meta.group }),
  );

// Slugify a group name for a stable category id.
const groupSlug = (g: string) => g.toLowerCase().replace(/[^a-z]+/g, '-');

// Emoji categories — derived from the Unicode CLDR catalog so the picker
// always carries the full set. Recent stays at the head for fast access.
const emojiCategories: EmojiCategory[] = [
  { id: 'recent', name: 'Recent', icon: '🕐', emojis: [] },
  ...CLDR_GROUP_ORDER.map((g): EmojiCategory => ({
    id: groupSlug(g),
    name: g,
    icon: GROUP_ICONS[g] ?? '⬜',
    emojis: ALL_EMOJI_ENTRIES.filter(e => e.group === g).map(e => e.emoji),
  })),
];

// Legacy hand-curated lists kept below as `LEGACY_EMOJI_CATEGORIES` for
// reference only — no longer wired. Safe to delete once no consumer
// imports them (none currently do; checked via grep).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LEGACY_EMOJI_CATEGORIES: EmojiCategory[] = [
  { id: 'recent', name: 'Recent', icon: '🕐', emojis: [] },
  {
    id: 'smileys',
    name: 'Smileys & People',
    icon: '😀',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','🫠','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😶‍🌫️','😏','😒','🙄','😬','😮‍💨','🤥','🫨','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','😵‍💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾']
  },
  {
    id: 'gestures',
    name: 'People & Body',
    icon: '👋',
    emojis: ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦','💋','🩸','👶','🧒','👦','👧','🧑','👨','👩','🧓','👴','👵']
  },
  {
    id: 'hearts',
    name: 'Hearts',
    icon: '❤️',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','🩷','🩵','🩶','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💌','💋','💯','💫','💥','💢','💦','💨','💤','💭','🗯️','👁️‍🗨️']
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    icon: '🐱',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊','🐒','🦍','🦧','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪲','🐛','🦋','🐌','🐞','🐜','🪰','🪱','🦟','🦗','🕷️','🕸️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🦭','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔','🐾','🌵','🎄','🌲','🌳','🌴','🪵','🌱','🌿','☘️','🍀','🎍','🪴','🎋','🍃','🍂','🍁','🍄','🐚','🪸','🪨','🌾','💐','🌷','🌹','🥀','🌺','🌸','🌼','🌻','🌞','🌝','🌛','🌜','🌚','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔','🌙','🌎','🌍','🌏','🪐','💫','⭐','🌟','✨','⚡','☄️','💥','🔥','🌈','☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️','💨','🌪️','🌫️','🌊','💧','💦','☔']
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍕',
    emojis: ['🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🫐','🥝','🍅','🫒','🥥','🥑','🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬','🥦','🧄','🧅','🍄','🥜','🫘','🌰','🍞','🥐','🥖','🫓','🥨','🥯','🥞','🧇','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🫔','🥙','🧆','🥚','🍳','🥘','🍲','🫕','🥣','🥗','🍿','🧈','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦀','🦞','🦐','🦑','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🫖','🍵','🍶','🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃','🫗','🥤','🧋','🧃','🧉','🧊']
  },
  {
    id: 'activities',
    name: 'Activities',
    icon: '⚽',
    emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚴','🚵','🎖️','🏆','🥇','🥈','🥉','🏅','🎗️','🎫','🎟️','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🪗','🎲','♟️','🎯','🎳','🎮','🕹️','🧩','🧸','🪅','🪩','🪆','🖼️','🎁','🎀','🎊','🎉','🎈','🎏','🎐','🧧','🎎','🎏','🎐','🪔','🧨']
  },
  {
    id: 'travel',
    name: 'Travel & Places',
    icon: '🚗',
    emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🦯','🦽','🦼','🛴','🚲','🛵','🏍️','🛺','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩️','💺','🛰️','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','⚓','🪝','⛽','🚧','🚦','🚥','🚏','🗺️','🗿','🗽','🗼','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','⛱️','🏖️','🏝️','🏜️','🌋','⛰️','🏔️','🗻','🏕️','⛺','🏠','🏡','🏘️','🏚️','🏗️','🏢','🏬','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏩','💒','🏛️','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛺','🌁','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','♨️','🎠','🛝','🎡','🎢','💈','🎪']
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: '💡',
    emojis: ['⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','🧾','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️','🧹','🪠','🧺','🧻','🚽','🚰','🚿','🛁','🛀','🧼','🪥','🪒','🪞','🧽','🪣','🛎️','🔑','🗝️','🚪','🪑','🛋️','🛏️','🛌','🧸','🪆','🖼️','🪞','🪟','🛍️','🛒','🎁','🎀','🎊','🎉','🪅','🪩']
  },
  {
    id: 'symbols',
    name: 'Symbols',
    icon: '💯',
    emojis: ['💯','💢','💬','👁️‍🗨️','🗨️','🗯️','💭','💤','♠️','♥️','♦️','♣️','🃏','🀄','🎴','🎼','🎵','🎶','💲','💱','™️','©️','®️','〰️','➰','➿','🔚','🔙','🔛','🔝','🔜','✔️','☑️','🔘','⚪','⚫','🔴','🔵','🟢','🟡','🟠','🟣','🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️','◻️','⬛','⬜','🟥','🟧','🟨','🟩','🟦','🟪','🟫','💠','🔔','🔕','📢','📣','📯','📡','💻','📱','📲','✉️','📨','📩','📤','📥','📦','📫','📪','📬','📭','📮','📜','📃','📄','📑','📊','📈','📉','📋','📌','📍','📎','🖇️','📏','📐','✂️','🗃️','🗄️','🗑️','🔒','🔓','🔏','🔐','🔑','🗝️','♻️','⚜️','🔱','📛','🔰','⭕','✅','☑️','✔️','❌','❎','➕','➖','➗','✖️','♾️','💲','💱','❓','❔','❕','❗','〽️','⚠️','🚸','🔅','🔆','🔱','⚜️']
  },
  {
    id: 'flags',
    name: 'Flags',
    icon: '🏳️',
    emojis: ['🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇺🇸','🇨🇦','🇲🇽','🇬🇧','🇫🇷','🇩🇪','🇮🇹','🇪🇸','🇵🇹','🇳🇱','🇧🇪','🇨🇭','🇦🇹','🇸🇪','🇳🇴','🇩🇰','🇫🇮','🇮🇸','🇮🇪','🇵🇱','🇨🇿','🇸🇰','🇭🇺','🇷🇴','🇧🇬','🇬🇷','🇹🇷','🇷🇺','🇺🇦','🇧🇾','🇪🇪','🇱🇻','🇱🇹','🇯🇵','🇰🇷','🇨🇳','🇮🇳','🇧🇷','🇦🇷','🇨🇱','🇨🇴','🇵🇪','🇻🇪','🇿🇦','🇪🇬','🇲🇦','🇳🇬','🇰🇪','🇪🇹','🇦🇺','🇳🇿']
  }
];

// Quick reactions
const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

// Picker dimensions used for viewport clamping. Match the values below.
// 360px width fits all 10 category tabs evenly (no horizontal scroll) and
// gives the 8-column emoji grid generous breathing room. Height is left
// at 440 so the grid shows ~5 rows before scroll.
const PICKER_WIDTH = 360;
const PICKER_HEIGHT = 440;
const VIEWPORT_PAD = 8;
// Re-exported so call sites can compute anchor coordinates that match
// the picker's actual width (place the picker BESIDE a bubble, not over
// it). Keep these in sync.
export const EMOJI_PICKER_WIDTH = PICKER_WIDTH;
export const EMOJI_PICKER_HEIGHT = PICKER_HEIGHT;

// Detect dark mode from html.dark class with a MutationObserver so the
// picker re-renders if the user toggles theme while the picker is open.
function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

// Treat the supplied (x, y) as the picker's desired top-left and clamp
// it inside the viewport. Call sites are responsible for choosing the
// anchor strategy (typically beside the bubble — see Messages.tsx) so
// the picker mirrors the "..." context-menu's "open next to the target"
// pattern instead of floating somewhere above with a large gap.
function clampPickerPosition(x: number, y: number) {
  if (typeof window === 'undefined') return { top: y, left: x };
  const maxLeft = window.innerWidth - PICKER_WIDTH - VIEWPORT_PAD;
  const maxTop = window.innerHeight - PICKER_HEIGHT - VIEWPORT_PAD;
  return {
    left: Math.max(VIEWPORT_PAD, Math.min(x, maxLeft)),
    top: Math.max(VIEWPORT_PAD, Math.min(y, maxTop)),
  };
}

// Styles — factory so we can swap palettes per theme without forking
// the component. Original dark-only inline styles are preserved as the
// dark branch verbatim; light-mode values mirror Pulse's surface tokens.
function makeStyles(isDarkMode: boolean) {
  // Pulse design-system colours. Dark surfaces use translucent layers
  // over the true-black canvas per the Translucency-Over-Tinting Rule;
  // light surfaces stay on paper-pure. Active state uses --pulse-rose
  // (coral) per the Coral-As-Signal Rule — never the purple
  // status-proposed colour. Tinted neutrals only, never #000 / #fff.
  const panelBg = isDarkMode ? 'rgba(255, 255, 255, 0.055)' : '#ffffff';
  const panelBorder = isDarkMode ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)';
  const dividerBorder = isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const fieldBg = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
  const fieldBorder = isDarkMode ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)';
  const fieldText = isDarkMode ? '#fafafa' : '#0f0f0f';      // ink — half-step, not #fff / #000
  const mutedText = isDarkMode ? '#b4b4b8' : '#52525b';
  const subtleText = isDarkMode ? '#6b7280' : '#6b7280';
  const hoverBg = isDarkMode ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.06)';
  // Coral active state — Pulse's only sanctioned colour for selection.
  const accentBg = isDarkMode ? 'rgba(244, 63, 94, 0.12)' : 'rgba(244, 63, 94, 0.10)';
  const accentBorder = isDarkMode ? 'rgba(244, 63, 94, 0.40)' : 'rgba(244, 63, 94, 0.30)';
  const accentText = isDarkMode ? '#fb7185' : '#e11d48';
  const dashedBorder = isDarkMode ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.20)';
  // Pulse motion signature: 220ms cubic-bezier(0.16, 1, 0.3, 1).
  const transition = 'all var(--pulse-duration, 220ms) var(--pulse-ease, cubic-bezier(0.16, 1, 0.3, 1))';
  return {
  container: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    alignItems: 'center'
  },
  reaction: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '12px',
    border: `1px solid ${fieldBorder}`,
    backgroundColor: fieldBg,
    color: fieldText,
    cursor: 'pointer',
    transition: transition,
    fontSize: '14px'
  },
  reactionActive: {
    backgroundColor: accentBg,
    borderColor: accentBorder
  },
  reactionCount: {
    fontSize: '11px',
    fontWeight: 600,
    color: mutedText
  },
  addButton: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: `1px dashed ${dashedBorder}`,
    backgroundColor: 'transparent',
    color: subtleText,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    transition: transition
  },
  picker: {
    position: 'fixed' as const,
    backgroundColor: panelBg,
    color: fieldText,
    // 12px = Pulse default popover radius. 16-20px is for modals/sheets,
    // not floating panels.
    borderRadius: '12px',
    border: `1px solid ${panelBorder}`,
    // Modal-tier shadow per the Elevation vocabulary. Glass-on-purpose:
    // backdrop-filter is allowed on floating panels (modal/menu/dropdown).
    backdropFilter: isDarkMode ? 'blur(24px)' : 'blur(12px)',
    WebkitBackdropFilter: isDarkMode ? 'blur(24px)' : 'blur(12px)',
    boxShadow: isDarkMode
      ? '0 20px 25px -5px rgba(0, 0, 0, 0.50), 0 10px 10px -5px rgba(0, 0, 0, 0.30)'
      : '0 20px 25px -5px rgba(0, 0, 0, 0.10), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    width: `${PICKER_WIDTH}px`,
    maxHeight: `${PICKER_HEIGHT}px`,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    zIndex: 1000
  },
  pickerHeader: {
    padding: '12px',
    borderBottom: `1px solid ${dividerBorder}`
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: `1px solid ${fieldBorder}`,
    backgroundColor: fieldBg,
    color: fieldText,
    fontSize: '13px',
    outline: 'none'
  },
  quickBar: {
    display: 'flex',
    gap: '4px',
    padding: '8px 12px',
    borderBottom: `1px solid ${dividerBorder}`
  },
  quickEmoji: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: transition
  },
  categoryTabs: {
    // Single horizontal row, no scroll — tabs flex-distribute across
    // the picker width so all 10 categories fit. If the picker is ever
    // resized below ~280px, the icons start crowding but won't scroll.
    display: 'flex',
    gap: '2px',
    padding: '8px 12px',
    borderBottom: `1px solid ${dividerBorder}`,
  },
  categoryTab: {
    // `flex: 1` so tabs evenly fill the row; minWidth: 0 lets them
    // shrink below their content size if needed. fontSize stays at 16px;
    // the buttons just get a touch narrower at small picker widths.
    flex: '1 1 0',
    minWidth: 0,
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: transition,
  },
  categoryTabActive: {
    backgroundColor: accentBg,
    color: accentText,
    boxShadow: `inset 0 -2px 0 ${accentBorder}`,
  },
  emojiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: '4px',
    padding: '12px',
    overflowY: 'auto' as const,
    flex: 1,
    maxHeight: '250px'
  },
  emojiButton: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: transition
  },
  categoryTitle: {
    // Pulse mono label — the system's signature. Inter-uppercase
    // collapses the picker into Generic SaaS. Mono-uppercase keeps it
    // instrument-grade.
    gridColumn: '1 / -1',
    fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
    fontSize: '11px',
    fontWeight: 500,
    color: mutedText,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    padding: '8px 0 4px'
  },
  tooltip: {
    position: 'absolute' as const,
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: panelBg,
    border: `1px solid ${panelBorder}`,
    fontSize: '11px',
    color: mutedText,
    whiteSpace: 'nowrap' as const,
    marginBottom: '4px',
    zIndex: 10
  },
  // expose the hover background for inline event handlers
  _hoverBg: hoverBg,
  _mutedText: mutedText,
  };
}
// Backwards-compat alias for legacy consumers (ReactionButton, EmojiReactions)
// that still use the const-style `styles` reference. Dark mode by default
// matches the prior behaviour exactly so visual output is preserved for
// those surfaces until they migrate to makeStyles().
const styles = makeStyles(true);

// Emoji Picker Component
//
// /impeccable critique cleanup (2026-05-18):
//   - dropped the redundant 8-emoji "quickReactions" row (Recent category
//     does the favourites job; two horizontal bars confused users)
//   - search now matches the emoji NAME from CLDR data (was matching the
//     query string against the emoji codepoint, which is broken)
//   - portal-rendered at document.body so no ancestor overflow can clip
//   - roving tabindex on the grid (arrow keys move between emojis)
//   - section title uses JetBrains Mono per the Mono-Label Rule
//   - active state uses coral, not purple (Status-Stays-Status Rule)
export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  position,
  recentEmojis = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  // Default to the first real category (smileys-emotion) after the
  // emojiCategories slug change.
  const [activeCategory, setActiveCategory] = useState(groupSlug(CLDR_GROUP_ORDER[0]));
  // Roving tabindex — which emoji button is currently keyboard-focused.
  const [focusedIndex, setFocusedIndex] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Theme + per-render styles factory. Recomputed when isDarkMode flips
  // so the picker tracks live theme toggles.
  const isDarkMode = useIsDarkMode();
  const s = useMemo(() => makeStyles(isDarkMode), [isDarkMode]);

  const categories = useMemo(() => {
    const cats = [...emojiCategories];
    if (recentEmojis.length > 0) {
      cats[0] = { ...cats[0], emojis: recentEmojis.slice(0, 16) };
    }
    return cats;
  }, [recentEmojis]);

  // Search across the full CLDR catalog by NAME (not by codepoint match
  // — that was the prior bug that made search return nothing for plain
  // English queries like "smile" or "thumbs").
  const filteredEmojis = useMemo(() => {
    if (!searchQuery) return null;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;
    return ALL_EMOJI_ENTRIES
      .filter(entry => entry.name.toLowerCase().includes(q))
      .map(entry => entry.emoji);
  }, [searchQuery]);

  // The currently visible flat list of emojis (search results OR the
  // active category). Drives the roving-tabindex math.
  const visibleEmojis = useMemo(() => {
    if (filteredEmojis) return filteredEmojis;
    const cat = categories.find(c => c.id === activeCategory);
    return cat ? cat.emojis : [];
  }, [filteredEmojis, categories, activeCategory]);

  // Reset focus when the visible set changes (new search, new category).
  useEffect(() => { setFocusedIndex(0); }, [searchQuery, activeCategory]);

  const handleSelect = useCallback((emoji: string) => {
    onSelect(emoji);
    onClose();
  }, [onSelect, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Arrow-key navigation across the emoji grid (8 cols). Enter / Space
  // selects, Esc closes (handled by parent click-outside).
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (visibleEmojis.length === 0) return;
    const COLS = 8;
    let next = focusedIndex;
    switch (e.key) {
      case 'ArrowRight': next = Math.min(focusedIndex + 1, visibleEmojis.length - 1); break;
      case 'ArrowLeft':  next = Math.max(focusedIndex - 1, 0); break;
      case 'ArrowDown':  next = Math.min(focusedIndex + COLS, visibleEmojis.length - 1); break;
      case 'ArrowUp':    next = Math.max(focusedIndex - COLS, 0); break;
      case 'Home':       next = 0; break;
      case 'End':        next = visibleEmojis.length - 1; break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleSelect(visibleEmojis[focusedIndex]);
        return;
      case 'Escape':
        e.preventDefault();
        onClose();
        return;
      default:
        return;
    }
    e.preventDefault();
    setFocusedIndex(next);
    // Move focus to the new button so screen readers track it.
    const buttons = gridRef.current?.querySelectorAll<HTMLButtonElement>('button[data-emoji-btn="true"]');
    buttons?.[next]?.focus();
  }, [visibleEmojis, focusedIndex, handleSelect, onClose]);

  if (!isOpen) return null;

  // Clamp to viewport when a position is supplied; centre on screen
  // otherwise. Right-half bubbles anchor the picker's right edge near
  // the supplied x so it opens leftward (mirrors MessageContextMenu).
  const clamped = position ? clampPickerPosition(position.x, position.y) : null;
  const pickerStyle: React.CSSProperties = {
    ...s.picker,
    ...(clamped
      ? { top: clamped.top, left: clamped.left }
      : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
  };

  const hoverIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.target as HTMLButtonElement).style.backgroundColor = s._hoverBg;
  };
  const hoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
  };

  // Find the meta for a given emoji to surface its name as aria-label /
  // title. Falls back to the codepoint if the emoji isn't in CLDR.
  const lookupName = (emoji: string): string => {
    const entry = ALL_EMOJI_ENTRIES.find(e => e.emoji === emoji);
    return entry?.name ?? emoji;
  };

  const picker = (
    <div ref={pickerRef} style={pickerStyle} role="dialog" aria-label="Emoji picker">
      <div style={s.pickerHeader}>
        <input
          type="text"
          placeholder="Search emoji…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={s.searchInput}
          autoFocus
          aria-label="Search emoji by name"
        />
      </div>

      {!searchQuery && (
        <div style={s.categoryTabs} role="tablist" aria-label="Emoji categories">
          {categories.filter(c => c.emojis.length > 0 || c.id !== 'recent').map(category => (
            <button
              key={category.id}
              role="tab"
              aria-selected={activeCategory === category.id}
              style={{
                ...s.categoryTab,
                ...(activeCategory === category.id ? s.categoryTabActive : {})
              }}
              onClick={() => setActiveCategory(category.id)}
              title={category.name}
              aria-label={category.name}
            >
              {category.icon}
            </button>
          ))}
        </div>
      )}

      <div
        ref={gridRef}
        style={s.emojiGrid}
        role="grid"
        aria-label={searchQuery ? `Emoji search results for ${searchQuery}` : activeCategory}
        onKeyDown={handleGridKeyDown}
      >
        {searchQuery ? (
          filteredEmojis && filteredEmojis.length > 0 ? (
            filteredEmojis.map((emoji, idx) => (
              <button
                key={emoji}
                data-emoji-btn="true"
                role="gridcell"
                aria-label={lookupName(emoji)}
                title={lookupName(emoji)}
                tabIndex={idx === focusedIndex ? 0 : -1}
                style={s.emojiButton}
                onClick={() => handleSelect(emoji)}
                onMouseEnter={hoverIn}
                onMouseLeave={hoverOut}
                onFocus={() => setFocusedIndex(idx)}
              >
                {emoji}
              </button>
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: s._mutedText }}>
              No emojis found
            </div>
          )
        ) : (
          categories
            .filter(c => c.id === activeCategory)
            .map(category => (
              <React.Fragment key={category.id}>
                <div style={s.categoryTitle}>{category.name}</div>
                {category.emojis.length === 0 ? (
                  <div style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: '20px',
                    fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
                    fontSize: '10px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: s._mutedText,
                  }}>
                    Most-used reactions land here
                  </div>
                ) : (
                  category.emojis.map((emoji, idx) => (
                    <button
                      key={`${category.id}-${emoji}`}
                      data-emoji-btn="true"
                      role="gridcell"
                      aria-label={lookupName(emoji)}
                      title={lookupName(emoji)}
                      tabIndex={idx === focusedIndex ? 0 : -1}
                      style={s.emojiButton}
                      onClick={() => handleSelect(emoji)}
                      onMouseEnter={hoverIn}
                      onMouseLeave={hoverOut}
                      onFocus={() => setFocusedIndex(idx)}
                    >
                      {emoji}
                    </button>
                  ))
                )}
              </React.Fragment>
            ))
        )}
      </div>
    </div>
  );

  // Portal to body so no ancestor's `overflow: hidden` or `transform`
  // can trap or clip the picker. Required for placement near message
  // bubbles whose parents may have transformed positioning.
  return typeof document !== 'undefined' ? createPortal(picker, document.body) : picker;
};

// Reaction with tooltip
const ReactionButton: React.FC<{
  reaction: Reaction;
  onClick: () => void;
}> = ({ reaction, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      {showTooltip && reaction.users.length > 0 && (
        <div style={styles.tooltip}>
          {reaction.users.slice(0, 5).join(', ')}
          {reaction.users.length > 5 && ` +${reaction.users.length - 5} more`}
        </div>
      )}
      <button
        style={{
          ...styles.reaction,
          ...(reaction.hasReacted ? styles.reactionActive : {})
        }}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span>{reaction.emoji}</span>
        <span style={styles.reactionCount}>{reaction.count}</span>
      </button>
    </div>
  );
};

// Main Emoji Reactions Component
export const EmojiReactions: React.FC<EmojiReactionsProps> = ({
  messageId,
  reactions,
  onReact,
  onRemoveReaction,
  compact = false
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<{ x: number; y: number } | undefined>();
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const handleAddClick = useCallback(() => {
    if (addButtonRef.current) {
      const rect = addButtonRef.current.getBoundingClientRect();
      setPickerPosition({
        x: Math.min(rect.left, window.innerWidth - 340),
        y: Math.min(rect.bottom + 8, window.innerHeight - 420)
      });
    }
    setShowPicker(true);
  }, []);

  const handleReactionClick = useCallback((reaction: Reaction) => {
    if (reaction.hasReacted) {
      onRemoveReaction?.(reaction.emoji);
    } else {
      onReact?.(reaction.emoji);
    }
  }, [onReact, onRemoveReaction]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    onReact?.(emoji);
  }, [onReact]);

  if (compact && (!reactions || reactions.length === 0)) {
    return null;
  }

  return (
    <div style={styles.container}>
      {(reactions || []).map(reaction => (
        <ReactionButton
          key={reaction.emoji}
          reaction={reaction}
          onClick={() => handleReactionClick(reaction)}
        />
      ))}

      <button
        ref={addButtonRef}
        style={styles.addButton}
        onClick={handleAddClick}
        onMouseEnter={e => {
          (e.target as HTMLButtonElement).style.borderColor = 'rgba(139, 92, 246, 0.4)';
          (e.target as HTMLButtonElement).style.color = '#a78bfa';
        }}
        onMouseLeave={e => {
          (e.target as HTMLButtonElement).style.borderColor = 'rgba(255, 255, 255, 0.2)';
          (e.target as HTMLButtonElement).style.color = '#64748b';
        }}
      >
        <Plus />
      </button>

      <EmojiPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleEmojiSelect}
        position={pickerPosition}
      />
    </div>
  );
};

// Quick Reaction Bar (for hover state on messages)
export const QuickReactionBar: React.FC<{
  onReact: (emoji: string) => void;
  existingReactions?: string[];
}> = ({ onReact, existingReactions = [] }) => {
  return (
    <div style={{
      display: 'flex',
      gap: '2px',
      padding: '4px',
      borderRadius: '8px',
      backgroundColor: 'rgba(26, 26, 36, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    }}>
      {quickReactions.map(emoji => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: existingReactions.includes(emoji) ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: transition
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            (e.target as HTMLButtonElement).style.transform = 'scale(1.2)';
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.backgroundColor = existingReactions.includes(emoji) ? 'rgba(139, 92, 246, 0.2)' : 'transparent';
            (e.target as HTMLButtonElement).style.transform = 'scale(1)';
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default EmojiReactions;
