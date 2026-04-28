// Step 2 schema for the "Pick a tool" frame.
//
// Captures the inputs the wizard needs to scope a vendor / tool / stack
// selection: the problem statement, the candidate set, the criteria the
// operator cares about, an optional monthly budget ceiling, and the deadline
// for making the call.

export interface PickToolStep2 {
  /** Sentence describing the problem the chosen tool must solve. */
  problem: string;

  /** Candidate tool names (min 2, max 8). */
  candidates: string[];

  /** Selection criteria the operator scores candidates on (min 2, max 6). */
  criteria: string[];

  /** Optional monthly budget ceiling in dollars. null when unset. */
  budgetCeiling: number | null;

  /** ISO date string (YYYY-MM-DD) the decision must be made by. */
  decideByDate: string;
}
