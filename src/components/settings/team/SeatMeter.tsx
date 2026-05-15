import React from 'react';
import { ArrowUpRight, Infinity as InfinityIcon } from 'lucide-react';

interface SeatMeterProps {
  used: number;
  limit: number;
  planLabel: string;
  /** Whether the current user can act on Upgrade (typically isOwner || isAdmin). */
  canUpgrade?: boolean;
}

// Above this, the plan is effectively unlimited — render an "Unlimited"
// chip instead of a useless 0.0001% bar. Mirrors WORKSPACE_PLAN_LIMITS
// in workspaceService.ts where `team`/`growth` are 1_000_000.
const UNLIMITED_THRESHOLD = 100_000;

const CTA_THRESHOLD = 70;
const CORAL_THRESHOLD = 90;

/**
 * Seat usage meter for Team Settings. Promotes "1 / 50 (Free plan)" from
 * `text-xs text-zinc-400` (page's revenue lever in the smallest type)
 * to a horizontal meter with progressive escalation:
 *
 *   <70%   — neutral zinc fill, no CTA
 *   70-90% — amber fill, Upgrade CTA appears
 *   >90%   — rose fill (Coral-As-Signal active), Upgrade CTA emphasised
 *
 * Upgrade CTA fires `pulse:settings-navigate` with `section: 'billing'`,
 * matching how UsageWarningBanner / Summit / useAIErrorHandler already
 * route the user into billing.
 */
export const SeatMeter: React.FC<SeatMeterProps> = ({ used, limit, planLabel, canUpgrade = true }) => {
  const isUnlimited = limit >= UNLIMITED_THRESHOLD;
  const rawPercent = limit > 0 ? (used / limit) * 100 : 0;
  const clampedPercent = Math.min(100, Math.max(0, rawPercent));
  const showCta = !isUnlimited && rawPercent > CTA_THRESHOLD && canUpgrade;
  const isCoral = !isUnlimited && rawPercent > CORAL_THRESHOLD;
  const isAmber = !isUnlimited && rawPercent > CTA_THRESHOLD && !isCoral;

  const handleUpgrade = () => {
    window.dispatchEvent(new CustomEvent('pulse:settings-navigate', {
      detail: { section: 'billing' },
    }));
  };

  return (
    <div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-3">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-bold text-zinc-900 dark:text-white tabular-nums">
            {isUnlimited ? (
              <span className="inline-flex items-center gap-1">
                <InfinityIcon className="w-3.5 h-3.5" /> {used}
              </span>
            ) : (
              <>{used} <span className="text-zinc-400 dark:text-zinc-500 font-normal">/ {limit}</span></>
            )}
          </span>
          <span
            className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 dark:text-zinc-400"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {isUnlimited ? 'members' : 'seats'}
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
            {planLabel} plan
          </span>
        </div>
        {showCta && (
          <button
            type="button"
            onClick={handleUpgrade}
            aria-label="Upgrade plan to add more seats"
            className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md transition ${
              isCoral
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            Upgrade
            <ArrowUpRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {!isUnlimited && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(clampedPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${used} of ${limit} seats used`}
          className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isCoral ? 'bg-rose-500' : isAmber ? 'bg-amber-500' : 'bg-zinc-400 dark:bg-zinc-500'
            }`}
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
      )}
    </div>
  );
};
