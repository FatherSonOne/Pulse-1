// ─────────────────────────────────────────────────────────────────────────────
// AtlasTerritories — Atlas-only Circle-territory polygons. Renders a
// convex hull around every circle's members who have at least one pinned
// location. Each territory wears the circle's own colour at low opacity so
// multiple territories read without fighting for the same coral.
//
// Selecting a territory (click) flips it into a "focused" mode with higher
// stroke + fill opacity. Clicking again clears the selection.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Polygon } from '@react-google-maps/api';
import type { Contact } from '../../../types';
import type { ContactCircle } from '../../../types/contactCircleTypes';
import { convexHull } from '../../../services/mapService';

export interface AtlasTerritoriesProps {
  circles: ContactCircle[];
  contacts: Contact[];
  selectedCircleId: string | null;
  onSelectCircle: (id: string | null) => void;
}

export const AtlasTerritories: React.FC<AtlasTerritoriesProps> = ({
  circles,
  contacts,
  selectedCircleId,
  onSelectCircle,
}) => {
  return (
    <>
      {circles.map(circle => {
        const members = contacts.filter(c =>
          circle.memberContactIds.includes(c.id) && (c.homeLat != null || c.workLat != null),
        );
        const points: Array<{ lat: number; lng: number }> = [];
        for (const m of members) {
          if (m.homeLat != null && m.homeLng != null) points.push({ lat: m.homeLat, lng: m.homeLng });
          if (m.workLat != null && m.workLng != null) points.push({ lat: m.workLat, lng: m.workLng });
        }
        if (points.length < 3) return null;
        const hull = convexHull(points);
        const isFocused = selectedCircleId === circle.id;
        return (
          <Polygon
            key={`territory-${circle.id}`}
            paths={hull}
            onClick={() => onSelectCircle(isFocused ? null : circle.id)}
            options={{
              fillColor: circle.color,
              fillOpacity: isFocused ? 0.18 : 0.08,
              strokeColor: circle.color,
              strokeOpacity: isFocused ? 0.9 : 0.4,
              strokeWeight: isFocused ? 2 : 1,
              clickable: true,
              zIndex: 1,
            }}
          />
        );
      })}
    </>
  );
};
