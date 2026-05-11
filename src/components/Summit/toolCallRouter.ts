/**
 * Tool-call router — turns RealtimeVoiceAgent function_call/function_result
 * history items into Summit artifacts.
 *
 * The realtime agent already executes tools (create_decision, rag_search, …)
 * and persists side-effects to their target surfaces. Our job is to mirror
 * those calls into the artifact panel so the user sees what was pulled or
 * created during the session.
 *
 * Pairing model: the agent emits a `function_call` followed by a
 * `function_result` with the same call-id base. We pair them on `id` prefix
 * (`${callId}-call` and `${callId}-result`) and emit one artifact per pair.
 */

import type { RealtimeHistoryItem } from '../../services/realtimeAgentService';
import type { ArtifactKind, SessionArtifact } from './voiceSessionStore';

const REF_SNIPPET_MAX = 280;

interface ToolMapping {
  kind: ArtifactKind;
  /** Build human-readable card content from args + output. */
  formatContent: (args: Record<string, unknown>, output: string) => string;
  /** Extract optional metadata (priority, refId, …). */
  buildMeta?: (
    args: Record<string, unknown>,
    output: string,
  ) => SessionArtifact['meta'];
}

const truncate = (s: string, max = REF_SNIPPET_MAX): string =>
  s.length > max ? s.slice(0, max - 1) + '…' : s;

const safeParseJSON = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Per-tool: how to turn a (name, args, output) triple into an artifact.
 * Tools not in this map are ignored (e.g. set_reminder, report_grounding).
 */
const TOOL_MAP: Record<string, ToolMapping> = {
  create_decision: {
    kind: 'decision',
    formatContent: (args) => {
      const title = typeof args.title === 'string' ? args.title : '';
      const description = typeof args.description === 'string' ? args.description : '';
      return title || description || 'Decision recorded';
    },
    buildMeta: (_args, output) => {
      const parsed = safeParseJSON(output);
      const id =
        parsed && typeof parsed === 'object' && 'id' in parsed
          ? String((parsed as Record<string, unknown>).id)
          : undefined;
      return id ? { refId: id, refSection: 'decisions', toolName: 'create_decision' } : { toolName: 'create_decision' };
    },
  },
  create_task: {
    kind: 'task',
    formatContent: (args) => {
      const title = typeof args.title === 'string' ? args.title : '';
      const description = typeof args.description === 'string' ? args.description : '';
      return title || description || 'Task created';
    },
    buildMeta: (args, output) => {
      const parsed = safeParseJSON(output);
      const id =
        parsed && typeof parsed === 'object' && 'id' in parsed
          ? String((parsed as Record<string, unknown>).id)
          : undefined;
      const priority =
        typeof args.priority === 'string' &&
        ['low', 'medium', 'high', 'urgent'].includes(args.priority)
          ? (args.priority as 'low' | 'medium' | 'high' | 'urgent')
          : undefined;
      const dueDate = typeof args.deadline === 'string' ? args.deadline : undefined;
      return {
        toolName: 'create_task',
        refSection: 'tasks',
        ...(id ? { refId: id } : {}),
        ...(priority ? { priority } : {}),
        ...(dueDate ? { dueDate } : {}),
      };
    },
  },
  rag_search: {
    kind: 'reference',
    formatContent: (args, output) => {
      const query = typeof args.query === 'string' ? args.query : '';
      const snippet = truncate(String(output ?? '').trim() || 'No results.');
      return query ? `**${query}**\n\n${snippet}` : snippet;
    },
    buildMeta: () => ({ toolName: 'rag_search', refSection: 'knowledge_base' }),
  },
  search_documents: {
    kind: 'reference',
    formatContent: (args, output) => {
      const query = typeof args.query === 'string' ? args.query : '';
      const snippet = truncate(String(output ?? '').trim() || 'No documents.');
      return query ? `**${query}**\n\n${snippet}` : snippet;
    },
    buildMeta: () => ({ toolName: 'search_documents', refSection: 'documents' }),
  },
  search_messages: {
    kind: 'reference',
    formatContent: (args, output) => {
      const query = typeof args.query === 'string' ? args.query : '';
      const snippet = truncate(String(output ?? '').trim() || 'No matches.');
      return query ? `**${query}**\n\n${snippet}` : snippet;
    },
    buildMeta: () => ({ toolName: 'search_messages', refSection: 'messages' }),
  },
  get_project_summary: {
    kind: 'reference',
    formatContent: (_args, output) => truncate(String(output ?? '').trim() || 'No summary.'),
    buildMeta: () => ({ toolName: 'get_project_summary', refSection: 'projects' }),
  },
  generate_summary: {
    kind: 'reference',
    formatContent: (_args, output) => truncate(String(output ?? '').trim() || 'No summary.'),
    buildMeta: () => ({ toolName: 'generate_summary', refSection: 'session' }),
  },
};

export interface ToolArtifactCandidate {
  /** Stable id derived from the call id — used by callers to dedupe. */
  pairId: string;
  artifact: Omit<SessionArtifact, 'id' | 'timestamp'>;
}

/**
 * Find newly-completed function_call/result pairs in the history that haven't
 * already been routed (`alreadyRouted` is the set of pairIds the caller has
 * processed). Returns one candidate per fresh pair.
 */
export function findNewToolArtifacts(
  history: RealtimeHistoryItem[],
  alreadyRouted: Set<string>,
): ToolArtifactCandidate[] {
  const candidates: ToolArtifactCandidate[] = [];

  // Index function_result entries by their pair-base id.
  const results = new Map<string, RealtimeHistoryItem>();
  for (const item of history) {
    if (item.type !== 'function_result') continue;
    if (!item.id.endsWith('-result')) continue;
    const base = item.id.slice(0, -'-result'.length);
    results.set(base, item);
  }

  for (const item of history) {
    if (item.type !== 'function_call') continue;
    if (!item.id.endsWith('-call')) continue;
    const base = item.id.slice(0, -'-call'.length);
    if (alreadyRouted.has(base)) continue;

    const result = results.get(base);
    if (!result) continue; // pair not yet complete

    const toolName = item.name ?? '';
    const mapping = TOOL_MAP[toolName];
    if (!mapping) {
      // Mark as routed so we don't keep re-checking, but emit nothing.
      alreadyRouted.add(base);
      continue;
    }

    let args: Record<string, unknown> = {};
    if (item.arguments) {
      const parsed = safeParseJSON(item.arguments);
      if (parsed && typeof parsed === 'object') {
        args = parsed as Record<string, unknown>;
      }
    }
    const output = result.output ?? '';

    candidates.push({
      pairId: base,
      artifact: {
        kind: mapping.kind,
        content: mapping.formatContent(args, output),
        source: 'tool',
        meta: mapping.buildMeta?.(args, output),
      },
    });
  }

  return candidates;
}
