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
    }
  }

  private async createHubSpotTask(integration: any, payload: CRMActionPayload) {
    // HubSpot task creation
    // POST https://api.hubapi.com/crm/v3/objects/tasks
    console.log('Creating HubSpot task:', payload);
    // TODO: Implement HubSpot task creation
  }

  private async createSalesforceTask(integration: any, payload: CRMActionPayload) {
    // Salesforce task creation
    console.log('Creating Salesforce task:', payload);
    // TODO: Implement Salesforce task creation
  }

  private async createPipedriveTask(integration: any, payload: CRMActionPayload) {
    // Pipedrive activity creation
    console.log('Creating Pipedrive task:', payload);
    // TODO: Implement Pipedrive task creation
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

  private async updateHubSpotDeal(
    integration: any,
    dealId: string,
    payload: CRMActionPayload
  ) {
    // PATCH https://api.hubapi.com/crm/v3/objects/deals/{dealId}
    console.log('Updating HubSpot deal:', dealId, payload);
    // TODO: Implement HubSpot deal update
  }

  private async updateSalesforceDeal(
    integration: any,
    dealId: string,
    payload: CRMActionPayload
  ) {
    // PATCH Salesforce opportunity
    console.log('Updating Salesforce deal:', dealId, payload);
    // TODO: Implement Salesforce deal update
  }

  private async updatePipedriveDeal(
    integration: any,
    dealId: string,
    payload: CRMActionPayload
  ) {
    // PUT https://api.pipedrive.com/v1/deals/{dealId}
    console.log('Updating Pipedrive deal:', dealId, payload);
    // TODO: Implement Pipedrive deal update
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
    }
  }

  private async logHubSpotCall(integration: any, payload: CRMActionPayload) {
    // Create task with call type in HubSpot
    console.log('Logging HubSpot call:', payload);
    // TODO: Implement HubSpot call logging
  }

  private async logSalesforceCall(integration: any, payload: CRMActionPayload) {
    // Create activity/event in Salesforce
    console.log('Logging Salesforce call:', payload);
    // TODO: Implement Salesforce call logging
  }

  private async logPipedriveCall(integration: any, payload: CRMActionPayload) {
    // Log activity in Pipedrive
    console.log('Logging Pipedrive call:', payload);
    // TODO: Implement Pipedrive call logging
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
    }
  }

  private async createHubSpotContact(integration: any, payload: CRMActionPayload) {
    // POST https://api.hubapi.com/crm/v3/objects/contacts
    console.log('Creating HubSpot contact:', payload);
    // TODO: Implement HubSpot contact creation
  }

  private async createSalesforceContact(integration: any, payload: CRMActionPayload) {
    // POST Salesforce Lead
    console.log('Creating Salesforce contact:', payload);
    // TODO: Implement Salesforce contact creation
  }

  private async createPipedriveContact(integration: any, payload: CRMActionPayload) {
    // POST https://api.pipedrive.com/v1/persons
    console.log('Creating Pipedrive contact:', payload);
    // TODO: Implement Pipedrive contact creation
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
