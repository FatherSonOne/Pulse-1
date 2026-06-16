// ─────────────────────────────────────────────────────────────────────────────
// LiveTeamDrawer — Direction D (Horizon, P8) first-class live-team surface.
//
// Promotes live presence from the bottom-sheet + filter-bar pill (LiveBroadcastSheet
// / the OFF-path Broadcast pill) to a right-side drawer that owns:
//   1. "Share my location" master switch — the consent-level is_sharing toggle
//      (setLocationSharing, previously unsurfaced) coupled to the GPS watch.
//   2. The broadcast recipient flow (via the shared useBroadcastControl, summoned
//      from PulseMapView's always-mounted recipient picker).
//   3. "Broadcasting now" — re-homed from LiveTeamView, now showing the human
//      location_label (populated by P8's broadcast upsert) with a coords fallback.
//   4. Active ETA shares — polled (eta_shares is NOT realtime), grace-window aware.
//
// Coral=signal-only (CLAUDE.md §4 / Gotcha 7): live indicators (the master-switch
// track when on, the broadcasting dots) carry rose; the drawer chrome (header,
// dividers, labels) stays neutral. Legacy LiveBroadcastSheet / LiveTeamView are
// PRESERVED — this is the Horizon path only, gated in PulseMapView.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, MessageCircle, Mic, Navigation, Radio, Video, X } from 'lucide-react';
import { Contact } from '../../../types';
import { UserLocation, setLocationSharing, stopLocationBroadcast, getActiveBroadcastRecipientIds } from '../../../services/locationService';
import {
  EtaShare,
  listActiveShares,
  cancelEtaShare,
  formatEta,
} from '../../../services/etaShareService';
import type { BroadcastControl } from './useBroadcastControl';
import { useDialogA11y } from '../sub/useDialogA11y';
import BroadcastRecipientPicker from '../sub/BroadcastRecipientPicker';

export interface LiveTeamDrawerProps {
  contacts: Contact[];
  liveLocations: Map<string, UserLocation>;
  isDarkMode: boolean;
  /** Logged-in user id — drives the share-my-location master switch. */
  userId: string;
  /** Shared broadcast state machine (owned by PulseMapView). */
  broadcast: BroadcastControl;
  onClose: () => void;
  onContactAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
}

interface LiveRow {
  contact: Contact;
  location: UserLocation;
}

// Copied (not imported) from LiveTeamView so that surface stays untouched as the
// OFF-path renderer + E2E export (Gotcha 2: re-home by copy, never move).
function formatLastSeen(updatedAt: Date): string {
  const now = Date.now();
  const diffSec = Math.floor((now - updatedAt.getTime()) / 1000);
  if (diffSec < 30) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export const LiveTeamDrawer: React.FC<LiveTeamDrawerProps> = ({
  contacts,
  liveLocations,
  isDarkMode,
  userId,
  broadcast,
  onClose,
  onContactAction,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useDialogA11y({ containerRef: panelRef, onClose, initialFocusRef: closeBtnRef });

  // Inline recipient picker — expands within the Share-my-location section so
  // choosing who can see you is one flow in one place, not a separate modal.
  // Opened on toggle-ON and via "Change who can see you".
  const [picking, setPicking] = useState(false);

  // ─── ETA shares — eta_shares is NOT in supabase_realtime (verified P7/P8), so
  // poll on a light 30s cadence. listActiveShares filters status='active', so a
  // canceled/arrived share leaves this list immediately on the owner side —
  // while the recipient's public link stays viewable for 5 more min (the
  // get_eta_share_by_token grace window). We surface that asymmetry, not "gone".
  const [shares, setShares] = useState<EtaShare[]>([]);
  const [graceNote, setGraceNote] = useState(false);
  const graceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const list = await listActiveShares();
      if (active) setShares(list);
    };
    void load();
    const id = window.setInterval(() => { void load(); }, 30_000);
    return () => {
      active = false;
      window.clearInterval(id);
      if (graceTimerRef.current) window.clearTimeout(graceTimerRef.current);
    };
  }, []);

  const handleCancelShare = async (shareId: string) => {
    try {
      await cancelEtaShare(shareId);
    } catch {
      // best effort — the next poll reconciles the list if this failed
    }
    setShares(prev => prev.filter(s => s.id !== shareId));
    setGraceNote(true);
    if (graceTimerRef.current) window.clearTimeout(graceTimerRef.current);
    graceTimerRef.current = window.setTimeout(() => setGraceNote(false), 8000);
  };

  // ─── Broadcasting-now rows — re-homed from LiveTeamView, enhanced to show the
  // human location_label when present (P8), falling back to coords + last-seen.
  const rows = useMemo<LiveRow[]>(() => {
    const result: LiveRow[] = [];
    for (const c of contacts) {
      const loc = liveLocations.get(c.id);
      if (loc?.isSharing) result.push({ contact: c, location: loc });
    }
    return result.sort(
      (a, b) => (b.location.updatedAt?.getTime() ?? 0) - (a.location.updatedAt?.getTime() ?? 0),
    );
  }, [contacts, liveLocations]);

  // ─── Master switch — consent-level is_sharing coupled to the GPS watch.
  // Ordering respects Gotcha 4 (setLocationSharing writes lat:0,lng:0):
  //  • Enable: flip consent BEFORE the watch starts. handleToggleLive only opens
  //    the recipient picker (no watch, no upserts yet) and no consents are granted
  //    yet, so the transient 0,0 is never visible to anyone.
  //  • Disable: tear the watch down SYNCHRONOUSLY via stopLocationBroadcast()
  //    first — this clears the module-global watchId + any pending 15s debounce,
  //    so no trailing real-coords upsert can re-assert is_sharing:true AFTER we
  //    flip it off. handleToggleLive then revokes recipients + clears liveOn (its
  //    effect-cleanup stop is then an idempotent no-op). Relying on that cleanup
  //    alone would race the await below — the cleanup runs a tick later.
  const handleMasterToggle = async () => {
    if (broadcast.liveOn) {
      stopLocationBroadcast();
      broadcast.handleToggleLive();
      setPicking(false);
      try { await setLocationSharing(userId, false); } catch { /* best effort */ }
    } else {
      // ON → grant consent, then EXPAND the inline recipient picker (not the
      // separate modal). The picker's confirm calls broadcast.handleRecipientConfirm
      // (flips liveOn true); Cancel just collapses it (sharing stays granted with
      // no recipients — cleaned on the next OFF, same benign orphan as before).
      try { await setLocationSharing(userId, true); } catch { /* best effort */ }
      setPicking(true);
    }
  };

  const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
  const sectionLabelCls = `text-[10px] tracking-[0.1em] uppercase ${
    isDarkMode ? 'text-gray-500' : 'text-gray-400'
  }`;

  return (
    <div
      className="absolute inset-0 z-30 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-team-drawer-title"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md h-full border-l shadow-2xl overflow-hidden flex flex-col ${
          isDarkMode ? 'bg-zinc-950 border-white/10 text-gray-200' : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        {/* Header — neutral chrome (coral reserved for the live signals below). */}
        <div className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${
          isDarkMode ? 'border-white/10' : 'border-gray-100'
        }`}>
          <div className="flex items-center gap-2">
            <Radio size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} aria-hidden="true" />
            <span id="live-team-drawer-title" className="text-[11px] tracking-[0.1em] uppercase" style={monoStyle}>
              Live team
            </span>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`p-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
              isDarkMode ? 'hover:bg-white/10 text-gray-400 focus-visible:ring-zinc-400' : 'hover:bg-gray-100 text-gray-500 focus-visible:ring-zinc-500'
            }`}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Share my location — master switch ─────────────────────────── */}
          <section className={`px-4 py-4 border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Share my location</p>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  {broadcast.liveOn
                    ? (broadcast.viewerCount > 0 ? `Visible to ${broadcast.viewerCount}` : 'On — pick who can see you')
                    : 'Off — your live position is private'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={broadcast.liveOn}
                aria-label="Share my location"
                onClick={() => { void handleMasterToggle(); }}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                  isDarkMode ? 'focus-visible:ring-rose-400' : 'focus-visible:ring-rose-500'
                } ${
                  broadcast.liveOn
                    ? 'bg-rose-500'
                    : isDarkMode ? 'bg-white/15' : 'bg-gray-300'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    broadcast.liveOn ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {broadcast.liveOn && !picking && (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className={`mt-3 inline-flex items-center gap-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:underline ${
                  isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Radio size={12} aria-hidden="true" />
                Change who can see you
              </button>
            )}

            {/* Inline recipient picker — the expandable section that replaces the
                separate modal: search + select + Broadcast, all in this drawer. */}
            {picking && (
              <div className="mt-3">
                <BroadcastRecipientPicker
                  inline
                  contacts={contacts}
                  initialSelectedUserIds={getActiveBroadcastRecipientIds()}
                  isDarkMode={isDarkMode}
                  onCancel={() => setPicking(false)}
                  onConfirm={(ids) => { void broadcast.handleRecipientConfirm(ids); setPicking(false); }}
                />
              </div>
            )}
          </section>

          {/* ── Broadcasting now ──────────────────────────────────────────── */}
          <section className={`px-4 py-4 border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
            <div className="flex items-center gap-2 mb-3" style={monoStyle}>
              {rows.length > 0 && (
                <span className="relative inline-flex h-1.5 w-1.5" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500/70 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
                </span>
              )}
              <span className={sectionLabelCls}>
                {rows.length > 0 ? `${rows.length} broadcasting now` : 'Broadcasting now'}
              </span>
            </div>

            {rows.length === 0 ? (
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                No teammates are sharing their location right now. When someone turns on Live, they'll appear here in real time.
              </p>
            ) : (
              <div
                className={`rounded-xl overflow-hidden border ${
                  isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-white'
                }`}
                role="list"
              >
                {rows.map(({ contact, location }, idx) => {
                  const seen = location.updatedAt ? formatLastSeen(location.updatedAt) : '';
                  const hasLabel = !!location.locationLabel;
                  const isLast = idx === rows.length - 1;
                  return (
                    <div
                      key={contact.id}
                      role="listitem"
                      className={`flex items-center gap-3 px-3 py-3 ${
                        isLast ? '' : isDarkMode ? 'border-b border-white/5' : 'border-b border-gray-100'
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 relative"
                        style={{ backgroundColor: contact.avatarColor || '#f43f5e' }}
                      >
                        {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 border-2"
                          style={{ borderColor: isDarkMode ? '#09090b' : '#ffffff' }}
                          aria-label="Live"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {contact.name}
                        </p>
                        <p className={`text-[11px] truncate flex items-center gap-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          {hasLabel ? (
                            <>
                              <MapPin size={10} className="flex-shrink-0" aria-hidden="true" />
                              <span className="truncate">{location.locationLabel}</span>
                              {seen && <span className="opacity-60 flex-shrink-0">· {seen}</span>}
                            </>
                          ) : (
                            <span style={monoStyle} className="tracking-[0.05em] uppercase">
                              {seen || 'broadcasting'}
                              {location.lat != null && location.lng != null && (
                                <span className="ml-2 opacity-70">
                                  {location.lat.toFixed(3)}, {location.lng.toFixed(3)}
                                </span>
                              )}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onContactAction('message', contact.id)}
                          title="Message"
                          aria-label={`Message ${contact.name}`}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                            isDarkMode ? 'text-gray-400 hover:bg-white/5 hover:text-gray-200 focus-visible:ring-zinc-400' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:ring-zinc-500'
                          }`}
                        >
                          <MessageCircle size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onContactAction('vox', contact.id)}
                          title="Voice"
                          aria-label={`Voice ${contact.name}`}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                            isDarkMode ? 'text-gray-400 hover:bg-white/5 hover:text-gray-200 focus-visible:ring-zinc-400' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:ring-zinc-500'
                          }`}
                        >
                          <Mic size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onContactAction('meet', contact.id)}
                          title="Meet"
                          aria-label={`Meet ${contact.name}`}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                            isDarkMode ? 'text-gray-400 hover:bg-white/5 hover:text-gray-200 focus-visible:ring-zinc-400' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:ring-zinc-500'
                          }`}
                        >
                          <Video size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Active ETA shares ─────────────────────────────────────────── */}
          <section className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={sectionLabelCls} style={monoStyle}>Active ETA shares</span>
            </div>

            {graceNote && (
              <p
                role="status"
                className={`mb-3 text-[11px] rounded-md px-2.5 py-1.5 ${
                  isDarkMode ? 'bg-white/[0.04] text-gray-400' : 'bg-gray-50 text-gray-500'
                }`}
              >
                Canceled. The recipient's link stays viewable for ~5 more minutes.
              </p>
            )}

            {shares.length === 0 ? (
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                No active ETA shares. Start one from a contact's location to share a live arrival link.
              </p>
            ) : (
              <div className="space-y-2">
                {shares.map(share => {
                  const dest = share.destinationLabel || 'destination';
                  const who = share.recipientLabel ? `to ${share.recipientLabel}` : 'public link';
                  return (
                    <div
                      key={share.id}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                        isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <Navigation size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {dest}
                        </p>
                        <p className={`text-[11px] truncate ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          {formatEta(share.lastEtaSeconds)} · {who}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { void handleCancelShare(share.id); }}
                        className={`text-[11px] font-medium px-2 py-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                          isDarkMode ? 'text-gray-300 hover:bg-white/10 focus-visible:ring-zinc-400' : 'text-gray-600 hover:bg-gray-100 focus-visible:ring-zinc-500'
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default LiveTeamDrawer;
