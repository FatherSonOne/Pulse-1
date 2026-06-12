# Mobile Chrome Handoff — slim bar + sheets + FAB retirement (2026-06-11)

Resume point for the next session.

> **UPDATE 2026-06-11 (session 2 — RESOLVED + pushed to `origin/main`).**
> Everything in the original handoff below (P1, both P2s, the full P3 sweep,
> and all 5 UNVERIFIED items) has been worked and pushed. See "Session 2
> outcome" immediately below; the original session-1 findings are kept
> verbatim as the record. Remaining open work is the broader
> keyboard-occlusion follow-up (L5) and a live visual pass.

## Session 2 outcome (2026-06-11) — shipped to origin/main

| Commit | What |
|---|---|
| `c980648` | **P1** focus-trap re-arm fix (useFocusTrap reads onEscape via ref, dropped from deps) + **P2a** arrow-key roving skips inputs + **P2b** nav-sheet contrast bump |
| `004ce49` | **P3 sweep**: active-row leading mark, focus-visible ring on rows, Email-Off/v2.0 aria, md-breakpoint sheet clear, stale FAB comments |
| `f83bc61` | **U3 + U5** new `src/lib/overlayStack.ts` LIFO stack: topmost-only Escape/Tab (useFocusTrap + CaptureModal) + `isOverlayOpen()` bail-guards in Relay/Glimpse/chords/palette |
| `35eab9f` | **U4** Relay "Vox <name>" no-op-while-mounted fixed via keyed intent + retarget nonce + onIntentConsumed clear |
| `72de3d5` | **P3-4** War Room gated behind experimentalEnabled in the "+" sheet (matches nav) |
| `bb78ce4` | **L5** `isOverlayOpen()` made DOM-authoritative + 10 view-level shortcut handlers guarded + App Cmd+/ /Cmd+J openers |
| `9740e30` | **L5 regression fixes** (review-caught): PulseAssistant aria-modal drop, chord/Contacts Escape re-order, TrialExpiredBlock + DeleteWorkspaceDialog aria-modal |

Resolution of the 5 UNVERIFIED items: **U1** vox autoFocus — resolved by the
P1 fix (no longer a limitation). **U2** md-rotate — the P3-8 fix works; only a
pre-existing Safari<14 `addEventListener` nit remains (repo-wide pattern).
**U3** stacked Escape — fixed (overlay stack). **U4** Relay vox no-op — fixed.
**U5** global shortcuts under sheet — fixed for the 4 named handlers.

Verification: two adversarial-review workflows (8 + 5 agents) plus full `tsc`
(no new errors) across every commit. Two real defects the review caught in U4
(identical-target no-op remount; uncleared stale intent) were fixed before the
U4 commit landed.

### Still open (next session)
1. **[L5 — keyboard-occlusion pass] DONE 2026-06-11** (commits `f83bc61`,
   `bb78ce4`, `9740e30`). `overlayStack.isOverlayOpen()` is now DOM-authoritative
   (any visible `[role=dialog][aria-modal=true]` counts), and the 10 view-level
   handlers (Dashboard, Messages incl. `e`=archive, Calendar incl. Delete,
   Meetings, Email-hybrid ×2, Briefing, Contacts, Sidebar, Cockpit, Map) + App
   Cmd+/ and Cmd+J now bail under an overlay (Cmd+K kept as an escape hatch). A
   3-lens review caught 3 regressions, all fixed: PulseAssistant dropped a wrong
   `aria-modal` (the docked panel was killing all view shortcuts + blocking its
   own Cmd+/ close), and the chord `?` overlay's Escape-close + Contacts' Escape
   were re-ordered above the guard. TrialExpiredBlock + DeleteWorkspaceDialog
   gained `aria-modal`.
   **Residual (smaller follow-up):** these blocking modals still lack
   `aria-modal` so shortcuts leak under them — `billing/UpgradePrompt`,
   `contacts/DuplicateDetectionModal`, `contacts/ContactGoalModal`,
   `Email/TemplateVariablesModal`, `Email/EmailTemplatesModalEnhanced`,
   `WarRoom/RealtimeVoiceAgent` (one-attribute fix each; verify each is truly
   full-screen-blocking first). Also: `map/sub/useDialogA11y` doesn't register on
   the stack (relies on the DOM fallback — fragile if a future map dialog forgets
   `aria-modal`); `MessageContextMenu`'s desktop popover omits `aria-modal`
   (asymmetric with its mobile sheet — decide intent).
2. **Live eyeball** — still not done. Headless authed capture is blocked: the
   mobile chrome only renders inside the logged-in app at <768px and `e2e/.auth/`
   is empty (Google OAuth can't be minted headlessly). Refresh the e2e token via
   the DevTools localStorage export → Downloads (see
   `reference_pulse_e2e_auth_refresh`), then a Playwright capture at 390px +
   desktop War Room is straightforward. Otherwise eyeball on real Android.

---

_The original session-1 findings follow, kept verbatim:_

## What shipped (4 commits, base `949cff9`)

| Commit | What |
|---|---|
| `df758da` | Viewport-escapee fixes: `Messages.tsx:3707` h-screen→h-full; `LiveDashboard.tsx` h-screen→h-full + App.tsx adds LIVE_AI to the full-bleed branch (MESSAGES/CALENDAR pattern). Audit found exactly these 2 escapees. |
| `c9bfd15` | Slim 48px bottom bar (`MobileBottomNav.tsx` rework: ☰ / current-section mono label / +) + `src/components/MobileChrome/` (MobileSheet shell, MobileNavSheet, MobileQuickActionsSheet, mobileNavConfig) + `useAndroidBackButton` additive `interceptBack` + App wiring (`mobileSheet` state, `<main>` pb 56→48) + `pulse-sheet-up` keyframe in index.css. |
| `c11feb1` | Deletes `GlobalQuickActions.tsx` (the coral FAB) + its App mount. Desktop = palette/⌘K; mobile = "+" sheet. Approved removal. |
| `fafb96d` | Palette `peopleProvider`: zero-query branch replays ≤3 `person-*` commands from the MRU (`utils/recentCommands`) so the pinned "Recent" group resolves people; 1-char noise gate kept; 2+ char path unchanged (shared `commandsFor` factory). |

Design decisions locked: hot row = old 4 tabs; section list mirrors Sidebar `getNavSections` (Slack flag-gated, Email "Off" caption, Experimental locked, Settings); dark sheets opaque (`dark:bg-zinc-950`, floating-panel rule); sheets z-[9500]; bar keeps z-40. **Named deviation:** the Sidebar left drawer (top hamburger) was KEPT — it's the only mobile home for WorkspaceSwitcher, billing alert, theme toggle, Settings entry, GoogleAccountSelector. Full nav consolidation deferred.

## Verification status

- esbuild parse: clean. `tsc --noEmit` (8GB heap): **no new errors** — all hits in App/Messages/LiveDashboard are the documented pre-existing debt (the App ×2 pair is named in `068a871`'s message); zero diagnostics in any new file.
- Vitest: 125 failed / 684 passed in 14 files, **all uncoupled** from this diff (no failing file imports any changed module — grep-verified). Not re-run against base; treated as pre-existing.
- **Nothing visually verified.** No live eyeball on mobile or desktop yet.

## MUST FIX next session (adversarially confirmed)

1. **[P1] Focus trap re-arms every render — vox picker typing is broken.**
   `MobileSheet.tsx:25` passes unstable `onEscape ?? onClose` into `useFocusTrap`, whose effect deps include `onEscape` (`useFocusTrap.ts:93`). Every keystroke in the vox search re-renders → trap tears down (focus-restore yanks focus) + re-arms (rAF focuses first focusable = header X). One character per tap, keyboard dismisses, autoFocus defeated.
   **Fix:** in `useFocusTrap`, read `onEscape` through a ref (same pattern as `interceptBack` in `useAndroidBackButton`) and drop it from the effect deps so the trap arms once per `active` transition. `useCallback` on consumers is NOT sufficient (handleEscape closes over `voxPicker`). Optionally pass `initialFocusRef` for the picker input. (Two lenses found this independently: MobileSheet.tsx:25 / MobileQuickActionsSheet.tsx:59.)
2. **[P2] Arrow-key handler hijacks the vox search input** (`MobileQuickActionsSheet.tsx:93`): ArrowUp/Down while typing moves focus to the Back button instead of moving the caret. Guard: skip when `e.target` is an input/textarea.
3. **[P2] Contrast:** sheet section headers + "Off" caption (`MobileNavSheet.tsx:57,83`) fail WCAG 1.4.3 in both themes (zinc-400/zinc-500 at 9-10px). Darken/lighten one step.

## SHOULD FIX (confirmed P3s)

- Active nav row = color-only signal; dark active/inactive ratio 2.12:1 (`MobileNavSheet.tsx:75`) — add a leading-edge 2px coral mark or dot (DESIGN.md nav spec allows it).
- Disabled Experimental rows leave keyboard focus order; "v2.0" caption unexplained (`MobileNavSheet.tsx:69`).
- "Email Off" accessible name reads like a toggle state (`MobileNavSheet.tsx:83`) — aria-label the row properly.
- "+" sheet offers War Room ungated while nav sheet locks it behind `experimentalEnabled` (`MobileQuickActionsSheet.tsx:77`) — pick one behavior (note: a second verifier called this acceptable; contested, decide deliberately).
- Row focus-visible is a faint bg tint, below DESIGN.md's visible coral outline spec (`MobileNavSheet.tsx:71`).
- peopleProvider MRU rows can leak past the Recent pin into a stray bottom "People" group when >5 recents exist (`App.tsx:~580`).
- Stale Dashboard comments (1198, 1796) still point at the deleted FAB.
- Sheet survives md-breakpoint crossing invisible-but-mounted (trap live, state stale; scroll lock verified inert) — clear `mobileSheet` on a `md` matchMedia.
- Sheet + CaptureModal stacked: Escape closes the hidden sheet under the visible modal (`useFocusTrap.ts:62` stopPropagation layering).
- ⌘K / g-chords while a sheet is open: focus escapes the aria-modal sheet into the occluded palette input.

## UNVERIFIED (verify agents died on session limit — re-verify before fixing)

- vox-picker autoFocus known-limitation claim; open-sheet at ≥768px rotate details; Escape stopPropagation interplay; "Quick Relay contact pick silently no-ops when already on Relay" (initialContactId read-on-mount suspicion — check `Relay.tsx`); Relay/Glimpse window-capture shortcuts firing under an open sheet.

## Refuted (do NOT re-fix)

48/49px bar off-by-one; mobileSheetRef render-write; touch-target sizes on X/Back buttons; hot-row icon/label drift vs Sidebar; identical-card-grid concern; opaque dark panel; coral budget/mono/radius/motion conformance — all checked and passed or judged fine.

## Next steps, in order

1. Fix P1 (useFocusTrap ref pattern) + P2s; commit.
2. Sweep the SHOULD-FIX P3s (most are one-liners); commit.
3. Re-verify the 5 unverified findings.
4. **Live eyeball** mobile (narrow window + real Android) and desktop War Room (the LIVE_AI full-bleed change removes its outer padding — intended but unseen).
5. Push to origin when satisfied.
