// ============================================
// SETUP COMPLETE - Step 4 of Wizard
// ============================================

import React from 'react';
import { CRMIntegration } from '../../../types/crmTypes';
import { CheckCircle, Zap, Users, TrendingUp } from 'lucide-react';

interface SetupCompleteProps {
  integration: CRMIntegration;
  onFinish: () => void;
}

export const SetupComplete: React.FC<SetupCompleteProps> = ({ integration, onFinish }) => {
  const platformNames = {
    hubspot: 'HubSpot',
    salesforce: 'Salesforce',
    pipedrive: 'Pipedrive',
    zoho: 'Zoho CRM',
  };

  const nextSteps = [
    {
      icon: <Zap size={24} />,
      title: 'Start Syncing',
      description: 'Your contacts and deals will automatically sync with Pulse',
    },
    {
      icon: <Users size={24} />,
      title: 'Create CRM Actions',
      description: 'Use action buttons in messages to create tasks, update deals, and log calls',
    },
    {
      icon: <TrendingUp size={24} />,
      title: 'Track Progress',
      description: 'View CRM data in the sidepanel while chatting with contacts',
    },
  ];

  return (
    <div className="setup-complete">
      {/* Success Icon */}
      <div className="setup-complete-icon">
        <CheckCircle size={64} className="success-icon" />
      </div>

      {/* Success Message */}
      <div className="setup-complete-header">
        <h3>Setup Complete!</h3>
        <p>
          Your {platformNames[integration.platform]} integration "{integration.displayName}" is now
          active and ready to use.
        </p>
      </div>

      {/* Integration Details */}
      <div className="setup-complete-details">
        <div className="detail-row">
          <span className="detail-label">Platform</span>
          <span className="detail-value">{platformNames[integration.platform]}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Integration Name</span>
          <span className="detail-value">{integration.displayName}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Status</span>
          <span className="detail-value">
            <span className="status-badge status-active">Active</span>
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Sync Enabled</span>
          <span className="detail-value">
            {integration.syncEnabled ? 'Yes' : 'No'}
          </span>
        </div>
      </div>

      {/* Next Steps */}
      <div className="setup-next-steps">
        <h4>What's Next?</h4>
        <div className="next-steps-grid">
          {nextSteps.map((step, index) => (
            <div key={index} className="next-step-card">
              <div className="next-step-icon">{step.icon}</div>
              <h5>{step.title}</h5>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="setup-complete-actions">
        <button className="btn btn-primary btn-large" onClick={onFinish}>
          Go to Integrations
        </button>
        <a href="/docs/crm-features" className="btn btn-secondary btn-large">
          Learn More
        </a>
      </div>

      {/* Help Text */}
      <div className="setup-complete-help">
        <p>
          Need help? Check out our{' '}
          <a href="/docs/crm-setup" target="_blank" rel="noopener noreferrer">
            CRM integration guide
          </a>{' '}
          or{' '}
          <a href="/support" target="_blank" rel="noopener noreferrer">
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  );
};
