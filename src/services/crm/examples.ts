// ============================================
// CRM Integration Usage Examples
// Demonstrates how to use each CRM service
// ============================================

import { CRMIntegration, CRMActionPayload } from '../../types/crmTypes';
import { hubspotService } from './hubspotService';
import { salesforceService } from './salesforceService';
import { pipedriveService } from './pipedriveService';
import { zohoService } from './zohoService';
import { generateAuthUrl, exchangeCodeForToken } from './oauthHelper';

/**
 * Example 1: OAuth Flow for Any CRM
 */
export async function exampleOAuthFlow(
  platform: 'hubspot' | 'salesforce' | 'pipedrive' | 'zoho'
) {
  // Step 1: Generate authorization URL
  const clientId = process.env[`${platform.toUpperCase()}_CLIENT_ID`];
  const redirectUri = process.env[`${platform.toUpperCase()}_REDIRECT_URI`];

  if (!clientId || !redirectUri) {
    throw new Error(`Missing ${platform} OAuth credentials`);
  }

  const authUrl = generateAuthUrl(platform, clientId, redirectUri, 'random-state');

  console.log(`Redirect user to: ${authUrl}`);

  // Step 2: After user authorizes, you'll receive a code in the callback
  // Exchange code for tokens
  const code = 'authorization_code_from_callback';
  const clientSecret = process.env[`${platform.toUpperCase()}_CLIENT_SECRET`];

  const tokens = await exchangeCodeForToken(
    platform,
    code,
    clientId,
    clientSecret!,
    redirectUri
  );

  console.log('Tokens received:', {
    access_token: tokens.access_token.slice(0, 10) + '...',
    refresh_token: tokens.refresh_token?.slice(0, 10) + '...',
    expires_in: tokens.expires_in,
  });

  // Step 3: Store tokens in your CRM integration record
  return tokens;
}

/**
 * Example 2: Create Task in All CRMs
 */
export async function exampleCreateTaskAllPlatforms(
  integrations: Record<string, CRMIntegration>
) {
  const payload: CRMActionPayload = {
    fields: {
      title: 'Follow up with lead',
      description: 'Discuss pricing and next steps',
      priority: 'high',
      dueDate: new Date(Date.now() + 86400000), // Tomorrow
    },
    associatedRecordId: 'contact-123',
    associatedRecordType: 'contact',
  };

  // HubSpot
  if (integrations.hubspot) {
    const task = await hubspotService.createTask(integrations.hubspot, payload);
    console.log('HubSpot task created:', task.id);
  }

  // Salesforce
  if (integrations.salesforce) {
    const task = await salesforceService.createTask(integrations.salesforce, payload);
    console.log('Salesforce task created:', task.id);
  }

  // Pipedrive
  if (integrations.pipedrive) {
    const activity = await pipedriveService.createActivity(
      integrations.pipedrive,
      payload
    );
    console.log('Pipedrive activity created:', activity.id);
  }

  // Zoho
  if (integrations.zoho) {
    const task = await zohoService.createTask(integrations.zoho, payload);
    console.log('Zoho task created:', task.id);
  }
}

/**
 * Example 3: Update Deal in All CRMs
 */
export async function exampleUpdateDealAllPlatforms(
  integrations: Record<string, CRMIntegration>,
  dealIds: Record<string, string>
) {
  const payload: CRMActionPayload = {
    fields: {
      stage: 'Negotiation',
      amount: 50000,
      closeDate: new Date('2026-03-31'),
      probability: 75,
    },
  };

  // HubSpot
  if (integrations.hubspot && dealIds.hubspot) {
    await hubspotService.updateDeal(
      integrations.hubspot,
      dealIds.hubspot,
      payload
    );
    console.log('HubSpot deal updated');
  }

  // Salesforce
  if (integrations.salesforce && dealIds.salesforce) {
    await salesforceService.updateOpportunity(
      integrations.salesforce,
      dealIds.salesforce,
      payload
    );
    console.log('Salesforce opportunity updated');
  }

  // Pipedrive
  if (integrations.pipedrive && dealIds.pipedrive) {
    await pipedriveService.updateDeal(
      integrations.pipedrive,
      dealIds.pipedrive,
      payload
    );
    console.log('Pipedrive deal updated');
  }

  // Zoho
  if (integrations.zoho && dealIds.zoho) {
    await zohoService.updateDeal(integrations.zoho, dealIds.zoho, payload);
    console.log('Zoho deal updated');
  }
}

/**
 * Example 4: Log Call Activity
 */
export async function exampleLogCall(integration: CRMIntegration) {
  const callPayload: CRMActionPayload = {
    fields: {
      title: 'Discovery Call',
      notes: 'Discussed product requirements and timeline',
      duration: 1800, // 30 minutes in seconds
      callTime: new Date(),
      outcome: 'Connected',
    },
    associatedRecordId: 'contact-123',
    associatedRecordType: 'contact',
  };

  switch (integration.platform) {
    case 'hubspot':
      const call = await hubspotService.logCall(integration, callPayload);
      console.log('HubSpot call logged:', call.id);
      break;

    case 'salesforce':
      const activity = await salesforceService.logActivity(integration, callPayload);
      console.log('Salesforce activity logged:', activity.id);
      break;

    case 'pipedrive':
      const pipedriveCall = await pipedriveService.createActivity(integration, {
        ...callPayload,
        fields: { ...callPayload.fields, activityType: 'call' },
      });
      console.log('Pipedrive call logged:', pipedriveCall.id);
      break;

    case 'zoho':
      const zohoCall = await zohoService.logCall(integration, callPayload);
      console.log('Zoho call logged:', zohoCall.id);
      break;
  }
}

/**
 * Example 5: Create Contact with Proper Field Mapping
 */
export async function exampleCreateContact(integration: CRMIntegration) {
  const contactPayload: CRMActionPayload = {
    fields: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1-555-0123',
      company: 'Acme Corp',
      jobTitle: 'Director of Sales',
      lifecycleStage: 'lead',
    },
  };

  switch (integration.platform) {
    case 'hubspot':
      const hsContact = await hubspotService.createContact(
        integration,
        contactPayload
      );
      console.log('HubSpot contact created:', hsContact.id);
      return hsContact;

    case 'salesforce':
      const sfContact = await salesforceService.createContact(
        integration,
        contactPayload
      );
      console.log('Salesforce contact created:', sfContact.id);
      return sfContact;

    case 'pipedrive':
      const pdPerson = await pipedriveService.createPerson(
        integration,
        contactPayload
      );
      console.log('Pipedrive person created:', pdPerson.id);
      return pdPerson;

    case 'zoho':
      const zohoContact = await zohoService.createContact(
        integration,
        contactPayload
      );
      console.log('Zoho contact created:', zohoContact.id);
      return zohoContact;
  }
}

/**
 * Example 6: Search Contact by Email
 */
export async function exampleSearchContact(
  integration: CRMIntegration,
  email: string
) {
  let contact;

  switch (integration.platform) {
    case 'hubspot':
      contact = await hubspotService.searchContactByEmail(integration, email);
      break;

    case 'salesforce':
      contact = await salesforceService.searchContactByEmail(integration, email);
      break;

    case 'pipedrive':
      contact = await pipedriveService.searchPersonByEmail(integration, email);
      break;

    case 'zoho':
      contact = await zohoService.searchContactByEmail(integration, email);
      break;
  }

  if (contact) {
    console.log(`Found contact in ${integration.platform}:`, contact);
  } else {
    console.log(`No contact found with email: ${email}`);
  }

  return contact;
}

/**
 * Example 7: Bi-Directional Sync Pattern
 */
export async function exampleBiDirectionalSync(
  integration: CRMIntegration,
  pulseContactId: string
) {
  // 1. Get contact from Pulse database
  // (This would be from your Supabase contacts table)
  const pulseContact = {
    id: pulseContactId,
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    phone: '+1-555-0456',
  };

  // 2. Check if contact exists in CRM
  const crmContact = await exampleSearchContact(integration, pulseContact.email);

  if (crmContact) {
    // Contact exists - update it
    console.log('Contact exists, updating...');
    // Use appropriate update method based on platform
  } else {
    // Contact doesn't exist - create it
    console.log('Contact not found, creating...');
    const newContact = await exampleCreateContact(integration);

    // Store mapping between Pulse ID and CRM ID
    console.log('Store mapping:', {
      pulseId: pulseContactId,
      crmId: newContact.id,
      platform: integration.platform,
    });
  }
}

/**
 * Example 8: Batch Operations with Rate Limiting
 */
export async function exampleBatchOperations(integration: CRMIntegration) {
  const { batchWithRateLimit } = await import('./retryHelper');

  const contacts = [
    { firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com' },
    { firstName: 'Bob', lastName: 'Williams', email: 'bob@example.com' },
    { firstName: 'Carol', lastName: 'Davis', email: 'carol@example.com' },
    // ... more contacts
  ];

  const results = await batchWithRateLimit(
    contacts,
    async (contact) => {
      const payload: CRMActionPayload = {
        fields: contact,
      };
      return await exampleCreateContact(integration);
    },
    {
      batchSize: 10, // Process 10 at a time
      delayBetweenBatches: 2000, // 2 second delay between batches
    }
  );

  console.log(`Created ${results.length} contacts`);
  return results;
}

/**
 * Example 9: Error Handling
 */
export async function exampleErrorHandling(integration: CRMIntegration) {
  const { CRMError } = await import('./retryHelper');

  try {
    const payload: CRMActionPayload = {
      fields: {
        title: 'Test Task',
        description: 'Testing error handling',
      },
    };

    await hubspotService.createTask(integration, payload);
  } catch (error) {
    if (error instanceof CRMError) {
      console.error('CRM Operation Failed:', {
        platform: error.platform,
        operation: error.operation,
        statusCode: error.statusCode,
        message: error.message,
      });

      // Handle specific error types
      if (error.statusCode === 401) {
        console.log('Token expired - automatic refresh will be attempted');
      } else if (error.statusCode === 429) {
        console.log('Rate limited - automatic retry with backoff');
      } else if (error.statusCode === 404) {
        console.log('Resource not found - check record ID');
      }
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

/**
 * Example 10: Complete Integration Workflow
 */
export async function exampleCompleteWorkflow() {
  // Step 1: User initiates OAuth
  const platform = 'hubspot';
  console.log('Step 1: Generating OAuth URL...');
  // const authUrl = generateAuthUrl(...);

  // Step 2: After OAuth callback, create integration
  console.log('Step 2: Creating integration...');
  // const integration = await crmService.createIntegration(...);

  // Step 3: Run initial sync
  console.log('Step 3: Running initial sync...');
  // const syncResult = await crmService.fullSync(integration.id);

  // Step 4: Create task from message
  console.log('Step 4: Creating task from message...');
  const taskPayload: CRMActionPayload = {
    fields: {
      title: 'Follow up on inquiry',
      description: 'User asked about pricing',
      dueDate: new Date(Date.now() + 86400000),
    },
  };
  // await crmActionsService.createAction('create_task', ...);

  // Step 5: Update deal when conversation progresses
  console.log('Step 5: Updating deal...');
  const dealPayload: CRMActionPayload = {
    fields: {
      stage: 'Qualified',
      amount: 25000,
    },
  };
  // await crmActionsService.createAction('update_deal', ...);

  console.log('Workflow complete!');
}
