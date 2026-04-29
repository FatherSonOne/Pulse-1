// Step 2 schema for the "Allocate something" decision frame.
//
// Captures the inputs needed to scope a budget / time / headcount / seat
// allocation: the resource type and total amount, the recipient set, the
// criteria the operator is optimizing for, and the deadline. Consumed by
// allocateFrame.tsx (Step2Form, validateStep2, suggestTasks, derivers) and
// persisted into WizardState.step2 keyed by frameId.

export type AllocateResourceType =
  | 'budget'
  | 'time'
  | 'headcount'
  | 'seats'
  | 'other';

export interface AllocateStep2 {
  /** Which kind of resource is being allocated. */
  resourceType: AllocateResourceType;

  /** Free-form label when resourceType === 'other'. Required in that case. */
  resourceTypeOther: string;

  /** Total amount to allocate. String to support "40 hrs/wk" alongside "50000". */
  totalAmount: string;

  /** Optional unit (e.g. "USD", "hours", "people"). Inferred from
   *  resourceType where possible; user can override. */
  unit: string;

  /** Recipients receiving a slice of the allocation. min 2, max 10. */
  recipients: string[];

  /** What the allocation is optimizing for. Defaults applied in suggestTasks
   *  when the operator leaves this empty. */
  criteria: string[];

  /** ISO YYYY-MM-DD date by which the allocation must be decided. */
  decideByDate: string;

  /** Workspace member ids brought in on the decision. */
  stakeholders: string[];
}
