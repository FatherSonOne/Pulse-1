// ─────────────────────────────────────────────────────────────────────────────
// GeoSearchInput — renderer-neutral address/place autocomplete (P4 of the
// MapLibre rebrand). Replaces Google's <Autocomplete> widget on the MapLibre
// path: a controlled input + a debounced dropdown backed by geosearchService
// (Photon / OSM). It does NOT depend on Google Maps JS being loaded.
//
// The results dropdown is body-PORTALED with fixed positioning computed from the
// input's bounding rect — the location pickers render this inside an
// `overflow-hidden` popover (PlacePicker) and a modal (LocationEditModal), where
// an in-flow dropdown would be clipped or trapped behind sibling content (the
// same stacking-context lesson as the command palette).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Loader2 } from 'lucide-react';
import { geosearch, type GeoSearchResult } from '../../../services/geosearchService';

interface GeoSearchInputProps {
  isDarkMode: boolean;
  placeholder?: string;
  /** Bias results toward this point (user position / map center). */
  near?: { lat: number; lng: number } | null;
  onSelect: (result: GeoSearchResult) => void;
  /** Lets each call site match its surrounding input styling. */
  inputClassName?: string;
  autoFocus?: boolean;
  /** Seed text (e.g. the contact's current address). */
  initialValue?: string;
}

const DEBOUNCE_MS = 300;
const DROPDOWN_MAX_H = 280;

interface DropdownPos {
  left: number;
  top: number;
  width: number;
  openUp: boolean;
}

const GeoSearchInput: React.FC<GeoSearchInputProps> = ({
  isDarkMode,
  placeholder = 'Search address or place…',
  near,
  onSelect,
  inputClassName,
  autoFocus,
  initialValue = '',
}) => {
  const [value, setValue] = useState(initialValue);
  const [results, setResults] = useState<GeoSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pos, setPos] = useState<DropdownPos | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic request id so a slow earlier response can't overwrite a newer one.
  const reqIdRef = useRef(0);
  // Latest `near` reachable from the debounced closure without re-subscribing.
  const nearRef = useRef(near);
  nearRef.current = near;

  const computePos = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const openUp = below < DROPDOWN_MAX_H && r.top > below;
    setPos({
      left: r.left,
      top: openUp ? r.top : r.bottom,
      width: r.width,
      openUp,
    });
  }, []);

  // Reposition while open — the input lives inside scrollable popovers/modals.
  useLayoutEffect(() => {
    if (!open) return;
    computePos();
    const onScroll = () => computePos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, results, computePos]);

  // Close on an outside click (the dropdown is portaled, so a plain blur can't
  // tell "clicked a result" from "clicked away" — track both elements).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const runSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      setResults([]);
      setLoading(false);
      reqIdRef.current++; // invalidate any in-flight response
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const id = ++reqIdRef.current;
      const found = await geosearch(q, { near: nearRef.current });
      if (id !== reqIdRef.current) return; // a newer keystroke superseded this
      setResults(found);
      setActiveIndex(found.length > 0 ? 0 : -1);
      setLoading(false);
      setOpen(true);
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setValue(next);
    setOpen(true);
    runSearch(next);
  };

  const handleSelect = (r: GeoSearchResult) => {
    setValue(r.name || r.address);
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    reqIdRef.current++; // drop any pending response
    onSelect(r);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (e.key === 'ArrowDown' && value.trim().length >= 3) setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const baseInput = isDarkMode
    ? 'bg-white/5 border-white/15 text-white placeholder-gray-500 focus:border-rose-500'
    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-500';

  const showDropdown = open && pos && (loading || results.length > 0 || value.trim().length >= 3);

  return (
    <>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown ? true : false}
          aria-autocomplete="list"
          aria-controls="geosearch-listbox"
          value={value}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={handleChange}
          onFocus={() => { if (results.length > 0 || value.trim().length >= 3) setOpen(true); }}
          onKeyDown={handleKeyDown}
          className={inputClassName ?? `w-full text-sm px-2.5 py-1.5 rounded-lg border outline-none transition-colors ${baseInput}`}
        />
        {loading && (
          <Loader2
            size={14}
            className="animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-rose-500 pointer-events-none"
            aria-hidden
          />
        )}
      </div>

      {showDropdown && createPortal(
        <div
          ref={dropdownRef}
          id="geosearch-listbox"
          role="listbox"
          className={`fixed rounded-lg border shadow-2xl overflow-y-auto ${
            isDarkMode ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-200'
          }`}
          style={{
            left: pos.left,
            width: pos.width,
            maxHeight: DROPDOWN_MAX_H,
            zIndex: 9000,
            ...(pos.openUp
              ? { bottom: window.innerHeight - pos.top + 4 }
              : { top: pos.top + 4 }),
          }}
        >
          {results.length === 0 ? (
            <p className={`px-3 py-3 text-xs text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {loading ? 'Searching…' : 'No matches.'}
            </p>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.lat},${r.lng}-${i}`}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                // mousedown (not click) so selection beats the input's blur.
                onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors ${
                  i === activeIndex
                    ? (isDarkMode ? 'bg-rose-500/15' : 'bg-rose-50')
                    : (isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50')
                }`}
              >
                <MapPin
                  size={12}
                  className={`mt-0.5 flex-shrink-0 ${i === activeIndex ? 'text-rose-500' : (isDarkMode ? 'text-gray-500' : 'text-gray-400')}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    {r.name || r.address || 'Unnamed place'}
                  </p>
                  {r.name && r.address && (
                    <p className={`text-xs truncate ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {r.address}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>,
        document.body,
      )}
    </>
  );
};

export default GeoSearchInput;
