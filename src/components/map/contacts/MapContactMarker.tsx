import React, { memo, useCallback } from 'react';
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
  /** Stable dispatcher. Receives the marker's own (contactId, locType) so
   *  PulseMapView can keep ONE handler reference across all markers — the
   *  prop identity never changes, so React.memo skips re-render when nothing
   *  else changed. */
  onClick: (contactId: string, locType: 'home' | 'work') => void;
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
  /** Spider animation phase supplied by useSpiderAnimation.
   *  - 'entering' (just expanded): runs the spider-leg-in keyframe at
   *    {animationDelayMs}ms after mount.
   *  - 'exiting' (just collapsed): runs spider-leg-out and the parent
   *    unmounts after the animation finishes.
   *  - 'idle' or undefined: no animation. */
  animationPhase?: 'entering' | 'idle' | 'exiting';
  animationDelayMs?: number;
  /** True when prefers-reduced-motion is on — the marker swaps the scale
   *  + transform animation for an opacity-only fade. */
  reducedMotion?: boolean;
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
  animationPhase,
  animationDelayMs = 0,
  reducedMotion = false,
}) => {
  const pos = liveLocation ? { lat: liveLocation.lat, lng: liveLocation.lng } : { lat, lng };
  const initials = getInitials(contact.name);
  const isSpiderLeg = mode === 'spider-leg';
  // Animation class is applied only for spider legs in entering/exiting
  // phases. Idle / normal markers keep the existing transform transition.
  const animationClass = isSpiderLeg && animationPhase === 'entering'
    ? (reducedMotion ? 'spider-leg-fade-in' : 'spider-leg-enter')
    : isSpiderLeg && animationPhase === 'exiting'
    ? (reducedMotion ? 'spider-leg-fade-out' : 'spider-leg-exit')
    : '';
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
    onClick(contact.id, locationType);
  }, [onClick, contact.id, locationType]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(contact.id, locationType);
    }
  }, [onClick, contact.id, locationType]);

  return (
    <OverlayView
      position={pos}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        className={`group relative cursor-pointer select-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 ${animationClass}`}
        style={{
          // Offset (when supplied by useMarkerOffsets) fans same-coord
          // siblings apart in screen space so each is independently
          // tappable. Hover/focus z-elevates so the active marker rides
          // on top of its group.
          transform: `translate(calc(-50% + ${offsetX}px), calc(-100% + ${offsetY}px))`,
          transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          // Spider-leg keyframes need a per-leg stagger; passing via CSS
          // variable keeps the keyframe rules generic and cacheable.
          ['--spider-delay' as string]: `${animationDelayMs}ms`,
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

// Custom comparator: with 500 markers, the dominant cost is the per-marker
// re-render that fires on every PulseMapView render — selection changes,
// hover, presence pings, spider state. Default React.memo (shallow compare)
// catches most of it; we add an explicit check on every prop so it's
// obvious which changes pierce the memo and which don't.
//
// Refs that flow through stable upstream state (contact, liveLocation,
// onClick) get identity comparison — they only change when the source data
// changes. Primitives get value comparison.
//
// Pierces the memo (correct re-render): isSelected flip on this marker,
// lat/lng change (live-location move), offsetX/offsetY change (cluster
// state change touched this group), animationPhase change, sequenceNumber
// change (route accept/dismiss).
//
// Does NOT pierce (skipped re-render): other markers' isSelected, presence
// pings for other contacts, spider toggle on a different group, hover on
// any marker (CSS group-hover, no React state).
function areEqual(prev: MapContactMarkerProps, next: MapContactMarkerProps): boolean {
  return (
    prev.contact === next.contact &&
    prev.locationType === next.locationType &&
    prev.lat === next.lat &&
    prev.lng === next.lng &&
    prev.isSelected === next.isSelected &&
    prev.isLive === next.isLive &&
    prev.liveLocation === next.liveLocation &&
    prev.onClick === next.onClick &&
    prev.sequenceNumber === next.sequenceNumber &&
    prev.offsetX === next.offsetX &&
    prev.offsetY === next.offsetY &&
    prev.showLabel === next.showLabel &&
    prev.mode === next.mode &&
    prev.animationPhase === next.animationPhase &&
    prev.animationDelayMs === next.animationDelayMs &&
    prev.reducedMotion === next.reducedMotion
  );
}

export default memo(MapContactMarker, areEqual);
