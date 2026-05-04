// Step 4: Rhythm.
//
// Set the dates and cadences that drive the resulting decision and tasks:
// when does this need to be decided by, when does the work need to ship,
// how often should the operator check in, when (if ever) should Pulse
// prompt for a retrospective on the outcome — and (B1.5) where, if it's
// the kind of decision that needs to land in a place.

import React, { useRef } from 'react';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import { MapPin, X } from 'lucide-react';
import { DatePicker } from './primitives/DatePicker';
import { RadioGroup } from './primitives/RadioGroup';
import { GOOGLE_MAPS_LIBRARIES } from '../../../services/mapService';
import type { Step4Output } from './types';

interface Step4RhythmProps {
  value: Step4Output;
  onChange: (next: Step4Output) => void;
}

const CADENCE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'twice_weekly', label: 'Twice weekly' },
  { value: 'daily', label: 'Daily' },
] as const;

const REMIND_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
] as const;

const RETRO_OPTIONS = [
  { value: '0', label: 'Skip' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
] as const;

export const Step4Rhythm: React.FC<Step4RhythmProps> = ({ value, onChange }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'pulse-google-maps',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const handleVenueSelected = () => {
    const ac = autocompleteRef.current;
    if (!ac) return;
    const result = ac.getPlace();
    if (!result.geometry?.location) return;
    onChange({
      ...value,
      venue: {
        lat: result.geometry.location.lat(),
        lng: result.geometry.location.lng(),
        address: result.formatted_address ?? null,
        name: result.name ?? null,
      },
    });
  };

  const handleClearVenue = () => onChange({ ...value, venue: null });

  return (
    <div className="dw-step4">
      <header className="dw-step4-header">
        <h3 className="dw-step4-title">Set the rhythm</h3>
        <p className="dw-step4-sub">
          When does this need to land, and how often should Pulse nudge you.
        </p>
      </header>

      <div className="dw-step4-grid">
        <DatePicker
          label="Decide by"
          value={value.decideByDate}
          onChange={(d) => onChange({ ...value, decideByDate: d })}
          required
          hint="The day a decision must be made by."
        />
        <DatePicker
          label="Ship by"
          value={value.shipByDate}
          onChange={(d) => onChange({ ...value, shipByDate: d })}
          hint="Optional. When the work needs to be done."
        />
      </div>

      <RadioGroup
        label="Check-in cadence"
        value={value.checkInCadence}
        onChange={(v) => onChange({ ...value, checkInCadence: v as Step4Output['checkInCadence'] })}
        options={[...CADENCE_OPTIONS]}
        hint="Pulse surfaces a check-in at this interval until the decision is made."
      />

      <RadioGroup
        label="Remind before decide-by"
        value={String(value.remindBeforeDays)}
        onChange={(v) => onChange({ ...value, remindBeforeDays: Number(v) as Step4Output['remindBeforeDays'] })}
        options={[...REMIND_OPTIONS]}
      />

      <RadioGroup
        label="Look back on this in"
        value={String(value.retrospectiveDays)}
        onChange={(v) => onChange({ ...value, retrospectiveDays: Number(v) as Step4Output['retrospectiveDays'] })}
        options={[...RETRO_OPTIONS]}
        hint="Pulse asks how the decision turned out, this many days after it lands."
      />

      <div className="dw-step4-venue">
        <label className="dw-step4-venue-label">Venue (optional)</label>
        {value.venue ? (
          <div className="dw-step4-venue-pill">
            <MapPin size={12} className="dw-step4-venue-pin" />
            <span className="dw-step4-venue-text">
              {value.venue.name || value.venue.address || 'Saved venue'}
            </span>
            <button
              type="button"
              className="dw-step4-venue-clear"
              onClick={handleClearVenue}
              aria-label="Remove venue"
            >
              <X size={12} />
            </button>
          </div>
        ) : isLoaded ? (
          <Autocomplete
            onLoad={a => { autocompleteRef.current = a; }}
            onPlaceChanged={handleVenueSelected}
            options={{ types: ['geocode', 'establishment'] }}
          >
            <input
              type="text"
              placeholder="Where will this happen…"
              className="dw-step4-venue-input"
            />
          </Autocomplete>
        ) : (
          <p className="dw-step4-venue-loading">Loading geocoder…</p>
        )}
        <p className="dw-step4-venue-hint">
          When this decision needs a place. Pulse pins it on the map and surfaces it in detail views.
        </p>
      </div>
    </div>
  );
};
