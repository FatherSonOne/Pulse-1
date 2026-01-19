// ============================================
// PIPEDRIVE CRM SERVICE
// Complete implementation for Pipedrive API operations
// ============================================

import axios, { AxiosInstance } from 'axios';
import { CRMIntegration, CRMActionPayload } from '../../types/crmTypes';
import { getValidAccessToken } from './oauthHelper';
import { withCRMRetry, CRMError, parseCRMError } from './retryHelper';

const PIPEDRIVE_API_BASE = 'https://api.pipedrive.com/v1';

export class PipedriveService {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      baseURL: PIPEDRIVE_API_BASE,
      timeout: 30000,
    });
  }

  /**
   * Get API token (Pipedrive can use API key or OAuth token)
   */
  private async getApiToken(integration: CRMIntegration): Promise<string> {
    // Pipedrive supports both API key and OAuth
    if (integration.accessToken) {
      return await getValidAccessToken(integration);
    }
    if (integration.apiKey) {
      return integration.apiKey;
    }
    throw new Error('No API token or key available for Pipedrive');
  }

  /**
   * Add auth parameter to request
   */
  private async addAuthParam(
    integration: CRMIntegration,
    params: Record<string, any> = {}
  ): Promise<Record<string, any>> {
    const token = await this.getApiToken(integration);
    return { ...params, api_token: token };
  }

  // ==================== ACTIVITY OPERATIONS ====================

  /**
   * Create activity (task/call/meeting) in Pipedrive
   */
  async createActivity(
    integration: CRMIntegration,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const params = await this.addAuthParam(integration);

        const activityData: any = {
          subject: payload.fields?.title || payload.title || 'New Activity',
          note: payload.fields?.description || payload.description || '',
          type: this.mapActivityType(payload.fields?.activityType || 'task'),
          done: 0,
        };

        // Add due date/time
        if (payload.fields?.dueDate || payload.dueDate) {
          const dueDate = new Date(payload.fields?.dueDate || payload.dueDate);
          activityData.due_date = dueDate.toISOString().split('T')[0];
          activityData.due_time = dueDate.toTimeString().slice(0, 5);
        }

        // Add duration (in minutes)
        if (payload.fields?.duration) {
          activityData.duration =
            typeof payload.fields.duration === 'number'
              ? Math.floor(payload.fields.duration / 60)
              : payload.fields.duration;
        }

        // Associate with deal
        if (payload.associatedRecordId && payload.associatedRecordType === 'deal') {
          activityData.deal_id = parseInt(payload.associatedRecordId, 10);
        }

        // Associate with person (contact)
        if (payload.fields?.contactId || payload.fields?.personId) {
          activityData.person_id = parseInt(
            payload.fields?.contactId || payload.fields?.personId,
            10
          );
        }

        // Associate with organization (company)
        if (payload.fields?.organizationId) {
          activityData.org_id = parseInt(payload.fields.organizationId, 10);
        }

        try {
          const response = await this.httpClient.post('/activities', activityData, {
            params,
          });

          if (!response.data.success) {
            throw new Error(
              response.data.error || 'Pipedrive activity creation failed'
            );
          }

          return response.data.data;
        } catch (error: any) {
          throw new CRMError(
            'Pipedrive',
            'createActivity',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  /**
   * Update activity (mark as done, update details)
   */
  async updateActivity(
    integration: CRMIntegration,
    activityId: string,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const params = await this.addAuthParam(integration);

        const updateData: any = {};

        if (payload.fields?.title) updateData.subject = payload.fields.title;
        if (payload.fields?.description) updateData.note = payload.fields.description;
        if (payload.fields?.done !== undefined) updateData.done = payload.fields.done;
        if (payload.fields?.dueDate) {
          const dueDate = new Date(payload.fields.dueDate);
          updateData.due_date = dueDate.toISOString().split('T')[0];
          updateData.due_time = dueDate.toTimeString().slice(0, 5);
        }

        try {
          const response = await this.httpClient.put(
            `/activities/${activityId}`,
            updateData,
            { params }
          );

          if (!response.data.success) {
            throw new Error(
              response.data.error || 'Pipedrive activity update failed'
            );
          }

          return response.data.data;
        } catch (error: any) {
          throw new CRMError(
            'Pipedrive',
            'updateActivity',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  // ==================== DEAL OPERATIONS ====================

  /**
   * Update deal in Pipedrive
   */
  async updateDeal(
    integration: CRMIntegration,
    dealId: string,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const params = await this.addAuthParam(integration);

        const updateData: any = {};

        // Map common deal fields
        if (payload.fields?.dealName || payload.fields?.title) {
          updateData.title = payload.fields?.dealName || payload.fields?.title;
        }
        if (payload.fields?.amount !== undefined) {
          updateData.value = payload.fields.amount;
        }
        if (payload.fields?.stage || payload.fields?.stageId) {
          updateData.stage_id = parseInt(
            payload.fields?.stage || payload.fields?.stageId,
            10
          );
        }
        if (payload.fields?.status) {
          updateData.status = payload.fields.status;
        }
        if (payload.fields?.probability !== undefined) {
          updateData.probability = payload.fields.probability;
        }
        if (payload.fields?.closeDate || payload.fields?.expectedCloseDate) {
          const closeDate = new Date(
            payload.fields?.closeDate || payload.fields?.expectedCloseDate
          );
          updateData.expected_close_date = closeDate.toISOString().split('T')[0];
        }

        // Associate with person
        if (payload.fields?.personId || payload.fields?.contactId) {
          updateData.person_id = parseInt(
            payload.fields?.personId || payload.fields?.contactId,
            10
          );
        }

        // Associate with organization
        if (payload.fields?.organizationId) {
          updateData.org_id = parseInt(payload.fields.organizationId, 10);
        }

        try {
          const response = await this.httpClient.put(`/deals/${dealId}`, updateData, {
            params,
          });

          if (!response.data.success) {
            throw new Error(response.data.error || 'Pipedrive deal update failed');
          }

          return response.data.data;
        } catch (error: any) {
          throw new CRMError(
            'Pipedrive',
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
   * Create deal in Pipedrive
   */
  async createDeal(
    integration: CRMIntegration,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const params = await this.addAuthParam(integration);

        const dealData: any = {
          title: payload.fields?.dealName || payload.fields?.title || 'New Deal',
        };

        if (payload.fields?.amount !== undefined) {
          dealData.value = payload.fields.amount;
        }
        if (payload.fields?.currency) {
          dealData.currency = payload.fields.currency;
        }
        if (payload.fields?.stageId) {
          dealData.stage_id = parseInt(payload.fields.stageId, 10);
        }
        if (payload.fields?.personId || payload.fields?.contactId) {
          dealData.person_id = parseInt(
            payload.fields?.personId || payload.fields?.contactId,
            10
          );
        }
        if (payload.fields?.organizationId) {
          dealData.org_id = parseInt(payload.fields.organizationId, 10);
        }

        try {
          const response = await this.httpClient.post('/deals', dealData, {
            params,
          });

          if (!response.data.success) {
            throw new Error(response.data.error || 'Pipedrive deal creation failed');
          }

          return response.data.data;
        } catch (error: any) {
          throw new CRMError(
            'Pipedrive',
            'createDeal',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  // ==================== PERSON (CONTACT) OPERATIONS ====================

  /**
   * Create person (contact) in Pipedrive
   */
  async createPerson(
    integration: CRMIntegration,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const params = await this.addAuthParam(integration);

        const personData: any = {
          name:
            payload.fields?.name ||
            `${payload.fields?.firstName || ''} ${payload.fields?.lastName || ''}`.trim() ||
            'New Contact',
        };

        // Add email
        if (payload.fields?.email) {
          personData.email = [{ value: payload.fields.email, primary: true }];
        }

        // Add phone
        if (payload.fields?.phone) {
          personData.phone = [{ value: payload.fields.phone, primary: true }];
        }

        // Associate with organization
        if (payload.fields?.organizationId) {
          personData.org_id = parseInt(payload.fields.organizationId, 10);
        }

        // Add custom fields
        if (payload.fields?.customFields) {
          Object.assign(personData, payload.fields.customFields);
        }

        try {
          const response = await this.httpClient.post('/persons', personData, {
            params,
          });

          if (!response.data.success) {
            throw new Error(
              response.data.error || 'Pipedrive person creation failed'
            );
          }

          return response.data.data;
        } catch (error: any) {
          throw new CRMError(
            'Pipedrive',
            'createPerson',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  /**
   * Update person in Pipedrive
   */
  async updatePerson(
    integration: CRMIntegration,
    personId: string,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const params = await this.addAuthParam(integration);

        const updateData: any = {};

        if (payload.fields?.name) updateData.name = payload.fields.name;
        if (payload.fields?.email) {
          updateData.email = [{ value: payload.fields.email, primary: true }];
        }
        if (payload.fields?.phone) {
          updateData.phone = [{ value: payload.fields.phone, primary: true }];
        }
        if (payload.fields?.organizationId) {
          updateData.org_id = parseInt(payload.fields.organizationId, 10);
        }

        try {
          const response = await this.httpClient.put(
            `/persons/${personId}`,
            updateData,
            { params }
          );

          if (!response.data.success) {
            throw new Error(
              response.data.error || 'Pipedrive person update failed'
            );
          }

          return response.data.data;
        } catch (error: any) {
          throw new CRMError(
            'Pipedrive',
            'updatePerson',
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
   * Get deal by ID
   */
  async getDeal(integration: CRMIntegration, dealId: string): Promise<any> {
    return withCRMRetry(
      async () => {
        const params = await this.addAuthParam(integration);

        try {
          const response = await this.httpClient.get(`/deals/${dealId}`, {
            params,
          });

          if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to fetch deal');
          }

          return response.data.data;
        } catch (error: any) {
          throw new CRMError(
            'Pipedrive',
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
   * Get person by ID
   */
  async getPerson(integration: CRMIntegration, personId: string): Promise<any> {
    return withCRMRetry(
      async () => {
        const params = await this.addAuthParam(integration);

        try {
          const response = await this.httpClient.get(`/persons/${personId}`, {
            params,
          });

          if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to fetch person');
          }

          return response.data.data;
        } catch (error: any) {
          throw new CRMError(
            'Pipedrive',
            'getPerson',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  /**
   * Search persons by email
   */
  async searchPersonByEmail(
    integration: CRMIntegration,
    email: string
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const params = await this.addAuthParam(integration, {
          term: email,
          fields: 'email',
          exact_match: 1,
        });

        try {
          const response = await this.httpClient.get('/persons/search', {
            params,
          });

          if (!response.data.success) {
            throw new Error(response.data.error || 'Search failed');
          }

          return response.data.data?.items?.[0]?.item || null;
        } catch (error: any) {
          throw new CRMError(
            'Pipedrive',
            'searchPersonByEmail',
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
   * Map activity type to Pipedrive format
   */
  private mapActivityType(type: string): string {
    const typeMap: Record<string, string> = {
      task: 'task',
      call: 'call',
      meeting: 'meeting',
      email: 'email',
      lunch: 'lunch',
      deadline: 'deadline',
    };

    return typeMap[type.toLowerCase()] || 'task';
  }
}

export const pipedriveService = new PipedriveService();
