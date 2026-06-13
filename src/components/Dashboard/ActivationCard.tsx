import React, { useEffect, useState } from 'react';
import { ArrowRight, Calendar, Check, CheckSquare, Loader2, Target, Users } from 'lucide-react';
import { AppView } from '../../types';
import { googleCalendarService } from '../../services/googleCalendarService';
import { getContactsConnectStatus } from '../../services/google/contactsConnect';

/**
 * First-run activation card — replaces the bare "Generate briefing" empty state
 * for a brand-new solo user. The dashboard briefing draws from connected sources
 * (calendar, contacts, tasks), so an empty account that just presses "Generate"
 * gets little. This card names the real, *ungated* value paths and routes the
 * user to the surfaces that already own each connect flow (we deliberately do
 * NOT re-implement the Google OAuth grants here — Pulse's auth model is split
 * across multiple clients, so we reuse the proven flows via navigation).
 *
 * Gmail is intentionally absent: it sits behind the default-OFF `emailEnabled`
 * flag, so leading with it would advertise a feature that isn't on. Calendar +
 * Contacts + a first capture are the genuinely-available solo inputs.
 *
 * Coral budget: reserved for the single primary CTA + focus rings. The
 * "connected" state is a neutral high-contrast check, not a colored signal, so
 * the card never exceeds the Coral-As-Signal rule.
 */

interface ActivationCardProps {
  greeting: string;
  loadingBriefing: boolean;
  onGenerate: () => void;
  onSkip: () => void;
  setView: (view: AppView, options?: { openTaskPanel?: boolean; openAddContact?: boolean }) => void;
}

const ActivationCard: React.FC<ActivationCardProps> = ({ greeting, loadingBriefing, onGenerate, onSkip, setView }) => {
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [contactsConnected, setContactsConnected] = useState(false);

  // Live connection status. Both reads fail soft to "not connected" (e.g. the
  // backend is unreachable locally), so the worst case is an honest "not yet".
  useEffect(() => {
    let alive = true;
    (async () => {
      const [cal, contacts] = await Promise.all([
        googleCalendarService.isConnected().catch(() => false),
        getContactsConnectStatus().then((s) => s.connected).catch(() => false),
      ]);
      if (!alive) return;
      setCalendarConnected(!!cal);
      setContactsConnected(!!contacts);
    })();
    return () => { alive = false; };
  }, []);

  const steps = [
    {
      key: 'calendar',
      icon: Calendar,
      label: 'Connect your calendar',
      hint: 'See today’s schedule in your briefing',
      done: calendarConnected,
      cta: calendarConnected ? 'Connected' : 'Connect',
      action: () => setView(AppView.CALENDAR),
    },
    {
      key: 'contacts',
      icon: Users,
      label: 'Import your contacts',
      hint: 'Put the people you work with in reach',
      done: contactsConnected,
      cta: contactsConnected ? 'Connected' : 'Import',
      action: () => setView(AppView.CONTACTS),
    },
    {
      key: 'task',
      icon: CheckSquare,
      label: 'Capture your first task',
      hint: 'Pulse keeps track of what needs you',
      done: false,
      cta: 'Add',
      action: () => setView(AppView.CALENDAR, { openTaskPanel: true }),
    },
  ];

  return (
    <div className="py-2 sm:py-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="pulse-label text-zinc-400 dark:text-zinc-500">GET SET UP</span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-3">
        {greeting}
      </h1>
      <p className="text-[15px] text-zinc-600 dark:text-zinc-400 mb-6 max-w-[60ch] leading-relaxed">
        Connect a source and Pulse starts working for you. Each one feeds your daily briefing.
      </p>

      <ul className="flex flex-col gap-2 mb-6 max-w-[34rem]">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.key}>
              <button
                type="button"
                onClick={step.action}
                aria-label={step.done ? `${step.label} (connected)` : step.label}
                className="group w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-zinc-300 dark:hover:border-white/20 transition-colors duration-150 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              >
                <span
                  className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 transition-colors duration-150 ${
                    step.done
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-400 dark:text-zinc-500'
                  }`}
                >
                  {step.done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{step.label}</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">{step.hint}</span>
                </span>
                <span
                  className={`flex items-center gap-1 text-xs font-medium shrink-0 ${
                    step.done ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {step.cta}
                  {!step.done && (
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onGenerate}
          disabled={loadingBriefing}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-sm font-medium transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 shadow-sm shadow-rose-500/10"
        >
          {loadingBriefing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
          {loadingBriefing ? 'Generating briefing' : 'Generate my first briefing'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors duration-150 focus-visible:outline-none focus-visible:underline"
        >
          Skip setup
        </button>
      </div>
    </div>
  );
};

export default ActivationCard;
