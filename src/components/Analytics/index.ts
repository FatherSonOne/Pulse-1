/**
 * /analytics now routes to the weekly Briefing surface.
 * The Observatory (AnalyticsDashboard) is preserved in the folder for
 * reference and is not exported until the migration craft pass is complete.
 *
 * Both `AnalyticsDashboard` (named) and the default export are re-routed to
 * `Briefing` so existing callers (App.tsx, Sidebar) need no changes.
 */

export { Briefing as AnalyticsDashboard } from '../Briefing/Briefing';
export { default } from '../Briefing/Briefing';
