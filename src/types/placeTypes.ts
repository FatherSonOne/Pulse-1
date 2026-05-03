// ============================================================
// Universal Place types
//
// A Place is a first-class location record. Any entity (contact,
// task, decision, event) can attach to one or more places via the
// EntityPlace join. This is what lets Map become a cross-section
// spatial layer instead of a contact-only view.
//
// Schema lives in supabase/migrations/20260503000006_*.sql.
// Backfill from contact.home_lat/work_lat lives in 20260503000007_*.sql.
// ============================================================

/** Place classification — drives default marker styling and grouping. */
export type PlaceType = 'home' | 'work' | 'site' | 'venue' | 'meeting' | 'custom';

/** Entities that can attach to a place. Extend as new sections adopt. */
export type PlaceEntityType = 'contact' | 'task' | 'decision' | 'event' | 'meeting';

/**
 * Role describes WHY an entity is attached to a place — the same
 * place can be a contact's `home` and another contact's `meeting_point`.
 * `primary` is the default for entities with only one location.
 */
export type PlaceRole =
  | 'home'
  | 'work'
  | 'venue'
  | 'site'
  | 'meeting_point'
  | 'completion_geofence'
  | 'primary';

export interface Place {
  id: string;
  ownerUserId: string;
  /** When set, the place is a workspace-shared location visible to all members. */
  workspaceId: string | null;
  lat: number;
  lng: number;
  address: string | null;
  name: string | null;
  type: PlaceType;
  /** Hex color for map rendering. Falls back to type-based default if null. */
  color: string | null;
  /** Optional geofence radius in meters; when set, enter/exit events fire. */
  geofenceRadiusM: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

/** A row of the entity_places junction table. */
export interface EntityPlace {
  entityType: PlaceEntityType;
  entityId: string;
  placeId: string;
  role: PlaceRole;
  createdAt: Date;
}

/**
 * Convenience shape for "place plus the role it plays for the
 * requesting entity" — what list/map renderers usually need.
 */
export interface PlaceWithRole extends Place {
  role: PlaceRole;
}

/** Default marker color per place type — mirrors the Coral Cockpit token system. */
export const PLACE_TYPE_COLORS: Record<PlaceType, string> = {
  home:    '#f43f5e', // rose-pulse
  work:    '#fb7185', // rose-bright
  site:    '#f59e0b', // amber for field sites
  venue:   '#a855f7', // violet for events / public venues
  meeting: '#06b6d4', // cyan for meetings (matches LIVE_LOCATION_COLOR family)
  custom:  '#6b7280', // neutral
};

/** Maps a raw DB row (snake_case) to the camelCase Place type. */
export function rowToPlace(row: Record<string, unknown>): Place {
  return {
    id:               String(row.id),
    ownerUserId:      String(row.owner_user_id),
    workspaceId:      (row.workspace_id ?? null) as string | null,
    lat:              Number(row.lat),
    lng:              Number(row.lng),
    address:          (row.address ?? null) as string | null,
    name:             (row.name ?? null) as string | null,
    type:             ((row.type as PlaceType) ?? 'custom'),
    color:            (row.color ?? null) as string | null,
    geofenceRadiusM:  row.geofence_radius_m == null ? null : Number(row.geofence_radius_m),
    notes:            (row.notes ?? null) as string | null,
    createdAt:        new Date(String(row.created_at)),
    updatedAt:        new Date(String(row.updated_at)),
    createdBy:        (row.created_by ?? null) as string | null,
  };
}

/** Maps a raw entity_places row to the camelCase EntityPlace type. */
export function rowToEntityPlace(row: Record<string, unknown>): EntityPlace {
  return {
    entityType: row.entity_type as PlaceEntityType,
    entityId:   String(row.entity_id),
    placeId:    String(row.place_id),
    role:       row.role as PlaceRole,
    createdAt:  new Date(String(row.created_at)),
  };
}
