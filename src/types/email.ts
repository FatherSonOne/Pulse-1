// src/types/email.ts

export interface Email {
  id: string;
  messageId: string;
  threadId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  snippet: string;
  body: string;
  html?: string;
  attachments?: EmailAttachment[];
  labels: string[];
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  isDraft: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  timestamp: number;
  date: string;
  replyTo?: string;
}

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string;
  url?: string;
}

export interface EmailDraft {
  id: string;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  html?: string;
  attachments?: EmailAttachment[];
  inReplyTo?: string;
  savedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  html?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailLabel {
  id: string;
  name: string;
  color: string;
  type: 'system' | 'user';
  messageCount?: number;
  unreadCount?: number;
}

export interface EmailFilter {
  id: string;
  name: string;
  isEnabled: boolean;
  criteria: EmailFilterCriteria;
  actions: EmailFilterActions;
  createdAt: string;
}

export interface EmailFilterCriteria {
  from?: string;
  to?: string;
  subject?: string;
  hasWords?: string;
  doesNotHave?: string;
  hasAttachment?: boolean;
  size?: { operator: 'greater' | 'less'; value: number };
}

export interface EmailFilterActions {
  applyLabel?: string;
  archive?: boolean;
  markAsRead?: boolean;
  star?: boolean;
  forward?: string;
  delete?: boolean;
  markImportant?: boolean;
}

export interface EmailThread {
  id: string;
  subject: string;
  participants: EmailAddress[];
  messages: Email[];
  snippet: string;
  lastMessageAt: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  messageCount: number;
}

export interface EmailFolder {
  id: string;
  name: string;
  icon: string;
  count: number;
  unreadCount: number;
  color?: string;
}

// Default email folders
export const DEFAULT_EMAIL_FOLDERS: EmailFolder[] = [
  { id: 'inbox', name: 'Inbox', icon: 'fa-inbox', count: 0, unreadCount: 0 },
  { id: 'starred', name: 'Starred', icon: 'fa-star', count: 0, unreadCount: 0, color: 'text-yellow-500' },
  { id: 'important', name: 'Important', icon: 'fa-bookmark', count: 0, unreadCount: 0, color: 'text-red-500' },
  { id: 'sent', name: 'Sent', icon: 'fa-paper-plane', count: 0, unreadCount: 0 },
  { id: 'drafts', name: 'Drafts', icon: 'fa-file', count: 0, unreadCount: 0 },
  { id: 'spam', name: 'Spam', icon: 'fa-shield-halved', count: 0, unreadCount: 0 },
  { id: 'trash', name: 'Trash', icon: 'fa-trash', count: 0, unreadCount: 0 },
  { id: 'archive', name: 'Archive', icon: 'fa-box-archive', count: 0, unreadCount: 0 },
];
