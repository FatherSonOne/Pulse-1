// Full-screen paywall shown when a workspace's 30-day Pulse Team trial has expired.
// Renders inside whichever area would normally be usable — blocks interaction until upgrade.

import React, { useState } from 'react';
import { AlertTriangle, Check, CreditCard, Loader, Sparkles, X } from 'lucide-react';
import billingService from '../../services/billingService';

interface TrialExpiredBlockProps {
  workspaceId: string;
  workspaceName?: string;
  canManageBilling?: boolean;
  /** Dev-only escape hatch. When provided, renders an "X" close button
   *  in the top-right corner that dismisses the overlay for the session. */
  onDevDismiss?: () => void;
}

const FEATURES = [
  'Unlimited team seats',
  'All 6 Relay modes (Quick, Team, Drop, Threads, Radio, Notes)',
  'Video Vox + Studio RAG',
  'Email, calendar, messaging, meetings',
  'Advanced analytics + full ecosystem bridge',
  '2,000 AI messages / 500 SMS / 50 GB storage / mo',
];

export const TrialExpiredBlock: React.FC<TrialExpiredBlockProps> = ({
  workspaceId,
  workspaceName,
  canManageBilling = true,
  onDevDismiss,
}) => {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    if (!canManageBilling) {
      setError('Ask your workspace owner to upgrade.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = await billingService.createCheckout({
        workspaceId,
        planId: 'pulse_team',
        billingCycle: cycle,
      });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed. Try again.');
      setLoading(false);
    }
  };

  const monthlyPrice = 100;
  const yearlyPrice = 1000;
  const yearlyMonthlyEquiv = yearlyPrice / 12;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-500" />

        {onDevDismiss && (
          <button
            type="button"
            onClick={onDevDismiss}
            title="Dismiss for this tab session (dev only) — Ctrl+Shift+P"
            className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors z-10"
          >
            <X size={16} />
          </button>
        )}

        <div className="p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Your Pulse trial has ended</h2>
              <p className="text-zinc-400 mt-1">
                {workspaceName ? `${workspaceName} — ` : ''}Pick a plan to keep your team connected.
              </p>
            </div>
          </div>

          {/* Billing cycle toggle */}
          <div className="flex items-center justify-center gap-3 bg-zinc-900/60 border border-zinc-800 rounded-xl p-2">
            <button
              type="button"
              onClick={() => setCycle('monthly')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                cycle === 'monthly'
                  ? 'bg-fuchsia-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle('yearly')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                cycle === 'yearly'
                  ? 'bg-fuchsia-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Yearly <span className="text-xs text-emerald-400 ml-1">2 months free</span>
            </button>
          </div>

          {/* Pulse Team card */}
          <div className="relative bg-zinc-900 border border-fuchsia-500/40 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-fuchsia-400" />
                <h3 className="text-xl font-bold text-white">Pulse Team</h3>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">
                  ${cycle === 'monthly' ? monthlyPrice : Math.round(yearlyMonthlyEquiv)}
                  <span className="text-sm text-zinc-400 font-normal">/mo</span>
                </div>
                {cycle === 'yearly' && (
                  <div className="text-xs text-zinc-500">${yearlyPrice} billed yearly</div>
                )}
              </div>
            </div>

            <ul className="space-y-2">
              {FEATURES.map((feat) => (
                <li key={feat} className="flex items-start gap-2 text-sm text-zinc-300">
                  <Check className="text-emerald-400 mt-0.5 flex-shrink-0" size={16} />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={handleUpgrade}
              disabled={loading || !canManageBilling}
              className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader className="animate-spin" size={18} /> Redirecting to checkout...</>
              ) : (
                <><CreditCard size={18} /> Upgrade now</>
              )}
            </button>

            {!canManageBilling && (
              <p className="text-xs text-zinc-500 text-center">
                Only workspace owners and admins can manage billing.
              </p>
            )}

            {error && (
              <p className="text-xs text-rose-400 text-center">{error}</p>
            )}
          </div>

          <p className="text-xs text-zinc-600 text-center">
            Questions? Email fm1@qntmecos.com. Cancel anytime from Settings → Billing.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrialExpiredBlock;
