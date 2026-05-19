# Messages Tools Redesign — Follow-up Handoff

**Date:** 2026-05-18
**Status:** Open — 5 commits shipped behind feature flags, 3 live bugs + 7 deferred items remain
**Predecessor doc:** [`docs/messages-tools-redesign.md`](messages-tools-redesign.md) (spec)

## Shipped (this chain)

| Commit | Surface | Flag |
|---|---|---|
| `2cb8826` | PR 2 — Message context-menu (Surface 2) | `messageContextMenuV2` |
| `f89c97b` | Muse — Coral chip tokens | (none — CSS only) |
| `faf31f1` | PR 1 — Compose bar (Surface 1, minus voice/schedule) | `pulseComposerV2` |
| `84b8c11` | PR 3a — Tools menu shell + Translate Settings + Thread Audit | `toolsMenuV2` |
| `8ed7952` | PR 3b — Thread Summary + Insights AI tiles | `toolsMenuV2` (shared) |

All flags default OFF. Legacy paths preserved.

---

## Live bugs (found post-merge in user smoke test)

### BUG-01 — Chat bubbles overflow when message has no break opportunities

**Symptom (user screenshot, light mode):** Long unbroken strings (e.g. `iubficiuhiuasbiueibufcfiufiluhliuasilciluwsabcbeuf;lu;fhailubcbcioufiuerwfb`) push the bubble past the right edge of the message column, partially hidden behind the next pane / overflowing the layout.

**Root cause (likely):** [`src/components/Messages/messages.css:484`](../src/components/Messages/messages.css#L484) declares `word-wrap: break-word` on `.message-bubble`. `word-wrap` is the legacy property — it only breaks long unbroken strings *as a last resort* and CAN still overflow when the bubble's parent doesn't enforce its own min-width. Modern equivalent that ALWAYS breaks: `overflow-wrap: anywhere` (or `word-break: break-word` as fallback).

**Investigation pointers:**
1. Replace `word-wrap: break-word` with `overflow-wrap: anywhere` at [messages.css:484](../src/components/Messages/messages.css#L484). Test against the user's exact gibberish string.
2. Walk the flex chain from [Messages.tsx:3425](../src/components/Messages.tsx#L3425) (outer `flex-1 flex flex-col min-w-0`) → scrollable wrapper at [Messages.tsx:3836](../src/components/Messages.tsx#L3836) (`flex-1 overflow-y-auto p-4 md:p-6`) → bubble container at [Messages.tsx:3918](../src/components/Messages.tsx#L3918) (`max-w-[70%] sm:max-w-[75%] md:max-w-[70%]`) → bubble itself.
3. Verify every ancestor up to the conversation pane root has `min-w-0` — flex children default to `min-width: auto` which prevents shrinking and is the most common cause of overflow-wrap not "taking effect".
4. The `max-width: 100%` at [messages.css:485](../src/components/Messages/messages.css#L485) is correct but only effective if the bubble's containing block is itself width-bounded.
5. Test matrix: very long unbroken string · long URL · pasted base64 · normal long sentence · emoji-only · RTL text · code block.

**Acceptance:**
- Test gibberish string wraps cleanly inside the 70%-max-width bubble
- Bubble never extends past its column on any viewport ≥ 320px
- Both `.message-bubble-sent` and `.message-bubble-received` variants behave identically
- Both dark and light modes

**Estimated effort:** 30 min (1 CSS line + visual regression test).

---

### BUG-02 — New Tools menu mounts with empty state because threadId / messageCount aren't wired

**Symptom (user screenshot):** Even with `toolsMenuV2` ON, the menu would show Summary + Insights HIDDEN and Thread Audit DISABLED ("Need 5+ messages") on threads that actually have many messages.

**Root cause:** [`src/components/PulseComposer/PulseComposer.tsx:708-712`](../src/components/PulseComposer/PulseComposer.tsx#L708) mounts `ToolsMenuPlaceholder` without `threadId` or `messageCount` props. ToolsMenuPlaceholder.tsx defaults to `threadId='unknown-thread'` and `messageCount=0` when those props are absent. The thresholds are:

| Tile | Hide if | Disabled if | Active if |
|---|---|---|---|
| Thread Summary | `count < 10` | `10 ≤ count < 50` | `count ≥ 50` |
| Insights | `count < 20` | — | `count ≥ 20` |
| Thread Audit | — | `count < 5` | `count ≥ 5` |
| Translate Settings | — | — | always |

With `count=0` the menu effectively shows only Translate Settings.

**Investigation pointers:**
1. PulseComposer needs `threadId` (the active Pulse conversation id) and `messageCount` (`pulseMessages.length` for that thread) as props.
2. Look at how `MessageInput` (legacy) receives `channelId` at [Messages.tsx:4638](../src/components/Messages.tsx#L4638) — same source.
3. Add to PulseComposer's prop interface in [types.ts](../src/components/PulseComposer/types.ts), pass through the [Messages.tsx:4617](../src/components/Messages.tsx#L4617) call site, then forward to ToolsMenuPlaceholder at [PulseComposer.tsx:708](../src/components/PulseComposer/PulseComposer.tsx#L708).
4. Verify `useTranslateSettings` localStorage key changes from `pulse_translate_settings_unknown-thread` to the real per-thread key — old broken settings under `unknown-thread` can stay (won't break, just orphaned).

**Acceptance:**
- Open a 50+ msg thread with `toolsMenuV2` on → Summary tile active, Insights tile active, Thread Audit shows Pace stats
- Open a 7 msg thread → Summary tile hidden, Insights tile hidden, Thread Audit disabled with empty-state copy
- Open a 12 msg thread → Summary tile disabled ("unlocks at 50"), Insights tile hidden, Thread Audit active

**Estimated effort:** 45 min (prop wiring + call-site update + verification at 3 thresholds).

---

### BUG-03 — Tools menu shows the legacy placeholder (flag off — UX expectation gap)

**Symptom (user screenshot):** Clicking the Tools opener shows the modal "Tools menu coming in PR 3 — Thread Summary, Insights, Thread Audit, and Translate Settings will live here. SURFACE 3 · MESSAGES TOOLS REDESIGN".

**Diagnosis:** Not a bug — the placeholder IS rendering correctly because `toolsMenuV2` is OFF. The wiring at [ToolsMenuPlaceholder.tsx:42-43](../src/components/PulseComposer/ToolsMenuPlaceholder.tsx#L42) is correct.

**Fix:** Flip the flag in **FeatureSettings → "New Tools Menu (Beta)"**, then re-open the Tools opener. Combine with BUG-02 fix for full effect.

**No engineering work needed** — this is a documentation gap. Optionally update the placeholder copy to say "Enable 'New Tools Menu (Beta)' in Settings to preview" since the redesign is now live.

---

## Deferred from the chain (known follow-ups)

### FOLLOWUP-01 — Wire real Gemini edge functions for Smart Compose, Thread Summary, Insights

All three currently use stub providers returning hardcoded content after a 1.5s delay. Provider contract is shaped to drop in:
- [`PulseComposer/useSmartCompose.ts`](../src/components/PulseComposer/useSmartCompose.ts) — has `suggestionProvider` prop
- [`ToolsMenuV2/ThreadSummary/useThreadSummary.ts`](../src/components/ToolsMenuV2/ThreadSummary/useThreadSummary.ts) — has `suggestionProvider` prop
- [`ToolsMenuV2/Insights/useInsights.ts`](../src/components/ToolsMenuV2/Insights/useInsights.ts) — has `suggestionProvider` prop

Per the Pulse memory note **"Pulse Gemini Routing is Server-Side"**, real wiring goes through Supabase edge functions (`ai-router` or equivalent), NOT direct API calls from the client. Edge function should accept the message-context array + return shaped responses matching the existing TS contracts.

**Estimated effort:** 2-3 days (edge function design + auth + rate limits + 3 client wires + integration tests).

---

### FOLLOWUP-02 — Voice message recording on compose bar (Relay-branded)

PR 1 explicitly skipped voice. Spec mock 1.6 specifies:
- Hold-to-record on mic button
- Swipe-left cancel (mobile)
- Swipe-up to lock for hands-free (mobile)
- Tap-to-start / tap-to-stop (desktop)
- Relay wordmark in the recording UI header

**Blocked on:** Relay branding token/mark. Need confirmation that Relay has a designated micro-mark or text-mark in `src/styles/pulse-tokens.css` or the Relay brand pack. Reach out to design owner before starting.

**Investigation pointers:**
1. Existing Relay implementation lives in `src/components/Relay/` — reuse recording infrastructure
2. The `pulseComposerV2` flag is the gate
3. Replace the current mic button at [PulseComposer.tsx](../src/components/PulseComposer/PulseComposer.tsx) (currently a placeholder) with the real hold-to-record affordance
4. Server-side voice upload pipeline already exists for legacy MessageInput — reuse the same endpoint

**Estimated effort:** 3-4 days (UI + gesture handling + Relay branding integration + upload wiring + tests).

---

### FOLLOWUP-03 — Schedule send via send-button long-press / chevron

PR 1 explicitly skipped. Spec mock 1.7 specifies:
- Long-press send button on mobile → bottom sheet with preset chips (Tomorrow 9 AM, Monday 9 AM, Tonight, Custom)
- Chevron next to send on desktop → anchored popover
- `Cmd+Shift+Enter` opens the picker
- Inline scheduled-bubble placeholder in thread (`📅 Scheduled · Mon 9:00 AM` with Edit / Cancel)

**Investigation pointers:**
1. Existing `scheduledMessages` feature flag in FeatureContext suggests prior work — check if backend already supports scheduled sends
2. New UI components likely live in `src/components/PulseComposer/SchedulePicker/`
3. Reuse `useLongPress` from `src/components/MessageContextMenu/useLongPress.ts` (already shipped in PR 2)

**Estimated effort:** 2 days.

---

### FOLLOWUP-04 — Tone chip (relationship-aware, on for new contacts only)

PR 1 explicitly skipped. Spec mock 1.3 + locked decision #5:
- Auto-surfaces above textarea when relationship-tone mismatch detected
- Show for contacts < 30 days unflagged exchanges, then auto-disable
- Apply rewrite / dismiss × controls
- **Uses neutral warning token, NOT coral** (Coral-As-Signal rule)

**Blocked on:** Relationship-context model. Need a server-side service that tracks per-contact tone history and surfaces "this draft reads terser than usual for this relationship". Significant backend work — not a frontend-only follow-up.

**Estimated effort:** Frontend 1 day · Backend (relationship-context model) 1-2 weeks · Total 2-3 weeks.

---

### FOLLOWUP-05 — Server-side `edit_until` timestamp per message

PR 2 currently uses a **client-computed fallback** (`createdAt + 15min`) at [`useMessageContextMenu.ts`](../src/components/MessageContextMenu/useMessageContextMenu.ts) (search for `computeIsEditable`). Will silently disagree with server clock if there's significant drift.

**Investigation pointers:**
1. Add `edit_until TIMESTAMPTZ` column to `pulse_messages` table (or equivalent)
2. Compute server-side at INSERT: `edit_until = NOW() + INTERVAL '15 minutes'`
3. Surface in `pulseService.editMessage` and the message-list query so clients receive it
4. Client falls back to computed value when `msg.edit_until` is absent (backwards-compat)

**Estimated effort:** 1 day (migration + service update + types regeneration).

---

### FOLLOWUP-06 — Server-side `thread.first_translated_message_id` for translate provenance

PR 3a's Translate Settings persists per-thread preferences but doesn't yet track "which message was the first translated one in this thread" — needed for the locked Translate Provenance decision (per-message chip on FIRST translation, thread-level indicator thereafter).

**Investigation pointers:**
1. Add `first_translated_message_id UUID NULL` to the thread / conversation table
2. Set on the first inbound message that gets auto-translated for the viewing user
3. Per-message chip renders only when `msg.id === thread.first_translated_message_id`
4. Thread-level indicator (`🌐 auto-PT→EN`) renders in thread header otherwise
5. Note: the chip itself uses a **neutral info-token, NOT coral** (translation is deterministic, not AI-authored prose)

**Estimated effort:** 1.5 days (schema + server update + 2 client render sites).

---

### FOLLOWUP-07 — Replace Pace stats stub with real message-store query

PR 3a's `ThreadAudit/PaceTab.tsx` ships deterministic per-threadId stubs with a `// TODO: wire to real message store` comment. The 4 stats (Avg reply time / Median / Your avg / Their avg) should compute from actual message timestamps.

**Investigation pointers:**
1. Pulse messages live in the Zustand `pulseMessages` slice (see [Messages.tsx:1339+](../src/components/Messages.tsx#L1339) context)
2. Computation: `O(n)` walk of consecutive messages by sender, take diffs, separate "your reply times" from "their reply times"
3. Window: last 30 days for the sparkline; 1-month rolling for the stats
4. Memoize aggressively — recompute only when messageCount changes or threadId changes
5. For long threads (1000+ msgs) consider moving to a worker; for now in-thread compute is acceptable

**Estimated effort:** 4-6 hours.

---

### FOLLOWUP-08 — Real Sentiment + Flow content in Thread Audit

PR 3a's Sentiment + Flow tabs currently show placeholder copy ("coming soon"). The structure (tablist/tabpanel) is real; only the bodies are stub.

**Sentiment requires:** Per-message sentiment scoring (likely an edge function call — same routing as Summary / Insights). Could batch-process on tab open with a "Computing sentiment..." loading state.

**Flow requires:** Topic-burst arc visualization — needs message clustering by topic (another edge function call) + a custom SVG renderer for the arcs.

**Estimated effort:** Sentiment 1 day · Flow 2-3 days.

---

### FOLLOWUP-09 — Tier-2 ADD-list items not yet built

Per the spec § ADD list, three Tier-2 universal features still need surfaces:
- **Pin / star message** — context-menu overflow item is wired but the persistent pinned-messages list (thread header) isn't built
- **@mention in group thread** — compose `@` slash variant; context-menu "Mention this person" is wired but the actual mention insertion + notification routing isn't
- **Forward message** — context-menu action opens a placeholder; needs contact picker + forward-with-attribution flow

**Estimated effort:** Pin 1.5 days · Mention 2 days · Forward 1.5 days · Total ~1 sprint.

---

## "Venture into the Message Thread area" (broader scope notes)

The user prompt suggested looking beyond the redesign at the Message Thread area in general. Quick observations from this session's reads, not yet investigated to fix:

### OBSERVATION-A — Massive Messages.tsx file size

[`Messages.tsx`](../src/components/Messages.tsx) is approaching 5,000 lines. The active Pulse conversation render alone spans roughly lines 3424-4646. Strangler-pattern extraction candidates (in order of safety):
1. The Pulse conversation pane (3424-4646) → `MessagesPulsePane.tsx`
2. The thread chat view (4652+) → `MessagesThreadPane.tsx`
3. The message-list scrollable region (3836-4500ish) → `MessageList.tsx`
4. The header row (3427-3500ish) → `MessageHeader.tsx`

Each is feature-flag-friendly via a wrapper pattern (legacy / extracted). Mirrors what's already happening on the Map (`refactor/map-strangler` branch).

**Effort:** ~2-3 weeks for a complete strangler refactor; can ship one extraction at a time.

### OBSERVATION-B — Mixed token vocabulary in message-bubble CSS

[`messages.css:498-548`](../src/components/Messages/messages.css#L498) uses raw `rgba(244, 63, 94, ...)` hex-derived values for the rose hairline accents instead of `var(--pulse-rose-*)` tokens. The variable resolves to the same color but bypassing the token system means:
- Coral-rebrand wouldn't propagate here
- Per the Pulse memory "Canonical --pulse-* vars at pulse-tokens.css; new components consume them, never redeclare colors locally", these declarations are technical debt

**Effort:** 1-2 hours (find/replace + visual diff verification).

### OBSERVATION-C — Bubble layout viewport responsiveness

The bubble `max-w-[70%] sm:max-w-[75%] md:max-w-[70%]` chain at [Messages.tsx:3918](../src/components/Messages.tsx#L3918) is unusual — it goes 70 → 75 → 70. Likely intentional (sm screens get a touch more width because the column is narrower) but worth a designer review against spec intent.

### OBSERVATION-D — `messageContextMenuV2`'s bubble-focus dependency

Per PR 2's known follow-ups: keyboard-only users can't reach the context-menu via `Shift+F10` because message bubbles aren't on the tab order today. Adding bubble navigation is out of PR 2 scope. A11y team will likely flag this in a future audit.

**Effort:** 1 day (roving tabindex on the message list + Up/Down/Home/End navigation).

---

## Priority recommendation

If the next engineer / agent has 1 week:

1. **Day 1:** BUG-01 (overflow CSS) + BUG-02 (Tools menu prop wiring) — both small, high-visibility-fix value
2. **Day 2-3:** FOLLOWUP-01 (real Gemini wiring for Smart Compose, Summary, Insights) — unlocks the redesign's real value
3. **Day 4:** FOLLOWUP-05 + FOLLOWUP-07 (server `edit_until` + Pace real stats) — small, polishes PR 2 + 3a
4. **Day 5:** FOLLOWUP-03 (schedule send) — high user-visible value, scoped

Voice (FOLLOWUP-02), tone chip (FOLLOWUP-04), real sentiment/flow (FOLLOWUP-08), and the Tier-2 ADDs (FOLLOWUP-09) are all multi-day each — schedule separately.

---

## Cross-references

- Spec: [`docs/messages-tools-redesign.md`](messages-tools-redesign.md)
- Components: [`src/components/PulseComposer/`](../src/components/PulseComposer/) (PR 1) · [`src/components/MessageContextMenu/`](../src/components/MessageContextMenu/) (PR 2) · [`src/components/ToolsMenuV2/`](../src/components/ToolsMenuV2/) (PR 3a + 3b)
- Tokens: [`src/styles/pulse-tokens.css`](../src/styles/pulse-tokens.css) (Muse coral chip family, lines 75-77 + 128)
- Feature flags: [`src/contexts/FeatureContext.tsx`](../src/contexts/FeatureContext.tsx) (`pulseComposerV2`, `messageContextMenuV2`, `toolsMenuV2`)
