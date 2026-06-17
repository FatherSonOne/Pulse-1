import { describe, it, expect } from 'vitest';
import {
  computeMatrix,
  emptyScoringMatrix,
  isEmptyMatrix,
  type ScoringMatrix,
} from '../../services/decisionScoring';

describe('decisionScoring — computeMatrix', () => {
  it('applies weights and ranks; ties keep input order', () => {
    const m: ScoringMatrix = {
      options: [{ id: 'o1', label: 'A' }, { id: 'o2', label: 'B' }],
      criteria: [{ id: 'c1', label: 'Cost', weight: 2 }, { id: 'c2', label: 'Speed', weight: 1 }],
      scores: { o1: { c1: 3, c2: 5 }, o2: { c1: 5, c2: 1 } },
    };
    // o1 = 3*2 + 5*1 = 11 ; o2 = 5*2 + 1*1 = 11 → tie
    const { results, winnerId } = computeMatrix(m);
    expect(results.find((r) => r.id === 'o1')!.total).toBe(11);
    expect(results.find((r) => r.id === 'o2')!.total).toBe(11);
    expect(winnerId).toBe('o1'); // tie → first by input order
  });

  it('picks the clear weighted winner and ranks correctly', () => {
    const m: ScoringMatrix = {
      options: [{ id: 'o1', label: 'A' }, { id: 'o2', label: 'B' }],
      criteria: [{ id: 'c1', label: 'Cost', weight: 3 }, { id: 'c2', label: 'Speed', weight: 1 }],
      scores: { o1: { c1: 5, c2: 1 }, o2: { c1: 1, c2: 5 } },
    };
    // o1 = 15+1 = 16 ; o2 = 3+5 = 8
    const r = computeMatrix(m);
    expect(r.winnerId).toBe('o1');
    expect(r.results.find((x) => x.id === 'o1')!.rank).toBe(1);
    expect(r.results.find((x) => x.id === 'o2')!.rank).toBe(2);
  });

  it('treats missing cell scores as 0', () => {
    const m: ScoringMatrix = {
      options: [{ id: 'o1', label: 'A' }],
      criteria: [{ id: 'c1', label: 'X', weight: 2 }, { id: 'c2', label: 'Y', weight: 1 }],
      scores: { o1: { c1: 4 } }, // c2 missing → 0
    };
    expect(computeMatrix(m).results[0].total).toBe(8);
  });

  it('no winner without criteria', () => {
    const m: ScoringMatrix = { options: [{ id: 'o1', label: 'A' }], criteria: [], scores: {} };
    expect(computeMatrix(m).winnerId).toBeNull();
  });

  it('no winner for an unscored matrix', () => {
    const m: ScoringMatrix = {
      options: [{ id: 'o1', label: 'A' }],
      criteria: [{ id: 'c1', label: 'X', weight: 1 }],
      scores: {},
    };
    expect(computeMatrix(m).winnerId).toBeNull();
  });
});

describe('decisionScoring — helpers', () => {
  it('emptyScoringMatrix / isEmptyMatrix', () => {
    expect(isEmptyMatrix(emptyScoringMatrix())).toBe(true);
    expect(isEmptyMatrix(null)).toBe(true);
    expect(isEmptyMatrix({ options: [{ id: 'o', label: 'A' }], criteria: [], scores: {} })).toBe(false);
  });
});
