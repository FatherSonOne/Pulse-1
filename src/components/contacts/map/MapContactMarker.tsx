import React, { useCallback } from 'react';
import { OverlayView } from '@react-google-maps/api';
import { Contact } from '../../../types';
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

const STATUS_RING: Record<Contact['status'], string> = {
  online: 'ring-green-400',
  busy: 'ring-red-500',
  away: 'ring-amber-400',
  offline: 'ring-gray-400',
};

const STATUS_BG: Record<Contact['status'], string> = {
  online: 'bg-green-400',
  busy: 'bg-red-500',
  away: 'bg-amber-400',
  offline: 'bg-gray-400',
};

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
  const size = isSelected ? 'w-14 h-14' : 'w-11 h-11';
  const textSize = isSelected ? 'text-base' : 'text-sm';

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
        {/* Live pulse ring */}
        {isLive && (
          <div
            className={`absolute inset-0 rounded-full motion-safe:animate-ping opacity-50`}
            style={{ backgroundColor: '#3b82f6', margin: -6 }}
          />
        )}

        {/* Selected glow */}
        {isSelected && (
          <div
            className="absolute rounded-full opacity-30 motion-safe:animate-pulse"
            style={{
              inset: -8,
              backgroundColor: contact.avatarColor,
              borderRadius: '50%',
            }}
          />
        )}

        {/* Avatar circle */}
        <div
          className={`relative ${size} rounded-full flex items-center justify-center text-white font-bold ${textSize} ring-2 shadow-lg transition-transform duration-150 ${STATUS_RING[contact.status]} ${isSelected ? 'scale-110' : 'hover:scale-105'}`}
          style={{ backgroundColor: contact.avatarColor }}
        >
          {contact.avatarUrl ? (
            <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}

          {/* Location type badge */}
          <span
            className="absolute -bottom-0.5 -right-0.5 text-xs leading-none"
            title={locationType === 'home' ? 'Home location' : 'Work location'}
          >
            {locationType === 'home' ? '🏠' : '🏢'}
          </span>

          {/* Status dot */}
          <div
            className={`absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white ${STATUS_BG[contact.status]}`}
          />
        </div>

        {/* Name label */}
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 pointer-events-none">
          <div
            className="whitespace-nowrap text-xs font-semibold px-1.5 py-0.5 rounded shadow"
            style={{
              backgroundColor: 'rgba(0,0,0,0.65)',
              color: '#fff',
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
