// server/crmOAuth.js
//
// Server-side (plain Node ESM) mirror of the BROWSER-FREE parts of
// src/services/crm/oauthHelper.ts — specifically CRM_OAUTH_CONFIGS and
// exchangeCodeForToken (a pure provider token exchange, no Supabase).
//
// Why this file exists: server.js runs under plain `node` (no TS transpile),
// so it cannot import oauthHelper.ts; and oauthHelper.ts imports the
// browser-only Supabase client (`import { supabase } from '../supabase'`,
// which reads import.meta.env and pulls in Capacitor) — poison for Node.
// The /api/crm/callback/:platform route only needs the token exchange and
// redirects the result to the frontend, so no Supabase is required here.
//
// KEEP IN SYNC: if you change CRM_OAUTH_CONFIGS or exchangeCodeForToken in
// src/services/crm/oauthHelper.ts, mirror the change here (and vice versa).

export const CRM_OAUTH_CONFIGS = {
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
  },
  salesforce: {
    authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    scopes: ['api', 'refresh_token', 'full'],
    grantType: 'authorization_code',
  },
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
  },
  zoho: {
    authUrl: 'https://accounts.zoho.com/oauth/v2/auth',
    tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
    scopes: [
      'ZohoCRM.modules.ALL',
      'ZohoCRM.settings.ALL',
      'ZohoCRM.users.READ',
    ],
    grantType: 'authorization_code',
  },
};

/**
 * Exchange an OAuth authorization code for access/refresh tokens.
 * Pure provider HTTP — no Supabase, no browser globals (Node 18+ global fetch).
 */
export async function exchangeCodeForToken(
  platform,
  code,
  clientId,
  clientSecret,
  redirectUri
) {
  const config = CRM_OAUTH_CONFIGS[platform];
  if (!config) {
    throw new Error(`Unknown CRM platform: ${platform}`);
  }

  const body = new URLSearchParams({
    grant_type: config.grantType || 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OAuth token exchange failed for ${platform}: ${response.statusText} - ${errorText}`
    );
  }

  return await response.json();
}
