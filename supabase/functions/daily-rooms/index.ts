// Supabase Edge Function: daily-rooms
// Proxies all Daily.co API calls server-side so the API key is never exposed to clients.
// Actions: create-room | create-token | start-recording | stop-recording | get-recordings | delete-room

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const DAILY_API = 'https://api.daily.co/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function dailyFetch(path: string, options: RequestInit = {}) {
  const apiKey = Deno.env.get('DAILY_API_KEY');
  if (!apiKey) throw new Error('DAILY_API_KEY not configured');

  const res = await fetch(`${DAILY_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daily API error ${res.status}: ${text}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ── Auth check — all actions require a valid Supabase session ─────────────
    // supabase-js v2: getUser() WITHOUT a token argument looks for a session in
    // client-side storage (which doesn't exist on the server). Passing the JWT
    // explicitly is the only correct way to validate a user-supplied bearer
    // token from inside an edge function. The previous version called getUser()
    // with no argument and silently failed for every authenticated request with
    // "Auth session missing!" — easy to miss because the function returned the
    // expected 401 without surfacing the underlying error.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);
    const userToken = authHeader.slice(7);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: getUserError } = await supabase.auth.getUser(userToken);
    if (!user) {
      console.warn('[daily-rooms] getUser rejected token:', getUserError?.message ?? 'unknown');
      return json({ error: 'Invalid token' }, 401);
    }

    const body = await req.json();
    const { action } = body;

    // ── create-room ───────────────────────────────────────────────────────────
    if (action === 'create-room') {
      const { eventId, title } = body;

      // Generate a deterministic room name from eventId (or random for instant meetings)
      const roomName = eventId
        ? `pulse-${eventId.replace(/-/g, '').slice(0, 16)}`
        : `pulse-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

      // Check if room already exists
      try {
        const existing = await dailyFetch(`/rooms/${roomName}`);
        // If we get here, room exists — return it
        console.log(`[daily-rooms] Reusing existing room: ${roomName}`);

        // Upsert to pulse_video_rooms
        await supabase.from('pulse_video_rooms').upsert({
          room_name: roomName,
          room_url: existing.url,
          calendar_event_id: eventId ?? null,
          created_by: user.id,
        }, { onConflict: 'room_name' });

        return json({ roomUrl: existing.url, roomName });
      } catch {
        // Room doesn't exist — create it
      }

      const room = await dailyFetch('/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name: roomName,
          properties: {
            max_participants: 50,
            enable_recording: 'cloud',
            enable_transcription: 'deepgram',
            start_video_off: false,
            start_audio_off: false,
            enable_chat: true,
            enable_prejoin_ui: true,
            lang: 'en',
            // Room expires 24 hours after creation
            exp: Math.floor(Date.now() / 1000) + 86400,
          },
        }),
      });

      console.log(`[daily-rooms] Created room: ${room.name} for user ${user.id}`);

      // Store in Supabase
      await supabase.from('pulse_video_rooms').upsert({
        room_name: room.name,
        room_url: room.url,
        calendar_event_id: eventId ?? null,
        created_by: user.id,
        title: title ?? 'Pulse Meeting',
      }, { onConflict: 'room_name' });

      return json({ roomUrl: room.url, roomName: room.name });
    }

    // ── create-token ──────────────────────────────────────────────────────────
    if (action === 'create-token') {
      const { roomName, isOwner = false, displayName } = body;
      if (!roomName) return json({ error: 'roomName required' }, 400);

      const tokenData = await dailyFetch('/meeting-tokens', {
        method: 'POST',
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            is_owner: isOwner,
            user_name: displayName ?? user.email?.split('@')[0] ?? 'Guest',
            user_id: user.id,
            // Token expires in 4 hours
            exp: Math.floor(Date.now() / 1000) + 14400,
            enable_recording: isOwner ? 'cloud' : undefined,
          },
        }),
      });

      return json({ token: tokenData.token });
    }

    // ── start-recording ───────────────────────────────────────────────────────
    if (action === 'start-recording') {
      const { roomName } = body;
      if (!roomName) return json({ error: 'roomName required' }, 400);

      // Update room status in Supabase
      await supabase
        .from('pulse_video_rooms')
        .update({ status: 'recording' })
        .eq('room_name', roomName);

      // Recording is started via daily.startRecording() on client-side
      // This action just updates our DB state
      return json({ success: true });
    }

    // ── stop-recording ────────────────────────────────────────────────────────
    if (action === 'stop-recording') {
      const { roomName } = body;
      if (!roomName) return json({ error: 'roomName required' }, 400);

      await supabase
        .from('pulse_video_rooms')
        .update({ status: 'ended' })
        .eq('room_name', roomName);

      return json({ success: true });
    }

    // ── get-recordings ────────────────────────────────────────────────────────
    if (action === 'get-recordings') {
      const { roomName } = body;
      if (!roomName) return json({ error: 'roomName required' }, 400);

      const data = await dailyFetch(`/recordings?room_name=${encodeURIComponent(roomName)}`);
      return json({ recordings: data.data ?? [] });
    }

    // ── get-recording-link ────────────────────────────────────────────────────
    if (action === 'get-recording-link') {
      const { recordingId } = body;
      if (!recordingId) return json({ error: 'recordingId required' }, 400);

      const data = await dailyFetch(`/recordings/${recordingId}/access-link`);
      return json({ url: data.download_link ?? data.link ?? null });
    }

    // ── save-transcript ───────────────────────────────────────────────────────
    if (action === 'save-transcript') {
      const { roomName, transcript, summary } = body;
      if (!roomName) return json({ error: 'roomName required' }, 400);

      await supabase
        .from('pulse_video_rooms')
        .update({ transcript, summary, status: 'ended' })
        .eq('room_name', roomName);

      return json({ success: true });
    }

    // ── delete-room ───────────────────────────────────────────────────────────
    if (action === 'delete-room') {
      const { roomName } = body;
      if (!roomName) return json({ error: 'roomName required' }, 400);

      try {
        await dailyFetch(`/rooms/${roomName}`, { method: 'DELETE' });
      } catch {
        // Room may already be expired — that's fine
      }

      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    console.error('[daily-rooms] Error:', err);
    return json({ error: err.message ?? 'Internal server error' }, 500);
  }
});
