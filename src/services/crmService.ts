// ============================================
// BASE CRM SERVICE (Platform-Agnostic)
// ============================================

import { supabase } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import axios, { AxiosInstance } from 'axios';
import {
  CRMIntegration,
  CRMContact,
  CRMCompany,
  CRMDeal,
  CRMPlatform,
  SyncStatus,
  SyncLog,
} from '../types/crmTypes';

/**
 * Base CRM Service
 * Provides unified interface for all CRM platforms
 */
export class CRMService {
  private supabase: SupabaseClient;
  private httpClient: AxiosInstance;
  private integrations: Map<string, CRMIntegration> = new Map();

  constructor() {
    this.supabase = supabase;
    this.httpClient = axios.create({
      timeout: 30000,
    });
  }

  // ==================== INTEGRATION SETUP ====================

  /**
   * Create CRM integration
   */
  async createIntegration(
    platform: CRMPlatform,
    displayName: string,
    apiKey: string,
    workspaceId: string
  ): Promise<CRMIntegration> {
    const integrationData = {
      platform,
      display_name: displayName,
      api_key: apiKey,
      workspace_id: workspaceId,
      is_active: true,
      sync_enabled: true,
      sync_status: 'idle',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('crm_integrations')
      .insert(integrationData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create integration: ${error.message}`);

    const integration = this.mapToCRMIntegration(data);
    this.integrations.set(integration.id, integration);
    return integration;
  }

  /**
   * Get integration by platform
   */
  async getIntegration(platform: CRMPlatform): Promise<CRMIntegration | null> {
    const { data, error } = await this.supabase
      .from('crm_integrations')
      .select('*')
      .eq('platform', platform)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch integration: ${error.message}`);
    }

    return data ? this.mapToCRMIntegration(data) : null;
  }

  /**
   * Update integration token
   */
  async updateToken(
    integrationId: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number
  ): Promise<void> {
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    const { error } = await this.supabase
      .from('crm_integrations')
      .update({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integrationId);

    if (error) throw new Error(`Failed to update token: ${error.message}`);
  }

  // ==================== SYNC OPERATIONS ====================

  /**
   * Full sync from CRM (all contacts, companies, deals)
   */
  async fullSync(crmId: string): Promise<SyncLog> {
    const integration = await this.getIntegrationById(crmId);
    if (!integration) throw new Error('Integration not found');

    const startedAt = new Date();
    let contactsSynced = 0;
    let companiesSynced = 0;
    let dealsSynced = 0;
    let status: 'success' | 'partial' | 'failed' = 'success';
    let errorMessage: string | undefined;

    try {
      // Update sync status
      await this.updateSyncStatus(crmId, 'syncing');

      // Platform-specific sync logic
      const syncResult = await this.syncByPlatform(
        integration.platform,
        integration
      );

      contactsSynced = syncResult.contactsSynced;
      companiesSynced = syncResult.companiesSynced;
      dealsSynced = syncResult.dealsSynced;
    } catch (error) {
      status = 'failed';
      errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
    } finally {
      // Record sync
      const completedAt = new Date();
      const durationSeconds = Math.floor(
        (completedAt.getTime() - startedAt.getTime()) / 1000
      );

      await this.recordSyncLog(crmId, 'full', {
        contactsSynced,
        companiesSynced,
        dealsSynced,
        status,
        errorMessage,
        durationSeconds,
        completedAt,
      });

      // Update final sync status
      await this.updateSyncStatus(
        crmId,
        status === 'success' ? 'idle' : 'error',
        errorMessage
      );

      // Update last sync time
      await this.updateLastSyncTime(crmId);
    }

    return {
      id: `sync-${Date.now()}`,
      crmId,
      syncType: 'full',
      contactsSynced,
      companiesSynced,
      dealsSynced,
      status,
      errorMessage,
      startedAt,
      completedAt: new Date(),
      durationSeconds: Math.floor(
        (new Date().getTime() - startedAt.getTime()) / 1000
      ),
    };
  }

  /**
   * Sync by platform (HubSpot, Salesforce, Pipedrive)
   */
  private async syncByPlatform(
    platform: CRMPlatform,
    integration: CRMIntegration
  ): Promise<{ contactsSynced: number; companiesSynced: number; dealsSynced: number }> {
    switch (platform) {
      case 'hubspot':
        return await this.syncHubSpot(integration);
      case 'salesforce':
        return await this.syncSalesforce(integration);
      case 'pipedrive':
        return await this.syncPipedrive(integration);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  // ==================== HUBSPOT SYNC ====================

  private async syncHubSpot(
    integration: CRMIntegration
  ): Promise<{ contactsSynced: number; companiesSynced: number; dealsSynced: number }> {
    const baseUrl = 'https://api.hubapi.com';
    const headers = { Authorization: `Bearer ${integration.accessToken}` };

    let contactsSynced = 0;
    let companiesSynced = 0;
    let dealsSynced = 0;

    try {
      // Fetch contacts
      const contactsResponse = await this.httpClient.get(
        `${baseUrl}/crm/v3/objects/contacts`,
        { headers, params: { limit: 100 } }
      );

      for (const contact of contactsResponse.data.results) {
        await this.storeContact(
          integration.id,
          'hubspot',
          {
            externalId: contact.id,
            firstName: contact.properties.firstname?.value,
            lastName: contact.properties.lastname?.value,
            email: contact.properties.email?.value,
            phone: contact.properties.phone?.value,
            lifecycleStage: contact.properties.hs_lead_status?.value || 'lead',
            customFields: contact.properties,
          }
        );
        contactsSynced++;
      }

      // Fetch companies
      const companiesResponse = await this.httpClient.get(
        `${baseUrl}/crm/v3/objects/companies`,
        { headers, params: { limit: 100 } }
      );

      for (const company of companiesResponse.data.results) {
        await this.storeCompany(integration.id, 'hubspot', {
          externalId: company.id,
          name: company.properties.name?.value,
          website: company.properties.website?.value,
          industry: company.properties.industry?.value,
          customFields: company.properties,
        });
        companiesSynced++;
      }

      // Fetch deals
      const dealsResponse = await this.httpClient.get(
        `${baseUrl}/crm/v3/objects/deals`,
        { headers, params: { limit: 100 } }
      );

      for (const deal of dealsResponse.data.results) {
        await this.storeDeal(integration.id, 'hubspot', {
          externalId: deal.id,
          name: deal.properties.dealname?.value,
          dealStage: deal.properties.dealstage?.value || 'negotiation',
          dealAmount: deal.properties.amount?.value,
          probability: deal.properties.probability?.value,
          customFields: deal.properties,
        });
        dealsSynced++;
      }
    } catch (error) {
      throw new Error(
        `HubSpot sync failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    return { contactsSynced, companiesSynced, dealsSynced };
  }

  // ==================== SALESFORCE SYNC ====================

  private async syncSalesforce(
    integration: CRMIntegration
  ): Promise<{ contactsSynced: number; companiesSynced: number; dealsSynced: number }> {
    // Similar pattern to HubSpot
    // Use Salesforce REST API endpoints
    const contactsSynced = 0;
    const companiesSynced = 0;
    const dealsSynced = 0;

    // TODO: Implement Salesforce-specific sync logic

    return { contactsSynced, companiesSynced, dealsSynced };
  }

  // ==================== PIPEDRIVE SYNC ====================

  private async syncPipedrive(
    integration: CRMIntegration
  ): Promise<{ contactsSynced: number; companiesSynced: number; dealsSynced: number }> {
    // Similar pattern to HubSpot
    // Use Pipedrive REST API endpoints
    const contactsSynced = 0;
    const companiesSynced = 0;
    const dealsSynced = 0;

    // TODO: Implement Pipedrive-specific sync logic

    return { contactsSynced, companiesSynced, dealsSynced };
  }

  // ==================== DATA STORAGE ====================

  /**
   * Store contact in Pulse
   */
  private async storeContact(
    crmId: string,
    platform: CRMPlatform,
    data: Partial<CRMContact>
  ): Promise<void> {
    await this.supabase.from('crm_contacts').upsert(
      {
        crm_id: crmId,
        external_id: data.externalId,
        platform,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        title: data.title,
        lifecycle_stage: data.lifecycleStage || 'lead',
        custom_fields: data.customFields || {},
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'crm_id, external_id' }
    );
  }

  /**
   * Store company in Pulse
   */
  private async storeCompany(
    crmId: string,
    platform: CRMPlatform,
    data: Partial<CRMCompany>
  ): Promise<void> {
    await this.supabase.from('crm_companies').upsert(
      {
        crm_id: crmId,
        external_id: data.externalId,
        platform,
        name: data.name,
        website: data.website,
        industry: data.industry,
        employee_count: data.employeeCount,
        annual_revenue: data.annualRevenue,
        custom_fields: data.customFields || {},
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'crm_id, external_id' }
    );
  }

  /**
   * Store deal in Pulse
   */
  private async storeDeal(
    crmId: string,
    platform: CRMPlatform,
    data: Partial<CRMDeal>
  ): Promise<void> {
    await this.supabase.from('crm_deals').upsert(
      {
        crm_id: crmId,
        external_id: data.externalId,
        platform,
        name: data.name,
        deal_stage: data.dealStage || 'negotiation',
        deal_amount: data.dealAmount,
        probability: data.probability,
        is_closed: data.isClosed || false,
        is_won: data.isWon || false,
        custom_fields: data.customFields || {},
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'crm_id, external_id' }
    );
  }

  // ==================== SYNC UTILITIES ====================

  private async updateSyncStatus(
    crmId: string,
    status: 'idle' | 'syncing' | 'error',
    errorMessage?: string
  ): Promise<void> {
    await this.supabase
      .from('crm_integrations')
      .update({
        sync_status: status,
        sync_error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', crmId);
  }

  private async updateLastSyncTime(crmId: string): Promise<void> {
    await this.supabase
      .from('crm_integrations')
      .update({
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', crmId);
  }

  private async recordSyncLog(
    crmId: string,
    syncType: 'full' | 'incremental' | 'webhook',
    log: any
  ): Promise<void> {
    await this.supabase.from('crm_sync_logs').insert({
      crm_id: crmId,
      sync_type: syncType,
      contacts_synced: log.contactsSynced,
      companies_synced: log.companiesSynced,
      deals_synced: log.dealsSynced,
      status: log.status,
      error_message: log.errorMessage,
      completed_at: log.completedAt?.toISOString(),
      duration_seconds: log.durationSeconds,
    });
  }

  private async getIntegrationById(crmId: string): Promise<CRMIntegration | null> {
    const { data, error } = await this.supabase
      .from('crm_integrations')
      .select('*')
      .eq('id', crmId)
      .single();

    if (error) return null;
    return this.mapToCRMIntegration(data);
  }

  private mapToCRMIntegration(data: any): CRMIntegration {
    return {
      id: data.id,
      platform: data.platform,
      displayName: data.display_name,
      apiKey: data.api_key,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: data.token_expires_at
        ? new Date(data.token_expires_at)
        : undefined,
      workspaceId: data.workspace_id,
      isActive: data.is_active,
      syncEnabled: data.sync_enabled,
      webhookUrl: data.webhook_url,
      webhookSecret: data.webhook_secret,
      lastSyncAt: data.last_sync_at
        ? new Date(data.last_sync_at)
        : undefined,
      syncStatus: data.sync_status,
      syncErrorMessage: data.sync_error_message,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

export const crmService = new CRMService();
