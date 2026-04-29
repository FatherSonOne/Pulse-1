// "Allocate something" decision frame.
//
// Frame 4 of the Decision Wizard. Captures a budget / time / headcount / seat
// allocation across 2-10 recipients and produces a task plan that gathers
// inputs, runs an ROI pass, drafts a proposal, marks the final allocation as
// the decision moment, and closes with notification + rationale tasks.
//
// Mirrors geminiService's invokeAIJson + fallback pattern: the AI suggestion
// step is best-effort, with a deterministic hand-rolled list as backup so
// Step 3 always has something to render.

import React from 'react';
import { PieChart } from 'lucide-react';
import {
  TextField,
  ChipsField,
  RadioGroup,
  DatePicker,
  MemberPicker,
  CurrencyField,
} from '../primitives';
import type { DecisionFrame, Step2Props, SuggestedTask } from '../types';
import type { AllocateStep2, AllocateResourceType } from './allocateFrame.types';
import { invokeAIJson } from '../../../../services/ai/aiService';
import { getCurrentWorkspaceId } from '../../../../services/ai/getWorkspaceId';
import {
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from '../../../../services/ai/errors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayPlusDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function inferUnit(resourceType: AllocateResourceType, resourceTypeOther: string): string {
  switch (resourceType) {
    case 'budget':
      return 'USD';
    case 'time':
      return 'hours';
    case 'headcount':
      return 'people';
    case 'seats':
      return 'seats';
    case 'other':
      return resourceTypeOther;
    default:
      return '';
  }
}

function resourceLabel(value: AllocateStep2): string {
  return value.resourceType === 'other' ? value.resourceTypeOther : value.resourceType;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRouterHardError(err: unknown): boolean {
  return (
    err instanceof AICapExceededError ||
    err instanceof AITrialExpiredError ||
    err instanceof AIProviderUnavailableError
  );
}

const RESOURCE_OPTIONS: Array<{ value: AllocateResourceType; label: string }> = [
  { value: 'budget', label: 'Budget' },
  { value: 'time', label: 'Time' },
  { value: 'headcount', label: 'Headcount' },
  { value: 'seats', label: 'Tool seats' },
  { value: 'other', label: 'Other' },
];

// ─── Step 2 form ─────────────────────────────────────────────────────────────

const Step2Form: React.FC<Step2Props<AllocateStep2>> = ({
  value,
  onChange,
  workspaceMembers,
  errors = {},
}) => {
  const v: AllocateStep2 = {
    resourceType: value.resourceType ?? 'budget',
    resourceTypeOther: value.resourceTypeOther ?? '',
    totalAmount: value.totalAmount ?? '',
    unit: value.unit ?? '',
    recipients: value.recipients ?? [],
    criteria: value.criteria ?? [],
    decideByDate: value.decideByDate ?? todayPlusDaysIso(7),
    stakeholders: value.stakeholders ?? [],
  };

  const update = <K extends keyof AllocateStep2>(key: K, next: AllocateStep2[K]) => {
    onChange({ ...v, [key]: next });
  };

  const handleResourceTypeChange = (next: AllocateResourceType) => {
    // When the resource type changes, infer a sensible unit and clear the
    // "other" label if we left the Other bucket. We don't overwrite a unit
    // the user has already customized.
    const inferred = inferUnit(next, v.resourceTypeOther);
    onChange({
      ...v,
      resourceType: next,
      unit: v.unit ? v.unit : inferred,
      resourceTypeOther: next === 'other' ? v.resourceTypeOther : '',
    });
  };

  return (
    <div className="dw-step2-form">
      <RadioGroup<AllocateResourceType>
        label="Resource type"
        value={v.resourceType}
        onChange={handleResourceTypeChange}
        options={RESOURCE_OPTIONS}
        required
        error={errors.resourceType}
      />

      {v.resourceType === 'other' && (
        <TextField
          label="What are you allocating"
          value={v.resourceTypeOther}
          onChange={(next) => update('resourceTypeOther', next)}
          placeholder="e.g. ad spend, GPU hours, retainer slots"
          required
          error={errors.resourceTypeOther}
        />
      )}

      {v.resourceType === 'budget' ? (
        <CurrencyField
          label="Total amount"
          value={v.totalAmount === '' ? null : Number(v.totalAmount)}
          onChange={(next) => update('totalAmount', next === null ? '' : String(next))}
          required
          error={errors.totalAmount}
          hint="Total budget to split across recipients."
        />
      ) : (
        <TextField
          label="Total amount"
          value={v.totalAmount}
          onChange={(next) => update('totalAmount', next)}
          placeholder={
            v.resourceType === 'time'
              ? 'e.g. 40 hrs/wk'
              : v.resourceType === 'headcount'
              ? 'e.g. 6'
              : v.resourceType === 'seats'
              ? 'e.g. 25'
              : 'e.g. 100'
          }
          required
          error={errors.totalAmount}
        />
      )}

      <TextField
        label="Unit"
        value={v.unit}
        onChange={(next) => update('unit', next)}
        placeholder={inferUnit(v.resourceType, v.resourceTypeOther) || 'e.g. hours, people, seats'}
        hint="Optional. Inferred from resource type if left blank."
      />

      <ChipsField
        label="Recipients"
        value={v.recipients}
        onChange={(next) => update('recipients', next)}
        placeholder="Team A, Team B, Project X"
        required
        minItems={2}
        maxItems={10}
        error={errors.recipients}
        hint="Min 2, max 10. Press Enter or comma to add."
      />

      <ChipsField
        label="Optimizing for"
        value={v.criteria}
        onChange={(next) => update('criteria', next)}
        placeholder="impact, fit, urgency"
        error={errors.criteria}
        hint='Defaults to "impact, fit" if left empty.'
      />

      <DatePicker
        label="Decide by"
        value={v.decideByDate}
        onChange={(next) => update('decideByDate', next ?? '')}
        required
        error={errors.decideByDate}
      />

      <MemberPicker
        label="Stakeholders"
        value={v.stakeholders}
        onChange={(next) => update('stakeholders', next)}
        members={workspaceMembers}
        placeholder="Add members weighing in"
        error={errors.stakeholders}
      />
    </div>
  );
};

// ─── Validation ──────────────────────────────────────────────────────────────

const validateStep2 = (
  value: Partial<AllocateStep2>,
): Partial<Record<keyof AllocateStep2, string>> => {
  const errs: Partial<Record<keyof AllocateStep2, string>> = {};

  if (!value.resourceType) {
    errs.resourceType = 'Pick a resource type.';
  }

  if (value.resourceType === 'other' && !value.resourceTypeOther?.trim()) {
    errs.resourceTypeOther = 'Name what you are allocating.';
  }

  if (!value.totalAmount?.toString().trim()) {
    errs.totalAmount = 'Enter a total amount.';
  }

  const recipients = value.recipients ?? [];
  if (recipients.length < 2) {
    errs.recipients = 'Add at least 2 recipients.';
  } else if (recipients.length > 10) {
    errs.recipients = 'Max 10 recipients.';
  }

  if (!value.decideByDate) {
    errs.decideByDate = 'Pick a decide-by date.';
  }

  return errs;
};

// ─── Derivers ────────────────────────────────────────────────────────────────

const deriveDecisionTitle = (value: AllocateStep2): string => {
  const label = resourceLabel(value);
  const count = value.recipients.length;
  return `Allocate ${value.totalAmount} ${label} across ${count} ${count === 1 ? 'recipient' : 'recipients'}`;
};

const deriveDecisionDescription = (value: AllocateStep2): string => {
  const label = resourceLabel(value);
  const unitOrLabel = value.unit || label;
  const lines: string[] = [
    `**Allocating:** ${value.totalAmount} ${unitOrLabel}`,
    `**Among:** ${value.recipients.join(', ')}`,
  ];
  if (value.criteria.length > 0) {
    lines.push(`**Optimizing for:** ${value.criteria.join(', ')}`);
  }
  lines.push(`**Decide by:** ${formatDate(value.decideByDate)}`);
  return lines.join('\n');
};

// ─── Task suggestion ─────────────────────────────────────────────────────────

interface AISuggestionPayload {
  tasks?: Array<{
    title?: string;
    description?: string;
    priority?: SuggestedTask['priority'];
    deadlineOffsetDays?: number;
    isDecisionMoment?: boolean;
  }>;
}

function fallbackTasks(value: AllocateStep2, daysToDecide: number, criteria: string[]): SuggestedTask[] {
  const recipients = value.recipients;
  const gatherDeadline = Math.max(1, Math.floor(daysToDecide * 0.25));
  const gatherDeadlineBatched = Math.max(1, Math.floor(daysToDecide * 0.3));
  const analysisDeadline = Math.max(1, Math.floor(daysToDecide * 0.5));
  const draftDeadline = Math.max(1, Math.floor(daysToDecide * 0.75));
  const label = resourceLabel(value);
  const criteriaText = criteria.join(', ');

  const gatherTasks: SuggestedTask[] = recipients.length <= 4
    ? recipients.map((r) => ({
        id: newId(),
        title: `Gather inputs from ${r}`,
        description: `Collect requested allocation, justification, and any constraints from ${r}.`,
        priority: 'medium',
        deadlineOffsetDays: gatherDeadline,
      }))
    : [
        {
          id: newId(),
          title: `Gather inputs from all ${recipients.length} recipients`,
          description: `Send a structured request to ${recipients.join(', ')} asking for their requested allocation, justification, and constraints.`,
          priority: 'medium',
          deadlineOffsetDays: gatherDeadlineBatched,
        },
      ];

  return [
    ...gatherTasks,
    {
      id: newId(),
      title: `Analyze ROI per recipient against ${criteriaText}`,
      description: `Score each recipient's request against ${criteriaText} and note tradeoffs.`,
      priority: 'high',
      deadlineOffsetDays: analysisDeadline,
    },
    {
      id: newId(),
      title: 'Draft allocation proposal',
      description: `Write a first-pass split of ${value.totalAmount} ${value.unit || label} with rationale per recipient.`,
      priority: 'high',
      deadlineOffsetDays: draftDeadline,
    },
    {
      id: newId(),
      title: 'Decide final allocation',
      description: 'Lock the final split and record the call.',
      priority: 'urgent',
      deadlineOffsetDays: daysToDecide,
      isDecisionMoment: true,
    },
    {
      id: newId(),
      title: `Notify ${recipients.length} recipients and document rationale`,
      description: 'Send the decision to each recipient with the per-slice rationale, and file the rationale doc in the workspace.',
      priority: 'medium',
      deadlineOffsetDays: daysToDecide + 1,
    },
  ];
}

const suggestTasks = async (
  value: AllocateStep2,
  decideByDate: string,
): Promise<SuggestedTask[]> => {
  const today = todayPlusDaysIso(0);
  const daysToDecide = daysBetween(today, decideByDate || value.decideByDate);
  const criteria = value.criteria.length > 0 ? value.criteria : ['impact', 'fit'];
  const label = resourceLabel(value);

  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      return fallbackTasks(value, daysToDecide, criteria);
    }

    const prompt = `You are helping a solo operator allocate ${value.totalAmount} ${value.unit || label} across ${value.recipients.length} recipients.
Recipients: ${value.recipients.join(', ')}
Optimizing for: ${criteria.join(', ')}
Decide by: ${decideByDate} (${daysToDecide} days from today)

Generate an allocation task plan. Tasks should:
- Include a "gather inputs from recipients" task (one per recipient when 4 or fewer, batched when 5 or more)
- Include an analysis / ROI estimation task scored against the criteria
- Have a draft-allocation task before the final decision
- Mark the final allocation decision with isDecisionMoment: true
- Include post-decision communication tasks (notify recipients, document rationale)
- Suggest 5-7 tasks total

Return JSON: { "tasks": [{ "title": string, "description": string, "priority": "low" | "medium" | "high" | "urgent", "deadlineOffsetDays": number, "isDecisionMoment"?: boolean }] }
deadlineOffsetDays is the day count from today; the final decision must equal ${daysToDecide}.`;

    const result = await invokeAIJson<AISuggestionPayload>(
      'task_prioritization',
      prompt,
      { workspaceId },
    );

    const aiTasks = result?.tasks ?? [];
    if (aiTasks.length === 0) {
      return fallbackTasks(value, daysToDecide, criteria);
    }

    return aiTasks
      .filter((t) => typeof t.title === 'string' && t.title.trim().length > 0)
      .map((t) => ({
        id: newId(),
        title: t.title!.trim(),
        description: typeof t.description === 'string' ? t.description : undefined,
        priority: t.priority ?? 'medium',
        deadlineOffsetDays:
          typeof t.deadlineOffsetDays === 'number' && t.deadlineOffsetDays >= 0
            ? t.deadlineOffsetDays
            : daysToDecide,
        isDecisionMoment: Boolean(t.isDecisionMoment),
      }));
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    return fallbackTasks(value, daysToDecide, criteria);
  }
};

// ─── Frame export ────────────────────────────────────────────────────────────

export const allocateFrame: DecisionFrame<AllocateStep2> = {
  id: 'allocate',
  label: 'Allocate something',
  icon: PieChart,
  blurb: 'Budget, time, headcount, or seat allocation between options.',
  defaultStep2: {
    resourceType: 'budget',
    resourceTypeOther: '',
    totalAmount: '',
    unit: 'USD',
    recipients: [],
    criteria: [],
    decideByDate: todayPlusDaysIso(7),
    stakeholders: [],
  },
  Step2Form,
  validateStep2,
  suggestTasks,
  deriveDecisionTitle,
  deriveDecisionDescription,
  contextFields: ['criteria', 'options', 'stakeholders', 'outcome'],
  defaultDecisionType: 'consensus',
};
