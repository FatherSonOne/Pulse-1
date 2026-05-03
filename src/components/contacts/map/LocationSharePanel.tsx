import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Contact } from '../../../types';
import {
  checkLocationConsent,
  upsertLocationConsent,
  LocationShareConsent,
  startLocationBroadcast,
  stopLocationBroadcast,
} from '../../../services/locationService';

interface LocationSharePanelProps {
  contact: Contact;
  myUserId: string;
  isDarkMode: boolean;
}

const EXPIRY_OPTIONS = [
  { label: '1 hour',     hours: 1 },
  { label: '8 hours',    hours: 8 },
  { label: 'Tomorrow',   hours: 24 },
  { label: 'Indefinite', hours: 0 },
];

const LocationSharePanel: React.FC<LocationSharePanelProps> = ({ contact, myUserId, isDarkMode }) => {
  const [consent, setConsent] = useState<LocationShareConsent | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLevel, setShareLevel] = useState<'precise' | 'approximate' | 'city_only'>('precise');
  const [expiryHours, setExpiryHours] = useState(0);
  const [saving, setSaving] = useState(false);

  const text = isDarkMode ? 'text-white' : 'text-gray-900';
  const sub = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const labelCls = `text-xs font-medium ${sub}`;

  useEffect(() => {
    if (!contact.pulseUserId) return;
    checkLocationConsent(myUserId, contact.pulseUserId)
      .then(c => {
        setConsent(c);
        if (c) {
          setIsSharing(c.isGranted);
          setShareLevel(c.shareLevel);
        }
      })
      .finally(() => setLoading(false));
  }, [contact.pulseUserId, myUserId]);

  const handleToggleShare = async () => {
    if (!contact.pulseUserId) return;
    setSaving(true);
    const newValue = !isSharing;
    const expiresAt = expiryHours > 0 ? new Date(Date.now() + expiryHours * 3600000) : undefined;
    try {
      await upsertLocationConsent(myUserId, contact.pulseUserId, newValue, shareLevel, expiresAt);
      setIsSharing(newValue);
      if (newValue) {
        startLocationBroadcast(myUserId);
      } else {
        stopLocationBroadcast();
      }
    } catch {
      toast.error('Failed to update location sharing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`text-xs ${sub} py-2 inline-flex items-center gap-1.5`}>
        <Loader2 size={12} className="animate-spin" />
        Loading...
      </div>
    );
  }

  if (!contact.pulseUserId) {
    return <p className={`text-xs ${sub}`}>Location sharing requires a linked Pulse account.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Share toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xs font-semibold ${text}`}>Share my location</p>
          <p className={`text-xs ${sub}`}>with {contact.name.split(' ')[0]}</p>
        </div>
        <button
          onClick={handleToggleShare}
          disabled={saving}
          className={`relative w-10 h-5 rounded-full transition-colors ${isSharing ? 'bg-rose-500' : isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isSharing ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Share level */}
      {isSharing && (
        <>
          <div className="space-y-1">
            <p className={labelCls}>Precision</p>
            <div className={`flex rounded-lg overflow-hidden text-xs ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
              {(['precise', 'approximate', 'city_only'] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setShareLevel(lvl)}
                  className={`flex-1 py-1 capitalize transition-colors text-xs ${
                    shareLevel === lvl
                      ? 'bg-rose-500 text-white'
                      : isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  {lvl === 'city_only' ? 'City' : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <p className={labelCls}>Expires</p>
            <div className="grid grid-cols-2 gap-1">
              {EXPIRY_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setExpiryHours(opt.hours)}
                  className={`py-1 px-2 rounded-lg text-xs transition-colors ${
                    expiryHours === opt.hours
                      ? 'bg-rose-500 text-white'
                      : isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Consent status from their side */}
      <div className={`rounded-lg px-2.5 py-2 text-xs ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
        <p className={sub}>
          {consent?.isGranted
            ? <><span className="text-green-400">●</span> {contact.name.split(' ')[0]} is sharing with you</>
            : <><span className="text-gray-400">●</span> {contact.name.split(' ')[0]} is not sharing yet</>
          }
        </p>
      </div>
    </div>
  );
};

export default LocationSharePanel;
