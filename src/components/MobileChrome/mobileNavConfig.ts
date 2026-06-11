// Shared config for the mobile slim bar + navigation sheet.
//
// Ground truth for the section list is the desktop Sidebar's nav config
// (src/components/Sidebar/Sidebar.tsx getNavSections): same grouping, same
// lucide icons, same flag gating — minus the four hot-row destinations,
// which render as large thumb targets at the top of the sheet instead of
// repeating in the lists. VIEW_LABELS additionally names views reachable
// outside the sheet (Settings, SMS, deep links) so the bar's center label
// never goes blank.

import type { ComponentType } from 'react';
import {
  Archive,
  BarChart3,
  BookOpen,
  Calendar,
  Hash,
  HelpCircle,
  Home,
  ListChecks,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Mic,
  Search,
  Settings,
  Users,
  Video,
} from 'lucide-react';
import { AppView } from '../../types';

export interface MobileNavItem {
  view: AppView;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** FeatureContext flag that must be ON for the row to render at all. */
  requiresFlag?: 'slackChannelsGrounding';
  /** Row carries an OFF caption while the email surface is disabled
   *  (mirrors the Sidebar; navigation still works — the Email view renders
   *  its own placeholder when the flag is off). */
  showsEmailGate?: boolean;
}

export interface MobileNavSection {
  label: string;
  items: MobileNavItem[];
  /** Greyed out (non-navigable) unless experimental features are enabled —
   *  mirrors the Sidebar's Experimental section. */
  experimental?: boolean;
}

/** The four destinations the old 5-tab bar carried, now the sheet's hot row. */
export const HOT_ITEMS: MobileNavItem[] = [
  { view: AppView.DASHBOARD, label: 'Home', icon: Home },
  { view: AppView.RELAY, label: 'Relay', icon: Mic },
  { view: AppView.MESSAGES, label: 'Messages', icon: MessageCircle },
  { view: AppView.DECISIONS_TASKS, label: 'Decisions', icon: ListChecks },
];

export const NAV_SECTIONS: MobileNavSection[] = [
  {
    label: 'Communication',
    items: [
      { view: AppView.EMAIL, label: 'Email', icon: Mail, showsEmailGate: true },
      { view: AppView.GLIMPSE, label: 'Glimpse', icon: Video },
      { view: AppView.SLACK_CHANNELS, label: 'Slack Channels', icon: Hash, requiresFlag: 'slackChannelsGrounding' },
    ],
  },
  {
    label: 'Work & People',
    items: [
      { view: AppView.CALENDAR, label: 'Calendar', icon: Calendar },
      { view: AppView.MEETINGS, label: 'Meetings', icon: Video },
      { view: AppView.CONTACTS, label: 'Contacts', icon: Users },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { view: AppView.MULTI_MODAL, label: 'Search', icon: Search },
      { view: AppView.ANALYTICS, label: 'Analytics', icon: BarChart3 },
      { view: AppView.ARCHIVES, label: 'Archives', icon: Archive },
      { view: AppView.USERS_GUIDE, label: 'User Guide', icon: HelpCircle },
    ],
  },
  {
    label: 'Experimental',
    experimental: true,
    items: [
      { view: AppView.LIVE, label: 'Summit', icon: MessageSquare },
      { view: AppView.MAP, label: 'Map', icon: MapPin },
      { view: AppView.LIVE_AI, label: 'War Room', icon: BookOpen },
    ],
  },
  {
    label: 'System',
    items: [
      { view: AppView.SETTINGS, label: 'Settings', icon: Settings },
    ],
  },
];

/** Bar center label for the current view. Every AppView is named so the
 *  label can't go blank (CONTACT_MAP redirects to MAP before render but is
 *  covered anyway). */
export const VIEW_LABELS: Record<AppView, string> = {
  [AppView.DASHBOARD]: 'Home',
  [AppView.MESSAGES]: 'Messages',
  [AppView.EMAIL]: 'Email',
  [AppView.SMS]: 'SMS',
  [AppView.RELAY]: 'Relay',
  [AppView.GLIMPSE]: 'Glimpse',
  [AppView.SLACK_CHANNELS]: 'Slack Channels',
  [AppView.CALENDAR]: 'Calendar',
  [AppView.MEETINGS]: 'Meetings',
  [AppView.CONTACTS]: 'Contacts',
  [AppView.MAP]: 'Map',
  [AppView.LIVE]: 'Summit',
  [AppView.LIVE_AI]: 'War Room',
  [AppView.ARCHIVES]: 'Archives',
  [AppView.SETTINGS]: 'Settings',
  [AppView.MESSAGE_ANALYTICS]: 'Analytics',
  [AppView.MULTI_MODAL]: 'Search',
  [AppView.ANALYTICS]: 'Analytics',
  [AppView.DECISIONS_TASKS]: 'Decisions',
  [AppView.USERS_GUIDE]: 'User Guide',
  [AppView.CONTACT_MAP]: 'Map',
};
