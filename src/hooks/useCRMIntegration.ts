// ============================================
// useCRMIntegration CUSTOM HOOK
// Main orchestrator for CRM features
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  CRMIntegration,
  CRMDeal,
  CRMContact,
  CRMCompany,
  SmartGroup,
  SyncStatus,
} from '../types/crmTypes';
import { crmService } from '../services/crmService';
import { smartGroupService } from '../services/smartGroupService';
import { crmActionsService } from '../services/crmActionsService';

/**
 * useCRMIntegration Hook
 * Main hook for CRM integration features
 */
export const useCRMIntegration = () => {
  const [integration, setIntegration] = useState<CRMIntegration | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ==================== INITIALIZATION ====================

  useEffect(() => {
    loadIntegration();
  }, []);

  const loadIntegration = async () => {
    try {
      setIsLoading(true);
      // Check for any active CRM integration
      // In real app, user would select which CRM to use
      const hubspot = await crmService.getIntegration('hubspot');
      if (hubspot) {
        setIntegration(hubspot);
        updateSyncStatus(hubspot.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CRM');
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== SYNC ====================

  const updateSyncStatus = useCallback(async (crmId: string) => {
    try {
      // You would fetch actual sync status from database
      setSyncStatus({
        platform: 'hubspot',
        lastSyncAt: new Date(),
        messageCount: 0,
        status: 'idle',
        contactsCount: 0,
        companiesCount: 0,
        dealsCount: 0,
      });
    } catch (err) {
      setError('Failed to update sync status');
    }
  }, []);

  const triggerFullSync = useCallback(async () => {
    if (!integration) return;

    try {
      setIsLoading(true);
      const result = await crmService.fullSync(integration.id);
      updateSyncStatus(integration.id);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsLoading(false);
    }
  }, [integration, updateSyncStatus]);

  // ==================== SMART GROUPS ====================

  const createSmartGroup = useCallback(
    async (
      channelId: string,
      channelName: string,
      rules: any,
      description?: string
    ) => {
      if (!integration) throw new Error('No CRM integration');

      try {
        const group = await smartGroupService.createSmartGroup(
          channelId,
          channelName,
          integration.id,
          rules,
          description
        );
        return group;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create group');
      }
    },
    [integration]
  );

  const listSmartGroups = useCallback(async () => {
    if (!integration) return [];

    try {
      return await smartGroupService.listSmartGroups(integration.id);
    } catch (err) {
      setError('Failed to list smart groups');
      return [];
    }
  }, [integration]);

  const syncSmartGroup = useCallback(async (groupId: string) => {
    try {
      await smartGroupService.syncGroupMembership(groupId);
    } catch (err) {
      setError('Failed to sync group membership');
    }
  }, []);

  // ==================== CRM ACTIONS ====================

  const executeAction = useCallback(
    async (
      actionType: any,
      targetExternalId: string,
      payload: any,
      context?: any
    ) => {
      if (!integration) throw new Error('No CRM integration');

      try {
        setIsLoading(true);
        const action = await crmActionsService.createAction(
          actionType,
          integration.id,
          targetExternalId,
          payload,
          '', // Current user ID
          context
        );
        return action;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setIsLoading(false);
      }
    },
    [integration]
  );

  return {
    // State
    integration,
    syncStatus,
    isLoading,
    error,

    // CRM Integration
    loadIntegration,

    // Sync
    triggerFullSync,

    // Smart Groups
    createSmartGroup,
    listSmartGroups,
    syncSmartGroup,

    // CRM Actions
    executeAction,
  };
};
