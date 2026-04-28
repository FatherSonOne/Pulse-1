// Frame: "Resolve a conflict"
//
// Disagreement between people or directions; needs a resolution. Step 2
// captures the disagreement narrative, the parties involved (workspace
// members, min 2), each party's stated position, and the decide-by date
// (default today + 5 days because conflicts shouldn't linger).
//
// The unique mechanic here is the dynamic `partyPositions` array. As the
// MemberPicker for `parties` changes, partyPositions is reconciled: new
// parties get a fresh empty position, removed parties drop their entry,
// and existing positions for parties still selected are preserved verbatim.
// Each entry also caches a partyName resolved against workspaceMembers so
// the deriver and AI prompt can produce human-readable output without
// re-resolving the user list.
//
// AI generation mirrors the router pattern from pickToolFrame and from
// parseNaturalLanguageTaskWithFallback in geminiService: invokeAIJson is
// the primary call, hard router errors (cap exceeded, trial expired,
// provider unavailable) bubble up so the wizard host can prompt for
// upgrade, and any soft failure degrades to a hand-rolled task plan that
// still references parties by their actual display name (never "Party 1"
// when a real name is available).

import React, { useEffect } from 'react';
import { GitFork } from 'lucide-react';

import type { DecisionFrame, Step2Props, SuggestedTask } from '../types';
import type { ConflictStep2, PartyPosition } from './conflictFrame.types';
import { TextareaField, MemberPicker, DatePicker } from '../primitives';
import type { User } from '../../../../types';
import { invokeAIJson } from '../../../../services/ai/aiService';
import { getCurrentWorkspaceId } from '../../../../services/ai/getWorkspaceId';
import {
  AIRouterError,
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from '../../../../services/ai/errors';

// ─── Constants ──────────────────────────────────────────────────────────────

const MIN_PARTIES = 2;
const MIN_DISAGREEMENT_CHARS = 10;
const DEFAULT_DECIDE_OFFSET_DAYS = 5;
const FOLLOWUP_DAYS_AFTER_DECISION = 14;

// ─── Helpers ────────────────────────────────────────────────────────────────

function isRouterHardError(err: unknown): err is AIRouterError {
  return (
    err instanceof AICapExceededError ||
    err instanceof AITrialExpiredError ||
    err instanceof AIProviderUnavailableError
  );
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  const a = new Date(fy, fm - 1, fd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function clampOffset(offset: number, max: number): number {
  if (offset < 0) return 0;
  if (offset > max) return max;
  return Math.round(offset);
}

function makeId(prefix: string, idx: number): string {
  return `${prefix}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
}

function memberDisplayName(m: User): string {
  return (m as User & { full_name?: string }).full_name || m.email || '';
}

function lookupMemberName(members: User[], id: string): string | undefined {
  const m = members.find((x) => x.id === id);
  if (!m) return undefined;
  const name = memberDisplayName(m);
  return name || undefined;
}

/** Resolve a display label for a party using the cached partyName, then
 *  the live workspaceMembers list, then the positional "Party N" fallback. */
function resolvePartyLabel(
  positions: PartyPosition[],
  partyId: string,
  members: User[],
): string {
  const entry = positions.find((p) => p.partyId === partyId);
  if (entry?.partyName && entry.partyName.trim()) return entry.partyName;
  const looked = lookupMemberName(members, partyId);
  if (looked) return looked;
  const idx = positions.findIndex((p) => p.partyId === partyId);
  return `Party ${idx >= 0 ? idx + 1 : positions.length + 1}`;
}

// ─── Default state ──────────────────────────────────────────────────────────

const defaultStep2: Partial<ConflictStep2> = {
  disagreement: '',
  parties: [],
  partyPositions: [],
  decideByDate: addDaysIso(todayIso(), DEFAULT_DECIDE_OFFSET_DAYS),
};

// ─── Validation ─────────────────────────────────────────────────────────────

function validateStep2(
  value: Partial<ConflictStep2>,
): Partial<Record<keyof ConflictStep2, string>> {
  const errors: Partial<Record<keyof ConflictStep2, string>> = {};

  const disagreement = (value.disagreement ?? '').trim();
  if (!disagreement) {
    errors.disagreement = 'Describe the disagreement.';
  } else if (disagreement.length < MIN_DISAGREEMENT_CHARS) {
    errors.disagreement = `Add a little more detail (at least ${MIN_DISAGREEMENT_CHARS} characters).`;
  }

  const parties = value.parties ?? [];
  if (parties.length < MIN_PARTIES) {
    errors.parties = `Pick at least ${MIN_PARTIES} parties.`;
  }

  const positions = value.partyPositions ?? [];
  if (parties.length >= MIN_PARTIES) {
    const allPartiesHavePositions = parties.every((id) => {
      const entry = positions.find((p) => p.partyId === id);
      return entry && entry.position.trim().length > 0;
    });
    if (!allPartiesHavePositions) {
      errors.partyPositions = "Capture every party's position.";
    }
  }

  if (!value.decideByDate) {
    errors.decideByDate = 'Pick a decide-by date.';
  }

  return errors;
}

// ─── Step 2 form ────────────────────────────────────────────────────────────

const Step2Form: React.FC<Step2Props<ConflictStep2>> = ({
  value,
  onChange,
  workspaceMembers,
  errors,
}) => {
  const v: Partial<ConflictStep2> = { ...defaultStep2, ...value };
  const disagreement = v.disagreement ?? '';
  const parties = v.parties ?? [];
  const partyPositions = v.partyPositions ?? [];
  const decideByDate = v.decideByDate ?? addDaysIso(todayIso(), DEFAULT_DECIDE_OFFSET_DAYS);

  const setField = <K extends keyof ConflictStep2>(
    key: K,
    next: ConflictStep2[K],
  ) => {
    onChange({ ...v, [key]: next });
  };

  // Reconcile partyPositions whenever parties or workspaceMembers change.
  // Preserves typed positions for parties still selected; pushes a fresh
  // empty entry for newly added parties; drops entries for parties no
  // longer selected; refreshes cached partyName so deriver / AI prompt
  // always have the latest display name available.
  useEffect(() => {
    const next: PartyPosition[] = parties.map((partyId) => {
      const existing = partyPositions.find((p) => p.partyId === partyId);
      const liveName = lookupMemberName(workspaceMembers, partyId);
      return {
        partyId,
        partyName: liveName ?? existing?.partyName,
        position: existing?.position ?? '',
      };
    });

    const sameLength = next.length === partyPositions.length;
    const sameContents =
      sameLength &&
      next.every((p, i) => {
        const cur = partyPositions[i];
        return (
          p.partyId === cur.partyId &&
          (p.partyName ?? '') === (cur.partyName ?? '')
        );
      });

    if (!sameContents) {
      onChange({ ...v, partyPositions: next });
    }
    // Only reconcile when parties or member metadata changes. Position
    // edits are handled separately via updatePosition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parties.join('|'), workspaceMembers.map((m) => `${m.id}:${memberDisplayName(m)}`).join('|')]);

  const updatePosition = (partyId: string, position: string) => {
    const next = partyPositions.map((p) =>
      p.partyId === partyId ? { ...p, position } : p,
    );
    onChange({ ...v, partyPositions: next });
  };

  return (
    <div className="dw-form">
      <TextareaField
        label="What's the disagreement?"
        value={disagreement}
        onChange={(next) => setField('disagreement', next)}
        placeholder="One or two sentences naming the friction."
        rows={3}
        required
        autoFocus
        error={errors?.disagreement}
      />

      <MemberPicker
        label="Parties involved"
        value={parties}
        onChange={(next) => setField('parties', next)}
        members={workspaceMembers}
        required
        multiSelect
        minItems={MIN_PARTIES}
        placeholder="Select at least two members"
        hint="Pick the members on either side of the disagreement."
        error={errors?.parties}
      />

      {parties.length > 0 && (
        <div className="dw-field">
          <span className="dw-field-label dt-label">Positions</span>
          {parties.map((partyId, idx) => {
            const label = resolvePartyLabel(partyPositions, partyId, workspaceMembers);
            const fallbackLabel = label || `Party ${idx + 1}`;
            const entry = partyPositions.find((p) => p.partyId === partyId);
            return (
              <TextareaField
                key={partyId}
                label={`What does ${fallbackLabel} want?`}
                value={entry?.position ?? ''}
                onChange={(next) => updatePosition(partyId, next)}
                placeholder={`${fallbackLabel}'s stated position or ask.`}
                rows={2}
                required
              />
            );
          })}
          {errors?.partyPositions && (
            <p className="dw-field-error" role="alert">{errors.partyPositions}</p>
          )}
        </div>
      )}

      <DatePicker
        label="Decide by"
        value={decideByDate}
        onChange={(next) => setField('decideByDate', next ?? '')}
        required
        hint="Defaults to five days out. Conflicts shouldn't linger."
        error={errors?.decideByDate}
      />
    </div>
  );
};

// ─── Title / description derivers ───────────────────────────────────────────

function deriveDecisionTitle(value: ConflictStep2): string {
  const text = (value.disagreement ?? '').trim();
  if (!text) return 'Resolve: conflict';
  const words = text.split(/\s+/);
  const summary = words.slice(0, 10).join(' ');
  const truncated = words.length > 10;
  return `Resolve: ${summary}${truncated ? '...' : ''}`;
}

function deriveDecisionDescription(value: ConflictStep2): string {
  const positions = value.partyPositions ?? [];
  const positionsBlock = positions
    .map(({ partyName, position }, idx) => {
      const label = partyName && partyName.trim() ? partyName : `Party ${idx + 1}`;
      return `**${label}:** ${position}`;
    })
    .join('\n\n');

  const lines: string[] = [
    '**Disagreement**',
    value.disagreement ?? '',
    '',
    '**Positions**',
  ];
  if (positionsBlock) {
    lines.push(positionsBlock);
  }
  if (value.decideByDate) {
    lines.push('');
    lines.push(`**Decide by:** ${formatDate(value.decideByDate)}`);
  }
  return lines.join('\n');
}

// ─── Task suggestion (AI + fallback) ────────────────────────────────────────

interface AIConflictTask {
  title?: string;
  description?: string;
  priority?: SuggestedTask['priority'];
  deadlineOffsetDays?: number;
  assigneeId?: string;
  isDecisionMoment?: boolean;
  isImmediate?: boolean;
}

function buildPrompt(value: ConflictStep2, daysFromNow: number): string {
  const positions = value.partyPositions ?? [];
  const partyNames = positions.map(
    (p, i) => (p.partyName && p.partyName.trim()) || `Party ${i + 1}`,
  );
  const positionsList = positions
    .map((p, i) => {
      const name = (p.partyName && p.partyName.trim()) || `Party ${i + 1}`;
      return `- ${name}: ${p.position}`;
    })
    .join('\n');

  return `You are helping a solo operator resolve a conflict between ${value.parties.length} parties.
Disagreement: ${value.disagreement}
Positions:
${positionsList}
Decide by: ${value.decideByDate} (${daysFromNow} days from now)

Generate a resolution task plan. Tasks should:
- Include a 1:1 conversation task with each party (one per party, parallel deadlines), referencing each party by name (${partyNames.join(', ')}). Never say "Party 1" or "Party 2" if a real name is given above.
- Include a "find common ground" or "list what we agree on" task in the middle of the timeline
- Include a "propose resolution" task before the decision moment
- Mark the resolution decision with isDecisionMoment: true and priority "urgent"
- Include a follow-up "check in 2 weeks later" task to verify the resolution held
- Keep it tight: 4 to 6 tasks total. Conflicts deserve focused action.

Return JSON: { "tasks": SuggestedTask[] }
Each task: { "title": string, "description"?: string, "priority": "low"|"medium"|"high"|"urgent", "deadlineOffsetDays": number, "isDecisionMoment"?: boolean }
Do not use em dashes. Plain hyphens or commas only.`;
}

function sanitizeAITasks(
  raw: unknown,
  daysToDecide: number,
): SuggestedTask[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const list = (raw as { tasks?: unknown }).tasks;
  if (!Array.isArray(list)) return null;

  const cleaned: SuggestedTask[] = [];
  let decisionMomentSeen = false;
  list.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const t = item as AIConflictTask;
    const title = typeof t.title === 'string' ? t.title.trim() : '';
    if (!title) return;
    const isDecisionMoment = Boolean(t.isDecisionMoment) && !decisionMomentSeen;
    if (isDecisionMoment) decisionMomentSeen = true;
    const priority: SuggestedTask['priority'] =
      t.priority && ['low', 'medium', 'high', 'urgent'].includes(t.priority)
        ? t.priority
        : isDecisionMoment
          ? 'urgent'
          : 'medium';
    const offset = clampOffset(
      typeof t.deadlineOffsetDays === 'number' && Number.isFinite(t.deadlineOffsetDays)
        ? t.deadlineOffsetDays
        : 0,
      daysToDecide + FOLLOWUP_DAYS_AFTER_DECISION,
    );
    cleaned.push({
      id: makeId('cf', idx),
      title,
      description: typeof t.description === 'string' ? t.description : undefined,
      priority,
      deadlineOffsetDays: offset,
      assigneeId: typeof t.assigneeId === 'string' ? t.assigneeId : undefined,
      isDecisionMoment,
      isImmediate: t.isImmediate === true,
    });
  });

  if (cleaned.length === 0) return null;

  // Guarantee one decision-moment task. If the AI didn't mark one, promote
  // the latest task that lands on or before the decide-by date.
  if (!cleaned.some((t) => t.isDecisionMoment)) {
    const eligible = cleaned.filter((t) => t.deadlineOffsetDays <= daysToDecide);
    const winner = (eligible.length > 0 ? eligible : cleaned).reduce((best, cur) =>
      cur.deadlineOffsetDays >= best.deadlineOffsetDays ? cur : best,
    );
    winner.isDecisionMoment = true;
    winner.priority = 'urgent';
  }

  return cleaned;
}

function buildFallbackTasks(
  value: ConflictStep2,
  daysToDecide: number,
): SuggestedTask[] {
  const safeDays = Math.max(1, daysToDecide);
  const positions = value.partyPositions ?? [];
  const tasks: SuggestedTask[] = [];

  // Per-party 1:1s in parallel during the first 40% of the window.
  const oneOnOneOffset = Math.max(1, Math.floor(safeDays * 0.4));
  positions.forEach((p, i) => {
    const name = (p.partyName && p.partyName.trim()) || `Party ${i + 1}`;
    tasks.push({
      id: makeId('cf-1to1', i),
      title: `1:1 with ${name}`,
      description: `Hear ${name}'s side directly. Surface what's actually at stake for them, beyond the stated position. Listen for the underlying need.`,
      priority: 'high',
      deadlineOffsetDays: oneOnOneOffset,
    });
  });

  // Common ground exercise at ~60%.
  tasks.push({
    id: makeId('cf-common', 0),
    title: 'List points of agreement and disagreement',
    description: 'Write down what every party already agrees on, and where the real fault lines are. Common ground first; sharpens what actually needs resolving.',
    priority: 'high',
    deadlineOffsetDays: Math.max(2, Math.floor(safeDays * 0.6)),
  });

  // Proposal at ~85%.
  tasks.push({
    id: makeId('cf-propose', 0),
    title: 'Draft resolution proposal',
    description: "Sketch a resolution that addresses each party's core concern. Walk through the trade-offs you're asking each side to accept.",
    priority: 'high',
    deadlineOffsetDays: Math.max(3, Math.floor(safeDays * 0.85)),
  });

  // The decision moment on the decide-by date.
  const partyNamesList = positions
    .map((p, i) => (p.partyName && p.partyName.trim()) || `Party ${i + 1}`)
    .join(' and ');
  tasks.push({
    id: makeId('cf-decide', 0),
    title: 'Resolve and align',
    description: `Walk through the proposal with ${partyNamesList || 'all parties'}. Lock in the resolution and confirm everyone leaves the room aligned.`,
    priority: 'urgent',
    deadlineOffsetDays: safeDays,
    isDecisionMoment: true,
  });

  // Follow-up two weeks after the decision.
  tasks.push({
    id: makeId('cf-followup', 0),
    title: 'Follow up: confirm the resolution held',
    description: 'Two weeks on, check in with each party. Did the resolution stick? Any new friction? If anything resurfaced, decide whether to reopen or course-correct.',
    priority: 'medium',
    deadlineOffsetDays: safeDays + FOLLOWUP_DAYS_AFTER_DECISION,
  });

  return tasks;
}

async function suggestTasks(
  value: ConflictStep2,
  decideByDate: string,
): Promise<SuggestedTask[]> {
  const today = todayIso();
  const target = decideByDate || value.decideByDate || today;
  const daysToDecide = Math.max(1, daysBetween(today, target));

  // AI path. Mirrors parseNaturalLanguageTaskWithFallback / pickToolFrame:
  // hard router errors bubble up so the wizard host can prompt for upgrade,
  // and any soft failure degrades to the hand-rolled list.
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      return buildFallbackTasks(value, daysToDecide);
    }
    const parsed = await invokeAIJson<{ tasks: AIConflictTask[] }>(
      'task_prioritization',
      buildPrompt(value, daysToDecide),
      { workspaceId },
    );
    const cleaned = sanitizeAITasks(parsed, daysToDecide);
    if (cleaned && cleaned.length >= 3) return cleaned;
    return buildFallbackTasks(value, daysToDecide);
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[conflictFrame:suggestTasks] AI failed, using fallback', err);
    return buildFallbackTasks(value, daysToDecide);
  }
}

// ─── Frame export ───────────────────────────────────────────────────────────

export const conflictFrame: DecisionFrame<ConflictStep2> = {
  id: 'conflict',
  label: 'Resolve a conflict',
  icon: GitFork,
  blurb: 'Disagreement between people or directions; needs a resolution.',
  defaultStep2,
  Step2Form,
  validateStep2,
  suggestTasks,
  deriveDecisionTitle,
  deriveDecisionDescription,
  contextFields: ['options', 'stakeholders', 'outcome'],
  defaultDecisionType: 'authority',
};

export { Step2Form };
