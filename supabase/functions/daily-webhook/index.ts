// Supabase Edge Function: daily-webhook
// Receives Daily.co webhook events and processes them:
//   recording.ready   → stores recording URL in pulse_video_rooms
//   recording.error   → logs the error to the room record
//
// Setup in Daily dashboard:
//   URL: https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/daily-webhook
//   Events: recording.ready, recording.error
//   Secret: set DAILY_WEBHOOK_SECRET env var + configure in Daily dashboard

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-daily-signature',
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
    const body = await req.json();
    const { type, payload } = body;

    console.log(`[daily-webhook] Received event: ${type}`);

    // Service-role client — no auth header needed, this is a server-to-server call
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── recording.ready ────────────────────────────────────────────────────
    if (type === 'recording.ready') {
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

      // ── Trigger AI summary if transcript exists ──────────────────────────
      // Fetch the room to check for existing transcript
      const { data: room } = await supabase
        .from('pulse_video_rooms')
        .select('transcript, summary, title, created_by')
        .eq('room_name', room_name)
        .single();

      if (room?.transcript && !room?.summary) {
        console.log(`[daily-webhook] Generating AI summary for ${room_name}`);
        const geminiKey = Deno.env.get('GEMINI_API_KEY');

        if (geminiKey) {
          try {
            const prompt = buildSummaryPrompt(room.transcript, room.title ?? 'Meeting');
            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
                }),
              },
            );

            if (geminiRes.ok) {
              const geminiData = await geminiRes.json();
              const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
              const structured = parseStructuredSummary(rawText);

              await supabase
                .from('pulse_video_rooms')
                .update({ summary: JSON.stringify(structured) })
                .eq('room_name', room_name);

              console.log(`[daily-webhook] AI summary saved for ${room_name}`);
            }
          } catch (e) {
            console.error('[daily-webhook] Gemini summary failed:', e);
          }
        }
      }

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

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildSummaryPrompt(transcript: string, title: string): string {
  return `You are an expert meeting summarizer. Analyze this meeting transcript and return a JSON object.

Meeting title: "${title}"

Transcript:
${transcript.slice(0, 8000)}

Return ONLY valid JSON with this exact structure:
{
  "aiSummary": "2-3 sentence executive summary of the meeting",
  "keyPoints": ["key point 1", "key point 2", "..."],
  "actionItems": [
    { "text": "action description", "owner": "person name or empty string", "priority": "high|medium|low" }
  ],
  "decisions": ["decision 1", "decision 2", "..."],
  "topics": ["topic 1", "topic 2", "..."],
  "sentiment": "positive|neutral|mixed|tense"
}`;
}

function parseStructuredSummary(raw: string): Record<string, unknown> {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: return raw text as summary
    return { aiSummary: raw, keyPoints: [], actionItems: [], decisions: [], topics: [], sentiment: 'neutral' };
  }
}
