// ============================================
// CRM OAuth Configuration Helper
// Centralized OAuth configs for all CRM providers
// ============================================

import { CRMPlatform, CRMIntegration } from '../../types/crmTypes';
import { supabase } from '../supabase';

export interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  grantType?: string;
}

/**
 * OAuth configurations for each CRM platform
 */
export const CRM_OAUTH_CONFIGS: Record<CRMPlatform | 'zoho', OAuthConfig> = {
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
 * Generate OAuth authorization URL
 */
export function generateAuthUrl(
  platform: CRMPlatform | 'zoho',
  clientId: string,
  redirectUri: string,
  state?: string
): string {
  const config = CRM_OAUTH_CONFIGS[platform];
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scopes.join(' '),
    response_type: 'code',
  });

  if (state) {
    params.append('state', state);
  }

  // Salesforce specific
  if (platform === 'salesforce') {
    params.append('prompt', 'consent');
  }

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  platform: CRMPlatform | 'zoho',
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  instance_url?: string;
}> {
  const config = CRM_OAUTH_CONFIGS[platform];

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

/**
 * Refresh access token
 */
export async function refreshCRMToken(
  integration: CRMIntegration
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  if (!integration.refreshToken) {
    throw new Error('No refresh token available');
  }

  const config = CRM_OAUTH_CONFIGS[integration.platform as CRMPlatform | 'zoho'];

  // Get client credentials from environment or database
  const clientId = process.env[`${integration.platform.toUpperCase()}_CLIENT_ID`];
  const clientSecret =
    process.env[`${integration.platform.toUpperCase()}_CLIENT_SECRET`];

  if (!clientId || !clientSecret) {
    throw new Error(
      `Missing OAuth credentials for ${integration.platform}. Set ${integration.platform.toUpperCase()}_CLIENT_ID and ${integration.platform.toUpperCase()}_CLIENT_SECRET`
    );
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: integration.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
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
      `Token refresh failed for ${integration.platform}: ${response.statusText} - ${errorText}`
    );
  }

  const tokens = await response.json();

  // Update integration with new tokens
  const tokenExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  await supabase
    .from('crm_integrations')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || integration.refreshToken,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  return tokens;
}

/**
 * Check if token is expired or about to expire
 */
export function isTokenExpired(integration: CRMIntegration): boolean {
  if (!integration.tokenExpiresAt) {
    return false; // No expiration time set, assume valid
  }

  const now = new Date();
  const expiresAt = new Date(integration.tokenExpiresAt);
  const bufferMinutes = 5; // Refresh 5 minutes before expiration

  return expiresAt.getTime() - now.getTime() < bufferMinutes * 60 * 1000;
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(
  integration: CRMIntegration
): Promise<string> {
  if (!integration.accessToken) {
    throw new Error('No access token available');
  }

  if (isTokenExpired(integration)) {
    const tokens = await refreshCRMToken(integration);
    return tokens.access_token;
  }

  return integration.accessToken;
}
