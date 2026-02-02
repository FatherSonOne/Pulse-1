# Pulse API - Logos Vision CRM Integration Developer Guide

**Last Updated:** 2026-01-27
**API Version:** 1.0
**Pulse Location:** F:\pulse1
**Logos Vision Location:** F:\logos-vision-crm

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Environment Setup](#environment-setup)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Google OAuth Implementation](#google-oauth-implementation)
7. [Background Sync Processing](#background-sync-processing)
8. [Security & Authentication](#security--authentication)
9. [Testing](#testing)
10. [Deployment](#deployment)
11. [Troubleshooting](#troubleshooting)

---

## Overview

### What is This Integration?

The Pulse API serves as the **backend intelligence layer** for Logos Vision CRM, providing:

- **Google Contacts Sync** - OAuth-based contact import from Google
- **AI Enrichment** - Relationship scoring and insights (future)
- **Background Processing** - Async sync jobs with progress tracking
- **Data Transformation** - Google Contacts → Supabase schema mapping

### Technology Stack

- **Runtime:** Node.js 24.x with ES Modules
- **Framework:** Express.js
- **Database:** Supabase (PostgreSQL with RLS)
- **APIs:** Google People API (googleapis@137.0.0)
- **Authentication:** Google OAuth 2.0 + API Key auth
- **Environment:** dotenv for config

### Key Files

```
F:\pulse1\
├── server.js                  # Main Express app with API routes
├── .env.local                 # Environment variables (not committed)
├── package.json               # Dependencies
├── migrations/                # Database migrations
│   ├── 001_google_contacts_sync_jobs.sql
│   ├── 002_relationship_profiles.sql
│   ├── 003_google_oauth_tokens.sql
│   └── 004_fix_user_id_column.sql
└── PULSE_API_LOGOS_VISION_INTEGRATION_GUIDE.md  # This file
```

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                 Logos Vision CRM                         │
│          (React Frontend - F:\logos-vision-crm)          │
│                                                           │
│  User clicks "Sync with Pulse" button                    │
│         ↓                                                 │
│  pulseApiService.ts calls Pulse API                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP POST /api/logos-vision/sync
                     │ Headers: X-API-Key: shared_secret
                     │
┌────────────────────▼────────────────────────────────────┐
│                   Pulse API Server                       │
│            (Express.js - F:\pulse1\server.js)            │
│                                                           │
│  1. Verify API key authentication                        │
│  2. Create sync job in database                          │
│  3. Spawn background sync process                        │
│  4. Return sync_id to client                             │
│                                                           │
│  Background Process:                                     │
│  ┌──────────────────────────────────────┐               │
│  │ fetchGoogleContactsInBackground()    │               │
│  │   ↓                                  │               │
│  │ 1. Get OAuth tokens from DB          │               │
│  │ 2. Call Google People API            │               │
│  │ 3. Paginate through all contacts     │               │
│  │ 4. Transform data format             │               │
│  │ 5. Insert into relationship_profiles │               │
│  │ 6. Update sync job status            │               │
│  └──────────────────────────────────────┘               │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Multiple API calls
                     ↓
┌─────────────────────────────────────────────────────────┐
│                 Google People API                        │
│  (people.googleapis.com/v1/people/me/connections)        │
│                                                           │
│  Returns paginated contact data:                         │
│  - names, emailAddresses, phoneNumbers                   │
│  - organizations, addresses, biographies                 │
└─────────────────────────────────────────────────────────┘

                     ↓ Stores results
┌─────────────────────────────────────────────────────────┐
│              Pulse Supabase Database                     │
│                                                           │
│  Tables:                                                 │
│  ┌─────────────────────────────────────┐                │
│  │ google_oauth_tokens                 │                │
│  │ - user_id, access_token,            │                │
│  │   refresh_token, expiry_date        │                │
│  └─────────────────────────────────────┘                │
│                                                           │
│  ┌─────────────────────────────────────┐                │
│  │ google_contacts_sync_jobs           │                │
│  │ - id, user_id, status,              │                │
│  │   total_contacts, synced, failed    │                │
│  └─────────────────────────────────────┘                │
│                                                           │
│  ┌─────────────────────────────────────┐                │
│  │ relationship_profiles               │                │
│  │ - contact_name, canonical_email,    │                │
│  │   phone, company, title, source     │                │
│  └─────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────┘
```

### Data Flow Sequence

1. **User Authorization (One-time)**
   ```
   User → Logos Vision → Pulse API → Google OAuth → Pulse API → Database
   ```

2. **Manual Sync Trigger**
   ```
   User clicks sync → Logos Vision → Pulse API → Create job → Background process
   ```

3. **Background Sync**
   ```
   Background job → Get tokens → Google API → Transform data → Supabase → Update job
   ```

4. **Status Polling**
   ```
   Logos Vision → Poll status endpoint → Pulse API → Query database → Return progress
   ```

---

## Environment Setup

### Prerequisites

1. **Node.js 24.x** installed
2. **npm** package manager
3. **Supabase project** with credentials
4. **Google Cloud project** with OAuth credentials

### Installation Steps

#### 1. Install Dependencies

```bash
cd F:\pulse1
npm install
```

**Required packages:**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "@supabase/supabase-js": "^2.39.0",
    "googleapis": "^137.0.0",
    "dotenv": "^17.2.3",
    "cors": "^2.8.5"
  }
}
```

#### 2. Configure Environment Variables

Create `F:\pulse1\.env.local`:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key

# Google OAuth Configuration
GOOGLE_CLIENT_ID=234234056284-xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_REDIRECT_URI=http://localhost:3003/api/logos-vision/auth/callback

# Google API Scopes (space-separated)
GOOGLE_SCOPES=https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email

# Logos Vision API Security
LOGOS_VISION_API_KEY=logos_vision_pulse_shared_secret_2026

# Server Configuration
PORT=3003
NODE_ENV=development
```

**Important Notes:**
- `SUPABASE_SERVICE_ROLE_KEY` is required to bypass RLS policies
- `GOOGLE_REDIRECT_URI` must match Google Cloud Console configuration
- `LOGOS_VISION_API_KEY` must match the key in Logos Vision CRM

#### 3. Load Environment in server.js

```javascript
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const LOGOS_VISION_API_KEY = process.env.LOGOS_VISION_API_KEY;
```

---

## Database Schema

### Migration Files

Run these migrations in order on your Pulse Supabase project:

#### Migration 001: Google Contacts Sync Jobs

**File:** `F:\pulse1\migrations\001_google_contacts_sync_jobs.sql`

```sql
-- Create sync jobs table
CREATE TABLE IF NOT EXISTS public.google_contacts_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  sync_type TEXT NOT NULL DEFAULT 'contacts' CHECK (sync_type IN ('contacts', 'full')),

  -- Sync configuration
  filter JSONB DEFAULT '{}',
  label TEXT,
  domain TEXT,

  -- Progress tracking
  total_contacts INTEGER DEFAULT 0,
  synced INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,

  -- Results
  error_message TEXT,
  error_details JSONB,
  sync_results JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_google_contacts_sync_jobs_user_id ON google_contacts_sync_jobs(user_id);
CREATE INDEX idx_google_contacts_sync_jobs_status ON google_contacts_sync_jobs(status);
CREATE INDEX idx_google_contacts_sync_jobs_created_at ON google_contacts_sync_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE google_contacts_sync_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can do anything"
  ON google_contacts_sync_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON google_contacts_sync_jobs TO service_role;
```

#### Migration 002: Relationship Profiles (Contacts)

**File:** `F:\pulse1\migrations\002_relationship_profiles.sql`

```sql
-- Note: This table may already exist in Pulse
-- Ensure these columns exist for Logos Vision integration

ALTER TABLE public.relationship_profiles
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS google_resource_name TEXT,
ADD COLUMN IF NOT EXISTS sync_metadata JSONB;

-- Index for Google resource lookup
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_google_resource
ON relationship_profiles(google_resource_name);

-- Index for source filtering
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_source
ON relationship_profiles(source);
```

#### Migration 003: Google OAuth Tokens

**File:** `F:\pulse1\migrations\003_google_oauth_tokens.sql`

```sql
-- Create OAuth tokens table
CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,

  -- OAuth tokens
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expiry_date BIGINT,
  scope TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can do anything"
  ON google_oauth_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON google_oauth_tokens TO service_role;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_google_oauth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_google_oauth_tokens_timestamp
  BEFORE UPDATE ON google_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_google_oauth_tokens_updated_at();
```

### How to Run Migrations

**Option A: Supabase Dashboard (Recommended)**

1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
2. Copy SQL from migration file
3. Paste and run
4. Verify tables created

**Option B: Supabase CLI**

```bash
cd F:\pulse1
supabase db push
```

---

## API Endpoints

### Authentication Middleware

All Logos Vision endpoints require API key authentication:

```javascript
function verifyLogosVisionAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== LOGOS_VISION_API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }

  next();
}
```

### Endpoint 1: Get OAuth Authorization URL

**Purpose:** Generate Google OAuth consent URL for user authorization

**Route:** `GET /api/logos-vision/auth/url`

**Query Parameters:**
- `workspace_id` (string, required) - User/workspace identifier

**Request Example:**
```bash
curl -X GET "http://localhost:3003/api/logos-vision/auth/url?workspace_id=current-user-id" \
  -H "X-API-Key: logos_vision_pulse_shared_secret_2026"
```

**Response:**
```json
{
  "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=...",
  "state": "random-state-string"
}
```

**Implementation:**
```javascript
app.get('/api/logos-vision/auth/url', verifyLogosVisionAuth, async (req, res) => {
  const { workspace_id } = req.query;

  if (!workspace_id) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  // Generate random state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES.split(' '),
    state: `${workspace_id}:${state}`,
    prompt: 'consent'
  });

  res.json({ auth_url: authUrl, state });
});
```

### Endpoint 2: OAuth Callback Handler

**Purpose:** Handle Google OAuth redirect, exchange code for tokens

**Route:** `GET /api/logos-vision/auth/callback`

**Query Parameters:**
- `code` (string) - OAuth authorization code from Google
- `state` (string) - State parameter for verification

**Flow:**
```
Google redirects → Pulse callback → Exchange code → Store tokens → Redirect to Logos Vision
```

**Implementation:**
```javascript
app.get('/api/logos-vision/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('[OAuth] Authorization error:', error);
    return res.redirect(`http://localhost:5176/contacts?oauth_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state' });
  }

  try {
    // Extract workspace_id from state
    const [workspace_id] = state.split(':');

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    console.log('[OAuth] Tokens received:', tokens);

    // Store tokens in database
    await storeGoogleTokens(workspace_id, tokens);
    console.log(`✅ Google OAuth tokens stored for workspace: ${workspace_id}`);

    // Redirect back to Logos Vision with success
    res.redirect('http://localhost:5176/contacts?oauth_success=true');
  } catch (err) {
    console.error('[OAuth] Token exchange error:', err);
    res.redirect(`http://localhost:5176/contacts?oauth_error=${encodeURIComponent(err.message)}`);
  }
});

async function storeGoogleTokens(userId, tokens) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Endpoint 3: Trigger Sync

**Purpose:** Start background Google Contacts sync

**Route:** `POST /api/logos-vision/sync`

**Request Body:**
```json
{
  "workspace_id": "current-user-id",
  "sync_type": "contacts",
  "filter": {
    "label": "Logos Vision"
  }
}
```

**Response:**
```json
{
  "sync_id": "uuid-of-sync-job",
  "status": "in_progress",
  "message": "Sync initiated",
  "total_contacts": 0,
  "synced": 0,
  "failed": 0
}
```

**Implementation:**
```javascript
app.post('/api/logos-vision/sync', verifyLogosVisionAuth, async (req, res) => {
  const { workspace_id, sync_type = 'contacts', filter = {} } = req.body;

  if (!workspace_id) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Create sync job record
    const { data: syncJob, error: jobError } = await supabase
      .from('google_contacts_sync_jobs')
      .insert({
        user_id: workspace_id,
        workspace_id,
        status: 'pending',
        sync_type,
        filter,
        label: filter.label,
        domain: filter.domain
      })
      .select()
      .single();

    if (jobError) throw jobError;

    console.log(`[Sync] Created sync job: ${syncJob.id}`);

    // Start background sync (non-blocking)
    fetchGoogleContactsInBackground(workspace_id, syncJob.id, filter)
      .catch(err => {
        console.error(`[Sync] Background sync failed:`, err);
      });

    // Return immediately
    res.json({
      sync_id: syncJob.id,
      status: 'in_progress',
      message: 'Sync initiated',
      total_contacts: 0,
      synced: 0,
      failed: 0
    });
  } catch (err) {
    console.error('[Sync] Error creating sync job:', err);
    res.status(500).json({ error: err.message });
  }
});
```

### Endpoint 4: Check Sync Status

**Purpose:** Poll sync job progress

**Route:** `GET /api/logos-vision/sync/:id/status`

**Response:**
```json
{
  "sync_id": "uuid",
  "status": "in_progress",
  "total_contacts": 428,
  "synced": 200,
  "failed": 0,
  "started_at": "2026-01-27T10:00:00Z",
  "message": "Syncing contacts..."
}
```

**When Complete:**
```json
{
  "sync_id": "uuid",
  "status": "completed",
  "total_contacts": 428,
  "synced": 12,
  "failed": 416,
  "completed_at": "2026-01-27T10:05:00Z",
  "message": "Sync completed successfully"
}
```

**Implementation:**
```javascript
app.get('/api/logos-vision/sync/:id/status', verifyLogosVisionAuth, async (req, res) => {
  const { id } = req.params;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: syncJob, error } = await supabase
    .from('google_contacts_sync_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !syncJob) {
    return res.status(404).json({ error: 'Sync job not found' });
  }

  res.json({
    sync_id: syncJob.id,
    status: syncJob.status,
    total_contacts: syncJob.total_contacts || 0,
    synced: syncJob.synced || 0,
    failed: syncJob.failed || 0,
    skipped: syncJob.skipped || 0,
    started_at: syncJob.started_at,
    completed_at: syncJob.completed_at,
    message: syncJob.error_message || getStatusMessage(syncJob.status)
  });
});

function getStatusMessage(status) {
  const messages = {
    'pending': 'Sync queued',
    'in_progress': 'Syncing contacts...',
    'completed': 'Sync completed successfully',
    'failed': 'Sync failed'
  };
  return messages[status] || 'Unknown status';
}
```

### Endpoint 5: Get Contacts

**Purpose:** Fetch synced contacts with optional filters

**Route:** `GET /api/logos-vision/contacts`

**Query Parameters:**
- `workspace_id` (string, required)
- `limit` (integer, default: 100)
- `offset` (integer, default: 0)
- `source` (string, optional) - Filter by source (e.g., 'google_contacts')

**Response:**
```json
{
  "contacts": [
    {
      "id": "uuid",
      "contact_name": "John Doe",
      "canonical_email": "john@example.com",
      "phone": "+1234567890",
      "company": "Acme Corp",
      "title": "CEO",
      "source": "google_contacts",
      "created_at": "2026-01-27T10:00:00Z"
    }
  ],
  "total": 12,
  "limit": 100,
  "offset": 0
}
```

**Implementation:**
```javascript
app.get('/api/logos-vision/contacts', verifyLogosVisionAuth, async (req, res) => {
  const { workspace_id, limit = 100, offset = 0, source } = req.query;

  if (!workspace_id) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let query = supabase
    .from('relationship_profiles')
    .select('*', { count: 'exact' })
    .eq('user_id', workspace_id)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (source) {
    query = query.eq('source', source);
  }

  const { data, error, count } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({
    contacts: data || [],
    total: count || 0,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
});
```

---

## Google OAuth Implementation

### OAuth Setup Steps

#### 1. Google Cloud Console Configuration

1. **Go to:** https://console.cloud.google.com/apis/credentials
2. **Create OAuth 2.0 Client:**
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: **Web application**
   - Name: "Pulse API - Logos Vision Integration"

3. **Configure Redirect URIs:**
   - Development: `http://localhost:3003/api/logos-vision/auth/callback`
   - Production: `https://your-pulse-api.com/api/logos-vision/auth/callback`

4. **Enable APIs:**
   - Google Contacts API
   - Google People API
   - Enable at: https://console.cloud.google.com/apis/library

5. **Copy Credentials:**
   - Client ID: `234234056284-xxx.apps.googleusercontent.com`
   - Client Secret: `GOCSPX-xxx`

#### 2. Initialize OAuth Client in server.js

```javascript
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
];
```

#### 3. Token Management Functions

```javascript
async function getGoogleTokens(userId) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type,
    expiry_date: data.expiry_date,
    scope: data.scope
  };
}

async function refreshAccessToken(userId) {
  const tokens = await getGoogleTokens(userId);
  if (!tokens || !tokens.refresh_token) {
    throw new Error('No refresh token available');
  }

  oauth2Client.setCredentials(tokens);

  const { credentials } = await oauth2Client.refreshAccessToken();

  await storeGoogleTokens(userId, credentials);

  return credentials;
}
```

---

## Background Sync Processing

### Main Sync Function

```javascript
async function fetchGoogleContactsInBackground(userId, syncJobId, filter = {}) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log(`[GoogleContacts] Starting sync for user ${userId}, job ${syncJobId}`);

    // Update job status to in_progress
    await supabase
      .from('google_contacts_sync_jobs')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', syncJobId);

    // Get OAuth tokens
    const tokens = await getGoogleTokens(userId);
    if (!tokens) {
      throw new Error('No Google OAuth tokens found. Please authorize first.');
    }

    oauth2Client.setCredentials(tokens);

    // Initialize People API
    const people = google.people({ version: 'v1', auth: oauth2Client });

    // Fetch all contacts with pagination
    let allContacts = [];
    let pageToken = null;

    do {
      const response = await people.people.connections.list({
        resourceName: 'people/me',
        pageSize: 100,
        personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,biographies',
        pageToken
      });

      allContacts = allContacts.concat(response.data.connections || []);
      pageToken = response.data.nextPageToken;

      console.log(`[GoogleContacts] Fetched ${allContacts.length} contacts so far...`);

      // Update progress
      await supabase
        .from('google_contacts_sync_jobs')
        .update({
          total_contacts: allContacts.length
        })
        .eq('id', syncJobId);
    } while (pageToken);

    console.log(`[GoogleContacts] Total contacts fetched: ${allContacts.length}`);

    // Apply label filtering (note: actual label filtering done in Logos Vision)
    if (filter.label) {
      console.log(`[GoogleContacts] Label filtering (${filter.label}) will be done in Logos Vision`);
    }

    // Import contacts to database
    let syncedCount = 0;
    let failedCount = 0;

    for (const contact of allContacts) {
      try {
        const result = await importContactToSupabase(supabase, userId, contact);
        if (result.success) {
          syncedCount++;
        } else {
          failedCount++;
        }

        // Update progress every 10 contacts
        if ((syncedCount + failedCount) % 10 === 0) {
          await supabase
            .from('google_contacts_sync_jobs')
            .update({
              synced: syncedCount,
              failed: failedCount
            })
            .eq('id', syncJobId);
        }
      } catch (err) {
        console.error(`[GoogleContacts] Failed to import contact:`, err);
        failedCount++;
      }
    }

    // Final update
    await supabase
      .from('google_contacts_sync_jobs')
      .update({
        status: 'completed',
        synced: syncedCount,
        failed: failedCount,
        completed_at: new Date().toISOString()
      })
      .eq('id', syncJobId);

    console.log(`[GoogleContacts] Sync completed: ${syncedCount} synced, ${failedCount} failed`);
  } catch (err) {
    console.error(`[GoogleContacts] Sync failed:`, err);

    // Update job status to failed
    await supabase
      .from('google_contacts_sync_jobs')
      .update({
        status: 'failed',
        error_message: err.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', syncJobId);

    throw err;
  }
}
```

### Contact Import Function

```javascript
async function importContactToSupabase(supabase, userId, contact) {
  const email = contact.emailAddresses?.[0]?.value;

  if (!email) {
    return {
      success: false,
      reason: 'no_email'
    };
  }

  const name = contact.names?.[0];
  const org = contact.organizations?.[0];
  const phone = contact.phoneNumbers?.[0];
  const address = contact.addresses?.[0];

  const contactData = {
    user_id: userId,
    source: 'google_contacts',
    google_resource_name: contact.resourceName,

    // Name fields
    first_name: name?.givenName || '',
    last_name: name?.familyName || '',
    contact_name: name ? `${name.givenName || ''} ${name.familyName || ''}`.trim() : email,

    // Contact info
    canonical_email: email,
    phone: phone?.value,

    // Organization
    company: org?.name,
    title: org?.title,

    // Address
    address: address?.formattedValue,

    // Metadata
    sync_metadata: {
      synced_at: new Date().toISOString(),
      google_resource: contact.resourceName
    },

    // Timestamps
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('relationship_profiles')
    .upsert(contactData, {
      onConflict: 'canonical_email',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (error) {
    console.error(`[Import] Failed to import ${email}:`, error);
    return {
      success: false,
      reason: 'database_error',
      error: error.message
    };
  }

  return {
    success: true,
    data
  };
}
```

---

## Security & Authentication

### API Key Authentication

All Logos Vision endpoints require the `X-API-Key` header:

```javascript
const LOGOS_VISION_API_KEY = process.env.LOGOS_VISION_API_KEY;

function verifyLogosVisionAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== LOGOS_VISION_API_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key'
    });
  }

  next();
}

// Apply to all Logos Vision routes
app.use('/api/logos-vision/*', verifyLogosVisionAuth);
```

### CORS Configuration

Allow requests from Logos Vision CRM:

```javascript
import cors from 'cors';

app.use(cors({
  origin: [
    'http://localhost:5176',   // Logos Vision dev
    'http://localhost:5182',   // Logos Vision alternate
    'https://your-logos-vision-domain.com'  // Production
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
```

### OAuth Token Security

- **Never expose tokens** in API responses
- **Use service role key** to bypass RLS and store tokens securely
- **Refresh tokens** when expired
- **Encrypt tokens** in database (future enhancement)

### RLS Policies

All tables use Row-Level Security with service role bypass:

```sql
CREATE POLICY "Service role can do anything"
  ON table_name
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

---

## Testing

### Manual Testing with curl

#### 1. Test Authorization URL Generation

```bash
curl -X GET "http://localhost:3003/api/logos-vision/auth/url?workspace_id=test-user" \
  -H "X-API-Key: logos_vision_pulse_shared_secret_2026"
```

**Expected:** OAuth URL returned

#### 2. Complete OAuth Flow

1. Visit the `auth_url` from step 1 in browser
2. Authorize with Google account
3. Get redirected back to callback
4. Check if redirected to Logos Vision with `oauth_success=true`

#### 3. Test Sync Trigger

```bash
curl -X POST "http://localhost:3003/api/logos-vision/sync" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: logos_vision_pulse_shared_secret_2026" \
  -d '{
    "workspace_id": "test-user",
    "sync_type": "contacts",
    "filter": {
      "label": "Logos Vision"
    }
  }'
```

**Expected:** Sync job created with `sync_id`

#### 4. Test Sync Status

```bash
curl -X GET "http://localhost:3003/api/logos-vision/sync/SYNC_ID_HERE/status" \
  -H "X-API-Key: logos_vision_pulse_shared_secret_2026"
```

**Expected:** Status with progress numbers

#### 5. Test Get Contacts

```bash
curl -X GET "http://localhost:3003/api/logos-vision/contacts?workspace_id=test-user&limit=10" \
  -H "X-API-Key: logos_vision_pulse_shared_secret_2026"
```

**Expected:** Array of synced contacts

### Automated Testing

Create test script `F:\pulse1\test-sync.js`:

```javascript
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3003';
const API_KEY = 'logos_vision_pulse_shared_secret_2026';
const WORKSPACE_ID = 'test-user';

async function testFullFlow() {
  console.log('🧪 Testing Pulse API - Logos Vision Integration\n');

  // 1. Test auth URL generation
  console.log('1. Getting OAuth URL...');
  const authResponse = await fetch(
    `${BASE_URL}/api/logos-vision/auth/url?workspace_id=${WORKSPACE_ID}`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  const authData = await authResponse.json();
  console.log('✅ Auth URL:', authData.auth_url.substring(0, 50) + '...\n');

  // 2. Trigger sync (assuming OAuth already completed)
  console.log('2. Triggering sync...');
  const syncResponse = await fetch(
    `${BASE_URL}/api/logos-vision/sync`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        workspace_id: WORKSPACE_ID,
        sync_type: 'contacts',
        filter: { label: 'Logos Vision' }
      })
    }
  );
  const syncData = await syncResponse.json();
  console.log('✅ Sync started:', syncData.sync_id, '\n');

  // 3. Poll status
  console.log('3. Polling sync status...');
  const syncId = syncData.sync_id;
  let status = 'in_progress';

  while (status === 'in_progress' || status === 'pending') {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const statusResponse = await fetch(
      `${BASE_URL}/api/logos-vision/sync/${syncId}/status`,
      { headers: { 'X-API-Key': API_KEY } }
    );
    const statusData = await statusResponse.json();
    status = statusData.status;

    console.log(`   Status: ${status}, Synced: ${statusData.synced}/${statusData.total_contacts}`);
  }

  console.log('✅ Sync completed!\n');

  // 4. Get contacts
  console.log('4. Fetching synced contacts...');
  const contactsResponse = await fetch(
    `${BASE_URL}/api/logos-vision/contacts?workspace_id=${WORKSPACE_ID}&limit=5`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  const contactsData = await contactsResponse.json();
  console.log(`✅ Found ${contactsData.total} contacts`);
  console.log('   Sample:', contactsData.contacts[0]);
}

testFullFlow().catch(console.error);
```

Run with:
```bash
node test-sync.js
```

---

## Deployment

### Development Server

```bash
cd F:\pulse1
node server.js
```

**Expected Output:**
```
[dotenv@17.2.3] injecting env (33) from .env.local
🚀 Pulse API Server running on http://localhost:3003
📡 Proxying Slack, Gmail, Twilio & OpenAI Realtime API requests...
🎤 Voice Agent endpoint: POST /api/realtime/session-token
🔗 CRM OAuth callbacks: /api/crm/callback/:platform
```

### Production Deployment

#### Option A: Node.js PM2

```bash
npm install -g pm2

# Start with PM2
pm2 start server.js --name pulse-api

# View logs
pm2 logs pulse-api

# Restart
pm2 restart pulse-api

# Stop
pm2 stop pulse-api
```

#### Option B: Docker

Create `Dockerfile`:

```dockerfile
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3003

CMD ["node", "server.js"]
```

Build and run:

```bash
docker build -t pulse-api .
docker run -p 3003:3003 --env-file .env.local pulse-api
```

### Environment Variables Checklist

Before deploying, ensure all environment variables are set:

- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `GOOGLE_REDIRECT_URI` (update for production domain)
- [ ] `LOGOS_VISION_API_KEY`

---

## Troubleshooting

### Common Issues

#### 1. "No Google OAuth tokens found"

**Cause:** User hasn't authorized yet or tokens expired

**Solution:**
- Trigger authorization flow: Call `/api/logos-vision/auth/url`
- User must complete OAuth consent
- Verify tokens stored in `google_oauth_tokens` table

**Check Database:**
```sql
SELECT user_id, created_at, updated_at
FROM google_oauth_tokens
WHERE user_id = 'test-user';
```

#### 2. "Invalid or missing API key"

**Cause:** `X-API-Key` header missing or wrong value

**Solution:**
- Ensure header included: `-H "X-API-Key: your_key_here"`
- Verify key matches `LOGOS_VISION_API_KEY` in `.env.local`
- Check Logos Vision CRM uses same key

#### 3. "People API has not been used in project"

**Cause:** Google People API not enabled

**Solution:**
1. Go to: https://console.cloud.google.com/apis/library
2. Search: "Google People API"
3. Click "Enable"
4. Wait 2-3 minutes for propagation

#### 4. CORS errors in browser

**Cause:** Logos Vision origin not in allowed list

**Solution:**
Update CORS configuration in `server.js`:

```javascript
app.use(cors({
  origin: ['http://localhost:5176', 'http://localhost:5182'],
  credentials: true
}));
```

#### 5. Sync stuck at 0/0 contacts

**Cause:** Background sync process crashed or OAuth tokens invalid

**Solution:**
1. Check Pulse server logs for errors
2. Verify OAuth tokens exist and not expired
3. Try re-authorizing
4. Check sync job status in database:

```sql
SELECT id, status, error_message, total_contacts, synced, failed
FROM google_contacts_sync_jobs
ORDER BY created_at DESC
LIMIT 5;
```

#### 6. 416 contacts failed (no email)

**Cause:** Google Contacts allows contacts without emails

**Not a bug:** This is expected behavior
- Only contacts with email addresses can be imported
- `canonical_email` is required field in `relationship_profiles`
- Solution: Future enhancement to support phone-only contacts

### Debug Mode

Enable detailed logging:

```javascript
// Add to server.js
const DEBUG = process.env.DEBUG === 'true';

function log(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

// Use in code
log('Fetching contacts for user:', userId);
log('Tokens:', tokens);
log('Response:', response.data);
```

Run with debug:
```bash
DEBUG=true node server.js
```

---

## Next Steps

### Phase 4 Enhancements

After basic integration working, consider:

1. **Auto-Sync Scheduler** - Automatic daily sync
2. **Bidirectional Sync** - Push contacts to Google
3. **Incremental Sync** - Only fetch changed contacts
4. **Selective Import** - UI to choose contacts
5. **Auto-Labeling** - Add "Logos Vision" label in Google

See: `PHASE_4_GOOGLE_CONTACTS_ENHANCEMENTS.md`

### Monitoring

Add monitoring for:
- Sync job success/failure rates
- Average sync duration
- OAuth token refresh frequency
- API endpoint response times

### Performance Optimization

- Implement caching for frequently accessed contacts
- Batch database inserts (100 at a time)
- Use database transactions for atomic operations
- Add Redis for job queue management

---

## Additional Resources

- **Google People API Docs:** https://developers.google.com/people
- **Supabase JS Client:** https://supabase.com/docs/reference/javascript
- **OAuth 2.0 Guide:** https://developers.google.com/identity/protocols/oauth2
- **Express.js Docs:** https://expressjs.com/

---

**Questions or Issues?**

Check the troubleshooting section or review the implementation in `F:\pulse1\server.js` for working examples.
