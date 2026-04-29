// Step 2 schema for the "Resolve a conflict" decision frame.
//
// Captures the disagreement, the parties involved, each party's stated
// position, and the deadline by which the conflict should be resolved.
// The `partyPositions` array is a dynamic field. Its length is driven by
// the `parties` selection, with one position-textarea per party.
//
// Consumed by conflictFrame.tsx (Step2Form, validateStep2, suggestTasks,
// derivers) and persisted into WizardState.step2 keyed by frameId.

/** A single party's stated position in the disagreement. */
export interface PartyPosition {
  /** Workspace member id. Matches an entry in `parties`. */
  partyId: string;
  /** Display name cached at edit time so derivers / AI prompts can render
   *  human-readable labels without re-resolving against workspaceMembers.
   *  Falls back to "Party 1", "Party 2" if missing. */
  partyName?: string;
  /** Free-form text capturing what this party wants / believes. */
  position: string;
}

export interface ConflictStep2 {
  /** Free-form description of the disagreement. */
  disagreement: string;

  /** Workspace member ids of the parties in conflict. Min 2. */
  parties: string[];

  /** One entry per party. Length and order tracks `parties`; existing
   *  entries are preserved when parties are added or removed. */
  partyPositions: PartyPosition[];

  /** ISO YYYY-MM-DD date by which the conflict should be resolved.
   *  Defaults to today + 5 days. Conflicts shouldn't linger. */
  decideByDate: string;
}
