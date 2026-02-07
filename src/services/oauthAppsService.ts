/**
 * OAuth Apps Service
 * Manages third-party OAuth applications connected to user's Google account
 * Provides app listing, permission tracking, and revocation capabilities
 */

import { supabase } from './supabase';

// ================================================
// Types
// ================================================

export interface OAuthConnectedApp {
  id: string;
  user_id: string;

  // App details
  app_name: string;
  app_client_id: string;
  provider: 'google' | 'microsoft' | 'apple';

  // Permissions and scopes
  scopes: string[];
  permissions_granted: string[];

  // Usage tracking
  first_used_at: string;
  last_used_at: string | null;
  access_count: number;

  // Security
  is_trusted: boolean;
  is_active: boolean;
  revoked_at: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface GoogleTokenInfo {
  issued_to: string; // Client ID
  audience: string;
  scope: string;
  expires_in: number;
  access_type: string;
}

export interface GoogleAppPermission {
  clientId: string;
  displayText: string;
  scopes: string[];
}

// ================================================
// Service Class
// ================================================

class OAuthAppsService {
  /**
   * Get all connected OAuth apps from database
   */
  async getConnectedApps(): Promise<OAuthConnectedApp[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('oauth_connected_apps')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('last_used_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('[OAuthApps] Error fetching apps:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Fetch connected apps from Google and sync to database
   * Uses Google's token info endpoint to discover OAuth clients
   */
  async syncGoogleApps(): Promise<OAuthConnectedApp[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // Get current session to extract Google access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) {
        console.warn('[OAuthApps] No Google provider token available');
        return [];
      }

      // Get token info from Google
      const tokenInfo = await this.getGoogleTokenInfo(session.provider_token);

      if (!tokenInfo) {
        return [];
      }

      // Parse scopes
      const scopes = tokenInfo.scope.split(' ').filter(Boolean);

      // Create or update app entry for Pulse itself
      const pulseApp = await this.upsertApp({
        app_name: 'Pulse',
        app_client_id: tokenInfo.issued_to,
        provider: 'google',
        scopes,
        permissions_granted: this.mapScopesToPermissions(scopes),
        is_trusted: true,
      });

      // Fetch third-party apps using Google Account API
      // Note: This requires special permissions that may not be available
      const thirdPartyApps = await this.fetchGoogleThirdPartyApps(session.provider_token);

      const allApps = [pulseApp, ...thirdPartyApps];

      return allApps;
    } catch (error) {
      console.error('[OAuthApps] Error syncing Google apps:', error);
      return [];
    }
  }

  /**
   * Get Google OAuth token information
   */
  private async getGoogleTokenInfo(accessToken: string): Promise<GoogleTokenInfo | null> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
      );

      if (!response.ok) {
        console.error('[OAuthApps] Token info request failed:', response.status);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[OAuthApps] Error fetching token info:', error);
      return null;
    }
  }

  /**
   * Fetch third-party apps from Google (if permission available)
   * This uses the Google Account Settings API which may require additional scopes
   */
  private async fetchGoogleThirdPartyApps(accessToken: string): Promise<OAuthConnectedApp[]> {
    try {
      // Note: This API may not be publicly available or may require special access
      // For now, we'll return empty array and rely on manual tracking
      return [];
    } catch (error) {
      console.debug('[OAuthApps] Third-party app listing not available');
      return [];
    }
  }

  /**
   * Upsert OAuth app to database
   */
  private async upsertApp(
    appData: Omit<OAuthConnectedApp, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'first_used_at' | 'last_used_at' | 'access_count' | 'is_active' | 'revoked_at'>
  ): Promise<OAuthConnectedApp> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check if app already exists
    const { data: existing } = await supabase
      .from('oauth_connected_apps')
      .select('*')
      .eq('user_id', user.id)
      .eq('app_client_id', appData.app_client_id)
      .eq('provider', appData.provider)
      .single();

    if (existing) {
      // Update existing app
      const { data, error } = await supabase
        .from('oauth_connected_apps')
        .update({
          scopes: appData.scopes,
          permissions_granted: appData.permissions_granted,
          last_used_at: new Date().toISOString(),
          access_count: existing.access_count + 1,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('[OAuthApps] Error updating app:', error);
        throw error;
      }

      return data;
    } else {
      // Insert new app
      const { data, error } = await supabase
        .from('oauth_connected_apps')
        .insert({
          user_id: user.id,
          ...appData,
          first_used_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
          access_count: 1,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('[OAuthApps] Error inserting app:', error);
        throw error;
      }

      return data;
    }
  }

  /**
   * Map OAuth scopes to human-readable permissions
   */
  private mapScopesToPermissions(scopes: string[]): string[] {
    const scopeMap: Record<string, string> = {
      'https://www.googleapis.com/auth/gmail.readonly': 'Read your emails',
      'https://www.googleapis.com/auth/gmail.send': 'Send emails on your behalf',
      'https://www.googleapis.com/auth/gmail.compose': 'Compose and manage drafts',
      'https://www.googleapis.com/auth/gmail.modify': 'Modify email labels and settings',
      'https://www.googleapis.com/auth/calendar.readonly': 'Read your calendar events',
      'https://www.googleapis.com/auth/calendar.events': 'Create and manage calendar events',
      'https://www.googleapis.com/auth/contacts.readonly': 'Read your contacts',
      'https://www.googleapis.com/auth/drive.file': 'Access files created by this app',
      'https://www.googleapis.com/auth/drive.readonly': 'Read files from your Drive',
      'https://www.googleapis.com/auth/userinfo.email': 'View your email address',
      'https://www.googleapis.com/auth/userinfo.profile': 'View your profile information',
      'email': 'Access your email address',
      'profile': 'Access your profile information',
      'openid': 'Authenticate your identity',
    };

    const permissions: string[] = [];

    for (const scope of scopes) {
      if (scopeMap[scope]) {
        permissions.push(scopeMap[scope]);
      } else {
        // Add the scope itself if not in map
        permissions.push(scope);
      }
    }

    return permissions;
  }

  /**
   * Revoke access to a third-party OAuth app
   */
  async revokeApp(appId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get app details
    const { data: app, error: fetchError } = await supabase
      .from('oauth_connected_apps')
      .select('*')
      .eq('id', appId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !app) {
      throw new Error('App not found');
    }

    // Mark as revoked in database
    const { error: updateError } = await supabase
      .from('oauth_connected_apps')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq('id', appId);

    if (updateError) {
      console.error('[OAuthApps] Error revoking app:', updateError);
      throw updateError;
    }

    // If this is a Google app, attempt to revoke via Google API
    if (app.provider === 'google') {
      await this.revokeGoogleAppAccess(app.app_client_id);
    }
  }

  /**
   * Revoke Google app access using Google's revocation endpoint
   * Note: This requires the app's token, which we may not have stored
   */
  private async revokeGoogleAppAccess(clientId: string): Promise<void> {
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) {
        console.warn('[OAuthApps] No Google provider token for revocation');
        return;
      }

      // Revoke the token
      const response = await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(session.provider_token)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (!response.ok) {
        console.warn('[OAuthApps] Google revocation returned:', response.status);
      } else {
        console.log('[OAuthApps] Successfully revoked Google app access');
      }
    } catch (error) {
      console.error('[OAuthApps] Error revoking Google app:', error);
    }
  }

  /**
   * Mark app as trusted
   */
  async markAsTrusted(appId: string, trusted: boolean): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('oauth_connected_apps')
      .update({ is_trusted: trusted })
      .eq('id', appId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[OAuthApps] Error updating trust status:', error);
      throw error;
    }
  }

  /**
   * Get app statistics
   */
  async getAppStats(): Promise<{
    total_apps: number;
    active_apps: number;
    trusted_apps: number;
    google_apps: number;
    microsoft_apps: number;
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: apps, error } = await supabase
      .from('oauth_connected_apps')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('[OAuthApps] Error fetching app stats:', error);
      throw error;
    }

    const total_apps = apps?.length || 0;
    const active_apps = apps?.filter((app) => app.is_active).length || 0;
    const trusted_apps = apps?.filter((app) => app.is_trusted).length || 0;
    const google_apps = apps?.filter((app) => app.provider === 'google').length || 0;
    const microsoft_apps = apps?.filter((app) => app.provider === 'microsoft').length || 0;

    return {
      total_apps,
      active_apps,
      trusted_apps,
      google_apps,
      microsoft_apps,
    };
  }

  /**
   * Get permission summary across all apps
   */
  async getPermissionSummary(): Promise<Record<string, number>> {
    const apps = await this.getConnectedApps();

    const permissionCounts: Record<string, number> = {};

    for (const app of apps) {
      for (const permission of app.permissions_granted) {
        permissionCounts[permission] = (permissionCounts[permission] || 0) + 1;
      }
    }

    return permissionCounts;
  }

  /**
   * Manually add a third-party app
   * Useful for tracking apps that can't be auto-discovered
   */
  async addManualApp(
    appName: string,
    provider: 'google' | 'microsoft' | 'apple',
    permissions: string[]
  ): Promise<OAuthConnectedApp> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('oauth_connected_apps')
      .insert({
        user_id: user.id,
        app_name: appName,
        app_client_id: `manual_${Date.now()}`,
        provider,
        scopes: [],
        permissions_granted: permissions,
        first_used_at: new Date().toISOString(),
        is_active: true,
        is_trusted: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[OAuthApps] Error adding manual app:', error);
      throw error;
    }

    return data;
  }

  /**
   * Open Google Account permissions page
   */
  openGooglePermissionsPage(): void {
    window.open(
      'https://myaccount.google.com/permissions',
      '_blank',
      'noopener,noreferrer'
    );
  }

  /**
   * Open Microsoft Account permissions page
   */
  openMicrosoftPermissionsPage(): void {
    window.open(
      'https://account.microsoft.com/privacy/app-access',
      '_blank',
      'noopener,noreferrer'
    );
  }
}

export const oauthAppsService = new OAuthAppsService();
export default oauthAppsService;
