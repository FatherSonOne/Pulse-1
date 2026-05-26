# send-push — Web Push (VAPID) sender

Server-side dispatcher for Web Push notifications. It reads active rows from
`push_subscriptions`, signs the request with the VAPID keypair, and POSTs the
encrypted push to each browser's push service. The service worker
(`public/sw-notifications.js`) renders the notification from the JSON payload.

This is a **server-to-server** function. It is guarded by a shared secret
(`PUSH_DISPATCH_SECRET`) — it is not meant to be called from the browser.

## API

`POST /functions/v1/send-push`

Header (one of):
- `Authorization: Bearer <PUSH_DISPATCH_SECRET>`
- `x-push-secret: <PUSH_DISPATCH_SECRET>`

Body:

```jsonc
{
  "user_id": "uuid",            // or "user_ids": ["uuid", ...]
  "notification": {
    "title": "string",          // required
    "body": "string",           // required
    "icon": "string",           // optional (sw defaults to /icons/icon-192.svg)
    "badge": "string",          // optional
    "tag": "string",            // optional
    "priority": "urgent",       // optional ("urgent" => requireInteraction + stronger vibrate)
    "actionUrl": "string",      // optional (click-through URL)
    "actions": [],              // optional
    "image": "string",          // optional
    "data": {}                  // optional
  }
}
```

Response: `{ "sent": N, "failed": N, "deactivated": N, "total": N }`

`deactivated` counts subscriptions the push service reported as gone
(HTTP 404/410); those rows are flipped to `is_active = false` automatically.

## Human-owned deploy steps

These cannot be done by an automated agent — they require generating real
secrets and running deploy commands. **Do not paste real keys into the repo.**

### 1. Generate a VAPID keypair

```bash
npx web-push generate-vapid-keys
```

This prints a `Public Key:` and `Private Key:` pair. Keep the private key secret.

### 2. Set the Supabase secrets for `send-push`

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=<public-key-from-step-1> \
  VAPID_PRIVATE_KEY=<private-key-from-step-1> \
  VAPID_SUBJECT=mailto:alerts@pulse.logosvision.org \
  PUSH_DISPATCH_SECRET=<a-long-random-string>
```

Generate `PUSH_DISPATCH_SECRET` with e.g. `openssl rand -hex 32`.

### 3. Make sure `check-search-alerts` can call `send-push`

`check-search-alerts` reads the SAME `PUSH_DISPATCH_SECRET` to authorize its
best-effort push. Secrets are project-wide in Supabase, so step 2 already
covers it — just confirm `check-search-alerts` is deployed with that secret set.

### 4. Set the public key on the frontend (Vercel)

The client uses the public key to subscribe. Set it to the **same** public key
from step 1:

```
VITE_VAPID_PUBLIC_KEY=<public-key-from-step-1>
```

### 5. Update the DB fallback row

The client's DB fallback reads `pwa_settings.vapid_public_key` (the migration
seeds it with the placeholder `REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY`). Replace it
with the real public key so the fallback matches the env var:

```sql
UPDATE pwa_settings
SET value = '<public-key-from-step-1>', updated_at = now()
WHERE key = 'vapid_public_key';
```

### 6. Deploy the function

```bash
supabase functions deploy send-push
```

### 7. Live end-to-end test (browser-only — the only true verification)

1. In a supported browser, open Pulse and grant notification permission so a
   row lands in `push_subscriptions` (confirm `is_active = true`).
2. Note that user's `user_id`.
3. Invoke the function:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-push" \
  -H "x-push-secret: $PUSH_DISPATCH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "<that-user-id>",
    "notification": { "title": "Pulse", "body": "Push is live", "tag": "test", "actionUrl": "/" }
  }'
```

4. Confirm a notification appears on the device and the response shows
   `"sent": 1`. This device-level delivery cannot be verified headless.
