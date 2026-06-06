# Contacts Redesign — Implementation Handoff

**Date:** 2026-06-05
**Direction locked:** Path D · Hybrid (3-pane: Browse / Focus / Co-pilot)
**Status:** Ready to implement
**Owner:** TBD (this doc is the handoff; it is self-contained)
**Flag:** `contactsHybrid` (default OFF)

---

## 0. TL;DR

Contacts today is a Google-synced address book with a deep relationship-intelligence layer bolted on, but its action wiring is **inverted for a solo operator**: every contact carries a *required* email, yet you cannot email a contact from anywhere in the surface. The three exposed actions (Message / Vox / Meet) only do anything real when the contact is also a Pulse user, which is ~1% of an imported address book. The locked redesign fixes this with a **hybrid-by-contact-type channel row** and folds the existing intelligence into a 3-pane People view: **List (Browse) · Detail (Focus) · AI co-pilot rail (Co-pilot)**.

**The non-negotiable principle:** *reach must match identity.* Pulse users get Message/Vox/Meet; everyone else gets Email / Slack (when linked) / Call / Note. Email wires to the compose bridge that already exists. Slack send + per-contact identity is genuinely net-new and is scoped as its own phase, not implied as a free button.

**Rollout:** new `contactsHybrid` flag in `FeatureContext`, default OFF, built under `src/components/contacts/hybrid/` reusing every existing service verbatim. Phase 0 adds the flag; Phase 11 flips it; Phase 12 retires the legacy People layout after soak. The Today tab, the relationship engine, cards/circles/filters, import/trim/dedup, and workspace share are all **preserved**.

---

## 1. Source of Truth

| Reference | Path |
|---|---|
| Visual spec (locked) | `_design-playground/contacts-redesign.html` — Path **D** is the default tab; A/B/C remain as labeled sources |
| Headless verify | `_design-playground/_verify-contacts.mjs` (zero console errors; shots in `_shots/contacts-*.png`) |
| This doc | `docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md` |
| Design tokens | `src/styles/pulse-tokens.css` (consume `--pulse-*`; never redeclare) |
| Memory | `~/.claude/projects/f--pulse1/memory/project_pulse_contacts_redesign_direction.md` |
| Conventions | `CLAUDE.md` §0 (code preservation), §4 (coral budget), §6 (doc naming) |
| Flag mechanism | `src/contexts/FeatureContext.tsx` (`FeatureFlags` interface + `DEFAULT_FEATURES`) |
| Channel pattern to reuse | `src/App.tsx` `handleComposeEmail` (compose bridge), `handleContactAction` (message/vox/meet) |

---

## 2. Mental Model

```
PEOPLE TAB (contactsHybrid ON)
┌──────────────┬───────────────────────────────┬──────────────────┐
│  COL 1        │  COL 2                         │  COL 3            │
│  BROWSE       │  FOCUS (selected contact)      │  CO-PILOT         │
│  (list from A)│  (B spine + timeline,          │  (AI rail from C) │
│               │   A context + info + groups)   │                   │
│  search       │  ┌ header (editable avatar)    │  Pulse AI         │
│  filter chips │  │ id badge · temp pill        │  ──────────────   │
│  ▸ Filters    │  ├ cadence spine (goal)        │  Suggested 1/3    │
│    (smart     │  ├ AI CONTEXT (coral)          │   + drafted       │
│     lists,    │  ├ interaction timeline        │     opener        │
│     circles,  │  ├ contact info (copyable)     │   + channel row   │
│     saved     │  ├ groups                      │  Slack · <person> │
│     filters,  │  └ YOUR NEXT TOUCH:            │  Route empty-state│
│     tags,     │     ChannelRow (adaptive)      │   (neutral hint)  │
│     archive)  │                                │                   │
└──────────────┴───────────────────────────────┴──────────────────┘
  ~330px           flex (center)                    ~320px
```

**Invariants the implementation MUST hold:**

1. **Reach matches identity.** `ChannelRow` renders Message/Vox/Meet **iff** `contact.pulseUserId` is set; otherwise Email / Slack(if `slackUserId`) / Call / Note. One shared primitive, used in the detail, the list (optional compact), and the co-pilot rail.
2. **Coral is AI-only.** Exactly two coral regions at rest in the People view: the inline **AI CONTEXT** strip (detail) and the **Suggested** card (rail). Temperature uses a separate dot vocabulary. The Route empty-state is a *system hint*, rendered neutral. Active nav/filter may use coral as state (allowed). If a third decorative coral element appears, it is wrong (CLAUDE.md §4).
3. **No new AI infrastructure.** The co-pilot rail is a new *presentation* of existing output (`todayFeedService` items + `enrichFeedItemsWithAIDrafts` openers + `relationshipProfile.aiNextActionSuggestion`). Do not add new model calls; reuse the Today pipeline.
4. **Preserve everything load-bearing.** Nothing in §4 marked Preserved/Moved may be dropped. Per CLAUDE.md §0 Rule A, removing working code requires an explicit approved pros/cons. This redesign is additive behind a flag.
5. **Both themes, both first-class.** Every pane tested light + dark before a phase is "done."

---

## 3. Current State — Architecture Audit Summary

| Concern | Where | Notes |
|---|---|---|
| Entry | `Contacts.tsx` → `ContactsLayout` → **`ContactsShell.tsx`** (360 ln) | Two-tab shell (Today/People); Circles demoted to a People facet; Map promoted to top-level. Owns 4 modals + 6 cross-surface events. |
| People view | **`ContactsRedesigned.tsx`** (1,919 ln) | Already a 3-pane layout: **facet sidebar | list | detail**. Search, sort, filters, 6 smart lists, circles, saved filters, archive toggle, grid/list view modes, bulk actions, cards. God component. |
| Detail | `ContactDetail.tsx` (~800 ln) | Info, health, lead score, source chip, AI insights tab, goals + autopilot, interaction history, meeting prep, map preview, Message/Vox/Meet cluster. Email/phone are **display-only** (`select-all`, no `mailto:`/`tel:`). |
| Today | `TodayView.tsx` (~250 ln) | AI feed (follow_up/birthday/cooling/hot_lead/awaiting/geofence), autopilot injection, AI drafts, Time/Route toggle, clustering (`todayClusterService`). |
| Channel wiring | `App.tsx` `handleContactAction` | `message→MESSAGES`, `vox→RELAY`, `meet→MEETINGS`. **No email/call/slack action.** Email compose bridge exists separately (`handleComposeEmail`). |
| Data model | `types.ts:76-109` | `email: string` **required**; `avatarUrl?` exists but **read-only** (no upload path); `pulseUserId?`; `source: local\|google\|vision`; home/work lat-lng. No `slackUserId`. |
| Relationship profile | `types/relationshipTypes.ts:99-170` | `relationshipScore/trend`, `preferredChannel (email\|calendar\|slack\|sms\|mixed)`, `aiRelationshipSummary`, `aiNextActionSuggestion`, lead grade/status. |
| Slack | `slackService.ts` + `SlackIntegration.tsx` | **Read-only** ingestion (channels/history → UnifiedMessage), bot-token (not OAuth), into unified inbox. No `chat.postMessage`. No contact↔Slack identity anywhere. |
| Avatar | `EditContactModal.tsx:101-110`, `AddContactModal.tsx` | Initial-in-a-circle **preview only**; zero `type="file"` in the section. `avatarUrl` is consumed (Google photo / Pulse user) but never authored. |
| Keyboard | `useContactsKeyboard.ts` | ⌘K search, `1` Today, `2` People, `Esc` close. (Header comment mentions D/S but they are not implemented.) |
| Flags | `FeatureContext.tsx` | No contacts flag today. Pattern: add to `FeatureFlags` + `DEFAULT_FEATURES` (false), surfaced in Settings → Features & Labs. |

---

## 4. Feature Disposition Matrix  *(the core of this doc)*

Disposition: **Preserved** (verbatim) · **Moved** (kept, new location) · **New** · **Deferred (v1.1)** · **Removed (rationale)**.

### 4.1 Shell & navigation
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Today / People tabs | ContactsShell | same | Preserved | Hybrid only changes the People body |
| Keyboard ⌘K / 1 / 2 / Esc | useContactsKeyboard | same | Preserved | + list `↑↓/⏎` and `E`=email added in Phase 9 |
| Map deep-link chip | ContactsShell tab bar | same | Preserved | |
| 6 cross-surface events + `pulse_focus_contact` | ContactsShell | same | Preserved | Hybrid shell must keep listening |
| Onboarding tour | ContactsOnboarding | same | Preserved | |

### 4.2 List & facets (Col 1)
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Search (name/email/role) | ContactsRedesigned | Col 1 header | Preserved | |
| Sort (name/status/score) | ContactsRedesigned | Col 1 Filters drawer | Moved | |
| Filter chips (tags) | sidebar | Col 1 chips row | Moved | |
| 6 smart lists | facet sidebar | Col 1 **Filters drawer** | Moved | **D1**: facets relocate into a collapsible drawer to free the slot for the AI rail. Predicates reused verbatim. |
| Circles | facet sidebar | Col 1 Filters drawer | Moved | `contactCircleService` unchanged; CircleDetail preserved |
| Saved filters | SavedFiltersPanel | Col 1 Filters drawer | Moved | `savedFiltersService` unchanged |
| Archive toggle + count | ArchivedToggle | Col 1 Filters drawer | Moved | |
| Grid / List view modes | ContactsRedesigned | Col 1 | Preserved | List is the hybrid default; Grid optional |
| Sidebar collapse state (localStorage) | ContactsRedesigned | adapt keys | Moved | `pulse_contacts_section_*` repurposed for the Filters drawer |
| Add contact button | ContactsRedesigned | Col 1 footer | Preserved | |

### 4.3 Detail / Focus (Col 2)
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Header (avatar/name/role/org/source) | ContactDetail | Col 2 header | Preserved | avatar becomes **EditableAvatar** (Phase 5) |
| Pulse-user vs External badge | implicit | `IdBadge` | New | drives the channel row |
| Relationship health + trend | RelationshipHealthCard | Col 2 (expandable) | Preserved | |
| Lead score grade/status | LeadScoreIndicator | Col 2 (expandable) | Preserved | |
| AI Insights tab | ContactAIInsightsTab | Col 2 section | Preserved | feeds the AI CONTEXT strip + co-pilot |
| Goals + autopilot | ContactDetail + RelationshipAutopilotToggle | Col 2 **cadence spine** | Moved | spine = nearest due goal; full list expandable |
| Interaction history | ContactDetail | Col 2 **cross-channel timeline** | Moved | render email/slack/vox/meet on one spine |
| Meeting prep cards | MeetingPrepCard | Col 2 (expandable) | Preserved | |
| Map preview | ContactDetail + MapPreview | Col 2 (when geocoded) | Preserved | |
| Edit / Delete | ContactDetail | Col 2 overflow | Preserved | |
| Message / Vox / Meet | ContactDetail (3-btn) | `ChannelRow` (Pulse users) | Moved | now conditional on `pulseUserId` |

### 4.4 Channel actions — the core fix
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Adaptive `ChannelRow` primitive | — | shared | **New** | Pulse user → Message/Vox/Meet; external → Email/Slack(if linked)/Call/Note |
| Email a contact | display-only text | `ChannelRow` Email | **New** | wires to existing `handleComposeEmail` bridge (`pulse_pending_compose` + `pulse:compose-email`), `emailEnabled`-gated (hide when off) |
| Call a contact | display-only text | `ChannelRow` Call | **New** | `tel:` device dialer. Distinct from Today feed's `call`→message mapping |
| Note (quick log) | — | `ChannelRow` Note | **New** | inline note append (reuse `notes` field / interaction log) |
| Slack a contact | — | `ChannelRow` Slack | **New (Phase 8)** | requires send + identity, see §4.8 |
| SMS | mocked/deferred | not shown | Deferred (v1.1) | phone field stays; no SMS action; label "SMS coming soon" if surfaced |

### 4.5 Avatar
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Avatar display (initials / photo) | Avatar | Avatar | Preserved | |
| **Avatar upload** | none | EditableAvatar + file input | **New (Phase 5)** | Supabase Storage bucket + RLS; write `avatarUrl` in Edit **and** Add modals |

### 4.6 Today feed
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Feed types, generation, autopilot, AI drafts | TodayView + todayFeedService | same | Preserved | also powers the co-pilot rail |
| Time / Route toggle + clustering | TodayView + todayClusterService | same | Preserved | real machinery |
| **Route empty-state** | silent empty bucket | honest hint | **New (Phase 6)** | "Set locations on contacts to group your day by area." Neutral, not coral |

### 4.7 AI co-pilot rail (Col 3)
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Suggested 1/N + drafted opener | (lives in Today + Insights) | Col 3 rail | **New presentation** | reuse `todayFeedService` top items + drafted openers; NO new AI calls |
| Slack callout | — | Col 3 | New | surfaces inbound Slack tied to a contact (post-Phase 8 identity) |
| Route empty-state | — | Col 3 | Moved | neutral hint |
| Selecting a rail item | — | selects contact in Col 1/2 | New | rail is a global agenda; selection syncs the focus pane |

### 4.8 Slack (net-new outbound + identity — the big lift)
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Inbound ingestion | slackService (read) | same | Preserved | |
| `preferredChannel: 'slack'` awareness | relationship profile | shown in detail | Preserved | |
| `slack_user_id` on contact | none | new nullable column | **New** | schema-first migration, dry-run rollback first (CLAUDE.md §4) |
| Identity resolver | none | match `users.info.profile.email` → contact.email | **New** | needs `users:read.email` scope |
| Slack send | none | `slackService.sendMessage` via `conversations.open` + `chat.postMessage` | **New** | routes through existing `/api/slack/proxy`; needs `chat:write` |
| "Link Slack" affordance | none | per-contact link/resolve UI | **New** | for contacts the resolver can't auto-match |

### 4.9 Cards / peer-share / import / workspace (all preserved)
| Feature | Current | New | Disposition |
|---|---|---|---|
| Received/Sent/Share card flows (cards/*) | cards/* | preserved, reachable from bulk + a Cards entry | Preserved |
| Google import + selective + reconnect | ConnectContactsModal | same | Preserved |
| Trim wizard (post-import) | TrimWizard | same | Preserved |
| Duplicate detection / merge | DuplicateDetectionModal | same | Preserved |
| Bulk actions (send card, workspace share, archive, delete, save filter) | BulkActionToolbar | same | Preserved |
| Workspace share / elevation | WorkspaceShareModal + workspaceContactsService | same | Preserved |

### Decisions needed (resolved in §10)
- **D1** facet relocation, **D3** avatar storage bucket, **D4** Slack identity column + scopes, **D6** email-action gating. See Decisions Log.

---

## 5. New Architecture

```
src/components/contacts/hybrid/
  ContactsHybridPeople.tsx     # 3-column orchestrator (replaces ContactsRedesigned body when flag ON)
  channels/
    ChannelRow.tsx             # the shared adaptive action row (INVARIANT 1)
    channelsFor.ts             # pure: contact -> channel[] ; unit-tested
    actions.ts                 # email(compose bridge) / call(tel:) / note / message|vox|meet(onAction) / slack(Phase 8)
  list/
    BrowseColumn.tsx           # search + chips + Filters drawer (smart lists/circles/saved filters/tags/archive)
    FiltersDrawer.tsx          # relocated facets — reuses savedFiltersService, contactCircleService, smart-list predicates
  detail/
    FocusColumn.tsx            # header + cadence spine + AI context + timeline + info + groups + ChannelRow
    CadenceSpine.tsx           # nearest-due goal (reuses contactGoalService)
    InteractionTimeline.tsx    # cross-channel ledger (email/slack/vox/meet)
  copilot/
    CopilotRail.tsx            # Suggested + drafted opener + Slack callout + RouteHint  (reuses todayFeedService output)
  avatar/
    EditableAvatar.tsx         # upload affordance (Phase 5)
```

**State.** Keep it local to `ContactsHybridPeople` (selectedContactId, search, filter, drawer-open) plus the existing services/hooks (`useRelationshipIntelligence`, `dataService`, `savedFiltersService`, `contactCircleService`). The co-pilot rail consumes `todayFeedService.generateTodayFeed` once and is independent of `selectedContactId`; clicking a rail item sets `selectedContactId` (and may dispatch `pulse:contacts:select-contact`).

**Reuse, do not rebuild.** `ContactDetail`'s sub-pieces (health card, lead indicator, insights tab, meeting prep, map preview, goals/autopilot) are imported into `FocusColumn` as sections, not reimplemented. The legacy `ContactsRedesigned` stays intact until Phase 12.

**Flag gate.** `ContactsShell` chooses body by `isFeatureEnabled('contactsHybrid')`: ON → `ContactsHybridPeople`; OFF → existing `ContactsRedesigned`. Today tab is unchanged either way.

---

## 6. Implementation Phases

Each phase is independently mergeable to `main` and commits on its own (CLAUDE.md §3).

- **Phase 0 — Scaffold.** Add `contactsHybrid: boolean` to `FeatureFlags` (`FeatureContext.tsx`) + `contactsHybrid: false` to `DEFAULT_FEATURES`; surface in Settings → Features & Labs. Create `src/components/contacts/hybrid/` with a stub `ContactsHybridPeople` and gate it in `ContactsShell`. **Commit immediately** (CLAUDE.md §1). *AC:* flag toggles between legacy and a stub with no errors.
- **Phase 1 — ChannelRow + channelsFor.** Pure `channelsFor(contact)` + `ChannelRow`. Wire: Email → `handleComposeEmail` bridge (`emailEnabled`-gated), Call → `tel:`, Note → inline append, Message/Vox/Meet → existing `onAction`. Slack button present but disabled ("Link Slack") until Phase 8. *AC:* a Pulse user shows Message/Vox/Meet; an external shows Email/Call/Note; Priya (slack-linked mock parity) shows Slack disabled.
- **Phase 2 — Browse column.** Port search + sort + filter chips; build `FiltersDrawer` that relocates smart lists, circles, saved filters, tags, archive toggle (reuse services verbatim). *AC:* every legacy filter reachable; counts match legacy.
- **Phase 3 — Focus column.** Compose header + cadence spine + AI context strip + interaction timeline + contact info + groups + `ChannelRow`. Import existing detail sub-components as expandable sections. *AC:* no detail feature from §4.3 is missing.
- **Phase 4 — Co-pilot rail.** New presentation of `todayFeedService` top items + drafted openers + Route hint; selecting an item syncs `selectedContactId`. No new AI calls. *AC:* rail content equals the Today feed's top items; zero added model invocations (verify via network/log).
- **Phase 5 — Avatar upload.** Verify/create Supabase Storage bucket (`contact-avatars`) + RLS (schema-first). `EditableAvatar` file input + client resize; write `avatarUrl` in **both** Edit and Add modals. *AC:* upload persists + renders on the card; existing Google/Pulse photos still render.
- **Phase 6 — Route empty-state.** Honest neutral hint in Route mode when no item resolves a location. *AC:* Route mode with 0 located contacts shows the hint, not a silent bucket.
- **Phase 7 — Preserve-and-port the rest.** Verify cards (received/sent/share), import/trim/dedup, bulk actions, workspace share, onboarding all work inside the hybrid shell. *AC:* each flow exercised once end-to-end under the flag.
- **Phase 8 — Slack send + identity (net-new).** (a) `slack_user_id` nullable column migration — **dry-run in a rolled-back transaction first** (CLAUDE.md §4), verify the real `contacts` table id type before writing. (b) resolver service: `users.info`→email match to `contact.email`; "Link Slack" UI for misses. (c) `slackService.sendMessage` via `conversations.open` + `chat.postMessage` through `/api/slack/proxy`; document required scopes (`chat:write`, `users:read.email`). (d) enable the Slack button in `ChannelRow`. *AC:* a linked contact composes + sends a Slack DM; an unlinked one shows "Link Slack".
- **Phase 9 — Keyboard + motion polish.** List `↑↓/⏎` nav, `E`=email, cross-fade on contact switch, `prefers-reduced-motion`. *AC:* keyboard-only reach of primary action; reduced-motion honored.
- **Phase 10 — Theme + a11y + i18n.** Both themes audited; WCAG 2.1 AA (axe); `react-i18next` keys for new copy; 48px touch targets. *AC:* axe clean on the People view, both themes.
- **Phase 11 — Flag flip.** After soak, default `contactsHybrid: true`; update Settings copy. *AC:* fresh load lands on hybrid.
- **Phase 12 — Legacy cleanup.** Remove the legacy People layout from `ContactsRedesigned` (keep a git tag; additive-safe). Requires explicit pros/cons approval per CLAUDE.md §0 Rule A before deleting. *AC:* no dead imports; Today + cards still mount.

**Commit message templates** (conventional, sign with `Co-Authored-By: Claude Opus 4.8 (1M context)`):
`feat(contacts): scaffold contactsHybrid flag + hybrid People shell` · `feat(contacts): adaptive ChannelRow (hybrid by contact type)` · `feat(contacts): Slack send + per-contact identity (Phase 8)`.

---

## 7. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Guessing `contacts` table id type / column for `slack_user_id` | Med | High | Schema-first: query `information_schema.columns` via MCP; dry-run rollback migration (CLAUDE.md §4) |
| 2 | Avatar Storage bucket missing RLS → public leakage | Med | High | Create bucket + per-user RLS; verify no existing bucket first |
| 3 | Coral budget regression (rail + context + temp + states) | Med | Med | Two AI coral regions only; temp uses dots; Route hint neutral; review at each phase |
| 4 | Co-pilot rail duplicates Today AI calls (cost) | Med | Med | Reuse one `generateTodayFeed` result; no new invocations (Invariant 3) |
| 5 | Slack bot lacks `chat:write` / `users:read.email` | High | Med | Document scope addition in SlackIntegration; surface a re-auth prompt |
| 6 | Identity resolver mismatches (no email in Slack msg) | High | Med | Match via `users.info.profile.email`; fall back to manual "Link Slack" |
| 7 | Porting the 1,919-ln god component drops a feature | High | High | Disposition matrix §4 is the checklist; Phase 7 exercises each flow |
| 8 | Email action shown when `emailEnabled` is OFF | Med | Med | Gate the Email button on the flag; hide (not disable) when off (D6) |
| 9 | Facet relocation hides a power-user filter | Med | Med | Filters drawer must expose all 6 smart lists + circles + saved filters |
| 10 | `tel:` no-op on desktop web | Low | Low | Show device-dialer affordance; copy-number fallback |
| 11 | `tsc --noEmit` OOMs / ~1,234 pre-existing errors | Med | Low | `NODE_OPTIONS=--max-old-space-size=8192`; gate on "no NEW errors" |
| 12 | Parallel Claude session sweeps WIP | Low | High | Commit each phase; explicit-path adds (CLAUDE.md §1) |
| 13 | Today feed and rail diverge over time | Low | Med | Single source (`todayFeedService`); rail is a view, not a fork |

---

## 8. Acceptance Criteria

**Behavioral**
- A Pulse-user contact shows Message/Vox/Meet; an external shows Email / Call / Note (+ Slack when linked).
- Email opens the existing composer pre-addressed; Call invokes `tel:`; Slack (Phase 8) composes a DM.
- Every legacy filter, smart list, circle, saved filter, bulk action, card flow, import/trim/dedup is reachable under the flag.
- Avatar upload persists and renders; Today Route shows the honest empty-state.

**Visual**
- Two coral regions at rest (AI context + Suggested). No coral chrome. Temperature via dots. Both themes pass.

**Code health**
- No NEW `tsc` errors (8 GB heap). Services reused, not reimplemented. Legacy untouched until Phase 12.

**Performance**
- No added AI calls for the rail. No layout shift after contact load. List virtualized if >200 rows (reuse existing pattern).

---

## 9. Out of Scope (Deferred to v1.1)

1. **SMS send** — 100% mocked/deferred platform-wide; phone field + "coming soon" only.
2. **Slack OAuth** (replacing the bot-token paste) — Phase 8 uses the existing proxy + bot token.
3. **Bi-directional Slack threads in-app** — inbound stays in the unified inbox; only DM send is added.
4. **Grid view polish / circle bubble viz** — Grid preserved as-is; no new visualization.
5. **AI auto-link of all Slack users to contacts in bulk** — resolver runs per-contact / on-demand, not a mass backfill.

---

## 10. Decisions Log

| # | Decision | Why |
|---|---|---|
| D1 | Relocate the facet sidebar (smart lists/circles/saved filters/tags/archive) into a Filters drawer in the list column | Frees the third column for the AI co-pilot rail; all facets preserved, none removed |
| D2 | Co-pilot rail is a **global agenda**, not contextual to the selected contact; selecting a rail item syncs the focus pane | Matches Path C; avoids a redundant per-contact AI panel (the detail already has AI context) |
| D3 | Avatar uploads go to a new Supabase Storage bucket `contact-avatars` with per-user RLS | No bucket exists today; schema-first + RLS required before writing |
| D4 | Add nullable `slack_user_id` to contacts; resolve identity via `users.info.profile.email` match | Slack messages carry no email; the user-profile endpoint does. Needs `users:read.email` |
| D5 | `Call` = `tel:` device dialer | Distinct from the Today feed's `call`→message mapping; the contact card should reach the real dialer |
| D6 | Email action is gated on `emailEnabled`; hidden when off | Email surface is itself flag-gated; never offer a dead channel |
| D7 | Route empty-state is neutral, not coral | It is a system hint, not AI output (coral budget, CLAUDE.md §4) |
| D8 | Build behind `contactsHybrid` in a new `hybrid/` folder, legacy intact until Phase 12 | Matches email/decisions/warroom rollout; additive + reversible (CLAUDE.md §0) |

---

## Appendix A — File inventory & disposition

| File | Lines | Disposition |
|---|---|---|
| `ContactsShell.tsx` | 360 | Modify (flag gate on People body) |
| `ContactsRedesigned.tsx` | 1,919 | Keep until Phase 12; legacy People layout |
| `ContactDetail.tsx` | ~800 | Reuse sub-components in FocusColumn |
| `ContactAIInsightsTab.tsx` | ~350 | Preserved (imported) |
| `EditContactModal.tsx` | 288 | Modify (avatar upload, Phase 5) |
| `AddContactModal.tsx` | 187 | Modify (avatar upload, Phase 5) |
| `TodayView.tsx` | ~520 | Modify (Route empty-state, Phase 6) |
| `todayClusterService.ts`, `todayFeedService.ts`, `contactGoalService.ts` | — | Preserved (reused) |
| `slackService.ts` | 198 | Extend (sendMessage, Phase 8) |
| `SlackIntegration.tsx` | 237 | Extend (scopes copy, Phase 8) |
| `savedFiltersService`, `contactCircleService`, `workspaceContactsService` | — | Preserved (reused) |
| `cards/*`, `ConnectContactsModal`, `TrimWizard`, `DuplicateDetectionModal`, `BulkActionToolbar`, `WorkspaceShareModal` | — | Preserved |
| `FeatureContext.tsx` | — | Modify (add `contactsHybrid`, Phase 0) |
| `types.ts` (Contact) | — | Modify (`slackUserId?`, Phase 8) |
| `_design-playground/contacts-redesign.html` | — | Spec (Path D) |

---

## Appendix B — Implementation reading order

1. This doc (§2 invariants, §4 matrix, §10 decisions).
2. `_design-playground/contacts-redesign.html` — Path D (the visual spec); A/B/C for source intent.
3. `src/components/contacts/ContactsShell.tsx` — where the flag gate goes.
4. `src/components/contacts/ContactsRedesigned.tsx` — the legacy People view to mirror (features, services).
5. `src/components/contacts/ContactDetail.tsx` — sub-components to reuse in FocusColumn.
6. `src/App.tsx` `handleComposeEmail` + `handleContactAction` — the channel wiring to call.
7. `src/contexts/FeatureContext.tsx` — flag pattern.
8. `src/services/slackService.ts` + `SlackIntegration.tsx` — the Slack base to extend (Phase 8).
9. `src/types.ts:76-109` + `src/types/relationshipTypes.ts` — the data shapes.

*This handoff is self-contained. A builder agent can start at Phase 0 without the chat history.*
