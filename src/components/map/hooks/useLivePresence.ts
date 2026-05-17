// ─────────────────────────────────────────────────────────────────────────────
// useLivePresence — subscribes to Supabase realtime location updates for
// every contact whose pulseUserId is set, accumulating their positions into
// a Map keyed by contact id.
//
// The map is what the live-broadcast sheet, the per-contact panel, and the
// in-place marker overlay all consume. Returning a Map (not an array) lets
// callers do O(1) `liveLocations.get(c.id)` instead of scanning.
//
// Re-subscribes whenever the contacts array reference changes — typically
// when the parent commits a contact-update via setLocalContacts. The unsub
// cleanup ensures we don't accumulate listeners across re-runs.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import type { Contact } from '../../../types';
import { subscribeToUserLocation, UserLocation } from '../../../services/locationService';

export function useLivePresence(contacts: Contact[]): Map<string, UserLocation> {
  const [liveLocations, setLiveLocations] = useState<Map<string, UserLocation>>(new Map());
  useEffect(() => {
    const linked = contacts.filter(c => c.pulseUserId);
    const unsubs: Array<() => void> = [];
    linked.forEach(c => {
      const unsub = subscribeToUserLocation(c.pulseUserId!, loc => {
        setLiveLocations(prev => new Map(prev).set(c.id, loc));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach(fn => fn());
  }, [contacts]);
  return liveLocations;
}
