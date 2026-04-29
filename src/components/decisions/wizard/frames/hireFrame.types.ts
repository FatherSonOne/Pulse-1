// Step 2 schema for the "Hire someone" decision frame.
//
// Captures the role, seniority, motivation, must/nice criteria, target
// decide-by date, and any workspace stakeholders involved in the call.
// Consumed by hireFrame.tsx (Step2Form, validateStep2, suggestTasks,
// derivers) and persisted into WizardState.step2 keyed by frameId.

export type HireSeniority = 'junior' | 'mid' | 'senior' | 'staff' | 'lead';

export interface HireStep2 {
  /** e.g. "Senior Backend Engineer". Free-form role label. */
  roleTitle: string;

  /** Seniority bucket. Lowercase token; rendered title-case in the form. */
  seniority: HireSeniority;

  /** One-sentence reason this role matters now. Surfaces in description. */
  whyNow: string;

  /** 1-8 must-have qualifications. Non-empty. */
  mustHaves: string[];

  /** 0-8 optional nice-to-haves. */
  niceToHaves: string[];

  /** ISO YYYY-MM-DD date by which a hire decision should be made. */
  decideByDate: string;

  /** Workspace member ids brought in on the decision. */
  stakeholders: string[];
}
