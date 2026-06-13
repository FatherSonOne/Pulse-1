# Email Push for Pulse: Server-Side Gmail watch -> Pub/Sub -> push-receiver

Status: PLAN (decision-ready, no code written)
Date: 2026-06-13
Owner: solo
Scope: deliver a Web Push notification when a new email lands in the owner's Gmail, mirroring the inbound-DM push shipped this session.

## 1. Why email cannot reuse the DM trigger

The DM push (this session) works because both Pulse-native DMs and Slack-grounded DMs terminate at an `INSERT INTO public.pulse_messages`, so an `AFTER INSERT` trigger (`public.notify_on_pulse_message`, `supabase/migrations/20260613000000_push_on_pulse_message.sql:26`) fires inside Postgres and calls `send-push` via `net.http_post` (`:82`).

Email has no such server-side insert. New mail reaches Pulse ONLY when the browser tab is open and `emailSyncService.fullSync()` runs (`src/services/emailSyncService.ts:180`), which pulls from Gmail client-side via `getGmailService()` (`:212`) and only then upserts rows into `cached_emails` (`:397`). The `cached_emails` insert is client-driven, so a trigger on it would not fire when the tab is closed, which is exactly the case push must cover. The migration's own header already calls this out as deliberately out of scope (`20260613000000_push_on_pulse_message.sql:22`).

Confirmed in code: `gmailService.ts` has `getHistory(startHistoryId, ...)` (`src/services/gmailService.ts:943`) but NO `users.watch` call. A repo-wide grep for `users.watch` / `pubsub` returns zero hits in source (only the migration comment). So the watch -> Pub/Sub path is fully net-new.

## 2. Target architecture (server-side, tab-independent)

```
Gmail mailbox (owner)
  | users.watch  (renewed every <7 days by cron)
  v
Google Cloud Pub/Sub topic  (projects/<gcp>/topics/pulse-gmail-push)
  | push subscription -> HTTPS POST
  v
NEW edge function: gmail-push-receiver  (verify_jwt = false)
  1. verify the Pub/Sub message (OIDC token audience + sender)
  2. decode { emailAddress, historyId } from message.data (base64)
  3. mint a Gmail access token from the stored grant (refresh_token in user_gmail_tokens)
  4. gmail.history.list(startHistoryId = stored history_id, historyTypes=messageAdded, labelIds=INBOX)
  5. for each NEW inbound message: build a preview (From + Subject)
  6. call send-push (Authorization: Bearer <cron_secret>) for the owner's user_id
  7. persist the new history_id back to email_sync_state
```

Single-tenant reality: this is owner-only mail (one Gmail grant, the `MEMORY.md` "Google Token Refresh" client 323300 in a Testing project). `watch` is set on one mailbox; the receiver resolves exactly one `user_id`. No fan-out needed for v1.

### Why this shape

- `send-push` already accepts `CRON_SECRET` as an alternate to `PUSH_DISPATCH_SECRET` (`supabase/functions/send-push/index.ts:55`, auth check `:98`), and the DM trigger already proved the vault `cron_secret` path end-to-end. The receiver reuses that exact secret. No new project secret.
- The receiver is server-side, so it works with the tab closed, which is the whole point.
- `history.list` is the cheap delta API the client already uses; the receiver just runs it server-side with the stored `history_id`.

## 3. Storage needed

Ground truth (verified):

- `public.email_sync_state` has `history_id text` (`supabase/migrations/20260119062007_remote_schema.sql:6201`), `user_id uuid` UNIQUE (`:9821`), RLS on with owner-only policies (`:15161`, `:15430`, `:15704`), and `service_role` is granted ALL (`:19046`). There is NO watch-expiration column today.
- `public.user_gmail_tokens` holds `refresh_token / access_token / expiry_date / scope` (`supabase/migrations/20260603120000_user_gmail_tokens.sql:13`), RLS on, no anon/auth policies (server service-role only). No watch state.

Decision: add watch bookkeeping to `email_sync_state` (it already owns `history_id`, keeping all sync cursors in one row). New columns via a small additive migration:

```sql
ALTER TABLE public.email_sync_state
  ADD COLUMN IF NOT EXISTS watch_expiration   timestamptz,
  ADD COLUMN IF NOT EXISTS watch_history_id   text,
  ADD COLUMN IF NOT EXISTS watch_topic        text,
  ADD COLUMN IF NOT EXISTS watch_last_renewed timestamptz;
```

- `watch_history_id`: the `historyId` returned by `users.watch` (the floor to start `history.list` from on the FIRST push after a (re)watch; thereafter the receiver advances `history_id` as it processes).
- `watch_expiration`: the `expiration` returned by `watch` (epoch ms -> store as timestamptz); the renewal cron keys off this.
- The receiver and the renewal job run server-side with the service-role key, which bypasses RLS (same pattern the backend uses for `user_gmail_tokens`), so no new policies are required.

Note on the existing `history_id`: today the CLIENT writes it (`emailSyncService.ts:246`, `:337`). With server-side watch in play, BOTH the client sync and the receiver will advance `history_id`. That is a known, benign race: `history.list` from a slightly stale id just replays a few already-cached messages (idempotent upsert on `cached_emails.id`, `emailSyncService.ts:399`/`:427`). Push dedup is handled separately (section 6).

## 4. Watch renewal cron (watch expires ~7 days)

Gmail `users.watch` expires in 7 days max and must be re-issued. Mirror the existing pg_cron pattern exactly (`supabase/migrations/20260301000001_schedule_search_alerts.sql`, hardened to vault in `20260503000007_cron_secret_via_vault.sql:40`).

Two viable hosts for the renewal call. Recommend (a):

(a) Cron -> a backend route `POST /api/gmail/watch/renew` (server.js). The backend already has the Gmail OAuth client + refresh logic (`server.js:611` refresh-token route, `:534` token upsert) and a clean place to call `gmail.users.watch`. Cron authenticates with the vault `cron_secret`.

(b) Cron -> a watch-renewer edge function that itself refreshes the Gmail token. This duplicates the OAuth refresh that already lives in server.js. Avoid.

Cron job (daily is safe for a 7-day TTL, and re-watching is idempotent):

```sql
SELECT cron.schedule(
  'gmail-watch-renew',
  '0 6 * * *',                              -- daily 06:00 UTC
  $$
  SELECT net.http_post(
    url     := '<VITE_BACKEND_URL>/api/gmail/watch/renew',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'cron_secret' LIMIT 1)
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

The renew route: refresh the Gmail token (reuse the `oauth2.googleapis.com/token` exchange at `server.js:622`), call `gmail.users.watch({ userId:'me', requestBody:{ topicName, labelIds:['INBOX'], labelFilterBehavior:'include' }})`, then upsert `watch_expiration` + `watch_history_id` into `email_sync_state`. Gating: skip when `isEmailEnabled` is OFF (section 7) and when there is no stored grant (`getUserGmailToken` returns null, `server.js:618`).

Backend reality: `VITE_BACKEND_URL` must point at the Render backend (`pulse-api-1epw.onrender.com` per MEMORY "Pulse Backend Deployed"). The cron URL is the same origin Slack/Gmail routes already use; if it is unset the route is unreachable (same failure mode the rest of `/api/gmail/*` has today).

## 5. Human-gated Google Cloud steps (one-time, owner-owned)

These cannot be scripted from this repo; they are console/gcloud actions in the SAME GCP project that owns the private Gmail OAuth client (Testing project, MEMORY "Google Token Refresh"):

1. Enable the Cloud Pub/Sub API in that project.
2. Create a topic, e.g. `projects/<gcp-project>/topics/pulse-gmail-push`.
3. Grant Gmail's service account publish rights on the topic:
   `gcloud pubsub topics add-iam-policy-binding pulse-gmail-push --member=serviceAccount:gmail-api-push@system.gserviceaccount.com --role=roles/pubsub.publisher`
   (Gmail `watch` fails with a permission error without this exact binding.)
4. Create a PUSH subscription on the topic with endpoint =
   `https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/gmail-push-receiver`
   and enable OIDC token auth (set a service account + audience) so the receiver can verify the caller.
5. Record `<gcp-project>` topic name as a backend env var (e.g. `GMAIL_PUSH_TOPIC`) and the OIDC audience as an edge-function secret (e.g. `GMAIL_PUSH_AUDIENCE`).
6. Confirm the Gmail grant carries `gmail.readonly` (it does: `server.js:61`), which is the scope `watch` + `history.list` require. No Pub/Sub OAuth scope is needed on the user grant; publish is authorized by the topic IAM binding in step 3, not by the user token.

Deliver these as a short runbook appended to `docs/LIVE_ENV_RUNBOOK.md` (which already documents `user_gmail_tokens`).

## 6. The new edge function: gmail-push-receiver

- Deploy with `verify_jwt = false` (Pub/Sub posts an OIDC token, not a Supabase JWT). This mirrors the Slack-channel edge branch in MEMORY that also runs `verify_jwt=false`.
- Verify the request: confirm the Google-signed OIDC token in the `Authorization` header has the expected audience (`GMAIL_PUSH_AUDIENCE`) and issuer (`accounts.google.com`). Reject otherwise. This is the security boundary, since the endpoint is public.
- Pub/Sub messages can arrive duplicated and out of order, and `watch` itself fires on ANY history change (including label changes and SENT). Dedup + filter in the receiver:
  - Only treat `messagesAdded` entries whose `labelIds` include `INBOX` and exclude `SENT`/`DRAFT` as notify-worthy (the same flag logic the client uses, `emailSyncService.ts:382`).
  - Track the last-pushed Gmail message id (the receiver can read `cached_emails` by `id = <userId>-<gmailId>`, `emailSyncService.ts:399`, or keep a tiny last-notified marker). Skip if already pushed.
- Reuse `send-push` verbatim: `POST .../functions/v1/send-push` with `Authorization: Bearer <CRON_SECRET>`, body `{ user_id, notification:{ title, body, tag:'email-'+threadId, actionUrl:'/?view=email&thread='+threadId, data:{ type:'email', ... } } }`. The DM trigger is the exact template (`20260613000000_push_on_pulse_message.sql:82`).
- ALWAYS return 200 quickly so Pub/Sub does not retry-storm; do the Gmail fetch but never 500 on a transient (swallow + ack), matching the DM trigger's "never block" stance (`:107`).

## 7. emailEnabled gating consideration

`emailEnabled` defaults OFF and is a CLIENT localStorage flag (`src/lib/emailFeature.ts:17`, reads `pulse_feature_flags` from `window.localStorage`). The server has no access to it. So:

- The watch + receiver + renewal cron are SERVER-SIDE and cannot read the client flag. The honest gate is "is there a stored Gmail grant?" (`user_gmail_tokens` row exists). No grant -> no watch -> no push. Today the only way a grant exists is if the owner connected Gmail, which requires turning Email on first (`getAccessToken` throws `EmailDisabledError` when off, `gmailService.ts:148`). So "grant present" is a reasonable server-side proxy for "email is in use."
- Cleaner option: have the watch-renew route ALSO stop the watch (`users.stop`) and clear `watch_expiration` when the owner disconnects Gmail (`DELETE /api/gmail/disconnect`, `server.js:663`). That makes disconnect the real off-switch server-side. Recommend wiring `users.stop` into the existing disconnect handler.
- Do NOT try to mirror the localStorage flag to the server for v1; it adds a sync surface for a single-owner feature. Gate on grant-present + a backend env switch (`GMAIL_PUSH_ENABLED`) you can flip without a deploy.

## 8. Effort estimate

Overall: M (roughly 1 to 1.5 focused days of code, plus the one-time human GCP setup).

- Migration (4 columns on `email_sync_state`): S, ~15 min, additive and reversible.
- Backend `/api/gmail/watch/renew` + `users.stop` on disconnect: S-M, reuses existing token refresh.
- `gmail-push-receiver` edge function (OIDC verify + history.list + dedup + send-push): M, the real work is the verify + dedup correctness.
- Renewal cron migration: S, copy of the existing pattern.
- Human GCP steps (topic + IAM + push subscription + OIDC): S in wall-clock but BLOCKING and owner-only; nothing ships until these exist.
- Live verification (send self a test email, watch the push land with tab closed): M, includes the inevitable IAM/audience misconfig round-trip.

## 9. Risks

- Testing-project 7-day refresh-token death. The Gmail grant lives in a Testing OAuth project whose refresh token expires ~7 days (MEMORY "Google Token Refresh"; `server.js:634` already handles `invalid_grant` by deleting the grant). When the grant dies, the renewal cron cannot refresh, `watch` lapses, and push silently stops until the owner reconnects. This is the dominant reliability risk and is inherited from the existing email stack, not introduced here. Mitigation: on `invalid_grant` during renew, optionally fire ONE push telling the owner to reconnect Gmail.
- Public endpoint abuse. `gmail-push-receiver` is `verify_jwt=false` and public. If OIDC verification is weak, anyone could POST it. Mitigation: strict audience + issuer check; treat the body as untrusted and always re-fetch from Gmail (never trust the posted historyId as authoritative for content).
- Pub/Sub at-least-once + watch fires on all history. Without the INBOX-only + dedup filter (section 6), the owner gets pushes for their own SENT mail, label changes, and duplicates. Mitigation is in the receiver logic.
- history_id divergence between client sync and receiver. Both advance `history_id`; a stale floor replays already-cached messages. Benign for caching (idempotent upsert) but could double-push if dedup keys only on history_id. Mitigation: dedup on Gmail message id, not on history cursor.
- VITE_BACKEND_URL unset in prod. The renewal cron hits the backend origin; if that env is wrong the watch never renews and the whole feature degrades to nothing (same class of failure as the rest of `/api/gmail/*`). Mitigation: include a watch-health check (alert if `watch_expiration` is in the past).
- Scope creep to multi-user. Everything here is single-owner. If Pulse ever supports per-user Gmail, the receiver must resolve `emailAddress -> user_id` and fan out; the `email_sync_state` row is already per-user, so the data model survives, but the watch-renewal loop becomes per-grant.

## 10. Recommendation

Proceed with the watch -> Pub/Sub -> `gmail-push-receiver` -> `send-push` architecture, storing watch state on `email_sync_state`, renewing via a daily backend route called by pg_cron (vault `cron_secret`), gated server-side on grant-present + a `GMAIL_PUSH_ENABLED` backend switch. It maximally reuses what shipped this session (`send-push` + vault secret + cron pattern) and adds exactly one new edge function plus a 4-column additive migration. The human-gated GCP topic/IAM/subscription steps are the true prerequisite and should be sequenced first, since no code path works until the topic publishes.
