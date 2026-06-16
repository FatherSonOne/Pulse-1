// ─────────────────────────────────────────────────────────────────────────────
// coralCockpitStyle — Direction D (P3) base-style + density tests.
//
// Locks the "honest, fully-styled, not faked" guarantee that justified building
// Contrast/density for real instead of shipping them disabled: Contrast is a
// distinct, complete palette (every field set), and density GENUINELY drops label
// layers rather than being a no-op toggle. coralLayers is pure (no network — only
// buildCoralStyle fetches), so this needs no mocks.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { PALETTES, coralLayers } from './coralCockpitStyle';
import type { MapBaseStyle } from '../sub/mapLens';

const VARIANTS: MapBaseStyle[] = ['light', 'dark', 'contrast'];

describe('coralCockpitStyle — palettes', () => {
  it('exposes light, dark, and the net-new contrast palette as DISTINCT palettes', () => {
    expect(PALETTES.light.canvas).not.toBe(PALETTES.dark.canvas);
    expect(PALETTES.contrast.canvas).not.toBe(PALETTES.light.canvas);
    expect(PALETTES.contrast.canvas).not.toBe(PALETTES.dark.canvas);
  });

  it('every variant is FULLY styled — no palette field is empty (no half-built variant)', () => {
    const fields = Object.keys(PALETTES.light);
    for (const v of VARIANTS) {
      for (const f of fields) {
        expect((PALETTES[v] as unknown as Record<string, string>)[f], `${v}.${f}`).toBeTruthy();
      }
    }
  });

  it('keeps the rose motorway accent on every variant (coral = signal)', () => {
    for (const v of VARIANTS) {
      expect(PALETTES[v].roadHighwayStroke).toBeTruthy();
    }
  });
});

describe('coralCockpitStyle — density layer filtering', () => {
  const layerIds = (density: 'high' | 'low') => coralLayers(PALETTES.light, density).map(l => l.id);

  it('high density keeps the full label set (today\'s behavior)', () => {
    expect(layerIds('high')).toEqual(
      expect.arrayContaining(['label-water', 'label-road', 'label-place-other', 'label-place-city']),
    );
  });

  it('low density hides minor labels but keeps city labels + roads', () => {
    const low = layerIds('low');
    expect(low).not.toContain('label-water');
    expect(low).not.toContain('label-place-other');
    expect(low).toContain('label-place-city'); // cities always shown
    expect(low).toContain('label-road'); // thinned, not dropped
  });

  it('low density thins road labels by raising their minzoom (12 → 14)', () => {
    const high = coralLayers(PALETTES.light, 'high').find(l => l.id === 'label-road');
    const low = coralLayers(PALETTES.light, 'low').find(l => l.id === 'label-road');
    expect((high as { minzoom?: number } | undefined)?.minzoom).toBe(12);
    expect((low as { minzoom?: number } | undefined)?.minzoom).toBe(14);
  });

  it('density only filters labels — base geometry is untouched', () => {
    expect(layerIds('low')).toEqual(
      expect.arrayContaining(['background', 'water', 'road-motorway', 'building', 'boundary-country']),
    );
  });

  it('defaults to high when density is omitted (backward compatible)', () => {
    expect(coralLayers(PALETTES.light).map(l => l.id)).toContain('label-water');
  });
});
