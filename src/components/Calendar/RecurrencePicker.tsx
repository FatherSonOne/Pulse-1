/**
 * RecurrencePicker.tsx
 *
 * A self-contained RRULE builder UI.
 * Renders a dropdown trigger + custom panel for the event creation form.
 * Generates an RFC 5545 RRULE string when the user configures recurrence.
 *
 * Props:
 *   value    — current RRULE string (or null for "does not repeat")
 *   onChange — called with the new RRULE string (or null to clear)
 *   eventDate — the event's date (used to auto-fill BYDAY for weekly)
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, RefreshCw } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
type EndCondition = 'never' | 'until' | 'count';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_CODES  = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const FREQ_LABELS: Record<Freq, string> = {
  DAILY:   'Day',
  WEEKLY:  'Week',
  MONTHLY: 'Month',
  YEARLY:  'Year',
};

// ── Parsing ───────────────────────────────────────────────────────────────────

interface RuleState {
  freq: Freq;
  interval: number;
  endCondition: EndCondition;
  untilDate: string;   // YYYY-MM-DD
  count: number;
  byDay: string[];     // e.g. ['MO','WE','FR']
  byMonthDay?: number;
}

function rruleToState(rule: string | null, eventDate: string): RuleState {
  const defaults: RuleState = {
    freq: 'WEEKLY',
    interval: 1,
    endCondition: 'never',
    untilDate: '',
    count: 10,
    byDay: [DAY_CODES[new Date(eventDate + 'T12:00:00').getDay()] ?? 'MO'],
  };

  if (!rule) return defaults;

  const parts: Record<string, string> = {};
  rule.split(';').forEach(s => {
    const [k, v] = s.split('=');
    if (k) parts[k] = v ?? '';
  });

  const state: RuleState = { ...defaults };
  if (parts['FREQ']) state.freq = parts['FREQ'] as Freq;
  if (parts['INTERVAL']) state.interval = parseInt(parts['INTERVAL'], 10);
  if (parts['COUNT']) {
    state.count = parseInt(parts['COUNT'], 10);
    state.endCondition = 'count';
  }
  if (parts['UNTIL']) {
    const u = parts['UNTIL'];
    state.untilDate = `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`;
    state.endCondition = 'until';
  }
  if (parts['BYDAY']) state.byDay = parts['BYDAY'].split(',');
  if (parts['BYMONTHDAY']) state.byMonthDay = parseInt(parts['BYMONTHDAY'], 10);

  return state;
}

function stateToRRule(s: RuleState): string {
  const parts = [`FREQ=${s.freq}`];
  if (s.interval > 1) parts.push(`INTERVAL=${s.interval}`);
  if (s.freq === 'WEEKLY' && s.byDay.length > 0) parts.push(`BYDAY=${s.byDay.join(',')}`);
  if (s.freq === 'MONTHLY' && s.byMonthDay) parts.push(`BYMONTHDAY=${s.byMonthDay}`);
  if (s.endCondition === 'until' && s.untilDate) {
    parts.push(`UNTIL=${s.untilDate.replace(/-/g, '')}`);
  }
  if (s.endCondition === 'count') parts.push(`COUNT=${s.count}`);
  return parts.join(';');
}

// ── Label helper ──────────────────────────────────────────────────────────────

function getLabel(rule: string | null, eventDate: string): string {
  if (!rule) return 'Does not repeat';
  const s = rruleToState(rule, eventDate);
  const intervalStr = s.interval > 1 ? `Every ${s.interval} ` : '';
  switch (s.freq) {
    case 'DAILY':   return `${intervalStr}Daily`;
    case 'WEEKLY': {
      const days = s.byDay.map(d => DAY_LABELS[DAY_CODES.indexOf(d)]).join(', ');
      return `${intervalStr}Weekly on ${days}`;
    }
    case 'MONTHLY': return `${intervalStr}Monthly`;
    case 'YEARLY':  return `${intervalStr}Yearly`;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface RecurrencePickerProps {
  value: string | null;
  onChange: (rule: string | null) => void;
  eventDate: string; // YYYY-MM-DD
}

export const RecurrencePicker: React.FC<RecurrencePickerProps> = ({ value, onChange, eventDate }) => {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [state, setState] = useState<RuleState>(() => rruleToState(value, eventDate));
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Sync incoming value
  useEffect(() => {
    setState(rruleToState(value, eventDate));
  }, [value, eventDate]);

  const presets: { label: string; rule: string | null }[] = [
    { label: 'Does not repeat',  rule: null },
    { label: 'Daily',            rule: 'FREQ=DAILY' },
    { label: `Weekly on ${DAY_LABELS[new Date(eventDate + 'T12:00:00').getDay()]}`,
      rule: `FREQ=WEEKLY;BYDAY=${DAY_CODES[new Date(eventDate + 'T12:00:00').getDay()]}` },
    { label: 'Monthly',          rule: 'FREQ=MONTHLY' },
    { label: 'Yearly',           rule: 'FREQ=YEARLY' },
  ];

  function selectPreset(rule: string | null) {
    onChange(rule);
    setCustom(false);
    setOpen(false);
  }

  function applyCustom() {
    const rule = stateToRRule(state);
    onChange(rule);
    setOpen(false);
    setCustom(false);
  }

  function toggleDay(code: string) {
    setState(prev => ({
      ...prev,
      byDay: prev.byDay.includes(code)
        ? prev.byDay.filter(d => d !== code)
        : [...prev.byDay, code],
    }));
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--pulse-ink-2)] hover:border-zinc-400 dark:hover:border-zinc-600 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)]"
      >
        <span className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-zinc-400" />
          {getLabel(value, eventDate)}
        </span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Clear button when a rule is set */}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-9 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[var(--pulse-rose)] transition"
          aria-label="Clear recurrence"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 top-full mt-1 w-full z-50 rounded-xl border border-[var(--pulse-border-strong)] bg-[var(--pulse-surface)] dark:bg-[var(--pulse-surface)] shadow-xl overflow-hidden"
          style={{ minWidth: '260px' }}
        >
          {!custom ? (
            <>
              {/* Preset list */}
              {presets.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => selectPreset(p.rule)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition hover:bg-[var(--pulse-rose-softer)] ${
                    value === p.rule
                      ? 'text-[var(--pulse-rose)] font-medium bg-[var(--pulse-rose-softer)]'
                      : 'text-[var(--pulse-ink-2)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <div className="border-t border-[var(--pulse-border)]">
                <button
                  type="button"
                  onClick={() => setCustom(true)}
                  className="w-full text-left px-4 py-2.5 text-sm text-[var(--pulse-rose)] font-medium hover:bg-[var(--pulse-rose-softer)] transition"
                >
                  Custom…
                </button>
              </div>
            </>
          ) : (
            /* Custom panel */
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--pulse-ink-2)]">Custom recurrence</span>
                <button type="button" onClick={() => setCustom(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Frequency + Interval */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-500 uppercase font-bold w-16 flex-shrink-0">Every</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={state.interval}
                  onChange={e => setState(p => ({ ...p, interval: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                  className="w-16 bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border-strong)] rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:border-[var(--pulse-rose)] transition"
                />
                <select
                  value={state.freq}
                  onChange={e => setState(p => ({ ...p, freq: e.target.value as Freq }))}
                  className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border-strong)] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[var(--pulse-rose)] dark:text-zinc-300 transition"
                >
                  {(Object.keys(FREQ_LABELS) as Freq[]).map(f => (
                    <option key={f} value={f}>{FREQ_LABELS[f]}{state.interval > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>

              {/* BYDAY checkboxes (weekly only) */}
              {state.freq === 'WEEKLY' && (
                <div>
                  <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Repeat on</label>
                  <div className="flex gap-1 flex-wrap">
                    {DAY_CODES.map((code, i) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggleDay(code)}
                        className={`w-8 h-8 rounded-full text-xs font-medium transition ${
                          state.byDay.includes(code)
                            ? 'bg-[var(--pulse-rose)] text-white'
                            : 'bg-[var(--pulse-surface-raised)] dark:bg-[var(--pulse-surface-raised)] text-[var(--pulse-ink-3)] hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-[var(--pulse-surface-raised)]'
                        }`}
                      >
                        {DAY_LABELS[i][0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* End condition */}
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Ends</label>
                <div className="space-y-2">
                  {(['never', 'until', 'count'] as EndCondition[]).map(cond => (
                    <label key={cond} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="endCondition"
                        checked={state.endCondition === cond}
                        onChange={() => setState(p => ({ ...p, endCondition: cond }))}
                        className="accent-[var(--pulse-rose)]"
                      />
                      <span className="text-sm text-[var(--pulse-ink-2)] capitalize">
                        {cond === 'never' ? 'Never' : cond === 'until' ? 'On date' : 'After'}
                      </span>
                      {cond === 'until' && state.endCondition === 'until' && (
                        <input
                          type="date"
                          value={state.untilDate}
                          onChange={e => setState(p => ({ ...p, untilDate: e.target.value }))}
                          className="ml-auto bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border-strong)] rounded-lg px-2 py-1 text-sm outline-none focus:border-[var(--pulse-rose)] dark:text-zinc-300 transition"
                        />
                      )}
                      {cond === 'count' && state.endCondition === 'count' && (
                        <div className="ml-auto flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={state.count}
                            onChange={e => setState(p => ({ ...p, count: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                            className="w-16 bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border-strong)] rounded-lg px-2 py-1 text-sm text-center outline-none focus:border-[var(--pulse-rose)] transition"
                          />
                          <span className="text-xs text-zinc-400">times</span>
                        </div>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Apply */}
              <button
                type="button"
                onClick={applyCustom}
                className="w-full py-2 bg-[var(--pulse-rose)] hover:bg-[var(--pulse-rose-deep)] text-white text-sm font-semibold rounded-lg transition shadow-sm"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecurrencePicker;
