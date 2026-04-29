// Hire-someone decision frame.
//
// Step 2 captures the role posting (title, seniority, motivation, criteria,
// decide-by, stakeholders); deriveDecisionTitle / Description build the
// natural-language decision body; suggestTasks asks the AI router for a
// recruitment plan and falls back to an interpolated 5-task scaffold when
// the router is unreachable or returns no usable JSON.

import React, { useEffect } from 'react';
import { Users } from 'lucide-react';

import {
  TextField,
  TextareaField,
  ChipsField,
  RadioGroup,
  DatePicker,
  MemberPicker,
} from '../primitives';
import type { DecisionFrame, Step2Props, SuggestedTask } from '../types';
import type { HireStep2, HireSeniority } from './hireFrame.types';

import { invokeAIJson } from '../../../../services/ai/aiService';
import { getCurrentWorkspaceId } from '../../../../services/ai/getWorkspaceId';
import {
  AIRouterError,
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from '../../../../services/ai/errors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isRouterHardError(err: unknown): err is AIRouterError {
  return (
    err instanceof AICapExceededError ||
    err instanceof AITrialExpiredError ||
    err instanceof AIProviderUnavailableError
  );
}

const SENIORITY_OPTIONS: Array<{ value: HireSeniority; label: string }> = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'staff', label: 'Staff' },
  { value: 'lead', label: 'Lead' },
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLong(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function clampOffset(offset: number, max: number): number {
  if (!Number.isFinite(offset)) return 1;
  return Math.max(1, Math.min(Math.round(offset), max));
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const defaultStep2: Partial<HireStep2> = {
  roleTitle: '',
  seniority: undefined,
  whyNow: '',
  mustHaves: [],
  niceToHaves: [],
  // decideByDate is hydrated by Step2Form on mount so the default tracks
  // "today" each time the frame opens (rather than baking in a stale ISO).
  decideByDate: '',
  stakeholders: [],
};

// ─── Step 2 form ─────────────────────────────────────────────────────────────

const Step2Form: React.FC<Step2Props<HireStep2>> = ({
  value,
  onChange,
  workspaceMembers,
  errors,
}) => {
  // Hydrate the decide-by default on first mount if the host didn't already
  // seed one. Today + 14 days, per spec.
  useEffect(() => {
    if (!value.decideByDate) {
      onChange({ ...value, decideByDate: isoPlusDays(14) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof HireStep2>(key: K, next: HireStep2[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="dw-form">
      <TextField
        label="Role title"
        value={value.roleTitle ?? ''}
        onChange={(v) => set('roleTitle', v)}
        placeholder="Senior Backend Engineer"
        required
        autoFocus
        maxLength={80}
        error={errors?.roleTitle}
      />

      <RadioGroup<HireSeniority>
        label="Seniority"
        value={(value.seniority as HireSeniority | undefined) ?? null}
        onChange={(v) => set('seniority', v)}
        options={SENIORITY_OPTIONS}
        required
        error={errors?.seniority}
      />

      <TextareaField
        label="Why now"
        value={value.whyNow ?? ''}
        onChange={(v) => set('whyNow', v)}
        placeholder="One sentence on why this hire matters this quarter."
        required
        rows={2}
        error={errors?.whyNow}
      />

      <ChipsField
        label="Must-haves"
        value={value.mustHaves ?? []}
        onChange={(v) => set('mustHaves', v)}
        placeholder="Add a qualification, press Enter"
        required
        maxItems={8}
        hint="One to eight. Press Enter or comma to add."
        error={errors?.mustHaves}
      />

      <ChipsField
        label="Nice-to-haves"
        value={value.niceToHaves ?? []}
        onChange={(v) => set('niceToHaves', v)}
        placeholder="Optional bonus skills"
        maxItems={8}
        hint="Up to eight. Optional."
        error={errors?.niceToHaves}
      />

      <DatePicker
        label="Decide by"
        value={value.decideByDate ?? null}
        onChange={(v) => set('decideByDate', v ?? '')}
        required
        hint="Defaults to two weeks from today."
        error={errors?.decideByDate}
      />

      <MemberPicker
        label="Stakeholders"
        value={value.stakeholders ?? []}
        onChange={(v) => set('stakeholders', v)}
        members={workspaceMembers}
        placeholder="Add anyone who should weigh in"
        error={errors?.stakeholders}
      />
    </div>
  );
};

// ─── Validation ──────────────────────────────────────────────────────────────

function validateStep2(value: Partial<HireStep2>): Partial<Record<keyof HireStep2, string>> {
  const errors: Partial<Record<keyof HireStep2, string>> = {};

  if (!value.roleTitle || !value.roleTitle.trim()) {
    errors.roleTitle = 'Add a role title.';
  }
  if (!value.seniority) {
    errors.seniority = 'Pick a seniority level.';
  }
  if (!value.whyNow || !value.whyNow.trim()) {
    errors.whyNow = 'Add one sentence on why now.';
  } else if (value.whyNow.trim().length < 10) {
    errors.whyNow = 'A few more words please (at least 10 characters).';
  }
  if (!value.mustHaves || value.mustHaves.length < 1) {
    errors.mustHaves = 'Add at least one must-have.';
  } else if (value.mustHaves.length > 8) {
    errors.mustHaves = 'Cap must-haves at eight.';
  }
  if (value.niceToHaves && value.niceToHaves.length > 8) {
    errors.niceToHaves = 'Cap nice-to-haves at eight.';
  }
  if (!value.decideByDate) {
    errors.decideByDate = 'Pick a decide-by date.';
  } else if (value.decideByDate < todayIso()) {
    errors.decideByDate = 'Decide-by must be today or later.';
  }

  return errors;
}

// ─── Derivers ────────────────────────────────────────────────────────────────

function deriveDecisionTitle(value: HireStep2): string {
  const seniority = (value.seniority ?? '').toLowerCase();
  const role = (value.roleTitle ?? '').trim().toLowerCase();
  return `Hire a ${seniority} ${role}`.replace(/\s+/g, ' ').trim();
}

function deriveDecisionDescription(value: HireStep2): string {
  const lines: string[] = [];
  if (value.whyNow && value.whyNow.trim()) {
    lines.push(value.whyNow.trim());
    lines.push('');
  }

  lines.push('**Must-haves**');
  for (const m of value.mustHaves ?? []) {
    lines.push(`- ${m}`);
  }

  if (value.niceToHaves && value.niceToHaves.length > 0) {
    lines.push('');
    lines.push('**Nice-to-haves**');
    for (const n of value.niceToHaves) {
      lines.push(`- ${n}`);
    }
  }

  if (value.decideByDate) {
    lines.push('');
    lines.push(`**Decide by:** ${formatDateLong(value.decideByDate)}`);
  }

  return lines.join('\n').trim();
}

// ─── Task suggestion (AI + interpolated fallback) ────────────────────────────

interface AITaskShape {
  title: string;
  description?: string;
  priority?: SuggestedTask['priority'];
  deadlineOffsetDays?: number;
  isDecisionMoment?: boolean;
}

function buildFallbackTasks(value: HireStep2, daysToDecide: number): SuggestedTask[] {
  const seniority = (value.seniority ?? 'senior').toLowerCase();
  const role = (value.roleTitle ?? 'role').trim() || 'role';
  const topMust = (value.mustHaves ?? []).slice(0, 2);
  const mustSummary = topMust.length > 0 ? topMust.join(', ') : 'core must-haves';
  const niceSummary = (value.niceToHaves ?? []).slice(0, 2).join(', ');

  const sourceBy = clampOffset(daysToDecide * 0.3, daysToDecide - 1);
  const screenBy = clampOffset(daysToDecide * 0.5, daysToDecide - 1);
  const interviewBy = clampOffset(daysToDecide * 0.85, daysToDecide - 1);
  const decideBy = daysToDecide;
  const kickoffBy = daysToDecide + 3;

  return [
    {
      id: 'hire-source',
      title: `Source 5 ${seniority} ${role.toLowerCase()} candidates strong on ${mustSummary}`,
      description: `Build a sourced shortlist that screens against the must-haves. Capture name, link, and a one-line fit note for each.`,
      priority: 'high',
      deadlineOffsetDays: sourceBy,
      isDecisionMoment: false,
    },
    {
      id: 'hire-screen',
      title: `Screen sourced candidates against must-haves for the ${role}`,
      description: `Run a 20-minute screen. Confirm the top must-haves${niceSummary ? `, probe on ${niceSummary}` : ''}, drop anyone below the bar.`,
      priority: 'high',
      deadlineOffsetDays: screenBy,
      isDecisionMoment: false,
    },
    {
      id: 'hire-interviews',
      title: `Run finalist interviews for the ${role}`,
      description: `Loop in stakeholders. Use a structured rubric per must-have so debriefs compare on the same axes.`,
      priority: 'high',
      deadlineOffsetDays: interviewBy,
      isDecisionMoment: false,
    },
    {
      id: 'hire-decision',
      title: `Decide on a finalist for the ${seniority} ${role.toLowerCase()}`,
      description: `Compare scorecards, weigh trade-offs against why-now, and make the call by the decide-by date.`,
      priority: 'urgent',
      deadlineOffsetDays: decideBy,
      isDecisionMoment: true,
    },
    {
      id: 'hire-kickoff',
      title: `Kick off ${role} onboarding`,
      description: `First-day setup, a 30-day plan tied to the why-now goal, and a check-in cadence with the new hire.`,
      priority: 'medium',
      deadlineOffsetDays: kickoffBy,
      isDecisionMoment: false,
    },
  ];
}

async function suggestTasks(value: HireStep2, decideByDate: string): Promise<SuggestedTask[]> {
  const today = todayIso();
  const target = decideByDate || value.decideByDate || isoPlusDays(14);
  const daysToDecide = daysBetween(today, target);

  const workspaceId = getCurrentWorkspaceId();

  if (workspaceId) {
    try {
      const prompt = `You are helping a solo operator hire a ${(value.seniority ?? '').toLowerCase()} ${value.roleTitle}.
Why now: ${value.whyNow}
Must-haves: ${(value.mustHaves ?? []).join(', ')}
Nice-to-haves: ${(value.niceToHaves ?? []).join(', ') || '(none)'}
Decide by: ${target} (${daysToDecide} days from now)

Generate a recruitment task plan. Tasks should:
- Be specific (reference the role title and must-haves where natural).
- Have realistic deadlineOffsetDays that cascade between 1 and ${daysToDecide} for sourcing, screening, and interviewing, with the decision task at ${daysToDecide}, and an onboarding kickoff a few days after.
- Cover sourcing, screening, interviewing, decision, and kickoff phases.
- Mark exactly one task with isDecisionMoment: true (the final decision task).
- Suggest 5 to 7 tasks total.
- Use plain prose. Do not use em dashes. Use periods, commas, colons, or parentheses instead.

Return JSON shaped as { "tasks": [ { "title": string, "description": string, "priority": "low"|"medium"|"high"|"urgent", "deadlineOffsetDays": number, "isDecisionMoment": boolean } ] }.
Return ONLY valid JSON, no commentary.`;

      const parsed = await invokeAIJson<{ tasks: AITaskShape[] }>(
        'task_prioritization',
        prompt,
        { workspaceId, temperature: 0.4 },
      );

      if (parsed && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
        const tasks: SuggestedTask[] = parsed.tasks.slice(0, 7).map((t, i) => ({
          id: `hire-ai-${i}`,
          title: typeof t.title === 'string' && t.title.trim() ? t.title.trim() : `Hiring task ${i + 1}`,
          description: typeof t.description === 'string' ? t.description : undefined,
          priority: (t.priority && ['low', 'medium', 'high', 'urgent'].includes(t.priority))
            ? t.priority
            : 'medium',
          deadlineOffsetDays: clampOffset(
            typeof t.deadlineOffsetDays === 'number' ? t.deadlineOffsetDays : (i + 1) * Math.max(1, Math.floor(daysToDecide / 5)),
            daysToDecide + 7,
          ),
          isDecisionMoment: Boolean(t.isDecisionMoment),
        }));

        // Guarantee exactly one decision-moment task.
        const moments = tasks.filter((t) => t.isDecisionMoment);
        if (moments.length === 0) {
          // Promote the latest task to the decision moment.
          let latestIdx = 0;
          for (let i = 1; i < tasks.length; i++) {
            if (tasks[i].deadlineOffsetDays >= tasks[latestIdx].deadlineOffsetDays) latestIdx = i;
          }
          tasks[latestIdx].isDecisionMoment = true;
          tasks[latestIdx].priority = 'urgent';
        } else if (moments.length > 1) {
          let kept = false;
          for (const t of tasks) {
            if (t.isDecisionMoment && !kept) { kept = true; continue; }
            if (t.isDecisionMoment) t.isDecisionMoment = false;
          }
        }

        return tasks;
      }
    } catch (err) {
      if (isRouterHardError(err)) throw err;
      console.warn('[hireFrame.suggestTasks] AI call failed, using fallback', err);
    }
  }

  return buildFallbackTasks(value, daysToDecide);
}

// ─── Frame export ────────────────────────────────────────────────────────────

export const hireFrame: DecisionFrame<HireStep2> = {
  id: 'hire',
  label: 'Hire someone',
  icon: Users,
  blurb: 'Recruitment, role definition, and onboarding plan.',
  defaultStep2,
  Step2Form,
  validateStep2,
  suggestTasks,
  deriveDecisionTitle,
  deriveDecisionDescription,
  contextFields: ['criteria', 'options', 'stakeholders', 'outcome'],
  defaultDecisionType: 'consensus',
};

export { Step2Form };
