// "Set strategy" decision frame.
//
// Step 2 captures a planning horizon, the desired outcome, the blockers in
// the way, an optional first-move kickoff, a decide-by date, and optional
// stakeholders. The frame derives a natural decision title and a markdown
// description, and produces a strategic-planning task plan: research and
// discovery up front, a decision moment in the middle (the strategy doc
// itself), and immediate first-move tasks fanning out after.
//
// AI generation runs through the same router pattern used by
// parseNaturalLanguageTaskWithFallback in geminiService: the primary call
// hits invokeAIJson, router hard errors bubble, and any soft failure
// (network, parse, malformed JSON, insufficient task list) falls through
// to a hand-rolled list that still references blockers by name and
// includes the operator-provided first move when one was typed.

import React from 'react';
import { Compass } from 'lucide-react';

import {
  TextField,
  TextareaField,
  ChipsField,
  RadioGroup,
  DatePicker,
  MemberPicker,
} from '../primitives';
import type { DecisionFrame, Step2Props, SuggestedTask } from '../types';
import type { StrategyStep2, StrategyTimeHorizon } from './strategyFrame.types';
import { invokeAIJson } from '../../../../services/ai/aiService';
import { getCurrentWorkspaceId } from '../../../../services/ai/getWorkspaceId';
import {
  AIRouterError,
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from '../../../../services/ai/errors';

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_BLOCKERS = 1;
const MAX_BLOCKERS = 6;
const MIN_OUTCOME_CHARS = 10;
const DEFAULT_DECIDE_OFFSET_DAYS = 14;

// Radio-button labels: short verbs the operator scans on Step 2.
const HORIZON_OPTIONS: Array<{ value: StrategyTimeHorizon; label: string }> = [
  { value: 'quarter', label: 'This quarter' },
  { value: 'half', label: 'Half' },
  { value: 'year', label: 'Year' },
  { value: 'multi_year', label: 'Multi-year' },
];

// Display labels: used in the derived title and description, where the
// horizon reads as a noun phrase ("Quarterly strategy:", "Annual strategy:").
const HORIZON_DISPLAY_LABEL: Record<StrategyTimeHorizon, string> = {
  quarter: 'Quarterly',
  half: 'Half-year',
  year: 'Annual',
  multi_year: 'Multi-year',
};

// Prompt label: lowercase phrasing for "set strategy for the next ___".
const HORIZON_PROMPT_PHRASE: Record<StrategyTimeHorizon, string> = {
  quarter: 'quarter',
  half: 'half-year',
  year: 'year',
  multi_year: 'multi-year window',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function formatDateDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
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

// Strip em dashes (and en dashes) from any AI-generated string. Spec
// forbids them; we rewrite to a comma + space pair that reads cleanly
// in either prose or task titles.
function stripEmDashes(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ', ');
}

// ─── Default state ───────────────────────────────────────────────────────────

const defaultStep2: Partial<StrategyStep2> = {
  timeHorizon: 'quarter',
  desiredOutcome: '',
  currentBlockers: [],
  firstMove: '',
  decideByDate: addDaysIso(todayIso(), DEFAULT_DECIDE_OFFSET_DAYS),
  stakeholders: [],
};

// ─── Validation ──────────────────────────────────────────────────────────────

function validateStep2(value: Partial<StrategyStep2>): Partial<Record<keyof StrategyStep2, string>> {
  const errors: Partial<Record<keyof StrategyStep2, string>> = {};

  if (!value.timeHorizon) {
    errors.timeHorizon = 'Pick a time horizon.';
  }

  const outcome = (value.desiredOutcome ?? '').trim();
  if (!outcome) {
    errors.desiredOutcome = 'Describe what success looks like.';
  } else if (outcome.length < MIN_OUTCOME_CHARS) {
    errors.desiredOutcome = `Add a little more detail (at least ${MIN_OUTCOME_CHARS} characters).`;
  }

  const blockers = value.currentBlockers ?? [];
  if (blockers.length < MIN_BLOCKERS) {
    errors.currentBlockers = 'Name at least one blocker.';
  } else if (blockers.length > MAX_BLOCKERS) {
    errors.currentBlockers = `At most ${MAX_BLOCKERS} blockers.`;
  }

  if (!value.decideByDate) {
    errors.decideByDate = 'Pick a decide-by date.';
  }

  return errors;
}

// ─── Step 2 form ─────────────────────────────────────────────────────────────

const Step2Form: React.FC<Step2Props<StrategyStep2>> = ({
  value,
  onChange,
  workspaceMembers,
  errors,
}) => {
  const v: Partial<StrategyStep2> = { ...defaultStep2, ...value };

  const setField = <K extends keyof StrategyStep2>(
    key: K,
    next: StrategyStep2[K],
  ) => {
    onChange({ ...v, [key]: next });
  };

  return (
    <div className="dw-form dw-step2-strategy">
      <RadioGroup<StrategyTimeHorizon>
        label="Time horizon"
        value={(v.timeHorizon as StrategyTimeHorizon | undefined) ?? null}
        onChange={(next) => setField('timeHorizon', next)}
        options={HORIZON_OPTIONS}
        required
        error={errors?.timeHorizon}
      />

      <TextareaField
        label="Desired outcome"
        value={v.desiredOutcome ?? ''}
        onChange={(next) => setField('desiredOutcome', next)}
        placeholder="What does success look like?"
        rows={3}
        required
        autoFocus
        error={errors?.desiredOutcome}
        hint="One or two sentences. Specific beats poetic."
      />

      <ChipsField
        label="Current blockers"
        value={v.currentBlockers ?? []}
        onChange={(next) => setField('currentBlockers', next)}
        placeholder="What's in the way?"
        required
        minItems={MIN_BLOCKERS}
        maxItems={MAX_BLOCKERS}
        error={errors?.currentBlockers}
        hint={`Press Enter to add. ${MIN_BLOCKERS} to ${MAX_BLOCKERS} blockers.`}
      />

      <TextField
        label="First move (optional)"
        value={v.firstMove ?? ''}
        onChange={(next) => setField('firstMove', next)}
        placeholder="If you had to do one thing this week..."
        error={errors?.firstMove}
        hint="If filled in, this becomes a fast-start task after the strategy is locked."
      />

      <DatePicker
        label="Decide by"
        value={v.decideByDate ?? null}
        onChange={(next) => setField('decideByDate', next ?? '')}
        required
        error={errors?.decideByDate}
        hint="Default is two weeks out. Push it sooner or later as needed."
      />

      <MemberPicker
        label="Stakeholders (optional)"
        value={v.stakeholders ?? []}
        onChange={(next) => setField('stakeholders', next)}
        members={workspaceMembers}
        placeholder="Add members"
        error={errors?.stakeholders}
      />
    </div>
  );
};

// ─── Title / description derivers ────────────────────────────────────────────

function deriveDecisionTitle(value: StrategyStep2): string {
  const outcome = (value.desiredOutcome ?? '').trim();
  const horizon = HORIZON_DISPLAY_LABEL[value.timeHorizon];
  if (!outcome) return `${horizon} strategy`;
  const words = outcome.split(/\s+/);
  const summary = words.slice(0, 8).join(' ');
  const truncated = words.length > 8 ? '...' : '';
  return `${horizon} strategy: ${summary}${truncated}`;
}

function deriveDecisionDescription(value: StrategyStep2): string {
  const horizon = HORIZON_DISPLAY_LABEL[value.timeHorizon];
  const blockers = value.currentBlockers ?? [];
  const blockerLines = blockers.length > 0
    ? blockers.map((b) => `- ${b}`).join('\n')
    : '- (none captured)';
  const firstMove = (value.firstMove ?? '').trim();
  const firstMoveLine = firstMove
    ? `**First move:** ${firstMove}\n\n`
    : '';
  const formattedDate = value.decideByDate
    ? formatDateDisplay(value.decideByDate)
    : '(not set)';

  return [
    `**Time horizon:** ${horizon}`,
    '',
    '**Desired outcome**',
    (value.desiredOutcome ?? '').trim(),
    '',
    '**Current blockers**',
    blockerLines,
    '',
    `${firstMoveLine}**Decide by:** ${formattedDate}`,
  ].join('\n');
}

// ─── AI suggestion + fallback ────────────────────────────────────────────────

interface AIStrategyTask {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  deadlineOffsetDays?: number;
  isDecisionMoment?: boolean;
  isImmediate?: boolean;
}

function buildPrompt(value: StrategyStep2, decideByDate: string, daysToDecide: number): string {
  const horizonPhrase = HORIZON_PROMPT_PHRASE[value.timeHorizon];
  const blockers = value.currentBlockers ?? [];
  const firstMove = (value.firstMove ?? '').trim();
  return [
    `You are helping a solo operator set strategy for the next ${horizonPhrase}.`,
    `Desired outcome: ${(value.desiredOutcome ?? '').trim()}`,
    `Current blockers: ${blockers.join('; ')}`,
    firstMove ? `First move idea: ${firstMove}` : '',
    `Decide by: ${decideByDate} (${daysToDecide} days from now)`,
    '',
    'Generate a strategic-planning task plan. Tasks should:',
    '- Include 1-2 research/discovery tasks to validate assumptions',
    '- Include a stakeholder-alignment task (1:1 conversations)',
    '- Include exactly one "synthesize and write the strategy doc" task with isDecisionMoment set to true and priority "urgent"',
    '- Include 1-2 immediate first-move tasks (the "fast start" after the strategy is set), each with isImmediate set to true',
    '- Have deadlines that cluster: research front-loaded (days 1 to floor(daysToDecide/2)), decision in the middle (around daysToDecide), first moves after (daysToDecide+1 to daysToDecide+7)',
    '- Reference blockers by name where natural',
    '- Suggest 5 to 8 tasks total',
    firstMove
      ? '- Include the operator-provided first move idea verbatim as one of the immediate tasks (isImmediate: true)'
      : '',
    '',
    'Return JSON: { "tasks": SuggestedTask[] }',
    'Each task: { "title": string, "description"?: string, "priority": "low"|"medium"|"high"|"urgent", "deadlineOffsetDays": number, "isDecisionMoment"?: boolean, "isImmediate"?: boolean }',
    'Do not use em dashes or en dashes anywhere. Plain hyphens, commas, or periods only.',
    'Return ONLY the JSON object, no surrounding prose.',
  ]
    .filter(Boolean)
    .join('\n');
}

function sanitizeAITasks(
  raw: unknown,
  daysToDecide: number,
  firstMove: string,
): SuggestedTask[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const list = (raw as { tasks?: unknown }).tasks;
  if (!Array.isArray(list) || list.length === 0) return null;

  const cleaned: SuggestedTask[] = [];
  let decisionMomentSeen = false;

  list.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const t = item as AIStrategyTask;
    const titleRaw = typeof t.title === 'string' ? t.title.trim() : '';
    if (!titleRaw) return;

    const title = stripEmDashes(titleRaw);
    const description = typeof t.description === 'string'
      ? stripEmDashes(t.description)
      : undefined;

    const isDecisionMoment = Boolean(t.isDecisionMoment) && !decisionMomentSeen;
    if (isDecisionMoment) decisionMomentSeen = true;

    const priority: SuggestedTask['priority'] =
      t.priority && (['low', 'medium', 'high', 'urgent'] as const).includes(t.priority)
        ? t.priority
        : isDecisionMoment
          ? 'urgent'
          : 'medium';

    const offset = clampOffset(
      typeof t.deadlineOffsetDays === 'number' && Number.isFinite(t.deadlineOffsetDays)
        ? t.deadlineOffsetDays
        : 0,
      daysToDecide + 14,
    );

    cleaned.push({
      id: makeId('strat', idx),
      title,
      description,
      priority,
      deadlineOffsetDays: offset,
      isDecisionMoment,
      isImmediate: Boolean(t.isImmediate),
    });
  });

  if (cleaned.length === 0) return null;

  // Guarantee one decision moment. If the AI didn't flag any, promote the
  // task with the largest offset (closest to the decide-by date).
  if (!cleaned.some((t) => t.isDecisionMoment)) {
    const winner = cleaned.reduce((best, cur) =>
      cur.deadlineOffsetDays >= best.deadlineOffsetDays ? cur : best,
    );
    winner.isDecisionMoment = true;
    winner.priority = 'urgent';
  }

  // Guarantee the operator-supplied firstMove appears verbatim. If the AI
  // dropped it, append it as an immediate task one day after the decision.
  if (firstMove) {
    const firstMoveLower = firstMove.toLowerCase();
    const present = cleaned.some(
      (t) =>
        t.title.toLowerCase() === firstMoveLower ||
        (t.title.toLowerCase().includes(firstMoveLower.slice(0, 24)) && t.isImmediate),
    );
    if (!present) {
      cleaned.push({
        id: makeId('strat-fm', cleaned.length),
        title: firstMove,
        description: 'Immediate first-move kickoff captured during wizard setup.',
        priority: 'high',
        deadlineOffsetDays: clampOffset(daysToDecide + 1, daysToDecide + 14),
        isImmediate: true,
      });
    }
  }

  return cleaned;
}

function buildFallbackTasks(value: StrategyStep2, daysToDecide: number): SuggestedTask[] {
  const tasks: SuggestedTask[] = [];
  const blockers = value.currentBlockers ?? [];
  const safeDays = Math.max(1, daysToDecide);
  const horizonDisplay = HORIZON_DISPLAY_LABEL[value.timeHorizon].toLowerCase();
  const outcomeShort = (value.desiredOutcome ?? '').trim().split(/\s+/).slice(0, 12).join(' ');

  // 1. Front-loaded research on the primary blocker.
  tasks.push({
    id: makeId('strat-r1', 0),
    title: `Research: validate "${blockers[0] ?? 'the core assumption'}"`,
    description: blockers[0]
      ? `Pressure-test the assumption that "${blockers[0]}" is actually blocking the path to: ${outcomeShort}. Look for evidence either way before committing.`
      : `Pressure-test the assumptions baked into: ${outcomeShort}.`,
    priority: 'high',
    deadlineOffsetDays: clampOffset(Math.max(2, Math.floor(safeDays * 0.2)), safeDays),
  });

  // 2. Optional secondary research if a second blocker exists.
  if (blockers.length > 1) {
    tasks.push({
      id: makeId('strat-r2', 0),
      title: `Research: investigate "${blockers[1]}"`,
      description: `Gather data and prior art on "${blockers[1]}" so the strategy addresses it head-on instead of around it.`,
      priority: 'medium',
      deadlineOffsetDays: clampOffset(Math.max(3, Math.floor(safeDays * 0.3)), safeDays),
    });
  }

  // 3. Stakeholder alignment in the middle.
  tasks.push({
    id: makeId('strat-align', 0),
    title: '1:1 alignment conversations with stakeholders',
    description: `Run short 1:1s to surface disagreement on direction before locking in the ${horizonDisplay} strategy. Listen for objections you haven't heard yet.`,
    priority: 'high',
    deadlineOffsetDays: clampOffset(Math.max(2, Math.floor(safeDays * 0.5)), safeDays),
  });

  // 4. Decision moment: synthesize and write the strategy doc.
  tasks.push({
    id: makeId('strat-doc', 0),
    title: 'Synthesize and write the strategy doc',
    description: blockers.length > 0
      ? `Synthesize research and stakeholder input into a single ${horizonDisplay} strategy that explicitly addresses each blocker: ${blockers.join(', ')}.`
      : `Synthesize research and stakeholder input into a single ${horizonDisplay} strategy doc.`,
    priority: 'urgent',
    deadlineOffsetDays: safeDays,
    isDecisionMoment: true,
  });

  // 5. Operator-provided first move (immediate fast start) if present.
  const firstMove = (value.firstMove ?? '').trim();
  if (firstMove) {
    tasks.push({
      id: makeId('strat-fm', 0),
      title: firstMove,
      description: 'Immediate first-move kickoff captured during wizard setup.',
      priority: 'high',
      deadlineOffsetDays: clampOffset(safeDays + 1, safeDays + 14),
      isImmediate: true,
    });
  }

  // 6. A second immediate task: communicate the strategy to the team.
  tasks.push({
    id: makeId('strat-comm', 0),
    title: 'Communicate strategy to team and stakeholders',
    description: 'Share the strategy doc, walk through trade-offs, and confirm next-step ownership.',
    priority: 'medium',
    deadlineOffsetDays: clampOffset(safeDays + 4, safeDays + 14),
    isImmediate: true,
  });

  // 7. Retro / check-in to close the loop.
  tasks.push({
    id: makeId('strat-retro', 0),
    title: 'Schedule a strategy check-in',
    description: `Book a calendar block one quarter into the ${horizonDisplay} strategy to review what's working and what isn't.`,
    priority: 'low',
    deadlineOffsetDays: clampOffset(safeDays + 7, safeDays + 14),
  });

  return tasks;
}

async function suggestTasks(
  value: StrategyStep2,
  decideByDate: string,
): Promise<SuggestedTask[]> {
  const today = todayIso();
  const target = decideByDate || value.decideByDate || today;
  const daysToDecide = Math.max(1, daysBetween(today, target));
  const firstMove = (value.firstMove ?? '').trim();

  // AI path. Mirrors parseNaturalLanguageTaskWithFallback: hard router
  // errors bubble; anything else degrades to the hand-rolled list.
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      return buildFallbackTasks(value, daysToDecide);
    }

    const parsed = await invokeAIJson<{ tasks: AIStrategyTask[] }>(
      'task_prioritization',
      buildPrompt(value, target, daysToDecide),
      { workspaceId },
    );

    const cleaned = sanitizeAITasks(parsed, daysToDecide, firstMove);
    if (cleaned && cleaned.length >= 3) return cleaned;
    return buildFallbackTasks(value, daysToDecide);
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[strategyFrame:suggestTasks] AI failed, using fallback', err);
    return buildFallbackTasks(value, daysToDecide);
  }
}

// ─── Frame export ────────────────────────────────────────────────────────────

export const strategyFrame: DecisionFrame<StrategyStep2> = {
  id: 'strategy',
  label: 'Set strategy',
  icon: Compass,
  blurb: 'High-level direction, multi-quarter plan, or strategic pivot.',
  defaultStep2,
  Step2Form,
  validateStep2,
  suggestTasks,
  deriveDecisionTitle,
  deriveDecisionDescription,
  contextFields: ['stakeholders', 'outcome'],
  defaultDecisionType: 'authority',
};

export { Step2Form };
