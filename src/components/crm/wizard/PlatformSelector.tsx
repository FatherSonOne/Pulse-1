// ============================================
// PLATFORM SELECTOR - Step 1 of Wizard
// ============================================

import React from 'react';
import { CRMPlatform } from '../../../types/crmTypes';
import { CheckCircle } from 'lucide-react';

interface PlatformSelectorProps {
  onSelect: (platform: CRMPlatform) => void;
}

interface PlatformInfo {
  id: CRMPlatform;
  name: string;
  description: string;
  features: string[];
  color: string;
  logo: string;
}

const platforms: PlatformInfo[] = [
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'All-in-one CRM platform for marketing, sales, and service',
    features: ['Contact Management', 'Deal Tracking', 'Email Integration', 'Task Automation'],
    color: '#FF7A59',
    logo: '🟠',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'World\'s #1 CRM platform for enterprise sales teams',
    features: ['Opportunity Management', 'Lead Tracking', 'Custom Objects', 'Advanced Analytics'],
    color: '#00A1E0',
    logo: '☁️',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    description: 'Sales-focused CRM built for pipeline management',
    features: ['Visual Pipeline', 'Activity Tracking', 'Deal Management', 'Sales Reports'],
    color: '#1D8C3D',
    logo: '📊',
  },
  {
    id: 'zoho',
    name: 'Zoho CRM',
    description: 'Comprehensive CRM with AI-powered sales assistant',
    features: ['AI Assistant', 'Workflow Automation', 'Multi-Channel Support', 'Analytics'],
    color: '#E42527',
    logo: '🔵',
  },
];

export const PlatformSelector: React.FC<PlatformSelectorProps> = ({ onSelect }) => {
  return (
    <div className="platform-selector">
      <div className="platform-selector-intro">
        <h3>Choose your CRM platform</h3>
        <p>Select the CRM you want to connect to Pulse. You can add multiple integrations later.</p>
      </div>

      <div className="platform-grid">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            className="platform-card"
            onClick={() => onSelect(platform.id)}
            style={{ '--platform-color': platform.color } as React.CSSProperties}
          >
            <div className="platform-card-header">
              <span className="platform-logo">{platform.logo}</span>
              <h4>{platform.name}</h4>
            </div>

            <p className="platform-description">{platform.description}</p>

            <ul className="platform-features">
              {platform.features.map((feature, index) => (
                <li key={index}>
                  <CheckCircle size={16} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="platform-card-footer">
              <span className="platform-cta">Connect {platform.name}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="platform-selector-help">
        <p>
          <strong>Need help?</strong> Check out our{' '}
          <a href="/docs/crm-setup" target="_blank" rel="noopener noreferrer">
            CRM setup guide
          </a>{' '}
          for detailed instructions.
        </p>
      </div>
    </div>
  );
};
