/**
 * Collaboration Service
 * Handles sharing, permissions, and activity feed
 */

import { supabase } from './supabase';
import {
  DocumentShare,
  CreateDocumentSharePayload,
  UpdateDocumentSharePayload,
  ProjectShare,
  CreateProjectSharePayload,
  ShareInvite,
  ActivityFeedItem,
  ActivityAction,
  SharePermissions,
  ProjectSharePermissions,
  SharedWithMeItem,
} from '../types/collaboration';

// ============================================
// DOCUMENT SHARING
// ============================================

/**
 * Get all shares for a document
 */
export async function getDocumentShares(docId: string): Promise<DocumentShare[]> {
  const { data, error } = await supabase
    .from('document_shares')
    .select('*')
    .eq('doc_id', docId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching document shares:', error);
    throw error;
  }

  return data || [];
}

/**
 * Create a document share
 */
export async function createDocumentShare(
  userId: string,
  payload: CreateDocumentSharePayload
): Promise<DocumentShare> {
  const insertData: any = {
    doc_id: payload.doc_id,
    shared_by: userId,
    permissions: payload.permissions,
    message: payload.message,
  };

  // Set share target
  if (payload.shared_with_user) {
    insertData.shared_with_user = payload.shared_with_user;
  } else if (payload.shared_with_email) {
    insertData.shared_with_email = payload.shared_with_email;
  }

  // Generate public link if requested
  if (payload.create_public_link) {
    insertData.public_link = generateShortId();
  }

  // Set expiration
  if (payload.expires_at) {
    insertData.expires_at = payload.expires_at;
  }

  const { data, error } = await supabase
    .from('document_shares')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating document share:', error);
    throw error;
  }

  return data;
}

/**
 * Update a document share
 */
export async function updateDocumentShare(
  shareId: string,
  payload: UpdateDocumentSharePayload
): Promise<DocumentShare> {
  const { data, error } = await supabase
    .from('document_shares')
    .update(payload)
    .eq('id', shareId)
    .select()
    .single();

  if (error) {
    console.error('Error updating document share:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a document share
 */
export async function deleteDocumentShare(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('document_shares')
    .delete()
    .eq('id', shareId);

  if (error) {
    console.error('Error deleting document share:', error);
    throw error;
  }
}

/**
 * Create a public link for a document
 */
export async function createPublicLink(
  userId: string,
  docId: string,
  permissions: SharePermissions = { canView: true, canComment: false, canEdit: false, canShare: false },
  expiresAt?: string
): Promise<string> {
  const publicLink = generateShortId();

  const { error } = await supabase
    .from('document_shares')
    .insert({
      doc_id: docId,
      shared_by: userId,
      public_link: publicLink,
      permissions,
      expires_at: expiresAt,
    });

  if (error) {
    console.error('Error creating public link:', error);
    throw error;
  }

  return publicLink;
}

/**
 * Get document by public link
 */
export async function getDocumentByPublicLink(publicLink: string): Promise<{
  docId: string;
  permissions: SharePermissions;
} | null> {
  const { data, error } = await supabase
    .from('document_shares')
    .select('doc_id, permissions, expires_at')
    .eq('public_link', publicLink)
    .single();

  if (error || !data) {
    return null;
  }

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }

  return {
    docId: data.doc_id,
    permissions: data.permissions,
  };
}

/**
 * Revoke public link
 */
export async function revokePublicLink(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('document_shares')
    .update({ public_link: null })
    .eq('id', shareId);

  if (error) {
    console.error('Error revoking public link:', error);
    throw error;
  }
}

// ============================================
// PROJECT SHARING
// ============================================

/**
 * Get all shares for a project
 */
export async function getProjectShares(projectId: string): Promise<ProjectShare[]> {
  const { data, error } = await supabase
    .from('project_shares')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching project shares:', error);
    throw error;
  }

  return data || [];
}

/**
 * Create a project share
 */
export async function createProjectShare(
  userId: string,
  payload: CreateProjectSharePayload
): Promise<ProjectShare> {
  const insertData: any = {
    project_id: payload.project_id,
    shared_by: userId,
    permissions: payload.permissions,
    message: payload.message,
  };

  if (payload.shared_with_user) {
    insertData.shared_with_user = payload.shared_with_user;
  } else if (payload.shared_with_email) {
    insertData.shared_with_email = payload.shared_with_email;
  }

  if (payload.create_public_link) {
    insertData.public_link = generateShortId();
  }

  if (payload.expires_at) {
    insertData.expires_at = payload.expires_at;
  }

  const { data, error } = await supabase
    .from('project_shares')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating project share:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a project share
 */
export async function deleteProjectShare(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('project_shares')
    .delete()
    .eq('id', shareId);

  if (error) {
    console.error('Error deleting project share:', error);
    throw error;
  }
}

// ============================================
// SHARED WITH ME
// ============================================

/**
 * Get all items shared with the current user
 */
export async function getSharedWithMe(userId: string): Promise<SharedWithMeItem[]> {
  const items: SharedWithMeItem[] = [];

  // Get shared documents
  const { data: docShares } = await supabase
    .from('document_shares')
    .select(`
      id,
      doc_id,
      shared_by,
      permissions,
      created_at,
      expires_at,
      knowledge_docs(title, file_type)
    `)
    .eq('shared_with_user', userId);

  if (docShares) {
    for (const share of docShares) {
      const doc = share.knowledge_docs as any;
      if (doc) {
        items.push({
          type: 'document',
          id: share.doc_id,
          share_id: share.id,
          title: doc.title,
          file_type: doc.file_type,
          shared_by: share.shared_by,
          sharer_email: '', // Would need join
          permissions: share.permissions,
          shared_at: share.created_at,
          expires_at: share.expires_at,
        });
      }
    }
  }

  // Get shared projects
  const { data: projectShares } = await supabase
    .from('project_shares')
    .select(`
      id,
      project_id,
      shared_by,
      permissions,
      created_at,
      expires_at,
      ai_projects(name, icon, color)
    `)
    .eq('shared_with_user', userId);

  if (projectShares) {
    for (const share of projectShares) {
      const project = share.ai_projects as any;
      if (project) {
        items.push({
          type: 'project',
          id: share.project_id,
          share_id: share.id,
          title: project.name,
          icon: project.icon,
          color: project.color,
          shared_by: share.shared_by,
          sharer_email: '',
          permissions: share.permissions,
          shared_at: share.created_at,
          expires_at: share.expires_at,
        });
      }
    }
  }

  // Sort by shared_at descending
  items.sort((a, b) => new Date(b.shared_at).getTime() - new Date(a.shared_at).getTime());

  return items;
}

/**
 * Check if user has access to a document
 */
export async function checkDocumentAccess(
  userId: string,
  docId: string
): Promise<SharePermissions | null> {
  // Check ownership
  const { data: doc } = await supabase
    .from('knowledge_docs')
    .select('user_id')
    .eq('id', docId)
    .single();

  if (doc?.user_id === userId) {
    return { canView: true, canComment: true, canEdit: true, canShare: true };
  }

  // Check direct share
  const { data: share } = await supabase
    .from('document_shares')
    .select('permissions, expires_at')
    .eq('doc_id', docId)
    .eq('shared_with_user', userId)
    .single();

  if (share) {
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return null;
    }
    return share.permissions;
  }

  return null;
}

// ============================================
// ACTIVITY FEED
// ============================================

/**
 * Record an activity
 */
export async function recordActivity(
  userId: string,
  action: ActivityAction,
  options?: {
    projectId?: string;
    docId?: string;
    details?: Record<string, any>;
  }
): Promise<void> {
  const { error } = await supabase.from('activity_feed').insert({
    user_id: userId,
    actor_id: userId,
    action,
    project_id: options?.projectId,
    doc_id: options?.docId,
    details: options?.details,
  });

  if (error) {
    console.error('Error recording activity:', error);
    // Don't throw - activity logging shouldn't break the app
  }
}

/**
 * Notify other users about an activity
 */
export async function notifyActivity(
  actorId: string,
  targetUserIds: string[],
  action: ActivityAction,
  options?: {
    projectId?: string;
    docId?: string;
    details?: Record<string, any>;
  }
): Promise<void> {
  const inserts = targetUserIds.map(userId => ({
    user_id: userId,
    actor_id: actorId,
    action,
    project_id: options?.projectId,
    doc_id: options?.docId,
    details: options?.details,
  }));

  const { error } = await supabase.from('activity_feed').insert(inserts);

  if (error) {
    console.error('Error notifying activity:', error);
  }
}

/**
 * Get activity feed for a user
 */
export async function getActivityFeed(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    projectId?: string;
    docId?: string;
  }
): Promise<ActivityFeedItem[]> {
  let query = supabase
    .from('activity_feed')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options?.unreadOnly) {
    query = query.eq('is_read', false);
  }

  if (options?.projectId) {
    query = query.eq('project_id', options.projectId);
  }

  if (options?.docId) {
    query = query.eq('doc_id', options.docId);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching activity feed:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get unread activity count
 */
export async function getUnreadActivityCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('activity_feed')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Mark activities as read
 */
export async function markActivitiesAsRead(
  userId: string,
  activityIds?: string[]
): Promise<void> {
  let query = supabase
    .from('activity_feed')
    .update({ is_read: true })
    .eq('user_id', userId);

  if (activityIds && activityIds.length > 0) {
    query = query.in('id', activityIds);
  }

  const { error } = await query;

  if (error) {
    console.error('Error marking activities as read:', error);
    throw error;
  }
}

/**
 * Clear all activities for a user
 */
export async function clearActivityFeed(userId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_feed')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error clearing activity feed:', error);
    throw error;
  }
}

// ============================================
// SHARE INVITES
// ============================================

/**
 * Create a share invite for an email
 */
export async function createShareInvite(
  invitedBy: string,
  email: string,
  inviteType: 'document' | 'project',
  resourceId: string,
  permissions: SharePermissions | ProjectSharePermissions,
  expiresInDays = 7
): Promise<ShareInvite> {
  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { data, error } = await supabase
    .from('share_invites')
    .insert({
      email,
      invite_type: inviteType,
      resource_id: resourceId,
      invited_by: invitedBy,
      permissions,
      token,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating invite:', error);
    throw error;
  }

  return data;
}

/**
 * Accept a share invite
 */
export async function acceptShareInvite(
  userId: string,
  token: string
): Promise<{ type: 'document' | 'project'; resourceId: string }> {
  // Get the invite
  const { data: invite, error: fetchError } = await supabase
    .from('share_invites')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .single();

  if (fetchError || !invite) {
    throw new Error('Invalid or expired invite');
  }

  // Check expiration
  if (new Date(invite.expires_at) < new Date()) {
    throw new Error('Invite has expired');
  }

  // Create the share
  if (invite.invite_type === 'document') {
    await supabase.from('document_shares').insert({
      doc_id: invite.resource_id,
      shared_by: invite.invited_by,
      shared_with_user: userId,
      permissions: invite.permissions,
    });
  } else {
    await supabase.from('project_shares').insert({
      project_id: invite.resource_id,
      shared_by: invite.invited_by,
      shared_with_user: userId,
      permissions: invite.permissions,
    });
  }

  // Mark invite as accepted
  await supabase
    .from('share_invites')
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq('id', invite.id);

  return {
    type: invite.invite_type,
    resourceId: invite.resource_id,
  };
}

/**
 * Get pending invites for a user's email
 */
export async function getPendingInvites(email: string): Promise<ShareInvite[]> {
  const { data, error } = await supabase
    .from('share_invites')
    .select('*')
    .eq('email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString());

  if (error) {
    console.error('Error fetching invites:', error);
    return [];
  }

  return data || [];
}

// ============================================
// HELPERS
// ============================================

/**
 * Generate a short ID for public links
 */
function generateShortId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate an invite token
 */
function generateInviteToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Format a share URL
 */
export function formatShareUrl(publicLink: string, type: 'document' | 'project' = 'document'): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/share/${type}/${publicLink}`;
}

/**
 * Copy share URL to clipboard
 */
export async function copyShareUrl(publicLink: string, type: 'document' | 'project' = 'document'): Promise<void> {
  const url = formatShareUrl(publicLink, type);
  await navigator.clipboard.writeText(url);
}
