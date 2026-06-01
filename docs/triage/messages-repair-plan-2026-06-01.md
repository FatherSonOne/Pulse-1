# Messages Repair Plan — 2026-06-01
Source report: `docs/triage/messages-triage-2026-06-01.md` (read 2026-06-01)
Scope chosen by user: **FULL RESTORATION** · Tools surface: **Wire real data in** ·
Orphans: **Case-by-case w/ Rule-A** · SMS + stubs: **Build SMS real now**

> Planning artifact only. No functional code has been altered in producing this
> plan. Each work item is executed later, **one at a time**, each with its own
> Rule-A confirmation for any destructive change, its own verification run, and
> its own commit. Plan approval is the green light to *propose* each change in
> turn — not to carry them all out unattended.

---

## 0. Verification Delta (what changed between the report and now)

The triage report was committed at `bf742df` earlier today. Two commits landed
around/after it that **already resolved two of its findings**. Re-verified by
opening the live files and quoting current lines:

| Finding | Report said | Re-verified status | Evidence |
|---|---|---|---|
| **S1** latent crash | `setShowCommandPalette`/`newMessage`/`setNewMessage` undeclared | **CONFIRMED** | `Messages.tsx:4796` (1 ref, 0 decl), `setNewMessage` only at `:4844` as a prop, no `const [newMessage` / `const [showCommandPalette` anywhere in file |
| **C1** unread = 0 | `getUnreadCount` returns `data?.length` w/ `head:true` | **CONFIRMED** | `pulseService.ts:609-626`: `.select('id',{count:'exact',head:true})` then `return data?.length \|\| 0` — `data` is null under `head:true` |
| **G1** tools surface | "occlusion / double-mount; real copy hidden under z-40 overlay" | **CHANGED (material correction)** | The two surfaces are **mutually exclusive**, never co-render — see box below |
| **G2** `messageService` schema drift | stale `in_app_messages` columns | **STALE — already fixed** | `messageService.ts` now uses `event_trigger`/`segment`/`custom_segment_query`/`starts_at`/`is_active`/`display_duration_seconds`/`total_messages_seen` (commit `aafef7f`). All old names gone. |
| **C7** retention column | `userMatchesSegment` reads `user_retention_cohorts.last_seen_at` (missing) | **STALE — already fixed** | `messageService.ts:265` now reads `.select('updated_at')` (commit `708a4fb`) |

**G1 correction (this is the most important delta).** The report described
ToolOverlay and `MessagesFeaturePanels` rendering the *same* components twice with
the real copy occluded under an opaque `z-40` overlay. That is **not what the code
does**:

- `ToolOverlay` renders inside the **live Pulse-DM branch**, guarded
  `{activePulseConv && !activeThread && (…)}` (`Messages.tsx:3484`, overlay at `:3905`).
- `MessagesFeaturePanels` renders inside the **dormant legacy branch**,
  guarded `{activeThread && (…)}` (`Messages.tsx:4690`, panels at `:4840`).
- Selecting a conversation runs `setActivePulseConversation(id)` **and**
  `setActiveThreadId('')` (`:3475-3476`), so `activeThread` and `activePulseConv`
  cannot both be truthy in normal use. **They never co-render — there is no occlusion.**

The real situation is simpler and sharper: **ToolOverlay is the tools surface the
live path actually shows, and its child panels are rendered propless** — e.g.
`<EngagementScoring />`, `<ResponseTimeTracker />` (`ToolOverlay.tsx:180-181`),
`<ConversationSummary />` (`:226`), `<ProactiveInsightsEnhanced />` (`:185`) get no
`messages`; ToolOverlay is never handed a `messages` prop (`Messages.tsx:3905-3917`).
The **real-data implementation (`MessagesFeaturePanels`) is stranded in the dead
legacy branch** users never reach. There is no "hidden real copy to un-hide by
deleting an overlay" — the fix is to **feed real data into ToolOverlay** (the
chosen direction), using FeaturePanels' wiring as the reference.

**Net:** drop **G2** and **C7** (already fixed). **S1** and **C1** stand.
**G1** stands as a real problem but with a corrected mechanism that changes the
fix (W4 below). All other report findings (C2-C6, S2-S5, §5 stubs, §7 orphans)
are non-destructive/lower-stakes and are taken as CONFIRMED-per-report; **each
will be spot-verified against the live file immediately before it is edited**
(operating-contract rule 1), never edited on the report's word alone.

---

## 1. Decisions Taken (Phase-3 forks)

| # | Fork | Options offered | **User's choice** | Consequence for the plan |
|---|---|---|---|---|
| D1 | Scope of this pass | launch-blocker only / quick-wins+honest / **full restoration** | **Full restoration** | Everything below is in scope, incl. the two COMPLEX builds; longest timeline, largest blast radius; destructive items still gated per-item |
| D2 | Tools surface (G1) | wire real / make-honest-hide / leave | **Wire real data in** | W4 threads `pulseMessages`/conversation/contact into ToolOverlay and removes mock fallbacks; FeaturePanels kept as reference (its deletion is a later orphan call, not part of W4) |
| D3 | Orphans (§7) | case-by-case Rule-A / leave-all / delete-dead-set | **Case-by-case w/ Rule-A** | W10 handles each orphan individually: re-grep importers → Rule-A pros/cons → explicit user sign-off. No batch deletes. Lands last. |
| D4 | SMS + live stubs | defer-SMS+clean-stubs / defer-all / **build-SMS-real** | **Build SMS real now** | W7 wires a server-side Twilio send through the deployed Render backend using existing Twilio integration infra; W8 cleans the in-component stubs |

---

## 2. Work Items

Complexity key: TRIVIAL <5min · MODERATE <30min · COMPLEX >30min.
Every item names its verification. tsc gating note: repo has ~1,234 pre-existing
TS errors and `tsc` OOMs at default heap — run
`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` and gate on **no NEW
errors in changed scope**, never zero.

### W1 — Eliminate the S1 latent crash  ·  CONFIRMED · TRIVIAL · (S1)
- **Files/lines:** `Messages.tsx:4796` (dead Command-Palette button →
  `setShowCommandPalette`), `:4843-4844` (`newMessage`/`setNewMessage` passed to
  `<MessagesFeaturePanels>`). All inside the legacy `{activeThread && …}` branch.
- **Why it matters:** the moment a legacy thread is selected (e.g. an
  `initialContactId` deep-link → `createNewThread` `:1630`) this branch mounts and
  throws `ReferenceError`. It ships today only because the branch is unreachable in
  normal use and vite skips type-checking. Under **full restoration** the legacy
  branch is being revived (W9), so this crash becomes reachable — fix it first.
- **Approach (additive-first):**
  1. `setShowCommandPalette` — the local Cmd+K palette was deliberately removed
     (`:636-640`). Investigate whether any surviving palette exists to wire to. If
     not → **delete the orphaned button** (Rule-A block below).
  2. `newMessage`/`setNewMessage` — read what `MessagesFeaturePanels` does with
     them. If consumed → declare `const [newMessage, setNewMessage] = useState('')`
     at component scope (additive, reversible). If unused by the panel → drop the
     two props. Pick whichever the panel's signature proves correct.
- **Dependencies:** none. **Blocks:** W9 (legacy-branch revival) safely.
- **Blast radius:** legacy branch only; live Pulse-DM path untouched.
- **Verification:** `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep Messages.tsx` shows the 3 identifiers resolved (no `Cannot find name`); manual: deep-link a legacy thread, branch mounts without `ReferenceError`.
- **Rule-A block (only if the dead button is deleted):**
  - *Change:* remove the `<button onClick={() => setShowCommandPalette(true)}>` at `Messages.tsx:4796`.
  - *Pros:* removes a guaranteed crash trigger; the button currently does nothing but throw.
  - *Cons:* loses the visual affordance for a command palette that no longer exists — i.e. no real behavior is lost (the handler references an undeclared setter; it could never have worked). If a palette is later rebuilt, the button is one line to restore from git.
  - *Preserved vs sacrificed:* preserves every working path; sacrifices only a non-functional button.
  - *Completeness proof:* `grep setShowCommandPalette` → 1 hit (this button), 0 declarations; the button has no reachable success path. Removal is strictly safer than the status quo.

### W2 — Fix `getUnreadCount` always returning 0  ·  CONFIRMED · TRIVIAL · (C1)
- **File/line:** `pulseService.ts:609-626`.
- **Break:** `.select('id', { count:'exact', head:true })` returns `data = null`;
  code does `return data?.length || 0` → always 0.
- **Fix:** destructure `count`: `const { count, error } = await …; … return count ?? 0;`
- **Dependencies:** none. **Cascade:** low — store derives unread elsewhere, badge mostly works anyway, but the public method is wrong and may be relied on later.
- **Verification:** tsc on services scope; manual: a conversation with unread messages returns the true count, not 0.

### W3 — Clean the legacy typing wiring  ·  CONFIRMED-per-report (spot-verify) · TRIVIAL · (C2, C3)
- **Files/lines:** `Messages.tsx:4898` (`<TypingIndicator users={typingUsers}/>` — interface only has `userName`/`size`/`className`), `:4669-4671` (`onTyping={(isTyping)=>{}}` empty on the legacy `MessageInput`; real typing is wired separately at `:5426-5429`).
- **Fix:** pass the correct `userName` prop (or derive a name string) to `TypingIndicator`; for `onTyping`, wire it to the real typing broadcast or remove the dead callback — decide once the legacy path is being revived in W9 (it may want real typing then).
- **Dependencies:** light coupling to W9 (legacy revival). Can ship independently as a clean-up now; revisit `onTyping` semantics in W9.
- **Verification:** tsc shows no prop-type error on `TypingIndicator`; manual in legacy branch: typing bubble shows a name.

### W4 — Wire real data into ToolOverlay (the tools surface goes fake → real)  ·  CONFIRMED · COMPLEX · (G1, C8, §5 mock-data components)
**This is the headline user-value item.** Per D2.
- **Render site:** `Messages.tsx:3905` `<ToolOverlay …>` (no `messages` passed today).
- **Live data available at that scope:** `pulseMessages` (`:789`, `PulseMessage[]`),
  `activePulseConv` (id, `other_user`), plus `contacts` props.
- **Panels to feed (they already accept real props; propless → empty/mock):**
  `EngagementScoring` (`messages` default `[]`, returns null `<5`),
  `ResponseTimeTracker` (`messages` default `[]`), `ConversationFlowViz`,
  `ProactiveInsightsEnhanced`, `ConversationSummary` (`messages`),
  `ContactInsights` (`contactId`/`contact`), and the §5 mock list
  (`ReactionsAnalytics`, `SentimentTimeline`, `ConversationInsights`, etc.).
- **Approach (additive, panel-by-panel — each its own commit):**
  1. Add a `messages` prop to `ToolOverlay` and pass `messages={pulseMessages}`
     from `:3905`, plus `contact`/`contactId` from `activePulseConv.other_user`.
  2. Build a small **shape adapter** (`PulseMessage` → each panel's expected
     `{ sender/senderId, timestamp, text, … }`) once, reuse across panels. Mirror
     the exact mapping `MessagesFeaturePanels` already uses (it is the working
     reference for the real-data shape — read it before writing the adapter).
  3. Thread the adapted data into each panel at `ToolOverlay.tsx:180-352`,
     replacing bare `<Panel />` with `<Panel messages={…} … />`.
  4. Per panel, **remove the `generateMock*()`/`Math.random` fallback** only after
     its real data path renders correctly (don't delete the mock generator until
     the real wire is proven — additive then subtractive).
- **`togglePanel` dual-set (`:898-919`):** once ToolOverlay is the real surface,
  the legacy `setShow*Panel(true)` sets feed only the dead-branch FeaturePanels.
  **Do not delete them in W4** (that touches the FeaturePanels orphan question →
  W10). W4 leaves them inert; W10 decides FeaturePanels' fate with a Rule-A block.
- **Dependencies:** none upstream. **Unblocks:** W5/C4 (tool-suggestion launcher).
- **Blast radius:** ToolOverlay + its ~38 children; the live Pulse-DM stream is
  untouched (read-only consumption of `pulseMessages`).
- **Verification:** tsc on `MessageEnhancements/` scope; manual/e2e: open each tool
  tab on a real conversation and confirm non-zero, conversation-specific numbers
  (not the `score:0` / `generateMock` defaults). Screenshot before/after per panel.

### W5 — Cracked moderate repairs  ·  CONFIRMED-per-report (spot-verify) · MODERATE · (C4, C5, C6)
- **C4** `Messages.tsx:1166-1169` — tool-suggestion no-op launcher
  (`// TODO: Implement actual tool launch logic via ToolOverlay`). **Depends on W4.**
  Wire it to the same `togglePanel`/`setActiveToolOverlay` path the real palette
  site (`:1192`) uses. Verify: a suggested tool actually opens.
- **C5** `messageEnhancementsService.ts:604` `generateProactiveInsights` — signature
  takes `apiKey` but body is pure keyword heuristics, never calls AI. Full
  restoration → route through `ai-router` edge fn (server-side per Pulse Gemini
  convention; **do not** add a direct API call). Verify: response reflects AI, not
  keyword match; tsc.
- **C6** `messageChannelService.ts:177` `getChannelMembers` — embed
  `users:user_id (id,name,avatar_url)`; canonical profile table is
  `user_profiles`/`pulse_users` (no `users` relationship, no `name` col). **Verify
  the real FK/relationship via Supabase MCP first** (schema-first rule), then fix
  the embed to the real table/columns. Verify: query returns members, no 400.
- **Dependencies:** C4 → W4. C5, C6 independent.
- **Verification:** per-item above + tsc on changed scope.

### W6 — User-visible error-feedback pass  ·  CONFIRMED-per-report · MODERATE · (report §9 #8)
- **What:** most failure paths in `Messages.tsx` are silent `console.error` (only
  `pulseEditToast` surfaces). Add toast feedback on the user-facing failure paths
  (send failure already rolls back optimistically `:1378-1380` — surface it; delete
  failure `:3065-3074`; reaction/star/schedule failures).
- **Approach:** reuse the existing toast mechanism (`pulseEditToast` pattern); do
  not introduce a new toast system. Additive only.
- **Dependencies:** none. **Verification:** manual: force a failure (offline), see a
  toast; tsc.

### W7 — Build real SMS send  ·  CONFIRMED · COMPLEX · (report §10, SMS)  — per D4
- **Current:** `Messages.tsx:1984` `handleSendSms` → `openSmsApp(activeContact.phone, message)`
  (`permissionService`) — native-only `sms:` URL, dead on web.
- **Existing infra to build on (investigate first, don't assume):**
  `services/nativeSmsService.ts`, `settings/integrations/TwilioIntegration.tsx`,
  `settings/integrations/OrgIntegrationsCard.tsx`, `config/backend.ts`, the
  deployed Render backend (`pulse-api-1epw.onrender.com`, server.js).
- **Approach:** add a server-side Twilio send endpoint on the Render backend (or a
  Supabase edge fn — match where Twilio creds already live; check `TwilioIntegration`
  config storage first). `handleSendSms` calls it for web + native; keep the `sms:`
  hand-off as a native fallback. Gate on the org's Twilio integration being
  configured; clear UX when it isn't.
- **Dependencies:** none on other items, but **depends on Twilio integration
  config being real** — verify the integration actually stores usable creds before
  building the send path. **Blast radius:** new endpoint + `handleSendSms`; no
  change to Pulse-DM.
- **Verification:** real send to a test number from web; failure UX when Twilio
  unconfigured; tsc.

### W8 — In-live-path stub cleanup / make-real  ·  CONFIRMED-per-report (spot-verify) · MODERATE · (report §5 in-component stubs)  — per D4
- Proposal voting auto-approves on a 3s timer / fake second voter
  (`Messages.tsx:2334-2336`) — behind `proposalMode` flag (off). Remove the fake
  voter; gate the feature honestly until real multi-party voting exists.
- Focus-mode "while you were focused" digest = hardcoded string (`:2087`) — build a
  real digest from actual unread/activity data, or hide until real.
- Outcome-goal modal writes `localStorage pulse-goal-${id}` (`:4434,4452`), never
  read back, no table — full restoration: persist to a real table (schema-first:
  define/verify the table via MCP) and read it back, or remove the dead write.
- `'add-to-calendar'` rich-card action → `// TODO` (`:5090`) — wire to the real
  calendar integration.
- **Dependencies:** none hard. **Verification:** per item; tsc.

### W9 — Severed reconnects  ·  CONFIRMED-per-report (spot-verify) · VARIES · (S2, S3, S4, S5)
- **S4** (TRIVIAL) `Messages.tsx` — `ConversationHealthWidget` (`:75`),
  `TranslationWidget` (`:82`), `AchievementProgress` (`:76`) imported, never
  rendered. Render them in an appropriate surface **or** remove the dead imports —
  decide per widget (these may be intended rail/tool content; W4 may be their home).
- **S3** (MODERATE) `BotMessage.tsx` chain (real `ecosystem-outbound` edge calls)
  has zero render sites; strands `MeetingRecapCard`/`MeetingBriefingCard`/
  `ActionItemsCard`. Give it a front door (render `<BotMessage>` for bot-authored
  messages) **or** leave dormant — investigate whether bot messages exist in
  `pulse_messages` (is_bot) before wiring.
- **S2** (MODERATE) `MessagesContext.tsx` (354 lines) provided, never consumed —
  the live component re-implements its state locally. Wire the component to consume
  it **or** treat as orphan (→ W10 Rule-A). Likely orphan; defer to W10.
- **S5** (TRIVIAL) `classifyMessage` (`messageAutoResponseService.ts:320`) — complete,
  router-wired, self-documented "Not used internally". Wire a caller **or** leave.
- **Dependencies:** W1 (legacy branch crash-free before reviving it). **Verification:** per item; tsc.

### W10 — Orphan triage (case-by-case, Rule-A, lands LAST)  ·  per D3 · VARIES · (§7)
For **each** orphan below: (1) re-grep all importers against live code, (2) write a
Rule-A pros/cons, (3) get explicit user sign-off before any deletion. Nothing here
is pre-approved by this plan.
- Phase-3 cluster: `Messages/ContextMenu.tsx`, `Messages/RadialMenu.tsx`,
  `Messages/FeatureSettingsPanel.tsx`, `examples/Phase3Examples.tsx` (the only
  importer of the first three, itself zero-importer). MEMORY wrongly believed these
  were deleted on GA — they exist.
- `Messages/ChannelList.tsx` (complete CRUD, no render site — may have a planned consumer).
- `Messages/MessageContainer.tsx` (dead twin of `src/components/MessageContainer.tsx`).
- `hooks/useMessagesState.ts` (~430 LoC, only self-reference).
- `hooks/useMessageContextMenu.ts` (dead duplicate of the live menu's hook).
- `hooks/usePulseMessaging.ts` (orphaned; also harbors a bug —
  `pulseService.createOrGetConversation` vs real `getOrCreateConversation`).
- `useCommonTriggers`/`useActivityTracking` (`useMessageTrigger.ts:75,179`).
- `MessagesContext.tsx` (from S2, if not reconnected in W9).
- ~10 `MessageEnhancements/` orphans (`AICoach` orig, `SmartComposeEnhanced`,
  `ToneAdjuster`, `InlineCoachTip`, `MediatorIndicator`, `TranslationWidgetEnhanced`,
  `ProactiveInsights` orig, `PersonalAnalyticsDashboard`+`AnalyticsBadge`,
  `SearchPanel`+`QuickSearchButton`, `AchievementSystemEnhanced`).
- Dead methods: `generateFocusDigest`, `summarizeSingleMessage`, `parseJSONResponse`,
  `calculateAchievements`.
- **FeaturePanels** real-data path: once W4 makes ToolOverlay real, decide whether
  the dead-branch `MessagesFeaturePanels` is now redundant (Rule-A) — but only after
  W4 is stable and proven.
- **Dependencies:** W4 + W9 (so "truly unused" is accurate). **Lands last** — most
  destructive, after all dependents are stable.

---

## 3. Launch Order

### Dependency graph
```
W1 (crash) ─┬─> W9 (legacy revival needs crash-free branch)
            └─> (foundation; nothing depends on data, do first)
W2 (unread)   independent
W3 (typing)   light dep on W9 for onTyping semantics
W4 (ToolOverlay real) ──> W5/C4 (tool launcher)
W5 (C5,C6)    independent
W6 (errors)   independent
W7 (SMS)      independent (needs Twilio config to be real)
W8 (stubs)    independent
W9 (severed) ──needs──> W1 ; feeds ─> W10
W4 + W9 ──────feed──> W10 (orphan deletes need accurate "unused")
W10 (orphans) LAST (destructive)
```

### Sequenced table
| Order | Item | Category | Complexity | Why here | Unblocks |
|---|---|---|---|---|---|
| 1 | W1 S1 crash | Severed | TRIVIAL | Guaranteed `ReferenceError`; full-restoration revives the branch → must be safe first | W9 |
| 2 | W2 unread=0 | Cracked | TRIVIAL | Wrong public method; quick win, momentum | — |
| 3 | W3 typing wiring | Cracked | TRIVIAL | Clean legacy render path; cheap | — |
| 4 | W4 ToolOverlay → real | Gutted/wiring | COMPLEX | Highest user value; turns the whole tools surface fake→real | W5/C4, clarifies W10 |
| 5 | W5 C4/C5/C6 | Cracked | MODERATE | C4 needs W4; C5/C6 remove silent failures | — |
| 6 | W6 error-feedback | Cracked | MODERATE | UX reliability; additive | — |
| 7 | W8 stub cleanup | Stub | MODERATE | Stop fake/dead bits shipping; mostly flag-gated | — |
| 8 | W7 SMS real | Stub | COMPLEX | Launch-blocker build; server-side, lands late | — |
| 9 | W9 severed reconnects | Severed | VARIES | Needs W1; some feed W10 | W10 |
| 10 | W10 orphan triage | Orphan | VARIES | Destructive, case-by-case, after "unused" is accurate | — |

### Waves (each leaves a committable, verified state)
- **Wave 1 — Stop the bleeding (TRIVIAL):** W1, W2, W3. Three independent commits.
  Section is crash-free, unread is correct, legacy typing path is clean.
- **Wave 2 — Make the tools surface real (COMPLEX):** W4 (one commit per panel
  cluster) then W5/C4. Commits: `feat(messages): feed real data into ToolOverlay
  <panel>` per cluster.
- **Wave 3 — Cracked moderates + honesty:** W5 (C5, C6), W6, W8. Separate commits
  per concern (don't batch unrelated).
- **Wave 4 — Build SMS real (COMPLEX):** W7. Its own commit(s); backend endpoint +
  client wire may be two commits.
- **Wave 5 — Severed reconnects + orphan triage (destructive last):** W9 then W10.
  Each reconnect its own commit; each orphan deletion its own Rule-A-gated commit.

Per CLAUDE.md: commit each unit independently; never batch unrelated changes;
`Co-Authored-By: Claude Opus 4.8 (1M context)` trailer; no `--no-verify`.

---

## 4. Out of Scope / Deferred (deliberate, so a later session doesn't mistake it for missed work)
- **G2 / C7** — already fixed (commits `aafef7f`/`708a4fb`); nothing to do.
- **The "occlusion" framing** from the report — not a real bug; documented in §0 so
  no future session "fixes" a non-existent overlay race.
- **Live Pulse-DM core** (`pulseService` send/realtime/reactions/stars/schedule,
  Path D tasks/decisions, context-menu GA) — **explicitly do not touch**; it is the
  solid foundation everything else hangs on.
- **Feature flags** `pulseComposerV2`/`toolsMenuV2` — remain OFF; their V2 shells are
  separate deferred work (per MEMORY), not part of this restoration.

---

## 5. Verification Strategy
- **Type-check (gate per item):**
  `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` — repo has ~1,234
  pre-existing errors and OOMs at default heap, so gate on **no NEW errors in the
  changed scope** (filter with `| grep <file>`), not zero.
- **Tests:** `npm run test` (Vitest) for service-level changes (`pulseService`,
  `messageChannelService`, `messageEnhancementsService`).
- **E2E / manual:** Playwright (`npm run test:e2e`, dev server up) + manual eyeball
  for the rendered surfaces (W4 panels, W3/W9 legacy branch, W7 SMS) — headless
  can't always load Direct contacts, so live screenshots where needed.
- **Schema-first (W5/C6, W8 outcome-goal):** verify real columns/relationships via
  Supabase MCP before writing any query; dry-run destructive migrations in a
  rolled-back transaction first.
- **Per-item evidence:** "done" for any item requires the named check to have
  actually run, with real output reported — not assumed.

---

## 6. Execution Protocol (per Phase 6)
Wave 1 executes **one item at a time**. For each: spot-verify the finding against
the live file → make the change → run the named verification → report real output →
commit. Destructive sub-steps (W1 dead-button delete, every W10 orphan) get their
own Rule-A confirmation and explicit user "proceed" before the edit. The plan is
the green light to *propose* each change in turn, not to carry them all out
unattended.
