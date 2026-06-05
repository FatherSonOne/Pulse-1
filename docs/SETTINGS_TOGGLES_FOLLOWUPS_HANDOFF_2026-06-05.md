# Settings Toggles — Follow-ups Handoff — 2026-06-05

> Continue-work handoff. Pairs with the `/impeccable critique` pass on the
> Features & Labs toggle surface (2026-06-05). This doc is a **plan to execute
> later**, not work already done. It captures three follow-ups left open after
> that pass, plus the ground-truth needed to act on them safely
> (CLAUDE.md Rule A — no destructive change without an approved pros/cons;
> Rule B — verify wiring before declaring anything dead).
>
> Prior context: `docs/MESSAGE_SETTINGS_HANDOFF_2026-06-01.md` (the Message
> Settings repurpose that curated the Messages slide-out panel).

---

## 0. Context — what shipped this session

A `/impeccable critique` of the **global** Features & Labs settings surface
([src/components/settings/FeaturesLabsSettings.tsx](../src/components/settings/FeaturesLabsSettings.tsx))
scored it 25/40 and surfaced five issues. All five were fixed and pushed to
`main`. The shared `ToggleItem` primitive carries most of these changes, so they
also affect the 8 other settings surfaces that consume it.

| Commit | Action | What |
|---|---|---|
| `8238168` | harden | `ToggleItem` got `role="switch"` + `aria-checked`; the blue `!important` `*:focus-visible` override in `audit-fixes.css` (baseline boilerplate from the initial commit) replaced with the brand rose `#f43f5e` — **app-wide** |
| `95efe0a` | quieter | Toggle on-state coral (`bg-rose-500`) → neutral ink (`bg-zinc-800 dark:bg-zinc-200`), so a settings page full of "on" toggles no longer reads as a coral wall (Coral-As-Signal rule) |
| `1f72acb` | clarify | Added `FEATURE_DESCRIPTIONS` (grounded in verified consumers) and wired it in; killed `desc=""`; removed the leaked `MessageInput` code-name from the advanced-category copy |
| `fc5c64f` | audit | Neutralized the Messages panel `ToggleSwitch` to match `ToggleItem`; **discovered the priority-lock path is dead code** (see Follow-up 1) |
| `5351c13` | adapt | Whole row is now the switch: one tab stop, ≥48px touch/focus target, no click-bubbling |

**Verification at ship time:** each commit type-checked clean (full-repo `tsc`
= **918** errors total, under the ~1,234 pre-existing baseline; **zero** in any
touched file or `ToggleItem` consumer) and passed the gitleaks pre-commit hook.
**Not yet visually verified in a running browser** — drive the app (light + dark)
to confirm the rose focus ring, four toggle states, and 48px row target before
relying on it.

---

## 1. Follow-up — remove the dead `isPriority` path in FeatureSettingsPanel

### 1.1 Ground truth (verified 2026-06-05)
The Messages slide-out panel
([src/components/Messages/FeatureSettingsPanel.tsx](../src/components/Messages/FeatureSettingsPanel.tsx))
renders only `MESSAGE_SETTINGS_CATEGORIES` (`:46`), which contains a single
category, `message`. It does **not** iterate the global `FEATURE_CATEGORIES`.
Therefore:

- `isPriority={categoryId === 'priority'}` (`:650`) is **always `false`** — there
  is no `priority` category in this panel.
- Consequently the locked-toggle + `PRIORITY` badge path never executes:
  - `FeatureRow` `isPriority` prop (`:1234`, `:1244`)
  - the `PRIORITY` badge block `{isPriority && (…)}` (`:1269`–`:1283`)
  - `disabled={isPriority}` on that row's `ToggleSwitch` (`:1291`)
  - the `{!isPriority && (…)}` guard around Enable-All/Disable-All (`:1172`)
  - the `isPriority` prop threaded through `CategoryRowProps` (`:1077`, `:1094`,
    `:1165`)

This is leftover scaffolding from when the panel iterated `FEATURE_CATEGORIES`
(pre the 2026-06-01 Message Settings repurpose). It is dormant, not buggy.

### 1.2 Why the critique called it an "inconsistency" (corrected)
The critique flagged "priority locked in the panel vs free in settings." That was
read from the **code**, before confirming the code path is unreachable. Per
Rule B: it is **not a live inconsistency**. There is nothing to reconcile in
behavior — only dead code to (optionally) remove.

### 1.3 Rule-A pros/cons (fill in before deleting)
- **Pros:** removes ~30 lines of unreachable branching; `CategoryRow` /
  `FeatureRow` get simpler signatures; future readers aren't misled into thinking
  a priority-lock exists.
- **Cons:** if a future change re-introduces a `priority` category into
  `MESSAGE_SETTINGS_CATEGORIES`, the lock/badge UX would have to be rebuilt. Low
  risk (the panel is deliberately curated to message-scoped flags), but real.
- **Decision needed:** delete now, or leave dormant. Default recommendation:
  **delete** — it's genuinely unreachable and the git history preserves it.

### 1.4 Scope / verification
- File: `FeatureSettingsPanel.tsx` only.
- Remove the `isPriority` prop from `CategoryRowProps` + `FeatureRowProps`, the
  badge block, the `disabled={isPriority}`, and the `{!isPriority}` guard (always
  render Enable/Disable-All, since the only category is non-priority).
- Gate: `tsc` no-new-errors; the panel's baseline was 0 errors after this session.

---

## 2. Follow-up — unify on ONE shared Switch component

### 2.1 Ground truth
There are **two** toggle implementations, now visually matched but still
separate:

1. `src/components/settings/shared/ToggleItem.tsx` — the row IS the switch
   (`role="switch"`, `tabIndex`, key handler), neutral on-state, ≥48px target.
   Used by **9** settings surfaces.
2. `ToggleSwitch` inside `FeatureSettingsPanel.tsx` (`:1317`+) — a standalone
   switch control (`role="switch"`, `md`/`lg` sizes), used for the Advanced-Mode
   header toggle, `SettingRow`, and `FeatureRow`. After `fc5c64f` its on-state is
   neutral too, mirroring `ToggleItem`'s four-state contrast
   (light-on `#27272a`, dark-on `#e4e4e7` track + `#18181b` knob).

They were brought to **visual** parity in Actions 2/4, but they are duplicated
logic. The remaining inconsistency is structural, not visible.

### 2.2 Target
Extract a single `Switch` primitive and have both call sites consume it:
- `ToggleItem` wraps `Switch` as the visual + the row as the interactive element
  (or `Switch` owns interactivity and `ToggleItem` is layout-only — decide).
- `FeatureSettingsPanel`'s `SettingRow` / `FeatureRow` / Advanced-Mode toggle
  consume the same `Switch`.

### 2.3 Risks / Rule-A note
- `FeatureSettingsPanel.tsx` is ~1,380 lines and uses an **inline theme object**
  (`t`) with explicit `toggleOff` / `toggleKnob`, while `ToggleItem` uses Tailwind
  + `dark:` variants. A shared `Switch` must support both theming models or one
  side must migrate. This is a real refactor of working code — **additive,
  reversible** is the bar (build the new `Switch`, migrate one call site, verify,
  then the next). Do not rip out the panel.
- Keep `role="switch"` + `aria-checked` + the Enter/Space handling on whichever
  element is interactive. Don't regress the a11y won this session.

### 2.4 Scope
- New: `src/components/settings/shared/Switch.tsx` (or `shared/ui/Switch.tsx`).
- Edit: `ToggleItem.tsx`, `FeatureSettingsPanel.tsx`.
- Gate: `tsc` no-new-errors across all 9 `ToggleItem` consumers + the panel.

---

## 3. Follow-up — curate vestigial flags out of global Features & Labs

### 3.1 Ground truth (verified consumers, 2026-06-05)
| Flag | Verified consumer | Status |
|---|---|---|
| `moodBadges` | `MessageEnhancements/MessageMoodBadge.tsx:13` | **Live** |
| `smartReplies` | `Relay/VoxSmartReplies.tsx:38` (Relay) | **Live** |
| `scheduledMessages` | `MessageEnhancements/MessageScheduling.tsx` + `ScheduleMessageModal` | **Live** |
| `voiceInput` | `MessageInput/MessageInput.tsx:106,752,773` | **Vestigial** — gates the *classic* composer only (retired on the Pulse-DM path; reachable on legacy threads) |
| `aiComposer` | `MessageInput/MessageInput.tsx:104,586` | **Vestigial** — classic composer only |
| `toneAnalysis` | `MessageInput/MessageInput.tsx:105,665` | **Vestigial** — classic composer only (Advanced Mode) |

The three vestigial flags still appear under **Priority / Advanced** in the global
Features & Labs surface because `FeaturesLabsSettings` iterates
`FEATURE_CATEGORIES`. Toggling them has **no effect on the current Pulse-DM
composer**. Their descriptions (added in `1f72acb`) are honest about this ("…in
the classic composer"), but the toggles are still arguably noise on the main
surface.

### 3.2 Two ways to do it — pick the safe one first
- **Safe / additive (recommended first step):** remove the vestigial keys from
  the `FEATURE_CATEGORIES.priority.features` / `.advanced.features` **arrays** in
  [src/contexts/FeatureContext.tsx:237](../src/contexts/FeatureContext.tsx#L237).
  This only changes what the **global** surface renders — `FEATURE_CATEGORIES` is
  no longer consumed by the Messages panel (that uses `MESSAGE_SETTINGS_CATEGORIES`).
  The flag **definitions** (`FeatureFlags`, `DEFAULT_FEATURES`, `FEATURE_NAMES`,
  `FEATURE_DESCRIPTIONS`) stay intact, so the classic-composer gates keep working
  for legacy threads. Fully reversible.
  - After this, `priority` would contain only `moodBadges`; consider whether a
    one-item "Priority" category still earns its own card, or whether `moodBadges`
    folds into a single "Message Features" card alongside `scheduledMessages`
    (matching the Messages panel's curation).
- **Destructive / Rule-A heavy (defer):** delete the flag **keys** entirely. This
  touches the `FeatureFlags` interface, `DEFAULT_FEATURES`, `FEATURE_NAMES` (a
  *total* `Record`, so a key can't be dropped without updating the type),
  `FEATURE_DESCRIPTIONS`, `FEATURE_CATEGORIES`, **and** the live
  `isFeatureEnabled('…')` call sites in `MessageInput.tsx` (which would orphan the
  classic composer's voice/AI/tone gates). Only do this if the classic composer
  is being fully retired. Present a per-flag pros/cons and get sign-off.

### 3.3 Open question for the user
Is the **classic** `MessageInput` composer slated for full removal, or is it still
load-bearing on the legacy-thread branch? The answer decides between 3.2-safe
(keep gates, hide toggles) and 3.2-destructive (remove gates + flags). Per the
`project_pulse_messages_tools_removed` memory, `MessageInput` was *preserved* for
the legacy-thread path — so **3.2-safe is the default** until that path is gone.

### 3.4 Scope / verification
- Safe path: `FeatureContext.tsx` only (+ a glance at `FeaturesLabsSettings.tsx`
  if a one-item category gets restructured).
- Gate: `tsc` no-new-errors; manual check that Features & Labs renders the curated
  list and the classic-composer gates still respond on a legacy thread.

---

## 4. Files in scope (all follow-ups)
- `src/components/Messages/FeatureSettingsPanel.tsx` — dead `isPriority` removal (1); shared-Switch migration (2).
- `src/components/settings/shared/ToggleItem.tsx` — shared-Switch migration (2).
- `src/components/settings/shared/Switch.tsx` — **new**, if doing (2).
- `src/contexts/FeatureContext.tsx` — `FEATURE_CATEGORIES` curation (3).
- `src/components/settings/FeaturesLabsSettings.tsx` — only if a category card is restructured (3).

## 5. Verification strategy (every follow-up)
- **Type-check (gate):** `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`,
  gate on **no NEW errors** vs the current **918** total. The settings/toggle
  files were all 0 after this session.
- **gitleaks:** runs on every commit; never `--no-verify`.
- **Manual (required — headless can't drive the UI):** open Settings → Features &
  Labs and the Messages → Message Settings panel in **both** themes; tab to a
  toggle (rose focus ring), flip it (neutral on-state, knob legible), confirm a
  screen reader announces on/off; for (3), confirm the classic-composer gates
  still respond on a legacy thread.
- Commit each follow-up independently with explicit paths (parallel sessions are
  active on `main` — never `git commit -a` / bare commit; see
  `feedback_parallel_session_commit_a_sweep`).

## 6. Sequencing (suggested)
1. **(3) safe curation** — smallest, highest user-facing value (removes noise from
   the global surface). Additive/reversible. Commit.
2. **(1) dead-code removal** — quick, isolated to the panel. Commit.
3. **(2) shared Switch** — the real refactor; do last, one call site at a time.

## 7. Cross-references
- This session's commits: `8238168`, `95efe0a`, `1f72acb`, `fc5c64f`, `5351c13`.
- Prior handoff: `docs/MESSAGE_SETTINGS_HANDOFF_2026-06-01.md`.
- Memory: `project_pulse_messages_tools_removed` (composer default + tools
  removal), `reference_pulse_design_tokens` (Coral-As-Signal), `feedback_parallel_session_commit_a_sweep`.
