import React from 'react';

import { ArrowLeft, ExternalLink } from 'lucide-react';

interface AboutProps {
  onBack?: () => void;
}

// Minimal public "About Pulse" page. Pulse-focused only — the company story lives
// at qntmecos.com. Mirrors the PrivacyPolicy / TermsOfService shell (header, card,
// footer, dark-mode parity) so the public pages feel like one set. Reached at
// /about (see App.tsx) and linked from the landing + legal-page footers.
const About: React.FC<AboutProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <ArrowLeft className="text-zinc-500" />
              </button>
            )}
            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0f172a] flex items-center justify-center">
                <svg viewBox="0 0 64 64" className="w-6 h-6">
                  <defs>
                    <linearGradient id="pulse-grad-about" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f43f5e"/>
                      <stop offset="100%" stopColor="#ec4899"/>
                    </linearGradient>
                  </defs>
                  <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#pulse-grad-about)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">Pulse</span>
            </a>
          </div>
          <a
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
          >
            Back to App
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 md:p-12 shadow-sm">
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-2">
            About Pulse
          </h1>
          <p className="text-zinc-500 mb-8">One surface. Every signal.</p>

          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">What Pulse is</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                Pulse is one screen for every work conversation: messaging, voice (Relay), async video (Glimpse),
                calendar, contacts, and decisions &mdash; plus email and Slack as opt-in connectors. Instead of
                juggling a dozen tabs, you get a single workspace where every message, meeting, task, and contact
                is searchable from one place.
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                One cross-surface AI reads across all of it &mdash; summarizing threads, drafting replies,
                transcribing voice, and extracting tasks &mdash; and it labels every word it writes
                (for example, <span className="font-mono text-sm">CLAUDE &middot; SUMMARY</span>) so you always
                know what's yours and what the AI produced.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">Who it's for</h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                Pulse is built for the overloaded solo operator &mdash; and the team they pull in. If your day is
                scattered across email, chat, voice notes, a calendar, and a half-used CRM, Pulse pulls those
                channels onto one surface so nothing slips and you spend less time switching tools.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">What makes it different</h2>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2">
                <li><strong>Unified, not bolted-on:</strong> voice, video, and text live on the same surface, not in separate apps.</li>
                <li><strong>AI you can trust:</strong> every AI-written line is labeled, and your content is never used to train AI models.</li>
                <li><strong>Voice-first Relay:</strong> voice messaging treated as a first-class channel, with transcription on every message.</li>
                <li><strong>Everywhere you work:</strong> a real web app, Windows desktop app, and Android app &mdash; your data syncs across them.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">Who builds Pulse</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                Pulse is built by Quantum Ecosystems LLC (QntmEcos). We're a small, independent team building
                practical tools for people who do a lot with a little.
              </p>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-6 space-y-1">
                <p className="text-zinc-700 dark:text-zinc-300 font-medium">Quantum Ecosystems LLC</p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Web:{' '}
                  <a href="https://qntmecos.com" target="_blank" rel="noopener noreferrer" className="text-rose-500 hover:text-rose-600 underline inline-flex items-center gap-1">
                    qntmecos.com <ExternalLink className="text-[10px]" />
                  </a>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Source:{' '}
                  <a href="https://github.com/FatherSonOne/Pulse-1" target="_blank" rel="noopener noreferrer" className="text-rose-500 hover:text-rose-600 underline inline-flex items-center gap-1">
                    github.com/FatherSonOne/Pulse-1 <ExternalLink className="text-[10px]" />
                  </a>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Contact:{' '}
                  <a href="mailto:fm1@qntmecos.com" className="text-rose-500 hover:text-rose-600 underline">fm1@qntmecos.com</a>
                </p>
                <p className="text-zinc-500 text-sm pt-1">Pulse Version 25.1.3</p>
              </div>
            </section>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-4 text-sm text-zinc-500">
            <a href="/" className="hover:text-rose-500 transition">Home</a>
            <span>|</span>
            <a href="/privacy" className="hover:text-rose-500 transition">Privacy Policy</a>
            <span>|</span>
            <a href="/terms" className="hover:text-rose-500 transition">Terms of Service</a>
            <span>|</span>
            <a href="mailto:fm1@qntmecos.com" className="hover:text-rose-500 transition">Contact</a>
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} Quantum Ecosystems LLC. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
};

export default About;
