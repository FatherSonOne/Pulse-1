// Shared folder copy + icon metadata for the hybrid surface.
// Empty-state strings are ported verbatim from EmailListRedesign so the
// non-inbox folder views stay consistent with the legacy client during
// the side-by-side rollout.

import type { EmailFolder } from '../../../../services/emailSyncService';
import type { LucideIcon } from 'lucide-react';
import {
  Inbox, Send, FileEdit, Star, Flag, Clock,
  Trash2, ShieldAlert, Archive,
} from 'lucide-react';

export interface FolderMeta {
  id: EmailFolder;
  label: string;
  icon: LucideIcon;
  /** Title + body for the empty state when the folder has no emails. */
  empty: { title: string; body: string };
}

export const FOLDER_META: Record<EmailFolder, FolderMeta> = {
  inbox:     { id: 'inbox',     label: 'Inbox',     icon: Inbox,        empty: { title: 'Inbox zero.',            body: 'Nothing waiting on you right now.' } },
  starred:   { id: 'starred',   label: 'Starred',   icon: Star,         empty: { title: 'No starred emails yet.', body: 'Star important emails to keep them close.' } },
  important: { id: 'important', label: 'Important', icon: Flag,         empty: { title: 'No important emails.',   body: 'Emails marked important will appear here.' } },
  snoozed:   { id: 'snoozed',   label: 'Snoozed',   icon: Clock,        empty: { title: 'No snoozed emails.',     body: 'Snoozed emails return here when it is time to act.' } },
  sent:      { id: 'sent',      label: 'Sent',      icon: Send,         empty: { title: 'No sent emails yet.',    body: 'Messages you send from Pulse will appear here.' } },
  drafts:    { id: 'drafts',    label: 'Drafts',    icon: FileEdit,     empty: { title: 'No drafts saved.',       body: 'Start a new email and save it to finish later.' } },
  all:       { id: 'all',       label: 'All Mail',  icon: Archive,      empty: { title: 'No emails cached yet.',  body: 'Sync Gmail to fill All Mail.' } },
  trash:     { id: 'trash',     label: 'Trash',     icon: Trash2,       empty: { title: 'Trash is empty.',        body: 'Emails you move to trash will appear here before deletion.' } },
  spam:      { id: 'spam',      label: 'Spam',      icon: ShieldAlert,  empty: { title: 'No spam found.',         body: 'Messages marked as spam will appear here.' } },
};

/** Display order for the folders dropdown (inbox first, then by importance). */
export const FOLDER_ORDER: EmailFolder[] = [
  'inbox', 'starred', 'important', 'snoozed',
  'sent', 'drafts', 'all', 'trash', 'spam',
];
