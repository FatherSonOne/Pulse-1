/impeccable critique Tasks Detail + Pulse Map IA — second pass after the
Coral Cockpit token sweep and Risk-Read disclosure demotion landed.
Re-score on the same Nielsen heuristics against the previous baseline
(14/40 last pass, target was 22-24/40 after the sweep).

## TARGETS

### Part A — Tasks Detail deferred polish

The first critique flagged five issues this pass did NOT cover. Score
them now and propose concrete fixes (PRD-ready, file:line cited):

1. PlacePicker saved-places dedupe — `src/components/map/PlacePicker.tsx`.
   The dropdown still renders duplicate "Home / 1020 Ridgeview Ln" rows
   when `listUserPlaces()` returns dupes. Picker has no dedupe pass, no
   collision counter, no "clean up in Settings" hint. Treat as a real
   UX bug, not a data bug — the picker should be hardened regardless of
   what the underlying table returns.

2. Subtasks tab empty state — `src/components/decisions/SubtaskList.tsx`
   (rendered inside `src/components/tasks/TaskEditModal.tsx` tab 2). On
   a fresh task, the tab shows ONLY a "Generate with AI" gradient
   button + an empty "Add subtask…" input. No examples, no
   contextual scaffolding, no "what is a subtask" microcopy. First-
   timer (Jordan) gets zero guidance; the AI button feels like the
   only path forward, fighting the solo-operator-agency principle.

3. Keyboard + dirty-close guard — `src/components/tasks/TaskEditModal.tsx`.
   Power user (Alex) has no Cmd-Enter to save, no Cmd-1/2/3 to switch
   tabs, no warning if Cancel/ESC is pressed after edits. Save closes
   the modal silently — no toast, no confirmation. Audit the full
   keyboard contract.

4. Native `<select>` for Priority/Status/Assignee — `TaskEditModal.tsx`
   lines 274-352 area. Emoji-prefixed options ("📋 To Do", "🔨 In
   Progress") read as Slack/Asana template. Native select locks
   platform-native styling, can't render Pulse's mono-uppercase label
   aesthetic. Propose a segmented pill replacement for Priority and
   Status (Assignee can stay select-shaped but token-styled).

5. Modal-as-first-thought — `TaskEditModal.tsx` is portaled, scrim,
   600px wide. Linear, Things 3, Height all moved task-detail into a
   right-side panel so the list stays visible. Should Pulse follow?
   Cite specific solo-operator workflow patterns (list-stays-visible,
   inline edit on card, side-pane on click).

### Part B — Map feature IA: lives in Contacts or earns its own?

Pulse Map currently lives as a tab inside Contacts (Today / People /
Circles / Map). Source files for context:

- `src/components/contacts/ContactsShell.tsx` — the tab container
- `src/components/contacts/map/ContactMapView.tsx` — main map view
- `src/components/contacts/map/MapFilterBar.tsx` — header with the
  new "Go Live" toggle (Phase 2a)
- `src/components/contacts/map/MapContactPanel.tsx` — per-contact slide-in panel
- `src/components/Sidebar/Sidebar.tsx` — the top-level nav (see
  AppView enum)
- `src/types.ts` — AppView enum (current top-level sections)

The Map has accreted real cross-section weight since the Phase 2 work:

- Geofence detection fires for ANY entity (contact, task, decision,
  event, meeting) via entity_places + geofence_radius_m
- Live ETA share is a workspace-wide capability (not just contact-related)
- Calendar travel-buffer chips consume the maps stack
- Today re-grouped by geographic cluster
- Decisions/Tasks now have geo-anchor + completion geofences
- War Room Team Radar tile shows live broadcasting members
- "Go Live" is a top-of-map header toggle that affects all of these

The IA question: is Map still a *Contacts sub-view*, or has it earned
top-level sidebar placement next to Dashboard / Messages / Calendar /
Decisions & Tasks / War Room / etc.?

Evaluate against:

1. **Conceptual scope** — does the section still serve contacts only,
   or does it now serve a cross-section spatial layer that other
   sections deep-link into?
2. **Discoverability** — where would Jordan (first-timer) look to
   share a live ETA, see team radar, or set a task geofence? Are
   they likely to find those affordances inside Contacts?
3. **Information architecture** — count the cross-section linkbacks.
   How many sections (calendar, decisions, tasks, war room, today)
   now depend on the maps stack? If many, Contacts is hosting a layer
   that's broader than itself.
4. **Comparable products** — how do Linear (no map), Notion (no map),
   Superhuman (no map), Things 3 (no map), and field-ops tools like
   Salesforce Maps and HubSpot Maps surface spatial data? Where do
   they put it and why?
5. **What sub-views would a standalone Map section have?** — propose
   a structure (e.g. Map / Live Team / Coverage / Routes / Settings)
   versus what Contacts > Map shows today.
6. **Migration cost** — if Map gets promoted, what breaks? List the
   files that hardcode the assumption "Map lives under Contacts."
7. **The opposite case** — why would Map *stay* under Contacts? Is it
   really a contact-relationship feature wearing a geospatial mask, or
   has the geospatial layer outgrown the contact frame?

Take a strong opinion. End Part B with a clear recommendation:
PROMOTE (standalone section), KEEP (Contacts sub-tab), or HYBRID
(Map stays in Contacts, but specific surfaces — e.g. Team Radar full-
screen — get their own top-level entry). Justify with the strongest
single argument plus 2-3 supporting points.

## DELIVERABLE

Standard impeccable critique structure:

- Design Health Score table (Nielsen 10, 0-4 each), with delta vs.
  the previous 14/40 baseline noted per row
- Anti-Patterns Verdict — has the Coral Cockpit pass actually
  shipped, or did new slop arrive? Specifically: native selects, no
  keyboard support, the AI Subtasks generation button
- Overall Impression (one paragraph)
- What's Working (2-3)
- Priority Issues (3-5, P0-P3, with /impeccable command suggestions)
- Persona Red Flags (Alex + Jordan)
- Minor Observations
- Part B as a separate section: "Map IA — Stay or Promote?" with the
  PROMOTE / KEEP / HYBRID verdict and migration impact analysis
- Provocative Questions

No hedging. Cite file:line. The Map IA section should read like a
product-strategy memo, not a UX checklist.
