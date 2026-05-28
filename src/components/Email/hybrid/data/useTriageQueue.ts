// useTriageQueue — Phase 4 stub. Memoized selector deriving the Triage queue
// from emailStore.emails (unread + ai_priority_score ≥ 60, capped at 20 per
// session). Exposes { queue, idx, currentEmail, advance, rewind, isDone }.
export function useTriageQueue() {
  return {
    queue: [] as string[],
    idx: 0,
    currentEmail: null,
    advance: () => {},
    rewind: () => {},
    isDone: false,
  };
}
