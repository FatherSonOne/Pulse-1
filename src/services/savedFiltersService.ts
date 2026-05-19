// savedFiltersService.ts
// Phase B: persisted contact filter predicates.

import { z } from 'zod';
import { supabase } from './supabase';

// Predicate DSL - Zod schema is authoritative. DB stores as opaque jsonb.
// Predicates reference Circles/Tags by stable UUID (not name) so renames don't break.
export const filterPredicateSchema = z.object({
  search: z.string().optional(),
  circle_ids: z.array(z.string().uuid()).optional(),
  tag_uuids: z.array(z.string().uuid()).optional(),
  smart_list: z.enum(['vip', 'recent', 'cold', 'inactive_30d', 'inactive_90d', 'never_opened_90d']).optional(),
  archived: z.boolean().optional(),
  import_source: z.enum(['google', 'microsoft', 'manual']).nullable().optional(),
  rfm_cohort: z.enum(['active', 'warm', 'cooling', 'stale', 'dormant']).optional(),
  email_domain: z.string().optional(),
});

export type FilterPredicate = z.infer<typeof filterPredicateSchema>;

export interface SavedFilter {
  id: string;
  user_id: string;
  workspace_id: string | null;
  name: string;
  predicate_json: FilterPredicate;
  created_at: string;
  updated_at: string;
}

interface FilterableContact {
  id?: string;
  name?: string | null;
  email?: string | null;
  company?: string | null;
  archived_at?: string | null;
  circle_ids?: string[];
  import_source?: string | null;
}

export async function listSavedFilters(workspaceId?: string): Promise<{ user: SavedFilter[]; workspace: SavedFilter[] }> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return { user: [], workspace: [] };

  const { data, error } = await supabase
    .from('saved_filters')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  const all = (data ?? []) as SavedFilter[];
  const userFilters = all.filter(f => f.user_id === user.id && f.workspace_id === null);
  const workspaceFilters = workspaceId
    ? all.filter(f => f.workspace_id === workspaceId)
    : [];

  return { user: userFilters, workspace: workspaceFilters };
}

export async function createSavedFilter(input: {
  name: string;
  predicate: FilterPredicate;
  workspaceId?: string;
}): Promise<SavedFilter> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Not authenticated');

  const validated = filterPredicateSchema.parse(input.predicate);

  const { data, error } = await supabase
    .from('saved_filters')
    .insert({
      user_id: user.id,
      workspace_id: input.workspaceId ?? null,
      name: input.name,
      predicate_json: validated,
    })
    .select()
    .single();

  if (error) throw error;
  return data as SavedFilter;
}

export async function updateSavedFilter(id: string, patch: Partial<{ name: string; predicate: FilterPredicate }>): Promise<SavedFilter> {
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.predicate !== undefined) updates.predicate_json = filterPredicateSchema.parse(patch.predicate);

  const { data, error } = await supabase
    .from('saved_filters')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as SavedFilter;
}

export async function deleteSavedFilter(id: string): Promise<void> {
  const { error } = await supabase.from('saved_filters').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Apply a saved filter's predicate in-memory against a contacts array.
 * Used by the UI to filter the loaded contacts page.
 *
 * Returns the filter result + orphaned-condition count (referenced
 * Circle/Tag UUIDs no longer exist in the user's data).
 */
export function applyFilterPredicate<TContact extends FilterableContact>(
  predicate: FilterPredicate,
  contacts: TContact[],
  knownCircleIds: Set<string>,
  knownTagUuids: Set<string>
): { matched: TContact[]; orphanedConditions: number } {
  let orphanedConditions = 0;

  if (predicate.circle_ids) {
    const orphanCircles = predicate.circle_ids.filter(id => !knownCircleIds.has(id));
    orphanedConditions += orphanCircles.length;
  }
  if (predicate.tag_uuids) {
    const orphanTags = predicate.tag_uuids.filter(id => !knownTagUuids.has(id));
    orphanedConditions += orphanTags.length;
  }

  const validCircleIds = (predicate.circle_ids ?? []).filter(id => knownCircleIds.has(id));

  const matched = contacts.filter(c => {
    if (predicate.archived !== undefined) {
      const isArchived = !!c.archived_at;
      if (predicate.archived !== isArchived) return false;
    }
    if (predicate.search) {
      const q = predicate.search.toLowerCase();
      const hay = `${c.name ?? ''} ${c.email ?? ''} ${c.company ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (validCircleIds.length > 0) {
      const contactCircleIds = c.circle_ids ?? [];
      if (!validCircleIds.some(id => contactCircleIds.includes(id))) return false;
    }
    if (predicate.import_source !== undefined) {
      if (c.import_source !== predicate.import_source) return false;
    }
    // smart_list, rfm_cohort, email_domain filters are computed against
    // RelationshipProfile / cohort metadata at call sites with that data.
    return true;
  });

  return { matched, orphanedConditions };
}
