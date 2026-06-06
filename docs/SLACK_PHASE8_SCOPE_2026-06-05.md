# Slack Section — Locked Scope Doc (contactsHybrid Phase 8: send + per-contact identity)

> **Generated:** 2026-06-05 · Phase 1 (brainstorm + scope) of the Slack build.
> **Method:** 8-dimension code/schema audit + 5-claim adversarial verification (workflow `slack-phase1-scope`, 14 agents), synthesized against live `information_schema` ground truth.
> **Scope owner:** contactsHybrid redesign · Phase 8 of 13 · handoff `docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md`
> **Status:** LOCKED. The 4 user-facing forks (§11) were **RESOLVED 2026-06-05 — all confirmed as recommended** (Q1 `users.lookupByEmail`, Q2 per-user localStorage, Q3 ship-send-now / harden-proxy-auth-later, Q4 send-as-bot). Feeds Phase 2 (gateway/proxy), Phase 5 (section-redesign mockup), Phase 8 (build).
> **Guardrail:** this phase is **additive** to a working read-only Slack path. No existing Slack ingestion code, proxy read path, or `channelsFor` contract may be rewritten or deleted (CLAUDE.md Rule A). Every "gap" below is a documented Phase-8 seam, not a bug.

## 1. As-Is (verified)

- The only Slack service is read-only. `slackService.ts` exposes exactly four methods, all read/auth: `getChannels`→`conversations.list` (`slackService.ts:53`), `getChannelMessages`→`conversations.history`+`users.info` (`slackService.ts:86,104`), `getAllMessages` (`slackService.ts:149`), `testConnection`→`auth.test` (`slackService.ts:186`). No `sendMessage`, `chat.postMessage`, `conversations.open`, or `users.lookupByEmail` exists anywhere (grep `chat\.postMessage|conversations\.open|lookupByEmail|postMessage` across `**/slack*.{ts,tsx}` → no matches; repo-wide hits are docs only).
- There is exactly ONE Slack proxy route: `app.post('/api/slack/proxy', ...)` at `server.js:139-174`. The handoff/INTEGRATIONS-audit citation of "server.js:106" is **stale** — do not trust it.
- The proxy has **NO allowlist**. It validates only presence (`server.js:142-144`) then interpolates the caller's `endpoint` verbatim into `https://slack.com/api/${endpoint}` (`server.js:147`). Any method string reaches Slack.
- The proxy is **GET-only and bodyless**. The upstream `fetch` (`server.js:156-161`) sets no `method` (defaults to GET) and no `body`; all `params` are appended to the query string and `String()`-coerced (`server.js:151-152`). A `blocks`/`attachments` array becomes `'[object Object]'`.
- The proxy is unauthenticated. `/api/slack/proxy` does no Supabase/Bearer check of its own (`server.js:139-144`), unlike `/api/email/*` which calls `getSupabaseClient(req)`. It is effectively an open relay to slack.com for whoever holds a token + can reach the backend.
- No Slack rate-limit/429/Retry-After handling. The proxy passes HTTP status through (`server.js:165-166`) and never inspects Slack's 200-with-`{ok:false}` envelope; the client (`slackService.ts:40`) is what checks `data.ok`.
- The token is a **bot token (xoxb-)**, bring-your-own, never persisted. It is seeded from a Vite **build-time** env var: `const [slackToken, setSlackToken] = useState(import.meta.env.VITE_SLACK_BOT_TOKEN || '')` (`SlackIntegration.tsx:18`). The format validator only accepts `xoxb-` (`src/utils/envValidation.ts:187`). No `localStorage`/`IndexedDB`/`sessionStorage`/Supabase write of the token exists (grep clean). It evaporates on reload unless the env var is baked in.
- The token reaches the proxy per-request in the JSON body: `body: JSON.stringify({ endpoint, token: this.botToken, params })` (`slackService.ts:26-29`); server reads `req.body.token` and forwards as `Authorization: Bearer` (`server.js:140,158`).
- The documented scopes are read-only ingestion only: `channels:history, channels:read, groups:history, groups:read, im:history, im:read, mpim:read, users:read` (`SlackIntegration.tsx:146-155`). **No `chat:write`, no `im:write`, no `users:read.email`.**
- `Contact` has **no Slack field**. `types.ts:76-109` lists `email` (REQUIRED, `:84`) and `pulseUserId?` (`:96`); there is no `slackUserId`/`slack_user_id` member. The single `slack_user_id` occurrence in src is a forward-reference comment (`channelsFor.ts:47`). (Live schema confirms: `contacts` has no `slack_user_id` column; `email text NOT NULL`; `user_id` is `text`.)
- `channelsFor` already emits a Slack descriptor, gated on two opts: it pushes `{kind:'slack', tone:'slack', disabled:!opts.slackSendEnabled, disabledReason:'Slack send arrives in a later phase'}` only `if (opts.slackLinked)` (`channelsFor.ts:79-87`).
- The descriptor is dead in real data. `ChannelRow` is mounted in exactly one place, `FocusColumn.tsx` (the contact detail), which passes only `contact`, `emailEnabled`, `onAction`, `onNote` — never `slackLinked`/`slackSendEnabled`, so both are `undefined` and the `if (opts.slackLinked)` branch never fires for a real user. `slackLinked:true` appears only in tests (`channelsFor.test.ts:48,57`; `ChannelRow.test.tsx:55`).
- `ChannelRow.tsx:69-71` has an explicit no-op `case 'slack': break;` and relabels a disabled Slack button to "Link Slack" (`ChannelRow.tsx:87`).
- `actions.ts` has only `composeEmail` (`:20`) and `callContact` (`:35`). There is no `sendSlack`. `composeEmail` reuses the existing compose bridge verbatim: `sessionStorage 'pulse_pending_compose'` + `window` event `'pulse:compose-email'` + `'pulse:navigate'` (`actions.ts:21-28`), the same bridge `App.handleComposeEmail` (`App.tsx:640-647`) uses and `EmailHybridClient` drains warm+cold (`EmailHybridClient.tsx:237-271`).
- `App.tsx` has **no Slack handler at all**; the only `slack` tokens are the settings-integrations command card label/keywords (`App.tsx:304,307`).
- Analytics is wired-but-unfed. `slack_sent`/`slack_received` columns + a real `update_daily_metrics` CASE branch exist (`analyticsService.ts:24-25`; migration `20260119062007_remote_schema.sql:3992,4001`), but no client ever calls `trackMessageEvent({channel:'slack'})` (grep clean). `AnalyticsDashboard.tsx:341,345` actively filters `slack` out of one breakdown view.
- Two Slack settings surfaces are decoupled: `OrgIntegrationsCard` writes a `workspace_integrations` policy row (`scope`, `is_enabled`) but never a credential; `shared_config jsonb` exists (`20260426000005_workspace_integrations.sql:21`) but is never written (always `{}`). Setting Slack to "shared" stores **no token**. `workspace_integrations` select RLS is membership-only (`:77-85`); insert/update/delete is owner/admin (`:87-118`). (Live schema confirms a `slack` row exists: scope `shared`, enabled.)
- `webhookService.ts` (the in-app "incoming webhooks" normalizer) is **irrelevant** to send/identity — `processWebhook` has zero production callers (only tests + the unrelated `entomateService.processWebhook`), its HMAC scheme won't match Slack's, and it is browser-side. Do not route Slack work through it.

## 2. Corrected Assumptions

- **"Net-new OAuth send."** WRONG framing. Phase 8 is **not** OAuth. It keeps the existing **bot-token (xoxb-)** + existing `/api/slack/proxy` and only adds DM send (handoff `:280` "Slack OAuth … deferred to v1.1"; `:281` "only DM send is added"). Calling it "OAuth send" would over-scope the phase.
- **"No allowlist, so all send/identity methods already pass — no backend change needed."** HALF WRONG. There is no allowlist (true), but the proxy is GET-only/bodyless (`server.js:156-161`). `users.lookupByEmail` (scalar `email` arg) and `conversations.open` (scalar `users` CSV) survive as GET query calls; **`chat.postMessage` with structured `blocks`/`attachments` does NOT** — `String(params[key])` mangles objects (`server.js:152`). The send path **does** need a proxy change (a POST-body branch) for anything beyond a bare `channel`+`text` string.
- **"Token is persisted client-side (localStorage/IndexedDB)."** WRONG. It is a **build-time env var** (`import.meta.env.VITE_SLACK_BOT_TOKEN`) baked into the bundle, plus ephemeral `useState`. It is NOT in any browser store and NOT in the DB. Therefore a send triggered from Contacts has **no token in scope** today — token *availability*, not just *persistence*, is the blocker.
- **"unifiedInboxService instantiates SlackService."** INVERTED. `unifiedInboxService` never imports or constructs `SlackService`; its only consumer is `SlackIntegration.tsx:33,59`. `unifiedInboxService` only reshapes raw objects (`:28-39`).
- **"Existing scopes are enough."** WRONG. The pasted token's scopes are read-only (`SlackIntegration.tsx:146-155`). `chat.postMessage`→`missing_scope` without `chat:write`; `conversations.open` for a DM needs `im:write`; `users.lookupByEmail` needs `users:read.email`. The user must re-install the Slack app to mint a token with these — and the UI gives zero affordance for that today.
- **"`channelsFor` must change to enable Slack."** WRONG. The contract is already correct and test-locked: `disabled:true`+"Slack send arrives in a later phase" when `slackLinked && !slackSendEnabled` (`channelsFor.test.ts:46-51`), `disabled:false` when both true (`:53-61`). Phase 8 makes the *callers* pass the real values; it must not edit the resolver's branch shape.
- **"Identity via `users.lookupByEmail`."** The handoff actually specs identity via **`users.info.profile.email` match** (handoff `:166,294`), because Slack *messages* carry no email but the user-profile endpoint does. The audit's `lookupByEmail` framing is one option, not the locked one — see D-B / Q1.

## 3. Decisions (LOCKED)

> The 4 user-facing forks (D-A send-as-bot, D-B identity endpoint, D-C token storage, and the proxy-auth call) were confirmed by the user on 2026-06-05 — **all as recommended** (see §11).

| ID | Question | Decision | Rationale | Rejected |
|----|----------|----------|-----------|----------|
| D-A | Send as bot or as user? | **Send as the Pulse bot app (xoxb-)** via `chat.postMessage` | The only token we have is a bot token (`envValidation.ts:187`); user-send needs a `xoxp-` user token via OAuth, explicitly deferred (handoff `:280`). The DM legitimately shows "from the Pulse app", which is honest. | Send-as-user (`xoxp-`/`as_user`) — requires full Slack OAuth + user-scope install; out of phase. |
| D-B | Resolve identity via `users.lookupByEmail` or `users.info`? | **`users.lookupByEmail({email: contact.email})`** as the primary resolver; persist the returned `user.id` | Direct email→id in one scalar call; survives the existing GET proxy untouched. Requires `users:read.email`. `contact.email` is REQUIRED (`types.ts:84`) so every external contact is resolvable. Stores the id so we don't re-call per send. | `users.info`-scan + `profile.email` match (handoff's literal text) — needs iterating member lists, N calls, still needs `users:read.email`. **Overrides handoff `:166` wording → confirm via Q1.** |
| D-C | Token at send time: per-user token or workspace `shared` row? | **Per-user, persisted to `localStorage` key `pulse_slack_bot_token`**, read by a non-React helper mirroring `emailFeature.isEmailEnabled` | Matches current per-user bring-your-own-bot-token model + `SyncPreferences` localStorage precedent. Avoids putting a raw `xoxb-` into `workspace_integrations.shared_config`, whose select RLS is membership-only (`20260426000005:77-85`) = readable by every member (real secret-exposure risk). | `shared_config` — exposes raw token to all members under current RLS; column is dead/untested; would need encryption-at-rest + admin-only select first. |
| D-D | Does send need a `server.js` change? | **YES — add an optional `method`/`body` branch to `/api/slack/proxy`** (additive; the GET read path stays untouched) | `chat.postMessage` with `blocks` is mangled by query-string `String()` coercion (`server.js:152`); a clean POST-with-JSON-body branch is required and is additive per CLAUDE.md Rule A. `conversations.open`/`lookupByEmail` could ride GET but should also use the POST branch for consistency. | Piggyback the existing GET path for plain `channel`+`text` only — fragile, undocumented, breaks the moment we add formatting. |
| D-E | Send UI surface | **Inline send inside the Focus column** (compose a short DM in place), mirroring the *intent* of the email compose bridge but NOT navigating away | Email navigates to its own full section because Email *is* a section; Slack has no section, so a navigate-away has no destination. A small inline composer (textarea + Send) in `FocusColumn` keeps the act local to the contact. | (a) Sidecar (email reply pattern) — no Slack panel to slide into; (b) Global modal — heavier than a one-line DM warrants; (c) `slack://` deep-link — abandons in-app send, contradicts handoff. |
| D-F | Feature gating | **One new `FeatureContext` flag `slackSend` (default OFF)** as the global kill-switch; keep `slackLinked` as PER-CONTACT runtime data derived from `contact.slackUserId` | They answer different questions: *is the capability shipped* (flag) vs *does THIS contact have a Slack id* (data). A real flag lets us ship the UI dark and flip via Settings without redeploy (the inAppSms/emailCampaigns pattern). | (a) Fold under `contactsHybrid` — couples send to the layout switch; can't dark-launch send to hybrid testers; (b) hardcode the `slackSendEnabled` prop — no runtime kill-switch; (c) put the flag in `src/lib/featureFlags.ts` — gives only a `?ff_` URL override, no Settings toggle. |
| D-G | Recipient model | **Send by stored `slack_user_id` → `conversations.open` → DM channel id → `chat.postMessage`** | A stable persisted link means one resolve, then cheap repeat sends; `slackLinked = !!contact.slackUserId`. | Resolve-by-email at every send — extra round-trip + `users:read.email` on every send; keep as the *fallback* when `slackUserId` is null ("Link Slack"). |
| D-H | Analytics on send | **Increment `slack_sent` via `analyticsCollector.trackMessageEvent({channel:'slack', isSent:true, ...})` after a successful send**, mirroring `EmailHybridClient.tsx:462-475` | The column + RPC branch are real and currently unfed; the email send-site is the exact template. | Leave analytics unfed — wastes a working column; or build on the `@deprecated` `analyticsService.*` exports — wrong path. |

## 4. In Scope (v1)

- **Schema:** add nullable `contacts.slack_user_id text` (migration, dry-run-rollback-first; §7).
- **Type:** add `slackUserId?: string` to `Contact` (`types.ts`, after `pulseUserId?` at `:96`).
- **Proxy:** additive POST-body branch on `/api/slack/proxy` (`server.js:139`) — optional `method` + JSON `body` passthrough; existing GET read path unchanged.
- **Service:** new `slackService.lookupUserByEmail(email)` (→`users.lookupByEmail`), `slackService.openDm(slackUserId)` (→`conversations.open`), `slackService.sendMessage(channelOrUserId, text)` (→`conversations.open` then `chat.postMessage`), each via the existing `slackRequest` shape; client checks `data.ok` (already done at `slackService.ts:40`). First-ever unit tests for these (mock the proxy fetch), including the `missing_scope`/`channel_not_found`/`users_not_found` error branches.
- **Token availability:** persist the pasted bot token to `localStorage` (`pulse_slack_bot_token`) in `SlackIntegration.tsx` + a non-React reader helper (mirrors `emailFeature.ts`) so Contacts send code can obtain it outside React.
- **Identity resolver:** "Link Slack" action that calls `lookupUserByEmail(contact.email)`, persists the result to `slack_user_id`, and flips the contact to linked. Manual-link fallback copy for misses (no email match).
- **Channel wiring:** `FocusColumn` computes and passes `slackLinked = !!contact.slackUserId` and `slackSendEnabled = features.slackSend`; add a `sendSlack(contact, text)` in `actions.ts` and a real `case 'slack'` handler in `ChannelRow` (replacing the no-op at `:69-71`) — via a new `onSendSlack`/`onLinkSlack` prop (mirroring `onNote`), NOT by widening the `onAction` union (keeps `ChannelRow.test.tsx:43-48` green).
- **Send UI:** inline DM composer in the Focus column (textarea + Send + char affordance), with empty/loading/error/disabled states (§9).
- **Feature flag:** new `slackSend` in `FeatureContext` (type + default `false` + `FEATURE_NAMES` entry [required, total Record] + description + a hardcoded Settings card in `FeaturesLabsSettings.tsx`, surfaced only after the consumer ships).
- **Scopes UX:** update `SlackIntegration.tsx` scope list to add `chat:write`, `im:write`, `users:read.email`, plus a "re-install required for send" note and a runtime `missing_scope` catch that surfaces a re-auth prompt.
- **Analytics:** `slack_sent` increment after a successful send (D-H).
- **Tests:** keep all 5 existing `channelsFor`/`ChannelRow` tests green; add a send-invocation test (button fires the handler when `slackSendEnabled`) and the resolver/`slackService` unit tests above.

## 5. Out of Scope (deferred)

- Slack **OAuth / user-token (`xoxp-`) send-as-human** (handoff `:280`) — v1.1.
- **Inbound/real-time Slack** (Events API, `url_verification`, `x-slack-signature` HMAC, a new Supabase edge function) — would NOT reuse `webhookService.ts`; net-new, deferred (handoff §9; audit inbound-webhooks).
- **`slack_received` inbound increment** and the inbound "Slack callout" on the contact (handoff `:156`) — post-Phase-8 identity.
- **Block Kit / attachments / threads / file uploads** — v1 is plain-text DM only (the POST branch makes this *possible* but v1 ships text).
- **Workspace shared-token** model (`workspace_integrations.shared_config` + encryption + admin-only RLS) — deferred unless multi-operator shared send is requested.
- **`AnalyticsDashboard` slack-filter revisit** (`:341,345`) — leave as-is; out of this phase.
- **Adding a Supabase Bearer auth check to `/api/slack/proxy`** — a real security improvement (the route is currently an open relay) but a separate security decision; flagged in §10/§11 (Q3), not silently added.
- **`channelsFor` resolver logic changes** — frozen; only callers change.

## 6. Change Set

| Path | Change | Kind | Sub-step |
|------|--------|------|----------|
| `supabase/migrations/<ts>_phase8_contacts_slack_user_id.sql` | `ADD COLUMN slack_user_id text NULL` + partial index + COMMENT | migration | 8a |
| `src/types.ts` (`Contact`, after `:96`) | add `slackUserId?: string` | extend | 8a |
| `server.js` (`/api/slack/proxy`, `:139-174`) | additive: if `req.body.method === 'POST'`, issue `fetch(method:'POST', body: JSON.stringify(params), Content-Type: application/json)`; else keep current GET path | modify | 8b |
| `src/services/slackService.ts` (extend, `:198`) | add `lookupUserByEmail`, `openDm`, `sendMessage`; pass `method:'POST'` through `slackRequest` for writes | extend | 8c |
| `src/services/slackService.test.ts` | NEW — first tests for slackService; mock proxy fetch; cover send + resolve + error branches | new | 8c |
| `src/components/settings/integrations/SlackIntegration.tsx` (`:18,146-155`) | persist token to `localStorage` on save; add `chat:write`/`im:write`/`users:read.email` to scope list + re-install note | modify | 8d |
| `src/lib/slackToken.ts` | NEW — non-React `getSlackBotToken()` reader (mirrors `emailFeature.ts`) | new | 8d |
| `src/contexts/FeatureContext.tsx` (`FeatureFlags`, `DEFAULT_FEATURES`, `FEATURE_NAMES`, `FEATURE_DESCRIPTIONS`) | add `slackSend: boolean` (default `false`) | extend | 8e |
| `src/components/settings/FeaturesLabsSettings.tsx` | add hardcoded `slackSend` toggle card (surface only after consumer ships) | extend | 8e |
| `src/components/contacts/hybrid/channels/actions.ts` (`:41`) | add `sendSlack(contact, text)` → resolve/openDm/postMessage + analytics + identity persist | extend | 8f |
| `src/components/contacts/hybrid/channels/ChannelRow.tsx` (`:29,69-71`) | add `onSendSlack?`/`onLinkSlack?` prop; real `case 'slack'` handler | modify | 8f |
| `src/components/contacts/hybrid/detail/FocusColumn.tsx` | pass `slackLinked={!!contact.slackUserId}` + `slackSendEnabled={features.slackSend}`; mount inline DM composer | modify | 8f |
| `src/components/contacts/hybrid/channels/channelsFor.test.ts` / `ChannelRow.test.tsx` | keep green; add send-invocation + linked-derivation tests | extend | 8g |

## 7. Migration Sketch

Honors ground truth: `contacts.user_id` is `text` (not uuid) — but the new column is independent of `user_id`, so no FK and no type coupling. New columns inherit the table's existing RLS policies (no policy edit needed). **Dry-run in a rolled-back transaction first** (CLAUDE.md §4), confirm it completes clean, THEN apply once.

```sql
-- DRY-RUN: prove it applies clean, then roll back. Do NOT commit this block.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Ground-truth check (read, don't assume): confirm the table + that the column is absent.
-- (Run separately first: SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='contacts' AND column_name='slack_user_id';)

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS slack_user_id text NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_slack_user_id
  ON public.contacts (slack_user_id)
  WHERE slack_user_id IS NOT NULL;

COMMENT ON COLUMN public.contacts.slack_user_id IS
  'Resolved Slack user id (e.g. U0123ABCD) for an external contact, set by the '
  'Phase 8 "Link Slack" resolver via users.lookupByEmail on contact.email. '
  'NULL = not linked (Slack channel does not appear). Independent of user_id '
  '(no FK). Client mirror: Contact.slackUserId in src/types.ts.';

RAISE EXCEPTION 'dry-run rollback';  -- aborts; proves the DDL is valid without persisting
COMMIT;  -- never reached in dry-run
```

After a clean dry-run, ship the real migration file as the same body **without** the `RAISE EXCEPTION`, following the existing additive-column migration template (lock/statement timeouts, `ADD COLUMN IF NOT EXISTS`, partial index, COMMENT). No RLS policy edits required.

## 8. Slack API Contract (feeds Phase 2 / gateway)

Methods (all via `/api/slack/proxy`, bearer = the xoxb- bot token in `req.body.token`):

- **`users.lookupByEmail`** — args `{ email }` (scalar). Works over current GET proxy; will use POST branch for uniformity. Scope: `users:read.email`. Returns `{ ok, user: { id, ... } }`. Errors: `users_not_found` (no Slack member with that email — fall to manual "Link Slack"), `missing_scope`, `invalid_auth`.
- **`conversations.open`** — args `{ users: "<slack_user_id>" }`. POST. Scope: `im:write`. Returns `{ ok, channel: { id } }` (the DM channel id). Errors: `user_not_found`, `cannot_dm_bot`, `missing_scope`.
- **`chat.postMessage`** — args `{ channel: "<dm channel id>", text }`. **POST-body required** (D-D) — bare `channel`+`text` could ride GET but v1 standardizes on POST. Scope: `chat:write`. Returns `{ ok, ts, channel }`. Errors: `not_in_channel`, `channel_not_found`, `missing_scope`, `restricted_action`.
- **`auth.test`** (existing) — used to validate the token + surface granted scopes for the re-install prompt.

Cross-cutting:
- **Envelope:** Slack returns HTTP 200 with `{ ok:false, error }` for app errors; the proxy passes 200 through (`server.js:165`), so the client MUST branch on `data.ok` (`slackService.ts:40` already does).
- **Rate limits:** `chat.postMessage` ~Tier (1 msg/sec/channel); `users.lookupByEmail` Tier 3; `conversations.open` Tier 4. The proxy has NO 429/Retry-After handling (`server.js:166`). v1 mitigation: single-shot sends (no bursts); surface a 429 as a "try again in a moment" toast. Backoff/retry is deferred.
- **Scope failure is the dominant first-run error:** an existing read-only token returns `missing_scope` on every write/lookup until the app is re-installed with `chat:write`/`im:write`/`users:read.email`. Detect and route to the re-auth prompt.

## 9. Mockup Brief (feeds Phase 5 / section-redesign)

Surfaces:

1. **Slack channel button in `ChannelRow`** (Focus column). States:
   - *Not linked* (`!slackUserId`): Slack channel is **absent** (current behavior; `channelsFor` doesn't push it). No dead button.
   - *Linked, send flag OFF*: shown, **disabled**, label "Link Slack", tooltip "Slack send arrives in a later phase" (existing `channelsFor.ts:85`, `ChannelRow.tsx:87`).
   - *Linked, send flag ON*: enabled "Slack" button; click opens the inline composer.
2. **"Link Slack" affordance** for an external contact with `email` but no `slackUserId` (when the send flag is ON): a small "Link Slack" action that calls the resolver. States: idle → *loading* (spinner, "Looking up &lt;email&gt;…") → *linked* (button becomes the live Slack button) → *not found* ("No Slack member matches this email" + manual-link hint) → *scope error* ("Slack send needs reinstalling the app with chat:write — open Settings").
3. **Inline DM composer** (Focus column): textarea + Send. States: empty (placeholder "Message &lt;name&gt; on Slack"), typing, *sending* (disabled + spinner), *sent* (transient "Sent on Slack" confirmation), *error* (inline error text from `data.error`, message preserved for retry), *disabled* (flag off / not linked).
4. **Settings scope panel** (`SlackIntegration.tsx`): updated scope list now including `chat:write`, `im:write`, `users:read.email`, with a "Re-install the app to enable sending" note and a connection state showing whether send-capable scopes are present.

Tone notes (CLAUDE.md §4):
- **Slack purple is a channel marker only** — use it for the Slack icon/identity chip, never as chrome, button fill, or accent.
- **Coral is AI-only** — the Slack composer is a human action; no coral except the allowed hover state already in `ChannelRow.tsx:96`. No coral on send/confirmation.
- Neutral chrome via `--pulse-*` tokens; consume, don't redeclare.
- `lucide` brand icons are version-unstable; `ChannelRow` already uses `Hash` for Slack (`:19`) — keep that, optionally tint Slack-purple.

## 10. Risks & Mitigations

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R1 | Guessing `contacts` id/column type for the migration | Med | High | Schema-first: query `information_schema.columns` via MCP; dry-run-rollback migration (§7); column is FK-free/independent of `user_id`. |
| R2 | Bot token lacks `chat:write`/`im:write`/`users:read.email` → `missing_scope` | **High** | Med | Update scope docs; catch `missing_scope` at runtime → re-auth prompt; surface granted scopes from `auth.test`. |
| R3 | Proxy mangles `chat.postMessage` body via query-string `String()` coercion (`server.js:152`) | High (if GET reused) | High | Add the POST-body branch (D-D); v1 text-only keeps payload simple even so. |
| R4 | Token unavailable to Contacts send (build-time env var only) | **High** | High | Persist to `localStorage` + non-React reader (D-C); empty-token state disables send with "Connect Slack in Settings". |
| R5 | `users.lookupByEmail` returns `users_not_found` (contact has no Slack account) | High | Low | Manual "Link Slack" fallback; honest empty-state copy (§9). |
| R6 | `/api/slack/proxy` is an unauthenticated open relay; adding write widens the surface | Med | Med | Flag to user (Q3); do NOT silently add auth (Rule A); recommend a follow-up Supabase Bearer check like `/api/email/*`. |
| R7 | Storing raw `xoxb-` in `localStorage` is readable by any XSS | Med | Med | Per-user only (not shared-config exposure to all members); document; do not log; `.gitleaks.toml:58-59` already guards commits. |
| R8 | No 429/Retry-After handling | Low | Low | Single-shot sends; surface 429 as retry toast; backoff deferred. |
| R9 | Breaking the test-locked `channelsFor`/`ChannelRow` contract | Med | High | Only callers change; add `onSendSlack` prop instead of widening `onAction`; keep all 5 tests green. |
| R10 | DM appears "from the Pulse bot," surprising the operator | Med | Low | UX copy clarifies "Sent via Pulse"; user-send is the deferred v1.1 path. |

## 11. User Decisions — RESOLVED 2026-06-05

All four confirmed **as recommended**:

1. **Identity endpoint → `users.lookupByEmail` (D-B).** One scalar `email→id` call requiring `users:read.email`. This **overrides** the handoff's `users.info`-scan wording (`:166,294`).
2. **Token storage → per-user `localStorage`** key `pulse_slack_bot_token` + a non-React reader (D-C). `workspace_integrations.shared_config` rejected (member-readable under current RLS, unencrypted).
3. **Proxy auth → ship send now, harden later.** The additive POST branch lands this phase; a Supabase Bearer check on `/api/slack/proxy` (an open relay today, `server.js:139-144`) is tracked as a **separate security follow-up**, not a Phase-8 blocker. ⚠️ **Carry this forward as an explicit follow-up item** so it isn't lost.
4. **Send identity → send-as-bot for v1 (D-A).** DMs post from the Pulse bot app ("Sent via Pulse"); send-as-user (OAuth `xoxp-`) stays deferred to v1.1.

## 12. Acceptance Criteria

- Migration applies cleanly after a passing dry-run-rollback; `contacts.slack_user_id text NULL` + partial index + COMMENT exist; no RLS change; `Contact.slackUserId?` present in `types.ts`.
- With `slackSend` flag OFF: Contacts behaves exactly as today — Slack never appears for unlinked contacts; linked-in-tests still renders disabled "Link Slack". All 5 existing `channelsFor`/`ChannelRow` tests pass unchanged.
- With `slackSend` flag ON and a contact that has a `slack_user_id`: the Slack button is enabled; clicking opens the inline composer; sending a non-empty message calls `conversations.open` then `chat.postMessage` through the proxy and shows a "Sent on Slack" confirmation; `slack_sent` increments.
- With `slackSend` ON and a contact with `email` but no `slack_user_id`: a "Link Slack" action resolves via `users.lookupByEmail`, persists `slack_user_id`, and flips the contact to send-ready; a no-match shows the honest "No Slack member matches this email" state.
- A token lacking `chat:write`/`users:read.email` produces a clear `missing_scope` → re-install prompt, not a silent failure; `SlackIntegration.tsx` lists the new scopes.
- `server.js` GET read path (`conversations.list/history`, `users.info`, `auth.test`) is byte-for-byte unchanged; only an additive POST branch is introduced.
- `slackService` has unit tests covering send, resolve, and `missing_scope`/`users_not_found`/`channel_not_found` error branches (mocked proxy fetch).
- No coral on any Slack human-action surface; Slack purple used only as a channel/identity marker; tokens consumed from `--pulse-*`.

## 13. Recommended Next Phase

Resolve the four **Open Questions** (§11) — especially Q1 (identity endpoint), Q2 (token storage), and Q3 (proxy auth) — since they change the Change Set. Then proceed in this order: (1) **schema** sub-step 8a (migration dry-run → apply + `Contact.slackUserId`), the lowest-risk reversible foundation everything else depends on; (2) **proxy** 8b additive POST branch + **service** 8c `slackService` methods with their first unit tests (verifiable in isolation, no UI); (3) **token persistence + scopes** 8d; (4) **flag** 8e; (5) **wiring + inline composer** 8f; (6) **tests/AC** 8g. Hand §8 (API contract) to Phase 2/gateway and §9 (mockup brief) to Phase 5/section-redesign in parallel with sub-step 8a so the surface is designed while the schema lands. Per CLAUDE.md §3, commit each sub-step (8a…8g) independently with explicit paths.
