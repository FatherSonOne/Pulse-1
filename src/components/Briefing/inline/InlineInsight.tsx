/**
 * Inline insight surfaces — shared across Contact list rows, Contact detail,
 * Conversation header, and Channel header. Three variants:
 *
 *   <BriefingChip />   — compact pill for list rows (state transition signal).
 *   <BriefingBanner /> — single-line banner for thread/conversation headers.
 *   <BriefingStrip />  — channel-header data strip with reply velocity.
 *
 * All consume the same `tone` vocabulary as the Briefing surface; nothing
 * here defines its own colors. Threshold gating (≥ confidence 0.6) lives at
 * the call site.
 */

import React from 'react';
import './InlineInsight.css';

export type InsightTone = 'positive' | 'warning' | 'overdue' | 'info' | 'neutral';

interface BriefingChipProps {
  tone: InsightTone;
  /** Short uppercase label, e.g. "GONE QUIET", "REPLYING FAST". */
  label: string;
  title?: string;
}

export const BriefingChip: React.FC<BriefingChipProps> = ({ tone, label, title }) => (
  <span
    className={`pulse-insight-chip pulse-insight-tone-${tone}`}
    title={title}
    role="status"
  >
    {label}
  </span>
);

interface BriefingDotProps {
  tone: InsightTone;
  title?: string;
}

export const BriefingDot: React.FC<BriefingDotProps> = ({ tone, title }) => (
  <span
    className={`pulse-insight-dot pulse-insight-tone-${tone}`}
    title={title}
    aria-label={title}
  />
);

interface BriefingBannerProps {
  tone: InsightTone;
  /** A single sentence. Capped at 65ch by the surface. */
  text: string;
  onDismiss?: () => void;
  onOpen?: () => void;
}

export const BriefingBanner: React.FC<BriefingBannerProps> = ({
  tone,
  text,
  onDismiss,
  onOpen,
}) => (
  <div className={`pulse-insight-banner pulse-insight-tone-${tone}`}>
    <span className="pulse-insight-banner-text">{text}</span>
    <span className="pulse-insight-banner-actions">
      {onOpen && (
        <button
          type="button"
          className="pulse-insight-banner-link"
          onClick={onOpen}
        >
          Open
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          className="pulse-insight-banner-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </span>
  </div>
);

interface BriefingStripField {
  /** Mono uppercase label, e.g. "AVG REPLY". */
  label: string;
  /** Value, e.g. "14m" or "3 in queue". */
  value: string;
  /** Optional tone for the value text. */
  tone?: InsightTone;
}

interface BriefingStripProps {
  channelName: string;
  fields: BriefingStripField[];
}

export const BriefingStrip: React.FC<BriefingStripProps> = ({ channelName, fields }) => (
  <div className="pulse-insight-strip">
    <span className="pulse-insight-strip-channel">{channelName}</span>
    <ul className="pulse-insight-strip-fields" role="list">
      {fields.map((f, i) => (
        <li key={i} className="pulse-insight-strip-field">
          <span className="pulse-insight-strip-label">{f.label}</span>
          <span
            className={`pulse-insight-strip-value${f.tone ? ` pulse-insight-tone-${f.tone}` : ''}`}
          >
            {f.value}
          </span>
        </li>
      ))}
    </ul>
  </div>
);
