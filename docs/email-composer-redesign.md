# Email Composer Redesign — Handoff

**Status:** open · drafted 2026-05-28 · composer view only
**Surface:** `src/components/Email/EmailComposerModal.tsx` (1,429 lines)
**Flag:** none (composer is shared by legacy + hybrid surfaces)
**Reference designs:** `_design-playground/email-redesign.html` (re-open this in a browser before starting — composer panel is not literally in the playground, but the Cockpit/Triage aesthetic, type ramp, coral budget, and chrome density all live there)

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

The owner is going to design the composer view themselves. This handoff
is for the implementing agent — what stays, what changes, what to
read first, and the technical constraints not to break.

---

## Step 0 — read these before touching code

1. `_design-playground/email-redesign.html` — full Cockpit + Triage
   playground. Composer is NOT there as a literal mockup, but the
   visual vocabulary (type, color, spacing, chrome density) you need
   to match is.
2. `docs/EMAIL_HYBRID_REDESIGN_HANDOFF_2026-05-27.md` §3 (design
   tokens) and §6 step 9 (Compose modal disposition). The Phase 1
   handoff already specified that the composer should be ported to
   token classes — that work was deferred to this redesign.
3. `docs/email-hybrid-phase12-polish.md` — context on the post-soak
   passes. Item 12.3 added a `Maximize2` affordance + fullscreen
   default for new messages; 12.9 fixed light/dark theming for the
   `EmailComposerModal` toolbar. Both are predecessor work — neither
   touched aesthetic alignment.
4. The live Hybrid surfaces — `InlineReader.tsx`, `TriageCard.tsx`,
   `EmailReaderPanel.tsx`, `GeminiSummaryCard.tsx`. These are the
   reference for what "Cockpit aesthetic" means in code.
5. `src/styles/pulse-tokens.css` — every color / surface / ink token
   the new composer should consume. Do NOT redeclare colors in the
   composer file.

---

## Goal

A composer that feels native to the Cockpit/Triage surface:

- Editorial chrome — serif `var(--pulse-font-serif)` on header text
  and major labels (matches `TriageCard.tsx` `font-weight: 500`).
- `var(--pulse-canvas)` / `var(--pulse-canvas-soft)` /
  `var(--pulse-surface-raised)` layering — opaque, not the current
  `bg-white/95` translucency. (Phase 12.15 just fixed the same
  transparency bug on the reader panel — same lesson applies here.)
- `pulse-border` / `pulse-ink` / `pulse-ink-2` / `pulse-ink-3` for
  separators and text. No stone/zinc Tailwind aliases.
- Coral (`var(--pulse-coral-fg)`, `pulse-rose-bg-soft-color`,
  `pulse-rose-bg-color`) **only** on AI-provenance affordances —
  AI Draft, Tone Check, Enhance, Smart Compose suggestion strip.
  See `CLAUDE.md §4` (coral budget rule) and the `AiChip` primitive
  in `src/components/Email/hybrid/primitives/`.
- A tool palette that doesn't look like a flight deck. Group the
  AI tools behind a single "AI" entry (matches the Triage briefing
  pattern); collapse formatting into a contextual mini-toolbar near
  the cursor or behind a `Pen` button.
- Maximize mode should be a true full-page takeover, not a floating
  rounded card. Mirror `.reader-panel.is-maximized` in
  `src/components/Email/hybrid/hybrid.css:343-356` — full width, no
  border, no rounded corners, opaque `var(--pulse-canvas)` background,
  opaque header strip.

The owner will design the layout/composition. The implementing agent
is responsible for executing that design against the constraints
below.

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

### 3. Header (mandatory)
Mirror `TriageCard.tsx` header pattern: serif title
(`fontFamily: 'var(--pulse-font-serif)', fontWeight: 500`), avatar
chip if `replyTo` exists (shows who you're replying to), recipient
list compressed into a single sentence ("To Jane Doe + 2 others")
that expands on click.

### 4. Maximize mode (mandatory)
Replace `w-[calc(100vw-80px)] h-[calc(100vh-32px)] top-4 right-4
rounded-xl` with a full-bleed takeover. Pattern to match (already
shipped on the reader panel — read it for reference):

```css
.composer-panel.is-maximized {
  position: fixed; inset: 0;
  width: 100%; max-width: 100%;
  border-radius: 0;
  border: none;
  box-shadow: none;
  background: var(--pulse-canvas);
}
```

Restore mode (the compact bottom-right floating panel) is fine to
keep — it's the right default for replies.

### 5. Body field
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

- [ ] Composer opens from Cockpit FAB, Triage Reply button, Triage
      "Send draft" button, lane-row Reply, search-result Reply,
      and `replyTo` via `useEmailComposeStore.openReply` — all
      enter with correct prefill.
- [ ] Restore-draft strip appears when re-entering with saved local
      draft.
- [ ] All AI handlers fire and surface results (do a real call —
      `tsc` won't catch a broken `await`).
- [ ] Maximize → restore → maximize round-trip works without losing
      form state.
- [ ] Minimize bar shows subject + click-to-restore.
- [ ] Send + Schedule + Save Draft + Discard each round-trip.
- [ ] Light AND dark modes — no leftover stone/zinc backgrounds, no
      transparent surfaces in dark mode (the failure mode that bit
      both `.reader-panel` and `.reader-panel.is-maximized` —
      `--pulse-surface` is `rgba(255,255,255,0.03)` in dark, so
      a panel styled with it goes nearly invisible).
- [ ] Coral budget audit — open the panel and count coral surfaces.
      AI provenance only (`AiChip`, coral-tinted AI tool cluster).
      No coral on send buttons unless the owner explicitly designed
      it that way (Triage's Send is rose because it IS the AI-drafted
      reply send — same logic only applies to "Send AI-drafted reply").
- [ ] `npx tsc --noEmit` reports no NEW type errors (repo has ~1234
      pre-existing — see `reference_pulse_tsc_oom.md` memory).
- [ ] Commit on `main` with conventional-commit message, single
      `feat(email): redesign composer to Cockpit aesthetic` or split
      into chrome / structure / AI-cluster commits if the work is
      large enough.

---

## Open questions for the owner (resolve before implementation)

1. Rich text vs. textarea? Current is textarea-with-markdown-shortcuts;
   the playground's reader is HTML-rendered. Symmetry would suggest
   contenteditable, but it's a much bigger lift.
2. AI cluster: dropdown menu, inline panel (current pattern), or a
   coral side-rail like `GeminiSummaryCard`?
3. Confidential mode UI — current is a long expanding panel with 7
   fields. Worth keeping that footprint or collapsing to defaults +
   "Customize"?
4. Templates — keep `TemplatesModal` as a separate modal or fold
   into a "Start from template" entry inside the composer header?

The agent should NOT make these calls unilaterally — surface them
back to the owner if the design doesn't answer them.
