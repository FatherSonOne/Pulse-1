// ============================================
// CONTACTS ONBOARDING
// First-visit tour for the Contacts section. Shown once per user,
// dismissed state stored in localStorage. Phase D rewrite: matches
// the new IA (Today + People; Circles is now a People sidebar facet)
// and uses coral instead of sky-blue so it reads as Pulse, not a
// generic onboarding template.
// ============================================

import React, { useState } from 'react';
import { AnimatedIcon } from '../ui/AnimatedIcon';

interface OnboardingStep {
  id: string;
  title: string;
  body: string;
  icon: string;
}

const TOUR_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Contacts',
    body: 'Pulse turns your contacts into a relationship surface. Two tabs, one workflow. A 20-second tour.',
    icon: 'rocket',
  },
  {
    id: 'today',
    title: 'Today',
    body: 'A triage feed of relationship actions: who to follow up with, who has gone cold, who is worth a check-in. Start your morning here.',
    icon: 'target',
  },
  {
    id: 'people',
    title: 'People',
    body: 'Everyone you know, with relationship health and tags. Use Smart Lists for system-computed filters, Tags for your own labels, and Circles for grouped lenses, all in the sidebar.',
    icon: 'people',
  },
  {
    id: 'goals',
    title: 'Keep-in-touch goals',
    body: 'Open any contact and set a cadence. Pulse surfaces them on Today before they slip, and Autopilot drafts the message for you.',
    icon: 'gear',
  },
];

const LS_KEY = 'pulse_contacts_tour_seen_v2';

interface ContactsOnboardingProps {
  onComplete: () => void;
}

export const ContactsOnboarding: React.FC<ContactsOnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const currentStep = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      try { localStorage.setItem(LS_KEY, 'true'); } catch { /* ignore */ }
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSkip = () => {
    try { localStorage.setItem(LS_KEY, 'true'); } catch { /* ignore */ }
    onComplete();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.70)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contacts-tour-title"
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'var(--pulse-surface)',
          border: '1px solid var(--pulse-border)',
          boxShadow: 'var(--pulse-shadow-md)',
          color: 'var(--pulse-ink)',
        }}
      >
        <div className="p-6">
          {/* Segmented progress: filled coral for done, hairline rose for current, neutral for upcoming */}
          <div className="flex gap-1.5 mb-5" aria-hidden="true">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full"
                style={{
                  background:
                    i < step
                      ? 'var(--pulse-rose)'
                      : i === step
                      ? 'var(--pulse-rose-glow)'
                      : 'var(--pulse-border)',
                  transition: 'background 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            ))}
          </div>

          <div className="flex justify-center mb-4">
            <div
              className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center"
              style={{
                background: 'var(--pulse-rose-soft)',
                border: '1px solid var(--pulse-rose-soft)',
              }}
            >
              <AnimatedIcon icon={currentStep.icon} size={32} />
            </div>
          </div>

          <h3
            id="contacts-tour-title"
            className="text-lg font-semibold text-center mb-2"
            style={{ color: 'var(--pulse-ink)' }}
          >
            {currentStep.title}
          </h3>
          <p
            className="text-sm text-center leading-relaxed"
            style={{ color: 'var(--pulse-ink-2)' }}
          >
            {currentStep.body}
          </p>

          <div className="flex items-center justify-center gap-1.5 mt-5">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to step ${i + 1}`}
                onClick={() => setStep(i)}
                className="rounded-full"
                style={{
                  width: i === step ? 16 : 6,
                  height: 6,
                  background: i === step ? 'var(--pulse-rose)' : 'var(--pulse-border-strong)',
                  transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>

        <div
          className="px-6 pb-5 flex items-center justify-between"
          style={{ borderTop: '1px solid transparent' }}
        >
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs hover:underline"
            style={{ color: 'var(--pulse-ink-3)' }}
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ background: 'var(--pulse-rose)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--pulse-rose-deep)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--pulse-rose)'; }}
          >
            {isLast ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Returns true if the user hasn't seen the Phase D tour yet. We bumped
 * the localStorage key from _v1 to _v2 so anyone who saw the old
 * (Circles-bubble-chart) tour sees this updated one once.
 */
export function shouldShowContactsTour(): boolean {
  try {
    return !localStorage.getItem(LS_KEY);
  } catch {
    return false;
  }
}

export default ContactsOnboarding;
