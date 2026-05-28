// useCockpitData — Phase 2 stub. Hoists DailyBriefing.loadBriefing heuristics
// (greeting + 4 stat counts + top-3 priority + meeting detection) and exposes
// { briefingMeta, signalEmails, laneBuckets, loading } for the Cockpit.
export function useCockpitData() {
  return {
    briefingMeta: null,
    signalEmails: [],
    laneBuckets: {},
    loading: false,
  };
}
