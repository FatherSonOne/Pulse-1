import { supabase } from './supabase';
import { AppView } from '../types';
import { decisionService } from './decisionService';
import { taskService } from './taskService';

export type CaptureSourceSection =
  | 'dashboard'
  | 'global'
  | 'messages'
  | 'email'
  | 'relay'
  | 'calendar'
  | 'contacts'
  | 'decisions_tasks'
  | 'archives'
  | 'war_room'
  | 'summit'
  | 'meetings'
  | 'settings';

export type CaptureKind = 'decision' | 'learning' | 'friction' | 'question' | 'task' | null;

export interface CaptureNote {
  id: string;
  user_id: string;
  workspace_id: string;
  content: string;
  content_html: string | null;
  source_section: CaptureSourceSection;
  source_id: string | null;
  source_url: string | null;
  kind: CaptureKind;
  routed_task_id: string | null;
  routed_decision_id: string | null;
  tags: string[];
  ai_insight: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface CreateCaptureInput {
  workspaceId: string;
  content: string;
  sourceSection: CaptureSourceSection;
  sourceId?: string | null;
  sourceUrl?: string | null;
  kind?: CaptureKind;
  tags?: string[];
}

/**
 * Maps an AppView to a CaptureSourceSection. The capture modal calls this so
 * notes typed from anywhere in Pulse know where they came from.
 */
export const appViewToSourceSection = (view: AppView): CaptureSourceSection => {
  switch (view) {
    case AppView.DASHBOARD:        return 'dashboard';
    case AppView.MESSAGES:         return 'messages';
    case AppView.EMAIL:            return 'email';
    case AppView.RELAY:            return 'relay';
    case AppView.CALENDAR:         return 'calendar';
    case AppView.CONTACTS:         return 'contacts';
    case AppView.DECISIONS_TASKS:  return 'decisions_tasks';
    case AppView.ARCHIVES:         return 'archives';
    case AppView.MEETINGS:         return 'meetings';
    case AppView.SETTINGS:         return 'settings';
    case AppView.LIVE_AI:          return 'summit';
    default:                       return 'global';
  }
};

/**
 * Best-effort title extraction from free-form capture content. Uses the first
 * non-empty line if it's short enough; otherwise truncates the leading content.
 * Downstream Decisions/Tasks need a title; the full content goes into description.
 */
const deriveTitle = (content: string): string => {
  const trimmed = content.trim();
  const firstLine = trimmed.split(/\r?\n/, 1)[0] || trimmed;
  if (firstLine.length <= 100) return firstLine;
  return firstLine.slice(0, 80).trimEnd() + '…';
};

export interface CreateAndRouteResult {
  note: CaptureNote | null;
  routedTo: 'decision' | 'task' | null;
  routedId: string | null;
}

export const captureService = {
  /**
   * Persist a capture. Returns the inserted row or null on failure.
   */
  async create(input: CreateCaptureInput): Promise<CaptureNote | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[captureService.create] no authenticated user');
      return null;
    }

    const { data, error } = await supabase
      .from('pulse_notes')
      .insert({
        user_id: user.id,
        workspace_id: input.workspaceId,
        content: input.content,
        source_section: input.sourceSection,
        source_id: input.sourceId ?? null,
        source_url: input.sourceUrl ?? null,
        kind: input.kind ?? null,
        tags: input.tags ?? [],
      })
      .select()
      .single();

    if (error) {
      console.warn('[captureService.create] insert failed:', error.message);
      return null;
    }
    return data as CaptureNote;
  },

  /**
   * Create a capture AND, when `kind` is 'decision' or 'task', create the
   * downstream artifact and link it back via `routed_decision_id` /
   * `routed_task_id`. Other kinds (learning / friction / question) only
   * create the note.
   *
   * The capture is the source of truth — if the downstream create fails, the
   * note still lands so the thought isn't lost. The caller is told which
   * artifact (if any) was successfully routed.
   */
  async createAndRoute(input: CreateCaptureInput): Promise<CreateAndRouteResult> {
    const note = await this.create(input);
    if (!note) return { note: null, routedTo: null, routedId: null };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { note, routedTo: null, routedId: null };

    const title = deriveTitle(input.content);

    if (input.kind === 'decision') {
      const decision = await decisionService.createDecision({
        workspace_id: input.workspaceId,
        title,
        description: input.content,
        proposed_by: user.id,
      });
      if (decision?.id) {
        await supabase
          .from('pulse_notes')
          .update({ routed_decision_id: decision.id })
          .eq('id', note.id);
        return { note, routedTo: 'decision', routedId: decision.id };
      }
      return { note, routedTo: null, routedId: null };
    }

    if (input.kind === 'task') {
      const task = await taskService.createTask({
        workspace_id: input.workspaceId,
        title,
        description: input.content,
        created_by: user.id,
        priority: 'medium',
        status: 'todo',
      });
      if (task?.id) {
        await supabase
          .from('pulse_notes')
          .update({ routed_task_id: task.id })
          .eq('id', note.id);
        return { note, routedTo: 'task', routedId: task.id };
      }
      return { note, routedTo: null, routedId: null };
    }

    return { note, routedTo: null, routedId: null };
  },

  /**
   * Fetch a single note by id. Used when CapturesView hydrates from
   * `sessionStorage.pulse_focus_note` (set by the dashboard widget +
   * command-palette search results).
   */
  async getById(id: string): Promise<CaptureNote | null> {
    const { data, error } = await supabase
      .from('pulse_notes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.warn('[captureService.getById] failed:', error.message);
      return null;
    }
    return (data as CaptureNote) ?? null;
  },

  /**
   * Most-recent notes for a workspace, limited to `limit`. Used by the
   * dashboard widget and the captures view in Archives.
   */
  async listRecent(workspaceId: string, limit = 5): Promise<CaptureNote[]> {
    const { data, error } = await supabase
      .from('pulse_notes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[captureService.listRecent] failed:', error.message);
      return [];
    }
    return (data ?? []) as CaptureNote[];
  },

  /**
   * Per-source listing: war-room panel, summit panel, thread sidebar.
   */
  async listBySource(
    workspaceId: string,
    sourceSection: CaptureSourceSection,
    sourceId: string,
  ): Promise<CaptureNote[]> {
    const { data, error } = await supabase
      .from('pulse_notes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('source_section', sourceSection)
      .eq('source_id', sourceId)
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[captureService.listBySource] failed:', error.message);
      return [];
    }
    return (data ?? []) as CaptureNote[];
  },

  /**
   * Full-text search across captures for a workspace. Backed by the
   * `search_tsv` generated column + GIN index in the migration. Returns
   * notes ranked by relevance, capped at `limit`.
   */
  async search(workspaceId: string, query: string, limit = 20): Promise<CaptureNote[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    // Convert free-form query to tsquery: tokens joined by `&`. Strip anything
    // that would break the parser (single quotes, backslashes).
    const tsQuery = trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map(t => t.replace(/[':\\&|!()]/g, ''))
      .filter(Boolean)
      .map(t => `${t}:*`)
      .join(' & ');

    if (!tsQuery) return [];

    const { data, error } = await supabase
      .from('pulse_notes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .textSearch('search_tsv', tsQuery, { config: 'english' })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[captureService.search] failed:', error.message);
      return [];
    }
    return (data ?? []) as CaptureNote[];
  },

  /**
   * Soft-delete a capture. Hard delete is reserved for admin / retention sweeps.
   */
  async archive(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('pulse_notes')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.warn('[captureService.archive] failed:', error.message);
      return false;
    }
    return true;
  },

  /**
   * Update a capture's content (for inline edits in the modal or archives view).
   */
  async updateContent(id: string, content: string): Promise<boolean> {
    const { error } = await supabase
      .from('pulse_notes')
      .update({ content })
      .eq('id', id);

    if (error) {
      console.warn('[captureService.updateContent] failed:', error.message);
      return false;
    }
    return true;
  },
};
