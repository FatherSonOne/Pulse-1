// src/components/Archives/MemoryOverviewPanel.tsx
// Memory overview — replaces the dashboard-template stats panel.
// Three pivots: Top People (touchpoint counts), Themes (tag frequency), Recent.
// No hero stats, no quick-action grid, no preview duplication.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, MessagesSquare, Mic, Phone, Sparkles, Users, Video } from 'lucide-react';
import { useArchiveStore } from '../../store/archiveStore';
import { getTypeLabel } from './archiveHelpers';
import { BriefingSheet } from './BriefingSheet';
import type { ArchiveItem, ArchiveType } from '../../types';

const CHANNEL_GROUPS: Record<string, ArchiveType[]> = {
  voice: ['vox_transcript', 'transcript', 'relay_message', 'relay_note', 'relay_live'],
  meeting: ['meeting_note', 'war_room_session'],
  text: ['message', 'email', 'journal', 'summary', 'document', 'decision_log', 'artifact', 'research'],
  media: ['image', 'video', 'glimpse'],
};

const channelOf = (type: ArchiveType): keyof typeof CHANNEL_GROUPS => {
  for (const [key, types] of Object.entries(CHANNEL_GROUPS)) {
    if (types.includes(type)) return key as keyof typeof CHANNEL_GROUPS;
  }
  return 'text';
};

const ChannelIcon: React.FC<{ kind: keyof typeof CHANNEL_GROUPS; className?: string }> = ({ kind, className }) => {
  const cls = className || 'w-3 h-3';
  if (kind === 'voice') return <Mic className={cls} />;
  if (kind === 'meeting') return <Video className={cls} />;
  if (kind === 'media') return <Phone className={cls} />;
  return <MessagesSquare className={cls} />;
};

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const MemoryOverviewPanel: React.FC = () => {
  const items = useArchiveStore(s => s.items);
  const contacts = useArchiveStore(s => s.contacts);
  const query = useArchiveStore(s => s.query);
  const activeFilter = useArchiveStore(s => s.activeFilter);
  const activeCollectionId = useArchiveStore(s => s.activeCollectionId);
  const activeSmartFolderId = useArchiveStore(s => s.activeSmartFolderId);
  const setSelectedItem = useArchiveStore(s => s.setSelectedItem);
  const setQuery = useArchiveStore(s => s.setQuery);
  const setActiveFilter = useArchiveStore(s => s.setActiveFilter);
  const loadContacts = useArchiveStore(s => s.loadContacts);

  const [briefing, setBriefing] = useState<{ open: boolean; items: ArchiveItem[]; subject: string }>({
    open: false,
    items: [],
    subject: '',
  });

  const isFiltered = Boolean(query || (activeFilter && activeFilter !== 'all') || activeCollectionId || activeSmartFolderId);
  const briefingSubject = useMemo(() => {
    if (query) return query;
    if (activeFilter && activeFilter !== 'all') return getTypeLabel(activeFilter as ArchiveType);
    if (activeCollectionId) return 'Selected collection';
    if (activeSmartFolderId) return 'Smart folder';
    return 'Memory';
  }, [query, activeFilter, activeCollectionId, activeSmartFolderId]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const memory = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];
    const now = new Date();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const monthAgo = new Date(now.getTime() - 30 * weekMs / 7);

    // 12-week sparkline buckets (oldest → newest)
    const buckets = new Array(12).fill(0);
    const oldestBucketStart = now.getTime() - 12 * weekMs;
    let thisMonth = 0;
    let oldest: Date | null = null;

    const peopleMap = new Map<string, { count: number; channels: Record<string, number>; lastDate: Date }>();
    const themeCounts = new Map<string, number>();

    safeItems.forEach(item => {
      const d = item.date instanceof Date ? item.date : new Date(item.date);
      if (isNaN(d.getTime())) return;

      // Sparkline
      const t = d.getTime();
      if (t >= oldestBucketStart && t <= now.getTime()) {
        const bucket = Math.min(11, Math.floor((t - oldestBucketStart) / weekMs));
        buckets[bucket]++;
      }
      // This month
      if (d >= monthAgo) thisMonth++;
      // Oldest
      if (!oldest || d < oldest) oldest = d;

      // People
      if (item.relatedContactId) {
        const entry = peopleMap.get(item.relatedContactId) || { count: 0, channels: {}, lastDate: d };
        entry.count++;
        const ch = channelOf(item.type);
        entry.channels[ch] = (entry.channels[ch] || 0) + 1;
        if (d > entry.lastDate) entry.lastDate = d;
        peopleMap.set(item.relatedContactId, entry);
      }

      // Themes
      const allTags = [...(item.tags || []), ...(item.aiTags || [])];
      allTags.forEach(tag => {
        if (tag) themeCounts.set(tag, (themeCounts.get(tag) || 0) + 1);
      });
    });

    const topPeople = Array.from(peopleMap.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([contactId, data]) => {
        const contact = (contacts || []).find((c: any) => c?.id === contactId);
        const name = contact?.displayName || contact?.fullName || `Contact ${contactId.slice(0, 8)}`;
        return { contactId, name, ...data };
      });

    const topThemes = Array.from(themeCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    const recent = [...safeItems]
      .sort((a, b) => {
        const da = a.date instanceof Date ? a.date : new Date(a.date);
        const db = b.date instanceof Date ? b.date : new Date(b.date);
        return db.getTime() - da.getTime();
      })
      .slice(0, 5);

    return {
      total: safeItems.length,
      contactCount: peopleMap.size,
      thisMonth,
      oldest: oldest as Date | null,
      buckets,
      topPeople,
      topThemes,
      recent,
    };
  }, [items, contacts]);

  const oldestLabel = memory.oldest
    ? memory.oldest.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null;

  // Sparkline path (12 weeks)
  const sparkMax = Math.max(1, ...memory.buckets);
  const sparkPath = memory.buckets
    .map((v, i) => {
      const x = (i / 11) * 100;
      const y = 24 - (v / sparkMax) * 22;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const sparkArea = `${sparkPath} L100,24 L0,24 Z`;

  if (memory.total === 0) {
    // Sidebar carries the action paths; this pane carries the vision sentence.
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 min-h-0 p-8">
        <div className="text-center max-w-md">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-rose-500 mb-3">
            Memory
          </div>
          <h2 className="text-2xl font-light text-zinc-900 dark:text-zinc-50 leading-snug tracking-tight mb-3">
            Every word. Every voice. Every Pulse.
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            One searchable surface for every conversation that happens through Pulse — meetings, voice notes, transcripts, decisions, AI summaries. Capture a conversation to start the catalogue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex-1 flex flex-col overflow-y-auto bg-zinc-50 dark:bg-zinc-950 min-h-0">
      {/* Memory header strip — no card chrome, just type + sparkline */}
      <div className="px-6 pt-6 pb-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-rose-500">Memory</span>
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-500 truncate">
              {isFiltered ? `filtered · ${briefingSubject}` : 'every word · every voice · every pulse'}
            </span>
          </div>
          {isFiltered && items.length >= 2 && (
            <button
              onClick={() => setBriefing({ open: true, items, subject: briefingSubject })}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/[0.10] hover:bg-rose-500/[0.16] border border-rose-500/30 text-[10px] font-mono uppercase tracking-[0.12em] text-rose-600 dark:text-rose-400 transition-colors flex-shrink-0"
              style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
              title="Synthesize a briefing across these conversations"
            >
              <Sparkles className="w-3 h-3" />
              Build briefing
            </button>
          )}
        </div>
        <h2 className="text-base font-light text-zinc-900 dark:text-zinc-50 leading-snug max-w-prose">
          <span className="font-mono text-[15px] text-rose-500">{memory.total.toLocaleString()}</span>
          <span className="text-zinc-600 dark:text-zinc-400"> conversations across </span>
          <span className="font-mono text-[15px] text-zinc-900 dark:text-zinc-50">{memory.contactCount}</span>
          <span className="text-zinc-600 dark:text-zinc-400"> contacts</span>
          {oldestLabel && (
            <>
              <span className="text-zinc-600 dark:text-zinc-400"> since </span>
              <span className="font-mono text-[15px] text-zinc-900 dark:text-zinc-50">{oldestLabel}</span>
            </>
          )}
          <span className="text-zinc-600 dark:text-zinc-400">. </span>
          <span className="font-mono text-[15px] text-zinc-900 dark:text-zinc-50">{memory.thisMonth}</span>
          <span className="text-zinc-600 dark:text-zinc-400"> this month.</span>
        </h2>

        {/* Sparkline — 12 weeks */}
        <div className="mt-3 flex items-end gap-3">
          <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="w-full max-w-[420px] h-7" aria-hidden>
            <path d={sparkArea} fill="rgba(244,63,94,0.10)" />
            <path d={sparkPath} fill="none" stroke="#f43f5e" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 dark:text-zinc-600 whitespace-nowrap">
            12wk
          </span>
        </div>
      </div>

      {/* Top People */}
      <section className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-500" />
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
              Top People · by touchpoints
            </span>
          </div>
          {memory.contactCount > 5 && (
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600">
              + {memory.contactCount - 5} more
            </span>
          )}
        </div>
        {memory.topPeople.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-600 py-3">
            No contact links yet. Items archived from a conversation will pivot by person.
          </p>
        ) : (
          <ul className="space-y-1">
            {memory.topPeople.map(person => {
              const channelKeys = ['voice', 'meeting', 'text', 'media'] as const;
              const ranked = channelKeys
                .map(k => ({ k, v: person.channels[k] || 0 }))
                .filter(c => c.v > 0)
                .sort((a, b) => b.v - a.v);
              const primary = ranked.slice(0, 2);
              const remainder = ranked.slice(2).reduce((sum, c) => sum + c.v, 0);
              const maxPrimary = Math.max(1, ...primary.map(c => c.v));
              const personItems = items.filter(i => i.relatedContactId === person.contactId);
              return (
                <li key={person.contactId}>
                  <div
                    className="relative w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-white dark:hover:bg-white/[0.03] transition-[background-color] duration-200 group"
                    style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
                  >
                    <button
                      onClick={() => setQuery(person.name)}
                      className="absolute inset-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                      aria-label={`Filter memory by ${person.name}`}
                    />
                    <div className="relative w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] flex items-center justify-center text-[10px] font-mono font-medium text-zinc-600 dark:text-zinc-300 flex-shrink-0">
                      {initialsOf(person.name)}
                    </div>
                    <div className="relative flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-zinc-900 dark:text-zinc-50 truncate">{person.name}</span>
                        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-500 whitespace-nowrap">
                          {person.count} · {person.lastDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
                        {primary.map(({ k, v }) => {
                          const w = (v / maxPrimary) * 100;
                          return (
                            <div
                              key={k}
                              className="flex items-center gap-1 text-[9px] font-mono text-zinc-400 dark:text-zinc-500 min-w-0"
                              title={`${v} ${k}`}
                            >
                              <ChannelIcon kind={k} className="w-2.5 h-2.5 flex-shrink-0" />
                              <div className="hidden sm:block h-1 w-12 bg-zinc-200 dark:bg-white/[0.06] rounded-full overflow-hidden flex-shrink-0">
                                <div className="h-full bg-rose-500/60" style={{ width: `${w}%` }} />
                              </div>
                              <span className="tabular-nums">{v}</span>
                            </div>
                          );
                        })}
                        {remainder > 0 && (
                          <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 whitespace-nowrap" title={`${remainder} more across other channels`}>
                            +{remainder}
                          </span>
                        )}
                      </div>
                    </div>
                    {personItems.length >= 2 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBriefing({ open: true, items: personItems, subject: person.name });
                        }}
                        className="relative inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-[0.12em] text-rose-600 dark:text-rose-400 bg-rose-500/[0.08] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-rose-500/[0.16] transition flex-shrink-0"
                        title={`Build briefing for ${person.name}`}
                        aria-label={`Build briefing for ${person.name}`}
                      >
                        <Sparkles className="w-3 h-3" />
                        Brief
                      </button>
                    )}
                    <ChevronRight className="relative w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700 group-hover:text-rose-500 transition-colors flex-shrink-0" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Themes */}
      <section className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-500" />
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
            Themes · by frequency
          </span>
        </div>
        {memory.topThemes.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-600">
            No tags yet. AI tags appear automatically as you archive.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {memory.topThemes.map(([theme, count]) => (
              <button
                key={theme}
                onClick={() => setQuery(theme)}
                className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] hover:border-rose-500/40 hover:bg-rose-500/[0.06] transition-colors duration-200"
                style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
              >
                <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-700 dark:text-zinc-300">
                  {theme}
                </span>
                <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600">{count}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Recent */}
      <section className="px-6 py-5 flex-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
            Last {memory.recent.length}
          </span>
        </div>
        <ul className="space-y-1">
          {memory.recent.map((item: ArchiveItem) => {
            const d = item.date instanceof Date ? item.date : new Date(item.date);
            const contact = item.relatedContactId
              ? (contacts || []).find((c: any) => c?.id === item.relatedContactId)
              : null;
            const contactName: string | null = contact
              ? (contact.displayName || contact.fullName || null)
              : null;
            const contactFirst = contactName ? contactName.split(/\s+/)[0].toLowerCase() : null;
            return (
              <li key={item.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedItem(item)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedItem(item); } }}
                  className="w-full flex items-baseline gap-3 py-2 px-2 -mx-2 rounded-lg text-left cursor-pointer hover:bg-white dark:hover:bg-white/[0.03] transition-[background-color] duration-200 group focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                  style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
                >
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600 w-12 flex-shrink-0 tabular-nums">
                    {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setActiveFilter(item.type); }}
                    className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500 w-16 flex-shrink-0 text-left hover:text-rose-500 transition-colors truncate"
                  >
                    {getTypeLabel(item.type)}
                  </button>
                  {contactFirst && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setQuery(contactName!); }}
                      className="font-mono text-[10px] lowercase tracking-wide text-zinc-500 dark:text-zinc-500 hover:text-rose-500 transition-colors truncate flex-shrink-0 max-w-[80px]"
                      title={`Filter by ${contactName}`}
                    >
                      {contactFirst}
                    </button>
                  )}
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-50 truncate flex-1">
                    {item.title}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700 group-hover:text-rose-500 transition-colors flex-shrink-0" />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
    <BriefingSheet
      open={briefing.open}
      onClose={() => setBriefing({ open: false, items: [], subject: '' })}
      items={briefing.items}
      subject={briefing.subject}
    />
    </>
  );
};

export default MemoryOverviewPanel;
