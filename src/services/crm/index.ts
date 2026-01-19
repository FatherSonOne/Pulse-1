// ============================================
// CRM Services Export
// Central export point for all CRM integrations
// ============================================

export { hubspotService, HubSpotService } from './hubspotService';
export { salesforceService, SalesforceService } from './salesforceService';
export { pipedriveService, PipedriveService } from './pipedriveService';
export { zohoService, ZohoService } from './zohoService';

export {
  generateAuthUrl,
  exchangeCodeForToken,
  refreshCRMToken,
  getValidAccessToken,
  isTokenExpired,
  CRM_OAUTH_CONFIGS,
  type OAuthConfig,
} from './oauthHelper';

export {
  withCRMRetry,
  withTimeout,
  batchWithRateLimit,
  parseCRMError,
  CRMError,
  type RetryOptions,
} from './retryHelper';
