import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = 3003;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

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

// Enable CORS for the Vite dev server
app.use(cors({
  origin: ['http://localhost:3002', 'http://localhost:3000', 'http://localhost:3001'],
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Pulse API Server Running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Pulse API Server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying Slack, Gmail, Twilio & OpenAI Realtime API requests...`);
  console.log(`🎤 Voice Agent endpoint: POST /api/realtime/session-token`);
  console.log(`🔗 CRM OAuth callbacks: /api/crm/callback/:platform`);
});
