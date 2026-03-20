import React, { useState } from 'react';
import { Contact } from '../../../types';
import { ContactCircle } from '../../../types/contactCircleTypes';
import { UserLocation, distanceMiles, formatDistance } from '../../../services/locationService';
import LocationEditModal from './LocationEditModal';
import LocationSharePanel from './LocationSharePanel';

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
  const [activeLocType, setActiveLocType] = useState<'home' | 'work'>(locationType);

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

  const STATUS_COLORS: Record<Contact['status'], string> = {
    online: '#22c55e', busy: '#ef4444', away: '#f59e0b', offline: '#6b7280',
  };

  const initials = contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <div
        className={`absolute right-3 top-16 bottom-3 w-80 rounded-xl border shadow-2xl flex flex-col overflow-hidden z-10 ${bg}`}
        style={{ animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold ring-2 shadow"
                style={{ backgroundColor: contact.avatarColor, ringColor: STATUS_COLORS[contact.status] }}
              >
                {contact.avatarUrl
                  ? <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full rounded-full object-cover" />
                  : initials
                }
                {/* Status dot */}
                <div
                  className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white"
                  style={{ backgroundColor: STATUS_COLORS[contact.status] }}
                />
              </div>
              {liveLocation && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white motion-safe:animate-pulse" title="Live location" />
              )}
            </div>
            <div>
              <h3 className={`font-bold text-base leading-tight ${text}`}>{contact.name}</h3>
              <p className={`text-sm ${sub}`}>{contact.role}{contact.company ? ` · ${contact.company}` : ''}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[contact.status] }} />
                <span className={`text-xs capitalize ${sub}`}>{contact.status}</span>
                {liveLocation && <span className="text-xs text-blue-400 ml-1">· Live</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className={`p-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        <div className={`border-t ${divider}`} />

        {/* Location section */}
        <div className="p-4 space-y-3">
          {/* Home / Work toggle */}
          <div className={`flex rounded-lg overflow-hidden text-xs ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
            {(['home', 'work'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveLocType(t)}
                className={`flex-1 py-1.5 capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-inset ${
                  activeLocType === t ? 'bg-rose-500 text-white' : `${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`
                }`}
              >
                {t === 'home' ? '🏠 Home' : '🏢 Work'}
              </button>
            ))}
          </div>

          {address ? (
            <div className={`rounded-lg p-3 ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
              <p className={`text-sm ${text}`}>{address}</p>
              {distance && (
                <p className="text-xs text-rose-400 mt-0.5 font-medium">
                  <i className="fa-solid fa-location-dot mr-1" />
                  {distance} from you
                </p>
              )}
              {liveLocation && (
                <p className="text-xs text-blue-400 mt-0.5">
                  <i className="fa-solid fa-circle-dot mr-1 motion-safe:animate-pulse" />
                  Live · updated {Math.round((Date.now() - liveLocation.updatedAt.getTime()) / 60000)}m ago
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
            className="w-full py-1.5 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 text-rose-500 border-rose-500/30 hover:bg-rose-500/10"
          >
            <i className="fa-solid fa-location-dot mr-1.5" />
            {address ? 'Edit Location' : 'Set Location'}
          </button>
        </div>

        {/* Circles */}
        {memberCircles.length > 0 && (
          <>
            <div className={`border-t ${divider}`} />
            <div className="px-4 py-3">
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${sub}`}>Circles</p>
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

        {/* Location sharing (Phase 3 — only for linked Pulse users) */}
        {contact.pulseUserId && (
          <>
            <div className={`border-t ${divider}`} />
            <div className="px-4 py-3">
              <button
                onClick={() => setShowSharePanel(!showSharePanel)}
                className={`w-full flex items-center justify-between text-sm font-medium ${text}`}
              >
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-share-nodes text-blue-400" />
                  Location Sharing
                </span>
                <i className={`fa-solid fa-chevron-${showSharePanel ? 'up' : 'down'} text-xs ${sub}`} />
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

        {/* Quick actions */}
        <div className="mt-auto border-t p-3 flex gap-2" style={{ borderColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
          <button
            onClick={() => onAction('message', contact.id)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold bg-transparent border border-gray-600 text-gray-300 hover:border-rose-500/50 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <i className="fa-solid fa-message mr-1.5" />Message
          </button>
          <button
            onClick={() => onAction('vox', contact.id)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
          >
            <i className="fa-solid fa-microphone mr-1.5" />Vox
          </button>
          <button
            onClick={() => onAction('meet', contact.id)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold bg-transparent border border-gray-600 text-gray-300 hover:border-rose-500/50 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <i className="fa-solid fa-video mr-1.5" />Meet
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

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
};

export default MapContactPanel;
