/**
 * CalendarTodayView.tsx — "Path D" hybrid day view.
 *
 * A single day rendered three ways, sharing one constant intelligence rail:
 *   • Agenda   — time-ordered spine (what's actually happening)
 *   • Timeline — vertical hour rail with duration-proportional blocks, visible
 *                overlaps, focus blocks as open canvas, travel gaps
 *   • Split    — agenda + timeline side by side (the "dual" view)
 *
 * The AI rail (conflicts / travel buffers / focus / suggested fix) is
 * view-agnostic, so it never moves. Selecting an event in any pane
 * cross-highlights it everywhere and loads it into the rail.
 *
 * Color discipline: category color is a quiet accent (tick / dot), never a
 * saturated pill fill — the month grid's rainbow is the thing we're fixing.
 * Rose/coral is reserved for the AI rail and today's emphasis.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { CalendarEvent } from '../../types';
import { getEventTypeMeta } from '../../services/customEventTypesService';
import { getTravelBuffersForEvents, type TravelBuffer } from '../../services/travelBufferService';
import type { ConflictResolution, FocusTimeBlock } from '../../services/calendarAIService';
import {
  Calendar, MapPin, Users, Car, AlertTriangle, Sparkles,
  Plus, Brain, ChevronRight, List, LayoutGrid, Columns,
} from 'lucide-react';

type SubView = 'agenda' | 'timeline' | 'split';

interface CalendarTodayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  conflicts?: ConflictResolution[];
  focusBlocks?: FocusTimeBlock[];
  /** True once the AI analyses have run at least once (rail emptiness is meaningful). */
  aiReady?: boolean;
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  onFocusDateChange: (date: Date) => void;
  /** Opens the full AI assistant panel — where real reschedule/auto-arrange lives. */
  onOpenAIPanel?: () => void;
}

// ── date / time helpers ─────────────────────────────────────────────────────
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DOW3 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const startOfDay = (d: Date): Date => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmtTime = (d: Date): string => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const minsOfDay = (d: Date): number => d.getHours() * 60 + d.getMinutes();
/** "14:30" / "2:30 PM" → minutes from midnight. */
const parseClock = (t: string): number => {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  if (m[3]) { h = h % 12; if (/pm/i.test(m[3])) h += 12; }
  return h * 60 + parseInt(m[2], 10);
};
const asDate = (v: Date | string): Date => (v instanceof Date ? v : new Date(v));

// ── shared event chip styling ───────────────────────────────────────────────
function typeColor(ev: CalendarEvent): string { return getEventTypeMeta(ev.type).color; }

/* ════════════════════════════════════════════════════════════════════════
   WEEK STRIP — scrub the focus day; the month becomes a strip, not the event
   ════════════════════════════════════════════════════════════════════════ */
const WeekStrip: React.FC<{ focusDate: Date; events: CalendarEvent[]; onPick: (d: Date) => void }> = ({ focusDate, events, onPick }) => {
  const today = new Date();
  const week = useMemo(() => {
    const start = startOfDay(focusDate); start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [focusDate]);
  return (
    <div className="px-4 pt-3 shrink-0">
      <div className="grid grid-cols-7 gap-1.5">
        {week.map((d, i) => {
          const isToday = isSameDay(d, today);
          const isFocus = isSameDay(d, focusDate);
          const count = events.filter(e => isSameDay(asDate(e.start), d)).length;
          return (
            <button
              key={i}
              onClick={() => onPick(d)}
              className="rounded-lg border px-2 py-1.5 text-center transition hover:bg-zinc-50 dark:hover:bg-white/[0.04]"
              style={{
                borderColor: isFocus ? 'rgb(244 63 94)' : 'var(--pulse-border, rgba(0,0,0,0.08))',
                background: isFocus ? 'rgba(244,63,94,0.06)' : 'transparent',
              }}
            >
              <div className={`font-mono text-[9px] tracking-[0.12em] ${isToday ? 'text-rose-500' : 'text-zinc-500 dark:text-zinc-400'}`}>{DOW3[d.getDay()]}</div>
              <div className={`text-[15px] mt-0.5 ${isFocus ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-zinc-900 dark:text-white'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{d.getDate()}</div>
              <div className="flex items-center justify-center gap-0.5 mt-1 h-1.5">
                {Array.from({ length: Math.min(count, 4) }).map((_, k) => <span key={k} className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500" />)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   AGENDA SPINE — single-day, time-ordered. Category color = a left tick.
   ════════════════════════════════════════════════════════════════════════ */
const AgendaSpine: React.FC<{
  events: CalendarEvent[];
  buffers: Map<string, TravelBuffer>;
  conflictIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  dense?: boolean;
}> = ({ events, buffers, conflictIds, selectedId, onSelect, dense }) => {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-center mb-4">
          <Calendar className="w-7 h-7 text-zinc-400" strokeWidth={1.5} />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing scheduled.</p>
      </div>
    );
  }
  return (
    <div className="relative pl-[64px]">
      <div className="absolute left-[54px] top-1 bottom-1 w-px bg-zinc-200 dark:bg-zinc-800" />
      {events.map(ev => {
        const meta = getEventTypeMeta(ev.type);
        const buf = buffers.get(ev.id);
        const conflict = conflictIds.has(ev.id);
        const active = selectedId === ev.id;
        return (
          <div key={ev.id} className="relative mb-2">
            <div className="absolute -left-[64px] top-2 w-[48px] text-right font-mono text-[11px] text-zinc-500 dark:text-zinc-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {ev.allDay ? 'all' : fmtTime(asDate(ev.start))}
            </div>
            <div className="absolute -left-[13px] top-2.5 w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-zinc-950" style={{ borderColor: meta.color }} />
            <button
              onClick={() => onSelect(active ? null : ev.id)}
              className="w-full text-left rounded-xl border p-2.5 transition"
              style={{
                borderColor: conflict ? 'rgb(239 68 68)' : (active ? 'rgb(244 63 94)' : 'var(--pulse-border, rgba(0,0,0,0.08))'),
                background: active ? 'rgba(244,63,94,0.06)' : 'var(--pulse-surface, #fff)',
                boxShadow: active ? '0 0 0 1px rgb(244 63 94)' : 'none',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-1 self-stretch rounded" style={{ background: meta.color, minHeight: 16 }} />
                <i className={`fa-solid ${meta.icon} text-[11px]`} style={{ color: meta.color }} />
                <span className="text-[13px] font-medium text-zinc-900 dark:text-white truncate">{ev.title}</span>
                {!dense && !ev.allDay && (
                  <span className="ml-auto font-mono text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {fmtTime(asDate(ev.start))}–{fmtTime(asDate(ev.end))}
                  </span>
                )}
              </div>
              {(ev.location || (ev.attendees && ev.attendees.length > 0) || buf || conflict) && (
                <div className="flex items-center gap-2.5 mt-1.5 pl-3 text-[11px] text-zinc-500 dark:text-zinc-400 flex-wrap">
                  {ev.attendees && ev.attendees.length > 0 && (
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{ev.attendees.length}</span>
                  )}
                  {ev.location && !dense && (
                    <span className="flex items-center gap-1 truncate max-w-[180px]"><MapPin className="w-3 h-3" />{ev.location}</span>
                  )}
                  {buf && (
                    <span className={`flex items-center gap-1 ${buf.isTight ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}`}>
                      <Car className="w-3 h-3" />{buf.travelLabel}{buf.isTight ? ' · tight' : ''}
                    </span>
                  )}
                  {conflict && (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium"><AlertTriangle className="w-3 h-3" />conflict</span>
                  )}
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   DAY TIMELINE — vertical hour rail. Duration-proportional blocks, overlap
   columns (so a double-book is undeniable), focus blocks as open canvas,
   travel gaps as hatched fills.
   ════════════════════════════════════════════════════════════════════════ */
const DayTimeline: React.FC<{
  focusDate: Date;
  events: CalendarEvent[];
  buffers: Map<string, TravelBuffer>;
  focusBlocks: FocusTimeBlock[];
  conflictIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  dense?: boolean;
}> = ({ focusDate, events, buffers, focusBlocks, conflictIds, selectedId, onSelect, dense }) => {
  const HOUR_H = dense ? 50 : 62;
  const timed = events.filter(e => !e.allDay).sort((a, b) => asDate(a.start).getTime() - asDate(b.start).getTime());
  const allDay = events.filter(e => e.allDay);

  // Dynamic window: an hour of padding around the day's events, clamped & sane.
  const { startH, endH } = useMemo(() => {
    if (timed.length === 0) return { startH: 8, endH: 18 };
    let lo = 24, hi = 0;
    timed.forEach(e => { lo = Math.min(lo, asDate(e.start).getHours()); hi = Math.max(hi, asDate(e.end).getHours() + (asDate(e.end).getMinutes() > 0 ? 1 : 0)); });
    focusBlocks.forEach(b => { lo = Math.min(lo, Math.floor(parseClock(b.startTime) / 60)); hi = Math.max(hi, Math.ceil(parseClock(b.endTime) / 60)); });
    return { startH: Math.max(0, Math.min(lo - 1, 8)), endH: Math.min(24, Math.max(hi + 1, 18)) };
  }, [timed, focusBlocks]);

  const winTop = startH * 60;
  const pxPerMin = HOUR_H / 60;
  const topOf = (mins: number) => (mins - winTop) * pxPerMin;
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);

  // Overlap clustering → column packing (general, not hardcoded).
  const layout = useMemo(() => {
    const out = new Map<string, { col: number; cols: number }>();
    let cluster: CalendarEvent[] = [];
    let clusterEnd = -Infinity;
    const flush = () => {
      if (cluster.length === 0) return;
      const colEnds: number[] = [];
      const assign = new Map<string, number>();
      cluster.forEach(ev => {
        const s = asDate(ev.start).getTime(), e = asDate(ev.end).getTime();
        let c = 0; while (c < colEnds.length && colEnds[c] > s) c++;
        colEnds[c] = e; assign.set(ev.id, c);
      });
      const cols = colEnds.length;
      cluster.forEach(ev => out.set(ev.id, { col: assign.get(ev.id)!, cols }));
      cluster = []; clusterEnd = -Infinity;
    };
    timed.forEach(ev => {
      const s = asDate(ev.start).getTime(), e = asDate(ev.end).getTime();
      if (s >= clusterEnd && cluster.length > 0) flush();
      cluster.push(ev); clusterEnd = Math.max(clusterEnd, e);
    });
    flush();
    return out;
  }, [timed]);

  const today = new Date();
  const showNow = isSameDay(focusDate, today);
  const nowMins = minsOfDay(today);

  return (
    <div className="h-full overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm flex items-center gap-2">
        <span className="text-[13px] font-semibold text-zinc-900 dark:text-white">
          {WEEKDAYS[focusDate.getDay()]}, {MONTHS[focusDate.getMonth()]} {focusDate.getDate()}
        </span>
        {conflictIds.size > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3 h-3" />{conflictIds.size / 2 >= 1 ? `${Math.ceil(conflictIds.size / 2)} conflict${conflictIds.size > 2 ? 's' : ''}` : 'conflict'}
          </span>
        )}
      </div>

      {/* all-day chips */}
      {allDay.length > 0 && (
        <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-900 flex flex-wrap gap-1.5">
          {allDay.map(ev => {
            const meta = getEventTypeMeta(ev.type);
            const active = selectedId === ev.id;
            return (
              <button key={ev.id} onClick={() => onSelect(active ? null : ev.id)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition"
                style={{ borderColor: active ? 'rgb(244 63 94)' : 'var(--pulse-border, rgba(0,0,0,0.08))', background: active ? 'rgba(244,63,94,0.06)' : 'transparent' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                <span className="text-zinc-700 dark:text-zinc-200 truncate max-w-[140px]">{ev.title}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="relative">
        <div className="relative ml-[52px] mr-2" style={{ height: (endH - startH) * HOUR_H + 16 }}>
          {/* hour grid + labels */}
          {hours.map((h, i) => (
            <React.Fragment key={h}>
              <div className="absolute left-0 right-0 border-t border-zinc-100 dark:border-zinc-900" style={{ top: i * HOUR_H }} />
              <div className="absolute -left-[48px] -translate-y-1.5 font-mono text-[10px] text-zinc-400" style={{ top: i * HOUR_H, fontVariantNumeric: 'tabular-nums' }}>
                {((h + 11) % 12) + 1}{h < 12 ? 'a' : 'p'}
              </div>
            </React.Fragment>
          ))}

          {/* focus blocks — open canvas */}
          {focusBlocks.map(fb => {
            const top = topOf(parseClock(fb.startTime));
            const h = Math.max(topOf(parseClock(fb.endTime)) - top, 18);
            if (h <= 0) return null;
            return (
              <div key={fb.id} className="absolute left-0 right-2 rounded-lg flex flex-col justify-center px-3 pointer-events-none"
                style={{ top, height: h, border: '1.5px dashed #8b5cf6', background: 'rgba(139,92,246,0.07)' }}>
                <div className="flex items-center gap-1.5"><Brain className="w-3.5 h-3.5 text-violet-500" /><span className="text-[12px] font-medium text-zinc-800 dark:text-zinc-100">{fb.suggested ? 'Suggested focus' : 'Focus'}</span></div>
                {!dense && <span className="text-[10px] text-zinc-500">Open canvas · {fb.protected ? 'protected' : 'available'}</span>}
              </div>
            );
          })}

          {/* travel-buffer gaps */}
          {timed.map(ev => {
            const buf = buffers.get(ev.id);
            if (!buf) return null;
            const fromEnd = asDate(ev.end);
            const next = timed.find(e => e.id === buf.toEventId);
            if (!next) return null;
            const top = topOf(minsOfDay(fromEnd));
            const h = topOf(minsOfDay(asDate(next.start))) - top;
            if (h < 8) return null;
            return (
              <div key={`buf-${ev.id}`} className="absolute left-0 right-2 rounded-md flex items-center justify-center"
                style={{ top, height: h, backgroundImage: 'repeating-linear-gradient(135deg, var(--pulse-border, rgba(0,0,0,0.08)) 0 5px, transparent 5px 10px)' }}>
                <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 rounded ${buf.isTight ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>
                  <Car className="w-3 h-3" />{buf.travelLabel}
                </span>
              </div>
            );
          })}

          {/* now line */}
          {showNow && nowMins >= winTop && nowMins <= endH * 60 && (
            <div className="absolute left-0 right-2 z-20 pointer-events-none" style={{ top: topOf(nowMins) }}>
              <div className="h-px bg-rose-500" /><div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-rose-500" />
            </div>
          )}

          {/* event blocks */}
          {timed.map(ev => {
            const meta = getEventTypeMeta(ev.type);
            const s = minsOfDay(asDate(ev.start)), e = minsOfDay(asDate(ev.end));
            const top = topOf(s);
            const h = Math.max((e - s) * pxPerMin, 22);
            const lay = layout.get(ev.id) || { col: 0, cols: 1 };
            const gap = 4;
            const widthPct = 100 / lay.cols;
            const conflict = conflictIds.has(ev.id);
            const active = selectedId === ev.id;
            return (
              <button key={ev.id} onClick={() => onSelect(active ? null : ev.id)}
                className="absolute rounded-lg px-2 py-1 text-left overflow-hidden transition"
                style={{
                  top, height: h,
                  left: `calc(${lay.col * widthPct}% )`,
                  width: `calc(${widthPct}% - ${gap}px)`,
                  background: 'var(--pulse-surface, #fff)',
                  border: `1px solid ${active ? 'rgb(244 63 94)' : (conflict ? 'rgb(239 68 68)' : 'var(--pulse-border-strong, rgba(0,0,0,0.16))')}`,
                  boxShadow: active ? '0 0 0 1.5px rgb(244 63 94), 0 4px 14px rgba(0,0,0,0.12)' : '0 1px 4px rgba(0,0,0,0.10)',
                }}>
                <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l" style={{ background: meta.color }} />
                <div className="flex items-center gap-1 pl-1.5">
                  <span className="text-[12px] font-medium text-zinc-900 dark:text-white truncate">{ev.title}</span>
                  {conflict && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
                </div>
                {!dense && h > 34 && (
                  <div className="pl-1.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400 truncate" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {fmtTime(asDate(ev.start))}{ev.location ? ` · ${ev.location}` : ''}
                  </div>
                )}
              </button>
            );
          })}

          {timed.length === 0 && allDay.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">Nothing timed today.</div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   AI RAIL — the constant intelligence pane (the only rose/coral surface).
   ════════════════════════════════════════════════════════════════════════ */
const AiRail: React.FC<{
  width: number;
  selected: CalendarEvent | null;
  selectedBuffer: TravelBuffer | null;
  selectedConflict: boolean;
  conflicts: ConflictResolution[];
  focusBlocks: FocusTimeBlock[];
  tightBuffers: TravelBuffer[];
  people: string[];
  aiReady: boolean;
  onOpenEvent: (ev: CalendarEvent) => void;
  onOpenAIPanel?: () => void;
}> = ({ width, selected, selectedBuffer, selectedConflict, conflicts, focusBlocks, tightBuffers, people, aiReady, onOpenEvent, onOpenAIPanel }) => {
  const hasSignal = conflicts.length > 0 || tightBuffers.length > 0 || focusBlocks.length > 0;
  return (
    <div className="shrink-0 overflow-auto space-y-3" style={{ width }}>
      {/* selected event detail */}
      {selected && (
        <div className="rounded-xl border p-3" style={{ borderColor: 'rgb(244 63 94)', background: 'var(--pulse-surface, #fff)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: typeColor(selected) }} />
            <span className="font-mono text-[10px] tracking-[0.12em] text-zinc-500">SELECTED</span>
          </div>
          <div className="text-[14px] font-semibold text-zinc-900 dark:text-white">{selected.title}</div>
          <div className="font-mono text-[11px] text-zinc-500 mt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {selected.allDay ? 'All day' : `${fmtTime(asDate(selected.start))}–${fmtTime(asDate(selected.end))}`}
          </div>
          {(selected.location || (selected.attendees && selected.attendees.length > 0)) && (
            <div className="flex flex-col gap-1 mt-2">
              {selected.attendees && selected.attendees.length > 0 && <span className="text-[11px] text-zinc-600 dark:text-zinc-300 flex items-center gap-1"><Users className="w-3 h-3" />{selected.attendees.length} attendees</span>}
              {selected.location && <span className="text-[11px] text-zinc-600 dark:text-zinc-300 flex items-center gap-1"><MapPin className="w-3 h-3" />{selected.location}</span>}
            </div>
          )}
          {(selectedBuffer || selectedConflict) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedBuffer && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${selectedBuffer.isTight ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>{selectedBuffer.travelLabel}{selectedBuffer.isTight ? ' · tight' : ''}</span>}
              {selectedConflict && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400">double-booked</span>}
            </div>
          )}
          <button onClick={() => onOpenEvent(selected)} className="mt-2.5 w-full py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[12px] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition flex items-center justify-center gap-1.5">
            Open details <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pulse AI header card */}
      <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(244,63,94,0.25)', background: 'rgba(244,63,94,0.05)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-rose-500" />
          <span className="font-mono text-[11px] tracking-[0.12em] text-rose-600 dark:text-rose-400">PULSE AI · TODAY</span>
        </div>

        <div className="space-y-2">
          {/* travel buffers are computed locally (distance matrix) — always shown */}
          {tightBuffers.slice(0, 2).map((b, i) => (
            <div key={`b-${i}`} className="flex items-start gap-2">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-400 shrink-0">drive</span>
              <div className="text-[12px] text-zinc-800 dark:text-zinc-100 leading-snug">{b.recommendation || `Tight transfer to ${b.toEvent.title}`}</div>
            </div>
          ))}
          {/* conflicts + focus require the AI pass */}
          {aiReady && conflicts.slice(0, 3).map((c, i) => (
            <div key={`c-${i}`} className="flex items-start gap-2">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${c.priority === 'high' ? 'bg-red-500/15 text-red-600 dark:text-red-400' : c.priority === 'medium' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-zinc-500/15 text-zinc-500'}`}>conflict</span>
              <div className="text-[12px] text-zinc-800 dark:text-zinc-100 leading-snug">
                {c.conflictingEvents.map(e => e.title).join(' ↔ ')}
                {c.suggestedResolutions[0] && <div className="text-[11px] text-zinc-500">{c.suggestedResolutions[0].description}</div>}
              </div>
            </div>
          ))}
          {aiReady && focusBlocks.slice(0, 1).map((f, i) => (
            <div key={`f-${i}`} className="flex items-start gap-2">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-600 dark:text-violet-400 shrink-0">focus</span>
              <div className="text-[12px] text-zinc-800 dark:text-zinc-100 leading-snug">{f.startTime}–{f.endTime} {f.protected ? 'protected' : 'available'} for deep work.</div>
            </div>
          ))}
          {/* deepen / clean states */}
          {!aiReady && (
            <button onClick={onOpenAIPanel} className="w-full mt-0.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[12px] font-medium transition">
              {tightBuffers.length > 0 ? 'Scan for conflicts & focus' : 'Run analysis'}
            </button>
          )}
          {aiReady && !hasSignal && (
            <p className="text-[12px] text-zinc-600 dark:text-zinc-300 leading-snug">No conflicts, no tight drives. Today is clean.</p>
          )}
        </div>
      </div>

      {/* fix / assistant entry */}
      {aiReady && hasSignal && (
        <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(244,63,94,0.25)', background: 'rgba(244,63,94,0.05)' }}>
          <div className="font-mono text-[11px] tracking-[0.12em] text-rose-600 dark:text-rose-400 mb-2">RESOLVE</div>
          <p className="text-[12px] text-zinc-600 dark:text-zinc-300 leading-snug">Open the assistant to auto-arrange the day, reschedule a conflict, or protect a focus block.</p>
          <button onClick={onOpenAIPanel} className="mt-2.5 w-full py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[12px] font-medium transition">Open assistant</button>
        </div>
      )}

      {/* people today */}
      {people.length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-950">
          <div className="font-mono text-[11px] tracking-[0.12em] text-zinc-500 mb-2">PEOPLE TODAY</div>
          {people.slice(0, 6).map(n => (
            <div key={n} className="flex items-center gap-2 py-1">
              <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[9px] font-semibold text-zinc-600 dark:text-zinc-200">
                {n.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()}
              </div>
              <span className="text-[12px] text-zinc-800 dark:text-zinc-100 truncate">{n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   CONTAINER
   ════════════════════════════════════════════════════════════════════════ */
const PaneLabel: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="font-mono text-[10px] tracking-[0.12em] text-zinc-500 mb-2 px-1 flex items-center gap-1.5 shrink-0">{icon}{children}</div>
);

export const CalendarTodayView: React.FC<CalendarTodayViewProps> = ({
  currentDate, events, conflicts = [], focusBlocks = [], aiReady = false,
  onEventClick, onDateClick, onFocusDateChange, onOpenAIPanel,
}) => {
  const [subView, setSubView] = useState<SubView>('split');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // events on the focus day, sorted (all-day first, then by start)
  const dayEvents = useMemo(() => events
    .filter(e => isSameDay(asDate(e.start), currentDate))
    .sort((a, b) => (a.allDay === b.allDay ? asDate(a.start).getTime() - asDate(b.start).getTime() : a.allDay ? -1 : 1)),
    [events, currentDate]);

  // focus blocks / conflicts scoped to the focus day
  const dayFocus = useMemo(() => focusBlocks.filter(f => isSameDay(asDate(f.date), currentDate)), [focusBlocks, currentDate]);
  const dayConflicts = useMemo(() => {
    const dayIds = new Set(dayEvents.map(e => e.id));
    return conflicts.filter(c => c.conflictingEvents.some(e => dayIds.has(e.id)));
  }, [conflicts, dayEvents]);
  const conflictIds = useMemo(() => {
    const s = new Set<string>();
    dayConflicts.forEach(c => c.conflictingEvents.forEach(e => s.add(e.id)));
    return s;
  }, [dayConflicts]);

  // travel buffers for the focus day (real distance-matrix service, cached)
  const [buffers, setBuffers] = useState<Map<string, TravelBuffer>>(new Map());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getTravelBuffersForEvents(dayEvents);
      if (cancelled) return;
      const m = new Map<string, TravelBuffer>();
      for (const b of list) m.set(b.fromEventId, b);
      setBuffers(m);
    })();
    return () => { cancelled = true; };
  }, [dayEvents]);

  // keep selection valid as the day changes
  useEffect(() => { if (selectedId && !dayEvents.some(e => e.id === selectedId)) setSelectedId(null); }, [dayEvents, selectedId]);

  const selected = useMemo(() => dayEvents.find(e => e.id === selectedId) ?? null, [dayEvents, selectedId]);
  const selectedBuffer = selectedId ? (buffers.get(selectedId) ?? null) : null;
  const tightBuffers = useMemo(() => Array.from(buffers.values()).filter(b => b.isTight), [buffers]);
  const people = useMemo(() => {
    const set = new Set<string>();
    dayEvents.forEach(e => (e.attendees ?? []).forEach(a => a && set.add(a)));
    return Array.from(set);
  }, [dayEvents]);

  const segs: { id: SubView; label: string; icon: React.ReactNode }[] = [
    { id: 'agenda', label: 'Agenda', icon: <List className="w-3.5 h-3.5" /> },
    { id: 'timeline', label: 'Timeline', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { id: 'split', label: 'Split', icon: <Columns className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-50/50 dark:bg-black">
      {/* sub-view toggle + quick add */}
      <div className="flex items-center gap-3 px-4 pt-3 shrink-0">
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-100 dark:bg-white/[0.05]">
          {segs.map(s => (
            <button key={s.id} onClick={() => setSubView(s.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition ${subView === s.id ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}>
              {s.icon}{s.label}
            </button>
          ))}
        </div>
        <button onClick={() => onDateClick(currentDate)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[12px] font-medium transition">
          <Plus className="w-3.5 h-3.5" />New event
        </button>
      </div>

      <WeekStrip focusDate={currentDate} events={events} onPick={onFocusDateChange} />

      {/* body: center pane(s) + constant rail */}
      <div className="flex-1 overflow-hidden flex gap-3 px-4 py-3 min-h-0">
        {subView === 'agenda' && (
          <div className="flex-1 overflow-auto pr-1">
            <PaneLabel icon={<List className="w-3 h-3" />}>{WEEKDAYS[currentDate.getDay()].toUpperCase()} · {dayEvents.length} EVENTS</PaneLabel>
            <AgendaSpine events={dayEvents} buffers={buffers} conflictIds={conflictIds} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        )}

        {subView === 'timeline' && (
          <div className="flex-1 min-w-0 flex flex-col">
            <PaneLabel icon={<LayoutGrid className="w-3 h-3" />}>TIMELINE</PaneLabel>
            <div className="flex-1 min-h-0">
              <DayTimeline focusDate={currentDate} events={dayEvents} buffers={buffers} focusBlocks={dayFocus} conflictIds={conflictIds} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          </div>
        )}

        {subView === 'split' && (
          <>
            <div className="w-[300px] shrink-0 flex flex-col">
              <PaneLabel icon={<List className="w-3 h-3" />}>AGENDA</PaneLabel>
              <div className="flex-1 overflow-auto pr-1">
                <AgendaSpine events={dayEvents} buffers={buffers} conflictIds={conflictIds} selectedId={selectedId} onSelect={setSelectedId} dense />
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <PaneLabel icon={<LayoutGrid className="w-3 h-3" />}>TIMELINE</PaneLabel>
              <div className="flex-1 min-h-0">
                <DayTimeline focusDate={currentDate} events={dayEvents} buffers={buffers} focusBlocks={dayFocus} conflictIds={conflictIds} selectedId={selectedId} onSelect={setSelectedId} dense />
              </div>
            </div>
          </>
        )}

        <AiRail
          width={272}
          selected={selected}
          selectedBuffer={selectedBuffer}
          selectedConflict={selectedId ? conflictIds.has(selectedId) : false}
          conflicts={dayConflicts}
          focusBlocks={dayFocus}
          tightBuffers={tightBuffers}
          people={people}
          aiReady={aiReady}
          onOpenEvent={onEventClick}
          onOpenAIPanel={onOpenAIPanel}
        />
      </div>
    </div>
  );
};

export default CalendarTodayView;
