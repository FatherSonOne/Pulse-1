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
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const MapContactMarker: React.FC<MapContactMarkerProps> = ({
  contact,
  locationType,
  lat,
  lng,
  isSelected,
  isLive = false,
  liveLocation,
  onClick,
}) => {
  const pos = liveLocation ? { lat: liveLocation.lat, lng: liveLocation.lng } : { lat, lng };
  const initials = getInitials(contact.name);
  const size = isSelected ? 56 : 44;
  const fontSize = isSelected ? 16 : 14;
  const ringColor = MAP_STATUS_COLORS[contact.status];
  const LocationIcon = locationType === 'home' ? Home : Briefcase;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  }, [onClick]);

  return (
    <OverlayView
      position={pos}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        className="relative cursor-pointer select-none"
        style={{ transform: 'translate(-50%, -100%)' }}
        onClick={handleClick}
      >
        {/* Live ring — solid stroke, no perpetual ping. The "Live · Nm ago"
            timestamp in the panel carries the dynamic signal; the ring
            just identifies that this marker is a live position. */}
        {isLive && (
          <div
            className="absolute rounded-full"
            style={{
              inset: -4,
              border: `2px solid ${LIVE_LOCATION_COLOR}`,
              boxShadow: `0 0 0 4px ${LIVE_LOCATION_COLOR_SOFT}`,
            }}
          />
        )}

        {/* Avatar — status color forms the ring; selected adds a coral halo */}
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

          {/* Location-type badge (bottom-right). Coral background, white icon. */}
          <div
            className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center"
            style={{
              width: 18,
              height: 18,
              backgroundColor: '#f43f5e',
              border: '2px solid #fafafa',
            }}
            title={locationType === 'home' ? 'Home location' : 'Work location'}
          >
            <LocationIcon size={9} color="#fff" strokeWidth={2.5} />
          </div>
        </div>

        {/* Name label */}
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 pointer-events-none">
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
