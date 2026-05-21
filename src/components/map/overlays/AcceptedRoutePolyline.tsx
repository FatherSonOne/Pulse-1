// ─────────────────────────────────────────────────────────────────────────────
// AcceptedRoutePolyline — coral polyline overlay for an accepted route.
// Stroke is heavy enough (weight 5) to read on both light and dark map
// tiles, with the directional dot icon pattern repeating every 14px so
// long routes still feel oriented at a glance.
//
// Click → open-in-system-maps handler. The parent owns the URL builder;
// this overlay just relays the click.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Polyline } from '@react-google-maps/api';

export interface AcceptedRoutePolylineProps {
  path: google.maps.LatLngLiteral[];
  onClick: () => void;
}

export const AcceptedRoutePolyline: React.FC<AcceptedRoutePolylineProps> = ({ path, onClick }) => {
  return (
    <Polyline
      path={path}
      onClick={onClick}
      options={{
        strokeColor: '#f43f5e',
        strokeOpacity: 0.95,
        strokeWeight: 5,
        clickable: true,
        geodesic: false,
        zIndex: 5,
        icons: [{
          icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
          offset: '0',
          repeat: '14px',
        }],
      }}
    />
  );
};
