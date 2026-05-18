import React, { useCallback } from 'react';
import { OverlayView } from '@react-google-maps/api';
import { Briefcase, Home } from 'lucide-react';
import { Contact } from '../../../types';
import { LIVE_LOCATION_COLOR, LIVE_LOCATION_COLOR_SOFT, MAP_STATUS_COLORS } from '../../../services/mapService';
import { UserLocation } from '../../../services/locationService';

interface MapContactMarkerProps {
  contact: Contact;
  locationType: 'home' | 'work';
  lat: number;
  lng: number;
  isSelected: boolean;
  isLive?: boolean;
  liveLocation?: UserLocation;
  onClick: () => void;
  /** 1-indexed route order. When set, shows a coral sequence badge on the
   *  top-left of the marker. Set by PulseMapView after an AI route is
   *  accepted; un-set returns the marker to its standalone identity. */
  sequenceNumber?: number;
  /** CSS-pixel offset applied to the marker's transform — supplied by
   *  useMarkerOffsets when this marker shares a coord with siblings. The
   *  hook returns (0,0) when there's no overlap, so the prop is safe to
   *  pass unconditionally. */
  offsetX?: number;
  offsetY?: number;
  /** When false, the resting name label is suppressed because a sibling in
   *  the same offset group owns the label slot. Hover / focus / selected
   *  still surface the label via the existing group-hover CSS. */
  showLabel?: boolean;
  /** Cluster/spiderfy mode supplied by useMarkerClusters.
   *  - 'normal' (default): unchanged behavior.
   *  - 'spider-leg': leg of an expanded spider. Suppresses the resting label
   *    (the anchor owns identity for the group) and renders a thinner
   *    visual so the fan reads as a single composed unit. */
  mode?: 'normal' | 'spider-leg';
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// Progressive disclosure: at rest a marker shows two channels — avatar +
// status ring (+ live ring when applicable). The location-type badge stays
// hidden until the operator hovers or selects, freeing the resting state
// from the five-signals-on-a-thumbnail clutter the previous version had.
// When an accepted route exists, the sequence badge takes the corner slot
// permanently — route progress is the dominant narrative.
const MapContactMarker: React.FC<MapContactMarkerProps> = ({
  contact,
  locationType,
  lat,
  lng,
  isSelected,
  isLive = false,
  liveLocation,
  onClick,
  sequenceNumber,
  offsetX = 0,
  offsetY = 0,
  showLabel = true,
  mode = 'normal',
}) => {
  const pos = liveLocation ? { lat: liveLocation.lat, lng: liveLocation.lng } : { lat, lng };
  const initials = getInitials(contact.name);
  const isSpiderLeg = mode === 'spider-leg';
  // Legs render smaller — sibling-mass around an anchor, not the group's
  // identity. Anchor keeps the default 44/56 size from 'normal'.
  const size = isSpiderLeg ? (isSelected ? 40 : 32) : (isSelected ? 56 : 44);
  const fontSize = isSpiderLeg ? (isSelected ? 13 : 11) : (isSelected ? 16 : 14);
  const ringColor = MAP_STATUS_COLORS[contact.status];
  const LocationIcon = locationType === 'home' ? Home : Briefcase;
  const hasSequence = typeof sequenceNumber === 'number';
  // Reveal the location-type badge when the marker is selected OR being
  // hovered. CSS `group-hover` carries hover without React state — no
  // re-renders on mouse-move across markers.
  const badgeVisibilityCls = isSelected
    ? 'opacity-100'
    : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100';

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  }, [onClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }, [onClick]);

  return (
    <OverlayView
      position={pos}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        className="group relative cursor-pointer select-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
        style={{
          // Offset (when supplied by useMarkerOffsets) fans same-coord
          // siblings apart in screen space so each is independently
          // tappable. Hover/focus z-elevates so the active marker rides
          // on top of its group.
          transform: `translate(calc(-50% + ${offsetX}px), calc(-100% + ${offsetY}px))`,
          transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${contact.name}, ${locationType === 'home' ? 'home' : 'work'} location${isLive ? ', live' : ''}`}
      >
        {/* Live ring — thin 1.5px stroke so it reads as state, not chrome.
            The soft 4px outer halo carries the breathing presence; the ring
            itself is restrained. */}
        {isLive && (
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: -3,
              border: `1.5px solid ${LIVE_LOCATION_COLOR}`,
              boxShadow: `0 0 0 4px ${LIVE_LOCATION_COLOR_SOFT}`,
            }}
            aria-hidden="true"
          />
        )}

        {/* Avatar — status color forms the ring; selected adds a coral halo. */}
        <div
          className="relative flex items-center justify-center text-white font-bold rounded-full transition-transform duration-150"
          style={{
            width: size,
            height: size,
            fontSize,
            backgroundColor: contact.avatarColor,
            boxShadow: isSelected
              ? `0 0 0 2px ${ringColor}, 0 0 0 5px rgba(244, 63, 94, 0.40), 0 4px 16px rgba(0,0,0,0.30)`
              : `0 0 0 2px ${ringColor}, 0 2px 8px rgba(0,0,0,0.25)`,
          }}
        >
          {contact.avatarUrl ? (
            <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}

          {/* Bottom-right corner slot. Route sequence wins permanently when
              present; otherwise the location-type badge fades in on
              hover/focus/selected and stays hidden at rest. */}
          {hasSequence ? (
            <div
              className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center font-mono"
              style={{
                minWidth: 20,
                height: 20,
                padding: '0 6px',
                backgroundColor: '#f43f5e',
                color: '#fafafa',
                fontSize: 11,
                lineHeight: 1,
                border: '2px solid #fafafa',
                boxShadow: '0 1px 4px rgba(0,0,0,0.30)',
              }}
              aria-label={`Stop ${sequenceNumber} on accepted route`}
            >
              {sequenceNumber}
            </div>
          ) : (
            <div
              className={`absolute -bottom-1 -right-1 rounded-full flex items-center justify-center transition-opacity duration-150 ${badgeVisibilityCls}`}
              style={{
                width: 18,
                height: 18,
                backgroundColor: '#f43f5e',
                border: '2px solid #fafafa',
              }}
              title={locationType === 'home' ? 'Home location' : 'Work location'}
              aria-hidden={!isSelected}
            >
              <LocationIcon size={9} color="#fff" strokeWidth={2.5} />
            </div>
          )}
        </div>

        {/* Name label — first name only at rest. When `showLabel` is false
            another marker in the same offset group owns the resting label
            slot; this marker still surfaces the label on hover / focus /
            selected so the operator can still identify it. Spider legs
            never show a resting label — the anchor carries identity for
            the whole fan. */}
        <div
          className={`absolute top-full mt-1 left-1/2 -translate-x-1/2 pointer-events-none transition-opacity duration-150 ${
            isSpiderLeg
              ? (isSelected
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100')
              : (showLabel || isSelected
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100')
          }`}
        >
          <div
            className="whitespace-nowrap text-xs font-semibold px-1.5 py-0.5 rounded shadow"
            style={{
              backgroundColor: 'rgba(15, 15, 15, 0.75)',
              color: '#fafafa',
              backdropFilter: 'blur(4px)',
            }}
          >
            {contact.name.split(' ')[0]}
          </div>
        </div>
      </div>
    </OverlayView>
  );
};

export default MapContactMarker;
