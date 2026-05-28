# Abuse & Takedown Runbook — Acceptable Use, Abuse/Spam Handling & Content Takedowns

**Owner:** Quantum Ecosystems LLC
**Product:** Pulse (hosted on `logosvision.org`)
**Governing law:** State of South Carolina, United States
**Canonical contact:** `fm1@qntmecos.com`
**Last reviewed:** 2026-05-27 (#112)
**Status:** Operator-facing. Factual. Describes only enforcement tooling that exists today.

---

## 1. Purpose & legal entity

This runbook governs how **Quantum Ecosystems LLC** ("we") enforces acceptable
use, handles abuse and spam reports, and processes content and intellectual-
property takedowns for **Pulse**.

- **Legal entity / operator:** Quantum Ecosystems LLC.
- **Governing law:** the laws of the **State of South Carolina, United States**.
  Disputes are resolved in the state or federal courts located in South Carolina
  (Terms of Service §13).
- **Scope:** acceptable-use enforcement, abuse/spam handling, and content
  takedowns (including DMCA) for content and accounts on Pulse.

For data-subject rights (access / export / erasure / rectification) and
subprocessor/residency facts, see the companion
**[DSAR Runbook](./DSAR_RUNBOOK.md)**. The public-facing policies live at
`/terms` (Terms of Service) and `/privacy` (Privacy Policy).

---

## 2. Acceptable Use Policy (summary)

This mirrors and expands the prohibited uses in **Terms of Service §4**. Users
must not use Pulse to:

- **Illegal use** — any purpose that violates applicable law or regulation.
- **Harassment / abuse** — harass, threaten, bully, defame, or harm other users.
- **Spam / unsolicited bulk messaging** — send spam, unsolicited bulk or
  commercial messages, or otherwise abuse messaging, broadcast, or invite
  features.
- **Malware** — transmit viruses, malware, or other malicious code.
- **Unauthorized access / security violations** — attempt to gain unauthorized
  access to the Service, other accounts, or connected systems; probe, scan, or
  test security; or disrupt or overload the Service or its servers.
- **Scraping / automated extraction** — scrape, harvest, or systematically
  extract data or content without authorization.
- **Intellectual-property infringement** — infringe copyrights, trademarks,
  trade secrets, or other IP rights.

### Zero tolerance: child sexual abuse material (CSAM)

CSAM is strictly prohibited and is **zero-tolerance**. Any credible report or
discovery of CSAM is treated as an imminent-harm escalation:

- **Report to the NCMEC CyberTipline** (`report.cybertip.org`) as required by
  U.S. law.
- **Preserve** the relevant content and account evidence (do not delete before
  reporting/preservation obligations are met).
- **Escalate immediately** to the operator and to law enforcement as required,
  and suspend the offending account.

---

## 3. Reporting channel

There is **no in-app "Report" button in v1** — reporting is handled by **email**.

- **Report abuse, spam, or takedown requests to:** `fm1@qntmecos.com`

A useful report should include:

- **What:** the specific content, message, broadcast, or behavior at issue.
- **Where:** URLs, message/thread IDs, channel/workspace IDs, account handles
  or emails, and approximate timestamps.
- **Why:** a description of the violation (which Acceptable Use category, or the
  nature of the IP/DMCA claim).
- **Reporter contact:** a reply-to email so we can acknowledge and follow up.

**User-level self-help that exists today:** an individual user can block an
**email** sender or domain themselves via the blocked-senders feature
(`blockedSendersService` → `blocked_senders` table). This is an email-only
control and does not, by itself, constitute a report to the operator.

---

## 4. Triage & response SLA

1. **Acknowledge** receipt within **3 business days** and record the report date.
2. **Triage** severity:
   - *Imminent harm / CSAM / credible threats of violence* → **immediate**
     escalation (see §2), do not wait on the standard SLA.
   - *Standard abuse / spam / IP* → queue for investigation.
3. **Investigate** the report and **preserve evidence** (relevant content,
   account state, and any `admin_activity_logs` context) before taking
   destructive action.
4. **Act promptly** on credible abuse with a proportionate enforcement action
   (§5).
5. **Respond** to the reporter (and, where appropriate, the affected user) with
   the outcome.

---

## 5. Enforcement actions

Actions escalate with severity and history. Available actions and the **real**
mechanism behind each:

| Action | Mechanism (what actually exists) |
| --- | --- |
| **Content removal** | Remove or hide the offending content via operator/database action. |
| **Warning** | Notify the user of the violation and required correction. |
| **Account suspension / ban** | `admin-manage-user` edge function, `ban_user` action — sets the Supabase Auth `ban_duration` (default ~100 years) and `user_profiles.status = 'suspended'`. Reversible via `unban_user` (clears the ban and the suspended status). |
| **Account deletion** | `admin-manage-user` edge function, `delete_user` action — removes the account via the service role. |
| **Email-sender block (user-level)** | `blockedSendersService` → `blocked_senders` table; lets an individual user block an email address or domain. Email-only; not an account-level ban. |

**Authorization & logging (verified):**

- `admin-manage-user` is **admin-gated** — the caller must have
  `user_profiles.role = 'admin'`; non-admins are rejected (403).
- `ban_user`, `unban_user`, and `delete_user` all write an entry to
  **`admin_activity_logs`**.

Do **not** assume tooling beyond the above (e.g., there is no in-app moderation
queue or automated content scanner in v1) — enforcement is operator-driven via
these mechanisms.

---

## 6. Copyright / DMCA takedown

- **Designated agent / contact:** `fm1@qntmecos.com`.
- **Submitting a notice:** a valid takedown notice under 17 U.S.C. § 512(c)(3)
  should include:
  1. A physical or electronic **signature** of the copyright owner or authorized
     agent.
  2. **Identification of the copyrighted work** claimed to be infringed.
  3. **Identification of the infringing material** and information reasonably
     sufficient to locate it (URLs, message/content IDs).
  4. **Contact information** for the complaining party (address, phone, email).
  5. A **good-faith statement** that the use is not authorized by the owner,
     its agent, or the law.
  6. A statement, **under penalty of perjury**, that the information is accurate
     and that the complaining party is authorized to act on the owner's behalf.
- **Counter-notice:** a user whose content was removed may submit a counter-
  notice to `fm1@qntmecos.com` containing their signature, identification of the
  removed material and its prior location, a good-faith statement under penalty
  of perjury that the removal was a mistake or misidentification, and their
  contact information plus consent to jurisdiction. If we receive a valid
  counter-notice, we may restore the content per the statutory process unless the
  claimant files a court action.
- **Repeat-infringer policy:** accounts that are the subject of repeated, valid
  infringement notices are subject to suspension or termination under §5.

---

## 7. Record-keeping

- **Log every enforcement action** in **`admin_activity_logs`** (ban / unban /
  delete actions are logged automatically by `admin-manage-user`; content
  removals and warnings should be recorded with the same context).
- **Retain** enforcement and audit records per the retention rules in the
  **[DSAR Runbook §3 (ROPA) and §7 (retained by design)](./DSAR_RUNBOOK.md)** —
  audit/security logs are retained for security, fraud-prevention, and
  compliance purposes even after account deletion.
- Retain abuse/takedown correspondence (the report, the decision, and the
  outcome) for the same compliance window.

---

**Cross-references:** data-subject rights → [DSAR Runbook](./DSAR_RUNBOOK.md);
public policies → `/terms` and `/privacy`.
