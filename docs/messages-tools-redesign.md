# Messages Tools Redesign

**Date:** 2026-05-17
**Status:** Spec locked — pre-implementation
**Produced by:** Compass → Nexus → (Plea + Echo) → Compete → Palette → Forge
**Owner decisions locked:** 6 (see § Locked Decisions)

---

## TL;DR

The current Messages section exposes an **11-tile Tools menu with 17 sub-tabs across three nested levels**. Triangulated diagnosis from a synthetic-user-advocate (Plea), persona cognitive walkthrough (Echo), and 7-competitor market matrix (Compete) reaches the same root verdict:

> **Pulse built a "tools menu" mental model into a product where the dominant interaction is compose-and-send.** 14 of 20 leaf destinations fail the "noticed in first 7 days" bar. Most surviving features either duplicate each other or belong on the compose bar / message context-menu rather than as menu tiles.

The redesign **dissolves the menu into 3 surfaces**:

1. **Compose bar** (Surface 1) — most actions live here, inline or input-driven
2. **Message context-menu** (Surface 2) — long-press / right-click on a message
3. **Slim Tools menu** (Surface 3) — exactly 4 tiles, reserved for AI features with no other home

Plus: Notifications/Export/Shortcuts/Templates-management → App Settings. Search/Mute → thread header. Keyboard shortcuts → Cmd+K palette.

**Coral budget is locked at 6 usages, all on AI-output surfaces.** Coral is signal, never decoration.

---

## Diagnosis Triangulation (condensed)

### Plea — synthetic user advocate (4 personas)

Personas: Maya (busy pro), Theo (casual mobile), Priya (power user), Dan (first-week onboard).

- **17 KILLs:** AI Mediator, entire Analytics tool (Pace + Flow + AI Insights), all 6 Productivity tabs (Templates dup / Schedule / Summary / Export / Shortcuts / Notifications), Media Hub > Export, Media Hub > Translation dup, Media Hub > Backup, Media Hub > Suggestions, both "Productivity" and "Media Hub" as container names
- **15 MISSING** features users actually want (table-stakes in messaging apps): pin/star, in-thread search, schedule-send on compose bar, quote-reply, mute thread, voice message, edit sent, one-tap attach, reactions, @mention in group, block/report, smart-reply chips, forward, passive auto-translate
- **Root insight:** "Every tool the busy professional and casual user actually want is a one-tap action on the compose bar or message itself. Pulse has put those either missing or behind 2-4 taps, while the menu surfaces ambient AI tools (Coach, Mediator, Analytics) that nobody opens deliberately."

### Echo — persona cognitive walkthrough

Personas: first-time user, returning power user, mobile-only, accessibility (screen-reader + keyboard).

- **14 of 20 leaves** fail "would-notice-in-7-days"
- **Deepest path observed:** Tools → Media Hub → Translation tab → Translate sub-toggle → leaf = 4 clicks (same value the top-level Translate tool delivers in 1 click)
- **Universal frictions** (all 4 personas): duplicate entry points (Templates×2, Translate×2, Export×2); empty Analytics state ("0 messages analyzed" with no onboarding); notification IA misplacement; stub-density behind deep paths
- **A11y critical gap:** screen reader hears two "Templates" landmarks with identical accessible names — cannot disambiguate
- **Mobile-hostile:** Analytics 3+3 toggle row, Productivity 6-tab row, Media Hub 5-tab row all unusable on a 6" screen

### Compete — 7-competitor market matrix

Competitors: iMessage, WhatsApp, Slack, Signal, Telegram, Discord, Beeper.

| Verdict | Items |
|---|---|
| **Confirm KILL (DOA — no competitor ships)** | Analytics (per-conversation), Media Hub > Suggestions, AI Coach standalone, AI Mediator, Productivity > Shortcuts as a "tool" |
| **Confirm STANDARD-but-missing** (must add to reach table-stakes) | Quote-reply, reactions, edit-sent, voice message, one-tap attach, in-thread search, timed mute, block/report, pin, @mention, forward, schedule-send-on-compose |
| **Confirm DIFFERENTIATOR** (rare in market) | Smart Compose with cross-thread relationship-context memory, passive silent auto-translate (only Telegram Premium ships), AI Thread Summary (Slack-AI paid tier) |

Battle-card promise: **"the messenger that remembers the relationship."** Smart Compose with relationship-aware tone memory is the one feature 0 of 7 competitors can ship without rebuilding their data model.

---

## Locked Decisions (6)

1. **Kill AI Coach + AI Mediator** as standalone tools. Tone-awareness folds into Smart Compose's inline chip.
2. **Keep AI Thread Summary** as a slim tile (Slack-AI tier work-table-stake).
3. **Full re-architecture** across 3 surfaces (compose bar / context-menu / slim tools).
4. **Edit-after-reaction policy:** Clear reactions on edit + show "edited" badge with hover-to-see-original.
5. **Tone chip:** Relationship-aware surfacing — on for new contacts, off after 30 days of unflagged exchanges with that contact.
6. **Auto-translate provenance:** Per-message chip on FIRST translated message in a thread; thread-level indicator thereafter.

---

## Final KEEP / KILL / ADD

### KILL (high confidence)

| Item | Why |
|---|---|
| Analytics tool entire (Pace / Flow / AI Insights) | 0/7 competitors ship per-conversation analytics; empty first impression; no job-to-be-done |
| AI Mediator | 0/7 competitors; niche trigger; "vegetables users didn't order" |
| AI Coach (as standalone tile) | Fold into Smart Compose tone chip instead |
| Media Hub > Suggestions | DOA; label too vague; no validated demand |
| Media Hub > Backup | Backup is silent app responsibility, not user-facing tool |
| Productivity > Notifications | App-scoped settings in a per-message tool — wrong IA location |
| Productivity > Shortcuts (as tool) | Belongs in Cmd-K palette or Settings, not a tool |
| Productivity > Summary, Export, Templates, Schedule (as tabs) | Container is a junk drawer; survivors relocate (see KEEP) |
| Media Hub > Translation, Export (duplicate sub-tabs) | Kill the buried copies |
| "Productivity" and "Media Hub" containers | Junk-drawer / misleading labels |

### KEEP — but transformed

| Item | What changes |
|---|---|
| Smart Compose | Becomes **inline ghost-text in compose box** + relationship-context aware (per-contact tone memory). Folds tone-awareness from killed Coach. |
| Format | **Inline popover on text selection** (Notion / Medium pattern) — no longer a menu tile |
| Templates | One home. **Slash command on compose** (`/t name`) + management screen in Settings |
| Translate | One home. **Passive auto-translate** (silent inline on-receive) as default; manual translate as fallback |
| Schedule send | **Send-button long-press on compose bar** (WhatsApp / Slack / Telegram pattern) |
| AI Thread Summary | **Slim tile in Tools menu.** Hidden <10 msgs / disabled 10-49 / active 50+ |
| Insights | **Slim tile in Tools menu.** Hidden <20 msgs / active 20+ |
| Thread Audit (merges Pace + Sentiment + Conversation Flow) | **One tabbed tile** in Tools menu, with disabled "Need 5+ messages" state |
| Translate Settings | Slim tile in Tools menu — per-thread auto-translate toggle |
| Export | → App Settings (not a tool) |
| Keyboard Shortcuts | → Cmd+K command palette + Settings reference |
| Notifications | → App Settings + thread-header bell |

### ADD — table-stakes Pulse currently lacks

**Tier 1 (all 7/7 competitors ship — non-negotiable):**

1. Quote / inline reply to a specific message
2. Reactions / tapback (emoji reactions)
3. Edit sent message (15-min window)
4. Voice message (hold-to-record on compose bar)
5. One-tap attach (file / photo / camera on compose bar)
6. Search inside thread (scoped to current conversation)
7. Mute thread with timed presets (1hr / 8hr / until tomorrow)
8. Block / report sender (App Store / Play Store policy requirement)

**Tier 2 (universal but lower-rank):**

9. Pin / star message
10. @mention in group thread
11. Forward message

---

## New IA Tree (max 2 levels deep)

```
Messages Section
├── Compose bar (Surface 1)
│   ├── Attach (+) → sheet: file / photo / camera
│   ├── Smart Compose ghost-text → inline, Tab to accept
│   ├── Tone chip → auto-surfaced relationship-aware hint
│   ├── Format popover → on text selection
│   ├── Templates → /t <name> autocomplete
│   ├── Slash commands → / autocomplete (translate, schedule, etc.)
│   ├── Voice → hold mic to record (replaces send when input empty)
│   ├── Send → Cmd+Enter
│   ├── Schedule send → long-press / chevron on send
│   └── Tools menu opener → Cmd+Shift+P
├── Message context-menu (Surface 2)
│   ├── Quick reactions bar (6 emoji + more)
│   ├── Reply (quote)
│   ├── React (full picker)
│   ├── Copy
│   ├── Edit (own, <15 min)
│   ├── Forward
│   └── Overflow → Pin, Translate, Save, Select, Mention, Info, Delete, Block, Report
├── Tools menu — slim (Surface 3)
│   ├── Thread Summary (AI)
│   ├── Insights (AI)
│   ├── Thread Audit (pace + sentiment + flow)
│   └── Translate Settings
├── Thread header (existing — not in redesign scope)
│   ├── Search in thread → magnifier icon
│   ├── Mute thread → bell with presets (1hr / 8hr / until tomorrow / always)
│   └── Thread settings → overflow (participants, pinned, files)
├── Command palette (global)
│   └── Cmd+K → all keyboard shortcuts + actions
└── App Settings (off-canvas — NOT a tool)
    ├── Notifications
    ├── Export conversations
    ├── Keyboard shortcuts reference
    └── Templates management (create / edit / share)
```

**Depth check:** every leaf reachable in ≤ 2 hops from "Messages Section". The 4-click death paths in the current product are gone.

---

## Promotion / Demotion Log

| Original item | New location | Reason |
|---|---|---|
| Smart Compose (tile) | Compose bar — inline ghost-text + tone chip | Discovery problem solved by making it ambient |
| Format (tile) | Compose bar — selection popover | Notion/Medium pattern; format is property of selected text |
| AI Coach (tile) | **Killed** — folded into Smart Compose tone chip | Duplicate-AI fatigue; belongs to compose, not separate tool |
| AI Mediator (tile) | **Killed** — folded into Smart Compose chip with stronger copy | Same reason; two AI rewriters confuse model of where to type |
| AI Thread Summary | Tools menu — tile #1 | Slack-AI table-stake; keep as opt-in tile |
| Insights | Tools menu — tile #2 | Distinct from summary (patterns vs recap); opt-in |
| Pace / Sentiment / Conversation Flow | Merged into Thread Audit tile | Three audit views collapsed to one tabbed surface |
| Templates (tile) | Compose `/t` slash + Settings management | Two homes was the IA failure |
| Translate (tile) | Passive auto-translate default + per-thread settings tile + per-message context action | Eliminate "where do I translate?" by making it automatic |
| Keyboard Shortcuts (tile) | Cmd+K palette + Settings reference | Standard 2025 pattern; not per-thread |
| Export (tile) | App Settings | Nobody exports from a conversation tool surface |
| Notifications (tile) | App Settings + thread-header mute | Per-thread mute is daily; full config is settings |
| **ADD: Quote reply** | Message context-menu top 5 | Tier-1 table-stake |
| **ADD: Reactions** | Context-menu quick-bar above menu | Tier-1 |
| **ADD: Edit (15 min)** | Context-menu, own messages only | Tier-1 |
| **ADD: Voice message** | Compose bar — mic replaces send when empty | Tier-1; WhatsApp/Telegram pattern |
| **ADD: One-tap attach** | Compose bar — `+` with file/photo/camera | Tier-1 |
| **ADD: Search in thread** | Thread header | Tier-1; scoped to thread, not global |
| **ADD: Mute with presets** | Thread header bell | Tier-1 |
| **ADD: Block/report** | Context-menu destructive section | Tier-1; policy requirement |
| **ADD: Pin / star** | Context-menu overflow | Tier-2 |
| **ADD: @mention** | Compose `@` slash variant | Tier-2 |
| **ADD: Forward** | Context-menu top 5 | Tier-2 |

---

## Surface Inventories

### Surface 1 — Compose bar

`role="toolbar"` wrapping (a) action group left, (b) expandable text input center, (c) send group right.

| # | Action | Trigger | Mobile placement | Desktop placement | a11y label | Keyboard |
|---|---|---|---|---|---|---|
| 1 | Attach | Tap `+` → 3-item sheet/popover | Left of input, leftmost | Left of input, leftmost | `aria-label="Attach"`, `aria-haspopup="menu"` | `Alt+A` |
| 2 | Voice message | Press-and-hold mic, release send, swipe-left cancel | Right of input (replaces send when empty) | Right of input (replaces send when empty) | `aria-label="Hold to record voice message"`, `aria-pressed` while recording | `Alt+V` start, `Esc` cancel, `Enter` send |
| 3 | Smart Compose ghost-text | Passive inline as user types | Inline in textarea | Inline in textarea | `aria-live="polite"`, `aria-label="Suggestion: …. Tab to accept."` | `Tab` accept, `→` accept word, `Esc` dismiss |
| 4 | Tone chip (folded AI Coach) | Auto-surfaces on tone mismatch for new contacts (< 30 days unflagged) | Above textarea, dismissible | Above textarea, dismissible | `role="status"`, `aria-live="polite"` | `Ctrl+Shift+T` toggle, `Enter` apply, `Esc` dismiss |
| 5 | Format | Inline popover on text selection ≥ 1 char | Floats above selection | Floats above selection | `role="toolbar"`, `aria-label="Text formatting"` | `Cmd+B/I/E/K/Shift+7/Shift+8` |
| 6 | Templates | `/t <name>` typed in textarea → autocomplete | Listbox above keyboard | Listbox above input | `role="listbox"`, `aria-label="Template suggestions"` | `↑↓` nav, `Tab`/`Enter` insert |
| 7 | Slash commands | `/` at start of empty line | Same as Templates | Same as Templates | `role="listbox"` | Same as Templates |
| 8 | Translate-draft | Slash `/tr <lang>` or send-menu secondary | Within send menu | Within send menu | `aria-label="Translate draft before sending"` | `Cmd+Shift+L` |
| 9 | Send | Tap | Right of input, rightmost | Right of input, rightmost | `aria-label="Send message"` (updates to "Send to 3 people" in group) | `Cmd+Enter` |
| 10 | Schedule send | Long-press send / chevron next to send | Long-press → bottom sheet with presets | Chevron → popover | Send: `aria-haspopup="menu"` | `Cmd+Shift+Enter` |
| 11 | Tools menu opener | Tap kebab/tools icon | Inside `+` sheet, last row | Right of input, before send | `aria-label="AI tools"`, `aria-haspopup="dialog"` | `Cmd+Shift+P` |

### Surface 2 — Message context-menu

Triggered by long-press (mobile, 350ms) or right-click / `Shift+F10` / context-menu key (desktop).

| # | Action | Applicability | Time-bound | Position |
|---|---|---|---|---|
| 0 | Quick reactions bar (👍 ❤️ 😂 😮 😢 🙏 + `+`) | All messages | none | **Above** menu, always visible |
| 1 | Reply (quote) | All | none | Top 5 |
| 2 | React (full picker) | All | none | Top 5 |
| 3 | Copy text | All with text content | none | Top 5 |
| 4 | Edit | Own message only | Within 15 min of send; hidden after | Top 5 (own) |
| 5 | Forward | All | none | Top 5 |
| 6 | Pin to thread | All (workspace permissions in group) | none | Overflow |
| 7 | Translate this message | Received non-default language | Hidden when auto-translate already applied | Overflow |
| 8 | Show original | Received currently auto-translated | Inverse of #7 | Overflow |
| 9 | Save / Star | All | none | Overflow |
| 10 | Select (multi-select mode) | All | none | Overflow |
| 11 | Delete | Own message; group admin can delete others | always | Overflow (destructive, divider) |
| 12 | Block sender | Received, 1:1 only | Hidden in group (→ Mute participant) | Overflow (destructive) |
| 13 | Report | Received | none | Overflow (destructive) |
| 14 | Mention this user | Group on received | Hidden in 1:1 | Overflow |
| 15 | Message info (delivery/read) | Own in group | Hidden in 1:1 | Overflow |

### Surface 3 — Slim Tools menu (exactly 4 tiles)

| # | Tile | Purpose | Opens as | AI provenance chip | Empty-state |
|---|---|---|---|---|---|
| 1 | **Thread Summary** | LLM recap of conversation | Inline accordion within tools panel | **Y** — coral "AI" chip on output card | Hidden <10 msgs; disabled w/ onboarding 10-49; active 50+ |
| 2 | **Insights** | Patterns, recurring topics, unresolved questions | Inline accordion | **Y** | Hidden <20 msgs; active 20+ |
| 3 | **Thread Audit** (Pace + Sentiment + Flow) | Three sub-tabs: rhythm, tone trend, turn-taking | Modal (mobile) / side panel (desktop) | N (computed, not generated) | Disabled "Need 5+ messages" when too short |
| 4 | **Translate Settings** (per-thread) | Toggle passive auto-translate + target language | Inline form | N | Always available |

---

## Empty / Loading / Error States

| Surface | Empty | Loading | Error |
|---|---|---|---|
| **Thread Summary tile** | <10: hidden. 10-49: disabled "Summary unlocks at 50 messages". 50+: active. | Skeleton: 3 stacked lines (60%/90%/40%), 800ms shimmer. Determinate "Reading 234 messages…" for >200 msgs. | Inline retry card. AI chip persists. |
| **Insights tile** | <20: hidden. 20+: active. | Skeleton: 4 chip placeholders. | Same retry pattern. |
| **Thread Audit tile** | <5: disabled "Audit needs 5+ messages." 5+: active. | Per-sub-tab spinner; other tabs lazy-load. | Per-sub-tab error; siblings remain usable. |
| **Translate settings** | Always available; empty = auto-translate off. | n/a (instant) | "Couldn't save preference. Retry." |
| **Smart Compose ghost-text** | Silent (nothing rendered). | n/a (streaming) | Silent failure — logged, no user-visible error. |
| **Tone chip** | Default hidden; appears only when confidence ≥ threshold. | n/a | Suppressed on error. |
| **Templates `/t` autocomplete** | "No templates yet. Create one →" link to Settings. | Local lookup, no skeleton. | "Offline" badge with last-known cache. |
| **Quick reactions** | Always populated. | n/a | Optimistic UI rolls back with retry toast. |
| **Voice message** | Pre: mic button. Recording: waveform + timer + "Slide to cancel". | Recording in-flight. | Mic permission denied → bottom sheet to OS settings. Send fail → keep buffer + retry prompt. |
| **Schedule send** | Preset list + Custom. | n/a | Inline validation for past time. |

---

## Mobile vs Desktop Variants

| Feature | Mobile | Desktop | Reason |
|---|---|---|---|
| Compose bar overflow | `+` opens bottom sheet with Attach + Tools entry | Tools is its own button beside attach; no sheet | Touch grouping vs mouse space |
| Attach picker | Bottom sheet (file/photo/camera) | Popover anchored to `+` | Native OS pattern |
| Voice record | Press-hold; swipe-left cancel; swipe-up lock | Press-hold or `Alt+V` start, click stop; no swipe | Touch gestures vs pointer + keyboard |
| Format popover | Floats above selection, dismisses on scroll | Floats above selection, persists during scroll | iOS scroll behavior |
| Context-menu | Bottom sheet full-width + quick reactions on top | Anchored popover 240px + quick reactions on top | Mobile maximizes target; desktop minimizes travel |
| Tools menu | Bottom sheet 60% viewport, drag to expand | Right-side panel 380px, can pin open | Mobile yields to message view; desktop has column |
| Thread audit charts | Single-column, swipe tabs | Side-by-side small multiples | Screen real estate |
| Schedule send picker | Bottom sheet w/ date wheel (native) | Popover w/ date input + chips | Touch wheel vs keyboard |
| Send vs voice toggle | Same swap | Same + chevron next to send for schedule | Identical model |
| Cmd+K palette | Floating sheet from top | Centered modal | Cmd+K is desktop-primary |
| Tone chip | Dismissible by swipe-up | Dismissible by Esc or × | Touch vs keyboard |
| Templates `/t` autocomplete | Above keyboard, sticky | Below or above input depending on viewport | Keyboard occlusion |
| Long-press timing | 350ms (iOS-aligned) | n/a (right-click) | Platform conventions |

---

## A11y Decisions

### Landmarks per surface

- **Compose bar** → `role="toolbar"`, `aria-label="Message composer"`. Internal `role="group"` for attach group, `role="group"` for send group. Textarea is NOT inside a group (main editable region).
- **Message context-menu** → `role="menu"`, `aria-label="Message actions"`. Quick reactions are a sibling `role="toolbar"`, `aria-label="Quick reactions"` so SR users hear it as a distinct surface.
- **Tools menu** → `role="dialog"`, `aria-modal="true"` (mobile sheet) / `aria-modal="false"` (pinned desktop panel). Tiles are `role="button"` with provenance in `aria-label` ("Thread Summary — AI generated").
- **Cmd+K palette** → `role="dialog" aria-modal="true"`, internal `role="listbox"` with `aria-activedescendant`.

### Focus management on context-menu open

- On open: focus to **first menu item (Reply)**, NOT quick-reactions bar.
- Roving tabindex within menu (one item `tabindex=0` at a time).
- On close: focus returns to the message bubble (preserves reading position).
- `Esc` closes; click-outside closes; long-press release does NOT close.

### Compose bar role decision

`role="toolbar"` (NOT `role="group"`) for the outer compose bar. Independent action controls (toolbar), not logically-related inputs (group). Attach `+` is `aria-haspopup="menu"`; send + send-chevron form a `role="group"` with shared label "Send options".

### Live regions for Smart Compose

- `aria-live="polite"` (not assertive — would interrupt typing).
- `aria-atomic="true"` so the entire suggestion is announced (not character-by-character).
- 600ms debounce after suggestion settles.
- Announcement format: `"Suggestion: '…'. Press Tab to accept."`
- Tone chip uses `role="status"` (implicit polite).

### Identical-name disambiguation fix

The current product has two tabstops both labeled "Templates" and two labeled "Translate". Fix:

- Tools menu has **no** Templates tile (removed entirely — slash command handles insertion, settings handles management).
- Tools menu Translate tile is `aria-label="Translate settings for this thread"` — never collides with per-message context action `"Translate this message"` or slash command `"Translate draft"`.
- **Every accessible name is unique across the entire Messages section.** Verify with axe-core after implementation.

### Keyboard shortcut inventory (non-colliding)

| Shortcut | Action | Surface |
|---|---|---|
| `Cmd+Enter` | Send | Compose |
| `Cmd+Shift+Enter` | Open schedule-send picker | Compose |
| `Cmd+K` | Command palette | Global |
| `Cmd+Shift+P` | Open Tools menu | Compose |
| `Cmd+B / I / E / K` | Format selected text | Selection popover |
| `Cmd+Shift+7 / 8` | Ordered / unordered list | Selection popover |
| `Cmd+Shift+L` | Translate draft | Compose |
| `Alt+A` | Open attach sheet | Compose |
| `Alt+V` | Start voice recording | Compose |
| `Ctrl+Shift+T` | Toggle tone chip when hidden | Compose |
| `Tab` | Accept Smart Compose suggestion | Textarea (with suggestion present) |
| `→` (end of line) | Accept Smart Compose word-by-word | Textarea |
| `Esc` | Dismiss Smart Compose / Tone chip / close menu | Multiple |
| `Shift+F10` | Open context-menu (keyboard nav) | Message focused |

`Tab` semantic preserved when no Smart Compose suggestion present. When suggestion showing, `Tab` accepts AND moves focus to send button.

### Touch targets

All compose-bar buttons ≥ 44×44 CSS px (WCAG 2.2 AA, AAA preferred). Quick-reactions emoji 40px tap area with 8px spacing — meets WCAG 2.2 SC 2.5.8 spacing equivalence.

### Dark / light parity

- Tone chip uses `--pulse-coral` only when conflict severity ≥ high (per Coral-As-Signal rule). Soft tone hints use `--pulse-muted-fg`.
- Smart Compose ghost-text: `color-mix(in oklch, var(--pulse-fg), transparent 55%)` light, 50% dark. Both pass 3:1 against textarea background.
- AI provenance chips: coral border + `--pulse-coral-fg` text in both modes; background 12% opacity (light) / 8% opacity (dark).
- Quick reactions bar: light = surface-2 background with 1px border; dark = surface-3 background no border.

---

## Forge ASCII Mocks

Annotation key: `[coral]` = `--pulse-coral` token (signal only). `(muted)` = `--pulse-text-muted` ghost. `▢` = touch target ≥44×44. `<<` = mobile-only. `>>` = desktop-only.

### 1.1 Compose bar — at rest

```
MOBILE (375w)
┌────────────────────────────────────────────────┐
│                                                │
│  ┌──┐  ┌──────────────────────────────┐  ┌──┐  │
│  │ +│  │ Message Casey…               │  │ ◉│  │
│  └──┘  └──────────────────────────────┘  └──┘  │
│  attach     placeholder (muted)            mic │
└────────────────────────────────────────────────┘
   ▢44px        textarea grows to 5 lines       ▢44px

DESKTOP (≥1024w)
┌──────────────────────────────────────────────────────────────────────┐
│ [+]  Message Casey…                                  [⚙ tools]  [◉]  │
│      placeholder (muted)                              Cmd+Shift+P    │
└──────────────────────────────────────────────────────────────────────┘
```
Mic replaces send when textarea empty. Tools opener (`⚙`) is desktop-only inline.

### 1.2 Compose bar — text typed, Smart Compose ghost-text

```
MOBILE
┌────────────────────────────────────────────────┐
│  ┌──┐  ┌──────────────────────────────┐  ┌──┐  │
│  │ +│  │ Thanks for the heads up on   │  │ ▶│  │
│  │  │  │ the timeline — let me know   │  │  │  │
│  │  │  │ if you need anything else.   │  │  │  │
│  │  │  │ ░I'll circle back tomorrow░  │  │  │  │
│  └──┘  └──────────────────────────────┘  └──┘  │
│         ░░░ = ghost (muted)            send ▶  │
│         Tab=accept   →=accept word              │
└────────────────────────────────────────────────┘

DESKTOP
┌──────────────────────────────────────────────────────────────────────┐
│ [+] Thanks for the heads up — let me know if you need anything else. │
│     ░I'll circle back tomorrow░               [⚙]   [Cmd+Enter ▶]    │
└──────────────────────────────────────────────────────────────────────┘
```
Send is a **neutral primary** action — NOT coral. Coral reserved for AI signal.

### 1.3 Compose bar — Tone chip (new contact, <30 days)

```
            ┌─────────────────────────────────────────────────────┐
            │ ⚠  Sounds terser than usual — soften?    [Apply] [×]│
            │    relationship-aware (muted body, accent border)   │
            └─────────────────────────────────────────────────────┘
                              ↓ anchored above textarea
┌────────────────────────────────────────────────────────────────────┐
│ [+]   Fine. Send it.                                       [▶]     │
└────────────────────────────────────────────────────────────────────┘
```
Chip uses **neutral warning token** (NOT coral — coral is AI-output only). Auto-dismisses after 30 days unflagged exchanges with this contact.

### 1.4 Compose bar — Format popover on selection

```
                 ┌─────────────────────────────────────┐
                 │  B   I   <>   •—   "   🔗           │
                 │ bold ital code list quote link      │
                 └────────────┬────────────────────────┘
                              │ floats above selection
┌─────────────────────────────▼───────────────────────────────────────┐
│ [+]  Tomorrow's review will cover ▓the new pricing page▓ and Q3.   │
│                                    ↑ selected text                  │
│                                                              [▶]    │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.5 Compose bar — Templates `/t fri…` autocomplete

```
       ┌─────────────────────────────────────────────────┐
       │ ▌ Friday Update              ↵                   │ ← highlighted
       │   Friendly Hello             ↵                   │
       │   Friday Recap (team)        ↵                   │
       │   2 of 7 templates · ↑↓ navigate · Esc close     │
       └─────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│ [+]  /t fri▍                                              [▶]    │
└──────────────────────────────────────────────────────────────────┘
```

### 1.6 Compose bar — Voice recording (Relay branded)

```
MOBILE
┌──────────────────────────────────────────────────────────────┐
│  ┌─Relay voice────────────────────────────────────┐  ┌────┐  │
│  │ ▁▂▃▅▆▇▆▅▃▂▁▂▃▅▆▇▆▅▃▂▁▂▃▅▆▇   0:08              │  │ ✕  │  │
│  │ ◀ Slide to cancel             ▲ Lock           │  └────┘  │
│  └─────────────────────────────────────────────────┘  cancel │
└──────────────────────────────────────────────────────────────┘
        ▲ Relay wordmark — voice is a Relay context

DESKTOP
┌──────────────────────────────────────────────────────────────────────┐
│  Relay  ▁▂▃▅▆▇▆▅▃▂  0:08                       [Cancel]  [Stop ⏹]   │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.7 Compose bar — Schedule send popover

```
DESKTOP — chevron next to send
                          ┌───────────────────────────────┐
                          │ Send when?                    │
                          │ ─────────────────────────     │
                          │ [Tomorrow morning, 9 AM]      │
                          │ [Monday 9 AM]                 │
                          │ [Tonight, 7 PM]               │
                          │ [Custom…]                     │
                          │ ─────────────────────────     │
                          │  Esc to cancel · ↵ confirm    │
                          └───────────────────────────────┘
                                       ▲ anchored on chevron
┌──────────────────────────────────────────────────────────────────────┐
│ [+]  Heads up — bumping our 3pm to Thursday.            [▶][⌄]       │
│                                                       send  schedule │
└──────────────────────────────────────────────────────────────────────┘

MOBILE — long-press send opens bottom sheet
┌──────────────────────────────────────────────────┐
│           ──── (drag handle) ────                │
│  Send when?                                  ✕   │
│ ──────────────────────────────────────────────── │
│  ▢ Tomorrow morning, 9 AM                       │
│  ▢ Monday 9 AM                                  │
│  ▢ Tonight, 7 PM                                │
│  ▢ Custom…                                      │
└──────────────────────────────────────────────────┘
```

### 1.8 Compose bar — Attach sheet (mobile)

```
┌──────────────────────────────────────────────────┐
│           ──── (drag handle) ────                │
│                                                  │
│   ▢ 📎  File                                  ›  │
│ ──────────────────────────────────────────────── │
│   ▢ 🖼  Photo                                 ›  │
│ ──────────────────────────────────────────────── │
│   ▢ 📷  Camera                                ›  │
│ ──────────────────────────────────────────────── │
│              [   Cancel   ]                      │
└──────────────────────────────────────────────────┘
```

### 2.1 Context-menu — Own message, <15min (mobile sheet)

```
┌────────────────────────────────────────────────────┐
│           ──── (drag handle) ────                  │
│                                                    │
│   ┌────────────────────────────────────┐           │
│   │   👍   ❤   😂   😮   😢   🙏   ＋  │  ← quick   │
│   └────────────────────────────────────┘    react  │
│                                                    │
│ ──────────────────────────────────────────────── │
│   ↩  Reply (quote)                                 │
│   😀 React…                                        │
│   ⧉  Copy                                          │
│   ✎  Edit                       (visible — <15min) │
│   →  Forward                                       │
│ ──────────────────────────────────────────────── │
│   More…                                       ⌄    │
└────────────────────────────────────────────────────┘
```

### 2.2 Context-menu — Own message, edit window expired

```
┌────────────────────────────────────────────────────┐
│           ──── (drag handle) ────                  │
│   ┌────────────────────────────────────┐           │
│   │   👍   ❤   😂   😮   😢   🙏   ＋  │           │
│   └────────────────────────────────────┘           │
│ ──────────────────────────────────────────────── │
│   ↩  Reply (quote)                                 │
│   😀 React…                                        │
│   ⧉  Copy                                          │
│   →  Forward                                       │
│   ⊕  Pin                                           │
│ ──────────────────────────────────────────────── │
│   More…                                       ⌄    │
└────────────────────────────────────────────────────┘
```
Edit is **hidden** (not disabled-grey) — Pin fills the 5th slot.

### 2.3 Context-menu — Received message in 1:1 (mobile)

```
┌────────────────────────────────────────────────────┐
│           ──── (drag handle) ────                  │
│   ┌────────────────────────────────────┐           │
│   │   👍   ❤   😂   😮   😢   🙏   ＋  │           │
│   └────────────────────────────────────┘           │
│ ──────────────────────────────────────────────── │
│   ↩  Reply (quote)                                 │
│   😀 React…                                        │
│   ⧉  Copy                                          │
│   →  Forward                                       │
│   🌐 Translate this message                        │
│ ──────────────────────────────────────────────── │
│   More…                                       ⌄    │
│   └─→ Pin · Save · Select · Message info ·         │
│       Block sender · Report                        │
└────────────────────────────────────────────────────┘
```

### 2.4 Context-menu — Received message in group thread

```
┌────────────────────────────────────────────────────┐
│           ──── (drag handle) ────                  │
│   ┌────────────────────────────────────┐           │
│   │   👍   ❤   😂   😮   😢   🙏   ＋  │           │
│   └────────────────────────────────────┘           │
│ ──────────────────────────────────────────────── │
│   ↩  Reply (quote)                                 │
│   😀 React…                                        │
│   ⧉  Copy                                          │
│   @  Mention this person                           │
│   →  Forward                                       │
│ ──────────────────────────────────────────────── │
│   More…                                       ⌄    │
│   └─→ Pin · Save · Translate · Message info ·      │
│       Mute participant · Report                    │
└────────────────────────────────────────────────────┘
```
Block sender → Mute participant (group context). @mention promoted.

### 2.5 Context-menu — Desktop right-click popover (240px)

```
                ┌────────────────────────────────────┐
                │  👍   ❤   😂   😮   😢   🙏   ＋   │  ← role=toolbar
                ├────────────────────────────────────┤
                │  ↩  Reply               R          │
                │  😀 React…              E          │
                │  ⧉  Copy               ⌘C          │
                │  ✎  Edit               ⌘↵          │
                │  →  Forward             F          │
                ├────────────────────────────────────┤
                │  ⊕  Pin                            │
                │  🌐 Translate this msg              │
                │  ⭐ Save                           │
                │  ☐  Select                         │
                │  ℹ  Message info                   │
                │  🗑  Delete             ⌫           │
                └────────────────────────────────────┘
```

### 3.1 Tools menu — Desktop side panel (380px, pinned open)

```
┌──────────────────────────────────────────┐ 380px
│  Tools                              [⤓]  │  ← collapse/pin toggle
│  ──────────────────────────────────────  │
│  ┌────────────────────────────────────┐  │
│  │ 🔍  Search tools…                  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌──────────────────┐ ┌────────────────┐ │
│  │  Thread Summary  │ │  Insights      │ │
│  │  [AI]            │ │  [AI]          │ │  ← coral chips
│  │  Recap long      │ │  Patterns +    │ │
│  │  threads         │ │  highlights    │ │
│  └──────────────────┘ └────────────────┘ │
│                                          │
│  ┌──────────────────┐ ┌────────────────┐ │
│  │  Thread Audit    │ │  Translate     │ │
│  │                  │ │  Settings      │ │
│  │  Pace · Sentiment│ │                │ │
│  │  · Flow          │ │  Per-thread    │ │
│  └──────────────────┘ └────────────────┘ │
└──────────────────────────────────────────┘
```
**Exactly 4 tiles, 2×2 grid.** `[AI]` chip uses `--pulse-coral` border + `--pulse-coral-fg` text — only decoration permitted.

### 3.2 Tools menu — Mobile bottom sheet (60% viewport)

```
┌──────────────────────────────────────────────────┐
│           ──── (drag handle) ────                │
│  Tools                                      ✕   │
│  ──────────────────────────────────────────────  │
│  [🔍  Search tools…                          ]   │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ ✨ Thread Summary                      [AI]│  │
│  │    Recap long threads                      │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ 📊 Insights                            [AI]│  │
│  │    Patterns and highlights                 │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ 🧭 Thread Audit                            │  │
│  │    Pace · Sentiment · Flow                 │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ 🌐 Translate Settings                      │  │
│  │    Per-thread auto-translate               │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 3.3 Thread Summary — empty/locked (state matrix)

- `<10 msgs`: HIDE tile entirely
- `10-49 msgs`: DISABLED tile with copy "Summary unlocks at 50 messages" (dimmed `[AI]` chip preserves identity)
- `50+ msgs`: ACTIVE

### 3.4 Thread Summary — generating

```
┌──────────────────────────────────────────────────┐
│  ◀ Tools  /  Thread Summary                 [AI] │  ← coral chip
│  ────────────────────────────────────────────────│
│   ┌──────────────────────────────────────────┐   │
│   │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │   │ ← 60% skeleton
│   │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │   │ ← 90%
│   │  ░░░░░░░░░░░░░░░░░░░                     │   │ ← 40%
│   │                                          │   │
│   │  ━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░       │   │ ← determinate
│   │  Reading 234 messages… 62%               │   │
│   └──────────────────────────────────────────┘   │
│                              [Cancel]            │
└──────────────────────────────────────────────────┘
```

### 3.5 Thread Summary — generated (canonical AI chip placement)

```
┌──────────────────────────────────────────────────┐
│  ◀ Tools  /  Thread Summary                      │
│  ────────────────────────────────────────────────│
│   ┌──────────────────────────────────────[AI]┐   │  ← coral chip top-right
│   │                                          │   │
│   │  Casey raised concerns about the Q3      │   │
│   │  timeline on Monday, citing dependencies │   │
│   │  on the design review.                   │   │
│   │                                          │   │
│   │  You agreed to move the kickoff to       │   │
│   │  Thursday and to loop in Marcus before   │   │
│   │  Wednesday EOD.                          │   │
│   │                                          │   │
│   │  Open items: Marcus intro, revised       │   │
│   │  scope doc, vendor SOW.                  │   │
│   │  ────────────────────────────────────    │   │
│   │  Summarized from 234 messages · 2s ago   │   │
│   │              [↻ Regenerate]  [⧉ Copy]    │   │
│   └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### 3.6 Thread Audit — active with 3 sub-tabs

```
┌──────────────────────────────────────────────────┐
│  ◀ Tools  /  Thread Audit                        │
│  ────────────────────────────────────────────────│
│   ┌─────────┬─────────────┬──────────┐           │
│   │  Pace   │  Sentiment  │   Flow   │           │
│   ├─────────┴─────────────┴──────────┴────────┐  │
│   │  PACE                                     │  │
│   │  ────────────────────────────────────     │  │
│   │  Avg reply time      4h 12m               │  │
│   │  Median              28m                  │  │
│   │  Your avg            1h 02m               │  │
│   │  Their avg           7h 21m               │  │
│   │                                           │  │
│   │  Last 30 days                             │  │
│   │   ▁▂▁▃▂▅▃▂▄▅▆▃▂▁▂▃▄▅▆▇▆▅▃▂▁▂▃▄▅▆          │  │
│   │  ───────────────────────────────────────  │  │
│   │   day 1                          day 30   │  │
│   │                                           │  │
│   │  Sparkline uses --pulse-chart-1 token     │  │
│   │  (NOT coral — this is data, not signal)   │  │
│   └───────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```
**Data-viz uses `--pulse-chart-*` tokens, never coral.** Disabled-state copy: "Need 5+ messages — say more, see more."

---

## Coral Budget Audit

Across all 19 mocks, coral appears **exactly 6 times**:

1. Tools tile chip — Summary (3.1, 3.2)
2. Tools tile chip — Insights (3.1, 3.2)
3. Summary output card chip (3.5)
4. Insights output card chip (implied 3.x)
5. Disabled-Summary muted chip (3.3 option B)
6. Generating-state chip (3.4)

**Zero coral on:** Compose bar, Context-menu, Audit, Translate, or any flow chrome.

**Reject any PR that adds coral elsewhere.** Coral-as-signal rule is locked.

---

## Three Example User Flows

### Flow A — Casual user fixes a typo (uses Edit)

1. Type & send (mock 1.1 → 1.2). User types "Sounds god, let's do Thursday." Smart Compose suggests "Thursday's plan" but user hits `Cmd+Enter`.
2. Notice typo. Bubble reads "Sounds god".
3. Long-press own bubble → mock 2.1 sheet. Edit visible (45s after send, <15min).
4. Tap Edit. Sheet dismisses; bubble flips inline into textarea with compose toolbar. **Reactions on that message are cleared (locked decision #4)**; brief "(cleared on edit)" toast appears.
5. Fix and save. "edited" badge appears next to timestamp. Hover/long-press reveals original "Sounds god…".

`Mocks: 1.1 → 1.2 → 2.1 → 1.4-style inline editor → bubble with "edited" badge`

### Flow B — Power user schedules via keyboard only

1. Focus compose (`Cmd+K` or click). Mock 1.1.
2. Type body. "Heads up — bumping our 3pm to Thursday." Smart Compose offers "Will send a calendar invite shortly." (1.2). User does not accept.
3. `Cmd+Shift+Enter` → mock 1.7 desktop popover. Focus auto-lands on first preset chip.
4. `↓` to "Monday 9 AM", `Enter`. Popover closes; bubble shows `📅 Scheduled · Mon 9:00 AM` placeholder with `[Edit] [Cancel]` inline.

`Mocks: 1.1 → 1.2 → 1.7 (desktop) → scheduled-placeholder bubble`

### Flow C — Multilingual user reads + replies to a Portuguese message

1. Inbound Portuguese message ("Bom dia! Conseguimos confirmar para quinta?"). Translate Settings has passive auto-translate ON, target = English.
2. **First translated message in this thread** → per-message chip:

```
┌──────────────────────────────────────────────────┐
│  Casey · 9:04 AM                                 │
│  ┌────────────────────────────────────────────┐  │
│  │ Good morning! Can we confirm for Thursday? │  │
│  │ ─────────────────────────────────────────  │  │
│  │ 🌐 translated from Portuguese · Show       │  │
│  │    original                                │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```
The 🌐 chip uses **neutral info-token, NOT coral** — translation is deterministic, not AI-authored prose.

3. **Subsequent Portuguese messages do NOT show per-bubble chip** (locked decision #6). Thread-level indicator in header:

```
┌──────────────────────────────────────────────────┐
│  ‹  Casey                          🌐 auto-PT→EN │
└──────────────────────────────────────────────────┘
```

4. User replies. Smart Compose ghost-text "Confirming on my calendar now." (1.2). `Tab` accept.
5. `Cmd+Enter` send. Outgoing stays English; Translate Settings is passive-receive only.

`Mocks: incoming-bubble-with-chip → 1.2 → sent-bubble`

---

## Implementation Roadmap

### Pre-requisites (block any PR)

1. **AI chip token variants** — confirm `--pulse-coral-bg-12` (light) and `--pulse-coral-bg-08` (dark) exist in `src/styles/pulse-tokens.css`. If only `--pulse-coral` declared, add bg/fg variants via Muse first.
2. **Relay branding mark/token** — voice UI references "Relay" in dialog header (mock 1.6). Confirm Relay has its own micro-mark or text-mark in tokens.
3. **Server: `edit_until` timestamp per message** — NOT a client-computed boolean. Mock 2.2 depends on this being checked at menu-open.
4. **Server: `thread.first_translated_message_id`** must persist so reloads keep per-message chip on the right bubble.

### PR sequence

| PR | Surface | Scope | Time-box | Dependencies |
|---|---|---|---|---|
| **PR 1** | Compose bar | Surface 1 minus voice/schedule. Slash commands, format-on-select, Smart Compose ghost-text. | 5-7 days | None (no AI dependency for ghost-text fallback) |
| **PR 2** | Context-menu | Surface 2 full + edit-after-reaction clearing + "edited" badge | Standalone | Server `edit_until` timestamp |
| **PR 3a** | Tools menu shell | Translate Settings + Thread Audit (deterministic, no LLM) | Standalone | None |
| **PR 3b** | Tools menu AI tiles | Thread Summary + Insights with AI provenance chip | After PR 3a | Coral token variants + Gemini routing (already locked in server-side edge functions) |

### Coral budget audit (every PR review)

- Surface 1, Surface 2 PRs: **zero coral expected**. Reject if any appears.
- Surface 3 PR: **coral only on AI tile chips and AI output card chips**. Six instances total across the surface. Reject if any other element uses coral.

### Out-of-scope (not in this redesign)

- Thread header redesign (search, mute, settings)
- Cmd+K command palette implementation
- App Settings reorganization (notifications, export, shortcuts, templates management)

These surfaces are referenced but their detailed design is owned by other work streams.

---

## Open Questions / Future Decisions

None blocking implementation. The 3 questions Palette raised (edit-after-reaction policy, tone chip threshold, translate provenance) are all resolved in § Locked Decisions.

Potential future considerations (not blocking):

- **Outbound translate** — current spec is passive-receive only. If Pulse later wants outbound auto-translate (e.g., send English, recipient sees Spanish), revisit translate-draft slash command (`/tr <lang>`).
- **Voice transcripts** — Relay voice messages could auto-transcribe; not in current scope. Would add a context-menu action.
- **Smart Reply chips** — Compete flagged as NOT-STANDARD in messaging (Gmail-style chips are email-domain). Reconsider if Pulse adds an email/work-tier surface.
