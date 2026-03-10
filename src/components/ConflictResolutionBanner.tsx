import React, { useState } from 'react';
import { CalendarEvent } from '../types';

import { AlertTriangle, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventConflict {
  id: string;                   // unique conflict ID (used as key)
  eventA: CalendarEvent;        // event from provider A
  eventB: CalendarEvent;        // event from provider B (the "duplicate")
  similarity: number;           // 0–100 confidence score
}

interface ConflictResolutionBannerProps {
  conflicts: EventConflict[];
  /** User chose to keep A, delete B */
  onKeepA: (conflict: EventConflict) => void;
  /** User chose to keep B, delete A */
  onKeepB: (conflict: EventConflict) => void;
  /** User dismissed the conflict (keep both, don't ask again) */
  onDismiss: (conflict: EventConflict) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sourceLabel(event: CalendarEvent): string {
  if (event.source === 'google')  return 'Google';
  if (event.source === 'outlook') return 'Outlook';
  return 'Local';
}

function sourceIcon(event: CalendarEvent): string {
  if (event.source === 'google')  return 'fa-brands fa-google';
  if (event.source === 'outlook') return 'fa-brands fa-microsoft';
  return 'fa-solid fa-calendar';
}

function sourceColor(event: CalendarEvent): string {
  if (event.source === 'google')  return 'text-red-500';
  if (event.source === 'outlook') return 'text-blue-500';
  return 'text-zinc-500';
}

function formatRange(ev: CalendarEvent): string {
  if (ev.allDay) return 'All day';
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${fmt(ev.start)} – ${fmt(ev.end)}`;
}

// ─── Single conflict card ─────────────────────────────────────────────────────

const ConflictCard: React.FC<{
  conflict: EventConflict;
  onKeepA: () => void;
  onKeepB: () => void;
  onDismiss: () => void;
}> = ({ conflict, onKeepA, onKeepB, onDismiss }) => {
  const { eventA, eventB, similarity } = conflict;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-sm">
      {/* Warning icon */}
      <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
        <AlertTriangle className="text-amber-500 text-xs" />
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-900 dark:text-amber-200 truncate">
          Possible duplicate: &ldquo;{eventA.title}&rdquo;
        </p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <i className={`${sourceIcon(eventA)} ${sourceColor(eventA)} text-[10px]`} aria-hidden="true" />
            {sourceLabel(eventA)} · {formatRange(eventA)}
          </span>
          <span className="text-zinc-300 dark:text-zinc-600 text-xs">vs</span>
          <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <i className={`${sourceIcon(eventB)} ${sourceColor(eventB)} text-[10px]`} aria-hidden="true" />
            {sourceLabel(eventB)} · {formatRange(eventB)}
          </span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {similarity}% match
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onKeepA}
          aria-label={`Keep ${sourceLabel(eventA)} version`}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
        >
          Keep <span className={sourceColor(eventA)}>{sourceLabel(eventA)}</span>
        </button>
        <button
          onClick={onKeepB}
          aria-label={`Keep ${sourceLabel(eventB)} version`}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
        >
          Keep <span className={sourceColor(eventB)}>{sourceLabel(eventB)}</span>
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss — keep both"
          title="Keep both events"
          className="w-6 h-6 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="text-xs" />
        </button>
      </div>
    </div>
  );
};

// ─── Banner (shows first conflict + count) ────────────────────────────────────

const ConflictResolutionBanner: React.FC<ConflictResolutionBannerProps> = ({
  conflicts,
  onKeepA,
  onKeepB,
  onDismiss,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (conflicts.length === 0) return null;

  const visible = expanded ? conflicts : conflicts.slice(0, 1);

  return (
    <div
      className="px-3 py-2 space-y-2 border-b border-amber-100 dark:border-amber-900/30"
      role="region"
      aria-label="Calendar sync conflicts"
    >
      {visible.map(conflict => (
        <ConflictCard
          key={conflict.id}
          conflict={conflict}
          onKeepA={() => onKeepA(conflict)}
          onKeepB={() => onKeepB(conflict)}
          onDismiss={() => onDismiss(conflict)}
        />
      ))}

      {conflicts.length > 1 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-amber-600 dark:text-amber-400 hover:underline pl-1"
        >
          {expanded
            ? 'Show fewer'
            : `+${conflicts.length - 1} more duplicate${conflicts.length - 1 > 1 ? 's' : ''} detected`}
        </button>
      )}
    </div>
  );
};

export default ConflictResolutionBanner;

// ─── Detection utility (pure function, used by Calendar.tsx) ─────────────────

/**
 * Compare two event titles normalised (lowercase, punctuation stripped).
 * Returns similarity ratio 0–100.
 */
export function titleSimilarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return 100;
  if (!na || !nb) return 0;

  // Token overlap (Jaccard)
  const ta = new Set(na.split(/\s+/));
  const tb = new Set(nb.split(/\s+/));
  const intersection = [...ta].filter(w => tb.has(w)).length;
  const union = new Set([...ta, ...tb]).size;
  return Math.round((intersection / union) * 100);
}

/** Returns true if two events overlap in time (≥50% of shorter event duration). */
export function eventsOverlap(a: CalendarEvent, b: CalendarEvent): boolean {
  const overlapStart = Math.max(a.start.getTime(), b.start.getTime());
  const overlapEnd   = Math.min(a.end.getTime(),   b.end.getTime());
  if (overlapEnd <= overlapStart) return false;

  const overlapMs = overlapEnd - overlapStart;
  const durationA = a.end.getTime() - a.start.getTime();
  const durationB = b.end.getTime() - b.start.getTime();
  const shorter = Math.min(durationA, durationB);
  // At least 50% of the shorter event must overlap
  return overlapMs >= shorter * 0.5;
}

/**
 * Detect cross-provider duplicate events.
 * Returns a deduplicated list of EventConflict objects.
 * Ignores events from the same source.
 */
export function detectConflicts(events: CalendarEvent[]): EventConflict[] {
  const conflicts: EventConflict[] = [];
  const seen = new Set<string>(); // prevent A-B + B-A duplicates

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];

      // Only flag cross-provider conflicts
      if (!a.source || !b.source || a.source === b.source) continue;

      const sim = titleSimilarity(a.title, b.title);
      if (sim < 70) continue;                    // titles must be ≥70% similar
      if (!eventsOverlap(a, b)) continue;        // must overlap in time

      const key = [a.id, b.id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);

      conflicts.push({
        id: key,
        eventA: a,
        eventB: b,
        similarity: sim,
      });
    }
  }

  return conflicts;
}
