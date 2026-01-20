# OAuth Environment Variables Reference

Complete reference of environment variables required for CRM OAuth integrations.

## Overview

This document provides a comprehensive list of all OAuth-related environment variables used by Pulse CRM integrations, where they're used in the codebase, and how they're configured.

---

## Environment Variable Locations

### Development
- **File**: `.env.local`
- **Usage**: Local development and testing
- **Redirect URIs**: `http://localhost:5173/integrations/{platform}/callback`

### Production
- **File**: `.env.production` (not committed to git)
- **Template**: `.env.production.template` (committed, no sensitive data)
- **Usage**: Production deployment
- **Redirect URIs**: `https://your-domain.com/integrations/{platform}/callback`

### Example
- **File**: `.env.example` (committed)
- **Usage**: Template for team members to set up their local environment

---

## HubSpot OAuth Variables

### Required Environment Variables

```env
# HubSpot Client ID (App ID from HubSpot developer portal)
VITE_HUBSPOT_CLIENT_ID=12345678-abcd-1234-abcd-123456789012

# HubSpot Client Secret (from Auth tab in HubSpot app settings)
VITE_HUBSPOT_CLIENT_SECRET=1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p

# HubSpot OAuth Redirect URI (must match configured redirect URL)
VITE_HUBSPOT_REDIRECT_URI=http://localhost:5173/integrations/hubspot/callback
```

### Where These Variables Are Used

**`src/services/crm/oauthHelper.ts`**:
```typescript
// Line 20-33: OAuth configuration
hubspot: {
  authUrl: 'https://app.hubspot.com/oauth/authorize',
  tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
  scopes: [
    'crm.objects.contacts.write',
    'crm.objects.contacts.read',
    'crm.objects.companies.write',
    'crm.objects.companies.read',
    'crm.objects.deals.write',
    'crm.objects.deals.read',
    'crm.objects.tasks.write',
    'crm.objects.tasks.read',
  ],
}

// Line 152-159: Client credentials retrieval
const clientId = process.env.VITE_HUBSPOT_CLIENT_ID;
const clientSecret = process.env.VITE_HUBSPOT_CLIENT_SECRET;
```

**`src/services/crm/hubspotService.ts`**:
```typescript
// Line 11: API base URL
const HUBSPOT_API_BASE = 'https://api.hubapi.com';

// Line 27-28: Authentication headers with access token
Authorization: `Bearer ${accessToken}`
```

### OAuth Flow Implementation

1. **Authorization URL Generation** (`oauthHelper.ts:66-90`):
   - Uses `VITE_HUBSPOT_CLIENT_ID`
   - Uses `VITE_HUBSPOT_REDIRECT_URI`
   - Scopes: `crm.objects.contacts.write`, `crm.objects.contacts.read`, etc.

2. **Token Exchange** (`oauthHelper.ts:95-133`):
   - Uses `VITE_HUBSPOT_CLIENT_ID`
   - Uses `VITE_HUBSPOT_CLIENT_SECRET`
   - Uses `VITE_HUBSPOT_REDIRECT_URI`
   - Endpoint: `https://api.hubapi.com/oauth/v1/token`

3. **Token Refresh** (`oauthHelper.ts:138-202`):
   - Uses `VITE_HUBSPOT_CLIENT_ID`
   - Uses `VITE_HUBSPOT_CLIENT_SECRET`
   - Endpoint: `https://api.hubapi.com/oauth/v1/token`

---

## Salesforce OAuth Variables

### Required Environment Variables

```env
# Salesforce Consumer Key (Client ID from Connected App)
VITE_SALESFORCE_CLIENT_ID=3MVG9lKcPoNINVB...

# Salesforce Consumer Secret (Client Secret from Connected App)
VITE_SALESFORCE_CLIENT_SECRET=1234567890123456789

# Salesforce OAuth Redirect URI
VITE_SALESFORCE_REDIRECT_URI=http://localhost:5173/integrations/salesforce/callback
```

### Optional Variables (for Sandbox testing)

```env
# Salesforce Sandbox URLs (default: login.salesforce.com)
VITE_SALESFORCE_AUTH_URL=https://test.salesforce.com/services/oauth2/authorize
VITE_SALESFORCE_TOKEN_URL=https://test.salesforce.com/services/oauth2/token
```

### Where These Variables Are Used

**`src/services/crm/oauthHelper.ts`**:
```typescript
// Line 34-39: OAuth configuration
salesforce: {
  authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
  tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
  scopes: ['api', 'refresh_token', 'full'],
  grantType: 'authorization_code',
}

// Line 152-159: Client credentials retrieval
const clientId = process.env.VITE_SALESFORCE_CLIENT_ID;
const clientSecret = process.env.VITE_SALESFORCE_CLIENT_SECRET;
```

**`src/services/crm/salesforceService.ts`**:
```typescript
// Line 34-39: Dynamic instance URL handling
private getApiBase(integration: CRMIntegration): string {
  const instanceUrl =
    (integration as any).instance_url || 'https://login.salesforce.com';
  return `${instanceUrl}/services/data/v58.0`;
}

// Line 23-29: Authentication headers
Authorization: `Bearer ${accessToken}`
```

### Special Notes

- **Instance URL**: Salesforce returns `instance_url` during token exchange (e.g., `https://na1.salesforce.com`). This must be stored and used for all API requests.
- **API Version**: Currently using v58.0, update as needed
- **Sandbox vs Production**: Use different auth/token URLs for sandbox testing

---

## Pipedrive OAuth Variables

### Required Environment Variables

```env
# Pipedrive Client ID (from Developer Portal)
VITE_PIPEDRIVE_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j

# Pipedrive Client Secret (from Developer Portal)
VITE_PIPEDRIVE_CLIENT_SECRET=0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p

# Pipedrive OAuth Redirect URI
VITE_PIPEDRIVE_REDIRECT_URI=http://localhost:5173/integrations/pipedrive/callback
```

### Where These Variables Are Used

**`src/services/crm/oauthHelper.ts`**:
```typescript
// Line 40-50: OAuth configuration
pipedrive: {
  authUrl: 'https://oauth.pipedrive.com/oauth/authorize',
  tokenUrl: 'https://oauth.pipedrive.com/oauth/token',
  scopes: [
    'deals:full',
    'contacts:full',
    'activities:full',
    'users:read',
    'organizations:full',
  ],
}

// Line 152-159: Client credentials retrieval
const clientId = process.env.VITE_PIPEDRIVE_CLIENT_ID;
const clientSecret = process.env.VITE_PIPEDRIVE_CLIENT_SECRET;
```

**`src/services/crm/pipedriveService.ts`**:
```typescript
// Line 11: API base URL
const PIPEDRIVE_API_BASE = 'https://api.pipedrive.com/v1';

// Line 26-35: Token handling (supports both OAuth and API key)
private async getApiToken(integration: CRMIntegration): Promise<string> {
  if (integration.accessToken) {
    return await getValidAccessToken(integration);
  }
  if (integration.apiKey) {
    return integration.apiKey;
  }
  throw new Error('No API token or key available for Pipedrive');
}
```

### Special Notes

- **Dual Authentication**: Pipedrive supports both OAuth 2.0 and API key authentication
- **API Token Parameter**: Token passed as `api_token` query parameter, not in headers

---

## Zoho CRM OAuth Variables

### Required Environment Variables

```env
# Zoho Client ID (from API Console, format: 1000.XXXXX)
VITE_ZOHO_CLIENT_ID=1000.ABCDEFGHIJKLMNOPQRSTUVWXYZ123456

# Zoho Client Secret (from API Console)
VITE_ZOHO_CLIENT_SECRET=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t

# Zoho OAuth Redirect URI
VITE_ZOHO_REDIRECT_URI=http://localhost:5173/integrations/zoho/callback

# Zoho Accounts URL (based on data center)
VITE_ZOHO_ACCOUNTS_URL=https://accounts.zoho.com
```

### Data Center URLs

```env
# US: (default)
VITE_ZOHO_ACCOUNTS_URL=https://accounts.zoho.com

# Europe:
VITE_ZOHO_ACCOUNTS_URL=https://accounts.zoho.eu

# India:
VITE_ZOHO_ACCOUNTS_URL=https://accounts.zoho.in

# Australia:
VITE_ZOHO_ACCOUNTS_URL=https://accounts.zoho.com.au

# China:
VITE_ZOHO_ACCOUNTS_URL=https://accounts.zoho.com.cn
```

### Where These Variables Are Used

**`src/services/crm/oauthHelper.ts`**:
```typescript
// Line 51-61: OAuth configuration
zoho: {
  authUrl: 'https://accounts.zoho.com/oauth/v2/auth',
  tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
  scopes: [
    'ZohoCRM.modules.ALL',
    'ZohoCRM.settings.ALL',
    'ZohoCRM.users.READ',
  ],
  grantType: 'authorization_code',
}

// Line 152-159: Client credentials retrieval
const clientId = process.env.VITE_ZOHO_CLIENT_ID;
const clientSecret = process.env.VITE_ZOHO_CLIENT_SECRET;
```

**`src/services/crm/zohoService.ts`**:
```typescript
// Line 11: API base URL
const ZOHO_API_BASE = 'https://www.zohoapis.com/crm/v3';

// Line 26-32: Authentication headers
Authorization: `Zoho-oauthtoken ${accessToken}`
```

### Special Notes

- **Data Center Specific**: Must use correct `accounts` URL and `apis` URL for your data center
- **Client ID Format**: Zoho Client IDs start with `1000.`
- **Authorization Header Format**: Uses `Zoho-oauthtoken` prefix instead of `Bearer`

---

## Common OAuth Variables

### General Configuration

```env
# App URL (used for redirect URI construction)
VITE_APP_URL=http://localhost:5173

# OAuth state parameter secret (for CSRF protection)
VITE_OAUTH_STATE_SECRET=random-secret-string-for-csrf-protection
```

### Supabase (for token storage)

```env
# Supabase credentials (for storing OAuth tokens)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

## Variable Naming Convention

### Frontend Variables (Vite)
- **Prefix**: `VITE_` (exposed to frontend)
- **Example**: `VITE_HUBSPOT_CLIENT_ID`
- **Usage**: Can be accessed in frontend code via `import.meta.env.VITE_HUBSPOT_CLIENT_ID`

### Backend Variables (Node.js)
- **Prefix**: None (or custom prefix)
- **Example**: `HUBSPOT_CLIENT_SECRET`
- **Usage**: Accessed in Node.js via `process.env.HUBSPOT_CLIENT_SECRET`

### Current Implementation
All OAuth variables use `VITE_` prefix because:
1. OAuth helper runs in both frontend and backend contexts
2. Token exchange may occur in frontend (then stored securely in backend)
3. Simplifies configuration management

---

## Security Considerations

### Safe to Expose (Frontend)
```env
VITE_HUBSPOT_CLIENT_ID=...
VITE_HUBSPOT_REDIRECT_URI=...
VITE_SALESFORCE_CLIENT_ID=...
VITE_PIPEDRIVE_CLIENT_ID=...
VITE_ZOHO_CLIENT_ID=...
```

### MUST Keep Secret (Backend Only)
```env
VITE_HUBSPOT_CLIENT_SECRET=...
VITE_SALESFORCE_CLIENT_SECRET=...
VITE_PIPEDRIVE_CLIENT_SECRET=...
VITE_ZOHO_CLIENT_SECRET=...
```

**IMPORTANT**: While these use `VITE_` prefix, client secrets should ONLY be used in backend/server-side code. Never expose them in frontend JavaScript.

### Recommended Architecture

For production, consider moving token exchange to backend:

```typescript
// Backend endpoint (secure)
app.post('/api/oauth/exchange', async (req, res) => {
  const { platform, code } = req.body;

  // Client secret only accessible on server
  const clientSecret = process.env[`${platform.toUpperCase()}_CLIENT_SECRET`];

  const tokens = await exchangeCodeForToken(
    platform,
    code,
    clientId,
    clientSecret, // Never exposed to frontend
    redirectUri
  );

  // Store tokens securely in Supabase with RLS
  await storeTokens(tokens);

  res.json({ success: true });
});
```

---

## Environment Variable Validation

### Validation Script

Create `scripts/validate-oauth-env.js`:

```javascript
const requiredVars = {
  hubspot: [
    'VITE_HUBSPOT_CLIENT_ID',
    'VITE_HUBSPOT_CLIENT_SECRET',
    'VITE_HUBSPOT_REDIRECT_URI',
  ],
  salesforce: [
    'VITE_SALESFORCE_CLIENT_ID',
    'VITE_SALESFORCE_CLIENT_SECRET',
    'VITE_SALESFORCE_REDIRECT_URI',
  ],
  pipedrive: [
    'VITE_PIPEDRIVE_CLIENT_ID',
    'VITE_PIPEDRIVE_CLIENT_SECRET',
    'VITE_PIPEDRIVE_REDIRECT_URI',
  ],
  zoho: [
    'VITE_ZOHO_CLIENT_ID',
    'VITE_ZOHO_CLIENT_SECRET',
    'VITE_ZOHO_REDIRECT_URI',
    'VITE_ZOHO_ACCOUNTS_URL',
  ],
};

function validateOAuthEnv(platform) {
  const missing = [];

  for (const varName of requiredVars[platform]) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error(`❌ Missing ${platform} OAuth variables:`);
    missing.forEach(v => console.error(`   - ${v}`));
    return false;
  }

  console.log(`✅ ${platform} OAuth variables configured`);
  return true;
}

// Validate all platforms
const platforms = ['hubspot', 'salesforce', 'pipedrive', 'zoho'];
const allValid = platforms.every(validateOAuthEnv);

process.exit(allValid ? 0 : 1);
```

### Run Validation

```bash
# Validate environment variables before deployment
node scripts/validate-oauth-env.js
```

---

## TypeScript Type Definitions

### Environment Variable Types

```typescript
// src/types/env.d.ts
interface ImportMetaEnv {
  // Core
  readonly VITE_APP_MODE: 'production' | 'development' | 'demo';
  readonly VITE_APP_URL: string;

  // Supabase
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // HubSpot OAuth
  readonly VITE_HUBSPOT_CLIENT_ID: string;
  readonly VITE_HUBSPOT_CLIENT_SECRET: string;
  readonly VITE_HUBSPOT_REDIRECT_URI: string;

  // Salesforce OAuth
  readonly VITE_SALESFORCE_CLIENT_ID: string;
  readonly VITE_SALESFORCE_CLIENT_SECRET: string;
  readonly VITE_SALESFORCE_REDIRECT_URI: string;

  // Pipedrive OAuth
  readonly VITE_PIPEDRIVE_CLIENT_ID: string;
  readonly VITE_PIPEDRIVE_CLIENT_SECRET: string;
  readonly VITE_PIPEDRIVE_REDIRECT_URI: string;

  // Zoho OAuth
  readonly VITE_ZOHO_CLIENT_ID: string;
  readonly VITE_ZOHO_CLIENT_SECRET: string;
  readonly VITE_ZOHO_REDIRECT_URI: string;
  readonly VITE_ZOHO_ACCOUNTS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## Quick Reference Table

| Variable | Platform | Required | Sensitive | Where Used |
|----------|----------|----------|-----------|------------|
| `VITE_HUBSPOT_CLIENT_ID` | HubSpot | Yes | No | oauthHelper.ts, Frontend |
| `VITE_HUBSPOT_CLIENT_SECRET` | HubSpot | Yes | Yes | oauthHelper.ts, Backend only |
| `VITE_HUBSPOT_REDIRECT_URI` | HubSpot | Yes | No | oauthHelper.ts |
| `VITE_SALESFORCE_CLIENT_ID` | Salesforce | Yes | No | oauthHelper.ts, Frontend |
| `VITE_SALESFORCE_CLIENT_SECRET` | Salesforce | Yes | Yes | oauthHelper.ts, Backend only |
| `VITE_SALESFORCE_REDIRECT_URI` | Salesforce | Yes | No | oauthHelper.ts |
| `VITE_PIPEDRIVE_CLIENT_ID` | Pipedrive | Yes | No | oauthHelper.ts, Frontend |
| `VITE_PIPEDRIVE_CLIENT_SECRET` | Pipedrive | Yes | Yes | oauthHelper.ts, Backend only |
| `VITE_PIPEDRIVE_REDIRECT_URI` | Pipedrive | Yes | No | oauthHelper.ts |
| `VITE_ZOHO_CLIENT_ID` | Zoho | Yes | No | oauthHelper.ts, Frontend |
| `VITE_ZOHO_CLIENT_SECRET` | Zoho | Yes | Yes | oauthHelper.ts, Backend only |
| `VITE_ZOHO_REDIRECT_URI` | Zoho | Yes | No | oauthHelper.ts |
| `VITE_ZOHO_ACCOUNTS_URL` | Zoho | Yes | No | oauthHelper.ts |

---

## Related Documentation

- **Setup Guide**: `docs/OAUTH-SETUP-GUIDE.md`
- **Quick Checklist**: `docs/OAUTH-CHECKLIST.md`
- **Production Template**: `.env.production.template`
- **Example File**: `.env.example`
- **Backend Audit**: `docs/backend-audit.md`

---

**Last Updated**: 2026-01-20
**Version**: 1.0.0
