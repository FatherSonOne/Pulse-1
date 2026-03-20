import React, { useRef, useState } from 'react';
import { Autocomplete } from '@react-google-maps/api';
import { Contact } from '../../../types';
import { saveContactLocation, clearContactLocation } from '../../../services/locationService';

interface LocationEditModalProps {
  contact: Contact;
  isOpen: boolean;
  isDarkMode: boolean;
  onClose: () => void;
  onSave: (updated: Contact) => void;
}

type PlaceResult = google.maps.places.PlaceResult;

const LocationEditModal: React.FC<LocationEditModalProps> = ({
  contact,
  isOpen,
  isDarkMode,
  onClose,
  onSave,
}) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const homeRef = useRef<google.maps.places.Autocomplete | null>(null);
  const workRef = useRef<google.maps.places.Autocomplete | null>(null);
  const homeInputRef = useRef<HTMLInputElement>(null);
  const workInputRef = useRef<HTMLInputElement>(null);

  const [homePending, setHomePending] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [workPending, setWorkPending] = useState<{ lat: number; lng: number; address: string } | null>(null);

  if (!isOpen) return null;

  const bg = isDarkMode ? 'bg-black/90 backdrop-blur-xl border-white/10' : 'bg-white border-gray-200';
  const text = isDarkMode ? 'text-white' : 'text-gray-900';
  const sub = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const inputCls = isDarkMode
    ? 'bg-white/5 border-white/15 text-white placeholder-gray-500 focus:border-rose-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-rose-500';

  const handlePlaceChanged = (
    type: 'home' | 'work',
    ref: React.MutableRefObject<PlaceResult | null>
  ) => {
    const autocomplete = type === 'home' ? homeRef.current : workRef.current;
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    if (!place.geometry?.location) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const address = place.formatted_address || '';
    if (type === 'home') {
      setHomePending({ lat, lng, address });
      if (homeInputRef.current) homeInputRef.current.value = address;
    } else {
      setWorkPending({ lat, lng, address });
      if (workInputRef.current) workInputRef.current.value = address;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      let updated = { ...contact };
      if (homePending) {
        await saveContactLocation(contact.id, 'home', homePending.lat, homePending.lng, homePending.address);
        updated = { ...updated, homeLat: homePending.lat, homeLng: homePending.lng, homeAddress: homePending.address };
      }
      if (workPending) {
        await saveContactLocation(contact.id, 'work', workPending.lat, workPending.lng, workPending.address);
        updated = { ...updated, workLat: workPending.lat, workLng: workPending.lng, workAddress: workPending.address };
      }
      onSave(updated);
    } catch (e) {
      setError('Failed to save location. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (type: 'home' | 'work') => {
    try {
      await clearContactLocation(contact.id, type);
      const updated = type === 'home'
        ? { ...contact, homeLat: undefined, homeLng: undefined, homeAddress: undefined }
        : { ...contact, workLat: undefined, workLng: undefined, workAddress: undefined };
      onSave(updated);
    } catch (e) {
      setError('Failed to clear location.');
    }
  };

  const LocationField = ({
    type,
    label,
    emoji,
    currentAddress,
    autocompleteRef,
    inputRef,
  }: {
    type: 'home' | 'work';
    label: string;
    emoji: string;
    currentAddress?: string;
    autocompleteRef: React.MutableRefObject<google.maps.places.Autocomplete | null>;
    inputRef: React.RefObject<HTMLInputElement>;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={`text-sm font-semibold flex items-center gap-1.5 ${text}`}>
          <span>{emoji}</span> {label}
        </label>
        {currentAddress && (
          <button
            onClick={() => handleClear(type)}
            className="text-xs text-rose-400 hover:text-rose-500 transition-colors focus-visible:outline-none focus-visible:underline"
          >
            Clear
          </button>
        )}
      </div>
      {currentAddress && (
        <p className={`text-xs px-3 py-1.5 rounded-lg ${isDarkMode ? 'bg-white/5 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
          Current: {currentAddress}
        </p>
      )}
      <Autocomplete
        onLoad={a => { autocompleteRef.current = a; }}
        onPlaceChanged={() => handlePlaceChanged(type, autocompleteRef as React.MutableRefObject<PlaceResult | null>)}
        options={{ types: ['address'] }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder={`Search for ${label.toLowerCase()} address...`}
          className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${inputCls}`}
        />
      </Autocomplete>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${bg}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className={`text-base font-bold ${text}`}>Set Locations</h2>
            <p className={`text-xs mt-0.5 ${sub}`}>{contact.name}</p>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className={`mx-5 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`} />

        {/* Fields */}
        <div className="p-5 space-y-5">
          <LocationField
            type="home"
            label="Home"
            emoji="🏠"
            currentAddress={contact.homeAddress}
            autocompleteRef={homeRef}
            inputRef={homeInputRef}
          />
          <LocationField
            type="work"
            label="Work"
            emoji="🏢"
            currentAddress={contact.workAddress}
            autocompleteRef={workRef}
            inputRef={workInputRef}
          />

          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className={`flex gap-2 px-5 pb-5`}>
          <button
            onClick={onClose}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
              isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!homePending && !workPending)}
            className="flex-1 py-2 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
          >
            {saving ? <i className="fa-solid fa-spinner fa-spin mr-1.5" /> : null}
            Save Locations
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationEditModal;
