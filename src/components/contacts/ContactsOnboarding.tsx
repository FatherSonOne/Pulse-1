// ============================================
// CONTACTS ONBOARDING
// First-visit tour tooltips for Contacts Reimagined.
// Shown once per user — dismissed state stored in localStorage.
// ============================================

import React, { useState, useEffect } from 'react';
import { AnimatedIcon } from '../ui/AnimatedIcon';

// ==================== TYPES ====================

interface OnboardingStep {
  id: string;
  title: string;
  body: string;
  targetId?: string;     // CSS id to highlight (optional)
  position: 'center' | 'top' | 'bottom';
  icon: string;
}

// ==================== TOUR STEPS ====================

const TOUR_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Contacts Reimagined',
    body: 'Your contacts section is now a People Intelligence system. Let\'s take a 30-second tour.',
    position: 'center',
    icon: 'rocket',
  },
  {
    id: 'today',
    title: 'Your Day',
    body: 'The Today tab shows AI-curated relationship actions — who to reach out to, follow up with, or celebrate. Check it every morning.',
    position: 'top',
    icon: 'target',
  },
  {
    id: 'people',
    title: 'Your People',
    body: 'The People tab is your enhanced contacts list with relationship health rings, AI search, and rich profiles. Try searching "clients I haven\'t talked to in a month".',
    position: 'top',
    icon: 'people',
  },
  {
    id: 'circles',
    title: 'Your Network',
    body: 'The Circles tab shows your network as interactive bubbles. Let AI group your contacts automatically, or create your own circles.',
    position: 'top',
    icon: 'globe',
  },
  {
    id: 'goals',
    title: 'Set Keep-in-Touch Goals',
    body: 'Open any contact and set a relationship goal. Enable Autopilot and AI will draft messages for you when it\'s time to reach out.',
    position: 'center',
    icon: 'gear',
  },
];

const LS_KEY = 'pulse_contacts_tour_seen_v1';

// ==================== COMPONENT ====================

interface ContactsOnboardingProps {
  onComplete: () => void;
}

export const ContactsOnboarding: React.FC<ContactsOnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const currentStep = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      localStorage.setItem(LS_KEY, 'true');
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  }

  function handleSkip() {
    localStorage.setItem(LS_KEY, 'true');
    onComplete();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="w-full max-w-sm bg-white/90 dark:bg-zinc-900/85 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.07] shadow-2xl shadow-black/20 dark:shadow-black/50 rounded-2xl overflow-hidden animate-perm-enter">

        {/* Sky-500 accent strip (Contacts accent color) */}
        <div className="h-1 w-full bg-gradient-to-r from-sky-500 to-blue-600" />

        <div className="p-6">
          {/* Segmented progress dots */}
          <div className="flex gap-1.5 mb-5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i < step
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500'
                    : i === step
                    ? 'bg-sky-400 animate-pulse'
                    : 'bg-zinc-200 dark:bg-zinc-700/60'
                }`}
              />
            ))}
          </div>

          {/* Step icon — 72×72 sky accent */}
          <div className="flex justify-center mb-4">
            <div className="w-[72px] h-[72px] rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
              <AnimatedIcon icon={currentStep.icon} size={32} />
            </div>
          </div>

          {/* Content */}
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white text-center mb-2">
            {currentStep.title}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center leading-relaxed">
            {currentStep.body}
          </p>

          {/* Dot nav */}
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to step ${i + 1}`}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all ${
                  i === step
                    ? 'w-4 h-1.5 bg-sky-500'
                    : 'w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:brightness-110 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all duration-150 shadow-md"
          >
            {isLast ? 'Get started' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Returns true if the user hasn't seen the tour yet.
 */
export function shouldShowContactsTour(): boolean {
  try {
    return !localStorage.getItem(LS_KEY);
  } catch {
    return false;
  }
}

export default ContactsOnboarding;
