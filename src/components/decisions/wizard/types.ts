// Decision Wizard contract types.
//
// The wizard is a 5-step flow that produces a real configured decision plus
// a list of suggested tasks. Each of the 6 frames (Hire / Pick a tool /
// Build / Allocate / Strategy / Conflict) implements the DecisionFrame
// interface so the shell can render and submit them uniformly.
//
// Per-frame Step 2 schemas live in src/components/decisions/wizard/frames/*.

import type { LucideIcon } from 'lucide-react';
import type { Task } from '../../../services/taskService';
import type { User } from '../../../types';

export type FrameId =
  | 'hire'
  | 'pick_tool'
  | 'build'
  | 'allocate'
  | 'strategy'
  | 'conflict';

/** Which of the structured-decision-context fields a frame surfaces.
 *  Phase 4 introduces the universal schema; each frame opts in selectively. */
export type ContextField = 'criteria' | 'options' | 'stakeholders' | 'outcome';

/** A task suggested by a frame's `suggestTasks`. Mapped 1:1 to Partial<Task>
 *  on submit, but stays loose during Step 3 editing. */
export interface SuggestedTask {
  id: string; // local-only, used for keying during edit
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  /** ISO date string, deadline cascade is computed from rhythm + offset */
  deadlineOffsetDays: number;
  /** Optional workspace member id */
  assigneeId?: string;
  /** Marks the task that produces the decision itself. Exactly one task per
   *  frame's suggestion list should set this. */
  isDecisionMoment?: boolean;
  /** Marks an immediate-action task (e.g. Strategy frame's "first move"). */
  isImmediate?: boolean;
}

/** Generic Step 2 form props. Each frame's Step2Form receives these. */
export interface Step2Props<T = Record<string, unknown>> {
  value: Partial<T>;
  onChange: (next: Partial<T>) => void;
  workspaceMembers: User[];
  /** Validation errors keyed by field name. */
  errors?: Partial<Record<keyof T, string>>;
}

/** The wizard cross-step state. */
export interface WizardState {
  step: 1 | 2 | 3 | 4 | 5;
  frameId: FrameId | null;
  step2: Record<string, unknown>;
  step3Tasks: SuggestedTask[];
  step4: Step4Output;
  /** Set when the operator chose "Save as template" in Step 5. */
  saveAsTemplate: { name: string; description?: string; sharedWithWorkspace: boolean } | null;
}

export interface Step4Output {
  decideByDate: string | null; // ISO; defaults from frame
  shipByDate: string | null; // ISO; optional
  checkInCadence: 'none' | 'daily' | 'twice_weekly' | 'weekly';
  remindBeforeDays: 0 | 1 | 3 | 7;
  retrospectiveDays: 0 | 30 | 60 | 90; // 0 = no retro
  /**
   * Optional venue captured via Google Places Autocomplete. Stored on
   * the wizard's local state until the decision row exists; the host
   * (DecisionTaskHub.handleWizardSubmit) creates the matching `place`
   * + `entity_places` rows after createDecision returns an id.
   */
  venue?: WizardVenue | null;
}

export interface WizardVenue {
  lat: number;
  lng: number;
  address: string | null;
  name: string | null;
}

/** The contract every frame implements. */
export interface DecisionFrame<TStep2 = Record<string, unknown>> {
  id: FrameId;
  label: string;
  icon: LucideIcon;
  blurb: string;

  /** Default Step 2 state when the frame is first opened. */
  defaultStep2: Partial<TStep2>;

  /** Step 2 form component. */
  Step2Form: React.FC<Step2Props<TStep2>>;

  /** Validates Step 2. Returns map of errors; empty map means valid. */
  validateStep2: (value: Partial<TStep2>) => Partial<Record<keyof TStep2, string>>;

  /** Generates suggested tasks given Step 2 input. Calls AI under the hood
   *  and falls back to a hand-rolled list when AI is unavailable. */
  suggestTasks: (value: TStep2, decideByDate: string) => Promise<SuggestedTask[]>;

  /** Derives the decision title from Step 2 input. Must produce a natural,
   *  human-readable sentence (no "Should we pursue X?" templating). */
  deriveDecisionTitle: (value: TStep2) => string;

  /** Derives the decision description (markdown). */
  deriveDecisionDescription: (value: TStep2) => string;

  /** Phase 4 hook: which structured context fields this frame surfaces. */
  contextFields: ContextField[];

  /** Decision type to set on the row. Default 'consensus'. */
  defaultDecisionType?: 'consensus' | 'majority' | 'unanimous' | 'authority';
}

/** The wizard's submit payload, consumed by the host (DecisionTaskHub). */
export interface WizardOutput {
  decision: {
    workspace_id: string;
    title: string;
    description: string;
    decision_type: 'consensus' | 'majority' | 'unanimous' | 'authority';
    proposed_by: string;
    /** Phase 4: structured context. Frames that don't surface a field omit it. */
    metadata?: Record<string, unknown>;
  };
  tasks: Array<Pick<Task, 'workspace_id' | 'title' | 'description' | 'priority' | 'status' | 'assignee_id' | 'deadline'> & { metadata?: Record<string, unknown> }>;
  /**
   * Optional venue. When set, the host creates a `place` row and links
   * it to the new decision via `entity_places` (role='venue') after
   * createDecision returns an id.
   */
  venue?: WizardVenue | null;
  /** When set, a row is also written to decision_templates with the wizard config. */
  saveAsTemplate?: {
    name: string;
    description?: string;
    sharedWithWorkspace: boolean;
    config: {
      frameId: FrameId;
      step2: Record<string, unknown>;
      step4: Step4Output;
    };
  };
}
