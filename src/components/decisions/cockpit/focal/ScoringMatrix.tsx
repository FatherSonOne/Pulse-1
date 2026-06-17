/**
 * ScoringMatrix — weighted-criteria decision matrix editor (launch-readiness 3d).
 * Options (rows) scored against weighted criteria (columns); the engine
 * (decisionScoring) computes weighted totals + the winning option. Autosaves the
 * whole matrix to decisions.scoring_matrix (jsonb) via updateDecision, debounced.
 */
import { useRef, useState } from 'react';
import { Plus, X, Trophy } from 'lucide-react';
import { decisionService } from '../../../../services/decisionService';
import {
  computeMatrix,
  emptyScoringMatrix,
  type ScoringMatrix as Matrix,
} from '../../../../services/decisionScoring';

export function ScoringMatrixEditor({ decisionId, initial }: { decisionId: string; initial?: Matrix | null }) {
  const [matrix, setMatrix] = useState<Matrix>(() => initial ?? emptyScoringMatrix());
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const persist = (next: Matrix) => {
    setMatrix(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void decisionService.updateDecision(decisionId, { scoring_matrix: next });
    }, 500);
  };

  const addOption = () =>
    persist({ ...matrix, options: [...matrix.options, { id: crypto.randomUUID(), label: `Option ${matrix.options.length + 1}` }] });
  const addCriterion = () =>
    persist({ ...matrix, criteria: [...matrix.criteria, { id: crypto.randomUUID(), label: 'Criterion', weight: 1 }] });
  const removeOption = (id: string) => {
    const { [id]: _drop, ...rest } = matrix.scores;
    persist({ ...matrix, options: matrix.options.filter((o) => o.id !== id), scores: rest });
  };
  const removeCriterion = (id: string) =>
    persist({ ...matrix, criteria: matrix.criteria.filter((c) => c.id !== id) });
  const setOptionLabel = (id: string, label: string) =>
    persist({ ...matrix, options: matrix.options.map((o) => (o.id === id ? { ...o, label } : o)) });
  const setCriterion = (id: string, patch: Partial<Matrix['criteria'][number]>) =>
    persist({ ...matrix, criteria: matrix.criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const setScore = (oid: string, cid: string, v: number) =>
    persist({ ...matrix, scores: { ...matrix.scores, [oid]: { ...(matrix.scores[oid] ?? {}), [cid]: v } } });

  const { results, winnerId } = computeMatrix(matrix);
  const totalById = new Map(results.map((r) => [r.id, r.total]));
  const bare = matrix.options.length === 0 && matrix.criteria.length === 0;

  return (
    <div className="ck-scorematrix">
      <div className="ck-focal-section-label">Option scoring</div>
      {bare ? (
        <p className="ck-focal-desc">Weigh options against weighted criteria to find the strongest choice.</p>
      ) : (
        <div className="ck-sm-scroll">
          <table className="ck-sm-table">
            <thead>
              <tr>
                <th className="ck-sm-corner">Option</th>
                {matrix.criteria.map((c) => (
                  <th key={c.id} className="ck-sm-crit">
                    <input
                      className="ck-sm-crit-label"
                      value={c.label}
                      onChange={(e) => setCriterion(c.id, { label: e.target.value })}
                      aria-label="Criterion name"
                    />
                    <span className="ck-sm-weight">
                      ×
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        className="ck-sm-weight-input"
                        value={c.weight}
                        onChange={(e) => setCriterion(c.id, { weight: Number(e.target.value) || 0 })}
                        aria-label="Weight"
                      />
                      <button type="button" className="ck-sm-x" onClick={() => removeCriterion(c.id)} aria-label="Remove criterion">
                        <X size={11} />
                      </button>
                    </span>
                  </th>
                ))}
                <th className="ck-sm-total-h">Total</th>
              </tr>
            </thead>
            <tbody>
              {matrix.options.map((o) => (
                <tr key={o.id} data-winner={o.id === winnerId || undefined}>
                  <td className="ck-sm-opt">
                    <input
                      className="ck-sm-opt-label"
                      value={o.label}
                      onChange={(e) => setOptionLabel(o.id, e.target.value)}
                      aria-label="Option name"
                    />
                    <button type="button" className="ck-sm-x" onClick={() => removeOption(o.id)} aria-label="Remove option">
                      <X size={11} />
                    </button>
                  </td>
                  {matrix.criteria.map((c) => (
                    <td key={c.id}>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        className="ck-sm-score"
                        value={matrix.scores[o.id]?.[c.id] ?? ''}
                        onChange={(e) => setScore(o.id, c.id, e.target.value === '' ? 0 : Number(e.target.value))}
                        aria-label={`Score ${o.label} on ${c.label}`}
                      />
                    </td>
                  ))}
                  <td className="ck-sm-total">
                    {o.id === winnerId && <Trophy size={12} aria-label="Top option" />} {totalById.get(o.id) ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="ck-sm-actions">
        <button type="button" className="ck-pill ck-pill-add" onClick={addOption}><Plus size={12} /> Option</button>
        <button type="button" className="ck-pill ck-pill-add" onClick={addCriterion}><Plus size={12} /> Criterion</button>
      </div>
    </div>
  );
}
