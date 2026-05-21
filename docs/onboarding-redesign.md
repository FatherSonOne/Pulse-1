# Pulse Post-Stripe Onboarding — Redesign Spec

**Status:** Design, not built. Produced by `/impeccable onboard post-stripe flow` after a full critique.
**Owners:** Product + Eng. Pre-launch investor demo target.
**Brief:** [onboarding-revival.com](onboarding-revival.com). **Critique:** see prior session synthesis.
**Register:** product. **Brand laws:** [PRODUCT.md](../PRODUCT.md), [DESIGN.md](../DESIGN.md).

---

## 1. Aha moment

> **"I just sent a message in Pulse and got an AI-drafted reply, a summary, and a next-action in under 30 seconds."**

Not: *I configured my org logo.* Not: *I dismissed a checklist.* The activation event is `first_relay_message_sent`. Everything else is decoration that does not count as onboarding success.

## 2. Personas this flow must serve

1. **The Owner (primary)** — solo operator, just paid Stripe, has Linear/Raycast muscle memory, wants to feel the product in seconds, will close the tab if asked to fill 4 forms.
2. **The Returning Owner** — closed the tab mid-flow, came back hours/days later. Modal-locked them out today.
3. **The Invited Member / Admin** — never goes through Stripe. Today the checklist leaks to admins. Must see *nothing* setup-related.
4. **The Second-Workspace Owner** — already activated once, spinning up a child org. Modal currently re-fires. Must short-circuit.

## 3. Success metrics (must be instrumented before this ships)

| Event | Trigger | Why |
|---|---|---|
| `onboarding.plan_picker_named` | Org name typed pre-Stripe | Pre-Stripe activation signal |
| `onboarding.checkout_completed` | `?billing=success` lands | Funnel anchor |
| `onboarding.surface_shown` | Post-Stripe surface mounts | Modal → surface conversion |
| `onboarding.founder_note_played` | Voice note `play` event | Education attempt |
| `onboarding.first_message_sent` | First Relay message persists | **Activation** |
| `onboarding.first_capture_made` | First voice/quick capture | Secondary activation |
| `onboarding.teammate_invited` | First invite sent | Network activation |
| `onboarding.polish_opened` | Polish group expanded | Curiosity signal |
| `onboarding.polish_item_completed` | Logo / domain / billing / invite done | Maturity |
| `onboarding.dismissed` | User explicitly hides the surface | Drop-off |

Target: 60% reach `first_message_sent` within 5 minutes of `checkout_completed`. Below 40% means the surface is wrong.

## 4. The state machine

Replace the three-state column on `workspaces`:

```
Today:    onboarding_step  IN  ('pending', 'named', 'complete')
Proposed: onboarding_step  IN  ('named', 'activated', 'matured')
```

- `'named'` — workspace exists with a real name (set in the plan picker pre-Stripe; never null). Post-Stripe surface renders.
- `'activated'` — `first_relay_message_sent` has fired. Polish group becomes the only remaining UI.
- `'matured'` — Polish group dismissed or all four items complete. Surface gone.

NULL is coerced to `'matured'` at the read site (pre-existing workspaces). The `'pending'` value is **dropped from the schema**; org name is collected in the plan picker before checkout, so there is no longer a state where a workspace lacks a name. This kills the owner-lockout edge case entirely.

The blocking modal at [OrgOnboardingModal.tsx](../src/components/settings/OrgOnboardingModal.tsx) is **deleted**, not refactored.

## 5. The flow, screen by screen

### 5.1 Pre-Stripe — Plan picker captures org name

A single full-width step before Stripe Checkout. The form is two fields, not four.

```
┌──────────────────────────────────────────────────────────────────┐
│  PULSE  ·  TEAM TRIAL                                            │
│                                                                  │
│  What should we call your workspace?                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Acme Inc.                                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│  We'll use this everywhere. You can rename later.                │
│                                                                  │
│  How big is your team right now?                                 │
│                                                                  │
│  [ Just me ]   [ 2–5 ]   [ 6–20 ]   [ 21+ ]                      │
│                                                                  │
│  ──────────────────────────────────────────────────────────────  │
│                                                                  │
│                          [ Continue to checkout  → ]             │
└──────────────────────────────────────────────────────────────────┘
```

- Org name is required, validated, and **passed to Stripe Checkout as the customer name** in [billing-checkout/index.ts:150](../supabase/functions/billing-checkout/index.ts#L150). One source of truth.
- Team size becomes `workspace.size_bucket` ([workspaceService.ts:99](../src/services/workspaceService.ts#L99)) and seeds the Relay channel's example notes (solo gets one note set, teams get another).
- Industry is **not** asked. Two questions only. Industry can come later from contextual capture.

### 5.2 Stripe Checkout → webhook → return

- Stripe redirects to `/?onboarding=just-paid` (NOT `/settings?billing=success`).
- The new landing route reads `entitlements` and applies a **30s optimistic grace** in `sessionStorage` ([TrialGate.tsx:59-64](../src/components/billing/TrialGate.tsx#L59-L64)): during the grace window, `TrialExpiredBlock` never renders.
- In parallel, a 1.5s poll calls `useEntitlements().refresh()` up to 10 times. As soon as `entitlements.apps.pulse` becomes true, the grace flag is cleared and the real entitlement state takes over.
- `startPulseTeamTrial` becomes **synchronous and awaited** inside [workspaceService.ts:363](../src/services/workspaceService.ts#L363); workspace creation hard-fails if it errors. No more fire-and-forget.

### 5.3 The post-Stripe surface — full bleed

This replaces the modal + dashboard checklist entirely for workspaces in `onboarding_step IN ('named', 'activated')`.

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  ◀ PULSE   acme inc. ▾                                                  ⚙   ?      │
├─────────────────────────────────────────────────────┬──────────────────────────────┤
│                                                     │                              │
│  RELAY · #welcome                                   │  YOUR ACTIVATION             │
│                                                     │                              │
│  ┌─────────────────────────────────────────────┐    │                              │
│  │  ▶  0:18   "Hey — I'm Jay, founder of       │    │  MESSAGES SENT       0       │
│  │            Pulse. Tap reply and say         │    │  ──────────────────────      │
│  │            anything back. That's it,        │    │                              │
│  │            that's onboarding."              │    │  CAPTURES MADE       0       │
│  │  CLAUDE · SUMMARY  →  see below             │    │  ──────────────────────      │
│  └─────────────────────────────────────────────┘    │                              │
│                                                     │  TEAMMATES INVITED   0       │
│  ┌─────────────────────────────────────────────┐    │  ──────────────────────      │
│  │  ▶  0:22   "This is what a Vox sounds       │    │                              │
│  │            like. Hold the mic, speak,       │    │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  │            release. Want it transcribed?    │    │                              │
│  │            Pulse already did."              │    │  ▾ Polish your workspace     │
│  │  CLAUDE · SUMMARY  →  see below             │    │     (4 small things)         │
│  └─────────────────────────────────────────────┘    │                              │
│                                                     │                              │
│  ┌─────────────────────────────────────────────┐    │                              │
│  │  ▶  0:25   "Last one. Pulse drafts replies, │    │                              │
│  │            tracks decisions, and stays out  │    │                              │
│  │            of your way. Now you try."       │    │                              │
│  └─────────────────────────────────────────────┘    │                              │
│                                                     │                              │
│  ┌─────────────────────────────────────────────┐    │                              │
│  │   ●  Hold to record, or type your reply…    │    │                              │
│  └─────────────────────────────────────────────┘    │                              │
│                                                     │                              │
└─────────────────────────────────────────────────────┴──────────────────────────────┘
```

#### 5.3.1 Left rail — Relay #welcome channel

- A **real** Relay channel, not a tutorial mode. The same `RelayTriageStream` component renders it; the only difference is the seed data and the channel's `is_welcome` flag.
- Seeded with **three founder voice notes** (20-25s each). Audio is real, prerecorded, served from Supabase storage `voxer/welcome/`. Three notes only — not five. Founder voice, no music, no intro card.
  1. *"Reply to this — that's it, that's onboarding."* (sets the activation bar at one message)
  2. *"Here's what a Vox is. Try recording one."* (explains the primary primitive)
  3. *"Pulse drafts replies and tracks decisions. Now you try."* (closes the loop)
- Each note carries the **`CLAUDE · SUMMARY`** provenance chip beneath it ([DESIGN.md §5 signature component](../DESIGN.md)) — exactly the same chip that appears on every other AI artifact in Pulse. The chip expands inline to show the AI-generated summary. This *demonstrates* "AI shows its work" instead of telling.
- The reply composer at the bottom is the **real** Vox composer (`VoxRecordArea` from [src/components/Relay/](../src/components/Relay/)). Hold-to-record works. Typing works. Sending counts toward `messages_sent`.

#### 5.3.2 Right rail — Activation counters

A vertical stack, no card chrome, sitting on the right at 320px wide on desktop / collapsed to a horizontal pill row on mobile.

- Three live counters: `MESSAGES SENT`, `CAPTURES MADE`, `TEAMMATES INVITED`. JetBrains Mono uppercase tracked 0.1em, count rendered in `--pulse-mono-numeric` with `tabular-nums`. Number font-size 32px; label 11px.
- Each counter **ticks live** as the user takes the action. The tick animation is a single 220ms `--pulse-ease` slide-in with no bounce; the number colors momentarily flash to `--pulse-rose` then settles to `--pulse-ink`. Respects `prefers-reduced-motion`.
- When `MESSAGES SENT >= 1`, the entire activation block does **not** disappear. It collapses to a single line at the top of the right rail: `ACTIVATED · 1 MESSAGE · 0 CAPTURES · 0 INVITES`. The surface persists until the Polish group is dismissed.
- The hero-metric template is explicitly avoided: no four-equal-cards, no gradient accents, no big number with small label decoration. Three labels, three live numbers, one rule line separating them. That is all.

#### 5.3.3 Workspace breadcrumb (top-left)

`acme inc. ▾` is **in-place editable**: click → input → blur to save. No settings page deep-link. If the org name is wrong, fix it here in 2 seconds.

#### 5.3.4 The Polish group (demoted, not deleted)

Collapsed by default into a single line under the activation rail:

```
▾ Polish your workspace  (4 small things)
```

Expanded:

```
─────────────────────────────────────────
  POLISH  ·  4 SMALL THINGS

  ○  Upload a logo                       ›
  ○  Invite a teammate                   ›
  ○  Auto-join your domain               ›
  ○  Set a billing contact               ›

  Dismiss this section
─────────────────────────────────────────
```

- Items expand **inline** as accordions. No settings-page yank. The logo uploader, the invite form (bulk paste supported), the domain field, and the billing-contact field all render inside the accordion. Save buttons are inline. Sidebar updates immediately.
- Each item is the same vertical primitive: leading status icon (Circle / CheckCircle2 using `--pulse-tone-positive`), label in Inter title 15px, helper in Inter caption 12px ink-2.
- **No gradient backgrounds, no halo blobs, no glow shadows.** Plain `--pulse-surface` on `--pulse-canvas`, 1px `--pulse-border`. The Polish group earns no decorative attention — it is housekeeping.
- "Dismiss this section" is a low-priority ghost link. Flipping `onboarding_step` to `'matured'`. No "are you sure" — easy to undo from settings if regret strikes.
- Auto-join domain accordion adds a `gmail.com / outlook.com / icloud.com` guard: if the user's email domain is a public mail provider, the field is disabled with helper text *"Auto-join requires a workspace domain (e.g. acme.com)."*
- Billing-contact accordion explains the relationship to Stripe: *"Where invoices land. By default this is the email you gave Stripe. Override only if invoices should go elsewhere."* When the user changes it, fire `stripe.customers.update` to sync — no more silent desync.

### 5.4 The mobile / narrow-window adaptation

Below 720px the layout stacks. Activation counters become a single horizontal pill row pinned to the top of the screen; Relay channel takes the remainder. Polish group sits below the channel, still collapsed by default. Hold-to-record and inline accordions retain 48px touch targets per [pulse-tokens.css:154-163](../src/styles/pulse-tokens.css#L154-L163).

### 5.5 The "I want to skip this" path

A subtle `Take me to my dashboard →` ghost link in the top-right of the surface. Click → flips `onboarding_step` to `'matured'`, fires `onboarding.dismissed`, lands the user on Dashboard (with Polish group re-accessible from Settings if regret strikes). **No "are you sure", no second modal.** Power users skip; new users don't notice the link until they're ready.

The skip link respects the original brief: *Let experienced users skip onboarding. Don't block access to product. Provide "Skip" or "I'll explore on my own" options.*

## 6. Edge case map — every case from the critique, addressed

| Case | Today | Proposed |
|---|---|---|
| Owner closes tab and returns | Modal-locked forever | No modal. Returns to surface; everything is non-blocking. |
| Stripe webhook lag → "trial expired" flash | Hard branch on stale entitlements | 30s `sessionStorage` grace + 1.5s entitlements poll |
| Invited admin sees checklist | `OrgSetupChecklist` gated on `isAdmin` | Surface gated on `isOwner && onboarding_step IN ('named','activated')` |
| `onboarding_step = null` | Silent no-op | Coerced to `'matured'` at read site |
| Second workspace re-fires modal | Yes, painful | Surface only shows for `workspaces.length === 1 && isOwner`. Second workspace: no surface, just an inline rename toast. |
| Admin flips `onboarding_step` from another tab | Possible (RLS allows) | Add DB CHECK: only owner can write `onboarding_step` (RLS WITH CHECK by `created_by` or `role='owner'` lookup) |
| `startPulseTeamTrial` silently fails | Workspace exists with no entitlements | Awaited + hard-fail; workspace creation rolls back |
| `billing_email` desyncs from Stripe customer.email | Silent | Sync via `stripe.customers.update` on save |

## 7. Visual spec

### 7.1 Tokens (mandatory)

Everything below references [pulse-tokens.css](../src/styles/pulse-tokens.css). **No hex literals, no Tailwind palette references (`rose-500`, `emerald-500`, `zinc-*`) in the new files.**

| Surface | Token |
|---|---|
| Canvas | `var(--pulse-canvas)` |
| Surface card | `var(--pulse-surface)` |
| Border | `var(--pulse-border)` |
| Primary text | `var(--pulse-ink)` |
| Secondary text | `var(--pulse-ink-2)` |
| Tertiary text | `var(--pulse-ink-3)` |
| Brand accent (primary CTA, active state, focus ring) | `var(--pulse-rose)` |
| Done status check | `var(--pulse-tone-positive)` |
| Counter tick flash | `var(--pulse-rose)` |
| Modal scrim (the Skip-confirmation tooltip if any) | `.pulse-modal-scrim` |

### 7.2 Type

| Role | Family | Weight | Size | Tracking | Case |
|---|---|---|---|---|---|
| Surface heading (none — there is no big "Welcome to Pulse") | — | — | — | — | — |
| Counter number | Inter | 600 | 32px | -0.02em | as-is |
| Counter label | JetBrains Mono | 500 | 11px | 0.1em | UPPER |
| Polish section header | JetBrains Mono | 500 | 11px | 0.1em | UPPER |
| Polish item label | Inter | 500 | 15px | normal | as-is |
| Polish item helper | Inter | 400 | 12px | normal | as-is |
| Founder note title (overlay) | Inter | 500 | 14px | normal | as-is |
| Provenance chip | JetBrains Mono | 500 | 11px | 0.1em | UPPER |
| Workspace breadcrumb | Inter | 500 | 15px | normal | as-is |

There is **no welcome headline**. No "Welcome to Pulse, Acme Inc." string. The surface itself is the welcome.

### 7.3 Color strategy

**Restrained.** Tinted neutrals carry 95% of the surface. Rose is reserved for: active counter tick, send/record button, focus ring, founder note play affordance, hover state on Polish items. Nothing else. No gradient, no glow blob, no decorative pink.

The current modal's pink-halo decorative blob ([OrgSetupChecklist.tsx:117](../src/components/settings/OrgSetupChecklist.tsx#L117)) does not appear in the new surface.

### 7.4 Motion

| Element | Curve | Duration | Property |
|---|---|---|---|
| Counter tick | `--pulse-ease` | 220ms | `transform: translateY()` + color flash |
| Polish accordion expand | `--pulse-ease` | 220ms | `height` + opacity (use FLIP, not `transition: all`) |
| Skip link hover | linear | 100ms | `opacity` |
| Founder note play | `--pulse-ease` | 220ms | progress bar transform |
| `prefers-reduced-motion` | n/a | 0ms | All transitions disabled; counters snap |

No spring physics, no bounce, no elastic, no orchestrated entrance sequence. Per [DESIGN.md §4](../DESIGN.md): 2px-lift-cap; no theatrical hover.

### 7.5 Sound

Three founder voice notes only. No background music, no UI sound effects, no recording-start chime beyond the existing Relay one. Pulse is sharp, not playful — sound effects are bare except where they convey real state (record start/stop already exists in `VoxRecordArea`).

## 8. Accessibility spec

- Surface is a real route (`/onboarding`), not a modal. Browser back button works. Tab order is left-to-right, top-to-bottom: workspace breadcrumb → founder notes → composer → counters → Polish toggle.
- Skip link is the first tabbable element on the surface — keyboard users escape immediately.
- Counters use `aria-live="polite"` so screen readers announce ticks without interrupting.
- Founder notes are real `<audio>` elements with `controls` semantics; transcript chip expands a `<details>` with the AI summary.
- Polish accordion uses `<details>` / `<summary>` for native keyboard support and `prefers-reduced-motion` respect.
- Focus rings: 2px `var(--pulse-rose)` outline + 3px `var(--pulse-rose-glow)` halo, via [pulse-tokens.css:140](../src/styles/pulse-tokens.css#L140).
- Contrast: every text/background pair tested AA at minimum. Replace `text-zinc-400` on white violations from the old checklist.
- Reduced motion: all counter ticks, accordion expansions, and the founder-note progress bar honor `prefers-reduced-motion`.

## 9. What is being deleted

- [`src/components/settings/OrgOnboardingModal.tsx`](../src/components/settings/OrgOnboardingModal.tsx) — entire file. The pre-Stripe plan picker captures the name; no post-Stripe modal exists.
- [`src/components/settings/OrgSetupChecklist.tsx`](../src/components/settings/OrgSetupChecklist.tsx) — entire file. Replaced by the Polish accordion inside the new surface (or, post-`'matured'`, a quiet card in Workspace settings).
- The `'pending'` value from `workspaces.onboarding_step` CHECK constraint. Migration zeros it out (no rows should be in this state once the plan picker ships).

## 10. What is being added

- `src/components/Onboarding/PostStripeSurface.tsx` — new route component.
- `src/components/Onboarding/ActivationCounters.tsx` — right-rail counter stack.
- `src/components/Onboarding/PolishGroup.tsx` — accordion with inline forms.
- `src/components/Onboarding/FounderNote.tsx` — the seeded Vox card with provenance chip.
- `src/hooks/useActivationCounters.ts` — subscribes to PostHog events + DB counts.
- `src/components/billing/PlanPickerOrgNameStep.tsx` — pre-Stripe two-field form.
- `supabase/migrations/2026XXXXXXXXXX_onboarding_state_rework.sql` — drops `'pending'`, adds RLS owner-write constraint on `onboarding_step`.
- Six PostHog event calls wired against the existing [analytics.ts:74-94](../src/lib/monitoring/analytics.ts#L74-L94).

## 11. Telemetry contract (must match section 3)

```ts
trackEvent('onboarding.plan_picker_named',   { team_size, name_length });
trackEvent('onboarding.checkout_completed',  { plan_tier });
trackEvent('onboarding.surface_shown',       { workspace_id });
trackEvent('onboarding.founder_note_played', { note_index, completion_pct });
trackEvent('onboarding.first_message_sent',  { seconds_since_surface_shown });
trackEvent('onboarding.first_capture_made',  { seconds_since_surface_shown });
trackEvent('onboarding.teammate_invited',    { invite_method, count });
trackEvent('onboarding.polish_opened',       { });
trackEvent('onboarding.polish_item_completed', { item_id });
trackEvent('onboarding.dismissed',           { messages_sent, polish_completed_count });
```

Every event is fired exactly once per session (idempotent on `workspace_id + event_name`). The funnel is `surface_shown → first_message_sent`; everything else is secondary.

## 12. Out of scope (do NOT scope-creep)

- Industry classification, role classification, persona quiz. Two fields pre-Stripe. Stop.
- "What brought you to Pulse" textarea. No.
- A separate tutorial mode disconnected from real product. The Welcome channel **is** real product.
- Confetti. The activation moment is the counter ticking from 0 to 1. That is enough.
- A founder Loom. Three 20-second voice notes are the founder voice. A 5-minute Loom is a different product's onboarding.
- Sample data outside the Welcome channel. The user's Dashboard remains empty until they generate real data.

## 13. Sequencing into the rest of the impeccable plan

Next steps after this spec is accepted:

| Step | Command | Touches |
|---|---|---|
| 2 | `/impeccable typeset` | Counter labels, Polish header, provenance chip, breadcrumb — apply JetBrains Mono uppercase per §7.2 |
| 3 | `/impeccable quieter` | Strip gradient + halo + glow from any legacy onboarding code that survives the deletes; ensure the new surface launches Restrained |
| 4 | `/impeccable harden` | Radix Dialog for any remaining modal moments (in-place rename); a11y (§8); token migration (§7.1); telemetry (§11); trial-expired-flash fix (§5.2) |
| 5 | `/impeccable polish` | Final pass: copy, edge cases, dark mode parity, cross-browser, mobile |

## 14. Pre-launch acceptance — the bar this must clear

A new user, paying Stripe in a clean session, should be able to:

1. Type two fields and reach checkout in **under 10 seconds.**
2. Return from Stripe and see the welcome surface in **under 2 seconds**, with no "trial expired" flash.
3. Send their first message in Relay in **under 30 seconds** from landing on the surface.
4. Reach `'matured'` (or close the tab activated) without ever touching a settings page.

If any of those four bars fails on a real device, this redesign hasn't shipped — it's just rearranged.
