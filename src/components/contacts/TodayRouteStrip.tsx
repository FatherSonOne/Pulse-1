// ============================================================
// TodayRouteStrip (B2 / #35)
//
// Horizontal strip at the top of TodayView showing the day's
// geographic arc: every calendar event with a location, in time
// order, with travel-time hints between consecutive stops.
//
// Operator goal: see "9:00 → coffee → 11:30 → office → 1pm doctor"
// laid out left-to-right with "32 min by car" between stops, so a
// 90-min gap on opposite sides of town is obvious BEFORE committing
// to the day. Tapping a dot expands a 140px MapPreview underneath
// without leaving the Today tab.
// ============================================================

import React, { useEffect, useState } from 'react';
import { Car, MapPin } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { geocodeAddress } from '../../services/locationService';
import { getTravelTime, formatTravelTime, type TravelTime } from '../../services/directionsService';
import MapPreview from '../map/MapPreview';
import type { CalendarEvent } from '../../types';
import './TodayRouteStrip.css';

interface Stop {
  event: CalendarEvent;
  lat: number;
  lng: number;
}

interface TodayRouteStripProps {
  isDarkMode?: boolean;
}

function formatStopTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

const TodayRouteStrip: React.FC<TodayRouteStripProps> = ({ isDarkMode = false }) => {
  const [stops, setStops] = useState<Stop[]>([]);
  const [travels, setTravels] = useState<Array<TravelTime | null>>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Resolve today's events + their geocodes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const events = await dataService.getEvents(startOfToday(), endOfToday());
        if (cancelled) return;
        const located = events
          .filter(e => e.location && e.location.trim())
          .sort((a, b) => a.start.getTime() - b.start.getTime());

        const resolved: Stop[] = [];
        for (const ev of located) {
          const coords = await geocodeAddress(ev.location!);
          if (cancelled) return;
          if (coords) resolved.push({ event: ev, lat: coords.lat, lng: coords.lng });
        }
        if (!cancelled) setStops(resolved);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Resolve travel times for each consecutive pair.
  useEffect(() => {
    if (stops.length < 2) { setTravels([]); return; }
    let cancelled = false;
    (async () => {
      const out: Array<TravelTime | null> = [];
      for (let i = 0; i < stops.length - 1; i++) {
        const tt = await getTravelTime(
          { lat: stops[i].lat, lng: stops[i].lng },
          { lat: stops[i + 1].lat, lng: stops[i + 1].lng },
        );
        if (cancelled) return;
        out.push(tt);
      }
      if (!cancelled) setTravels(out);
    })();
    return () => { cancelled = true; };
  }, [stops]);

  if (loading || stops.length === 0) return null;

  return (
    <section
      className={`today-route-strip ${isDarkMode ? 'today-route-strip--dark' : ''}`}
      aria-label="Today's route"
    >
      <div className="today-route-strip__label">Today's route</div>
      <div className="today-route-strip__flow">
        {stops.map((stop, i) => {
          const expanded = expandedIdx === i;
          const accent = stop.event.color || '#f43f5e';
          return (
            <React.Fragment key={stop.event.id}>
              <button
                type="button"
                className={`today-route-stop ${expanded ? 'today-route-stop--expanded' : ''}`}
                onClick={() => setExpandedIdx(expanded ? null : i)}
                aria-expanded={expanded}
                aria-label={`${stop.event.title} at ${formatStopTime(stop.event.start)}`}
              >
                <span className="today-route-stop__dot" style={{ backgroundColor: accent }} />
                <span className="today-route-stop__time">{formatStopTime(stop.event.start)}</span>
                <span className="today-route-stop__title">{stop.event.title}</span>
              </button>
              {i < stops.length - 1 && (
                <span className="today-route-travel" aria-hidden={travels[i] ? 'false' : 'true'}>
                  <Car size={10} className="today-route-travel__icon" />
                  <span className="today-route-travel__text">
                    {travels[i] ? formatTravelTime(travels[i]!) : '— min'}
                  </span>
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {expandedIdx !== null && stops[expandedIdx] && (
        <div className="today-route-preview">
          <div className="today-route-preview__address">
            <MapPin size={12} className="today-route-preview__pin" />
            <span>{stops[expandedIdx].event.location}</span>
          </div>
          <MapPreview
            lat={stops[expandedIdx].lat}
            lng={stops[expandedIdx].lng}
            height={140}
            isDarkMode={isDarkMode}
            addressOverride={stops[expandedIdx].event.location ?? undefined}
          />
        </div>
      )}
    </section>
  );
};

export default TodayRouteStrip;
