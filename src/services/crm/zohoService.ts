// ============================================
// ZOHO CRM SERVICE
// Complete implementation for Zoho CRM API operations
// ============================================

import axios, { AxiosInstance } from 'axios';
import { CRMIntegration, CRMActionPayload } from '../../types/crmTypes';
import { getValidAccessToken } from './oauthHelper';
import { withCRMRetry, CRMError, parseCRMError } from './retryHelper';

const ZOHO_API_BASE = 'https://www.zohoapis.com/crm/v3';

export class ZohoService {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      baseURL: ZOHO_API_BASE,
      timeout: 30000,
    });
  }

  /**
   * Create authenticated headers
   */
  private async getHeaders(integration: CRMIntegration): Promise<Record<string, string>> {
    const accessToken = await getValidAccessToken(integration);
    return {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  // ==================== TASK OPERATIONS ====================

  /**
   * Create task in Zoho CRM
   */
  async createTask(
    integration: CRMIntegration,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);

        const taskData: any = {
          Subject: payload.fields?.title || payload.title || 'New Task',
          Description: payload.fields?.description || payload.description || '',
          Priority: this.mapPriority(payload.fields?.priority),
          Status: 'Not Started',
        };

        // Add due date
        if (payload.fields?.dueDate || payload.dueDate) {
          const dueDate = new Date(payload.fields?.dueDate || payload.dueDate);
          taskData.Due_Date = dueDate.toISOString().split('T')[0];
        }

        // Associate with related record (Contact, Deal, etc.)
        if (payload.associatedRecordId) {
          const relationType = this.getRelationType(
            payload.associatedRecordType || 'contact'
          );
          taskData[`$se_module`] = relationType;
          taskData.What_Id = payload.associatedRecordId;
        }

        const requestBody = {
          data: [taskData],
        };

        try {
          const response = await this.httpClient.post('/Tasks', requestBody, {
            headers,
          });

          if (!response.data.data?.[0]?.status === 'success') {
            throw new Error(
              response.data.data?.[0]?.message || 'Zoho task creation failed'
            );
          }

          return response.data.data[0].details;
        } catch (error: any) {
          throw new CRMError(
            'Zoho',
            'createTask',
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
   * Update deal in Zoho CRM
   */
  async updateDeal(
    integration: CRMIntegration,
    dealId: string,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);

        const updateData: any = {};

        // Map common deal fields
        if (payload.fields?.dealName || payload.fields?.title) {
          updateData.Deal_Name = payload.fields?.dealName || payload.fields?.title;
        }
        if (payload.fields?.amount !== undefined) {
          updateData.Amount = payload.fields.amount;
        }
        if (payload.fields?.stage) {
          updateData.Stage = payload.fields.stage;
        }
        if (payload.fields?.closeDate) {
          updateData.Closing_Date = new Date(payload.fields.closeDate)
            .toISOString()
            .split('T')[0];
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

        const requestBody = {
          data: [updateData],
        };

        try {
          const response = await this.httpClient.put(`/Deals/${dealId}`, requestBody, {
            headers,
          });

          if (response.data.data?.[0]?.status !== 'success') {
            throw new Error(
              response.data.data?.[0]?.message || 'Zoho deal update failed'
            );
          }

          return response.data.data[0].details;
        } catch (error: any) {
          throw new CRMError(
            'Zoho',
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
   * Create deal in Zoho CRM
   */
  async createDeal(
    integration: CRMIntegration,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);

        const dealData: any = {
          Deal_Name: payload.fields?.dealName || payload.fields?.title || 'New Deal',
          Stage: payload.fields?.stage || 'Qualification',
        };

        if (payload.fields?.amount !== undefined) {
          dealData.Amount = payload.fields.amount;
        }
        if (payload.fields?.closeDate) {
          dealData.Closing_Date = new Date(payload.fields.closeDate)
            .toISOString()
            .split('T')[0];
        }
        if (payload.fields?.contactId) {
          dealData.Contact_Name = payload.fields.contactId;
        }
        if (payload.fields?.accountId) {
          dealData.Account_Name = payload.fields.accountId;
        }

        const requestBody = {
          data: [dealData],
        };

        try {
          const response = await this.httpClient.post('/Deals', requestBody, {
            headers,
          });

          if (response.data.data?.[0]?.status !== 'success') {
            throw new Error(
              response.data.data?.[0]?.message || 'Zoho deal creation failed'
            );
          }

          return response.data.data[0].details;
        } catch (error: any) {
          throw new CRMError(
            'Zoho',
            'createDeal',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  // ==================== CONTACT OPERATIONS ====================

  /**
   * Create contact in Zoho CRM
   */
  async createContact(
    integration: CRMIntegration,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);

        const contactData: any = {};

        // Map standard contact fields
        if (payload.fields?.firstName) contactData.First_Name = payload.fields.firstName;
        if (payload.fields?.lastName) contactData.Last_Name = payload.fields.lastName;
        if (payload.fields?.email) contactData.Email = payload.fields.email;
        if (payload.fields?.phone) contactData.Phone = payload.fields.phone;
        if (payload.fields?.company || payload.fields?.accountName) {
          contactData.Account_Name = payload.fields.company || payload.fields.accountName;
        }
        if (payload.fields?.jobTitle) contactData.Title = payload.fields.jobTitle;
        if (payload.fields?.mobilePhone) contactData.Mobile = payload.fields.mobilePhone;
        if (payload.fields?.description) contactData.Description = payload.fields.description;

        // Lead source
        if (payload.fields?.leadSource) {
          contactData.Lead_Source = payload.fields.leadSource;
        }

        // Add custom fields
        if (payload.fields?.customFields) {
          Object.assign(contactData, payload.fields.customFields);
        }

        const requestBody = {
          data: [contactData],
        };

        try {
          const response = await this.httpClient.post('/Contacts', requestBody, {
            headers,
          });

          if (response.data.data?.[0]?.status !== 'success') {
            throw new Error(
              response.data.data?.[0]?.message || 'Zoho contact creation failed'
            );
          }

          return response.data.data[0].details;
        } catch (error: any) {
          throw new CRMError(
            'Zoho',
            'createContact',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  /**
   * Update contact in Zoho CRM
   */
  async updateContact(
    integration: CRMIntegration,
    contactId: string,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);

        const updateData: any = {};

        if (payload.fields?.firstName) updateData.First_Name = payload.fields.firstName;
        if (payload.fields?.lastName) updateData.Last_Name = payload.fields.lastName;
        if (payload.fields?.email) updateData.Email = payload.fields.email;
        if (payload.fields?.phone) updateData.Phone = payload.fields.phone;
        if (payload.fields?.jobTitle) updateData.Title = payload.fields.jobTitle;

        const requestBody = {
          data: [updateData],
        };

        try {
          const response = await this.httpClient.put(
            `/Contacts/${contactId}`,
            requestBody,
            { headers }
          );

          if (response.data.data?.[0]?.status !== 'success') {
            throw new Error(
              response.data.data?.[0]?.message || 'Zoho contact update failed'
            );
          }

          return response.data.data[0].details;
        } catch (error: any) {
          throw new CRMError(
            'Zoho',
            'updateContact',
            error.response?.status,
            parseCRMError(error)
          );
        }
      },
      integration
    );
  }

  // ==================== ACTIVITY/NOTE OPERATIONS ====================

  /**
   * Log call/activity as a note in Zoho CRM
   */
  async logCall(
    integration: CRMIntegration,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);

        const callData: any = {
          Call_Type: payload.fields?.callType || 'Outbound',
          Subject: payload.fields?.title || payload.title || 'Call',
          Description: payload.fields?.notes || payload.notes || '',
          Call_Start_Time: payload.fields?.callTime
            ? new Date(payload.fields.callTime).toISOString()
            : new Date().toISOString(),
        };

        // Add duration (in seconds)
        if (payload.fields?.duration) {
          callData.Call_Duration = payload.fields.duration.toString();
        }

        // Call outcome
        if (payload.fields?.outcome) {
          callData.Call_Result = payload.fields.outcome;
        }

        // Associate with record
        if (payload.associatedRecordId) {
          const relationType = this.getRelationType(
            payload.associatedRecordType || 'contact'
          );
          callData[`$se_module`] = relationType;
          callData.What_Id = payload.associatedRecordId;
        }

        const requestBody = {
          data: [callData],
        };

        try {
          const response = await this.httpClient.post('/Calls', requestBody, {
            headers,
          });

          if (response.data.data?.[0]?.status !== 'success') {
            throw new Error(
              response.data.data?.[0]?.message || 'Zoho call logging failed'
            );
          }

          return response.data.data[0].details;
        } catch (error: any) {
          throw new CRMError(
            'Zoho',
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
   * Create note attached to a record
   */
  async createNote(
    integration: CRMIntegration,
    payload: CRMActionPayload
  ): Promise<any> {
    return withCRMRetry(
      async () => {
        const headers = await this.getHeaders(integration);

        const noteData: any = {
          Note_Title: payload.fields?.title || payload.title || 'Note',
          Note_Content: payload.fields?.content || payload.notes || '',
        };

        // Associate with parent record
        if (payload.associatedRecordId && payload.associatedRecordType) {
          noteData.Parent_Id = payload.associatedRecordId;
          noteData.$se_module = this.getRelationType(payload.associatedRecordType);
        }

        const requestBody = {
          data: [noteData],
        };

        try {
          const response = await this.httpClient.post('/Notes', requestBody, {
            headers,
          });

          if (response.data.data?.[0]?.status !== 'success') {
            throw new Error(
              response.data.data?.[0]?.message || 'Zoho note creation failed'
            );
          }

          return response.data.data[0].details;
        } catch (error: any) {
          throw new CRMError(
            'Zoho',
            'createNote',
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
          const response = await this.httpClient.get(`/Contacts/${contactId}`, {
            headers,
          });

          return response.data.data?.[0] || null;
        } catch (error: any) {
          throw new CRMError(
            'Zoho',
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
          const response = await this.httpClient.get(`/Deals/${dealId}`, {
            headers,
          });

          return response.data.data?.[0] || null;
        } catch (error: any) {
          throw new CRMError(
            'Zoho',
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

        try {
          const response = await this.httpClient.get('/Contacts/search', {
            headers,
            params: {
              criteria: `(Email:equals:${email})`,
            },
          });

          return response.data.data?.[0] || null;
        } catch (error: any) {
          throw new CRMError(
            'Zoho',
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
   * Map priority to Zoho format
   */
  private mapPriority(priority?: string): string {
    if (!priority) return 'Medium';

    const priorityMap: Record<string, string> = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      urgent: 'Highest',
    };

    return priorityMap[priority.toLowerCase()] || 'Medium';
  }

  /**
   * Get Zoho module name for relation type
   */
  private getRelationType(type: string): string {
    const typeMap: Record<string, string> = {
      contact: 'Contacts',
      deal: 'Deals',
      opportunity: 'Deals',
      account: 'Accounts',
      company: 'Accounts',
      lead: 'Leads',
    };

    return typeMap[type.toLowerCase()] || 'Contacts';
  }
}

export const zohoService = new ZohoService();
