# Pulse Contacts Overhaul — Session Handoff (2026-05-18)

> **For the next Claude session.** This document is self-contained — read it first, verify git state, then pick up from "Resume recipe" below. The previous session ran Phase A + Phase B end-to-end via Apex and got Phase C blocked at Phase 1 Discovery awaiting magi's verdict on 12 architectural decisions.

---

## 1. Quick status

| Phase | Goal | Status | Branch on origin |
|---|---|---|---|
| **A — "Stop the Bleeding"** | Selective OAuth import + Trim wizard + provenance schema + scope-loss/INVALID_GRANT surfaces + feature flag | ✅ Ship-ready, **PR not yet opened** | `feat/contacts-phase-a-clean` (6 commits, +1528/-64) |
| **B — "Fix the Past"** | Multi-select + bulk actions + workspace_contacts JOIN + saved_filters + provenance chip UI + soft archive + RFM/email-domain auto-detect | ✅ Ship-ready, **PR not yet opened** | `feat/contacts-bulk-org` (now at `ba87f85`, includes Phase B + Messages redesign + branch-safety lock from parallel session) |
| **C — "Bet the Future"** | Contact-card sharing protocol (Pulse↔Pulse + non-Pulse vCard + Received inbox + virality loops) | 🟡 Blocked at Phase 1 Discovery → Phase 3 Verdict (magi) | Not yet branched — **fresh branch needed off origin/main** |

CLAUDE.md now locks **default-serial session policy** as of commit `ba87f85`. No more parallel Claude sessions in `f:/pulse1/` unless a worktree is explicitly spawned.

---

## 2. Verify before doing anything

```bash
git fetch
git status --short                                  # must be empty (modulo test-results orphans)
git log -1 --oneline                                 # tip of whatever branch you land on
git branch -a | grep -E "(phase-a-clean|bulk-org)"  # confirm both branches exist on origin
```

If `git log -1` on `feat/contacts-bulk-org` doesn't show `ba87f85` or a descendant, **STOP** — something has diverged and you need to investigate with the user before proceeding.

---

## 3. What's on each branch

### `feat/contacts-phase-a-clean` (Phase A, 6 commits off `main`)

Clean Phase A diff against `main`: 15 files, +1528/-64 LOC. Cherry-picked from the original (now-polluted) `feat/contacts-selective-import-v2` to isolate Phase A from parallel-session work.

**Files:**
- 2 migrations: `20260523000001_rejected_import_labels.sql`, `20260523000002_contacts_provenance_columns.sql`
- Services: `src/services/googleContactsService.ts` (mod — `importSelectedLabels`, `WorkspaceNotBootstrappedError`), `src/services/authService.ts` (mod — `hasContactsScope`, scope-missing event), `src/services/toastFactory.ts` (new — UX-4 scope-loss toast)
- Components: `src/components/contacts/ContactsEmptyState.tsx` (new), `src/components/contacts/ConnectContactsModal.tsx` (new), `src/components/contacts/TrimWizard.tsx` (new), `src/components/contacts/ContactsShell.tsx` (mod — orchestrator wiring), `src/components/contacts/ContactsRedesigned.tsx` (mod — Sync button re-pointed), `src/components/Auth/ReconnectGoogleModal.tsx` (mod — INVALID_GRANT banner variant), `src/components/settings/integrations/GoogleServicesIntegration.tsx` (mod — Test Contacts button gated)
- `src/i18n/locales/en.json` (mod — added `contacts.*` namespace with 38 keys across `empty/connectModal/trimWizard/scopeLossToast/invalidGrantBanner/reconnectModal` groups)
- `src/App.tsx` + `src/contexts/AuthContext.tsx` (mods — feature flag guards on legacy `syncGoogleContacts` auto-fire)

**Feature flag:** `VITE_CONTACTS_PHASE_A_ENABLED` (default `false`). Flag-off behavior is byte-identical to today.

### `feat/contacts-bulk-org` (Phase B, currently at `ba87f85`)

This branch carries Phase B work + the parallel session's Messages redesign + the branch-safety scaffolding + the CLAUDE.md serial-session lock. The Phase B work specifically is 8 commits (see "git log --oneline" — look for `feat(contacts):` prefix on commits with co-authored trailer).

**Phase B-specific files:**
- 3 migrations: `20260524000001_phase_b_archive_column.sql`, `20260524000002_phase_b_workspace_contacts.sql`, `20260524000003_phase_b_saved_filters.sql`
- Services: `src/services/workspaceContactsService.ts` (new — safe-projection JOIN reader), `src/services/savedFiltersService.ts` (new — Zod-validated predicate CRUD + `applyFilterPredicate`), `src/services/dataService.ts` (mod — `archiveContacts`/`restoreContacts`/`bulkDeleteContacts`/`bulkUpdateContacts` + `getContacts({includeArchived, archivedOnly})`), `src/services/contactCircleService.ts` (mod — `autoDetectCircles` RFM 5-cohort + email-domain clustering with 10-provider blocklist + role-prefix blocklist)
- 5 new UX components: `BulkActionToolbar.tsx`, `SavedFiltersPanel.tsx`, `WorkspaceShareModal.tsx`, `ProvenanceChip.tsx`, `ArchivedToggle.tsx`
- `src/components/contacts/ContactsRedesigned.tsx` (mod — checkbox layer, sidebar widgets, state for filter + share modal, `affectsCircle` computation, `SmartListType`-complete fallback object)
- `src/components/contacts/ContactsList.tsx` (mod — Shift+Arrow keyboard range against loaded-index)
- `src/components/contacts/ContactDetail.tsx` (mod — ProvenanceChip in header + audit trail from `workspace_contacts.shared_at/shared_by`)
- `src/components/contacts/Contacts.css` (mod — toolbar slot + archived row tint + 44px wrappers)
- `src/components/WarRoom/PulseStudio.css` (mod — `.ps-provenance-dot[data-source=...]` color variants)
- `src/i18n/locales/en.json` (mod — added 5 new top-level Phase B groups: `bulkToolbar/savedFilters/workspaceShare/archived/provenance` — disjoint from Phase A's groups)

**Feature flag:** Phase B is NOT feature-flagged. Additive, safe-by-default.

### Ground-truth catches absorbed in Phase B (carry forward to Phase C)

- `contacts.user_id` is **TEXT, not UUID** — any new RLS comparing to `auth.uid()` must cast `auth.uid()::text`. Source: `20260119062007_remote_schema.sql:5496` and existing `contacts_owner_all` policy.
- Sensitive payload columns are `notes`, `case_notes`, `phone`, `address` — NOT `private_notes` as several upstream prompts assumed. Any new workspace-cross-user JOIN must hand-pick safe columns explicitly.

---

## 4. Phase C — what's done and what's queued

### Phase 1 Discovery findings (complete, conversation history preserved in `.claude/projects/f--pulse1/memory/` via reference_apex_pipeline_pulse_patterns.md)

Three Phase C Discovery agents returned with strong outputs:

**plea (5 personas + Adversarial Adam)**:
- Maya (1-to-1 share with intro note + 15-min unsend window)
- Ron (non-Pulse recipient via QR — landing page can't be auth-walled)
- Aiko (3-5 daily intros — wants 4th top-level tab with badge count, not subview)
- Lee (untrusted-sender skeptic — decouple Accept-card from auto-add-sender)
- Sasha (50-card conference bundles — bulk Accept/Decline + Maybe/snooze + duplicate detection)
- Adversarial Adam (forgery via deeplink — requires server-side sender JOIN, never URL-param trust)

**echo (current-flow walkthrough + Risk Gate baseline)**:
- Median valence **−0.43**, dark patterns **3**, WCAG 3.0 Bronze **~2.8/4**, silent failures **3**
- Task success on CURRENT flow: Derek 5% (fails entirely), Maya 55%, Aiko 60%, Lee 65%, non-Pulse recipient 70%
- **Key code discovery**: `src/services/nativeShareService.ts` + `@capacitor/share` already wired in Pulse — Phase C mobile share is NOT greenfield; plumbing exists, only contact-data assembly + vCard formatting layer missing
- **Active dark pattern**: `BulkActionToolbar`'s "Share" CTA currently resolves to workspace-pool sharing only (label-vs-behavior mismatch). When Phase C peer-share ships, that label needs resolution.

**researcher (prior art + protocol recommendations)**:
Cited Apple NameDrop + AirDrop Code, LinkedIn Connect via QR, Google Workspace directory sharing, Signal contact share, iOS 26.2 AirDrop Code extension (Dec 2025), vCard 4.0 RFC 6350 field-reliability matrix, Capacitor 8 App Links + Universal Links current best practice.

### 12 architectural decisions queued for magi Phase 3 Verdict

| # | Decision | Recommended resolution (from Phase 1) |
|---|---|---|
| **1** | **Deeplink format** | CONTRADICT: replace `pulse://card/{id}` with **`https://go.pulse.logosvision.org/c/{id}`** (Universal Links + App Links). Keep `pulse://` for internal routing only. |
| **2** | **Sender auto-promote** | CONTRADICT: opt-in via default-CHECKED checkbox at Accept time, not silent automatic (Lee's persona + Apple's 2025 AirDrop Code precedent). |
| **3** | **vCard delivery method** | CONTRADICT: server-side `Content-Disposition: attachment; filename="contact.vcf"` (NOT `<a href="data:text/vcard;...">` — blocked on Chrome iOS per Chromium issue 604533). |
| **4** | **vCard version** | DIVERGE: serve **3.0** default (Outlook + older Android compat); strip `PHOTO`/`IMPP`/`RELATED` fields; 4.0 only on explicit Accept header. |
| **5** | **Received inbox IA** | DIVERGE: 4th top-level tab (Aiko's demand, badge-count discoverable) **vs** subview of People (lower IA width). magi must pick. |
| **6** | **Card forwarding** | DIVERGE: brief silent. Recommend: new card row per forward + `forwarded_from_card_id` FK + original sender opts out per-card + landing page shows "Aiko is sharing Maya's contact" transparency. |
| **7** | **Anti-spam** | DIVERGE: brief silent. Recommend: 50-card/day rate limit (free tier), `card_send_blocks` table, silent `view_count` for abuse detection. |
| **8** | **Intro note delivery channel** | DIVERGE: include in Resend email body (Pulse already has `send-email` edge function, `pulse.logosvision.org` DKIM/SPF-verified). Plain text, minimal HTML. |
| **9** | **Unsend / revocation window** | OPEN: Maya needs 15-min unsend before recipient opens. Schema: `contact_cards.revoked_at`. Revoked cards return `410 Gone` not `404` (UUID probing defense per Adversarial Adam). |
| **10** | **Token policy** | OPEN: single-use (Priya's screenshot becomes invalid) vs multi-use (QR is public URL, no access control) vs **configurable per share**. |
| **11** | **Expiry semantics** | OPEN: hard cutoff vs grace period (Sasha's deferred "Maybe" cards vs midnight delete). Recommend grace period with 3-day warning banner. |
| **12** | **Duplicate detection on bulk Accept** | OPEN: Sasha accepts a card for someone already in her People — merge / link / skip? Reuse Phase B's `workspace_contacts` dedup pattern. |

### Schema sketch (from Phase 1 researcher)

```sql
contact_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id text NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- TEXT cast
  recipient_hint text,                  -- email or Pulse user_id; nullable
  card_snapshot jsonb NOT NULL,         -- contact fields at time of share
  forwarded_from_card_id uuid REFERENCES contact_cards(id) ON DELETE SET NULL,
  is_forwardable boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
)
-- Plus: card_send_blocks (sender_user_id, blocked_by_user_id, blocked_at)
-- Plus: edge function `create-contact-card` mirroring `send-email` auth pattern
```

---

## 5. Resume recipe for the next session

### Step 1 — Read this doc + project memory

```bash
cat docs/CONTACTS_OVERHAUL_HANDOFF_2026-05-18.md
# In your conversation, also recall:
# - C:\Users\Aegis{FM}\.claude\projects\f--pulse1\memory\project_pulse_contacts_overhaul_a_b.md
# - C:\Users\Aegis{FM}\.claude\projects\f--pulse1\memory\reference_apex_pipeline_pulse_patterns.md
```

### Step 2 — Verify git state

```bash
git fetch
git status --short                    # must be empty
git log -1 --oneline                  # confirm tip
git branch --show-current             # know where you are
```

If working tree dirty or HEAD diverged from `ba87f85` on `feat/contacts-bulk-org`, STOP and ask the user.

### Step 3 — Create fresh Phase C branch (per CLAUDE.md serial-session policy)

```bash
git fetch origin main
git checkout -b feat/contact-card-sharing origin/main
```

**Do NOT branch off `feat/contacts-bulk-org`.** That branch carries Phase B + Messages redesign + branch-safety scaffolding and would pollute Phase C's diff against `main`. The Phase 1 Discovery findings apply equally regardless of which branch Phase C lands on.

### Step 4 — Run Phase 3 magi verdict directly

Phase 1 Discovery is complete; Phase 2 riff was skipped per the established Phase B pattern. The next step is magi.

Magi needs:
- Full Phase 1 Discovery findings (in conversation history of previous session, or summarize from this doc's §4)
- The 12 architectural decisions table above with the recommended resolutions
- magi's job: render Logos/Pathos/Sophia tri-engine verdict on each of the 12 decisions

**Budget reality**: Phase A+B already consumed 27 Claude agents + 4 Codex CLI sessions. Phase C through Ship will add another ~12-15 Claude agents. Be transparent with the user about cumulative budget when checking in at the magi verdict checkpoint.

### Step 5 — Phase 4 onward

After magi verdict:
- Phase 4 accord (Lite spec)
- Phase 5a schema + vision (parallel)
- Phase 5b Risk Gate (skip per Phase B pattern unless user wants it)
- Phase 6 codex 2-call implementation split
- Ship: guardian + launch

Use Phase A and Phase B prompts as templates. Patterns proven in those phases:
- Codex sandbox can't write to `.git/index.lock` — tell codex NOT to commit; orchestrator commits per logical unit
- Two-call codex split (backend + UX) gives cleaner implementations than one mega-call
- vision discretion: typically 0/4 sub-spawns when scope is magi-locked
- guardian + launch as Ship pattern saves real coordination effort

---

## 6. Hard guardrails that apply to Phase C

1. Display names verbatim — never strip `{`, `}`, `#` from contact names
2. `--pulse-*` tokens only (no new global tokens; reuse Phase A palette + `.ps-provenance-dot[data-source=...]` variants)
3. AI calls server-side only via `ai-router` edge function — Phase C has no AI use case
4. Workspace RLS via `user_has_workspace_access` for any workspace-scoped tables
5. `user_has_permission()` resolver for permission gating — but Sub-PR 7 is deferred; use `auth.uid()` checks for owner-only paths and leave `TODO(phase-7)` comments
6. `feat/contacts-polish @ 6d7aeb6` files HANDS-OFF
7. Service-role key format: `sb_secret_*` (41 chars)
8. Legacy mirror tables (`entomate_*`, `logos_*`) — do not touch
9. `contacts.user_id` is **TEXT** — cast `auth.uid()::text` in any RLS
10. Sensitive payload columns are `notes`/`case_notes`/`phone`/`address` — hand-pick safe columns in any cross-user projection

---

## 7. PR open instructions (for whenever Phase A + B are ready to ship)

### Phase A

URL: `https://github.com/FatherSonOne/Pulse-1/compare/main...feat/contacts-phase-a-clean?expand=1`

Title: `feat(contacts): selective OAuth import + Trim wizard (Phase A)`

Body: drafted by guardian in the previous session — recoverable from conversation history. If lost, regenerate with another guardian run.

Labels: `feature`, `contacts`, `feature-flag`, `migration`, `phase-a`

Release plan: launch agent drafted v25.2.0 changelog + 5-stage rollout — also in previous session's history.

### Phase B

URL: `https://github.com/FatherSonOne/Pulse-1/compare/main...feat/contacts-bulk-org?expand=1`

Title: `feat(contacts): bulk actions + workspace elevation + saved filters (Phase B)`

**Coordination note for Phase B PR**: the branch now contains MORE than just Phase B (Messages redesign + branch-safety + serial-session lock). The PR diff will be larger than the +2407/-70 LOC Phase B portion alone. Reviewer should expect a multi-feature PR or you may want to coordinate with the user about whether to:
- (a) Open as-is (the other commits are also worth shipping — Messages PR 1/2/3a/3b chain and branch-safety scaffolding)
- (b) Cherry-pick just Phase B's 8 commits to a fresh branch like `feat/contacts-bulk-org-clean` off `main` (same pattern that worked for Phase A)

Recommend (b) if the user prefers clean reviews; recommend (a) if the Messages + branch-safety work is also overdue for merge.

### Phase A merge order

Merge Phase A first → 24h stability window → merge Phase B (or Phase B clean variant). Then Phase C develops + ships on top.

---

## 8. Known unknowns

- **SPIKE-1 (workspace_contacts JOIN p95 ≤ 2× baseline at N=4000)** — NOT run yet. Schema agent authored the script in the migration's commit body. Run on staging before Phase B GA.
- **SPIKE-2 (selection reducer at N=4000)** — NOT run yet.
- **SPIKE-3 (email-domain FP ≤ 15%)** — NOT run yet. Live data needed.
- **SPIKE-4 (Capacitor Android header-replace usability)** — NOT run yet.
- **Phase A real-user feedback** — none yet. Phase B's scope was set assuming Phase A would land first and surface signal; if A doesn't merge for weeks, B's assumptions may drift.
- **Phase C IA decision (4th tab vs subview)** — Aiko strongly prefers tab; magi hasn't ruled.
- **Auto-promote opt-in vs auto** — Lee directly conflicts with brief's virality vector 2; magi must rule.

---

## 9. Files to NOT touch

- `src/utils/contactInitial.ts` (polish commit `6d7aeb6`)
- `src/components/contacts/TodayEmptyState.tsx` (polish commit `6d7aeb6`)
- Any file under `entomate_*` or `logos_*` (legacy mirror tables)

---

## 10. Contact + context

This handoff was produced by the previous Claude session at the user's request after they closed the parallel-session window and locked CLAUDE.md to default-serial policy. The user has full context on the work; this doc is for the *next Claude* to read.

**When resuming**: read this doc, verify git state, create the fresh Phase C branch, then check in with the user about whether to launch magi immediately or pause to discuss the 12 decisions first. The user has consistently engaged at decision checkpoints — preserve that pattern.

Good luck.
