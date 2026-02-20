// ============================================
// CONTACTS ONBOARDING
// First-visit tour tooltips for Contacts Reimagined.
// Shown once per user — dismissed state stored in localStorage.
// ============================================

import React, { useState, useEffect } from 'react';

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
    icon: '🚀',
  },
  {
    id: 'today',
    title: 'Your Day',
    body: 'The Today tab shows AI-curated relationship actions — who to reach out to, follow up with, or celebrate. Check it every morning.',
    position: 'top',
    icon: '🎯',
  },
  {
    id: 'people',
    title: 'Your People',
    body: 'The People tab is your enhanced contacts list with relationship health rings, AI search, and rich profiles. Try searching "clients I haven\'t talked to in a month".',
    position: 'top',
    icon: '🧑‍🤝‍🧑',
  },
  {
    id: 'circles',
    title: 'Your Network',
    body: 'The Circles tab shows your network as interactive bubbles. Let AI group your contacts automatically, or create your own circles.',
    position: 'top',
    icon: '🗺️',
  },
  {
    id: 'goals',
    title: 'Set Keep-in-Touch Goals',
    body: 'Open any contact and set a relationship goal. Enable Autopilot and AI will draft messages for you when it\'s time to reach out.',
    position: 'center',
    icon: '🤖',
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6">
          {/* Step icon */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-3xl shadow-sm">
              {currentStep.icon}
            </div>
          </div>

          {/* Content */}
          <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 text-center mb-2">
            {currentStep.title}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center leading-relaxed">
            {currentStep.body}
          </p>

          {/* Dots */}
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all ${
                  i === step
                    ? 'w-4 h-1.5 bg-indigo-500'
                    : 'w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            Skip tour
          </button>
          <button
            onClick={handleNext}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
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
