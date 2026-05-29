# Email Composer Redesign — Handoff

**Status:** open · drafted 2026-05-28 · waiting on `_design-playground/email-composer-final.html`
**Surface:** `src/components/Email/EmailComposerModal.tsx` (1,429 lines)
**Flag:** none (composer is shared by legacy + hybrid surfaces)
**Two views to implement:**
1. **Focal Canvas Composer** — the main full-page composer surface (used for new messages, forwards, undo-restored drafts, and any time the user expands a reply).
2. **Sidecar** — slide-out inline reply panel that docks alongside the email being replied to, so the user can keep the source thread visible while composing.

**Reference designs:**
- **`_design-playground/email-composer-final.html`** ← PRIMARY. Owner-authored. Read this first; it shows both the Focal Canvas and the Sidecar literally. Do NOT start until this file exists.
- `_design-playground/email-redesign.html` — secondary. Has no literal composer mockup, but is the source of truth for the Cockpit/Triage aesthetic (type ramp, coral budget, chrome density) that both composer views must match.

---

## Why this exists

The Email Hybrid redesign (Cockpit + Triage, shipped via phases 0–10 +
12.1–12.15 in May 2026) replaced the reading surface with editorial,
serif-headlined, low-chrome views built on the canonical `--pulse-*`
design tokens. The composer is the last surface that still wears the
pre-hybrid look:

- Tailwind utility soup (`bg-white/95 dark:bg-zinc-900/95`,
  `border-stone-200/80 dark:border-zinc-700/80`) instead of
  `pulse-surface` / `pulse-border` token classes.
- A toolbar of ~14 icon buttons in one row (Bold / Italic / Underline /
  Link / Attach / Drive / Templates / Smart Compose / Tone Check /
  Enhance / AI Draft / Schedule / Meet / Confidential).
- Two side AI panels (`showAiPanel`, `showToneCheck`) that pop in/out
  with their own internal chrome and overlap the body when open.
- Header text is plain sans (`text-sm font-semibold`) — no serif, no
  editorial tone.
- Maximize mode is `w-[calc(100vw-80px)] h-[calc(100vh-32px)]
  top-4 right-4 rounded-xl` — floating card, not a true full-page
  takeover (compare to `.reader-panel.is-maximized`).

The owner is designing both composer views themselves and will
deliver them as `_design-playground/email-composer-final.html`
(both views in one playground file, side-by-side or tabbed). This
handoff is for the implementing agent — what stays, what changes,
what to read first, and the technical constraints not to break.

**Do not start implementation until the playground file exists.**
This handoff describes the wiring contract and the aesthetic
target; the actual layout / type / chrome decisions come from the
playground.

---

## The two views

### View 1 — Focal Canvas Composer (full page)

The "stretch out and write" surface. Used for:
- New messages (Cockpit FAB → composer with `replyTo=null`).
- Forwards.
- Undo-restored drafts (`initialTo` / `initialSubject` / etc. set
  but `replyTo=null`).
- Any reply where the user clicks Maximize.

Visual constraints:
- True full-page takeover. Mirror `.reader-panel.is-maximized` in
  `src/components/Email/hybrid/hybrid.css:343-356` — `position:
  fixed; inset: 0`, full width, no border, no rounded corners,
  opaque `var(--pulse-canvas)` background.
- This is where the editorial chrome lives — serif title block,
  generous whitespace, the AI tool cluster has room to breathe.

State binding: `useEmailComposeStore` with `isMaximized=true` (or
equivalent state field — the owner's design may rename this).

### View 2 — Sidecar (slide-out inline reply)

The "keep the thread visible while I reply" surface. Used for:
- Reply / Reply-All from a lane row, search-result row, signal row,
  or the slide-out reader panel.
- Reply triggered from `TriageCard` (when the user clicks Reply
  instead of Send-draft).

Visual constraints:
- Docks to the right of the current view, similar footprint to
  `.reader-panel` (720px / 92% max-width on wide screens, narrower
  at 1100px / 900px breakpoints — match the slide-out reader so
  the two surfaces feel like siblings).
- Opaque `var(--pulse-canvas)` background — same lesson as the
  reader panel (see Phase 12.15b in `docs/email-hybrid-phase12-polish.md`).
- Animates in from the right (mirror `@keyframes readerPanelIn`).
- The thread/email being replied to stays visible behind / next to
  the Sidecar — DO NOT mount a backdrop that blacks it out. The
  whole point of Sidecar is letting the user reference the source.
- Has an "Expand to Focal Canvas" affordance (Maximize2 icon, top
  bar) — clicking it transitions the same draft into View 1
  without losing form state.

State binding: same `useEmailComposeStore` instance, but
`isMaximized=false`. The store already drives this distinction.

### Same draft, two presentations

Both views read/write the same underlying compose state. Expanding
Sidecar → Focal Canvas (and back) must preserve every field: to,
cc, bcc, subject, body, attachments, AI panel state, confidential
toggles, schedule selection.

---

## Step 0 — read these before touching code

1. **`_design-playground/email-composer-final.html`** — primary.
   Owner-authored mockup of both Focal Canvas + Sidecar. If this
   file doesn't exist yet, STOP and surface to the owner; the
   handoff is not actionable without it.
2. `_design-playground/email-redesign.html` — secondary. Full
   Cockpit + Triage playground. Source of truth for the visual
   vocabulary (type, color, spacing, chrome density) that the
   composer views must align with.
3. `docs/EMAIL_HYBRID_REDESIGN_HANDOFF_2026-05-27.md` §3 (design
   tokens) and §6 step 9 (Compose modal disposition). The Phase 1
   handoff already specified that the composer should be ported to
   token classes — that work was deferred to this redesign.
4. `docs/email-hybrid-phase12-polish.md` — context on the post-soak
   passes. Item 12.3 added a `Maximize2` affordance + fullscreen
   default for new messages; 12.9 fixed light/dark theming for the
   `EmailComposerModal` toolbar; 12.15b fixed `.reader-panel`
   transparency — same lesson applies to Sidecar.
5. The live Hybrid surfaces — `InlineReader.tsx`, `TriageCard.tsx`,
   `EmailReaderPanel.tsx`, `GeminiSummaryCard.tsx`. These are the
   reference for what "Cockpit aesthetic" means in code. The
   Sidecar in particular should feel like a sibling of
   `EmailReaderPanel`.
6. `src/styles/pulse-tokens.css` — every color / surface / ink token
   the new composer should consume. Do NOT redeclare colors in the
   composer file.

---

## Goal

Two composer views — **Focal Canvas** (full page) and **Sidecar**
(slide-out inline reply) — both native to the Cockpit/Triage surface:

- Editorial chrome — serif `var(--pulse-font-serif)` on header text
  and major labels (matches `TriageCard.tsx` `font-weight: 500`).
- `var(--pulse-canvas)` / `var(--pulse-canvas-soft)` /
  `var(--pulse-surface-raised)` layering — opaque, not the current
  `bg-white/95` translucency. (Phase 12.15 just fixed the same
  transparency bug on the reader panel — same lesson applies to
  both composer views.)
- `pulse-border` / `pulse-ink` / `pulse-ink-2` / `pulse-ink-3` for
  separators and text. No stone/zinc Tailwind aliases.
- Coral (`var(--pulse-coral-fg)`, `pulse-rose-bg-soft-color`,
  `pulse-rose-bg-color`) **only** on AI-provenance affordances —
  AI Draft, Tone Check, Enhance, Smart Compose suggestion strip.
  See `CLAUDE.md §4` (coral budget rule) and the `AiChip` primitive
  in `src/components/Email/hybrid/primitives/`.
- A tool palette that doesn't look like a flight deck. Both views
  share the same AI tool grouping pattern; Sidecar's tighter
  footprint may collapse it further (single "AI" entry → menu), but
  the underlying handlers are identical to Focal Canvas.
- Focal Canvas = true full-page takeover. Mirror
  `.reader-panel.is-maximized` in
  `src/components/Email/hybrid/hybrid.css:343-356` — full width, no
  border, no rounded corners, opaque `var(--pulse-canvas)` background,
  opaque header strip.
- Sidecar = slide-out sibling of `.reader-panel`. Same 720px /
  breakpoint widths, same `readerPanelIn` animation, opaque
  `var(--pulse-canvas)` background, NO backdrop (the user needs to
  see the source thread underneath).

The owner will design both views' layout/composition in
`_design-playground/email-composer-final.html`. The implementing
agent is responsible for executing that design against the
constraints below.

---

## What MUST keep working (regression contract)

The composer is a feature-dense surface. The redesign is **purely
visual + structural** — every behavior listed here must remain
functional after the rewrite. Test each by hand before declaring done.

### Wiring
- Props contract (unchanged):
  `userEmail`, `userName`, `replyTo`, `prefilledBody`, `initialTo`,
  `initialSubject`, `initialCc`, `initialBcc`, `onClose`, `onSend`.
  Callers: `EmailHybridClient`, `EmailClientWrapper`, the legacy
  `PulseEmailClientRedesign`, and `useEmailComposeStore.openReply`.
- `useEmailComposeStore` driving open/close + prefill — do not
  bypass it.
- AI-router errors funnelled through `useAIErrorHandler` (cap
  exceeded / provider down). Keep the existing call sites.

### Form
- To / CC / BCC inputs, "Add Cc" / "Add Bcc" expand toggles.
- Subject + body fields, body restored from `prefilledBody`,
  reply-quote auto-prepended when `replyTo` is set.
- File attachments via `fileInputRef`, `parseEmails`,
  `filesToAttachments`, `removeAttachment`, validation
  (`isValidEmail`), missing-attachment warning regex.

### AI features (each currently a separate button → consolidate UI but
preserve handlers)
- `handleGenerateAiDraft` — Wand2 / "AI Draft" with prompt + tone
  selector.
- `handleToneCheck` — SpellCheck / tone check panel with
  `ToneCheckResult` rendering.
- `handleEnhanceEmail(action)` — shorten / elaborate / formalize /
  casualize / fix_grammar.
- `handleSmartCompose` — inline suggestion. Toggle via
  `smartComposeEnabled`.

### Send/save paths
- `handleSend` — full validation, attachment encoding, AI confidence
  warnings, undo toast, calls `onSend(params)`.
- `handleSaveDraft` — persisted via `emailSyncService.saveDraft`,
  localStorage fallback (`DRAFT_KEY = 'pulse-email-composer-draft'`).
- `handleScheduleSend` — opens `ScheduleSendModal`, calls
  `emailSyncService.scheduleSend`.
- Auto-save (debounced effect on form state changes) — currently
  fires `handleSaveDraft` after edits.

### Modals + integrations
- `TemplatesModal` + `TemplateVariablesModal` — preserve open flow.
- `ScheduleSendModal`.
- `emailMeetService.createInstantMeet` — `handleInsertMeetLink`.
- `confidentialEmailService` — toggle + 7 sub-state fields
  (expiresAt, passcode, disableForward, disableCopy, disablePrint,
  disableDownload, requirePasscode).
- Drive quick attach (`handleOpenDrive`, `driveQuickAttach`).
- `VoiceTextButton` — voice-to-text for body. Phase 12.9 fixed the
  dark-mode styling here, keep it consumed.

### Chrome controls
- Minimize / Maximize / Close buttons in header.
- Minimized state (`isMinimized`) — collapsed bar at bottom-right
  showing subject + restore.
- Restored-draft strip (`restoredDraft`) when entering with saved
  local draft.
- Fullscreen default for new messages (`!replyTo`); replies open in
  the compact bottom-right panel by default. **Keep this behavior.**

### Keyboard
- ⌘↵ / Ctrl+Enter → send.
- Esc → close (with confirmation if dirty).
- Cmd+S / Ctrl+S → save draft.
- Bold/Italic/Underline shortcuts — `insertFormatting('**')` etc.

---

## What to change

### 1. Tokenize the chrome (mandatory)
Replace every `bg-white/95 dark:bg-zinc-900/95`,
`border-stone-200/80 dark:border-zinc-700/80`, and stone/zinc text
class with token-class equivalents:
- `bg-white/95 dark:bg-zinc-900/95` → `pulse-canvas` (set background
  inline via `style={{ background: 'var(--pulse-canvas)' }}` or
  add a `.composer-panel` class in a sibling CSS file).
- `border-stone-* / border-zinc-*` → `border pulse-border-color`.
- `text-stone-900 dark:text-white` → `pulse-ink-color`.
- `text-stone-500 dark:text-zinc-400` → `pulse-ink-2-color`.
- `text-stone-400 dark:text-zinc-500` → `pulse-ink-3-color`.
- Hover surfaces (`hover:bg-stone-100 dark:hover:bg-zinc-800`) →
  `hover:pulse-surface-raised`.

### 2. Restructure the tool palette (owner-designed)
The owner will provide the layout. Hard constraints for the agent:
- AI tools (Draft / Tone / Enhance / Smart Compose) MUST cluster
  under a single coral-tinted entrypoint — that's the Cockpit
  pattern (`AiChip` "Claude · briefing", coral strip on TriageCard).
  Do NOT scatter coral across 4 separate icon buttons.
- Formatting (B/I/U/Link) is utility chrome — neutral, low-contrast,
  collapsible.
- Send / Schedule / Draft / Discard are persistent — owner will
  decide placement.

### 3. Header (mandatory, both views)
Mirror `TriageCard.tsx` header pattern: serif title
(`fontFamily: 'var(--pulse-font-serif)', fontWeight: 500`), avatar
chip if `replyTo` exists (shows who you're replying to), recipient
list compressed into a single sentence ("To Jane Doe + 2 others")
that expands on click. Sidecar gets a tighter, single-line variant
of the same pattern.

### 4. Focal Canvas takeover (mandatory)
Replace `w-[calc(100vw-80px)] h-[calc(100vh-32px)] top-4 right-4
rounded-xl` with a full-bleed takeover. Pattern to match (already
shipped on the reader panel — read it for reference):

```css
.composer-focal {
  position: fixed; inset: 0;
  width: 100%; max-width: 100%;
  border-radius: 0;
  border: none;
  box-shadow: none;
  background: var(--pulse-canvas);
}
```

### 5. Sidecar panel (mandatory)
Mirror `.reader-panel` (`src/components/Email/hybrid/hybrid.css:310-336`)
not the legacy bottom-right floating card:

```css
.composer-sidecar {
  position: absolute; top: 0; right: 0; bottom: 0;
  width: 720px; max-width: 92%;
  background: var(--pulse-canvas);     /* opaque — same fix as 12.15b */
  border-left: 1px solid var(--pulse-border);
  box-shadow: -18px 0 60px rgba(0, 0, 0, 0.10);
  animation: readerPanelIn 320ms cubic-bezier(0.16, 1, 0.3, 1);
}
@media (max-width: 1100px) { .composer-sidecar { width: 620px; } }
@media (max-width: 900px)  { .composer-sidecar { width: 540px; } }
@media (max-width: 767px)  { .composer-sidecar { width: 100%; } }
```

No backdrop. The source thread/email behind the Sidecar stays
interactive — clicking it should not auto-close the composer
(unsaved-changes risk). Close happens via the X button, Esc, or
the explicit "Discard" / "Save draft & close" actions.

Sidecar must include an "Expand to Focal Canvas" affordance in its
header (Maximize2 icon, matches the reader panel's pattern) that
flips `isMaximized=true` without losing form state.

### 6. View transition (mandatory)
Switching Sidecar ↔ Focal Canvas preserves every form field:
- `to`, `cc`, `bcc`, `subject`, `body`
- `attachments` (the `File[]` array)
- `showAiPanel`, `aiPrompt`, `selectedTone`, `toneCheckResult`
- All 7 `confidential*` fields
- Schedule selection (if open)
- AI in-flight state (`aiGenerating`, `enhancing`, etc.) — the
  current request should keep running across the transition; do
  not abort it.

The cleanest implementation is a single rendered component with
two top-level CSS classes (`composer-focal` vs `composer-sidecar`)
driven by `isMaximized`. Don't fork the JSX into two components
with parallel state — that's how you lose fields on transition.

### 7. Body field
Currently a plain `<textarea>` rendered via `textareaRef`. Owner
may want a richer surface. If the rewrite stays on `<textarea>`,
serif body type at ~14.5px line-height ~1.6 matches the reader
typography. If it goes to contenteditable, you take on selection /
formatting plumbing — talk to the owner before going there.

---

## Out of scope for this redesign

- New send/AI capabilities. No new buttons.
- Changes to `emailComposeStore`, `emailAIService`, `smartComposeService`,
  `gmailService`, `emailSyncService`. The composer reads them; do
  not refactor them.
- Multi-account UX, signature manager UI, calendar embeds — all
  separate roadmap items.
- Mobile-specific layout. Pulse Web composer is desktop-first; if
  the owner's design has explicit mobile breakpoints, implement them,
  but don't invent a mobile pass unprompted.

---

## Acceptance checklist (run before marking done)

### Entry points → correct view
- [ ] Cockpit FAB → **Focal Canvas** (new message, `replyTo=null`).
- [ ] Triage card Reply button → **Sidecar** docked next to the
      Triage stage.
- [ ] Triage "Send draft" button → sends directly (no composer mount).
- [ ] Lane row Reply → **Sidecar** docked over the cockpit.
- [ ] Search-result Reply → **Sidecar** docked over the search view.
- [ ] `EmailReaderPanel` Reply → **Sidecar** replacing the reader
      panel (or stacked over it — owner's call).
- [ ] Undo-restored draft (`initialTo`/`initialSubject` set) →
      **Focal Canvas** (no replyTo, treat as new message).

### Both views, every entry
- [ ] Restore-draft strip appears when re-entering with saved local
      draft.
- [ ] All AI handlers fire and surface results (do a real call —
      `tsc` won't catch a broken `await`).
- [ ] Send + Schedule + Save Draft + Discard each round-trip.
- [ ] Light AND dark modes — no leftover stone/zinc backgrounds, no
      transparent surfaces in dark mode (the failure mode that bit
      both `.reader-panel` and `.reader-panel.is-maximized` —
      `--pulse-surface` is `rgba(255,255,255,0.03)` in dark, so
      a panel styled with it goes nearly invisible).
- [ ] Coral budget audit — open each view and count coral surfaces.
      AI provenance only (`AiChip`, coral-tinted AI tool cluster).
      No coral on send buttons unless the owner explicitly designed
      it that way (Triage's Send is rose because it IS the AI-drafted
      reply send — same logic only applies to "Send AI-drafted reply").

### Sidecar specifics
- [ ] Animates in from the right via `readerPanelIn`.
- [ ] Opaque background (`var(--pulse-canvas)`) in both themes —
      source thread does NOT bleed through.
- [ ] No backdrop. Source thread/email behind the Sidecar stays
      visible and interactive (no auto-close on outside click).
- [ ] Width breakpoints match `.reader-panel`: 720 / 620 / 540 /
      100% at default / 1100 / 900 / 767.
- [ ] Maximize button in header transitions to Focal Canvas
      preserving every form field, attachments, AI state, schedule
      selection, confidential toggles.
- [ ] Esc / X / "Save draft & close" all close cleanly.

### Focal Canvas specifics
- [ ] True full-page takeover (`inset: 0`, no border, no rounded
      corners, opaque `var(--pulse-canvas)`).
- [ ] Minimize button collapses to bottom-right bar showing subject
      + click-to-restore.
- [ ] Minimize → restore → maximize → minimize round-trip preserves
      every form field.
- [ ] Restore-to-Sidecar affordance (Minimize2 icon in header)
      transitions back to Sidecar without losing form state.

### Build
- [ ] `npx tsc --noEmit` reports no NEW type errors (repo has ~1234
      pre-existing — see `reference_pulse_tsc_oom.md` memory).
- [ ] Commit on `main` with conventional-commit message, e.g.
      `feat(email): redesign composer to Focal Canvas + Sidecar`.
      If the work is large, split into chrome / Sidecar / Focal /
      AI-cluster commits.

---

## Open questions for the owner (answer in `email-composer-final.html` or surface here)

1. **Rich text vs. textarea?** Current is textarea-with-markdown-shortcuts;
   the playground's reader is HTML-rendered. Symmetry would suggest
   contenteditable, but it's a much bigger lift. Same answer applies
   to both Focal Canvas and Sidecar (the body field is shared).
2. **AI cluster in Sidecar?** Focal Canvas has room for an inline
   AI panel like `GeminiSummaryCard`. Sidecar is tighter — does AI
   live as a single coral button that pops a menu, a coral strip
   above the body, or hidden behind an `AiChip` toggle?
3. **Confidential mode UI** — current is a long expanding panel
   with 7 fields. Worth keeping that footprint or collapsing to
   defaults + "Customize"? In Sidecar this matters more (less
   vertical room).
4. **Templates** — keep `TemplatesModal` as a separate modal or
   fold into a "Start from template" entry inside the composer
   header? Same answer for both views.
5. **Sidecar Reply-to-thread context** — should the Sidecar header
   show a compact "Replying to: <subject>" strip with avatar +
   thread count, or is the visible thread behind it enough? Owner's
   call.
6. **Sidecar dock side** — always right (matches `.reader-panel`),
   or left when launched from search-result Reply since the result
   list itself is left-anchored? Defaulting to right.

The agent should NOT make these calls unilaterally — if the
playground doesn't answer them, surface back to the owner.

---

## Trigger to launch

Implementation starts when **all** of these are true:
- `_design-playground/email-composer-final.html` exists and shows
  both Focal Canvas and Sidecar layouts.
- Owner has answered (or explicitly deferred) the six open
  questions above.
- Owner posts "ship the composer redesign" to a fresh session and
  points it at this handoff.

Until then, no composer code changes. The handoff is a contract,
not a backlog item to chip away at.
