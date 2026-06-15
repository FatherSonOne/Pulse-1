// ─────────────────────────────────────────────────────────────────────────────
// coralCockpitStyle — Pulse's "Coral Cockpit" cartography as a MapLibre style
// (light + dark). P3 of the MapLibre rebrand: replaces the stand-in OpenFreeMap
// `liberty` style with Pulse's own palette, re-expressed from the Google path's
// `mapService.ts` MAP_STYLE_LIGHT / MAP_STYLE_DARK in MapLibre's richer
// style-spec form (water, roads, parks, buildings, boundaries, labels).
//
// Design intent (mirrors mapService.ts): tinted neutrals carry 90%+ of the
// surface; rose appears ONLY on the motorway backbone — signal, not decoration,
// the same role coral plays everywhere else in Pulse.
//
// Tiles: we keep OpenFreeMap's free public `openmaptiles` vector source. We fetch
// the liberty style once only to INHERIT its correct `sources` / `glyphs` /
// `sprite` URLs (so they're never hard-coded and can't drift), then throw away
// its layers and substitute the Coral set below. A self-hosted Protomaps PMTiles
// source is a clean later swap — only the `sources` block + `source-layer` names
// would change; the palette stays.
//
// Type-only maplibre import → this module adds nothing to any bundle.
// ─────────────────────────────────────────────────────────────────────────────

import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

// OpenFreeMap public instance — free, no API key, no signup. We fetch it only to
// borrow its sources/glyphs/sprite; on failure we return this URL verbatim as a
// safe full-credit fallback (light liberty, no Coral styling, no dark mode — but
// the map still renders and is never under-attributed).
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Attribution. The OSM data credit is LEGALLY required (ODbL); OpenMapTiles +
// OpenFreeMap are courtesy. "MapLibre" (BSD-licensed, NOT required) is dropped.
export const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
  '© <a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

// The vector source id inside the liberty style. The existing MapLibreCanvas
// attribution patch already assumed this id; we keep the assumption in one place.
const OMT_SOURCE = 'openmaptiles';

// ─── Coral Cockpit palette ───────────────────────────────────────────────────
// Each field maps 1:1 to a tone from mapService.ts MAP_STYLE_LIGHT / DARK.
interface CoralPalette {
  canvas: string;           // base geometry / background  (--paper-warm light / true-black dark)
  landNatural: string;      // landscape.natural / landcover — a half-step from canvas
  park: string;             // poi.park geometry
  water: string;            // water geometry
  building: string;         // building fills (Google left these at geometry tone)
  roadLocal: string;        // road.local fill
  roadArterial: string;     // road.arterial / primary / trunk fill
  roadHighwayFill: string;  // road.highway geometry.fill (rose-tinted)
  roadHighwayStroke: string;// road.highway geometry.stroke (the rose accent)
  boundary: string;         // administrative stroke
  labelText: string;        // labels.text.fill
  labelHalo: string;        // labels.text.stroke
  waterLabel: string;       // water labels.text.fill
  roadLabel: string;        // road labels.text.fill
  roadLabelHalo: string;    // road labels.text.stroke
  adminLabel: string;       // administrative labels.text.fill
  localityLabel: string;    // administrative.locality labels.text.fill (cities/towns)
}

// Mirrors MAP_STYLE_LIGHT (mapService.ts ~L47–80).
const LIGHT: CoralPalette = {
  canvas: '#f4f1ee',
  landNatural: '#ece8e3',
  park: '#e6ece4',
  water: '#dfe3e0',
  building: '#ece8e3',
  roadLocal: '#fafafa',
  roadArterial: '#ebe7e3',
  roadHighwayFill: '#fde2e6',
  roadHighwayStroke: '#fda4af',
  boundary: '#d9d3cc',
  labelText: '#52525b',
  labelHalo: '#f4f1ee',
  waterLabel: '#78716c',
  roadLabel: '#52525b',
  roadLabelHalo: '#fafafa',
  adminLabel: '#78716c',
  localityLabel: '#52525b',
};

// Mirrors MAP_STYLE_DARK (mapService.ts ~L82–112).
const DARK: CoralPalette = {
  canvas: '#0a0a0a',
  landNatural: '#0d0d0d',
  park: '#0e1410',
  water: '#070a0d',
  building: '#141414',
  roadLocal: '#171717',
  roadArterial: '#1f1f1f',
  roadHighwayFill: '#2a0710',
  roadHighwayStroke: '#9f1239',
  boundary: '#27272a',
  labelText: '#b4b4b8',
  labelHalo: '#0a0a0a',
  waterLabel: '#52525b',
  roadLabel: '#a1a1aa',
  roadLabelHalo: '#0a0a0a',
  adminLabel: '#71717a',
  localityLabel: '#a1a1aa',
};

// Prefer an English label when present, else the local name (OpenMapTiles ships
// both `name` and `name:en`).
const NAME_FIELD = ['coalesce', ['get', 'name:en'], ['get', 'name']];

// ─── Coral Cockpit layers (OpenMapTiles v3 schema) ──────────────────────────
// Draw order bottom→top: background → land → water → roads → boundaries →
// labels. POI + transit are intentionally omitted (Google path hides them).
function coralLayers(p: CoralPalette): LayerSpecification[] {
  const layers = [
    { id: 'background', type: 'background', paint: { 'background-color': p.canvas } },

    // Natural land (wood / grass / sand) — a half-step from the canvas.
    {
      id: 'landcover',
      type: 'fill',
      source: OMT_SOURCE,
      'source-layer': 'landcover',
      paint: { 'fill-color': p.landNatural, 'fill-opacity': 0.7 },
    },
    // Parks (OMT v3 `park` source-layer). Renders nothing if absent — harmless.
    {
      id: 'park',
      type: 'fill',
      source: OMT_SOURCE,
      'source-layer': 'park',
      paint: { 'fill-color': p.park, 'fill-opacity': 0.8 },
    },

    // Water body + waterways.
    {
      id: 'water',
      type: 'fill',
      source: OMT_SOURCE,
      'source-layer': 'water',
      paint: { 'fill-color': p.water },
    },
    {
      id: 'waterway',
      type: 'line',
      source: OMT_SOURCE,
      'source-layer': 'waterway',
      paint: {
        'line-color': p.water,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 1.4],
      },
    },

    // Buildings — fade in at street zoom, kept subtle so pins always win.
    {
      id: 'building',
      type: 'fill',
      source: OMT_SOURCE,
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-color': p.building,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 15, 0.6],
      },
    },

    // ─── Roads, painted thin→wide. Local first (under), then arterial, then
    // primary/trunk, then the motorway casing + rose fill on top. ──────────
    {
      id: 'road-minor',
      type: 'line',
      source: OMT_SOURCE,
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['minor', 'service', 'track'], true, false],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': p.roadLocal,
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 2, 20, 8],
      },
    },
    {
      id: 'road-arterial',
      type: 'line',
      source: OMT_SOURCE,
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['secondary', 'tertiary'], true, false],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': p.roadArterial,
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 13, 1.6, 18, 11],
      },
    },
    {
      id: 'road-primary',
      type: 'line',
      source: OMT_SOURCE,
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['primary', 'trunk'], true, false],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': p.roadArterial,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 12, 2, 18, 13],
      },
    },
    // Motorway casing — the quiet rose accent. Slightly wider than its fill so a
    // thin rose edge reads (mirrors Google's geometry.stroke weight 0.3).
    {
      id: 'road-motorway-casing',
      type: 'line',
      source: OMT_SOURCE,
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['motorway'], true, false],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': p.roadHighwayStroke,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 10, 4, 16, 18],
        'line-opacity': 0.9,
      },
    },
    {
      id: 'road-motorway',
      type: 'line',
      source: OMT_SOURCE,
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['motorway'], true, false],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': p.roadHighwayFill,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 3, 16, 14],
      },
    },

    // ─── Administrative boundaries ───────────────────────────────────────
    {
      id: 'boundary-country',
      type: 'line',
      source: OMT_SOURCE,
      'source-layer': 'boundary',
      filter: ['==', ['get', 'admin_level'], 2],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': p.boundary,
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 10, 1.6],
        'line-opacity': 0.7,
      },
    },
    {
      id: 'boundary-state',
      type: 'line',
      source: OMT_SOURCE,
      'source-layer': 'boundary',
      filter: ['==', ['get', 'admin_level'], 4],
      paint: {
        'line-color': p.boundary,
        'line-width': 0.6,
        'line-opacity': 0.5,
        'line-dasharray': [2, 2],
      },
    },

    // ─── Labels — water, roads, places. POI + transit stay off. ───────────
    {
      id: 'label-water',
      type: 'symbol',
      source: OMT_SOURCE,
      'source-layer': 'water_name',
      layout: {
        'text-field': NAME_FIELD,
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
      },
      paint: {
        'text-color': p.waterLabel,
        'text-halo-color': p.labelHalo,
        'text-halo-width': 1,
      },
    },
    {
      id: 'label-road',
      type: 'symbol',
      source: OMT_SOURCE,
      'source-layer': 'transportation_name',
      minzoom: 12,
      layout: {
        'text-field': NAME_FIELD,
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'symbol-placement': 'line',
        'text-rotation-alignment': 'map',
      },
      paint: {
        'text-color': p.roadLabel,
        'text-halo-color': p.roadLabelHalo,
        'text-halo-width': 1.25,
      },
    },
    {
      id: 'label-place-other',
      type: 'symbol',
      source: OMT_SOURCE,
      'source-layer': 'place',
      filter: ['match', ['get', 'class'],
        ['country', 'state', 'province', 'village', 'suburb', 'neighbourhood', 'hamlet'], true, false],
      layout: {
        'text-field': NAME_FIELD,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 8, 13],
      },
      paint: {
        'text-color': p.adminLabel,
        'text-halo-color': p.labelHalo,
        'text-halo-width': 1,
      },
    },
    {
      id: 'label-place-city',
      type: 'symbol',
      source: OMT_SOURCE,
      'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
      layout: {
        'text-field': NAME_FIELD,
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 10, 16],
      },
      paint: {
        'text-color': p.localityLabel,
        'text-halo-color': p.labelHalo,
        'text-halo-width': 1.25,
      },
    },
  ];
  // The style-spec expression unions are stricter than the literals above can be
  // inferred to; this is the only type escape and it's localized to the build.
  return layers as unknown as LayerSpecification[];
}

// ─────────────────────────────────────────────────────────────────────────────
// buildCoralStyle — assemble the full style for the active theme. Fetches liberty
// only to inherit its sources/glyphs/sprite; substitutes the Coral layers; patches
// attribution. On any network/parse failure returns the plain liberty URL (safe
// full-credit fallback — light, un-Coral, but always renders).
// ─────────────────────────────────────────────────────────────────────────────
export async function buildCoralStyle(isDarkMode: boolean): Promise<StyleSpecification | string> {
  const palette = isDarkMode ? DARK : LIGHT;
  try {
    const res = await fetch(OPENFREEMAP_STYLE);
    if (!res.ok) return OPENFREEMAP_STYLE;
    const base = await res.json();
    if (!base?.sources?.[OMT_SOURCE]) return OPENFREEMAP_STYLE; // unexpected shape → safe fallback
    base.sources[OMT_SOURCE].attribution = ATTRIBUTION;
    const style = {
      version: 8,
      name: `Pulse Coral Cockpit (${isDarkMode ? 'dark' : 'light'})`,
      glyphs: base.glyphs,
      sprite: base.sprite,
      sources: base.sources,
      layers: coralLayers(palette),
    };
    return style as StyleSpecification;
  } catch {
    return OPENFREEMAP_STYLE; // network/parse failure → safe full-credit fallback
  }
}
