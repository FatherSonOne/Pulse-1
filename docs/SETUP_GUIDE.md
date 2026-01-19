# Pulse 1.0 - Setup Guide

This guide will walk you through setting up the Pulse unified inbox application with Slack, Supabase database persistence, and AI-powered analysis.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager
- Slack workspace with admin access
- Supabase account (free tier works)
- Google AI API key (Gemini)

## 1. Clone and Install Dependencies

```bash
cd pulse
npm install
```

## 2. Set Up Supabase Database

### 2.1 Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/log in
2. Click "New Project"
3. Fill in project details:
   - Name: `pulse-unified-inbox`
   - Database Password: (choose a strong password)
   - Region: (choose closest to you)
4. Wait for project to be provisioned (2-3 minutes)

### 2.2 Run Database Migrations

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `supabase/migrations/001_unified_inbox_schema.sql`
4. Paste into the SQL editor
5. Click "Run" to execute the migration

This will create all necessary tables:
- `users` - User accounts
- `integrations` - Platform OAuth tokens
- `contacts` - Unified contacts across platforms
- `channels` - Channels/groups/conversations
- `unified_messages` - Core message storage
- `conversation_graphs` - Conversation relationships
- `message_sync_state` - Sync state tracking

### 2.3 Get Supabase Credentials

1. In Supabase dashboard, go to **Settings** > **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (the long string under "Project API keys")

### 2.4 Update .env File

Open `.env` file and update:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## 3. Set Up Slack Integration

### 3.1 Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Enter:
   - **App Name**: `Pulse Unified Inbox`
   - **Workspace**: Select your workspace
5. Click **"Create App"**

### 3.2 Add Bot Token Scopes

1. In the left sidebar, click **"OAuth & Permissions"**
2. Scroll down to **"Scopes"** > **"Bot Token Scopes"**
3. Click **"Add an OAuth Scope"** and add the following **7 scopes**:

   - `channels:history` - Read public channel messages
   - `channels:read` - View public channels
   - `groups:history` - Read private channel messages
   - `groups:read` - View private channels
   - `im:history` - Read direct messages
   - `im:read` - View DMs
   - `users:read` - View user information

### 3.3 Install App to Workspace

1. Scroll up to **"OAuth Tokens for Your Workspace"**
2. Click **"Install to Workspace"**
3. Click **"Allow"** to authorize the app
4. Copy the **"Bot User OAuth Token"** (starts with `xoxb-`)

### 3.4 Update .env File

Open `.env` and update:

```env
VITE_SLACK_BOT_TOKEN=xoxb-your-token-here
```

### 3.5 Add Bot to Channels

The bot needs to be added to channels before it can read messages:

1. Open Slack
2. Go to a channel you want to sync
3. Type `/invite @Pulse Unified Inbox`
4. Repeat for all channels you want to sync

## 4. Configure Google Gemini AI

### 4.1 Get API Key

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **"Create API Key"**
3. Copy the generated key

### 4.2 Update .env File

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

## 5. Run the Application

### 5.1 Start Backend Proxy Server

In one terminal:

```bash
npm run server
```

This starts the Express proxy server on port 3003 to handle Slack API calls.

### 5.2 Start Frontend Development Server

In another terminal:

```bash
npm run dev
```

This starts the Vite development server (usually on port 5173).

## 6. Test the Integration

1. Open the app in your browser (usually `http://localhost:5173`)
2. Go to **Settings** (gear icon in sidebar)
3. Click **"Integrations"** tab
4. Under Slack Integration:
   - Your bot token should be pre-filled from `.env`
   - Click **"Test Connection"**
   - You should see: ✅ Connected to [Your Workspace Name]
   - Click **"Fetch Messages"**
   - Messages from channels where the bot is a member will appear
   - Check the console - you should see: `Stored X Slack messages to database`

## 7. Verify Database Persistence

1. Go to your Supabase dashboard
2. Click **"Table Editor"** in the left sidebar
3. Select the `unified_messages` table
4. You should see your Slack messages stored there
5. Check the `message_sync_state` table to see sync status

## 8. Troubleshooting

### Slack "missing_scope" Error

**Error**: `missing_scope: chat:write, channels:read, etc.`

**Solution**:
1. Go back to Slack API dashboard
2. Add the missing scopes under OAuth & Permissions
3. Click "Reinstall to Workspace" (this is required after adding scopes!)
4. Update your bot token in `.env` if a new one was generated

### Slack "not_in_channel" Error

**Error**: `not_in_channel`

**Solution**:
- The bot must be invited to channels: `/invite @Pulse Unified Inbox`
- Or check "Auto-add to public channels" in Slack App settings

### CORS Error

**Error**: `Access blocked by CORS policy`

**Solution**:
- Make sure the backend proxy server is running: `npm run server`
- Check that port 3003 is not in use by another application

### Supabase Connection Error

**Error**: `Failed to fetch messages: Invalid JWT`

**Solution**:
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
2. Make sure you're using the **anon public** key, not the service role key
3. Restart the dev server after updating `.env`

### No Messages Appearing

**Checklist**:
- ✅ Bot is added to at least one channel
- ✅ All 7 OAuth scopes are added
- ✅ App is reinstalled to workspace after adding scopes
- ✅ Database migration ran successfully
- ✅ Supabase credentials are correct in `.env`

## 9. Next Steps

### Add More Integrations

The architecture is ready for:
- **Gmail** - Email sync
- **Twilio SMS** - Text messages
- **Discord** - Server messages
- **Microsoft Teams** - Team chats

All will use the same unified database schema.

### Enable Real-time Sync

Currently, messages are fetched on-demand. You can add:
- Webhook listeners for real-time updates
- Scheduled background sync jobs
- Socket.IO for live message updates in the UI

### Build Conversation Graphs

The `conversation_graphs` table is ready for:
- AI-powered conversation threading
- Deduplication across platforms
- Relationship mapping between conversations

## 10. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Pulse Frontend                 │
│              (React + TypeScript)               │
└───────────────┬─────────────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
┌───────▼──────┐  ┌──────▼──────┐
│  Express     │  │  Supabase   │
│  Proxy       │  │  Database   │
│  (port 3003) │  │             │
└───────┬──────┘  └─────────────┘
        │
┌───────▼──────────────────────┐
│     Slack API                │
│  - conversations.list        │
│  - conversations.history     │
│  - users.info                │
└──────────────────────────────┘
```

## Support

For issues, check:
- Supabase logs: Dashboard > Logs
- Browser console for client-side errors
- Server terminal for proxy errors
- Slack API dashboard for rate limits

Happy syncing! 🚀
