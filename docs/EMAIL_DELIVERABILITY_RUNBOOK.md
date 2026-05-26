# Pulse Transactional Email Deliverability — Runbook

> **Issue #102 (P0).** Transactional email may silently not arrive for real
> users. The code side is done (FROM addresses across all senders now point at
> the Resend-verified domain). This runbook covers the parts that are **human /
> DNS / provider actions** — the steps no commit can perform. Read it top to
> bottom; the DMARC record and the external-delivery test are the two things
> still owed against the acceptance criteria.

---

## 1. Verified domain status

| Item | Value | Where |
|---|---|---|
| Verified sending domain | `pulse.logosvision.org` | Resend → Domains |
| SPF | configured ✅ | IONOS DNS (parent `logosvision.org` zone) |
| DKIM | configured ✅ | IONOS DNS |
| DMARC | **not yet added** ⚠️ | see §2 |
| Reply-to inbox | `support@logosvision.org` | IONOS forwarder on the **parent** domain |

Why the split: IONOS only exposes the **parent** domain (`logosvision.org`) for
email forwarders, so a real reply inbox can only live there. Resend, however,
requires the **FROM** address to be on the **verified** domain. So every Pulse
sender uses `<local-part>@pulse.logosvision.org` for `from` and
`support@logosvision.org` for `reply_to`. Replies route through the parent
forwarder to a monitored inbox instead of bouncing off a no-reply mailbox.

---

## 2. DMARC — the remaining DNS gap

Acceptance criterion 1 requires **SPF + DKIM + DMARC**. SPF and DKIM are live;
DMARC is missing. Add one TXT record at IONOS:

| Field | Value |
|---|---|
| Type | `TXT` |
| Host / name | `_dmarc.pulse.logosvision.org` |
| Value | `v=DMARC1; p=none; rua=mailto:support@logosvision.org; pct=100; aspf=r; adkim=r` |
| TTL | default (3600) is fine |

Notes:
- `p=none` is **monitor-only** — it does not affect delivery, it just asks
  receivers to send aggregate (`rua`) reports so you can confirm SPF/DKIM
  alignment before tightening. Start here.
- After ~1–2 weeks of clean aggregate reports, tighten the policy in stages:
  `p=none` → `p=quarantine` → `p=reject`. Never jump straight to `p=reject`.
- `aspf=r` / `adkim=r` use *relaxed* alignment, which is correct here because
  FROM is on the subdomain while the forwarder/reply path touches the parent.
- IONOS DNS UI: some panels want the host as `_dmarc.pulse` (relative to the
  `logosvision.org` zone) rather than the fully-qualified name. Enter whichever
  form the panel’s existing records use, then verify with
  `dig TXT _dmarc.pulse.logosvision.org +short` (or `nslookup -type=TXT`).

---

## 3. Sender inventory

Every place Pulse sends transactional mail, after issue #102. New senders MUST
follow this convention: **FROM on `pulse.logosvision.org`, `reply_to` =
`support@logosvision.org`.**

| Sender | File | FROM address | Surface | Auth gate |
|---|---|---|---|---|
| General relay | `supabase/functions/send-email/index.ts` | `noreply@pulse.logosvision.org` | Edge function (Deno) | Bearer JWT |
| Billing lifecycle | `supabase/functions/billing-webhook/emails.ts` | `noreply@pulse.logosvision.org` | Edge function (Deno) | Stripe webhook sig |
| Security alerts | `supabase/functions/send-security-alert/index.ts` | `noreply@pulse.logosvision.org` | Edge function (Deno) | `CRON_SECRET` |
| Saved-search alerts | `supabase/functions/check-search-alerts/index.ts` | `alerts@pulse.logosvision.org` (`ALERT_FROM_EMAIL` override) | Edge function (Deno) | `CRON_SECRET` |
| Calendar / RSVP invites | `src/services/rsvpService.ts` | `calendar@pulse.logosvision.org` | Client-side (browser) | `VITE_RESEND_API_KEY` |
| Workspace invites | `src/services/inviteService.ts` | `invites@pulse.logosvision.org` | Client-side (browser) | `VITE_RESEND_API_KEY` |

Any local-part on the verified subdomain works (`noreply`, `alerts`,
`calendar`, `invites`, …) — Resend verifies the **domain**, not the mailbox.

> **Known follow-up (out of scope for #102, tracked as #104):** the two
> client-side senders (`rsvpService.ts`, `inviteService.ts`) read
> `VITE_RESEND_API_KEY`, which bundles the Resend key into the browser. These
> should move behind an edge function during the feature-flag/secret audit.
> A `// TODO(#104)` note is left in `inviteService.ts`.

---

## 4. External-delivery test checklist (acceptance criterion 3)

Goal: prove mail arrives at an address that is **not** the Resend account
owner. `onboarding@resend.dev` mode only ever delivered to the owner, which is
exactly the failure #102 fixes — so the test must use an external inbox (e.g. a
personal Gmail that is NOT the Resend account-owner email).

### 4.0 Deploy first

The edge-function FROM changes only take effect once deployed. From the repo
root, against project **`pulse-chat`** (ref `ucaeuszgoihoyrvhewxk`):

```bash
supabase functions deploy send-email          --project-ref ucaeuszgoihoyrvhewxk
supabase functions deploy send-security-alert  --project-ref ucaeuszgoihoyrvhewxk
supabase functions deploy check-search-alerts  --project-ref ucaeuszgoihoyrvhewxk
supabase functions deploy billing-webhook      --project-ref ucaeuszgoihoyrvhewxk
```

The client-side senders (`inviteService.ts`, `rsvpService.ts`) ship with the
frontend deploy (Vercel) — no separate function deploy.

### 4.1 Invite email (`inviteService.ts`)

1. In Pulse, open a workspace and invite **external-gmail@gmail.com**.
2. Confirm the email lands in the **inbox** (not spam) within ~1 min.
3. Confirm FROM shows `Pulse <invites@pulse.logosvision.org>` and that hitting
   Reply addresses `support@logosvision.org`.
4. Click the invite link → it should resolve to
   `https://pulse.logosvision.org/invite/<token>` (not localhost, not 404).

### 4.2 Security alert (`send-security-alert`)

Invoke the deployed function directly with the cron secret:

```bash
curl -X POST \
  "https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/send-security-alert" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "user_email": "external-gmail@gmail.com",
    "alert_level": "high",
    "alert_title": "New login from unrecognized device",
    "alert_message": "Deliverability test for issue #102.",
    "alert_id": "00000000-0000-0000-0000-000000000000"
  }'
```

Expect `{ "success": true, "email_id": "..." }` and the alert in the external
inbox, FROM `Pulse <noreply@pulse.logosvision.org>`. (The
`security_alerts` UPDATE will no-op against the placeholder `alert_id` — that’s
fine for the delivery test.)

### 4.3 Search alert (`check-search-alerts`)

This one needs a real `saved_searches` row with `alert_enabled = true` for the
test user, plus matching `unified_messages` newer than `last_alert_at`. Then:

```bash
curl -X POST \
  "https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/check-search-alerts" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" -d '{}'
```

Expect the saved-search row to land in `processed[]` and an email at the test
user’s address, FROM `Pulse <alerts@pulse.logosvision.org>`. Note this sends to
the **saved-search owner’s** auth email, so seed the saved search under an
account whose email is the external test inbox.

### 4.4 Deliverability spot-checks

- View the raw message headers in Gmail (⋮ → Show original) and confirm
  **SPF=pass, DKIM=pass, DMARC=pass** once §2 is live.
- Optionally run the FROM domain through https://www.mail-tester.com to catch
  alignment regressions.

---

## 5. Hosting-domain decision (acceptance criterion 4)

**Decision for v1: keep sending from `pulse.logosvision.org`.**

- Legal entity is **Quantum Ecosystems LLC**.
- Apps are currently hosted on `*.logosvision.org`. A migration to
  `qntmecos.com` is *intended* but **deliberately deferred** — it’s a large,
  coordinated move touching:
  - DNS (new zone + SPF/DKIM/DMARC re-issued for the new domain)
  - OAuth redirect URLs (Google, etc.)
  - Supabase Auth URL configuration (site URL + redirect allow-list)
  - Stripe webhook endpoints
  - **Re-verifying the Resend sending domain** for `qntmecos.com` and waiting
    out DNS propagation
- Doing it piecemeal would break email mid-flight, so it stays bundled for a
  single cutover, not scheduled for launch.

### When the qntmecos.com migration ships

Re-verify the Resend domain for the new host, add SPF/DKIM/DMARC for it, then
update every FROM address. The files to touch (same six as §3):

1. `supabase/functions/send-email/index.ts` — `FROM_ADDRESS`, `REPLY_TO`, docstring
2. `supabase/functions/billing-webhook/emails.ts` — `FROM_ADDRESS`, `REPLY_TO`
3. `supabase/functions/send-security-alert/index.ts` — inline `from` / `reply_to`
4. `supabase/functions/check-search-alerts/index.ts` — `FROM_EMAIL` default, `APP_URL` default, inline `reply_to`
5. `src/services/rsvpService.ts` — inline `from`
6. `src/services/inviteService.ts` — inline `from` / `reply_to`, `appUrl`

Re-deploy all four edge functions and re-deploy the frontend after the change.
