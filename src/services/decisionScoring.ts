/**
 * decisionScoring.ts
 *
 * Weighted-criteria decision matrix (launch-readiness 3d). A decision can carry a
 * self-contained scoring matrix — options scored against weighted criteria — stored
 * in decisions.scoring_matrix (jsonb). This module is the pure compute layer:
 * weighted totals + ranking + winner. No I/O, so it's exhaustively unit-tested.
 *
 * Deliberately isolated from the wizard's decisions.options/criteria columns (which
 * have their own frame-owned shapes) to avoid shape collisions / clobbering.
 */

export interface ScoringCriterion {
  id: string;
  label: string;
  /** Relative importance (any non-negative number; not required to sum to 1). */
  weight: number;
}

export interface ScoringOption {
  id: string;
  label: string;
}

export interface ScoringMatrix {
  options: ScoringOption[];
  criteria: ScoringCriterion[];
  /** scores[optionId][criterionId] → raw cell score (e.g. 0–5). */
  scores: Record<string, Record<string, number>>;
}

export interface OptionResult {
  id: string;
  label: string;
  total: number;
  /** 1 = highest weighted total. Ties keep input order. */
  rank: number;
}

export function emptyScoringMatrix(): ScoringMatrix {
  return { options: [], criteria: [], scores: {} };
}

/** True when the matrix has nothing worth rendering. */
export function isEmptyMatrix(m?: ScoringMatrix | null): boolean {
  return !m || ((m.options?.length ?? 0) === 0 && (m.criteria?.length ?? 0) === 0);
}

/**
 * Weighted totals per option (Σ score×weight), ranked. winnerId is the top option
 * — or null when there are no criteria or nothing has been scored yet (so we never
 * crown a "winner" of an unscored matrix).
 */
export function computeMatrix(m: ScoringMatrix): { results: OptionResult[]; winnerId: string | null } {
  const criteria = m.criteria ?? [];
  const options = m.options ?? [];
  const scores = m.scores ?? {};

  const raw = options.map((o) => {
    const total = criteria.reduce(
      (sum, c) => sum + (scores[o.id]?.[c.id] ?? 0) * (c.weight ?? 0),
      0
    );
    return { id: o.id, label: o.label, total };
  });

  const sorted = [...raw].sort((a, b) => b.total - a.total);
  const rankById = new Map<string, number>();
  sorted.forEach((r, i) => rankById.set(r.id, i + 1));
  const results = raw.map((r) => ({ ...r, rank: rankById.get(r.id)! }));

  const anyScored = criteria.length > 0 && raw.some((r) => r.total > 0);
  const winnerId = anyScored ? sorted[0].id : null;
  return { results, winnerId };
}
