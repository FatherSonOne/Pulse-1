# CRM Integration Setup Guide

This guide provides step-by-step instructions for setting up CRM integrations with Pulse messaging platform.

## Supported CRM Platforms

- **HubSpot** - Full OAuth 2.0 support
- **Salesforce** - Full OAuth 2.0 support
- **Pipedrive** - OAuth 2.0 and API Key support
- **Zoho CRM** - Full OAuth 2.0 support

---

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [HubSpot Setup](#hubspot-setup)
3. [Salesforce Setup](#salesforce-setup)
4. [Pipedrive Setup](#pipedrive-setup)
5. [Zoho CRM Setup](#zoho-crm-setup)
6. [Testing Integration](#testing-integration)
7. [Troubleshooting](#troubleshooting)

---

## Environment Variables

Add these environment variables to your `.env` file:

```env
# HubSpot
HUBSPOT_CLIENT_ID=your_hubspot_client_id
HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
HUBSPOT_REDIRECT_URI=https://your-domain.com/api/crm/callback/hubspot

# Salesforce
SALESFORCE_CLIENT_ID=your_salesforce_client_id
SALESFORCE_CLIENT_SECRET=your_salesforce_client_secret
SALESFORCE_REDIRECT_URI=https://your-domain.com/api/crm/callback/salesforce

# Pipedrive
PIPEDRIVE_CLIENT_ID=your_pipedrive_client_id
PIPEDRIVE_CLIENT_SECRET=your_pipedrive_client_secret
PIPEDRIVE_REDIRECT_URI=https://your-domain.com/api/crm/callback/pipedrive

# Zoho CRM
ZOHO_CLIENT_ID=your_zoho_client_id
ZOHO_CLIENT_SECRET=your_zoho_client_secret
ZOHO_REDIRECT_URI=https://your-domain.com/api/crm/callback/zoho
```

---

## HubSpot Setup

### 1. Create HubSpot App

1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Click "Create App"
3. Fill in app details:
   - App name: "Pulse Messaging"
   - Description: "Sync contacts, deals, and tasks with Pulse"

### 2. Configure OAuth

1. Navigate to "Auth" tab
2. Add redirect URL: `https://your-domain.com/api/crm/callback/hubspot`
3. Select required scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.companies.read`
   - `crm.objects.companies.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `crm.objects.tasks.read`
   - `crm.objects.tasks.write`

### 3. Get Credentials

1. Copy **Client ID** and **Client Secret**
2. Add to `.env` file

### 4. Test Connection

```typescript
import { generateAuthUrl } from './services/crm/oauthHelper';

const authUrl = generateAuthUrl(
  'hubspot',
  process.env.HUBSPOT_CLIENT_ID!,
  process.env.HUBSPOT_REDIRECT_URI!
);

console.log('Authorize at:', authUrl);
```

### 5. Operations Supported

- ✅ Create Task
- ✅ Update Deal
- ✅ Log Call Engagement
- ✅ Create Contact
- ✅ Search Contact by Email
- ✅ Full Sync (Contacts, Companies, Deals)

### 6. Rate Limits

- **Free/Starter**: 100 requests per 10 seconds
- **Professional/Enterprise**: Higher limits
- Retry logic handles 429 responses automatically

---

## Salesforce Setup

### 1. Create Connected App

1. Log into Salesforce
2. Go to **Setup** → **Apps** → **App Manager**
3. Click **New Connected App**
4. Fill in details:
   - Connected App Name: "Pulse Messaging"
   - Contact Email: your email
   - Enable OAuth Settings: ✅

### 2. Configure OAuth

1. Callback URL: `https://your-domain.com/api/crm/callback/salesforce`
2. Selected OAuth Scopes:
   - Full access (full)
   - Perform requests on your behalf at any time (refresh_token, offline_access)
   - Access and manage your data (api)

### 3. Get Credentials

1. After saving, view the Connected App
2. Click **Manage Consumer Details**
3. Copy **Consumer Key** (Client ID) and **Consumer Secret** (Client Secret)
4. Add to `.env` file

### 4. Test Connection

```typescript
import { generateAuthUrl } from './services/crm/oauthHelper';

const authUrl = generateAuthUrl(
  'salesforce',
  process.env.SALESFORCE_CLIENT_ID!,
  process.env.SALESFORCE_REDIRECT_URI!
);

console.log('Authorize at:', authUrl);
```

### 5. Operations Supported

- ✅ Create Task
- ✅ Update Opportunity
- ✅ Log Activity (Call/Email/Meeting)
- ✅ Create Contact/Lead
- ✅ Search Contact by Email (SOQL)
- ✅ Full Sync (Contacts, Accounts, Opportunities)

### 6. Rate Limits

- Varies by Salesforce edition
- Daily API limit (e.g., 15,000 for Enterprise)
- Retry logic handles limits automatically

---

## Pipedrive Setup

### 1. Create Pipedrive App

1. Go to [Pipedrive Marketplace](https://www.pipedrive.com/en/marketplace/manager)
2. Click **Create Private App** (for your organization only)
3. Fill in app details:
   - App name: "Pulse Messaging"
   - Description: "Sync deals and contacts with Pulse"

### 2. Configure OAuth (Optional)

If using OAuth instead of API key:

1. Add OAuth Redirect URL: `https://your-domain.com/api/crm/callback/pipedrive`
2. Required scopes:
   - `deals:full`
   - `contacts:full`
   - `activities:full`
   - `users:read`
   - `organizations:full`

### 3. Get Credentials

**Option A: API Key (Simpler)**
1. Go to Settings → Personal Preferences → API
2. Copy your API Token
3. Add to `.env` as `PIPEDRIVE_API_KEY`

**Option B: OAuth (More Secure)**
1. Copy **Client ID** and **Client Secret** from your app
2. Add to `.env` file

### 4. Test Connection

**With API Key:**
```typescript
const integration = await crmService.createIntegration(
  'pipedrive',
  'My Pipedrive',
  process.env.PIPEDRIVE_API_KEY!,
  workspaceId
);
```

**With OAuth:**
```typescript
const authUrl = generateAuthUrl(
  'pipedrive',
  process.env.PIPEDRIVE_CLIENT_ID!,
  process.env.PIPEDRIVE_REDIRECT_URI!
);
```

### 5. Operations Supported

- ✅ Create Activity (Task/Call/Meeting)
- ✅ Update Deal
- ✅ Create Deal
- ✅ Create Person (Contact)
- ✅ Update Person
- ✅ Search Person by Email
- ✅ Full Sync (Persons, Organizations, Deals)

### 6. Rate Limits

- **2 requests per second per company**
- Burst allowance: 10 requests
- Retry logic with exponential backoff included

---

## Zoho CRM Setup

### 1. Create Zoho App

1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Click **Add Client**
3. Choose **Server-based Applications**
4. Fill in details:
   - Client Name: "Pulse Messaging"
   - Homepage URL: `https://your-domain.com`
   - Authorized Redirect URIs: `https://your-domain.com/api/crm/callback/zoho`

### 2. Configure Scopes

Required scopes:
- `ZohoCRM.modules.ALL` - Access all CRM modules
- `ZohoCRM.settings.ALL` - Access settings
- `ZohoCRM.users.READ` - Read user info

### 3. Get Credentials

1. Copy **Client ID** and **Client Secret**
2. Add to `.env` file

### 4. Test Connection

```typescript
import { generateAuthUrl } from './services/crm/oauthHelper';

const authUrl = generateAuthUrl(
  'zoho',
  process.env.ZOHO_CLIENT_ID!,
  process.env.ZOHO_REDIRECT_URI!
);

console.log('Authorize at:', authUrl);
```

### 5. Operations Supported

- ✅ Create Task
- ✅ Update Deal
- ✅ Create Deal
- ✅ Create Contact
- ✅ Update Contact
- ✅ Log Call
- ✅ Create Note
- ✅ Search Contact by Email

### 6. Rate Limits

- **100 API calls per minute per user**
- Daily limits vary by plan
- Retry logic handles rate limits automatically

---

## Testing Integration

### 1. OAuth Flow Test

```typescript
import { crmActionsService } from './services/crmActionsService';
import { CRMActionPayload } from './types/crmTypes';

// Create a test task
const payload: CRMActionPayload = {
  fields: {
    title: 'Test Task from Pulse',
    description: 'Testing CRM integration',
    priority: 'high',
    dueDate: new Date(Date.now() + 86400000), // Tomorrow
  },
};

await crmActionsService.createAction(
  'create_task',
  integrationId,
  contactId,
  payload,
  userId
);
```

### 2. Sync Test

```typescript
import { crmService } from './services/crmService';

// Run full sync
const syncLog = await crmService.fullSync(integrationId);

console.log('Sync complete:', {
  contacts: syncLog.contactsSynced,
  companies: syncLog.companiesSynced,
  deals: syncLog.dealsSynced,
  duration: syncLog.durationSeconds,
});
```

### 3. Search Test

```typescript
// HubSpot
const contact = await hubspotService.searchContactByEmail(
  integration,
  'test@example.com'
);

// Salesforce
const contact = await salesforceService.searchContactByEmail(
  integration,
  'test@example.com'
);

// Pipedrive
const person = await pipedriveService.searchPersonByEmail(
  integration,
  'test@example.com'
);

// Zoho
const contact = await zohoService.searchContactByEmail(
  integration,
  'test@example.com'
);
```

---

## Troubleshooting

### Common Issues

#### 1. "Invalid OAuth Token" Error

**Cause:** Token expired or invalid

**Solution:**
- Token refresh is automatic
- Check that refresh token is stored correctly
- Re-authorize if refresh token is missing

#### 2. "Rate Limit Exceeded" Error

**Cause:** Too many requests in short period

**Solution:**
- Retry logic handles this automatically with exponential backoff
- Consider implementing request queuing for bulk operations
- Check your CRM plan's rate limits

#### 3. "Insufficient Permissions" Error

**Cause:** Missing OAuth scopes

**Solution:**
- Review required scopes for each platform
- Re-authorize with correct scopes
- Check user permissions in CRM

#### 4. Sync Failures

**Cause:** Network issues, large datasets, or API changes

**Solution:**
```typescript
// Check sync logs
const { data: logs } = await supabase
  .from('crm_sync_logs')
  .select('*')
  .eq('crm_id', integrationId)
  .order('created_at', { ascending: false })
  .limit(10);

logs.forEach(log => {
  console.log(`Sync ${log.sync_type}: ${log.status}`);
  if (log.error_message) {
    console.error('Error:', log.error_message);
  }
});
```

### Debug Mode

Enable detailed logging:

```typescript
// In your service file
import { CRMError } from './crm/retryHelper';

try {
  const result = await operation();
} catch (error) {
  if (error instanceof CRMError) {
    console.error('CRM Error:', {
      platform: error.platform,
      operation: error.operation,
      statusCode: error.statusCode,
      message: error.message,
    });
  }
  throw error;
}
```

### Testing with Sandbox Accounts

All CRM platforms offer sandbox/test environments:

- **HubSpot**: Test accounts available (free tier)
- **Salesforce**: Developer Edition or Sandbox
- **Pipedrive**: Trial accounts with full API access
- **Zoho**: Developer account with test data

### Support Resources

- **HubSpot**: [developers.hubspot.com/docs](https://developers.hubspot.com/docs)
- **Salesforce**: [developer.salesforce.com](https://developer.salesforce.com)
- **Pipedrive**: [pipedrive.readme.io](https://pipedrive.readme.io)
- **Zoho**: [www.zoho.com/crm/developer](https://www.zoho.com/crm/developer)

---

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate tokens regularly** (especially API keys)
4. **Implement IP whitelisting** where supported
5. **Monitor API usage** to detect anomalies
6. **Use HTTPS** for all redirect URIs
7. **Validate webhook signatures** for CRM webhooks

---

## Database Schema

CRM integrations store data in these Supabase tables:

- `crm_integrations` - OAuth credentials and settings
- `crm_contacts` - Synced contacts
- `crm_companies` - Synced companies/accounts
- `crm_deals` - Synced deals/opportunities
- `crm_actions` - Action history (tasks, calls, etc.)
- `crm_sync_logs` - Sync operation logs

See migration files in `f:/pulse1/supabase/migrations/` for full schema.

---

## Next Steps

After setup:

1. Configure webhook endpoints for real-time updates
2. Set up bi-directional sync schedules
3. Create custom field mappings for your use case
4. Build smart groups for automatic contact segmentation
5. Implement CRM sidepanel in Pulse UI

---

## Support

For issues or questions:

1. Check this documentation
2. Review error logs in Supabase
3. Test with sandbox accounts first
4. Contact Pulse support with integration ID and error details
