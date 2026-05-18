import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

import { Plus } from 'lucide-react';

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

// Emoji categories — full catalog covering all major Unicode emoji groups.
// Order matches the standard picker convention (Apple / Slack / Discord).
const emojiCategories: EmojiCategory[] = [
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
const PICKER_WIDTH = 320;
const PICKER_HEIGHT = 440;
const VIEWPORT_PAD = 8;

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

// Clamp a desired picker top-left so the 320×440 panel stays inside the
// viewport with VIEWPORT_PAD edge padding. Called with the caller's
// position prop (which typically points at the bubble's center).
function clampPickerPosition(x: number, y: number) {
  if (typeof window === 'undefined') return { top: y, left: x };
  // Center the picker horizontally on the supplied x (caller hands us
  // the bubble centre) and open above the supplied y by default. If the
  // result would clip, the Math.max/Math.min clamps slide it back into
  // view from either edge.
  const desiredLeft = x - PICKER_WIDTH / 2;
  const desiredTop = y - PICKER_HEIGHT - 8;
  const maxLeft = window.innerWidth - PICKER_WIDTH - VIEWPORT_PAD;
  const maxTop = window.innerHeight - PICKER_HEIGHT - VIEWPORT_PAD;
  return {
    left: Math.max(VIEWPORT_PAD, Math.min(desiredLeft, maxLeft)),
    top: Math.max(VIEWPORT_PAD, Math.min(desiredTop > 0 ? desiredTop : y + 8, maxTop)),
  };
}

// Styles — factory so we can swap palettes per theme without forking
// the component. Original dark-only inline styles are preserved as the
// dark branch verbatim; light-mode values mirror Pulse's surface tokens.
function makeStyles(isDarkMode: boolean) {
  const panelBg = isDarkMode ? '#1a1a24' : '#ffffff';
  const panelBorder = isDarkMode ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.10)';
  const dividerBorder = isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const fieldBg = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
  const fieldBorder = isDarkMode ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)';
  const fieldText = isDarkMode ? '#e2e8f0' : '#1f2937';
  const mutedText = isDarkMode ? '#94a3b8' : '#6b7280';
  const subtleText = isDarkMode ? '#64748b' : '#9ca3af';
  const hoverBg = isDarkMode ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.06)';
  const accentBg = isDarkMode ? 'rgba(139, 92, 246, 0.20)' : 'rgba(139, 92, 246, 0.12)';
  const accentBorder = isDarkMode ? 'rgba(139, 92, 246, 0.40)' : 'rgba(139, 92, 246, 0.30)';
  const dashedBorder = isDarkMode ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.20)';
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
    transition: 'all 0.2s ease',
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
    transition: 'all 0.2s ease'
  },
  picker: {
    position: 'fixed' as const,
    backgroundColor: panelBg,
    color: fieldText,
    borderRadius: '16px',
    border: `1px solid ${panelBorder}`,
    boxShadow: isDarkMode
      ? '0 20px 60px rgba(0, 0, 0, 0.5)'
      : '0 20px 60px rgba(0, 0, 0, 0.15)',
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
    transition: 'all 0.2s ease'
  },
  categoryTabs: {
    display: 'flex',
    gap: '2px',
    padding: '8px 12px',
    borderBottom: `1px solid ${dividerBorder}`,
    overflowX: 'auto' as const
  },
  categoryTab: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    flexShrink: 0
  },
  categoryTabActive: {
    backgroundColor: accentBg
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
    transition: 'all 0.15s ease'
  },
  categoryTitle: {
    gridColumn: '1 / -1',
    fontSize: '11px',
    fontWeight: 600,
    color: subtleText,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
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
export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  position,
  recentEmojis = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');
  const pickerRef = useRef<HTMLDivElement>(null);
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

  const filteredEmojis = useMemo(() => {
    if (!searchQuery) return null;
    const query = searchQuery.toLowerCase();
    const allEmojis = categories.flatMap(c => c.emojis);
    return allEmojis.filter(emoji => emoji.includes(query));
  }, [searchQuery, categories]);

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

  if (!isOpen) return null;

  // Clamp to viewport when a position is supplied; centre on screen
  // otherwise. The clamp keeps the 320×440 panel inside the viewport
  // for bubbles near any edge (previously the picker could extend past
  // the bottom of the screen and clip the catalogue).
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

  return (
    <div ref={pickerRef} style={pickerStyle}>
      <div style={s.pickerHeader}>
        <input
          type="text"
          placeholder="Search emoji..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={s.searchInput}
          autoFocus
        />
      </div>

      <div style={s.quickBar}>
        {quickReactions.map(emoji => (
          <button
            key={emoji}
            style={s.quickEmoji}
            onClick={() => handleSelect(emoji)}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.backgroundColor = s._hoverBg;
              (e.target as HTMLButtonElement).style.transform = 'scale(1.2)';
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
              (e.target as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            {emoji}
          </button>
        ))}
      </div>

      {!searchQuery && (
        <div style={s.categoryTabs}>
          {categories.filter(c => c.emojis.length > 0 || c.id !== 'recent').map(category => (
            <button
              key={category.id}
              style={{
                ...s.categoryTab,
                ...(activeCategory === category.id ? s.categoryTabActive : {})
              }}
              onClick={() => setActiveCategory(category.id)}
              title={category.name}
            >
              {category.icon}
            </button>
          ))}
        </div>
      )}

      <div style={s.emojiGrid}>
        {searchQuery ? (
          filteredEmojis && filteredEmojis.length > 0 ? (
            filteredEmojis.map(emoji => (
              <button
                key={emoji}
                style={s.emojiButton}
                onClick={() => handleSelect(emoji)}
                onMouseEnter={hoverIn}
                onMouseLeave={hoverOut}
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
            .filter(c => c.id === activeCategory && c.emojis.length > 0)
            .map(category => (
              <React.Fragment key={category.id}>
                <div style={s.categoryTitle}>{category.name}</div>
                {category.emojis.map(emoji => (
                  <button
                    key={`${category.id}-${emoji}`}
                    style={s.emojiButton}
                    onClick={() => handleSelect(emoji)}
                    onMouseEnter={hoverIn}
                    onMouseLeave={hoverOut}
                  >
                    {emoji}
                  </button>
                ))}
              </React.Fragment>
            ))
        )}
      </div>
    </div>
  );
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
            transition: 'all 0.15s ease'
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
