// ─────────────────────────────────────────────────────────────────────────────
// useContactGeocoding — batch-geocodes contacts that have address text but
// no lat/lng yet.
//
// Side-effect hook. Owns its own in-flight ref so the caller doesn't have
// to plumb a Set through; promotion failures (a Google/Vision contact whose
// canonical id changes on save) are tracked locally and surfaced by calling
// the supplied setContacts with the new canonical id.
//
// Returns a `resetRequested` callback that the manual "auto-geocode" CTA
// uses to clear the in-flight cache and re-trigger a sweep on demand.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from 'react';
import type { Contact } from '../../../types';
import { geocodeContactsBatch, saveContactLocation } from '../../../services/locationService';

export interface UseContactGeocodingResult {
  /** Clear the in-flight cache. Used by the empty-state "Auto-geocode" CTA
   *  so the operator can re-trigger a sweep without remounting the section. */
  resetRequested: () => void;
}

export function useContactGeocoding(
  contacts: Contact[],
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>,
): UseContactGeocodingResult {
  const geocodeRequestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const needsGeocode = contacts.filter(c =>
      (c.address || c.homeAddress)
      && !c.homeLat
      && !c.workLat
      && !geocodeRequestedRef.current.has(c.id)
    );
    if (needsGeocode.length === 0) return;

    needsGeocode.forEach(c => geocodeRequestedRef.current.add(c.id));

    geocodeContactsBatch(needsGeocode).then(results => {
      results.forEach(async (coords, contactId) => {
        const contact = needsGeocode.find(c => c.id === contactId);
        if (!contact) return;
        const address = contact.homeAddress || contact.address || '';
        try {
          // saveContactLocation may promote a Google/Vision contact, in which
          // case the canonical id differs from the cached one — update local
          // state by the OLD id and write the new id into the row.
          const canonicalId = await saveContactLocation(contact, 'home', coords.lat, coords.lng, address);
          setContacts(prev =>
            prev.map(c => c.id === contactId
              ? { ...c, id: canonicalId, homeLat: coords.lat, homeLng: coords.lng, homeAddress: address }
              : c
            )
          );
        } catch {
          // Promotion / write failed (auth, RLS, schema). Surface in the
          // request set so we don't loop on a dead contact and keep the
          // user's UI usable.
          geocodeRequestedRef.current.add(contactId);
        }
      });
    });
  }, [contacts, setContacts]);

  const resetRequested = useCallback(() => {
    geocodeRequestedRef.current.clear();
  }, []);

  return { resetRequested };
}
