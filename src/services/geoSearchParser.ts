// ============================================================
// Geo modifier parser for the global search composer (B3 / #35).
//
// Parses trailing geographic constraints off a free-text search
// query so the spatial layer can filter results to a radius. The
// parser is pure — no I/O, no fetches — so it can run on every
// keystroke without cost.
//
// Recognised forms (last match wins, most-specific first):
//
//   <q> within <N> mi of <place>
//   <q> within <N> km of <place>
//   <q> near <place> within <N> mi
//   <q> near me within <N> mi
//   <q> within <N> mi              (bare radius -> "near me")
//   <q> near me
//   <q> near <place>
//
// "<place>" is taken verbatim and handed to the geocoder later.
// If the geocoder fails, the spatial filter excludes everything
// (callers should fall back to the unfiltered list).
// ============================================================

export type GeoFilterKind = 'near-me' | 'near-place';

export interface GeoFilter {
  kind: GeoFilterKind;
  /** Verbatim place text — only for kind='near-place'. */
  placeQuery?: string;
  radiusMiles: number;
}

export interface ParsedGeoQuery {
  /** The query stripped of any geo modifier. */
  baseQuery: string;
  geoFilter: GeoFilter | null;
}

const DEFAULT_RADIUS_MILES = 25;
const KM_PER_MI = 0.621371;

const UNIT = '(mi|miles?|km|kilometers?)';
const NUM = '(\\d+(?:\\.\\d+)?)';

const RE_WITHIN_OF_PLACE   = new RegExp(`\\s+within\\s+${NUM}\\s*${UNIT}\\s+of\\s+(.+?)$`, 'i');
const RE_NEAR_PLACE_WITHIN = new RegExp(`\\s+near\\s+(.+?)\\s+within\\s+${NUM}\\s*${UNIT}$`, 'i');
const RE_NEAR_ME_WITHIN    = new RegExp(`\\s+near\\s+me\\s+within\\s+${NUM}\\s*${UNIT}$`, 'i');
const RE_WITHIN            = new RegExp(`\\s+within\\s+${NUM}\\s*${UNIT}$`, 'i');
const RE_NEAR_ME           = /\s+near\s+me$/i;
const RE_NEAR_PLACE        = /\s+near\s+(.+?)$/i;

function unitToMiles(value: number, unit: string): number {
  return /^k/i.test(unit) ? value * KM_PER_MI : value;
}

export function parseGeoQuery(query: string): ParsedGeoQuery {
  const padded = ' ' + query.trim();

  let m = padded.match(RE_WITHIN_OF_PLACE);
  if (m) {
    return {
      baseQuery: padded.replace(RE_WITHIN_OF_PLACE, '').trim(),
      geoFilter: {
        kind: 'near-place',
        placeQuery: m[3].trim(),
        radiusMiles: unitToMiles(parseFloat(m[1]), m[2]),
      },
    };
  }

  m = padded.match(RE_NEAR_PLACE_WITHIN);
  if (m) {
    return {
      baseQuery: padded.replace(RE_NEAR_PLACE_WITHIN, '').trim(),
      geoFilter: {
        kind: 'near-place',
        placeQuery: m[1].trim(),
        radiusMiles: unitToMiles(parseFloat(m[2]), m[3]),
      },
    };
  }

  m = padded.match(RE_NEAR_ME_WITHIN);
  if (m) {
    return {
      baseQuery: padded.replace(RE_NEAR_ME_WITHIN, '').trim(),
      geoFilter: {
        kind: 'near-me',
        radiusMiles: unitToMiles(parseFloat(m[1]), m[2]),
      },
    };
  }

  m = padded.match(RE_WITHIN);
  if (m) {
    return {
      baseQuery: padded.replace(RE_WITHIN, '').trim(),
      geoFilter: {
        kind: 'near-me',
        radiusMiles: unitToMiles(parseFloat(m[1]), m[2]),
      },
    };
  }

  if (RE_NEAR_ME.test(padded)) {
    return {
      baseQuery: padded.replace(RE_NEAR_ME, '').trim(),
      geoFilter: { kind: 'near-me', radiusMiles: DEFAULT_RADIUS_MILES },
    };
  }

  m = padded.match(RE_NEAR_PLACE);
  if (m) {
    return {
      baseQuery: padded.replace(RE_NEAR_PLACE, '').trim(),
      geoFilter: {
        kind: 'near-place',
        placeQuery: m[1].trim(),
        radiusMiles: DEFAULT_RADIUS_MILES,
      },
    };
  }

  return { baseQuery: query.trim(), geoFilter: null };
}

/** Human-readable description of a GeoFilter for the active-filter chip. */
export function describeGeoFilter(f: GeoFilter): string {
  const radius = f.radiusMiles % 1 === 0
    ? `${f.radiusMiles.toFixed(0)} mi`
    : `${f.radiusMiles.toFixed(1)} mi`;
  if (f.kind === 'near-me') return `Near me · ${radius}`;
  return `Near ${f.placeQuery} · ${radius}`;
}
