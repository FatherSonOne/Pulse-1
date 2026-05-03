import React from 'react';
import { Briefcase, Globe, Home, Search } from 'lucide-react';
import { ContactCircle } from '../../../types/contactCircleTypes';

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
}

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

const MapFilterBar: React.FC<MapFilterBarProps> = ({ filter, circles, isDarkMode, onFilterChange }) => {
  const bg = isDarkMode ? 'bg-black/75 border-white/10' : 'bg-white/90 border-gray-200';
  const text = isDarkMode ? 'text-white' : 'text-gray-900';

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
