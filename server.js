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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

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
  const { endpoint, token, params } = req.body;

  if (!endpoint || !token) {
    return res.status(400).json({ error: 'Missing endpoint or token' });
  }

  try {
    const url = new URL(`https://slack.com/api/${endpoint}`);

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
app.post('/api/google/refresh-token', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: 'Missing refresh_token',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    // Get Google OAuth credentials from environment
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[Google Token Refresh] Missing credentials - clientId:', !!clientId, 'clientSecret:', !!clientSecret);
      return res.status(500).json({
        error: 'Server configuration error: Google OAuth credentials not configured',
        code: 'MISSING_CREDENTIALS'
      });
    }

    console.log('[Google Token Refresh] Attempting to refresh token...');

    // Call Google OAuth2 token endpoint with client secret
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,  // ✅ Backend has the secret
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Google Token Refresh] Failed:', errorData);

      // Handle specific Google OAuth errors
      if (errorData.error === 'invalid_grant') {
        return res.status(401).json({
          error: 'Refresh token expired or revoked. Please re-authenticate.',
          code: 'INVALID_GRANT',
          requiresReauth: true
        });
      }

      return res.status(response.status).json({
        error: errorData.error_description || 'Token refresh failed',
        code: errorData.error || 'REFRESH_FAILED'
      });
    }

    const data = await response.json();
    console.log('[Google Token Refresh] Success - token expires in', data.expires_in, 'seconds');

    res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope
    });

  } catch (error) {
    console.error('[Google Token Refresh] Server error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// OpenAI Realtime API - Ephemeral Token Generation
// This endpoint generates a short-lived token for WebRTC connections
app.post('/api/realtime/session-token', async (req, res) => {
  const { model = 'gpt-4o-realtime-preview-2024-12-17', voice = 'nova' } = req.body;

  // Get API key from request header or environment
  const apiKey = req.headers['x-openai-api-key'] || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({
      error: 'OpenAI API key required',
      message: 'Provide key in X-OpenAI-API-Key header or set OPENAI_API_KEY environment variable'
    });
  }

  try {
    // Request ephemeral token from OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice,
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

    // Return the ephemeral token (expires in ~60 seconds)
    res.json({
      client_secret: data.client_secret,
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
    const { exchangeCodeForToken } = await import('./src/services/crm/oauthHelper.js');

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

// Enrich a single contact with AI intelligence
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
