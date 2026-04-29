// Frame: "Pick a tool"
//
// Vendor selection, tool comparison, software stack choice. Step 2 captures
// the problem, candidate set, evaluation criteria, optional budget, and
// decide-by date. suggestTasks generates a tool-evaluation plan that scales
// with candidate count and references criteria together with candidates
// where natural (e.g. "Score candidates against criteria: ...").
//
// AI generation runs through the same router pattern used by
// parseNaturalLanguageTaskWithFallback in geminiService: the primary call
// hits invokeAIJson, router hard errors bubble, and any soft failure falls
// through to a hand-rolled task list.

import React from 'react';
import { Wrench } from 'lucide-react';

import type { DecisionFrame, Step2Props, SuggestedTask } from '../types';
import type { PickToolStep2 } from './pickToolFrame.types';
import {
  TextareaField,
  ChipsField,
  CurrencyField,
  DatePicker,
} from '../primitives';
import { invokeAIJson } from '../../../../services/ai/aiService';
import { getCurrentWorkspaceId } from '../../../../services/ai/getWorkspaceId';
import {
  AIRouterError,
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from '../../../../services/ai/errors';

// ─── Constants ──────────────────────────────────────────────────────────────

const MIN_CANDIDATES = 2;
const MAX_CANDIDATES = 8;
const MIN_CRITERIA = 2;
const MAX_CRITERIA = 6;
const DEFAULT_DECIDE_OFFSET_DAYS = 7;

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
  const [y, m, d] = iso.split('-').map(Number);
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

// ─── Default state ──────────────────────────────────────────────────────────

const defaultStep2: Partial<PickToolStep2> = {
  problem: '',
  candidates: [],
  criteria: [],
  budgetCeiling: null,
  decideByDate: addDaysIso(todayIso(), DEFAULT_DECIDE_OFFSET_DAYS),
};

// ─── Validation ─────────────────────────────────────────────────────────────

function validateStep2(value: Partial<PickToolStep2>): Partial<Record<keyof PickToolStep2, string>> {
  const errors: Partial<Record<keyof PickToolStep2, string>> = {};

  const problem = (value.problem ?? '').trim();
  if (!problem) {
    errors.problem = 'Describe the problem the tool needs to solve.';
  } else if (problem.length < 8) {
    errors.problem = 'Add a little more detail (at least 8 characters).';
  }

  const candidates = value.candidates ?? [];
  if (candidates.length < MIN_CANDIDATES) {
    errors.candidates = `Add at least ${MIN_CANDIDATES} candidates.`;
  } else if (candidates.length > MAX_CANDIDATES) {
    errors.candidates = `Keep the shortlist to ${MAX_CANDIDATES} or fewer.`;
  }

  const criteria = value.criteria ?? [];
  if (criteria.length < MIN_CRITERIA) {
    errors.criteria = `Add at least ${MIN_CRITERIA} selection criteria.`;
  } else if (criteria.length > MAX_CRITERIA) {
    errors.criteria = `Keep criteria focused: ${MAX_CRITERIA} or fewer.`;
  }

  if (
    value.budgetCeiling !== null &&
    value.budgetCeiling !== undefined &&
    value.budgetCeiling < 0
  ) {
    errors.budgetCeiling = 'Budget must be zero or more.';
  }

  if (!value.decideByDate) {
    errors.decideByDate = 'Pick a decide-by date.';
  }

  return errors;
}

// ─── Step 2 form ────────────────────────────────────────────────────────────

const Step2Form: React.FC<Step2Props<PickToolStep2>> = ({
  value,
  onChange,
  errors,
}) => {
  const v: Partial<PickToolStep2> = { ...defaultStep2, ...value };

  const setField = <K extends keyof PickToolStep2>(
    key: K,
    next: PickToolStep2[K],
  ) => {
    onChange({ ...v, [key]: next });
  };

  return (
    <div className="dw-form">
      <TextareaField
        label="What problem are you solving?"
        value={v.problem ?? ''}
        onChange={(next) => setField('problem', next)}
        placeholder="One sentence: what does this tool need to do?"
        rows={3}
        required
        autoFocus
        error={errors?.problem}
      />

      <ChipsField
        label="Candidates"
        value={v.candidates ?? []}
        onChange={(next) => setField('candidates', next)}
        placeholder="Add a tool name, then Enter"
        required
        minItems={MIN_CANDIDATES}
        maxItems={MAX_CANDIDATES}
        hint={`Shortlist ${MIN_CANDIDATES} to ${MAX_CANDIDATES} tools you actually want to evaluate.`}
        error={errors?.candidates}
      />

      <ChipsField
        label="Selection criteria"
        value={v.criteria ?? []}
        onChange={(next) => setField('criteria', next)}
        placeholder="Cost, DX, integrations, support..."
        required
        minItems={MIN_CRITERIA}
        maxItems={MAX_CRITERIA}
        hint={`What you're scoring on. ${MIN_CRITERIA} to ${MAX_CRITERIA} criteria.`}
        error={errors?.criteria}
      />

      <CurrencyField
        label="Budget ceiling"
        value={v.budgetCeiling ?? null}
        onChange={(next) => setField('budgetCeiling', next)}
        suffix="/ mo"
        placeholder="Optional"
        hint="Leave blank if budget isn't a hard constraint."
        error={errors?.budgetCeiling}
      />

      <DatePicker
        label="Decide by"
        value={v.decideByDate ?? null}
        onChange={(next) => setField('decideByDate', next ?? '')}
        required
        hint="Default is one week out. Push it sooner or later as needed."
        error={errors?.decideByDate}
      />
    </div>
  );
};

// ─── Title / description derivers ───────────────────────────────────────────

function deriveDecisionTitle(value: PickToolStep2): string {
  const cands = value.candidates ?? [];
  if (cands.length === 0) return 'Pick a tool';
  const head = cands.slice(0, 3).join(', ');
  const more = cands.length > 3 ? '...' : '';
  return `Pick a tool: ${head}${more}`;
}

function deriveDecisionDescription(value: PickToolStep2): string {
  const lines: string[] = [];
  const problem = (value.problem ?? '').trim();
  if (problem) {
    lines.push(problem);
    lines.push('');
  }
  lines.push(`**Candidates:** ${(value.candidates ?? []).join(', ')}`);
  lines.push(`**Criteria:** ${(value.criteria ?? []).join(', ')}`);
  if (value.budgetCeiling !== null && value.budgetCeiling !== undefined) {
    lines.push(`**Budget ceiling:** $${value.budgetCeiling}/mo`);
  }
  if (value.decideByDate) {
    lines.push(`**Decide by:** ${formatDate(value.decideByDate)}`);
  }
  return lines.join('\n');
}

// ─── Task suggestion (AI + fallback) ────────────────────────────────────────

interface AIPickToolTask {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  deadlineOffsetDays?: number;
  isDecisionMoment?: boolean;
}

function buildPrompt(value: PickToolStep2, daysFromNow: number): string {
  const budgetLine = value.budgetCeiling
    ? `Budget ceiling: $${value.budgetCeiling}/mo`
    : 'No hard budget ceiling.';
  return `You are helping a solo operator choose between ${value.candidates.length} tools to solve: ${value.problem}.
Candidates: ${value.candidates.join(', ')}
Selection criteria: ${value.criteria.join(', ')}
${budgetLine}
Decide by: ${value.decideByDate} (${daysFromNow} days from now)

Generate a tool-evaluation task plan. Tasks should:
- Include comparison or research tasks for each criterion (1 task per criterion is reasonable for 4 or fewer criteria; consolidate when there are more)
- Suggest pricing-confirmation outreach when budget matters
- Include a vendor demo or trial setup task per candidate (consolidate for long shortlists)
- Have exactly one final decision-making task with isDecisionMoment set to true and priority "urgent"
- Have a post-decision migration or onboarding task scheduled after the decide-by date
- Reference candidates and criteria together where natural (e.g. "Score Auth0, Clerk, Supabase Auth on cost and DX")
- 5 to 7 tasks total

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
    const t = item as AIPickToolTask;
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
      typeof t.deadlineOffsetDays === 'number' ? t.deadlineOffsetDays : 0,
      daysToDecide + 14,
    );
    cleaned.push({
      id: makeId('pt', idx),
      title,
      description: typeof t.description === 'string' ? t.description : undefined,
      priority,
      deadlineOffsetDays: offset,
      isDecisionMoment,
    });
  });
  if (cleaned.length === 0) return null;
  // Guarantee one decision-moment task. If the AI didn't mark one, promote
  // the latest task with the highest offset.
  if (!cleaned.some((t) => t.isDecisionMoment)) {
    const winner = cleaned.reduce((best, cur) =>
      cur.deadlineOffsetDays >= best.deadlineOffsetDays ? cur : best,
    );
    winner.isDecisionMoment = true;
    winner.priority = 'urgent';
  }
  return cleaned;
}

function buildFallbackTasks(
  value: PickToolStep2,
  daysToDecide: number,
): SuggestedTask[] {
  const tasks: SuggestedTask[] = [];
  const candidates = value.candidates ?? [];
  const criteria = value.criteria ?? [];
  const safeDays = Math.max(1, daysToDecide);

  // Demo / trial tasks. Scale with candidate count: per-candidate up to 3,
  // beyond that fold the rest into a single batch task.
  const headDemos = candidates.slice(0, 3);
  headDemos.forEach((cand, i) => {
    const offset = Math.max(1, Math.floor(safeDays * (0.2 + i * 0.1)));
    tasks.push({
      id: makeId('pt-demo', i),
      title: `Demo or trial: ${cand}`,
      description: `Spin up a trial or book a demo for ${cand}. Note any blockers signing up. Score against: ${criteria.join(', ')}.`,
      priority: 'medium',
      deadlineOffsetDays: clampOffset(offset, safeDays),
    });
  });
  if (candidates.length > 3) {
    const rest = candidates.slice(3);
    tasks.push({
      id: makeId('pt-demo-rest', 0),
      title: `Demo or trial: ${rest.join(', ')}`,
      description: `Bulk-evaluate the remaining shortlist (${rest.length} tools) at a lighter depth. Eliminate any that fail on must-have criteria.`,
      priority: 'medium',
      deadlineOffsetDays: clampOffset(Math.floor(safeDays * 0.55), safeDays),
    });
  }

  // Per-criterion research. For up to 4 criteria, one task each. Beyond
  // that, consolidate into a single scoring task.
  if (criteria.length <= 4) {
    criteria.forEach((crit, i) => {
      const offset = Math.max(1, Math.floor(safeDays * (0.3 + i * 0.08)));
      tasks.push({
        id: makeId('pt-crit', i),
        title: `Compare ${candidates.slice(0, 3).join(', ')}${candidates.length > 3 ? ' and others' : ''} on ${crit}`,
        description: `Research how each candidate stacks up specifically on ${crit}. Capture concrete evidence, not vibes.`,
        priority: 'medium',
        deadlineOffsetDays: clampOffset(offset, safeDays),
      });
    });
  } else {
    tasks.push({
      id: makeId('pt-score', 0),
      title: `Score candidates against criteria: ${criteria.join(', ')}`,
      description: `Build a comparison grid of ${candidates.join(', ')} scored on each criterion. One row per tool, one column per criterion.`,
      priority: 'medium',
      deadlineOffsetDays: clampOffset(Math.floor(safeDays * 0.6), safeDays),
    });
  }

  // Pricing confirmation when budget is in play.
  if (value.budgetCeiling) {
    tasks.push({
      id: makeId('pt-budget', 0),
      title: `Confirm pricing under $${value.budgetCeiling}/mo with shortlist`,
      description: `Reach out to vendors or check pricing pages to confirm a real total under $${value.budgetCeiling}/mo at expected usage. Watch for seat-based or usage-based escalators.`,
      priority: 'high',
      deadlineOffsetDays: clampOffset(Math.floor(safeDays * 0.7), safeDays),
    });
  }

  // The decision moment.
  tasks.push({
    id: makeId('pt-decide', 0),
    title: `Pick the winner from ${candidates.slice(0, 3).join(', ')}${candidates.length > 3 ? '...' : ''}`,
    description: `Review the comparison grid against ${criteria.join(', ')}. Commit. Document the why so future-you remembers.`,
    priority: 'urgent',
    deadlineOffsetDays: safeDays,
    isDecisionMoment: true,
  });

  // Post-decision onboarding.
  tasks.push({
    id: makeId('pt-onboard', 0),
    title: `Migrate or onboard to chosen tool`,
    description: `Set up accounts, migrate data, wire integrations, and update internal docs to point at the new tool.`,
    priority: 'high',
    deadlineOffsetDays: safeDays + 5,
  });

  return tasks;
}

async function suggestTasks(
  value: PickToolStep2,
  decideByDate: string,
): Promise<SuggestedTask[]> {
  const today = todayIso();
  const target = decideByDate || value.decideByDate || today;
  const daysToDecide = Math.max(1, daysBetween(today, target));

  // AI path. Mirrors parseNaturalLanguageTaskWithFallback: hard router
  // errors bubble up, anything else degrades to the hand-rolled list.
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      return buildFallbackTasks(value, daysToDecide);
    }
    const parsed = await invokeAIJson<{ tasks: AIPickToolTask[] }>(
      'task_prioritization',
      buildPrompt(value, daysToDecide),
      { workspaceId },
    );
    const cleaned = sanitizeAITasks(parsed, daysToDecide);
    if (cleaned && cleaned.length >= 3) return cleaned;
    return buildFallbackTasks(value, daysToDecide);
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[pickToolFrame:suggestTasks] AI failed, using fallback', err);
    return buildFallbackTasks(value, daysToDecide);
  }
}

// ─── Frame export ───────────────────────────────────────────────────────────

export const pickToolFrame: DecisionFrame<PickToolStep2> = {
  id: 'pick_tool',
  label: 'Pick a tool',
  icon: Wrench,
  blurb: 'Vendor selection, tool comparison, software stack choice.',
  defaultStep2,
  Step2Form,
  validateStep2,
  suggestTasks,
  deriveDecisionTitle,
  deriveDecisionDescription,
  contextFields: ['criteria', 'options', 'outcome'],
  defaultDecisionType: 'consensus',
};

export { Step2Form };
