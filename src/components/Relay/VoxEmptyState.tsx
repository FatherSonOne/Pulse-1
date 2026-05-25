// VoxEmptyState — the single empty-state pane for every Relay source.
//
// Path C "quiet" pattern (matches ClassicMode's no-selection pane and
// VoiceRooms): a flat neutral glyph in a token-surface circle, an optional
// mono uppercase eyebrow (the section signature), a light-weight title, one
// line of ink-2 prose, and at most one CTA.
//
// What this is NOT anymore (the 2.x AI-slop kit this replaces): pulsing
// concentric rings, a coral-gradient icon box, a bold title, hardcoded cold
// neutrals, and a scale-on-hover button. Coral is signal, never decoration —
// the glyph is neutral; only the action button carries the brand gradient.

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface VoxEmptyStateProps {
  /** Source/mode key (e.g. 'classic', 'vox_notes'). Carried for call-site
   *  compatibility via {...emptyConfig}; not rendered. */
  mode?: string;
  /**
   * @deprecated Ignored. The glyph is now a neutral tone (coral-as-signal:
   * an empty-state icon is decoration). Kept so existing call sites that pass
   * a per-mode color don't break; remove on the next call-site sweep.
   */
  color?: string;
  icon: LucideIcon;
  /** Optional mono uppercase eyebrow — the section name, e.g. "NOTES". */
  eyebrow?: string;
  title: string;
  description: string;
  /**
   * @deprecated Ignored. Theme is driven by --pulse-* tokens, which already
   * switch on the .dark class. Kept for call-site compatibility.
   */
  isDarkMode?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Optional tertiary hint below the CTA — typically a keyboard-shortcut
   *  reminder (e.g. "Hold space to record · ? for shortcuts"). */
  hint?: React.ReactNode;
}

export const VoxEmptyState: React.FC<VoxEmptyStateProps> = ({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  hint,
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16 min-h-[360px]">
      {/* Flat neutral glyph — no rings, no gradient. */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{ background: 'var(--pulse-surface)', border: '1px solid var(--pulse-border)' }}
      >
        <Icon className="w-8 h-8" style={{ color: 'var(--pulse-ink-3)' }} />
      </div>

      {eyebrow && (
        <p
          className="font-mono text-[10px] uppercase tracking-[0.1em] mb-2"
          style={{ color: 'var(--pulse-ink-3)' }}
        >
          {eyebrow}
        </p>
      )}

      {/* Light-weight title (300) per the Coral Cockpit display rule. */}
      <h3 className="text-lg font-light mb-1.5" style={{ color: 'var(--pulse-ink)' }}>
        {title}
      </h3>

      <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--pulse-ink-2)' }}>
        {description}
      </p>

      {action && (
        <button onClick={action.onClick} type="button" className="vox-empty-cta">
          {action.label}
        </button>
      )}

      {hint && (
        <p
          className="font-mono text-[10px] uppercase tracking-[0.1em] mt-4"
          style={{ color: 'var(--pulse-ink-3)' }}
        >
          {hint}
        </p>
      )}

      <style>{`
        .vox-empty-cta {
          margin-top: 24px;
          padding: 12px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%);
          box-shadow: 0 4px 12px rgba(244, 63, 94, 0.30);
          transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .vox-empty-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(244, 63, 94, 0.40);
        }
        .vox-empty-cta:active { transform: translateY(0); }
        @media (prefers-reduced-motion: reduce) {
          .vox-empty-cta { transition: none; }
          .vox-empty-cta:hover { transform: none; }
        }
      `}</style>
    </div>
  );
};

export default React.memo(VoxEmptyState);
