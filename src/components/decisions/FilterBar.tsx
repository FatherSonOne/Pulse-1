import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  List,
  Circle,
  PlayCircle,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
  X,
  Calendar,
  ChevronDown,
  MapPin,
} from 'lucide-react';
import { Place } from '../../types/placeTypes';
import './FilterBar.css';

export interface FilterState {
  search: string;
  status: 'all' | 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled';
  priority?: 'high' | 'medium' | 'low';
  dateRange?: { start: Date; end: Date };
  /**
   * Place filter: undefined = all, null = no place attached, string = a specific place_id.
   * The "no place" option is helpful for finding tasks that haven't been geo-tagged yet.
   */
  placeId?: string | null;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  /** Optional list of places visible to the user. Hides the place filter when empty/undefined. */
  availablePlaces?: Place[];
}

const TASK_STATUS_OPTIONS = [
  { value: 'all', label: 'All Tasks', icon: List },
  { value: 'todo', label: 'To Do', icon: Circle },
  { value: 'in_progress', label: 'In Progress', icon: PlayCircle },
  { value: 'in_review', label: 'In Review', icon: Eye },
  { value: 'blocked', label: 'Blocked', icon: AlertCircle },
  { value: 'done', label: 'Done', icon: CheckCircle },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle },
] as const;

const PRIORITY_OPTIONS = [
  { value: undefined, label: 'All Priorities' },
  { value: 'high', label: 'High Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'low', label: 'Low Priority' },
] as const;

type DateRangePreset = '' | '7d' | '30d' | '90d';

export const FilterBar: React.FC<FilterBarProps> = ({ filters, onChange, availablePlaces }) => {
  // Debounced search: local input state syncs to parent after 300ms idle
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Track which preset is active locally so the <select>'s displayed label
  // reflects the user's choice. FilterState only stores the resolved
  // {start, end} window — preserving the preset key here avoids reverse-
  // deriving "7d/30d/90d" from a date diff (brittle around DST + month edges).
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('');

  // Reset preset when an external clear wipes filters.dateRange.
  useEffect(() => {
    if (!filters.dateRange) setDateRangePreset('');
  }, [filters.dateRange]);

  useEffect(() => {
    // Sync external changes back (e.g. clear filters)
    setLocalSearch(filters.search);
  }, [filters.search]);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ ...filters, search: value });
    }, 300);
  };

  // Cleanup on unmount
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const hasActiveFilters =
    filters.search !== '' ||
    filters.status !== 'all' ||
    filters.priority !== undefined ||
    filters.dateRange !== undefined ||
    filters.placeId !== undefined;

  const handleClearFilters = () => {
    setDateRangePreset('');
    onChange({
      search: '',
      status: 'all',
      priority: undefined,
      dateRange: undefined,
      placeId: undefined,
    });
  };

  const handlePlaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '') onChange({ ...filters, placeId: undefined });
    else if (value === '__none__') onChange({ ...filters, placeId: null });
    else onChange({ ...filters, placeId: value });
  };

  const placeFilterValue =
    filters.placeId === undefined ? '' : filters.placeId === null ? '__none__' : filters.placeId;
  const selectedPlace =
    filters.placeId && filters.placeId !== null
      ? availablePlaces?.find(p => p.id === filters.placeId)
      : undefined;

  // handleSearchChange is replaced by handleSearchInputChange with debounce above

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...filters,
      status: e.target.value as FilterState['status']
    });
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value === '' ? undefined : e.target.value as 'high' | 'medium' | 'low';
    onChange({ ...filters, priority: value });
  };

  const handleDateRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as DateRangePreset;
    setDateRangePreset(value);
    if (value === '') {
      onChange({ ...filters, dateRange: undefined });
      return;
    }
    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);
    switch (value) {
      case '7d': start.setDate(start.getDate() - 7); break;
      case '30d': start.setDate(start.getDate() - 30); break;
      case '90d': start.setDate(start.getDate() - 90); break;
    }
    onChange({ ...filters, dateRange: { start, end } });
  };

  const selectedStatusOption = TASK_STATUS_OPTIONS.find(opt => opt.value === filters.status);
  const StatusIcon = selectedStatusOption?.icon || List;

  return (
    <div className="filter-bar">
      <div className="filter-bar__controls">
        {/* Search Input */}
        <div className="filter-bar__search">
          <Search className="filter-bar__search-icon" size={16} />
          <input
            type="text"
            placeholder="Search tasks..."
            value={localSearch}
            onChange={handleSearchInputChange}
            className="filter-bar__search-input"
          />
        </div>

        {/* Status Dropdown */}
        <div className="filter-bar__select-wrapper">
          <StatusIcon className="filter-bar__select-icon" size={16} />
          <select
            value={filters.status}
            onChange={handleStatusChange}
            className="filter-bar__select"
          >
            {TASK_STATUS_OPTIONS.map(option => {
              const OptionIcon = option.icon;
              return (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              );
            })}
          </select>
          <ChevronDown className="filter-bar__select-chevron" size={16} />
        </div>

        {/* Priority Filter */}
        <div className="filter-bar__select-wrapper">
          <select
            value={filters.priority || ''}
            onChange={handlePriorityChange}
            className="filter-bar__select"
          >
            {PRIORITY_OPTIONS.map(option => (
              <option
                key={option.value || 'all'}
                value={option.value || ''}
              >
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="filter-bar__select-chevron" size={16} />
        </div>

        {/* Date Range */}
        <div className="filter-bar__select-wrapper">
          <Calendar className="filter-bar__select-icon" size={16} />
          <select
            className="filter-bar__select"
            value={dateRangePreset}
            onChange={handleDateRangeChange}
            aria-label="Filter by date range"
          >
            <option value="">All Dates</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <ChevronDown className="filter-bar__select-chevron" size={16} />
        </div>

        {/* Place filter — hidden when the user has zero saved places. */}
        {availablePlaces && availablePlaces.length > 0 && (
          <div className="filter-bar__select-wrapper">
            <MapPin className="filter-bar__select-icon" size={16} />
            <select
              className="filter-bar__select"
              value={placeFilterValue}
              onChange={handlePlaceChange}
              aria-label="Filter by place"
            >
              <option value="">All Locations</option>
              <option value="__none__">No location</option>
              {availablePlaces.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name || p.address || 'Saved place'}
                </option>
              ))}
            </select>
            <ChevronDown className="filter-bar__select-chevron" size={16} />
          </div>
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="filter-bar__clear"
            title="Clear all filters"
          >
            <X size={16} />
            Clear
          </button>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="filter-bar__active">
          <span className="filter-bar__active-label">Active filters:</span>
          {filters.search && (
            <span className="filter-bar__active-tag">
              Search: "{filters.search}"
            </span>
          )}
          {filters.status !== 'all' && (
            <span className="filter-bar__active-tag">
              Status: {selectedStatusOption?.label}
            </span>
          )}
          {filters.priority && (
            <span className="filter-bar__active-tag">
              Priority: {filters.priority}
            </span>
          )}
          {filters.dateRange && dateRangePreset && (
            <span className="filter-bar__active-tag">
              Dates: {dateRangePreset === '7d' ? 'Last 7 days' : dateRangePreset === '30d' ? 'Last 30 days' : 'Last 90 days'}
            </span>
          )}
          {filters.placeId !== undefined && (
            <span className="filter-bar__active-tag">
              Location: {filters.placeId === null
                ? 'None'
                : (selectedPlace?.name || selectedPlace?.address || 'Selected')}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
