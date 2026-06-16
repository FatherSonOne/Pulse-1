// ─────────────────────────────────────────────────────────────────────────────
// I'm at… FAB — bottom-right of the Map. The wire between Map and Pulse's
// communication channels (the brief's "make Map a verb, not a noun").
//
// One-tap flow: GPS → reverse-geocode → pick a contact → send. The actual
// dispatch routes the user to Messages with the contact pre-selected and
// copies the message body to the clipboard so it's a single paste even if
// Messages doesn't (yet) honour the prefill event. Honest UX, no theatre.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, MapPin, MessageSquare, Send, X } from 'lucide-react';
import { Contact } from '../../../types';
import { reverseGeocode } from '../../../services/locationService';

interface ImAtFABProps {
  userPosition: { lat: number; lng: number } | null;
  contacts: Contact[];
  isDarkMode: boolean;
  /** Called when the user picks a recipient. Parent typically routes to
   *  Messages via onContactAction('message', id); this component also copies
   *  the body to clipboard as a deterministic fallback. */
  onSend: (contactId: string, body: string) => void;
}

// Pulse-linked contacts are the realistic universe for an "I'm at" ping — a
// phone-number-only contact can't be reached through the in-app channels and
// would need SMS fallback wiring that lives outside this surface.
function eligibleContacts(contacts: Contact[]): Contact[] {
  return contacts.filter(c => !!c.pulseUserId);
}

const ImAtFAB: React.FC<ImAtFABProps> = ({ userPosition, contacts, isDarkMode, onSend }) => {
  const [open, setOpen] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [resolving, setResolving] = useState(false);
  const [query, setQuery] = useState('');
  const sheetRef = useRef<HTMLDivElement>(null);

  const eligible = useMemo(() => eligibleContacts(contacts), [contacts]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter(c => c.name.toLowerCase().includes(q));
  }, [eligible, query]);

  // Resolve place name when the sheet opens. Cached per-position so we don't
  // hit the geocoder again if the user reopens within the same GPS reading.
  const lastResolvedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !userPosition) return;
    const key = `${userPosition.lat.toFixed(5)},${userPosition.lng.toFixed(5)}`;
    if (lastResolvedFor.current === key && placeName) return;
    setResolving(true);
    let cancelled = false;
    reverseGeocode(userPosition.lat, userPosition.lng)
      .then(addr => {
        if (cancelled) return;
        if (addr) {
          // Trim down to the most recognisable cell — full Google addresses
          // are too verbose for a message body. Prefer the first 2 segments
          // (street + city) and fall back to the raw address.
          const segments = addr.split(',').map(s => s.trim());
          const short = segments.length >= 2 ? `${segments[0]}, ${segments[1]}` : addr;
          setPlaceName(short);
        }
        lastResolvedFor.current = key;
      })
      .finally(() => { if (!cancelled) setResolving(false); });
    return () => { cancelled = true; };
  }, [open, userPosition, placeName]);

  // Focus trap + Esc close while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
      if (e.key !== 'Tab') return;
      const root = sheetRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])'),
      ).filter(el => !el.hasAttribute('disabled'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handlePick = useCallback(async (contactId: string) => {
    const placeLabel = (placeName || '').trim();
    const body = placeLabel ? `I'm at ${placeLabel}.` : `I'm at my current location.`;
    // Clipboard copy is the deterministic fallback — even if Messages doesn't
    // pick up the prefill event yet, the user can paste in one keystroke.
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(body);
      }
    } catch { /* clipboard blocked — toast still tells the user what happened */ }

    // Toast carries a stable id so the listener below can swap copy → drafted
    // when Messages confirms it consumed the draft. Keep the fallback wording
    // honest in case the listener never fires (Messages not mounted yet).
    const toastId = 'pulse-im-at-fab';
    const truncated = body.length > 40 ? body.slice(0, 40) + '…' : body;
    const contact = contacts.find(c => c.id === contactId);
    const contactName = contact?.name ?? 'contact';

    const onAccepted = (event: Event) => {
      const detail = (event as CustomEvent<{ contactId?: string; source?: string }>).detail;
      if (detail?.contactId !== contactId || detail?.source !== 'map-im-at') return;
      toast.success(`Drafted "${truncated}" to ${contactName}`, {
        id: toastId,
        duration: 3500,
      });
      window.removeEventListener('pulse:messages:draft:accepted', onAccepted);
      clearTimeout(timeout);
    };
    window.addEventListener('pulse:messages:draft:accepted', onAccepted);
    // If Messages doesn't pick it up within 1.5s (e.g. not mounted yet), the
    // fallback "copied" toast stands. Removes the listener so we don't leak.
    const timeout = window.setTimeout(() => {
      window.removeEventListener('pulse:messages:draft:accepted', onAccepted);
    }, 1500);

    onSend(contactId, body);
    setOpen(false);
    setQuery('');
    toast.success(`Copied "${truncated}" — paste in Messages`, {
      id: toastId,
      duration: 3500,
    });
  }, [onSend, placeName, contacts]);

  // Hide entirely when GPS isn't available — "I'm at…" without a location is
  // a worse affordance than a missing button.
  if (!userPosition) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send your location to a contact"
        title="I'm at…"
        /* Bottom-CENTER, not bottom-right: the map renderer's attribution credit
           (MapLibre's legally-required OSM/ODbL "ⓘ", or Google's links) lives in
           the bottom-right corner, and a bottom-right FAB covered it. Centering
           keeps the FAB prominent + easily reachable while leaving the credit
           visible/clickable. (-translate-x-1/2 centers; hover -translate-y-px
           composes via Tailwind's shared transform vars.) */
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3.5 py-2 rounded-full shadow-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 bg-rose-500 text-white hover:bg-rose-600 hover:-translate-y-px ${
          isDarkMode ? 'focus-visible:ring-offset-zinc-950' : 'focus-visible:ring-offset-white'
        }`}
        style={{ boxShadow: '0 4px 16px rgba(244,63,94,0.30)' }}
      >
        <MapPin size={14} />
        I'm at…
      </button>

      {open && (
        <div
          className="absolute inset-0 z-30 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Share your location with a contact"
        >
          <div
            ref={sheetRef}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-lg rounded-t-2xl border-t border-x shadow-2xl overflow-hidden map-sheet-up ${
              isDarkMode ? 'bg-zinc-950 border-white/10' : 'bg-white border-gray-200'
            }`}
            style={{ maxHeight: '80%' }}
          >
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-rose-500" />
                <span
                  className="text-[11px] tracking-[0.1em] uppercase"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Share your location
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className={`p-1 rounded transition-colors ${
                  isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <X size={14} />
              </button>
            </div>

            <div className="px-4 py-3 space-y-3">
              <label className="block">
                <span
                  className={`block text-[10px] tracking-[0.1em] uppercase mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Place
                </span>
                <div className="relative">
                  <input
                    type="text"
                    value={placeName}
                    onChange={(e) => setPlaceName(e.target.value)}
                    placeholder={resolving ? 'Resolving address…' : 'e.g. Sightglass, Mission'}
                    className={`w-full px-3 py-2 pr-9 rounded-lg text-sm outline-none transition-colors ${
                      isDarkMode
                        ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-rose-500'
                        : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-500'
                    }`}
                  />
                  {resolving && (
                    <Loader2
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 motion-safe:animate-spin"
                    />
                  )}
                </div>
              </label>

              <label className="block">
                <span
                  className={`block text-[10px] tracking-[0.1em] uppercase mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Send to
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Pulse contacts…"
                  className={`w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors ${
                    isDarkMode
                      ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-rose-500'
                      : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-500'
                  }`}
                />
              </label>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {eligible.length === 0 ? (
                <p className={`px-4 py-8 text-sm text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  No Pulse-linked contacts yet. Add a teammate to share your location.
                </p>
              ) : filtered.length === 0 ? (
                <p className={`px-4 py-8 text-sm text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  No contacts match your search.
                </p>
              ) : (
                filtered.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handlePick(c.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:bg-rose-500/10 ${
                      isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: c.avatarColor || '#f43f5e' }}
                    >
                      {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {c.name}
                      </p>
                      {c.role && (
                        <p className={`text-xs truncate ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          {c.role}
                        </p>
                      )}
                    </div>
                    <Send size={13} className="text-rose-500 flex-shrink-0" />
                  </button>
                ))
              )}
            </div>

            <div className={`px-4 py-3 border-t flex items-center gap-2 ${isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-100 bg-gray-50'}`}>
              <MessageSquare size={11} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
              <span className={`text-[11px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Picking a contact copies <span className="font-mono">"I'm at {placeName || '…'}"</span> and opens Messages.
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImAtFAB;
