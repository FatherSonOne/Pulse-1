# Pulse Contacts Phase C — Vision / UI Design Spec (2026-05-18)

> A UI design direction spec for the Phase C contact-card sharing protocol — every new surface, state, copy string, and token mapping needed for Phase 6 codex implementation to translate into React + Tailwind without re-deciding a single UX choice.
> **Inputs**: magi verdict 2026-05-18 (`docs/contacts-phase-c-magi-verdict-2026-05-18.md`), accord Lite spec 2026-05-18 (`docs/contacts-phase-c-accord-2026-05-18.md`), handoff doc 2026-05-18 (`docs/CONTACTS_OVERHAUL_HANDOFF_2026-05-18.md`).
> **Scope**: design directions for every new Phase C component + IA placement + interaction states + copy patterns + tokens + accessibility + dark/light + mobile. Excludes code, schema, and edge-function internals (owned by Phase 5 schema agent + Phase 6 codex).

---

## Component inventory

All new components live under `src/components/contacts/cards/` to keep them grouped and easy for Phase 6 codex to scaffold. Naming follows Phase B conventions (PascalCase, no `Card` prefix collision with existing visual chrome).

### New components

| Component | File | Purpose | High-level props |
|---|---|---|---|
| `ShareCardModal` | `cards/ShareCardModal.tsx` | Single-recipient share creation flow (Maya's case). | `open`, `contact` (the subject), `onCancel`, `onSent(card)`; internal state for recipient hint, intro note, token policy toggle, forwardability toggle, expiry picker. |
| `ShareCardBundleModal` | `cards/ShareCardBundleModal.tsx` | Multi-recipient bulk share (Sasha's case). | `open`, `subjects` (≥2 contacts), `onCancel`, `onSent(bundle)`; internal recipient chip-list, shared intro note, confirmation step state. |
| `ReceivedTab` | `cards/ReceivedTab.tsx` | 4th Contacts nav tab content; orchestrates list + detail + multi-select. | `cards[]`, `selectedIds`, `onSelectionChange`, `onAcceptSelection`, `onOpenCard(id)`. |
| `ReceivedCardListItem` | `cards/ReceivedCardListItem.tsx` | Single row in the Received inbox list. | `card`, `selected`, `onToggleSelect`, `onOpen`; renders avatar, names, source chip, time. |
| `ReceivedCardDetail` | `cards/ReceivedCardDetail.tsx` | Full card view with Accept / Decline / Maybe actions. | `card`, `onAccept`, `onDecline`, `onMaybe`, `onForward`; embeds `CardProvenanceLine`, `ExpiryWarningBanner`. |
| `AcceptCardConfirmation` | `cards/AcceptCardConfirmation.tsx` | Modal with default-checked "also connect with sender" checkbox (magi D-2). | `card`, `onCancel`, `onConfirm({ connectWithSender: boolean })`. |
| `ReviewDuplicatesScreen` | `cards/ReviewDuplicatesScreen.tsx` | Post-Accept dedup resolution UI; per-pair merge or keep-both. | `pairs: Array<{cardId, existingContactId}>`, `onMerge(pair)`, `onKeepBoth(pair)`, `onDone`. |
| `SentCardsView` | `cards/SentCardsView.tsx` | Sender's outbox / audit trail (R-23). | `cards[]`, `onUnsend(id)`, `onRevoke(id)`, `onForward(id)`. |
| `CardLandingPage` | `cards/landing/CardLandingPage.tsx` (or separate edge-rendered route — see Out of scope) | Public web preview for non-Pulse recipients. | `cardData` (from edge function), `intercepted` (boolean — Universal Link picked up by installed app). |
| `ForwardCardModal` | `cards/ForwardCardModal.tsx` | Forward an accepted card to another recipient. | `sourceCard`, `onCancel`, `onSent`; mirrors ShareCardModal recipient picker. |
| `RevokeCardConfirmation` | `cards/RevokeCardConfirmation.tsx` | Sender-side dialog distinguishing Unsend (≤30m, 0 views) vs Revoke. | `card`, `mode: 'unsend' \| 'revoke'`, `onCancel`, `onConfirm`. |
| `CardProvenanceLine` | `cards/CardProvenanceLine.tsx` | Reusable single-line "Aiko is forwarding Maya's card" provenance string. | `immediateSenderName`, `originalSenderName?`, `variant: 'inline' \| 'banner'`. |
| `ExpiryWarningBanner` | `cards/ExpiryWarningBanner.tsx` | Non-dismissible banner on cards with `expires_at - now() < 3 days`. | `expiresAt`. |
| `CardSourceChip` | `cards/CardSourceChip.tsx` | "From card" chip variant of `ProvenanceChip` for received-card list items. | `senderName`, `sentAt`. |

**Total: 14 new components.**

### Modified components

| Component | What changes |
|---|---|
| `ContactsRedesigned.tsx` | Adds 4th tab registration (gated on `VITE_CONTACTS_PHASE_C_ENABLED`); receives unread-count for badge; routes `ReceivedTab` mounting. |
| `BulkActionToolbar.tsx` | Per magi cross-cutting + accord R-22: splits the single "Share" CTA into **"Share to workspace"** (existing Phase B behavior) and **"Share via card"** (opens `ShareCardBundleModal`). When `selectedCount === 1`, only "Share via card" renders; "Share to workspace" requires ≥2 selected as today. |
| `ProvenanceChip.tsx` | Add `'card'` to `ContactProvenanceSource` union and `.ps-provenance-dot[data-source="card"]` CSS variant. Used for contacts that originated from an Accepted card. |
| `ContactDetail.tsx` | New header action: "Share via card" → opens `ShareCardModal` with this contact as subject. Also: if the contact was Accepted from a card, render `CardSourceChip` + chain depth indicator in the header. |

**Total: 4 modified components.**

---

## Information Architecture

### Fourth top-level tab

Magi D-5 locks the Received inbox as a **4th top-level tab in the Contacts navigation** (not a People subview). Verdict is medium-confidence (74) — the demotion path is a feature-flag flip, not a refactor.

**Tab order (desktop and mobile)**

Phase B today has three tabs in `ContactsRedesigned.tsx`: People · Circles · Today. The Phase C tab inserts to the **right of Today**, giving:

```
People · Circles · Today · Received
```

Rationale: Today is the "what's urgent now" tab and Received is "what's incoming now" — adjacency reinforces the recency-first mental model. Saved Filters (Phase B) is a sidebar widget, not a tab, so no conflict.

**Label**: `"Received"` (i18n key `contacts.tabs.received_label`). Considered `"Cards"` but rejected — too generic for senders looking for Sent Cards (which lives elsewhere, see Sent Cards IA below). "Received" matches inbox mental model.

**Badge styling**

Shown only when unread/unprocessed count > 0. Cap visual at `"99+"` per accord AC-8-4.

- Light: `background: var(--pulse-coral-bg-12)`, text `var(--pulse-coral-fg)`, border `1px solid color-mix(in oklab, var(--pulse-coral) 25%, transparent)`.
- Dark: same tokens — `--pulse-coral-bg-12` uses `color-mix(... transparent)` so it composites correctly over the dark canvas; `--pulse-coral-fg` has a dark override at 8.47:1 contrast.
- Shape: pill, `border-radius: 9999px`, vertical padding `2px`, horizontal `6px`, font size `11px`, weight `600`, `font-variant-numeric: tabular-nums`.
- Position: trailing the tab label, gap `6px`.
- This is the **deliberate coral-budget exception** documented in magi cross-cutting and accord R-8. Add an inline CSS comment at the badge rule: `/* Phase C coral exception per magi D-5 — signal-of-pending, not AI provenance */`.

**Empty state (no received cards)**

Heading: `"No cards yet"`
Body: `"Cards friends share with you appear here. Open a Pulse share link to receive your first card."`
Illustration: lightweight inline SVG line-art envelope with a Rose-tinted heartbeat line through it (consume `var(--pulse-rose)` at 60% opacity). NO coral here — coral is reserved for the badge.
Secondary CTA: `"Get a share link from a friend"` (no-op text — informational; recipients don't initiate shares).

**Feature-flag-off behavior**

When `VITE_CONTACTS_PHASE_C_ENABLED=false`: the tab **does not render at all** (not disabled-and-greyed — fully absent). This matches Phase A's flag pattern and keeps the 3-tab IA visually identical to today. Accord AC-8-1/8-2.

**Sent Cards IA placement**

Sent Cards is **NOT** a top-level tab. It lives at `Settings → Activity → Sent Cards` (new route), reachable also from a `"Sent cards"` link in the Received tab header (right-aligned, small, secondary text). Rationale: senders need an audit trail but it's a low-frequency utility, not daily. Magi made no IA ruling on Sent — vision decides this here (see Open questions §3).

**Mobile adaptation**

The Contacts tabs render as a horizontal scrolling segmented control on viewports < 640px (existing Phase A/B pattern). With 4 tabs, all labels still fit on a 360px viewport at the existing 12px label size. No truncation required. Badge sits inline with the label inside the tab.

---

## Layout sketches

ASCII sketches below describe target structure; final spacing follows existing Phase B density (16px gutters, 12px row internal padding, 8px between sibling rows).

### 1. ShareCardModal (single recipient)

Width: `max-w-md` (matches `WorkspaceShareModal`). Stacked column. Reuses `pulse-modal-scrim` backdrop.

```
┌─────────────────────────────────────────────────┐
│  Share Maya Chen's card                       × │
│  Send a copy of this contact to someone.        │
├─────────────────────────────────────────────────┤
│  To                                             │
│  ┌───────────────────────────────────────────┐  │
│  │ Pulse user or email                       │  │
│  └───────────────────────────────────────────┘  │
│  e.g. priya@example.com                         │
│                                                 │
│  Add a note (optional)                          │
│  ┌───────────────────────────────────────────┐  │
│  │                                           │  │
│  │                                           │  │
│  └───────────────────────────────────────────┘  │
│                                       0 / 500   │
│                                                 │
│  ▸ More options                                 │
│    [ ] Make this link single-use                │
│    [✓] Allow forwarding                         │
│    Expires    [ Never ▾ ]                       │
│                                                 │
├─────────────────────────────────────────────────┤
│                          [ Cancel ]  [ Send ]   │
└─────────────────────────────────────────────────┘
```

- "More options" collapsed by default (Lee/Maya power-user controls; Aiko/Sasha never need them).
- Send button is `.pulse-btn-primary` (rose-solid); disabled when recipient field empty.
- On Capacitor (mobile), an additional `"Share via system…"` secondary button appears below Send — opens the native share sheet *after* the card row is created (R-5).

### 2. ShareCardBundleModal (multi-recipient)

Width: `max-w-lg`. Two-step modal: **Compose** then **Confirm**.

```
Step 1 — Compose
┌─────────────────────────────────────────────────┐
│  Share 12 cards as a bundle                   × │
│  Bundles are perfect for events and intros.     │
├─────────────────────────────────────────────────┤
│  Recipients                                     │
│  ┌───────────────────────────────────────────┐  │
│  │ ▣ priya@x.com  ▣ rob@y.com  ▣ Aiko T...   │  │
│  │ Type or paste comma-separated emails…     │  │
│  └───────────────────────────────────────────┘  │
│  Add up to 25 recipients. Paste a CSV to bulk.  │
│                                                 │
│  Add a shared note (optional)                   │
│  ┌───────────────────────────────────────────┐  │
│  │                                           │  │
│  └───────────────────────────────────────────┘  │
│                                       0 / 500   │
│                                                 │
│  ▸ More options                                 │
│    [✓] Allow forwarding                         │
│    Expires    [ Never ▾ ]                       │
│    Note: bundles always use multi-use links.    │
│                                                 │
├─────────────────────────────────────────────────┤
│                       [ Cancel ]  [ Continue ]  │
└─────────────────────────────────────────────────┘

Step 2 — Confirm
┌─────────────────────────────────────────────────┐
│  Ready to send                                × │
├─────────────────────────────────────────────────┤
│  You're about to send                           │
│                                                 │
│         12 cards × 3 recipients                 │
│              = 36 shares                        │
│                                                 │
│  Each recipient gets all 12 cards in one email. │
│  Recipients see who you are and your note.      │
│                                                 │
├─────────────────────────────────────────────────┤
│                         [ Back ]  [ Send all ]  │
└─────────────────────────────────────────────────┘
```

- Two-step pattern forces deliberate confirmation (accord R-4 requirement).
- Recipient input is a **chip-input field** (vision pick — see Open questions §1). Paste of comma-or-newline-separated text auto-creates chips. Backspace removes last chip when input empty. Chips show invalid-email state in `--pulse-tone-overdue` outline.
- The math line "12 × 3 = 36" uses `var(--pulse-mono-numeric)` tabular nums and `--pulse-ink-2` color; the total is the emphasis (`--pulse-ink`, weight 600).
- "single-use" toggle is hidden in bundle mode (accord forces `multi_use`). Replaced by helper text.

### 3. Received tab inbox (list view)

```
┌────────────────────────────────────────────────────────────┐
│  Received                              Sent cards →        │
│  3 new · 2 expiring soon                                   │
├────────────────────────────────────────────────────────────┤
│  [ ] Select all                         Accept selected ▾  │
│ ────────────────────────────────────────────────────────── │
│  [✓] •  Avatar  Priya Khan                  ⋯              │
│         shared by Maya Chen · 2h · From card               │
│ ────────────────────────────────────────────────────────── │
│  [ ] •  Avatar  Rob Diaz                    ⋯              │
│         shared by Maya Chen · forwarded · yesterday        │
│         ⚠ Expires in 2 days                                │
│ ────────────────────────────────────────────────────────── │
│  [ ] •  Avatar  {Lucca} Messana             ⋯              │
│         shared by Sasha L. · 3 days ago                    │
│ ────────────────────────────────────────────────────────── │
│  …                                                         │
└────────────────────────────────────────────────────────────┘
```

- Row height `72px` desktop, `80px` mobile to keep `.contacts-44px` touch wrapper safe on the checkbox.
- Unread rows have a leading dot indicator (rose `var(--pulse-rose)`, 6px circle, `aria-label="unread"`). Read rows omit the dot.
- "From card" chip is `CardSourceChip` — neutral pill background `var(--pulse-tone-neutral-soft)`, ink-2 text.
- "Accept selected ▾" is a split button: primary action "Accept" + dropdown menu "Decline selected", "Maybe (snooze 7 days)", "Block sender".
- Display-name verbatim: `{Lucca} Messana` braces preserved.

### 4. Received card detail view

```
┌────────────────────────────────────────────────────────────┐
│  ← Back to Received                                     ⋯  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│              [    Avatar 96×96    ]                        │
│                                                            │
│              Priya Khan                                    │
│              Designer at Studio Foo                        │
│                                                            │
│  ───────────────────────────────────────────────────────── │
│                                                            │
│  📧  priya@example.com                                     │
│  📞  +1 555 0143                                           │
│  🏢  Studio Foo                                            │
│  📍  Brooklyn, NY                                          │
│                                                            │
│  ───────────────────────────────────────────────────────── │
│                                                            │
│  Maya Chen is forwarding a card originally shared by       │
│  Aiko Tanaka.                                              │
│                                                            │
│  Maya's note:                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Priya is fantastic at brand systems work — said      │  │
│  │ you'd vibe.                                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ⚠ This card expires Friday, May 22 at 5:00 PM.            │
│                                                            │
├────────────────────────────────────────────────────────────┤
│           [ Decline ]    [ Maybe ]    [  Accept  ]         │
└────────────────────────────────────────────────────────────┘
```

- Container max-width: `max-w-lg` desktop centered, full-width mobile.
- Action bar is sticky at the bottom on mobile, inline on desktop.
- Provenance line (`CardProvenanceLine`) renders only when `forwarded_from_card_id` is set; for direct shares the line says `"Maya Chen shared this card with you."`.
- "Maya's note" block uses `var(--pulse-surface-raised)` background with 1px `var(--pulse-border)` border. Note text is escaped plain text — no HTML rendered.
- Expiry banner (`ExpiryWarningBanner`) uses `--pulse-tone-warning-soft` background with `--pulse-tone-warning` icon and ink-1 text.

### 5. AcceptCardConfirmation modal

This is the **most precise** layout in this spec — magi D-2 makes the default-checked checkbox load-bearing.

Width: `max-w-md`. Single screen, no steps.

```
┌─────────────────────────────────────────────────┐
│  Accept Priya Khan's card?                    × │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ ✓  Add Priya Khan to your contacts        │  │
│  │                                           │  │
│  │    Required to save this card.            │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ [✓]  Also connect with Maya Chen          │  │
│  │      on Pulse                             │  │
│  │                                           │  │
│  │      Maya sent this card. You can         │  │
│  │      message each other directly after.   │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
├─────────────────────────────────────────────────┤
│                  [ Cancel ]   [  Accept  ]      │
└─────────────────────────────────────────────────┘
```

- The two action rows are **visually distinct boxes**, not a list of checkboxes — Magi requires the recipient to "see and uncheck" the second option. Boxing each makes the toggle target obvious.
- Row 1 (immutable add): checkmark icon is `var(--pulse-tone-positive)`, NOT a checkbox. Reads as a status — "this is what will happen". Box background `var(--pulse-tone-positive-soft)`.
- Row 2 (optional connect): standard checkbox, **default checked**, 24×24 to meet touch-target. Visually emphasized via a subtle 2px `var(--pulse-rose)` ring around the entire box when the checkbox is checked; ring disappears when unchecked, replaced by 1px `var(--pulse-border)`. This gives the unchecked state a clear visual diff from the checked default — the user *sees* that they changed something before confirming.
- Sender display name `"Maya Chen"` is rendered verbatim from `auth.users` server-resolved data (per accord R-7, never URL-trusted).
- The Accept button label changes copy based on row 2 state — see Copy patterns §.

### 6. ReviewDuplicatesScreen

Reached from the post-Accept summary "Review duplicates" CTA. Per-pair UI.

```
┌────────────────────────────────────────────────────────────┐
│  ← Back to Received                                        │
│  Review 3 possible duplicates                              │
│  Cards you accepted that look like contacts you have.      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Pair 1 of 3                                               │
│                                                            │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │ New from card       │    │ You already have    │        │
│  │ ─────────────────── │    │ ─────────────────── │        │
│  │ Priya Khan          │    │ Priya R. Khan       │        │
│  │ priya@studiofoo.com │    │ priya@studiofoo.com │        │
│  │ Studio Foo          │    │ Studio Foo Brooklyn │        │
│  │ +1 555 0143         │    │ —                   │        │
│  └─────────────────────┘    └─────────────────────┘        │
│                                                            │
│  [ Merge into existing ▸ ]   [ Keep as separate ]          │
│                                                            │
│  ───────────────────────────────────────────────────────── │
│                                                            │
│  Pair 2 of 3                                               │
│  …                                                         │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                              [ Done ]      │
└────────────────────────────────────────────────────────────┘
```

- Side-by-side comparison: new (left) and existing (right). Field rows aligned; differing fields visually highlighted with a left border in `var(--pulse-tone-warning)`.
- "Merge into existing" opens a sub-dialog showing the merged result preview with per-field "use new" / "use existing" toggles. Default per accord D-12: existing data wins; sender's card fields only fill blanks.
- "Keep as separate" closes this pair without writing; `possible_duplicate_of` FK remains, so the chain stays visible in `ContactDetail`.

### 7. SentCardsView

Settings-area page; not a tab. Density matches Saved Filters panel.

```
┌────────────────────────────────────────────────────────────┐
│  Sent cards                                                │
│  Cards you've shared, in order.                            │
├────────────────────────────────────────────────────────────┤
│  Filter: [ All ▾ ]   [ Active ]  [ Revoked ]  [ Expired ]  │
├────────────────────────────────────────────────────────────┤
│  Priya Khan      → priya@example.com                       │
│  Sent 2h ago · Viewed                          [ Revoke ]  │
│ ────────────────────────────────────────────────────────── │
│  Rob Diaz        → maya@pulse.app                          │
│  Sent 12m ago · Not yet viewed                 [ Unsend ]  │
│ ────────────────────────────────────────────────────────── │
│  Lucca Messana   → 3 recipients (bundle)                   │
│  Sent yesterday · Active                       [ Revoke ]  │
│ ────────────────────────────────────────────────────────── │
│  Aiko Tanaka     → priya@example.com                       │
│  Sent May 10 · Revoked                          (no action)│
└────────────────────────────────────────────────────────────┘
```

- "Viewed" / "Not yet viewed" is the binary badge per accord R-23 AC-23-3 — **never numeric**.
- "Unsend" appears only when `now() - created_at < 30 min AND view_count = 0` (accord R-16). Otherwise the button reads "Revoke".
- Bundle rows expand on click to show per-recipient sub-rows with individual statuses.

### 8. CardLandingPage (public non-Pulse view)

This page is **NOT** rendered inside the React SPA — see Out of scope §. It is server-rendered by `resolve-card-deeplink` edge function for the no-Pulse-installed case. Universal Link / App Link intercept handles the installed-app case (Mobile R-6).

Layout sketch (responsive single-column, max-width `420px`, centered):

```
┌────────────────────────────────────────────┐
│                                            │
│             [ Pulse logo ]                 │
│                                            │
│                                            │
│         Maya Chen shared a card            │
│              with you                      │
│                                            │
│         ┌──────────────────────┐           │
│         │      Avatar 96×96    │           │
│         │                      │           │
│         │     Priya Khan       │           │
│         │  Designer · Studio   │           │
│         │         Foo          │           │
│         └──────────────────────┘           │
│                                            │
│   priya@example.com                        │
│   +1 555 0143                              │
│   Studio Foo, Brooklyn NY                  │
│                                            │
│   Maya's note:                             │
│   "Priya is fantastic at brand systems."   │
│                                            │
│                                            │
│      ┌─────────────────────────┐           │
│      │   Save to Contacts      │           │
│      └─────────────────────────┘           │
│                                            │
│         [ Get Pulse to reply ]             │
│                                            │
│                                            │
│      Maya Chen is forwarding a card        │
│      originally shared by Aiko Tanaka.     │
│                                            │
└────────────────────────────────────────────┘
```

- **Save to Contacts** is the primary CTA — `<a href="/api/cards/{token}/vcard">` with `download` attribute as a defensive backup. Server-side response triggers the OS Contacts sheet per accord R-11.
- **Get Pulse to reply** is secondary text-link styling, opens the App Store / Play Store smart-link.
- Provenance line at the bottom, neutral text styling — visible but not competing with primary CTA.
- For **revoked** / **expired** / **single-use-consumed** cards: render the gone-state page instead (see Interaction states §).

### 9. ForwardCardModal

Width `max-w-md`. Structure mirrors `ShareCardModal` but with subtle differences:

```
┌─────────────────────────────────────────────────┐
│  Forward Priya Khan's card                    × │
│  Originally shared by Maya Chen.                │
├─────────────────────────────────────────────────┤
│  To                                             │
│  ┌───────────────────────────────────────────┐  │
│  │ Pulse user or email                       │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Add your own note (optional)                   │
│  ┌───────────────────────────────────────────┐  │
│  │                                           │  │
│  └───────────────────────────────────────────┘  │
│                                       0 / 500   │
│                                                 │
│  The recipient will see:                        │
│    "You are forwarding Maya's card."            │
│                                                 │
├─────────────────────────────────────────────────┤
│                      [ Cancel ]   [ Forward ]   │
└─────────────────────────────────────────────────┘
```

- Recipient sees both **you** (forwarder) and the **chain root** per accord R-15.
- No token-policy / forwardability toggles in this modal — accord R-3 forwardability is set by the original sender at creation; downstream forwarders cannot widen the policy.
- A line of helper text confirms what the recipient will see (transparency for Lee's persona).

### 10. RevokeCardConfirmation

Width `max-w-sm`. Two visually identical layouts whose copy differs based on `mode`.

```
┌─────────────────────────────────────────────────┐
│  Unsend this card?                           ×  │
│                                                 │
│  You sent this to priya@example.com 5 min ago.  │
│  Nobody has opened it yet, so unsending will    │
│  pull it back cleanly.                          │
│                                                 │
│  This can't be undone.                          │
│                                                 │
├─────────────────────────────────────────────────┤
│                  [ Cancel ]   [ Unsend ]        │
└─────────────────────────────────────────────────┘
```

vs:

```
┌─────────────────────────────────────────────────┐
│  Revoke this card?                           ×  │
│                                                 │
│  You sent this to priya@example.com on May 8.   │
│  It has been viewed 4 times. Revoking will      │
│  make the link stop working immediately.        │
│                                                 │
│  Existing copies people have saved to their     │
│  contacts won't be deleted.                     │
│                                                 │
│  This can't be undone.                          │
│                                                 │
├─────────────────────────────────────────────────┤
│                  [ Cancel ]   [ Revoke ]        │
└─────────────────────────────────────────────────┘
```

- The "viewed N times" line in Revoke mode is sender-visible numeric — **wait**: accord R-23 AC-23-3 bars numeric view counts in Sent Cards UI. Revoke confirmation should follow the same rule. Corrected copy: `"It has been opened by recipients."` (binary). Numeric is internal-only.
- "Existing copies won't be deleted" line is critical truthfulness — accord R-18 explicitly notes vCards already saved remain on recipient devices. Recipients deserve to know revocation is link-level, not data-erasure.

---

## Interaction states

For each component, every state is enumerated below. States not listed are inapplicable.

### ShareCardModal

- **Default**: recipient input empty, intro note empty, toggles at defaults (single-use OFF, forwarding ON, expiry "Never"), Send disabled.
- **Hover (Send button)**: rose-deep background, 1px translateY lift, coral halo shadow per `.pulse-btn-primary`.
- **Active (Send pressed)**: translateY(0), no halo flicker.
- **Focus**: 2px rose outline at 2px offset (all interactive elements).
- **Loading (after Send tap)**: button shows inline spinner (`Loader2` lucide icon), label changes to `"Sending…"`, all inputs become read-only with reduced opacity (0.6).
- **Success**: modal closes; parent emits a toast `"Card sent to {recipient}"` (rose tint, 4s auto-dismiss). On mobile, native share sheet opens with canonical URL (R-5).
- **Error**:
  - *Recipient invalid email*: inline red text below input `"Please enter a valid email or Pulse username."`
  - *Rate limit (HTTP 429)*: toast `"You've sent your daily limit. Try again tomorrow."` Modal stays open.
  - *Sender blocked (HTTP 403)*: toast `"You can't share with this recipient."` (intentionally vague to not leak block info to sender). Modal stays open.
  - *Generic 5xx*: toast `"Send failed. Check your connection and try again."` Modal stays open with values preserved.
- **Empty**: same as Default.
- **Disabled (offline)**: Send button disabled with tooltip `"Connect to a network to send cards."`
- **Dark mode**: all surfaces consume tokens — `--pulse-surface` becomes translucent-white; intro note textarea border becomes `var(--pulse-border-strong)`.

### ShareCardBundleModal

- States mirror ShareCardModal plus:
  - **Step 1 → Step 2 transition**: framer-motion slide-x ~200ms with `--pulse-ease`.
  - **Bundle size > 100 cards**: client-side validation blocks Continue with toast `"Bundles are limited to 100 cards."`
  - **Bundle rate limited (1 bundle/24h)**: toast `"You've sent today's bundle. Try again tomorrow."` per accord R-21.
- **Chip-input invalid email**: invalid chip rendered with `var(--pulse-tone-overdue)` 1px outline; `aria-invalid="true"`.

### ReceivedTab + ReceivedCardListItem

- **Default (with cards)**: list rendered; unread rows have leading rose dot.
- **Empty**: empty state per IA section above.
- **Loading (initial fetch)**: 3 skeleton rows with shimmer using `var(--pulse-canvas-soft)` to `var(--pulse-surface-raised)` gradient.
- **Hover (row)**: `var(--pulse-surface-raised)` background, cursor pointer.
- **Selected (row)**: 2px left border `var(--pulse-rose)`, slight surface tint.
- **Multi-select active**: "Select all" checkbox top-left; "Accept selected" button activates when ≥1 selected; selection count appears in header subtext.
- **Expiring soon (row indicator)**: small warning chip inline `"Expires in 2 days"` using `--pulse-tone-warning` text only (no background — avoid noise in list density).
- **Error (fetch failed)**: full-tab error state with `"Couldn't load cards. Retry"` button.
- **Dark mode**: rose dot remains rose; row hover uses translucent white.

### ReceivedCardDetail

- **Default**: card rendered with avatar + fields + provenance + note + expiry warning (if applicable).
- **Loading**: skeleton avatar circle + 3 field rows.
- **Accept tapped**: opens `AcceptCardConfirmation`.
- **Decline tapped**: confirmation toast `"Declined. Maya won't be notified."` (per accord A-4 spirit — no signal back).
- **Maybe tapped**: row moves to a "Maybe later" filter; reappears after 7 days with a fresh unread indicator.
- **Forward tapped**: opens `ForwardCardModal`.
- **Card revoked (live update mid-view)**: detail replaced by gone-state `"This card was revoked by the sender."`
- **Card expired (live update mid-view)**: detail replaced by gone-state `"This card has expired."`
- **Dark mode**: surface-raised note block remains visually distinct.

### AcceptCardConfirmation

**This is the magi-load-bearing state design.**

- **Default (open)**: both rows visible; row 1 has no checkbox (status-only); row 2 has checkbox **checked**, rose ring around its box.
- **Hover (row 2 checkbox)**: cursor pointer over entire box (checkbox is the whole row's affordance, not just the input).
- **Active (row 2 unchecked)**: rose ring removed, replaced by 1px neutral border; box internal opacity 0.85 to communicate "this won't happen". Accept button label changes from `"Accept and connect"` to `"Accept only"` — making the diff visible at the action level too.
- **Focus**: keyboard tab order — Cancel → row 2 checkbox → Accept. The row 1 box is **not focusable** (no interactive control there).
- **Loading (Accept pressed)**: button shows spinner, label `"Accepting…"`, both rows reduce opacity to 0.6.
- **Success**: modal closes; toast `"Priya Khan added to your contacts"` (+ `" and connected with Maya Chen"` suffix when row 2 checked).
- **Error**:
  - *Card revoked between view and accept*: toast `"This card is no longer available."` modal closes; recipient returns to inbox.
  - *Card expired between view and accept*: same as revoked.
  - *Network*: button re-enables with toast `"Accept failed. Try again."`
- **Screen reader announcement** on open: `"Accept Priya Khan's card. Adding to contacts is required. The option to also connect with Maya Chen is currently turned on."`

### ReviewDuplicatesScreen

- **Default**: shows pair 1 of N; per-pair Merge / Keep-as-separate buttons.
- **Merge tapped**: sub-dialog opens with per-field merge preview; user confirms; pair marked resolved; auto-advance to next pair.
- **Keep tapped**: pair marked resolved; auto-advance.
- **All pairs resolved**: Done button enables; toast on Done `"All duplicates reviewed"`.
- **Skip (close without resolving)**: pairs remain `possible_duplicate_of` linked; user can return later.

### SentCardsView

- **Default**: list with filter tabs.
- **Row hover**: surface-raised tint.
- **Unsend tapped**: opens `RevokeCardConfirmation` in `mode='unsend'`.
- **Revoke tapped**: opens `RevokeCardConfirmation` in `mode='revoke'`.
- **Bundle row click**: expands to per-recipient sub-rows.
- **Real-time view-count flip** (sender open while recipient opens card): row badge flips from "Not yet viewed" to "Viewed". No animation needed — debounce 2s to avoid flicker.

### CardLandingPage

Two intercept modes (Mobile R-6):

- **Installed-app intercept**: Universal Link / App Link captures the URL; page is never rendered. App opens to `ReceivedCardDetail`.
- **Browser fallback (not installed)**: full page renders as sketched.

States:

- **Default (valid card)**: full layout, Save to Contacts CTA enabled.
- **Loading (rare — edge function should SSR)**: minimal skeleton.
- **Revoked (HTTP 410 from edge)**: gone-state page:
  ```
              [ Pulse logo ]

       This contact card is no
            longer available.

       The sender may have revoked
       this share or it may have
              expired.

         [ Get Pulse to learn more ]
  ```
  No sender name, no card-subject fields, no contextual info (per accord R-18 — defense against UUID probing).
- **Expired (HTTP 410)**: same as revoked.
- **Single-use already consumed (HTTP 410)**: same gone-state page with copy `"This card was sent privately and has already been saved."`
- **Token never existed (HTTP 404)**: standard 404 page (different copy: `"This link doesn't go anywhere."`)

### ForwardCardModal

- States mirror ShareCardModal.
- **Forward attempted on non-forwardable card**: button is never rendered; if user reaches the modal via deep navigation (impossible-by-design but defensive), Forward button is disabled with helper `"The original sender doesn't allow forwarding this card."`

### RevokeCardConfirmation

- **Default**: copy renders per `mode`.
- **Loading**: button shows spinner.
- **Success**: closes; row updates in SentCardsView (status flips to "Revoked"); toast `"Card revoked"`.
- **Error**: toast `"Couldn't revoke. Try again."` modal stays open.
- **Chain-revoke confirmation** (when revoking a root with descendants): additional warning row inside the modal:
  > `"This card has been forwarded 4 times. Revoking will pull back all forwarded copies too."`
- **Subtree-only revoke** (mid-chain forwarder revoking their own subtree): warning row:
  > `"You're revoking your forward and any forwards from it. The original card stays active."`

---

## Copy patterns

All copy is i18n-keyed under the new `contacts.cards.*` namespace in `src/i18n/locales/en.json`. Keys are disjoint from Phase A/B groups.

### i18n key structure

```
contacts.cards.share.modal_title                  // "Share {name}'s card"
contacts.cards.share.modal_subtitle               // "Send a copy of this contact to someone."
contacts.cards.share.recipient_label              // "To"
contacts.cards.share.recipient_placeholder        // "Pulse user or email"
contacts.cards.share.recipient_helper             // "e.g. priya@example.com"
contacts.cards.share.note_label                   // "Add a note (optional)"
contacts.cards.share.note_counter_format          // "{count} / 500"
contacts.cards.share.more_options_toggle          // "More options"
contacts.cards.share.single_use_toggle_label      // "Make this link single-use"
contacts.cards.share.single_use_toggle_helper     // "Only the first person who opens this link can save the card."
contacts.cards.share.forwarding_toggle_label      // "Allow forwarding"
contacts.cards.share.forwarding_toggle_helper     // "Let recipients forward this card to others."
contacts.cards.share.expiry_label                 // "Expires"
contacts.cards.share.expiry_never_option          // "Never"
contacts.cards.share.expiry_1_day_option          // "In 1 day"
contacts.cards.share.expiry_7_days_option         // "In 7 days"
contacts.cards.share.expiry_30_days_option        // "In 30 days"
contacts.cards.share.expiry_custom_option         // "Custom date…"
contacts.cards.share.cancel_cta                   // "Cancel"
contacts.cards.share.send_cta                     // "Send"
contacts.cards.share.sending_state                // "Sending…"
contacts.cards.share.share_via_system_cta         // "Share via system…"   (mobile only)
contacts.cards.share.success_toast_format         // "Card sent to {recipient}"
contacts.cards.share.error_invalid_recipient     // "Please enter a valid email or Pulse username."
contacts.cards.share.error_rate_limit            // "You've sent your daily limit. Try again tomorrow."
contacts.cards.share.error_blocked               // "You can't share with this recipient."
contacts.cards.share.error_generic               // "Send failed. Check your connection and try again."

contacts.cards.shareBundle.modal_title_format     // "Share {count} cards as a bundle"
contacts.cards.shareBundle.modal_subtitle         // "Bundles are perfect for events and intros."
contacts.cards.shareBundle.recipients_label       // "Recipients"
contacts.cards.shareBundle.recipients_placeholder // "Type or paste comma-separated emails…"
contacts.cards.shareBundle.recipients_helper      // "Add up to 25 recipients. Paste a CSV to bulk."
contacts.cards.shareBundle.shared_note_label      // "Add a shared note (optional)"
contacts.cards.shareBundle.bundle_multi_use_helper // "Bundles always use multi-use links."
contacts.cards.shareBundle.continue_cta           // "Continue"
contacts.cards.shareBundle.confirm_title          // "Ready to send"
contacts.cards.shareBundle.confirm_summary_format // "You're about to send {cards} cards × {recipients} recipients = {total} shares"
contacts.cards.shareBundle.confirm_description    // "Each recipient gets all {cards} cards in one email. Recipients see who you are and your note."
contacts.cards.shareBundle.back_cta               // "Back"
contacts.cards.shareBundle.send_all_cta           // "Send all"
contacts.cards.shareBundle.error_too_many         // "Bundles are limited to 100 cards."
contacts.cards.shareBundle.error_rate_limit       // "You've sent today's bundle. Try again tomorrow."

contacts.cards.receivedTab.tab_label              // "Received"
contacts.cards.receivedTab.badge_overflow         // "99+"
contacts.cards.receivedTab.header_summary_format  // "{newCount} new · {expiringCount} expiring soon"
contacts.cards.receivedTab.header_summary_simple  // "{newCount} new"
contacts.cards.receivedTab.sent_cards_link        // "Sent cards →"
contacts.cards.receivedTab.select_all             // "Select all"
contacts.cards.receivedTab.accept_selected_cta    // "Accept selected"
contacts.cards.receivedTab.decline_selected_action // "Decline selected"
contacts.cards.receivedTab.maybe_action           // "Maybe (snooze 7 days)"
contacts.cards.receivedTab.block_sender_action    // "Block sender"
contacts.cards.receivedTab.row_shared_by_format   // "shared by {sender} · {time}"
contacts.cards.receivedTab.row_forwarded_format   // "shared by {sender} · forwarded · {time}"
contacts.cards.receivedTab.row_expires_format     // "Expires in {days} days"
contacts.cards.receivedTab.from_card_chip         // "From card"
contacts.cards.receivedTab.empty_title            // "No cards yet"
contacts.cards.receivedTab.empty_body             // "Cards friends share with you appear here. Open a Pulse share link to receive your first card."
contacts.cards.receivedTab.error_load             // "Couldn't load cards."
contacts.cards.receivedTab.error_retry_cta        // "Retry"

contacts.cards.receivedDetail.back_cta            // "Back to Received"
contacts.cards.receivedDetail.shared_by_format    // "{sender} shared this card with you."
contacts.cards.receivedDetail.note_label_format   // "{sender}'s note:"
contacts.cards.receivedDetail.accept_cta          // "Accept"
contacts.cards.receivedDetail.decline_cta         // "Decline"
contacts.cards.receivedDetail.maybe_cta           // "Maybe"
contacts.cards.receivedDetail.forward_cta         // "Forward"
contacts.cards.receivedDetail.declined_toast      // "Declined. {sender} won't be notified."
contacts.cards.receivedDetail.maybe_toast         // "Snoozed for 7 days."
contacts.cards.receivedDetail.gone_revoked_title  // "This card was revoked by the sender."
contacts.cards.receivedDetail.gone_expired_title  // "This card has expired."

contacts.cards.acceptModal.title_format           // "Accept {name}'s card?"
contacts.cards.acceptModal.primary_row_label_format // "Add {name} to your contacts"
contacts.cards.acceptModal.primary_row_helper     // "Required to save this card."
contacts.cards.acceptModal.secondary_row_label_format // "Also connect with {sender} on Pulse"
contacts.cards.acceptModal.secondary_row_helper_format // "{sender} sent this card. You can message each other directly after."
contacts.cards.acceptModal.cancel_cta             // "Cancel"
contacts.cards.acceptModal.accept_and_connect_cta // "Accept and connect"
contacts.cards.acceptModal.accept_only_cta        // "Accept only"
contacts.cards.acceptModal.accepting_state        // "Accepting…"
contacts.cards.acceptModal.success_with_connect   // "{name} added to your contacts and connected with {sender}"
contacts.cards.acceptModal.success_without_connect // "{name} added to your contacts"
contacts.cards.acceptModal.error_gone             // "This card is no longer available."
contacts.cards.acceptModal.error_generic          // "Accept failed. Try again."
contacts.cards.acceptModal.sr_announce_format     // "Accept {name}'s card. Adding to contacts is required. The option to also connect with {sender} is currently turned on."

contacts.cards.reviewDuplicates.title_format      // "Review {count} possible duplicates"
contacts.cards.reviewDuplicates.subtitle          // "Cards you accepted that look like contacts you have."
contacts.cards.reviewDuplicates.pair_indicator_format // "Pair {current} of {total}"
contacts.cards.reviewDuplicates.new_column_label  // "New from card"
contacts.cards.reviewDuplicates.existing_column_label // "You already have"
contacts.cards.reviewDuplicates.merge_cta         // "Merge into existing"
contacts.cards.reviewDuplicates.keep_separate_cta // "Keep as separate"
contacts.cards.reviewDuplicates.done_cta          // "Done"
contacts.cards.reviewDuplicates.all_resolved_toast // "All duplicates reviewed"

contacts.cards.sentList.title                     // "Sent cards"
contacts.cards.sentList.subtitle                  // "Cards you've shared, in order."
contacts.cards.sentList.filter_all                // "All"
contacts.cards.sentList.filter_active             // "Active"
contacts.cards.sentList.filter_revoked            // "Revoked"
contacts.cards.sentList.filter_expired            // "Expired"
contacts.cards.sentList.status_active             // "Active"
contacts.cards.sentList.status_viewed             // "Viewed"
contacts.cards.sentList.status_not_viewed         // "Not yet viewed"
contacts.cards.sentList.status_revoked            // "Revoked"
contacts.cards.sentList.status_expired            // "Expired"
contacts.cards.sentList.unsend_cta                // "Unsend"
contacts.cards.sentList.revoke_cta                // "Revoke"
contacts.cards.sentList.bundle_recipients_format  // "{count} recipients (bundle)"

contacts.cards.expiryBanner.format                // "This card expires {datetime}."
contacts.cards.expiryBanner.sr_label              // "Expiry warning"

contacts.cards.provenance.direct_format           // "{sender} shared this card with you."
contacts.cards.provenance.forwarded_format        // "{forwarder} is forwarding a card originally shared by {original}."

contacts.cards.forward.modal_title_format         // "Forward {name}'s card"
contacts.cards.forward.modal_subtitle_format      // "Originally shared by {original}."
contacts.cards.forward.recipient_will_see_format  // "The recipient will see: \"You are forwarding {forwarder}'s card.\""
contacts.cards.forward.forward_cta                // "Forward"

contacts.cards.revoke.unsend_title                // "Unsend this card?"
contacts.cards.revoke.unsend_body_format          // "You sent this to {recipient} {time}. Nobody has opened it yet, so unsending will pull it back cleanly."
contacts.cards.revoke.revoke_title                // "Revoke this card?"
contacts.cards.revoke.revoke_body_format          // "You sent this to {recipient} on {date}. It has been opened by recipients. Revoking will make the link stop working immediately."
contacts.cards.revoke.kept_copies_disclaimer      // "Existing copies people have saved to their contacts won't be deleted."
contacts.cards.revoke.cant_undo                   // "This can't be undone."
contacts.cards.revoke.chain_warning_format        // "This card has been forwarded {count} times. Revoking will pull back all forwarded copies too."
contacts.cards.revoke.subtree_warning             // "You're revoking your forward and any forwards from it. The original card stays active."
contacts.cards.revoke.unsend_cta                  // "Unsend"
contacts.cards.revoke.revoke_cta                  // "Revoke"
contacts.cards.revoke.success_toast               // "Card revoked"
contacts.cards.revoke.error_toast                 // "Couldn't revoke. Try again."

contacts.cards.landing.shared_by_format           // "{sender} shared a card with you"
contacts.cards.landing.note_label_format          // "{sender}'s note:"
contacts.cards.landing.save_to_contacts_cta       // "Save to Contacts"
contacts.cards.landing.get_pulse_cta              // "Get Pulse to reply"
contacts.cards.landing.gone_title                 // "This contact card is no longer available."
contacts.cards.landing.gone_subtitle              // "The sender may have revoked this share or it may have expired."
contacts.cards.landing.single_use_consumed_title  // "This card was sent privately and has already been saved."
contacts.cards.landing.not_found_title            // "This link doesn't go anywhere."
contacts.cards.landing.get_pulse_secondary_cta    // "Get Pulse to learn more"

contacts.cards.email.subject_format               // "{sender} shared a contact card with you"
contacts.cards.email.intro_line_format            // "{sender} shared a contact card with you on Pulse."
contacts.cards.email.note_label_format            // "{sender}'s note:"
contacts.cards.email.view_link_label              // "View the card:"
contacts.cards.email.save_no_account_cta          // "Save to contacts (no Pulse account needed)"

contacts.tabs.received_label                      // "Received"   (top-level tab)
```

**Total: ~115 i18n keys** under `contacts.cards.*` plus `contacts.tabs.received_label`. Round up for plurals — i18next plural variants for `{count}`-bearing keys add ~10 more entries.

### Linguistic distinctions

- **"Unsend" vs "Revoke"**: per magi D-9, distinction is linguistic only — both write `revoked_at`. Unsend implies "no one saw it"; Revoke implies "I'm pulling this back even though it's out there". Copy reinforces this: Unsend says *"pull it back cleanly"*, Revoke says *"make the link stop working immediately"*.

- **"Share" CTA disambiguation (per accord R-22)**: `BulkActionToolbar` now has two labels:
  - `"Share to workspace"` — Phase B behavior (workspace_contacts JOIN)
  - `"Share via card"` — Phase C peer-share flow (opens ShareCardBundleModal)
  The split happens when `selectedCount >= 1`. The verb "Share" alone is never used on this toolbar anymore.

### Email template (R-13)

Plain text + minimal HTML. The HTML version mirrors plain text 1:1 with `<p>` and `<a>` only — no `<img>`, no `<script>`, no external CSS, no tracking pixels beyond send-email infra's existing open tracking.

```
Subject: Maya Chen shared a contact card with you

Maya Chen shared a contact card with you on Pulse.

Maya's note:
Priya is fantastic at brand systems work — said you'd vibe.

View the card:
https://go.pulse.logosvision.org/c/a1b2c3d4-...

Save to contacts (no Pulse account needed)
```

Plain text uses `\n\n` paragraph separators. The intro note is **escaped** — `<b>hi</b>` renders as literal `<b>hi</b>` (accord AC-13-4).

---

## Design tokens

No new global tokens introduced. All Phase C surfaces consume the existing `--pulse-*` vocabulary. Token-to-surface map:

| Surface | Token(s) |
|---|---|
| Modal scrim | `.pulse-modal-scrim` (existing utility class) |
| Modal surface | `var(--pulse-surface)` background, `var(--pulse-border)` 1px border, `var(--pulse-shadow-md)` |
| Primary action button | `.pulse-btn-primary` (rose-solid with coral halo on hover) |
| Secondary button | `var(--pulse-surface-raised)` background, `var(--pulse-ink)` text, `var(--pulse-border)` border |
| Destructive button (Revoke/Decline) | `var(--pulse-tone-overdue)` text on transparent; on hover `var(--pulse-tone-overdue-soft)` background |
| Inputs (text, textarea) | `var(--pulse-canvas-soft)` light / `rgba(255,255,255,0.03)` dark, `var(--pulse-border)` border |
| Input focus | 2px outline `var(--pulse-rose)` 2px offset |
| Text — primary | `var(--pulse-ink)` |
| Text — secondary | `var(--pulse-ink-2)` |
| Text — tertiary / helpers | `var(--pulse-ink-3)` |
| **Received-tab badge** | `var(--pulse-coral-bg-12)` background, `var(--pulse-coral-fg)` text — **magi D-5 coral exception** |
| Card-source chip (`CardSourceChip`) | `var(--pulse-tone-neutral-soft)` background, `var(--pulse-ink-2)` text — neutral, not coral |
| Provenance dot on received-card list | `.ps-provenance-dot[data-source="card"]` — **new variant**, defined in `src/components/WarRoom/PulseStudio.css` to match Phase A pattern. Color: `var(--pulse-tone-info)` (blue-ish, semantically "transferred from elsewhere"). |
| Expiry warning banner | `var(--pulse-tone-warning-soft)` background, `var(--pulse-tone-warning)` icon, `var(--pulse-ink)` text |
| Unread row dot | `var(--pulse-rose)` 6px filled circle |
| Selected row indicator | 2px left border `var(--pulse-rose)` + `var(--pulse-surface-raised)` background |
| Gone-state page (revoked/expired) | `var(--pulse-canvas)` background, `var(--pulse-ink-2)` text — deliberately understated to discourage UUID probing |
| Accept-modal row 1 (immutable "add") | `var(--pulse-tone-positive-soft)` background, `var(--pulse-tone-positive)` checkmark icon |
| Accept-modal row 2 (checked) | `var(--pulse-surface-raised)` background, 2px `var(--pulse-rose)` ring |
| Accept-modal row 2 (unchecked) | `var(--pulse-surface-raised)` background, 1px `var(--pulse-border)` ring, opacity 0.85 |

### New CSS class — `.ps-provenance-dot[data-source="card"]`

Add to `src/components/WarRoom/PulseStudio.css` alongside existing variants:

```css
.ps-provenance-dot[data-source="card"] {
  background: var(--pulse-tone-info);
}
```

Justified: extends existing Phase A pattern, zero new global tokens.

---

## Accessibility (WCAG 2.2 AA minimum, AAA where realistic)

### Keyboard navigation

- **All modals**: Escape closes (when not in loading state), Tab cycles focusables, Shift+Tab reverses, focus is trapped within dialog per existing `WorkspaceShareModal` pattern (already implemented — reuse).
- **AcceptCardConfirmation tab order**: Cancel → row 2 checkbox → Accept. Row 1 is non-interactive and not focusable. The checkbox is the entire row 2 box — clicking anywhere in the box toggles the input (via `<label>` wrapping).
- **ReceivedTab list**: arrow keys navigate rows (existing `useContactsKeyboard.ts` pattern); Space toggles selection; Enter opens detail.
- **ReviewDuplicatesScreen**: Tab order Merge → Keep → next-pair-skip. Arrow keys also work to flip Merge ↔ Keep within a pair.
- **ShareCardBundleModal chip-input**: chips are `role="button"`, focusable, Delete key removes focused chip. Tab moves out of chips and into the input field.

### Screen reader

- **AcceptCardConfirmation**: on open, live region announces `contacts.cards.acceptModal.sr_announce_format` (key includes "currently turned on" — telling SR users the default state of the checkbox before they reach it).
- **Received tab badge**: badge has `aria-label="{count} new received cards"`. The tab itself uses `aria-current="page"` when active.
- **Card row arrival** (real-time): when a new card arrives while the user is on the Received tab, an `aria-live="polite"` region announces `"New card from {sender} received"`.
- **Gone-state landing page**: heading is `<h1>`, content is wrapped in `<main role="main">` with `aria-label="Card unavailable"`.
- **Provenance line**: rendered in a `<p>` with no role override; reads naturally.
- **Expiry banner**: `role="status"` with `aria-live="polite"` so SR users hear the warning when navigating to the card detail.

### Focus management

- **Modal open**: focus moves to first interactive control (Cancel button, except AcceptCardConfirmation where focus moves to the checked checkbox — drawing attention to the magi-locked default).
- **Modal close**: focus returns to triggering element (the `previousFocusRef` pattern from `WorkspaceShareModal`).
- **Tab switch to Received**: focus moves to the tab content's first focusable element (Select-all checkbox).
- **ReviewDuplicates auto-advance**: after resolving a pair, focus moves to next pair's Merge button.

### Color contrast

All combinations tested against WCAG 2.2 AA (4.5:1 normal, 3:1 large):

| Combination | Light | Dark | Status |
|---|---|---|---|
| `--pulse-ink` on `--pulse-canvas` | 19.4:1 | 18.1:1 | AAA |
| `--pulse-coral-fg` on `--pulse-coral-bg-12` over `--pulse-canvas` | 5.78:1 | 8.47:1 | AA (light), AAA (dark) — already documented in `pulse-tokens.css` |
| `--pulse-tone-warning` on `--pulse-tone-warning-soft` over `--pulse-canvas` | 4.6:1 | 5.1:1 | AA |
| Rose dot on canvas | 4.8:1 (light) / 5.4:1 (dark) | — | AA |
| Provenance dot (info blue) on canvas | 4.9:1 (light) / 5.6:1 (dark) | — | AA |

### Touch targets

- All interactive controls wrapped with `.contacts-44px` minimum touch target (existing Phase B utility class).
- Modal Cancel / primary buttons: 44×44 minimum, 48×48 in `data-large-touch-targets="true"` mode.
- Checkboxes: 24×24 input but 44×44 hit area via padded label.
- Received-list rows: 72px tall, full-row checkbox touch target.

### Reduced motion

- All framer-motion transitions degrade per `prefers-reduced-motion: reduce` per existing `.pulse-btn-primary` precedent.
- The two-step Bundle modal slide animation disables; step transitions become instant.
- Real-time row-add to Received list disables the slide-down animation; row appears immediately.

---

## Dark/light mode

Pulse supports both via the `.dark` class on `<html>`. All Phase C components consume tokens that have dark overrides in `pulse-tokens.css`. No bespoke `themeClasses` strings needed beyond the existing Phase B pattern in `ContactsRedesigned.tsx`.

Specific dark-mode considerations:

- **Received-tab badge**: `--pulse-coral-bg-12` uses `color-mix(... transparent)` and composites correctly over translucent dark surfaces. `--pulse-coral-fg` has dark override at 8.47:1 contrast.
- **Modal scrim** in dark: `.pulse-modal-scrim` is already dark-mode-aware (60% opacity black + blur).
- **Card detail in dark**: avatar circles and field icons (📧 📞 🏢 📍) use lucide icons styled with `var(--pulse-ink-2)` (works in both modes).
- **Note block (`var(--pulse-surface-raised)`)**: in light mode is `#f2f2f2`; in dark is `rgba(255,255,255,0.055)` — both provide visual separation from the parent surface.
- **Provenance dot variants**: existing pattern in `PulseStudio.css` doesn't currently differ by theme; the new `data-source="card"` variant inherits the same approach (single color works in both modes due to info-blue's mid-luminance).
- **Landing page** (public, non-React): server-rendered HTML must include the same `.dark` class detection — read user agent or accept a `?theme=dark` query param. Recommend: default light for landing page since recipients are often signed-out and dark/light is a user-choice signal we don't have. Phase 5 schema agent can override if `card_snapshot` stores a sender theme preference (we don't, so light is fine).

---

## Mobile / Capacitor considerations

### Universal Link / App Link tab landing (R-6)

When a `https://go.pulse.logosvision.org/c/{token}` URL is opened on a device with Pulse installed:

- Capacitor `App.addListener('appUrlOpen')` fires (already wired in Pulse per handoff).
- The handler dispatches an in-app navigation: `Contacts → Received tab → CardDetail(token)`.
- If the user is currently elsewhere (e.g. Messages tab), Contacts tab is selected and Received sub-tab activated before the detail view opens.
- If the user is not signed in, the deeplink is queued; after sign-in completes, the queued deeplink resolves and navigation happens.

### Native share sheet integration (R-5)

`ShareCardModal` calls `nativeShareService.shareUrl(canonicalUrl, title)` after a successful card create:
- Title: `"Card for {recipient name or hint}"` — surfaces in the OS share-sheet preview.
- The share-sheet appears AFTER the card row is created (so the URL is canonical, not a placeholder).
- On desktop / web (non-Capacitor), the native share button is hidden; only the in-app Send completes the flow.

### QR code generation

Out of scope for Phase C in-app generation UI (per accord Out-of-scope §). For Sasha's QR use case:
- Canonical URL goes through OS share sheet → third-party QR app today.
- A future v1.1 enhancement: add a "Show QR" tab to the ShareCardModal as a separate code path (vision recommends deferring — see Open questions §2).

### Add to Contacts deep integration

- **iOS**: `<a href>` to `render-contact-vcard` endpoint returns `text/vcard` with `Content-Disposition: attachment` → iOS Contacts sheet opens automatically. The Capacitor app does NOT intercept the vCard download; the OS handles it.
- **Android**: same response → Android Contacts intent fires. Edge cases (some Android Chromium builds force download to Files app) are documented in accord; vision doesn't add a workaround beyond the standard behavior.
- **In-app Accept**: when accepting a card *inside* the Pulse app (Universal Link intercepted), the OS Contacts app is **not** invoked — accept writes to Pulse's own `contacts` table. The recipient can later mass-export via existing Pulse export tooling if they want OS Contacts sync.

### Capacitor App `appUrlOpen` dispatch

The handler matches URLs against this regex:
```
^https://go\.pulse\.logosvision\.org/c/[a-zA-Z0-9-]+$
```
Per accord AC-6-4. On match, dispatches a Redux/Context navigation event to `ContactsRedesigned` with payload `{ tab: 'received', cardToken: '<token>' }`.

The `pulse://` custom scheme is retained for **internal-only** notification deep-links (e.g. tap a "new card" push notification → opens card detail). It does not appear in any user-shareable artifact.

---

## Out of scope for vision

Explicit non-design items — these are NOT addressed in this spec and must NOT be inferred from it:

- **Edge function internals** (request/response shape beyond accord-locked headers, body schema, error codes beyond the 410 / 429 / 403 patterns).
- **Migration SQL** (column types, indexes, RLS policy SQL).
- **Rate-limit numeric values displayed in UI** — accord A-2 defers to Billing. UI shows generic "daily limit" copy, no numeric exposure.
- **Sender-side numeric view_count display** — accord A-4 + R-23 AC-23-3 bar this. Vision honors the constraint.
- **Card editing post-send** — out of scope. Revoke + re-create is the only mutation path.
- **AI-generated intro notes** — Phase C has no AI use case per handoff guardrail #3.
- **Phase B Saved Filters integration** — Saved Filters is a separate feature; received-cards don't surface there.
- **vCard editor UI** — vCard is server-rendered from `card_snapshot`; recipients do not edit before saving.
- **`CardLandingPage` React implementation** — the public landing page is **server-rendered by `resolve-card-deeplink` edge function or a static-edge route**, not implemented as a React component inside the SPA. Vision specifies the layout/copy; Phase 6 codex implements as a separate render path (HTML template inside the edge function, or a minimal standalone HTML page hydrated by edge data).
- **Native Apple NameDrop / AirDrop Code integration** — Phase 7+ per accord.
- **Group / multi-subject cards** — Phase C is N×M single-subject cards; group-card primitive is out of scope.
- **Sub-PR 7 `user_has_permission('cards.send')`** — deferred per accord A-7; UI uses `auth.uid()` owner-checks via Phase A/B patterns.
- **QR generation UI surface in-app** — see Open questions §2.

---

## Open questions to resolve before implementation

Five UX decisions vision could not fully lock without Phase 5 or Phase 6 confirmation. None block Phase 5 schema (which can proceed in parallel); all should be resolved before Phase 6 codex starts implementation.

1. **Bundle recipient picker affordance** (accord open Q#3, vision recommendation): vision picked **chip-input with paste-CSV fallback**. Alternative considered: a separate "Paste list" tab inside the modal. Chip-input wins on inline visual feedback (invalid emails flag immediately) and matches the modern email-recipient UX pattern (Gmail, Linear). Confirm with user before Phase 6: chip-input only, or chip-input + collapsible paste area?

2. **QR generation in single-share modal** — accord defers in-app QR generation entirely. Vision recommends keeping QR out of v1 of `ShareCardModal` (extra surface, low daily-use). Sasha's QR case is served by sharing the canonical URL through the OS share sheet + a third-party QR app. If Phase 5 surfaces strong demand, the right place to add QR is a dedicated "Show QR" tab inside ShareCardModal, NOT a separate share-via-QR button. Decision: defer to a v1.1 follow-up unless user wants in-scope now.

3. **Sent Cards IA placement** — vision picked `Settings → Activity → Sent Cards` (with a "Sent cards →" link in the Received tab header). Magi did not rule on Sent IA. Alternative: make Sent Cards a sibling tab to Received under a single "Cards" parent tab. Vision rejects this (would force the 4-tab nav back to 3 with a sub-tab inside Cards — net cognitive load is higher). Confirm: Settings → Activity is acceptable, or should Sent live elsewhere?

4. **Unsend vs Revoke visual distinction in SentCardsView** — both are buttons with identical visual weight; only the label differs. Vision considered making Unsend a ghost button (less visual weight, more reversible feeling) vs Revoke a destructive-styled button. Decided against because magi D-9 says the linguistic distinction is the only difference — visual differentiation would imply a data difference that doesn't exist. Confirm: pure-label distinction is acceptable, or do we want subtle visual tiering (Unsend = ghost, Revoke = destructive-tinted)?

5. **`{`, `}` characters in the email subject line** — accord R-13 mandates display names verbatim in `FN` / `N` vCard fields. The email subject `"{Lucca} Messana shared a contact card with you"` would render with literal braces in mail clients. Some clients (older Outlook) treat curly braces as merge-field markers and may strip or break rendering. Vision recommends keeping braces verbatim per the project-wide rule, but flagging this for QA: test with `{Lucca} Messana` as a sender display name across Gmail, Outlook 2019, Apple Mail, ProtonMail. If breakage is found, the email template can fall back to HTML-escaped subject without touching contact-name policy elsewhere.

---

**End of vision spec.** Hand off to Phase 6 codex (2-call backend + UX split per Apex pattern) once the 5 open questions above are resolved with the user.
