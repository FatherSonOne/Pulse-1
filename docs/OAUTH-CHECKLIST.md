# OAuth Setup Checklist

Quick reference checklist for setting up CRM OAuth integrations.

## Pre-Setup Checklist

- [ ] Active CRM account with admin access
- [ ] Production domain configured (e.g., `https://your-domain.com`)
- [ ] Local development environment running (`http://localhost:5173`)
- [ ] Supabase project set up with CRM tables
- [ ] `.env.production.template` reviewed

---

## HubSpot OAuth Setup

### Configuration Steps
- [ ] Create HubSpot developer account
- [ ] Create OAuth app at [HubSpot Developer Portal](https://developers.hubspot.com/)
- [ ] Add redirect URIs:
  - [ ] Development: `http://localhost:5173/integrations/hubspot/callback`
  - [ ] Production: `https://your-domain.com/integrations/hubspot/callback`
- [ ] Configure OAuth scopes:
  - [ ] `crm.objects.contacts.write`
  - [ ] `crm.objects.contacts.read`
  - [ ] `crm.objects.companies.write`
  - [ ] `crm.objects.companies.read`
  - [ ] `crm.objects.deals.write`
  - [ ] `crm.objects.deals.read`
  - [ ] `crm.objects.tasks.write`
  - [ ] `crm.objects.tasks.read`

### Credentials
- [ ] Copy App ID (Client ID)
- [ ] Copy Client Secret
- [ ] Add to `.env.production`:
  ```env
  VITE_HUBSPOT_CLIENT_ID=your-client-id
  VITE_HUBSPOT_CLIENT_SECRET=your-client-secret
  VITE_HUBSPOT_REDIRECT_URI=https://your-domain.com/integrations/hubspot/callback
  ```

### Testing
- [ ] Test OAuth flow in development
- [ ] Install app on test HubSpot account
- [ ] Verify token refresh works
- [ ] Test contact/deal sync
- [ ] Test in production

---

## Salesforce OAuth Setup

### Configuration Steps
- [ ] Log in to Salesforce
- [ ] Navigate to Setup → App Manager
- [ ] Create new Connected App
- [ ] Enable OAuth Settings
- [ ] Add callback URLs:
  - [ ] Development: `http://localhost:5173/integrations/salesforce/callback`
  - [ ] Production: `https://your-domain.com/integrations/salesforce/callback`
- [ ] Configure OAuth scopes:
  - [ ] `api` (Access and manage your data)
  - [ ] `refresh_token` (Provide access via the Web)
  - [ ] `web` (Perform requests on your behalf)
  - [ ] `full` (Full access to logged-in user data)
- [ ] Configure policies:
  - [ ] Permitted Users: All users may self-authorize
  - [ ] IP Relaxation: Relax IP restrictions
  - [ ] Refresh Token Policy: Valid until revoked

### Credentials
- [ ] Copy Consumer Key (Client ID)
- [ ] Copy Consumer Secret (Client Secret)
- [ ] Add to `.env.production`:
  ```env
  VITE_SALESFORCE_CLIENT_ID=your-consumer-key
  VITE_SALESFORCE_CLIENT_SECRET=your-consumer-secret
  VITE_SALESFORCE_REDIRECT_URI=https://your-domain.com/integrations/salesforce/callback
  ```

### Testing
- [ ] Test OAuth flow in development
- [ ] Test on Sandbox environment first
- [ ] Verify `instance_url` is stored correctly
- [ ] Test contact/opportunity sync
- [ ] Test in production

---

## Pipedrive OAuth Setup

### Configuration Steps
- [ ] Go to [Pipedrive Developer Portal](https://app.pipedrive.com/developer/apps)
- [ ] Create new app
- [ ] Add callback URL:
  - [ ] Development: `http://localhost:5173/integrations/pipedrive/callback`
  - [ ] Production: `https://your-domain.com/integrations/pipedrive/callback`
- [ ] Configure OAuth scopes:
  - [ ] `deals:full`
  - [ ] `contacts:full`
  - [ ] `activities:full`
  - [ ] `organizations:full`
  - [ ] `users:read`

### Credentials
- [ ] Copy Client ID
- [ ] Copy Client Secret
- [ ] Add to `.env.production`:
  ```env
  VITE_PIPEDRIVE_CLIENT_ID=your-client-id
  VITE_PIPEDRIVE_CLIENT_SECRET=your-client-secret
  VITE_PIPEDRIVE_REDIRECT_URI=https://your-domain.com/integrations/pipedrive/callback
  ```

### Testing
- [ ] Test OAuth flow in development
- [ ] Test person/deal sync
- [ ] Test activity logging
- [ ] Verify rate limits are respected
- [ ] Test in production

---

## Zoho CRM OAuth Setup

### Configuration Steps
- [ ] Go to [Zoho API Console](https://api-console.zoho.com/)
- [ ] Create Server-based Application
- [ ] Select correct data center (US, EU, IN, AU, CN)
- [ ] Add redirect URIs:
  - [ ] Development: `http://localhost:5173/integrations/zoho/callback`
  - [ ] Production: `https://your-domain.com/integrations/zoho/callback`
- [ ] Configure OAuth scopes:
  - [ ] `ZohoCRM.modules.ALL`
  - [ ] `ZohoCRM.settings.ALL`
  - [ ] `ZohoCRM.users.READ`

### Credentials
- [ ] Copy Client ID
- [ ] Copy Client Secret
- [ ] Note data center URL
- [ ] Add to `.env.production`:
  ```env
  VITE_ZOHO_CLIENT_ID=your-client-id
  VITE_ZOHO_CLIENT_SECRET=your-client-secret
  VITE_ZOHO_REDIRECT_URI=https://your-domain.com/integrations/zoho/callback
  VITE_ZOHO_ACCOUNTS_URL=https://accounts.zoho.com
  ```

### Testing
- [ ] Test OAuth flow in development
- [ ] Verify correct data center URL
- [ ] Test contact/deal sync
- [ ] Monitor API rate limits
- [ ] Test in production

---

## General Testing Checklist

### Development Environment
- [ ] Set up `.env.local` with development credentials
- [ ] Start development server (`npm run dev`)
- [ ] Navigate to Settings → Integrations
- [ ] Test OAuth authorization flow for each CRM
- [ ] Verify successful connection
- [ ] Check token storage in Supabase
- [ ] Test sync operations (read/write)

### Production Environment
- [ ] Set up `.env.production` with production credentials
- [ ] Deploy to production domain
- [ ] Verify redirect URIs match production domain
- [ ] Test OAuth flow in production
- [ ] Monitor OAuth logs for errors
- [ ] Test token refresh mechanism
- [ ] Verify webhook callbacks work (if configured)

### Security Verification
- [ ] Credentials not committed to version control
- [ ] `.env` files added to `.gitignore`
- [ ] Different credentials for dev/staging/production
- [ ] HTTPS enabled in production
- [ ] Redirect URI exact match (no wildcards)
- [ ] State parameter used for CSRF protection
- [ ] Tokens encrypted in Supabase
- [ ] Row Level Security (RLS) enabled
- [ ] Rate limiting implemented
- [ ] OAuth events logged

---

## Post-Setup Tasks

### Monitoring
- [ ] Set up OAuth error alerts
- [ ] Monitor token refresh rates
- [ ] Track failed authorization attempts
- [ ] Monitor API rate limit usage
- [ ] Log all sync operations

### Documentation
- [ ] Document OAuth setup for team
- [ ] Create runbook for OAuth issues
- [ ] Document rate limits per platform
- [ ] Create troubleshooting guide
- [ ] Document security procedures

### Maintenance
- [ ] Schedule OAuth secret rotation (every 90 days)
- [ ] Set up token expiration monitoring
- [ ] Plan for OAuth app approval renewals
- [ ] Document incident response procedures
- [ ] Schedule regular security audits

---

## Common Issues Reference

### Quick Fixes

**Redirect URI Mismatch**
```
Check: Exact URL match (http vs https, trailing slash)
Fix: Update redirect URI in CRM OAuth app settings
```

**Invalid Client Credentials**
```
Check: No extra spaces, correct environment variables
Fix: Regenerate client secret, update .env file
```

**Insufficient Permissions**
```
Check: All required scopes configured
Fix: Add missing scopes, user must re-authorize
```

**Token Expired**
```
Check: Token refresh logic working
Fix: Verify refresh token valid, implement auto-refresh
```

**Rate Limit Exceeded**
```
Check: API usage patterns
Fix: Implement request queuing, reduce sync frequency
```

---

## Support Resources

- **Full Setup Guide**: `docs/OAUTH-SETUP-GUIDE.md`
- **Backend Audit**: `docs/backend-audit.md`
- **CRM Integration Architecture**: `docs/crm-integration-architecture.md`

### Platform Documentation
- HubSpot: https://developers.hubspot.com/docs/api/oauth
- Salesforce: https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_flows.htm
- Pipedrive: https://pipedrive.readme.io/docs/marketplace-oauth-authorization
- Zoho: https://www.zoho.com/crm/developer/docs/api/v3/oauth-overview.html

---

**Last Updated**: 2026-01-20
**Version**: 1.0.0
