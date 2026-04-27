// src/services/messagePersonalService.ts
//
// Per-user message-attached features that previously lived as
// in-memory useState arrays in Messages.tsx (deep-dive issue #26):
//   - Bookmarks    (saved messages, with collections + tags)
//   - Highlights   (text-range highlights in 5 colors)
//   - Annotations  (post-it notes on a message, with threaded replies)
//   - Templates    (reusable message bodies, optionally workspace-shared)
//
// Backed by the migration:
//   supabase/migrations/20260426000007_messages_personal_features.sql
//
// All FKs reference `pulse_messages(id)` ON DELETE CASCADE — see the
// migration header for the message-identity scoping note.

import { supabase } from './supabase';

// ──────────────────────────────────────────────────────────────
// Bookmarks
// ──────────────────────────────────────────────────────────────

export interface MessageBookmark {
  id: string;
  user_id: string;
  message_id: string;
  collection: string | null;
  note: string | null;
  tags: string[];
  created_at: string;
}

export const messagePersonalService = {
  // ── Bookmarks ────────────────────────────────────────────────

  async listBookmarks(opts?: { collection?: string; limit?: number }): Promise<MessageBookmark[]> {
    let query = supabase
      .from('message_bookmarks')
      .select('*')
      .order('created_at', { ascending: false });
    if (opts?.collection) query = query.eq('collection', opts.collection);
    if (opts?.limit) query = query.limit(opts.limit);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as MessageBookmark[];
  },

  async addBookmark(input: {
    messageId: string;
    collection?: string;
    note?: string;
    tags?: string[];
  }): Promise<MessageBookmark> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('message_bookmarks')
      .insert({
        user_id: user.id,
        message_id: input.messageId,
        collection: input.collection ?? null,
        note: input.note ?? null,
        tags: input.tags ?? [],
      })
      .select()
      .single();
    if (error) throw error;
    return data as MessageBookmark;
  },

  async updateBookmark(
    id: string,
    updates: Partial<Pick<MessageBookmark, 'collection' | 'note' | 'tags'>>
  ): Promise<MessageBookmark> {
    const { data, error } = await supabase
      .from('message_bookmarks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as MessageBookmark;
  },

  async removeBookmark(id: string): Promise<void> {
    const { error } = await supabase.from('message_bookmarks').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Highlights ───────────────────────────────────────────────

  async listHighlightsForMessage(messageId: string): Promise<MessageHighlight[]> {
    const { data, error } = await supabase
      .from('message_highlights')
      .select('*')
      .eq('message_id', messageId)
      .order('range_start', { ascending: true });
    if (error) throw error;
    return (data ?? []) as MessageHighlight[];
  },

  async addHighlight(input: {
    messageId: string;
    rangeStart: number;
    rangeEnd: number;
    highlighted: string;
    color?: HighlightColor;
    label?: string;
  }): Promise<MessageHighlight> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('message_highlights')
      .insert({
        user_id: user.id,
        message_id: input.messageId,
        range_start: input.rangeStart,
        range_end: input.rangeEnd,
        highlighted: input.highlighted,
        color: input.color ?? 'yellow',
        label: input.label ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as MessageHighlight;
  },

  async removeHighlight(id: string): Promise<void> {
    const { error } = await supabase.from('message_highlights').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Annotations ──────────────────────────────────────────────

  async listAnnotationsForMessage(messageId: string): Promise<MessageAnnotation[]> {
    const { data, error } = await supabase
      .from('message_annotations')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as MessageAnnotation[];
  },

  async addAnnotation(input: {
    messageId: string;
    body: string;
    type?: AnnotationType;
    parentId?: string;
    mentions?: string[];
  }): Promise<MessageAnnotation> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('message_annotations')
      .insert({
        user_id: user.id,
        message_id: input.messageId,
        body: input.body,
        type: input.type ?? 'comment',
        parent_id: input.parentId ?? null,
        mentions: input.mentions ?? [],
      })
      .select()
      .single();
    if (error) throw error;
    return data as MessageAnnotation;
  },

  async updateAnnotation(
    id: string,
    updates: Partial<Pick<MessageAnnotation, 'body' | 'resolved' | 'type'>>
  ): Promise<MessageAnnotation> {
    const { data, error } = await supabase
      .from('message_annotations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as MessageAnnotation;
  },

  async removeAnnotation(id: string): Promise<void> {
    const { error } = await supabase.from('message_annotations').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Templates ────────────────────────────────────────────────

  async listTemplates(opts?: { workspaceId?: string }): Promise<MessageTemplate[]> {
    let query = supabase
      .from('message_templates')
      .select('*')
      .order('usage_count', { ascending: false })
      .order('updated_at', { ascending: false });
    // RLS already enforces visibility — we only need to filter client-side
    // when the caller wants templates from a specific workspace context.
    if (opts?.workspaceId) {
      query = query.or(`workspace_id.eq.${opts.workspaceId},workspace_id.is.null`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as MessageTemplate[];
  },

  async addTemplate(input: {
    name: string;
    body: string;
    category?: TemplateCategory;
    variables?: string[];
    tags?: string[];
    workspaceId?: string;
  }): Promise<MessageTemplate> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        user_id: user.id,
        workspace_id: input.workspaceId ?? null,
        name: input.name,
        body: input.body,
        category: input.category ?? 'custom',
        variables: input.variables ?? [],
        tags: input.tags ?? [],
      })
      .select()
      .single();
    if (error) throw error;
    return data as MessageTemplate;
  },

  async updateTemplate(
    id: string,
    updates: Partial<Pick<MessageTemplate, 'name' | 'body' | 'category' | 'variables' | 'tags' | 'workspace_id'>>
  ): Promise<MessageTemplate> {
    const { data, error } = await supabase
      .from('message_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as MessageTemplate;
  },

  async removeTemplate(id: string): Promise<void> {
    const { error } = await supabase.from('message_templates').delete().eq('id', id);
    if (error) throw error;
  },

  /** Increment usage_count and refresh last_used_at after a template is used. */
  async recordTemplateUsage(id: string): Promise<void> {
    const { error } = await supabase.rpc('increment_template_usage', { template_id: id });
    if (error) {
      // Fallback: read-modify-write if the RPC isn't deployed. Acceptable
      // because usage tracking is non-critical and lossy under contention.
      const { data } = await supabase
        .from('message_templates')
        .select('usage_count')
        .eq('id', id)
        .single();
      if (data) {
        await supabase
          .from('message_templates')
          .update({ usage_count: (data.usage_count ?? 0) + 1, last_used_at: new Date().toISOString() })
          .eq('id', id);
      }
    }
  },
};

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
export type AnnotationType = 'comment' | 'question' | 'suggestion' | 'flag' | 'approval';
export type TemplateCategory = 'greeting' | 'follow-up' | 'meeting' | 'feedback' | 'closing' | 'custom';

export interface MessageHighlight {
  id: string;
  user_id: string;
  message_id: string;
  range_start: number;
  range_end: number;
  highlighted: string;
  color: HighlightColor;
  label: string | null;
  created_at: string;
}

export interface MessageAnnotation {
  id: string;
  message_id: string;
  parent_id: string | null;
  user_id: string;
  body: string;
  type: AnnotationType;
  resolved: boolean;
  mentions: string[];
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: string;
  user_id: string;
  workspace_id: string | null;
  name: string;
  body: string;
  category: TemplateCategory;
  variables: string[];
  tags: string[];
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export default messagePersonalService;
