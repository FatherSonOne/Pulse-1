# Integrations — Built vs. Stub Audit

**Date:** 2026-05-31
**Trigger:** Operator saw the Slack settings card expose a *bot-token paste field*
(`xoxb-…` + "Test Connection") instead of the OAuth "Connect Slack" button the
`/launch-followups` `live-smoke-99` item assumed, and asked: *"Did I never build
the Slack OAuth UI, or did we lose work to destructive GitHub behavior?"* — plus
*"it looks like we're missing the Zapier connection."*

This doc is the ground-truth answer, surface by surface.

---

## TL;DR — was any work lost?

**No work was lost.** Git history is conclusive:

- `git log --all -S "api/slack/callback"` → **0 commits**. A Slack OAuth callback
  route never existed in this repo's history.
- `git log --all -S "ZapierIntegration"` → **0 commits**. A Zapier connect
  component never existed.
- `git log --all -S "Connect Slack"` → only the `/launch-followups` command file
  and the `f005214` multi-section-audit doc commit — i.e. the phrase only ever
  lived in *planning text*, never in shipped UI code.

What actually happened: the `live-smoke-99` checklist item (written in a prior
planning session) **described an aspirational OAuth flow that was never built.**
Pulse's real Slack integration is, and always has been, a **bring-your-own
bot-token proxy.** The mismatch is a documentation/expectation bug in the
checklist, not lost code. Zapier was never built beyond a policy-toggle row.

---

## The architecture in one sentence

The Render backend (`server.js`, live at `pulse-api-1epw.onrender.com`) is a set
of **thin authenticated proxies** — it forwards a credential the client already
holds (a Slack bot token, a Google access token, Twilio SID/auth) to the upstream
API. It is **not** an OAuth broker for Slack/Twilio. The only real OAuth dances
in `server.js` are **Google** (for the Logos-Vision contacts sync) and the
**CRM** callback route.

---

## Surface-by-surface

| Surface | UI component | Backend | Auth model | State | Notes |
|---|---|---|---|---|---|
| **Slack** | `SlackIntegration.tsx` | `POST /api/slack/proxy` (server.js:106) | **Bot token paste** (`xoxb-…`) | ✅ **Real, works** | Not OAuth. User creates a Slack app, pastes the bot token, "Test Connection" → `auth.test`, "Fetch Messages" → `conversations.list`/`history` → stored via `unifiedInboxDb`. |
| **Gmail** | `GmailIntegration.tsx` | `POST /api/gmail/proxy` (server.js:144) | **Piggybacks Google sign-in** (`user.connectedProviders.google`) | ✅ **Real, works** | No separate connect button. If you logged in with Google, the card shows "Connected" and "Test Connection"/fetch use the existing Google token. |
| **Google services** | `GoogleServicesIntegration.tsx` | `/api/google/refresh-token` + `/api/logos-vision/auth/*` | **Real Google OAuth** | ✅ **Real** | The one genuine OAuth broker. Tokens stored in `google_oauth_tokens`. |
| **Microsoft 365** | `MicrosoftIntegration.tsx` | (Supabase auth provider) | **Real OAuth** via `loginWithMicrosoft()` | ⚠️ **Connect works; data wiring unverified** | "Connect Microsoft Account" runs Supabase Azure OAuth. The Outlook/Calendar/Contacts tiles are presentational — no proxy route in server.js consumes the MS token yet. |
| **Twilio (SMS)** | `TwilioIntegration.tsx` | `POST /api/twilio/proxy` (server.js:187) | **Account SID + auth token paste** | 🔶 **Proxy real, feature flag OFF** | Backend proxy is real, but SMS is hidden for v1 (`inAppSms` flag false, #100) and A2P 10DLC isn't registered (`sms-10dlc` parked). Don't smoke SMS for launch. |
| **Zapier** | *(none)* — only a row in `OrgIntegrationsCard.tsx` | *(none)* | n/a | ❌ **Not built** | `zapier` exists only as an org **policy toggle** (per-user/shared/enable) in `OrgIntegrationsCard` + a `workspaceService` type union. No connect component, no backend route, no event forwarding. The closest real capability is the generic **Webhook Manager** (`webhookService.ts`, 312 LoC) which the User Guide points at Zapier/n8n/custom HTTP endpoints. |
| **CRM** | `crm/IntegrationSetupWizard.tsx` | `/api/crm/callback/:platform` (server.js:727) | OAuth via `server/crmOAuth.js` | ⚠️ **Known broken server-side** | Out of scope per roadmap #99 (browser-Supabase coupling). Tracked separately. |
| **Apple iCloud / LinkedIn** | `ComingSoonIntegrations.tsx` | — | — | ❌ **"Coming Soon" placeholders** | Intentionally disabled cards (`pointerEvents: none`). Honest. |
| **Ecosystem Bridge** | own Settings section | — | two-header gateway+token | ✅ separate feature | Not part of this audit. |

---

## Direct answers to the two questions

### "Did I never build the Slack integration UI, or did we lose work?"

You **did** build a working Slack integration UI — it's `SlackIntegration.tsx`,
and it's a **bot-token** flow, not OAuth. Nothing was lost. The screenshot you
saw (SLACK BOT TOKEN field + required scopes + Test Connection) **is** the
intended, shipped, functional UI. The confusion came from the `live-smoke-99`
checklist describing a "Connect Slack" OAuth button that was never part of the
build.

### "It looks like we're missing the Zapier connection."

Correct — Zapier was **never built** as a connectable integration. It exists only
as an org-policy row (so an admin can pre-toggle a scope for it) and as a string
in a TypeScript union. There is no Zapier connect UI, no OAuth, and no event
forwarding. If you want Zapier in v1, the honest near-term path is the existing
**Webhook Manager** (point a Zap's "Catch Hook" trigger at a Pulse webhook), not
a native Zapier app — a native Zapier integration is a separate, larger build
(publish a Zapier app, define triggers/actions, OAuth or API-key auth).

---

## Implications for the launch checklist

1. **`live-smoke-99` was written against a flow that doesn't exist.** The smoke
   needs to be rewritten to the *real* architecture:
   - Slack: paste a bot token → Test Connection → channels populate → Fetch
     Messages → messages land in Unified Inbox.
   - Gmail: confirm Google sign-in → card reads "Connected" → Test Connection →
     fetch recent emails.
   Both are still valid launch smokes; they just don't involve a Slack/Gmail
   OAuth redirect handshake against the Render backend.

2. **The `redirect_uri mismatch` NOTES in `live-smoke-99` are moot** — there are
   no `/api/slack/callback` or `/api/gmail/callback` routes to misconfigure.

3. **Truth-in-product (#104) gap:** decide whether the **Zapier** row should stay
   visible in `OrgIntegrationsCard` for v1. Showing a policy toggle for an
   integration that can't be connected is the same class of issue #104 was
   created to fix (don't surface what isn't real). Options: (a) hide the Zapier
   row until a real integration ships, or (b) relabel it to point at the Webhook
   Manager.

4. **Microsoft 365** data wiring should be spot-checked separately — connect is
   real but no backend proxy consumes the token yet.

---

## Recommended follow-ups (not done in this pass)

- [ ] Rewrite `live-smoke-99` WHAT/NOTES to the bot-token + Google-piggyback
      reality (then run the smoke).
- [ ] Decide Zapier v1 disposition (hide row vs. relabel to Webhook Manager) —
      file under #104.
- [ ] Verify Microsoft 365 actually surfaces Outlook/Calendar data, or mark the
      tiles "Coming Soon" to stay honest.
- [ ] (Optional, post-v1) Evaluate a native Zapier app vs. leaning on the
      Webhook Manager.
