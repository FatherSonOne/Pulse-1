/impeccable execute remaining Relay section work — Phase 3 polish

Context: The Relay section has been through two prior /impeccable critiques
(Run #1: 24/40, Run #2: 30/40, Run #3: 33/40). The current state is upper-mid
band. Seven priority items remain. Run them in the order below — the cheap
wins land first so the section's score lifts visibly before the half-day
items kick in.

# Already resolved (do NOT re-litigate)

These are documented as fixed; verify briefly with grep but don't re-flag:
- "Vox" terminology in user-visible Settings strings (all 6 strings replaced)
- Default Vox Mode dropdown selling 7 retired modes (rebuilt against the 6 peers;
  now writes settings.relayDefaultView, consumed by Relay.tsx initial-view useEffect)
- AIProvenanceChip coverage (~95% of AI content; Notes summary, Notes transcript,
  Direct/Channel/Broadcast transcripts all chipped)
- Side-stripe in VoiceRooms (both call sites, killed)
- Filter chip vocabulary in Triage + Notes (now rounded-md + shell-matching colors)
- PulseRadio LayeredVisualizer + concentric hero rings + decorative waves (deleted)
- ClassicMode walkie-talkie empty state + Math.random() waveform (replaced)
- VoxBubble.tsx (deleted; was unused)
- 3 identical-card-grids (Audio Quality / Video Quality / Channel Type → segmented)
- Opaque grey panel stack in all 5 Settings tabs (→ translucent)
- Status-color violations: orange selection in PulseRadio, green LIVE pill in
  Video preview, purple gradient in Video preview, amber notice in Storage
- Coral-as-decoration: Notes note-list avatars, Notes tag pills, Settings General
  8 toggle-row coral tiles, Storage usage gradient, "More Settings" info card
- Canvas color drift: dark:bg-black / dark:bg-zinc-950 / bg-[#0a0a0b] all
  unified to bg-[#080808] across the 6-peer surfaces + shared toolbars

The current architecture: 6 peers (Triage / Direct / Channel / Broadcast /
Notes / Live), 4 Settings tabs (Audio / Video / Storage / General),
single Relay shell with mono-uppercase nav and settings cog. Coral Cockpit
design system; coral reserved for state and signal; mono labels via
JetBrains Mono; tinted neutrals over true grey.

# Tasks to execute, in order

## 1. /impeccable layout — Notes record area to bottom-pinned (~5 min)

File: src/components/Relay/VoxNotesMode.tsx
Currently the VoxRecordArea renders near the top of the Notes panel (~L911),
between the toolbar and the split list/detail view. Direct and Channel
bottom-pin theirs as a compose footer. Notes should match that pattern
because the action (capture a thought) is the same shape.

Move the VoxRecordArea + RecordingPreview block from above the split-view
container to below it (right before the closing wrapper, alongside the
audio element). Match the spacing pattern Direct/Channel use: border-t,
panel padding. The pendingRecording RecordingPreview should stack above
the record area when active (same as the existing inline behavior).

Cross-cutting concern D ("Mic affordance inconsistency") collapses from
3 patterns to 2 after this. Broadcast's hero recorder stays as-is because
creating-a-broadcast is the act, not the side-channel.

## 2. /impeccable distill — Link-to-Item modal (~15 min)

File: src/components/Relay/VoxNotesMode.tsx, around L1244-1288
The "Link to Item" modal renders 5 identical-shape rows (Email / Meeting /
Task / Contact / Note), each with: coral icon tile + label + description.
Items differ only in noun. Replace with a simpler list:
- Drop the coral icon tile entirely; inline neutral Lucide icon
- Drop the description line (it's tautological — "Link to email: Connect
  this note to an email")
- Single-line row: leading icon + label, hover state, ChevronRight on the
  right
- Modal width can shrink to max-w-sm

Use the existing LINK_TYPE_ICONS dict — already wired. Modal chrome (header,
backdrop, Cancel button) stays.

## 3. /impeccable shape — TeamVoxMode panel consolidation (~2 hours)

File: src/components/Relay/TeamVoxMode.tsx
Five hand-rolled modals/popovers live in this file with overlapping z,
backdrop, close logic, and shape:
- showAddMember (member picker)
- showNotificationSettings (notification preference panel)
- showChannelSettings (channel edit panel)
- showMentionPicker (@ picker)
- showWorkspaceDropdown (workspace switcher)

Extract a shared RelayPanelShell component (or reuse VoiceRooms' PreJoinSheet
pattern — fixed scrim, slide-up sheet, mono header, X close, optional footer).
Migrate all 5 to consume it. The internals of each panel stay; only the
chrome unifies. The shape command first — don't write code until the API
shape is checked.

If extracting one shared shell is too much scope in one pass, just unify the
chrome inline (same z-index, same scrim, same border treatment, same Esc
handling). The end goal is: looking at any of the 5 panels, the only thing
that changes is the content; the chrome is identical.

## 4. /impeccable polish — ClassicMode.css → token migration (~half day)

File: src/components/Relay/ClassicMode.css
Currently a 1000+ LOC bespoke namespace for sidebar, contact list, thread
bubbles, message actions, reactions, reply context bar. The decoration is
already gone (walkie-talkie + random waveform), but the visual language is
still parallel to the Coral Cockpit design system.

Migrate to Tailwind tokens consuming src/styles/pulse-tokens.css:
- .classic-sidebar / .classic-main grid layout → flex with border-r and
  shell-matching border colors
- .classic-contact rows → match the row pattern Triage uses (hover bg, 9x9
  avatar, mono timestamp, primary/secondary text colors)
- .classic-message bubbles → use the same coral fill for "me" rows that
  VoxBubble used to (bg-rose-50 dark:bg-[rgba(244,63,94,0.08)], rounded-2xl
  rounded-br-md), neutral for "received" (bg-white dark:bg-white/[0.03],
  rounded-bl-md)
- .classic-waveform-bars stays (deterministic peaks already there)
- .classic-reaction-picker / .classic-message-actions-bar → token-driven
  hover states matching Triage row actions
- Drop any --cv-* CSS variables that duplicate --pulse-* tokens

After this, ClassicMode.css should be measurably smaller (target: <300 LOC)
and the file should render as part of the Coral Cockpit, not as a separate
visual language.

## 5. /impeccable polish — PulseRadio.css → token migration (~half day)

File: src/components/Relay/PulseRadio.css
Same story as ClassicMode.css. Channel rail, broadcast cards, modal chrome,
settings panels — all currently in a bespoke .pulse-radio-* namespace.

Migrate to tokens. Specific targets:
- .pulse-radio-sidebar / .pulse-radio-channel → use the rail vocabulary
  VoiceRooms uses (RailSection + RailRow primitives, mono uppercase section
  label, fill-tint active state, no side-stripe)
- .pulse-radio-broadcast cards → flat panel with hairline border, no nested
  card chrome, neutral hover
- .pulse-radio-record-section → same VoxRecordArea wrapper Direct/Channel
  use; remove bespoke section padding
- .pulse-radio-modal → migrate to pulse-modal-scrim + bg-[#080808] surface
  to match VoiceRooms' modals
- Drop any --pr-* CSS variables that duplicate --pulse-* tokens

Target: <200 LOC after migration. The active-tab indicator vocabulary should
collapse to the shell pattern (cross-cutting F's last remaining outlier).

## 6. /impeccable extract — <RelayVoiceMessage> (~1 day)

Currently 4 divergent inline voice-message implementations:
- Direct (ClassicMode.tsx, around the activeThreadRecordings.map)
- Channel (TeamVoxMode.tsx)
- Broadcast (PulseRadio.tsx)
- Notes (VoxNotesMode.tsx detail panel)

Differ in chrome: avatar size, timestamp format, waveform style, playback
speed pill placement, AI summary chip placement, action menu trigger,
surface-specific extras (audience label for Triage rows, message-type for
Channel, episode chip for Broadcast, reply context indicator for Direct).

Design a shared <RelayVoiceMessage> component with:
- Required: id, audioUrl, duration, timestamp, sender ('me' | 'other'),
  senderName, isPlaying, onPlay/onPause
- Optional: transcript, analysis, status, starred, bookmarked, reactions
- Surface-slot props for extras: leadingAudienceLabel (Triage),
  messageTypePill (Channel), episodeChip (Broadcast), replyToContext (Direct),
  audienceMeta (Channel)
- Standardize chrome: 36px play button (rose-500 for needs-reply, neutral
  otherwise), deterministic peak-driven waveform via passed-in audioBuffer
  or seed, 10x10 senderName-initial avatar with neutral background,
  AIProvenanceChip wherever there's machine content, MoreVertical action
  trigger to a shared VoxMessageMenu

Implementation steps:
1. /impeccable shape — design the prop API first; show 3 example usages
   (Triage row, Direct bubble, Notes list item) before writing the component
2. Build <RelayVoiceMessage> in src/components/Relay/RelayVoiceMessage.tsx
3. Migrate Direct's bubble first (smallest surface)
4. Migrate Channel
5. Migrate Broadcast
6. Migrate Notes
7. Run /impeccable polish on each after migration to verify nothing
   regressed

This is the long-tail consistency fix. Don't skip the shape step.

## 7. /impeccable polish — Dormant-surface canvas migration (~10 min)

Files: src/components/Relay/VoiceCommandsHub.tsx, SilentMode.tsx,
VoxPlaylists.tsx
These three each still carry `dark:bg-zinc-950` on their root container.
Per index.ts comments they're dormant or non-surfaced in the 6-peer shell
— but they're still exported and reachable via deep links. Replace
`dark:bg-zinc-950` with `dark:bg-[#080808]` in all three for canvas
consistency with the rest of the section.

If any of them turn out to be fully dead code (not imported anywhere
outside index.ts), flag that for a separate deletion pass — don't
delete in this run.

# What to return

After each command finishes, write a one-paragraph summary noting:
- What was deleted (LOC count if non-trivial)
- What was migrated (file:line refs)
- Anything that didn't apply or had to be skipped (with reason)
- Any new findings surfaced during the work that weren't in the prior critique

At the end of the full run, re-score the section against the 10-heuristic
table. Predicted lift from 33/40:
- Consistency: 4 → 4 (already maxed for the surfaces being touched; legacy
  CSS migration solidifies it)
- Aesthetic: 4 → 4 (legacy CSS removed = clear-line-of-sight to genuine 4)
- All others: unchanged
- Plus a possible +1 on Recognition if the unified panel chrome makes
  TeamVoxMode's 5 surfaces more legibly distinct

Expected total: 34-36/40, depending on how much of items 4-6 lands cleanly.

# Constraints

- Don't introduce backwards-compat shims for renamed components or props.
  If <RelayVoiceMessage> doesn't match the old inline shape exactly, change
  the call sites; don't proxy.
- Don't add new emoji to any user-visible string.
- Don't add new gradient backgrounds anywhere — flat coral or flat neutral
  only.
- Don't add side-stripe borders (DESIGN.md absolute ban; one was already
  killed in VoiceRooms).
- Each command should leave the section in a working state. If a migration
  partially lands, leave a clear TODO comment with the remaining scope and
  the surface it affects.
- Update auto-memory only if you learn something durable about the project
  (e.g., that ClassicMode.css uses --cv-* prefixed vars; useful for future
  passes). Don't memorialize what's in this prompt.

# Verification at the end

Run these greps and report counts:
- `backdrop-filter:` in src/components/Relay/ → should match the modal-only
  list (preview-overlay, modal-overlay, pulse-modal-scrim, AI-panel scrims).
  Any new non-modal usage = regression.
- `border-l-[2-9]` in src/components/Relay/ — side-stripe scan. Should be
  zero matches on colored borders (only border-l-2 border-transparent for
  layout spacing is acceptable).
- `bg-orange-` / `bg-green-` / `bg-amber-` / `bg-purple-` in
  src/components/Relay/ — status-color decoration scan. Each match should
  carry an explanatory comment for its semantic meaning, or be removed.
- `Math.random()` in src/components/Relay/ — should not appear in render
  paths.
- `linear-gradient` in src/components/Relay/ (excluding modal scrims and
  the recording-preview gradient ring) — coral-as-decoration scan. Each
  should be justified or removed.
- `bg-gray-[0-9]00` in src/components/Relay/ — Settings opaque grey leak
  detector. Should be zero matches inside files I migrated; remaining
  matches indicate untouched shared components.

If any verification scan surfaces unexpected new matches, fix and re-scan
before declaring done.