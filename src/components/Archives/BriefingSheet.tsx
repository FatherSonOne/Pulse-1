// src/components/Archives/BriefingSheet.tsx
// Right-side sheet that synthesizes a briefing across selected memory items.
// Trigger: filtered Memory view with 2+ items, or per-contact CTA.

import React, { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Mail, RotateCcw, Sparkles, X } from 'lucide-react';
import type { ArchiveItem } from '../../types';
import {
  buildMemoryBriefing,
  memoryBriefingToMarkdown,
  type MemoryBriefing,
} from '../../services/memoryBriefingService';
import { useArchiveStore } from '../../store/archiveStore';

interface BriefingSheetProps {
  open: boolean;
  onClose: () => void;
  items: ArchiveItem[];
  subject: string;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtShort = (d: Date) =>
  d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const BriefingSheet: React.FC<BriefingSheetProps> = ({ open, onClose, items, subject }) => {
  const [briefing, setBriefing] = useState<MemoryBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const setSelectedItem = useArchiveStore(s => s.setSelectedItem);
  const demoMode = useArchiveStore(s => s.demoMode);

  // Build briefing when sheet opens with items
  useEffect(() => {
    if (!open) return;
    if (items.length < 2) {
      setError('Need at least 2 conversations to build a briefing.');
      setBriefing(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBriefing(null);
    buildMemoryBriefing({ items, subject })
      .then(b => {
        if (!cancelled) setBriefing(b);
      })
      .catch(err => {
        if (!cancelled) setError(err?.message || 'Briefing failed.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, items, subject, retryKey]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleCopy = async () => {
    if (!briefing) return;
    try {
      await navigator.clipboard.writeText(memoryBriefingToMarkdown(briefing));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  const handleEmail = () => {
    if (!briefing) return;
    const subjectLine = encodeURIComponent(`Briefing: ${briefing.subject}`);
    const body = encodeURIComponent(memoryBriefingToMarkdown(briefing));
    window.location.href = `mailto:?subject=${subjectLine}&body=${body}`;
  };

  const openItem = (id?: string) => {
    if (!id) return;
    const item = items.find(i => i.id === id);
    if (item) {
      setSelectedItem(item);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Briefing for ${subject}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-md" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-[560px] h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-white/[0.08] shadow-2xl flex flex-col animate-slide-in-right"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'briefing-slide 280ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <style>{`@keyframes briefing-slide { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

        {/* Header */}
        <header className="px-6 pt-6 pb-5 border-b border-zinc-200 dark:border-white/[0.06]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden />
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400">
                  Pulse AI · Briefing
                </span>
              </div>
              <h2 className="text-xl font-light text-zinc-900 dark:text-zinc-50 leading-snug truncate">
                {subject}
              </h2>
              {briefing && (
                <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-500 mt-1.5 tabular-nums">
                  {briefing.sourceCount} conversation{briefing.sourceCount === 1 ? '' : 's'} · {fmtShort(briefing.rangeStart)} — {fmtShort(briefing.rangeEnd)}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition flex-shrink-0"
              aria-label="Close briefing"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full p-8 gap-3">
              <Loader2 className="w-5 h-5 text-rose-500 animate-spin" />
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
                Synthesizing memory · {items.length} sources
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{error}</p>
              {items.length >= 2 && (
                <button
                  onClick={() => setRetryKey(k => k + 1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/[0.08] hover:bg-rose-500/[0.14] border border-rose-500/30 text-[11px] font-mono uppercase tracking-[0.12em] text-rose-600 dark:text-rose-400 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retry synthesis
                </button>
              )}
            </div>
          )}

          {briefing && !loading && (
            <div className="px-6 py-5 space-y-6 max-w-prose">
              {briefing.provenance === 'skeleton' && (
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-500 px-3 py-2 bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded">
                  AI synthesis unavailable · showing source skeleton
                </div>
              )}

              {/* Last contact */}
              {briefing.lastContact && (
                <Section label="Last contact">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500 tabular-nums whitespace-nowrap">
                      {fmtShort(briefing.lastContact.date)}
                    </span>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed flex-1">
                      <button
                        onClick={() => openItem(briefing.lastContact?.itemId)}
                        className="text-left hover:text-rose-500 transition-colors"
                      >
                        {briefing.lastContact.summary}
                      </button>
                    </p>
                  </div>
                </Section>
              )}

              {/* Active threads */}
              {briefing.threads.length > 0 && (
                <Section label={`Active threads · ${briefing.threads.length}`}>
                  <ul className="space-y-2.5">
                    {briefing.threads.map((t, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mt-1 tabular-nums w-6 flex-shrink-0">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => openItem(t.latestItemId)}
                            className="text-left text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:text-rose-500 transition-colors"
                          >
                            {t.topic}
                          </button>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mt-0.5">
                            {t.state}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Decisions */}
              {briefing.decisions.length > 0 && (
                <Section label={`Decisions · ${briefing.decisions.length}`}>
                  <ul className="space-y-1.5">
                    {briefing.decisions.map((d, i) => (
                      <li key={i} className="flex items-baseline gap-2">
                        <span className="text-rose-500 mt-1.5 flex-shrink-0" aria-hidden>·</span>
                        <button
                          onClick={() => openItem(d.itemId)}
                          className="text-left text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed hover:text-rose-500 transition-colors"
                        >
                          {d.outcome}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Open questions */}
              {briefing.openQuestions.length > 0 && (
                <Section label={`Open questions · ${briefing.openQuestions.length}`}>
                  <ul className="space-y-1.5">
                    {briefing.openQuestions.map((q, i) => (
                      <li key={i} className="flex items-baseline gap-2">
                        <span className="text-zinc-400 dark:text-zinc-600 mt-1.5 flex-shrink-0" aria-hidden>?</span>
                        <span className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                          {q}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Talking points */}
              {briefing.talkingPoints.length > 0 && (
                <Section label="For the next conversation" accent>
                  <ul className="space-y-2">
                    {briefing.talkingPoints.map((p, i) => (
                      <li key={i} className="flex items-baseline gap-2.5 px-3 py-2 rounded-lg bg-rose-500/[0.05] border border-rose-500/15">
                        <Sparkles className="w-3 h-3 text-rose-500 mt-1 flex-shrink-0" />
                        <span className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">{p}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Sources */}
              {briefing.sourceItemIds.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500 hover:text-rose-500 transition-colors">
                      Sources · {briefing.sourceItemIds.length} ▸
                    </span>
                  </summary>
                  <ul className="mt-3 space-y-1">
                    {briefing.sourceItemIds.map(id => {
                      const item = items.find(i => i.id === id);
                      if (!item) return null;
                      const d = item.date instanceof Date ? item.date : new Date(item.date);
                      return (
                        <li key={id}>
                          <button
                            onClick={() => openItem(id)}
                            className="w-full flex items-baseline gap-3 py-1 text-left hover:text-rose-500 transition-colors"
                          >
                            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600 tabular-nums w-12 flex-shrink-0">
                              {fmtShort(d)}
                            </span>
                            <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate">{item.title}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {briefing && !loading && (
          <footer className="px-6 py-3 border-t border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] flex items-center justify-between gap-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
              {demoMode ? 'Demo synthesis · counted toward AI usage' : 'Esc to close'}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleEmail}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition"
              >
                <Mail className="w-3.5 h-3.5" /> Email
              </button>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-600 dark:text-rose-400 bg-rose-500/[0.08] hover:bg-rose-500/[0.14] transition"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </>
                )}
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};

const Section: React.FC<{ label: string; accent?: boolean; children: React.ReactNode }> = ({
  label,
  accent,
  children,
}) => (
  <section>
    <div
      className={`text-[10px] font-mono uppercase tracking-[0.18em] mb-3 ${
        accent ? 'text-rose-500' : 'text-zinc-500 dark:text-zinc-500'
      }`}
    >
      {label}
    </div>
    {children}
  </section>
);

export default BriefingSheet;
