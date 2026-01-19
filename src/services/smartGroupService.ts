// ============================================
// SMART GROUPS SERVICE
// Auto-manage channel membership by CRM rules
// ============================================

import { supabase } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  SmartGroup,
  MembershipRules,
  SmartRule,
  CRMDeal,
  CRMContact,
  CRMCompany,
} from '../types/crmTypes';

/**
 * Smart Groups Service
 * Manages automatic group membership based on CRM data rules
 */
export class SmartGroupService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = supabase;
  }

  /**
   * Create smart group (auto-managed channel)
   */
  async createSmartGroup(
    channelId: string,
    channelName: string,
    crmId: string,
    membershipRules: MembershipRules,
    description?: string
  ): Promise<SmartGroup> {
    const groupData = {
      channel_id: channelId,
      channel_name: channelName,
      description,
      crm_id: crmId,
      membership_rules: membershipRules,
      member_contact_ids: [],
      member_user_ids: [],
      is_active: true,
      auto_sync_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('smart_groups')
      .insert(groupData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create smart group: ${error.message}`);

    // Run initial sync
    await this.syncGroupMembership(data.id);

    return this.mapToSmartGroup(data);
  }

  /**
   * Sync group membership based on rules
   * This is called on schedule or when CRM data changes
   */
  async syncGroupMembership(groupId: string): Promise<void> {
    const group = await this.getSmartGroup(groupId);
    if (!group) throw new Error('Smart group not found');

    // Get all deals that match the rules
    const matchingDeals = await this.findMatchingDeals(
      group.crmId,
      group.membershipRules
    );

    // Extract contact IDs from matching deals
    const contactIds: Set<string> = new Set();
    for (const deal of matchingDeals) {
      deal.contactIds.forEach((id) => contactIds.add(id));
    }

    // Get Pulse users for these contacts
    const { data: contacts } = await this.supabase
      .from('crm_contacts')
      .select('pulse_user_id')
      .in('external_id', Array.from(contactIds));

    const userIds = (contacts || [])
      .filter((c) => c.pulse_user_id)
      .map((c) => c.pulse_user_id);

    // Update group membership
    await this.supabase
      .from('smart_groups')
      .update({
        member_contact_ids: Array.from(contactIds),
        member_user_ids: userIds,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', groupId);

    // Trigger channel membership updates (actual channel sync logic here)
    await this.updateChannelMembers(group.channelId, userIds);
  }

  /**
   * Find deals matching membership rules
   */
  private async findMatchingDeals(
    crmId: string,
    rules: MembershipRules
  ): Promise<CRMDeal[]> {
    // Build query based on rules
    let query = this.supabase
      .from('crm_deals')
      .select('*')
      .eq('crm_id', crmId);

    // Apply each rule
    for (const rule of rules.rules) {
      query = this.applyRuleToQuery(query, rule);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch deals: ${error.message}`);

    return (data || []).map((d) => ({
      id: d.id,
      crmId: d.crm_id,
      externalId: d.external_id,
      platform: d.platform,
      name: d.name,
      dealStage: d.deal_stage,
      dealAmount: d.deal_amount,
      currency: d.currency,
      closeDate: d.close_date ? new Date(d.close_date) : undefined,
      createdDate: d.created_date ? new Date(d.created_date) : undefined,
      contactIds: d.contact_ids || [],
      companyId: d.company_id,
      companyName: d.company_name,
      ownerId: d.owner_id,
      ownerName: d.owner_name,
      probability: d.probability,
      isClosed: d.is_closed,
      isWon: d.is_won,
      linkedChatId: d.linked_chat_id,
      linkedChannelId: d.linked_channel_id,
      customFields: d.custom_fields || {},
      lastUpdatedAt: d.last_updated_at
        ? new Date(d.last_updated_at)
        : undefined,
      syncedAt: new Date(d.synced_at),
    }));
  }

  /**
   * Apply a single rule to a query
   * Example: { field: 'deal_stage', operator: 'eq', value: 'Negotiation' }
   */
  private applyRuleToQuery(query: any, rule: SmartRule): any {
    switch (rule.operator) {
      case 'eq':
        return query.eq(this.fieldToColumn(rule.field), rule.value);
      case 'ne':
        return query.neq(this.fieldToColumn(rule.field), rule.value);
      case 'gt':
        return query.gt(this.fieldToColumn(rule.field), rule.value);
      case 'lt':
        return query.lt(this.fieldToColumn(rule.field), rule.value);
      case 'gte':
        return query.gte(this.fieldToColumn(rule.field), rule.value);
      case 'lte':
        return query.lte(this.fieldToColumn(rule.field), rule.value);
      case 'in':
        return query.in(this.fieldToColumn(rule.field), rule.value as string[]);
      case 'contains':
        return query.like(
          this.fieldToColumn(rule.field),
          `%${rule.value}%`
        );
      default:
        return query;
    }
  }

  /**
   * Convert field name to database column name
   */
  private fieldToColumn(field: string): string {
    // Convert camelCase to snake_case
    return field.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  /**
   * Update actual channel membership
   * This would call your Pulse chat API to add/remove members
   */
  private async updateChannelMembers(
    channelId: string,
    userIds: string[]
  ): Promise<void> {
    // TODO: Integrate with Pulse chat API to update channel membership
    console.log(`Updating channel ${channelId} with members:`, userIds);
  }

  /**
   * Get smart group
   */
  async getSmartGroup(groupId: string): Promise<SmartGroup | null> {
    const { data, error } = await this.supabase
      .from('smart_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error) return null;
    return this.mapToSmartGroup(data);
  }

  /**
   * List all smart groups for a CRM
   */
  async listSmartGroups(crmId: string): Promise<SmartGroup[]> {
    const { data, error } = await this.supabase
      .from('smart_groups')
      .select('*')
      .eq('crm_id', crmId)
      .eq('is_active', true);

    if (error) throw new Error(`Failed to list smart groups: ${error.message}`);

    return (data || []).map((d) => this.mapToSmartGroup(d));
  }

  /**
   * Update smart group rules
   */
  async updateSmartGroupRules(
    groupId: string,
    rules: MembershipRules
  ): Promise<void> {
    await this.supabase
      .from('smart_groups')
      .update({
        membership_rules: rules,
        updated_at: new Date().toISOString(),
      })
      .eq('id', groupId);

    // Re-sync membership
    await this.syncGroupMembership(groupId);
  }

  /**
   * Delete smart group
   */
  async deleteSmartGroup(groupId: string): Promise<void> {
    await this.supabase.from('smart_groups').delete().eq('id', groupId);
  }

  private mapToSmartGroup(data: any): SmartGroup {
    return {
      id: data.id,
      channelId: data.channel_id,
      channelName: data.channel_name,
      description: data.description,
      crmId: data.crm_id,
      membershipRules: data.membership_rules,
      memberContactIds: data.member_contact_ids || [],
      memberUserIds: data.member_user_ids || [],
      isActive: data.is_active,
      autoSyncEnabled: data.auto_sync_enabled,
      lastSyncAt: data.last_sync_at
        ? new Date(data.last_sync_at)
        : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

export const smartGroupService = new SmartGroupService();
