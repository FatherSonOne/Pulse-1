/**
 * StudioOnboarding — First-time welcome overlay for War Room.
 *
 * Shows a quick 3-step guide on first visit:
 *  1. Upload sources
 *  2. Ask questions (with /commands)
 *  3. Pin artifacts
 *
 * Persisted via localStorage so it only shows once.
 */

import React, { useState, useEffect } from 'react';
import { ArrowRight, BookOpen, FileText, MessageSquare, Pin, Sparkles, X } from 'lucide-react';

const STORAGE_KEY = 'pulse-studio-onboarded-v1';

interface StudioOnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: FileText,
    title: 'Add Your Sources',
    description: 'Upload documents, PDFs, or notes to give the AI context. Toggle which sources are active for each conversation.',
    accent: '#f43f5e',
  },
  {
    icon: MessageSquare,
    title: 'Ask Anything',
    description: 'Type naturally or use slash commands like /brainstorm, /analyze, /decide to get structured results. Try @skeptic or @scribe to switch AI personas.',
    accent: '#3b82f6',
  },
  {
    icon: Pin,
    title: 'Pin & Collect',
    description: 'The AI produces rich artifacts — tables, timelines, idea boards. Pin anything important to the Artifacts panel for later reference and export.',
    accent: '#10b981',
  },
];

export const StudioOnboarding: React.FC<StudioOnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const handleComplete = () => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
    onComplete();
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="ps-onboarding-overlay">
      <div className="ps-onboarding-card">
        {/* Close button */}
        <button className="ps-onboarding-close" onClick={handleComplete}>
          <X size={16} />
        </button>

        {/* Logo */}
        <div className="ps-onboarding-logo">
          <BookOpen size={24} />
        </div>

        <h2 className="ps-onboarding-title">Welcome to the War Room</h2>
        <p className="ps-onboarding-subtitle">Your AI-powered research workspace</p>

        {/* Step content */}
        <div className="ps-onboarding-step">
          <div className="ps-onboarding-step-icon" style={{ background: `${current.accent}15`, color: current.accent }}>
            <current.icon size={24} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: '12px 0 6px', color: 'var(--ps-text-primary)' }}>
            {current.title}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--ps-text-secondary)', lineHeight: 1.6, maxWidth: 340, margin: '0 auto' }}>
            {current.description}
          </p>
        </div>

        {/* Progress dots */}
        <div className="ps-onboarding-dots">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`ps-onboarding-dot ${i === step ? 'ps-onboarding-dot--active' : ''}`}
              style={i === step ? { background: current.accent } : undefined}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="ps-onboarding-actions">
          {step > 0 && (
            <button className="ps-onboarding-btn ps-onboarding-btn--secondary" onClick={() => setStep(s => s - 1)}>
              Back
            </button>
          )}
          {isLast ? (
            <button className="ps-onboarding-btn ps-onboarding-btn--primary" onClick={handleComplete}>
              Get Started
              <Sparkles size={14} />
            </button>
          ) : (
            <button className="ps-onboarding-btn ps-onboarding-btn--primary" onClick={() => setStep(s => s + 1)}>
              Next
              <ArrowRight size={14} />
            </button>
          )}
        </div>

        {/* Skip */}
        <button className="ps-onboarding-skip" onClick={handleComplete}>
          Skip intro
        </button>
      </div>
    </div>
  );
};

/** Check if onboarding has been completed */
export function hasCompletedOnboarding(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return true; }
}

export default StudioOnboarding;
