// src/components/ToolsMenuV2/AiChip.tsx
// PR 3b — Surface 3 · AI provenance chip primitive.
//
// Visual signal that the adjacent content is AI-generated. Used in
// EXACTLY four places across the whole redesign:
//   1. Summary tile (in the tile grid)
//   2. Insights tile (in the tile grid)
//   3. Summary output card (top-right)
//   4. Insights output card (top-right)
//
// Reviewer rejects any additional usage. Coral budget is locked.

import React from 'react';
import { Sparkles } from 'lucide-react';
import './ai-chip.css';

export interface AiChipProps {
  /** Slim "dim" variant for the 10-49 message disabled Summary tile. */
  dim?: boolean;
  /**
   * When true, the chip is purely decorative and is hidden from screen
   * readers (the parent's aria-label already carries "AI generated").
   * When false, the chip self-announces.
   */
  decorative?: boolean;
  /** Optional className passthrough — used for absolute-positioning the
   * card variants. */
  className?: string;
}

export const AiChip: React.FC<AiChipProps> = ({
  dim = false,
  decorative = true,
  className,
}) => {
  const cls = [
    'pulse-ai-chip',
    dim ? 'pulse-ai-chip--dim' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span
      className={cls}
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : 'AI generated'}
    >
      <Sparkles size={10} aria-hidden="true" />
      <span>AI</span>
    </span>
  );
};

export default AiChip;
