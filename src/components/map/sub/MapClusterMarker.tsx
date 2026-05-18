// ─────────────────────────────────────────────────────────────────────────────
// MapClusterMarker — coral disc rendered at a cluster centroid when zoom ≤ 15.
//
// Diameter scales with member count so a 50-pin cluster reads as heavier than
// a 3-pin one without inflating chrome at low counts. Click zooms the map to
// the cluster's bbox (handled by the parent via onClick callback).
//
// Visual language matches MapContactMarker: rose accent (#f43f5e — the Pulse
// brand token, also used by the route sequence badge), white text, subtle
// ring + drop shadow. No avatar / no live state — clusters are aggregated
// signals, not identities.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback } from 'react';
import { OverlayView } from '@react-google-maps/api';
import type { ClusterCentroid } from '../hooks/useMarkerClusters';

interface MapClusterMarkerProps {
  cluster: ClusterCentroid;
  onClick: (cluster: ClusterCentroid) => void;
}

function sizeForCount(count: number): { diameter: number; fontSize: number } {
  if (count >= 50) return { diameter: 48, fontSize: 16 };
  if (count >= 10) return { diameter: 40, fontSize: 14 };
  return { diameter: 32, fontSize: 12 };
}

const MapClusterMarker: React.FC<MapClusterMarkerProps> = ({ cluster, onClick }) => {
  const { diameter, fontSize } = sizeForCount(cluster.count);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick(cluster);
    },
    [cluster, onClick],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(cluster);
      }
    },
    [cluster, onClick],
  );

  return (
    <OverlayView
      position={{ lat: cluster.lat, lng: cluster.lng }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Cluster of ${cluster.count} contacts. Click to expand.`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="cursor-pointer select-none rounded-full flex items-center justify-center font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
        style={{
          width: diameter,
          height: diameter,
          fontSize,
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#f43f5e',
          border: '2px solid #fafafa',
          boxShadow: '0 0 0 4px rgba(244, 63, 94, 0.20), 0 2px 8px rgba(0,0,0,0.30)',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {cluster.count}
      </div>
    </OverlayView>
  );
};

export default MapClusterMarker;
