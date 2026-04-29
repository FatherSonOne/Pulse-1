// src/services/tagsService.ts
//
// Phase 7b — client for the tags feature. Backed by `tag_definitions`
// (workspace-scoped tag taxonomy) and `thread_tags` (conversation
// assignments) from migration 20260427000001.
//
// Data model:
//   - A tag is defined once per workspace (name + color + description).
//   - A conversation (DM or channel) can have any number of tags.
//   - The same tag can be applied to many conversations.
//
// RLS shapes:
//   - Read: workspace members see their workspace's tag definitions
//     and any thread_tags whose tag belongs to their workspace.
//   - Write: only the original creator can update/delete a tag
//     definition; any workspace member can apply or remove a tag
//     assignment.

import { supabase } from './supabase';

export type ConversationKind = 'dm' | 'channel';

export interface TagDefinition {
  id: string;
  workspace_id: string;
  name: string;
  color: string; // hex
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface ThreadTag {
  id: string;
  tag_id: string;
  conversation_kind: ConversationKind;
  conversation_id: string;
  applied_by: string;
  applied_at: string;
}

interface CreateTagDefinitionInput {
  workspaceId: string;
  name: string;
  color?: string;
  description?: string;
}

interface ApplyTagInput {
  tagId: string;
  conversationKind: ConversationKind;
  conversationId: string;
}

class TagsService {
  // ── Definitions ─────────────────────────────────────────────

  /** All tags defined in the given workspace, alphabetical. */
  async listDefinitions(workspaceId: string): Promise<TagDefinition[]> {
    const { data, error } = await supabase
      .from('tag_definitions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as TagDefinition[];
  }

  /** Create a new tag definition in a workspace. UNIQUE constraint on
   *  (workspace_id, name) — surface a friendly error on collision. */
  async createDefinition(input: CreateTagDefinitionInput): Promise<TagDefinition> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const trimmed = input.name.trim();
    if (!trimmed) throw new Error('Tag name is required');

    const { data, error } = await supabase
      .from('tag_definitions')
      .insert({
        workspace_id: input.workspaceId,
        name: trimmed,
        color: input.color ?? '#94a3b8',
        description: input.description ?? null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        // Postgres unique violation
        throw new Error(`A tag named "${trimmed}" already exists in this workspace`);
      }
      throw error;
    }
    return data as TagDefinition;
  }

  /** Update name / color / description on a tag definition. RLS
   *  restricts to the original creator. */
  async updateDefinition(
    id: string,
    updates: Partial<Pick<TagDefinition, 'name' | 'color' | 'description'>>,
  ): Promise<TagDefinition> {
    const { data, error } = await supabase
      .from('tag_definitions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as TagDefinition;
  }

  /** Delete a tag definition (cascades to thread_tags via FK). */
  async deleteDefinition(id: string): Promise<void> {
    const { error } = await supabase
      .from('tag_definitions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // ── Assignments ─────────────────────────────────────────────

  /** Apply a tag to a conversation. Idempotent via the
   *  (tag_id, conversation_id) UNIQUE constraint — duplicate applies
   *  raise 23505 which we swallow as a no-op. */
  async applyTag(input: ApplyTagInput): Promise<ThreadTag | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('thread_tags')
      .insert({
        tag_id: input.tagId,
        conversation_kind: input.conversationKind,
        conversation_id: input.conversationId,
        applied_by: user.id,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') return null; // already applied
      throw error;
    }
    return data as ThreadTag;
  }

  /** Remove a single tag from a conversation. */
  async removeTag(tagId: string, conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('thread_tags')
      .delete()
      .eq('tag_id', tagId)
      .eq('conversation_id', conversationId);
    if (error) throw error;
  }

  /** All tags currently applied to a conversation, joined with their
   *  definitions so consumers can render colored pills directly. */
  async listTagsForConversation(
    conversationId: string,
  ): Promise<TagDefinition[]> {
    const { data, error } = await supabase
      .from('thread_tags')
      .select('tag:tag_definitions(*)')
      .eq('conversation_id', conversationId);
    if (error) throw error;
    // Postgres-rest types embedded relations as arrays even on
    // many-to-one joins, hence the unknown cast.
    const rows = (data ?? []) as unknown as Array<{ tag: TagDefinition | null }>;
    return rows
      .map((r) => r.tag)
      .filter((t): t is TagDefinition => !!t);
  }

  /** Bulk variant — load tags for many conversations at once and
   *  return a `Record<conversationId, TagDefinition[]>`. Useful for
   *  the thread list which renders pills next to every thread. */
  async listTagsForConversations(
    conversationIds: string[],
  ): Promise<Record<string, TagDefinition[]>> {
    if (conversationIds.length === 0) return {};
    const { data, error } = await supabase
      .from('thread_tags')
      .select('conversation_id, tag:tag_definitions(*)')
      .in('conversation_id', conversationIds);
    if (error) throw error;

    const rows = (data ?? []) as unknown as Array<{
      conversation_id: string;
      tag: TagDefinition | null;
    }>;
    const grouped: Record<string, TagDefinition[]> = {};
    for (const row of rows) {
      if (!row.tag) continue;
      grouped[row.conversation_id] ??= [];
      grouped[row.conversation_id].push(row.tag);
    }
    return grouped;
  }

  /** All conversations tagged with a specific tag. Useful for filter UI. */
  async listConversationsForTag(tagId: string): Promise<ThreadTag[]> {
    const { data, error } = await supabase
      .from('thread_tags')
      .select('*')
      .eq('tag_id', tagId);
    if (error) throw error;
    return (data ?? []) as ThreadTag[];
  }

  // ── Realtime ────────────────────────────────────────────────

  /** Subscribe to tag-assignment changes. Calls onChange with the
   *  affected conversation_id whenever a tag is applied or removed. */
  subscribeToTagChanges(
    onChange: (event: { conversationId: string; eventType: 'applied' | 'removed' }) => void,
  ): () => void {
    const channel = supabase
      .channel('thread-tags-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'thread_tags' },
        (payload) => {
          const row = payload.new as ThreadTag;
          onChange({ conversationId: row.conversation_id, eventType: 'applied' });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'thread_tags' },
        (payload) => {
          const row = payload.old as ThreadTag;
          onChange({ conversationId: row.conversation_id, eventType: 'removed' });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }
}

export const tagsService = new TagsService();
export default tagsService;
