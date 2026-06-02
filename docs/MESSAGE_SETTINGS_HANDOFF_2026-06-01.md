# Message Settings — Implementation Handoff — 2026-06-01

> Continue-work handoff. Pairs with the Messages forensic triage and the
> sequenced repair plan:
> - Triage: `docs/triage/messages-triage-2026-06-01.md`
> - Repair plan: `docs/triage/messages-repair-plan-2026-06-01.md`
>
> This doc is a **plan to execute later**, not work already done. It captures two
> new requests from the user plus the ground-truth needed to act on them safely
> (CLAUDE.md Rule A — no destructive change without approved pros/cons; Rule B —
> verify wiring before declaring anything dead).

---

## 0. Context — why this exists

Across this session the Messages composer/tools surface was overhauled (see §1).
With the tools menu removed and the new composer shipped, the user surfaced two
follow-ups while reviewing the running app:

1. **The voice mic has no way to pick an audio input/output device.** The newly
   wired voice button records from the system-default mic only.
2. **The Messages "Feature Settings" panel is now redundant** — several of its
   toggles gated code that has since been retired. The user wants it **repurposed
   into a "Message Settings" panel** containing **(a) audio input/output device
   selection** and **(b) message settings**.

Intended outcome: turn the stale feature-flag panel into a useful, real
Message-Settings surface, and give voice a device picker.

---

## 1. Current state (shipped this session, on `main`)

| Commit | What |
|---|---|
| `3d828b3` | W1 — eliminated the latent `ReferenceError` in the legacy-thread branch |
| `00780d9` | W2 — `getUnreadCount` returns real count, not always 0 |
| `e6309d1` | W3 — legacy `TypingIndicator` prop + empty `onTyping` fixed |
| `ebde60b` | Tools menu removed from the UX behind `MESSAGES_TOOLS_ENABLED` (reversible; scaffolding dormant) |
| `c033cd5` | Gated the **PulseComposer** tools entry point (missed in the first pass) |
| `c5e1bbe` | PulseComposer brought to parity: **voice** (`VoiceTextButton`), **drafts** (`pulse_msg_draft_v1:<threadId>`), **typing** |
| `d3d8e3c` | **PulseComposer is now THE Pulse-DM composer** (unconditional); legacy `MessageInput` retired on that path (component preserved) |
| `b75d619` | Removed the dead "Messages Tools Redesign (Beta)" flag toggles from Features Labs |

Net for this handoff: the **old MessageInput composer is retired on the Pulse-DM
path**, which is what makes several feature flags vestigial (see §3).

---

## 2. The target — repurpose the "Feature Settings" panel → "Message Settings"

### 2.1 What the panel actually is (verified)
- The "FEATURE SETTINGS" panel in the user's screenshot is
  **`src/components/Messages/FeatureSettingsPanel.tsx`** (title at `:358`, "Advanced
  Mode" at `:442`). It renders `FEATURE_CATEGORIES` / `FEATURE_NAMES` from
  `src/contexts/FeatureContext.tsx` via `toggleFeature`, with search + per-category
  bulk enable/disable.
- It is opened from a **button in the Messages header** (`Messages.tsx:3630`,
  title "Feature Settings") which sets `showFeatureSettings`, and is lazily
  rendered in **`src/components/Messages/MessagesEndModals.tsx:356`**.
- **Triage correction (Rule B):** the triage report (§7 Orphans) lists
  `FeatureSettingsPanel.tsx` as orphaned ("only `Phase3Examples.tsx:21`"). That is
  **wrong** — it is imported and rendered by `MessagesEndModals.tsx` and reachable
  from the header button. Do **not** treat it as dead in the W10 orphan triage.
- A second renderer of the same `FEATURE_CATEGORIES` exists at
  `src/components/settings/FeaturesLabsSettings.tsx` (global Settings →
  `features_labs`). Any change to the *data* affects both surfaces; this handoff
  concerns the **Messages** panel specifically.

### 2.2 Desired end state
Rename/repurpose `FeatureSettingsPanel` into a **Message Settings** panel with two
sections:
1. **Audio** — input (microphone) and output (speaker) device pickers (§4).
2. **Message settings** — the genuinely message-scoped toggles, plus new ones (§5).

Keep the same open mechanism (header button + `MessagesEndModals` render); this is
a content/IA change, not a new mounting path. Preserve the panel's existing
search / theming / a11y shell — reskin the contents, don't rebuild the chrome.

---

## 3. Feature-flag wiring audit (DO THIS BEFORE REMOVING ANYTHING — Rule A/B)

The user's read ("not wired to anything") is **partly** true. Verified consumers
of each flag currently in the panel:

| Flag | Still wired to… | Verdict for Message Settings |
|---|---|---|
| `voiceInput` | `MessageInput.tsx:106` (legacy composer, **retired on Pulse-DM**) + dead `Phase3Examples` | **Vestigial on Pulse-DM.** Voice now always renders in PulseComposer. Repurpose as a real "enable voice input" toggle that PulseComposer honors, or drop. |
| `aiComposer` | `MessageInput.tsx:104` (retired) + dead `Phase3Examples` | **Vestigial.** No PulseComposer consumer. |
| `toneAnalysis` | `MessageInput.tsx:105` (retired) | **Vestigial.** |
| `draftManager` | **no consumer found anywhere** | **Dead.** PulseComposer drafts are unconditional now. |
| `moodBadges` | `MessageEnhancements/MessageMoodBadge.tsx:13` | **LIVE — keep.** Real message-stream feature. |
| `smartReplies` | `Relay/VoxSmartReplies.tsx:38` | **LIVE but Relay, not Messages.** Don't surface in *Message* settings; leave it for Relay. |
| `scheduledMessages` | `MessageEnhancements/MessageScheduling.tsx:88` | **LIVE — keep** (scheduling is a real message feature). |

**Rule-A requirement:** removing any flag key touches `FeatureFlags` (interface),
`DEFAULT_FEATURES`, `FEATURE_NAMES` (a *total* `Record`, so a key can't be dropped
without updating the type), `FEATURE_CATEGORIES`, and every `isFeatureEnabled('x')`
call site. Present a per-flag pros/cons and get sign-off before deleting. Safer
first step: just **re-curate which flags the Message Settings panel surfaces**
(keep `moodBadges` + `scheduledMessages`, drop the vestigial ones from the panel)
without deleting the flag definitions — additive/reversible.

---

## 4. Audio input/output device selection (new — the mic gap)

### 4.1 Ground truth
- Voice runs through **`src/hooks/useVoiceToText.ts`**, dual-provider:
  `'web-speech' | 'openai'` (`:19`). `VoiceTextButton` (`src/components/shared/`)
  wraps it; PulseComposer renders that button (commit `c5e1bbe`).
- **There is no device handling anywhere** — no `getUserMedia`,
  `enumerateDevices`, or `deviceId` in `useVoiceToText` or `VoiceTextButton`.
  Input uses the OS default mic; output (voice-message playback) uses the OS
  default speaker.
- **Hard limitation:** the **Web Speech API cannot target a specific input
  device** — it always uses the system default. Honoring a chosen mic requires the
  capture to go through `getUserMedia({ audio: { deviceId } })` (i.e. the OpenAI/
  MediaRecorder path, or a new getUserMedia-based capture), not Web Speech. Call
  this out in the UI (e.g. disable the input picker, or auto-switch provider, when
  Web Speech is the active provider).

### 4.2 Approach
1. **Enumerate devices:** `navigator.mediaDevices.enumerateDevices()` → filter
   `kind === 'audioinput'` and `'audiooutput'`. Labels require a prior
   `getUserMedia` permission grant — gate enumeration behind a "grant mic access"
   action. Listen to `devicechange` to refresh.
2. **Persist the selection:** localStorage (e.g. `pulse_audio_input_device` /
   `pulse_audio_output_device`) — mirror the simple-localStorage pattern already
   used for drafts and Translate Settings.
3. **Apply input device:** thread the chosen `deviceId` into the capture. For the
   OpenAI/getUserMedia path, pass `audio: { deviceId: { exact } }`. For Web Speech,
   surface the limitation (no override possible).
4. **Apply output device:** for voice-message playback `<audio>` elements, use
   `HTMLMediaElement.setSinkId(deviceId)` (Chromium; feature-detect — Safari/FF
   lack it; degrade gracefully). Identify the message-audio playback component(s)
   and thread the selected output device in.
5. **UI:** two `<select>`s (Input / Output) in the Message Settings "Audio"
   section, with a live "test mic" level meter optional. Reuse existing token
   styles; no coral (coral is AI-only per CLAUDE.md).

### 4.3 Open questions (ask the user)
- Output-device selection only matters where the app plays audio in-app (voice
  messages). Confirm scope: input-only, or input + output?
- Web Speech vs OpenAI: do we force the OpenAI/getUserMedia path when a non-default
  input device is chosen (better device control, needs the OpenAI key), or accept
  that device selection only applies to the OpenAI provider?

---

## 5. "Message settings" — candidate contents (confirm with user)

The user said "message settings" without enumerating. Propose, then confirm:
- **Keep (live flags):** Mood Badges (`moodBadges`), Scheduled Messages
  (`scheduledMessages`).
- **New, genuinely message-scoped candidates** (each needs its own wiring — these
  are *proposals*, not existing toggles): Enter-to-send vs Shift+Enter, read
  receipts on/off, typing-indicator on/off, notification sound/preview, default
  composer behavior, link-preview on/off, message text size.
- **Drop from this panel (vestigial):** AI Composer, Tone Analysis, Draft Manager,
  Voice Input (per §3) — pending the Rule-A sign-off.
> Do not silently invent persisted settings that aren't wired — each new toggle
> must either gate a real behavior or be explicitly marked "coming soon".

---

## 6. Files in scope
- `src/components/Messages/FeatureSettingsPanel.tsx` — the panel to repurpose.
- `src/components/Messages/MessagesEndModals.tsx` (~356) — render site (lazy).
- `src/components/Messages.tsx` (~3630) — the header button (relabel "Feature
  Settings" → "Message Settings"; check the icon/title).
- `src/contexts/FeatureContext.tsx` — `FEATURE_CATEGORIES`/`FEATURE_NAMES`/
  `FeatureFlags` (flag curation; Rule-A before deleting keys).
- `src/hooks/useVoiceToText.ts`, `src/components/shared/VoiceTextButton.tsx` — audio
  input device threading.
- Voice-message **playback** component(s) — for output `setSinkId` (locate: grep
  for the audio element that plays `voxer`/voice-message blobs).
- i18n: `messages.featureSettings.*` keys → add `messages.messageSettings.*` (keep
  old keys until migration done).

---

## 7. Verification strategy
- **Type-check (gate):** `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`,
  gate on **no NEW errors** vs the ~1,234 pre-existing (Messages.tsx baseline is
  **16** after this session's work; `FeatureContext.tsx`/`FeaturesLabsSettings.tsx`/
  `PulseComposer.tsx` are currently **0**).
- **Manual (required — headless can't drive mic/devices):** open Message Settings
  from the header; confirm the relabel; grant mic access; verify input/output
  device lists populate and persist across reload; record a voice clip using a
  non-default mic; play a voice message through a non-default speaker (Chromium).
- **a11y:** the panel shell already has search/keyboard handling — preserve it.

---

## 8. Suggested sequencing
1. **Relabel + re-curate** (additive, reversible): rename the panel/header to
   "Message Settings", drop the vestigial flags from what it surfaces (keep
   `moodBadges` + `scheduledMessages`), no flag-key deletion yet. Commit.
2. **Audio section — input picker** (enumerate + persist + thread deviceId into the
   getUserMedia/OpenAI path; note Web Speech limitation). Commit.
3. **Audio section — output picker** (`setSinkId` on voice-message playback,
   feature-detected). Commit.
4. **Message settings toggles** — wire the confirmed new ones one at a time; mark
   anything not-yet-real as "coming soon". Commit each.
5. **(Optional, Rule-A) flag cleanup** — delete the truly-dead keys (`draftManager`
   first; it has zero consumers) with per-flag pros/cons. Commit.

Each step leaves a committable, type-checked, eyeball-verified state.

---

## 9. Cross-references
- Triage: `docs/triage/messages-triage-2026-06-01.md`
- Repair plan (waves W1–W10): `docs/triage/messages-repair-plan-2026-06-01.md`
  (this work is adjacent to W8 stub cleanup / W10 orphan triage, but is its own
  user-requested track).
- Memory: `project_pulse_messages_tools_removed` (tools removal + composer default).
