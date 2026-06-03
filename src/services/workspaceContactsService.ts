// workspaceContactsService.ts
// Phase B: workspace elevation for personal contacts.
//
// Safety-critical: listWorkspaceContacts hand-picks SAFE COLUMNS only
// from the contacts table. The underlying contacts RLS gates the row
// for cross-user reads, but a careless SELECT * could expose owner-
// only fields (notes, case_notes, phone, address) if RLS ever weakens.
// Defense in depth: always explicit column list here.

import { supabase } from './supabase';

export interface BulkResult {
  succeeded: string[];
  failed: Array<{ id: string; reason: string }>;
}

export interface WorkspaceSharedContact {
  // SAFE columns only - never include notes/case_notes/phone/address here.
  id: string;
  name: string;
  email: string | null;
  avatar_color: string | null;
  role: string | null;
  // Share metadata:
  shared_by: string | null;
  shared_at: string;
}

interface WorkspaceContactSafeColumns {
  id: string;
  name: string;
  email: string | null;
  avatar_color: string | null;
  role: string | null;
}

interface WorkspaceContactRow {
  shared_by: string | null;
  shared_at: string;
  contacts: WorkspaceContactSafeColumns | WorkspaceContactSafeColumns[];
}

/**
 * Share N contacts owned by the current user into a workspace.
 * Returns per-id success/failure. RLS enforces caller is workspace
 * member AND contact owner; any id that fails predicate appears in `failed`.
 */
export async function shareContactsToWorkspace(
  contactIds: string[],
  workspaceId: string
): Promise<BulkResult> {
  if (contactIds.length === 0) return { succeeded: [], failed: [] };

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Not authenticated');

  const CHUNK = 500;
  const succeeded: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  for (let i = 0; i < contactIds.length; i += CHUNK) {
    const chunk = contactIds.slice(i, i + CHUNK);
    const rows = chunk.map(id => ({
      workspace_id: workspaceId,
      contact_id: id,
      shared_by: user.id,
    }));

    const { data, error } = await supabase
      .from('workspace_contacts')
      .upsert(rows, { onConflict: 'workspace_id,contact_id' })
      .select('contact_id');

    if (error) {
      chunk.forEach(id => failed.push({ id, reason: error.message }));
      continue;
    }

    const returnedIds = new Set((data ?? []).map(r => r.contact_id));
    for (const id of chunk) {
      if (returnedIds.has(id)) succeeded.push(id);
      else failed.push({ id, reason: 'rls_blocked_or_missing' });
    }
  }

  return { succeeded, failed };
}

/**
 * List contacts shared into a workspace. SAFE columns only.
 */
export async function listWorkspaceContacts(
  workspaceId: string
): Promise<WorkspaceSharedContact[]> {
  const { data, error } = await supabase
    .from('workspace_contacts')
    .select(`
      shared_by,
      shared_at,
      contacts!inner (
        id,
        name,
        email,
        avatar_color,
        role
      )
    `)
    .eq('workspace_id', workspaceId)
    .order('shared_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as WorkspaceContactRow[]).flatMap(row => {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    if (!contact) return [];
    return [{
      id: contact.id,
      name: contact.name,
      email: contact.email,
      avatar_color: contact.avatar_color,
      role: contact.role,
      shared_by: row.shared_by,
      shared_at: row.shared_at,
    }];
  });
}

/**
 * Remove a contact's workspace share. RLS enforces sharer OR workspace admin.
 */
export async function unshareContactFromWorkspace(
  contactId: string,
  workspaceId: string
): Promise<void> {
  const { error } = await supabase
    .from('workspace_contacts')
    .delete()
    .eq('contact_id', contactId)
    .eq('workspace_id', workspaceId);

  if (error) throw error;
}
