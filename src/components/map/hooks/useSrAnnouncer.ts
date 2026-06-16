// ─────────────────────────────────────────────────────────────────────────────
// useSrAnnouncer — drives the visually-hidden lens / view-mode announcer.
//
// Lens swap announcements fire on lens or marker-count change (lens swap
// usually changes both). View-mode announcements fire on viewMode change.
// The empty initial string serves as the "skip mount" gate so SR users
// don't get spammed with a "Today lens" message they didn't trigger.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { LENS_OPTIONS, MAP_HORIZON_OPTIONS, MAP_VIEW_OPTIONS, type MapHorizon, type MapLens, type MapViewMode } from '../sub/mapLens';

export function useSrAnnouncer(
  // Accepts the legacy MapLens AND the Horizon detents/atlas (P5) so the
  // announcer labels "Now" / "3 Days" / "Atlas" correctly under either chrome.
  lens: MapLens | MapHorizon,
  markerCount: number,
  viewMode: MapViewMode,
): string {
  const [srAnnouncement, setSrAnnouncement] = useState('');

  useEffect(() => {
    const lensLabel =
      LENS_OPTIONS.find(o => o.id === lens)?.label
      ?? MAP_HORIZON_OPTIONS.find(o => o.id === lens)?.label
      ?? lens;
    setSrAnnouncement(`${lensLabel} lens, ${markerCount} ${markerCount === 1 ? 'contact' : 'contacts'} on map`);
  }, [lens, markerCount]);

  useEffect(() => {
    const viewLabel = MAP_VIEW_OPTIONS.find(o => o.id === viewMode)?.label ?? viewMode;
    setSrAnnouncement(`${viewLabel} view`);
  }, [viewMode]);

  return srAnnouncement;
}
