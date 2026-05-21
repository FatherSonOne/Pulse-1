/impeccable critique Contacts (post Phase-3 IA promotion) + Map (now
top-level). Third pass, after the modal keyboard contract, segmented
Priority/Status pills, PlacePicker dedupe, SubtaskList scaffold, and the
Map→Sidebar promotion landed. Previous score 14/40 (pass 1) → 21/40
(pass 2, partial Coral Cockpit). Target: 30+/40.

## CONTEXT — what changed since pass 2

- `AppView.MAP` is now a top-level section in [src/types.ts:19](src/types.ts#L19);
  `AppView.CONTACT_MAP` is kept only as a legacy redirect.
- [src/App.tsx](src/App.tsx) renders `ContactMapView` directly for
  `AppView.MAP` (lazy-loaded). The CONTACT_MAP case is now a one-shot
  redirect to MAP.
- [src/components/Sidebar/Sidebar.tsx](src/components/Sidebar/Sidebar.tsx)
  has `Map` between `Contacts` and `Decisions & Tasks` under "Work &
  People."
- [src/components/contacts/ContactsShell.tsx](src/components/contacts/ContactsShell.tsx)
  dropped the `'map'` tab. A `View on Map` mono-uppercase chip in the
  tab bar dispatches `pulse:navigate` with `AppView.MAP`.
- TaskEditModal: ⌘Enter saves, ⌘1/2/3 switch tabs, ESC triggers a
  dirty-discard prompt that snaps to Details, save fires a toast.
- TaskEditModal: native `<select>` for Priority/Status replaced with
  segmented mono-uppercase pills. Status pills carry a leading status-
  color dot per DESIGN.md §2 Status-Stays-Status.
- PlacePicker: `dedupePlaces()` survival-ranks attached > geofence-
  configured > first; renders a `N hidden` mono chip with a truthful
  tooltip (no Settings deep-link yet — that surface doesn't exist).
- SubtaskList: empty state is now a three-row click-to-promote scaffold.
  "Generate with AI" demoted from gradient pill to mono-uppercase chip.
  Sparkles keyframe animation deleted.

Re-score these heuristics honestly. If something regressed, say so.

## TARGETS

### Part A — Contacts post-promotion

Contacts now has three tabs (Today / People / Circles) plus a right-
cluster `View on Map` deep-link chip + the legacy ⌘K hint chip. Re-
evaluate:

1. **Tab bar balance.** Was the 4th tab carrying any visual weight that
   the 3-tab bar now needs to compensate for? Audit the rhythm —
   [ContactsShell.tsx:115-165](src/components/contacts/ContactsShell.tsx#L115-L165).

2. **`View on Map` discoverability.** The chip uses JetBrains Mono
   uppercase, hidden on `<sm` viewports. Does it read as "deep-link to
   another section" or as "filter inside this section"? Cite specific
   discoverability heuristics. Should it grow an icon affordance or
   keyboard shortcut?

3. **Cross-tab keyboard contract.** [useContactsKeyboard.ts](src/components/contacts/useContactsKeyboard.ts)
   binds 1/2/3 to today/people/circles. Should there be a `4` (or `M`)
   that jumps to the standalone Map section, or is that confusing now
   that Map lives outside the Contacts module? Pick one and justify.

4. **Today route strip lives here.** [TodayRouteStrip.tsx](src/components/contacts/TodayRouteStrip.tsx)
   inside Today consumes the maps stack (`todayClusterService`) but
   lives under Contacts. Is that consistent with the Phase-3 promotion
   logic, or should TodayRouteStrip move to a standalone Today section?
   Frame the answer in IA terms.

5. **ContactsShell still imports `Search` from lucide-react for the ⌘K
   chip.** Is the chip even needed now that the global command palette
   exists? Audit.

### Part B — Standalone Map section

`AppView.MAP` renders the same `ContactMapView` the tab used to. Source
files for context:

- [src/components/contacts/map/ContactMapView.tsx](src/components/contacts/map/ContactMapView.tsx)
  — main map view
- [src/components/contacts/map/MapFilterBar.tsx](src/components/contacts/map/MapFilterBar.tsx)
  — header with status filters, Live broadcast toggle
- [src/components/contacts/map/MapContactPanel.tsx](src/components/contacts/map/MapContactPanel.tsx)
  — per-contact slide-in panel
- [src/components/map/PlacePicker.tsx](src/components/map/PlacePicker.tsx)
  — universal entity place picker

Score on:

1. **Component name leakage.** The standalone section renders
   `ContactMapView`. The directory is `src/components/contacts/map/`.
   Both names lie about the section's actual scope (any entity, not
   just contacts). Should the files relocate to `src/components/map/`
   for IA truth, or is that bikeshedding?

2. **Header IA.** The MapFilterBar currently shows: search, location-
   type toggle (All / Home / Work), Live broadcast toggle, status
   filter dots, circle chips. All five are *contact-centric*. Now that
   the section is top-level and serves tasks/decisions/meetings/events,
   what should the header surface? Propose an entity-type filter pill
   row (Contacts / Tasks / Decisions / Meetings / Events) that drives
   which markers render.

3. **Missing sub-views.** The promotion was approved on the premise
   that a standalone Map enables sub-views (Live Team, Routes,
   Geofences). None exist yet. Score Heuristic 7 (Flexibility) on the
   assumption Map is still 1 view, not N.

4. **Live broadcast toggle in the section header.** [MapFilterBar.tsx:172-193](src/components/contacts/map/MapFilterBar.tsx#L172-L193).
   This is now a section-level capability, not a contacts-feature. Is
   it positioned correctly? Compare to Salesforce Maps and HubSpot
   Visits — where do they put broadcast/share-location toggles?

5. **Empty state.** When the user opens Map with zero contacts +
   nothing geocoded, what do they see? Audit the empty path.

### Part C — Cross-section connections (verified)

This is the IA truth, code-verified at write-time. Critique should
score discoverability + cross-linkbacks against it.

**Maps stack consumers** (read by, not written to):

| Section | File | Service consumed | Visible? |
|---|---|---|---|
| Calendar (Agenda) | [CalendarAgendaView.tsx:4](src/components/CalendarAgendaView.tsx#L4) | `travelBufferService` | yes — travel chips between events |
| Calendar (Views) | [CalendarViews.tsx:4](src/components/CalendarViews.tsx#L4), `useCalendarTravelBuffers` hook | `travelBufferService` (via hook) | yes — chips in week/day view |
| Today (Contacts) | [TodayView.tsx:35](src/components/contacts/TodayView.tsx#L35), [TodayRouteStrip.tsx](src/components/contacts/TodayRouteStrip.tsx) | `todayClusterService` | yes — geo cluster strip |
| Dashboard | [Dashboard.tsx:1599](src/components/Dashboard.tsx#L1599), [Dashboard/tiles/TeamRadarTile.tsx](src/components/Dashboard/tiles/TeamRadarTile.tsx) | `teamRadarService` (polled 45s) | yes — tile in dashboard grid |
| Decisions/Tasks Hub | [DecisionTaskHub.tsx:205](src/components/decisions/DecisionTaskHub.tsx#L205) | `entity_places` (place-aware filter), `attachPlaceToEntity` | partial — filter chip |
| Decisions (Card) | [EnhancedDecisionCard.tsx:518](src/components/decisions/EnhancedDecisionCard.tsx#L518) | `PlacePicker` (venue + geofence) | yes — inline picker |
| Decisions (Activity Drawer) | [ActivityDrawer.tsx:128](src/components/decisions/activity/ActivityDrawer.tsx#L128) | `PlacePicker` | yes — drawer field |
| Tasks (Edit Modal) | [TaskEditModal.tsx:463](src/components/tasks/TaskEditModal.tsx#L463) | `PlacePicker` (primary place + geofence) | yes — inline picker |
| Search | [SearchMapView.tsx](src/components/SearchMapView.tsx) | `entity_places` via `spatialSearchService` | yes — map view inside search |

**Geofence stack writers**: PlacePicker is the single write surface
([PlacePicker.tsx:177-191](src/components/map/PlacePicker.tsx#L177-L191)).
[geofenceService.ts](src/services/geofenceService.ts) + [geofenceNotificationService.ts](src/services/geofenceNotificationService.ts)
fire arrival/exit alerts for any entity_places row.

**Known stale linkbacks worth flagging**:

- [Dashboard.tsx:1602](src/components/Dashboard.tsx#L1602) — TeamRadarTile
  `onClick={() => setView(AppView.CONTACTS)}`. Should now route to
  `AppView.MAP`. Same for any other tile or palette command that points
  Team Radar at Contacts.
- [SearchMapView.tsx](src/components/SearchMapView.tsx) — verify it
  still works in isolation; it predates the promotion and may assume
  it's mounted under Contacts.

### Part D — Critique-it questions

End the critique with strong opinions on these four:

1. **Does Map now have an identity problem?** Three months ago it was
   "where my contacts are." Today it's a workspace-wide spatial layer.
   Has the visual design caught up, or does it still read like a
   contacts feature wearing a sidebar entry?

2. **Should `View on Map` deep-link from Contacts pass any state?**
   Currently it's `pulse:navigate → AppView.MAP` with no filter. Should
   it pre-filter Map to contacts-only (matching the user's current
   intent), or drop them into the full cross-entity view?

3. **TaskEditModal still uses a modal.** The phase-0 keyboard contract
   shipped, but the right-side panel migration hasn't. Score the
   modal-as-first-thought anti-pattern: did the keyboard contract buy
   enough goodwill to delay the panel migration, or is the modal still
   the load-bearing failure?

4. **Risk Read + AI Subtasks both use the AIProvenanceChip pattern.**
   Should every AI surface in Pulse adopt the chip + lazy-fire +
   re-analyze pattern that Risk Read uses, or is that overfitting?

## DELIVERABLE

Standard impeccable critique structure:

- Design Health Score table (Nielsen 10, 0-4 each), with delta vs the
  21/40 pass-2 baseline noted per row
- Anti-Patterns Verdict — did the Phase-3 + Coral Cockpit work hold, or
  did new slop slip in?
- Overall Impression (one paragraph)
- What's Working (2-3)
- Priority Issues (3-5, P0-P3, with /impeccable command suggestions)
- Persona Red Flags (Alex + Jordan, plus optionally a new "Sam" persona
  for a field-ops user who lives in Map)
- Minor Observations
- Part B as a separate section: "Map IA — has the design caught up?"
  with concrete next-sub-view priorities (Live Team / Routes /
  Geofences) ranked
- Part C as a separate section: "Cross-section linkback audit" — for
  each consumer in the table, score (a) is the linkback bidirectional
  (can the user navigate Map → consumer and consumer → Map?), (b) is
  the visual treatment consistent (same chip aesthetic, same provenance
  pattern), (c) are there missing connections (e.g. should Calendar
  travel chips deep-link to Map with route view?)
- Provocative Questions

No hedging. Cite file:line. The Map IA section should read like a
product-strategy memo, not a UX checklist.
