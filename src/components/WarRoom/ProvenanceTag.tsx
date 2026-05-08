/**
 * ProvenanceTag — Pulse's signature AI-attribution chip.
 *
 * Mono uppercase tag identifying the AI source of any generated artifact.
 * Spec: DESIGN.md §5 — "JetBrains Mono uppercase chip that prefixes any
 * AI-generated artifact... e.g. CLAUDE · SUMMARY, GEMINI · DRAFT".
 *
 * Format: rose-soft background, rose-deep text, 11px tracked 0.1em,
 * optional 8px coral dot prefix.
 */

import React from 'react';

export interface ProvenanceTagProps {
  model?: string;
  kind?: string;
  showDot?: boolean;
  className?: string;
}

export const ProvenanceTag: React.FC<ProvenanceTagProps> = ({
  model,
  kind,
  showDot = true,
  className,
}) => {
  if (!model && !kind) return null;
  return (
    <span className={`ps-provenance${className ? ` ${className}` : ''}`}>
      {showDot && <span className="ps-provenance-dot" aria-hidden />}
      {model && <span className="ps-provenance-model">{model}</span>}
      {model && kind && <span className="ps-provenance-sep" aria-hidden>·</span>}
      {kind && <span className="ps-provenance-kind">{kind}</span>}
    </span>
  );
};

export default ProvenanceTag;
