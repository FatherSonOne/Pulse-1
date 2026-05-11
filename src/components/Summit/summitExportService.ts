/**
 * Summit Export Service
 *
 * Routes a Summit session's structured artifacts and notes to the right
 * downstream surfaces:
 *   - War Room (Archives entry, type: 'war_room_session')
 *   - Decisions & Tasks (one row per decision / task artifact)
 *   - Markdown blob (returned to caller, written to disk by Summit.tsx)
 *
 * Each destination returns a result with success/fail counts so the caller
 * can surface a precise toast ("3 of 4 tasks pushed").
 */

import { archiveService } from '../../services/archiveService';
import { decisionService } from '../../services/decisionService';
import { taskService } from '../../services/taskService';
import type {
  SessionArtifact,
  SessionArtifacts,
  StoredVoiceNote,
} from './voiceSessionStore';

export interface SummitSessionPayload {
  startedAt: number;
  endedAt: number;
  durationSec: number;
  notes: StoredVoiceNote[];
  artifacts: SessionArtifacts;
  /** Optional last-line snippet for War Room title/blurb. */
  takeaway?: string;
}

export interface PushResult {
  ok: number;
  fail: number;
  ids: string[];
}

export interface WarRoomExportResult {
  ok: boolean;
  archiveId?: string;
  error?: string;
}

const formatDate = (ms: number) => new Date(ms).toLocaleString();
const formatDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * Render the full session as a Markdown document. Used by both the file
 * download path and the War Room archive write.
 */
export function renderMarkdown(payload: SummitSessionPayload): string {
  const { startedAt, endedAt, durationSec, notes, artifacts, takeaway } = payload;

  const sections: string[] = [];
  sections.push(`# Summit Session`);
  sections.push('');
  sections.push(`**Started:** ${formatDate(startedAt)}`);
  sections.push(`**Ended:** ${formatDate(endedAt)}`);
  sections.push(`**Duration:** ${formatDuration(durationSec)}`);
  if (takeaway) sections.push(`\n> ${takeaway}`);
  sections.push('');

  const renderArtifactBlock = (heading: string, items: SessionArtifact[]) => {
    if (items.length === 0) return;
    sections.push(`## ${heading}`);
    sections.push('');
    items.forEach((a) => {
      const tag = a.source === 'auto' ? '[AUTO]' : '[YOU]';
      const meta: string[] = [];
      if (a.meta?.priority) meta.push(`priority: ${a.meta.priority}`);
      if (a.meta?.dueDate) meta.push(`due: ${new Date(a.meta.dueDate).toLocaleDateString()}`);
      const metaStr = meta.length > 0 ? `  \n  *${meta.join(' · ')}*` : '';
      sections.push(`- ${tag} ${a.content}${metaStr}`);
    });
    sections.push('');
  };

  renderArtifactBlock('Decisions', artifacts.decisions);
  renderArtifactBlock('Tasks', artifacts.tasks);
  renderArtifactBlock('References', artifacts.references);
  renderArtifactBlock('Open Questions', artifacts.questions);

  if (notes.length > 0) {
    sections.push('## Notes');
    sections.push('');
    notes.forEach((n) => {
      const time = new Date(n.timestamp).toLocaleTimeString();
      sections.push(`- *(${time})* ${n.content}`);
    });
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Push the Decisions bucket to the workspace's `decisions` table. Each
 * artifact becomes a `proposed`-status decision the team can vote on.
 */
export async function pushDecisions(
  workspaceId: string,
  userId: string,
  decisions: SessionArtifact[],
): Promise<PushResult> {
  const ids: string[] = [];
  let fail = 0;
  for (const d of decisions) {
    try {
      const created = await decisionService.createDecision({
        workspace_id: workspaceId,
        proposed_by: userId,
        title: d.content,
        decision_type: 'general',
      });
      if (created?.id) {
        ids.push(created.id);
      } else {
        fail += 1;
      }
    } catch {
      fail += 1;
    }
  }
  return { ok: ids.length, fail, ids };
}

/**
 * Push the Tasks bucket to the workspace's `extracted_tasks` table.
 * Maps artifact meta (priority, dueDate) to taskService fields.
 */
export async function pushTasks(
  workspaceId: string,
  userId: string,
  tasks: SessionArtifact[],
): Promise<PushResult> {
  const ids: string[] = [];
  let fail = 0;
  for (const t of tasks) {
    try {
      const created = await taskService.createTask({
        workspace_id: workspaceId,
        title: t.content,
        priority: t.meta?.priority ?? 'medium',
        deadline: t.meta?.dueDate,
        created_by: userId,
        metadata: { source: 'summit' },
      });
      if (created?.id) {
        ids.push(created.id);
      } else {
        fail += 1;
      }
    } catch {
      fail += 1;
    }
  }
  return { ok: ids.length, fail, ids };
}

/**
 * Persist the rendered session to Archives as a War Room session entry.
 * The user can browse / share / export from there.
 */
export async function exportToWarRoom(
  payload: SummitSessionPayload,
  options?: { title?: string; tags?: string[] },
): Promise<WarRoomExportResult> {
  try {
    const content = renderMarkdown(payload);
    const fallbackTitle = `Summit · ${new Date(payload.startedAt).toLocaleString()}`;
    const archive = await archiveService.createArchive({
      type: 'war_room_session',
      title: options?.title?.trim() || fallbackTitle,
      content,
      date: new Date(payload.endedAt),
      tags: options?.tags ?? ['summit'],
    });
    if (!archive?.id) {
      return { ok: false, error: 'Archive creation returned no id' };
    }
    return { ok: true, archiveId: archive.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
