// Step 2 schema for the "Set strategy" decision frame.
//
// Captures the time horizon, desired outcome, current blockers, optional
// first-move idea, target decide-by date, and any workspace stakeholders
// brought into the strategy conversation. Consumed by strategyFrame.tsx
// (Step2Form, validateStep2, suggestTasks, derivers) and persisted into
// WizardState.step2 keyed by frameId.

export type StrategyTimeHorizon = 'quarter' | 'half' | 'year' | 'multi_year';

export interface StrategyStep2 {
  /** Planning horizon. Lowercase token; rendered as friendly label in the form. */
  timeHorizon: StrategyTimeHorizon;

  /** What success looks like at the end of the horizon. Free-form sentence(s). */
  desiredOutcome: string;

  /** 1-6 blockers in the way of the desired outcome. Non-empty. */
  currentBlockers: string[];

  /** Optional one-thing-this-week kickoff. Surfaces as an immediate task. */
  firstMove: string;

  /** ISO YYYY-MM-DD date by which the strategy should be locked. */
  decideByDate: string;

  /** Workspace member ids brought in on the decision. */
  stakeholders: string[];
}
