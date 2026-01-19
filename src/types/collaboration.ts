/**
 * Collaboration Types
 * Sharing, permissions, and activity feed
 */

// ============================================
// PERMISSIONS
// ============================================

export interface SharePermissions {
  canView: boolean;
  canComment: boolean;
  canEdit: boolean;
  canShare: boolean;
}

export interface ProjectSharePermissions extends SharePermissions {
  canAddDocs: boolean;
}

// Permission presets for quick selection
export const PERMISSION_PRESETS = {
  viewer: {
    label: 'Viewer',
    description: 'Can view only',
    icon: 'fa-eye',
    permissions: { canView: true, canComment: false, canEdit: false, canShare: false },
  },
  commenter: {
    label: 'Commenter',
    description: 'Can view and comment',
    icon: 'fa-comment',
    permissions: { canView: true, canComment: true, canEdit: false, canShare: false },
  },
  editor: {
    label: 'Editor',
    description: 'Can view, comment, and edit',
    icon: 'fa-pencil',
    permissions: { canView: true, canComment: true, canEdit: true, canShare: false },
  },
  admin: {
    label: 'Admin',
    description: 'Full access including sharing',
    icon: 'fa-user-shield',
    permissions: { canView: true, canComment: true, canEdit: true, canShare: true },
  },
} as const;

export type PermissionPreset = keyof typeof PERMISSION_PRESETS;

// ============================================
// DOCUMENT SHARES
// ============================================

export interface DocumentShare {
  id: string;
  doc_id: string;
  shared_by: string;
  shared_with_user?: string;
  shared_with_email?: string;
  permissions: SharePermissions;
  public_link?: string;
  expires_at?: string;
  message?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  sharer?: {
    email: string;
    display_name?: string;
    avatar_url?: string;
  };
  recipient?: {
    email: string;
    display_name?: string;
    avatar_url?: string;
  };
  document?: {
    title: string;
    file_type: string;
  };
}

export interface CreateDocumentSharePayload {
  doc_id: string;
  shared_with_email?: string;
  shared_with_user?: string;
  permissions: SharePermissions;
  expires_at?: string;
  message?: string;
  create_public_link?: boolean;
}

export interface UpdateDocumentSharePayload {
  permissions?: SharePermissions;
  expires_at?: string | null;
  message?: string;
}

// ============================================
// PROJECT SHARES
// ============================================

export interface ProjectShare {
  id: string;
  project_id: string;
  shared_by: string;
  shared_with_user?: string;
  shared_with_email?: string;
  permissions: ProjectSharePermissions;
  public_link?: string;
  expires_at?: string;
  message?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  sharer?: {
    email: string;
    display_name?: string;
    avatar_url?: string;
  };
  recipient?: {
    email: string;
    display_name?: string;
    avatar_url?: string;
  };
  project?: {
    name: string;
    icon: string;
    color: string;
  };
}

export interface CreateProjectSharePayload {
  project_id: string;
  shared_with_email?: string;
  shared_with_user?: string;
  permissions: ProjectSharePermissions;
  expires_at?: string;
  message?: string;
  create_public_link?: boolean;
}

// ============================================
// SHARE INVITES
// ============================================

export interface ShareInvite {
  id: string;
  email: string;
  invite_type: 'document' | 'project';
  resource_id: string;
  invited_by: string;
  permissions: SharePermissions | ProjectSharePermissions;
  token: string;
  expires_at: string;
  accepted_at?: string;
  accepted_by?: string;
  created_at: string;
}

// ============================================
// ACTIVITY FEED
// ============================================

export type ActivityAction =
  | 'doc_uploaded'
  | 'doc_viewed'
  | 'doc_shared'
  | 'doc_unshared'
  | 'doc_commented'
  | 'doc_deleted'
  | 'project_created'
  | 'project_shared'
  | 'project_unshared'
  | 'annotation_added'
  | 'annotation_resolved'
  | 'highlight_added'
  | 'highlight_deleted'
  | 'user_joined'
  | 'user_left'
  | 'audio_generated'
  | 'study_guide_created'
  | 'faq_generated'
  | 'timeline_generated'
  | 'tag_added'
  | 'collection_created';

export interface ActivityFeedItem {
  id: string;
  user_id: string;
  project_id?: string;
  doc_id?: string;
  action: ActivityAction;
  actor_id?: string;
  details?: Record<string, any>;
  is_read: boolean;
  created_at: string;
  // Joined data
  actor?: {
    email: string;
    display_name?: string;
    avatar_url?: string;
  };
  document?: {
    title: string;
    file_type: string;
  };
  project?: {
    name: string;
    icon: string;
    color: string;
  };
}

// Activity action display config
export const ACTIVITY_ACTIONS: Record<ActivityAction, {
  label: string;
  icon: string;
  color: string;
  pastTense: string;
}> = {
  doc_uploaded: { label: 'Document Uploaded', icon: 'fa-upload', color: 'text-blue-500', pastTense: 'uploaded' },
  doc_viewed: { label: 'Document Viewed', icon: 'fa-eye', color: 'text-gray-500', pastTense: 'viewed' },
  doc_shared: { label: 'Document Shared', icon: 'fa-share', color: 'text-green-500', pastTense: 'shared' },
  doc_unshared: { label: 'Share Removed', icon: 'fa-user-minus', color: 'text-orange-500', pastTense: 'unshared' },
  doc_commented: { label: 'Comment Added', icon: 'fa-comment', color: 'text-purple-500', pastTense: 'commented on' },
  doc_deleted: { label: 'Document Deleted', icon: 'fa-trash', color: 'text-red-500', pastTense: 'deleted' },
  project_created: { label: 'Project Created', icon: 'fa-folder-plus', color: 'text-blue-500', pastTense: 'created' },
  project_shared: { label: 'Project Shared', icon: 'fa-share-alt', color: 'text-green-500', pastTense: 'shared' },
  project_unshared: { label: 'Project Share Removed', icon: 'fa-user-minus', color: 'text-orange-500', pastTense: 'unshared' },
  annotation_added: { label: 'Annotation Added', icon: 'fa-sticky-note', color: 'text-yellow-500', pastTense: 'annotated' },
  annotation_resolved: { label: 'Annotation Resolved', icon: 'fa-check-circle', color: 'text-green-500', pastTense: 'resolved annotation on' },
  highlight_added: { label: 'Highlight Added', icon: 'fa-highlighter', color: 'text-yellow-400', pastTense: 'highlighted' },
  highlight_deleted: { label: 'Highlight Removed', icon: 'fa-eraser', color: 'text-gray-400', pastTense: 'removed highlight from' },
  user_joined: { label: 'User Joined', icon: 'fa-user-plus', color: 'text-green-500', pastTense: 'joined' },
  user_left: { label: 'User Left', icon: 'fa-user-minus', color: 'text-gray-500', pastTense: 'left' },
  audio_generated: { label: 'Audio Overview Generated', icon: 'fa-podcast', color: 'text-pink-500', pastTense: 'generated audio for' },
  study_guide_created: { label: 'Study Guide Created', icon: 'fa-book-open', color: 'text-emerald-500', pastTense: 'created study guide for' },
  faq_generated: { label: 'FAQ Generated', icon: 'fa-circle-question', color: 'text-blue-400', pastTense: 'generated FAQ for' },
  timeline_generated: { label: 'Timeline Generated', icon: 'fa-timeline', color: 'text-purple-400', pastTense: 'generated timeline for' },
  tag_added: { label: 'Tag Added', icon: 'fa-tag', color: 'text-rose-500', pastTense: 'tagged' },
  collection_created: { label: 'Collection Created', icon: 'fa-folder', color: 'text-indigo-500', pastTense: 'created collection' },
};

// ============================================
// SHARED WITH ME VIEW
// ============================================

export interface SharedWithMeItem {
  type: 'document' | 'project';
  id: string;
  share_id: string;
  title: string;
  file_type?: string;
  icon?: string;
  color?: string;
  shared_by: string;
  sharer_name?: string;
  sharer_email: string;
  permissions: SharePermissions | ProjectSharePermissions;
  shared_at: string;
  expires_at?: string;
}
