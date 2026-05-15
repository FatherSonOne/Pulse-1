import React, { useState } from 'react';
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  Home,
  MapPin,
  MessageSquare,
  Navigation,
  Radio,
  Share2,
  Video,
  X,
} from 'lucide-react';
import { Contact } from '../../../types';
import { ContactCircle } from '../../../types/contactCircleTypes';
import { LIVE_LOCATION_COLOR, MAP_STATUS_COLORS } from '../../../services/mapService';
import { UserLocation, distanceMiles, formatDistance } from '../../../services/locationService';
import LocationEditModal from './LocationEditModal';
import LocationSharePanel from './LocationSharePanel';
import EtaShareModal from './EtaShareModal';

interface MapContactPanelProps {
  contact: Contact;
  locationType: 'home' | 'work';
  circles: ContactCircle[];
  userPosition: { lat: number; lng: number } | null;
  liveLocation?: UserLocation;
  myUserId: string;
  isDarkMode: boolean;
  onClose: () => void;
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onContactUpdated: (updated: Contact) => void;
}

const MapContactPanel: React.FC<MapContactPanelProps> = ({
  contact,
  locationType,
  circles,
  userPosition,
  liveLocation,
  myUserId,
  isDarkMode,
  onClose,
  onAction,
  onContactUpdated,
}) => {
  const [showLocationEdit, setShowLocationEdit] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [showEtaShare, setShowEtaShare] = useState(false);
  const [activeLocType, setActiveLocType] = useState<'home' | 'work'>(locationType);

  const hasAnyLocation =
    (contact.homeLat != null && contact.homeLng != null) ||
    (contact.workLat != null && contact.workLng != null);

  const bg = isDarkMode ? 'bg-black/90 backdrop-blur-xl border-white/10' : 'bg-white/90 backdrop-blur-xl border-gray-200';
  const text = isDarkMode ? 'text-white' : 'text-gray-900';
  const sub = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const divider = isDarkMode ? 'border-white/10' : 'border-gray-100';

  const lat = activeLocType === 'home' ? contact.homeLat : contact.workLat;
  const lng = activeLocType === 'home' ? contact.homeLng : contact.workLng;
  const address = activeLocType === 'home' ? contact.homeAddress : contact.workAddress;

  const distance = userPosition && lat != null && lng != null
    ? formatDistance(distanceMiles(userPosition.lat, userPosition.lng, lat, lng))
    : null;

  const memberCircles = circles.filter(c => c.memberContactIds.includes(contact.id));
  const initials = contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const liveAgeMin = liveLocation
    ? Math.round((Date.now() - liveLocation.updatedAt.getTime()) / 60000)
    : null;

  return (
    <>
      <div
        className={`absolute right-3 top-16 bottom-3 w-80 rounded-xl border shadow-2xl flex flex-col overflow-hidden z-10 contacts-map-panel-enter ${bg}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold shadow"
                style={{
                  backgroundColor: contact.avatarColor,
                  boxShadow: `0 0 0 2px ${MAP_STATUS_COLORS[contact.status]}, 0 2px 8px rgba(0,0,0,0.20)`,
                }}
              >
                {contact.avatarUrl
                  ? <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full rounded-full object-cover" />
                  : initials
                }
                {/* Status dot */}
                <div
                  className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white"
                  style={{ backgroundColor: MAP_STATUS_COLORS[contact.status] }}
                />
              </div>
              {liveLocation && (
                <div
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white"
                  style={{ backgroundColor: LIVE_LOCATION_COLOR }}
                  title="Live location"
                />
              )}
            </div>
            <div>
              <h3 className={`font-bold text-base leading-tight ${text}`}>{contact.name}</h3>
              <p className={`text-sm ${sub}`}>{contact.role}{contact.company ? ` · ${contact.company}` : ''}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MAP_STATUS_COLORS[contact.status] }} />
                <span className={`text-xs capitalize ${sub}`}>{contact.status}</span>
                {liveLocation && (
                  <span className="text-xs ml-1" style={{ color: LIVE_LOCATION_COLOR }}>· Live</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
              isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
            aria-label="Close panel"
          >
            <X size={14} />
          </button>
        </div>

        <div className={`border-t ${divider}`} />

        {/* Location section */}
        <div className="p-4 space-y-3">
          {/* Home / Work toggle */}
          <div className={`flex rounded-lg overflow-hidden text-xs ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
            {([
              { value: 'home' as const, label: 'Home', Icon: Home },
              { value: 'work' as const, label: 'Work', Icon: Briefcase },
            ]).map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setActiveLocType(value)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-inset ${
                  activeLocType === value
                    ? 'bg-rose-500 text-white'
                    : `${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`
                }`}
              >
                <Icon size={11} />
                {label}
              </button>
            ))}
          </div>

          {address ? (
            <div className={`rounded-lg p-3 ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
              <p className={`text-sm ${text}`}>{address}</p>
              {distance && (
                <p className="text-xs text-rose-500 mt-1 font-medium flex items-center gap-1">
                  <MapPin size={11} />
                  {distance} from you
                </p>
              )}
              {liveLocation && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: LIVE_LOCATION_COLOR }}>
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: LIVE_LOCATION_COLOR }}
                  />
                  Live · updated {liveAgeMin}m ago
                </p>
              )}
            </div>
          ) : (
            <div className={`rounded-lg p-3 text-center ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
              <p className={`text-sm ${sub}`}>No {activeLocType} location set</p>
            </div>
          )}

          <button
            onClick={() => setShowLocationEdit(true)}
            className="w-full py-1.5 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 text-rose-500 border-rose-500/30 hover:bg-rose-500/10 inline-flex items-center justify-center gap-1.5"
          >
            <MapPin size={11} />
            {address ? 'Edit Location' : 'Set Location'}
          </button>

          {/* Share Live ETA — only meaningful when the contact has a destination */}
          {hasAnyLocation && (
            <button
              onClick={() => setShowEtaShare(true)}
              className="w-full py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 bg-rose-500 text-white hover:bg-rose-600 inline-flex items-center justify-center gap-1.5"
            >
              <Navigation size={11} />
              Share Live ETA
            </button>
          )}
        </div>

        {/* Circles */}
        {memberCircles.length > 0 && (
          <>
            <div className={`border-t ${divider}`} />
            <div className="px-4 py-3">
              <p className={`font-mono text-[11px] uppercase tracking-[0.1em] mb-2 ${sub}`}>Circles</p>
              <div className="flex flex-wrap gap-1.5">
                {memberCircles.map(c => (
                  <span
                    key={c.id}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: c.color + '22', color: c.color, border: `1px solid ${c.color}44` }}
                  >
                    {c.icon && <span>{c.icon}</span>}
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Location sharing — only for linked Pulse users */}
        {contact.pulseUserId && (
          <>
            <div className={`border-t ${divider}`} />
            <div className="px-4 py-3">
              <button
                onClick={() => setShowSharePanel(!showSharePanel)}
                className={`w-full flex items-center justify-between text-sm font-medium ${text}`}
              >
                <span className="flex items-center gap-2">
                  <Share2 size={14} style={{ color: LIVE_LOCATION_COLOR }} />
                  Location Sharing
                </span>
                {showSharePanel
                  ? <ChevronUp size={12} className={sub} />
                  : <ChevronDown size={12} className={sub} />}
              </button>
              {showSharePanel && (
                <div className="mt-2">
                  <LocationSharePanel
                    contact={contact}
                    myUserId={myUserId}
                    isDarkMode={isDarkMode}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Quick actions — Message / Relay / Meet (was: Vox) */}
        <div
          className="mt-auto border-t p-3 flex gap-2"
          style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }}
        >
          <button
            onClick={() => onAction('message', contact.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold bg-transparent border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 inline-flex items-center justify-center gap-1.5 ${
              isDarkMode
                ? 'border-white/15 text-gray-300 hover:border-rose-500/50 hover:text-white'
                : 'border-gray-300 text-gray-700 hover:border-rose-500/50 hover:text-gray-900'
            }`}
          >
            <MessageSquare size={11} />
            Message
          </button>
          <button
            onClick={() => onAction('vox', contact.id)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 inline-flex items-center justify-center gap-1.5"
          >
            <Radio size={11} />
            Relay
          </button>
          <button
            onClick={() => onAction('meet', contact.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold bg-transparent border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 inline-flex items-center justify-center gap-1.5 ${
              isDarkMode
                ? 'border-white/15 text-gray-300 hover:border-rose-500/50 hover:text-white'
                : 'border-gray-300 text-gray-700 hover:border-rose-500/50 hover:text-gray-900'
            }`}
          >
            <Video size={11} />
            Meet
          </button>
        </div>
      </div>

      {showLocationEdit && (
        <LocationEditModal
          contact={contact}
          isOpen={showLocationEdit}
          isDarkMode={isDarkMode}
          onClose={() => setShowLocationEdit(false)}
          onSave={updated => {
            onContactUpdated(updated);
            setShowLocationEdit(false);
          }}
        />
      )}

      {showEtaShare && (
        <EtaShareModal
          contact={contact}
          isOpen={showEtaShare}
          isDarkMode={isDarkMode}
          onClose={() => setShowEtaShare(false)}
        />
      )}
    </>
  );
};

export default MapContactPanel;
