// ─────────────────────────────────────────────────────────────────────────────
// AtlasHalos — Atlas-only density rendering via overlapping rose-tinted
// circles. Each pinned point contributes a soft ~1km halo; where points
// cluster, the halos sum optically and produce a heat-map feel without
// depending on Google's deprecated HeatmapLayer (sunset May 2026, warning
// hot today).
//
// Pulse-linked + team members render slightly stronger (1.2km radius +
// higher opacity) so the active network reads through the rest of the dots.
//
// The halo computation memoises off the contacts array so re-renders driven
// by lens / filter changes don't recompute when the underlying pin set is
// stable.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { Circle } from '@react-google-maps/api';
import type { Contact } from '../../../types';

export interface AtlasHalosProps {
  contacts: Contact[];
}

interface Halo {
  key: string;
  lat: number;
  lng: number;
  radiusM: number;
  opacity: number;
}

export const AtlasHalos: React.FC<AtlasHalosProps> = ({ contacts }) => {
  const halos = useMemo(() => {
    const out: Halo[] = [];
    for (const c of contacts) {
      const strong = c.pulseUserId || c.isTeamMember;
      const baseOpacity = strong ? 0.09 : 0.06;
      const radiusM = strong ? 1200 : 1000;
      if (c.homeLat != null && c.homeLng != null) {
        out.push({ key: `halo-${c.id}-home`, lat: c.homeLat, lng: c.homeLng, radiusM, opacity: baseOpacity });
      }
      if (c.workLat != null && c.workLng != null) {
        out.push({ key: `halo-${c.id}-work`, lat: c.workLat, lng: c.workLng, radiusM, opacity: baseOpacity });
      }
    }
    return out;
  }, [contacts]);

  return (
    <>
      {halos.map(halo => (
        <Circle
          key={halo.key}
          center={{ lat: halo.lat, lng: halo.lng }}
          radius={halo.radiusM}
          options={{
            fillColor: '#f43f5e',
            fillOpacity: halo.opacity,
            strokeOpacity: 0,
            clickable: false,
            zIndex: 0,
          }}
        />
      ))}
    </>
  );
};
