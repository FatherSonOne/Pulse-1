// ============================================
// SALESFORCE CRM SERVICE
// Complete implementation for Salesforce API operations
// ============================================

import axios, { AxiosInstance } from 'axios';
import { CRMIntegration, CRMActionPayload } from '../../types/crmTypes';
import { getValidAccessToken } from './oauthHelper';
import { withCRMRetry, CRMError, parseCRMError } from './retryHelper';

export class SalesforceService {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      timeout: 30000,
    });
  }

  /**
   * Create authenticated headers
   */
  private async getHeaders(integration: CRMIntegration): Promise<Record<string, string>> {
    const accessToken = await getValidAccessToken(integration);
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get Salesforce API base URL
   */
  private getApiBase(integration: CRMIntegration): string {
    // instance_url is returned during OAuth and stored in integration
    const instanceUrl =
      (integration as any).instance_url || 'https://login.salesforce.com';
    return `${instanceUrl}/services/data/v58.0`;
  }

  // ==================== TASK OPERATIONS ====================

  /**
   * Create task in Salesforce
   */
  async createTask(
    integration: CRMIntegration,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);
        const baseUrl = this.getApiBase(integration);

        const taskData: any = {
          Subject: payload.fields?.title || payload.title || 'New Task',
          Description: payload.fields?.description || payload.description || '',
          Priority: this.mapPriority(payload.fields?.priority),
          Status: 'Not Started',
          TaskSubtype: 'Task',
        };

        // Add due date
        if (payload.fields?.dueDate || payload.dueDate) {
          const dueDate = new Date(payload.fields?.dueDate || payload.dueDate);
          taskData.ActivityDate = dueDate.toISOString().split('T')[0];
        }

        // Associate with contact/lead (WhoId)
        if (payload.associatedRecordId && payload.associatedRecordType === 'contact') {
          taskData.WhoId = payload.associatedRecordId;
        }

        // Associate with opportunity/account (WhatId)
        if (
          payload.associatedRecordId &&
          (payload.associatedRecordType === 'opportunity' ||
            payload.associatedRecordType === 'deal')
        ) {
          taskData.WhatId = payload.associatedRecordId;
        }

        try {
          const response = await this.httpClient.post(
            `${baseUrl}/sobjects/Task`,
            taskData,
            { headers }
          );
          return response.data;
        } catch (error: any) {
          throw new CRMError(
            'Salesforce',
            'createTask',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  /**
   * Update opportunity in Salesforce
   */
  async updateOpportunity(
    integration: CRMIntegration,
    opportunityId: string,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);
        const baseUrl = this.getApiBase(integration);

        const updateData: any = {};

        // Map common opportunity fields
        if (payload.fields?.stage) {
          updateData.StageName = payload.fields.stage;
        }
        if (payload.fields?.amount !== undefined) {
          updateData.Amount = payload.fields.amount;
        }
        if (payload.fields?.closeDate) {
          updateData.CloseDate = new Date(payload.fields.closeDate)
            .toISOString()
            .split('T')[0];
        }
        if (payload.fields?.dealName) {
          updateData.Name = payload.fields.dealName;
        }
        if (payload.fields?.probability !== undefined) {
          updateData.Probability = payload.fields.probability;
        }
        if (payload.fields?.description) {
          updateData.Description = payload.fields.description;
        }

        // Add custom fields
        if (payload.fields?.customFields) {
          Object.assign(updateData, payload.fields.customFields);
        }

        try {
          const response = await this.httpClient.patch(
            `${baseUrl}/sobjects/Opportunity/${opportunityId}`,
            updateData,
            { headers }
          );
          return response.data;
        } catch (error: any) {
          throw new CRMError(
            'Salesforce',
            'updateOpportunity',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  /**
   * Log activity (call/email/meeting) in Salesforce
   */
  async logActivity(
    integration: CRMIntegration,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);
        const baseUrl = this.getApiBase(integration);

        const activityType = payload.fields?.activityType || 'Call';

        // Create Event (for meetings) or Task (for calls/emails)
        const isEvent = activityType.toLowerCase() === 'meeting';

        const activityData: any = {
          Subject: payload.fields?.title || payload.title || activityType,
          Description: payload.fields?.notes || payload.notes || '',
          Status: 'Completed',
        };

        if (isEvent) {
          // Event-specific fields
          activityData.StartDateTime = payload.fields?.startTime
            ? new Date(payload.fields.startTime).toISOString()
            : new Date().toISOString();
          activityData.EndDateTime = payload.fields?.endTime
            ? new Date(payload.fields.endTime).toISOString()
            : new Date(Date.now() + 3600000).toISOString(); // +1 hour default
          activityData.IsAllDayEvent = payload.fields?.allDay || false;
        } else {
          // Task-specific fields
          activityData.ActivityDate = new Date().toISOString().split('T')[0];
          activityData.TaskSubtype = activityType;
          if (payload.fields?.duration) {
            activityData.CallDurationInSeconds = payload.fields.duration;
          }
        }

        // Associate with contact/lead
        if (payload.associatedRecordId && payload.associatedRecordType === 'contact') {
          activityData.WhoId = payload.associatedRecordId;
        }

        // Associate with opportunity
        if (
          payload.associatedRecordId &&
          (payload.associatedRecordType === 'opportunity' ||
            payload.associatedRecordType === 'deal')
        ) {
          activityData.WhatId = payload.associatedRecordId;
        }

        try {
          const endpoint = isEvent ? 'Event' : 'Task';
          const response = await this.httpClient.post(
            `${baseUrl}/sobjects/${endpoint}`,
            activityData,
            { headers }
          );
          return response.data;
        } catch (error: any) {
          throw new CRMError(
            'Salesforce',
            'logActivity',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  /**
   * Create contact or lead in Salesforce
   */
  async createContact(
    integration: CRMIntegration,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);
        const baseUrl = this.getApiBase(integration);

        // Determine if creating Contact or Lead
        const isLead =
          payload.fields?.recordType === 'lead' ||
          payload.fields?.lifecycleStage === 'lead';

        const recordData: any = {};

        // Common fields
        if (payload.fields?.firstName) recordData.FirstName = payload.fields.firstName;
        if (payload.fields?.lastName) recordData.LastName = payload.fields.lastName;
        if (payload.fields?.email) recordData.Email = payload.fields.email;
        if (payload.fields?.phone) recordData.Phone = payload.fields.phone;
        if (payload.fields?.company) recordData.Company = payload.fields.company;
        if (payload.fields?.jobTitle) recordData.Title = payload.fields.jobTitle;

        if (isLead) {
          // Lead-specific fields
          recordData.LastName = recordData.LastName || 'Unknown'; // Required
          recordData.Company = recordData.Company || 'Unknown'; // Required
          recordData.Status = payload.fields?.status || 'Open - Not Contacted';
          if (payload.fields?.leadSource) {
            recordData.LeadSource = payload.fields.leadSource;
          }

          try {
            const response = await this.httpClient.post(
              `${baseUrl}/sobjects/Lead`,
              recordData,
              { headers }
            );
            return response.data;
          } catch (error: any) {
            throw new CRMError(
              'Salesforce',
              'createLead',
              error.response?.status,
              parseCRMError(error)
            );
          }
        } else {
          // Contact-specific fields
          recordData.LastName = recordData.LastName || 'Unknown'; // Required

          // Associate with Account if provided
          if (payload.fields?.accountId) {
            recordData.AccountId = payload.fields.accountId;
          }

          // Add custom fields
          if (payload.fields?.customFields) {
            Object.assign(recordData, payload.fields.customFields);
          }

          try {
            const response = await this.httpClient.post(
              `${baseUrl}/sobjects/Contact`,
              recordData,
              { headers }
            );
            return response.data;
          } catch (error: any) {
            throw new CRMError(
              'Salesforce',
              'createContact',
              error.response?.status,
              parseCRMError(error)
            );
          }
        }
      },
      integration
    );
  }

  // ==================== READ OPERATIONS ====================

  /**
   * Get contact by ID
   */
  async getContact(integration: CRMIntegration, contactId: string): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);
        const baseUrl = this.getApiBase(integration);

        try {
          const response = await this.httpClient.get(
            `${baseUrl}/sobjects/Contact/${contactId}`,
            { headers }
          );
          return response.data;
        } catch (error: any) {
          throw new CRMError(
            'Salesforce',
            'getContact',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  /**
   * Get opportunity by ID
   */
  async getOpportunity(
    integration: CRMIntegration,
    opportunityId: string
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);
        const baseUrl = this.getApiBase(integration);

        try {
          const response = await this.httpClient.get(
            `${baseUrl}/sobjects/Opportunity/${opportunityId}`,
            { headers }
          );
          return response.data;
        } catch (error: any) {
          throw new CRMError(
            'Salesforce',
            'getOpportunity',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  /**
   * Search records using SOQL
   */
  async searchRecords(
    integration: CRMIntegration,
    soqlQuery: string
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);
        const baseUrl = this.getApiBase(integration);

        try {
          const response = await this.httpClient.get(`${baseUrl}/query`, {
            headers,
            params: { q: soqlQuery },
          });
          return response.data;
        } catch (error: any) {
          throw new CRMError(
            'Salesforce',
            'searchRecords',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  /**
   * Search contact by email
   */
  async searchContactByEmail(
    integration: CRMIntegration,
    email: string
  ): Promise<any> {
    const query = `SELECT Id, FirstName, LastName, Email, Phone, Title FROM Contact WHERE Email = '${email}' LIMIT 1`;
    const result = await this.searchRecords(integration, query);
    return result.records[0] || null;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Map priority to Salesforce format
   */
  private mapPriority(priority?: string): string {
    if (!priority) return 'Normal';

    const priorityMap: Record<string, string> = {
      low: 'Low',
      medium: 'Normal',
      high: 'High',
      urgent: 'High',
    };

    return priorityMap[priority.toLowerCase()] || 'Normal';
  }
}

export const salesforceService = new SalesforceService();
