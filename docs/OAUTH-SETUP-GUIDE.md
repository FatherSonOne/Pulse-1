# OAuth Setup Guide for CRM Integrations

Complete step-by-step guide for configuring OAuth credentials for all supported CRM platforms.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [General OAuth Concepts](#general-oauth-concepts)
- [HubSpot OAuth Setup](#hubspot-oauth-setup)
- [Salesforce OAuth Setup](#salesforce-oauth-setup)
- [Pipedrive OAuth Setup](#pipedrive-oauth-setup)
- [Zoho CRM OAuth Setup](#zoho-crm-oauth-setup)
- [Testing Your OAuth Setup](#testing-your-oauth-setup)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Pulse integrates with major CRM platforms using OAuth 2.0 for secure authentication. This guide walks you through setting up OAuth credentials for:

- **HubSpot CRM**
- **Salesforce**
- **Pipedrive**
- **Zoho CRM**

Each platform requires you to register an OAuth application and configure redirect URIs.

---

## Prerequisites

Before you begin, ensure you have:

1. **Active CRM Account**: Admin access to your CRM platform
2. **Production Domain**: Your Pulse deployment URL (e.g., `https://your-domain.com`)
3. **Development Environment**: Local setup for testing (e.g., `http://localhost:5173`)
4. **Supabase Project**: Active Supabase project with CRM integration tables

---

## General OAuth Concepts

### OAuth 2.0 Flow

1. **Authorization Request**: User clicks "Connect CRM" → Redirected to CRM OAuth page
2. **User Consent**: User grants permissions to your application
3. **Authorization Code**: CRM redirects back with authorization code
4. **Token Exchange**: Your app exchanges code for access token and refresh token
5. **API Access**: Use access token to make API requests
6. **Token Refresh**: Automatically refresh expired access tokens

### Key Terms

- **Client ID**: Public identifier for your OAuth application
- **Client Secret**: Private secret key (NEVER expose in frontend)
- **Redirect URI**: URL where CRM sends authorization code
- **Scopes**: Specific permissions your app requests
- **Access Token**: Short-lived token for API requests (typically 1-24 hours)
- **Refresh Token**: Long-lived token to get new access tokens (typically 90 days - indefinite)

---

## HubSpot OAuth Setup

### Step 1: Create HubSpot Developer Account

1. Go to [HubSpot Developers](https://developers.hubspot.com/)
2. Sign in with your HubSpot account
3. Navigate to **Developer Tools** → **Apps**

### Step 2: Create OAuth Application

1. Click **Create App**
2. Fill in application details:
   - **App Name**: Pulse CRM Integration
   - **Description**: Pulse messaging platform with CRM sync
   - **App Logo**: Upload your logo (optional)

### Step 3: Configure OAuth Settings

1. Go to **Auth** tab
2. Add **Redirect URLs**:
   - Development: `http://localhost:5173/integrations/hubspot/callback`
   - Production: `https://your-domain.com/integrations/hubspot/callback`

3. Configure **Scopes** (Required):
   ```
   crm.objects.contacts.write
   crm.objects.contacts.read
   crm.objects.companies.write
   crm.objects.companies.read
   crm.objects.deals.write
   crm.objects.deals.read
   crm.objects.tasks.write
   crm.objects.tasks.read
   ```

### Step 4: Get Credentials

1. Copy **App ID** (this is your Client ID)
2. Copy **Client Secret** from the Auth tab
3. Add to your `.env.production`:
   ```env
   VITE_HUBSPOT_CLIENT_ID=12345678-abcd-1234-abcd-123456789012
   VITE_HUBSPOT_CLIENT_SECRET=1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p
   VITE_HUBSPOT_REDIRECT_URI=https://your-domain.com/integrations/hubspot/callback
   ```

### Step 5: Test Installation

1. Click **Install App** to test on your own HubSpot account
2. Grant all requested permissions
3. Verify successful connection

### HubSpot-Specific Notes

- HubSpot uses OAuth 2.0 with refresh tokens that never expire
- Access tokens expire after 6 hours
- HubSpot provides detailed API usage metrics in the developer portal
- You can test webhooks using HubSpot's webhook testing tool

---

## Salesforce OAuth Setup

### Step 1: Access Salesforce Setup

1. Log in to [Salesforce](https://login.salesforce.com/)
2. Click the **gear icon** → **Setup**
3. Navigate to **Platform Tools** → **Apps** → **App Manager**

### Step 2: Create Connected App

1. Click **New Connected App**
2. Fill in basic information:
   - **Connected App Name**: Pulse CRM Integration
   - **API Name**: Pulse_CRM_Integration
   - **Contact Email**: your-email@company.com

### Step 3: Enable OAuth Settings

1. Check **Enable OAuth Settings**
2. Set **Callback URL**:
   - Development: `http://localhost:5173/integrations/salesforce/callback`
   - Production: `https://your-domain.com/integrations/salesforce/callback`

   Note: Add both URLs separated by line breaks

3. Select **OAuth Scopes** (Required):
   ```
   Access and manage your data (api)
   Perform requests on your behalf at any time (refresh_token, offline_access)
   Provide access to your data via the Web (web)
   Full access to all data accessible by the logged-in user (full)
   ```

4. Additional Settings:
   - Check **Require Secret for Web Server Flow**
   - Check **Require Secret for Refresh Token Flow**
   - Set **IP Relaxation**: Relax IP restrictions (or configure your server IPs)

### Step 4: Configure Policies

1. After saving, click **Manage**
2. Click **Edit Policies**
3. Set **Permitted Users**: All users may self-authorize
4. Set **IP Relaxation**: Relax IP restrictions
5. Set **Refresh Token Policy**: Refresh token is valid until revoked

### Step 5: Get Credentials

1. Copy **Consumer Key** (this is your Client ID)
2. Click **Click to reveal** to see **Consumer Secret** (this is your Client Secret)
3. Add to your `.env.production`:
   ```env
   VITE_SALESFORCE_CLIENT_ID=3MVG9lKcPoNINVB...
   VITE_SALESFORCE_CLIENT_SECRET=1234567890123456789
   VITE_SALESFORCE_REDIRECT_URI=https://your-domain.com/integrations/salesforce/callback
   ```

### Salesforce Sandbox (Testing)

For testing, use Salesforce Sandbox:

```env
VITE_SALESFORCE_AUTH_URL=https://test.salesforce.com/services/oauth2/authorize
VITE_SALESFORCE_TOKEN_URL=https://test.salesforce.com/services/oauth2/token
```

### Salesforce-Specific Notes

- Access tokens expire after 15 minutes by default (configurable)
- Refresh tokens are valid until revoked
- Salesforce returns `instance_url` during token exchange - store this!
- Different Salesforce editions may have API call limits
- Monitor API usage in Setup → System Overview

---

## Pipedrive OAuth Setup

### Step 1: Access Pipedrive Developer Hub

1. Go to [Pipedrive Developer Portal](https://app.pipedrive.com/developer/apps)
2. Sign in with your Pipedrive account
3. Click **Create App**

### Step 2: Create OAuth Application

1. Fill in app details:
   - **App Name**: Pulse CRM Integration
   - **Short Description**: Messaging platform with CRM sync
   - **Developer Name**: Your name or company
   - **Developer Email**: your-email@company.com

2. Upload **App Icon** (optional, 256x256px)

### Step 3: Configure OAuth & Permissions

1. Go to **OAuth & Access scopes** section
2. Add **Callback URL**:
   - Development: `http://localhost:5173/integrations/pipedrive/callback`
   - Production: `https://your-domain.com/integrations/pipedrive/callback`

3. Select **Scopes** (Required):
   ```
   deals:full - Full access to deals
   contacts:full - Full access to persons
   activities:full - Full access to activities
   organizations:full - Full access to organizations
   users:read - Read access to users
   ```

### Step 4: Get Credentials

1. Go to **Basic info** tab
2. Copy **Client ID**
3. Copy **Client Secret**
4. Add to your `.env.production`:
   ```env
   VITE_PIPEDRIVE_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j
   VITE_PIPEDRIVE_CLIENT_SECRET=0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p
   VITE_PIPEDRIVE_REDIRECT_URI=https://your-domain.com/integrations/pipedrive/callback
   ```

### Step 5: Submit for Review (Optional)

For public marketplace listing:
1. Go to **Marketplace** tab
2. Fill in marketplace details
3. Submit for Pipedrive review

### Pipedrive-Specific Notes

- Pipedrive supports both OAuth and API token authentication
- Access tokens expire after 1 hour
- Refresh tokens are valid for 60 days (rolling window)
- API rate limit: 100 requests per 2 seconds per user
- Pipedrive returns company domain during token exchange

---

## Zoho CRM OAuth Setup

### Step 1: Access Zoho API Console

1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Sign in with your Zoho account
3. Click **Get Started** or **Add Client**

### Step 2: Create Server-Based Application

1. Select **Server-based Applications**
2. Fill in client details:
   - **Client Name**: Pulse CRM Integration
   - **Homepage URL**: https://your-domain.com
   - **Authorized Redirect URIs**:
     - Development: `http://localhost:5173/integrations/zoho/callback`
     - Production: `https://your-domain.com/integrations/zoho/callback`

### Step 3: Configure Scopes

Select the following scopes (Required):
```
ZohoCRM.modules.ALL - Full access to all CRM modules
ZohoCRM.settings.ALL - Full access to CRM settings
ZohoCRM.users.READ - Read access to users
```

### Step 4: Select Data Center

Choose the appropriate data center for your Zoho account:
- **US**: accounts.zoho.com
- **EU**: accounts.zoho.eu
- **India**: accounts.zoho.in
- **Australia**: accounts.zoho.com.au
- **China**: accounts.zoho.com.cn

### Step 5: Get Credentials

1. Copy **Client ID** (format: 1000.XXXXXXXXXX)
2. Copy **Client Secret**
3. Add to your `.env.production`:
   ```env
   VITE_ZOHO_CLIENT_ID=1000.ABCDEFGHIJKLMNOPQRSTUVWXYZ123456
   VITE_ZOHO_CLIENT_SECRET=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t
   VITE_ZOHO_REDIRECT_URI=https://your-domain.com/integrations/zoho/callback
   VITE_ZOHO_ACCOUNTS_URL=https://accounts.zoho.com
   ```

### Zoho-Specific Notes

- Access tokens expire after 1 hour
- Refresh tokens are valid for 90 days (rolling window with use)
- Must specify correct data center URL based on account location
- Zoho requires domain verification for production apps
- API rate limit: 5000 requests per day per organization (default)
- Zoho CRM Free edition has API limitations

---

## Testing Your OAuth Setup

### Local Development Testing

1. **Set up development environment variables**:
   ```bash
   cp .env.production.template .env.local
   # Fill in your development credentials
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Test OAuth flow**:
   - Navigate to Settings → Integrations
   - Click "Connect" for the CRM platform
   - Complete authorization flow
   - Verify successful connection

### Production Testing Checklist

- [ ] Update redirect URIs to production domain
- [ ] Test authorization flow
- [ ] Verify token storage in Supabase
- [ ] Test token refresh mechanism
- [ ] Verify API calls work (read/write operations)
- [ ] Test sync operations (contacts, deals, companies)
- [ ] Verify webhook callbacks (if configured)
- [ ] Test error handling and reconnection
- [ ] Monitor logs for OAuth errors
- [ ] Test token revocation and reconnection

### Testing Tools

**Postman/Insomnia**: Test OAuth flows manually
```
1. GET authorization URL
2. Complete browser auth flow
3. POST to token endpoint with authorization code
4. Test API requests with access token
5. Test refresh token flow
```

**Browser DevTools**: Monitor OAuth redirects and token exchanges
```
1. Open Network tab
2. Filter for OAuth-related requests
3. Verify redirect URIs
4. Check token responses
5. Monitor API requests
```

---

## Security Best Practices

### Credential Management

1. **Never commit credentials to version control**:
   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.production
   ```

2. **Use environment-specific credentials**:
   - Development: Separate OAuth apps
   - Staging: Separate OAuth apps
   - Production: Production OAuth apps

3. **Rotate secrets regularly**:
   - OAuth secrets: Every 90 days
   - API keys: Every 30-90 days
   - Access tokens: Automatic (short-lived)

### OAuth Security

1. **Validate redirect URIs**:
   - Use exact match, not wildcards
   - Use HTTPS in production
   - Whitelist specific paths

2. **Use state parameter**:
   - Generate random state for CSRF protection
   - Validate state on callback
   - Store state in session/local storage

3. **Secure token storage**:
   - Store tokens encrypted in Supabase
   - Never expose tokens in frontend
   - Use secure HttpOnly cookies where possible
   - Implement Row Level Security (RLS)

4. **Token refresh best practices**:
   - Refresh tokens before expiration (5-minute buffer)
   - Implement exponential backoff for refresh failures
   - Handle refresh token expiration gracefully
   - Re-authenticate user if refresh fails

### Application Security

1. **Implement rate limiting**:
   ```typescript
   // Example: Limit OAuth attempts per IP
   const MAX_OAUTH_ATTEMPTS = 5;
   const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
   ```

2. **Monitor OAuth usage**:
   - Log all OAuth events
   - Alert on suspicious patterns
   - Track failed authorization attempts
   - Monitor token refresh rates

3. **Validate webhook signatures**:
   ```typescript
   // Verify webhook came from CRM platform
   const isValid = verifyWebhookSignature(
     payload,
     signature,
     webhookSecret
   );
   ```

4. **Implement IP whitelisting** (if supported by CRM):
   - Restrict API access to known IPs
   - Use VPN or static IPs for production

### Compliance

1. **GDPR Compliance**:
   - Document data access and storage
   - Provide data export/deletion
   - Obtain user consent for CRM access
   - Include privacy policy link

2. **SOC 2 / ISO 27001**:
   - Encrypt data at rest and in transit
   - Implement access logging
   - Regular security audits
   - Incident response procedures

---

## Troubleshooting

### Common OAuth Errors

#### "Redirect URI Mismatch"

**Problem**: OAuth redirect doesn't match configured URI

**Solution**:
```
1. Check exact URL match (http vs https, trailing slash)
2. Verify URL is whitelisted in CRM OAuth app settings
3. Check for URL encoding issues
4. Ensure production domain is correctly configured
```

#### "Invalid Client ID or Secret"

**Problem**: Client credentials are incorrect or expired

**Solution**:
```
1. Verify credentials copied correctly (no extra spaces)
2. Check if OAuth app is active/approved
3. Regenerate client secret if compromised
4. Verify environment variables loaded correctly
```

#### "Insufficient Permissions"

**Problem**: Missing required OAuth scopes

**Solution**:
```
1. Review required scopes in oauthHelper.ts
2. Add missing scopes in CRM OAuth app
3. User must re-authorize to grant new scopes
4. Clear old tokens and reconnect
```

#### "Token Expired" / "Invalid Token"

**Problem**: Access token expired and refresh failed

**Solution**:
```typescript
// Check token expiration logic
const isExpired = isTokenExpired(integration);

// Verify refresh token is valid
const hasRefreshToken = integration.refreshToken != null;

// Check token refresh implementation
const newToken = await refreshCRMToken(integration);

// If refresh fails, require re-authorization
if (!newToken) {
  // Show "Reconnect CRM" prompt to user
}
```

### Platform-Specific Issues

#### HubSpot

**Issue**: "Invalid scope" error
- **Solution**: HubSpot scope names are case-sensitive. Use exact format from docs.

**Issue**: Rate limit errors
- **Solution**: HubSpot limits: 100 requests per 10 seconds. Implement request queuing.

#### Salesforce

**Issue**: "Invalid session ID" error
- **Solution**: Store and use `instance_url` from token response.

**Issue**: API version compatibility
- **Solution**: Update API version in code (`/services/data/v58.0`).

#### Pipedrive

**Issue**: "Unauthorized domain" error
- **Solution**: Verify domain ownership in Pipedrive developer settings.

**Issue**: Webhook not receiving events
- **Solution**: Check webhook URL is publicly accessible (not localhost).

#### Zoho

**Issue**: "Invalid authentication" from wrong data center
- **Solution**: Use correct accounts URL for your data center (EU, IN, AU, etc.).

**Issue**: "API limit exceeded"
- **Solution**: Zoho Free has strict limits. Upgrade plan or reduce sync frequency.

### Debugging Tools

#### Enable OAuth Debug Logging

```typescript
// Add to oauthHelper.ts for debugging
const DEBUG_OAUTH = process.env.VITE_DEBUG_OAUTH === 'true';

if (DEBUG_OAUTH) {
  console.log('OAuth Request:', {
    platform,
    clientId: clientId.substring(0, 8) + '...',
    redirectUri,
    scopes: config.scopes,
  });
}
```

#### Test OAuth Flow Manually

```bash
# 1. Generate authorization URL
node scripts/generate-oauth-url.js hubspot

# 2. Visit URL in browser and authorize

# 3. Copy authorization code from callback URL

# 4. Exchange code for tokens
node scripts/exchange-oauth-code.js hubspot AUTH_CODE_HERE

# 5. Test API request with access token
curl -H "Authorization: Bearer ACCESS_TOKEN" \
  https://api.hubapi.com/crm/v3/objects/contacts
```

#### Monitor OAuth in Supabase

```sql
-- Check stored integrations
SELECT id, platform, display_name,
       is_active, sync_status, last_sync_at,
       token_expires_at
FROM crm_integrations;

-- Check sync logs
SELECT crm_id, sync_type, status,
       contacts_synced, companies_synced, deals_synced,
       error_message, completed_at
FROM crm_sync_logs
ORDER BY completed_at DESC
LIMIT 10;

-- Check for expired tokens
SELECT id, platform, display_name, token_expires_at
FROM crm_integrations
WHERE token_expires_at < NOW() + INTERVAL '5 minutes'
  AND is_active = true;
```

---

## Additional Resources

### Official Documentation

- **HubSpot**: https://developers.hubspot.com/docs/api/oauth
- **Salesforce**: https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_flows.htm
- **Pipedrive**: https://pipedrive.readme.io/docs/marketplace-oauth-authorization
- **Zoho**: https://www.zoho.com/crm/developer/docs/api/v3/oauth-overview.html

### OAuth 2.0 Resources

- OAuth 2.0 Specification: https://oauth.net/2/
- OAuth Security Best Practices: https://oauth.net/2/security-best-practices/
- OAuth Debugger: https://oauthdebugger.com/

### Pulse Documentation

- Integration Architecture: `docs/crm-integration-architecture.md`
- Backend Audit: `docs/backend-audit.md`
- OAuth Checklist: `docs/OAUTH-CHECKLIST.md`

---

## Support

For additional help:

1. Check GitHub Issues: Search for similar OAuth issues
2. Review Supabase logs: Check for OAuth-related errors
3. Test with Postman: Verify OAuth flow manually
4. Contact CRM support: Platform-specific OAuth issues
5. Review security logs: Check for authentication errors

---

**Last Updated**: 2026-01-20
**Version**: 1.0.0
**Maintained By**: Pulse Backend Team
