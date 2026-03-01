import React from 'react';
import {
  CheckIcon, CrossIcon, WarningIcon, BellIcon, TargetIcon,
  ChartIcon, ChatIcon, RocketIcon, LightbulbIcon, LightningIcon,
  FireIcon, GearIcon, MicrophoneIcon, ClipboardIcon, EmailIcon,
  LinkIcon, HookIcon, MobileIcon, WrenchIcon, HashIcon,
  StarIcon, TrophyIcon, TagIcon, PeopleIcon, MegaphoneIcon,
  ToolsIcon, PaletteIcon, NoteIcon, SignalIcon,
  KeyboardIcon, GlobeIcon, PackageIcon, EditIcon, PinIcon,
  SaveIcon, UploadIcon, ReplyIcon, ForwardIcon, CalendarIcon,
  LaptopIcon, GamepadIcon,
} from './icons';

export type IconName =
  | 'check' | 'cross' | 'warning' | 'bell' | 'target'
  | 'chart' | 'chat' | 'rocket' | 'lightbulb' | 'lightning'
  | 'fire' | 'gear' | 'microphone' | 'clipboard' | 'email'
  | 'link' | 'hook' | 'mobile' | 'wrench' | 'hash'
  | 'star' | 'sparkle' | 'trophy' | 'tag' | 'bookmark'
  | 'people' | 'megaphone' | 'broadcast' | 'tools' | 'palette'
  | 'note' | 'signal' | 'mic-studio' | 'lock'
  | 'keyboard' | 'globe' | 'package' | 'edit' | 'pin'
  | 'save' | 'upload' | 'reply' | 'forward' | 'calendar'
  | 'masks' | 'gamepad';

interface AnimatedIconProps {
  icon: IconName | string;
  size?: number;
  color?: string;
  className?: string;
}

const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string; className?: string }>> = {
  check: CheckIcon,
  cross: CrossIcon,
  warning: WarningIcon,
  bell: BellIcon,
  target: TargetIcon,
  chart: ChartIcon,
  chat: ChatIcon,
  rocket: RocketIcon,
  lightbulb: LightbulbIcon,
  lightning: LightningIcon,
  fire: FireIcon,
  gear: GearIcon,
  microphone: MicrophoneIcon,
  'mic-studio': MicrophoneIcon,
  clipboard: ClipboardIcon,
  email: EmailIcon,
  link: LinkIcon,
  hook: HookIcon,
  mobile: MobileIcon,
  wrench: WrenchIcon,
  hash: HashIcon,
  star: StarIcon,
  sparkle: StarIcon,
  trophy: TrophyIcon,
  tag: TagIcon,
  bookmark: TagIcon,
  people: PeopleIcon,
  megaphone: MegaphoneIcon,
  broadcast: MegaphoneIcon,
  tools: ToolsIcon,
  palette: PaletteIcon,
  note: NoteIcon,
  signal: SignalIcon,
  keyboard: KeyboardIcon,
  globe: GlobeIcon,
  package: PackageIcon,
  edit: EditIcon,
  pin: PinIcon,
  save: SaveIcon,
  upload: UploadIcon,
  reply: ReplyIcon,
  forward: ForwardIcon,
  calendar: CalendarIcon,
  lock: WrenchIcon, // placeholder — uses wrench shape; can replace with dedicated LockIcon
  masks: PaletteIcon, // placeholder — reuses palette; can replace with dedicated MasksIcon
  laptop: LaptopIcon,
  gamepad: GamepadIcon,
};

export const AnimatedIcon: React.FC<AnimatedIconProps> = ({
  icon,
  size = 18,
  color = 'currentColor',
  className = '',
}) => {
  const IconComponent = ICON_MAP[icon];
  if (!IconComponent) {
    // Fallback: render nothing if icon not found
    return null;
  }
  return <IconComponent size={size} color={color} className={className} />;
};

export default AnimatedIcon;
