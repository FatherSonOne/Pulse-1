# DSAR Runbook — Data-Subject Rights, Residency & Records of Processing

**Owner:** Quantum Ecosystems LLC
**Product:** Pulse (hosted on `logosvision.org`)
**Last reviewed:** 2026-05-27 (#111)
**Status:** Operator-facing. Factual. Update when subprocessors, regions, or the erasure cascade change.

---

## 1. Purpose & scope

This runbook governs how Pulse handles **data-subject access requests (DSARs)**
and related data-subject rights under:

- **GDPR** (EU/EEA users) — Arts. 15 (access), 16 (rectification), 17 (erasure),
  20 (portability), 21 (objection).
- **CCPA / CPRA** (California residents) — right to know, right to delete,
  right to correct, right to opt out of sale/sharing (Pulse does **not** sell or
  share personal information for cross-context behavioral advertising).

Legal entity / data controller: **Quantum Ecosystems LLC**.
Application and marketing surfaces are served from `logosvision.org` (current
hosting; a future migration to `qntmecos.com` is planned but not scheduled).

This document covers data Pulse holds in its own systems. Personal data a user
contributed to **other** workspaces/organizations is controlled by those orgs;
see §7.

For acceptable-use enforcement, abuse/spam handling, and content/DMCA takedowns,
see the companion **[Abuse & Takedown Runbook](./ABUSE_TAKEDOWN_RUNBOOK.md)**.

---

## 2. Data residency

| Attribute | Value |
| --- | --- |
| Primary database region | **AWS `us-east-1` (US East)** |
| Database engine | Supabase, PostgreSQL **17** |
| Project ref | `ucaeuszgoihoyrvhewxk` (`pulse-chat`) |
| Storage / Auth | Same Supabase project (us-east-1) |

**Operator decision (v1):** No EU-region migration. Pulse stays US-hosted.
Cross-border transfers of EU-user personal data are governed by the **EU
Standard Contractual Clauses (SCCs)** with our subprocessors (see §5).

**Surface the real region in the UI.** `Settings → Compliance` reads the
`VITE_SUPABASE_REGION` build-time env var (with a generic fallback when unset).
To show the true region:

```
# .env / Vercel project env
VITE_SUPABASE_REGION="US East (us-east-1)"
```

Set this in **Vercel** (production + preview) and in local `.env`. The Compliance
card then displays "US East (us-east-1)" as the Primary region instead of the
"Multi-region (managed by Supabase)" fallback.

---

## 3. Records of Processing Activities (ROPA)

| Data category | Purpose | Legal basis (GDPR) | Retention |
| --- | --- | --- | --- |
| Profile / identity (name, handle, avatar, email, phone) | Account, auth, display | Contract | Life of account; deleted on erasure |
| Messages & voice (DMs, voxes, transcripts) | Core messaging product | Contract | Life of account or per user retention policy; deleted on erasure |
| Contacts / CRM (records, circles, goals, relationships, deals) | Relationship management features | Contract / legitimate interest | Life of account; deleted on erasure |
| Calendar & tasks | Scheduling, task tracking | Contract | Life of account; deleted on erasure |
| Decisions (decisions, votes, decision tasks) | Decision-tracking feature | Contract | Life of account; deleted on erasure |
| Email (campaigns, segments, synced messages) | Email features / Gmail integration | Consent (OAuth) / Contract | Life of account; deleted on erasure |
| Location / Maps (geocoding, directions, places) | Maps & location features | Legitimate interest / Consent | Transient + cached; deleted on erasure |
| Billing (subscriptions, invoices, usage) | Payment processing, financial records | Contract / legal obligation | **Retained** per financial-regulation requirements (see §7) |
| AI-derived summaries (thread/conversation summaries, insights) | AI assistance features | Legitimate interest / Consent | Life of account; deleted on erasure |
| Audit & security logs (`admin_activity_logs`, sessions, activity) | Security, compliance, fraud prevention | Legal obligation / legitimate interest | **Retained** for security & compliance (see §7) |

---

## 4. AI processing note (acceptance #4)

Pulse's AI features **process user content**. This is material for the ROPA and
for any DPA/subprocessor disclosure.

- **What runs:** Thread/conversation summaries, compose/drafting, autopilot,
  RAG/retrieval, and meeting summaries.
- **Where it runs:** **Server-side only**, via Supabase edge functions —
  `ai-router` (which routes text/reasoning tasks to **Google Gemini** and
  **Anthropic Claude**), the `gemini-*` functions (`gemini-proxy`,
  `gemini-audio`, `gemini-video`, `gemini-image`, `gemini-speech`,
  `gemini-embed`, `gemini-live-token`), and the OpenAI token/transcription
  functions (`openai-realtime-token`, `whisper-proxy`).
- **What content is sent:** Message text, email bodies, meeting transcripts,
  and contact/CRM data are transmitted to the AI subprocessor for inference at
  request time.
- **No client-side API keys.** All AI calls are brokered server-side; the React
  client never holds a Gemini/OpenAI key.
- **Intended contractual posture:** Content is sent **transiently for
  inference** and is **not used to train** the providers' models. This reflects
  the intended posture — **operator must confirm** this against each provider's
  current DPA / API data-use terms (Google Gemini API, Anthropic Claude API,
  OpenAI API) and update this section if the terms differ.

AI subprocessors evidenced in `supabase/functions/`: **Google (Gemini)**,
**Anthropic (Claude)** — wired in `ai-router/providers.ts` + `tasks.ts` as the
primary provider for most chat/reasoning tasks — and **OpenAI**.

---

## 5. Subprocessors

Derived from the deployed edge functions and integrations in this codebase.
Mark "(verify)" items against live vendor contracts before publishing externally.

| Subprocessor | Purpose | Region | Evidence |
| --- | --- | --- | --- |
| Supabase | Database, auth, storage, edge functions | AWS us-east-1 | `supabase/` project, all `*` functions |
| Google — Gemini | Server-side AI inference (text/audio/video/image/speech/embeddings) | US (SCCs) | `ai-router`, `gemini-*` functions |
| Anthropic — Claude | Server-side AI inference (chat, reasoning, RAG, summaries) | US (SCCs) | `ai-router/providers.ts` (`invokeClaude`), `tasks.ts` |
| Google — Maps Platform | Geocoding, directions, distance | US (SCCs) | `maps-geocode`, `maps-directions`, `maps-distance` |
| Google — Gmail / Calendar / Contacts (OAuth) | Email, calendar, contacts integration | US (SCCs) | OAuth scopes; `emails`, `calendar_events` |
| OpenAI | Realtime token minting, Whisper transcription | US (SCCs) | `openai-realtime-token`, `whisper-proxy` |
| Daily.co | Video calls / rooms | US (verify) | `daily-rooms`, `daily-webhook` |
| Resend | Transactional email delivery | US (verify) | `send-email` (verified domain `pulse.logosvision.org`) |
| Stripe | Billing, subscriptions, invoices | US (verify) | `billing-*` functions, `billing-webhook` |
| Render | Auxiliary Express backend (Slack/Gmail token refresh, CRM OAuth) | US (verify) | `server.js` deployed on Render |
| Vercel | Frontend hosting / CDN | Global edge (verify) | Production deploy target |
| Twilio | SMS | — | **Disabled in v1** (see #100); declared in `config.toml` as `enabled = false` |

---

## 6. DSAR intake & response SLA (acceptance #3)

### Channels

**(a) Self-serve, in-app** — `Settings → Privacy`:

- **Export my data** (GDPR Art. 20 portability) — `DataExportRequestCard`
  produces a downloadable export of the user's data read under their own RLS.
- **Erase my account** (GDPR Art. 17 erasure) — `DataErasureCard` and the
  Privacy Dashboard "Delete Account" action both invoke the `delete-account`
  edge function (see §7).

**(b) Assisted, by email** — for access/rectification requests or any request a
user can't complete self-serve, direct them to:

> **fm1@qntmecos.com**

(This is the canonical legal/privacy/abuse contact, and the same address
wired into the DPA card in `ComplianceSettings.tsx`. Do **not** invent a new
mailbox.)

### Response SLA

| Regime | Acknowledge | Fulfill | Extension |
| --- | --- | --- | --- |
| GDPR (Art. 12(3)) | Promptly | Within **1 month** of receipt | +2 months for complex/numerous requests, **with notice to the data subject** |
| CCPA / CPRA | Within 10 business days (confirm receipt) | Within **45 days** | +45 days with notice |

**Identity verification is required before fulfilling** any assisted request.
For in-app self-serve actions, the authenticated session is the identity proof.

### Operator checklist for an emailed request

1. **Acknowledge** receipt (within SLA) and record the request date.
2. **Verify identity** — confirm the requester controls the account email; for
   sensitive requests, require an in-session confirmation or re-auth.
3. **Classify** the right invoked (access / portability / erasure /
   rectification / objection).
4. **Fulfill:**
   - *Access / portability* → have the user run the in-app export, or generate
     it on their behalf from their data under RLS.
   - *Erasure* → confirm no legal hold / open billing obligation, then have the
     user run in-app erasure (preferred) or trigger `delete-account` for them.
   - *Rectification* → update the relevant records.
5. **Respond** with what was done and what (if anything) was retained and why
   (§7).
6. **Log** the request and resolution in `admin_activity_logs`.

---

## 7. Erasure coverage (precise & honest)

Account deletion is a **two-step** operation triggered by the `delete-account`
edge function (`supabase/functions/delete-account/`):

1. **`delete_user_account(target_user_id)`** runs *as the user* (so the RPC's
   `auth.uid()` self-delete guard passes). It deletes the user's content across
   ~50 tables, **including**:
   - the canonical **`pulse_users`** row (no FK → would otherwise survive as an
     orphaned profile);
   - tables with **no FK to `auth.users`** that would not cascade
     (`team_vox_messages`, `broadcasts`, `decisions`/`decision_tasks`/
     `decision_votes`, `contact_circles`, `contact_goals`, `saved_searches`,
     `event_rsvp`, `in_app_messages`, `relationship_profiles`,
     `push_subscriptions`, `oauth_connected_apps`);
   - clearing of the **NO-ACTION FK blockers** (`subtasks`, `task_activity`,
     `crm_actions`, `crm_contacts`, `crm_deals`, `crm_integrations`,
     `ecosystem_alerts`, `org_invites`, `org_members`, `share_invites`,
     `user_sessions`, and `archives.created_by`) so step 2 cannot fail on a FK
     violation.
2. **`auth.admin.deleteUser(user.id)`** removes the auth identity using the
   service role. Remaining references clean up automatically via
   `ON DELETE CASCADE` / `SET NULL` FKs.

### Retained by design (and why)

| Retained data | Reason |
| --- | --- |
| Audit logs / `admin_activity_logs` | Security, fraud prevention, and compliance evidence (legal obligation / legitimate interest). The deletion event itself is logged here. |
| Invoices / Stripe billing records | Financial-regulation retention requirements. |
| Data contributed to **other** workspaces/orgs | Owned by those organizations as separate controllers; not the deleting user's to erase. |

This mirrors the "What will be retained" list shown to users in
`DataErasureCard.tsx`.

---

## 8. Export coverage

The self-serve **`DataExportRequestCard`** produces a live export (GDPR Art. 20
portability) of the user's data, read directly under the user's RLS — the data
never leaves the browser except as the downloaded file. Export history is
recorded in `data_exports` and surfaced honestly in the Privacy Dashboard
"Download History" (no fabricated entries; empty state when there are none).

**Known gaps (do not expand in this change):**

- `dataExportService` currently returns **empty arrays** for contacts and
  calendar (placeholders pending Google API integration) and emails. These are
  flagged TODOs in the service, not a complete Art. 20 export of those
  categories yet.
- Messages export targets `chat_messages`; verify it covers the canonical
  messaging tables (`pulse_messages`, voxer/quick-vox) before claiming a full
  messaging export.

Track export-completeness expansion as a separate follow-up.
