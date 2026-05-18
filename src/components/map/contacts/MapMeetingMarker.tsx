// ─────────────────────────────────────────────────────────────────────────────
// MapMeetingMarker — second marker type introduced in Phase 5 for calendar
// events with a resolved location. Visually distinct from MapContactMarker
// (smaller pill, calendar glyph) but shares the coral palette so it reads as
// part of the same TODAY/WEEK lens story.
//
// Why separate from MapContactMarker: contact markers carry identity (avatar
// initials, status ring, live state). Meeting markers carry a *moment*
// (where you need to be, when). Different semantic, different shape.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback } from 'react';
import { OverlayView } from '@react-google-maps/api';
import { CalendarClock } from 'lucide-react';
import { CalendarEvent } from '../../../types';

interface MapMeetingMarkerProps {
  event: CalendarEvent;
  lat: number;
  lng: number;
  isSelected: boolean;
  onClick: () => void;
  /** 1-indexed route position. Renders the same coral sequence badge contact
   *  markers use so the accepted-route polyline reads consistently. */
  sequenceNumber?: number;
  /** CSS-pixel offset from useMarkerOffsets — non-zero when this meeting
   *  shares a coord with sibling markers (typically a contact pinned at
   *  the same address). Safe to omit; defaults to (0,0). */
  offsetX?: number;
  offsetY?: number;
  /** Suppresses the resting time/title label when a sibling marker in the
   *  same offset group owns the label slot. Hover / focus / selected still
   *  surface the label. */
  showLabel?: boolean;
  /** Cluster/spiderfy mode supplied by useMarkerClusters.
   *  - 'normal' (default): unchanged behavior.
   *  - 'spider-leg': leg of an expanded spider — suppresses resting label
   *    and renders smaller so the fan reads as composed sibling-mass
   *    around the anchor. */
  mode?: 'normal' | 'spider-leg';
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: false });
}

const MapMeetingMarker: React.FC<MapMeetingMarkerProps> = ({
  event,
  lat,
  lng,
  isSelected,
  onClick,
  sequenceNumber,
  offsetX = 0,
  offsetY = 0,
  showLabel = true,
  mode = 'normal',
}) => {
  const isSpiderLeg = mode === 'spider-leg';
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

  const size = isSpiderLeg ? (isSelected ? 36 : 28) : (isSelected ? 44 : 36);

  return (
    <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
      <div
        className="group relative cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
        style={{
          transform: `translate(calc(-50% + ${offsetX}px), calc(-100% + ${offsetY}px))`,
          transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${event.title} at ${formatTime(event.start)}`}
      >
        <div
          className="relative flex items-center justify-center rounded-full transition-transform duration-150"
          style={{
            width: size,
            height: size,
            backgroundColor: '#fafafa',
            border: '2px solid #f43f5e',
            boxShadow: isSelected
              ? '0 0 0 4px rgba(244, 63, 94, 0.30), 0 4px 16px rgba(0,0,0,0.30)'
              : '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          <CalendarClock size={isSelected ? 20 : 16} color="#f43f5e" strokeWidth={2.2} />

          {typeof sequenceNumber === 'number' && (
            <div
              className="absolute -top-2 -left-2 rounded-full flex items-center justify-center font-mono"
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
          )}
        </div>

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
            className="whitespace-nowrap text-[11px] font-semibold px-1.5 py-0.5 rounded shadow"
            style={{
              backgroundColor: 'rgba(15, 15, 15, 0.75)',
              color: '#fafafa',
              backdropFilter: 'blur(4px)',
            }}
          >
            {formatTime(event.start)} · {event.title.length > 24 ? event.title.slice(0, 24) + '…' : event.title}
          </div>
        </div>
      </div>
    </OverlayView>
  );
};

export default MapMeetingMarker;
