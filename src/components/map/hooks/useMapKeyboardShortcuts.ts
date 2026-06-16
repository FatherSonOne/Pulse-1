// ─────────────────────────────────────────────────────────────────────────────
// useMapKeyboardShortcuts — wires document-level keyboard handlers for the
// map section. Skips events fired inside form fields (INPUT/TEXTAREA/
// contentEditable) so typing into the search box never accidentally swaps
// the lens.
//
// Shortcuts:
//   1 / 2 / 3 — today / week / atlas lens
//   4 / 5 / 6 / 7 — roadmap / satellite / terrain / hybrid view mode
//   /          — focus the search input
//   Escape     — close (in priority order) live sheet, contact panel,
//                meeting panel, circle panel, add-location picker
//
// Caller supplies the current state values it needs for the Escape ladder
// and the setter / focus callbacks the shortcuts trigger.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, RefObject } from 'react';
import { isOverlayOpen } from '../../../lib/overlayStack';
import type { MapHorizon, MapLens, MapViewMode } from '../sub/mapLens';

export interface UseMapKeyboardShortcutsInput {
  setLens: (lens: MapLens) => void;
  changeViewMode: (mode: MapViewMode) => void;
  // Direction D (Horizon, P5). When mapHorizonOn, 1–4 drive the scrubber detents
  // (now/today/3d/week) and `a` toggles Atlas mode, instead of the legacy 1/2/3
  // lens + 4–7 view-mode keys. Optional so the OFF path is untouched.
  mapHorizonOn?: boolean;
  setHorizon?: (h: MapHorizon) => void;
  toggleAtlasMode?: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  // Escape ladder — state checks and corresponding "close" callbacks.
  showLiveSheet: boolean;
  setShowLiveSheet: (next: boolean) => void;
  selectedContactId: string | null;
  setSelectedContactId: (next: string | null) => void;
  selectedMeetingId: string | null;
  setSelectedMeetingId: (next: string | null) => void;
  selectedCircleId: string | null;
  setSelectedCircleId: (next: string | null) => void;
  showAddLocationPicker: boolean;
  setShowAddLocationPicker: (next: boolean) => void;
}

export function useMapKeyboardShortcuts(input: UseMapKeyboardShortcutsInput): void {
  const {
    setLens,
    changeViewMode,
    mapHorizonOn,
    setHorizon,
    toggleAtlasMode,
    searchInputRef,
    showLiveSheet,
    setShowLiveSheet,
    selectedContactId,
    setSelectedContactId,
    selectedMeetingId,
    setSelectedMeetingId,
    selectedCircleId,
    setSelectedCircleId,
    showAddLocationPicker,
    setShowAddLocationPicker,
  } = input;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (e.key === 'Escape') {
        if (showLiveSheet) { setShowLiveSheet(false); return; }
        if (selectedContactId) { setSelectedContactId(null); return; }
        if (selectedMeetingId) { setSelectedMeetingId(null); return; }
        if (selectedCircleId) { setSelectedCircleId(null); return; }
        if (showAddLocationPicker) { setShowAddLocationPicker(false); return; }
        return;
      }
      if (inField) return;
      if (isOverlayOpen()) return;
      // Horizon chrome (mapHorizon ON): 1–4 → scrubber detents, `a` → Atlas mode.
      // The legacy 5/6/7 view-mode keys are inert here (the base-style switch has
      // no hotkeys yet — not a regression, the control is net-new).
      if (mapHorizonOn && setHorizon) {
        if (e.key === '1') { setHorizon('now');   e.preventDefault(); return; }
        if (e.key === '2') { setHorizon('today'); e.preventDefault(); return; }
        if (e.key === '3') { setHorizon('3d');    e.preventDefault(); return; }
        if (e.key === '4') { setHorizon('week');  e.preventDefault(); return; }
        if ((e.key === 'a' || e.key === 'A') && toggleAtlasMode) { toggleAtlasMode(); e.preventDefault(); return; }
        if (e.key === '/') { searchInputRef.current?.focus(); e.preventDefault(); return; }
        return;
      }
      // Legacy chrome (OFF path) — unchanged.
      if (e.key === '1') { setLens('today'); e.preventDefault(); return; }
      if (e.key === '2') { setLens('week');  e.preventDefault(); return; }
      if (e.key === '3') { setLens('atlas'); e.preventDefault(); return; }
      if (e.key === '4') { changeViewMode('roadmap');   e.preventDefault(); return; }
      if (e.key === '5') { changeViewMode('satellite'); e.preventDefault(); return; }
      if (e.key === '6') { changeViewMode('terrain');   e.preventDefault(); return; }
      if (e.key === '7') { changeViewMode('hybrid');    e.preventDefault(); return; }
      if (e.key === '/') {
        searchInputRef.current?.focus();
        e.preventDefault();
        return;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [
    showLiveSheet,
    selectedContactId,
    selectedMeetingId,
    selectedCircleId,
    showAddLocationPicker,
    setLens,
    changeViewMode,
    mapHorizonOn,
    setHorizon,
    toggleAtlasMode,
    setShowLiveSheet,
    setSelectedContactId,
    setSelectedMeetingId,
    setSelectedCircleId,
    setShowAddLocationPicker,
    searchInputRef,
  ]);
}
