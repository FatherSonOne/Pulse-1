# Pulse Messages - Development Setup Guide

**Version**: 1.0
**Last Updated**: 2026-01-19

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Database Setup](#database-setup)
5. [Running the Application](#running-the-application)
6. [Development Tools](#development-tools)
7. [Common Issues](#common-issues)

---

## System Requirements

### Minimum Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Git**: 2.40.0 or higher
- **RAM**: 4 GB minimum, 8 GB recommended
- **Disk Space**: 2 GB free space

### Supported Operating Systems

- **Windows**: 10/11 (64-bit)
- **macOS**: 12.0+ (Monterey or later)
- **Linux**: Ubuntu 20.04+, Fedora 35+, or equivalent

### Recommended IDE

**VS Code** with extensions:
- ESLint
- Prettier
- TypeScript
- Tailwind CSS IntelliSense
- GitLens

---

## Installation

### 1. Install Node.js

**Windows/macOS**:
- Download from [nodejs.org](https://nodejs.org)
- Install LTS version (18.x or higher)

**Linux (Ubuntu/Debian)**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Verify Installation**:
```bash
node --version  # Should be 18.x or higher
npm --version   # Should be 9.x or higher
```

### 2. Install Git

**Windows**:
- Download from [git-scm.com](https://git-scm.com)

**macOS**:
```bash
brew install git
```

**Linux**:
```bash
sudo apt-get install git
```

**Verify Installation**:
```bash
git --version  # Should be 2.40+ or higher
```

### 3. Clone Repository

```bash
# Clone the repository
git clone https://github.com/pulse/pulse-messages.git
cd pulse-messages

# Or if you forked it
git clone https://github.com/YOUR_USERNAME/pulse-messages.git
cd pulse-messages
```

### 4. Install Dependencies

```bash
# Install all npm dependencies
npm install

# This installs:
# - React, TypeScript, Vite
# - Supabase client
# - UI libraries (Tailwind, Framer Motion)
# - Development tools (ESLint, Prettier)
# - Testing libraries (Jest, Testing Library)
```

**Expected Output**:
```
added 1247 packages in 45s
```

---

## Configuration

### 1. Environment Variables

Create `.env` file in project root:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Google Gemini API (for AI features)
VITE_GEMINI_API_KEY=your-gemini-api-key

# Optional: CRM Integrations
VITE_HUBSPOT_CLIENT_ID=
VITE_HUBSPOT_CLIENT_SECRET=
VITE_SALESFORCE_CLIENT_ID=
VITE_SALESFORCE_CLIENT_SECRET=

# Optional: Other Services
VITE_ELEVENLABS_API_KEY=
VITE_MAPBOX_API_KEY=
VITE_PERPLEXITY_API_KEY=
```

### 2. Get Supabase Credentials

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings > API
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

### 3. Get Gemini API Key

1. Go to [ai.google.dev](https://ai.google.dev)
2. Click "Get API Key"
3. Create new project or select existing
4. Generate API key
5. Copy to `VITE_GEMINI_API_KEY`

---

## Database Setup

### 1. Supabase Schema

Run SQL migrations in Supabase SQL Editor:

```sql
-- Create message_channels table
CREATE TABLE message_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  is_group BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create channel_messages table
CREATE TABLE channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES message_channels(id),
  sender_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  thread_id UUID,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_pinned BOOLEAN DEFAULT false
);

-- Create message_interactions table (reactions)
CREATE TABLE message_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES channel_messages(id),
  user_id UUID NOT NULL,
  interaction_type TEXT NOT NULL,
  emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create channel_members table
CREATE TABLE channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES message_channels(id),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_channel_messages_channel_id ON channel_messages(channel_id);
CREATE INDEX idx_channel_messages_created_at ON channel_messages(created_at DESC);
CREATE INDEX idx_message_interactions_message_id ON message_interactions(message_id);
```

### 2. Enable Real-Time

In Supabase Dashboard:
1. Go to Database > Replication
2. Enable replication for:
   - `channel_messages`
   - `message_interactions`
   - `channel_members`

### 3. Row-Level Security

```sql
-- Enable RLS
ALTER TABLE message_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

-- Policies (simplified for development)
CREATE POLICY "Public channels visible to all"
  ON message_channels FOR SELECT
  USING (is_public = true);

CREATE POLICY "Messages visible to channel members"
  ON channel_messages FOR SELECT
  USING (
    channel_id IN (
      SELECT channel_id FROM channel_members
      WHERE user_id = auth.uid()
    )
  );
```

---

## Running the Application

### Development Server

```bash
npm run dev
```

**Output**:
```
VITE v5.0.0  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.100:5173/
```

Open http://localhost:5173 in your browser.

### Build for Production

```bash
npm run build
```

**Output**: Optimized build in `dist/` folder

### Preview Production Build

```bash
npm run preview
```

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm test -- --watch
```

### Linting and Formatting

```bash
# Run ESLint
npm run lint

# Fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Type checking
npm run type-check
```

---

## Development Tools

### VS Code Configuration

Create `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

### Recommended Extensions

Install from VS Code Marketplace:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "eamodio.gitlens",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

### Browser DevTools

**React DevTools**:
- [Chrome Extension](https://chrome.google.com/webstore/detail/react-developer-tools)
- [Firefox Add-on](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

**Redux DevTools** (for Zustand):
- [Chrome Extension](https://chrome.google.com/webstore/detail/redux-devtools)

### Database Tools

**Supabase Studio**: Built-in at https://app.supabase.com

**Alternative**:
- **TablePlus**: https://tableplus.com
- **pgAdmin**: https://www.pgadmin.org

---

## Common Issues

### Port Already in Use

**Error**: `Port 5173 is already in use`

**Solution**:
```bash
# Find process using port
# Windows
netstat -ano | findstr :5173

# macOS/Linux
lsof -i :5173

# Kill the process or use different port
npm run dev -- --port 5174
```

### Module Not Found

**Error**: `Cannot find module 'xyz'`

**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Supabase Connection Failed

**Error**: `Failed to connect to Supabase`

**Solution**:
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. Check Supabase project is running
3. Test connection:
   ```javascript
   import { createClient } from '@supabase/supabase-js';
   const supabase = createClient(url, key);
   const { data } = await supabase.from('message_channels').select('*');
   console.log(data);
   ```

### TypeScript Errors

**Error**: Type errors in IDE

**Solution**:
```bash
# Restart TypeScript server
# VS Code: Ctrl+Shift+P > "TypeScript: Restart TS Server"

# Or rebuild
npm run type-check
```

### Hot Reload Not Working

**Error**: Changes not reflecting in browser

**Solution**:
1. Clear browser cache (Ctrl+Shift+R)
2. Restart dev server
3. Check file is saved
4. Verify file is in `src/` directory

---

## Next Steps

After setup:

1. **Read Documentation**: See [User Guide](./USER_GUIDE.md)
2. **Explore Codebase**: Start with [Architecture](./MESSAGES_ARCHITECTURE.md)
3. **Run Tests**: `npm test` to ensure everything works
4. **Make Changes**: See [Contributing Guide](./CONTRIBUTING.md)

---

## Getting Help

**Issues**: GitHub Issues
**Discussions**: GitHub Discussions
**Email**: dev@pulse.example.com

---

**Document Version**: 1.0
**Last Updated**: 2026-01-19
