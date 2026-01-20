// ============================================
// CRM ACTIONS SERVICE
// Convert messages to CRM operations
// ============================================

import { supabase } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  CRMAction,
  CRMActionPayload,
  CRMActionType,
  CRMIntegration,
} from '../types/crmTypes';
import { crmService } from './crmService';

/**
 * CRM Actions Service
 * Manages message-to-CRM workflows
 */
export class CRMActionsService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = supabase;
  }

  /**
   * Create CRM action (task, update deal, log call, etc.)
   */
  async createAction(
    actionType: CRMActionType,
    crmId: string,
    targetExternalId: string,
    payload: CRMActionPayload,
    triggeredByUserId: string,
    context?: {
      chatId?: string;
      messageId?: string;
      templateName?: string;
    }
  ): Promise<CRMAction> {
    const actionData = {
      id: `action-${uuidv4()}`,
      action_type: actionType,
      template_name: context?.templateName,
      crm_id: crmId,
      target_external_id: targetExternalId,
      action_payload: payload,
      triggered_by_user_id: triggeredByUserId,
      triggered_in_chat_id: context?.chatId,
      triggered_by_message_id: context?.messageId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('crm_actions')
      .insert(actionData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create action: ${error.message}`);

    // Execute the action
    await this.executeAction(data.id);

    return this.mapToCRMAction(data);
  }

  /**
   * Execute CRM action
   */
  async executeAction(actionId: string): Promise<void> {
    // Get action
    const { data: actionData, error: fetchError } = await this.supabase
      .from('crm_actions')
      .select('*')
      .eq('id', actionId)
      .single();

    if (fetchError) throw new Error('Action not found');

    const action = actionData;

    // Get integration
    const { data: integrationData } = await this.supabase
      .from('crm_integrations')
      .select('*')
      .eq('id', action.crm_id)
      .single();

    if (!integrationData) throw new Error('Integration not found');

    try {
      // Update status
      await this.updateActionStatus(actionId, 'executing');

      // Execute based on action type and platform
      switch (action.action_type) {
        case 'create_task':
          await this.executeCreateTask(integrationData, action);
          break;
        case 'update_deal':
          await this.executeUpdateDeal(integrationData, action);
          break;
        case 'log_call':
          await this.executeLogCall(integrationData, action);
          break;
        case 'create_contact':
          await this.executeCreateContact(integrationData, action);
          break;
      }

      // Mark as completed
      await this.updateActionStatus(actionId, 'completed');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.updateActionStatus(actionId, 'failed', errorMessage);
      throw error;
    }
  }

  /**
   * Create task in CRM
   */
  private async executeCreateTask(
    integration: any,
    action: any
  ): Promise<void> {
    const payload = action.action_payload;

    switch (integration.platform) {
      case 'hubspot':
        await this.createHubSpotTask(integration, payload);
        break;
      case 'salesforce':
        await this.createSalesforceTask(integration, payload);
        break;
      case 'pipedrive':
        await this.createPipedriveTask(integration, payload);
        break;
      case 'zoho':
        await this.createZohoTask(integration, payload);
        break;
    }
  }

  private async createZohoTask(integration: any, payload: CRMActionPayload) {
    const { zohoService } = await import('./crm/zohoService');
    return await zohoService.createTask(integration, payload);
  }

  private async createHubSpotTask(integration: any, payload: CRMActionPayload) {
    const { hubspotService } = await import('./crm/hubspotService');
    return await hubspotService.createTask(integration, payload);
  }

  private async createSalesforceTask(integration: any, payload: CRMActionPayload) {
    const { salesforceService } = await import('./crm/salesforceService');
    return await salesforceService.createTask(integration, payload);
  }

  private async createPipedriveTask(integration: any, payload: CRMActionPayload) {
    const { pipedriveService } = await import('./crm/pipedriveService');
    return await pipedriveService.createActivity(integration, payload);
  }

  /**
   * Update deal in CRM
   */
  private async executeUpdateDeal(
    integration: any,
    action: any
  ): Promise<void> {
    const payload = action.action_payload;
    const dealExternalId = action.target_external_id;

    switch (integration.platform) {
      case 'hubspot':
        await this.updateHubSpotDeal(integration, dealExternalId, payload);
        break;
      case 'salesforce':
        await this.updateSalesforceDeal(integration, dealExternalId, payload);
        break;
      case 'pipedrive':
        await this.updatePipedriveDeal(integration, dealExternalId, payload);
        break;
      case 'zoho':
        await this.updateZohoDeal(integration, dealExternalId, payload);
        break;
    }

    // Update local cache
    await this.supabase
      .from('crm_deals')
      .update({
        deal_stage: payload.fields?.stage,
        deal_amount: payload.fields?.amount,
        last_updated_at: new Date().toISOString(),
      })
      .eq('external_id', dealExternalId)
      .eq('crm_id', integration.id);
  }

  private async updateZohoDeal(
    integration: any,
    dealId: string,
    payload: CRMActionPayload
  ) {
    const { zohoService } = await import('./crm/zohoService');
    return await zohoService.updateDeal(integration, dealId, payload);
  }

  private async updateHubSpotDeal(
    integration: any,
    dealId: string,
    payload: CRMActionPayload
  ) {
    const { hubspotService } = await import('./crm/hubspotService');
    return await hubspotService.updateDeal(integration, dealId, payload);
  }

  private async updateSalesforceDeal(
    integration: any,
    dealId: string,
    payload: CRMActionPayload
  ) {
    const { salesforceService } = await import('./crm/salesforceService');
    return await salesforceService.updateOpportunity(integration, dealId, payload);
  }

  private async updatePipedriveDeal(
    integration: any,
    dealId: string,
    payload: CRMActionPayload
  ) {
    const { pipedriveService } = await import('./crm/pipedriveService');
    return await pipedriveService.updateDeal(integration, dealId, payload);
  }

  /**
   * Log call in CRM
   */
  private async executeLogCall(
    integration: any,
    action: any
  ): Promise<void> {
    const payload = action.action_payload;

    switch (integration.platform) {
      case 'hubspot':
        await this.logHubSpotCall(integration, payload);
        break;
      case 'salesforce':
        await this.logSalesforceCall(integration, payload);
        break;
      case 'pipedrive':
        await this.logPipedriveCall(integration, payload);
        break;
      case 'zoho':
        await this.logZohoCall(integration, payload);
        break;
    }
  }

  private async logZohoCall(integration: any, payload: CRMActionPayload) {
    const { zohoService } = await import('./crm/zohoService');
    return await zohoService.logCall(integration, payload);
  }

  private async logHubSpotCall(integration: any, payload: CRMActionPayload) {
    const { hubspotService } = await import('./crm/hubspotService');
    return await hubspotService.logCall(integration, payload);
  }

  private async logSalesforceCall(integration: any, payload: CRMActionPayload) {
    const { salesforceService } = await import('./crm/salesforceService');
    return await salesforceService.logActivity(integration, payload);
  }

  private async logPipedriveCall(integration: any, payload: CRMActionPayload) {
    const { pipedriveService } = await import('./crm/pipedriveService');
    return await pipedriveService.createActivity(integration, {
      ...payload,
      fields: { ...payload.fields, activityType: 'call' }
    });
  }

  /**
   * Create contact in CRM
   */
  private async executeCreateContact(
    integration: any,
    action: any
  ): Promise<void> {
    const payload = action.action_payload;

    switch (integration.platform) {
      case 'hubspot':
        await this.createHubSpotContact(integration, payload);
        break;
      case 'salesforce':
        await this.createSalesforceContact(integration, payload);
        break;
      case 'pipedrive':
        await this.createPipedriveContact(integration, payload);
        break;
      case 'zoho':
        await this.createZohoContact(integration, payload);
        break;
    }
  }

  private async createZohoContact(integration: any, payload: CRMActionPayload) {
    const { zohoService } = await import('./crm/zohoService');
    return await zohoService.createContact(integration, payload);
  }

  private async createHubSpotContact(integration: any, payload: CRMActionPayload) {
    const { hubspotService } = await import('./crm/hubspotService');
    return await hubspotService.createContact(integration, payload);
  }

  private async createSalesforceContact(integration: any, payload: CRMActionPayload) {
    const { salesforceService } = await import('./crm/salesforceService');
    return await salesforceService.createContact(integration, payload);
  }

  private async createPipedriveContact(integration: any, payload: CRMActionPayload) {
    const { pipedriveService } = await import('./crm/pipedriveService');
    return await pipedriveService.createPerson(integration, payload);
  }

  // ==================== UTILITIES ====================

  /**
   * Get action
   */
  async getAction(actionId: string): Promise<CRMAction | null> {
    const { data, error } = await this.supabase
      .from('crm_actions')
      .select('*')
      .eq('id', actionId)
      .single();

    if (error) return null;
    return this.mapToCRMAction(data);
  }

  /**
   * List actions by chat
   */
  async listActionsByChat(chatId: string): Promise<CRMAction[]> {
    const { data, error } = await this.supabase
      .from('crm_actions')
      .select('*')
      .eq('triggered_in_chat_id', chatId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list actions: ${error.message}`);

    return (data || []).map((d) => this.mapToCRMAction(d));
  }

  private async updateActionStatus(
    actionId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      updateData.executed_at = new Date().toISOString();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    await this.supabase
      .from('crm_actions')
      .update(updateData)
      .eq('id', actionId);
  }

  private mapToCRMAction(data: any): CRMAction {
    return {
      id: data.id,
      actionType: data.action_type,
      templateName: data.template_name,
      crmId: data.crm_id,
      targetExternalId: data.target_external_id,
      actionPayload: data.action_payload,
      triggeredByUserId: data.triggered_by_user_id,
      triggeredInChatId: data.triggered_in_chat_id,
      triggeredByMessageId: data.triggered_by_message_id,
      status: data.status,
      errorMessage: data.error_message,
      executedAt: data.executed_at
        ? new Date(data.executed_at)
        : undefined,
      createdAt: new Date(data.created_at),
    };
  }
}

export const crmActionsService = new CRMActionsService();
