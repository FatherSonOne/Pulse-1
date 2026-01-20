# OAuth Integration Setup Guide

Complete guide for setting up CRM OAuth integrations for Pulse Messages.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [HubSpot Integration](#hubspot-integration)
- [Salesforce Integration](#salesforce-integration)
- [Pipedrive Integration](#pipedrive-integration)
- [Zoho CRM Integration](#zoho-crm-integration)
- [Testing OAuth Flows](#testing-oauth-flows)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before setting up OAuth integrations:

1. **Production Domain**: Have your production domain ready (e.g., `https://app.pulsemessages.com`)
2. **SSL Certificate**: Ensure SSL/TLS is properly configured
3. **Environment File**: Copy `.env.production` to `.env.production.local`
4. **Admin Access**: Have admin access to each CRM platform you want to integrate

---

## HubSpot Integration

### Step 1: Create HubSpot App

1. Visit [HubSpot Developer Portal](https://app.hubspot.com/developers)
2. Click **"Create app"**
3. Fill in app details:
   - **App name**: Pulse Messages
   - **Description**: Unified messaging platform with CRM integration
   - **Logo**: Upload your app logo

### Step 2: Configure OAuth

1. Navigate to **"Auth"** tab in your app settings
2. Add **Redirect URLs**:
   ```
   https://app.pulsemessages.com/crm/callback/hubspot
   http://localhost:5173/crm/callback/hubspot (for development)
   ```

3. Select **Scopes**:
   Required scopes:
   - `crm.objects.contacts.read` - Read contacts
   - `crm.objects.contacts.write` - Create/update contacts
   - `crm.objects.companies.read` - Read companies
   - `crm.objects.companies.write` - Create/update companies
   - `crm.objects.deals.read` - Read deals
   - `crm.objects.deals.write` - Create/update deals
   - `crm.schemas.contacts.read` - Read contact properties
   - `crm.schemas.companies.read` - Read company properties

4. Click **"Save"**

### Step 3: Get Credentials

1. Copy **Client ID** from the app dashboard
2. Copy **Client Secret** (keep this secure!)
3. Add to `.env.production.local`:
   ```env
   VITE_HUBSPOT_CLIENT_ID=your-client-id
   VITE_HUBSPOT_CLIENT_SECRET=your-client-secret
   VITE_HUBSPOT_REDIRECT_URI=https://app.pulsemessages.com/crm/callback/hubspot
   ```

### Step 4: Install App

1. Go to **"Install URL"** in app settings
2. Test installation on your HubSpot account
3. Verify permissions are granted

---

## Salesforce Integration

### Step 1: Create Connected App

1. Log in to [Salesforce](https://login.salesforce.com)
2. Navigate to: **Setup** → **Apps** → **App Manager**
3. Click **"New Connected App"**
4. Fill in details:
   - **Connected App Name**: Pulse Messages
   - **API Name**: Pulse_Messages (auto-generated)
   - **Contact Email**: your-email@company.com

### Step 2: Enable OAuth Settings

1. Check **"Enable OAuth Settings"**
2. Set **Callback URL**:
   ```
   https://app.pulsemessages.com/crm/callback/salesforce
   ```

3. Select **OAuth Scopes**:
   - Full access (full)
   - Perform requests on your behalf at any time (refresh_token, offline_access)
   - Manage user data via APIs (api)
   - Access unique user identifiers (openid)

4. Check **"Require Secret for Web Server Flow"**
5. Save the connected app

### Step 3: Get Credentials

1. After saving, click **"Manage Consumer Details"**
2. Verify your identity (email verification code)
3. Copy **Consumer Key** (Client ID)
4. Copy **Consumer Secret** (Client Secret)
5. Add to `.env.production.local`:
   ```env
   VITE_SALESFORCE_CLIENT_ID=your-consumer-key
   VITE_SALESFORCE_CLIENT_SECRET=your-consumer-secret
   VITE_SALESFORCE_REDIRECT_URI=https://app.pulsemessages.com/crm/callback/salesforce
   VITE_SALESFORCE_LOGIN_URL=https://login.salesforce.com
   ```

### Step 4: Configure OAuth Policies

1. Go back to connected app details
2. Click **"Manage"**
3. Edit **OAuth Policies**:
   - **Permitted Users**: All users may self-authorize
   - **IP Relaxation**: Relax IP restrictions
   - **Refresh Token Policy**: Refresh token is valid until revoked

---

## Pipedrive Integration

### Step 1: Create Pipedrive App

1. Visit [Pipedrive Marketplace](https://app.pipedrive.com/developer/apps)
2. Click **"Create new app"**
3. Fill in app details:
   - **App name**: Pulse Messages
   - **App type**: Private app (or Public if you plan to publish)
   - **Description**: CRM-integrated messaging platform

### Step 2: Configure OAuth

1. Navigate to **"OAuth & access scopes"**
2. Set **Redirect URI**:
   ```
   https://app.pulsemessages.com/crm/callback/pipedrive
   ```

3. Select **Scopes**:
   - `deals:read` - Read deals
   - `deals:write` - Create/update deals
   - `persons:read` - Read persons (contacts)
   - `persons:write` - Create/update persons
   - `organizations:read` - Read organizations
   - `organizations:write` - Create/update organizations
   - `activities:read` - Read activities
   - `activities:write` - Create/update activities

4. Save changes

### Step 3: Get Credentials

1. Go to **"Basic information"** tab
2. Copy **Client ID**
3. Copy **Client Secret**
4. Add to `.env.production.local`:
   ```env
   VITE_PIPEDRIVE_CLIENT_ID=your-client-id
   VITE_PIPEDRIVE_CLIENT_SECRET=your-client-secret
   VITE_PIPEDRIVE_REDIRECT_URI=https://app.pulsemessages.com/crm/callback/pipedrive
   ```

---

## Zoho CRM Integration

### Step 1: Register Client

1. Visit [Zoho API Console](https://api-console.zoho.com/)
2. Click **"Add Client"**
3. Select **"Server-based Applications"**
4. Fill in details:
   - **Client Name**: Pulse Messages
   - **Homepage URL**: https://app.pulsemessages.com
   - **Authorized Redirect URIs**:
     ```
     https://app.pulsemessages.com/crm/callback/zoho
     ```

### Step 2: Configure Scopes

After creating the client, configure these scopes:
- `ZohoCRM.modules.ALL` - Full access to CRM modules
- `ZohoCRM.settings.ALL` - Access to CRM settings
- `ZohoCRM.users.READ` - Read user information

Or use specific scopes for granular control:
- `ZohoCRM.modules.contacts.ALL`
- `ZohoCRM.modules.accounts.ALL`
- `ZohoCRM.modules.deals.ALL`
- `ZohoCRM.modules.tasks.ALL`

### Step 3: Get Credentials

1. Copy **Client ID**
2. Copy **Client Secret**
3. Note your **Data Center** (US, EU, IN, AU, JP, CA)
4. Add to `.env.production.local`:
   ```env
   VITE_ZOHO_CLIENT_ID=your-client-id
   VITE_ZOHO_CLIENT_SECRET=your-client-secret
   VITE_ZOHO_REDIRECT_URI=https://app.pulsemessages.com/crm/callback/zoho
   VITE_ZOHO_ACCOUNTS_URL=https://accounts.zoho.com
   ```

**Data Center URLs**:
- US: `https://accounts.zoho.com`
- EU: `https://accounts.zoho.eu`
- India: `https://accounts.zoho.in`
- Australia: `https://accounts.zoho.com.au`
- Japan: `https://accounts.zoho.jp`
- Canada: `https://accounts.zoho.ca`

---

## Testing OAuth Flows

### Local Testing

1. Update `.env.local` with test credentials
2. Add localhost redirect URIs to all OAuth apps:
   ```
   http://localhost:5173/crm/callback/{platform}
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Test each integration:
   - Navigate to Settings → Integrations
   - Click "Connect" for each CRM
   - Complete OAuth flow
   - Verify token is stored in Supabase
   - Test data sync

### Production Testing

1. Deploy to staging environment first
2. Update OAuth apps with staging URLs
3. Test full integration flow:
   - User authentication
   - CRM connection
   - Data sync
   - Contact creation
   - Deal updates

4. Monitor for errors in:
   - Browser console
   - Network tab
   - Supabase logs
   - Application logs

---

## Troubleshooting

### Common Issues

#### 1. Redirect URI Mismatch

**Error**: `redirect_uri_mismatch`

**Solution**:
- Verify redirect URI in OAuth app matches exactly
- Check for trailing slashes
- Ensure HTTPS in production
- Update environment variables

#### 2. Invalid Client ID/Secret

**Error**: `invalid_client` or `unauthorized_client`

**Solution**:
- Regenerate client secret
- Verify credentials are not expired
- Check for extra spaces in .env file
- Ensure client is active

#### 3. Insufficient Permissions

**Error**: `insufficient_scope` or `access_denied`

**Solution**:
- Add missing OAuth scopes to app
- User may need to re-authorize
- Check CRM user has necessary permissions
- Verify scopes in token request

#### 4. Token Refresh Fails

**Error**: `invalid_grant` or `refresh_token_expired`

**Solution**:
- Implement token refresh logic
- Check refresh token expiration policy
- User may need to re-authenticate
- Verify token storage is working

#### 5. CORS Errors

**Error**: `CORS policy: No 'Access-Control-Allow-Origin'`

**Solution**:
- Add domain to CRM app whitelist
- Check API proxy configuration
- Verify headers in API requests
- Use backend proxy for sensitive calls

### Debugging OAuth Flow

1. **Enable Detailed Logging**:
   ```typescript
   console.log('OAuth State:', {
     clientId: VITE_HUBSPOT_CLIENT_ID,
     redirectUri: window.location.origin + '/crm/callback/hubspot',
     scopes: 'crm.objects.contacts.read crm.objects.contacts.write'
   });
   ```

2. **Check Token Exchange**:
   ```typescript
   const tokenResponse = await fetch(tokenUrl, {
     method: 'POST',
     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
     body: new URLSearchParams({
       grant_type: 'authorization_code',
       client_id: clientId,
       client_secret: clientSecret,
       redirect_uri: redirectUri,
       code: authCode
     })
   });
   console.log('Token Response:', await tokenResponse.json());
   ```

3. **Verify Token Storage**:
   ```typescript
   const { data, error } = await supabase
     .from('crm_integrations')
     .select('*')
     .eq('platform', 'hubspot')
     .single();
   console.log('Stored Integration:', data);
   ```

---

## Security Best Practices

1. **Never Expose Secrets**: Keep client secrets server-side only
2. **Use PKCE**: Implement PKCE flow for public clients
3. **Rotate Credentials**: Regularly rotate OAuth credentials
4. **Monitor Access**: Track and audit OAuth token usage
5. **Implement Timeouts**: Set appropriate token expiration
6. **Validate Redirects**: Whitelist allowed redirect URIs
7. **Encrypt Tokens**: Encrypt tokens at rest in database
8. **Rate Limiting**: Implement rate limits on OAuth endpoints

---

## Support Resources

### HubSpot
- [OAuth Documentation](https://developers.hubspot.com/docs/api/oauth)
- [Community Forum](https://community.hubspot.com/)
- [Support](https://developers.hubspot.com/support)

### Salesforce
- [OAuth 2.0 Guide](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm)
- [Developer Community](https://developer.salesforce.com/forums)
- [Support](https://help.salesforce.com/)

### Pipedrive
- [OAuth Guide](https://pipedrive.readme.io/docs/marketplace-oauth-authorization)
- [Developer Forum](https://devcommunity.pipedrive.com/)
- [Support](https://support.pipedrive.com/)

### Zoho CRM
- [OAuth 2.0 Documentation](https://www.zoho.com/crm/developer/docs/api/v2/oauth-overview.html)
- [Developer Community](https://help.zoho.com/portal/en/community/zoho-crm)
- [Support](https://help.zoho.com/portal/en/home)

---

## Next Steps

After completing OAuth setup:

1. ✅ Test each integration thoroughly
2. ✅ Configure webhook listeners for real-time sync
3. ✅ Set up error monitoring and alerting
4. ✅ Document integration for your team
5. ✅ Plan for credential rotation schedule
6. ✅ Configure backup OAuth apps (failover)

---

**Last Updated**: 2026-01-19
**Version**: 1.0
