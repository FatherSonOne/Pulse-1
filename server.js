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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Pulse API Server Running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Pulse API Server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying Slack, Gmail, Twilio & OpenAI Realtime API requests...`);
  console.log(`🎤 Voice Agent endpoint: POST /api/realtime/session-token`);
});
