// ─────────────────────────────────────────────────────────────────────────────
// AI strip + accepted-route shared types.
//
// Hoisted out of PulseMapView so the AiStrip sub-component (still in
// PulseMapView at the time this module was extracted), the future
// useMapAiProposals hook, and the DEV e2e harness can all reference these
// shapes without import cycles through the host component.
// ─────────────────────────────────────────────────────────────────────────────

import type { AtlasProposal, RouteProposal, WeekProposal } from '../../../services/mapAIService';
import type { LatLng } from '../provider/types';

export type AiProposal =
  | { kind: 'route';   proposal: RouteProposal }
  | { kind: 'plan';    proposal: WeekProposal }
  | { kind: 'insight'; proposal: AtlasProposal };

export type AiState =
  | { status: 'idle' }
  | { status: 'fetching' }
  | { status: 'ready'; data: AiProposal }
  | { status: 'none' }
  | { status: 'paused'; until: number }
  // Reorder mode is entered from a 'ready' route proposal. orderedIds is a
  // working draft the user mutates via drag; baseProposal is the snapshot we
  // revert to on Cancel without losing the AI's original rationale.
  | { status: 'reordering'; orderedIds: string[]; baseProposal: RouteProposal };

export interface AcceptedRoute {
  orderedMarkerKeys: string[];
  // Renderer-neutral (P8): was google.maps.LatLngLiteral[]. The shape is
  // structurally identical, so every consumer (the Google <Polyline> overlay
  // and the MapLibre GeoJSON layer) still typechecks — this only removes the
  // hard google.maps dependency from the shared route type.
  path: LatLng[];
  durationMin: number;
  arrivesAt: Date;
}
