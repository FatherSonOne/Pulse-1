// "Build something" decision frame.
//
// Frame contract for feature specs, project kickoffs, or one-off builds.
// The "decision moment" for a build is upstream of execution: the operator's
// scoping call (yes / no / scope) sits at the start of the task list, not
// the final ship. This frame mirrors that. Its suggestTasks output marks a
// scoping task near the front with isDecisionMoment, and the ship task is
// merely the terminal milestone.
//
// AI suggestion uses invokeAIJson under the hood with a hand-rolled fallback
// list when the router is unavailable, mirroring the pattern in
// parseNaturalLanguageTaskWithFallback.

import React from 'react';
import { Hammer } from 'lucide-react';

import type { DecisionFrame, Step2Props, SuggestedTask } from '../types';
import {
  TextField,
  TextareaField,
  DatePicker,
  MemberPicker,
} from '../primitives';
import type { BuildStep2 } from './buildFrame.types';

import { invokeAIJson } from '../../../../services/ai/aiService';
import { getCurrentWorkspaceId } from '../../../../services/ai/getWorkspaceId';
import {
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from '../../../../services/ai/errors';

// ─── Defaults ────────────────────────────────────────────────────────────────

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function formatLongDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const HYPOTHESIS_PLACEHOLDER =
  'e.g. I think weekly digests will boost retention because operators forget to check Pulse on weekends.';

const ACCEPTANCE_PLACEHOLDER =
  "We'll know it's working when...";

// ─── Step 2 Form ─────────────────────────────────────────────────────────────

const Step2Form: React.FC<Step2Props<BuildStep2>> = ({
  value,
  onChange,
  workspaceMembers,
  errors,
}) => {
  const v = value as Partial<BuildStep2>;

  const set = <K extends keyof BuildStep2>(key: K, next: BuildStep2[K]) => {
    onChange({ ...v, [key]: next });
  };

  return (
    <div className="dw-step2-form">
      <TextField
        label="What are you building"
        value={v.whatBuilding ?? ''}
        onChange={(next) => set('whatBuilding', next)}
        placeholder="Email digest scheduler"
        required
        autoFocus
        maxLength={120}
        error={errors?.whatBuilding}
      />

      <TextField
        label="Who is it for"
        value={v.forWhom ?? ''}
        onChange={(next) => set('forWhom', next)}
        placeholder="Product managers running weekly reviews"
        required
        maxLength={160}
        error={errors?.forWhom}
      />

      <TextareaField
        label="Hypothesis"
        value={v.hypothesis ?? ''}
        onChange={(next) => set('hypothesis', next)}
        placeholder={HYPOTHESIS_PLACEHOLDER}
        required
        rows={3}
        hint='Frame it as "I think X because Y." A weak hypothesis is fine, a missing one is not.'
        error={errors?.hypothesis}
      />

      <TextareaField
        label="Acceptance signal"
        value={v.acceptanceSignal ?? ''}
        onChange={(next) => set('acceptanceSignal', next)}
        placeholder={ACCEPTANCE_PLACEHOLDER}
        required
        rows={3}
        hint="Concrete and observable. Numbers beat adjectives."
        error={errors?.acceptanceSignal}
      />

      <DatePicker
        label="Target ship date"
        value={v.targetShipDate ?? null}
        onChange={(next) => set('targetShipDate', next ?? '')}
        required
        error={errors?.targetShipDate}
        hint="Defaults to three weeks out. Adjust to taste."
      />

      <MemberPicker
        label="Stakeholders"
        value={v.stakeholders ?? []}
        onChange={(next) => set('stakeholders', next)}
        members={workspaceMembers}
        multiSelect
        placeholder="Add stakeholders (optional)"
        hint="Anyone who needs to weigh in on the scoping call."
      />
    </div>
  );
};

// ─── Validation ──────────────────────────────────────────────────────────────

function validateStep2(value: Partial<BuildStep2>): Partial<Record<keyof BuildStep2, string>> {
  const errors: Partial<Record<keyof BuildStep2, string>> = {};

  if (!value.whatBuilding || !value.whatBuilding.trim()) {
    errors.whatBuilding = 'Required.';
  } else if (value.whatBuilding.trim().length < 3) {
    errors.whatBuilding = 'A few words at minimum.';
  }

  if (!value.forWhom || !value.forWhom.trim()) {
    errors.forWhom = 'Required.';
  }

  if (!value.hypothesis || !value.hypothesis.trim()) {
    errors.hypothesis = 'Required.';
  } else if (value.hypothesis.trim().length < 15) {
    errors.hypothesis = 'A real sentence, please (at least 15 characters).';
  }

  if (!value.acceptanceSignal || !value.acceptanceSignal.trim()) {
    errors.acceptanceSignal = 'Required.';
  } else if (value.acceptanceSignal.trim().length < 15) {
    errors.acceptanceSignal = 'A real sentence, please (at least 15 characters).';
  }

  if (!value.targetShipDate) {
    errors.targetShipDate = 'Required.';
  }

  return errors;
}

// ─── Derivers ────────────────────────────────────────────────────────────────

function deriveDecisionTitle(value: BuildStep2): string {
  const what = (value.whatBuilding ?? '').trim();
  return `Build: ${what}`;
}

function deriveDecisionDescription(value: BuildStep2): string {
  const what = (value.whatBuilding ?? '').trim();
  const forWhom = (value.forWhom ?? '').trim();
  const hypothesis = (value.hypothesis ?? '').trim();
  const acceptanceSignal = (value.acceptanceSignal ?? '').trim();
  const ship = value.targetShipDate ? formatLongDate(value.targetShipDate) : '';

  return [
    `**Building:** ${what}`,
    `**For:** ${forWhom}`,
    '',
    '**Hypothesis**',
    hypothesis,
    '',
    '**Acceptance signal**',
    acceptanceSignal,
    '',
    `**Target ship:** ${ship}`,
  ].join('\n');
}

// ─── Task suggestion ─────────────────────────────────────────────────────────

interface AITaskShape {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  deadlineOffsetDays?: number;
  isDecisionMoment?: boolean;
  isImmediate?: boolean;
}

function isRouterHardError(err: unknown): boolean {
  return (
    err instanceof AICapExceededError ||
    err instanceof AITrialExpiredError ||
    err instanceof AIProviderUnavailableError
  );
}

function localId(): string {
  return `t-${Math.random().toString(36).slice(2, 10)}`;
}

function clampPriority(p: unknown): 'low' | 'medium' | 'high' | 'urgent' {
  return p === 'low' || p === 'medium' || p === 'high' || p === 'urgent' ? p : 'medium';
}

/** Hand-rolled fallback. Used when the AI router is unavailable. The shape
 *  mirrors the seed expected by the wizard shell: scoping moment near the
 *  start, implementation in the middle, measurement and ship at the end. */
function buildFallbackTasks(value: BuildStep2): SuggestedTask[] {
  const what = (value.whatBuilding ?? '').trim();
  const forWhom = (value.forWhom ?? '').trim();
  const hypothesis = (value.hypothesis ?? '').trim();
  const acceptanceSignal = (value.acceptanceSignal ?? '').trim();

  const today = todayIso();
  const targetShip = value.targetShipDate || isoPlusDays(21);
  const daysToShip = daysBetween(today, targetShip);

  const trimSignal = acceptanceSignal.length > 40
    ? `${acceptanceSignal.slice(0, 40)}...`
    : acceptanceSignal;

  const tasks: Omit<SuggestedTask, 'id'>[] = [
    {
      title: `Scope and sign off: ${what}`,
      description: `Confirm we should build this at all. Hypothesis: ${hypothesis}`,
      priority: 'high',
      deadlineOffsetDays: Math.min(2, Math.max(1, Math.floor(daysToShip * 0.1))),
      isDecisionMoment: true,
    },
    {
      title: `Spec ${what} for ${forWhom}`,
      description: 'Write a one-pager covering scope, non-goals, and the rough shape of the solution.',
      priority: 'high',
      deadlineOffsetDays: Math.min(5, Math.max(3, Math.floor(daysToShip * 0.2))),
    },
    {
      title: 'Build core path',
      description: `Implement the happy-path slice that proves the hypothesis: ${hypothesis}`,
      priority: 'medium',
      deadlineOffsetDays: Math.max(4, Math.floor(daysToShip * 0.5)),
    },
    {
      title: 'Build edge cases and error states',
      description: 'Cover the unhappy paths, empty states, and failure modes.',
      priority: 'medium',
      deadlineOffsetDays: Math.max(5, Math.floor(daysToShip * 0.75)),
    },
    {
      title: `Test against signal: ${trimSignal}`,
      description: `Measure the build against the acceptance signal: ${acceptanceSignal}`,
      priority: 'high',
      deadlineOffsetDays: Math.max(6, daysToShip - 1),
    },
    {
      title: `Ship ${what}`,
      description: `Cut the release for ${forWhom}.`,
      priority: 'urgent',
      deadlineOffsetDays: daysToShip,
    },
  ];

  return tasks.map((t) => ({ id: localId(), ...t }));
}

/** AI-backed task generator. Falls through to the fallback on any non-hard
 *  router error. Hard errors (cap exceeded, trial expired, provider down)
 *  bubble up so the wizard shell can surface the right upgrade prompt. */
async function suggestTasksViaAI(value: BuildStep2): Promise<SuggestedTask[] | null> {
  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const today = todayIso();
  const targetShip = value.targetShipDate || isoPlusDays(21);
  const daysToShip = daysBetween(today, targetShip);

  const prompt = `You are helping a solo operator plan to build: ${value.whatBuilding}.
For whom: ${value.forWhom}
Hypothesis: ${value.hypothesis}
Acceptance signal: ${value.acceptanceSignal}
Target ship: ${targetShip} (${daysToShip} days from now)

Generate a build task plan. Tasks should:
- Include a quick spec or design task before implementation
- Break implementation into 2-3 sub-tasks if the project is non-trivial (>14 days)
- Include a measurement / test-against-acceptance-signal task near the end
- Mark a kickoff or scoping decision-moment task as isDecisionMoment: true (the moment to decide whether to actually build, scope, or sequence)
- Have realistic deadlines cascading to target ship date (deadlineOffsetDays from today, max ${daysToShip})
- Reference the hypothesis or acceptance signal in titles or descriptions where natural
- Suggest 5-8 tasks total
- Avoid em dashes; use commas, periods, or parentheses instead

Return JSON with this shape:
{
  "tasks": [
    {
      "title": "string",
      "description": "string (optional)",
      "priority": "low" | "medium" | "high" | "urgent",
      "deadlineOffsetDays": number,
      "isDecisionMoment": boolean (optional, exactly one task)
    }
  ]
}

Return ONLY the JSON, no explanations.`;

  const parsed = await invokeAIJson<{ tasks?: AITaskShape[] }>(
    'task_prioritization',
    prompt,
    { workspaceId },
  );

  const raw = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
  if (raw.length === 0) return null;

  const cleaned: SuggestedTask[] = raw
    .filter((t) => t && typeof t.title === 'string' && t.title.trim().length > 0)
    .map((t) => ({
      id: localId(),
      title: t.title.trim(),
      description: typeof t.description === 'string' ? t.description.trim() : undefined,
      priority: clampPriority(t.priority),
      deadlineOffsetDays: typeof t.deadlineOffsetDays === 'number' && t.deadlineOffsetDays >= 0
        ? Math.min(Math.round(t.deadlineOffsetDays), daysToShip)
        : Math.floor(daysToShip / 2),
      isDecisionMoment: Boolean(t.isDecisionMoment),
    }));

  if (cleaned.length === 0) return null;

  // Guarantee exactly one decision moment near the start. If the model
  // produced zero or multiple, normalize.
  const decisionIndices = cleaned
    .map((t, i) => (t.isDecisionMoment ? i : -1))
    .filter((i) => i >= 0);

  if (decisionIndices.length === 0) {
    cleaned[0].isDecisionMoment = true;
  } else if (decisionIndices.length > 1) {
    const keep = decisionIndices[0];
    cleaned.forEach((t, i) => {
      t.isDecisionMoment = i === keep;
    });
  }

  return cleaned;
}

async function suggestTasks(value: BuildStep2, _decideByDate: string): Promise<SuggestedTask[]> {
  void _decideByDate;
  try {
    const aiTasks = await suggestTasksViaAI(value);
    if (aiTasks && aiTasks.length > 0) return aiTasks;
    return buildFallbackTasks(value);
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[buildFrame:suggestTasks] AI call failed, using fallback', err);
    return buildFallbackTasks(value);
  }
}

// ─── Frame export ────────────────────────────────────────────────────────────

export const buildFrame: DecisionFrame<BuildStep2> = {
  id: 'build',
  label: 'Build something',
  icon: Hammer,
  blurb: 'Feature spec, project kickoff, or one-off build.',

  defaultStep2: {
    whatBuilding: '',
    forWhom: '',
    hypothesis: '',
    acceptanceSignal: '',
    targetShipDate: isoPlusDays(21),
    stakeholders: [],
  },

  Step2Form,
  validateStep2,
  suggestTasks,
  deriveDecisionTitle,
  deriveDecisionDescription,

  contextFields: ['stakeholders', 'outcome'],
  defaultDecisionType: 'authority',
};

export { Step2Form };
