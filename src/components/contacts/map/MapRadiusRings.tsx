import React from 'react';
import { Circle, OverlayView } from '@react-google-maps/api';
import { RADIUS_RINGS, MILES_TO_METERS, LIVE_LOCATION_COLOR } from '../../../services/mapService';

interface MapRadiusRingsProps {
  center: { lat: number; lng: number };
  isDarkMode: boolean;
}

const MapRadiusRings: React.FC<MapRadiusRingsProps> = ({ center, isDarkMode }) => {
  return (
    <>
      {RADIUS_RINGS.map(ring => (
        <React.Fragment key={ring.radiusMiles}>
          <Circle
            center={center}
            radius={ring.radiusMiles * MILES_TO_METERS}
            options={{
              strokeColor: ring.strokeColor,
              strokeOpacity: isDarkMode ? 0.5 : 0.4,
              strokeWeight: 1.5,
              fillColor: ring.fillColor,
              fillOpacity: isDarkMode ? 0.04 : 0.03,
              clickable: false,
              zIndex: 1,
            }}
          />
          <OverlayView
            position={{
              lat: center.lat,
              lng: center.lng + ring.radiusMiles / 55, // rough offset east
            }}
            mapPaneName={OverlayView.OVERLAY_LAYER}
          >
            <div
              className="text-xs font-semibold pointer-events-none select-none px-1.5 py-0.5 rounded"
              style={{
                color: ring.strokeColor,
                background: isDarkMode ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.8)',
                border: `1px solid ${ring.strokeColor}44`,
                transform: 'translateY(-50%)',
                whiteSpace: 'nowrap',
              }}
            >
              {ring.label}
            </div>
          </OverlayView>
        </React.Fragment>
      ))}
      {/* User position dot — solid, no perpetual ping (motion is for state,
          not decoration). Border picks up canvas color via box-shadow. */}
      <OverlayView
        position={center}
        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      >
        <div className="relative" style={{ transform: 'translate(-50%, -50%)' }}>
          <div
            className="rounded-full"
            style={{
              width: 14,
              height: 14,
              backgroundColor: LIVE_LOCATION_COLOR,
              boxShadow: '0 0 0 2px #fafafa, 0 2px 6px rgba(0,0,0,0.30)',
            }}
          />
        </div>
      </OverlayView>
    </>
  );
};

export default MapRadiusRings;
