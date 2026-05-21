import React from 'react';
import { Polygon, OverlayView } from '@react-google-maps/api';
import { Contact } from '../../../types';
import { ContactCircle } from '../../../types/contactCircleTypes';

interface MapCircleOverlayProps {
  circle: ContactCircle;
  contacts: Contact[];
  isSelected: boolean;
  isDarkMode: boolean;
  onClick: () => void;
}

// Simple convex hull using Graham scan (sufficient for small N contact sets)
function convexHull(points: Array<{ lat: number; lng: number }>) {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a.lng - b.lng || a.lat - b.lat);
  const cross = (O: typeof points[0], A: typeof points[0], B: typeof points[0]) =>
    (A.lng - O.lng) * (B.lat - O.lat) - (A.lat - O.lat) * (B.lng - O.lng);
  const lower: typeof points = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: typeof points = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

// Expand a polygon outward from its centroid by a given factor
function expandHull(pts: Array<{ lat: number; lng: number }>, factor = 0.0005) {
  if (pts.length === 0) return pts;
  const cx = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  return pts.map(p => ({
    lat: p.lat + (p.lat - cx) * 0.3 + (p.lat > cx ? factor : -factor),
    lng: p.lng + (p.lng - cy) * 0.3 + (p.lng > cy ? factor : -factor),
  }));
}

const MapCircleOverlay: React.FC<MapCircleOverlayProps> = ({
  circle,
  contacts,
  isSelected,
  isDarkMode,
  onClick,
}) => {
  // Gather positions for all circle members
  const memberContacts = contacts.filter(c => circle.memberContactIds.includes(c.id));
  const points: Array<{ lat: number; lng: number }> = [];
  memberContacts.forEach(c => {
    if (c.homeLat != null && c.homeLng != null) points.push({ lat: c.homeLat, lng: c.homeLng });
    if (c.workLat != null && c.workLng != null) points.push({ lat: c.workLat, lng: c.workLng });
  });

  if (points.length === 0) return null;
  if (points.length === 1) {
    // Single point — render nothing (marker handles it)
    return null;
  }

  const hull = expandHull(convexHull(points));

  // Centroid for label
  const centroid = {
    lat: hull.reduce((s, p) => s + p.lat, 0) / hull.length,
    lng: hull.reduce((s, p) => s + p.lng, 0) / hull.length,
  };

  return (
    <>
      <Polygon
        paths={hull.map(p => ({ lat: p.lat, lng: p.lng }))}
        options={{
          strokeColor: circle.color,
          strokeOpacity: isSelected ? 0.9 : 0.5,
          strokeWeight: isSelected ? 2 : 1.5,
          fillColor: circle.color,
          fillOpacity: isSelected ? 0.12 : 0.06,
          clickable: true,
          zIndex: 2,
        }}
        onClick={onClick}
      />
      <OverlayView position={centroid} mapPaneName={OverlayView.OVERLAY_LAYER}>
        <div
          className="pointer-events-none select-none px-2 py-0.5 rounded-full text-xs font-semibold shadow"
          style={{
            color: circle.color,
            backgroundColor: isDarkMode ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.85)',
            border: `1px solid ${circle.color}66`,
            transform: 'translate(-50%, -50%)',
            whiteSpace: 'nowrap',
          }}
        >
          {circle.icon && <span className="mr-1">{circle.icon}</span>}
          {circle.name}
        </div>
      </OverlayView>
    </>
  );
};

export default MapCircleOverlay;
