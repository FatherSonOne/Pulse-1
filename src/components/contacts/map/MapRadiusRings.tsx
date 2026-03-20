import React from 'react';
import { Circle, OverlayView } from '@react-google-maps/api';
import { RADIUS_RINGS, MILES_TO_METERS } from '../../../services/mapService';

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
      {/* User position dot */}
      <OverlayView
        position={center}
        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      >
        <div className="relative" style={{ transform: 'translate(-50%, -50%)' }}>
          {/* Ping animation */}
          <div
            className="absolute inset-0 rounded-full motion-safe:animate-ping opacity-40"
            style={{ backgroundColor: '#3b82f6', width: 20, height: 20, margin: -4 }}
          />
          <div
            className="relative rounded-full border-2 border-white shadow-lg"
            style={{ width: 14, height: 14, backgroundColor: '#3b82f6' }}
          />
        </div>
      </OverlayView>
    </>
  );
};

export default MapRadiusRings;
