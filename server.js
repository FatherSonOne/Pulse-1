import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { google } from 'googleapis';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const app = express();
// Hosts like Render/Railway/Fly inject the port to bind via $PORT; fall back to
// 3003 for local dev. Binding the wrong port makes platform health checks fail.
const PORT = process.env.PORT || 3003;

// .trim() all three: a trailing space/newline in an env value breaks the Supabase
// client with "Invalid API key" (the same whitespace footgun that hit the Slack
// redirect_uri). Valid URLs/keys never carry surrounding whitespace.
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || '').trim();

// Google OAuth configuration.
//
// IMPORTANT: there are TWO distinct Google OAuth clients in play.
//  - GOOGLE_CLIENT_ID/SECRET below is the *logos-vision* integration client
//    (server-side Contacts sync, redirect …/logos-vision/auth/callback). It
//    mints the tokens stored in public.google_oauth_tokens (keyed by
//    workspace_id). Leave this as-is.
//  - The interactive Pulse LOGIN goes through Supabase's Google provider, which
//    uses a DIFFERENT client (matches VITE_GOOGLE_CLIENT_ID, 35770…). A Google
//    refresh token can only be refreshed by the client that minted it, so the
//    /api/google/refresh-token endpoint MUST use the login client's
//    credentials below — not the logos-vision client.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

// Login client (the one configured in the Supabase dashboard Google provider).
// GOOGLE_LOGIN_CLIENT_ID falls back to VITE_GOOGLE_CLIENT_ID since that is the
// same value; GOOGLE_LOGIN_CLIENT_SECRET must be set server-side (copy it from
// Supabase → Auth → Providers → Google → Client Secret). NEVER VITE_-prefix it.
const GOOGLE_LOGIN_CLIENT_ID =
  process.env.GOOGLE_LOGIN_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_LOGIN_CLIENT_SECRET = process.env.GOOGLE_LOGIN_CLIENT_SECRET;

// Gmail private client — a THIRD OAuth client in its OWN GCP project kept in
// "Testing" so the restricted Gmail scopes work for the owner (test user) with
// no CASA. Used only by the owner-only Gmail connect flow (/api/gmail/auth/*);
// the production login client (35770) stays CASA-free. Never VITE_-prefix.
// .trim() guards the paste footgun: a trailing space/newline in the Render env
// value gets URL-encoded into the OAuth request (client_id=…%0A, redirect_uri
// =…/callback\n) → Google rejects with invalid_request "doesn't comply with
// OAuth 2.0 policy" (confirmed live: the authorize URL carried client_id=…%0A).
// Same paste-footgun fix already applied to the Slack/Supabase reads (b4d39fe,
// da52d0b). ?.trim() is null-safe — undefined stays undefined so gmailConfigured() still reports not-configured.
const GMAIL_OAUTH_CLIENT_ID = process.env.GMAIL_OAUTH_CLIENT_ID?.trim();
const GMAIL_OAUTH_CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET?.trim();
const GMAIL_OAUTH_REDIRECT_URI = process.env.GMAIL_OAUTH_REDIRECT_URI?.trim();
const GMAIL_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
];

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Google Contacts API scopes
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/contacts.other.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

const getSupabaseClient = (req) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase env vars not configured');
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    const error = new Error('Missing Authorization token');
    error.status = 401;
    throw error;
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};

const getUserId = async (supabase) => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    const err = new Error('Unable to resolve user');
    err.status = 401;
    throw err;
  }
  return data.user.id;
};

// Enable CORS for the Vite dev server and production deployments
app.use(cors({
  origin: [
    // Development origins
    'http://localhost:3002',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5182',  // Logos Vision CRM
    'http://localhost:5176',  // Logos Vision CRM (alternate port)
    'http://localhost:5173',  // Vite dev server default port

    // Production origins from environment variables
    process.env.VITE_APP_URL,
    process.env.VITE_API_URL,
    process.env.PRODUCTION_URL,

    // Vercel preview and production deployments
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,

    // Hardcoded production URL (fallback)
    'https://pulse.logosvision.org',

    // Support Vercel preview deployments with regex pattern
  ].filter(Boolean).concat([
    // Regex patterns for dynamic preview URLs
    /^https:\/\/.*\.vercel\.app$/,
    /^https:\/\/pulse.*\.vercel\.app$/
  ]),
  credentials: true
}));

app.use(express.json());

// Slack API Proxy endpoint
app.post('/api/slack/proxy', async (req, res) => {
  const { endpoint, token, params, method } = req.body;

  if (!endpoint || !token) {
    return res.status(400).json({ error: 'Missing endpoint or token' });
  }

  // Phase 8 (Slack send): write methods (chat.postMessage, conversations.open,
  // users.lookupByEmail) need an HTTP POST with a JSON body — structured args
  // (channel, text, users) would be String()-mangled onto the query string by
  // the read path below. Reads stay on the original GET-with-query-params path,
  // unchanged. Opt in by passing method:'POST' in the request body.
  const isWrite = String(method || 'GET').toUpperCase() === 'POST';

  try {
    const url = new URL(`https://slack.com/api/${endpoint}`);

    if (isWrite) {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(params || {}),
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({ error: data.error || 'Slack API request failed' });
      }

      return res.json(data);
    }

    // Add query parameters
    if (params) {
      Object.keys(params).forEach(key => {
        url.searchParams.append(key, String(params[key]));
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'Slack API request failed' });
    }

    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Gmail API Proxy endpoint
app.post('/api/gmail/proxy', async (req, res) => {
  const { endpoint, token, params } = req.body;

  if (!endpoint || !token) {
    return res.status(400).json({ error: 'Missing endpoint or token' });
  }

  try {
    const url = new URL(`https://gmail.googleapis.com/gmail/v1/${endpoint}`);

    // Add query parameters
    if (params) {
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, String(v)));
        } else {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'Gmail API request failed' });
    }

    res.json(data);
  } catch (error) {
    console.error('Gmail proxy error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Twilio API Proxy endpoint
app.post('/api/twilio/proxy', async (req, res) => {
  const { endpoint, accountSid, authToken, params } = req.body;

  if (!accountSid || !authToken) {
    return res.status(400).json({ error: 'Missing accountSid or authToken' });
  }

  try {
    // Build Twilio API URL
    const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
    const url = endpoint ? `${baseUrl}/${endpoint}` : `${baseUrl}.json`;

    // Add query parameters
    const fullUrl = new URL(url);
    if (params) {
      Object.keys(params).forEach(key => {
        fullUrl.searchParams.append(key, String(params[key]));
      });
    }

    // Basic Auth for Twilio (accountSid:authToken)
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(fullUrl.toString(), {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Twilio API request failed' });
    }

    res.json(data);
  } catch (error) {
    console.error('Twilio proxy error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ==========================
// GOOGLE OAUTH TOKEN REFRESH
// ==========================
// This endpoint securely refreshes Google OAuth tokens using the client secret
// The client secret MUST be kept on the backend and never exposed to the frontend
// ── Per-user Google LOGIN token store (public.user_google_tokens) ───────────
// Distinct from storeGoogleTokens/getGoogleTokens (google_oauth_tokens, the
// logos-vision integration keyed by workspace_id). Uses the service-role client
// so RLS (deny-all to clients) is bypassed; the refresh_token never leaves the
// server.
function tokenStoreClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

async function getUserGoogleToken(userId) {
  const { data, error } = await tokenStoreClient()
    .from('user_google_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[Google Token] getUserGoogleToken error:', error);
    return null;
  }
  return data;
}

async function upsertUserGoogleToken(userId, fields) {
  const { error } = await tokenStoreClient()
    .from('user_google_tokens')
    .upsert(
      { user_id: userId, ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) console.error('[Google Token] upsertUserGoogleToken error:', error);
}

async function deleteUserGoogleToken(userId) {
  const { error } = await tokenStoreClient()
    .from('user_google_tokens')
    .delete()
    .eq('user_id', userId);
  if (error) console.error('[Google Token] deleteUserGoogleToken error:', error);
}

// Resolve the authenticated Supabase user id from the request's Bearer token,
// or null if it is missing/invalid.
async function resolveUserId(req) {
  try {
    return await getUserId(getSupabaseClient(req));
  } catch {
    return null;
  }
}

// POST /api/google/store-refresh-token
// Called by the client on SIGNED_IN to persist the Google provider_refresh_token
// so it survives Supabase dropping it from the session after its JWT refresh.
app.post('/api/google/store-refresh-token', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const { refresh_token, scope } = req.body || {};
    if (!refresh_token) {
      return res.status(400).json({ error: 'Missing refresh_token', code: 'MISSING_REFRESH_TOKEN' });
    }

    await upsertUserGoogleToken(userId, {
      refresh_token,
      ...(scope ? { scope } : {}),
    });

    res.json({ stored: true });
  } catch (error) {
    console.error('[Google Token Store] Server error:', error);
    res.status(500).json({ error: error.message || 'Internal server error', code: 'SERVER_ERROR' });
  }
});

// POST /api/google/refresh-token
// Refreshes the Google LOGIN provider access token. MUST use the login client's
// credentials (the client configured in Supabase's Google provider, 35770…) —
// a refresh token can only be refreshed by the client that minted it, so the
// logos-vision client (GOOGLE_CLIENT_ID, 234234…) would 401 here. The refresh
// token comes from the request body when the session still has it, otherwise
// from the per-user stored token (user_google_tokens), so refresh keeps working
// after Supabase drops provider_refresh_token from the session.
app.post('/api/google/refresh-token', async (req, res) => {
  try {
    const userId = await resolveUserId(req);

    // Effective refresh token: prefer the one the client sent (freshest),
    // otherwise fall back to the stored per-user token.
    let refreshToken = req.body?.refresh_token || null;
    if (!refreshToken && userId) {
      const stored = await getUserGoogleToken(userId);
      refreshToken = stored?.refresh_token || null;
    }

    if (!refreshToken) {
      return res.status(400).json({
        error: 'No refresh token available (none sent and none stored). Please reconnect Google.',
        code: 'MISSING_REFRESH_TOKEN',
        requiresReauth: true,
      });
    }

    const clientId = GOOGLE_LOGIN_CLIENT_ID;
    const clientSecret = GOOGLE_LOGIN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[Google Token Refresh] Missing LOGIN credentials - clientId:', !!clientId, 'clientSecret:', !!clientSecret);
      return res.status(500).json({
        error: 'Server configuration error: GOOGLE_LOGIN_CLIENT_ID / GOOGLE_LOGIN_CLIENT_SECRET not set',
        code: 'MISSING_CREDENTIALS',
      });
    }

    console.log('[Google Token Refresh] Attempting refresh (login client)…');

    // Call Google's OAuth2 token endpoint with the login client's secret.
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Google Token Refresh] Failed:', errorData);

      if (errorData.error === 'invalid_grant') {
        // The grant is dead (revoked / expired). Clear the stored token so we
        // stop retrying it; the user must reconnect.
        if (userId) await deleteUserGoogleToken(userId);
        return res.status(401).json({
          error: 'Refresh token expired or revoked. Please re-authenticate.',
          code: 'INVALID_GRANT',
          requiresReauth: true,
        });
      }

      return res.status(response.status).json({
        error: errorData.error_description || 'Token refresh failed',
        code: errorData.error || 'REFRESH_FAILED',
      });
    }

    const data = await response.json();
    console.log('[Google Token Refresh] Success - token expires in', data.expires_in, 'seconds');

    // Persist the freshest material so a later call works even when the client
    // no longer carries a refresh token. (Google omits refresh_token on a
    // refresh grant, so keep the one we just used.)
    if (userId) {
      await upsertUserGoogleToken(userId, {
        refresh_token: refreshToken,
        access_token: data.access_token,
        expiry_date: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
        ...(data.scope ? { scope: data.scope } : {}),
      });
    }

    res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope,
    });
  } catch (error) {
    console.error('[Google Token Refresh] Server error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// ============================================
// GMAIL PRIVATE GRANT (scope split — owner-only Gmail)
// Separate Gmail OAuth client (own GCP project, Testing status). Restricted
// Gmail scopes live here, NOT on the login client, so production login is
// CASA-free. Tokens stored in public.user_gmail_tokens, keyed by auth uid.
// ============================================

function getGmailOauthClient() {
  return new google.auth.OAuth2(
    GMAIL_OAUTH_CLIENT_ID,
    GMAIL_OAUTH_CLIENT_SECRET,
    GMAIL_OAUTH_REDIRECT_URI
  );
}

function gmailConfigured() {
  return !!(GMAIL_OAUTH_CLIENT_ID && GMAIL_OAUTH_CLIENT_SECRET && GMAIL_OAUTH_REDIRECT_URI);
}

// Sign/verify the OAuth `state` so the PUBLIC callback (no Bearer token — it is a
// redirect from Google) can attribute the grant to a user without trusting the
// client. HMAC over {uid, exp}; 10-minute validity.
const GMAIL_STATE_SECRET =
  process.env.JWT_SECRET || process.env.LOGOS_VISION_API_KEY || SUPABASE_SERVICE_KEY || 'pulse-gmail-state';

function signGmailState(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + 10 * 60 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', GMAIL_STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyGmailState(state) {
  const [payload, sig] = String(state || '').split('.');
  if (!payload || !sig) throw new Error('malformed state');
  const expected = crypto.createHmac('sha256', GMAIL_STATE_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('state signature mismatch');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (!data.exp || Date.now() > data.exp) throw new Error('state expired');
  return data.uid;
}

async function getUserGmailToken(userId) {
  const { data, error } = await tokenStoreClient()
    .from('user_gmail_tokens').select('*').eq('user_id', userId).maybeSingle();
  if (error) { console.error('[Gmail Token] get error:', error); return null; }
  return data;
}

async function upsertUserGmailToken(userId, fields) {
  const { error } = await tokenStoreClient()
    .from('user_gmail_tokens')
    .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) console.error('[Gmail Token] upsert error:', error);
}

async function deleteUserGmailToken(userId) {
  const { error } = await tokenStoreClient().from('user_gmail_tokens').delete().eq('user_id', userId);
  if (error) console.error('[Gmail Token] delete error:', error);
}

// GET /api/gmail/status — is the owner's Gmail grant connected?
app.get('/api/gmail/status', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    const row = await getUserGmailToken(userId);
    res.json({ connected: !!row, configured: gmailConfigured() });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/gmail/auth/url — authorize URL for the separate Gmail client
app.get('/api/gmail/auth/url', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    if (!gmailConfigured()) {
      return res.status(500).json({ error: 'Gmail OAuth client not configured on the server', code: 'MISSING_CONFIG' });
    }
    const url = getGmailOauthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent select_account',  // consent (refresh token) + account chooser (switch accounts)
      scope: GMAIL_OAUTH_SCOPES,
      state: signGmailState(userId),
    });
    res.json({ url });
  } catch (error) {
    console.error('[Gmail Auth URL] error:', error);
    res.status(500).json({ error: error.message || 'Failed to build auth URL' });
  }
});

// GET /api/gmail/auth/callback — Google redirects here; store the grant, bounce to app
app.get('/api/gmail/auth/callback', async (req, res) => {
  const appUrl = process.env.VITE_APP_URL || process.env.PRODUCTION_URL || 'http://localhost:5173';
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.redirect(`${appUrl}/?gmail_error=${encodeURIComponent(oauthError)}`);
    if (!code || !state) return res.redirect(`${appUrl}/?gmail_error=missing_code`);

    let userId;
    try { userId = verifyGmailState(state); }
    catch { return res.redirect(`${appUrl}/?gmail_error=bad_state`); }

    const { tokens } = await getGmailOauthClient().getToken(code);
    if (!tokens.refresh_token) {
      // No refresh token returned (consent skipped). With prompt:consent this is rare.
      return res.redirect(`${appUrl}/?gmail_error=no_refresh_token`);
    }
    await upsertUserGmailToken(userId, {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token || null,
      expiry_date: tokens.expiry_date || null,
      scope: tokens.scope || null,
    });
    console.log('✅ Gmail grant stored for user:', userId);
    res.redirect(`${appUrl}/?gmail=connected`);
  } catch (error) {
    console.error('[Gmail Callback] error:', error);
    res.redirect(`${appUrl}/?gmail_error=${encodeURIComponent(error.message || 'callback_failed')}`);
  }
});

// POST /api/gmail/refresh-token — mint a fresh Gmail access token from the grant
app.post('/api/gmail/refresh-token', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    if (!gmailConfigured()) {
      return res.status(500).json({ error: 'Gmail OAuth client not configured on the server', code: 'MISSING_CONFIG' });
    }
    const row = await getUserGmailToken(userId);
    if (!row?.refresh_token) {
      return res.status(404).json({ error: 'Gmail not connected', code: 'GMAIL_NOT_CONNECTED', requiresConnect: true });
    }
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GMAIL_OAUTH_CLIENT_ID,
        client_secret: GMAIL_OAUTH_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: row.refresh_token,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (err.error === 'invalid_grant') {
        // Grant dead (revoked, or the Testing 7-day refresh-token expiry). Clear
        // it so we stop retrying; the user must reconnect Gmail.
        await deleteUserGmailToken(userId);
        return res.status(401).json({
          error: 'Gmail grant expired or revoked. Please reconnect Gmail.',
          code: 'INVALID_GRANT', requiresReauth: true, requiresConnect: true,
        });
      }
      return res.status(response.status).json({
        error: err.error_description || 'Gmail token refresh failed',
        code: err.error || 'REFRESH_FAILED',
      });
    }
    const data = await response.json();
    await upsertUserGmailToken(userId, {
      refresh_token: row.refresh_token,
      access_token: data.access_token,
      expiry_date: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
      ...(data.scope ? { scope: data.scope } : {}),
    });
    res.json({ access_token: data.access_token, expires_in: data.expires_in, token_type: data.token_type, scope: data.scope });
  } catch (error) {
    console.error('[Gmail Refresh] error:', error);
    res.status(500).json({ error: error.message || 'Internal server error', code: 'SERVER_ERROR' });
  }
});

// DELETE /api/gmail/disconnect — drop the stored grant
app.delete('/api/gmail/disconnect', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    await deleteUserGmailToken(userId);
    res.json({ disconnected: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============================================
// GOOGLE CONTACTS PRIVATE GRANT (separate-account import — owner-only)
// Lets a user import contacts from a DIFFERENT Google account than their login.
// Mirrors the Gmail scope-split: reuses the private Gmail Testing OAuth client
// (env may point at the same client id/secret with contacts.readonly added + its
// own redirect URI). Tokens in public.user_google_contacts_tokens, keyed by auth
// uid. State signing is shared with the Gmail flow (signGmailState/verifyGmailState).
// ============================================

const GOOGLE_CONTACTS_OAUTH_CLIENT_ID = process.env.GOOGLE_CONTACTS_OAUTH_CLIENT_ID?.trim();
const GOOGLE_CONTACTS_OAUTH_CLIENT_SECRET = process.env.GOOGLE_CONTACTS_OAUTH_CLIENT_SECRET?.trim();
const GOOGLE_CONTACTS_OAUTH_REDIRECT_URI = process.env.GOOGLE_CONTACTS_OAUTH_REDIRECT_URI?.trim();
const GOOGLE_CONTACTS_OAUTH_SCOPES = ['https://www.googleapis.com/auth/contacts.readonly'];

function getGoogleContactsOauthClient() {
  return new google.auth.OAuth2(
    GOOGLE_CONTACTS_OAUTH_CLIENT_ID,
    GOOGLE_CONTACTS_OAUTH_CLIENT_SECRET,
    GOOGLE_CONTACTS_OAUTH_REDIRECT_URI
  );
}

function googleContactsConfigured() {
  return !!(GOOGLE_CONTACTS_OAUTH_CLIENT_ID && GOOGLE_CONTACTS_OAUTH_CLIENT_SECRET && GOOGLE_CONTACTS_OAUTH_REDIRECT_URI);
}

async function getUserGoogleContactsToken(userId) {
  const { data, error } = await tokenStoreClient()
    .from('user_google_contacts_tokens').select('*').eq('user_id', userId).maybeSingle();
  if (error) { console.error('[Contacts Token] get error:', error); return null; }
  return data;
}

async function upsertUserGoogleContactsToken(userId, fields) {
  const { error } = await tokenStoreClient()
    .from('user_google_contacts_tokens')
    .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) console.error('[Contacts Token] upsert error:', error);
}

async function deleteUserGoogleContactsToken(userId) {
  const { error } = await tokenStoreClient().from('user_google_contacts_tokens').delete().eq('user_id', userId);
  if (error) console.error('[Contacts Token] delete error:', error);
}

// GET /api/google-contacts/status — is the separate Contacts grant connected?
app.get('/api/google-contacts/status', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    const row = await getUserGoogleContactsToken(userId);
    res.json({ connected: !!row, configured: googleContactsConfigured() });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/google-contacts/auth/url — authorize URL; select_account so the user
// can pick a DIFFERENT account than their login.
app.get('/api/google-contacts/auth/url', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    if (!googleContactsConfigured()) {
      return res.status(500).json({ error: 'Google Contacts OAuth client not configured on the server', code: 'MISSING_CONFIG' });
    }
    const url = getGoogleContactsOauthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'select_account consent',  // account chooser (different account) + consent (refresh token)
      scope: GOOGLE_CONTACTS_OAUTH_SCOPES,
      state: signGmailState(userId),
    });
    res.json({ url });
  } catch (error) {
    console.error('[Contacts Auth URL] error:', error);
    res.status(500).json({ error: error.message || 'Failed to build auth URL' });
  }
});

// GET /api/google-contacts/auth/callback — Google redirects here; store the grant
app.get('/api/google-contacts/auth/callback', async (req, res) => {
  const appUrl = process.env.VITE_APP_URL || process.env.PRODUCTION_URL || 'http://localhost:5173';
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.redirect(`${appUrl}/?google_contacts_error=${encodeURIComponent(oauthError)}`);
    if (!code || !state) return res.redirect(`${appUrl}/?google_contacts_error=missing_code`);

    let userId;
    try { userId = verifyGmailState(state); }
    catch { return res.redirect(`${appUrl}/?google_contacts_error=bad_state`); }

    const { tokens } = await getGoogleContactsOauthClient().getToken(code);
    if (!tokens.refresh_token) {
      return res.redirect(`${appUrl}/?google_contacts_error=no_refresh_token`);
    }
    await upsertUserGoogleContactsToken(userId, {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token || null,
      expiry_date: tokens.expiry_date || null,
      scope: tokens.scope || null,
    });
    console.log('✅ Google Contacts grant stored for user:', userId);
    res.redirect(`${appUrl}/?google_contacts=connected`);
  } catch (error) {
    console.error('[Contacts Callback] error:', error);
    res.redirect(`${appUrl}/?google_contacts_error=${encodeURIComponent(error.message || 'callback_failed')}`);
  }
});

// POST /api/google-contacts/refresh-token — mint a fresh access token from the grant
app.post('/api/google-contacts/refresh-token', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    if (!googleContactsConfigured()) {
      return res.status(500).json({ error: 'Google Contacts OAuth client not configured on the server', code: 'MISSING_CONFIG' });
    }
    const row = await getUserGoogleContactsToken(userId);
    if (!row?.refresh_token) {
      return res.status(404).json({ error: 'Google Contacts not connected', code: 'CONTACTS_NOT_CONNECTED', requiresConnect: true });
    }
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CONTACTS_OAUTH_CLIENT_ID,
        client_secret: GOOGLE_CONTACTS_OAUTH_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: row.refresh_token,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (err.error === 'invalid_grant') {
        // Grant dead (revoked, or the Testing 7-day refresh-token expiry). Clear
        // it so we stop retrying; the user must reconnect.
        await deleteUserGoogleContactsToken(userId);
        return res.status(401).json({
          error: 'Google Contacts grant expired or revoked. Please reconnect.',
          code: 'INVALID_GRANT', requiresReauth: true, requiresConnect: true,
        });
      }
      return res.status(response.status).json({
        error: err.error_description || 'Google Contacts token refresh failed',
        code: err.error || 'REFRESH_FAILED',
      });
    }
    const data = await response.json();
    await upsertUserGoogleContactsToken(userId, {
      refresh_token: row.refresh_token,
      access_token: data.access_token,
      expiry_date: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
      ...(data.scope ? { scope: data.scope } : {}),
    });
    res.json({ access_token: data.access_token, expires_in: data.expires_in, token_type: data.token_type, scope: data.scope });
  } catch (error) {
    console.error('[Contacts Refresh] error:', error);
    res.status(500).json({ error: error.message || 'Internal server error', code: 'SERVER_ERROR' });
  }
});

// DELETE /api/google-contacts/disconnect — drop the stored grant
app.delete('/api/google-contacts/disconnect', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    await deleteUserGoogleContactsToken(userId);
    res.json({ disconnected: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============================================
// SLACK USER-OAUTH (send-as-you + own-DM read) — P1 of Slack-grounded Messages.
// Mirrors the Gmail per-user block above. Single-tenant: the operator installs
// to their own workspace. The xoxp- USER token is stored server-side in
// public.user_slack_tokens and NEVER reaches the browser; it is distinct from
// the Phase-8 bot token (xoxb-, localStorage) which keeps powering reads +
// Contacts send (D8 — keep both). The public bot proxy (/api/slack/proxy) is
// intentionally NOT used for the user token (D7).
// Scope: docs/SLACK_MESSAGES_GROUNDING_SCOPE_2026-06-06.md §8.
// ============================================

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
// Accept both _URI (Gmail-convention) and _URL, and TRIM the value: a trailing
// space in the Render env var encodes as '+' in the authorize URL, so the
// redirect_uri sent (".../callback ") doesn't match the registered ".../callback"
// and Slack returns bad_redirect_uri. Confirmed via the live consent URL.
const SLACK_OAUTH_REDIRECT_URI = (process.env.SLACK_OAUTH_REDIRECT_URI || process.env.SLACK_OAUTH_REDIRECT_URL || '').trim();
// Launch USER-scope set (1:1 DM send + read). im:write is required by
// conversations.open; users:read.email must be requested alongside users:read.
// channels:history / groups:history / mpim:history are a post-launch fast-follow.
const SLACK_USER_SCOPES = 'chat:write,im:write,im:history,users:read,users:read.email';

function slackOauthConfigured() {
  return !!(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET && SLACK_OAUTH_REDIRECT_URI);
}

// Same signed-state scheme as Gmail: the PUBLIC callback (a redirect from Slack,
// no Bearer) attributes the grant via an HMAC over {uid, exp}. 10-minute validity.
const SLACK_STATE_SECRET =
  process.env.JWT_SECRET || process.env.LOGOS_VISION_API_KEY || SUPABASE_SERVICE_KEY || 'pulse-slack-state';

function signSlackState(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + 10 * 60 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SLACK_STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySlackState(state) {
  const [payload, sig] = String(state || '').split('.');
  if (!payload || !sig) throw new Error('malformed state');
  const expected = crypto.createHmac('sha256', SLACK_STATE_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('state signature mismatch');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (!data.exp || Date.now() > data.exp) throw new Error('state expired');
  return data.uid;
}

async function getUserSlackToken(userId) {
  const { data, error } = await tokenStoreClient()
    .from('user_slack_tokens').select('*').eq('user_id', userId).maybeSingle();
  if (error) { console.error('[Slack Token] get error:', error); return null; }
  return data;
}

async function upsertUserSlackToken(userId, fields) {
  const { error } = await tokenStoreClient()
    .from('user_slack_tokens')
    .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) console.error('[Slack Token] upsert error:', error);
  return error || null;
}

async function deleteUserSlackToken(userId) {
  const { error } = await tokenStoreClient().from('user_slack_tokens').delete().eq('user_id', userId);
  if (error) console.error('[Slack Token] delete error:', error);
}

// Ensure a deterministic shadow auth.users row exists for a Slack counterpart so
// they can occupy a participant slot in pulse_conversations/pulse_messages (all 4
// participant cols FK -> auth.users; a bare synthetic uuid would fail the FK). The
// DB RPC (SECURITY DEFINER, service_role-only) computes the uuidv5, inserts the row
// email-less with raw_user_meta_data.pulse_shadow=true — which the 4 auth.users
// onboarding triggers skip (migration 20260607061411) so it fires ZERO side effects
// — and is idempotent (ON CONFLICT DO NOTHING). Returns the same uuid every call.
// Used by P2 (send-as-you) and the slack-events edge fn (P3).
// Scope: docs/SLACK_MESSAGES_GROUNDING_SCOPE_2026-06-06.md §3/§7.
async function ensureSlackShadowUser(teamId, slackUserId, email = null, displayName = null) {
  if (!teamId || !slackUserId) {
    throw new Error('ensureSlackShadowUser: teamId and slackUserId are required');
  }
  const { data, error } = await tokenStoreClient().rpc('ensure_slack_shadow_user', {
    p_team_id: teamId,
    p_slack_user_id: slackUserId,
    p_email: email,
    p_display_name: displayName,
  });
  if (error) {
    console.error('[Slack Shadow] mint error:', error);
    throw new Error(error.message || 'shadow mint failed');
  }
  return data; // the deterministic shadow auth.users uuid
}

// GET /api/slack/status — is the owner's Slack user-token grant connected?
app.get('/api/slack/status', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    const row = await getUserSlackToken(userId);
    res.json({
      connected: !!row,
      configured: slackOauthConfigured(),
      slackUserId: row?.slack_user_id || null,
      teamId: row?.slack_team_id || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/slack/auth/url — Slack user-token authorize URL (user_scope, NOT scope)
app.get('/api/slack/auth/url', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    if (!slackOauthConfigured()) {
      return res.status(500).json({ error: 'Slack OAuth client not configured on the server', code: 'MISSING_CONFIG' });
    }
    const params = new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      user_scope: SLACK_USER_SCOPES,   // USER scopes go in user_scope, NOT scope (=bot scopes)
      redirect_uri: SLACK_OAUTH_REDIRECT_URI,
      state: signSlackState(userId),
    });
    res.json({ url: `https://slack.com/oauth/v2/authorize?${params.toString()}` });
  } catch (error) {
    console.error('[Slack Auth URL] error:', error);
    res.status(500).json({ error: error.message || 'Failed to build auth URL' });
  }
});

// GET /api/slack/auth/callback — Slack redirects here; store the xoxp- grant, bounce to app
app.get('/api/slack/auth/callback', async (req, res) => {
  const appUrl = process.env.VITE_APP_URL || process.env.PRODUCTION_URL || 'http://localhost:5173';
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.redirect(`${appUrl}/?slack_error=${encodeURIComponent(oauthError)}`);
    if (!code || !state) return res.redirect(`${appUrl}/?slack_error=missing_code`);

    let userId;
    try { userId = verifySlackState(state); }
    catch { return res.redirect(`${appUrl}/?slack_error=bad_state`); }

    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: SLACK_OAUTH_REDIRECT_URI,
      }),
    });
    const data = await tokenRes.json();
    // Slack returns HTTP 200 with { ok:false, error } on logical failures.
    if (!data.ok) {
      return res.redirect(`${appUrl}/?slack_error=${encodeURIComponent(data.error || 'oauth_failed')}`);
    }
    // The USER token (xoxp-) is nested under authed_user.access_token; the
    // top-level access_token would be the bot token (xoxb-) if bot scopes were set.
    const authedUser = data.authed_user || {};
    if (!authedUser.access_token) {
      return res.redirect(`${appUrl}/?slack_error=no_user_token`);
    }
    const storeErr = await upsertUserSlackToken(userId, {
      access_token: authedUser.access_token,
      scope: authedUser.scope || null,
      slack_user_id: authedUser.id || null,
      slack_team_id: data.team?.id || null,
      bot_user_id: data.bot_user_id || null,
      token_type: authedUser.token_type || 'user',
    });
    if (storeErr) {
      // Surface the real failure instead of a misleading ?slack=connected. A
      // silent store failure (e.g. SUPABASE_SERVICE_ROLE_KEY missing → the client
      // falls back to anon → RLS blocks the write) is what made an empty table
      // look "connected".
      return res.redirect(`${appUrl}/?slack_error=${encodeURIComponent('store_failed: ' + (storeErr.message || storeErr.code || 'db write blocked'))}`);
    }
    console.log('✅ Slack user grant stored for user:', userId);
    res.redirect(`${appUrl}/?slack=connected`);
  } catch (error) {
    console.error('[Slack Callback] error:', error);
    res.redirect(`${appUrl}/?slack_error=${encodeURIComponent(error.message || 'callback_failed')}`);
  }
});

// DELETE /api/slack/disconnect — drop the stored user-token grant.
// No refresh route: Slack user tokens are non-expiring unless rotation is enabled
// (out of scope). On invalid_auth at send time, the send path deletes the row and
// prompts reconnect — mirrors the Gmail invalid_grant branch.
app.delete('/api/slack/disconnect', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    await deleteUserSlackToken(userId);
    res.json({ disconnected: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// POST /api/slack/send — send a 1:1 DM AS THE OPERATOR (xoxp-), for Slack-grounded
// Messages send-as-you (P2). The user token is read server-side from
// user_slack_tokens and injected into the Slack call; it NEVER reaches the browser,
// and this route is intentionally separate from the open bot proxy (/api/slack/proxy,
// D7). Mirrors slackService.openDm + sendMessage, but posts as the human. On a
// token-death error the stored grant is dropped and the client is told to reconnect
// (mirrors the Gmail invalid_grant branch). Phase-8 bot send (Contacts) is untouched
// (D8 — both tokens coexist). Body: { slackUserId?, channel?, text } (one target req).
app.post('/api/slack/send', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });

    const { slackUserId, channel: bodyChannel, text, email, displayName } = req.body || {};
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) return res.status(400).json({ error: 'Missing text', code: 'MISSING_TEXT' });
    if (!slackUserId && !bodyChannel) {
      return res.status(400).json({ error: 'Missing slackUserId or channel', code: 'MISSING_TARGET' });
    }

    const row = await getUserSlackToken(userId);
    if (!row?.access_token) {
      return res.status(400).json({ error: 'Slack not connected', code: 'NOT_CONNECTED' });
    }
    const userToken = row.access_token;

    const slackPost = async (method, payload) => {
      const r = await fetch(`https://slack.com/api/${method}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(payload),
      });
      return r.json();
    };

    // A dead user token can't be refreshed (non-expiring unless rotation is on, which
    // is out of scope); drop the grant + tell the client to reconnect.
    const isAuthDead = (err) =>
      ['invalid_auth', 'token_revoked', 'account_inactive', 'token_expired', 'not_authed'].includes(err);

    // Resolve the DM channel (open it if only a slackUserId was given). Needs im:write.
    let channel = bodyChannel;
    if (!channel) {
      const open = await slackPost('conversations.open', { users: slackUserId });
      if (!open.ok) {
        if (isAuthDead(open.error)) {
          await deleteUserSlackToken(userId);
          return res.status(401).json({ error: open.error, code: 'RECONNECT_REQUIRED' });
        }
        return res.status(502).json({ error: open.error || 'conversations.open failed', code: 'SLACK_ERROR' });
      }
      channel = open.channel?.id;
      if (!channel) {
        return res.status(502).json({ error: 'conversations.open returned no channel id', code: 'SLACK_ERROR' });
      }
    }

    const sent = await slackPost('chat.postMessage', { channel, text: trimmed });
    if (!sent.ok) {
      if (isAuthDead(sent.error)) {
        await deleteUserSlackToken(userId);
        return res.status(401).json({ error: sent.error, code: 'RECONNECT_REQUIRED' });
      }
      return res.status(502).json({ error: sent.error || 'chat.postMessage failed', code: 'SLACK_ERROR' });
    }

    // Mirror the delivered DM into Messages as a local outbound row so the operator
    // sees it in the thread. That needs the shadow auth.users row (the recipient side)
    // + a transport='slack' conversation — both minted server-side here (service-role,
    // the deterministic uuidv5 + auth.users insert can't be done from the browser). The
    // CLIENT then writes the actual message via send_pulse_message (sender=self) so RLS
    // + the _assert_caller_is guard pass naturally; we just return the ids it needs.
    let shadowUserId = null;
    let conversationId = null;
    const teamId = row.slack_team_id || null;
    if (slackUserId && teamId) {
      try {
        shadowUserId = await ensureSlackShadowUser(teamId, slackUserId, email || null, displayName || null);
        const { data: convId, error: convErr } = await tokenStoreClient().rpc('get_or_create_slack_conversation', {
          p_pulse_user_id: userId,
          p_shadow_id: shadowUserId,
          p_external_slack_user_id: slackUserId,
          p_external_email: email || null,
          p_external_display_name: displayName || null,
        });
        if (convErr) console.error('[Slack Send] conversation upsert error:', convErr);
        else conversationId = convId;
      } catch (mintErr) {
        // The DM already landed in Slack; a local-mirror failure must NOT fail the send.
        // ids stay null → the client falls back to optimistic-only display.
        console.error('[Slack Send] local mirror failed (DM still delivered):', mintErr);
      }
    }

    // ts is returned so the client can tag the local outbound row + the slack-events
    // edge fn (P3) can echo-dedup the operator's own message. shadowUserId/conversationId
    // let the client persist the local outbound row in the right slack thread.
    res.json({ ok: true, channel: sent.channel || channel, ts: sent.ts, shadowUserId, conversationId, teamId });
  } catch (error) {
    console.error('[Slack Send] error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Slack CHANNEL reply-as-you (Integration C · P6). Posts the operator's reply into a Slack
// channel AS THE HUMAN (xoxp- injected server-side, never the open bot proxy — D7), then
// records a local outbound row in the channel mirror so Pulse shows it. Unlike /api/slack/send
// there is no conversations.open — you post directly to a channel you're a member of. The
// inbound echo of this post is filtered by the slack-events edge fn (operator's own slack id),
// and the UNIQUE(thread_id, slack_ts) index dedups even if it weren't. Body: { channel, text }.
app.post('/api/slack/channel-send', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });

    const { channel, text } = req.body || {};
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) return res.status(400).json({ error: 'Missing text', code: 'MISSING_TEXT' });
    if (!channel) return res.status(400).json({ error: 'Missing channel', code: 'MISSING_CHANNEL' });

    const row = await getUserSlackToken(userId);
    if (!row?.access_token) return res.status(400).json({ error: 'Slack not connected', code: 'NOT_CONNECTED' });
    const userToken = row.access_token;
    const teamId = row.slack_team_id || null;

    const isAuthDead = (err) =>
      ['invalid_auth', 'token_revoked', 'account_inactive', 'token_expired', 'not_authed'].includes(err);

    const sent = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ channel, text: trimmed }),
    }).then((r) => r.json());

    if (!sent.ok) {
      if (isAuthDead(sent.error)) {
        await deleteUserSlackToken(userId);
        return res.status(401).json({ error: sent.error, code: 'RECONNECT_REQUIRED' });
      }
      // e.g. not_in_channel / missing_scope — surface so the UI can explain.
      return res.status(502).json({ error: sent.error || 'chat.postMessage failed', code: 'SLACK_ERROR' });
    }

    // Record the local outbound row (best-effort; the Slack post already succeeded, so a
    // mirror failure must NOT fail the send — the client falls back to realtime/refresh).
    let message = null;
    if (teamId) {
      try {
        const store = tokenStoreClient();
        const { data: threadId, error: tErr } = await store.rpc('get_or_create_slack_channel_thread', {
          p_owner_pulse_id: userId,
          p_team_id: teamId,
          p_slack_channel_id: channel,
          p_channel_name: null,
          p_is_private: false,
        });
        if (tErr) throw tErr;
        if (threadId) {
          const { data: inserted, error: insErr } = await store
            .from('slack_channel_messages')
            .insert({
              thread_id: threadId,
              sender_shadow_id: null,
              sender_slack_id: row.slack_user_id || null,
              sender_name: 'You',
              content: trimmed,
              is_outgoing: true,
              slack_ts: sent.ts,
              metadata: { transport: 'slack_channel', slack_ts: sent.ts, slack_channel: channel },
            })
            .select()
            .maybeSingle();
          if (insErr) throw insErr;
          message = inserted || null;
          await store
            .from('slack_channel_threads')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', threadId);
        }
      } catch (mirrorErr) {
        console.error('[Slack Channel Send] local mirror failed (message still delivered):', mirrorErr);
      }
    }

    res.json({ ok: true, channel: sent.channel || channel, ts: sent.ts, message });
  } catch (error) {
    console.error('[Slack Channel Send] error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// POST /api/slack/conversation — start (or fetch) a 1:1 Slack thread to message someone AS
// YOU, WITHOUT sending yet (the Messages "New Slack message" front-door). Resolves an email
// -> Slack user id via the operator's xoxp- (users:read.email), mints the shadow recipient +
// the transport='slack' conversation (service-role), and returns the conversation id so the
// client can open it in Messages. Body: { email } or { slackUserId } (+ optional displayName).
app.post('/api/slack/conversation', async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });

    let { slackUserId, email, displayName } = req.body || {};
    email = typeof email === 'string' ? email.trim() : null;
    if (!slackUserId && !email) {
      return res.status(400).json({ error: 'Provide an email or slackUserId', code: 'MISSING_TARGET' });
    }

    const row = await getUserSlackToken(userId);
    if (!row?.access_token) return res.status(400).json({ error: 'Slack not connected', code: 'NOT_CONNECTED' });
    const teamId = row.slack_team_id || null;
    if (!teamId) return res.status(400).json({ error: 'Slack workspace unknown', code: 'NO_TEAM' });
    const userToken = row.access_token;

    const slackGet = async (method, params) => {
      const qs = new URLSearchParams(params).toString();
      const r = await fetch(`https://slack.com/api/${method}?${qs}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      return r.json();
    };
    const isAuthDead = (err) =>
      ['invalid_auth', 'token_revoked', 'account_inactive', 'token_expired', 'not_authed'].includes(err);

    // Resolve email -> Slack user id (+ profile) when no id was given.
    if (!slackUserId) {
      const look = await slackGet('users.lookupByEmail', { email });
      if (!look.ok) {
        if (isAuthDead(look.error)) {
          await deleteUserSlackToken(userId);
          return res.status(401).json({ error: look.error, code: 'RECONNECT_REQUIRED' });
        }
        if (look.error === 'users_not_found') {
          return res.status(404).json({ error: 'No Slack user has that email', code: 'NOT_ON_SLACK' });
        }
        return res.status(502).json({ error: look.error || 'lookup failed', code: 'SLACK_ERROR' });
      }
      slackUserId = look.user?.id;
      displayName = displayName || look.user?.profile?.real_name || look.user?.real_name || look.user?.name || null;
      email = email || look.user?.profile?.email || null;
      if (!slackUserId) return res.status(502).json({ error: 'lookup returned no user id', code: 'SLACK_ERROR' });
    } else if (!displayName) {
      // Best-effort enrich a directly-provided id.
      const info = await slackGet('users.info', { user: slackUserId });
      if (info.ok) {
        displayName = info.user?.profile?.real_name || info.user?.real_name || info.user?.name || null;
        email = email || info.user?.profile?.email || null;
      }
    }

    const shadowUserId = await ensureSlackShadowUser(teamId, slackUserId, email || null, displayName || null);
    const { data: conversationId, error: convErr } = await tokenStoreClient().rpc('get_or_create_slack_conversation', {
      p_pulse_user_id: userId,
      p_shadow_id: shadowUserId,
      p_external_slack_user_id: slackUserId,
      p_external_email: email || null,
      p_external_display_name: displayName || null,
    });
    if (convErr) {
      console.error('[Slack Conversation] upsert error:', convErr);
      return res.status(500).json({ error: convErr.message || 'conversation create failed' });
    }

    res.json({ ok: true, conversationId, shadowUserId, slackUserId, displayName: displayName || null, email: email || null, teamId });
  } catch (error) {
    console.error('[Slack Conversation] error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// OpenAI Realtime API - Ephemeral Token Generation
// This endpoint generates a short-lived token for WebRTC connections
app.post('/api/realtime/session-token', async (req, res) => {
  const { model = 'gpt-realtime', voice = 'alloy' } = req.body;

  // Get API key from request header or environment
  const apiKey = req.headers['x-openai-api-key'] || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({
      error: 'OpenAI API key required',
      message: 'Provide key in X-OpenAI-API-Key header or set OPENAI_API_KEY environment variable'
    });
  }

  try {
    // Request ephemeral token from OpenAI (GA endpoint). The old beta
    // `/v1/realtime/sessions` was removed and now 404s "Invalid URL"; GA mints
    // via `/v1/realtime/client_secrets` with a nested `session` object.
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model,
          audio: { output: { voice } },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI token generation failed:', errorData);
      return res.status(response.status).json({
        error: 'Failed to generate ephemeral token',
        details: errorData.error || response.statusText
      });
    }

    const data = await response.json();

    // Return the ephemeral token (expires in ~60 seconds). GA returns the key at
    // top-level `value` (prefix `ek_`); expose it as `value` and keep the legacy
    // `client_secret` shape as a fallback for any older consumer.
    res.json({
      value: data.value,
      client_secret: data.client_secret ?? { value: data.value, expires_at: data.expires_at },
      expires_at: data.expires_at,
      model: data.model,
      voice: data.voice,
    });

  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ==========================
// Email Automation API
// ==========================

app.get('/api/email/vacation-responder', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase
      .from('vacation_responder')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data: data || null });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

app.post('/api/email/vacation-responder', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const payload = req.body || {};
    const { data, error } = await supabase
      .from('vacation_responder')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

app.get('/api/email/blocked-senders', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase
      .from('blocked_senders')
      .select('*')
      .order('blocked_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data: data || [] });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

app.post('/api/email/blocked-senders', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase
      .from('blocked_senders')
      .insert(req.body || {})
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

app.delete('/api/email/blocked-senders/:id', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { error } = await supabase
      .from('blocked_senders')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

app.get('/api/email/notification-rules', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase
      .from('notification_rules')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data: data || [] });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

app.post('/api/email/notification-rules', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase
      .from('notification_rules')
      .insert(req.body || {})
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

app.patch('/api/email/notification-rules/:id', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase
      .from('notification_rules')
      .update(req.body || {})
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

app.delete('/api/email/notification-rules/:id', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { error } = await supabase
      .from('notification_rules')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

// Email accounts
app.get('/api/email/accounts', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase
      .from('email_accounts')
      .select('*')
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data: data || [] });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

app.post('/api/email/accounts', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const userId = await getUserId(supabase);
    const payload = { ...(req.body || {}), user_id: userId };
    const { data, error } = await supabase
      .from('email_accounts')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

app.patch('/api/email/accounts/:id', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase
      .from('email_accounts')
      .update(req.body || {})
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

app.delete('/api/email/accounts/:id', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { error } = await supabase
      .from('email_accounts')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

// Confidential emails
app.post('/api/email/confidential', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const userId = await getUserId(supabase);
    const payload = { ...(req.body || {}), user_id: userId };
    const { data, error } = await supabase
      .from('confidential_emails')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

app.post('/api/email/confidential/:id/revoke', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase
      .from('confidential_emails')
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

// ==========================
// Gemini AI Proxy
// ==========================
// Keeps GEMINI_API_KEY server-side only — client never sees the key

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

app.get('/api/email/ai/status', (req, res) => {
  res.json({ available: !!GEMINI_API_KEY });
});

app.post('/api/email/ai', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Gemini API key not configured on server' });
    }

    // Authenticate user
    const supabase = getSupabaseClient(req);
    await getUserId(supabase); // throws if not authenticated

    const { prompt, temperature, maxOutputTokens } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const geminiResponse = await fetch(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: temperature ?? 0.7,
          maxOutputTokens: maxOutputTokens ?? 1024,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json().catch(() => ({}));
      const msg = errorData.error?.message || `Gemini API error: ${geminiResponse.status}`;
      return res.status(geminiResponse.status).json({ error: msg });
    }

    const data = await geminiResponse.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'AI proxy error' });
  }
});

// OpenAI Realtime WebSocket Proxy (for environments that need it)
app.get('/api/realtime/ws-info', (req, res) => {
  res.json({
    websocket_url: 'wss://api.openai.com/v1/realtime',
    protocols: ['realtime'],
    note: 'Use POST /api/realtime/session-token to get ephemeral credentials first'
  });
});

// ==========================
// CRM OAuth Callback Routes
// ==========================

// OAuth callback for all CRM platforms
app.get('/api/crm/callback/:platform', async (req, res) => {
  const { platform } = req.params;
  const { code, state, error, error_description } = req.query;

  // Handle OAuth errors
  if (error) {
    console.error(`CRM OAuth error (${platform}):`, error, error_description);
    return res.redirect(
      `/settings/integrations?status=error&platform=${platform}&message=${encodeURIComponent(error_description || error)}`
    );
  }

  if (!code) {
    return res.redirect(
      `/settings/integrations?status=error&platform=${platform}&message=${encodeURIComponent('Authorization code missing')}`
    );
  }

  try {
    // Import CRM OAuth helper dynamically
    const { exchangeCodeForToken } = await import('./server/crmOAuth.js');

    // Get credentials from environment
    const clientId = process.env[`${platform.toUpperCase()}_CLIENT_ID`];
    const clientSecret = process.env[`${platform.toUpperCase()}_CLIENT_SECRET`];
    const redirectUri = process.env[`${platform.toUpperCase()}_REDIRECT_URI`];

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(`Missing ${platform} OAuth credentials in environment`);
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForToken(
      platform,
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    // Calculate token expiration
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour

    // Store in session temporarily (will be saved by frontend)
    const integrationData = {
      platform,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: expiresAt.toISOString(),
      instanceUrl: tokens.instance_url, // For Salesforce
      scope: tokens.scope,
    };

    // Redirect to success page with data in URL params (will be picked up by frontend)
    const params = new URLSearchParams({
      status: 'success',
      platform,
      data: Buffer.from(JSON.stringify(integrationData)).toString('base64'),
    });

    res.redirect(`/settings/integrations?${params.toString()}`);
  } catch (error) {
    console.error(`Failed to complete ${platform} OAuth:`, error);
    res.redirect(
      `/settings/integrations?status=error&platform=${platform}&message=${encodeURIComponent(error.message)}`
    );
  }
});

// Get CRM integrations for current user
app.get('/api/crm/integrations', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const userId = await getUserId(supabase);

    const { data, error } = await supabase
      .from('crm_integrations')
      .select('*')
      .eq('workspace_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data: data || [] });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

// Create new CRM integration
app.post('/api/crm/integrations', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const userId = await getUserId(supabase);

    const payload = {
      ...(req.body || {}),
      workspace_id: userId,
      is_active: true,
      sync_enabled: true,
      sync_status: 'idle',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('crm_integrations')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

// Update CRM integration
app.patch('/api/crm/integrations/:id', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);

    const payload = {
      ...(req.body || {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('crm_integrations')
      .update(payload)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete CRM integration
app.delete('/api/crm/integrations/:id', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);

    const { error } = await supabase
      .from('crm_integrations')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

// Trigger manual CRM sync
app.post('/api/crm/integrations/:id/sync', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);

    // Update sync status to 'syncing'
    await supabase
      .from('crm_integrations')
      .update({ sync_status: 'syncing', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    // Import and run sync (async, don't wait)
    const { crmService } = await import('./src/services/crmService.js');
    crmService.fullSync(req.params.id).catch(error => {
      console.error(`Sync failed for integration ${req.params.id}:`, error);
    });

    res.json({ success: true, message: 'Sync started' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

// Get CRM sync logs
app.get('/api/crm/integrations/:id/sync-logs', async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);

    const { data, error } = await supabase
      .from('crm_sync_logs')
      .select('*')
      .eq('crm_id', req.params.id)
      .order('started_at', { ascending: false })
      .limit(10);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data: data || [] });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

// ============================================
// LOGOS VISION CRM INTEGRATION ENDPOINTS
// ============================================

// Middleware to verify Logos Vision API key
const verifyLogosVisionAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const validApiKey = process.env.LOGOS_VISION_API_KEY;

  if (!validApiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: 'Unauthorized - Invalid API key' });
  }

  next();
};

// ============================================
// GOOGLE OAUTH ENDPOINTS
// ============================================

// Helper: Store OAuth tokens in Supabase
async function storeGoogleTokens(userId, tokens) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type || 'Bearer',
      expiry_date: tokens.expiry_date,
      scope: tokens.scope,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.error('Error storing Google tokens:', error);
    throw error;
  }

  return data;
}

// Helper: Get OAuth tokens from Supabase
async function getGoogleTokens(userId) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.error('Error getting Google tokens:', error);
    throw error;
  }

  return data;
}

// GET /api/logos-vision/auth/url - Get Google OAuth authorization URL
app.get('/api/logos-vision/auth/url', verifyLogosVisionAuth, async (req, res) => {
  try {
    const { workspace_id } = req.query;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    // Generate authorization URL with state parameter for security
    const state = Buffer.from(JSON.stringify({
      workspace_id,
      timestamp: Date.now()
    })).toString('base64');

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      scope: GOOGLE_SCOPES,
      state,
      prompt: 'consent' // Force consent screen to get refresh token
    });

    res.json({
      auth_url: authUrl,
      state
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: error.message || 'Failed to generate auth URL' });
  }
});

// GET /api/logos-vision/auth/callback - OAuth callback handler
app.get('/api/logos-vision/auth/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Handle OAuth errors
    if (oauthError) {
      console.error('OAuth error:', oauthError);
      return res.redirect(`http://localhost:5176/contacts?oauth_error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Decode state to get workspace_id
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { workspace_id } = stateData;

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Store tokens in database
    await storeGoogleTokens(workspace_id, tokens);

    console.log('✅ Google OAuth tokens stored for workspace:', workspace_id);

    // Redirect back to Logos Vision with success
    res.redirect(`http://localhost:5176/contacts?oauth_success=true`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`http://localhost:5176/contacts?oauth_error=${encodeURIComponent(error.message)}`);
  }
});

// Get contacts with relationship intelligence for Logos Vision CRM
app.get('/api/logos-vision/contacts', verifyLogosVisionAuth, async (req, res) => {
  try {
    const { email, limit = 100, offset = 0, includeScore, includeTrends, includeInsights } = req.query;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let query = supabase
      .from('relationship_profiles')
      .select('*')
      .order('last_interaction_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (email) {
      query = query.eq('canonical_email', email);
    }

    const { data: profiles, error, count } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Transform to Logos Vision format
    const contacts = (profiles || []).map(profile => {
      const totalInteractions = (profile.total_emails_sent || 0) + (profile.total_emails_received || 0) + (profile.total_meetings || 0) + (profile.total_calls || 0);
      const sentimentScore = profile.ai_sentiment_average || 0;
      const sentiment = sentimentScore > 0.3 ? 'positive' : sentimentScore < -0.3 ? 'negative' : 'neutral';

      return {
        id: profile.id,
        email: profile.canonical_email,
        name: profile.contact_name,
        company: profile.company,
        title: profile.title,
        phone: profile.phone,
        relationship_score: includeScore !== 'false' ? profile.relationship_score : undefined,
        relationship_trend: includeTrends !== 'false' ? profile.relationship_trend : undefined,
        communication_frequency: profile.communication_frequency,
        preferred_channel: profile.preferred_channel,
        last_interaction_date: profile.last_interaction_at,
        total_interactions: totalInteractions,
        tags: profile.custom_tags || [],
        ai_insights: includeInsights !== 'false' ? {
          talking_points: profile.ai_talking_points || [],
          next_best_action: profile.ai_next_action_suggestion,
          sentiment
        } : undefined,
      };
    });

    res.json({
      contacts,
      total: count || contacts.length,
      page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Logos Vision contacts API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Returns Pulse's INTERNAL relationship intelligence for a contact:
// relationship score, communication frequency, interaction counts, and AI
// talking-points all derived from the user's own interaction history (with
// safe defaults like "Initiate first contact" for unknown contacts).
// This is NOT third-party/external data enrichment. The route path and JSON
// response shape are a cross-app contract consumed by the Logos Vision app —
// do not rename them.
app.post('/api/logos-vision/contacts/:email/enrich', verifyLogosVisionAuth, async (req, res) => {
  try {
    const { email } = req.params;
    const { name, company } = req.body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Try to find existing profile
    const { data: existingProfile } = await supabase
      .from('relationship_profiles')
      .select('*')
      .eq('canonical_email', email)
      .single();

    if (existingProfile) {
      // Return existing enrichment
      const totalInteractions = (existingProfile.total_emails_sent || 0) + (existingProfile.total_emails_received || 0) + (existingProfile.total_meetings || 0) + (existingProfile.total_calls || 0);
      const sentimentScore = existingProfile.ai_sentiment_average || 0;
      const sentiment = sentimentScore > 0.3 ? 'positive' : sentimentScore < -0.3 ? 'negative' : 'neutral';

      return res.json({
        email,
        enrichment: {
          relationship_score: existingProfile.relationship_score,
          relationship_trend: existingProfile.relationship_trend,
          communication_frequency: existingProfile.communication_frequency,
          preferred_channel: existingProfile.preferred_channel,
          last_interaction_date: existingProfile.last_interaction_at,
          total_interactions: totalInteractions,
          tags: existingProfile.custom_tags || [],
          ai_insights: {
            talking_points: existingProfile.ai_talking_points || [],
            next_best_action: existingProfile.ai_next_action_suggestion,
            sentiment
          }
        }
      });
    }

    // Create new profile with basic data
    const newProfile = {
      canonical_email: email,
      contact_name: name || email.split('@')[0],
      contact_email: email,
      company: company || null,
      relationship_score: 50, // Default neutral score
      relationship_trend: 'new',
      communication_frequency: 'monthly',
      preferred_channel: 'email',
      total_emails_sent: 0,
      total_emails_received: 0,
      total_meetings: 0,
      total_calls: 0,
      custom_tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: createdProfile, error } = await supabase
      .from('relationship_profiles')
      .insert(newProfile)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      email,
      enrichment: {
        relationship_score: 50,
        relationship_trend: 'new',
        communication_frequency: 'monthly',
        preferred_channel: 'email',
        total_interactions: 0,
        tags: [],
        ai_insights: {
          talking_points: [],
          next_best_action: 'Initiate first contact',
          sentiment: 'neutral'
        }
      }
    });
  } catch (error) {
    console.error('Contact enrichment error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Helper: Get or create "Logos Vision" contact group (label) in Google Contacts
async function getOrCreateLogosVisionLabel(people, supabase, userId) {
  try {
    // Check if we have the label resource name cached in database
    const { data: config } = await supabase
      .from('google_contacts_auto_sync_config')
      .select('logos_vision_label_resource_name')
      .eq('user_id', userId)
      .single();

    // If we have a cached resource name, verify it still exists
    if (config?.logos_vision_label_resource_name) {
      try {
        const existingGroup = await people.contactGroups.get({
          resourceName: config.logos_vision_label_resource_name
        });

        if (existingGroup.data) {
          console.log(`[GoogleContacts] Using existing "Logos Vision" label: ${config.logos_vision_label_resource_name}`);
          return config.logos_vision_label_resource_name;
        }
      } catch (err) {
        // Label no longer exists, will create a new one
        console.log(`[GoogleContacts] Cached label not found, will create new one`);
      }
    }

    // Search for existing "Logos Vision" label
    const listResponse = await people.contactGroups.list({
      pageSize: 100
    });

    const existingLabel = listResponse.data.contactGroups?.find(
      group => group.name === 'Logos Vision' && group.groupType === 'USER_CONTACT_GROUP'
    );

    if (existingLabel) {
      console.log(`[GoogleContacts] Found existing "Logos Vision" label: ${existingLabel.resourceName}`);

      // Cache the resource name
      await supabase
        .from('google_contacts_auto_sync_config')
        .upsert({
          user_id: userId,
          logos_vision_label_resource_name: existingLabel.resourceName,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      return existingLabel.resourceName;
    }

    // Create new "Logos Vision" label
    console.log(`[GoogleContacts] Creating "Logos Vision" label...`);
    const createResponse = await people.contactGroups.create({
      requestBody: {
        contactGroup: {
          name: 'Logos Vision'
        }
      }
    });

    const newResourceName = createResponse.data.resourceName;
    console.log(`[GoogleContacts] Created "Logos Vision" label: ${newResourceName}`);

    // Cache the resource name
    await supabase
      .from('google_contacts_auto_sync_config')
      .upsert({
        user_id: userId,
        logos_vision_label_resource_name: newResourceName,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    return newResourceName;
  } catch (error) {
    console.error(`[GoogleContacts] Error managing label:`, error);
    throw error;
  }
}

// Helper: Add contacts to "Logos Vision" label in Google Contacts
async function addContactsToLabel(people, contactResourceNames, labelResourceName) {
  try {
    if (!contactResourceNames || contactResourceNames.length === 0) {
      return;
    }

    console.log(`[GoogleContacts] Adding ${contactResourceNames.length} contacts to "Logos Vision" label...`);

    // Google API allows max 100 contacts per batch
    const batchSize = 100;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < contactResourceNames.length; i += batchSize) {
      const batch = contactResourceNames.slice(i, i + batchSize);

      try {
        await people.contactGroups.members.modify({
          resourceName: labelResourceName,
          requestBody: {
            resourceNamesToAdd: batch
          }
        });

        successCount += batch.length;
        console.log(`[GoogleContacts] Added batch of ${batch.length} contacts to label (${successCount}/${contactResourceNames.length})`);
      } catch (error) {
        console.error(`[GoogleContacts] Error adding batch to label:`, error.message);
        failCount += batch.length;
      }
    }

    console.log(`[GoogleContacts] Finished labeling: ${successCount} success, ${failCount} failed`);
    return { successCount, failCount };
  } catch (error) {
    console.error(`[GoogleContacts] Error in addContactsToLabel:`, error);
    throw error;
  }
}

// Helper: Fetch Google Contacts and store in database
async function fetchGoogleContactsInBackground(userId, syncJobId, filter = {}) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log(`[GoogleContacts] Starting sync for user ${userId}, job ${syncJobId}`);

    // Get stored OAuth tokens
    const tokenData = await getGoogleTokens(userId);

    if (!tokenData || !tokenData.access_token) {
      throw new Error('No Google OAuth tokens found. Please authorize first.');
    }

    // Set OAuth credentials
    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expiry_date: tokenData.expiry_date
    });

    // Create People API client
    const people = google.people({ version: 'v1', auth: oauth2Client });

    // Get sync token for incremental sync (if available)
    const { data: syncConfig } = await supabase
      .from('google_contacts_auto_sync_config')
      .select('sync_token')
      .eq('user_id', userId)
      .single();

    const existingSyncToken = syncConfig?.sync_token;

    if (existingSyncToken) {
      console.log(`[GoogleContacts] Using incremental sync (sync token exists)`);
    } else {
      console.log(`[GoogleContacts] Using full sync (no sync token - first sync)`);
    }

    // Fetch contacts from Google
    let allContacts = [];
    let pageToken = null;
    let totalFetched = 0;
    let newSyncToken = null;

    do {
      const requestParams = {
        resourceName: 'people/me',
        pageSize: 100,
        personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,biographies',
        pageToken
      };

      // Use sync token for incremental sync
      if (existingSyncToken && !pageToken) {
        requestParams.requestSyncToken = true;
        requestParams.syncToken = existingSyncToken;
      } else if (!existingSyncToken) {
        // Request sync token for future incremental syncs
        requestParams.requestSyncToken = true;
      }

      const response = await people.people.connections.list(requestParams);

      const connections = response.data.connections || [];
      allContacts = allContacts.concat(connections);
      totalFetched += connections.length;

      // Update sync job progress
      await supabase
        .from('google_contacts_sync_jobs')
        .update({
          total_contacts: totalFetched,
          synced: allContacts.length,
          updated_at: new Date().toISOString()
        })
        .eq('id', syncJobId);

      pageToken = response.data.nextPageToken;

      // Capture new sync token (only present on last page)
      if (!pageToken && response.data.nextSyncToken) {
        newSyncToken = response.data.nextSyncToken;
      }

      console.log(`[GoogleContacts] Fetched ${totalFetched} contacts so far...`);
    } while (pageToken);

    console.log(`[GoogleContacts] Total contacts fetched: ${allContacts.length}`);

    // Filter contacts if label specified
    let filteredContacts = allContacts;
    if (filter.label) {
      // Google doesn't support label filtering via API easily
      // For now, sync all and let Logos Vision filter
      console.log(`[GoogleContacts] Label filtering (${filter.label}) will be done in Logos Vision`);
    }

    // Store contacts in relationship_profiles
    let syncedCount = 0;
    let failedCount = 0;
    let skippedNoIdentifier = 0;
    let failedDatabaseError = 0;
    const importedContactResourceNames = []; // Track successfully imported contacts for labeling

    for (const contact of filteredContacts) {
      try {
        // Extract contact data
        const name = contact.names?.[0]?.displayName || 'Unknown';
        const emails = contact.emailAddresses || [];
        const primaryEmail = emails.find(e => e.metadata?.primary)?.value || emails[0]?.value;
        const phone = contact.phoneNumbers?.[0]?.value;
        const company = contact.organizations?.[0]?.name;
        const title = contact.organizations?.[0]?.title;

        // Require at least email OR phone
        if (!primaryEmail && !phone) {
          skippedNoIdentifier++;
          continue; // Skip contacts without any identifier
        }

        // Determine unique identifier (prefer email, fallback to phone)
        const identifier = primaryEmail || phone;
        const identifierField = primaryEmail ? 'canonical_email' : 'phone';

        // Check if profile already exists
        const { data: existingProfile } = await supabase
          .from('relationship_profiles')
          .select('id')
          .eq(identifierField, identifier)
          .single();

        if (existingProfile) {
          // Update existing profile
          const updateData = {
            contact_name: name,
            source: 'google_contacts',
            google_resource_name: contact.resourceName,
            synced_to_google: true,
            last_synced_to_google_at: new Date().toISOString(),
            sync_direction: 'from_google',
            updated_at: new Date().toISOString()
          };

          // Add fields only if they have values
          if (primaryEmail) updateData.canonical_email = primaryEmail;
          if (phone) updateData.phone = phone;
          if (company) updateData.company = company;
          if (title) updateData.title = title;

          await supabase
            .from('relationship_profiles')
            .update(updateData)
            .eq(identifierField, identifier);
        } else {
          // Create new profile
          const insertData = {
            user_id: userId,
            contact_name: name,
            canonical_email: primaryEmail || null,
            contact_email: primaryEmail || null,
            phone: phone || null,
            company: company || null,
            title: title || null,
            relationship_score: 50,
            relationship_trend: 'new',
            communication_frequency: 'monthly',
            preferred_channel: primaryEmail ? 'email' : 'phone',
            source: 'google_contacts',
            google_resource_name: contact.resourceName,
            synced_to_google: true,
            last_synced_to_google_at: new Date().toISOString(),
            sync_direction: 'from_google',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          await supabase
            .from('relationship_profiles')
            .insert(insertData);
        }

        syncedCount++;

        // Track this contact for potential labeling
        if (contact.resourceName) {
          importedContactResourceNames.push(contact.resourceName);
        }
      } catch (error) {
        console.error(`[GoogleContacts] Error syncing contact:`, error.message);
        if (error.message?.includes('database') || error.message?.includes('constraint')) {
          failedDatabaseError++;
        } else {
          failedCount++;
        }
      }
    }

    // Auto-label imported contacts in Google Contacts (if enabled)
    try {
      const { data: labelConfig } = await supabase
        .from('google_contacts_auto_sync_config')
        .select('auto_label_enabled')
        .eq('user_id', userId)
        .single();

      if (labelConfig?.auto_label_enabled && importedContactResourceNames.length > 0) {
        console.log(`[GoogleContacts] Auto-labeling enabled, will add ${importedContactResourceNames.length} contacts to "Logos Vision" label`);

        const labelResourceName = await getOrCreateLogosVisionLabel(people, supabase, userId);
        await addContactsToLabel(people, importedContactResourceNames, labelResourceName);

        console.log(`[GoogleContacts] ✅ Contacts labeled in Google Contacts`);
      } else if (labelConfig?.auto_label_enabled) {
        console.log(`[GoogleContacts] Auto-labeling enabled but no contacts to label`);
      }
    } catch (error) {
      console.error(`[GoogleContacts] Error auto-labeling contacts (continuing anyway):`, error.message);
      // Don't fail the entire sync if labeling fails
    }

    // Mark sync job as completed
    await supabase
      .from('google_contacts_sync_jobs')
      .update({
        status: 'completed',
        total_contacts: allContacts.length,
        synced: syncedCount,
        failed: failedCount,
        skipped_no_identifier: skippedNoIdentifier,
        failed_database_error: failedDatabaseError,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', syncJobId);

    // Save new sync token for future incremental syncs
    if (newSyncToken) {
      await supabase
        .from('google_contacts_auto_sync_config')
        .upsert({
          user_id: userId,
          sync_token: newSyncToken,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      console.log(`[GoogleContacts] ✅ Sync token saved for future incremental syncs`);
    }

    console.log(`[GoogleContacts] Sync completed: ${syncedCount} synced, ${failedCount} failed, ${skippedNoIdentifier} skipped (no identifier)`);

  } catch (error) {
    console.error(`[GoogleContacts] Sync failed:`, error);

    // Mark sync job as failed
    await supabase
      .from('google_contacts_sync_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', syncJobId);

    throw error;
  }
}

// Trigger Google Contacts sync
app.post('/api/logos-vision/sync', verifyLogosVisionAuth, async (req, res) => {
  try {
    const { workspace_id, sync_type = 'contacts', filter } = req.body;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Create sync job record
    const syncJob = {
      id: crypto.randomUUID(),
      user_id: workspace_id,
      workspace_id,
      sync_type,
      status: 'in_progress',
      total_contacts: 0,
      synced: 0,
      failed: 0,
      filter: filter || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: createdJob, error } = await supabase
      .from('google_contacts_sync_jobs')
      .insert(syncJob)
      .select()
      .single();

    if (error && error.code === '42P01') {
      // Table doesn't exist, return mock sync job
      return res.json({
        sync_id: syncJob.id,
        status: 'in_progress',
        total_contacts: 0,
        synced: 0,
        message: 'Sync initiated (mock mode - table not created yet)'
      });
    }

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Trigger actual Google Contacts fetch in background
    fetchGoogleContactsInBackground(workspace_id, syncJob.id, filter).catch(error => {
      console.error('Background sync error:', error);
    });

    res.json({
      sync_id: syncJob.id,
      status: 'in_progress',
      total_contacts: 0,
      synced: 0,
      message: 'Sync initiated - fetching contacts from Google'
    });
  } catch (error) {
    console.error('Sync trigger error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Check sync status
app.get('/api/logos-vision/sync/:id/status', verifyLogosVisionAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: syncJob, error } = await supabase
      .from('google_contacts_sync_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Sync job not found' });
    }

    if (error && error.code === '42P01') {
      // Table doesn't exist, return mock data
      return res.json({
        sync_id: id,
        status: 'completed',
        total_contacts: 0,
        synced: 0,
        failed: 0,
        message: 'Mock sync job (table not created yet)'
      });
    }

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      sync_id: syncJob.id,
      status: syncJob.status,
      total_contacts: syncJob.total_contacts,
      synced: syncJob.synced,
      failed: syncJob.failed,
      skipped_no_identifier: syncJob.skipped_no_identifier || 0,
      failed_database_error: syncJob.failed_database_error || 0,
      completed_at: syncJob.completed_at,
      message: syncJob.error_message || undefined
    });
  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get auto-sync configuration
app.get('/api/logos-vision/auto-sync/config', verifyLogosVisionAuth, async (req, res) => {
  try {
    const { workspace_id } = req.query;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
      .from('google_contacts_auto_sync_config')
      .select('*')
      .eq('user_id', workspace_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }

    // Return default config if not found
    res.json(data || {
      enabled: false,
      interval_hours: 24,
      last_sync_at: null,
      next_sync_at: null,
      auto_label_enabled: false
    });
  } catch (error) {
    console.error('Get auto-sync config error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update auto-sync configuration
app.put('/api/logos-vision/auto-sync/config', verifyLogosVisionAuth, async (req, res) => {
  try {
    const { workspace_id, enabled, interval_hours, auto_label_enabled } = req.body;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Calculate next sync time
    const now = new Date();
    const next_sync_at = new Date(now.getTime() + (interval_hours || 24) * 60 * 60 * 1000);

    const updateData = {
      user_id: workspace_id,
      enabled,
      interval_hours: interval_hours || 24,
      next_sync_at: enabled ? next_sync_at.toISOString() : null,
      updated_at: now.toISOString()
    };

    // Include auto_label_enabled if provided
    if (auto_label_enabled !== undefined) {
      updateData.auto_label_enabled = auto_label_enabled;
    }

    const { data, error } = await supabase
      .from('google_contacts_auto_sync_config')
      .upsert(updateData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    console.log(`[AutoSync] Config updated for ${workspace_id}: enabled=${enabled}, interval=${interval_hours}h, auto_label=${auto_label_enabled}`);

    res.json(data);
  } catch (error) {
    console.error('Update auto-sync config error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Preview Google Contacts (fetch without importing)
app.get('/api/logos-vision/contacts/preview', verifyLogosVisionAuth, async (req, res) => {
  try {
    const { workspace_id } = req.query;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    console.log(`[GoogleContacts] Previewing contacts for user ${workspace_id}`);

    // Get stored OAuth tokens
    const tokenData = await getGoogleTokens(workspace_id);

    if (!tokenData || !tokenData.access_token) {
      return res.status(401).json({ error: 'No Google OAuth tokens found. Please authorize first.' });
    }

    // Set OAuth credentials
    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expiry_date: tokenData.expiry_date
    });

    // Create People API client
    const people = google.people({ version: 'v1', auth: oauth2Client });

    // Fetch all contacts
    const allContacts = [];
    let pageToken = null;

    do {
      const response = await people.people.connections.list({
        resourceName: 'people/me',
        pageSize: 100,
        personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,biographies',
        pageToken
      });

      if (response.data.connections) {
        allContacts.push(...response.data.connections);
      }

      pageToken = response.data.nextPageToken;
    } while (pageToken);

    console.log(`[GoogleContacts] Preview fetched ${allContacts.length} contacts`);

    // Transform contacts to frontend-friendly format
    const previewContacts = allContacts.map(contact => {
      const name = contact.names?.[0]?.displayName || 'Unnamed Contact';
      const primaryEmail = contact.emailAddresses?.[0]?.value || null;
      const phone = contact.phoneNumbers?.[0]?.value || null;
      const company = contact.organizations?.[0]?.name || null;
      const title = contact.organizations?.[0]?.title || null;
      const resourceName = contact.resourceName;

      return {
        resourceName,
        name,
        email: primaryEmail,
        phone,
        company,
        title,
        hasIdentifier: !!(primaryEmail || phone)
      };
    });

    res.json({
      total: previewContacts.length,
      contacts: previewContacts
    });
  } catch (error) {
    console.error('[GoogleContacts] Preview error:', error);
    res.status(500).json({ error: error.message || 'Failed to preview contacts' });
  }
});

// Selective import (import only selected contacts)
app.post('/api/logos-vision/contacts/import-selected', verifyLogosVisionAuth, async (req, res) => {
  try {
    const { workspace_id, resource_names } = req.body;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    if (!resource_names || !Array.isArray(resource_names) || resource_names.length === 0) {
      return res.status(400).json({ error: 'resource_names array is required' });
    }

    console.log(`[GoogleContacts] Selective import for user ${workspace_id}: ${resource_names.length} contacts`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get stored OAuth tokens
    const tokenData = await getGoogleTokens(workspace_id);

    if (!tokenData || !tokenData.access_token) {
      return res.status(401).json({ error: 'No Google OAuth tokens found. Please authorize first.' });
    }

    // Set OAuth credentials
    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expiry_date: tokenData.expiry_date
    });

    // Create People API client
    const people = google.people({ version: 'v1', auth: oauth2Client });

    // Import selected contacts
    let syncedCount = 0;
    let failedCount = 0;
    let skippedNoIdentifier = 0;
    let failedDatabaseError = 0;

    for (const resourceName of resource_names) {
      try {
        // Fetch individual contact
        const response = await people.people.get({
          resourceName,
          personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,biographies'
        });

        const contact = response.data;
        const name = contact.names?.[0]?.displayName || 'Unnamed Contact';
        const primaryEmail = contact.emailAddresses?.[0]?.value || null;
        const phone = contact.phoneNumbers?.[0]?.value || null;
        const company = contact.organizations?.[0]?.name || null;
        const title = contact.organizations?.[0]?.title || null;

        // Require at least email OR phone
        if (!primaryEmail && !phone) {
          skippedNoIdentifier++;
          continue;
        }

        // Use email as primary identifier, fallback to phone
        const identifier = primaryEmail || phone;
        const identifierField = primaryEmail ? 'canonical_email' : 'phone';

        // Check if profile already exists
        const { data: existingProfile } = await supabase
          .from('relationship_profiles')
          .select('id')
          .eq(identifierField, identifier)
          .single();

        if (existingProfile) {
          // Update existing profile
          const updateData = {
            contact_name: name,
            source: 'google_contacts',
            google_resource_name: resourceName,
            synced_to_google: true,
            last_synced_to_google_at: new Date().toISOString(),
            sync_direction: 'from_google',
            updated_at: new Date().toISOString()
          };

          if (primaryEmail) updateData.canonical_email = primaryEmail;
          if (phone) updateData.phone = phone;
          if (company) updateData.company = company;
          if (title) updateData.title = title;

          await supabase
            .from('relationship_profiles')
            .update(updateData)
            .eq(identifierField, identifier);
        } else {
          // Create new profile
          const insertData = {
            user_id: workspace_id,
            contact_name: name,
            canonical_email: primaryEmail || null,
            contact_email: primaryEmail || null,
            phone: phone || null,
            company: company || null,
            title: title || null,
            relationship_score: 50,
            relationship_trend: 'new',
            communication_frequency: 'monthly',
            preferred_channel: primaryEmail ? 'email' : 'phone',
            source: 'google_contacts',
            google_resource_name: resourceName,
            synced_to_google: true,
            last_synced_to_google_at: new Date().toISOString(),
            sync_direction: 'from_google',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          await supabase
            .from('relationship_profiles')
            .insert(insertData);
        }

        syncedCount++;
      } catch (error) {
        console.error(`[GoogleContacts] Error importing contact ${resourceName}:`, error.message);
        if (error.message?.includes('database') || error.message?.includes('constraint')) {
          failedDatabaseError++;
        } else {
          failedCount++;
        }
      }
    }

    console.log(`[GoogleContacts] Selective import completed: ${syncedCount} imported, ${failedCount} failed, ${skippedNoIdentifier} skipped`);

    // Auto-label imported contacts in Google Contacts (if enabled)
    try {
      const { data: labelConfig } = await supabase
        .from('google_contacts_auto_sync_config')
        .select('auto_label_enabled')
        .eq('user_id', workspace_id)
        .single();

      if (labelConfig?.auto_label_enabled && syncedCount > 0) {
        console.log(`[GoogleContacts] Auto-labeling enabled, will add ${syncedCount} contacts to "Logos Vision" label`);

        const labelResourceName = await getOrCreateLogosVisionLabel(people, supabase, workspace_id);
        // Only label the contacts that were successfully imported (not skipped/failed)
        const successfulImports = resource_names.slice(0, syncedCount);
        await addContactsToLabel(people, successfulImports, labelResourceName);

        console.log(`[GoogleContacts] ✅ Contacts labeled in Google Contacts`);
      }
    } catch (error) {
      console.error(`[GoogleContacts] Error auto-labeling contacts (continuing anyway):`, error.message);
      // Don't fail the entire import if labeling fails
    }

    res.json({
      total_selected: resource_names.length,
      imported: syncedCount,
      failed: failedCount,
      skipped_no_identifier: skippedNoIdentifier,
      failed_database_error: failedDatabaseError
    });
  } catch (error) {
    console.error('[GoogleContacts] Selective import error:', error);
    res.status(500).json({ error: error.message || 'Failed to import selected contacts' });
  }
});

// Push Logos Vision contacts to Google Contacts (Bidirectional Sync)
app.post('/api/logos-vision/contacts/push-to-google', verifyLogosVisionAuth, async (req, res) => {
  try {
    const { workspace_id } = req.body;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    console.log(`[GoogleContacts] Starting bidirectional sync (push to Google) for user ${workspace_id}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get stored OAuth tokens
    const tokenData = await getGoogleTokens(workspace_id);

    if (!tokenData || !tokenData.access_token) {
      return res.status(401).json({ error: 'No Google OAuth tokens found. Please authorize first.' });
    }

    // Set OAuth credentials
    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expiry_date: tokenData.expiry_date
    });

    // Create People API client
    const people = google.people({ version: 'v1', auth: oauth2Client });

    // Find contacts that need to be synced to Google
    // (contacts created in Logos Vision that haven't been pushed to Google yet)
    const { data: contactsToSync, error: fetchError } = await supabase
      .from('relationship_profiles')
      .select('id, contact_name, canonical_email, contact_email, phone, company, title, google_resource_name, sync_direction')
      .eq('user_id', workspace_id)
      .or('synced_to_google.is.null,synced_to_google.eq.false');

    if (fetchError) {
      console.error(`[GoogleContacts] Error fetching contacts to sync:`, fetchError);
      return res.status(500).json({ error: 'Failed to fetch contacts' });
    }

    console.log(`[GoogleContacts] Found ${contactsToSync?.length || 0} contacts to push to Google`);

    if (!contactsToSync || contactsToSync.length === 0) {
      return res.json({
        total: 0,
        created: 0,
        updated: 0,
        failed: 0,
        message: 'No contacts need to be synced to Google'
      });
    }

    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const pushedResourceNames = []; // Track for auto-labeling

    for (const contact of contactsToSync) {
      try {
        // Build contact data for Google
        const contactData = {
          names: [{ givenName: contact.contact_name || 'Unknown' }]
        };

        // Add email if available
        if (contact.canonical_email || contact.contact_email) {
          contactData.emailAddresses = [{
            value: contact.canonical_email || contact.contact_email
          }];
        }

        // Add phone if available
        if (contact.phone) {
          contactData.phoneNumbers = [{ value: contact.phone }];
        }

        // Add organization if available
        if (contact.company || contact.title) {
          contactData.organizations = [{
            name: contact.company || '',
            title: contact.title || ''
          }];
        }

        // Check if contact already exists in Google (by email)
        let existingGoogleContact = null;
        if (contact.canonical_email || contact.contact_email) {
          try {
            const searchResponse = await people.people.searchContacts({
              query: contact.canonical_email || contact.contact_email,
              readMask: 'names,emailAddresses,phoneNumbers'
            });

            if (searchResponse.data.results && searchResponse.data.results.length > 0) {
              // Found existing contact in Google
              existingGoogleContact = searchResponse.data.results[0].person;
              console.log(`[GoogleContacts] Found existing contact in Google: ${existingGoogleContact.resourceName}`);
            }
          } catch (searchError) {
            // Search failed, continue with create
            console.log(`[GoogleContacts] Search failed, will create new contact:`, searchError.message);
          }
        }

        if (existingGoogleContact && existingGoogleContact.resourceName) {
          // Update existing contact in Google
          const updateResponse = await people.people.updateContact({
            resourceName: existingGoogleContact.resourceName,
            updatePersonFields: 'names,emailAddresses,phoneNumbers,organizations',
            requestBody: contactData
          });

          console.log(`[GoogleContacts] Updated contact in Google: ${updateResponse.data.resourceName}`);

          // Update database
          await supabase
            .from('relationship_profiles')
            .update({
              google_resource_name: updateResponse.data.resourceName,
              synced_to_google: true,
              last_synced_to_google_at: new Date().toISOString(),
              sync_direction: 'bidirectional',
              updated_at: new Date().toISOString()
            })
            .eq('id', contact.id);

          updatedCount++;
          pushedResourceNames.push(updateResponse.data.resourceName);
        } else {
          // Create new contact in Google
          const createResponse = await people.people.createContact({
            requestBody: contactData
          });

          console.log(`[GoogleContacts] Created contact in Google: ${createResponse.data.resourceName}`);

          // Update database
          await supabase
            .from('relationship_profiles')
            .update({
              google_resource_name: createResponse.data.resourceName,
              synced_to_google: true,
              last_synced_to_google_at: new Date().toISOString(),
              sync_direction: contact.sync_direction === 'from_google' ? 'bidirectional' : 'to_google',
              updated_at: new Date().toISOString()
            })
            .eq('id', contact.id);

          createdCount++;
          pushedResourceNames.push(createResponse.data.resourceName);
        }
      } catch (error) {
        console.error(`[GoogleContacts] Error pushing contact ${contact.contact_name}:`, error.message);
        failedCount++;
      }
    }

    // Auto-label pushed contacts (if enabled)
    try {
      const { data: labelConfig } = await supabase
        .from('google_contacts_auto_sync_config')
        .select('auto_label_enabled')
        .eq('user_id', workspace_id)
        .single();

      if (labelConfig?.auto_label_enabled && pushedResourceNames.length > 0) {
        console.log(`[GoogleContacts] Auto-labeling ${pushedResourceNames.length} pushed contacts`);
        const labelResourceName = await getOrCreateLogosVisionLabel(people, supabase, workspace_id);
        await addContactsToLabel(people, pushedResourceNames, labelResourceName);
        console.log(`[GoogleContacts] ✅ Pushed contacts labeled in Google Contacts`);
      }
    } catch (error) {
      console.error(`[GoogleContacts] Error auto-labeling pushed contacts (continuing anyway):`, error.message);
    }

    console.log(`[GoogleContacts] Bidirectional sync completed: ${createdCount} created, ${updatedCount} updated, ${failedCount} failed`);

    res.json({
      total: contactsToSync.length,
      created: createdCount,
      updated: updatedCount,
      failed: failedCount
    });
  } catch (error) {
    console.error('[GoogleContacts] Push to Google error:', error);
    res.status(500).json({ error: error.message || 'Failed to push contacts to Google' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Pulse API Server Running' });
});

// Background Auto-Sync Scheduler
// Runs every hour to check for due syncs
const AUTO_SYNC_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

async function checkAndRunAutoSyncs() {
  try {
    console.log('[AutoSync] Checking for due syncs...');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get all users with auto-sync enabled and due for sync
    const now = new Date();
    const { data: configs, error } = await supabase
      .from('google_contacts_auto_sync_config')
      .select('*')
      .eq('enabled', true)
      .lte('next_sync_at', now.toISOString());

    if (error) {
      console.error('[AutoSync] Error fetching configs:', error);
      return;
    }

    if (!configs || configs.length === 0) {
      console.log('[AutoSync] No users due for sync');
      return;
    }

    console.log(`[AutoSync] Found ${configs.length} user(s) due for sync`);

    for (const config of configs) {
      try {
        console.log(`[AutoSync] Starting sync for user ${config.user_id}`);

        // Create sync job
        const { data: syncJob, error: jobError } = await supabase
          .from('google_contacts_sync_jobs')
          .insert({
            user_id: config.user_id,
            workspace_id: config.user_id,
            status: 'pending',
            sync_type: 'contacts',
            filter: { label: 'Logos Vision' }
          })
          .select()
          .single();

        if (jobError) throw jobError;

        // Trigger background sync (non-blocking)
        fetchGoogleContactsInBackground(config.user_id, syncJob.id, { label: 'Logos Vision' })
          .catch(err => {
            console.error(`[AutoSync] Sync failed for user ${config.user_id}:`, err);
          });

        // Update next sync time
        const nextSyncAt = new Date(now.getTime() + config.interval_hours * 60 * 60 * 1000);

        await supabase
          .from('google_contacts_auto_sync_config')
          .update({
            last_sync_at: now.toISOString(),
            next_sync_at: nextSyncAt.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('user_id', config.user_id);

        console.log(`[AutoSync] Sync initiated for user ${config.user_id}, next sync at ${nextSyncAt.toISOString()}`);
      } catch (err) {
        console.error(`[AutoSync] Failed to start sync for user ${config.user_id}:`, err);
      }
    }
  } catch (err) {
    console.error('[AutoSync] Scheduler error:', err);
  }
}

// Start the auto-sync scheduler
setInterval(checkAndRunAutoSyncs, AUTO_SYNC_CHECK_INTERVAL);
console.log(`⏰ Auto-sync scheduler started (checking every ${AUTO_SYNC_CHECK_INTERVAL / 1000 / 60} minutes)`);

// Run once on startup (after 10 seconds to allow server to fully initialize)
setTimeout(() => {
  checkAndRunAutoSyncs().catch(err => {
    console.error('[AutoSync] Initial check failed:', err);
  });
}, 10000);

app.listen(PORT, () => {
  console.log(`🚀 Pulse API Server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying Slack, Gmail, Twilio & OpenAI Realtime API requests...`);
  console.log(`🎤 Voice Agent endpoint: POST /api/realtime/session-token`);
  console.log(`🔗 CRM OAuth callbacks: /api/crm/callback/:platform`);
});
