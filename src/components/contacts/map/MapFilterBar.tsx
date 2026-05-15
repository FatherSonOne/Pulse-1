import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Briefcase, Globe, Home, Radio, Search, X } from 'lucide-react';
import { ContactCircle } from '../../../types/contactCircleTypes';
import { startLocationBroadcast, stopLocationBroadcast } from '../../../services/locationService';

export interface MapFilter {
  circles: string[];
  status: ('online' | 'offline' | 'busy' | 'away')[];
  locationType: 'all' | 'home' | 'work';
  searchQuery: string;
}

interface MapFilterBarProps {
  filter: MapFilter;
  circles: ContactCircle[];
  isDarkMode: boolean;
  onFilterChange: (f: MapFilter) => void;
  geoBlocked?: boolean;
  onDismissGeoBanner?: () => void;
  /** Logged-in user id — drives the personal Live Location broadcast toggle. */
  userId: string;
}

// Cached so the broadcast resumes on reload if the user had it enabled.
const LIVE_LOCATION_LS_KEY = 'pulse:map:live-location-on';

const STATUS_OPTIONS: { value: MapFilter['status'][number]; label: string; color: string }[] = [
  { value: 'online',  label: 'Online',  color: '#22c55e' },
  { value: 'busy',    label: 'Busy',    color: '#ef4444' },
  { value: 'away',    label: 'Away',    color: '#f59e0b' },
  { value: 'offline', label: 'Offline', color: '#6b7280' },
];

const LOCATION_OPTIONS = [
  { value: 'all'  as const, label: 'All',  Icon: Globe },
  { value: 'home' as const, label: 'Home', Icon: Home },
  { value: 'work' as const, label: 'Work', Icon: Briefcase },
];

const MapFilterBar: React.FC<MapFilterBarProps> = ({
  filter, circles, isDarkMode, onFilterChange, geoBlocked, onDismissGeoBanner, userId,
}) => {
  const bg = isDarkMode ? 'bg-black/75 border-white/10' : 'bg-white/90 border-gray-200';
  const text = isDarkMode ? 'text-white' : 'text-gray-900';

  // Personal Live Location toggle — controls own broadcast + geofence
  // detection. Persisted so a refresh resumes the previous state.
  const [liveOn, setLiveOn] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(LIVE_LOCATION_LS_KEY) === '1';
  });

  useEffect(() => {
    if (!userId) return;
    if (liveOn) {
      startLocationBroadcast(userId, err => {
        if (err.code === err.PERMISSION_DENIED) {
          toast.error('Location permission denied. Enable it to use arrival alerts.');
          setLiveOn(false);
        }
      });
    } else {
      stopLocationBroadcast();
    }
    // Tear down on unmount only — toggling off above handles state changes.
    return () => {
      if (!liveOn) stopLocationBroadcast();
    };
  }, [liveOn, userId]);

  const handleToggleLive = () => {
    const next = !liveOn;
    setLiveOn(next);
    try { localStorage.setItem(LIVE_LOCATION_LS_KEY, next ? '1' : '0'); } catch { /* ignore */ }
    if (next) {
      toast('Live location on — arrival alerts active', { icon: '📡', duration: 3000 });
    } else {
      toast('Live location off', { icon: '⏸', duration: 2000 });
    }
  };

  const toggleStatus = (s: MapFilter['status'][number]) => {
    const next = filter.status.includes(s)
      ? filter.status.filter(x => x !== s)
      : [...filter.status, s];
    onFilterChange({ ...filter, status: next });
  };

  const toggleCircle = (id: string) => {
    const next = filter.circles.includes(id)
      ? filter.circles.filter(x => x !== id)
      : [...filter.circles, id];
    onFilterChange({ ...filter, circles: next });
  };

  // No status filter active = "show all" (matches the !active = full-list contract below)
  const noStatusFilter = filter.status.length === 0;

  return (
    <div className={`absolute top-3 left-3 right-3 z-10 rounded-xl border backdrop-blur-2xl shadow-lg ${bg}`}>
      {/* Geolocation-denied banner (A4). Status-color amber #f59e0b is paired
          with a label so colour isn't the only signal. */}
      {geoBlocked && (
        <div
          role="status"
          className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs border-b ${
            isDarkMode ? 'border-white/10' : 'border-gray-200'
          }`}
          style={{
            backgroundColor: isDarkMode ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.08)',
            color: isDarkMode ? '#fcd34d' : '#b45309',
          }}
        >
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
            Location blocked — enable to see distances.
          </span>
          {onDismissGeoBanner && (
            <button
              type="button"
              onClick={onDismissGeoBanner}
              aria-label="Dismiss location banner"
              className={`p-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                isDarkMode ? 'hover:bg-white/10' : 'hover:bg-amber-500/10'
              }`}
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 p-2 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
          <Search size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
          <input
            type="text"
            placeholder="Search contacts..."
            value={filter.searchQuery}
            onChange={e => onFilterChange({ ...filter, searchQuery: e.target.value })}
            className={`text-sm outline-none bg-transparent ${text} w-full`}
          />
        </div>

        <div className={`w-px h-5 ${isDarkMode ? 'bg-white/15' : 'bg-gray-200'}`} />

        {/* Location type toggle */}
        <div className={`flex rounded-lg overflow-hidden text-xs ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}>
          {LOCATION_OPTIONS.map(({ value, label, Icon }) => {
            const active = filter.locationType === value;
            return (
              <button
                key={value}
                onClick={() => onFilterChange({ ...filter, locationType: value })}
                className={`flex items-center gap-1.5 px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-inset ${
                  active
                    ? 'bg-rose-500 text-white'
                    : `${isDarkMode ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-200'}`
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Live Location toggle — starts the personal broadcast which
            powers arrival/exit alerts on geofenced places. Rose pulse-dot
            when on; muted when off. */}
        <button
          onClick={handleToggleLive}
          aria-pressed={liveOn}
          title={liveOn ? 'Live location on — tap to stop' : 'Turn on live location for arrival alerts'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
            liveOn
              ? 'bg-rose-500 text-white'
              : isDarkMode
                ? 'bg-white/10 text-gray-300 hover:bg-white/15'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {liveOn ? (
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-white/70 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          ) : (
            <Radio size={12} />
          )}
          {liveOn ? 'Live' : 'Go Live'}
        </button>

        {/* Status filters — muted at rest, color-on-active. Matches the
            People sidebar tag-dot pattern: chroma earns its appearance. */}
        <div className="flex gap-1">
          {STATUS_OPTIONS.map(s => {
            const active = noStatusFilter || filter.status.includes(s.value);
            return (
              <button
                key={s.value}
                onClick={() => toggleStatus(s.value)}
                title={s.label}
                aria-label={`${s.label} status filter`}
                aria-pressed={active}
                className={`w-5 h-5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
                  active ? '' : 'opacity-30'
                }`}
                style={{
                  backgroundColor: active ? s.color : 'currentColor',
                  color: isDarkMode ? '#52525b' : '#a1a1aa',
                }}
              />
            );
          })}
        </div>

        {/* Circle chips */}
        {circles.length > 0 && (
          <>
            <div className={`w-px h-5 ${isDarkMode ? 'bg-white/15' : 'bg-gray-200'}`} />
            <div className="flex gap-1 flex-wrap">
              {circles.slice(0, 5).map(c => {
                const active = filter.circles.length === 0 || filter.circles.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCircle(c.id)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                      active ? 'opacity-100' : 'opacity-40'
                    }`}
                    style={{ backgroundColor: c.color + '33', color: c.color, border: `1px solid ${c.color}66` }}
                  >
                    {c.icon && <span>{c.icon}</span>}
                    {c.name}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MapFilterBar;
