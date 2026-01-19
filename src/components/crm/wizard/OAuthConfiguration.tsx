// ============================================
// OAUTH CONFIGURATION - Step 2 of Wizard
// ============================================

import React, { useState } from 'react';
import { CRMPlatform, CRMIntegration } from '../../../types/crmTypes';
import { ExternalLink, Key, AlertCircle, ArrowLeft } from 'lucide-react';

interface OAuthConfigurationProps {
  platform: CRMPlatform;
  onComplete: (data: Partial<CRMIntegration>) => void;
  onBack: () => void;
}

const platformInfo = {
  hubspot: {
    name: 'HubSpot',
    docsUrl: 'https://developers.hubspot.com/',
    setupSteps: [
      'Go to HubSpot Developer Portal',
      'Create a new app or select existing',
      'Navigate to the Auth tab',
      'Copy your Client ID and Secret',
      'Add redirect URL: http://localhost:3003/api/crm/callback/hubspot',
    ],
    requiredScopes: [
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
      'crm.objects.companies.read',
      'crm.objects.companies.write',
    ],
  },
  salesforce: {
    name: 'Salesforce',
    docsUrl: 'https://developer.salesforce.com/',
    setupSteps: [
      'Log into Salesforce',
      'Go to Setup → Apps → App Manager',
      'Click "New Connected App"',
      'Enable OAuth Settings',
      'Add callback URL: http://localhost:3003/api/crm/callback/salesforce',
      'Copy Consumer Key and Secret',
    ],
    requiredScopes: ['full', 'refresh_token', 'offline_access', 'api'],
  },
  pipedrive: {
    name: 'Pipedrive',
    docsUrl: 'https://pipedrive.readme.io/',
    setupSteps: [
      'Go to Pipedrive Marketplace Manager',
      'Create a Private App',
      'Add OAuth redirect URL: http://localhost:3003/api/crm/callback/pipedrive',
      'Copy Client ID and Secret',
      'Alternatively, use your API Token for simpler setup',
    ],
    requiredScopes: ['deals:full', 'contacts:full', 'activities:full', 'users:read'],
  },
  zoho: {
    name: 'Zoho CRM',
    docsUrl: 'https://www.zoho.com/crm/developer/',
    setupSteps: [
      'Go to Zoho API Console',
      'Click "Add Client" → Server-based Applications',
      'Enter your app name and homepage URL',
      'Add redirect URI: http://localhost:3003/api/crm/callback/zoho',
      'Copy Client ID and Secret',
    ],
    requiredScopes: ['ZohoCRM.modules.ALL', 'ZohoCRM.settings.ALL', 'ZohoCRM.users.READ'],
  },
};

export const OAuthConfiguration: React.FC<OAuthConfigurationProps> = ({
  platform,
  onComplete,
  onBack,
}) => {
  const [useApiKey, setUseApiKey] = useState(platform === 'pipedrive');
  const [apiKey, setApiKey] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const info = platformInfo[platform];

  const handleOAuthStart = () => {
    setIsAuthenticating(true);

    // Build OAuth URL
    const clientId = process.env[`VITE_${platform.toUpperCase()}_CLIENT_ID`];
    if (!clientId) {
      alert(
        `${platform.toUpperCase()}_CLIENT_ID not configured. Add it to your .env file.`
      );
      setIsAuthenticating(false);
      return;
    }

    const redirectUri = `http://localhost:3003/api/crm/callback/${platform}`;
    const state = Math.random().toString(36).substring(7);

    let authUrl = '';
    switch (platform) {
      case 'hubspot':
        authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&scope=crm.objects.contacts.read%20crm.objects.contacts.write%20crm.objects.deals.read%20crm.objects.deals.write&state=${state}`;
        break;

      case 'salesforce':
        authUrl = `https://login.salesforce.com/services/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=full%20refresh_token%20api&state=${state}`;
        break;

      case 'pipedrive':
        authUrl = `https://oauth.pipedrive.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&state=${state}`;
        break;

      case 'zoho':
        authUrl = `https://accounts.zoho.com/oauth/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=ZohoCRM.modules.ALL%20ZohoCRM.settings.ALL%20ZohoCRM.users.READ&access_type=offline&state=${state}`;
        break;
    }

    // Open OAuth popup
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      authUrl,
      'CRM OAuth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // The callback will handle the rest
  };

  const handleApiKeySubmit = () => {
    if (!apiKey.trim()) {
      alert('Please enter your API key');
      return;
    }

    onComplete({
      apiKey: apiKey.trim(),
      platform,
    });
  };

  return (
    <div className="oauth-configuration">
      <button className="wizard-back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to Platform Selection
      </button>

      <div className="oauth-header">
        <h3>Configure {info.name} Integration</h3>
        <p>Follow these steps to connect your {info.name} account</p>
      </div>

      {/* API Key Option for Pipedrive */}
      {platform === 'pipedrive' && (
        <div className="oauth-method-selector">
          <label>
            <input
              type="radio"
              checked={useApiKey}
              onChange={() => setUseApiKey(true)}
            />
            <span>Use API Token (Simpler)</span>
          </label>
          <label>
            <input
              type="radio"
              checked={!useApiKey}
              onChange={() => setUseApiKey(false)}
            />
            <span>Use OAuth (More Secure)</span>
          </label>
        </div>
      )}

      {useApiKey && platform === 'pipedrive' ? (
        // API Key Flow
        <div className="oauth-api-key">
          <div className="oauth-info-box">
            <Key size={20} />
            <div>
              <strong>Using API Token</strong>
              <p>
                Get your API token from Pipedrive Settings → Personal Preferences → API
              </p>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="api-key">Pipedrive API Token</label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Pipedrive API token"
              className="oauth-input"
            />
          </div>

          <div className="oauth-actions">
            <button className="btn btn-primary" onClick={handleApiKeySubmit}>
              Continue with API Token
            </button>
          </div>
        </div>
      ) : (
        // OAuth Flow
        <div className="oauth-flow">
          {/* Setup Instructions */}
          <div className="oauth-instructions">
            <h4>Setup Steps</h4>
            <ol>
              {info.setupSteps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>

          {/* Required Scopes */}
          <div className="oauth-scopes">
            <h4>Required Permissions</h4>
            <div className="scope-list">
              {info.requiredScopes.map((scope, index) => (
                <span key={index} className="scope-badge">
                  {scope}
                </span>
              ))}
            </div>
          </div>

          {/* Warning Box */}
          <div className="oauth-warning">
            <AlertCircle size={20} />
            <div>
              <strong>Before you continue:</strong>
              <p>
                Make sure you've configured your OAuth app in {info.name} with the correct
                redirect URL and client credentials in your environment variables.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="oauth-actions">
            <a
              href={info.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <ExternalLink size={16} />
              Open {info.name} Docs
            </a>

            <button
              className="btn btn-primary"
              onClick={handleOAuthStart}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? 'Waiting for authorization...' : `Authorize ${info.name}`}
            </button>
          </div>

          {isAuthenticating && (
            <div className="oauth-waiting">
              <div className="spinner" />
              <p>Complete the authorization in the popup window...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
