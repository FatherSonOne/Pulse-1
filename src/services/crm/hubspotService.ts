// ============================================
// HUBSPOT CRM SERVICE
// Complete implementation for HubSpot API operations
// ============================================

import axios, { AxiosInstance } from 'axios';
import { CRMIntegration, CRMActionPayload } from '../../types/crmTypes';
import { getValidAccessToken } from './oauthHelper';
import { withCRMRetry, CRMError, parseCRMError } from './retryHelper';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';

export class HubSpotService {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      baseURL: HUBSPOT_API_BASE,
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

  // ==================== TASK OPERATIONS ====================

  /**
   * Create task in HubSpot
   */
  async createTask(
    integration: CRMIntegration,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);

        const taskData: any = {
          properties: {
            hs_task_subject: payload.fields?.title || payload.title || 'New Task',
            hs_task_body: payload.fields?.description || payload.description || '',
            hs_task_priority: this.mapPriority(payload.fields?.priority),
            hs_task_status: 'NOT_STARTED',
            hs_task_type: 'TODO',
          },
        };

        // Add due date if provided
        if (payload.fields?.dueDate || payload.dueDate) {
          const dueDate = payload.fields?.dueDate || payload.dueDate;
          taskData.properties.hs_timestamp = new Date(dueDate).getTime();
        }

        // Add associations (link to contact, deal, company)
        if (payload.associatedRecordId) {
          taskData.associations = [
            {
              to: { id: payload.associatedRecordId },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED',
                  associationTypeId: this.getAssociationTypeId(
                    payload.associatedRecordType || 'contact'
                  ),
                },
              ],
            },
          ];
        }

        try {
          const response = await this.httpClient.post(
            '/crm/v3/objects/tasks',
            taskData,
            { headers }
          );
          return response.data;
        } catch (error: any) {
          throw new CRMError(
            'HubSpot',
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
   * Update deal in HubSpot
   */
  async updateDeal(
    integration: CRMIntegration,
    dealId: string,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);

        const properties: any = {};

        // Map common deal fields
        if (payload.fields?.stage) {
          properties.dealstage = payload.fields.stage;
        }
        if (payload.fields?.amount !== undefined) {
          properties.amount = payload.fields.amount;
        }
        if (payload.fields?.closeDate) {
          properties.closedate = new Date(payload.fields.closeDate)
            .toISOString()
            .split('T')[0];
        }
        if (payload.fields?.dealName) {
          properties.dealname = payload.fields.dealName;
        }
        if (payload.fields?.probability !== undefined) {
          properties.hs_deal_stage_probability = payload.fields.probability;
        }

        // Add custom fields
        if (payload.fields?.customFields) {
          Object.assign(properties, payload.fields.customFields);
        }

        try {
          const response = await this.httpClient.patch(
            `/crm/v3/objects/deals/${dealId}`,
            { properties },
            { headers }
          );
          return response.data;
        } catch (error: any) {
          throw new CRMError(
            'HubSpot',
            'updateDeal',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  /**
   * Log call engagement in HubSpot
   */
  async logCall(
    integration: CRMIntegration,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);

        const callData: any = {
          properties: {
            hs_call_title: payload.fields?.title || payload.title || 'Call',
            hs_call_body: payload.fields?.notes || payload.notes || '',
            hs_call_duration:
              payload.fields?.duration || payload.duration || 0,
            hs_call_status: 'COMPLETED',
            hs_timestamp: payload.fields?.callTime
              ? new Date(payload.fields.callTime).getTime()
              : Date.now(),
          },
        };

        // Add call outcome
        if (payload.fields?.outcome) {
          callData.properties.hs_call_disposition = payload.fields.outcome;
        }

        // Add associations
        if (payload.associatedRecordId) {
          callData.associations = [
            {
              to: { id: payload.associatedRecordId },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED',
                  associationTypeId: this.getAssociationTypeId(
                    payload.associatedRecordType || 'contact'
                  ),
                },
              ],
            },
          ];
        }

        try {
          const response = await this.httpClient.post(
            '/crm/v3/objects/calls',
            callData,
            { headers }
          );
          return response.data;
        } catch (error: any) {
          throw new CRMError(
            'HubSpot',
            'logCall',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  /**
   * Create contact in HubSpot
   */
  async createContact(
    integration: CRMIntegration,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);

        const properties: any = {};

        // Map standard contact fields
        if (payload.fields?.email) properties.email = payload.fields.email;
        if (payload.fields?.firstName) properties.firstname = payload.fields.firstName;
        if (payload.fields?.lastName) properties.lastname = payload.fields.lastName;
        if (payload.fields?.phone) properties.phone = payload.fields.phone;
        if (payload.fields?.company) properties.company = payload.fields.company;
        if (payload.fields?.jobTitle) properties.jobtitle = payload.fields.jobTitle;
        if (payload.fields?.website) properties.website = payload.fields.website;
        if (payload.fields?.lifecycleStage) {
          properties.lifecyclestage = payload.fields.lifecycleStage;
        }

        // Add custom fields
        if (payload.fields?.customFields) {
          Object.assign(properties, payload.fields.customFields);
        }

        const contactData: any = { properties };

        // Associate with company if provided
        if (payload.fields?.companyId) {
          contactData.associations = [
            {
              to: { id: payload.fields.companyId },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED',
                  associationTypeId: 280, // Contact to Company association
                },
              ],
            },
          ];
        }

        try {
          const response = await this.httpClient.post(
            '/crm/v3/objects/contacts',
            contactData,
            { headers }
          );
          return response.data;
        } catch (error: any) {
          throw new CRMError(
            'HubSpot',
            'createContact',
            error.response?.status,
            parseCRMError(error)
          );
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

        try {
          const response = await this.httpClient.get(
            `/crm/v3/objects/contacts/${contactId}`,
            { headers }
          );
          return response.data;
        } catch (error: any) {
          throw new CRMError(
            'HubSpot',
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
   * Get deal by ID
   */
  async getDeal(integration: CRMIntegration, dealId: string): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);

        try {
          const response = await this.httpClient.get(
            `/crm/v3/objects/deals/${dealId}`,
            { headers }
          );
          return response.data;
        } catch (error: any) {
          throw new CRMError(
            'HubSpot',
            'getDeal',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  /**
   * Search contacts by email
   */
  async searchContactByEmail(
    integration: CRMIntegration,
    email: string
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);

        const searchPayload = {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'email',
                  operator: 'EQ',
                  value: email,
                },
              ],
            },
          ],
        };

        try {
          const response = await this.httpClient.post(
            '/crm/v3/objects/contacts/search',
            searchPayload,
            { headers }
          );
          return response.data.results[0] || null;
        } catch (error: any) {
          throw new CRMError(
            'HubSpot',
            'searchContactByEmail',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Map priority to HubSpot format
   */
  private mapPriority(priority?: string): string {
    if (!priority) return 'MEDIUM';

    const priorityMap: Record<string, string> = {
      low: 'LOW',
      medium: 'MEDIUM',
      high: 'HIGH',
      urgent: 'HIGH',
    };

    return priorityMap[priority.toLowerCase()] || 'MEDIUM';
  }

  /**
   * Get HubSpot association type ID
   * https://developers.hubspot.com/docs/api/crm/associations
   */
  private getAssociationTypeId(recordType: string): number {
    const associationMap: Record<string, number> = {
      contact: 204, // Task to Contact
      deal: 216, // Task to Deal
      company: 192, // Task to Company
      ticket: 228, // Task to Ticket
    };

    return associationMap[recordType.toLowerCase()] || 204;
  }
}

export const hubspotService = new HubSpotService();
