// Supabase Edge Function: daily-webhook
// Receives Daily.co webhook events and processes them:
//   recording.ready-to-download → stores recording URL in pulse_video_rooms
//   recording.error             → logs the error to the room record
//
// Setup:
//   1. config.toml declares [functions.daily-webhook] verify_jwt = false —
//      Daily sends NO Supabase JWT, so the gateway would 401 otherwise.
//   2. Create the webhook via Daily's REST API (POST /v1/webhooks) for events
//      ['recording.ready-to-download','recording.error'] → this URL. Daily
//      returns an `hmac` (base64) secret; store it as DAILY_WEBHOOK_SECRET (or
//      pass your own base64 secret on creation).
//   3. Auth is the HMAC-SHA256 of `${X-Webhook-Timestamp}.${rawBody}` using the
//      base64-DECODED secret, base64-encoded and matched against the
//      X-Webhook-Signature header (verified inside this fn below).
//
// Note: summarization is intentionally NOT done here — the client handleLeave
// path generates the meeting summary via ai-router (metered, CLAUDE.md §4). This
// fn only persists recording_url so recordings become playable.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ── Daily HMAC signature verification (Web Crypto, no extra deps) ─────────────
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Daily signs `${timestamp}.${rawBody}` with HMAC-SHA256 using the base64-decoded
// secret, then base64-encodes the result. See docs.daily.co/reference/rest-api/webhooks.
async function verifyDailySignature(
  secretB64: string,
  timestamp: string,
  rawBody: string,
  signatureB64: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      b64ToBytes(secretB64),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
    return timingSafeEqual(bytesToB64(new Uint8Array(mac)), signatureB64);
  } catch (e) {
    console.error('[daily-webhook] signature verification threw:', e);
    return false;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Read the raw body FIRST — the signature is computed over the exact bytes
    // Daily sent, so we must verify before JSON.parse (a re-stringify can differ).
    const rawBody = await req.text();

    // ── Verify Daily's HMAC signature ────────────────────────────────────────
    const secret = Deno.env.get('DAILY_WEBHOOK_SECRET');
    if (!secret) {
      console.error('[daily-webhook] DAILY_WEBHOOK_SECRET not configured — refusing unverified webhook');
      return json({ error: 'webhook secret not configured' }, 500);
    }
    const signature = req.headers.get('X-Webhook-Signature');
    const timestamp = req.headers.get('X-Webhook-Timestamp');
    if (!signature || !timestamp) {
      return json({ error: 'missing signature headers' }, 401);
    }
    if (!(await verifyDailySignature(secret, timestamp, rawBody, signature))) {
      console.warn('[daily-webhook] invalid signature — rejecting');
      return json({ error: 'invalid signature' }, 401);
    }

    const body = JSON.parse(rawBody);
    const { type, payload } = body;

    console.log(`[daily-webhook] Received event: ${type}`);

    // Service-role client — no auth header needed, this is a server-to-server call
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── recording.ready-to-download ──────────────────────────────────────────
    // Daily's event type is 'recording.ready-to-download' (not 'recording.ready')
    // — see docs.daily.co/reference/rest-api/webhooks/events.
    if (type === 'recording.ready-to-download') {
      const {
        room_name,
        recording_id,
        s3_key,
        s3_bucket,
        // Daily provides a share_token for constructing the streaming URL
        share_token,
        // Duration in seconds
        duration,
        // Timestamp
        start_ts,
      } = payload ?? {};

      if (!room_name) {
        console.error('[daily-webhook] recording.ready missing room_name');
        return json({ error: 'missing room_name' }, 400);
      }

      // Build the access URL — Daily recordings are accessible via share token
      // Format: https://api.daily.co/v1/recordings/{recording_id}/access-link
      // We'll store the recording_id and fetch the access link on demand
      const dailyApiKey = Deno.env.get('DAILY_API_KEY')!;
      let recordingUrl: string | null = null;

      if (recording_id && dailyApiKey) {
        try {
          const linkRes = await fetch(
            `https://api.daily.co/v1/recordings/${recording_id}/access-link`,
            { headers: { Authorization: `Bearer ${dailyApiKey}` } },
          );
          if (linkRes.ok) {
            const linkData = await linkRes.json();
            recordingUrl = linkData.download_link ?? null;
          }
        } catch (e) {
          console.warn('[daily-webhook] Could not fetch access link:', e);
        }
      }

      const { error } = await supabase
        .from('pulse_video_rooms')
        .update({
          recording_id,
          recording_url: recordingUrl,
          duration_seconds: duration ?? null,
          status: 'ended',
          ended_at: start_ts ? new Date(start_ts * 1000 + (duration ?? 0) * 1000).toISOString() : new Date().toISOString(),
        })
        .eq('room_name', room_name);

      if (error) {
        console.error('[daily-webhook] DB update failed:', error);
        return json({ error: error.message }, 500);
      }

      console.log(`[daily-webhook] Recording ready for room ${room_name}: ${recording_id}`);

      // Summarization is intentionally NOT done here — see header note. The
      // client handleLeave path already produces the summary via ai-router
      // (metered, CLAUDE.md §4). This fn only persists recording_url.

      return json({ success: true, recording_id });
    }

    // ── recording.error ────────────────────────────────────────────────────
    if (type === 'recording.error') {
      const { room_name, error: dailyError } = payload ?? {};
      console.error(`[daily-webhook] Recording error for ${room_name}:`, dailyError);

      if (room_name) {
        await createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        )
          .from('pulse_video_rooms')
          .update({ status: 'ended' })
          .eq('room_name', room_name);
      }

      return json({ received: true });
    }

    // Acknowledge unknown events
    return json({ received: true, type });

  } catch (err) {
    console.error('[daily-webhook] Error:', err);
    return json({ error: err.message ?? 'Internal server error' }, 500);
  }
});
