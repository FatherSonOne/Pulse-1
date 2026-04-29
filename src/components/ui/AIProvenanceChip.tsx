// AIProvenanceChip — Pulse's "AI shows its work" signature component.
//
// Every AI-generated artifact (summary, transcript, action items, smart reply)
// in Relay (and other Pulse surfaces) gets prefixed with this chip. Format is
// `VENDOR · TYPE` or `VENDOR · TYPE · DURATION`, e.g. CLAUDE · SUMMARY,
// PULSE AI · ACTION ITEMS, WHISPER · TRANSCRIPT · 2.4S.
//
// Spec source: DESIGN.md "Signature Component — The AI Provenance Tag" +
// chip-accent component tokens (JetBrains Mono 11px uppercase tracked 0.1em,
// rose-deep on accent-soft-light, 4px radius, 4×8px padding).
//
// The chip replaces the Sparkles + purple-gradient AI panel headers that the
// /impeccable critique flagged as the AI-startup template. AI artifacts here
// are auditable, attributable, and dismissible.

import React from 'react';
import { X } from 'lucide-react';

export interface AIProvenanceChipProps {
  /** Provider name in display form, e.g. 'PULSE AI', 'CLAUDE', 'WHISPER'. */
  vendor: string;
  /** Artifact type, e.g. 'SUMMARY', 'ACTION ITEMS', 'TRANSCRIPT'. Optional. */
  type?: string;
  /** Optional duration suffix, e.g. '2.4S' for a 2.4-second response. */
  duration?: string;
  /** Renders a 6px coral dot prefix when the artifact is fresh (<60s old). */
  fresh?: boolean;
  /** When provided, renders a × dismiss button after the label. */
  onDismiss?: () => void;
  /** Additional Tailwind classes appended to the root span. */
  className?: string;
}

export const AIProvenanceChip: React.FC<AIProvenanceChipProps> = ({
  vendor,
  type,
  duration,
  fresh = false,
  onDismiss,
  className = '',
}) => {
  const label = [vendor, type, duration].filter(Boolean).join(' · ');

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[11px] font-medium uppercase tracking-[0.1em] bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 ${className}`}
    >
      {fresh && (
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full bg-rose-500"
        />
      )}
      <span>{label}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Dismiss ${label}`}
          className="ml-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm hover:bg-rose-500/20 transition-colors"
        >
          <X className="w-2.5 h-2.5" strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
};

export default AIProvenanceChip;
