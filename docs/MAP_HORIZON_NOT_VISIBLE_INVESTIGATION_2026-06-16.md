# Map "Horizon" (Direction D) — "I don't see the new design" Investigation Handoff

| | |
|---|---|
| **Doc** | `docs/MAP_HORIZON_NOT_VISIBLE_INVESTIGATION_2026-06-16.md` |
| **Date** | 2026-06-16 |
| **Reporter** | User — "the new Maps section UI/UX doesn't look like the selected design Horizon D; it still looks the same as before the design update. Hours of work and I don't see the new design." |
| **Purpose** | Explain WHY the live Map doesn't look like `_design-playground/maps-redesign.html` (Direction D), with confirmed facts + ranked hypotheses + exact verification steps + the real remaining work. |
| **Read with** | `docs/MAP_HORIZON_RESUME_HANDOFF_2026-06-15.md` (P0–P9 progress), `docs/MAP_HORIZON_BUILD_HANDOFF_2026-06-15.md` (specs). |

---

## 0. TL;DR (confirmed root cause)

**The Horizon redesign is behind the `mapHorizon` feature flag, which is OFF by default — by design.** Every phase (P0–P9) was *dark-launched* flag-off so the live Map stays byte-for-byte the legacy "Coral Cockpit" until the flag is deliberately flipped. **In normal use you see the OLD map because the flag is off — the new design is built, not missing.**

- **To see it right now:** Settings → Experimental features → enable **"Map Horizon Redesign (Alpha)"**. (The MapLibre renderer it rides on is already default-ON, so this one toggle is enough.)
- **Proof the work is real and renders:** the user's second screenshot (the live app, not the mockup) already shows the **`GEOFENCES · 2`** chip (today's P9), the **base-style switch** (P3), and the **time scrubber** `1·2·3·4 / ATLAS` (P5) — all of which only render when the flag is on. So that screenshot was taken with Horizon ON.
- **Why it *still* doesn't look like the mockup even with the flag on:** (a) the map is **empty** (0 located contacts → "Nothing on the map today", so no markers / no coral AI route card / no route line — the mockup's hero visuals), and (b) there is a **chrome fidelity gap** (cramped scrubber vs the mockup's labeled slider, different top-right control cluster).

Nothing here is wasted work; it's three separable issues: **(1) visibility (flag), (2) data, (3) fidelity.**

---

## 1. Confirmed facts (read from the code this session — not assumptions)

| Fact | Evidence |
|---|---|
| `mapHorizon` defaults **OFF** | `DEFAULT_FEATURES.mapHorizon = false` — `src/contexts/FeatureContext.tsx:181` |
| `mapLibreRenderer` defaults **ON** (since FLAGS_VERSION 1, 2026-06-15) | `DEFAULT_FEATURES.mapLibreRenderer = true` — `FeatureContext.tsx:175`; migration block `:207-212` |
| Activation is a **double-gate** but practically single | `const mapHorizonOn = features.mapHorizon && mapLibreOn;` — `PulseMapView.tsx:125`. `mapLibreOn` is true by default → flipping only `mapHorizon` activates Horizon. |
| OFF path is **byte-identical to the legacy map** | Every Horizon surface is `{mapHorizonOn ? <new/> : <legacy/>}` or an optional prop defaulting to legacy (scrubber↔`MapLensRow`, base-style↔`MapViewPicker`, neutral chrome, drawers). |
| The flag **is** user-toggleable | `FEATURE_NAMES.mapHorizon = 'Map Horizon Redesign (Alpha)'` — `FeatureContext.tsx:395` → appears in the experimental Settings list. |
| The Map section itself is gated by `experimentalEnabled` | `FeatureContext.tsx:172-174` comment. (User is reaching Maps, so this is already on.) |
| There is **no `?ff_mapHorizon` URL override** | `mapHorizon` is read straight from `features.mapHorizon`; only `mapLibreRenderer` has a `?ff_` dev override (`useMapLibreRenderer.ts:13-34`). Enable `mapHorizon` via Settings or the persisted `pulse_feature_flags` blob. |
| **P8 + P9 are committed LOCALLY, not pushed** | `main` is ahead of `origin/main`; P8 `44ec1e7`, P9 `883a911`. A deployed (Vercel) build does **not** have P8/P9 yet — and prod `mapHorizon` is OFF regardless. |

---

## 2. What the two screenshots actually are

- **Screenshot 1** — URL `F:/pulse1/_design-playground/maps-redesign.html`, tab "D · Horizon". This is the **hand-built HTML design mockup** (the target), **not** the running app. It is intentionally higher-fidelity than any first implementation.
- **Screenshot 2** — the **live Pulse app** (dark mode) with Horizon **ON** (the `GEOFENCES·2` / base-style switch / `1·2·3·4 ATLAS` scrubber are flag-gated). It shows the empty state "Nothing on the map today / Switch to Atlas", a "5 mi" radius ring, and the bottom chips. This is the real implementation — functional, but empty + lower-fidelity than the mockup.

The user's "looks the same as before" is most consistent with: **their day-to-day Maps view has the flag OFF (legacy), and screenshot 2 is the flag-ON state they toggled to check — which underwhelms because it's empty + not yet polished to the mockup.**

---

## 3. Hypotheses, ranked, with how to confirm

### H1 — Flag is OFF in normal use → legacy map (HIGHEST confidence; explains "same as before")
**Confirm:** Settings → Experimental → is "Map Horizon Redesign (Alpha)" toggled on? Or in the browser console:
```js
JSON.parse(localStorage.getItem('pulse_feature_flags') || '{}').mapHorizon   // true/false/undefined
```
`undefined`/`false` → you're on the legacy map. **Fix:** toggle it on (see §4).

### H2 — Flag ON but EMPTY DATA → barren map, no hero visuals (HIGH; explains screenshot 2)
The operational account has 0 located/pinned contacts in the now/today window → the `LensEmptyState` ("Nothing on the map today") renders and **none** of the mockup's signature elements appear: no contact markers, no coral **AI route card** (needs ≥2 located stops), no coral **route polyline** (needs an accepted route). The mockup is fully populated, so the contrast is stark.
**Confirm:** switch the scrubber to **Week**, or tap **Atlas** (zoom-out to the full network); pin/geocode 2–3 contacts. Markers + (with ≥2 stops) the AI card should appear.

### H3 — Fidelity gap: implementation ≠ mockup chrome (MEDIUM–HIGH; the real design debt)
Even populated, the live chrome diverges from Direction D:
- **Time scrubber** renders as compact `1 2 3 4` icon-chips (live) vs the mockup's **labeled horizontal slider** "Now — Today — 3 days — Week" with a draggable handle.
- **Top-right control cluster** differs (mockup: count badges + shield; live: globe/home/building/broadcast icons).
- General spacing/typography polish lags the hand-built mock.
**Confirm:** open `_design-playground/maps-redesign.html` (D tab) side-by-side with the live app (flag on) and diff each surface. **This is genuine remaining design work**, not a bug — see §5.

### H4 — Looking at a deployed/prod build (MEDIUM; rule it out)
If the user checked a Vercel URL rather than local dev, P8/P9 aren't pushed and `mapHorizon` is off in prod → even less is present.
**Confirm:** which origin? `localhost:5173` (local, latest) vs a `*.vercel.app` / `logosvision.org` (prod, behind by 10 commits + flag off).

### H5 — A specific surface genuinely regressed/missing (LOW; verify per-surface)
After confirming H1–H3, walk the §5 checklist to catch any surface that's wired but not rendering (e.g., a flag sub-gate, a lens condition, an import).

---

## 4. To SEE the new design right now (fastest path)

1. **Local dev** (`npm run dev:full`, not a prod URL).
2. Settings → **Experimental** → enable **"Map Horizon Redesign (Alpha)"** (MapLibre renderer is already default-on).
   - Or console: `const f = JSON.parse(localStorage.pulse_feature_flags||'{}'); f.mapHorizon = true; localStorage.pulse_feature_flags = JSON.stringify(f);` then reload.
3. Open **Maps**. To see content rather than the empty state: drag the scrubber to **Week** or tap **Atlas**, and pin/geocode a couple of contacts.
4. Toggle the **base-style switch** (Light/Dark/Contrast) and the **Geofences** chip to confirm P3/P9 live.

---

## 5. To make it MATCH Direction D (the real remaining work)

This is the work that turns "functional behind a flag" into "looks like the mockup":

1. **Surface-by-surface fidelity audit** vs `_design-playground/maps-redesign.html` (D). Produce a divergence list. Known so far:
   - [ ] **Scrubber** — labeled slider with handle (mockup) vs numbered chips (live). `horizon/HorizonScrubber.tsx`.
   - [ ] **AI route card** styling/placement (only visible with ≥2 stops).
   - [ ] **Top-right control cluster** parity.
   - [ ] **Empty state** — the mockup is populated; decide whether to demo-seed or accept an honest empty state.
   - [ ] Base-style switch labels (`Light/Dark/Contrast/Rich` mock vs `Light/Dark/Contrast/T` live).
2. **Live eyeball with data** — P4/P8/P9 are all marked "not yet live-eyeballed" in the resume handoff §5 precisely because the account has no located contacts. Seed/pin data, screenshot light + dark.
3. **P13 — graduate `mapHorizon` ON by default** (the phase that makes Horizon the *default* experience for everyone). Requires a `FLAGS_VERSION` bump + migration-block line (a persisted `false` would otherwise mask the flip). **This is the step that finally answers "why don't I see it" permanently** — but only do it after the fidelity audit + a live eyeball, and per the existing Rule-A gate on P13.

---

## 6. Checklist for the investigating session
- [ ] Confirm `mapHorizon` flag state in the user's actual browser (H1).
- [ ] Confirm origin (local vs prod) (H4).
- [ ] With flag on + data seeded, screenshot live Horizon (dark + light).
- [ ] Side-by-side diff vs the Direction-D mockup → divergence list (H3/§5.1).
- [ ] Decide scope: fidelity pass now vs flip-default (P13) now vs both.
- [ ] If flipping default: `FLAGS_VERSION` bump + migration line + re-verify OFF→ON path.

---

## 7. One-line answer for the user
The Horizon redesign is built and working but **lives behind the `mapHorizon` flag, which is OFF by default** (intentional dark-launch) — so the everyday Map is still the old one. Turn on "Map Horizon Redesign (Alpha)" in Settings to see it; then close the remaining **data** + **visual-fidelity** gaps vs the mockup, and finally flip the flag on by default (P13).
