// ============================================================
// EtaSharePage
//
// Public viewer for a Live ETA share. Mounted at /eta/:token by
// App.tsx as an early-return route — no auth required. Polls the
// SECURITY DEFINER `get_eta_share_by_token` RPC every 8s for fresh
// position + ETA. Renders the sharer's moving pin (rose) and the
// destination pin (slate) on a Google Map.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Loader2, MapPin } from 'lucide-react';
import { GOOGLE_MAPS_LIBRARIES, getMapOptions } from '../services/mapService';
import { getEtaShareByToken, formatEta, PublicEtaShare } from '../services/etaShareService';

const POLL_INTERVAL_MS = 8_000;

interface EtaSharePageProps {
  token: string;
}

const EtaSharePage: React.FC<EtaSharePageProps> = ({ token }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'pulse-eta-viewer',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [share, setShare] = useState<PublicEtaShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  const fetchShare = useCallback(async () => {
    const result = await getEtaShareByToken(token);
    if (!result) {
      setNotFound(true);
      setShare(null);
    } else {
      setShare(result);
      setNotFound(false);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchShare();
    const interval = window.setInterval(fetchShare, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [fetchShare]);

  // Fit bounds whenever both pins are available — covers initial load
  // and any subsequent movement that drifts off-screen.
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !share) return;
    if (share.lastLat == null || share.lastLng == null) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: share.lastLat, lng: share.lastLng });
    bounds.extend({ lat: share.destinationLat, lng: share.destinationLng });
    mapRef.current.fitBounds(bounds, 80);
  }, [isLoaded, share]);

  const center = useMemo(() => {
    if (share?.lastLat != null && share?.lastLng != null) {
      return { lat: share.lastLat, lng: share.lastLng };
    }
    if (share) return { lat: share.destinationLat, lng: share.destinationLng };
    return { lat: 37.7749, lng: -122.4194 };
  }, [share]);

  if (loadError) {
    return <FullScreenMessage title="Map unavailable" body="Couldn't load Google Maps." />;
  }
  if (loading) {
    return <FullScreenMessage title="Loading…" loading />;
  }
  if (notFound || !share) {
    return (
      <FullScreenMessage
        title="Share unavailable"
        body="This live ETA link has expired or was canceled."
      />
    );
  }

  const status = share.status;
  const headline = status === 'arrived'
    ? 'Arrived'
    : status === 'canceled'
      ? 'Share canceled'
      : status === 'expired'
        ? 'Share expired'
        : share.lastEtaSeconds != null
          ? `ETA ${formatEta(share.lastEtaSeconds)}`
          : 'En route';

  const subhead = share.destinationLabel || 'Destination';
  const distanceLabel = share.lastDistanceM != null
    ? share.lastDistanceM < 1000
      ? `${Math.round(share.lastDistanceM)} m away`
      : `${(share.lastDistanceM / 1000).toFixed(1)} km away`
    : null;

  return (
    <div className="fixed inset-0 bg-zinc-50">
      {isLoaded && (
        <GoogleMap
          mapContainerClassName="w-full h-full"
          center={center}
          zoom={13}
          options={getMapOptions(false)}
          onLoad={m => { mapRef.current = m; }}
        >
          {share.lastLat != null && share.lastLng != null && (
            <Marker
              position={{ lat: share.lastLat, lng: share.lastLng }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#f43f5e',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
              }}
              title="Live position"
            />
          )}
          <Marker
            position={{ lat: share.destinationLat, lng: share.destinationLng }}
            icon={{
              path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
              scale: 6,
              fillColor: '#3f3f46',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
            title={subhead}
          />
        </GoogleMap>
      )}

      {/* Top status card */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[92%] max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl px-5 py-4 border border-zinc-200">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xl font-bold text-zinc-900 truncate">{headline}</p>
              <p className="text-sm text-zinc-500 truncate">to {subhead}</p>
            </div>
            <div className="flex-shrink-0">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  status === 'active'
                    ? 'bg-rose-100 text-rose-700'
                    : status === 'arrived'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    status === 'active' ? 'bg-rose-500' : status === 'arrived' ? 'bg-emerald-500' : 'bg-zinc-400'
                  }`}
                >
                  {status === 'active' && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75 animate-ping" />
                  )}
                </span>
                {status === 'active' ? 'Live' : status[0].toUpperCase() + status.slice(1)}
              </span>
            </div>
          </div>
          {distanceLabel && (
            <p className="text-xs text-zinc-500 mt-1">{distanceLabel}</p>
          )}
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
        <p className="text-[10px] text-zinc-500 bg-white/80 backdrop-blur px-2 py-1 rounded-md">
          Shared via Pulse · Auto-refreshing every 8s
        </p>
      </div>
    </div>
  );
};

const FullScreenMessage: React.FC<{ title: string; body?: string; loading?: boolean }> = ({
  title, body, loading,
}) => (
  <div className="fixed inset-0 bg-zinc-50 flex items-center justify-center p-6">
    <div className="text-center max-w-sm">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-100 text-rose-500 mb-4">
        {loading ? <Loader2 className="animate-spin" size={28} /> : <MapPin size={28} />}
      </div>
      <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
      {body && <p className="text-sm text-zinc-500 mt-1">{body}</p>}
    </div>
  </div>
);

export default EtaSharePage;
